import { useEffect, useRef, useState } from 'react';
import type { ScanReport, Verdict } from './types';

const LOADING_STEPS = [
  'Opening the link in a safe, isolated environment…',
  'Reading the page and what it asks visitors to do…',
  'Inspecting the web address for look-alike tricks…',
  'Following any hidden redirects to the real destination…',
  'Searching scam reports and security databases…',
  'Writing your plain-English report…',
];

const VERDICT_UI: Record<
  Verdict,
  { label: string; icon: string; blurb: string; tone: string }
> = {
  dangerous: {
    label: 'Dangerous',
    icon: '⛔',
    blurb: 'This is almost certainly a scam. Do not enter anything here.',
    tone: 'danger',
  },
  suspicious: {
    label: 'Suspicious',
    icon: '⚠️',
    blurb: 'Warning signs were found. Do not type passwords, card numbers, or pay anything here.',
    tone: 'warn',
  },
  likely_safe: {
    label: 'Looks safe',
    icon: '✅',
    blurb: 'No scam signs were found on this link. Stay alert as usual, but it checks out.',
    tone: 'safe',
  },
  unreachable: {
    label: "Couldn't open it",
    icon: '❓',
    blurb: 'The page could not be reached. Here is what the address alone tells us.',
    tone: 'unknown',
  },
};

type Phase =
  | { name: 'idle' }
  | { name: 'loading' }
  | { name: 'error'; message: string }
  | { name: 'done'; url: string; report: ScanReport };

export default function App() {
  const [input, setInput] = useState('');
  const [phase, setPhase] = useState<Phase>({ name: 'idle' });
  const [step, setStep] = useState(0);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (phase.name !== 'loading') return;
    setStep(0);
    const timer = setInterval(
      () => setStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1)),
      7000,
    );
    return () => clearInterval(timer);
  }, [phase.name]);

  useEffect(() => {
    if (phase.name === 'done' || phase.name === 'error') {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [phase.name]);

  async function scan() {
    const url = input.trim();
    if (!url || phase.name === 'loading') return;
    setPhase({ name: 'loading' });
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.report) {
        setPhase({
          name: 'error',
          message:
            data?.error ??
            'The scan could not be completed. Please check the link and try again.',
        });
        return;
      }
      setPhase({ name: 'done', url: data.url, report: data.report });
    } catch {
      setPhase({
        name: 'error',
        message: 'Could not reach the scanner. Check your internet connection and try again.',
      });
    }
  }

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setInput(text.trim());
    } catch {
      /* clipboard permission denied — user can paste manually */
    }
  }

  const loading = phase.name === 'loading';

  return (
    <div className="page">
      <header className="hero">
        <div className="brand">
          <span className="brand-shield" aria-hidden>
            🛡️
          </span>
          <span className="brand-name">
            Atatron <em>LinkShield</em>
          </span>
        </div>
        <h1>
          Got a strange link?
          <br />
          <em>Check it before you trust it.</em>
        </h1>
        <p className="hero-sub">
          Paste any link — from an email, a text message, WhatsApp, Facebook, YouTube, or anywhere
          else. An AI investigator opens it safely, checks scam databases, and explains in plain
          English whether it's a scam, who's behind it, and what they want from you.
        </p>

        <form
          className="scan-form"
          onSubmit={(e) => {
            e.preventDefault();
            void scan();
          }}
        >
          <div className="scan-box">
            <input
              type="text"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder="Paste the link here, e.g. https://…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              aria-label="Link to check"
            />
            <button
              type="button"
              className="ghost-btn"
              onClick={() => void pasteFromClipboard()}
              disabled={loading}
            >
              Paste
            </button>
            <button type="submit" className="scan-btn" disabled={loading || !input.trim()}>
              {loading ? 'Checking…' : 'Check this link'}
            </button>
          </div>
        </form>

        <p className="hero-note">
          The link is opened on our servers, never on your device — checking is always safe, even
          for dangerous links.
        </p>
      </header>

      <main className="results" ref={resultRef}>
        {loading && (
          <section className="card loading-card" aria-live="polite">
            <div className="spinner" aria-hidden />
            <h2>Investigating your link…</h2>
            <p className="loading-step">{LOADING_STEPS[step]}</p>
            <p className="loading-hint">
              A thorough check takes about one to two minutes. Please keep this page open.
            </p>
          </section>
        )}

        {phase.name === 'error' && (
          <section className="card error-card" role="alert">
            <h2>⚠️ The scan didn't finish</h2>
            <p>{phase.message}</p>
          </section>
        )}

        {phase.name === 'done' && <Report url={phase.url} report={phase.report} />}

        {phase.name === 'idle' && (
          <section className="tips">
            <h2>Three golden rules while you wait for any scan</h2>
            <ol>
              <li>
                <strong>Real companies never rush you.</strong> "Your account will be closed in 24
                hours" is pressure, and pressure is the number-one scam tool.
              </li>
              <li>
                <strong>Never type a password on a page you reached from a message.</strong> Open
                the official website or app yourself instead.
              </li>
              <li>
                <strong>When in doubt, ask.</strong> Show the message to someone you trust — or
                paste the link up here first.
              </li>
            </ol>
          </section>
        )}
      </main>

      <footer className="footer">
        <p>
          Powered by Claude, Anthropic's AI, which browses the link live on every scan. No scanner
          is 100% perfect — if a report says "safe" but something still feels wrong, trust your gut
          and don't enter personal details.
        </p>
      </footer>
    </div>
  );
}

function Report({ url, report }: { url: string; report: ScanReport }) {
  const ui = VERDICT_UI[report.verdict] ?? VERDICT_UI.suspicious;
  const score = Math.max(0, Math.min(100, Math.round(report.risk_score)));

  return (
    <section className={`card report tone-${ui.tone}`}>
      <div className="verdict-banner">
        <span className="verdict-icon" aria-hidden>
          {ui.icon}
        </span>
        <div>
          <h2 className="verdict-label">{ui.label}</h2>
          <p className="verdict-blurb">{ui.blurb}</p>
        </div>
      </div>

      <div className="checked-url">
        <span className="field-label">Link checked</span>
        <code>{url}</code>
      </div>

      <div className="risk-row">
        <div className="risk-meter" role="img" aria-label={`Risk level ${score} out of 100`}>
          <div className="risk-track">
            <div className="risk-fill" style={{ width: `${score}%` }} />
          </div>
          <div className="risk-caption">
            <span>
              Risk level: <strong>{score} / 100</strong>
            </span>
            <span>Confidence: {report.confidence}</span>
          </div>
        </div>
      </div>

      {report.scam_type && (
        <p className="scam-type">
          <span className="field-label">Type of scam</span> {report.scam_type}
        </p>
      )}

      <div className="report-block">
        <h3>What this page really is</h3>
        <p>
          <strong>{report.site_title}.</strong> {report.summary}
        </p>
      </div>

      <div className="report-block">
        <h3>Who is likely behind it</h3>
        <p>{report.who_is_behind}</p>
      </div>

      {report.what_they_want.length > 0 && (
        <div className="report-block">
          <h3>What they want from you</h3>
          <ul>
            {report.what_they_want.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {report.red_flags.length > 0 && (
        <div className="report-block">
          <h3>Warning signs we found</h3>
          <ul className="flag-list red">
            {report.red_flags.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {report.good_signs.length > 0 && (
        <div className="report-block">
          <h3>Reassuring signs</h3>
          <ul className="flag-list green">
            {report.good_signs.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="report-block advice">
        <h3>What you should do now</h3>
        <ol>
          {report.advice.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ol>
      </div>
    </section>
  );
}
