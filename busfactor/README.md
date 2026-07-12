# BusFactor

**Finds the knowledge that dies when an engineer quits — then extracts it.**

> 📖 Full technical brief (workflow, algorithms, diagrams, real results):
> [hosted explainer page](https://claude.ai/code/artifact/4aea6bd5-0023-4d0f-ba7e-042fb13967f3)
> — also committed at [`docs/explainer.html`](docs/explainer.html).

Point BusFactor at any public git repository. It:

1. **Locates the risk** — scores every module by *knowledge concentration ×
   dependency criticality × recent activity*, computed from the repo's own git
   history and import graph (no AI involved in this step — it's pure math),
   and renders it as an interactive treemap.
2. **Interviews the owner** — a Claude agent that has actually read the code
   and its commit history asks the module's owner scarily specific questions
   ("in `retry.ts` you added jitter three days after the March incident, but
   the sibling queue has none — deliberate?"), verifies the answers against
   the repo, and asks follow-ups.
3. **Writes docs with a unit test** — the agent drafts ADR-style docs, then a
   *fresh* "new hire" agent (which has never seen the code or the interview)
   must pass a held-out onboarding exam using only those docs. Score below
   80% → the gaps become the next round of interview questions. Docs ship
   only when they provably transfer understanding.

## Quickstart

```sh
cd busfactor
npm install
npm start            # builds the frontend and serves everything on :5177
# open http://localhost:5177
```

The **risk map works with no configuration** — try `expressjs/express` or
`pallets/flask` from the example chips.

To enable the interview → docs → exam loop, set an Anthropic API key before
starting:

```sh
export ANTHROPIC_API_KEY=sk-ant-...
npm start
```

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Enables the interview/exam agents |
| `BUSFACTOR_PORT` | `5177` | Server port |
| `BUSFACTOR_INTERVIEWER_MODEL` | `claude-opus-4-8` | Interviewer / examiner / docs writer |
| `BUSFACTOR_EXAMINEE_MODEL` | `claude-sonnet-5` | The "new hire" that takes the exam |
| `BUSFACTOR_GRADER_MODEL` | `claude-haiku-4-5` | Grades exam answers against ground truth |

Dev mode: `npm run dev:server` (API on :5177) + `npm run dev:web` (Vite on
:5178, proxied).

## How the risk score works

For each module *m* (directory, depth ≤ 2):

- **Concentration** `C(m)` — Herfindahl–Hirschman index over recency-weighted
  authorship. Each commit contributes `0.5^(age/180d) × (1 + ln(1 + lines))`
  to its author (lines capped at 400 per touch so one mega-refactor doesn't
  equal years of stewardship). `C(m) = Σ share²`; `1/C` = "effective owners".
- **Criticality** `K(m)` — PageRank over the module dependency graph, built
  from static imports (JS/TS/Python) and supplemented with co-change coupling
  (modules modified in the same commit) when import edges are sparse.
- **Activity** `A(m)` — recency-weighted churn.
- **Risk** `R(m) ∝ C × (0.25 + 0.75·K̂) × (0.25 + 0.75·Â) × kind-weight`,
  scaled to 0–100 across the repo. `K̂`, `Â` are percentile ranks; the floors
  keep a stale-but-critical module from scoring exactly zero; tests, examples,
  and docs are down-weighted (0.3 / 0.2 / 0.15) because losing tacit knowledge
  about them hurts less than losing it about production code.

Recency is measured against the repo's **own newest commit**, so archived
repos are analyzed on their own timeline.

## The closed loop (why this isn't "AI writes docs")

```
held-out exam (written BEFORE the interview, from the code)
        │
interview owner ──> verify answers against repo ──> draft docs
        ▲                                              │
        │                                              ▼
gap-targeted questions <── grade <── fresh agent takes exam with DOCS ONLY
```

The exam is generated before the interview and never shown to the
interviewer. The examinee never sees the code or the transcript — only the
docs. If the docs can't get a fresh reader to 80%, they aren't done. It's
documentation with a unit test.

## API

| Route | Purpose |
|---|---|
| `POST /api/analyze` `{repoUrl}` | Clone + full risk analysis |
| `POST /api/interview/start` `{repoUrl, module}` | Start an interview session |
| `GET /api/interview/:id/stream` | SSE event stream (status, questions, docs, exam results) |
| `POST /api/interview/:id/answers` `{answers[]}` | Submit the owner's answers |
| `GET /api/interview/:id/docs` | Download the final docs (`.md`) |
| `GET /api/health` | Key/model status |

## Security & limitations

- Repo tools handed to the agent are **read-only**, path-confined to the
  clone, and run via `execFile` (no shell).
- Public `https://` repos only; clones are cached under `busfactor/.cache/`.
- Import-graph parsing covers JS/TS/Python; other languages fall back to
  co-change coupling automatically.
- Interview sessions are in-memory (restart clears them) — hackathon scope.
- Author identity is keyed on the git author name; no identity merging yet.
