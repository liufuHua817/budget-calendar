import { describe, expect, test } from 'vitest'
import { distributeCents, formatCents, parseYuanToCents } from './money'

describe('integer-cent money helpers', () => {
  test('parses positive yuan with at most two decimals', () => {
    expect(parseYuanToCents('53.58')).toBe(5358)
    expect(parseYuanToCents('3.6')).toBe(360)
    expect(parseYuanToCents('1')).toBe(100)
  })

  test.each(['', '0', '0.00', '-1', '1.234', '1e2', ' 3.6 '])(
    'rejects invalid yuan input %j',
    (input) => {
      expect(() => parseYuanToCents(input)).toThrow(RangeError)
    },
  )

  test('formats signed cents for display', () => {
    expect(formatCents(5358)).toBe('¥53.58')
    expect(formatCents(-270)).toBe('-¥2.70')
  })

  test('distributes remainder cents to earlier slots', () => {
    expect(distributeCents(37500, 7)).toEqual([5358, 5357, 5357, 5357, 5357, 5357, 5357])
    expect(distributeCents(10, 3)).toEqual([4, 3, 3])
  })

  test('rejects invalid distributions', () => {
    expect(() => distributeCents(-1, 2)).toThrow(RangeError)
    expect(() => distributeCents(10.5, 2)).toThrow(RangeError)
    expect(() => distributeCents(10, 0)).toThrow(RangeError)
  })
})
