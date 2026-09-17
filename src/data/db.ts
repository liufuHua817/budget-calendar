import Dexie, { type Table } from 'dexie'
import type {
  Cycle,
  LedgerTransaction,
  Project,
  ProjectPreset,
  SettingRecord,
} from '../domain/models'

export class BudgetDatabase extends Dexie {
  cycles!: Table<Cycle, string>
  projects!: Table<Project, string>
  projectPresets!: Table<ProjectPreset, string>
  transactions!: Table<LedgerTransaction, string>
  settings!: Table<SettingRecord, string>

  constructor(name = 'budget-calendar') {
    super(name)
    this.version(1).stores({
      cycles: '&id, startDate, endDate, expectedNextPayDate, status',
      projects: '&id, expenseType, sortOrder, isActive',
      projectPresets: '&id, projectId, sortOrder',
      transactions: '&id, cycleId, projectId, localDate, [cycleId+localDate]',
      settings: '&key',
    })
  }
}
