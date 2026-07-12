import { useEffect, useRef, useState } from "react";
import { sendAnswers, startInterview, type InterviewEvent, type ModuleStats } from "./api.ts";
import { Markdown } from "./markdown.tsx";

interface InterviewProps {
  repoUrl: string;
  module: ModuleStats;
  onBack: () => void;
}

const TIER_ICON: Record<string, string> = { critical: "▲", high: "◆", moderate: "●", low: "✓" };

export function Interview({ repoUrl, module, onBack }: InterviewProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [events, setEvents] = useState<InterviewEvent[]>([]);
  const [answered, setAnswered] = useState<Record<number, string[]>>({});
  const [drafts, setDrafts] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let cancelled = false;
    startInterview(repoUrl, module.path)
      .then(({ sessionId }) => {
        if (cancelled) return;
        setSessionId(sessionId);
        const es = new EventSource(`/api/interview/${sessionId}/stream`);
        sourceRef.current = es;
        es.onmessage = (msg) => {
          const ev = JSON.parse(msg.data) as InterviewEvent;
          setEvents((prev) => [...prev, ev]);
          if (ev.type === "questions") setDrafts(ev.questions.map(() => ""));
          if (ev.type === "done" || ev.type === "error") es.close();
        };
      })
      .catch((err) => setStartError(err.message));
    return () => {
      cancelled = true;
      sourceRef.current?.close();
    };
  }, [repoUrl, module.path]);

  const latestQuestions = [...events].reverse().find((e) => e.type === "questions");
  const done = events.some((e) => e.type === "done");
  const awaiting =
    latestQuestions?.type === "questions" && !answered[latestQuestions.round] && !done;

  const submit = async () => {
    if (!sessionId || latestQuestions?.type !== "questions") return;
    setSubmitting(true);
    try {
      await sendAnswers(sessionId, drafts);
      setAnswered((prev) => ({ ...prev, [latestQuestions.round]: drafts }));
    } catch (err) {
      setEvents((prev) => [...prev, { type: "error", message: (err as Error).message }]);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="interview">
      <div className="iv-head">
        <button className="ghost" onClick={onBack}>← Risk map</button>
        <h2>
          Interview — {module.path}{" "}
          <span className={`badge ${module.tier}`}>
            {TIER_ICON[module.tier]} {module.tier}
          </span>
        </h2>
      </div>
      <p className="hint">
        The agent has read this module and its git history. Answer as the code's owner —
        it will verify your claims against the repo, write docs, and keep interviewing
        until a fresh "new hire" agent can pass an onboarding exam using the docs alone.
      </p>

      {startError && <div className="error-banner">{startError}</div>}

      <div className="timeline">
        {events.map((ev, i) => {
          switch (ev.type) {
            case "status":
              return <div key={i} className="ev-status">{ev.message}</div>;
            case "questions": {
              const isLive = awaiting && ev === latestQuestions;
              const givenAnswers = answered[ev.round];
              return (
                <div key={i} className="card">
                  <h4>Round {ev.round} — interviewer questions</h4>
                  {ev.intro && <p className="hint">{ev.intro}</p>}
                  {ev.questions.map((q, qi) => (
                    <div key={qi} className="q">
                      <div className="q-text">{qi + 1}. {q}</div>
                      {isLive ? (
                        <textarea
                          value={drafts[qi] ?? ""}
                          placeholder="Answer as the module's owner…"
                          onChange={(e) =>
                            setDrafts((d) => d.map((v, di) => (di === qi ? e.target.value : v)))
                          }
                        />
                      ) : (
                        <div className="answered">{givenAnswers?.[qi] ?? "…"}</div>
                      )}
                    </div>
                  ))}
                  {isLive && (
                    <button
                      className="primary"
                      disabled={submitting || drafts.every((d) => !d.trim())}
                      onClick={submit}
                    >
                      {submitting ? "Submitting…" : "Submit answers"}
                    </button>
                  )}
                </div>
              );
            }
            case "docs_draft":
              return (
                <div key={i} className="card">
                  <h4>Draft documentation</h4>
                  <Markdown source={ev.markdown} />
                </div>
              );
            case "exam_result":
              return (
                <div key={i} className="card">
                  <h4>Onboarding exam — fresh agent, docs only</h4>
                  <div className="exam-score">
                    <span className="big">{Math.round(ev.score * 100)}%</span>
                    <span className={`badge ${ev.passed ? "low" : "critical"}`}>
                      {ev.passed ? "✓ docs transfer understanding" : "▲ below the bar"}
                    </span>
                  </div>
                  <ul className="breakdown">
                    {ev.breakdown.map((b, bi) => (
                      <li key={bi}>
                        <span className={`verdict ${b.verdict}`}>{b.verdict}</span> — {b.question}
                        <div className="hint">{b.note}</div>
                      </li>
                    ))}
                  </ul>
                  {ev.gaps.length > 0 && (
                    <p className="gaps"><strong>Gaps driving the next round:</strong> {ev.gaps.join("; ")}</p>
                  )}
                </div>
              );
            case "final_docs":
              return (
                <div key={i} className="card">
                  <h4>
                    Final documentation — verified in {ev.rounds} round(s), exam score{" "}
                    {Math.round(ev.score * 100)}%
                  </h4>
                  <a href={`/api/interview/${sessionId}/docs`}>
                    <button className="primary">Download docs (.md)</button>
                  </a>
                </div>
              );
            case "error":
              return <div key={i} className="error-banner">{ev.message}</div>;
            default:
              return null;
          }
        })}
        {!done && events.length > 0 && !awaiting && (
          <div className="spinner-line">working…</div>
        )}
        {events.length === 0 && !startError && (
          <div className="spinner-line">starting the interviewer agent…</div>
        )}
      </div>
    </div>
  );
}
