import { useState } from "react";
import { useGame } from "../store/gameStore";

export default function SidePanel() {
  const game = useGame((s) => s.game);
  const exportSave = useGame((s) => s.exportSave);
  const [copied, setCopied] = useState(false);

  if (!game) return null;
  const hpPct = Math.round((game.hp / game.maxHp) * 100);

  async function copySave() {
    const code = exportSave();
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      prompt("Copy your save code:", code);
    }
  }

  return (
    <aside className="space-y-3 lg:sticky lg:top-6 self-start w-full">
      <section className="panel p-4">
        <h2 className="font-display" style={{ color: "var(--accent)" }}>
          {game.character.name}
        </h2>
        <p className="text-xs mt-0.5" style={{ color: "var(--ink-dim)" }}>
          {game.character.class}
          {game.character.traits.length > 0 && ` · ${game.character.traits.join(", ")}`}
        </p>
        <div className="mt-3">
          <div className="flex justify-between text-xs mb-1" style={{ color: "var(--ink-dim)" }}>
            <span>HP</span>
            <span>
              {game.hp} / {game.maxHp}
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-black/40 overflow-hidden border" style={{ borderColor: "var(--edge)" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${hpPct}%`,
                background: hpPct > 40 ? "var(--accent)" : "var(--danger)",
              }}
            />
          </div>
        </div>
        <p className="text-xs mt-3" style={{ color: "var(--ink-dim)" }}>
          <span style={{ color: "var(--ink)" }}>Location:</span> {game.location}
        </p>
      </section>

      <PanelList title="Inventory" items={game.inventory} empty="Empty pockets." />
      <PanelList title="Quest log" items={game.questLog} empty="No quests yet." />

      {game.worldFacts.length > 0 && (
        <details className="panel p-4">
          <summary className="font-display text-sm cursor-pointer" style={{ color: "var(--accent)" }}>
            World memory ({game.worldFacts.length})
          </summary>
          <ul className="mt-2 space-y-1.5 text-xs" style={{ color: "var(--ink-dim)" }}>
            {game.worldFacts.slice(-12).map((f, i) => (
              <li key={i}>• {f}</li>
            ))}
          </ul>
        </details>
      )}

      <button onClick={() => void copySave()} className="btn-choice w-full px-4 py-2.5 text-sm">
        {copied ? "✓ Save code copied" : "Copy save code"}
      </button>
    </aside>
  );
}

function PanelList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <section className="panel p-4">
      <h3 className="font-display text-sm" style={{ color: "var(--accent)" }}>
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-xs mt-1.5 italic" style={{ color: "var(--ink-dim)" }}>
          {empty}
        </p>
      ) : (
        <ul className="mt-1.5 space-y-1 text-sm">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2">
              <span style={{ color: "var(--accent)" }}>›</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
