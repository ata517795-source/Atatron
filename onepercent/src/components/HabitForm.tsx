import { useState } from 'react'
import { useStore } from '../store'
import type { Frequency, Habit } from '../types'
import { todayKey } from '../lib/date'
import { uid } from '../lib/format'
import { bestStreak, currentStreak, formationProgress } from '../lib/habits'
import { Modal, Ring, Switch, xCancel } from './ui'

const ICONS = ['🏃', '📚', '🧘', '💧', '🛏️', '🗣️', '💪', '🥗', '✍️', '🙏', '🚭', '📵', '💰']
const COLORS = ['#eb6834', '#3987e5', '#199e70', '#c98500', '#9085e9', '#e66767', '#d55181', '#008300']

const FREQ_OPTIONS: Array<{ label: string; value: Frequency }> = [
  { label: 'Harian', value: { type: 'harian' } },
  { label: '2x seminggu', value: { type: 'mingguan', kali: 2 } },
  { label: '3x seminggu', value: { type: 'mingguan', kali: 3 } },
  { label: '4x seminggu', value: { type: 'mingguan', kali: 4 } },
  { label: '5x seminggu', value: { type: 'mingguan', kali: 5 } },
  { label: '6x seminggu', value: { type: 'mingguan', kali: 6 } },
  { label: 'Mingguan (1x)', value: { type: 'mingguan', kali: 1 } },
]

export function HabitForm({ habit, onClose }: { habit: Habit | null; onClose: () => void }) {
  const upsert = useStore((s) => s.upsertHabit)
  const del = useStore((s) => s.deleteHabit)
  const archive = useStore((s) => s.archiveHabit)
  const renew = useStore((s) => s.renewHabit)
  const goals = useStore((s) => s.goals)
  const showSnackbar = useStore((s) => s.showSnackbar)

  const [nama, setNama] = useState(habit?.nama ?? '')
  const [kind, setKind] = useState<Habit['kind']>(habit?.kind ?? 'build')
  const [freqIdx, setFreqIdx] = useState(() => {
    if (!habit) return 0
    if (habit.frekuensi.type === 'harian') return 0
    const kali = habit.frekuensi.kali
    const i = FREQ_OPTIONS.findIndex((o) => o.value.type === 'mingguan' && o.value.kali === kali)
    return i === -1 ? 0 : i
  })
  const [waktu, setWaktu] = useState(habit?.waktuEksekusi ?? '06:00')
  const [icon, setIcon] = useState(habit?.icon ?? '🏃')
  const [color, setColor] = useState(habit?.color ?? COLORS[0])
  const [sport, setSport] = useState(habit?.sport ?? false)
  const [reminder, setReminder] = useState(habit?.reminder ?? true)
  const [goalId, setGoalId] = useState(habit?.goalId ?? '')
  const [cue, setCue] = useState(habit?.cue ?? '')
  const [routine, setRoutine] = useState(habit?.routine ?? '')
  const [reward, setReward] = useState(habit?.reward ?? '')

  const dirty = nama !== (habit?.nama ?? '')

  const save = () => {
    if (!nama.trim()) return
    upsert({
      id: habit?.id ?? uid(),
      nama: nama.trim(),
      frekuensi: FREQ_OPTIONS[freqIdx].value,
      waktuEksekusi: waktu,
      kind,
      icon,
      color,
      sport,
      reminder,
      goalId: goalId || undefined,
      cue,
      routine: routine || nama.trim(),
      reward,
      createdAt: habit?.createdAt ?? todayKey(),
      archived: habit?.archived ?? false,
      log: habit?.log ?? {},
      stravaLog: habit?.stravaLog ?? {},
    })
    onClose()
  }

  const form = formationProgress(
    habit ?? { log: {} } as Habit,
  )

  return (
    <Modal
      title={habit ? 'Ubah Habit' : 'Habit Baru'}
      sub='Ketik "X" di kolom nama untuk membatalkan.'
      onClose={onClose}
    >
      {habit && (
        <div className="row" style={{ gap: 16, marginBottom: 16 }}>
          <Ring
            percent={(form.logged / form.target) * 100}
            color={color}
            size={70}
            label={form.logged >= form.target ? '✓' : `${form.logged}`}
            sublabel={form.logged >= form.target ? 'terbentuk!' : `/ ${form.target} hari`}
          />
          <div className="small" style={{ color: 'var(--ink-2)', flex: 1 }}>
            <b>Pembentukan habit:</b> {form.logged} hari tercatat menuju {form.target} hari
            {' '}· Streak saat ini {currentStreak(habit).n} {currentStreak(habit).unit}
            {' '}· terbaik {bestStreak(habit).n} {bestStreak(habit).unit}
          </div>
        </div>
      )}

      <div className="field">
        <label>Nama Habit</label>
        <input
          value={nama}
          placeholder="cth. Lari Pagi"
          autoFocus={!habit}
          onChange={(e) => {
            if (xCancel(e.target.value, dirty, onClose)) return
            setNama(e.target.value)
          }}
        />
      </div>

      <div className="field">
        <label>Jenis</label>
        <div className="seg">
          <button className={kind === 'build' ? 'active' : ''} onClick={() => setKind('build')}>🌱 Bangun kebiasaan baik</button>
          <button className={kind === 'break' ? 'active' : ''} onClick={() => setKind('break')}>⛓️‍💥 Putus kebiasaan buruk</button>
        </div>
        {kind === 'break' && <div className="hint">Untuk kebiasaan buruk, mencentang = satu hari bersih tanpa kebiasaan itu.</div>}
      </div>

      <div className="row" style={{ gap: 10 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Frekuensi</label>
          <select value={freqIdx} onChange={(e) => setFreqIdx(Number(e.target.value))}>
            {FREQ_OPTIONS.map((o, i) => (
              <option key={o.label} value={i}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Waktu Eksekusi</label>
          <input type="time" value={waktu} onChange={(e) => setWaktu(e.target.value)} />
        </div>
      </div>

      {/* Habit-loop diagram: Cue → Routine → Reward */}
      <div className="field">
        <label>Diagram Habit Loop</label>
        <div className="loop-diagram">
          <div className="loop-node">
            <b>PEMICU</b>
            <input value={cue} placeholder="cth. alarm 05:20" onChange={(e) => setCue(e.target.value)} />
          </div>
          <div className="loop-arrow">→</div>
          <div className="loop-node">
            <b>RUTINITAS</b>
            <input value={routine} placeholder={nama || 'kebiasaannya'} onChange={(e) => setRoutine(e.target.value)} />
          </div>
          <div className="loop-arrow">→</div>
          <div className="loop-node">
            <b>HADIAH</b>
            <input value={reward} placeholder="cth. kopi enak" onChange={(e) => setReward(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="row" style={{ gap: 10 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Ikon</label>
          <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
            {ICONS.map((ic) => (
              <button
                key={ic}
                className="btn sm"
                style={{ fontSize: 18, padding: '6px 9px', background: ic === icon ? 'var(--habits-soft)' : 'var(--surface-2)', border: ic === icon ? '1.5px solid var(--habits)' : '1.5px solid transparent' }}
                onClick={() => setIcon(ic)}
              >
                {ic}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="field">
        <label>Warna</label>
        <div className="row" style={{ gap: 8 }}>
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              aria-label={`Warna ${c}`}
              style={{
                width: 30, height: 30, borderRadius: 10, background: c, cursor: 'pointer',
                border: c === color ? '3px solid var(--ink)' : '3px solid transparent',
              }}
            />
          ))}
        </div>
      </div>

      {goals.length > 0 && (
        <div className="field">
          <label>Tautkan ke Goal (opsional)</label>
          <select value={goalId} onChange={(e) => setGoalId(e.target.value)}>
            <option value="">— tidak ditautkan —</option>
            {goals.filter((g) => g.status !== 'achieved').map((g) => (
              <option key={g.id} value={g.id}>{g.nama}</option>
            ))}
          </select>
        </div>
      )}

      <div className="setting-row">
        <span style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>🟠 Habit olahraga (auto-log dari Strava)</span>
        <Switch on={sport} onChange={setSport} />
      </div>
      <div className="setting-row" style={{ marginBottom: 16 }}>
        <span style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>⏰ Pengingat di Waktu Eksekusi</span>
        <Switch on={reminder} onChange={setReminder} />
      </div>

      <button className="btn primary block" onClick={save} disabled={!nama.trim()} style={{ opacity: nama.trim() ? 1 : 0.5 }}>
        {habit ? 'Simpan Perubahan' : 'Mulai Habit Ini 🌱'}
      </button>

      {habit && (
        <div className="row" style={{ gap: 8, marginTop: 10 }}>
          <button
            className="btn ghost sm"
            style={{ flex: 1 }}
            onClick={() => {
              renew(habit.id)
              showSnackbar(`"${habit.nama}" diperbarui — riwayat tersimpan, hitungan mulai lagi`)
              onClose()
            }}
          >
            🔄 Perbarui
          </button>
          <button
            className="btn ghost sm"
            style={{ flex: 1 }}
            onClick={() => {
              archive(habit.id, !habit.archived)
              onClose()
            }}
          >
            {habit.archived ? '📤 Aktifkan' : '📦 Arsipkan'}
          </button>
          <button
            className="btn danger sm"
            style={{ flex: 1 }}
            onClick={() => {
              del(habit.id)
              onClose()
            }}
          >
            🗑️ Hapus
          </button>
        </div>
      )}
    </Modal>
  )
}
