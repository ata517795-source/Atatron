import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Alloc, Goal, Habit, Period, Settings, Transaction,
} from './types'
import { addDays, todayKey } from './lib/date'
import { currentStreak, MILESTONES } from './lib/habits'
import { confetti } from './lib/confetti'
import { buildSeed } from './lib/seed'

export type Tab = 'dashboard' | 'habits' | 'expenses' | 'goals'

interface Snackbar {
  message: string
  undo?: () => void
}

interface State {
  settings: Settings
  period: Period
  habits: Habit[]
  transactions: Transaction[]
  goals: Goal[]
  kategoriPengeluaran: string[]
  kategoriPemasukan: string[]
  kategoriGoal: string[]
  tab: Tab
  snackbar: Snackbar | null
  celebration: string | null

  setTab: (t: Tab) => void
  setPeriod: (p: Period) => void
  setSettings: (patch: Partial<Settings>) => void
  showSnackbar: (message: string, undo?: () => void) => void
  dismissSnackbar: () => void
  celebrate: (message: string) => void
  dismissCelebration: () => void

  upsertHabit: (h: Habit) => void
  deleteHabit: (id: string) => void
  archiveHabit: (id: string, archived: boolean) => void
  renewHabit: (id: string) => void
  toggleLog: (id: string, day: string) => void

  upsertTransaction: (t: Transaction) => void
  deleteTransaction: (id: string) => void
  addKategori: (jenis: 'pemasukan' | 'pengeluaran', nama: string) => void

  upsertGoal: (g: Goal) => void
  deleteGoal: (id: string) => void
  toggleKeyResult: (goalId: string, krId: string) => void
  finishGoal: (goalId: string) => void

  syncStrava: () => number
  loadDemo: () => void
  resetAll: () => void
}

const now = new Date()

const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  userName: '',
  onboarded: false,
  targetRatio: { kebutuhan: 50, keinginan: 30, investasi: 20 },
  remindersEnabled: false,
  eveningSummary: true,
  stravaConnected: false,
  calendarConnected: false,
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      period: { month: now.getMonth(), year: now.getFullYear() },
      habits: [],
      transactions: [],
      goals: [],
      kategoriPengeluaran: ['Makanan', 'Transport', 'Kos/Sewa', 'Internet', 'Hiburan', 'Belanja', 'Kesehatan', 'Saham', 'Emas', 'Dana Darurat'],
      kategoriPemasukan: ['Gaji', 'Freelance', 'Bonus', 'Dividen', 'Lainnya'],
      kategoriGoal: ['Career', 'Health', 'Finance', 'Relationship', 'Spiritual', 'Learning'],
      tab: 'dashboard',
      snackbar: null,
      celebration: null,

      setTab: (tab) => set({ tab }),
      setPeriod: (period) => set({ period }),
      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      showSnackbar: (message, undo) => {
        set({ snackbar: { message, undo } })
        window.setTimeout(() => {
          if (get().snackbar?.message === message) set({ snackbar: null })
        }, 5000)
      },
      dismissSnackbar: () => set({ snackbar: null }),
      celebrate: (message) => {
        confetti()
        set({ celebration: message })
      },
      dismissCelebration: () => set({ celebration: null }),

      upsertHabit: (h) =>
        set((s) => ({
          habits: s.habits.some((x) => x.id === h.id)
            ? s.habits.map((x) => (x.id === h.id ? h : x))
            : [...s.habits, h],
        })),

      deleteHabit: (id) => {
        const prev = get().habits
        const victim = prev.find((h) => h.id === id)
        if (!victim) return
        set({ habits: prev.filter((h) => h.id !== id) })
        get().showSnackbar(`Habit "${victim.nama}" dihapus`, () =>
          set((s) => ({ habits: [...s.habits, victim], snackbar: null })),
        )
      },

      archiveHabit: (id, archived) =>
        set((s) => ({ habits: s.habits.map((h) => (h.id === id ? { ...h, archived } : h)) })),

      /** carry the habit into the current period: history kept, streak restarts */
      renewHabit: (id) =>
        set((s) => ({
          habits: s.habits.map((h) =>
            h.id === id ? { ...h, archived: false, createdAt: todayKey() } : h,
          ),
        })),

      toggleLog: (id, day) => {
        const today = todayKey()
        if (day > today) return
        let milestone = 0
        set((s) => ({
          habits: s.habits.map((h) => {
            if (h.id !== id) return h
            const log = { ...h.log }
            const stravaLog = { ...h.stravaLog }
            if (log[day]) {
              delete log[day]
              delete stravaLog[day]
            } else {
              log[day] = true
              const st = currentStreak({ ...h, log })
              const days = st.unit === 'hari' ? st.n : st.n * 7
              if (MILESTONES.includes(days)) milestone = days
            }
            return { ...h, log, stravaLog }
          }),
        }))
        if (milestone) {
          get().celebrate(`🔥 Streak ${milestone} hari! Kamu ${milestone >= 66 ? 'sudah membentuk habit ini' : 'makin dekat jadi 1% lebih baik'}.`)
        }
      },

      upsertTransaction: (t) =>
        set((s) => ({
          transactions: s.transactions.some((x) => x.id === t.id)
            ? s.transactions.map((x) => (x.id === t.id ? t : x))
            : [...s.transactions, t],
        })),

      deleteTransaction: (id) => {
        const victim = get().transactions.find((t) => t.id === id)
        if (!victim) return
        set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) }))
        get().showSnackbar('Transaksi dihapus', () =>
          set((s) => ({ transactions: [...s.transactions, victim], snackbar: null })),
        )
      },

      addKategori: (jenis, nama) =>
        set((s) =>
          jenis === 'pemasukan'
            ? { kategoriPemasukan: [...new Set([...s.kategoriPemasukan, nama])] }
            : { kategoriPengeluaran: [...new Set([...s.kategoriPengeluaran, nama])] },
        ),

      upsertGoal: (g) =>
        set((s) => ({
          goals: s.goals.some((x) => x.id === g.id)
            ? s.goals.map((x) => (x.id === g.id ? g : x))
            : [...s.goals, g],
        })),

      deleteGoal: (id) => {
        const victim = get().goals.find((g) => g.id === id)
        if (!victim) return
        set((s) => ({ goals: s.goals.filter((g) => g.id !== id) }))
        get().showSnackbar(`Goal "${victim.nama}" dihapus`, () =>
          set((s) => ({ goals: [...s.goals, victim], snackbar: null })),
        )
      },

      toggleKeyResult: (goalId, krId) => {
        let finished: Goal | null = null
        set((s) => ({
          goals: s.goals.map((g) => {
            if (g.id !== goalId) return g
            const keyResults = g.keyResults.map((kr) =>
              kr.id === krId ? { ...kr, done: !kr.done } : kr,
            )
            const allDone = keyResults.length > 0 && keyResults.every((kr) => kr.done)
            const status = allDone ? 'achieved' as const
              : keyResults.some((kr) => kr.done) ? 'in_progress' as const : 'not_started' as const
            const next: Goal = {
              ...g, keyResults, status,
              achievedAt: allDone ? todayKey() : undefined,
            }
            if (allDone && g.status !== 'achieved') finished = next
            return next
          }),
        }))
        if (finished !== null) get().celebrate(`🏆 Goal "${(finished as Goal).nama}" tercapai! Masuk Hall of Fame.`)
      },

      finishGoal: (goalId) => {
        const g = get().goals.find((x) => x.id === goalId)
        if (!g || g.status === 'achieved') return
        set((s) => ({
          goals: s.goals.map((x) =>
            x.id === goalId
              ? {
                  ...x,
                  status: 'achieved',
                  achievedAt: todayKey(),
                  keyResults: x.keyResults.map((kr) => ({ ...kr, done: true })),
                }
              : x,
          ),
        }))
        get().celebrate(`🏆 Goal "${g.nama}" tercapai! Masuk Hall of Fame.`)
      },

      /**
       * Demo Strava sync: fills recent activity days for sport habits.
       * (Real OAuth token exchange needs the backend — see README Roadmap.)
       */
      syncStrava: () => {
        let added = 0
        const today = todayKey()
        set((s) => ({
          habits: s.habits.map((h) => {
            if (!h.sport || h.archived) return h
            const log = { ...h.log }
            const stravaLog = { ...h.stravaLog }
            for (let i = 0; i < 21; i++) {
              const day = addDays(today, -i)
              // deterministic pseudo-activity pattern: ~3 activity days per week
              const seedNum = day.split('-').reduce((a, p) => a + parseInt(p, 10), 0) + h.id.length
              if (seedNum % 7 < 3 && !log[day]) {
                log[day] = true
                const km = (4 + (seedNum % 5) * 1.3).toFixed(1).replace('.', ',')
                const menit = 28 + (seedNum % 4) * 9
                stravaLog[day] = `${km} km · ${menit} mnt`
                added++
              }
            }
            return { ...h, log, stravaLog }
          }),
        }))
        return added
      },

      loadDemo: () => {
        const seed = buildSeed()
        set((s) => ({
          habits: seed.habits,
          transactions: seed.transactions,
          goals: seed.goals,
          settings: { ...s.settings, userName: s.settings.userName || 'Ata', onboarded: true },
        }))
      },

      resetAll: () =>
        set({
          habits: [], transactions: [], goals: [],
          settings: { ...DEFAULT_SETTINGS },
          period: { month: new Date().getMonth(), year: new Date().getFullYear() },
        }),
    }),
    {
      name: 'onepercent-v1',
      partialize: (s) => ({
        settings: s.settings,
        habits: s.habits,
        transactions: s.transactions,
        goals: s.goals,
        kategoriPengeluaran: s.kategoriPengeluaran,
        kategoriPemasukan: s.kategoriPemasukan,
        kategoriGoal: s.kategoriGoal,
      }),
    },
  ),
)

export type { Alloc, Transaction }
