import { describe, expect, test } from 'vitest'
import { addDays, daysBetween, suggestNextPayDate } from './dateKey'

describe('date-only arithmetic', () => {
  test('adds calendar days without timezone drift', () => {
    expect(addDays('2026-09-16', 30)).toBe('2026-10-16')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  test('counts exclusive distance between date keys', () => {
    expect(daysBetween('2026-09-16', '2026-10-15')).toBe(29)
  })

  test('suggests the same day next month and clamps month end', () => {
    expect(suggestNextPayDate('2026-09-16')).toBe('2026-10-16')
    expect(suggestNextPayDate('2026-01-31')).toBe('2026-02-28')
    expect(suggestNextPayDate('2028-01-31')).toBe('2028-02-29')
  })
})
