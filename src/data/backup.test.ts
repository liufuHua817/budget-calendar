import { afterEach, describe, expect, test } from 'vitest'
import { BudgetDatabase } from './db'
import type { Cycle, LedgerTransaction, Project, ProjectPreset } from '../domain/models'
import { exportBackup, parseBackup, restoreBackup } from './backup'

const databases: BudgetDatabase[] = []

function createDatabase() {
  const database = new BudgetDatabase(`backup-test-${crypto.randomUUID()}`)
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

async function seed(database: BudgetDatabase) {
  await database.cycles.add(cycle)
  await database.projects.add(project)
  await database.projectPresets.add(preset)
  await database.transactions.add(entry)
  await database.settings.add({ key: 'defaultCycleBudgetCents', value: 150_000 })
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.delete()))
})

describe('versioned backup', () => {
  test('exports and parses a complete V1 payload', async () => {
    const database = createDatabase()
    await seed(database)
    const payload = await exportBackup(database)
    const parsed = parseBackup(JSON.stringify(payload))

    expect(parsed).toMatchObject({
      format: 'budget-calendar-backup',
      version: 1,
      cycles: [cycle],
      projects: [project],
      projectPresets: [preset],
      transactions: [entry],
    })
  })

  test.each([
    ['wrong format', (value: Record<string, unknown>): void => { value.format = 'other' }],
    ['unsupported version', (value: Record<string, unknown>): void => { value.version = 2 }],
    [
      'negative cents',
      (value: Record<string, unknown>): void => {
        (value.cycles as Array<Record<string, unknown>>)[0].totalBudgetCents = -1
      },
    ],
    [
      'malformed date',
      (value: Record<string, unknown>): void => {
        (value.cycles as Array<Record<string, unknown>>)[0].startDate = '2026-02-30'
      },
    ],
    [
      'invalid payday order',
      (value: Record<string, unknown>): void => {
        (value.cycles as Array<Record<string, unknown>>)[0].expectedNextPayDate = '2026-09-16'
      },
    ],
    [
      'active end mismatch',
      (value: Record<string, unknown>): void => {
        (value.cycles as Array<Record<string, unknown>>)[0].endDate = '2026-10-14'
      },
    ],
    [
      'unknown project reference',
      (value: Record<string, unknown>): void => {
        (value.transactions as Array<Record<string, unknown>>)[0].projectId = 'missing'
      },
    ],
    [
      'transaction outside cycle',
      (value: Record<string, unknown>): void => {
        (value.transactions as Array<Record<string, unknown>>)[0].localDate = '2026-10-16'
      },
    ],
  ] as const)('rejects %s', async (_label, mutate) => {
    const database = createDatabase()
    await seed(database)
    const value = structuredClone(await exportBackup(database)) as unknown as Record<string, unknown>
    mutate(value)
    expect(() => parseBackup(JSON.stringify(value))).toThrow()
  })

  test('restores every row after a full clear', async () => {
    const database = createDatabase()
    await seed(database)
    const payload = await exportBackup(database)

    await database.transaction(
      'rw',
      [
        database.cycles,
        database.projects,
        database.projectPresets,
        database.transactions,
        database.settings,
      ],
      async () => {
        await Promise.all(database.tables.map((table) => table.clear()))
      },
    )
    await restoreBackup(database, payload)

    const restored = await exportBackup(database)
    expect(restored.cycles).toEqual(payload.cycles)
    expect(restored.projects).toEqual(payload.projects)
    expect(restored.projectPresets).toEqual(payload.projectPresets)
    expect(restored.transactions).toEqual(payload.transactions)
    expect(restored.settings).toEqual(payload.settings)
  })

  test('preserves existing data when restore validation fails', async () => {
    const database = createDatabase()
    await seed(database)
    const payload = await exportBackup(database)
    const duplicate = { ...payload, cycles: [payload.cycles[0], payload.cycles[0]] }

    await expect(restoreBackup(database, duplicate)).rejects.toBeDefined()
    expect(await database.cycles.toArray()).toEqual([cycle])
    expect(await database.transactions.toArray()).toEqual([entry])
  })
})
