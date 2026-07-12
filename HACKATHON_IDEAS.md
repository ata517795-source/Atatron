# Top 5 Projects to Win the Anthropic Hackathon

Five project concepts engineered to win, ranked. Each one is: a **real problem** (with evidence), a **novel core idea** nobody else in the room will have, a **concrete algorithm** (not "we prompt Claude"), a **realistic 48-hour build plan**, and a **deployed web app** you can hand judges a URL for.

**The winning formula these are built on:**

1. **Emotion + evidence in the demo.** Judges remember the moment they *feel* the problem.
2. **An algorithmic core with a name.** "We compute grounded extensions over an argument graph" beats "our agents debate" every time.
3. **Agentic depth, not chat.** Anthropic judges want to see Claude *doing* things — tool use, sub-agents, self-verification loops — not a textarea in front of one API call.
4. **A closed loop.** The best projects don't just generate output; they *check their own output* and iterate. That's the pattern Anthropic itself is pushing (outcomes, graders, verification).
5. **Shippable in 48 hours.** Every idea below has a brutal MVP cut that still demos end-to-end.

**Model strategy used throughout** (current pricing, per million tokens):

| Model | ID | In / Out | Role in these projects |
|---|---|---|---|
| Claude Opus 4.8 | `claude-opus-4-8` | $5 / $25 | Primary workhorse: agent loops, adjudication, synthesis |
| Claude Sonnet 5 | `claude-sonnet-5` | $3 / $15 (intro $2/$10) | Parallel sub-agents, per-persona/per-page work |
| Claude Haiku 4.5 | `claude-haiku-4-5` | $1 / $5 | High-volume cheap passes: extraction, classification, entailment cells |

Shared infra assumptions: **Next.js 15 (App Router) + TypeScript on Vercel**, `@anthropic-ai/sdk` with the beta **tool runner** for agent loops, **structured outputs** (`output_config.format` + strict tool schemas) so every pipeline stage emits validated JSON, **prompt caching** on big stable contexts (repo maps, fee schedules, source documents), and **streaming SSE** to the browser so judges watch the agents work live.

---

## #1 — ClearBill: an agentic auditor for medical bills

*Upload a hospital bill. Watch a team of agents find the errors, price every line item against public data, and draft the dispute letter — with receipts.*

### The real problem

- Reviews of hospital bills routinely find error rates cited between **50% and 80%** of itemized bills (duplicate charges, unbundling, upcoding, charges for services never rendered).
- Medical debt is the **leading contributor to personal bankruptcy in the US**, and ~100M Americans carry health-care debt.
- The information asymmetry is total: bills arrive as inscrutable PDFs full of CPT/HCPCS codes; the data needed to check them (CMS fee schedules, NCCI edit pairs, hospital price-transparency files) is *public* but unusable by normal humans.

This is the ideal hackathon problem: universally felt, emotionally charged, and the "expert knowledge" barrier is exactly what an LLM + public datasets dissolves.

### The novel core

Not "chat with your bill." ClearBill is a **three-layer audit engine** where Claude does the *reading* and *arguing*, but deterministic algorithms over public datasets do the *accusing* — so every finding ships with a citation a hospital billing department can't wave away.

### Algorithm

**Layer 0 — Structured extraction.** Bill PDF/photo → Claude Opus 4.8 with vision + strict structured output → normalized line items `{cpt_code, description, date_of_service, units, modifier, charge}`. Fuzzy code normalization: candidate CPT match = argmax over (character trigram similarity of description × prior probability of code in that care setting), so garbled OCR descriptions still map to real codes.

**Layer 1 — Deterministic rules engine (the accuser).**
- **Duplicates:** build a similarity graph over line items — edge if same `(code, date)` and near-identical description (Jaccard over token sets > 0.8) — and flag every connected component of size > 1 that exceeds plausible units.
- **Unbundling:** check every pair of billed codes against the public **CMS NCCI Procedure-to-Procedure (PTP) edit table**. A billed pair that appears in the edit table with modifier indicator `0` is, by CMS's own rule, not separately billable. This is a set-membership check over ~1M published pairs — trivial to run, devastating in a demo.
- **Upcoding signal:** compare billed E/M visit level against the CMS-published national distribution of E/M levels for that specialty; flag levels above the 90th percentile as "review" (a signal, not an accusation — Claude words it carefully).
- **Price benchmark:** for every code, compute `charge / medicare_rate` from the CMS Physician Fee Schedule (free CSV). Flag items above a configurable multiple (e.g. 4×) with the exact benchmark cited.

**Layer 2 — LLM adjudication.** Opus 4.8 receives the flagged items *with their rule-engine evidence* and the extracted bill context, judges which flags are defensible, assigns severity and estimated overcharge, and drafts a **dispute letter** citing the specific NCCI edits and benchmark rates. Structured output guarantees the findings render as a clean report.

The division of labor is the insight: **rules find, Claude judges and argues.** Pure-LLM auditors hallucinate; pure-rules auditors can't read a crumpled photo of a bill or write a letter. The sandwich does both.

### Workflow (user's view)

1. Drag a bill PDF/photo onto the page (or click "use demo bill").
2. Live pipeline view: *Extracting 34 line items… Checking 561 code pairs against NCCI… Benchmarking against CMS fee schedule…* (SSE stream of agent events).
3. Report: bill rendered with flagged lines highlighted, each flag expandable to show the evidence (the NCCI row, the benchmark math), total estimated overcharge in big red numbers.
4. One click → generated dispute letter, editable, downloadable.

### Tech stack

- **Frontend:** Next.js 15 + Tailwind on Vercel; SSE streaming of pipeline events; PDF rendering via `react-pdf`.
- **API:** Next.js route handlers; long-running audit as a streamed route (or Vercel background function).
- **Claude:** `@anthropic-ai/sdk` — Opus 4.8 for extraction (vision + strict structured outputs) and adjudication; Haiku 4.5 for per-line description normalization (cheap, parallel). Prompt-cache the audit rubric + code-set context.
- **Data:** CMS Physician Fee Schedule + NCCI PTP edits loaded into **SQLite (via Turso/libSQL) or Postgres (Neon/Supabase)** at build time; lookups are indexed set-membership queries, no LLM needed.
- **No PHI storage:** process in memory, never persist uploads — say this out loud to judges; it shows judgment.

### 48-hour cut

- **Hours 0–8:** ingest CMS CSVs → SQLite; extraction prompt + strict schema working on 3 sample bills.
- **Hours 8–20:** rules engine (duplicates + NCCI + benchmark; skip upcoding if tight), adjudication pass, findings schema.
- **Hours 20–34:** UI — upload, streaming pipeline view, highlighted report.
- **Hours 34–44:** dispute-letter generation, demo bill with *seeded known errors*, polish.
- **Hours 44–48:** rehearse demo, deploy, record backup video.

### Demo script (3 min)

Hold up a real (anonymized) hospital bill: "Nobody in this room can tell me if this is correct. Neither could I. So I built the thing that can." Upload → agents stream → "$1,912 in likely errors: this line is a duplicate; these two codes are illegal to bill together per CMS edit 43239/43235 — here's the rule." Click → dispute letter. Done.

### Why it wins / main risk

**Wins:** biggest emotional payload of the five; the NCCI check gives an "objectively true finding" moment no other team will have; obvious real-world path. **Risk:** OCR quality on messy bills — mitigate with 2–3 curated demo bills and photo-mode as stretch. Judge every finding with the softener "likely error — verify with provider" to stay honest.

---

## #2 — BusFactor: finds the knowledge that dies when an engineer quits — then extracts it

*Point it at a repo. It computes exactly which critical code only one person understands, interviews that person like a senior engineer would, writes the docs — and proves the docs work by making a fresh "new hire" agent pass an onboarding exam with them.*

### The real problem

Every engineering org bleeds tacit knowledge: the *why* behind weird code lives in one person's head, and when they leave, incidents follow. Teams know this ("bus factor") but have no way to (a) locate the risk precisely, (b) extract the knowledge without weeks of doc-writing nobody does, or (c) know whether the docs they *do* write actually transfer understanding. Offboarding checklists say "document your work" — nobody does it well.

### The novel core

Three things nobody else will demo:

1. **A quantified risk map**, not vibes — an actual scoring algorithm over git history + dependency structure.
2. **An interviewer that has read the code.** It doesn't ask "please describe the module" — it asks *"in `retry.ts` you added jitter in commit `a41f2` three days after the March incident, but the sibling queue in `flush.ts` has none — deliberate?"* That question quality is the demo.
3. **A closed-loop grader:** docs are only accepted when a *fresh-context* "new hire" agent, given only the generated docs, can answer real onboarding questions about the module. Documentation with a unit test.

### Algorithm

**Risk scoring.** For each module *m* (directory or file cluster):

- **Concentration** `C(m)` = Herfindahl–Hirschman index over recency-weighted authorship: each commit contributes weight `exp(-λ · age)` (half-life ≈ 6 months) to its author; `C(m) = Σ_a share_a²`. `C → 1` means one living person owns it.
- **Criticality** `K(m)` = PageRank of the module in the **import/dependency graph** (things many things depend on matter more).
- **Activity** `A(m)` = recent churn (a dead, stable module is less urgent than a hot one).
- **Risk** `R(m) = C(m) × K(m) × A(m)`, ranked. Pure computation — `git log` + a dependency parse ( `madge` for JS/TS, `grimp`/AST for Python). No LLM tokens spent.

**Interview generation.** For the top-risk module, an Opus 4.8 agent (tool runner with read/grep/git-log tools) explores the code and its history and emits *targeted* questions bound to specific commits/lines — prioritizing places where the code does something a reasonable engineer wouldn't expect (heuristic: comments containing "hack/careful/don't", magic constants, asymmetries between sibling code paths, commits that follow reverts).

**Extraction + verification loop.** Interview happens in a chat UI; the agent asks follow-ups and *checks claims against the code live* ("you said this only runs on Mondays — the cron says daily; which is right?"). It then writes ADR-style docs. **Grader:** a fresh Sonnet 5 instance with *no access to the interview or code*, only the docs, must answer N held-out onboarding questions (generated before the interview); a separate judge scores answers against code ground truth. Score < threshold → interviewer asks more questions. Loop until pass.

### Workflow

1. Paste a public GitHub repo URL (or use the pre-loaded demo repo).
2. Risk map renders: treemap of modules colored by `R(m)`, hover shows "87% of recency-weighted knowledge held by @alice; imported by 23 modules."
3. Click the red square → "Interview @alice" → chat session with scarily specific questions.
4. Watch the loop: docs drafted → new-hire agent examined → 6/10 → two more questions → 9/10 → **docs committed as a PR** (via GitHub MCP server).

### Tech stack

- **Frontend:** Next.js 15 on Vercel; treemap via **D3**; interview chat with streaming.
- **Analysis worker:** Node service (Fly.io/Railway) that clones the repo, runs `git log --numstat`, builds the dependency graph, computes HHI/PageRank (`graphology` — PageRank is 20 lines).
- **Claude:** Opus 4.8 interviewer-agent via the SDK **tool runner** with custom `read_file`/`grep`/`git_log` tools; Sonnet 5 as the new-hire examinee; Haiku 4.5 as the answer-grader. Prompt-cache the repo map + module source across interview turns (huge saving — same prefix every turn).
- **GitHub MCP server** for the final "open docs PR" flourish.

### 48-hour cut

Analysis + risk map (hours 0–14) → interviewer agent + chat UI (14–28) → grader loop (28–38) → PR flourish + polish (38–48). MVP scope: one language (TypeScript), public repos only. **Prep move:** seed a demo repo with a genuinely weird-but-documented-nowhere design decision, and have a teammate play the interviewee live on stage.

### Why it wins / main risk

**Wins:** dev-tool judges *are* the target user; the live interview question quality gets audible reactions; the doc-unit-test loop is a genuinely publishable idea. **Risk:** interview quality varies by repo — control it by choosing the demo repo carefully. This is the pick if judging skews technical.

---

## #3 — Repro: paste a GitHub issue, get a failing test and the commit that broke it

*The most hated sentence in open source is "cannot reproduce." Repro turns an issue URL into a minimal reproduction script, then finds the offending commit with an LLM-guided bisect.*

### The real problem

Maintainers spend a huge share of triage time trying to reproduce bug reports; "needs repro" is where issues go to die (search any major repo for the `needs-reproduction` label — thousands of stale issues). Reproduction is mechanical-but-tedious work: read report, guess environment, write minimal script, run, adjust. That's precisely the shape of work agents are now good at.

### The novel core

Two pieces:

1. **Issue → failing test, autonomously, in a sandbox** — with a defined success predicate: the script's failure *signature* (exception type + message pattern + stack frames) must match the issue's, so the agent can't declare fake victory.
2. **Semantic bisect** — a named improvement over `git bisect`. Plain bisect blindly probes midpoints: `O(log n)` builds, and each build+test cycle is expensive. Repro first *ranks* commits in the regression window by suspicion `s(c) = α·sim(issue_text, diff_c ⊕ msg_c) + β·overlap(files(c), files(stack_trace))` (embedding similarity + file-path overlap), tests the top-k suspects directly, and only falls back to standard bisect if none hit. When the bug is a typical regression, this finds the culprit in 1–3 test runs instead of 8–12. Cheap, measurable, and you can put the comparison on a slide.

### Workflow

1. Paste issue URL → agent parses the report (env, version, expected/actual, stack trace) into a structured spec.
2. Sandbox spins up; agent clones, installs, writes `repro.py`/`repro.test.ts`, runs, iterates — every command streamed to the browser like a CI log.
3. Signature match → **"Reproduced ✅"** with the failing test file.
4. Semantic bisect streams: *ranked 214 commits, testing #1 suspect `f3a91c` "refactor date parsing"… still fails at parent? no → culprit found.*
5. Shareable report page: repro script, culprit commit + diff, suspected root cause, fix sketch — formatted as a ready-to-post issue comment.

### Tech stack

- **Frontend:** Next.js 15 on Vercel, xterm.js-style live log via SSE, shareable `/report/[id]` pages (Postgres via Neon).
- **Sandbox:** one container per job — **E2B** (fastest to integrate at a hackathon), or Fly machines / **Claude Managed Agents** (server-side sandbox + GitHub mounting out of the box — using it is itself a nice touch at an Anthropic event).
- **Claude:** Opus 4.8 as the repro agent (Agent SDK or API tool runner with bash + editor tools); Haiku 4.5 for embedding-ish similarity scoring of commits (batch, cheap); structured outputs for the issue spec and the final report.
- **Scope fence:** Python + Node repos, issues that include a stack trace, dependency install ≤ ~2 min.

### 48-hour cut

Sandbox + agent loop reproducing *one known issue* end-to-end (hours 0–16) → issue parsing + signature matcher (16–24) → semantic bisect (24–34) → live-log UI + report pages (34–44) → curate 3 demo issues from real OSS repos where it works, rehearse (44–48). **Never demo on an unseen issue live; take one as a stretch finale only if hour 47 tests pass.**

### Why it wins / main risk

**Wins:** the flashiest live demo of the five (watching an agent operate a terminal never gets old); "semantic bisect" gives it research flavor; every judge who maintains OSS wants it. **Risk:** environment setup is the graveyard of this idea — the scope fence and curated demo issues are non-negotiable.

---

## #4 — PlainWeb: the web, rewritten for the brain reading it — with a fidelity guarantee

*A reading-accessibility layer: any article, rewritten live for dyslexia, aphasia, ADHD, or ESL readers — where every rewrite is machine-verified to preserve the original's claims.*

### The real problem

- ~10–15% of people have dyslexia; **~2M Americans live with aphasia** (stroke survivors who can think perfectly well but struggle to decode complex sentence structure); millions more read English as a second language.
- Most web text is written at a college reading level; US adult average is ~7th–8th grade. Government, health, and legal content — the content people *must* understand — is the worst.
- Existing tools change *presentation* (fonts, spacing, TTS). Almost nothing changes the *language itself*, because naive simplification silently distorts meaning — a fatal flaw for health or legal content.

### The novel core

The **fidelity gate**: simplification with a machine-checked guarantee, not a vibe.

1. **Claim decomposition:** Haiku 4.5 extracts the original passage into atomic claims `{c₁…cₙ}` (cheap, parallel per section).
2. **Rewrite:** Sonnet 5 rewrites the passage for the active profile under hard constraints (per-profile: max sentence length, active voice, frequency-list vocabulary, one idea per sentence; aphasia mode: subject-verb-object, no center-embedding; ADHD mode: aggressive structure — bullets, bolded key terms, TL;DR first).
3. **Bidirectional entailment check:** for each original claim, a Haiku judge verifies the rewrite still entails it (**coverage**); each rewrite sentence is verified as entailed by the original (**no hallucination**). Score = min(coverage, precision).
4. **Repair loop:** score < 0.95 → the specific failed claims go back to the rewriter with instructions to restore them. Iterate ≤ 3 times; readability verified with Flesch-Kincaid/LIX computed in code, not asked of the model.

That loop — *generate → decompose → entail → repair* — is a legitimate mini-paper, and it's what separates this from "we asked Claude to simplify."

### Workflow

1. Paste any article URL (or use the bookmarklet).
2. Pick a profile: **Dyslexia / Aphasia / ADHD / Plain-English (ESL) / Original**.
3. Split view: original left, rewritten right, with the fidelity badge — *"41/41 claims preserved · reading level 11.8 → 5.2"*. Hover a rewritten sentence to highlight its source sentence.
4. Toggle profiles live on the same article; typographic layer (OpenDyslexic option, spacing, line width) applied per profile.

### Tech stack

- **Frontend:** Next.js 15 on Vercel; content extraction with **Mozilla Readability**; server-side fetch of target pages; split-view with sentence alignment (kept as `{original_idx → rewritten_idx}` in the structured output).
- **Claude:** Sonnet 5 rewriter, Haiku 4.5 claim-extraction and entailment cells (the entailment matrix is many small cheap calls — batch them; this is exactly what Haiku pricing is for). Structured outputs everywhere.
- **Cache:** rewrites keyed by `(url_hash, profile, content_hash)` in Vercel KV — instant repeat loads, and the demo can't be killed by latency.
- **Ethics guardrail worth stating on stage:** medical/legal pages get a banner + never drop dosage/date/number claims (claims tagged `critical` must appear verbatim).

### 48-hour cut

Extraction + one profile end-to-end (0–12) → fidelity gate + repair loop (12–26) → remaining profiles = constraint-config only (26–32) → split view, badges, hover-alignment, bookmarklet (32–44) → cache + rehearse with a CDC page and a news article (44–48).

### Why it wins / main risk

**Wins:** accessibility resonates hard with Anthropic's mission framing; the fidelity badge turns a fuzzy demo into a measurable one; profile toggling is a beautiful visual. **Risk:** it reads "less agentic" than the others — counter that by narrating the repair loop live (show iteration 1 failing 3 claims and repairing them). If a teammate has personal connection to aphasia/dyslexia, this jumps a rank.

---

## #5 — Red Council: stress-test any decision with a parliament of grounded personas

*Paste a policy, PRD, or announcement. A council of persona agents — grounded in real demographic and stakeholder data — attacks it from every side. Formal argumentation semantics (not vibes) decides which objections actually survive.*

### The real problem

Organizations ship policies, features, and announcements that blow up in ways *someone would have predicted* — but that someone wasn't in the room. Real red-teaming with diverse stakeholders is expensive and slow, so it rarely happens. Multi-agent "debate" demos exist, but they're theater: agents politely generate text at each other and nobody knows what the output *means*.

### The novel core

Two upgrades that turn debate theater into an instrument:

1. **Grounded personas, not stereotypes.** Personas are sampled from a structured frame (occupation, income band, age, disability status, geography, relationship to the decision) with quotas over the actual affected population (ACS/census-style marginals for public policy; user-segment data for product decisions). Each persona's arguments must cite its own frame ("as someone paid hourly, section 3's unpaid training time is a wage cut").
2. **Dung's abstract argumentation framework as the aggregator.** Every claim and counter-claim becomes a node; "attacks" become directed edges; a moderator agent maps each new argument into the graph (attack / support / new). Then compute the **grounded extension** — the unique minimal set of arguments that are collectively defensible (an argument is *in* iff every attacker is itself defeated). Objections in the grounded extension are *undefeated risks*; attacked-and-defended points are *resolved*; odd cycles surface as *genuine dilemmas*. This is 1995-vintage formal argumentation theory (Dung), computable in ~40 lines, and it makes the output rigorous: the risk report isn't "what the loudest agent said," it's "what survived."

### Algorithm summary

Persona sampling (quota sampling over marginal distributions) → K parallel Sonnet 5 persona critiques (structured: claim, severity, affected group, cited frame attribute) → moderator (Opus 4.8) canonicalizes claims and inserts attack edges, runs R rounds where the drafter defends and personas rebut → compute grounded extension via the standard fixed-point iteration (repeatedly accept unattacked arguments, remove what they defeat) → report ranks *surviving* objections by severity × affected-population share.

### Workflow

1. Paste the decision text; pick context (public policy / product change / comms) and council size.
2. Council view: persona cards stream in with their sharpest objection each.
3. Debate rounds animate on a live **argument graph** (nodes turning green/red as the extension computation resolves them).
4. Output: **Risk Map** — surviving objections ranked, each with who's affected, why it survived rebuttal, and a suggested mitigation; plus "resolved concerns" (defended successfully) so it's not pure doom.
5. Edit the policy text → re-run → watch risks drop. (That re-run moment is the demo climax: it's a *tool*, not a toy.)

### Tech stack

- **Frontend:** Next.js 15 on Vercel; force-directed argument graph (D3 / react-force-graph); SSE streaming of council events.
- **Claude:** Sonnet 5 personas (parallel — this is the fan-out workload), Opus 4.8 moderator/canonicalizer (the hard reasoning is claim-matching), structured outputs for every argument node. Prompt-cache the decision text + rubric across all persona calls (same prefix, K-way savings).
- **Grounded-extension solver:** plain TypeScript, fixed-point iteration; unit-testable with textbook examples.
- **Persona frames:** small curated JSON of ACS-derived marginals for the demo domains — honest framing: "simulated perspectives grounded in population structure — a pre-mortem instrument, not a survey replacement."

### 48-hour cut

Persona sampling + parallel critiques (0-12) → moderator + argument-graph data model (12–24) → grounded-extension solver + tests (24–30) → graph UI + risk report (30–42) → the edit-and-rerun flow + rehearse on one juicy demo policy, e.g. a real city's e-scooter ordinance or a return-to-office memo (42–48).

### Why it wins / main risk

**Wins:** the most intellectually distinctive of the five — argumentation semantics + LLM agents is genuinely underexplored, and it rhymes with Anthropic's own interests (deliberation, epistemics, societal impacts). The animated argument graph is a striking visual. **Risk:** demo can feel abstract if the input policy is boring — the entire demo lives or dies on choosing a decision text the audience has opinions about. Also be ready for "isn't this just synthetic opinions?" — the answer is the pre-mortem framing and the formal semantics.

---

## Head-to-head

| | Problem pain | Novelty | Demo punch | 48h feasibility | Judge fit (Anthropic) |
|---|---|---|---|---|---|
| **#1 ClearBill** | ★★★★★ | ★★★★ | ★★★★★ | ★★★★ | Impact + agentic pipeline |
| **#2 BusFactor** | ★★★★ | ★★★★★ | ★★★★ | ★★★★ | Devtools + closed-loop eval |
| **#3 Repro** | ★★★★ | ★★★★ | ★★★★★ | ★★★ | Agents + OSS love |
| **#4 PlainWeb** | ★★★★★ | ★★★★ | ★★★★ | ★★★★★ | Mission/accessibility |
| **#5 Red Council** | ★★★ | ★★★★★ | ★★★★ | ★★★★ | Research flavor |

**My recommendation:** build **ClearBill** if the judging rewards real-world impact and demo emotion (most general hackathons do — including Anthropic's public ones, where societal-benefit projects have historically placed well). Build **BusFactor** if the judge panel is engineer-heavy and devtools-inclined — its closed-loop "documentation with a unit test" idea is the most likely to make a judge say *"I've never seen that."* Repro is the high-variance flashy pick; PlainWeb is the safest to finish; Red Council is the one a professor would write the paper about.

## Shared 48-hour playbook (whichever you pick)

1. **Deploy a hello-world to Vercel in hour 1.** The URL exists from the start; you never have a deploy crisis at hour 47.
2. **Structured outputs from day one.** Every stage emits schema-validated JSON — this is what keeps a multi-stage pipeline debuggable at 3am.
3. **Curate the demo inputs early** (the bill, the repo, the issue, the article, the policy). The demo runs on inputs you've tested twenty times; live-unseen input is a finale stunt, never the main act.
4. **Prompt-cache the big stable context** (fee schedules, repo maps, source docs) — 10× cost/latency saving on the fan-out calls, and mention it to judges; it signals production thinking.
5. **Stream everything.** Judges should watch the agents work. A spinner is a demo-killer; an SSE event log is a demo.
6. **Record a backup video at hour 44.** Conference wifi has ended more hackathon runs than bugs have.
7. **Close the pitch with the same sentence you opened with**, now proven: *"Nobody can read this bill / this codebase / this policy — now anyone can."*
