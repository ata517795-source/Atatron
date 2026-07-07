import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleImage } from "./_lib/imageCore";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const result = await handleImage(req.body, process.env);
  res.status(result.status).json(result.body);
}
