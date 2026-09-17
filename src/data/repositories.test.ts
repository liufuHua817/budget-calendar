import { afterEach, describe, expect, test } from 'vitest'
import type { Cycle, LedgerTransaction, Project, ProjectPreset } from '../domain/models'
import { BudgetDatabase } from './db'
import {
  getActiveCycle,
  getCycleForDate,
  getTransactionsForCycle,
  putCycle,
  putProject,
  putProjectPreset,
  putTransaction,
  replaceAllData,
} from './repositories'

const databases: BudgetDatabase[] = []

function createDatabase() {
  const database = new BudgetDatabase(`test-${crypto.randomUUID()}`)
  databases.push(database)
  return database
}

const cycle: Cycle = {
  id: 'cycle-1',
  startDate: '2026-09-16',
  endDate: '2026-10-15',
  expectedNextPayDate: '2026-10-16',
  totalBudgetCents: 150_000,
  status: 'active',
  createdAt: '2026-09-16T00:00:00.000Z',
  updatedAt: '2026-09-16T00:00:00.000Z',
}

const project: Project = {
  id: 'metro',
  name: '地铁',
  icon: 'train',
  color: '#246bfe',
  expenseType: 'budget',
  sortOrder: 0,
  isActive: true,
  createdAt: cycle.createdAt,
  updatedAt: cycle.updatedAt,
}

const preset: ProjectPreset = {
  id: 'metro-360',
  projectId: project.id,
  amountCents: 360,
  sortOrder: 0,
}

const entry: LedgerTransaction = {
  id: 'entry-1',
  cycleId: cycle.id,
  projectId: project.id,
  expenseType: 'budget',
  amountCents: 360,
  localDate: '2026-09-16',
  note: '',
  createdAt: cycle.createdAt,
  updatedAt: cycle.updatedAt,
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.delete()))
})

describe('local repositories', () => {
  test('round-trips typed cycle, project, preset and transaction rows', async () => {
    const database = createDatabase()
    await putCycle(database, cycle)
    await putProject(database, project)
    await putProjectPreset(database, preset)
    await putTransaction(database, entry)

    expect(await getActiveCycle(database)).toEqual(cycle)
    expect(await getCycleForDate(database, '2026-10-01')).toEqual(cycle)
    expect(await getTransactionsForCycle(database, cycle.id)).toEqual([entry])
    expect((await database.projects.get(project.id))?.name).toBe('地铁')
    expect((await database.projectPresets.get(preset.id))?.amountCents).toBe(360)
  })

  test('rolls back every table when full replacement fails', async () => {
    const database = createDatabase()
    await putCycle(database, cycle)
    await putProject(database, project)

    await expect(
      replaceAllData(database, {
        cycles: [cycle, { ...cycle }],
        projects: [],
        projectPresets: [],
        transactions: [],
        settings: [],
      }),
    ).rejects.toBeDefined()

    expect(await database.cycles.toArray()).toEqual([cycle])
    expect(await database.projects.toArray()).toEqual([project])
  })
})
