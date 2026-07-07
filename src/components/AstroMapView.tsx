import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { geoAzimuthalEquidistant, geoCentroid, geoPath } from 'd3-geo';
import { useGame } from '../store/gameStore';
import { countryColor } from '../lib/colors';
import { NEIGHBORS, WORLD_FEATURES, countryOfFeature, featureName, type CountryFeature } from '../lib/worldGeo';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/**
 * Antarctica is hidden on the astro chart: in the pole-centered azimuthal
 * projection it smears into a ring around the whole rim. (It stays fully
 * clickable on the globe and flat map.)
 */
function onChart(f: CountryFeature): boolean {
  return countryOfFeature(f)?.cca3 !== 'ATA' && f.properties?.name !== 'Antarctica';
}

/** Spherical centroids, computed once (used for stars + constellation lines). */
const CENTROIDS: [number, number][] = WORLD_FEATURES.map((f) => geoCentroid(f as never));

/** Unique neighbor pairs (i < j) for the constellation lines. */
const PAIRS: [number, number][] = [];
NEIGHBORS.forEach((ns, i) => ns.forEach((j) => i < j && PAIRS.push([i, j])));

interface Tip {
  x: number;
  y: number;
  text: string;
}

export function AstroMapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectCountry = useGame((s) => s.selectCountry);
  const selectedCca3 = useGame((s) => s.selectedCca3);

  const [size, setSize] = useState({ w: 1200, h: 700 });
  const [spin, setSpin] = useState(20); // rotation of the star wheel
  const [tilt, setTilt] = useState(-90); // -90 = North Pole at center
  const [zoom, setZoom] = useState(1);
  const [hovered, setHovered] = useState<CountryFeature | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const drag = useRef<{ x: number; y: number; spin: number; tilt: number } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const R = (Math.min(size.w, size.h) / 2 - 34) * zoom;
  const cx = size.w / 2;
  const cy = size.h / 2;

  const { paths, stars, lines } = useMemo(() => {
    const projection = geoAzimuthalEquidistant()
      .rotate([spin, tilt])
      .scale(R / Math.PI)
      .translate([cx, cy])
      .clipAngle(179.9);
    const path = geoPath(projection);
    const paths = WORLD_FEATURES.filter(onChart).map((f) => ({ f, d: path(f as never) ?? '' }));
    const pts = CENTROIDS.map((c) => projection(c));
    const stars = WORLD_FEATURES.map((f, i) => {
      const p = pts[i];
      if (!onChart(f)) return null;
      const country = countryOfFeature(f);
      const area = country?.area ?? 1000;
      return p && Number.isFinite(p[0])
        ? { f, x: p[0], y: p[1], r: Math.min(3.6, Math.max(1.1, Math.log10(Math.max(10, area)) * 0.62)) }
        : null;
    });
    const lines = PAIRS.map(([a, b]) => {
      if (!onChart(WORLD_FEATURES[a]) || !onChart(WORLD_FEATURES[b])) return null;
      const pa = pts[a];
      const pb = pts[b];
      if (!pa || !pb || !Number.isFinite(pa[0]) || !Number.isFinite(pb[0])) return null;
      // skip lines that wrap across the chart rim
      const d2 = (pa[0] - pb[0]) ** 2 + (pa[1] - pb[1]) ** 2;
      if (d2 > (R * 0.9) ** 2) return null;
      return { x1: pa[0], y1: pa[1], x2: pb[0], y2: pb[1] };
    });
    return { paths, stars, lines };
  }, [size, spin, tilt, zoom, R, cx, cy]);

  const zoomBy = useCallback((factor: number) => {
    setZoom((z) => Math.min(8, Math.max(0.7, z * factor)));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      if (k === 'z') zoomBy(1.35);
      if (k === 'x') zoomBy(1 / 1.35);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomBy]);

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, spin, tilt };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (drag.current) {
      const dx = e.clientX - drag.current.x;
      const dy = e.clientY - drag.current.y;
      setSpin(drag.current.spin + dx * (0.35 / zoom));
      setTilt(Math.min(90, Math.max(-90, drag.current.tilt + dy * (0.3 / zoom))));
    }
    if (hovered) setTip({ x: e.clientX, y: e.clientY, text: featureName(hovered) });
  };
  const onPointerUp = () => (drag.current = null);

  // month ring tick positions
  const ring = useMemo(
    () =>
      MONTHS.map((m, i) => {
        const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
        return {
          m,
          x: cx + Math.cos(a) * (R + 16),
          y: cy + Math.sin(a) * (R + 16),
          tx1: cx + Math.cos(a) * (R + 2),
          ty1: cy + Math.sin(a) * (R + 2),
          tx2: cx + Math.cos(a) * (R + 8),
          ty2: cy + Math.sin(a) * (R + 8),
        };
      }),
    [R, cx, cy],
  );

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden"
      style={{
        background:
          'radial-gradient(circle at 50% 45%, #131b4a 0%, #0b1030 45%, #070b24 100%)',
      }}
    >
      <svg
        width={size.w}
        height={size.h}
        className="block touch-none"
        style={{ cursor: drag.current ? 'grabbing' : hovered ? 'pointer' : 'grab' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => {
          onPointerUp();
          setHovered(null);
          setTip(null);
        }}
        onWheel={(e) => zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12)}
      >
        <defs>
          <filter id="astroGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="chartBg">
            <stop offset="0%" stopColor="#182258" />
            <stop offset="80%" stopColor="#0d1338" />
            <stop offset="100%" stopColor="#0a0e2c" />
          </radialGradient>
        </defs>

        {/* chart disc + rim */}
        <circle cx={cx} cy={cy} r={R} fill="url(#chartBg)" stroke="#ffd166" strokeOpacity="0.35" strokeWidth="1.5" />
        <circle cx={cx} cy={cy} r={R * 0.66} fill="none" stroke="#ffd166" strokeOpacity="0.1" strokeDasharray="3 6" />
        <circle cx={cx} cy={cy} r={R * 0.33} fill="none" stroke="#ffd166" strokeOpacity="0.1" strokeDasharray="3 6" />
        {ring.map((t) => (
          <g key={t.m}>
            <line x1={t.tx1} y1={t.ty1} x2={t.tx2} y2={t.ty2} stroke="#ffd166" strokeOpacity="0.4" />
            <text
              x={t.x}
              y={t.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="9"
              fontWeight={800}
              fill="#ffd166"
              opacity="0.55"
              fontFamily="Nunito, sans-serif"
            >
              {t.m}
            </text>
          </g>
        ))}

        {/* country regions — faint glowing shapes */}
        {paths.map(({ f, d }, i) => {
          const c = countryOfFeature(f);
          const col = countryColor(c?.cca3);
          const isSel = c && c.cca3 === selectedCca3;
          const isHov = f === hovered;
          return (
            <path
              key={i}
              d={d}
              fill={col.fill}
              fillOpacity={isSel ? 0.55 : isHov ? 0.45 : 0.2}
              stroke={col.glow}
              strokeOpacity={isSel || isHov ? 0.95 : 0.55}
              strokeWidth={isSel ? 1.4 : 0.7}
              onPointerEnter={() => setHovered(f)}
              onPointerLeave={() => setHovered(null)}
              onClick={() => {
                if (drag.current) return;
                if (c) selectCountry(c.cca3);
              }}
              style={{ transition: 'fill-opacity 150ms, stroke-opacity 150ms' }}
            />
          );
        })}

        {/* constellation lines between neighboring countries */}
        <g filter="url(#astroGlow)" pointerEvents="none">
          {lines.map(
            (l, i) =>
              l && (
                <line
                  key={i}
                  x1={l.x1}
                  y1={l.y1}
                  x2={l.x2}
                  y2={l.y2}
                  stroke="#9fd8ff"
                  strokeOpacity="0.38"
                  strokeWidth="0.9"
                  strokeDasharray="1 4"
                  strokeLinecap="round"
                />
              ),
          )}
        </g>

        {/* one star per country */}
        <g filter="url(#astroGlow)">
          {stars.map(
            (s, i) =>
              s && (
                <circle
                  key={i}
                  cx={s.x}
                  cy={s.y}
                  r={s.f === hovered ? s.r * 1.8 : s.r}
                  fill={countryOfFeature(s.f) ? '#fff6d8' : '#8b93b8'}
                  opacity={0.9}
                  style={{ animation: `twinkle ${2 + (i % 5) * 0.7}s ease-in-out ${(i % 7) * 0.4}s infinite` }}
                  pointerEvents="none"
                />
              ),
          )}
        </g>

        {/* hovered / selected name in chart style */}
        {(hovered || selectedCca3) && (
          <text
            x={cx}
            y={cy - R - 24 < 20 ? 24 : cy - R - 10}
            textAnchor="middle"
            fontSize="18"
            fontWeight={800}
            fill="#ffe29a"
            fontFamily="'Baloo 2', sans-serif"
            pointerEvents="none"
          >
            {hovered ? `✦ ${featureName(hovered)} ✦` : ''}
          </text>
        )}
      </svg>

      {tip && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-amber-glow/50 bg-dusk-900/95 px-3 py-1 text-sm font-extrabold text-gold-300"
          style={{ left: tip.x + 14, top: tip.y - 36 }}
        >
          ✦ {tip.text}
        </div>
      )}

      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-dusk-900/80 px-4 py-1.5 text-xs font-bold text-gold-300/90 backdrop-blur">
        Astro chart — drag to spin the wheel · Click a constellation-country ·{' '}
        <kbd className="text-amber-glow">Z</kbd>/<kbd className="text-amber-glow">X</kbd> zoom
      </div>
    </div>
  );
}
