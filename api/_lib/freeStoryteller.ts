// ─── Free storyteller engine ─────────────────────────────────────────────
// A $0, no-API-key procedural DM. Deterministic seeded tables weave a real
// arc per adventure (villain, treasure, destination) with encounters,
// hazards, discoveries and a climax. Clearly labeled in the UI — it never
// pretends to be the Claude DM.

import type { GameState, StoryTurn } from "./storyCore";

// ── Seeded RNG ────────────────────────────────────────────────────────────
function hashStr(s: string): number {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(rng: () => number, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
const range = (rng: () => number, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));

// ── Genre word banks ──────────────────────────────────────────────────────
interface Bank {
  travelVerb: string;
  places: string[];
  npcNames: string[];
  npcRoles: string[];
  villains: string[];
  macguffins: string[];
  items: string[];
  hazards: string[];
  shelters: string[];
  moods: string[];
}

const BANKS: Record<string, Bank> = {
  fantasy: {
    travelVerb: "walk",
    places: [
      "the Thornwood", "Greyspire Keep", "the village of Ashford", "the Sunken Chapel",
      "Mistfen Marsh", "the Old King's Road", "Hollowmere", "the Screaming Caves",
    ],
    npcNames: ["Bram", "Edrys", "Tolliver", "Maren", "Old Sylla", "Corvin", "Petra", "Dunric", "Isolde", "Fenn"],
    npcRoles: [
      "a wandering tinker", "a one-eyed huntress", "a nervous acolyte",
      "a retired sellsword", "a herb-witch", "a road warden",
    ],
    villains: ["the Pale Baron", "Morgatha the Unsleeping", "the Wyrm of Hollowmere", "the Ashen King"],
    macguffins: ["the Ember Crown", "the Bell of Saint Varra", "the Last Seed of the Elderwood", "the Moonwrit Grimoire"],
    items: [
      "a coil of elven rope", "a jar of glowmoss", "a silver-edged dagger", "a traveler's cloak",
      "dried waybread", "a warding charm", "a rusted key", "a vial of troll salve",
      "a torn map fragment", "a hunting horn",
    ],
    hazards: [
      "A snare of living roots whips around your ankle",
      "The footbridge groans and gives way beneath you",
      "Dire wolves burst from the bracken, all teeth and hunger",
      "A cursed mist rolls in and drinks the warmth from your bones",
      "Bandits rise from the ditch with crossbows leveled",
    ],
    shelters: ["a hollow oak", "an abandoned watchtower", "a shepherd's bothy", "a mossy overhang"],
    moods: [
      "Crows argue in the bare branches overhead.",
      "Somewhere far off, a bell tolls the wrong hour.",
      "The air smells of rain and old iron.",
      "Fireflies drift past like sparks from an unseen forge.",
      "The road remembers older feet than yours.",
    ],
  },
  "sci-fi": {
    travelVerb: "make your way",
    places: [
      "the derelict freighter Cassandra's Wake", "Dock 7 of Meridian Station", "the hydroponics ring",
      "the AI core vault", "the smugglers' bazaar", "cryo-bay theta", "the maintenance underdeck",
      "the observation blister",
    ],
    npcNames: ["Juno", "Aksel", "Dr. Imura", "Whistler", "Saint-6", "Reyes", "Okonkwo", "Pell", "Vasquez", "Trill"],
    npcRoles: [
      "a twitchy dock rat", "a decommissioned combat android", "a company auditor",
      "a void-scarred pilot", "a black-market chemist", "a station chaplain",
    ],
    villains: [
      "the Overseer AI HALCYON", "Consortium enforcer Drax Volle",
      "the hive-mind of Bay 12", "Captain Nyx of the Red Quadrant",
    ],
    macguffins: [
      "the jump-drive prototype", "the colony seed-vault codes",
      "the black-box of the Cassandra", "the antimatter regulator",
    ],
    items: [
      "a plasma cutter", "an oxygen candle", "a forged ID chit", "a med-stim injector",
      "a coil of monofilament", "a cracked datapad", "an EMP puck", "a ration brick",
      "a magnetic grapple", "a signal jammer",
    ],
    hazards: [
      "A hull breach hisses your atmosphere into the void",
      "A security turret wakes with a red, unblinking eye",
      "A swarm of feral repair drones descends in a chittering cloud",
      "Radiation bleeds through a cracked shield plate",
      "A pressure door slams shut, clipping you on the way through",
    ],
    shelters: ["a sealed crew cabin", "a cargo pod with working heat", "the lee of a coolant stack", "an intact escape blister"],
    moods: [
      "Station lights flicker in a rhythm that is almost a language.",
      "Somewhere in the walls, something is knocking back.",
      "The recycled air tastes of copper and someone else's fear.",
      "Through the viewport, the nebula burns silent and indifferent.",
      "A half-erased announcement loops in a dead crew member's voice.",
    ],
  },
  mystery: {
    travelVerb: "make your way",
    places: [
      "the Blue Lantern jazz club", "the rain-flooded docks", "Room 313 of the Hotel Marchmont",
      "the county records office", "the fog-bound tram depot", "the widow's brownstone",
      "the coroner's basement", "the newspaper morgue",
    ],
    npcNames: [
      "Vivian Kade", "Sgt. O'Mara", "Little Eddie", "Miss Chen", "Father Doyle",
      "Rosa", "the Professor", "Colm", "Betty Two-Rings", "Marlowe",
    ],
    npcRoles: [
      "a chain-smoking informant", "a crooked beat cop", "a nightclub singer",
      "a nervous bank teller", "a retired safecracker", "an ambulance chaser",
    ],
    villains: ["the Marchmont strangler", "Councilman Vey", "the Scarlet Syndicate", "whoever signs their notes 'M.'"],
    macguffins: ["the missing ledger", "the negative of the photograph", "the dead man's key", "the confession letter"],
    items: [
      "a matchbook from the Blue Lantern", "a press pass", "a snub-nosed revolver", "a flask of rye",
      "a lockpick set", "a bus ticket to nowhere", "a bloodstained glove", "a pawn shop receipt",
      "a stenographer's notebook", "a stranger's house key",
    ],
    hazards: [
      "A sap catches you behind the ear before you hear the footsteps",
      "A black sedan mounts the curb and nearly pins you to the wall",
      "A warning shot stars the window a foot from your head",
      "The drink was doped — the room tilts hard",
      "Two heavies in cheap suits decide to make their point physically",
    ],
    shelters: ["an all-night diner", "the back pew of St. Brigid's", "your office with the blinds drawn", "a friendly barber's back room"],
    moods: [
      "Rain writes its confession on the window glass.",
      "A saxophone bleeds through the wall from somewhere unseen.",
      "Every streetlight down the block has a halo of fog.",
      "The city hums like it knows something you don't.",
      "Yesterday's headlines drift wet along the gutter.",
    ],
  },
  pirate: {
    travelVerb: "sail",
    places: [
      "Port Greelock", "the reef of Widow's Teeth", "the black-sailed wreck Perdition",
      "Tortuga Row", "the smugglers' cove", "the captain's cabin", "the powder deck", "Gull Rock",
    ],
    npcNames: [
      "Salt-Anne", "Barbosso", "Quiet Tom", "Madame Reve", "Fiddler Jack",
      "the Bosun", "Ysabel", "One-Shot Erne", "Cookie", "Dogwatch Bill",
    ],
    npcRoles: [
      "a rum-soaked navigator", "a press-ganged surgeon", "a shark-toothed quartermaster",
      "a dockside fortune-teller", "a marooned mutineer", "a harbor spy",
    ],
    villains: ["Admiral Corvane of the Crown", "Blackfin the Drowned", "the ghost-crew of the Perdition", "Queen Maru of the reef raiders"],
    macguffins: ["the Siren's Ledger", "the compass that points to guilt", "the Perdition's gold manifest", "the sea-charts of the Widow's Teeth"],
    items: [
      "a rusty cutlass", "a spyglass with a cracked lens", "a bottle of black rum", "a boarding axe",
      "a pouch of pieces-of-eight", "a storm lantern", "a shark-tooth charm", "a coil of tarred rope",
      "a smuggler's false-bottom chest", "a parrot with opinions",
    ],
    hazards: [
      "A rogue wave slams you against the gunwale",
      "Grapeshot screams overhead as a Crown sloop opens fire",
      "The reef tears a groan from the hull beneath your feet",
      "A knife-fight spills out of the tavern and swallows you",
      "The rigging snaps and drops a spar where you stood",
    ],
    shelters: ["a dry sea-cave", "the fo'c'sle hammocks", "a friendly tavern's loft", "a beached longboat turned turtle"],
    moods: [
      "Gulls wheel and jeer over the mastheads.",
      "The tide drags its slow knife along the shore.",
      "Somewhere below, the bilge sings its rotten song.",
      "Lightning walks the horizon like a drunken god.",
      "The wind carries salt, tar, and someone's bad intentions.",
    ],
  },
  "post-apoc": {
    travelVerb: "trek",
    places: [
      "the rust-market of Old Junction", "the collapsed overpass camp", "Vault Door 9",
      "the glass flats", "the dead mall's atrium", "the water-tower settlement",
      "the irradiated orchard", "Signal Hill",
    ],
    npcNames: ["Patch", "Mother Greer", "Deacon", "Lark", "Two-Volt", "Sana", "the Cartographer", "Bones", "Ivy", "Ratchet"],
    npcRoles: [
      "a scrap prospector", "a caravan doctor", "a radio hermit",
      "a seed-keeper", "a toll-bridge runner", "a dust nomad",
    ],
    villains: ["the Rustlords of Junction", "the Geiger Saint and his choir", "the machine-cult of Vault 9", "Warboss Kettle"],
    macguffins: ["the seed-vault manifest", "the water purifier core", "the pre-Fall map cache", "the antibiotic cooler"],
    items: [
      "a hand-cranked flashlight", "a gas mask with one good filter", "a jar of clean water", "a machete",
      "a geiger counter that mostly works", "a can of pre-Fall peaches", "a bundle of copper wire",
      "a bicycle-chain whip", "a solar cell", "a dog-eared repair manual",
    ],
    hazards: [
      "The ground gives way into a buried basement",
      "A dust storm strips the horizon and then your skin",
      "Feral dogs pace you with patient, clever eyes",
      "The geiger counter screams before you feel the heat",
      "Raiders' headlights pin you against the hardpan",
    ],
    shelters: ["a rust-eaten school bus", "a storm cellar with a working bolt", "a subway mouth", "a pre-Fall bank vault"],
    moods: [
      "Wind hisses through a fence that guards nothing now.",
      "A traffic light sways, blinking amber at empty roads.",
      "Static on the hand radio almost resolves into a voice.",
      "The bones of the old world make long shadows at dusk.",
      "Rain falls, and you can't tell yet if it's the safe kind.",
    ],
  },
};

// ── Arc derivation (deterministic per character + adventure count) ───────
interface Arc {
  villain: string;
  macguffin: string;
  goalPlace: string;
  startPlace: string;
  ally: string;
  allyRole: string;
}

function deriveArc(bank: Bank, seedStr: string, arcIndex: number): Arc {
  const rng = mulberry32(hashStr(`${seedStr}#arc${arcIndex}`));
  const startPlace = pick(rng, bank.places);
  let goalPlace = pick(rng, bank.places);
  if (goalPlace === startPlace) goalPlace = bank.places[(bank.places.indexOf(goalPlace) + 3) % bank.places.length];
  return {
    villain: pick(rng, bank.villains),
    macguffin: pick(rng, bank.macguffins),
    goalPlace,
    startPlace,
    ally: pick(rng, bank.npcNames),
    allyRole: pick(rng, bank.npcRoles),
  };
}

const VICTORY_PREFIX = "Victory: ";

// ── Turn generation ───────────────────────────────────────────────────────
export function freeTurn(state: GameState, playerAction: string, beginAction: string): StoryTurn {
  const bank = BANKS[state.genre] ?? BANKS.fantasy;
  const seedStr = `${state.character.name}|${state.genre}`;
  const victories = state.worldFacts.filter((f) => f.startsWith(VICTORY_PREFIX)).length;
  const arc = deriveArc(bank, seedStr, victories);

  // Per-turn variety seed: changes with every action and accumulated fact.
  const rng = mulberry32(
    hashStr(`${seedStr}|${state.worldFacts.length}|${state.history.length}|${playerAction}|${state.hp}`),
  );

  if (playerAction === beginAction) return openingTurn(state, bank, arc, rng);

  // Progress within the current arc ≈ facts recorded since the last victory.
  const lastVictoryIdx = state.worldFacts.reduce((acc, f, i) => (f.startsWith(VICTORY_PREFIX) ? i : acc), -1);
  const progress = state.worldFacts.length - 1 - lastVictoryIdx;
  const stage: "early" | "mid" | "late" = progress < 3 ? "early" : progress < 6 ? "mid" : "late";

  const action = playerAction.trim();
  const lowerAction = action.toLowerCase();

  // The confrontation unlocks once the tale is underway — either by naming
  // the villain / choosing "confront", or by pushing to the goal in person.
  const mentionsGoal = lowerAction.includes(arc.goalPlace.toLowerCase());
  const wantsClimax =
    stage !== "early" &&
    (lowerAction.includes("confront") ||
      lowerAction.includes(arc.villain.toLowerCase()) ||
      (mentionsGoal && (state.location === arc.goalPlace || stage === "late")));
  if (wantsClimax) return climaxTurn(state, bank, arc, rng);

  const resting = /rest|camp|sleep|shelter|heal|recover/i.test(action);
  if (resting && state.hp < state.maxHp) return restTurn(state, bank, arc, rng, action);

  // Directed travel: if the action names a known place, actually go there.
  const namedPlace = [...bank.places]
    .sort((a, b) => b.length - a.length)
    .find((p) => lowerAction.includes(p.toLowerCase()));
  if (namedPlace && namedPlace !== state.location) {
    return travelTurn(state, bank, arc, rng, action, stage, namedPlace);
  }

  // Weighted episode table; wounded players see fewer hazards.
  const roll = rng();
  const hazardCut = state.hp < 30 ? 0.12 : 0.25;
  if (roll < hazardCut) return hazardTurn(state, bank, arc, rng, action);
  if (roll < 0.5) return npcTurn(state, bank, arc, rng, action, stage);
  if (roll < 0.68) return discoveryTurn(state, bank, arc, rng, action);
  return travelTurn(state, bank, arc, rng, action, stage);
}

// ── Shared helpers ────────────────────────────────────────────────────────
function ack(action: string): string {
  const a = action.replace(/[.!?]+$/, "");
  const lower = a.charAt(0).toLowerCase() + a.slice(1);
  return `You ${/^you /i.test(a) ? lower.replace(/^you /i, "") : `set your mind to it: ${lower}`}.`;
}

function baseChoices(bank: Bank, arc: Arc, rng: () => number, state: GameState, stage: string): string[] {
  const choices: string[] = [];
  const otherPlace = pick(rng, bank.places.filter((p) => p !== state.location));
  choices.push(`Head for ${otherPlace}`);
  choices.push(pick(rng, [
    "Search the area carefully",
    "Ask around for rumors",
    `Look for signs of ${arc.villain}`,
    "Keep to the shadows and observe",
  ]));
  if (stage === "late") choices.push(`Confront ${arc.villain} at ${arc.goalPlace}`);
  else choices.push(`Press on toward ${arc.goalPlace}`);
  if (state.hp < state.maxHp * 0.6) choices.push("Find shelter and rest");
  return [...new Set(choices)].slice(0, 4);
}

function emptyUpdates() {
  return { hpDelta: 0, addItems: [], removeItems: [], newQuests: [], newFacts: [], location: "" };
}

const FREE: Pick<StoryTurn, "engine"> = { engine: "free" };

// ── Episode types ─────────────────────────────────────────────────────────
function openingTurn(state: GameState, bank: Bank, arc: Arc, rng: () => number): StoryTurn {
  const item = pick(rng, bank.items);
  const mood = pick(rng, bank.moods);
  const narrative = [
    `${state.character.name}, ${state.character.class.toLowerCase()}, your story opens in ${arc.startPlace}. ${mood}`,
    `Word travels fast in places like this, and tonight it travels straight to you: ${arc.macguffin} — the thing everyone swore was legend — is real, and ${arc.villain} holds it at ${arc.goalPlace}. ${arc.ally}, ${arc.allyRole}, presses ${item} into your hands and says you're the only one fool enough to go after it.`,
    `The road will not be kind. But then, neither are you.`,
  ].join("\n\n");
  return {
    ...FREE,
    narrative,
    choices: [
      `Set out toward ${arc.goalPlace}`,
      `Ask ${arc.ally} what they know about ${arc.villain}`,
      "Gather supplies before leaving",
      "Scout the area first",
    ],
    imagePrompt: `A lone adventurer receiving a quest in ${arc.startPlace}, moody atmospheric light`,
    stateUpdates: {
      ...emptyUpdates(),
      addItems: [item],
      newQuests: [`Recover ${arc.macguffin} from ${arc.villain} at ${arc.goalPlace}`],
      newFacts: [`${arc.ally} (${arc.allyRole}) set you hunting ${arc.macguffin}, held by ${arc.villain} at ${arc.goalPlace}`],
      location: arc.startPlace,
    },
  };
}

function travelTurn(
  state: GameState,
  bank: Bank,
  arc: Arc,
  rng: () => number,
  action: string,
  stage: string,
  destOverride?: string,
): StoryTurn {
  const dest = destOverride ?? pick(rng, bank.places.filter((p) => p !== state.location));
  const mood = pick(rng, bank.moods);
  const hint =
    stage === "late" || dest === arc.goalPlace
      ? `${arc.goalPlace} is close now — you can feel ${arc.villain}'s attention like weather about to turn.`
      : `Every league brings new whispers of ${arc.villain}, none of them comforting.`;
  return {
    ...FREE,
    narrative: [`${ack(action)} You ${bank.travelVerb} on, leaving ${state.location} behind, until ${dest} rises to meet you.`, `${mood} ${hint}`].join("\n\n"),
    choices: baseChoices(bank, arc, rng, { ...state, location: dest }, stage),
    imagePrompt: `A traveler arriving at ${dest}, ${state.genre} atmosphere, dramatic sky`,
    stateUpdates: { ...emptyUpdates(), newFacts: [`Reached ${dest}`], location: dest },
  };
}

function npcTurn(state: GameState, bank: Bank, arc: Arc, rng: () => number, action: string, stage: string): StoryTurn {
  const name = pick(rng, bank.npcNames.filter((n) => n !== arc.ally));
  const role = pick(rng, bank.npcRoles);
  const givesItem = rng() < 0.4;
  const item = pick(rng, bank.items.filter((i) => !state.inventory.includes(i)));
  const rumor = pick(rng, [
    `${arc.villain} has doubled the watch at ${arc.goalPlace} — something has them spooked.`,
    `a stranger was asking about you by name, and paid in good coin for the answers.`,
    `there's a safe way into ${arc.goalPlace}, known only to those who dig for it.`,
    `${arc.macguffin} is said to mark whoever holds it. ${arc.villain} is already marked.`,
  ]);
  const body = givesItem
    ? `${name} sizes you up, then trades you ${item} for nothing but your word to remember the favor. "And a warning for free," they add: ${rumor}`
    : `Over a guarded conversation, ${name} lets one thing slip: ${rumor}`;
  return {
    ...FREE,
    narrative: [`${ack(action)} Near ${state.location} you fall in with ${name}, ${role}.`, body, pick(rng, bank.moods)].join("\n\n"),
    choices: baseChoices(bank, arc, rng, state, stage),
    imagePrompt: `Two figures in quiet negotiation at ${state.location}, ${state.genre} mood`,
    stateUpdates: {
      ...emptyUpdates(),
      addItems: givesItem ? [item] : [],
      newFacts: [`Met ${name}, ${role}, at ${state.location}`],
    },
  };
}

function discoveryTurn(state: GameState, bank: Bank, arc: Arc, rng: () => number, action: string): StoryTurn {
  const item = pick(rng, bank.items.filter((i) => !state.inventory.includes(i)));
  return {
    ...FREE,
    narrative: [
      `${ack(action)} Patience pays: tucked where only the thorough would look, you find ${item}.`,
      `${pick(rng, bank.moods)} Small victories keep the long road honest.`,
    ].join("\n\n"),
    choices: baseChoices(bank, arc, rng, state, "mid"),
    imagePrompt: `A hand uncovering ${item} in ${state.location}, close-up, ${state.genre} tones`,
    stateUpdates: { ...emptyUpdates(), addItems: [item], newFacts: [`Found ${item} near ${state.location}`] },
  };
}

function hazardTurn(state: GameState, bank: Bank, arc: Arc, rng: () => number, action: string): StoryTurn {
  const hazard = pick(rng, bank.hazards);
  const dmg = -range(rng, 8, 18);
  const loseItem = state.inventory.length > 2 && rng() < 0.25;
  const lost = loseItem ? state.inventory[Math.floor(rng() * state.inventory.length)] : null;
  return {
    ...FREE,
    narrative: [
      `${ack(action)} Then the world objects. ${hazard}.`,
      `You come through it breathing — barely${lost ? ` — and ${lost} does not come with you` : ""}. ${pick(rng, bank.moods)}`,
    ].join("\n\n"),
    choices: baseChoices(bank, arc, rng, state, "mid"),
    imagePrompt: `A moment of sudden danger at ${state.location}, motion and chaos, ${state.genre} style`,
    stateUpdates: { ...emptyUpdates(), hpDelta: dmg, removeItems: lost ? [lost] : [], newFacts: [`Survived danger at ${state.location}`] },
  };
}

function restTurn(state: GameState, bank: Bank, arc: Arc, rng: () => number, action: string): StoryTurn {
  const shelter = pick(rng, bank.shelters);
  const heal = range(rng, 12, 22);
  return {
    ...FREE,
    narrative: [
      `${ack(action)} You find ${shelter} and let the hours do their quiet work. Wounds close; thoughts settle.`,
      `${pick(rng, bank.moods)} Somewhere out there, ${arc.villain} isn't resting. Best not to linger.`,
    ].join("\n\n"),
    choices: baseChoices(bank, arc, rng, state, "mid"),
    imagePrompt: `A weary traveler resting in ${shelter}, warm light against darkness`,
    stateUpdates: { ...emptyUpdates(), hpDelta: heal },
  };
}

function climaxTurn(state: GameState, bank: Bank, arc: Arc, rng: () => number): StoryTurn {
  const dmg = -range(rng, 8, state.hp > 40 ? 20 : 10);
  const nextHint = "The world is wide, and rumor never sleeps — already there is talk of something new.";
  return {
    ...FREE,
    narrative: [
      `${arc.goalPlace}. ${arc.villain} is waiting — of course they are. What follows is fast, ugly, and closer than you'll ever admit in the retelling.`,
      `When it ends, you are the one still standing, and ${arc.macguffin} is in your hands. Whatever power it holds, tonight it holds the shape of a promise kept.`,
      `${pick(rng, bank.moods)} ${nextHint}`,
    ].join("\n\n"),
    choices: ["Set out toward a new tale", "Take stock of your winnings", "Rest on your laurels a while"],
    imagePrompt: `A triumphant figure holding ${arc.macguffin} at ${arc.goalPlace}, epic ${state.genre} finale`,
    stateUpdates: {
      ...emptyUpdates(),
      hpDelta: dmg,
      addItems: [capitalize(arc.macguffin)],
      newFacts: [`${VICTORY_PREFIX}took ${arc.macguffin} from ${arc.villain} at ${arc.goalPlace}`],
      location: arc.goalPlace,
    },
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
