import type { BudgetDatabase } from '../data/db'
import type { DateKey } from '../domain/dateKey'
import { addDays } from '../domain/dateKey'
import type { Cycle } from '../domain/models'

export type CycleAttentionState = 'current' | 'payday-confirmation-required'

export interface StartNextCycleInput {
  activeCycleId: string
  actualStartDate: DateKey
  expectedNextPayDate: DateKey
  totalBudgetCents: number
}

function validateBudget(totalBudgetCents: number) {
  if (!Number.isSafeInteger(totalBudgetCents) || totalBudgetCents <= 0) {
    throw new RangeError('Budget must be a positive integer number of cents')
  }
}

function validatePayRange(startDate: DateKey, expectedNextPayDate: DateKey) {
  if (expectedNextPayDate <= startDate) {
    throw new RangeError('Expected payday must be after the cycle start')
  }
}

function timestamp() {
  return new Date().toISOString()
}

export async function createFirstCycle(
  db: BudgetDatabase,
  startDate: DateKey,
  expectedNextPayDate: DateKey,
  totalBudgetCents: number,
): Promise<Cycle> {
  validatePayRange(startDate, expectedNextPayDate)
  validateBudget(totalBudgetCents)
  if (await db.cycles.where('status').equals('active').count()) {
    throw new Error('An active cycle already exists')
  }

  const now = timestamp()
  const cycle: Cycle = {
    id: crypto.randomUUID(),
    startDate,
    endDate: addDays(expectedNextPayDate, -1),
    expectedNextPayDate,
    totalBudgetCents,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
  await db.cycles.add(cycle)
  await db.settings.put({ key: 'defaultCycleBudgetCents', value: totalBudgetCents })
  return cycle
}

export function getCycleAttentionState(
  cycle: Cycle,
  today: DateKey,
): CycleAttentionState {
  return today >= cycle.expectedNextPayDate ? 'payday-confirmation-required' : 'current'
}

export async function rescheduleExpectedPayday(
  db: BudgetDatabase,
  cycleId: string,
  expectedNextPayDate: DateKey,
): Promise<Cycle> {
  const cycle = await db.cycles.get(cycleId)
  if (!cycle || cycle.status !== 'active') throw new Error('Active cycle not found')
  validatePayRange(cycle.startDate, expectedNextPayDate)

  const updated: Cycle = {
    ...cycle,
    endDate: addDays(expectedNextPayDate, -1),
    expectedNextPayDate,
    updatedAt: timestamp(),
  }
  await db.cycles.put(updated)
  return updated
}

export async function confirmPaydayAndStartNextCycle(
  db: BudgetDatabase,
  input: StartNextCycleInput,
): Promise<{ archived: Cycle; active: Cycle }> {
  validateBudget(input.totalBudgetCents)
  validatePayRange(input.actualStartDate, input.expectedNextPayDate)

  return db.transaction('rw', [db.cycles, db.transactions, db.settings], async () => {
    const oldCycle = await db.cycles.get(input.activeCycleId)
    if (!oldCycle || oldCycle.status !== 'active') throw new Error('Active cycle not found')
    if (input.actualStartDate <= oldCycle.startDate) {
      throw new RangeError('New cycle must start after the active cycle')
    }

    const now = timestamp()
    const archived: Cycle = {
      ...oldCycle,
      endDate: addDays(input.actualStartDate, -1),
      status: 'archived',
      updatedAt: now,
    }
    const active: Cycle = {
      id: crypto.randomUUID(),
      startDate: input.actualStartDate,
      endDate: addDays(input.expectedNextPayDate, -1),
      expectedNextPayDate: input.expectedNextPayDate,
      totalBudgetCents: input.totalBudgetCents,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    }

    await db.cycles.put(archived)
    await db.cycles.add(active)

    const entriesToMove = await db.transactions
      .where('cycleId')
      .equals(oldCycle.id)
      .filter((entry) => entry.localDate >= input.actualStartDate)
      .toArray()
    if (entriesToMove.length) {
      await db.transactions.bulkPut(
        entriesToMove.map((entry) => ({ ...entry, cycleId: active.id, updatedAt: now })),
      )
    }

    await db.settings.put({
      key: 'defaultCycleBudgetCents',
      value: input.totalBudgetCents,
    })
    return { archived, active }
  })
}
