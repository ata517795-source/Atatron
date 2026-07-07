import { COUNTRIES } from './countries';

/**
 * Deterministic, vibrant, well-separated tint per country using
 * golden-angle hue stepping over the alphabetically sorted country list.
 */
const colorByCca3 = new Map<string, { fill: string; bright: string; glow: string }>();

COUNTRIES.forEach((c, i) => {
  const hue = Math.round((i * 137.508) % 360);
  // Muted, sophisticated jewel tones (lower saturation) for a calm, editorial
  // map rather than a neon arcade look. Comma syntax: three-globe's bundled
  // d3-color can't parse space-separated hsl().
  colorByCca3.set(c.cca3, {
    fill: `hsl(${hue}, 42%, 54%)`,
    bright: `hsl(${hue}, 55%, 64%)`,
    glow: `hsla(${hue}, 60%, 62%, 0.85)`,
  });
});

const FALLBACK = { fill: 'hsl(210, 14%, 44%)', bright: 'hsl(210, 18%, 55%)', glow: 'hsla(210, 24%, 58%, 0.8)' };

export function countryColor(cca3: string | undefined) {
  return (cca3 && colorByCca3.get(cca3)) || FALLBACK;
}
