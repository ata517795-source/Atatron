import { useMemo, useState } from 'react'
import { useStore } from '../store'
import type { Goal, GoalStatus, Horizon, KeyResult } from '../types'
import { addDays, daysUntil, formatTanggal, sisaWaktuLabel, todayKey } from '../lib/date'
import { uid } from '../lib/format'
import { Empty, Icon, Modal, PeriodSelector, xCancel } from './ui'

const ACCENT = 'var(--goals)'

export const HORIZONS: Array<{ id: Horizon; label: string; defaultDays: number }> = [
  { id: 'weekly', label: 'Mingguan', defaultDays: 7 },
  { id: 'monthly', label: 'Bulanan', defaultDays: 30 },
  { id: 'quarterly', label: 'Kuartalan', defaultDays: 90 },
  { id: 'yearly', label: 'Tahunan', defaultDays: 365 },
  { id: '5y', label: '5 Tahun', defaultDays: 365 * 5 },
  { id: '10y', label: '10 Tahun', defaultDays: 365 * 10 },
  { id: '20y', label: '20 Tahun', defaultDays: 365 * 20 },
]

const STATUS_LABEL: Record<GoalStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  achieved: 'Achieved',
}

export function progress(g: Goal): number {
  if (g.keyResults.length === 0) return g.status === 'achieved' ? 100 : 0
  return (g.keyResults.filter((kr) => kr.done).length / g.keyResults.length) * 100
}

export function Goals() {
  const goals = useStore((s) => s.goals)
  const [horizon, setHorizon] = useState<Horizon | 'hof'>('weekly')
  const [editing, setEditing] = useState<Goal | 'new' | null>(null)

  const activeGoals = goals.filter((g) => g.status !== 'achieved')
  const achieved = goals
    .filter((g) => g.status === 'achieved')
    .sort((a, b) => (b.achievedAt ?? '').localeCompare(a.achievedAt ?? ''))

  const shown = useMemo(
    () =>
      horizon === 'hof'
        ? []
        : goals
            .filter((g) => g.horizon === horizon && g.status !== 'achieved')
            .sort((a, b) => a.tenggatWaktu.localeCompare(b.tenggatWaktu)),
    [goals, horizon],
  )

  return (
    <div style={{ ['--accent' as string]: ACCENT }}>
      <PeriodSelector accent={ACCENT} />

      <div className="horizon-tabs">
        {HORIZONS.map((h) => {
          const count = goals.filter((g) => g.horizon === h.id && g.status !== 'achieved').length
          return (
            <button
              key={h.id}
              className={`chip ${horizon === h.id ? 'active' : ''}`}
              style={{ flex: 'none', border: '1px solid var(--border)', background: horizon === h.id ? ACCENT : 'var(--chip)', color: horizon === h.id ? '#fff' : 'var(--ink-2)', borderRadius: 999, padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              onClick={() => setHorizon(h.id)}
            >
              {h.label}{count > 0 ? ` · ${count}` : ''}
            </button>
          )
        })}
        <button
          className="chip"
          style={{ flex: 'none', border: '1px solid var(--border)', background: horizon === 'hof' ? 'var(--series-yellow)' : 'var(--chip)', color: horizon === 'hof' ? '#fff' : 'var(--ink-2)', borderRadius: 999, padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          onClick={() => setHorizon('hof')}
        >
          Hall of Fame{achieved.length ? ` · ${achieved.length}` : ''}
        </button>
      </div>

      {horizon === 'hof' ? (
        achieved.length === 0 ? (
          <Empty art={<Icon name="trophy" size={44} strokeWidth={1.4} />} title="Hall of Fame masih kosong" body="Selesaikan goal pertamamu dan pajang trofinya di sini." />
        ) : (
          achieved.map((g) => (
            <div key={g.id} className="card glow-goals" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ color: 'var(--series-yellow)' }}><Icon name="trophy" size={30} strokeWidth={1.6} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800 }}>{g.nama}</div>
                <div className="muted">
                  {g.kategori} · {HORIZONS.find((h) => h.id === g.horizon)?.label}
                  {g.achievedAt ? ` · tercapai ${formatTanggal(g.achievedAt)}` : ''}
                </div>
              </div>
              <button className="btn ghost sm" onClick={() => setEditing(g)}>Lihat</button>
            </div>
          ))
        )
      ) : shown.length === 0 ? (
        <Empty
          art={<Icon name="target" size={44} strokeWidth={1.4} />}
          title={`Belum ada goal ${HORIZONS.find((h) => h.id === horizon)?.label.toLowerCase()}`}
          body="Tulis satu goal yang jelas — dirimu 20 tahun lagi akan berterima kasih."
          action={<button className="btn primary" onClick={() => setEditing('new')}>Tambah goal</button>}
        />
      ) : (
        shown.map((g) => <GoalCard key={g.id} goal={g} onEdit={() => setEditing(g)} />)
      )}

      {activeGoals.length > 0 && horizon !== 'hof' && (
        <div className="muted" style={{ textAlign: 'center', marginTop: 4 }}>
          Geser tab horizon di atas — dari minggu ini sampai 20 tahun ke depan.
        </div>
      )}

      <button className="fab" onClick={() => setEditing('new')} aria-label="Goal baru">+</button>
      {editing && (
        <GoalForm
          goal={editing === 'new' ? null : editing}
          defaultHorizon={horizon === 'hof' ? 'weekly' : horizon}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function GoalCard({ goal, onEdit }: { goal: Goal; onEdit: () => void }) {
  const toggleKeyResult = useStore((s) => s.toggleKeyResult)
  const finishGoal = useStore((s) => s.finishGoal)
  const overdue = daysUntil(goal.tenggatWaktu) < 0
  const pct = progress(goal)

  return (
    <div className={`card goal-card ${overdue ? 'overdue' : ''}`}>
      <div className="spread">
        <div style={{ fontWeight: 800, fontSize: 15.5, flex: 1 }}>{goal.nama}</div>
        <span className={`status-badge st-${goal.status}`}>{STATUS_LABEL[goal.status]}</span>
      </div>
      <div className="muted" style={{ marginTop: 3 }}>
        {goal.kategori} · Tenggat {formatTanggal(goal.tenggatWaktu)} ·{' '}
        <span style={{ color: overdue ? 'var(--critical)' : 'var(--goals)', fontWeight: 800 }}>
          {sisaWaktuLabel(goal.tenggatWaktu)}
        </span>
      </div>
      <div className="goal-progress"><div className="fill" style={{ width: `${pct}%` }} /></div>
      <div className="muted" style={{ marginBottom: 6 }}>{Math.round(pct)}% — Key Results:</div>
      {goal.keyResults.map((kr) => (
        <div key={kr.id} className="kr-row">
          <button className={`kr-check ${kr.done ? 'done' : ''}`} onClick={() => toggleKeyResult(goal.id, kr.id)} aria-label={kr.label}>✓</button>
          <span className={kr.done ? 'done-label' : ''}>{kr.label}</span>
        </div>
      ))}
      <div className="row" style={{ gap: 8, marginTop: 10 }}>
        <button className="btn sm ghost" style={{ flex: 1 }} onClick={onEdit}>Ubah</button>
        <button className="btn sm primary" style={{ flex: 1 }} onClick={() => finishGoal(goal.id)}>Selesaikan</button>
      </div>
    </div>
  )
}

function GoalForm({ goal, defaultHorizon, onClose }: {
  goal: Goal | null
  defaultHorizon: Horizon
  onClose: () => void
}) {
  const upsert = useStore((s) => s.upsertGoal)
  const del = useStore((s) => s.deleteGoal)
  const kategoriGoal = useStore((s) => s.kategoriGoal)

  const [nama, setNama] = useState(goal?.nama ?? '')
  const [horizon, setHorizon] = useState<Horizon>(goal?.horizon ?? defaultHorizon)
  const [tenggat, setTenggat] = useState(
    goal?.tenggatWaktu ?? addDays(todayKey(), HORIZONS.find((h) => h.id === defaultHorizon)!.defaultDays),
  )
  const [kategori, setKategori] = useState(goal?.kategori ?? 'Career')
  const [krs, setKrs] = useState<KeyResult[]>(goal?.keyResults ?? [{ id: uid(), label: '', done: false }])

  const dirty = nama !== (goal?.nama ?? '')

  const save = () => {
    if (!nama.trim()) return
    const keyResults = krs.filter((kr) => kr.label.trim())
    const doneCount = keyResults.filter((kr) => kr.done).length
    upsert({
      id: goal?.id ?? uid(),
      nama: nama.trim(),
      horizon,
      tenggatWaktu: tenggat,
      kategori,
      status:
        keyResults.length > 0 && doneCount === keyResults.length
          ? 'achieved'
          : doneCount > 0
            ? 'in_progress'
            : goal?.status === 'achieved'
              ? 'achieved'
              : goal?.status ?? 'not_started',
      keyResults,
      achievedAt: goal?.achievedAt,
    })
    onClose()
  }

  return (
    <Modal title={goal ? 'Ubah Goal' : 'Goal Baru'} sub='Ketik "X" di kolom nama untuk membatalkan.' onClose={onClose}>
      <div className="field">
        <label>Nama Goal</label>
        <input
          value={nama}
          placeholder="cth. Half marathon pertama"
          autoFocus={!goal}
          onChange={(e) => {
            if (xCancel(e.target.value, dirty, onClose)) return
            setNama(e.target.value)
          }}
        />
      </div>

      <div className="row" style={{ gap: 10 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Horizon</label>
          <select
            value={horizon}
            onChange={(e) => {
              const h = e.target.value as Horizon
              setHorizon(h)
              if (!goal) setTenggat(addDays(todayKey(), HORIZONS.find((x) => x.id === h)!.defaultDays))
            }}
          >
            {HORIZONS.map((h) => <option key={h.id} value={h.id}>{h.label}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Kategori</label>
          <select value={kategori} onChange={(e) => setKategori(e.target.value)}>
            {kategoriGoal.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
      </div>

      <div className="field">
        <label>Tenggat Waktu</label>
        <input type="date" value={tenggat} onChange={(e) => setTenggat(e.target.value)} />
      </div>

      <div className="field">
        <label>Key Results (1–5, terukur)</label>
        {krs.map((kr, i) => (
          <div key={kr.id} className="row" style={{ gap: 8, marginBottom: 8 }}>
            <input
              style={{ flex: 1, border: '1.5px solid var(--border)', background: 'var(--surface-2)', color: 'var(--ink)', borderRadius: 12, padding: '10px 12px', outline: 'none' }}
              value={kr.label}
              placeholder={`Key result ${i + 1}`}
              onChange={(e) => setKrs(krs.map((x) => (x.id === kr.id ? { ...x, label: e.target.value } : x)))}
            />
            <button className="btn ghost sm" onClick={() => setKrs(krs.filter((x) => x.id !== kr.id))} aria-label="Hapus key result">✕</button>
          </div>
        ))}
        {krs.length < 5 && (
          <button className="btn ghost sm" onClick={() => setKrs([...krs, { id: uid(), label: '', done: false }])}>
            + Tambah key result
          </button>
        )}
      </div>

      <button className="btn primary block" onClick={save} disabled={!nama.trim()} style={{ opacity: nama.trim() ? 1 : 0.5 }}>
        {goal ? 'Simpan perubahan' : 'Simpan goal'}
      </button>
      {goal && (
        <button className="btn danger block" style={{ marginTop: 10 }} onClick={() => { del(goal.id); onClose() }}>
          Hapus goal
        </button>
      )}
    </Modal>
  )
}
