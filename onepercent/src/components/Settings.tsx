import { useState } from 'react'
import { useStore } from '../store'
import { requestPermission } from '../lib/notify'
import { Modal, Switch } from './ui'

export function Settings({ onClose }: { onClose: () => void }) {
  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  const syncStrava = useStore((s) => s.syncStrava)
  const loadDemo = useStore((s) => s.loadDemo)
  const resetAll = useStore((s) => s.resetAll)
  const showSnackbar = useStore((s) => s.showSnackbar)
  const [ratio, setRatio] = useState(settings.targetRatio)

  const saveRatio = (patch: Partial<typeof ratio>) => {
    const next = { ...ratio, ...patch }
    setRatio(next)
    if (next.kebutuhan + next.keinginan + next.investasi === 100) {
      setSettings({ targetRatio: next })
    }
  }
  const ratioSum = ratio.kebutuhan + ratio.keinginan + ratio.investasi

  return (
    <Modal title="Pengaturan" onClose={onClose}>
      <div className="field">
        <label>Nama kamu</label>
        <input
          value={settings.userName}
          placeholder="cth. Ata"
          onChange={(e) => setSettings({ userName: e.target.value })}
        />
      </div>

      <div className="section-title">Tampilan <span className="line" /></div>
      <div className="setting-row">
        <span style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>🌙 Mode gelap</span>
        <Switch on={settings.theme === 'dark'} onChange={(v) => setSettings({ theme: v ? 'dark' : 'light' })} />
      </div>

      <div className="section-title">Alarm & Pengingat <span className="line" /></div>
      <div className="setting-row">
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>⏰ Notifikasi habit</div>
          <div className="muted">Pengingat di Waktu Eksekusi tiap habit</div>
        </div>
        <Switch
          on={settings.remindersEnabled}
          onChange={async (v) => {
            if (v) {
              const ok = await requestPermission()
              setSettings({ remindersEnabled: ok })
              showSnackbar(ok ? 'Pengingat aktif! ⏰' : 'Izin notifikasi ditolak browser')
            } else setSettings({ remindersEnabled: false })
          }}
        />
      </div>
      <div className="setting-row">
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>🌙 Ringkasan malam (20:00)</div>
          <div className="muted">"X habit belum di-log hari ini"</div>
        </div>
        <Switch on={settings.eveningSummary} onChange={(v) => setSettings({ eveningSummary: v })} />
      </div>
      <div className="muted" style={{ margin: '8px 2px' }}>
        Notifikasi berbunyi selama aplikasi/PWA terbuka. Push saat aplikasi tertutup butuh server push — ada di roadmap.
      </div>

      <div className="section-title">Target Alokasi (Needs/Wants/Invest) <span className="line" /></div>
      <div className="row" style={{ gap: 8 }}>
        {(['kebutuhan', 'keinginan', 'investasi'] as const).map((k) => (
          <div className="field" style={{ flex: 1 }} key={k}>
            <label style={{ textTransform: 'capitalize' }}>{k} %</label>
            <input
              type="number" min={0} max={100} value={ratio[k]}
              onChange={(e) => saveRatio({ [k]: Number(e.target.value) } as Partial<typeof ratio>)}
            />
          </div>
        ))}
      </div>
      <div className="muted" style={{ marginTop: -6, marginBottom: 8, color: ratioSum === 100 ? 'var(--good)' : 'var(--critical)' }}>
        Total: {ratioSum}% {ratioSum === 100 ? '✓ tersimpan' : '— harus 100% agar tersimpan'}
      </div>

      <div className="section-title">Integrasi <span className="line" /></div>

      <div className="card" style={{ marginBottom: 10 }}>
        <div className="spread">
          <div>
            <div style={{ fontWeight: 800 }}>🟠 Strava</div>
            <div className="muted">Auto-log habit olahraga dari aktivitas larimu</div>
          </div>
          <Switch
            on={settings.stravaConnected}
            onChange={(v) => {
              setSettings({ stravaConnected: v })
              if (v) {
                const n = syncStrava()
                showSnackbar(`Strava terhubung (demo) — ${n} hari aktivitas disinkronkan 🟠`)
              }
            }}
          />
        </div>
        {settings.stravaConnected && (
          <button
            className="btn sm ghost block"
            style={{ marginTop: 10 }}
            onClick={() => showSnackbar(`Sinkron selesai — ${syncStrava()} hari baru dari Strava`)}
          >
            🔄 Sinkronkan sekarang
          </button>
        )}
        <div className="muted" style={{ marginTop: 8 }}>
          Mode demo: mensimulasikan aktivitas Strava. OAuth asli butuh backend + API key (lihat README).
        </div>
      </div>

      <div className="card">
        <div className="spread">
          <div>
            <div style={{ fontWeight: 800 }}>📅 Google Calendar</div>
            <div className="muted">Tampilkan acara hari ini di Dashboard</div>
          </div>
          <Switch
            on={settings.calendarConnected}
            onChange={(v) => {
              setSettings({ calendarConnected: v })
              if (v) showSnackbar('Calendar terhubung (demo) — acara hari ini tampil di Dashboard 📅')
            }}
          />
        </div>
        <div className="muted" style={{ marginTop: 8 }}>
          Mode demo: acara contoh. OAuth asli butuh Google Cloud credential (lihat README).
        </div>
      </div>

      <div className="section-title">Data <span className="line" /></div>
      <button className="btn block" onClick={() => { loadDemo(); showSnackbar('Data demo 6 bulan dimuat 🎉'); onClose() }}>
        🎬 Muat data demo (6 bulan)
      </button>
      <button
        className="btn danger block"
        style={{ marginTop: 10 }}
        onClick={() => {
          if (window.confirm('Hapus SEMUA data (habit, transaksi, goal)? Tidak bisa dibatalkan.')) {
            resetAll()
            onClose()
          }
        }}
      >
        🗑️ Hapus semua data
      </button>
      <div className="muted" style={{ marginTop: 12, textAlign: 'center' }}>
        OnePercent v0.1 · data tersimpan di perangkatmu (offline-first)
      </div>
    </Modal>
  )
}
