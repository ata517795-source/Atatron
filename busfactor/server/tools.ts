import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { runGit } from "./git.ts";

/**
 * Read-only repo tools handed to the interviewer agent. Every path is
 * canonicalized and confined to the cloned repo directory; git commands run
 * via execFile (no shell), so model output can't escape the sandbox.
 */

const MAX_LINES_PER_READ = 250;
const MAX_OUTPUT_CHARS = 20_000;

function confine(repoDir: string, requested: string): string {
  const resolved = path.resolve(repoDir, requested.replace(/^\/+/, ""));
  if (resolved !== repoDir && !resolved.startsWith(repoDir + path.sep)) {
    throw new Error(`Path escapes the repository: ${requested}`);
  }
  return resolved;
}

const clip = (s: string) =>
  s.length > MAX_OUTPUT_CHARS ? s.slice(0, MAX_OUTPUT_CHARS) + "\n…[truncated]" : s;

export function makeRepoTools(repoDir: string) {
  const listFiles = betaZodTool({
    name: "list_files",
    description:
      "List files in a directory of the repository (recursive, up to 200 entries). Call with dir='.' for the repo root.",
    inputSchema: z.object({
      dir: z.string().describe("Directory path relative to the repo root, e.g. 'src/router'"),
    }),
    run: async ({ dir }) => {
      const out = await runGit(["ls-files", "--", dir === "." ? "." : dir], repoDir);
      const lines = out.split("\n").filter(Boolean);
      const shown = lines.slice(0, 200);
      return clip(shown.join("\n") + (lines.length > 200 ? `\n…and ${lines.length - 200} more` : ""));
    },
  });

  const readFile = betaZodTool({
    name: "read_file",
    description: `Read a file from the repository with line numbers. Reads at most ${MAX_LINES_PER_READ} lines per call; use start_line to page through longer files.`,
    inputSchema: z.object({
      path: z.string().describe("File path relative to the repo root"),
      start_line: z.number().int().min(1).optional().describe("1-based first line (default 1)"),
    }),
    run: async ({ path: file, start_line }) => {
      const full = confine(repoDir, file);
      const stat = fs.statSync(full);
      if (stat.size > 1_000_000) return "File too large to read.";
      const lines = fs.readFileSync(full, "utf8").split("\n");
      const start = (start_line ?? 1) - 1;
      const slice = lines.slice(start, start + MAX_LINES_PER_READ);
      const body = slice.map((l, i) => `${start + i + 1}\t${l}`).join("\n");
      const remaining = lines.length - (start + slice.length);
      return clip(body + (remaining > 0 ? `\n…${remaining} more lines` : ""));
    },
  });

  const grepRepo = betaZodTool({
    name: "grep_repo",
    description:
      "Search the repository for a regex pattern (git grep -nE). Returns file:line:match, up to 80 matches.",
    inputSchema: z.object({
      pattern: z.string().describe("Extended regex pattern"),
      dir: z.string().optional().describe("Restrict to this directory (relative path)"),
    }),
    run: async ({ pattern, dir }) => {
      try {
        const args = ["grep", "-nE", "--max-count=10", pattern];
        if (dir) args.push("--", dir);
        const out = await runGit(args, repoDir);
        return clip(out.split("\n").slice(0, 80).join("\n"));
      } catch {
        return "No matches.";
      }
    },
  });

  const gitLogFile = betaZodTool({
    name: "git_log_file",
    description:
      "Show the commit history of a file or directory (follows renames for single files). Returns hash, date, author, subject.",
    inputSchema: z.object({
      path: z.string().describe("File or directory path relative to the repo root"),
      limit: z.number().int().min(1).max(40).optional().describe("Max commits (default 20)"),
    }),
    run: async ({ path: p, limit }) => {
      confine(repoDir, p);
      const out = await runGit(
        ["log", `-n${limit ?? 20}`, "--date=short", "--pretty=format:%h %ad %an — %s", "--", p],
        repoDir,
      );
      return clip(out || "No history.");
    },
  });

  const gitShow = betaZodTool({
    name: "git_show",
    description:
      "Show a commit: message, stats, and (truncated) patch. Use the short hashes returned by git_log_file.",
    inputSchema: z.object({
      hash: z.string().regex(/^[0-9a-f]{6,40}$/i).describe("Commit hash"),
    }),
    run: async ({ hash }) => {
      const out = await runGit(["show", "--stat", "--patch", "--no-color", hash], repoDir);
      return clip(out.split("\n").slice(0, 220).join("\n"));
    },
  });

  return [listFiles, readFile, grepRepo, gitLogFile, gitShow];
}
