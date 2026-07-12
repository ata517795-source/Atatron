import type { AnalyzeResult, InterviewEvent, ModuleStats } from "../../server/types.ts";

export type { AnalyzeResult, InterviewEvent, ModuleStats };

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  return data as T;
}

export const analyze = (repoUrl: string) => post<AnalyzeResult>("/api/analyze", { repoUrl });

export const startInterview = (repoUrl: string, module: string) =>
  post<{ sessionId: string }>("/api/interview/start", { repoUrl, module });

export const sendAnswers = (sessionId: string, answers: string[]) =>
  post<{ ok: boolean }>(`/api/interview/${sessionId}/answers`, { answers });

export interface Health {
  ok: boolean;
  anthropic: boolean;
  models: { interviewer: string; examinee: string; grader: string };
}
export const health = async (): Promise<Health> => {
  const res = await fetch("/api/health");
  return res.json();
};
