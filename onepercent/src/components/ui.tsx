import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { BULAN_PENDEK } from '../lib/date'

/* ---------- X-to-cancel convention ----------
   Any form field: typing exactly "X" (or "x") discards the entry.
   Non-empty forms ask for confirmation first. */
export function xCancel(value: string, dirty: boolean, close: () => void): boolean {
  if (value.trim().toLowerCase() !== 'x') return false
  if (!dirty || window.confirm('Buang isian ini? (kamu mengetik "X")')) close()
  return true
}

export function Modal({ title, sub, onClose, children }: {
  title: string
  sub?: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label={title}>
        <div className="grab" />
        <div className="spread">
          <h2>{title}</h2>
          <button className="btn ghost sm" onClick={onClose} aria-label="Tutup">✕</button>
        </div>
        {sub && <div className="sub">{sub}</div>}
        {children}
      </div>
    </div>
  )
}

export function Ring({ percent, size = 74, stroke = 8, color, label, sublabel }: {
  percent: number
  size?: number
  stroke?: number
  color: string
  label?: string
  sublabel?: string
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const [off, setOff] = useState(c)
  useEffect(() => {
    const t = setTimeout(() => setOff(c * (1 - Math.min(100, percent) / 100)), 40)
    return () => clearTimeout(t)
  }, [percent, c])
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle
          className="ring-fg"
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={off}
        />
      </svg>
      <div className="ring-label">
        <div style={{ fontSize: size / 4.6 }}>{label ?? `${Math.round(percent)}%`}</div>
        {sublabel && <div className="muted" style={{ fontSize: 10 }}>{sublabel}</div>}
      </div>
    </div>
  )
}

/** animated counting number */
export function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const [shown, setShown] = useState(0)
  const prev = useRef(0)
  useEffect(() => {
    const from = prev.current
    prev.current = value
    const start = performance.now()
    const dur = 700
    let raf: number
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / dur)
      const ease = 1 - Math.pow(1 - t, 3)
      setShown(from + (value - from) * ease)
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <>{format(shown)}</>
}

/** global period selector: Jan–Des chips + year stepper */
export function PeriodSelector({ accent }: { accent: string }) {
  const period = useStore((s) => s.period)
  const setPeriod = useStore((s) => s.setPeriod)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.querySelector('.chip.active')?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [])
  return (
    <div style={{ ['--accent' as string]: accent, marginBottom: 14 }}>
      <div className="spread" style={{ marginBottom: 8 }}>
        <div className="year-stepper">
          <button onClick={() => setPeriod({ ...period, year: period.year - 1 })} aria-label="Tahun sebelumnya">‹</button>
          <span>{period.year}</span>
          <button onClick={() => setPeriod({ ...period, year: period.year + 1 })} aria-label="Tahun berikutnya">›</button>
        </div>
        <button
          className="btn ghost sm"
          onClick={() => setPeriod({ month: new Date().getMonth(), year: new Date().getFullYear() })}
        >
          Hari ini
        </button>
      </div>
      <div className="period" ref={ref}>
        {BULAN_PENDEK.map((b, i) => (
          <button
            key={b}
            className={`chip ${i === period.month ? 'active' : ''}`}
            onClick={() => setPeriod({ ...period, month: i })}
          >
            {b}
          </button>
        ))}
      </div>
    </div>
  )
}

export function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return <button className={`switch ${on ? 'on' : ''}`} role="switch" aria-checked={on} onClick={() => onChange(!on)} />
}

export function Snackbar() {
  const snackbar = useStore((s) => s.snackbar)
  const dismiss = useStore((s) => s.dismissSnackbar)
  if (!snackbar) return null
  return (
    <div className="snackbar">
      <span>{snackbar.message}</span>
      {snackbar.undo && <button onClick={snackbar.undo}>URUNGKAN</button>}
      <button onClick={dismiss} style={{ color: 'var(--ink-3)' }}>✕</button>
    </div>
  )
}

export function Celebration() {
  const celebration = useStore((s) => s.celebration)
  const dismiss = useStore((s) => s.dismissCelebration)
  if (!celebration) return null
  return (
    <div className="celebration" onClick={dismiss}>
      <div className="box">
        <span className="emoji">🎉</span>
        <p style={{ fontWeight: 800, fontSize: 17, lineHeight: 1.45 }}>{celebration}</p>
        <button className="btn primary block" onClick={dismiss}>Lanjut! 🚀</button>
      </div>
    </div>
  )
}

export function Empty({ art, title, body, action }: {
  art: string
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="empty card">
      <div className="art">{art}</div>
      <b>{title}</b>
      <div className="small" style={{ marginBottom: action ? 16 : 0 }}>{body}</div>
      {action}
    </div>
  )
}
