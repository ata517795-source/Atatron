// ─── Infinite Story Realms: DM engine ────────────────────────────────────
// Runs ONLY server-side (Vercel function + Vite dev middleware). The
// Anthropic API key never reaches the browser.

import { freeTurn } from "./freeStoryteller";

// Swap to "claude-sonnet-5" for richer prose ($3/$15 per MTok vs $1/$5).
// Can also be overridden without a code change via the DM_MODEL env var.
export const DM_MODEL = "claude-haiku-4-5";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MAX_TOKENS = 2048;

// ── Wire types (server-side copies; src/types.ts mirrors these) ──────────
export interface GameState {
  genre: string;
  /** Which storyteller runs the game: Claude (needs API key) or the free procedural engine. */
  dm: "claude" | "free";
  character: { name: string; class: string; traits: string[] };
  hp: number;
  maxHp: number;
  inventory: string[];
  questLog: string[];
  worldFacts: string[];
  location: string;
  history: { action: string; summary: string }[];
}

interface StateUpdates {
  hpDelta: number;
  addItems: string[];
  removeItems: string[];
  newQuests: string[];
  newFacts: string[];
  location: string;
}

export interface StoryTurn {
  narrative: string;
  choices: string[];
  imagePrompt: string;
  stateUpdates: StateUpdates;
  /** Which engine produced this turn. */
  engine: "claude" | "free";
}

export interface HandlerResult {
  status: number;
  body: StoryTurn | { error: string };
}

export type Env = Record<string, string | undefined>;

const BEGIN_ACTION = "__begin_adventure__";
const VALID_GENRES = new Set(["fantasy", "sci-fi", "mystery", "pirate", "post-apoc"]);

// ── Strict-JSON schema (Anthropic structured outputs) ────────────────────
const TURN_SCHEMA = {
  type: "object",
  properties: {
    narrative: { type: "string", description: "2-4 vivid paragraphs of second-person narration" },
    choices: { type: "array", items: { type: "string" }, description: "3-4 short action options" },
    imagePrompt: { type: "string", description: "One-sentence scene description for an illustrator" },
    stateUpdates: {
      type: "object",
      properties: {
        hpDelta: { type: "integer" },
        addItems: { type: "array", items: { type: "string" } },
        removeItems: { type: "array", items: { type: "string" } },
        newQuests: { type: "array", items: { type: "string" } },
        newFacts: { type: "array", items: { type: "string" } },
        location: { type: "string" },
      },
      required: ["hpDelta", "addItems", "removeItems", "newQuests", "newFacts", "location"],
      additionalProperties: false,
    },
  },
  required: ["narrative", "choices", "imagePrompt", "stateUpdates"],
  additionalProperties: false,
} as const;

// ── Prompt building ───────────────────────────────────────────────────────
function systemPrompt(): string {
  return [
    "You are the Dungeon Master of «Infinite Story Realms», an illustrated choice-based text RPG.",
    "You invent the world, plot, characters and consequences live, in the genre the player chose.",
    "You are witty, vivid and fair: actions have real consequences, risks can fail, and the world stays internally consistent with the provided state (worldFacts, history, inventory, quests, location).",
    "",
    "EVERY reply must be a single JSON object with exactly these fields:",
    '{ "narrative": string, "choices": string[], "imagePrompt": string,',
    '  "stateUpdates": { "hpDelta": int, "addItems": string[], "removeItems": string[], "newQuests": string[], "newFacts": string[], "location": string } }',
    "Return ONLY the JSON object — no markdown fences, no preamble, no commentary.",
    "",
    "Rules:",
    "- narrative: 2-4 short paragraphs, second person ('you'), matching the genre's voice. Never break character or mention being an AI.",
    "- choices: 3-4 distinct short imperative actions (max ~10 words each). At least one cautious and one bold option.",
    "- imagePrompt: one evocative sentence describing the current scene for an illustrator. No character names.",
    "- stateUpdates.hpDelta: 0 unless the player was healed or hurt this turn; keep within -30..+30. The player dies at 0 HP, so wound gradually.",
    "- addItems/removeItems: only items the narrative actually grants or consumes. removeItems must match existing inventory names.",
    "- newQuests: short goal phrases when a new objective emerges; [] otherwise.",
    "- newFacts: 0-3 terse facts worth remembering forever (names, promises, discoveries, deaths). Old history is discarded — newFacts is the world's long-term memory, so record anything future turns must not contradict.",
    "- location: the player's current location name (update it when they move).",
    "- If the player's free-text action is impossible or nonsensical, let the attempt fail entertainingly in-world; never scold the player.",
    "- If hp is low, raise the stakes but always leave a path to survival.",
    "- If the player action is '" + BEGIN_ACTION + "', open the adventure: establish the world, the character's situation, a hook, and a starting location.",
  ].join("\n");
}

function userPrompt(state: GameState, playerAction: string): string {
  return JSON.stringify({
    genre: state.genre,
    character: state.character,
    hp: state.hp,
    maxHp: state.maxHp,
    inventory: state.inventory,
    questLog: state.questLog,
    worldFacts: state.worldFacts,
    location: state.location,
    recentHistory: state.history,
    playerAction,
  });
}

// ── Input validation / bounding (never trust the client blindly) ─────────
function clampStr(s: unknown, max: number): string {
  return typeof s === "string" ? s.slice(0, max) : "";
}

function clampArr(a: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(a)) return [];
  return a.slice(-maxItems).map((s) => clampStr(s, maxLen)).filter(Boolean);
}

export function sanitizeState(raw: unknown): GameState | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const genre = clampStr(r.genre, 20);
  if (!VALID_GENRES.has(genre)) return null;
  const ch = (r.character ?? {}) as Record<string, unknown>;
  const name = clampStr(ch.name, 60);
  if (!name) return null;

  const maxHp = typeof r.maxHp === "number" && r.maxHp > 0 && r.maxHp <= 999 ? Math.round(r.maxHp) : 100;
  const hp = typeof r.hp === "number" ? Math.max(0, Math.min(maxHp, Math.round(r.hp))) : maxHp;

  const history = Array.isArray(r.history)
    ? r.history.slice(-8).flatMap((h) => {
        const e = h as Record<string, unknown>;
        const action = clampStr(e.action, 220);
        const summary = clampStr(e.summary, 320);
        return action || summary ? [{ action, summary }] : [];
      })
    : [];

  return {
    genre,
    dm: r.dm === "free" ? "free" : "claude",
    character: { name, class: clampStr(ch.class, 60), traits: clampArr(ch.traits, 8, 60) },
    hp,
    maxHp,
    inventory: clampArr(r.inventory, 30, 80),
    questLog: clampArr(r.questLog, 20, 160),
    worldFacts: clampArr(r.worldFacts, 40, 200),
    location: clampStr(r.location, 120) || "unknown",
    history,
  };
}

// ── Defensive JSON parsing ────────────────────────────────────────────────
export function parseTurnJson(text: string): StoryTurn | null {
  let t = text.trim();
  // Strip ``` fences if the model wrapped its JSON despite instructions.
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenced) t = fenced[1].trim();
  // Trim any preamble before the first brace / after the last brace.
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first === -1 || last <= first) return null;
  t = t.slice(first, last + 1);

  try {
    const o = JSON.parse(t) as Record<string, unknown>;
    if (typeof o.narrative !== "string" || !o.narrative.trim()) return null;
    if (!Array.isArray(o.choices)) return null;
    const choices = o.choices.map((c) => clampStr(c, 160)).filter(Boolean).slice(0, 5);
    if (choices.length === 0) return null;
    const u = (o.stateUpdates ?? {}) as Record<string, unknown>;
    const hpDeltaRaw = typeof u.hpDelta === "number" ? Math.round(u.hpDelta) : 0;
    return {
      engine: "claude",
      narrative: o.narrative.trim(),
      choices,
      imagePrompt: clampStr(o.imagePrompt, 400),
      stateUpdates: {
        hpDelta: Math.max(-50, Math.min(50, hpDeltaRaw)),
        addItems: clampArr(u.addItems, 6, 80),
        removeItems: clampArr(u.removeItems, 6, 80),
        newQuests: clampArr(u.newQuests, 4, 160),
        newFacts: clampArr(u.newFacts, 4, 200),
        location: clampStr(u.location, 120),
      },
    };
  } catch {
    return null;
  }
}

// ── Anthropic Messages API call (raw fetch — no SDK needed serverless) ───
interface AnthropicResponse {
  content?: { type: string; text?: string }[];
  stop_reason?: string;
  error?: { type?: string; message?: string };
}

async function callAnthropic(
  apiKey: string,
  model: string,
  system: string,
  messages: { role: "user" | "assistant"; content: string }[],
): Promise<{ text?: string; stopReason?: string; errorStatus?: number; errorMsg?: string }> {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      system,
      messages,
      // Structured outputs: constrains the response to valid TURN_SCHEMA JSON.
      output_config: { format: { type: "json_schema", schema: TURN_SCHEMA } },
    }),
  });

  const data = (await res.json().catch(() => null)) as AnthropicResponse | null;
  if (!res.ok) {
    return { errorStatus: res.status, errorMsg: data?.error?.message ?? `HTTP ${res.status}` };
  }
  const text = data?.content?.find((b) => b.type === "text")?.text;
  return { text, stopReason: data?.stop_reason };
}

function friendlyApiError(status: number, msg: string): HandlerResult {
  if (status === 401 || status === 403)
    return { status: 502, body: { error: "The server's Anthropic API key was rejected. Check ANTHROPIC_API_KEY." } };
  if (status === 429)
    return { status: 503, body: { error: "The DM is catching their breath (rate limited). Wait a moment and try again." } };
  if (status === 529 || status >= 500)
    return { status: 503, body: { error: "The realm's connection to the DM is overloaded. Try again shortly." } };
  return { status: 502, body: { error: `The DM stumbled: ${msg}` } };
}

// ── Main handler (framework-agnostic) ─────────────────────────────────────
export async function handleStory(rawBody: unknown, env: Env): Promise<HandlerResult> {
  const body = (rawBody ?? {}) as Record<string, unknown>;
  const state = sanitizeState(body.state);
  const playerAction = clampStr(body.playerAction, 300).trim();
  if (!state || !playerAction) {
    return { status: 400, body: { error: "Invalid request: expected { state, playerAction }." } };
  }

  const apiKey = env.ANTHROPIC_API_KEY?.trim();
  // Free storyteller: chosen explicitly ($0, no key needed), and also the
  // fallback when no ANTHROPIC_API_KEY is configured.
  if (state.dm === "free" || !apiKey) {
    return { status: 200, body: freeTurn(state, playerAction, BEGIN_ACTION) };
  }

  const model = env.DM_MODEL?.trim() || DM_MODEL;
  const system = systemPrompt();
  const messages: { role: "user" | "assistant"; content: string }[] = [
    { role: "user", content: userPrompt(state, playerAction) },
  ];

  let result;
  try {
    result = await callAnthropic(apiKey, model, system, messages);
  } catch {
    return { status: 503, body: { error: "Could not reach the DM (network error). Try again." } };
  }

  if (result.errorStatus) return friendlyApiError(result.errorStatus, result.errorMsg ?? "");
  if (result.stopReason === "refusal") {
    return { status: 200, body: refusalTurn(state) };
  }

  let turn = result.text ? parseTurnJson(result.text) : null;

  // One retry with an explicit valid-JSON nudge (spec-mandated safety net —
  // structured outputs should make this path nearly unreachable).
  if (!turn) {
    const retryMessages = [
      ...messages,
      { role: "assistant" as const, content: (result.text ?? "").slice(0, 4000) || "(empty)" },
      { role: "user" as const, content: "That was not valid JSON. Return ONLY the JSON object described in the system prompt — no fences, no commentary." },
    ];
    try {
      const retry = await callAnthropic(apiKey, model, system, retryMessages);
      if (retry.errorStatus) return friendlyApiError(retry.errorStatus, retry.errorMsg ?? "");
      turn = retry.text ? parseTurnJson(retry.text) : null;
    } catch {
      /* fall through to error below */
    }
  }

  if (!turn) {
    return { status: 502, body: { error: "The DM spoke in tongues (invalid response). Try again." } };
  }
  return { status: 200, body: turn };
}

/** In-world handling when safety classifiers decline an action. */
function refusalTurn(state: GameState): StoryTurn {
  return {
    engine: "claude",
    narrative:
      "A strange hush falls over the world. Whatever you just attempted, the fates refuse to weave it into this tale.\n\nThe moment passes, and the realm waits for a different choice.",
    choices: ["Take a breath and reconsider", "Survey your surroundings", "Continue on your way"],
    imagePrompt: "A quiet, expectant pause in the world, dust motes hanging in still light",
    stateUpdates: { hpDelta: 0, addItems: [], removeItems: [], newQuests: [], newFacts: [], location: state.location },
  };
}
