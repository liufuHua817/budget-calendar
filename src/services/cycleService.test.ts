import { afterEach, describe, expect, test } from 'vitest'
import { BudgetDatabase } from '../data/db'
import { calculateCycleProjection } from '../domain/budgetEngine'
import type { DateKey } from '../domain/dateKey'
import type { LedgerTransaction } from '../domain/models'
import {
  confirmPaydayAndStartNextCycle,
  createFirstCycle,
  getCycleAttentionState,
  rescheduleExpectedPayday,
} from './cycleService'

const databases: BudgetDatabase[] = []

function createDatabase() {
  const database = new BudgetDatabase(`cycle-test-${crypto.randomUUID()}`)
  databases.push(database)
  return database
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.delete()))
})

describe('salary cycle lifecycle', () => {
  test('creates the first cycle from salary date to expected-payday eve', async () => {
    const database = createDatabase()
    const cycle = await createFirstCycle(database, '2026-09-16', '2026-10-16', 150_000)

    expect(cycle).toMatchObject({
      startDate: '2026-09-16',
      endDate: '2026-10-15',
      expectedNextPayDate: '2026-10-16',
      totalBudgetCents: 150_000,
      status: 'active',
    })
    expect(await database.cycles.get(cycle.id)).toEqual(cycle)
    await expect(
      createFirstCycle(database, '2026-09-16', '2026-09-16', 150_000),
    ).rejects.toThrow(RangeError)
  })

  test('requires confirmation on payday without creating a cycle', async () => {
    const database = createDatabase()
    const cycle = await createFirstCycle(database, '2026-09-16', '2026-10-16', 150_000)

    expect(getCycleAttentionState(cycle, '2026-10-15')).toBe('current')
    expect(getCycleAttentionState(cycle, '2026-10-16')).toBe('payday-confirmation-required')
    expect(await database.cycles.count()).toBe(1)
  })

  test('extends the active cycle when salary is delayed', async () => {
    const database = createDatabase()
    const cycle = await createFirstCycle(database, '2026-09-16', '2026-10-16', 150_000)
    const extended = await rescheduleExpectedPayday(database, cycle.id, '2026-10-18')

    expect(extended.endDate).toBe('2026-10-17')
    expect(extended.expectedNextPayDate).toBe('2026-10-18')
    expect(calculateCycleProjection(extended, [], '2026-10-16').days).toHaveLength(32)
    expect(await database.cycles.count()).toBe(1)
  })

  test.each([
    ['on time', '2026-10-16'],
    ['early', '2026-10-15'],
    ['late', '2026-10-18'],
  ] as const)('starts an independent cycle when salary arrives %s', async (_label, actualStartDate) => {
    const database = createDatabase()
    const oldCycle = await createFirstCycle(database, '2026-09-16', '2026-10-16', 150_000)

    const result = await confirmPaydayAndStartNextCycle(database, {
      activeCycleId: oldCycle.id,
      actualStartDate,
      expectedNextPayDate: '2026-11-16',
      totalBudgetCents: 120_000,
    })

    expect(result.archived).toMatchObject({
      id: oldCycle.id,
      endDate: previousDate(actualStartDate),
      status: 'archived',
      totalBudgetCents: 150_000,
    })
    expect(result.active).toMatchObject({
      startDate: actualStartDate,
      endDate: '2026-11-15',
      expectedNextPayDate: '2026-11-16',
      status: 'active',
      totalBudgetCents: 120_000,
    })
    expect((await database.settings.get('defaultCycleBudgetCents'))?.value).toBe(120_000)
  })

  test('moves same-day transactions into the confirmed new cycle', async () => {
    const database = createDatabase()
    const oldCycle = await createFirstCycle(database, '2026-09-16', '2026-10-16', 150_000)
    const entry: LedgerTransaction = {
      id: 'today-entry',
      cycleId: oldCycle.id,
      projectId: 'metro',
      expenseType: 'budget',
      amountCents: 360,
      localDate: '2026-10-16',
      note: '',
      createdAt: oldCycle.createdAt,
      updatedAt: oldCycle.updatedAt,
    }
    await database.transactions.add(entry)

    const result = await confirmPaydayAndStartNextCycle(database, {
      activeCycleId: oldCycle.id,
      actualStartDate: '2026-10-16',
      expectedNextPayDate: '2026-11-16',
      totalBudgetCents: 150_000,
    })

    expect((await database.transactions.get(entry.id))?.cycleId).toBe(result.active.id)
  })
})

function previousDate(date: DateKey): DateKey {
  const value = new Date(`${date}T00:00:00.000Z`)
  value.setUTCDate(value.getUTCDate() - 1)
  return value.toISOString().slice(0, 10) as DateKey
}
