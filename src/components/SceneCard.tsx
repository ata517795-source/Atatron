import { useEffect, useState } from "react";
import type { StoryTurn } from "../types";

const IMAGE_ENABLED = import.meta.env.VITE_IMAGE_ENABLED === "1";

/**
 * Scene banner. Text-only stylized card by default; if VITE_IMAGE_ENABLED=1 it
 * asks /api/image for art and falls back to the text card on any failure.
 */
export default function SceneCard({ turn }: { turn: StoryTurn | null }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    setImageUrl(null);
    if (!IMAGE_ENABLED || !turn?.imagePrompt) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/image", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ prompt: turn.imagePrompt }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { url?: string };
        if (!cancelled && data.url) setImageUrl(data.url);
      } catch {
        /* image layer is optional — text card remains */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [turn?.imagePrompt]);

  if (!turn?.imagePrompt) return null;

  if (imageUrl) {
    return (
      <div className="rounded-xl overflow-hidden border" style={{ borderColor: "var(--edge)" }}>
        <img src={imageUrl} alt={turn.imagePrompt} className="w-full max-h-64 object-cover" />
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border px-5 py-4"
      style={{
        borderColor: "var(--edge)",
        background: "linear-gradient(135deg, var(--accent-soft), transparent 70%), var(--bg-panel)",
      }}
    >
      <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--accent)" }}>
        Scene
      </p>
      <p className="mt-1 text-sm italic" style={{ color: "var(--ink-dim)" }}>
        {turn.imagePrompt}
      </p>
    </div>
  );
}
