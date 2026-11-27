import { th } from './th'

export type Unit = 'g' | 'ml' | 'piece'

const pad = (n: number, w = 2) => String(n).padStart(w, '0')

/** ISO `2026-11-27` -> `27/11/69` (Buddhist year, last two digits). */
export function formatThaiDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${pad(d)}/${pad(m)}/${pad((y + 543) % 100)}`
}

/** `dd/mm/yy` (yy = 25yy B.E.) or `dd/mm/yyyy` (B.E.) -> ISO, or null if malformed/nonexistent. */
export function parseThaiDate(input: string): string | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(input.trim())
  if (!match) return null
  const d = Number(match[1])
  const m = Number(match[2])
  const be = match[3].length === 2 ? 2500 + Number(match[3]) : Number(match[3])
  const y = be - 543
  const date = new Date(Date.UTC(y, m - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return null
  }
  return `${pad(y, 4)}-${pad(m)}-${pad(d)}`
}

const numberFmt = (n: number, min: number, max: number) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: min, maximumFractionDigits: max }).format(n)

export function formatBaht(n: number): string {
  return `${numberFmt(n, 2, 2)} ${th.common.baht}`
}

export function formatQty(n: number, unit: Unit): string {
  return `${numberFmt(n, 0, 4)} ${th.units[unit]}`
}
