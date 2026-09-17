import { createContext, useContext } from 'react'
import type { BackupPayloadV1 } from '../data/backup'
import type { DateKey } from '../domain/dateKey'
import type {
  Cycle,
  CycleProjection,
  ExpenseType,
  LedgerTransaction,
  Project,
  ProjectPreset,
} from '../domain/models'
import type { CycleAttentionState } from '../services/cycleService'
import type { RecordTransactionInput, UpdateTransactionInput } from '../services/transactionService'

export interface BudgetAppValue {
  loading: boolean
  today: DateKey
  cycle?: Cycle
  cycles: Cycle[]
  projects: Project[]
  presets: ProjectPreset[]
  transactions: LedgerTransaction[]
  allTransactions: LedgerTransaction[]
  projection?: CycleProjection
  attentionState?: CycleAttentionState
  refresh(): Promise<void>
  createFirstCycle(startDate: DateKey, expectedNextPayDate: DateKey, budgetCents: number): Promise<void>
  rescheduleExpectedPayday(expectedNextPayDate: DateKey): Promise<void>
  startNextCycle(input: {
    actualStartDate: DateKey
    expectedNextPayDate: DateKey
    budgetCents: number
  }): Promise<void>
  addTransaction(input: RecordTransactionInput): Promise<LedgerTransaction>
  editTransaction(id: string, patch: UpdateTransactionInput): Promise<void>
  removeTransaction(id: string): Promise<void>
  saveProject(input: {
    id?: string
    name: string
    icon: string
    color: string
    expenseType: ExpenseType
    presetAmountsCents: number[]
  }): Promise<void>
  deactivateProject(id: string): Promise<void>
  moveProject(id: string, direction: -1 | 1): Promise<void>
  createBackup(): Promise<BackupPayloadV1>
  restoreFromBackup(payload: BackupPayloadV1): Promise<void>
}

export const BudgetAppContext = createContext<BudgetAppValue | undefined>(undefined)

export function useBudgetApp() {
  const value = useContext(BudgetAppContext)
  if (!value) throw new Error('useBudgetApp must be used inside BudgetAppProvider')
  return value
}
