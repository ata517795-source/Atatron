import type { GameState, StoryTurn } from "../types";

/**
 * Calls OUR /api/story endpoint (the Anthropic proxy). The Anthropic API key
 * lives only in that serverless function — never in this browser bundle.
 */
export async function requestTurn(state: GameState, playerAction: string): Promise<StoryTurn> {
  const res = await fetch("/api/story", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ state, playerAction }),
  });

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON error body */
  }

  if (!res.ok) {
    const msg =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : `The realm flickered (HTTP ${res.status}). Try again.`;
    throw new Error(msg);
  }

  const turn = body as StoryTurn;
  if (!turn || typeof turn.narrative !== "string" || !Array.isArray(turn.choices)) {
    throw new Error("The DM's reply was garbled. Try again.");
  }
  return turn;
}
