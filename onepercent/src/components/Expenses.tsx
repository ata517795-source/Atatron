import { useMemo, useState } from 'react'
import { useStore } from '../store'
import type { Alloc, Transaction } from '../types'
import { BULAN, BULAN_PENDEK, formatTanggal, todayKey } from '../lib/date'
import { formatNominalInput, parseNominal, rupiah, rupiahPendek, uid } from '../lib/format'
import { CountUp, Empty, Icon, Modal, PeriodSelector, xCancel } from './ui'
import { Donut, GroupedBars } from './charts'

const ACCENT = 'var(--expenses)'
const ALLOC_META: Record<Alloc, { label: string; en: string; color: string }> = {
  kebutuhan: { label: 'Kebutuhan', en: 'Needs', color: 'var(--series-blue)' },
  keinginan: { label: 'Keinginan', en: 'Wants', color: 'var(--series-yellow)' },
  investasi: { label: 'Investasi', en: 'Invest', color: 'var(--series-aqua)' },
}

export function Expenses() {
  const transactions = useStore((s) => s.transactions)
  const period = useStore((s) => s.period)
  const targetRatio = useStore((s) => s.settings.targetRatio)
  const [editing, setEditing] = useState<Transaction | 'new' | null>(null)
  const [fJenis, setFJenis] = useState<'semua' | 'pemasukan' | 'pengeluaran'>('semua')
  const [fAlloc, setFAlloc] = useState<Alloc | 'semua'>('semua')
  const [search, setSearch] = useState('')

  const monthKey = `${period.year}-${String(period.month + 1).padStart(2, '0')}`
  const monthTx = useMemo(
    () => transactions.filter((t) => t.tanggal.startsWith(monthKey)).sort((a, b) => b.tanggal.localeCompare(a.tanggal)),
    [transactions, monthKey],
  )

  const totalPemasukan = monthTx.filter((t) => t.jenis === 'pemasukan').reduce((a, t) => a + t.nominal, 0)
  const totalPengeluaran = monthTx.filter((t) => t.jenis === 'pengeluaran').reduce((a, t) => a + t.nominal, 0)
  const nett = totalPemasukan - totalPengeluaran

  const byAlloc = (a: Alloc) =>
    monthTx.filter((t) => t.jenis === 'pengeluaran' && t.alokasi === a).reduce((x, t) => x + t.nominal, 0)
  const allocData = (['kebutuhan', 'keinginan', 'investasi'] as Alloc[]).map((a) => {
    const value = byAlloc(a)
    const pct = totalPengeluaran ? (value / totalPengeluaran) * 100 : 0
    const target = targetRatio[a]
    const diff = Math.round(pct - target)
    return {
      label: `${ALLOC_META[a].label} (${ALLOC_META[a].en})`,
      value,
      color: ALLOC_META[a].color,
      note: `target ${target}% · ${diff === 0 ? 'tepat' : diff > 0 ? `lebih ${diff}%` : `hemat ${-diff}%`}`,
    }
  })

  const yearly = useMemo(() => {
    const inA = Array(12).fill(0)
    const outA = Array(12).fill(0)
    for (const t of transactions) {
      const [y, m] = t.tanggal.split('-').map(Number)
      if (y !== period.year) continue
      if (t.jenis === 'pemasukan') inA[m - 1] += t.nominal
      else outA[m - 1] += t.nominal
    }
    return { inA, outA }
  }, [transactions, period.year])

  const byKategori = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of monthTx) {
      if (t.jenis !== 'pengeluaran') continue
      map.set(t.kategori, (map.get(t.kategori) ?? 0) + t.nominal)
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [monthTx])

  const filtered = monthTx.filter((t) => {
    if (fJenis !== 'semua' && t.jenis !== fJenis) return false
    if (fAlloc !== 'semua' && t.alokasi !== fAlloc) return false
    if (search && !`${t.kategori} ${t.catatan}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div style={{ ['--accent' as string]: ACCENT }}>
      <PeriodSelector accent={ACCENT} />

      <div className="stat-grid" style={{ marginBottom: 14 }}>
        <div className="stat-tile">
          <div className="k">Total Pemasukan</div>
          <div className="v pos"><CountUp value={totalPemasukan} format={rupiah} /></div>
        </div>
        <div className="stat-tile">
          <div className="k">Total Pengeluaran</div>
          <div className="v" style={{ color: 'var(--series-red)' }}><CountUp value={totalPengeluaran} format={rupiah} /></div>
        </div>
        <div className="stat-tile span2 glow-expenses card" style={{ margin: 0 }}>
          <div className="k">Nett Cashflow — {BULAN[period.month]} {period.year}</div>
          <div className={`v ${nett >= 0 ? 'pos' : 'neg'}`} style={{ fontSize: 27 }}>
            <CountUp value={nett} format={rupiah} />
          </div>
          <div className="muted">{nett >= 0 ? 'Surplus — uangmu bekerja untukmu.' : 'Defisit — cek pos Keinginan.'}</div>
        </div>
      </div>

      {monthTx.length === 0 ? (
        <Empty
          art={<Icon name="wallet" size={44} strokeWidth={1.4} />}
          title={`Belum ada transaksi di ${BULAN[period.month]}`}
          body="Catat pemasukan & pengeluaran pertamamu — arus kas yang sadar adalah 1% lebih baik versi dompet."
          action={<button className="btn primary" onClick={() => setEditing('new')}>Catat transaksi</button>}
        />
      ) : (
        <>
          <div className="card">
            <div style={{ fontWeight: 800, marginBottom: 10 }}>Alokasi Pengeluaran</div>
            <Donut
              data={allocData}
              centerLabel={rupiahPendek(totalPengeluaran)}
              centerSub="total keluar"
              format={rupiah}
            />
          </div>

          <div className="card">
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Rekap {period.year}</div>
            <GroupedBars
              labels={BULAN_PENDEK.map((b) => b[0])}
              a={yearly.inA}
              b={yearly.outA}
              nameA="Pemasukan"
              nameB="Pengeluaran"
              colorA="var(--series-aqua)"
              colorB="var(--series-red)"
              format={rupiahPendek}
            />
          </div>

          {byKategori.length > 0 && (
            <div className="card">
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Kategori teratas</div>
              {byKategori.slice(0, 6).map(([kat, val]) => (
                <div key={kat} className="spread" style={{ padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700 }}>{kat}</span>
                  <span style={{ fontSize: 13.5, fontWeight: 800 }}>{rupiah(val)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="section-title">Riwayat Transaksi <span className="line" /></div>

          <div className="filter-row">
            {(['semua', 'pemasukan', 'pengeluaran'] as const).map((j) => (
              <button key={j} className={`chip ${fJenis === j ? 'active' : ''}`} style={{ flex: 'none' }} onClick={() => setFJenis(j)}>
                {j === 'semua' ? 'Semua' : j === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran'}
              </button>
            ))}
            {(['kebutuhan', 'keinginan', 'investasi'] as const).map((a) => (
              <button key={a} className={`chip ${fAlloc === a ? 'active' : ''}`} style={{ flex: 'none' }} onClick={() => setFAlloc(fAlloc === a ? 'semua' : a)}>
                {ALLOC_META[a].label}
              </button>
            ))}
          </div>
          <div className="field" style={{ marginBottom: 10 }}>
            <input placeholder="Cari kategori / catatan…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          <div className="card" style={{ padding: '4px 14px' }}>
            {filtered.length === 0 && <div className="muted" style={{ padding: 14, textAlign: 'center' }}>Tidak ada yang cocok dengan filter.</div>}
            {filtered.map((t) => (
              <button key={t.id} className="tx-row" style={{ width: '100%', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', color: 'var(--ink)', textAlign: 'left', cursor: 'pointer' }} onClick={() => setEditing(t)}>
                <div className="tx-icon" style={{ color: t.jenis === 'pemasukan' ? 'var(--good)' : 'var(--ink-3)' }}>
                  <Icon name={t.jenis === 'pemasukan' ? 'arrowIn' : 'arrowOut'} size={17} strokeWidth={2} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row" style={{ gap: 6 }}>
                    <span style={{ fontWeight: 800, fontSize: 14 }}>{t.kategori}</span>
                    {t.alokasi && <span className={`alloc-tag alloc-${t.alokasi}`}>{ALLOC_META[t.alokasi].en}</span>}
                  </div>
                  <div className="muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {formatTanggal(t.tanggal)}{t.catatan ? ` · ${t.catatan}` : ''}
                  </div>
                </div>
                <div style={{ fontWeight: 800, fontSize: 14 }} className={t.jenis === 'pemasukan' ? 'pos' : ''}>
                  {t.jenis === 'pemasukan' ? '+' : '−'}{rupiah(t.nominal)}
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      <button className="fab" onClick={() => setEditing('new')} aria-label="Catat transaksi">+</button>
      {editing && <TxForm tx={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function TxForm({ tx, onClose }: { tx: Transaction | null; onClose: () => void }) {
  const upsert = useStore((s) => s.upsertTransaction)
  const del = useStore((s) => s.deleteTransaction)
  const kategoriPengeluaran = useStore((s) => s.kategoriPengeluaran)
  const kategoriPemasukan = useStore((s) => s.kategoriPemasukan)
  const addKategori = useStore((s) => s.addKategori)

  const [jenis, setJenis] = useState<Transaction['jenis']>(tx?.jenis ?? 'pengeluaran')
  const [nominal, setNominal] = useState(tx ? formatNominalInput(String(tx.nominal)) : '')
  const [alokasi, setAlokasi] = useState<Alloc>(tx?.alokasi ?? 'kebutuhan')
  const kategoris = jenis === 'pemasukan' ? kategoriPemasukan : kategoriPengeluaran
  const [kategori, setKategori] = useState(tx?.kategori ?? '')
  const [tanggal, setTanggal] = useState(tx?.tanggal ?? todayKey())
  const [catatan, setCatatan] = useState(tx?.catatan ?? '')

  const dirty = nominal !== '' || catatan !== ''

  const save = () => {
    const n = parseNominal(nominal)
    if (!n) return
    upsert({
      id: tx?.id ?? uid(),
      tanggal,
      nominal: n,
      jenis,
      alokasi: jenis === 'pengeluaran' ? alokasi : undefined,
      kategori: kategori || (jenis === 'pemasukan' ? 'Lainnya' : 'Makanan'),
      catatan,
    })
    onClose()
  }

  return (
    <Modal title={tx ? 'Ubah Transaksi' : 'Catat Transaksi'} sub='Ketik "X" di kolom nominal untuk membatalkan.' onClose={onClose}>
      <div className="field">
        <div className="seg">
          <button className={jenis === 'pemasukan' ? 'active' : ''} style={{ ['--accent' as string]: 'var(--series-aqua)' }} onClick={() => { setJenis('pemasukan'); setKategori('') }}>Pemasukan</button>
          <button className={jenis === 'pengeluaran' ? 'active' : ''} style={{ ['--accent' as string]: 'var(--series-red)' }} onClick={() => { setJenis('pengeluaran'); setKategori('') }}>Pengeluaran</button>
        </div>
      </div>

      <div className="field">
        <label>Nominal (Rp)</label>
        <input
          inputMode="numeric"
          placeholder="cth. 50.000"
          value={nominal}
          autoFocus={!tx}
          style={{ fontSize: 22, fontWeight: 800 }}
          onChange={(e) => {
            if (xCancel(e.target.value, dirty, onClose)) return
            setNominal(formatNominalInput(e.target.value))
          }}
        />
      </div>

      {jenis === 'pengeluaran' && (
        <div className="field">
          <label>Jenis Alokasi</label>
          <div className="seg">
            {(['kebutuhan', 'keinginan', 'investasi'] as Alloc[]).map((a) => (
              <button
                key={a}
                className={alokasi === a ? 'active' : ''}
                style={{ ['--accent' as string]: ALLOC_META[a].color }}
                onClick={() => setAlokasi(a)}
              >
                {ALLOC_META[a].label}
              </button>
            ))}
          </div>
          <div className="hint">Needs untuk hidup · Wants untuk senang · Invest untuk masa depan.</div>
        </div>
      )}

      <div className="row" style={{ gap: 10 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Kategori</label>
          <select
            value={kategori}
            onChange={(e) => {
              if (e.target.value === '__new__') {
                const nama = window.prompt('Nama kategori baru:')
                if (nama?.trim() && nama.trim().toLowerCase() !== 'x') {
                  addKategori(jenis, nama.trim())
                  setKategori(nama.trim())
                }
                return
              }
              setKategori(e.target.value)
            }}
          >
            <option value="">— pilih —</option>
            {kategoris.map((k) => <option key={k} value={k}>{k}</option>)}
            <option value="__new__">＋ Kategori baru…</option>
          </select>
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Tanggal</label>
          <input type="date" value={tanggal} max={todayKey()} onChange={(e) => setTanggal(e.target.value)} />
        </div>
      </div>

      <div className="field">
        <label>Catatan / Deskripsi</label>
        <input
          value={catatan}
          placeholder="opsional"
          onChange={(e) => {
            if (xCancel(e.target.value, dirty, onClose)) return
            setCatatan(e.target.value)
          }}
        />
      </div>

      <button className="btn primary block" style={{ ['--accent' as string]: ACCENT }} onClick={save} disabled={!parseNominal(nominal)}>
        {tx ? 'Simpan perubahan' : 'Simpan transaksi'}
      </button>
      {tx && (
        <button className="btn danger block" style={{ marginTop: 10 }} onClick={() => { del(tx.id); onClose() }}>
          Hapus transaksi
        </button>
      )}
    </Modal>
  )
}
