import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeRepo } from "./analyze.ts";
import { ensureClone } from "./git.ts";
import {
  anthropicConfigured,
  getSession,
  startInterview,
  submitAnswers,
} from "./interview.ts";
import type { AnalyzeResult, InterviewEvent } from "./types.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(HERE, "..", "dist");
const PORT = Number(process.env.BUSFACTOR_PORT ?? 5177);

const app = express();
app.use(express.json({ limit: "1mb" }));

const analysisCache = new Map<string, AnalyzeResult>();

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    anthropic: anthropicConfigured(),
    models: {
      interviewer: process.env.BUSFACTOR_INTERVIEWER_MODEL ?? "claude-opus-4-8",
      examinee: process.env.BUSFACTOR_EXAMINEE_MODEL ?? "claude-sonnet-5",
      grader: process.env.BUSFACTOR_GRADER_MODEL ?? "claude-haiku-4-5",
    },
  });
});

app.post("/api/analyze", async (req, res) => {
  try {
    const repoUrl = String(req.body?.repoUrl ?? "");
    const cached = analysisCache.get(repoUrl);
    if (cached && !req.body?.force) {
      res.json(cached);
      return;
    }
    const result = await analyzeRepo(repoUrl);
    analysisCache.set(repoUrl, result);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post("/api/interview/start", async (req, res) => {
  try {
    if (!anthropicConfigured()) {
      res.status(503).json({
        error:
          "No Anthropic credentials. Set ANTHROPIC_API_KEY (or ANTHROPIC_AUTH_TOKEN) and restart the server to enable interviews. The risk map works without it.",
      });
      return;
    }
    const repoUrl = String(req.body?.repoUrl ?? "");
    const modulePath = String(req.body?.module ?? "");
    const analysis = analysisCache.get(repoUrl) ?? (await analyzeRepo(repoUrl));
    analysisCache.set(repoUrl, analysis);
    const module = analysis.modules.find((m) => m.path === modulePath);
    if (!module) {
      res.status(404).json({ error: `Module not found in analysis: ${modulePath}` });
      return;
    }
    const repoDir = await ensureClone(repoUrl);
    const session = await startInterview(repoDir, module);
    res.json({ sessionId: session.id });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get("/api/interview/:id/stream", (req, res) => {
  const session = getSession(req.params.id);
  if (!session) {
    res.status(404).end();
    return;
  }
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  const send = (ev: InterviewEvent) => res.write(`data: ${JSON.stringify(ev)}\n\n`);
  for (const ev of session.events) send(ev); // replay, then live
  session.subscribers.add(send);
  const heartbeat = setInterval(() => res.write(": hb\n\n"), 15_000);
  req.on("close", () => {
    clearInterval(heartbeat);
    session.subscribers.delete(send);
  });
});

app.post("/api/interview/:id/answers", async (req, res) => {
  try {
    const session = getSession(req.params.id);
    if (!session) {
      res.status(404).json({ error: "Unknown session" });
      return;
    }
    const answers = (req.body?.answers ?? []).map((a: unknown) => String(a));
    await submitAnswers(session, answers);
    res.status(202).json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get("/api/interview/:id/docs", (req, res) => {
  const session = getSession(req.params.id);
  if (!session?.docs) {
    res.status(404).json({ error: "No docs yet" });
    return;
  }
  res
    .type("text/markdown")
    .setHeader(
      "Content-Disposition",
      `attachment; filename="${session.module.path.replace(/[^\w.-]+/g, "_")}-docs.md"`,
    )
    .send(session.docs);
});

// Static frontend (after `npm run build:web`)
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(DIST, "index.html")));
}

app.listen(PORT, () => {
  console.log(`BusFactor listening on http://localhost:${PORT}`);
  console.log(
    anthropicConfigured()
      ? "Anthropic credentials detected — interviews enabled."
      : "No ANTHROPIC_API_KEY — risk analysis works; interviews are disabled until you set it.",
  );
});
