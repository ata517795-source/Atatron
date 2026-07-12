import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const CACHE_DIR = path.join(HERE, "..", ".cache", "repos");

export function runGit(
  args: string[],
  cwd: string,
  opts: { maxBuffer?: number; timeout?: number } = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      args,
      {
        cwd,
        maxBuffer: opts.maxBuffer ?? 64 * 1024 * 1024,
        timeout: opts.timeout ?? 180_000,
        env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
      },
      (err, stdout) => (err ? reject(err) : resolve(stdout)),
    );
  });
}

export function validateRepoUrl(url: string): string {
  const trimmed = url.trim();
  if (!/^https:\/\/[\w.-]+\/[\w./~-]+$/.test(trimmed)) {
    throw new Error(
      "Repo URL must be a plain https git URL, e.g. https://github.com/owner/repo",
    );
  }
  return trimmed.replace(/\.git$/, "");
}

export function repoName(url: string): string {
  const parts = validateRepoUrl(url).split("/");
  return parts.slice(-2).join("/");
}

/** Clone (or reuse a cached clone of) a public repo. Returns the working dir. */
export async function ensureClone(repoUrl: string): Promise<string> {
  const url = validateRepoUrl(repoUrl);
  const dir = path.join(
    CACHE_DIR,
    createHash("sha1").update(url).digest("hex").slice(0, 16),
  );
  if (fs.existsSync(path.join(dir, ".git"))) {
    return dir;
  }
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  await runGit(
    ["clone", "--single-branch", "--no-tags", `${url}.git`, dir],
    CACHE_DIR,
    { timeout: 300_000 },
  );
  return dir;
}
