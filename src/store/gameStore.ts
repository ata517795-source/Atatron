import { create } from "zustand";
import type { GameState, Genre, StoryTurn } from "../types";
import { startingState } from "../types";
import { requestTurn } from "../lib/api";

export const BEGIN_ACTION = "__begin_adventure__";
const MAX_HISTORY = 8;
const MAX_FACTS = 40;
const SAVE_KEY = "isr-autosave-v1";

interface SaveBlob {
  v: 1;
  game: GameState;
  turn: StoryTurn | null;
}

interface Store {
  phase: "start" | "playing";
  game: GameState | null;
  turn: StoryTurn | null;
  loading: boolean;
  error: string | null;

  startGame: (genre: Genre, name: string, charClass: string) => void;
  takeTurn: (action: string) => Promise<void>;
  retry: () => Promise<void>;
  resetToStart: () => void;
  exportSave: () => string | null;
  importSave: (code: string) => boolean;
}

/** First ~2 sentences (bounded) — used to summarize a turn into history. */
function summarize(narrative: string, max = 240): string {
  const clean = narrative.replace(/\s+/g, " ").trim();
  const sentences = clean.match(/[^.!?]+[.!?]+/g);
  const short = sentences ? sentences.slice(0, 2).join(" ") : clean;
  return short.length > max ? short.slice(0, max - 1) + "…" : short;
}

function applyUpdates(game: GameState, turn: StoryTurn, action: string): GameState {
  const u = turn.stateUpdates ?? {};
  const inventory = game.inventory
    .filter((i) => !(u.removeItems ?? []).some((r) => r.toLowerCase() === i.toLowerCase()))
    .concat(u.addItems ?? []);
  const questLog = game.questLog.concat(u.newQuests ?? []);
  const worldFacts = game.worldFacts.concat(u.newFacts ?? []).slice(-MAX_FACTS);
  const hp = Math.max(0, Math.min(game.maxHp, game.hp + (u.hpDelta ?? 0)));
  const history = game.history
    .concat({
      action: action === BEGIN_ACTION ? "The adventure began" : action,
      summary: summarize(turn.narrative),
    })
    .slice(-MAX_HISTORY);

  return {
    ...game,
    hp,
    inventory,
    questLog,
    worldFacts,
    location: u.location?.trim() ? u.location : game.location,
    history,
  };
}

function autosave(game: GameState | null, turn: StoryTurn | null) {
  try {
    if (game) localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, game, turn } satisfies SaveBlob));
    else localStorage.removeItem(SAVE_KEY);
  } catch {
    /* storage unavailable — in-memory state still works */
  }
}

let lastAction: string | null = null;

export const useGame = create<Store>((set, get) => ({
  phase: "start",
  game: null,
  turn: null,
  loading: false,
  error: null,

  startGame(genre, name, charClass) {
    const game = startingState(genre, name.trim() || "The Nameless One", charClass);
    set({ phase: "playing", game, turn: null, error: null });
    void get().takeTurn(BEGIN_ACTION);
  },

  async takeTurn(action) {
    const { game, loading } = get();
    if (!game || loading) return;
    lastAction = action;
    set({ loading: true, error: null });
    try {
      const turn = await requestTurn(game, action);
      const next = applyUpdates(game, turn, action);
      set({ game: next, turn, loading: false });
      autosave(next, turn);
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "The DM lost their train of thought.",
      });
    }
  },

  async retry() {
    if (lastAction) await get().takeTurn(lastAction);
  },

  resetToStart() {
    lastAction = null;
    autosave(null, null);
    set({ phase: "start", game: null, turn: null, loading: false, error: null });
  },

  exportSave() {
    const { game, turn } = get();
    if (!game) return null;
    const blob: SaveBlob = { v: 1, game, turn };
    return btoa(unescape(encodeURIComponent(JSON.stringify(blob))));
  },

  importSave(code) {
    try {
      const blob = JSON.parse(decodeURIComponent(escape(atob(code.trim())))) as SaveBlob;
      if (blob.v !== 1 || !blob.game?.character?.name) return false;
      set({ phase: "playing", game: blob.game, turn: blob.turn, loading: false, error: null });
      autosave(blob.game, blob.turn);
      return true;
    } catch {
      return false;
    }
  },
}));

/** Restore autosave on load (called once from App). */
export function loadAutosave(): boolean {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const blob = JSON.parse(raw) as SaveBlob;
    if (blob.v !== 1 || !blob.game?.character?.name) return false;
    useGame.setState({ phase: "playing", game: blob.game, turn: blob.turn });
    return true;
  } catch {
    return false;
  }
}
