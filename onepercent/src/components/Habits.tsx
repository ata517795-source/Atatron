import { useMemo, useState } from 'react'
import { useStore } from '../store'
import type { Habit } from '../types'
import { BULAN, BULAN_PENDEK, daysInMonth, makeKey, todayKey, formatTanggalPendek } from '../lib/date'
import { currentStreak, dailyCompletion, frekuensiLabel, monthlyPercent, movingAverage } from '../lib/habits'
import { persen } from '../lib/format'
import { PeriodSelector, Ring, Empty } from './ui'
import { LineChart } from './charts'
import { HabitForm } from './HabitForm'

const ACCENT = 'var(--habits)'

export function Habits() {
  const habits = useStore((s) => s.habits)
  const period = useStore((s) => s.period)
  const toggleLog = useStore((s) => s.toggleLog)
  const [view, setView] = useState<'hari' | 'tahun' | 'grafik'>('hari')
  const [editing, setEditing] = useState<Habit | 'new' | null>(null)

  const active = habits.filter((h) => !h.archived)
  const archived = habits.filter((h) => h.archived)
  const today = todayKey()

  const overallMonth = useMemo(() => {
    if (active.length === 0) return 0
    return active.reduce((a, h) => a + monthlyPercent(h, period.year, period.month), 0) / active.length
  }, [active, period])

  return (
    <div style={{ ['--accent' as string]: ACCENT }}>
      <PeriodSelector accent={ACCENT} />

      {active.length === 0 && archived.length === 0 ? (
        <Empty
          art="🌱"
          title="Belum ada habit"
          body="Ayo mulai jadi 1% lebih baik — bangun habit pertamamu!"
          action={<button className="btn primary" onClick={() => setEditing('new')}>+ Habit Baru</button>}
        />
      ) : (
        <>
          <div className="card glow-habits">
            <div className="spread">
              <div>
                <div className="muted">Skor bulan {BULAN[period.month]}</div>
                <div className="big-number">{persen(overallMonth)}</div>
                <div className="small" style={{ color: 'var(--ink-2)' }}>
                  {overallMonth >= 80 ? 'Luar biasa konsisten! 🔥' : overallMonth >= 50 ? 'Terus naik, jangan putus! 💪' : 'Mulai lagi hari ini — 1% saja. 🌱'}
                </div>
              </div>
              <Ring percent={overallMonth} color={ACCENT} size={84} />
            </div>
          </div>

          <div className="seg" style={{ marginBottom: 14 }}>
            <button className={view === 'hari' ? 'active' : ''} onClick={() => setView('hari')}>Hari Ini</button>
            <button className={view === 'tahun' ? 'active' : ''} onClick={() => setView('tahun')}>Tahun {period.year}</button>
            <button className={view === 'grafik' ? 'active' : ''} onClick={() => setView('grafik')}>Grafik</button>
          </div>

          {view === 'hari' && (
            <>
              {active.map((h) => {
                const st = currentStreak(h)
                const pct = monthlyPercent(h, period.year, period.month)
                const doneToday = !!h.log[today]
                return (
                  <div key={h.id} className="card habit-card" style={{ ['--hcolor' as string]: h.color }}>
                    <button className="habit-icon" style={{ border: 'none', cursor: 'pointer' }} onClick={() => setEditing(h)} aria-label={`Edit ${h.nama}`}>
                      {h.icon}
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }} onClick={() => setEditing(h)}>
                      <div style={{ fontWeight: 800, fontSize: 15 }}>{h.nama}</div>
                      <div className="muted">
                        {frekuensiLabel(h)} · {h.waktuEksekusi}
                        {h.kind === 'break' && ' · hari bersih'}
                      </div>
                      <div className="row" style={{ gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
                        <span className="streak-pill">🔥 {st.n} {st.unit}</span>
                        {h.stravaLog[today] && <span className="strava-pill">🟠 Strava · {h.stravaLog[today]}</span>}
                        <span className="muted" style={{ fontSize: 11 }}>{persen(pct)} bulan ini</span>
                      </div>
                    </div>
                    <button
                      className={`habit-check ${doneToday ? 'done' : ''}`}
                      onClick={() => toggleLog(h.id, today)}
                      aria-label={doneToday ? 'Batalkan log hari ini' : 'Log hari ini'}
                    >
                      ✓
                    </button>
                  </div>
                )
              })}
              {archived.length > 0 && (
                <>
                  <div className="section-title">Diarsipkan <span className="line" /></div>
                  {archived.map((h) => (
                    <div key={h.id} className="card habit-card" style={{ opacity: 0.65, ['--hcolor' as string]: h.color }}>
                      <div className="habit-icon">{h.icon}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800 }}>{h.nama}</div>
                        <div className="muted">{frekuensiLabel(h)}</div>
                      </div>
                      <button className="btn sm ghost" onClick={() => setEditing(h)}>Kelola</button>
                    </div>
                  ))}
                </>
              )}
            </>
          )}

          {view === 'tahun' && <YearGrid habits={active} year={period.year} />}
          {view === 'grafik' && <ProgressChart habits={active} />}
        </>
      )}

      <button className="fab" onClick={() => setEditing('new')} aria-label="Habit baru">+</button>
      {editing && <HabitForm habit={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

/* ---------- Year view: rows = habits, columns = days grouped by month ---------- */
function YearGrid({ habits, year }: { habits: Habit[]; year: number }) {
  const toggleLog = useStore((s) => s.toggleLog)
  const [cell, setCell] = useState(13)
  const today = todayKey()

  const months = useMemo(
    () => Array.from({ length: 12 }, (_, m) => ({ m, days: daysInMonth(year, m) })),
    [year],
  )

  return (
    <div className="card">
      <div className="spread" style={{ marginBottom: 10 }}>
        <div style={{ fontWeight: 800 }}>Jan–Des {year}</div>
        <div className="row" style={{ gap: 8 }}>
          <span className="muted">Zoom</span>
          <input
            type="range" min={9} max={22} value={cell}
            onChange={(e) => setCell(Number(e.target.value))}
            style={{ width: 90 }}
            aria-label="Zoom grid"
          />
        </div>
      </div>
      <div className="yeargrid-scroll">
        <table className="yeargrid">
          <thead>
            <tr>
              <th className="mlabel" />
              {months.map(({ m, days }) => (
                <th key={m} colSpan={days} style={{ fontSize: 10, fontWeight: 800, color: 'var(--habits)', textAlign: 'left', paddingBottom: 4 }}>
                  {BULAN_PENDEK[m]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {habits.map((h) => (
              <tr key={h.id} style={{ ['--hcolor' as string]: h.color }}>
                <td className="mlabel" title={h.nama}>{h.icon}</td>
                {months.flatMap(({ m, days }) =>
                  Array.from({ length: days }, (_, i) => {
                    const key = makeKey(year, m, i + 1)
                    const future = key > today
                    return (
                      <td key={key} style={{ padding: 0 }}>
                        <button
                          className={`ycell ${h.log[key] ? 'done' : ''} ${key === today ? 'today' : ''} ${future ? 'future' : ''}`}
                          style={{ width: cell, height: cell }}
                          disabled={future}
                          onClick={() => toggleLog(h.id, key)}
                          aria-label={`${h.nama} ${key}`}
                          title={`${h.nama} · ${key}${h.stravaLog[key] ? ` · Strava ${h.stravaLog[key]}` : ''}`}
                        />
                      </td>
                    )
                  }),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="muted" style={{ marginTop: 8 }}>
        Ketuk sel untuk toggle log. Geser untuk melihat sepanjang tahun · kotak berbingkai = hari ini.
      </div>
    </div>
  )
}

/* ---------- day-by-day progress chart + 1% reference ---------- */
function ProgressChart({ habits }: { habits: Habit[] }) {
  const period = useStore((s) => s.period)
  const [range, setRange] = useState<'bulan' | 'tahun'>('bulan')

  const { days, labels } = useMemo(() => {
    if (range === 'bulan') {
      const n = daysInMonth(period.year, period.month)
      const days = Array.from({ length: n }, (_, i) => makeKey(period.year, period.month, i + 1))
      return { days, labels: days.map((_d, i) => String(i + 1)) }
    }
    const days: string[] = []
    for (let m = 0; m < 12; m++) {
      const n = daysInMonth(period.year, m)
      for (let d = 1; d <= n; d++) days.push(makeKey(period.year, m, d))
    }
    return { days, labels: days.map((d) => (d.endsWith('-01') ? BULAN_PENDEK[Number(d.slice(5, 7)) - 1] : '')) }
  }, [period, range])

  const daily = useMemo(() => dailyCompletion(habits, days), [habits, days])
  const ma = useMemo(() => movingAverage(daily, 7), [daily])
  const reference = useMemo(
    () => days.map((_, i) => 100 / Math.pow(1.01, days.length - 1 - i)),
    [days],
  )

  return (
    <div className="card">
      <div className="spread" style={{ marginBottom: 8 }}>
        <div style={{ fontWeight: 800 }}>Progres harian</div>
        <div className="seg" style={{ width: 170 }}>
          <button className={range === 'bulan' ? 'active' : ''} onClick={() => setRange('bulan')}>{BULAN_PENDEK[period.month]}</button>
          <button className={range === 'tahun' ? 'active' : ''} onClick={() => setRange('tahun')}>{period.year}</button>
        </div>
      </div>
      <LineChart
        series={[
          { name: 'Harian', color: 'color-mix(in srgb, var(--habits) 45%, transparent)', values: daily, width: 1.5 },
          { name: 'Rata-rata 7 hari', color: 'var(--habits)', values: ma, width: 2.5 },
          { name: 'Kurva 1%/hari', color: 'var(--ink-3)', values: reference, dashed: true, width: 1.5 },
        ]}
        xLabels={labels}
        tipLabel={(i) => formatTanggalPendek(days[i])}
      />
      <div className="muted" style={{ marginTop: 10 }}>
        Garis putus-putus = pertumbuhan majemuk 1% per hari (1,01^hari). Kejar dirimu yang teoretis! 🚀
      </div>
    </div>
  )
}
