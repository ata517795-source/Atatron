// Shared game types. The server (api/_lib) keeps its own copy of the wire
// types so the serverless bundle never imports from src/.

export const GENRES = ["fantasy", "sci-fi", "mystery", "pirate", "post-apoc"] as const;
export type Genre = (typeof GENRES)[number];

/** Which storyteller runs the game. */
export type DmMode = "claude" | "free";

export interface Character {
  name: string;
  class: string;
  traits: string[];
}

export interface HistoryEntry {
  action: string;
  summary: string;
}

/** Full game state — kept client-side, sent to /api/story every turn. */
export interface GameState {
  genre: Genre;
  dm: DmMode;
  character: Character;
  hp: number;
  maxHp: number;
  inventory: string[];
  questLog: string[];
  worldFacts: string[];
  location: string;
  history: HistoryEntry[];
}

export interface StateUpdates {
  hpDelta?: number;
  addItems?: string[];
  removeItems?: string[];
  newQuests?: string[];
  newFacts?: string[];
  location?: string;
}

/** One DM turn as returned by /api/story. */
export interface StoryTurn {
  narrative: string;
  choices: string[];
  imagePrompt: string;
  stateUpdates: StateUpdates;
  /** Which engine produced this turn. */
  engine?: DmMode;
}

export interface GenreMeta {
  id: Genre;
  label: string;
  tagline: string;
  classes: string[];
}

export const GENRE_META: GenreMeta[] = [
  {
    id: "fantasy",
    label: "High Fantasy",
    tagline: "Ancient forests, forgotten crowns, and sleeping dragons.",
    classes: ["Wandering Knight", "Hedge Mage", "Gutter Thief", "Storm Bard"],
  },
  {
    id: "sci-fi",
    label: "Deep-Space Sci-Fi",
    tagline: "Derelict stations, rogue AIs, and the cold between stars.",
    classes: ["Salvage Pilot", "Ship Engineer", "Void Marine", "Xeno-Linguist"],
  },
  {
    id: "mystery",
    label: "Noir Mystery",
    tagline: "Rain-slick streets, locked rooms, and lies in every alibi.",
    classes: ["Private Eye", "Beat Reporter", "Retired Detective", "Cat Burglar"],
  },
  {
    id: "pirate",
    label: "Age of Sail",
    tagline: "Cursed gold, black flags, and storms that whisper your name.",
    classes: ["First Mate", "Powder Monkey", "Sea Witch", "Disgraced Captain"],
  },
  {
    id: "post-apoc",
    label: "Post-Apocalypse",
    tagline: "Rust, radiation, and the stubborn ember of civilization.",
    classes: ["Scavenger", "Road Medic", "Caravan Guard", "Vault Tinkerer"],
  },
];

export function startingState(genre: Genre, name: string, charClass: string, dm: DmMode): GameState {
  return {
    genre,
    dm,
    character: { name, class: charClass, traits: [] },
    hp: 100,
    maxHp: 100,
    inventory: [],
    questLog: [],
    worldFacts: [],
    location: "unknown",
    history: [],
  };
}
