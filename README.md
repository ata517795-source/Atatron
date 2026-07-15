# 🛡️ Atatron LinkShield

**Paste any link. Get a plain-English answer: is it a scam?**

LinkShield is a web tool built for people who are *not* tech experts — the parents and
grandparents who get "your package is held at customs" texts and "your account will be
suspended" emails every week. Paste the link, press one button, and an AI investigator
(Claude Opus by Anthropic) does what a security professional would do:

1. **Opens the link on the server** (never on your device) and reads the actual page —
   what it shows and what it asks visitors to do.
2. **Inspects the web address** for look-alike tricks: `paypa1.com`, brand names hidden in
   subdomains, URL shorteners, redirect chains, throwaway domains.
3. **Searches the live web** for the domain's reputation — scam databases, news, and the
   real brand's official address.
4. **Writes a report in everyday language**: a clear verdict (Dangerous / Suspicious /
   Looks safe), a 0–100 risk score, who is likely behind the page, exactly what data or
   money they're trying to take, the warning signs found, and what to do next — including
   recovery steps if you already clicked.

It handles links from anywhere: email, SMS, WhatsApp, YouTube, X, Facebook, online shops,
and even GitHub repositories (it reads what a repo tells users to download or run).

> ⚠️ **Honest limits:** no scanner on earth is 100% accurate. LinkShield is deliberately
> cautious — when it can't verify a site, it says *Suspicious* rather than guessing "safe".
> The report always shows its confidence level and the concrete evidence it found.

---

## How it works

```
Browser (React + Vite)
   │  POST /api/scan { url }
   ▼
Vercel serverless function (api/scan.ts)
   │  Claude Opus (claude-opus-4-8) with adaptive thinking
   │  + web_fetch tool  → opens the link & follows redirects, safely, server-side
   │  + web_search tool → checks reputation, scam reports, the real brand's domain
   ▼
Structured JSON report (enforced by a JSON schema — the UI never gets malformed data)
```

- The Anthropic API key lives **only on the server** (environment variable). It is never
  shipped to the browser.
- The model must fill a strict JSON schema (verdict, risk score, evidence, advice), so the
  UI is deterministic even though the investigation is agentic.

## Run it locally

```bash
npm install
cp .env.example .env        # put your ANTHROPIC_API_KEY inside
npx vercel dev              # runs the frontend AND the /api/scan function
```

Plain `npm run dev` also works for UI work, but `/api/scan` only exists under `vercel dev`
(or on a Vercel deployment).

## Deploy to Vercel

1. Push this repo to GitHub and import it in [vercel.com](https://vercel.com) — or run
   `npx vercel`. Framework: **Vite** (auto-detected).
2. In the Vercel project: **Settings → Environment Variables** → add
   `ANTHROPIC_API_KEY` = your key from [platform.claude.com](https://platform.claude.com).
3. Redeploy. Done — the site is live and scans work.

`vercel.json` sets `maxDuration: 300` for the scan function; a thorough scan (page fetch +
redirects + several web searches + reasoning) typically takes 30–90 seconds.

## Cost & abuse note

Every scan makes one Claude Opus request with live web tools (roughly a few cents per
scan). The endpoint is open by default — if you share the site publicly and worry about
abuse, add rate limiting (e.g. Vercel Firewall rules or an IP-based limiter) in front of
`/api/scan`.

## Project layout

```
api/scan.ts     ← the investigator: Anthropic API call, tools, JSON-schema report
src/App.tsx     ← the whole UI: scan form, loading states, report rendering
src/index.css   ← styling (warm paper theme, big readable type)
src/types.ts    ← the ScanReport shape shared with the API response
vercel.json     ← function timeout
```
