import fs from "node:fs";
import path from "node:path";
import { buildCoChangeEdges, buildImportEdges, pageRank } from "./deps.ts";
import { ensureClone, repoName, runGit } from "./git.ts";
import type { AnalyzeResult, ModuleStats, OwnerShare } from "./types.ts";

/**
 * The risk model, per module m:
 *
 *   Concentration  C(m) = Herfindahl–Hirschman index over recency-weighted
 *                          authorship (commit weight decays with half-life
 *                          HALF_LIFE_DAYS). C -> 1 means one person owns it.
 *   Criticality    K(m) = PageRank of m in the module dependency graph.
 *   Activity       A(m) = recency-weighted churn (a hot module matters more
 *                          than a dead one).
 *
 *   Risk R(m) ∝ C(m) × K̂(m) × Â(m)   (K, A as percentile ranks, with small
 *   floors so a stale-but-critical module never scores exactly zero), scaled
 *   to 0..100 across the repo.
 */

const HALF_LIFE_DAYS = 180;
const LINES_CAP_PER_TOUCH = 400; // one mega-refactor commit shouldn't equal years of stewardship
const MODULE_DEPTH = 2;

const CODE_EXT = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".vue", ".svelte",
  ".py", ".go", ".rs", ".java", ".kt", ".rb", ".php", ".ex", ".exs",
  ".c", ".h", ".cc", ".cpp", ".hpp", ".cs", ".swift", ".scala",
  ".sql", ".sh", ".pl", ".lua", ".r", ".m", ".zig",
]);

const SKIP_PATH = /(^|\/)(node_modules|dist|build|out|vendor|third_party|\.next|coverage|__snapshots__|\.yarn)(\/|$)/;
const SKIP_FILE = /(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|Cargo\.lock|poetry\.lock|go\.sum|Gemfile\.lock|composer\.lock|\.min\.|\.map$|\.snap$)/;

function isAnalyzable(file: string, codeOnly: boolean): boolean {
  if (SKIP_PATH.test(file) || SKIP_FILE.test(file)) return false;
  if (!codeOnly) return true;
  return CODE_EXT.has(path.posix.extname(file).toLowerCase());
}

/** Normalize rename notation: "a/{old => new}/b" and "old => new". */
function normalizeRename(p: string): string {
  return p
    .replace(/\{([^{}]*) => ([^{}]*)\}/g, (_, _from, to) => to)
    .replace(/^[^\t]* => /, "")
    .replace(/\/\//g, "/")
    .replace(/^\.\//, "");
}

/** Losing tacit knowledge about tests or examples hurts far less than losing
 * it about production code — weight the risk product accordingly. */
const KIND_WEIGHT = { source: 1, test: 0.3, example: 0.2, docs: 0.15 } as const;

export function moduleKind(modulePath: string): keyof typeof KIND_WEIGHT {
  if (/(^|\/)(tests?|__tests__|spec|e2e|testing)(\/|$)/i.test(modulePath)) return "test";
  if (/(^|\/)(examples?|demos?|samples?|benchmarks?|fixtures)(\/|$)/i.test(modulePath)) return "example";
  if (/(^|\/)(docs?|documentation|website|\.github)(\/|$)/i.test(modulePath)) return "docs";
  return "source";
}

export function moduleOf(file: string): string {
  const dir = path.posix.dirname(file);
  if (dir === ".") return "(root)";
  return dir.split("/").slice(0, MODULE_DEPTH).join("/");
}

interface Touch {
  author: string;
  weight: number; // recency weight 0..1
  lines: number;
}

function percentileRanks(values: number[]): number[] {
  const sorted = values.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
  const ranks = new Array<number>(values.length).fill(0);
  const denominator = Math.max(values.length - 1, 1);
  sorted.forEach(([, originalIndex], position) => {
    ranks[originalIndex] = position / denominator;
  });
  return ranks;
}

export async function analyzeRepo(repoUrl: string): Promise<AnalyzeResult> {
  const repoDir = await ensureClone(repoUrl);

  const lsFiles = (await runGit(["ls-files"], repoDir)).split("\n").filter(Boolean);
  const codeFiles = lsFiles.filter((f) => isAnalyzable(f, true));
  const codeOnly = codeFiles.length >= 20;
  const files = codeOnly ? codeFiles : lsFiles.filter((f) => isAnalyzable(f, false));
  const fileSet = new Set(files);

  const log = await runGit(
    ["log", "--no-merges", "--numstat", "--date=iso-strict", "--pretty=format:@@@%H|%aI|%aN"],
    repoDir,
  );

  const touchesByModule = new Map<string, Touch[]>();
  const filesByModule = new Map<string, Set<string>>();
  const lastTouchedByModule = new Map<string, number>(); // epoch ms
  const commitsByModule = new Map<string, Set<string>>();
  const commitModuleSets: string[][] = [];
  const authors = new Set<string>();

  // First pass to find the newest commit date — recency is measured against the
  // repo's own head, so archived repos are analyzed on their own timeline.
  let newestMs = 0;
  for (const line of log.split("\n")) {
    if (line.startsWith("@@@")) {
      const dateMs = Date.parse(line.split("|")[1]);
      if (dateMs > newestMs) newestMs = dateMs;
    }
  }
  if (newestMs === 0) newestMs = Date.now();

  let commitCount = 0;
  let currentAuthor = "";
  let currentWeight = 0;
  let currentDateMs = 0;
  let currentHash = "";
  let currentModules: string[] = [];

  const flushCommit = () => {
    if (currentModules.length > 0) commitModuleSets.push(currentModules);
    currentModules = [];
  };

  for (const line of log.split("\n")) {
    if (line.startsWith("@@@")) {
      flushCommit();
      const [hash, date, author] = line.slice(3).split("|");
      currentHash = hash;
      currentAuthor = (author || "unknown").trim();
      currentDateMs = Date.parse(date);
      const ageDays = Math.max(0, (newestMs - currentDateMs) / 86_400_000);
      currentWeight = Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
      authors.add(currentAuthor);
      commitCount++;
      continue;
    }
    const m = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(line);
    if (!m) continue;
    if (m[1] === "-" || m[2] === "-") continue; // binary
    const file = normalizeRename(m[3]);
    if (!fileSet.has(file)) continue;

    const mod = moduleOf(file);
    const lines = Math.min(parseInt(m[1], 10) + parseInt(m[2], 10), LINES_CAP_PER_TOUCH);

    let touches = touchesByModule.get(mod);
    if (!touches) touchesByModule.set(mod, (touches = []));
    touches.push({ author: currentAuthor, weight: currentWeight, lines });

    let modFiles = filesByModule.get(mod);
    if (!modFiles) filesByModule.set(mod, (modFiles = new Set()));
    modFiles.add(file);

    let modCommits = commitsByModule.get(mod);
    if (!modCommits) commitsByModule.set(mod, (modCommits = new Set()));
    modCommits.add(currentHash);

    if ((lastTouchedByModule.get(mod) ?? 0) < currentDateMs) {
      lastTouchedByModule.set(mod, currentDateMs);
    }
    currentModules.push(mod);
  }
  flushCommit();

  // Only score modules that still exist in the working tree.
  const liveModules = new Set(files.map(moduleOf));
  const modulePaths = [...touchesByModule.keys()].filter((m) => liveModules.has(m));

  // --- Concentration + churn -------------------------------------------------
  const concentration = new Map<string, number>();
  const owners = new Map<string, OwnerShare[]>();
  const churn = new Map<string, number>();
  for (const mod of modulePaths) {
    const weightByAuthor = new Map<string, number>();
    let totalWeight = 0;
    let totalChurn = 0;
    for (const t of touchesByModule.get(mod)!) {
      const w = t.weight * (1 + Math.log1p(t.lines));
      weightByAuthor.set(t.author, (weightByAuthor.get(t.author) ?? 0) + w);
      totalWeight += w;
      totalChurn += t.weight * t.lines;
    }
    let hhi = 0;
    const shares: OwnerShare[] = [];
    for (const [name, w] of weightByAuthor) {
      const share = totalWeight > 0 ? w / totalWeight : 0;
      hhi += share * share;
      shares.push({ name, share });
    }
    shares.sort((a, b) => b.share - a.share);
    concentration.set(mod, hhi);
    owners.set(mod, shares.slice(0, 4));
    churn.set(mod, totalChurn);
  }

  // --- Criticality (PageRank over the dependency graph) ----------------------
  const importEdges = buildImportEdges(repoDir, files, moduleOf);
  let importEdgeCount = 0;
  for (const targets of importEdges.values()) importEdgeCount += targets.size;

  const coChangeUsed = importEdgeCount < modulePaths.length;
  const edges = coChangeUsed
    ? mergeEdges(importEdges, buildCoChangeEdges(commitModuleSets))
    : importEdges;
  const rank = pageRank(modulePaths, edges);

  // --- LOC (for treemap sizing) ----------------------------------------------
  const loc = new Map<string, number>();
  let countedFiles = 0;
  for (const file of files) {
    const mod = moduleOf(file);
    if (!liveModules.has(mod)) continue;
    let lines = 0;
    try {
      const full = path.join(repoDir, file);
      const stat = fs.statSync(full);
      if (stat.size <= 300_000 && countedFiles < 6000) {
        countedFiles++;
        const content = fs.readFileSync(full, "utf8");
        lines = content.split("\n").length;
      } else {
        lines = Math.round(stat.size / 40);
      }
    } catch {
      /* deleted or unreadable — ignore */
    }
    loc.set(mod, (loc.get(mod) ?? 0) + lines);
  }

  // --- Composite risk ---------------------------------------------------------
  const criticalityValues = modulePaths.map((m) => rank.get(m) ?? 0);
  const churnValues = modulePaths.map((m) => churn.get(m) ?? 0);
  const criticalityPct = percentileRanks(criticalityValues);
  const churnPct = percentileRanks(churnValues);

  const rawRisk = modulePaths.map((mod, i) => {
    const c = concentration.get(mod) ?? 0;
    return (
      c *
      (0.25 + 0.75 * criticalityPct[i]) *
      (0.25 + 0.75 * churnPct[i]) *
      KIND_WEIGHT[moduleKind(mod)]
    );
  });
  const maxRisk = Math.max(...rawRisk, 1e-9);

  const modules: ModuleStats[] = modulePaths.map((mod, i) => {
    const risk = Math.round((rawRisk[i] / maxRisk) * 1000) / 10;
    const c = concentration.get(mod) ?? 0;
    return {
      path: mod,
      files: filesByModule.get(mod)?.size ?? 0,
      loc: loc.get(mod) ?? 0,
      commits: commitsByModule.get(mod)?.size ?? 0,
      lastTouchedDays: Math.round(
        (newestMs - (lastTouchedByModule.get(mod) ?? newestMs)) / 86_400_000,
      ),
      concentration: round3(c),
      effectiveOwners: round3(c > 0 ? 1 / c : 0),
      topOwners: (owners.get(mod) ?? []).map((o) => ({ name: o.name, share: round3(o.share) })),
      criticality: round6(rank.get(mod) ?? 0),
      criticalityPct: round3(criticalityPct[i]),
      churnPct: round3(churnPct[i]),
      risk,
      tier: risk >= 75 ? "critical" : risk >= 50 ? "high" : risk >= 25 ? "moderate" : "low",
      kind: moduleKind(mod),
    };
  });

  modules.sort((a, b) => b.risk - a.risk);

  return {
    repoUrl,
    name: repoName(repoUrl),
    analyzedAt: new Date().toISOString(),
    commitCount,
    authorCount: authors.size,
    fileCount: files.length,
    importEdges: importEdgeCount,
    coChangeUsed,
    modules,
  };
}

function mergeEdges(
  a: Map<string, Map<string, number>>,
  b: Map<string, Map<string, number>>,
): Map<string, Map<string, number>> {
  const merged = new Map<string, Map<string, number>>();
  for (const source of [a, b]) {
    for (const [from, targets] of source) {
      let out = merged.get(from);
      if (!out) merged.set(from, (out = new Map()));
      for (const [to, w] of targets) out.set(to, (out.get(to) ?? 0) + w);
    }
  }
  return merged;
}

const round3 = (v: number) => Math.round(v * 1000) / 1000;
const round6 = (v: number) => Math.round(v * 1_000_000) / 1_000_000;
