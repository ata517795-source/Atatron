import rawCountries from 'world-countries';

/**
 * Country facts come from the `world-countries` npm package — the open
 * mledoze/countries dataset (ODbL) that also powered REST Countries.
 * (REST Countries v1–v4 were taken offline in 2026; v5 requires an API key,
 * so we bundle the same underlying open dataset instead and fetch the
 * live/changing fields — population, leaders, weather — from Wikidata and
 * Open-Meteo at click time.)
 */
export interface Country {
  cca2: string;
  cca3: string;
  ccn3: string;
  name: string;
  officialName: string;
  capital: string[];
  region: string;
  subregion: string;
  languages: string[];
  currencies: { code: string; name: string; symbol: string }[];
  /** [lat, lng] country centroid */
  latlng: [number, number];
  area: number;
  borders: string[];
  landlocked: boolean;
  unMember: boolean;
  independent: boolean;
  flagEmoji: string;
  flagPng: string;
  flagSvg: string;
}

function toCountry(c: (typeof rawCountries)[number]): Country {
  const code = c.cca2.toLowerCase();
  return {
    cca2: c.cca2,
    cca3: c.cca3,
    ccn3: c.ccn3 ? c.ccn3.padStart(3, '0') : '',
    name: c.name.common,
    officialName: c.name.official,
    capital: c.capital ?? [],
    region: c.region,
    subregion: c.subregion,
    languages: Object.values(c.languages ?? {}),
    currencies: Object.entries(c.currencies ?? {}).map(([codeKey, cur]) => ({
      code: codeKey,
      name: cur.name,
      symbol: cur.symbol,
    })),
    latlng: c.latlng,
    area: c.area,
    borders: c.borders ?? [],
    landlocked: c.landlocked,
    unMember: c.unMember,
    independent: c.independent,
    flagEmoji: c.flag,
    // Real flag imagery from FlagCDN (the same CDN REST Countries used)
    flagPng: `https://flagcdn.com/w320/${code}.png`,
    flagSvg: `https://flagcdn.com/${code}.svg`,
  };
}

export const COUNTRIES: Country[] = rawCountries
  .map(toCountry)
  .sort((a, b) => a.name.localeCompare(b.name));

export const byCca3 = new Map(COUNTRIES.map((c) => [c.cca3, c]));
export const byCcn3 = new Map(
  COUNTRIES.filter((c) => c.ccn3).map((c) => [c.ccn3, c]),
);
export const byName = new Map(COUNTRIES.map((c) => [c.name.toLowerCase(), c]));

/** Resolve a world-atlas TopoJSON feature id (ISO 3166-1 numeric) to a country. */
export function countryForAtlasId(id: string | number | undefined, atlasName?: string): Country | undefined {
  if (id !== undefined && id !== null) {
    const c = byCcn3.get(String(id).padStart(3, '0'));
    if (c) return c;
  }
  if (atlasName) return byName.get(atlasName.toLowerCase());
  return undefined;
}

export function formatPopulation(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)} billion`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} million`;
  return n.toLocaleString('en-US');
}

export function formatArea(km2: number): string {
  return `${Math.round(km2).toLocaleString('en-US')} km²`;
}
