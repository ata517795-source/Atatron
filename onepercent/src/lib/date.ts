import type { DayKey } from '../types'

export const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]
export const BULAN_PENDEK = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
]
export const HARI_PENDEK = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

export function todayKey(): DayKey {
  return toKey(new Date())
}

export function toKey(d: Date): DayKey {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromKey(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function makeKey(year: number, month: number, day: number): DayKey {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

/** DD/MM/YYYY per the app convention */
export function formatTanggal(key: DayKey): string {
  const [y, m, d] = key.split('-')
  return `${d}/${m}/${y}`
}

export function formatTanggalPendek(key: DayKey): string {
  const d = fromKey(key)
  return `${d.getDate()} ${BULAN_PENDEK[d.getMonth()]}`
}

export function addDays(key: DayKey, n: number): DayKey {
  const d = fromKey(key)
  d.setDate(d.getDate() + n)
  return toKey(d)
}

/** Monday-based start of week */
export function startOfWeek(key: DayKey): DayKey {
  const d = fromKey(key)
  const dow = (d.getDay() + 6) % 7 // Mon=0
  d.setDate(d.getDate() - dow)
  return toKey(d)
}

export function dayOfYear(key: DayKey): number {
  const d = fromKey(key)
  const start = new Date(d.getFullYear(), 0, 1)
  return Math.floor((d.getTime() - start.getTime()) / 86400000) + 1
}

/** days until deadline (negative = overdue) */
export function daysUntil(key: DayKey): number {
  const ms = fromKey(key).getTime() - fromKey(todayKey()).getTime()
  return Math.round(ms / 86400000)
}

export function sisaWaktuLabel(key: DayKey): string {
  const n = daysUntil(key)
  if (n < 0) return `terlewat ${-n} hari`
  if (n === 0) return 'hari ini!'
  if (n === 1) return 'besok'
  if (n < 60) return `${n} hari lagi`
  const bulan = Math.round(n / 30)
  if (bulan < 24) return `${bulan} bulan lagi`
  return `${Math.round(bulan / 12)} tahun lagi`
}
