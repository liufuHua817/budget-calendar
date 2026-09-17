import type { DateKey } from './dateKey'

export type ExpenseType = 'budget' | 'fixed'
export type CycleStatus = 'active' | 'archived'

export interface Cycle {
  id: string
  startDate: DateKey
  endDate: DateKey
  expectedNextPayDate: DateKey
  totalBudgetCents: number
  status: CycleStatus
  createdAt: string
  updatedAt: string
}

export interface Project {
  id: string
  name: string
  icon: string
  color: string
  expenseType: ExpenseType
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface ProjectPreset {
  id: string
  projectId: string
  amountCents: number
  sortOrder: number
}

export interface LedgerTransaction {
  id: string
  cycleId: string
  projectId: string
  expenseType: ExpenseType
  amountCents: number
  localDate: DateKey
  note: string
  createdAt: string
  updatedAt: string
}

export interface DailyProjection {
  date: DateKey
  dayIndex: number
  weekIndex: number
  baseBudgetCents: number
  carryInCents: number
  availableCents: number
  budgetSpentCents: number
  fixedSpentCents: number
  carryOutCents: number
  overspentCents: number
}

export interface CycleProjection {
  cycleId: string
  days: DailyProjection[]
  budgetSpentCents: number
  fixedSpentCents: number
  remainingBudgetCents: number
  surplusCents: number
  overspendCents: number
}

export interface SettingRecord {
  key: string
  value: unknown
}
