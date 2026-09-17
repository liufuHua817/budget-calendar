import { afterEach, describe, expect, test } from 'vitest'
import { BudgetDatabase } from '../data/db'
import type { Project } from '../domain/models'
import { createFirstCycle } from './cycleService'
import {
  createUndoHandle,
  deleteTransaction,
  recordTransaction,
  updateTransaction,
} from './transactionService'

const databases: BudgetDatabase[] = []

function createDatabase() {
  const database = new BudgetDatabase(`transaction-test-${crypto.randomUUID()}`)
  databases.push(database)
  return database
}

async function seed(database: BudgetDatabase) {
  const cycle = await createFirstCycle(database, '2026-09-16', '2026-10-16', 150_000)
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
  await database.projects.add(project)
  return { cycle, project }
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.delete()))
})

describe('transaction service', () => {
  test.each([0, -1, 10.5])('rejects invalid integer-cent amount %s', async (amountCents) => {
    const database = createDatabase()
    const { cycle, project } = await seed(database)
    await expect(
      recordTransaction(database, {
        cycleId: cycle.id,
        projectId: project.id,
        amountCents,
        localDate: '2026-09-16',
        note: '',
      }),
    ).rejects.toThrow(RangeError)
  })

  test('rejects unknown projects and dates outside the referenced cycle', async () => {
    const database = createDatabase()
    const { cycle } = await seed(database)
    await expect(
      recordTransaction(database, {
        cycleId: cycle.id,
        projectId: 'missing',
        amountCents: 360,
        localDate: '2026-09-16',
        note: '',
      }),
    ).rejects.toThrow('Project not found')
    await expect(
      recordTransaction(database, {
        cycleId: cycle.id,
        projectId: 'metro',
        amountCents: 360,
        localDate: '2026-10-16',
        note: '',
      }),
    ).rejects.toThrow('outside the cycle')
  })

  test('snapshots the project expense type when recording', async () => {
    const database = createDatabase()
    const { cycle, project } = await seed(database)
    const entry = await recordTransaction(database, {
      cycleId: cycle.id,
      projectId: project.id,
      amountCents: 360,
      localDate: '2026-09-16',
      note: '上班',
    })
    await database.projects.update(project.id, { expenseType: 'fixed' })

    expect((await database.transactions.get(entry.id))?.expenseType).toBe('budget')
  })

  test('updates and deletes a validated transaction', async () => {
    const database = createDatabase()
    const { cycle, project } = await seed(database)
    const entry = await recordTransaction(database, {
      cycleId: cycle.id,
      projectId: project.id,
      amountCents: 360,
      localDate: '2026-09-16',
      note: '',
    })

    const updated = await updateTransaction(database, entry.id, { amountCents: 270, note: '优惠' })
    expect(updated).toMatchObject({ amountCents: 270, note: '优惠' })
    await deleteTransaction(database, entry.id)
    expect(await database.transactions.get(entry.id)).toBeUndefined()
  })

  test('allows one undo within five seconds and rejects expired undo', async () => {
    const database = createDatabase()
    const { cycle, project } = await seed(database)
    const first = await recordTransaction(database, {
      cycleId: cycle.id,
      projectId: project.id,
      amountCents: 360,
      localDate: '2026-09-16',
      note: '',
    })
    let now = 1_000
    const clock = () => now
    const firstUndo = createUndoHandle(database, first.id, 5_000, clock)

    now += 4_999
    await expect(firstUndo.undo()).resolves.toBe(true)
    await expect(firstUndo.undo()).resolves.toBe(false)

    const second = await recordTransaction(database, {
      cycleId: cycle.id,
      projectId: project.id,
      amountCents: 270,
      localDate: '2026-09-16',
      note: '',
    })
    const expiredUndo = createUndoHandle(database, second.id, 5_000, clock)
    now += 5_001
    await expect(expiredUndo.undo()).resolves.toBe(false)
    expect(await database.transactions.get(second.id)).toBeDefined()
  })
})
