import { describe, expect, it } from 'vitest'
import { formatBaht, formatQty, formatThaiDate, parseThaiDate } from './format'

describe('formatThaiDate', () => {
  it('formats ISO as dd/mm/yy in Buddhist year', () => {
    expect(formatThaiDate('2026-11-27')).toBe('27/11/69')
    expect(formatThaiDate('2026-12-01')).toBe('01/12/69')
  })
})

describe('parseThaiDate', () => {
  it('parses two-digit Buddhist year', () => {
    expect(parseThaiDate('27/11/69')).toBe('2026-11-27')
    expect(parseThaiDate('01/12/69')).toBe('2026-12-01')
  })
  it('parses four-digit Buddhist year', () => {
    expect(parseThaiDate('27/11/2569')).toBe('2026-11-27')
  })
  it('rejects impossible or malformed dates', () => {
    expect(parseThaiDate('31/02/69')).toBeNull()
    expect(parseThaiDate('abc')).toBeNull()
    expect(parseThaiDate('')).toBeNull()
  })
  it('round-trips a leap day', () => {
    expect(parseThaiDate(formatThaiDate('2028-02-29'))).toBe('2028-02-29')
  })
})

describe('formatBaht / formatQty', () => {
  it('formats baht with grouping and two decimals', () => {
    expect(formatBaht(1234.5)).toBe('1,234.50 บาท')
  })
  it('formats quantity with Thai unit', () => {
    expect(formatQty(1500, 'g')).toContain('กรัม')
    expect(formatQty(250, 'ml')).toContain('มิลลิลิตร')
    expect(formatQty(3, 'piece')).toContain('ชิ้น')
  })
})
