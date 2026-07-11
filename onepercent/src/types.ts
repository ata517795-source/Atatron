/** ISO date "YYYY-MM-DD" — the app's canonical day key. */
export type DayKey = string

export type Frequency =
  | { type: 'harian' }
  | { type: 'mingguan'; kali: number } // kali = times per week (mingguan 1x = kali:1)

export type HabitKind = 'build' | 'break'

export interface Habit {
  id: string
  nama: string
  frekuensi: Frequency
  waktuEksekusi: string // "HH:MM"
  kind: HabitKind
  icon: string // emoji
  color: string // one of PALETTE slots
  goalId?: string
  sport: boolean // Strava auto-complete candidate
  reminder: boolean
  cue: string // habit-loop diagram fields
  routine: string
  reward: string
  createdAt: DayKey
  archived: boolean
  /** set of logged days; for 'break' habits a log means a clean day */
  log: Record<DayKey, true>
  /** days auto-logged from Strava (subset of log) with activity summary */
  stravaLog: Record<DayKey, string>
}

export type Alloc = 'kebutuhan' | 'keinginan' | 'investasi'

export interface Transaction {
  id: string
  tanggal: DayKey
  nominal: number
  jenis: 'pemasukan' | 'pengeluaran'
  alokasi?: Alloc // only for pengeluaran
  kategori: string
  catatan: string
}

export type Horizon =
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'yearly'
  | '5y'
  | '10y'
  | '20y'

export type GoalStatus = 'not_started' | 'in_progress' | 'achieved'

export interface KeyResult {
  id: string
  label: string
  done: boolean
}

export interface Goal {
  id: string
  nama: string
  horizon: Horizon
  tenggatWaktu: DayKey
  kategori: string
  status: GoalStatus
  keyResults: KeyResult[]
  achievedAt?: DayKey
}

export interface Settings {
  theme: 'dark' | 'light'
  userName: string
  onboarded: boolean
  targetRatio: { kebutuhan: number; keinginan: number; investasi: number }
  remindersEnabled: boolean
  eveningSummary: boolean
  stravaConnected: boolean // demo connection (real OAuth needs a backend — see README)
  calendarConnected: boolean
}

export interface Period {
  month: number // 0-11
  year: number
}
