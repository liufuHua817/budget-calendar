import { afterEach, describe, expect, test } from 'vitest'
import { exportBackup, restoreBackup } from '../src/data/backup'
import { BudgetDatabase } from '../src/data/db'
import { calculateCycleProjection } from '../src/domain/budgetEngine'
import type { Project, ProjectPreset } from '../src/domain/models'
import {
  confirmPaydayAndStartNextCycle,
  createFirstCycle,
  getCycleAttentionState,
  rescheduleExpectedPayday,
} from '../src/services/cycleService'
import { recordTransaction, updateTransaction } from '../src/services/transactionService'

const databases: BudgetDatabase[] = []

function createDatabase() {
  const database = new BudgetDatabase(`acceptance-${crypto.randomUUID()}`)
  databases.push(database)
  return database
}

function project(
  id: string,
  name: string,
  expenseType: Project['expenseType'],
  sortOrder: number,
): Project {
  const now = '2026-09-16T00:00:00.000Z'
  return {
    id,
    name,
    icon: 'circle',
    color: expenseType === 'budget' ? '#246bfe' : '#f59e0b',
    expenseType,
    sortOrder,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.delete()))
})

describe('complete salary-budget workflow', () => {
  test('keeps every cycle independent while recalculating and restoring exact local data', async () => {
    const database = createDatabase()

    const firstCycle = await createFirstCycle(
      database,
      '2026-09-16',
      '2026-10-16',
      150_000,
    )
    expect(calculateCycleProjection(firstCycle, [], '2026-09-16').days).toHaveLength(30)

    const metro = project('metro', '地铁', 'budget', 0)
    const rent = project('rent', '房租', 'fixed', 1)
    const presets: ProjectPreset[] = [
      { id: 'metro-270', projectId: metro.id, amountCents: 270, sortOrder: 0 },
      { id: 'metro-360', projectId: metro.id, amountCents: 360, sortOrder: 1 },
    ]
    await database.projects.bulkAdd([metro, rent])
    await database.projectPresets.bulkAdd(presets)

    const metroEntry = await recordTransaction(database, {
      cycleId: firstCycle.id,
      projectId: metro.id,
      amountCents: 360,
      localDate: '2026-09-16',
      note: '',
    })
    const afterMetro = calculateCycleProjection(
      firstCycle,
      await database.transactions.toArray(),
      '2026-09-16',
    )
    expect(afterMetro.budgetSpentCents).toBe(360)
    expect(afterMetro.days[0].budgetSpentCents).toBe(360)

    await recordTransaction(database, {
      cycleId: firstCycle.id,
      projectId: rent.id,
      amountCents: 500_000,
      localDate: '2026-09-16',
      note: '固定房租',
    })
    const afterRent = calculateCycleProjection(
      firstCycle,
      await database.transactions.toArray(),
      '2026-09-16',
    )
    expect(afterRent.remainingBudgetCents).toBe(afterMetro.remainingBudgetCents)
    expect(afterRent.fixedSpentCents).toBe(500_000)

    await recordTransaction(database, {
      cycleId: firstCycle.id,
      projectId: metro.id,
      amountCents: 10_000,
      localDate: '2026-09-17',
      note: '测试超支',
    })
    const afterOverspend = calculateCycleProjection(
      firstCycle,
      await database.transactions.toArray(),
      '2026-09-17',
    )
    expect(afterOverspend.days[2].baseBudgetCents).toBeLessThan(5_000)

    await updateTransaction(database, metroEntry.id, { amountCents: 270 })
    const afterEdit = calculateCycleProjection(
      firstCycle,
      await database.transactions.toArray(),
      '2026-09-17',
    )
    expect(afterEdit.days[2].baseBudgetCents).toBeGreaterThan(
      afterOverspend.days[2].baseBudgetCents,
    )

    expect(getCycleAttentionState(firstCycle, '2026-10-16')).toBe(
      'payday-confirmation-required',
    )
    expect(await database.cycles.count()).toBe(1)

    const extended = await rescheduleExpectedPayday(database, firstCycle.id, '2026-10-18')
    expect(extended.endDate).toBe('2026-10-17')
    expect(calculateCycleProjection(extended, [], '2026-10-16').days).toHaveLength(32)
    expect(await database.cycles.count()).toBe(1)

    const { archived, active } = await confirmPaydayAndStartNextCycle(database, {
      activeCycleId: firstCycle.id,
      actualStartDate: '2026-10-18',
      expectedNextPayDate: '2026-11-18',
      totalBudgetCents: 120_000,
    })
    expect(archived).toMatchObject({
      id: firstCycle.id,
      status: 'archived',
      endDate: '2026-10-17',
      totalBudgetCents: 150_000,
    })
    expect(active).toMatchObject({
      status: 'active',
      startDate: '2026-10-18',
      totalBudgetCents: 120_000,
    })

    const payload = await exportBackup(database)
    await database.transaction('rw', database.tables, async () => {
      await Promise.all(database.tables.map((table) => table.clear()))
    })
    expect(await database.cycles.count()).toBe(0)
    await restoreBackup(database, payload)
    const restored = await exportBackup(database)

    expect(restored.cycles).toEqual(payload.cycles)
    expect(restored.projects).toEqual(payload.projects)
    expect(restored.projectPresets).toEqual(payload.projectPresets)
    expect(restored.transactions).toEqual(payload.transactions)
    expect(restored.settings).toEqual(payload.settings)
  })
})
