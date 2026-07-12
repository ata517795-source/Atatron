import { useEffect, useState } from 'react'
import { useStore, type Tab } from './store'
import { scheduleToday } from './lib/notify'
import { Dashboard } from './components/Dashboard'
import { Habits } from './components/Habits'
import { Expenses } from './components/Expenses'
import { Goals } from './components/Goals'
import { Settings } from './components/Settings'
import { Onboarding } from './components/Onboarding'
import { Celebration, Icon, Snackbar } from './components/ui'

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'dashboard', label: 'Beranda', icon: 'pulse' },
  { id: 'habits', label: 'Habits', icon: 'flame' },
  { id: 'expenses', label: 'Cashflow', icon: 'wallet' },
  { id: 'goals', label: 'Goals', icon: 'target' },
]

export default function App() {
  const tab = useStore((s) => s.tab)
  const setTab = useStore((s) => s.setTab)
  const settings = useStore((s) => s.settings)
  const habits = useStore((s) => s.habits)
  const syncStrava = useStore((s) => s.syncStrava)
  const [showSettings, setShowSettings] = useState(false)

  // theme
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme
  }, [settings.theme])

  // reminders for today (re-planned whenever logs/toggles change)
  useEffect(() => {
    if (settings.remindersEnabled) scheduleToday(habits, settings.eveningSummary)
  }, [habits, settings.remindersEnabled, settings.eveningSummary])

  // Strava sync on app open
  useEffect(() => {
    if (settings.stravaConnected) syncStrava()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!settings.onboarded) return <Onboarding />

  return (
    <>
      <header className="app-header">
        <div className="app-title">
          <span className="logo">1%</span>
          OnePercent
        </div>
        <div className="header-spacer" />
        <button className="icon-btn" onClick={() => setShowSettings(true)} aria-label="Pengaturan">
          <Icon name="sliders" size={19} />
        </button>
      </header>

      <main className="main" key={tab}>
        {tab === 'dashboard' && <Dashboard />}
        {tab === 'habits' && <Habits />}
        {tab === 'expenses' && <Expenses />}
        {tab === 'goals' && <Goals />}
      </main>

      <nav className="tabbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'active' : ''}
            onClick={() => setTab(t.id)}
          >
            <span className="ticon"><Icon name={t.icon} size={21} strokeWidth={tab === t.id ? 2 : 1.7} /></span>
            {t.label}
          </button>
        ))}
      </nav>

      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
      <Snackbar />
      <Celebration />
    </>
  )
}
