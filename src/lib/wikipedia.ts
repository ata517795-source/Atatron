/** Wikipedia REST summaries (en.wikipedia.org/api/rest_v1) — real article extracts. */

export interface WikiSummary {
  title: string;
  extract: string;
  thumbnailUrl?: string;
  pageUrl: string;
}

const cache = new Map<string, Promise<WikiSummary | null>>();

export function fetchWikiSummary(title: string): Promise<WikiSummary | null> {
  const key = title.toLowerCase();
  const hit = cache.get(key);
  if (hit) return hit;
  const p = (async (): Promise<WikiSummary | null> => {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`,
      { headers: { Accept: 'application/json' } },
    );
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Wikipedia ${res.status}`);
    const d = await res.json();
    if (d.type === 'disambiguation' || !d.extract) return null;
    return {
      title: d.title,
      extract: d.extract,
      thumbnailUrl: d.thumbnail?.source,
      pageUrl: d.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
    };
  })().catch((err) => {
    cache.delete(key);
    throw err;
  });
  cache.set(key, p);
  return p;
}

/** Try a list of titles in order; first hit wins, null if none exist. */
export async function fetchFirstSummary(titles: string[]): Promise<WikiSummary | null> {
  for (const t of titles) {
    try {
      const s = await fetchWikiSummary(t);
      if (s) return s;
    } catch {
      /* try next */
    }
  }
  return null;
}
