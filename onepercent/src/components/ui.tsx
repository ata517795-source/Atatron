import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { BULAN_PENDEK } from '../lib/date'

/* ---------- icon system: stroked 24x24 SVGs, no emoji ---------- */
const PATHS: Record<string, ReactNode> = {
  pulse: <path d="M3 12h4l2.5-7 5 14 2.5-7h4" />,
  flame: (
    <path d="M12 22c4.4 0 7-3 7-6.8 0-4.8-3.8-6.7-5.2-10.7-.6 2-2 3.4-3.6 5C8.2 11.4 5 12.8 5 15.7 5 19 7.6 22 12 22zM12 22c-2 0-3.2-1.5-3.2-3.2 0-1.9 1.4-2.7 2.2-4.6.9 1 2.9 1.9 2.9 4.3 0 1.8-.9 3.5-1.9 3.5z" />
  ),
  wallet: (
    <>
      <path d="M19 7V5a1.5 1.5 0 0 0-1.5-1.5H5A2 2 0 0 0 3 5.5V18a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2H5" />
      <circle cx="16.5" cy="13.5" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 7h16M4 12h16M4 17h16" />
      <circle cx="14.5" cy="7" r="2" fill="var(--surface)" />
      <circle cx="8.5" cy="12" r="2" fill="var(--surface)" />
      <circle cx="16.5" cy="17" r="2" fill="var(--surface)" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M4 10h16M8 3v4M16 3v4" />
    </>
  ),
  trophy: (
    <>
      <path d="M7.5 3.5h9V10a4.5 4.5 0 0 1-9 0V3.5z" />
      <path d="M7.5 5.5H4.5a3 3 0 0 0 3 3.7M16.5 5.5h3a3 3 0 0 1-3 3.7" />
      <path d="M12 14.5v3.5M8.5 21h7M10 21v-3h4v3" />
    </>
  ),
  trending: <path d="M3 17.5l5.5-5.5 3.5 3.5L20 8M15.5 8H20v4.5" />,
  repeat: (
    <path d="M17 2.5l3.5 3.5L17 9.5M20.5 6H8a5 5 0 0 0-5 5M7 21.5L3.5 18 7 14.5M3.5 18H16a5 5 0 0 0 5-5" />
  ),
  arrowIn: <path d="M17 7L7 17M7 9.5V17h7.5" />,
  arrowOut: <path d="M7 17L17 7M9.5 7H17v7.5" />,
  check: <path d="M4.5 12.5l5 5L19.5 7" />,
}

export function Icon({ name, size = 22, strokeWidth = 1.8, style }: {
  name: keyof typeof PATHS & string
  size?: number
  strokeWidth?: number
  style?: React.CSSProperties
}) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round"
      style={style} aria-hidden
    >
      {PATHS[name]}
    </svg>
  )
}

/** monogram tile for a habit: first letter, habit color */
export function HabitMark({ nama, color, sm }: { nama: string; color: string; sm?: boolean }) {
  return (
    <span className={`habit-icon ${sm ? 'sm' : ''}`} style={{ ['--hcolor' as string]: color }}>
      {(nama.trim()[0] ?? '·').toUpperCase()}
    </span>
  )
}

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
        <div style={{ fontSize: size / 4.2 }}>{label ?? `${Math.round(percent)}%`}</div>
        {sublabel && <div className="muted" style={{ fontSize: 10, fontFamily: 'var(--font)', fontWeight: 500 }}>{sublabel}</div>}
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
        <span className="emoji" style={{ color: 'var(--habits)' }}>
          <Icon name="trophy" size={52} strokeWidth={1.5} />
        </span>
        <p style={{ fontWeight: 600, fontSize: 16.5, lineHeight: 1.45 }}>{celebration}</p>
        <button className="btn primary block" onClick={dismiss}>Lanjut</button>
      </div>
    </div>
  )
}

export function Empty({ art, title, body, action }: {
  art: ReactNode
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="empty card">
      <div className="art" style={{ color: 'var(--ink-3)' }}>{art}</div>
      <b>{title}</b>
      <div className="small" style={{ marginBottom: action ? 16 : 0 }}>{body}</div>
      {action}
    </div>
  )
}
