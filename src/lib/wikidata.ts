/**
 * Live data from the Wikidata SPARQL endpoint (query.wikidata.org).
 * Everything here is fetched at click time — nothing is invented or hardcoded.
 * Results are cached in sessionStorage (6h TTL) to be polite to the endpoint.
 */

const ENDPOINT = 'https://query.wikidata.org/sparql';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

type Binding = Record<string, { type: string; value: string }>;

function hashKey(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `ww:sparql:${(h >>> 0).toString(36)}`;
}

function readCache(key: string): Binding[] | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { t, rows } = JSON.parse(raw);
    if (Date.now() - t > CACHE_TTL_MS) return null;
    return rows;
  } catch {
    return null;
  }
}

function writeCache(key: string, rows: Binding[]) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), rows }));
  } catch {
    /* storage full — fine, just skip caching */
  }
}

// Small concurrency limiter so we never hammer the public endpoint.
const MAX_CONCURRENT = 3;
let active = 0;
const waiters: (() => void)[] = [];

async function acquire() {
  if (active < MAX_CONCURRENT) {
    active++;
    return;
  }
  await new Promise<void>((resolve) => waiters.push(resolve));
  active++;
}

function release() {
  active--;
  waiters.shift()?.();
}

const inFlight = new Map<string, Promise<Binding[]>>();

export async function sparql(query: string): Promise<Binding[]> {
  const key = hashKey(query);
  const cached = readCache(key);
  if (cached) return cached;
  const pending = inFlight.get(key);
  if (pending) return pending;

  const p = (async () => {
    await acquire();
    try {
      const url = `${ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;
      // one polite retry when the public endpoint rate-limits us (429)
      for (let attempt = 0; ; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 55_000);
        try {
          const res = await fetch(url, {
            headers: { Accept: 'application/sparql-results+json' },
            signal: controller.signal,
          });
          if (res.status === 429 && attempt === 0) {
            const wait = Number(res.headers.get('Retry-After')) || 3;
            await new Promise((r) => setTimeout(r, Math.min(wait, 15) * 1000));
            continue;
          }
          if (!res.ok) throw new Error(`Wikidata SPARQL ${res.status}`);
          const data = await res.json();
          const rows: Binding[] = data.results.bindings;
          writeCache(key, rows);
          return rows;
        } finally {
          clearTimeout(timer);
        }
      }
    } finally {
      release();
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, p);
  return p;
}

function parsePoint(wkt: string): { lat: number; lng: number } | null {
  const m = /Point\(([-\d.eE+]+)\s+([-\d.eE+]+)\)/.exec(wkt);
  if (!m) return null;
  return { lng: parseFloat(m[1]), lat: parseFloat(m[2]) };
}

function entityId(uri: string): string {
  return uri.slice(uri.lastIndexOf('/') + 1);
}

/** Normalize a Commons Special:FilePath URL to https + a sane width. */
export function commonsThumb(url: string, width = 640): string {
  const u = url.replace(/^http:/, 'https:');
  return u.includes('?') ? u : `${u}?width=${width}`;
}

/** True when Wikidata had no English label (label falls back to the QID). */
function isBareQid(label: string): boolean {
  return /^Q\d+$/.test(label);
}

// ─── Country live facts: population, leaders, anthem, capital coords ────────

export interface CountryLive {
  qid: string;
  population: number | null;
  headsOfState: string[];
  headsOfGov: string[];
  anthem: { name: string; audioUrl?: string; articleUrl?: string } | null;
  capital: { name: string; lat: number; lng: number } | null;
}

export async function fetchCountryLive(cca2: string): Promise<CountryLive> {
  const q = `
SELECT ?country ?population ?hosLabel ?hogLabel ?anthemLabel ?anthemAudio ?anthemArticle ?capitalLabel ?capCoord WHERE {
  ?country wdt:P297 "${cca2}" .
  OPTIONAL { ?country wdt:P1082 ?population . }
  OPTIONAL { ?country wdt:P35 ?hos . }
  OPTIONAL { ?country wdt:P6 ?hog . }
  OPTIONAL { ?country wdt:P85 ?anthem .
    OPTIONAL { ?anthem wdt:P51 ?anthemAudio . }
    OPTIONAL { ?anthemArticle schema:about ?anthem ; schema:isPartOf <https://en.wikipedia.org/> . } }
  OPTIONAL { ?country wdt:P36 ?capital . OPTIONAL { ?capital wdt:P625 ?capCoord . } }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT 12`;
  const rows = await sparql(q);
  if (rows.length === 0) throw new Error(`No Wikidata entity for ${cca2}`);

  const hos = new Set<string>();
  const hog = new Set<string>();
  let population: number | null = null;
  let anthem: CountryLive['anthem'] = null;
  let capital: CountryLive['capital'] = null;
  const qid = entityId(rows[0].country.value);

  for (const r of rows) {
    if (r.population && population === null) population = Number(r.population.value);
    if (r.hosLabel && !isBareQid(r.hosLabel.value)) hos.add(r.hosLabel.value);
    if (r.hogLabel && !isBareQid(r.hogLabel.value)) hog.add(r.hogLabel.value);
    if (r.anthemLabel && !anthem) {
      anthem = {
        name: r.anthemLabel.value,
        audioUrl: r.anthemAudio ? commonsThumb(r.anthemAudio.value) : undefined,
        articleUrl: r.anthemArticle?.value,
      };
    }
    if (r.capitalLabel && r.capCoord && !capital) {
      const pt = parsePoint(r.capCoord.value);
      if (pt) capital = { name: r.capitalLabel.value, ...pt };
    }
  }
  return { qid, population, headsOfState: [...hos], headsOfGov: [...hog], anthem, capital };
}

// ─── Landmarks (famous / public / ancient places with coordinates) ──────────

export interface Landmark {
  qid: string;
  name: string;
  lat: number;
  lng: number;
  imageUrl?: string;
  sitelinks: number;
}

/**
 * Two fast queries run in parallel and merged:
 *  1. well-known landmark classes (tourist attraction, museum, castle, palace,
 *     archaeological site, bridge, church, observation tower, monument, …)
 *  2. UNESCO World Heritage Sites (heritage designation P1435)
 */
export async function fetchLandmarks(qid: string): Promise<Landmark[]> {
  const select = `SELECT DISTINCT ?item ?itemLabel ?coord ?image ?sitelinks WHERE {`;
  const tail = `
  ?item wdt:P17 wd:${qid} ; wdt:P625 ?coord ; wikibase:sitelinks ?sitelinks .
  OPTIONAL { ?item wdt:P18 ?image . }
  FILTER(?sitelinks > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?sitelinks) LIMIT 18`;

  const classesQ = `${select}
  VALUES ?class { wd:Q570116 wd:Q33506 wd:Q23413 wd:Q16560 wd:Q839954 wd:Q9259 wd:Q12280 wd:Q16970 wd:Q1440300 wd:Q2319498 wd:Q4989906 wd:Q1081138 }
  ?item wdt:P31 ?class .${tail}`;
  const heritageQ = `${select}
  ?item wdt:P1435 wd:Q9259 .${tail}`;

  const results = await Promise.allSettled([sparql(classesQ), sparql(heritageQ)]);
  const seen = new Map<string, Landmark>();
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    for (const b of r.value) {
      const id = entityId(b.item.value);
      if (seen.has(id)) continue;
      const label = b.itemLabel?.value ?? '';
      if (!label || isBareQid(label)) continue;
      const pt = parsePoint(b.coord.value);
      if (!pt) continue;
      seen.set(id, {
        qid: id,
        name: label,
        ...pt,
        imageUrl: b.image ? commonsThumb(b.image.value) : undefined,
        sitelinks: Number(b.sitelinks.value),
      });
    }
  }
  if (seen.size === 0 && results.every((r) => r.status === 'rejected')) {
    throw new Error('Landmark queries failed');
  }
  return [...seen.values()].sort((a, b) => b.sitelinks - a.sitelinks).slice(0, 18);
}

// ─── Endemic wildlife (animals & plants unique to the country) ──────────────

export interface Species {
  qid: string;
  name: string;
  commonName?: string;
  imageUrl?: string;
  kingdom: 'animal' | 'plant';
}

export async function fetchEndemicSpecies(qid: string): Promise<Species[]> {
  const q = `
SELECT DISTINCT ?item ?itemLabel ?common ?image ?kingdom WHERE {
  ?item wdt:P183 wd:${qid} ; wdt:P105 wd:Q7432 .
  ?item wdt:P171/wdt:P171* ?kingdom . VALUES ?kingdom { wd:Q729 wd:Q756 }
  OPTIONAL { ?item wdt:P18 ?image . }
  OPTIONAL { ?item wdt:P1843 ?common . FILTER(LANG(?common)="en") }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT 30`;
  const rows = await sparql(q);
  const seen = new Map<string, Species>();
  for (const b of rows) {
    const id = entityId(b.item.value);
    if (seen.has(id)) continue;
    const label = b.itemLabel?.value ?? '';
    if (!label || isBareQid(label)) continue;
    seen.set(id, {
      qid: id,
      name: label,
      commonName: b.common?.value,
      imageUrl: b.image ? commonsThumb(b.image.value, 320) : undefined,
      kingdom: b.kingdom.value.endsWith('Q729') ? 'animal' : 'plant',
    });
  }
  return [...seen.values()].slice(0, 16);
}

// ─── Signature dishes & drinks ───────────────────────────────────────────────

export interface Dish {
  qid: string;
  name: string;
  imageUrl?: string;
  sitelinks: number;
}

export async function fetchDishes(qid: string): Promise<Dish[]> {
  const q = `
SELECT DISTINCT ?item ?itemLabel ?image ?sitelinks WHERE {
  { ?item wdt:P31 wd:Q1968435 . ?item wdt:P17|wdt:P495 wd:${qid} . }
  UNION
  { ?item wdt:P495 wd:${qid} ; wdt:P31/wdt:P279* wd:Q2095 . }
  UNION
  { ?item wdt:P495 wd:${qid} ; wdt:P31/wdt:P279* wd:Q40050 . }
  ?item wikibase:sitelinks ?sitelinks . FILTER(?sitelinks > 8)
  OPTIONAL { ?item wdt:P18 ?image . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?sitelinks) LIMIT 12`;
  const rows = await sparql(q);
  const seen = new Map<string, Dish>();
  for (const b of rows) {
    const id = entityId(b.item.value);
    if (seen.has(id)) continue;
    const label = b.itemLabel?.value ?? '';
    if (!label || isBareQid(label)) continue;
    seen.set(id, {
      qid: id,
      name: label,
      imageUrl: b.image ? commonsThumb(b.image.value, 320) : undefined,
      sitelinks: Number(b.sitelinks.value),
    });
  }
  return [...seen.values()].slice(0, 8);
}
