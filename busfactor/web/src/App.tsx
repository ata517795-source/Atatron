import { useEffect, useState } from "react";
import { analyze, health, type AnalyzeResult, type Health, type ModuleStats } from "./api.ts";
import { Interview } from "./Interview.tsx";
import { Treemap } from "./Treemap.tsx";

const EXAMPLES = [
  "https://github.com/expressjs/express",
  "https://github.com/pallets/flask",
  "https://github.com/fastify/fastify",
];

const LOADING_STEPS = [
  "Cloning the repository…",
  "Parsing the full commit history…",
  "Computing recency-weighted ownership (HHI) per module…",
  "Building the dependency graph and running PageRank…",
  "Scoring risk = concentration × criticality × activity…",
];

const TIER_ICON: Record<string, string> = { critical: "▲", high: "◆", moderate: "●", low: "✓" };

export function App() {
  const [repoUrl, setRepoUrl] = useState("");
  const [status, setStatus] = useState<Health | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeResult | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [interviewing, setInterviewing] = useState<ModuleStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    health().then(setStatus).catch(() => setStatus(null));
  }, []);

  useEffect(() => {
    if (!loading) return;
    const t = setInterval(
      () => setLoadingStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1)),
      2200,
    );
    return () => clearInterval(t);
  }, [loading]);

  const runAnalysis = async (url: string) => {
    setError(null);
    setLoading(true);
    setLoadingStep(0);
    setAnalysis(null);
    setSelected(null);
    try {
      setAnalysis(await analyze(url));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const selectedModule = analysis?.modules.find((m) => m.path === selected) ?? null;

  return (
    <div className="shell">
      <header className="top">
        <span className="brand"><span className="bus">Bus</span>Factor</span>
        <span className="tagline">
          finds the knowledge that dies when an engineer quits — then extracts it
        </span>
      </header>

      {interviewing && analysis ? (
        <Interview
          repoUrl={analysis.repoUrl}
          module={interviewing}
          onBack={() => setInterviewing(null)}
        />
      ) : !analysis ? (
        <div className="hero">
          <h1>Where does your codebase depend on one person's memory?</h1>
          <p>
            Point BusFactor at a public git repo. It scores every module by
            knowledge&nbsp;concentration × dependency&nbsp;criticality × recent&nbsp;activity,
            then interviews the owner and writes docs that provably transfer understanding.
          </p>
          <form
            className="repo-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (repoUrl.trim()) runAnalysis(repoUrl.trim());
            }}
          >
            <input
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
              aria-label="Repository URL"
            />
            <button className="primary" disabled={loading || !repoUrl.trim()}>
              Analyze
            </button>
          </form>
          <div className="examples">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                className="chip"
                disabled={loading}
                onClick={() => {
                  setRepoUrl(ex);
                  runAnalysis(ex);
                }}
              >
                {ex.replace("https://github.com/", "")}
              </button>
            ))}
          </div>
          {loading && <div className="spinner-line">{LOADING_STEPS[loadingStep]}</div>}
          {error && <div className="error-banner">{error}</div>}
        </div>
      ) : (
        <>
          <div className="results-head">
            <h2>{analysis.name}</h2>
            <span className="meta">
              {analysis.commitCount.toLocaleString()} commits · {analysis.authorCount} authors ·{" "}
              {analysis.fileCount.toLocaleString()} files · {analysis.importEdges} import edges
              {analysis.coChangeUsed ? " (+ co-change coupling)" : ""}
            </span>
            <button className="ghost" onClick={() => setAnalysis(null)}>
              ← analyze another repo
            </button>
          </div>
          <div className="results">
            <div className="panel">
              <h3>Knowledge-risk map</h3>
              <Treemap
                modules={analysis.modules}
                selected={selected}
                onSelect={(p) => setSelected(p)}
              />
            </div>
            <div className="panel">
              {selectedModule ? (
                <ModuleDetail
                  module={selectedModule}
                  interviewEnabled={Boolean(status?.anthropic)}
                  models={status?.models}
                  onBack={() => setSelected(null)}
                  onInterview={() => setInterviewing(selectedModule)}
                />
              ) : (
                <>
                  <h3>Highest risk first</h3>
                  <ul className="ranked">
                    {analysis.modules.slice(0, 40).map((m) => (
                      <li
                        key={m.path}
                        className={selected === m.path ? "selected" : ""}
                        onClick={() => setSelected(m.path)}
                      >
                        <span className={`badge ${m.tier}`}>
                          {TIER_ICON[m.tier]} {m.tier}
                        </span>
                        <span className="path">{m.path}</span>
                        <span className="score">{m.risk}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ModuleDetail({
  module,
  interviewEnabled,
  models,
  onBack,
  onInterview,
}: {
  module: ModuleStats;
  interviewEnabled: boolean;
  models?: Health["models"];
  onBack: () => void;
  onInterview: () => void;
}) {
  return (
    <div className="detail">
      <button className="ghost" onClick={onBack}>← all modules</button>
      <h3 style={{ marginTop: 14 }}>{module.path}</h3>
      <p>
        <span className={`badge ${module.tier}`}>
          {TIER_ICON[module.tier]} {module.tier}
        </span>{" "}
        <strong style={{ fontSize: 22 }}>{module.risk}</strong>
        <span className="meta"> / 100 risk</span>
      </p>
      <dl>
        <dt>Kind</dt>
        <dd>{module.kind}</dd>
        <dt>Knowledge concentration</dt>
        <dd>{module.concentration} (HHI)</dd>
        <dt>Effective owners</dt>
        <dd>{module.effectiveOwners.toFixed(1)}</dd>
        <dt>Criticality percentile</dt>
        <dd>{Math.round(module.criticalityPct * 100)}</dd>
        <dt>Recent-churn percentile</dt>
        <dd>{Math.round(module.churnPct * 100)}</dd>
        <dt>Files / LOC</dt>
        <dd>
          {module.files} / {module.loc.toLocaleString()}
        </dd>
        <dt>Commits</dt>
        <dd>{module.commits.toLocaleString()}</dd>
        <dt>Last touched</dt>
        <dd>{module.lastTouchedDays === 0 ? "today" : `${module.lastTouchedDays}d ago`}</dd>
      </dl>
      <div className="owners">
        {module.topOwners.map((o) => (
          <div key={o.name} className="owner-row">
            <span className="name" title={o.name}>{o.name}</span>
            <span className="track">
              <span className="fill" style={{ width: `${Math.round(o.share * 100)}%` }} />
            </span>
            <span className="pct">{Math.round(o.share * 100)}%</span>
          </div>
        ))}
      </div>
      <button
        className="primary"
        style={{ marginTop: 16, width: "100%" }}
        disabled={!interviewEnabled}
        onClick={onInterview}
      >
        Interview the owner
      </button>
      {!interviewEnabled ? (
        <p className="hint">
          Set <code>ANTHROPIC_API_KEY</code> and restart the server to enable the
          interview → docs → exam loop. The risk map works without it.
        </p>
      ) : (
        <p className="hint">
          interviewer {models?.interviewer} · examinee {models?.examinee} · grader{" "}
          {models?.grader}
        </p>
      )}
    </div>
  );
}
