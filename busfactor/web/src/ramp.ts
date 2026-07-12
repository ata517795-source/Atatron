/**
 * Sequential blue ramp (validated reference palette) for risk magnitude.
 * Light mode: light -> dark as risk grows. Dark mode: the same ramp selected
 * for the dark surface — recessive (dark) steps for low risk, bright steps
 * for high risk — so perceptual salience tracks risk in both modes.
 */
const RAMP = [
  "#cde2fb", "#b7d3f6", "#9ec5f4", "#86b6ef", "#6da7ec", "#5598e7",
  "#3987e5", "#2a78d6", "#256abf", "#1c5cab", "#184f95", "#104281", "#0d366b",
];

export function riskColor(risk: number, dark: boolean): string {
  const t = Math.max(0, Math.min(1, risk / 100));
  const index = Math.round(t * (RAMP.length - 1));
  return dark ? RAMP[RAMP.length - 1 - index] : RAMP[index];
}

/** Relative luminance — decides whether cell labels wear dark or light ink. */
export function inkFor(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const lum =
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255);
  return lum > 0.35 ? "#0b0b0b" : "#ffffff";
}

export function rampGradientCss(dark: boolean): string {
  const stops = dark ? [...RAMP].reverse() : RAMP;
  return `linear-gradient(to right, ${stops.join(", ")})`;
}
