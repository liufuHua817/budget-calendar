import type { BudgetDatabase } from '../data/db'
import type { DateKey } from '../domain/dateKey'
import type { ExpenseType, LedgerTransaction } from '../domain/models'

export interface RecordTransactionInput {
  cycleId: string
  projectId: string
  amountCents: number
  localDate: DateKey
  note: string
  expenseType?: ExpenseType
}

export interface UpdateTransactionInput {
  projectId?: string
  amountCents?: number
  localDate?: DateKey
  note?: string
  expenseType?: ExpenseType
}

function validateAmount(amountCents: number) {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new RangeError('Amount must be a positive integer number of cents')
  }
}

async function validateReferences(
  db: BudgetDatabase,
  cycleId: string,
  projectId: string,
  localDate: DateKey,
) {
  const [cycle, project] = await Promise.all([
    db.cycles.get(cycleId),
    db.projects.get(projectId),
  ])
  if (!cycle) throw new Error('Cycle not found')
  if (!project) throw new Error('Project not found')
  if (localDate < cycle.startDate || localDate > cycle.endDate) {
    throw new RangeError('Transaction date is outside the cycle')
  }
  return { cycle, project }
}

export async function recordTransaction(
  db: BudgetDatabase,
  input: RecordTransactionInput,
): Promise<LedgerTransaction> {
  validateAmount(input.amountCents)
  const { project } = await validateReferences(
    db,
    input.cycleId,
    input.projectId,
    input.localDate,
  )
  const now = new Date().toISOString()
  const transaction: LedgerTransaction = {
    id: crypto.randomUUID(),
    cycleId: input.cycleId,
    projectId: input.projectId,
    expenseType: input.expenseType ?? project.expenseType,
    amountCents: input.amountCents,
    localDate: input.localDate,
    note: input.note,
    createdAt: now,
    updatedAt: now,
  }
  await db.transactions.add(transaction)
  return transaction
}

export async function updateTransaction(
  db: BudgetDatabase,
  id: string,
  patch: UpdateTransactionInput,
): Promise<LedgerTransaction> {
  const existing = await db.transactions.get(id)
  if (!existing) throw new Error('Transaction not found')

  const amountCents = patch.amountCents ?? existing.amountCents
  const projectId = patch.projectId ?? existing.projectId
  const localDate = patch.localDate ?? existing.localDate
  validateAmount(amountCents)
  const { project } = await validateReferences(db, existing.cycleId, projectId, localDate)
  const updated: LedgerTransaction = {
    ...existing,
    projectId,
    amountCents,
    localDate,
    note: patch.note ?? existing.note,
    expenseType:
      patch.expenseType ?? (patch.projectId ? project.expenseType : existing.expenseType),
    updatedAt: new Date().toISOString(),
  }
  await db.transactions.put(updated)
  return updated
}

export async function deleteTransaction(db: BudgetDatabase, id: string): Promise<void> {
  await db.transactions.delete(id)
}

export function createUndoHandle(
  db: BudgetDatabase,
  transactionId: string,
  ttlMs: number,
  clock: () => number = () => Date.now(),
): { undo(): Promise<boolean>; expiresAt: number } {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) throw new RangeError('Undo TTL must be positive')
  const expiresAt = clock() + ttlMs
  let used = false

  return {
    expiresAt,
    async undo() {
      if (used || clock() >= expiresAt) return false
      used = true
      const existing = await db.transactions.get(transactionId)
      if (!existing) return false
      await db.transactions.delete(transactionId)
      return true
    },
  }
}
