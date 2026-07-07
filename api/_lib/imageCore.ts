// Scene-art proxy STUB. The app runs fully without images (text scene cards).
// To enable: pick an image provider, set IMAGE_API_KEY in .env / Vercel env,
// implement the call below, and set VITE_IMAGE_ENABLED=1 for the client.

export interface ImageResult {
  status: number;
  body: { url: string } | { error: string };
}

export async function handleImage(rawBody: unknown, env: Record<string, string | undefined>): Promise<ImageResult> {
  const body = (rawBody ?? {}) as Record<string, unknown>;
  const prompt = typeof body.prompt === "string" ? body.prompt.slice(0, 500).trim() : "";
  if (!prompt) return { status: 400, body: { error: "Missing prompt" } };

  if (!env.IMAGE_API_KEY) {
    return { status: 501, body: { error: "Image generation not configured (IMAGE_API_KEY unset)." } };
  }

  // TODO: call your chosen image provider here with env.IMAGE_API_KEY and
  // return { status: 200, body: { url: <hosted image URL or data: URI> } }.
  return { status: 501, body: { error: "Image provider not implemented yet." } };
}
