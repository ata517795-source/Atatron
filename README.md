# Infinite Story Realms 📜

An AI-driven, illustrated*, choice-based text RPG where **Claude is the live dungeon
master** — it invents the world, story, and choices on the fly and remembers everything.
No story content is hardcoded: every narrative beat comes from the model at play time.

*\*Scene art is an optional layer (off by default) — the app ships with stylized
text scene cards and runs fully without images.*

---

## Quick start

```bash
npm install
cp .env.example .env        # then paste your Anthropic API key into .env
npm run dev                 # → http://localhost:5173
```

**Playing for free ($0, no API key):** pick **"Free storyteller"** on the start
screen. It's a built-in procedural story engine — each adventure derives a real
arc (a villain, a treasure, a destination) from seeded random tables per genre,
with encounters, hazards, discoveries, rest, and a climax. It costs nothing,
needs no key, and is also the automatic fallback whenever the server has no
`ANTHROPIC_API_KEY`. It's honestly labeled in the UI (`Free storyteller mode ·
$0 · no AI`) — for truly infinite, improvised stories, use the Claude DM.

**Playing with the Claude DM:** get a key at
[console.anthropic.com](https://console.anthropic.com) and set it in `.env`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

## How it's built

```
src/                      React 19 + Vite + TypeScript + Tailwind 4 + Zustand
api/story.ts              Vercel serverless function → thin wrapper
api/image.ts              Optional scene-art proxy (stub until you pick a provider)
api/_lib/storyCore.ts     The DM engine: prompt, Anthropic call, strict-JSON parsing
api/_lib/freeStoryteller.ts  The $0 procedural engine (no key, no AI)
vite.config.ts            Dev middleware mounts the SAME api/_lib handlers locally,
                          so `npm run dev` runs the identical server logic as prod
```

### Security model

The Anthropic API key lives **only** in the serverless function environment
(`.env` locally, Vercel env vars in prod). The browser talks exclusively to
`/api/story`; the key and even the `api.anthropic.com` URL never appear in the
client bundle (verified by grepping `dist/`). `.env` is gitignored.

### The DM engine

Every turn the client sends its full game state
(`genre, character, hp, inventory, questLog, worldFacts, location, history`) plus the
player's action to `/api/story`. The function asks Claude to respond as DM with
**strict JSON only**:

```json
{
  "narrative": "2-4 vivid paragraphs…",
  "choices": ["3-4 short actions"],
  "imagePrompt": "one-sentence scene description",
  "stateUpdates": { "hpDelta": 0, "addItems": [], "removeItems": [],
                    "newQuests": [], "newFacts": [], "location": "…" }
}
```

Valid JSON is enforced three ways: Anthropic **structured outputs**
(`output_config.format` with a JSON schema) constrain the response server-side;
the parser still strips ``` fences and trims preambles defensively; and if
parsing somehow fails, the function re-asks once with a "return valid JSON only"
nudge before surfacing a friendly error (the UI never dead-ends — there's
always a retry button).

**Memory stays bounded:** only the last 8 turns travel as summarized history;
the DM is instructed to distill anything worth remembering forever into
`worldFacts` (capped at 40), which persist for the whole adventure. That keeps
per-turn token cost flat no matter how long you play.

### Swapping the model

The model is a single constant at the top of [`api/_lib/storyCore.ts`](api/_lib/storyCore.ts):

```ts
export const DM_MODEL = "claude-haiku-4-5"; // ← swap to "claude-sonnet-5" for richer prose
```

or override without touching code via the `DM_MODEL` env var.

### Expected cost per turn

A typical turn is ~1,000–1,500 input tokens (system prompt + game state) and
~400–800 output tokens (narrative + choices + updates):

| Storyteller | Pricing (per MTok in/out) | ≈ Cost per turn | ≈ Turns per $1 |
|---|---|---|---|
| **Free storyteller** (procedural, no AI) | — | $0 | ∞ |
| `claude-haiku-4-5` (default Claude DM) | $1 / $5 | $0.004–0.005 | ~200–250 |
| `claude-sonnet-5` | $3 / $15 (intro $2 / $10 through 2026-08-31) | $0.012–0.015 | ~70–85 |

Estimates only — long inventories/quest logs push input tokens up slightly.

## Save / load

- The game **autosaves** to `localStorage` after every turn.
- **Copy save code** (side panel) exports the full state as a base64 string;
  paste it into *"Continue from a save code"* on the start screen — on any
  device or browser.

## Optional image layer

Off by default; the app is fully playable without it.

1. Pick an image provider and put its key in `.env` as `IMAGE_API_KEY`.
2. Implement the provider call in [`api/_lib/imageCore.ts`](api/_lib/imageCore.ts)
   (the `TODO` returns `{ url }`).
3. Set `VITE_IMAGE_ENABLED=1` so the client requests art for each scene's
   `imagePrompt`. Any failure silently falls back to the text scene card.

## Deploy a public link (Vercel)

The repo is zero-config for Vercel: Vite frontend + `api/` functions are
auto-detected.

**Via CLI:**

```bash
npm i -g vercel
vercel login
vercel                                    # first deploy (accept defaults)
vercel env add ANTHROPIC_API_KEY          # paste your key, select all environments
vercel --prod                             # → public production URL
```

**Via dashboard:** push this repo to GitHub → [vercel.com/new](https://vercel.com/new)
→ import the repo (framework preset: **Vite**) → add `ANTHROPIC_API_KEY` under
*Settings → Environment Variables* → Deploy. Optional: add `DM_MODEL` to swap
models per-environment.

*(Netlify works too, but the serverless functions are written for Vercel's
`api/` convention — Vercel is the intended path.)*

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with local `/api` middleware (same logic as prod) |
| `npm run build` | Type-check + production build to `dist/` |
| `npm run preview` | Preview the production build (note: no `/api` — use `vercel dev` for that) |
