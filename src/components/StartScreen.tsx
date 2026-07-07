import { useState } from "react";
import { GENRE_META, type Genre } from "../types";
import { useGame } from "../store/gameStore";

export default function StartScreen() {
  const startGame = useGame((s) => s.startGame);
  const importSave = useGame((s) => s.importSave);
  const [genre, setGenre] = useState<Genre>("fantasy");
  const [name, setName] = useState("");
  const [charClass, setCharClass] = useState(GENRE_META[0].classes[0]);
  const [saveCode, setSaveCode] = useState("");
  const [saveError, setSaveError] = useState(false);

  const meta = GENRE_META.find((g) => g.id === genre)!;

  function pickGenre(g: (typeof GENRE_META)[number]) {
    setGenre(g.id);
    setCharClass(g.classes[0]);
    document.documentElement.dataset.theme = g.id;
  }

  return (
    <div className="min-h-full flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl">
        <header className="text-center mb-8">
          <h1 className="font-display text-4xl sm:text-5xl tracking-wide" style={{ color: "var(--accent)" }}>
            Infinite Story Realms
          </h1>
          <p className="mt-3 text-sm" style={{ color: "var(--ink-dim)" }}>
            A living text adventure. Claude is your dungeon master — every world, every twist,
            invented the moment you act.
          </p>
        </header>

        <section className="parchment p-6 sm:p-8">
          <h2 className="font-display text-lg mb-3">Choose your realm</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-1">
            {GENRE_META.map((g) => (
              <button
                key={g.id}
                onClick={() => pickGenre(g)}
                className="btn-choice px-4 py-3"
                style={
                  g.id === genre
                    ? { borderColor: "var(--accent)", background: "var(--accent-soft)", outline: "1px solid var(--accent)" }
                    : undefined
                }
                aria-pressed={g.id === genre}
              >
                <span className="block font-display">{g.label}</span>
                <span className="block text-xs mt-1" style={{ color: "var(--ink-dim)" }}>
                  {g.tagline}
                </span>
              </button>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mt-6">
            <label className="block">
              <span className="text-sm" style={{ color: "var(--ink-dim)" }}>
                Your name
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Rowan Vale"
                maxLength={40}
                className="mt-1 w-full rounded-md px-3 py-2 bg-black/25 border outline-none focus:border-[var(--accent)]"
                style={{ borderColor: "var(--edge)", color: "var(--ink)" }}
              />
            </label>
            <label className="block">
              <span className="text-sm" style={{ color: "var(--ink-dim)" }}>
                Your calling
              </span>
              <select
                value={charClass}
                onChange={(e) => setCharClass(e.target.value)}
                className="mt-1 w-full rounded-md px-3 py-2 bg-black/25 border outline-none focus:border-[var(--accent)]"
                style={{ borderColor: "var(--edge)", color: "var(--ink)" }}
              >
                {meta.classes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button
            onClick={() => startGame(genre, name, charClass)}
            className="mt-6 w-full py-3 rounded-lg font-display text-lg tracking-wide transition-transform hover:-translate-y-px"
            style={{ background: "var(--accent)", color: "var(--bg)" }}
          >
            Begin the adventure
          </button>
        </section>

        <section className="panel mt-4 p-4">
          <details>
            <summary className="cursor-pointer text-sm" style={{ color: "var(--ink-dim)" }}>
              Continue from a save code
            </summary>
            <div className="mt-3 flex gap-2">
              <input
                value={saveCode}
                onChange={(e) => {
                  setSaveCode(e.target.value);
                  setSaveError(false);
                }}
                placeholder="Paste save code…"
                className="flex-1 rounded-md px-3 py-2 bg-black/25 border outline-none text-sm"
                style={{ borderColor: saveError ? "var(--danger)" : "var(--edge)", color: "var(--ink)" }}
              />
              <button
                onClick={() => {
                  if (!importSave(saveCode)) setSaveError(true);
                }}
                className="btn-choice px-4 py-2 text-sm"
              >
                Load
              </button>
            </div>
            {saveError && (
              <p className="mt-2 text-xs" style={{ color: "var(--danger)" }}>
                That save code couldn't be read.
              </p>
            )}
          </details>
        </section>
      </div>
    </div>
  );
}
