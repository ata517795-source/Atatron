import { useState } from "react";
import { useGame } from "../store/gameStore";
import SidePanel from "./SidePanel";
import SceneCard from "./SceneCard";
import Typewriter from "./Typewriter";

export default function PlayScreen() {
  const game = useGame((s) => s.game);
  const turn = useGame((s) => s.turn);
  const loading = useGame((s) => s.loading);
  const error = useGame((s) => s.error);
  const takeTurn = useGame((s) => s.takeTurn);
  const retry = useGame((s) => s.retry);
  const resetToStart = useGame((s) => s.resetToStart);

  const [freeText, setFreeText] = useState("");
  const [narrativeDone, setNarrativeDone] = useState(false);

  if (!game) return null;
  const dead = game.hp <= 0;

  function act(action: string) {
    setNarrativeDone(false);
    setFreeText("");
    void takeTurn(action);
  }

  return (
    <div className="min-h-full max-w-6xl mx-auto px-4 py-6 grid gap-4 lg:grid-cols-[1fr_300px]">
      <main className="min-w-0">
        <header className="flex items-center justify-between mb-4 gap-3">
          <h1 className="font-display text-xl tracking-wide truncate" style={{ color: "var(--accent)" }}>
            Infinite Story Realms
          </h1>
          <button
            onClick={() => {
              if (confirm("Abandon this adventure and return to the start screen?")) resetToStart();
            }}
            className="text-xs px-3 py-1.5 rounded-md border"
            style={{ borderColor: "var(--edge)", color: "var(--ink-dim)" }}
          >
            New adventure
          </button>
        </header>

        {turn?.engine === "free" && game.dm === "claude" && (
          <div
            className="mb-3 text-xs px-3 py-2 rounded-md border"
            style={{ borderColor: "var(--accent)", color: "var(--accent)", background: "var(--accent-soft)" }}
          >
            The server has no ANTHROPIC_API_KEY, so the free storyteller is running this tale.
            Add a key to .env and restart to summon the Claude DM.
          </div>
        )}
        {turn?.engine === "free" && game.dm === "free" && (
          <p className="mb-3 text-[11px] uppercase tracking-[0.15em]" style={{ color: "var(--ink-dim)" }}>
            Free storyteller mode · $0 · no AI
          </p>
        )}

        <SceneCard turn={turn} />

        <article className="parchment p-6 mt-4 leading-relaxed text-[1.05rem] whitespace-pre-wrap min-h-40">
          {loading && !turn ? (
            <DmThinking />
          ) : turn ? (
            <Typewriter key={turn.narrative} text={turn.narrative} onDone={() => setNarrativeDone(true)} />
          ) : error ? (
            <p style={{ color: "var(--ink-dim)" }}>The mists refuse to part…</p>
          ) : null}
        </article>

        {error && (
          <div
            className="mt-3 px-4 py-3 rounded-md border flex items-center justify-between gap-3"
            style={{ borderColor: "var(--danger)", color: "var(--danger)" }}
          >
            <span className="text-sm">{error}</span>
            <button onClick={() => void retry()} className="btn-choice px-3 py-1.5 text-sm shrink-0">
              Try again
            </button>
          </div>
        )}

        {loading && turn && <DmThinking className="mt-4" />}

        {!loading && !error && turn && !dead && (
          <div className="mt-4 grid gap-2" style={{ opacity: narrativeDone ? 1 : 0.55 }}>
            {turn.choices.map((choice, i) => (
              <button key={i} onClick={() => act(choice)} className="btn-choice px-4 py-3" disabled={loading}>
                <span className="mr-2 font-display" style={{ color: "var(--accent)" }}>
                  {i + 1}.
                </span>
                {choice}
              </button>
            ))}
            <form
              className="flex gap-2 mt-1"
              onSubmit={(e) => {
                e.preventDefault();
                if (freeText.trim()) act(freeText.trim());
              }}
            >
              <input
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                placeholder="…or do something else entirely"
                maxLength={200}
                className="flex-1 rounded-md px-3 py-2.5 bg-black/25 border outline-none text-sm focus:border-[var(--accent)]"
                style={{ borderColor: "var(--edge)", color: "var(--ink)" }}
              />
              <button type="submit" className="btn-choice px-4 py-2 text-sm" disabled={loading || !freeText.trim()}>
                Do it
              </button>
            </form>
          </div>
        )}

        {dead && !loading && (
          <div className="mt-4 parchment p-6 text-center">
            <h2 className="font-display text-2xl" style={{ color: "var(--danger)" }}>
              Your tale ends here.
            </h2>
            <p className="mt-2 text-sm" style={{ color: "var(--ink-dim)" }}>
              HP has reached zero. But every ending seeds a new beginning.
            </p>
            <button
              onClick={resetToStart}
              className="mt-4 px-6 py-2.5 rounded-lg font-display"
              style={{ background: "var(--accent)", color: "var(--bg)" }}
            >
              Begin a new legend
            </button>
          </div>
        )}
      </main>

      <SidePanel />
    </div>
  );
}

function DmThinking({ className = "" }: { className?: string }) {
  return (
    <p className={`flex items-center gap-1.5 ${className}`} style={{ color: "var(--ink-dim)" }}>
      <span className="italic">The DM is thinking</span>
      <span className="thinking-dot">●</span>
      <span className="thinking-dot">●</span>
      <span className="thinking-dot">●</span>
    </p>
  );
}
