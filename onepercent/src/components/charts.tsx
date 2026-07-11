import { useMemo, useRef, useState } from 'react'

/* Chart primitives — hand-rolled SVG, phone-first, hover/tap tooltips. */

const W = 360
const H = 190
const PAD = { l: 34, r: 10, t: 12, b: 22 }

export interface LineSeries {
  name: string
  color: string
  values: (number | null)[]
  dashed?: boolean
  width?: number
}

export function LineChart({ series, xLabels, yMax = 100, formatY, tipLabel }: {
  series: LineSeries[]
  xLabels: string[] // one per index; sparse ticks are auto-picked
  yMax?: number
  formatY?: (v: number) => string
  tipLabel?: (i: number) => string
}) {
  const n = Math.max(...series.map((s) => s.values.length))
  const [tip, setTip] = useState<{ i: number; xPct: number; yPct: number } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const x = (i: number) => PAD.l + (i / Math.max(1, n - 1)) * (W - PAD.l - PAD.r)
  const y = (v: number) => PAD.t + (1 - Math.min(v, yMax) / yMax) * (H - PAD.t - PAD.b)
  const fy = formatY ?? ((v: number) => `${Math.round(v)}%`)

  const paths = useMemo(
    () =>
      series.map((s) => {
        let d = ''
        s.values.forEach((v, i) => {
          if (v === null) return
          d += (d && s.values[i - 1] !== null ? ' L' : ' M') + `${x(i).toFixed(1)} ${y(v).toFixed(1)}`
        })
        return d
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series, n, yMax],
  )

  const tickEvery = Math.max(1, Math.ceil(n / 6))

  const onMove = (clientX: number) => {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return
    const rel = ((clientX - rect.left) / rect.width) * W
    const i = Math.max(0, Math.min(n - 1, Math.round(((rel - PAD.l) / (W - PAD.l - PAD.r)) * (n - 1))))
    const first = series.find((s) => s.values[i] !== null)
    const v = first?.values[i]
    setTip({ i, xPct: (x(i) / W) * 100, yPct: v != null ? (y(v) / H) * 100 : 30 })
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <svg
        className="chart-svg"
        viewBox={`0 0 ${W} ${H}`}
        onPointerMove={(e) => onMove(e.clientX)}
        onPointerDown={(e) => onMove(e.clientX)}
        onPointerLeave={() => setTip(null)}
      >
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(yMax * f)} y2={y(yMax * f)} stroke="var(--grid)" strokeWidth="1" />
            <text x={PAD.l - 5} y={y(yMax * f) + 3.5} fontSize="9" fill="var(--ink-3)" textAnchor="end">
              {fy(yMax * f)}
            </text>
          </g>
        ))}
        <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} stroke="var(--baseline)" strokeWidth="1" />
        {xLabels.map((l, i) =>
          i % tickEvery === 0 && l ? (
            <text key={i} x={x(i)} y={H - 7} fontSize="9" fill="var(--ink-3)" textAnchor="middle">
              {l}
            </text>
          ) : null,
        )}
        {tip && <line x1={x(tip.i)} x2={x(tip.i)} y1={PAD.t} y2={H - PAD.b} stroke="var(--ink-3)" strokeWidth="1" strokeDasharray="3 3" />}
        {series.map((s, si) => (
          <path
            key={s.name}
            d={paths[si]}
            fill="none"
            stroke={s.color}
            strokeWidth={s.width ?? 2}
            strokeDasharray={s.dashed ? '5 5' : undefined}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        {tip &&
          series.map((s) => {
            const v = s.values[tip.i]
            if (v === null || v === undefined) return null
            return <circle key={s.name} cx={x(tip.i)} cy={y(v)} r="4" fill={s.color} stroke="var(--surface)" strokeWidth="2" />
          })}
      </svg>
      {tip && (
        <div className="chart-tip" style={{ left: `${tip.xPct}%`, top: `${Math.max(14, tip.yPct)}%` }}>
          <div>{tipLabel ? tipLabel(tip.i) : xLabels[tip.i]}</div>
          {series.map((s) => {
            const v = s.values[tip.i]
            return v === null || v === undefined ? null : (
              <div key={s.name} className="tsub">
                <span style={{ color: s.color }}>●</span> {s.name}: {fy(v)}
              </div>
            )
          })}
        </div>
      )}
      <div className="legend">
        {series.map((s) => (
          <span key={s.name} className="item">
            <span className="swatch line" style={{ background: s.color, ...(s.dashed ? { backgroundImage: `repeating-linear-gradient(90deg, ${s.color} 0 4px, transparent 4px 7px)`, background: 'none', borderTop: `3px dashed ${s.color}`, height: 0 } : {}) }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  )
}

export function Donut({ data, centerLabel, centerSub, format }: {
  data: Array<{ label: string; value: number; color: string; note?: string }>
  centerLabel: string
  centerSub?: string
  format: (v: number) => string
}) {
  const total = data.reduce((a, d) => a + d.value, 0)
  const [sel, setSel] = useState<number | null>(null)
  const size = 168
  const r = 62
  const cx = size / 2
  const stroke = 26

  let acc = 0
  const arcs = data.map((d) => {
    const a0 = (acc / Math.max(1, total)) * Math.PI * 2 - Math.PI / 2
    acc += d.value
    const a1 = (acc / Math.max(1, total)) * Math.PI * 2 - Math.PI / 2
    const large = a1 - a0 > Math.PI ? 1 : 0
    const p0 = [cx + r * Math.cos(a0), cx + r * Math.sin(a0)]
    const p1 = [cx + r * Math.cos(a1), cx + r * Math.sin(a1)]
    return { d, path: `M ${p0[0]} ${p0[1]} A ${r} ${r} 0 ${large} 1 ${p1[0]} ${p1[1]}` }
  })

  return (
    <div className="row" style={{ gap: 16, alignItems: 'center' }}>
      <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
        <svg width={size} height={size}>
          {arcs.map((a, i) =>
            a.d.value > 0 ? (
              <path
                key={a.d.label}
                d={a.path}
                fill="none"
                stroke={a.d.color}
                strokeWidth={sel === i ? stroke + 5 : stroke}
                strokeLinecap="butt"
                style={{ transition: 'stroke-width 0.2s', cursor: 'pointer' }}
                onClick={() => setSel(sel === i ? null : i)}
              />
            ) : null,
          )}
          {/* 2px surface gaps between segments */}
          {data.filter((d) => d.value > 0).length > 1 &&
            (() => {
              let cum = 0
              return data.map((d) => {
                const ang = (cum / Math.max(1, total)) * Math.PI * 2 - Math.PI / 2
                cum += d.value
                const inner = r - stroke / 2 - 4
                const outer = r + stroke / 2 + 4
                return (
                  <line
                    key={`gap-${d.label}`}
                    x1={cx + inner * Math.cos(ang)} y1={cx + inner * Math.sin(ang)}
                    x2={cx + outer * Math.cos(ang)} y2={cx + outer * Math.sin(ang)}
                    stroke="var(--surface)" strokeWidth="2"
                  />
                )
              })
            })()}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', pointerEvents: 'none' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>{sel !== null ? format(data[sel].value) : centerLabel}</div>
            <div className="muted" style={{ fontSize: 10.5 }}>{sel !== null ? data[sel].label : centerSub}</div>
          </div>
        </div>
      </div>
      <div style={{ flex: 1 }}>
        {data.map((d, i) => (
          <button
            key={d.label}
            onClick={() => setSel(sel === i ? null : i)}
            style={{
              display: 'block', width: '100%', textAlign: 'left', background: sel === i ? 'var(--surface-2)' : 'none',
              border: 'none', borderRadius: 10, padding: '7px 8px', cursor: 'pointer', color: 'var(--ink)',
            }}
          >
            <span className="row" style={{ gap: 7 }}>
              <span className="swatch" style={{ width: 10, height: 10, borderRadius: 3, background: d.color, flex: 'none' }} />
              <span style={{ fontSize: 12.5, fontWeight: 700, flex: 1 }}>{d.label}</span>
              <span style={{ fontSize: 12.5, fontWeight: 800 }}>{total ? Math.round((d.value / total) * 100) : 0}%</span>
            </span>
            {d.note && <span className="muted" style={{ fontSize: 10.5, paddingLeft: 17 }}>{d.note}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

/** grouped monthly bars: two series across 12 months, rounded data-ends */
export function GroupedBars({ labels, a, b, nameA, nameB, colorA, colorB, format }: {
  labels: string[]
  a: number[]
  b: number[]
  nameA: string
  nameB: string
  colorA: string
  colorB: string
  format: (v: number) => string
}) {
  const [tip, setTip] = useState<number | null>(null)
  const max = Math.max(1, ...a, ...b)
  const bw = (W - PAD.l - PAD.r) / labels.length
  const barW = Math.min(9, bw / 2 - 3)
  const y = (v: number) => PAD.t + (1 - v / max) * (H - PAD.t - PAD.b)

  const bar = (xPos: number, v: number, color: string, key: string) => {
    const yTop = y(v)
    const h = H - PAD.b - yTop
    if (h <= 0) return null
    const rr = Math.min(4, h)
    return (
      <path
        key={key}
        d={`M ${xPos} ${H - PAD.b} L ${xPos} ${yTop + rr} Q ${xPos} ${yTop} ${xPos + rr} ${yTop} L ${xPos + barW - rr} ${yTop} Q ${xPos + barW} ${yTop} ${xPos + barW} ${yTop + rr} L ${xPos + barW} ${H - PAD.b} Z`}
        fill={color}
      />
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} onPointerLeave={() => setTip(null)}>
        {[0.5, 1].map((f) => (
          <g key={f}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(max * f)} y2={y(max * f)} stroke="var(--grid)" strokeWidth="1" />
            <text x={PAD.l - 5} y={y(max * f) + 3.5} fontSize="8.5" fill="var(--ink-3)" textAnchor="end">{format(max * f)}</text>
          </g>
        ))}
        <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} stroke="var(--baseline)" strokeWidth="1" />
        {labels.map((l, i) => {
          const gx = PAD.l + i * bw
          return (
            <g key={l} onPointerDown={() => setTip(i)} onPointerEnter={() => setTip(i)} style={{ cursor: 'pointer' }}>
              <rect x={gx} y={PAD.t} width={bw} height={H - PAD.t - PAD.b} fill={tip === i ? 'var(--chip)' : 'transparent'} rx="4" />
              {bar(gx + bw / 2 - barW - 1, a[i], colorA, `a${i}`)}
              {bar(gx + bw / 2 + 1, b[i], colorB, `b${i}`)}
              <text x={gx + bw / 2} y={H - 7} fontSize="8.5" fill="var(--ink-3)" textAnchor="middle">{l}</text>
            </g>
          )
        })}
      </svg>
      {tip !== null && (a[tip] > 0 || b[tip] > 0) && (
        <div className="chart-tip" style={{ left: `${((PAD.l + tip * bw + bw / 2) / W) * 100}%`, top: '8%' }}>
          <div>{labels[tip]}</div>
          <div className="tsub"><span style={{ color: colorA }}>●</span> {nameA}: {format(a[tip])}</div>
          <div className="tsub"><span style={{ color: colorB }}>●</span> {nameB}: {format(b[tip])}</div>
        </div>
      )}
      <div className="legend">
        <span className="item"><span className="swatch" style={{ background: colorA }} /> {nameA}</span>
        <span className="item"><span className="swatch" style={{ background: colorB }} /> {nameB}</span>
      </div>
    </div>
  )
}
