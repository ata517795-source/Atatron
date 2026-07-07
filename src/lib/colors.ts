import { COUNTRIES } from './countries';

/**
 * Deterministic, vibrant, well-separated tint per country using
 * golden-angle hue stepping over the alphabetically sorted country list.
 */
const colorByCca3 = new Map<string, { fill: string; bright: string; glow: string }>();

COUNTRIES.forEach((c, i) => {
  const hue = Math.round((i * 137.508) % 360);
  // comma syntax: three-globe's bundled d3-color can't parse space-separated hsl()
  colorByCca3.set(c.cca3, {
    fill: `hsl(${hue}, 72%, 58%)`,
    bright: `hsl(${hue}, 85%, 68%)`,
    glow: `hsla(${hue}, 90%, 65%, 0.85)`,
  });
});

const FALLBACK = { fill: 'hsl(230, 15%, 42%)', bright: 'hsl(230, 20%, 55%)', glow: 'hsla(230, 30%, 60%, 0.8)' };

export function countryColor(cca3: string | undefined) {
  return (cca3 && colorByCca3.get(cca3)) || FALLBACK;
}
