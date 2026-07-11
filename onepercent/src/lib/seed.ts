import type { Goal, Habit, Transaction } from '../types'
import { addDays, fromKey, todayKey, toKey } from './date'
import { uid } from './format'

/** deterministic PRNG so the demo data is stable between reloads */
function mulberry32(a: number) {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const DAYS = 183 // ~6 months of history

export function buildSeed(): { habits: Habit[]; transactions: Transaction[]; goals: Goal[] } {
  const rand = mulberry32(20260710)
  const today = todayKey()
  const start = addDays(today, -(DAYS - 1))

  // ---- Habits: consistency improves over time (the 1% story) ----
  const defs: Array<Partial<Habit> & { nama: string; baseP: number; gainP: number }> = [
    { nama: 'Lari Pagi', frekuensi: { type: 'mingguan', kali: 4 }, waktuEksekusi: '05:30', icon: '🏃', color: '#eb6834', sport: true, baseP: 0.5, gainP: 0.35 },
    { nama: 'Baca Buku 20 Menit', frekuensi: { type: 'harian' }, waktuEksekusi: '21:00', icon: '📚', color: '#3987e5', baseP: 0.55, gainP: 0.3 },
    { nama: 'Meditasi', frekuensi: { type: 'harian' }, waktuEksekusi: '06:15', icon: '🧘', color: '#9085e9', baseP: 0.45, gainP: 0.35 },
    { nama: 'Belajar Bahasa Inggris', frekuensi: { type: 'mingguan', kali: 5 }, waktuEksekusi: '19:30', icon: '🗣️', color: '#1baf7a', baseP: 0.5, gainP: 0.3 },
    { nama: 'Bebas Rokok', kind: 'break', frekuensi: { type: 'harian' }, waktuEksekusi: '08:00', icon: '🚭', color: '#e34948', baseP: 0.6, gainP: 0.38 },
  ]

  const habits: Habit[] = defs.map((d) => {
    const log: Record<string, true> = {}
    for (let i = 0; i < DAYS; i++) {
      const day = addDays(start, i)
      const progress = i / DAYS
      const p = Math.min(0.97, d.baseP + d.gainP * progress)
      const weeklyCap = d.frekuensi!.type === 'mingguan' ? d.frekuensi!.kali / 7 + 0.12 : 1
      if (rand() < p * Math.min(1, weeklyCap * 1.6)) log[day] = true
    }
    return {
      id: uid(),
      nama: d.nama,
      frekuensi: d.frekuensi ?? { type: 'harian' },
      waktuEksekusi: d.waktuEksekusi ?? '07:00',
      kind: d.kind ?? 'build',
      icon: d.icon ?? '✨',
      color: d.color ?? '#eb6834',
      sport: d.sport ?? false,
      reminder: true,
      cue: d.nama === 'Lari Pagi' ? 'Alarm 05:20, sepatu sudah di depan pintu' : 'Setelah rutinitas sebelumnya',
      routine: d.nama,
      reward: d.nama === 'Bebas Rokok' ? 'Tabungan rokok masuk Investasi' : 'Centang hijau + kopi enak',
      createdAt: start,
      archived: false,
      log,
      stravaLog: {},
    }
  })

  // ---- Transactions: ~6 months of realistic cashflow (Rupiah) ----
  const transactions: Transaction[] = []
  const startDate = fromKey(start)
  const endDate = fromKey(today)
  const push = (t: Omit<Transaction, 'id'>) => transactions.push({ id: uid(), ...t })

  for (let m = new Date(startDate.getFullYear(), startDate.getMonth(), 1); m <= endDate; m.setMonth(m.getMonth() + 1)) {
    const y = m.getFullYear()
    const mo = m.getMonth()
    const day = (d: number) => toKey(new Date(y, mo, d))
    const inMonth = (d: number) => new Date(y, mo, d) >= startDate && new Date(y, mo, d) <= endDate

    if (inMonth(1)) push({ tanggal: day(1), nominal: 8_500_000, jenis: 'pemasukan', kategori: 'Gaji', catatan: 'Gaji bulanan' })
    if (rand() < 0.6 && inMonth(15)) push({ tanggal: day(15), nominal: Math.round((1 + rand() * 2.5) * 500_000), jenis: 'pemasukan', kategori: 'Freelance', catatan: 'Proyek sampingan' })

    if (inMonth(2)) push({ tanggal: day(2), nominal: 1_800_000, jenis: 'pengeluaran', alokasi: 'kebutuhan', kategori: 'Kos/Sewa', catatan: 'Sewa kos' })
    if (inMonth(3)) push({ tanggal: day(3), nominal: 350_000, jenis: 'pengeluaran', alokasi: 'kebutuhan', kategori: 'Internet', catatan: 'Paket data + wifi' })
    if (inMonth(5)) push({ tanggal: day(5), nominal: 1_000_000, jenis: 'pengeluaran', alokasi: 'investasi', kategori: 'Saham', catatan: 'DCA bulanan' })
    if (inMonth(6)) push({ tanggal: day(6), nominal: 500_000, jenis: 'pengeluaran', alokasi: 'investasi', kategori: 'Dana Darurat', catatan: 'Auto-transfer' })

    const nFood = 8 + Math.floor(rand() * 5)
    for (let i = 0; i < nFood; i++) {
      const d = 1 + Math.floor(rand() * 28)
      if (!inMonth(d)) continue
      push({ tanggal: day(d), nominal: Math.round((15 + rand() * 60) * 1000), jenis: 'pengeluaran', alokasi: 'kebutuhan', kategori: 'Makanan', catatan: rand() < 0.5 ? 'Makan siang' : 'Belanja dapur' })
    }
    for (let i = 0; i < 4; i++) {
      const d = 2 + Math.floor(rand() * 26)
      if (!inMonth(d)) continue
      push({ tanggal: day(d), nominal: Math.round((20 + rand() * 40) * 1000), jenis: 'pengeluaran', alokasi: 'kebutuhan', kategori: 'Transport', catatan: 'Bensin/ojek' })
    }
    const nWants = 3 + Math.floor(rand() * 4)
    for (let i = 0; i < nWants; i++) {
      const d = 3 + Math.floor(rand() * 25)
      if (!inMonth(d)) continue
      const wants: Array<[string, string, number]> = [
        ['Hiburan', 'Nonton + kopi', 85],
        ['Belanja', 'Baju/gadget kecil', 220],
        ['Hiburan', 'Langganan streaming', 55],
        ['Belanja', 'Jajan online', 120],
      ]
      const [kategori, catatan, base] = wants[Math.floor(rand() * wants.length)]
      push({ tanggal: day(d), nominal: Math.round(base * 1000 * (0.6 + rand())), jenis: 'pengeluaran', alokasi: 'keinginan', kategori, catatan })
    }
  }

  // ---- Goals across all horizons ----
  const g = (
    nama: string, horizon: Goal['horizon'], dueInDays: number, kategori: string,
    krs: Array<[string, boolean]>, achieved = false,
  ): Goal => {
    const keyResults = krs.map(([label, done]) => ({ id: uid(), label, done: achieved ? true : done }))
    const someDone = keyResults.some((kr) => kr.done)
    return {
      id: uid(),
      nama,
      horizon,
      tenggatWaktu: addDays(today, dueInDays),
      kategori,
      status: achieved ? 'achieved' : someDone ? 'in_progress' : 'not_started',
      keyResults,
      achievedAt: achieved ? addDays(today, -12) : undefined,
    }
  }

  const goals: Goal[] = [
    g('Selesaikan review mingguan', 'weekly', 4, 'Career', [['Tulis refleksi minggu ini', true], ['Rencanakan minggu depan', false]]),
    g('Lari total 60 km bulan ini', 'weekly', 6, 'Health', [['Minggu 1: 15 km', true], ['Minggu 2: 15 km', true], ['Minggu 3: 15 km', false], ['Minggu 4: 15 km', false]]),
    g('Baca 2 buku', 'monthly', 20, 'Learning', [['Atomic Habits (ulang)', true], ['Psychology of Money', false]]),
    g('Nett cashflow positif 3 bulan beruntun', 'quarterly', 80, 'Finance', [['Bulan 1 surplus', true], ['Bulan 2 surplus', true], ['Bulan 3 surplus', false]]),
    g('Half marathon pertama', 'yearly', 200, 'Health', [['Rutin lari 4x seminggu', true], ['10K di bawah 65 menit', false], ['Daftar event HM', false]]),
    g('Dana darurat Rp30 juta', 'yearly', 320, 'Finance', [['Rp10 jt', true], ['Rp20 jt', false], ['Rp30 jt', false]]),
    g('DP rumah pertama', '5y', 1600, 'Finance', [['Investasi rutin Rp1,5 jt/bln', true], ['Portofolio Rp150 jt', false], ['Survey lokasi', false]]),
    g('Karier: lead engineer', '5y', 1400, 'Career', [['Mentor 2 junior', false], ['Sertifikasi arsitektur', false]]),
    g('Passive income 50% biaya hidup', '10y', 3400, 'Finance', [['Dividen Rp500 rb/bln', false], ['Aset produktif kedua', false]]),
    g('Pensiun dini + yayasan belajar', '20y', 7200, 'Spiritual', [['Rencana tertulis', true], ['Aset pensiun 25x pengeluaran', false]]),
    g('Konsisten olahraga 30 hari', 'monthly', -12, 'Health', [['30 hari beruntun', true]], true),
    g('Lunasi cicilan gadget', 'quarterly', -30, 'Finance', [['Cicilan lunas', true]], true),
  ]

  return { habits, transactions, goals }
}
