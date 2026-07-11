import { useMemo } from 'react'
import { useStore } from '../store'
import { addDays, BULAN, dayOfYear, daysUntil, formatTanggal, fromKey, HARI_PENDEK, sisaWaktuLabel, todayKey } from '../lib/date'
import { monthlyPercent } from '../lib/habits'
import { persen, rupiah } from '../lib/format'
import { CountUp, Empty, Ring } from './ui'
import { progress, HORIZONS } from './Goals'

const DEMO_EVENTS = [
  { time: '09:00', title: 'Daily standup', cal: true },
  { time: '13:00', title: 'Review proyek', cal: true },
  { time: '16:30', title: 'Mentoring', cal: true },
]

export function Dashboard() {
  const habits = useStore((s) => s.habits)
  const goals = useStore((s) => s.goals)
  const transactions = useStore((s) => s.transactions)
  const settings = useStore((s) => s.settings)
  const toggleLog = useStore((s) => s.toggleLog)
  const setTab = useStore((s) => s.setTab)

  const today = todayKey()
  const now = fromKey(today)
  const active = habits.filter((h) => !h.archived)

  // consistency score: this year's logged days ÷ scheduled-ish days so far
  const doy = dayOfYear(today)
  const consistency = useMemo(() => {
    if (active.length === 0) return 0
    const per = active.map((h) => {
      let done = 0
      let span = 0
      for (let i = 0; i < Math.min(doy, 120); i++) {
        const d = addDays(today, -i)
        if (d < h.createdAt) break
        span++
        if (h.log[d]) done++
      }
      return span ? done / span : 0
    })
    return (per.reduce((a, b) => a + b, 0) / per.length) * 100
  }, [active, today, doy])

  // streak flame: consecutive days with any log
  const flame = useMemo(() => {
    const anyLog = (d: string) => habits.some((h) => h.log[d])
    let n = 0
    let d = anyLog(today) ? today : addDays(today, -1)
    while (anyLog(d)) {
      n++
      d = addDays(d, -1)
    }
    return n
  }, [habits, today])

  const monthTx = transactions.filter((t) => t.tanggal.startsWith(today.slice(0, 7)))
  const nett = monthTx.reduce((a, t) => a + (t.jenis === 'pemasukan' ? t.nominal : -t.nominal), 0)
  const monthScore = active.length
    ? active.reduce((a, h) => a + monthlyPercent(h, now.getFullYear(), now.getMonth()), 0) / active.length
    : 0

  const upcoming = goals
    .filter((g) => g.status !== 'achieved')
    .sort((a, b) => a.tenggatWaktu.localeCompare(b.tenggatWaktu))
    .slice(0, 3)
  const overdue = goals.filter((g) => g.status !== 'achieved' && daysUntil(g.tenggatWaktu) < 0)

  // today checklist interleaved with calendar events
  const timeline = useMemo(() => {
    const items: Array<{ time: string; kind: 'habit' | 'event'; habitId?: string; title: string; icon: string; done?: boolean; color?: string; strava?: string }> = []
    for (const h of active) {
      items.push({
        time: h.waktuEksekusi, kind: 'habit', habitId: h.id, title: h.nama,
        icon: h.icon, done: !!h.log[today], color: h.color, strava: h.stravaLog[today],
      })
    }
    if (settings.calendarConnected) for (const e of DEMO_EVENTS) items.push({ time: e.time, kind: 'event', title: e.title, icon: '📅' })
    return items.sort((a, b) => a.time.localeCompare(b.time))
  }, [active, settings.calendarConnected, today])

  const hour = new Date().getHours()
  const salam = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 19 ? 'Selamat sore' : 'Selamat malam'

  return (
    <div>
      <div className="spread" style={{ marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>
            {salam}{settings.userName ? `, ${settings.userName}` : ''} 👋
          </div>
          <div className="muted">
            {HARI_PENDEK[new Date().getDay()]}, {formatTanggal(today)} · {BULAN[now.getMonth()]} {now.getFullYear()}
          </div>
        </div>
        {flame > 0 && (
          <div className="streak-pill" style={{ fontSize: 14, padding: '8px 13px' }}>
            🔥 {flame} hari
          </div>
        )}
      </div>

      <HeroCard doy={doy} consistency={consistency} />

      {active.length === 0 ? (
        <Empty
          art="🌱"
          title="Belum ada habit — ayo mulai jadi 1% lebih baik!"
          body="Buat habit pertamamu dan mulai kurva pertumbuhanmu hari ini."
          action={<button className="btn primary" onClick={() => setTab('habits')}>+ Buat Habit Pertama</button>}
        />
      ) : (
        <>
          <div className="section-title">Hari ini <span className="line" /></div>
          <div className="card" style={{ padding: '6px 14px' }}>
            {timeline.map((item, i) => (
              <div key={i} className="tx-row">
                <div className="muted" style={{ width: 42, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{item.time}</div>
                <div className="tx-icon" style={item.color ? { background: `color-mix(in srgb, ${item.color} 16%, transparent)` } : undefined}>{item.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, textDecoration: item.done ? 'line-through' : 'none', color: item.done ? 'var(--ink-3)' : 'var(--ink)' }}>
                    {item.title}
                  </div>
                  {item.strava && <span className="strava-pill">🟠 Strava · {item.strava}</span>}
                  {item.kind === 'event' && <span className="muted" style={{ fontSize: 11 }}>Google Calendar</span>}
                </div>
                {item.kind === 'habit' && item.habitId && (
                  <button
                    className={`habit-check ${item.done ? 'done' : ''}`}
                    style={{ width: 38, height: 38, ['--hcolor' as string]: item.color }}
                    onClick={() => toggleLog(item.habitId!, today)}
                  >
                    ✓
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <div className="stat-grid">
        <button className="stat-tile" style={{ cursor: 'pointer', textAlign: 'left' }} onClick={() => setTab('expenses')}>
          <div className="k">Nett Cashflow bulan ini</div>
          <div className={`v ${nett >= 0 ? 'pos' : 'neg'}`} style={{ fontSize: 17 }}>
            <CountUp value={nett} format={rupiah} />
          </div>
        </button>
        <button className="stat-tile row" style={{ cursor: 'pointer', gap: 12 }} onClick={() => setTab('habits')}>
          <Ring percent={monthScore} color="var(--habits)" size={54} stroke={6} />
          <div style={{ textAlign: 'left' }}>
            <div className="k">Habit bulan ini</div>
            <div style={{ fontWeight: 800 }}>{persen(monthScore)}</div>
          </div>
        </button>
      </div>

      {(upcoming.length > 0 || overdue.length > 0) && (
        <>
          <div className="section-title">Goal terdekat <span className="line" /></div>
          {overdue.map((g) => (
            <button key={g.id} className="card goal-card overdue" style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }} onClick={() => setTab('goals')}>
              <div className="spread">
                <span style={{ fontWeight: 800 }}>⚠️ {g.nama}</span>
                <span className="small" style={{ color: 'var(--critical)', fontWeight: 800 }}>{sisaWaktuLabel(g.tenggatWaktu)}</span>
              </div>
              <div className="muted">Lewat tenggat — selesaikan atau geser tenggatnya.</div>
            </button>
          ))}
          {upcoming.filter((g) => daysUntil(g.tenggatWaktu) >= 0).map((g) => (
            <button key={g.id} className="card" style={{ width: '100%', textAlign: 'left', cursor: 'pointer', color: 'var(--ink)' }} onClick={() => setTab('goals')}>
              <div className="spread">
                <span style={{ fontWeight: 800, fontSize: 14 }}>🎯 {g.nama}</span>
                <span className="small" style={{ color: 'var(--goals)', fontWeight: 800 }}>{sisaWaktuLabel(g.tenggatWaktu)}</span>
              </div>
              <div className="goal-progress" style={{ margin: '8px 0 2px' }}>
                <div className="fill" style={{ width: `${progress(g)}%` }} />
              </div>
              <div className="muted">{HORIZONS.find((h) => h.id === g.horizon)?.label} · {g.kategori} · {Math.round(progress(g))}%</div>
            </button>
          ))}
        </>
      )}
    </div>
  )
}

/** "1% Better" hero: compound curve 1.01^day with your position marker */
function HeroCard({ doy, consistency }: { doy: number; consistency: number }) {
  const W = 320
  const H = 110
  const days = 365
  const y = (d: number) => H - 8 - (Math.pow(1.01, d) / Math.pow(1.01, days)) * (H - 26)
  const x = (d: number) => 8 + (d / days) * (W - 16)
  const path = useMemo(() => {
    let p = ''
    for (let d = 0; d <= days; d += 5) p += `${p ? ' L' : 'M'}${x(d).toFixed(1)} ${y(d).toFixed(1)}`
    return p
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="card hero">
      <div className="spread" style={{ position: 'relative', zIndex: 1 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>1% lebih baik setiap hari</div>
          <div className="muted small">1,01³⁶⁵ = 37,8× dalam setahun</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 800, fontSize: 22 }}><CountUp value={consistency} format={(v) => persen(v)} /></div>
          <div className="muted" style={{ fontSize: 10.5 }}>konsistensimu</div>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" style={{ position: 'relative', zIndex: 1 }}>
        <path d={`${path} L ${x(days)} ${H} L ${x(0)} ${H} Z`} fill="rgba(247,178,59,0.14)" />
        <path d={path} fill="none" stroke="#f7b23b" strokeWidth="2.5" strokeLinecap="round" />
        <line x1={x(doy)} x2={x(doy)} y1={y(doy)} y2={H - 4} stroke="rgba(255,255,255,0.5)" strokeWidth="1" strokeDasharray="3 3" />
        <circle cx={x(doy)} cy={y(doy)} r="6" fill="#f7b23b" stroke="#2b2073" strokeWidth="2.5" />
        <text x={Math.min(x(doy) + 8, W - 70)} y={Math.max(y(doy) - 8, 12)} fontSize="10" fontWeight="800" fill="#fff">
          hari ke-{doy}
        </text>
        <text x={x(0)} y={H - 2} fontSize="8.5" fill="rgba(255,255,255,0.55)">Jan</text>
        <text x={x(days) - 20} y={H - 2} fontSize="8.5" fill="rgba(255,255,255,0.55)">Des</text>
      </svg>
    </div>
  )
}
