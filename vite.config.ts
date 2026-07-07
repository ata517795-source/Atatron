import { defineConfig, loadEnv, type Plugin, type Connect } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { handleStory } from "./api/_lib/storyCore";
import { handleImage } from "./api/_lib/imageCore";

/**
 * Dev-only /api middleware so `npm run dev` serves the SAME server logic that
 * Vercel runs in production (api/story.ts + api/image.ts are thin wrappers
 * around the shared api/_lib modules). Secrets from .env stay server-side —
 * only VITE_-prefixed vars ever reach the browser bundle.
 */
function devApi(env: Record<string, string>): Plugin {
  const route =
    (fn: (body: unknown, env: Record<string, string>) => Promise<{ status: number; body: unknown }>): Connect.NextHandleFunction =>
    (req, res) => {
      if (req.method !== "POST") {
        res.statusCode = 405;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ error: "Method not allowed" }));
        return;
      }
      let raw = "";
      req.on("data", (chunk) => (raw += chunk));
      req.on("end", async () => {
        let parsed: unknown = {};
        try {
          parsed = raw ? JSON.parse(raw) : {};
        } catch {
          /* handled as invalid body by the core */
        }
        try {
          const result = await fn(parsed, env);
          res.statusCode = result.status;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify(result.body));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }));
        }
      });
    };

  return {
    name: "dev-api",
    configureServer(server) {
      server.middlewares.use("/api/story", route(handleStory));
      server.middlewares.use("/api/image", route(handleImage));
    },
  };
}

export default defineConfig(({ mode }) => {
  // Loads ALL vars from .env (including non-VITE_ secrets) for the dev
  // middleware only. Vite still exposes only VITE_-prefixed vars to the client.
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), tailwindcss(), devApi(env)],
  };
});
