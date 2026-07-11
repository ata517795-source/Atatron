import type { Habit, DayKey } from '../types'
import { addDays, daysInMonth, fromKey, makeKey, startOfWeek, todayKey } from './date'

export function frekuensiLabel(h: Habit): string {
  if (h.frekuensi.type === 'harian') return 'Harian'
  const k = h.frekuensi.kali
  return k === 1 ? 'Mingguan' : `${k}x seminggu`
}

export function timesPerWeek(h: Habit): number {
  return h.frekuensi.type === 'harian' ? 7 : h.frekuensi.kali
}

function logsInWeek(h: Habit, weekStart: DayKey): number {
  let n = 0
  for (let i = 0; i < 7; i++) if (h.log[addDays(weekStart, i)]) n++
  return n
}

/**
 * Streak Saat Ini.
 * - Harian: consecutive logged days ending today or yesterday (today still
 *   pending doesn't break it). Unit: hari.
 * - Nx seminggu: consecutive weeks meeting the target, counting back from the
 *   last complete week. The current week never breaks the streak while it can
 *   still be met, and extends it once met. Unit: minggu.
 */
export function currentStreak(h: Habit): { n: number; unit: 'hari' | 'minggu' } {
  const today = todayKey()
  if (h.frekuensi.type === 'harian') {
    let n = 0
    let d = h.log[today] ? today : addDays(today, -1)
    while (h.log[d]) {
      n++
      d = addDays(d, -1)
    }
    return { n, unit: 'hari' }
  }
  const target = h.frekuensi.kali
  const thisWeek = startOfWeek(today)
  let n = 0
  let week = thisWeek
  if (logsInWeek(h, week) >= target) n++ // current week already met
  week = addDays(week, -7)
  while (logsInWeek(h, week) >= target) {
    n++
    week = addDays(week, -7)
  }
  return { n, unit: 'minggu' }
}

export function bestStreak(h: Habit): { n: number; unit: 'hari' | 'minggu' } {
  const keys = Object.keys(h.log).sort()
  if (keys.length === 0) return { n: 0, unit: h.frekuensi.type === 'harian' ? 'hari' : 'minggu' }
  if (h.frekuensi.type === 'harian') {
    let best = 1
    let run = 1
    for (let i = 1; i < keys.length; i++) {
      run = addDays(keys[i - 1], 1) === keys[i] ? run + 1 : 1
      if (run > best) best = run
    }
    return { n: best, unit: 'hari' }
  }
  const target = h.frekuensi.kali
  const weeks = new Map<DayKey, number>()
  for (const k of keys) {
    const w = startOfWeek(k)
    weeks.set(w, (weeks.get(w) ?? 0) + 1)
  }
  const sorted = [...weeks.keys()].sort()
  let best = 0
  let run = 0
  let prev: DayKey | null = null
  for (const w of sorted) {
    const met = (weeks.get(w) ?? 0) >= target
    run = met ? (prev !== null && addDays(prev, 7) === w ? run + 1 : 1) : 0
    prev = met ? w : null
    if (run > best) best = run
  }
  return { n: best, unit: 'minggu' }
}

/** scheduled days for a habit within a month (capped at today for the current month) */
export function scheduledDaysInMonth(h: Habit, year: number, month: number): number {
  const today = fromKey(todayKey())
  const total = daysInMonth(year, month)
  let effective = total
  if (year === today.getFullYear() && month === today.getMonth()) effective = today.getDate()
  if (year > today.getFullYear() || (year === today.getFullYear() && month > today.getMonth())) effective = 0
  if (h.frekuensi.type === 'harian') return effective
  return Math.max(1, Math.round((h.frekuensi.kali * effective) / 7))
}

export function doneDaysInMonth(h: Habit, year: number, month: number): number {
  let n = 0
  const total = daysInMonth(year, month)
  for (let d = 1; d <= total; d++) if (h.log[makeKey(year, month, d)]) n++
  return n
}

/** Persentase bulanan: days done ÷ days scheduled by Frekuensi (capped 100) */
export function monthlyPercent(h: Habit, year: number, month: number): number {
  const sched = scheduledDaysInMonth(h, year, month)
  if (sched === 0) return 0
  return Math.min(100, (doneDaysInMonth(h, year, month) / sched) * 100)
}

/** day-by-day completion: % of active habits logged on each day of the range */
export function dailyCompletion(habits: Habit[], days: DayKey[]): (number | null)[] {
  const today = todayKey()
  return days.map((day) => {
    if (day > today) return null
    const active = habits.filter((h) => !h.archived && h.createdAt <= day)
    if (active.length === 0) return null
    const done = active.filter((h) => h.log[day]).length
    return (done / active.length) * 100
  })
}

export function movingAverage(values: (number | null)[], window: number): (number | null)[] {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1).filter((v): v is number => v !== null)
    if (slice.length === 0) return null
    return slice.reduce((a, b) => a + b, 0) / slice.length
  })
}

export const MILESTONES = [7, 21, 30, 66, 100, 365]

/** habit-formation ring: progress toward 21 then 66 logged days */
export function formationProgress(h: Habit): { logged: number; target: 21 | 66 } {
  const logged = Object.keys(h.log).length
  return { logged, target: logged < 21 ? 21 : 66 }
}
