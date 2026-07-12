export interface OwnerShare {
  name: string;
  share: number; // 0..1 of recency-weighted knowledge
}

export interface ModuleStats {
  path: string;
  files: number;
  loc: number;
  commits: number;
  lastTouchedDays: number;
  /** Recency-weighted authorship HHI, 0..1. 1 = one person holds everything. */
  concentration: number;
  /** 1 / HHI — how many people "effectively" understand this module. */
  effectiveOwners: number;
  topOwners: OwnerShare[];
  /** PageRank over the module dependency graph. */
  criticality: number;
  criticalityPct: number; // percentile 0..1
  churnPct: number; // percentile 0..1 of recency-weighted churn
  /** Composite risk, 0..100. */
  risk: number;
  tier: "critical" | "high" | "moderate" | "low";
  kind: "source" | "test" | "example" | "docs";
}

export interface AnalyzeResult {
  repoUrl: string;
  name: string;
  analyzedAt: string;
  commitCount: number;
  authorCount: number;
  fileCount: number;
  importEdges: number;
  coChangeUsed: boolean;
  modules: ModuleStats[];
}

export interface ExamQuestion {
  question: string;
  groundTruth: string;
}

export type InterviewEvent =
  | { type: "status"; message: string }
  | { type: "questions"; round: number; questions: string[]; intro?: string }
  | { type: "docs_draft"; markdown: string }
  | {
      type: "exam_result";
      score: number;
      passed: boolean;
      breakdown: { question: string; verdict: string; note: string }[];
      gaps: string[];
    }
  | { type: "final_docs"; markdown: string; rounds: number; score: number }
  | { type: "error"; message: string }
  | { type: "done" };
