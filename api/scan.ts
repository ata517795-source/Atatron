// Atatron LinkShield — scan endpoint (Vercel serverless function).
//
// POST /api/scan  { url: string }
//
// Claude Opus investigates the link with live web access (it fetches the page
// itself and searches scam databases / news for reputation), then returns a
// structured plain-English safety report.

import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 300;

const MODEL = 'claude-opus-4-8';

const REPORT_SCHEMA = {
  type: 'object',
  properties: {
    verdict: {
      type: 'string',
      enum: ['dangerous', 'suspicious', 'likely_safe', 'unreachable'],
      description: 'Overall safety verdict for this exact link.',
    },
    risk_score: {
      type: 'integer',
      description:
        'Risk from 0 (completely harmless) to 100 (confirmed scam/phishing/malware). Must be consistent with the verdict: dangerous 75-100, suspicious 40-74, likely_safe 0-39, unreachable 40-70 depending on how the address itself looks.',
    },
    confidence: {
      type: 'string',
      enum: ['low', 'medium', 'high'],
      description: 'How sure you are, based on how much evidence you could actually gather.',
    },
    site_title: {
      type: 'string',
      description: 'What the page claims or appears to be, in a few words. E.g. "A login page pretending to be Netflix".',
    },
    scam_type: {
      anyOf: [{ type: 'string' }, { type: 'null' }],
      description:
        'Short name of the scam category if this is (probably) a scam, e.g. "Phishing — fake bank login", "Fake online shop", "Crypto investment scam", "Tech-support scam", "Malware download". null if not a scam.',
    },
    summary: {
      type: 'string',
      description:
        '2-4 short sentences, plain everyday language, telling the reader what this link really is and whether they should trust it.',
    },
    who_is_behind: {
      type: 'string',
      description:
        'Best evidence-based description of who operates this page. For scams: who the criminals are pretending to be and any clues about the real operators (domain registration country, hosting, known scam network). For legit sites: the real company/person. Be honest about uncertainty.',
    },
    what_they_want: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Concrete things this page tries to get from the visitor: passwords, card numbers, ID photos, money, crypto wallet access, remote control of the computer, personal details for identity theft... Empty array if it asks for nothing harmful.',
    },
    red_flags: {
      type: 'array',
      items: { type: 'string' },
      description: 'Specific warning signs found during the investigation, each one short and concrete. Empty if none.',
    },
    good_signs: {
      type: 'array',
      items: { type: 'string' },
      description: 'Specific reassuring findings (well-known real domain, long history, matches the official site...). Empty if none.',
    },
    advice: {
      type: 'array',
      items: { type: 'string' },
      description:
        '2-5 concrete next steps for the reader, ordered by importance. Include recovery steps ("If you already entered your password there, change it now...") when the link is dangerous.',
    },
  },
  required: [
    'verdict',
    'risk_score',
    'confidence',
    'site_title',
    'scam_type',
    'summary',
    'who_is_behind',
    'what_they_want',
    'red_flags',
    'good_signs',
    'advice',
  ],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `You are LinkShield, a world-class online-scam and phishing investigator. Your reports are read by everyday people with no technical background — often older adults — who received a link by email, text message, WhatsApp, or social media and want to know if it is safe before (or after) clicking it.

HOW TO INVESTIGATE (use your tools — never judge from the address alone when the page can be fetched):
1. Fetch the exact URL with web_fetch and read the page: what does it show, and what does it ask the visitor to do (log in, pay, enter card details, download something, connect a crypto wallet, call a phone number, install an app)?
2. Study the web address itself: the real registered domain vs. the brand the page imitates; look-alike spellings (paypa1, arnazon, faceb00k); brand names hidden in subdomains (paypal.com.security-check.xyz); recently-registered or throwaway domains; suspicious endings; URL shorteners and redirect chains — fetch through to the final destination and judge THAT page.
3. Use web_search to check reputation: is this domain reported on scam/phishing blocklists or forums, is there news about it, does the real brand actually live at a different address, how established is the site?
4. Links on big platforms (YouTube, X/Twitter, Facebook, GitHub, Google Docs...) — the platform is legitimate, but the CONTENT can still be a scam: fake giveaway videos, phishing posts, GitHub repos distributing credential stealers or "cracked software", malicious Google Forms. Judge the specific content, not the platform. For GitHub repos, look at what the README instructs users to run or download.
5. Weigh the evidence honestly. Never call a well-known legitimate site dangerous without strong specific evidence, and never trust a page just because it LOOKS professional — scam pages copy real designs pixel-for-pixel.

VERDICT RULES:
- "dangerous": clear evidence of phishing, scam, fraud, or malware.
- "suspicious": several warning signs, or you could not verify it is legitimate. The reader should not enter any information or pay anything.
- "likely_safe": a known legitimate site, or a page that shows no scam behavior after real checks.
- "unreachable": the page could not be loaded AND search told you too little. Explain what the address alone suggests and how careful to be.
- When genuinely torn between "likely_safe" and "suspicious", choose "suspicious" — telling someone a scam is safe hurts far more than extra caution.
- Do not invent findings. Every red flag you list must come from something you actually observed or found in search results.

WRITING RULES:
- Plain, warm, everyday language. No jargon: say "web address" not "URL", "page ending" not "TLD", or explain the term in brackets.
- Short sentences. Speak directly to the reader: "This page asks for your bank login…".
- who_is_behind must be your best evidence-supported inference (e.g. "Criminals pretending to be the DHL delivery company — the real DHL website is dhl.com, not this address"), never speculation stated as certain fact.
- advice must be concrete actions, not vague warnings.`;

type Verdict = 'dangerous' | 'suspicious' | 'likely_safe' | 'unreachable';

export interface ScanReport {
  verdict: Verdict;
  risk_score: number;
  confidence: 'low' | 'medium' | 'high';
  site_title: string;
  scam_type: string | null;
  summary: string;
  who_is_behind: string;
  what_they_want: string[];
  red_flags: string[];
  good_signs: string[];
  advice: string[];
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Accepts what real people paste: bare domains, addresses with spaces around them, etc. */
function normalizeUrl(raw: string): string | null {
  let input = raw.trim();
  if (!input) return null;
  if (input.length > 2048) return null;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(input)) {
    input = `https://${input}`;
  }
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  if (!parsed.hostname.includes('.')) return null;
  return parsed.href;
}

export async function POST(request: Request): Promise<Response> {
  let rawUrl = '';
  try {
    const body = (await request.json()) as { url?: unknown };
    rawUrl = String(body?.url ?? '');
  } catch {
    return json({ error: 'Send JSON like { "url": "https://example.com" }.' }, 400);
  }

  const url = normalizeUrl(rawUrl);
  if (!url) {
    return json(
      { error: 'That does not look like a web link. Paste the full address, e.g. https://example.com/page' },
      400,
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return json(
      {
        error:
          'The scanner is not fully set up yet: the ANTHROPIC_API_KEY environment variable is missing on the server. The site owner needs to add it in the Vercel project settings.',
      },
      500,
    );
  }

  const client = new Anthropic();

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content:
        `Please investigate this link and produce your safety report:\n\n${url}\n\n` +
        `Fetch it, follow any redirects to the real destination, check its reputation, and fill in every field of the report.`,
    },
  ];

  const baseParams = {
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    thinking: { type: 'adaptive' as const },
    tools: [
      { type: 'web_fetch_20260209' as const, name: 'web_fetch' as const, max_uses: 6, max_content_tokens: 40000 },
      { type: 'web_search_20260209' as const, name: 'web_search' as const, max_uses: 5 },
    ],
    output_config: {
      format: {
        type: 'json_schema' as const,
        schema: REPORT_SCHEMA as unknown as Record<string, unknown>,
      },
    },
  };

  try {
    let response = await client.messages
      .stream({ ...baseParams, messages })
      .finalMessage();

    // Server-side tools pause after their iteration limit — resume until done.
    let continuations = 0;
    while (response.stop_reason === 'pause_turn' && continuations < 4) {
      continuations += 1;
      messages.push({ role: 'assistant', content: response.content });
      response = await client.messages
        .stream({ ...baseParams, messages })
        .finalMessage();
    }

    if (response.stop_reason === 'refusal') {
      return json(
        { error: 'The scanner could not analyze this link. Please try a different link.' },
        422,
      );
    }

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim();

    if (!text) {
      return json({ error: 'The scan finished without a report. Please try again.' }, 502);
    }

    const report = JSON.parse(text) as ScanReport;
    return json({ url, report, model: response.model });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return json(
        { error: 'The server\'s Anthropic API key was rejected. The site owner should check ANTHROPIC_API_KEY in Vercel.' },
        500,
      );
    }
    if (error instanceof Anthropic.RateLimitError) {
      return json({ error: 'The scanner is busy right now. Please wait a minute and try again.' }, 429);
    }
    if (error instanceof Anthropic.APIError) {
      console.error('Anthropic API error', error.status, error.message);
      return json({ error: 'The scan failed on our side. Please try again in a moment.' }, 502);
    }
    console.error('Scan failed', error);
    return json({ error: 'Something went wrong during the scan. Please try again.' }, 500);
  }
}
