import type { DateKey } from '../domain/dateKey'
import type {
  Cycle,
  LedgerTransaction,
  Project,
  ProjectPreset,
  SettingRecord,
} from '../domain/models'
import type { BudgetDatabase } from './db'

export interface DataSnapshot {
  cycles: Cycle[]
  projects: Project[]
  projectPresets: ProjectPreset[]
  transactions: LedgerTransaction[]
  settings: SettingRecord[]
}

export async function putCycle(db: BudgetDatabase, cycle: Cycle): Promise<void> {
  await db.cycles.put(cycle)
}

export async function putProject(db: BudgetDatabase, project: Project): Promise<void> {
  await db.projects.put(project)
}

export async function putProjectPreset(
  db: BudgetDatabase,
  preset: ProjectPreset,
): Promise<void> {
  await db.projectPresets.put(preset)
}

export async function putTransaction(
  db: BudgetDatabase,
  transaction: LedgerTransaction,
): Promise<void> {
  await db.transactions.put(transaction)
}

export async function getActiveCycle(db: BudgetDatabase): Promise<Cycle | undefined> {
  return db.cycles.where('status').equals('active').first()
}

export async function getCycleForDate(
  db: BudgetDatabase,
  date: DateKey,
): Promise<Cycle | undefined> {
  const cycles = await db.cycles.toArray()
  return cycles.find((cycle) => cycle.startDate <= date && cycle.endDate >= date)
}

export async function getTransactionsForCycle(
  db: BudgetDatabase,
  cycleId: string,
): Promise<LedgerTransaction[]> {
  return db.transactions.where('cycleId').equals(cycleId).sortBy('createdAt')
}

export async function replaceAllData(
  db: BudgetDatabase,
  snapshot: DataSnapshot,
): Promise<void> {
  await db.transaction(
    'rw',
    [db.cycles, db.projects, db.projectPresets, db.transactions, db.settings],
    async () => {
      await Promise.all([
        db.cycles.clear(),
        db.projects.clear(),
        db.projectPresets.clear(),
        db.transactions.clear(),
        db.settings.clear(),
      ])
      if (snapshot.cycles.length) await db.cycles.bulkAdd(snapshot.cycles)
      if (snapshot.projects.length) await db.projects.bulkAdd(snapshot.projects)
      if (snapshot.projectPresets.length) await db.projectPresets.bulkAdd(snapshot.projectPresets)
      if (snapshot.transactions.length) await db.transactions.bulkAdd(snapshot.transactions)
      if (snapshot.settings.length) await db.settings.bulkAdd(snapshot.settings)
    },
  )
}
