import { describe, expect, it } from 'vitest'
import { errorMessage, th } from './th'

const LATIN = /[A-Za-z]/
const ALLOWED = new Set(['Inven2Food', 'Email', 'Password'])

function strings(o: unknown): string[] {
  if (typeof o === 'string') return [o]
  if (o && typeof o === 'object') return Object.values(o).flatMap(strings)
  return []
}

describe('th', () => {
  it('has no Latin letters except allowed tokens', () => {
    for (const s of strings(th)) {
      if (ALLOWED.has(s)) continue
      expect(s, s).not.toMatch(LATIN)
    }
  })
  it('page title is Inven2Food', () => {
    expect(th.appTitle).toBe('Inven2Food')
  })
  it('has the six nav names', () => {
    expect(Object.values(th.nav)).toEqual([
      'หน้าหลัก', 'คลังวัตถุดิบ', 'วัตถุดิบ', 'รายการอาหารและสูตร', 'ประวัติทำอาหาร', 'รายการซื้อของ',
    ])
  })
})

describe('errorMessage', () => {
  it('maps known codes to Thai', () => {
    for (const c of ['INSUFFICIENT_STOCK', 'INVALID_QTY', 'RECIPE_EMPTY', 'ALREADY_CANCELLED', 'UNIT_MISMATCH', 'EXPIRY_IN_PAST', 'NOT_FOUND', 'INVALID_CREDENTIALS']) {
      const m = errorMessage(c)
      expect(m).not.toBe('')
      expect(m).not.toMatch(LATIN)
      expect(m).not.toBe(th.errors.UNKNOWN)
    }
  })
  it('falls back to the generic message for unknown text', () => {
    const m = errorMessage('weird raw postgres text')
    expect(m).toBe('เกิดข้อผิดพลาด ลองใหม่อีกครั้ง')
    expect(m).not.toMatch(LATIN)
  })
})
