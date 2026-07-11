/** "Rp1.250.000" — Indonesian Rupiah, dot thousand separators, no decimals */
export function rupiah(n: number): string {
  const sign = n < 0 ? '−' : ''
  return `${sign}Rp${Math.round(Math.abs(n)).toLocaleString('id-ID')}`
}

/** compact "Rp1,2 jt" for tight chart labels */
export function rupiahPendek(n: number): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? '−' : ''
  if (abs >= 1_000_000_000) return `${sign}Rp${(abs / 1_000_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} M`
  if (abs >= 1_000_000) return `${sign}Rp${(abs / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`
  if (abs >= 1_000) return `${sign}Rp${(abs / 1_000).toLocaleString('id-ID', { maximumFractionDigits: 0 })} rb`
  return `${sign}Rp${abs}`
}

/** parse user nominal input: keep digits only */
export function parseNominal(raw: string): number {
  const digits = raw.replace(/[^\d]/g, '')
  return digits ? parseInt(digits, 10) : 0
}

/** live-format an input value with thousand separators as the user types */
export function formatNominalInput(raw: string): string {
  const n = parseNominal(raw)
  return n ? n.toLocaleString('id-ID') : ''
}

export function persen(n: number): string {
  return `${Math.round(n)}%`
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}
