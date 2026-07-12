import { useState } from 'react'
import { useStore } from '../store'
import { Icon } from './ui'

const SLIDES = [
  {
    icon: 'trending',
    title: '1% lebih baik setiap hari',
    body: '1,01 pangkat 365 = 37,8. Perbaikan kecil yang konsisten mengalahkan perubahan besar yang sesekali.',
  },
  {
    icon: 'repeat',
    title: 'Tukar kebiasaan buruk dengan yang baik',
    body: 'Lacak habit sepanjang Januari–Desember, jaga streak, dan lihat grafik progresmu naik hari demi hari.',
  },
  {
    icon: 'target',
    title: 'Uang & goals ikut terarah',
    body: 'Catat cashflow dengan metode Needs/Wants/Invest dan hubungkan aksi harian ke goal 20 tahunmu.',
  },
]

export function Onboarding() {
  const setSettings = useStore((s) => s.setSettings)
  const loadDemo = useStore((s) => s.loadDemo)
  const [step, setStep] = useState(0)
  const [nama, setNama] = useState('')

  const last = step === SLIDES.length

  return (
    <div className="onboard">
      {!last ? (
        <>
          <div className="art" style={{ color: 'var(--habits)' }}>
            <Icon name={SLIDES[step].icon} size={64} strokeWidth={1.4} />
          </div>
          <h1>{SLIDES[step].title}</h1>
          <p>{SLIDES[step].body}</p>
          <div className="dots">
            {SLIDES.map((_, i) => <span key={i} className={i === step ? 'on' : ''} />)}
            <span className={last ? 'on' : ''} />
          </div>
          <div className="foot">
            <button className="btn primary block" onClick={() => setStep(step + 1)}>
              {step === SLIDES.length - 1 ? 'Siap mulai' : 'Lanjut'}
            </button>
            <button className="btn ghost block" onClick={() => setStep(SLIDES.length)}>Lewati</button>
          </div>
        </>
      ) : (
        <>
          <div className="art" style={{ color: 'var(--habits)' }}>
            <Icon name="pulse" size={64} strokeWidth={1.4} />
          </div>
          <h1>Siapa nama kamu?</h1>
          <p>Biar sapaan pagimu terasa personal.</p>
          <div className="field" style={{ marginTop: 22 }}>
            <input
              placeholder="Nama panggilan"
              value={nama}
              autoFocus
              onChange={(e) => setNama(e.target.value)}
              style={{ textAlign: 'center', fontSize: 18, fontWeight: 600 }}
            />
          </div>
          <div className="foot">
            <button
              className="btn primary block"
              disabled={!nama.trim()}
              style={{ opacity: nama.trim() ? 1 : 0.5 }}
              onClick={() => setSettings({ userName: nama.trim(), onboarded: true })}
            >
              Mulai dari nol
            </button>
            <button
              className="btn block"
              onClick={() => {
                if (nama.trim()) setSettings({ userName: nama.trim() })
                loadDemo()
              }}
            >
              Coba dengan data contoh 6 bulan
            </button>
          </div>
        </>
      )}
    </div>
  )
}
