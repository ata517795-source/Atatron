import type { Habit } from '../types'
import { todayKey } from './date'

/**
 * In-app reminder scheduling with the Web Notifications API.
 * Fires while the app (or installed PWA) is open; true closed-app push needs
 * a push server — see README "Roadmap".
 */
let timers: number[] = []

export async function requestPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  const res = await Notification.requestPermission()
  return res === 'granted'
}

function show(title: string, body: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  try {
    new Notification(title, { body, icon: '/icon-192.png' })
  } catch {
    /* some platforms require a service-worker notification; ignore */
  }
}

export function scheduleToday(habits: Habit[], eveningSummary: boolean): void {
  timers.forEach(clearTimeout)
  timers = []
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  const now = new Date()
  const today = todayKey()

  for (const h of habits) {
    if (h.archived || !h.reminder || h.log[today]) continue
    const [hh, mm] = h.waktuEksekusi.split(':').map(Number)
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm)
    const delay = at.getTime() - now.getTime()
    if (delay > 0 && delay < 86400000) {
      const streak = Object.keys(h.log).length
      timers.push(
        window.setTimeout(
          () => show(`Waktunya ${h.nama}`, `Streak kamu: ${streak} hari. Jangan putus hari ini.`),
          delay,
        ),
      )
    }
  }

  if (eveningSummary) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0)
    const delay = at.getTime() - now.getTime()
    if (delay > 0) {
      timers.push(
        window.setTimeout(() => {
          const pending = habits.filter((h) => !h.archived && !h.log[todayKey()]).length
          if (pending > 0) show('Ringkasan malam', `${pending} habit belum di-log hari ini.`)
        }, delay),
      )
    }
  }
}
