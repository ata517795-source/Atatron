import { hierarchy, treemap, treemapSquarify, type HierarchyRectangularNode } from "d3-hierarchy";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ModuleStats } from "./api.ts";
import { inkFor, rampGradientCss, riskColor } from "./ramp.ts";

interface TreemapProps {
  modules: ModuleStats[];
  selected: string | null;
  onSelect: (path: string) => void;
}

type LeafDatum = ModuleStats & { value?: number };

function useDarkMode(): boolean {
  const [dark, setDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return dark;
}

export function Treemap({ modules, selected, onSelect }: TreemapProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(880);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; m: ModuleStats } | null>(null);
  const dark = useDarkMode();
  const height = 560;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(Math.max(360, w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const leaves = useMemo(() => {
    const root = hierarchy<{ children: LeafDatum[] } | LeafDatum>({ children: modules })
      .sum((d) => ("risk" in d ? Math.max(d.loc, 40) : 0))
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    treemap<{ children: LeafDatum[] } | LeafDatum>()
      .size([width, height])
      .paddingInner(2)
      .paddingOuter(2)
      .tile(treemapSquarify)(root);
    return root.leaves() as HierarchyRectangularNode<LeafDatum>[];
  }, [modules, width]);

  return (
    <div className="treemap-wrap" ref={wrapRef}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Knowledge-risk treemap: cell size is lines of code, color is risk"
        onMouseLeave={() => setTooltip(null)}
      >
        {leaves.map((leaf) => {
          const m = leaf.data;
          const w = leaf.x1 - leaf.x0;
          const h = leaf.y1 - leaf.y0;
          const fill = riskColor(m.risk, dark);
          const ink = inkFor(fill);
          const isSelected = selected === m.path;
          return (
            <g key={m.path} className="cell" transform={`translate(${leaf.x0},${leaf.y0})`}>
              <rect
                width={w}
                height={h}
                rx={4}
                fill={fill}
                stroke={isSelected ? ink : "none"}
                strokeWidth={isSelected ? 2 : 0}
                onClick={() => onSelect(m.path)}
                onMouseMove={(e) => {
                  const bounds = wrapRef.current!.getBoundingClientRect();
                  setTooltip({
                    x: Math.min(e.clientX - bounds.left + 14, width - 260),
                    y: e.clientY - bounds.top + 14,
                    m,
                  });
                }}
              />
              {w > 76 && h > 30 && (
                <text x={8} y={18} fill={ink} fontSize={12.5} fontWeight={600}>
                  {truncate(m.path, w / 7.2)}
                </text>
              )}
              {w > 76 && h > 48 && (
                <text x={8} y={35} fill={ink} fontSize={11.5} opacity={0.85}>
                  risk {m.risk}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {tooltip && (
        <div className="tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          <div className="t-title">{tooltip.m.path}</div>
          <div className="t-row">
            risk {tooltip.m.risk} / 100 · {tooltip.m.tier} · {tooltip.m.kind}
          </div>
          <div className="t-row">
            {tooltip.m.topOwners[0]
              ? `${Math.round(tooltip.m.topOwners[0].share * 100)}% held by ${tooltip.m.topOwners[0].name}`
              : "no owner data"}
          </div>
          <div className="t-row">
            {tooltip.m.effectiveOwners.toFixed(1)} effective owner(s) · {tooltip.m.files} files ·{" "}
            {tooltip.m.loc.toLocaleString()} loc
          </div>
        </div>
      )}
      <div className="legend">
        <span>Risk</span>
        <span>0</span>
        <div className="bar" style={{ background: rampGradientCss(dark) }} />
        <span>100</span>
        <span style={{ marginLeft: 12 }}>cell size = lines of code</span>
      </div>
    </div>
  );
}

function truncate(s: string, maxChars: number): string {
  return s.length > maxChars ? s.slice(0, Math.max(3, Math.floor(maxChars) - 1)) + "…" : s;
}
