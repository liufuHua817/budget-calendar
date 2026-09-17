import { describe, expect, test } from 'vitest'
import type { Cycle, ExpenseType, LedgerTransaction } from './models'
import { calculateCycleProjection, createInitialAllocations } from './budgetEngine'

const thirtyDayCycle: Cycle = {
  id: 'cycle-1',
  startDate: '2026-09-16',
  endDate: '2026-10-15',
  expectedNextPayDate: '2026-10-16',
  totalBudgetCents: 150_000,
  status: 'active',
  createdAt: '2026-09-16T00:00:00.000Z',
  updatedAt: '2026-09-16T00:00:00.000Z',
}

function transaction(
  id: string,
  localDate: LedgerTransaction['localDate'],
  amountCents: number,
  expenseType: ExpenseType = 'budget',
): LedgerTransaction {
  return {
    id,
    cycleId: thirtyDayCycle.id,
    projectId: expenseType === 'budget' ? 'daily' : 'rent',
    expenseType,
    amountCents,
    localDate,
    note: '',
    createdAt: '2026-09-16T00:00:00.000Z',
    updatedAt: '2026-09-16T00:00:00.000Z',
  }
}

describe('initial cycle allocation', () => {
  test('allocates the exact budget across the actual 30-day cycle', () => {
    const days = createInitialAllocations(150_000, 30)
    expect(days).toHaveLength(30)
    expect(days.reduce((sum, value) => sum + value, 0)).toBe(150_000)
    expect(days.slice(28).reduce((sum, value) => sum + value, 0)).toBe(10_000)
  })

  test('assigns remainder cents to earlier dates', () => {
    const days = createInitialAllocations(101, 30)
    expect(days.reduce((sum, value) => sum + value, 0)).toBe(101)
    expect(days[0]).toBe(4)
    expect(days[29]).toBe(3)
  })

  test.each([28, 29, 30, 31, 35])('supports a %i-day cycle', (dayCount) => {
    const days = createInitialAllocations(150_000, dayCount)
    expect(days).toHaveLength(dayCount)
    expect(days.reduce((sum, value) => sum + value, 0)).toBe(150_000)
  })

  test('builds one empty projection row for every actual date', () => {
    const projection = calculateCycleProjection(thirtyDayCycle, [], '2026-09-16')
    expect(projection.days).toHaveLength(30)
    expect(projection.days[0]).toMatchObject({
      date: '2026-09-16',
      dayIndex: 0,
      weekIndex: 0,
      baseBudgetCents: 5_000,
      budgetSpentCents: 0,
      fixedSpentCents: 0,
    })
    expect(projection.days[29]).toMatchObject({
      date: '2026-10-15',
      dayIndex: 29,
      weekIndex: 4,
    })
    expect(projection.days[1]).toMatchObject({
      baseBudgetCents: 5_000,
      carryInCents: 0,
      availableCents: 5_000,
    })
    expect(projection.remainingBudgetCents).toBe(150_000)
  })

  test('rejects a cycle whose end precedes its start', () => {
    expect(() =>
      calculateCycleProjection(
        { ...thirtyDayCycle, endDate: '2026-09-15', expectedNextPayDate: '2026-09-16' },
        [],
        '2026-09-16',
      ),
    ).toThrow(RangeError)
  })
})

describe('dynamic carryover and replanning', () => {
  test('carries an unused daily amount into the next day', () => {
    const projection = calculateCycleProjection(
      thirtyDayCycle,
      [transaction('t1', '2026-09-16', 3_000)],
      '2026-09-17',
    )

    expect(projection.days[0]).toMatchObject({
      availableCents: 5_000,
      budgetSpentCents: 3_000,
      carryOutCents: 2_000,
    })
    expect(projection.days[1]).toMatchObject({
      baseBudgetCents: 5_000,
      carryInCents: 2_000,
      availableCents: 7_000,
    })
  })

  test('adds a full-week remainder to the next actual week', () => {
    const weekOne = Array.from({ length: 7 }, (_, index) =>
      transaction(`w1-${index}`, `2026-09-${16 + index}` as LedgerTransaction['localDate'], 4_000),
    )
    const projection = calculateCycleProjection(thirtyDayCycle, weekOne, '2026-09-23')

    expect(projection.days.slice(7, 14).map((day) => day.baseBudgetCents)).toEqual([
      6_000, 6_000, 6_000, 6_000, 6_000, 6_000, 6_000,
    ])
  })

  test('distributes week-four remainder across a two-day final week', () => {
    const spending = Array.from({ length: 28 }, (_, index) => {
      const amount = index < 21 ? 5_000 : 4_000
      const date = index < 15 ? `2026-09-${16 + index}` : `2026-10-${String(index - 14).padStart(2, '0')}`
      return transaction(`day-${index}`, date as LedgerTransaction['localDate'], amount)
    })
    const projection = calculateCycleProjection(thirtyDayCycle, spending, '2026-10-14')

    expect(projection.days.slice(28).map((day) => day.baseBudgetCents)).toEqual([8_500, 8_500])
  })

  test('redistributes the exact remaining budget after daily overspending', () => {
    const projection = calculateCycleProjection(
      thirtyDayCycle,
      [transaction('t1', '2026-09-16', 6_000)],
      '2026-09-16',
    )

    expect(projection.days[0].overspentCents).toBe(1_000)
    expect(projection.days.slice(1).reduce((sum, day) => sum + day.baseBudgetCents, 0)).toBe(
      144_000,
    )
  })

  test('keeps fixed expenses outside the budget engine', () => {
    const baseline = calculateCycleProjection(thirtyDayCycle, [], '2026-09-16')
    const projection = calculateCycleProjection(
      thirtyDayCycle,
      [transaction('fixed', '2026-09-16', 500_000, 'fixed')],
      '2026-09-16',
    )

    expect(projection.days.map((day) => day.availableCents)).toEqual(
      baseline.days.map((day) => day.availableCents),
    )
    expect(projection.fixedSpentCents).toBe(500_000)
    expect(projection.remainingBudgetCents).toBe(150_000)
  })

  test('sets every future budget to zero after the cycle budget is exhausted', () => {
    const projection = calculateCycleProjection(
      thirtyDayCycle,
      [transaction('t1', '2026-09-16', 160_000)],
      '2026-09-16',
    )

    expect(projection.days.slice(1).every((day) => day.availableCents === 0)).toBe(true)
    expect(projection.overspendCents).toBe(10_000)
    expect(projection.remainingBudgetCents).toBe(0)
  })

  test('produces the same projection regardless of transaction order', () => {
    const entries = [
      transaction('t1', '2026-09-16', 3_000),
      transaction('t2', '2026-09-17', 2_700),
      transaction('t3', '2026-09-17', 50_000, 'fixed'),
    ]

    expect(calculateCycleProjection(thirtyDayCycle, entries, '2026-09-17')).toEqual(
      calculateCycleProjection(thirtyDayCycle, [...entries].reverse(), '2026-09-17'),
    )
  })
})
