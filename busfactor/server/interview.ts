import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { runGit } from "./git.ts";
import { makeRepoTools } from "./tools.ts";
import type { ExamQuestion, InterviewEvent, ModuleStats } from "./types.ts";

/**
 * The closed loop:
 *
 *   1. EXAM      — before any interview happens, an examiner writes N held-out
 *                  onboarding questions (with ground-truth notes) from the code.
 *   2. INTERVIEW — an interviewer agent that has actually read the code and its
 *                  history asks the human owner targeted questions, verifies the
 *                  answers against the repo, and asks follow-ups.
 *   3. DOCS      — the interviewer drafts ADR-style documentation.
 *   4. GRADE     — a fresh "new hire" agent (no code, no transcript — docs only)
 *                  takes the exam; a grader scores it against ground truth.
 *   5. LOOP      — score < PASS_THRESHOLD → the gaps become the next round of
 *                  interview questions. Docs ship only when they provably
 *                  transfer understanding.
 */

const INTERVIEWER_MODEL = process.env.BUSFACTOR_INTERVIEWER_MODEL ?? "claude-opus-4-8";
const EXAMINEE_MODEL = process.env.BUSFACTOR_EXAMINEE_MODEL ?? "claude-sonnet-5";
const GRADER_MODEL = process.env.BUSFACTOR_GRADER_MODEL ?? "claude-haiku-4-5";
const PASS_THRESHOLD = 0.8;
const MAX_ROUNDS = 3;

export function anthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

export interface InterviewSession {
  id: string;
  repoDir: string;
  module: ModuleStats;
  round: number;
  phase: "exploring" | "awaiting_answers" | "working" | "done" | "error";
  exam: ExamQuestion[];
  pendingQuestions: string[];
  transcript: string[];
  docs?: string;
  score?: number;
  events: InterviewEvent[];
  subscribers: Set<(ev: InterviewEvent) => void>;
}

const sessions = new Map<string, InterviewSession>();
export const getSession = (id: string) => sessions.get(id);

function emit(session: InterviewSession, ev: InterviewEvent) {
  session.events.push(ev);
  for (const send of session.subscribers) send(ev);
}

const status = (s: InterviewSession, message: string) => emit(s, { type: "status", message });

// ---------------------------------------------------------------------------
// Context assembly
// ---------------------------------------------------------------------------

async function moduleContext(repoDir: string, modulePath: string): Promise<string> {
  const target = modulePath === "(root)" ? "." : modulePath;
  const listing = (await runGit(["ls-files", "--", target], repoDir))
    .split("\n")
    .filter(Boolean)
    .filter((f) => (modulePath === "(root)" ? !f.includes("/") : true));

  const sized = listing
    .map((f) => {
      try {
        return { f, size: fs.statSync(path.join(repoDir, f)).size };
      } catch {
        return { f, size: 0 };
      }
    })
    .sort((a, b) => b.size - a.size);

  let budget = 26_000;
  const excerpts: string[] = [];
  for (const { f } of sized.slice(0, 8)) {
    if (budget <= 0) break;
    try {
      const text = fs.readFileSync(path.join(repoDir, f), "utf8");
      const head = text.split("\n").slice(0, 120).join("\n").slice(0, Math.min(4000, budget));
      excerpts.push(`===== ${f} (first lines) =====\n${head}`);
      budget -= head.length;
    } catch {
      /* binary/unreadable */
    }
  }
  return `Files in module "${modulePath}":\n${listing.join("\n")}\n\n${excerpts.join("\n\n")}`;
}

function moduleBrief(m: ModuleStats): string {
  const ownerList = m.topOwners
    .map((o) => `${o.name} (${Math.round(o.share * 100)}%)`)
    .join(", ");
  return [
    `Module: ${m.path}`,
    `Risk score: ${m.risk}/100 (tier: ${m.tier})`,
    `Knowledge concentration (HHI): ${m.concentration} — effectively ${m.effectiveOwners} owner(s)`,
    `Recency-weighted owners: ${ownerList}`,
    `Dependency criticality percentile: ${Math.round(m.criticalityPct * 100)}`,
    `Recent-churn percentile: ${Math.round(m.churnPct * 100)}`,
  ].join("\n");
}

const INTERVIEWER_SYSTEM = `You are a senior staff engineer conducting a knowledge-extraction interview before a key engineer becomes unavailable. Your specialty is asking the questions ONLY the code's owner can answer: design intent, rejected alternatives, incident history, invariants that the code enforces silently, and asymmetries a newcomer would trip over.

Rules:
- Ground every question in something concrete you found with your tools: a file, a line, a commit, a constant, an asymmetry between sibling code paths.
- Never ask generic questions ("please describe the module"). Ask the question a sharp reviewer would ask after actually reading the diff history.
- Ask about WHY, not WHAT — the code already says what it does.
- Keep to 3-5 questions per round; make each one count.`;

// ---------------------------------------------------------------------------
// Phase 1 — start: held-out exam, then exploration + first questions
// ---------------------------------------------------------------------------

export async function startInterview(
  repoDir: string,
  module: ModuleStats,
): Promise<InterviewSession> {
  const session: InterviewSession = {
    id: randomUUID().slice(0, 8),
    repoDir,
    module,
    round: 1,
    phase: "exploring",
    exam: [],
    pendingQuestions: [],
    transcript: [],
    events: [],
    subscribers: new Set(),
  };
  sessions.set(session.id, session);

  void (async () => {
    try {
      status(session, `Reading ${module.path} and writing a held-out onboarding exam…`);
      const context = await moduleContext(repoDir, module.path);

      const ExamSchema = z.object({
        questions: z
          .array(
            z.object({
              question: z.string(),
              ground_truth: z
                .string()
                .describe("Model answer with file/line citations, used only for grading"),
            }),
          )
          .min(4)
          .max(6),
      });
      const examResponse = await client().messages.parse({
        model: INTERVIEWER_MODEL,
        max_tokens: 6000,
        thinking: { type: "adaptive" },
        system:
          "You write onboarding exams for software modules. Questions must test real understanding a new maintainer needs (design intent, failure modes, invariants, how pieces interact) — not trivia. Every ground-truth note cites specific files or functions.",
        messages: [
          {
            role: "user",
            content: `${moduleBrief(module)}\n\n${context}\n\nWrite the exam now (5 questions).`,
          },
        ],
        output_config: { format: zodOutputFormat(ExamSchema) },
      });
      const parsedExam = examResponse.parsed_output;
      if (!parsedExam) throw new Error("Exam generation returned no parseable output");
      session.exam = parsedExam.questions.map((q) => ({
        question: q.question,
        groundTruth: q.ground_truth,
      }));

      status(
        session,
        `Held-out exam locked (${session.exam.length} questions, hidden from the interview). Interviewer agent is exploring the code and its history…`,
      );

      await interviewRound(
        session,
        `${moduleBrief(module)}\n\nExplore this module with your tools before asking anything: read the key files, run git_log_file on the most-touched ones, open suspicious commits with git_show, grep for TODO/HACK/FIXME/workaround and magic constants. Look for asymmetries between sibling code paths and code that a reasonable engineer would not expect. Then call submit_questions with your opening 3-5 interview questions for the module's owner.`,
      );
      session.phase = "awaiting_answers";
    } catch (err) {
      fail(session, err);
    }
  })();

  return session;
}

/** Run one interviewer turn that must end in submit_questions. */
async function interviewRound(session: InterviewSession, instruction: string) {
  let captured: { intro?: string; notes: string; questions: string[] } | null = null;

  const submitQuestions = betaZodTool({
    name: "submit_questions",
    description:
      "Submit the interview questions for this round. Call exactly once, after you have finished exploring.",
    inputSchema: z.object({
      intro: z
        .string()
        .optional()
        .describe("One short sentence to the interviewee framing this round"),
      notes: z
        .string()
        .describe(
          "Your private working notes: what you read, what you found, why these questions",
        ),
      questions: z.array(z.string()).min(1).max(5),
    }),
    run: async (input) => {
      captured = input;
      return "Questions recorded. End your turn now.";
    },
  });

  await client().beta.messages.toolRunner({
    model: INTERVIEWER_MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: INTERVIEWER_SYSTEM,
    tools: [...makeRepoTools(session.repoDir), submitQuestions],
    messages: [
      {
        role: "user",
        content: `${session.transcript.join("\n\n")}\n\n---\n${instruction}`,
      },
    ],
  });

  const result = captured as { intro?: string; notes: string; questions: string[] } | null;
  if (!result) throw new Error("Interviewer finished without submitting questions");
  session.pendingQuestions = result.questions;
  session.transcript.push(
    `AGENT NOTES (round ${session.round}): ${result.notes}`,
    ...result.questions.map((q, i) => `INTERVIEWER Q${session.round}.${i + 1}: ${q}`),
  );
  emit(session, {
    type: "questions",
    round: session.round,
    questions: result.questions,
    intro: result.intro,
  });
}

// ---------------------------------------------------------------------------
// Phase 2 — answers: verify, follow up or conclude, then docs + exam
// ---------------------------------------------------------------------------

export async function submitAnswers(session: InterviewSession, answers: string[]) {
  if (session.phase !== "awaiting_answers") throw new Error("Session is not awaiting answers");
  session.phase = "working";

  session.pendingQuestions.forEach((q, i) => {
    session.transcript.push(`ENGINEER (answering "${q.slice(0, 90)}…"): ${answers[i] ?? "(no answer)"}`);
  });
  session.pendingQuestions = [];

  void (async () => {
    try {
      status(session, "Verifying the answers against the code…");

      let followUp: { intro?: string; notes: string; questions: string[] } | null = null;
      let conclusion: string | null = null;

      const askFollowUp = betaZodTool({
        name: "ask_follow_up",
        description:
          "Ask follow-up questions when answers are vague, contradict the code, or open new threads worth documenting.",
        inputSchema: z.object({
          intro: z.string().optional(),
          notes: z.string().describe("What you verified and what still doesn't add up"),
          questions: z.array(z.string()).min(1).max(4),
        }),
        run: async (input) => {
          followUp = input;
          return "Follow-up recorded. End your turn now.";
        },
      });

      const concludeInterview = betaZodTool({
        name: "conclude_interview",
        description:
          "Conclude the interview when you have enough verified understanding to write solid documentation.",
        inputSchema: z.object({
          summary: z
            .string()
            .describe("Everything learned, verified and attributed — the raw material for the docs"),
        }),
        run: async ({ summary }) => {
          conclusion = summary;
          return "Conclusion recorded. End your turn now.";
        },
      });

      await client().beta.messages.toolRunner({
        model: INTERVIEWER_MODEL,
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        system: INTERVIEWER_SYSTEM,
        tools: [...makeRepoTools(session.repoDir), askFollowUp, concludeInterview],
        messages: [
          {
            role: "user",
            content: `${session.transcript.join("\n\n")}\n\n---\nThe engineer has answered. Verify their claims against the repository with your tools (cron entries, constants, commit dates — anything checkable). Then either ask_follow_up (if round ${session.round} < ${MAX_ROUNDS} and something important is still unclear or contradicts the code) or conclude_interview.`,
          },
        ],
      });

      if (followUp && session.round < MAX_ROUNDS) {
        const f = followUp as { intro?: string; notes: string; questions: string[] };
        session.round++;
        session.pendingQuestions = f.questions;
        session.transcript.push(
          `AGENT NOTES (round ${session.round}): ${f.notes}`,
          ...f.questions.map((q: string, i: number) => `INTERVIEWER Q${session.round}.${i + 1}: ${q}`),
        );
        emit(session, {
          type: "questions",
          round: session.round,
          questions: f.questions,
          intro: f.intro,
        });
        session.phase = "awaiting_answers";
        return;
      }

      if (conclusion) session.transcript.push(`INTERVIEW CONCLUSION: ${conclusion}`);
      await draftDocsAndExamine(session);
    } catch (err) {
      fail(session, err);
    }
  })();
}

async function draftDocsAndExamine(session: InterviewSession) {
  status(session, "Drafting ADR-style documentation from the verified interview…");

  const docsResponse = await client().messages.create({
    model: INTERVIEWER_MODEL,
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    system:
      "You turn verified interview transcripts into documentation a new maintainer can actually work from. Write Markdown: a short overview, then ADR-style sections (Context / Decision / Consequences) for each design decision uncovered, then a 'Traps for new maintainers' section. Attribute tacit knowledge to the interview; cite files and commits where known. Do not pad.",
    messages: [
      {
        role: "user",
        content: `${moduleBrief(session.module)}\n\n${session.transcript.join("\n\n")}\n\nWrite the documentation now.`,
      },
    ],
  });
  const docs = docsResponse.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  session.docs = docs;
  emit(session, { type: "docs_draft", markdown: docs });

  // --- The exam: fresh examinee, docs only ---------------------------------
  status(session, "A fresh 'new hire' agent is taking the onboarding exam using only the docs…");

  const AnswersSchema = z.object({ answers: z.array(z.string()) });
  const examineeResponse = await client().messages.parse({
    model: EXAMINEE_MODEL,
    max_tokens: 4000,
    system:
      "You are a new hire on your first day. Your ONLY source of information is the documentation provided. You have never seen the code. Answer each exam question from the docs alone; if the docs do not cover it, answer exactly 'Not covered by the docs.'",
    messages: [
      {
        role: "user",
        content: `DOCUMENTATION:\n\n${session.docs}\n\nEXAM (answer in order):\n${session.exam
          .map((q, i) => `${i + 1}. ${q.question}`)
          .join("\n")}`,
      },
    ],
    output_config: { format: zodOutputFormat(AnswersSchema) },
  });
  const answers = examineeResponse.parsed_output?.answers ?? [];

  status(session, "Grading the exam against ground truth…");
  const GradeSchema = z.object({
    results: z.array(
      z.object({
        verdict: z.enum(["correct", "partial", "wrong"]),
        note: z.string(),
      }),
    ),
    gaps: z
      .array(z.string())
      .describe("Topics the docs failed to transfer — used to drive follow-up questions"),
  });
  const gradeResponse = await client().messages.parse({
    model: GRADER_MODEL,
    max_tokens: 3000,
    system:
      "You grade exam answers against ground-truth notes. 'correct' = the substance matches; 'partial' = right direction, missing key specifics; 'wrong' = incorrect or 'Not covered'. Be strict but fair; grade substance, not wording.",
    messages: [
      {
        role: "user",
        content: session.exam
          .map(
            (q, i) =>
              `QUESTION ${i + 1}: ${q.question}\nGROUND TRUTH: ${q.groundTruth}\nNEW HIRE'S ANSWER: ${answers[i] ?? "(none)"}`,
          )
          .join("\n\n"),
      },
    ],
    output_config: { format: zodOutputFormat(GradeSchema) },
  });
  const grade = gradeResponse.parsed_output;
  if (!grade) throw new Error("Grader returned no parseable output");

  const points = grade.results.reduce(
    (sum, r) => sum + (r.verdict === "correct" ? 1 : r.verdict === "partial" ? 0.5 : 0),
    0,
  );
  const score = Math.round((points / Math.max(session.exam.length, 1)) * 100) / 100;
  session.score = score;
  const passed = score >= PASS_THRESHOLD;

  emit(session, {
    type: "exam_result",
    score,
    passed,
    breakdown: grade.results.map((r, i) => ({
      question: session.exam[i]?.question ?? "",
      verdict: r.verdict,
      note: r.note,
    })),
    gaps: grade.gaps,
  });

  if (passed || session.round >= MAX_ROUNDS) {
    session.phase = "done";
    emit(session, {
      type: "final_docs",
      markdown: session.docs,
      rounds: session.round,
      score,
    });
    emit(session, { type: "done" });
    return;
  }

  // --- Loop: the gaps become the next round of questions --------------------
  session.round++;
  session.transcript.push(
    `EXAM RESULT: score ${score} — below threshold. Gaps: ${grade.gaps.join("; ")}`,
  );
  status(
    session,
    `Docs scored ${Math.round(score * 100)}% — below the ${PASS_THRESHOLD * 100}% bar. Interviewing again to close the gaps…`,
  );
  await interviewRound(
    session,
    `The onboarding exam exposed gaps the docs did not cover: ${grade.gaps.join(
      "; ",
    )}. Investigate these specific areas with your tools, then call submit_questions with targeted questions that will extract exactly this missing knowledge.`,
  );
  session.phase = "awaiting_answers";
}

function fail(session: InterviewSession, err: unknown) {
  session.phase = "error";
  const message = err instanceof Error ? err.message : String(err);
  emit(session, { type: "error", message });
}
