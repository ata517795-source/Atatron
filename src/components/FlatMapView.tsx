import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { useGame } from '../store/gameStore';
import { countryColor } from '../lib/colors';
import { WORLD_FEATURES, countryOfFeature, featureName, type CountryFeature } from '../lib/worldGeo';

interface Tip {
  x: number;
  y: number;
  text: string;
}

export function FlatMapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectCountry = useGame((s) => s.selectCountry);
  const selectedCca3 = useGame((s) => s.selectedCca3);

  const [size, setSize] = useState({ w: 1200, h: 700 });
  const [lambda, setLambda] = useState(0); // horizontal pan = projection rotation
  const [zoom, setZoom] = useState(1);
  const [hovered, setHovered] = useState<CountryFeature | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const drag = useRef<{ x: number; lambda: number } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() =>
      setSize({ w: el.clientWidth, h: el.clientHeight }),
    );
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const { paths, labels } = useMemo(() => {
    const projection = geoNaturalEarth1()
      .rotate([lambda, 0])
      .fitExtent(
        [
          [8, 8],
          [size.w - 8, size.h - 8],
        ],
        { type: 'Sphere' },
      );
    projection.scale(projection.scale() * zoom);
    projection.translate([size.w / 2, size.h / 2]);
    const path = geoPath(projection);
    const paths = WORLD_FEATURES.map((f) => ({
      f,
      d: path(f as never) ?? '',
      area: path.area(f as never),
    }));
    // label a country when its projected shape is big enough on screen
    const labels = paths
      .filter((p) => p.area > 260)
      .map((p) => {
        const [cx, cy] = path.centroid(p.f as never);
        return {
          f: p.f,
          x: cx,
          y: cy,
          size: Math.max(9, Math.min(20, Math.sqrt(p.area) / 9)),
        };
      })
      .filter((l) => Number.isFinite(l.x) && Number.isFinite(l.y));
    return { paths, labels };
  }, [size, lambda, zoom]);

  const zoomBy = useCallback((factor: number) => {
    setZoom((z) => Math.min(9, Math.max(1, z * factor)));
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
    drag.current = { x: e.clientX, lambda };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (drag.current) {
      const dx = e.clientX - drag.current.x;
      setLambda(drag.current.lambda - (dx * 360) / (size.w * zoom * 1.6));
    }
    if (hovered) {
      setTip({ x: e.clientX, y: e.clientY, text: featureName(hovered) });
    }
  };
  const onPointerUp = () => (drag.current = null);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-gradient-to-b from-ink-950 via-[#0e1a45] to-[#14103a]"
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
        {/* ocean */}
        <rect width={size.w} height={size.h} fill="transparent" />
        {paths.map(({ f, d }, i) => {
          const c = countryOfFeature(f);
          const col = countryColor(c?.cca3);
          const isSel = c && c.cca3 === selectedCca3;
          const isHov = f === hovered;
          return (
            <path
              key={i}
              d={d}
              fill={isSel || isHov ? col.bright : col.fill}
              stroke="#070b24"
              strokeWidth={isSel ? 1.6 : 0.6}
              opacity={hovered && !isHov && !isSel ? 0.82 : 1}
              onPointerEnter={() => setHovered(f)}
              onPointerLeave={() => setHovered(null)}
              onClick={() => {
                if (drag.current) return;
                if (c) selectCountry(c.cca3);
              }}
              style={{ transition: 'opacity 120ms' }}
            />
          );
        })}
        {labels.map((l, i) => (
          <text
            key={`t${i}`}
            x={l.x}
            y={l.y}
            textAnchor="middle"
            fontSize={l.size}
            fontFamily="Nunito, sans-serif"
            fontWeight={800}
            fill="rgba(10,12,30,0.85)"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth={0.5}
            paintOrder="stroke"
            pointerEvents="none"
          >
            {featureName(l.f)}
          </text>
        ))}
      </svg>

      {tip && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-gold-400/50 bg-ink-900/95 px-3 py-1 text-sm font-extrabold text-gold-300"
          style={{ left: tip.x + 14, top: tip.y - 36 }}
        >
          {tip.text}
        </div>
      )}

      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-ink-900/80 px-4 py-1.5 text-xs font-bold text-gold-300/90 backdrop-blur">
        Drag to pan · Click a country · <kbd className="text-gold-400">Z</kbd> zoom in ·{' '}
        <kbd className="text-gold-400">X</kbd> zoom out
      </div>
      <div className="absolute right-4 top-4 flex flex-col gap-1">
        <button
          onClick={() => zoomBy(1.35)}
          className="h-9 w-9 rounded-xl bg-ink-800/90 text-lg font-black text-gold-300 transition hover:bg-ink-700"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          onClick={() => zoomBy(1 / 1.35)}
          className="h-9 w-9 rounded-xl bg-ink-800/90 text-lg font-black text-gold-300 transition hover:bg-ink-700"
          aria-label="Zoom out"
        >
          −
        </button>
      </div>
    </div>
  );
}
