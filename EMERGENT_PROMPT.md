# Emergent Prompt — "OnePercent" Life Routine Tracker (Mobile App)

Copy everything inside the block below and paste it as your first message in
[Emergent](https://emergent.sh). After the first build, use the follow-up
prompts at the bottom of this file to iterate.

---

```
Build a cross-platform MOBILE APP (installable on Android & iOS, phone-first UI,
also usable as a responsive web app) called "OnePercent — Life Routine Tracker".

MISSION
The app helps a person get 1% better every day: replace bad habits with good
ones, track money consciously, and connect daily actions to 20-year goals.
It must be production-ready and able to scale to 10,000+ registered users, so
include real user accounts (email + Google sign-in), a cloud database where
every user's data is private to them, and fast load times.

The app has 4 areas reachable from a bottom tab bar:
Dashboard · Habits · Expenses · Goals.

=====================================================================
GLOBAL RULES (apply everywhere)
=====================================================================
1. Every screen has a period selector: a month picker (Jan–Desember) plus a
   year picker. Changing it filters everything on screen to that month/year.
   The habit year view can show the entire year at once.
2. Cancel convention: every input form and dialog can be cancelled either by
   tapping a Cancel/X button OR by typing the letter "X" in the input field —
   typing "X" instantly discards the entry and closes the form. Confirm before
   discarding non-empty forms.
3. UI labels use Bahasa Indonesia exactly as specified below (Nama Habit,
   Frekuensi, Pemasukan, Pengeluaran, etc.). Currency is Indonesian Rupiah,
   formatted like "Rp1.250.000". Dates use DD/MM/YYYY.
4. All data auto-saves instantly; every list supports add, edit, and delete
   with an undo snackbar.

=====================================================================
MODULE 1 — HABIT TRACKER
=====================================================================
Purpose: a full-year habit tracker (Januari–Desember) inspired by an annual
habit-tracking spreadsheet, but interactive and beautiful.

Data model — each habit has:
- Nama Habit (name)
- Frekuensi (frequency: Harian, 4x seminggu, 3x seminggu, Mingguan, or custom
  X times per week)
- Waktu Eksekusi (execution time of day, e.g. 05:30 — used for reminders)
- Streak Saat Ini (current streak, auto-calculated; also show best streak)
- Log Harian (daily log: one check per day, tappable)
- Type: Good habit to build, or Bad habit to break (breaking = logging a
  "clean day")
- Optional link to a Goal (see Module 3) and an icon + color per habit.

Required features:
1. YEAR VIEW: a full Jan–Desember grid for the selected year — rows are
   habits, columns are days grouped by month — like a wall-calendar heatmap.
   Filled cells use the habit's color; scrolling and pinch-zoom must feel
   smooth on a phone. Tapping any day toggles that day's log.
2. PROGRESS CHART: a line chart of day-by-day progress — % of scheduled
   habits completed each day — with 7-day moving average, viewable per month
   and for the whole year. Overlay a dotted "1% better every day" compound
   reference curve (1.01^day) so users can race their theoretical self.
3. NEW-HABIT DIAGRAM: when creating a habit, show a visual habit-loop diagram
   (Cue → Routine → Reward) the user fills in, plus a 21-day / 66-day
   formation progress ring that fills as they log days.
4. Habits are fully editable: change, add, archive, delete, and "renew" — a
   one-tap action that carries a habit into a new month/year with its streak
   history preserved but progress reset.
5. MONTHLY PERCENTAGE: for the selected month, each habit shows a completion
   percentage (days done ÷ days scheduled by its Frekuensi) as an animated
   progress ring, plus an overall month score for all habits combined.
6. Streak logic: streaks count only scheduled days (a 4x-per-week habit is
   not broken by an off day). Celebrate milestones (7, 21, 30, 66, 100, 365
   days) with a confetti animation.

=====================================================================
MODULE 2 — EXPENSE TRACKER
=====================================================================
Purpose: conscious cashflow tracking with the Needs/Wants/Invest method.

Data model — each transaction has:
- Tanggal (date)
- Nominal (amount in Rupiah — numeric input with automatic thousand
  separators)
- Jenis: Pemasukan (income) or Pengeluaran (expense)
- For Pengeluaran, a Jenis Alokasi: Kebutuhan (Needs), Keinginan (Wants), or
  Investasi (Invest)
- Kategori (user-manageable category list, e.g. Makanan, Transport, Gaji,
  Saham)
- Catatan/Deskripsi (note)

Required features:
1. Quick-add entry form (2 taps from anywhere via a floating + button):
   choose Pemasukan or Pengeluaran, type the Nominal, pick
   Kebutuhan/Keinginan/Investasi (for Pengeluaran), Kategori, Tanggal
   defaulting to today, optional Catatan. Typing "X" cancels.
2. For the selected month always display three headline stat cards with
   animated counting numbers: Total Pemasukan, Total Pengeluaran, and Nett
   Cashflow (Pemasukan − Pengeluaran; green when positive, red when
   negative).
3. RECAP with charts:
   - Donut chart splitting Pengeluaran into Kebutuhan / Keinginan / Investasi
     with percentages, compared against a user-configurable target ratio
     (default 50/30/20) — show whether they're over or under each bucket.
   - Bar or line chart of Pemasukan vs Pengeluaran across the months of the
     selected year.
   - Category breakdown list sorted by amount.
4. Transaction history for the month: filterable by Jenis, Alokasi, and
   Kategori; searchable; swipe to edit or delete.

=====================================================================
MODULE 3 — GOALS TRACKER
=====================================================================
Purpose: connect today's habits to a 20-year vision.

Data model — each goal has:
- Nama Goal (name)
- Horizon: Weekly, Monthly, Quarterly, Yearly, 5 Years, 10 Years, or 20 Years
- Tenggat Waktu (deadline date)
- Kategori (Career, Health, Finance, Relationship, Spiritual, Learning —
  user-extensible)
- Status: Not Started, In Progress, Achieved
- Key Results: a checklist of 1–5 measurable key results, each with its own
  progress; goal progress % = average of its key results.

Required features:
1. A horizon timeline view: horizontally swipeable sections from Weekly out
   to 20 Years, so users literally scroll from "this week" into their future.
   Each section lists its goals as cards with progress bars, Kategori color
   tag, Tenggat Waktu countdown ("21 hari lagi"), and Status badge.
2. Add/edit goals with the same "X to cancel" convention.
3. Finishing: checking the last key result (or a "Selesaikan" button) marks
   the goal Achieved with a full-screen celebration animation; achieved goals
   move to a trophy-room "Hall of Fame" screen.
4. Goals can be linked to habits (Module 1) and a savings target (Module 2 —
   Investasi transactions can count toward a Finance goal's progress).
5. Overdue goals (past Tenggat Waktu, not Achieved) get a gentle red
   highlight and appear in the Dashboard nudge section.

=====================================================================
INTEGRATIONS (make each one work, with graceful fallback if not connected)
=====================================================================
1. ALARM / REMINDERS: schedule real device notifications (push/local
   notifications, with permission prompt) at each habit's Waktu Eksekusi:
   "Waktunya {Nama Habit}! 🔥 Streak kamu: {n} hari". Include a daily
   evening summary reminder ("3 habit belum di-log hari ini") and optional
   weekly finance recap notification. Users control all reminders per habit
   in Settings.
2. CALENDAR (Google Calendar): OAuth connect in Settings. Two-way value:
   (a) create recurring calendar events for each habit at its Waktu
   Eksekusi and events for every goal's Tenggat Waktu; (b) show today's
   calendar events on the Dashboard so users plan habits around real
   schedules. Handle disconnect/reconnect cleanly.
3. STRAVA: OAuth connect in Settings. After connecting, fetch the user's
   activities via the Strava API and AUTO-COMPLETE any habit the user has
   marked as "sport habit" (e.g. Lari, Sepeda, Gym) on days a matching
   activity exists — show a small Strava badge on auto-logged days and the
   activity's distance/time in the day detail. Sync on app open and via a
   manual refresh button. If Strava isn't connected, sport habits just work
   manually.
Store all API keys/secrets server-side in environment variables, never in
client code.

=====================================================================
DASHBOARD (home tab)
=====================================================================
- Greeting with the user's name and today's date.
- "1% Better" hero card: an animated compound-growth curve showing that 1%
  daily improvement = 37x in a year, with a marker for the user's current
  day-of-year and their actual consistency score.
- Today's habit checklist (tap to log, with Waktu Eksekusi times and
  today's calendar events interleaved).
- This month's Nett Cashflow mini-card and habit completion % ring.
- Nearest goal deadlines and any overdue-goal nudges.
- A motivational streak flame showing total consecutive days the user logged
  anything.

=====================================================================
DESIGN DIRECTION
=====================================================================
- Wonderful, creative, and absolutely NOT boring: this should feel like a
  premium, joyful product, not a spreadsheet.
- Powerful color: a vibrant gradient-driven palette (e.g. deep indigo/violet
  base with electric coral, lime, and cyan accents), full dark mode and light
  mode. Each module gets a signature accent: Habits = warm orange/coral,
  Expenses = emerald/teal, Goals = violet/indigo.
- Animation everywhere it adds delight, never where it slows the user down:
  smooth page transitions, spring micro-interactions on taps, progress rings
  that animate on load, numbers that count up, confetti on streak milestones
  and achieved goals, a satisfying checkmark burst when logging a habit.
  Keep everything at 60fps on mid-range phones.
- Big rounded cards, soft glows/shadows, bold friendly typography (large
  numbers for stats), and playful empty states with illustrations and a
  clear call-to-action ("Belum ada habit — ayo mulai jadi 1% lebih baik!").
- Onboarding: a 3-screen animated intro explaining the 1% philosophy, then
  guide the user to create their first habit, first goal, and set their
  monthly budget.

=====================================================================
QUALITY BAR
=====================================================================
- All charts interactive (tap a point/slice for details) and animated.
- Empty, loading, and error states designed for every screen.
- Works offline for logging; syncs when back online.
- Seed a demo account/mode with 6 months of realistic sample data so every
  chart and screen looks alive on first run.
Start by building the full app structure with all four tabs working end to
end with local data + auth, then wire up notifications, Google Calendar, and
Strava.
```

---

## Follow-up prompts for iterating in Emergent

Use these one at a time after the first build, in order of importance:

1. **Test the core loop first:**
   "Create a habit 'Lari Pagi' (Frekuensi: 4x seminggu, Waktu Eksekusi 05:30),
   log 10 days, and show me the year view, the monthly percentage ring, and
   the day-by-day progress line chart. Fix anything that looks wrong."
2. **Strava:** "Connect Strava via OAuth now. Use my API credentials (I'll
   paste Client ID/Secret into the env settings). Auto-complete the 'Lari
   Pagi' habit from real activities and show the Strava badge on those days."
3. **Calendar:** "Enable Google Calendar OAuth. Create recurring events for
   my habits and deadline events for my goals, and show today's events on
   the Dashboard."
4. **Alarms:** "Make the habit reminders fire as real device notifications at
   each Waktu Eksekusi, plus the 20:00 evening summary. Let me toggle them
   per habit in Settings."
5. **Polish pass:** "Do a design polish pass: stronger gradients, springier
   micro-animations, confetti on the 7-day streak, and make the Dashboard
   hero card feel spectacular. Nothing may feel boring or spreadsheet-like."
6. **Scale check:** "Review the backend for 10k users: add proper indexes,
   per-user data isolation, and rate limiting on the Strava/Calendar sync."

## Notes

- The three reference spreadsheets (habit, expense, goals) are private Google
  Sheets — Emergent can't open them, which is why every column and rule from
  them is written out explicitly in the prompt above. If you can, export each
  sheet as CSV/screenshot and attach them in Emergent for extra fidelity.
- Two spelling fixes were applied on purpose: "Jenis Lokasi" → **Jenis
  Alokasi** (Needs/Wants/Invest allocation) and "Archieved" → **Achieved**.
  If you really meant something else, adjust those lines before pasting.
- Strava and Google Calendar need developer credentials (free): create an app
  at https://www.strava.com/settings/api and a Google Cloud OAuth client with
  the Calendar API enabled, then paste the keys into Emergent's environment
  settings when it asks.
