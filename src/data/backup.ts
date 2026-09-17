import type {
  Cycle,
  LedgerTransaction,
  Project,
  ProjectPreset,
  SettingRecord,
} from '../domain/models'
import { z } from 'zod'
import { calculateCycleProjection } from '../domain/budgetEngine'
import type { DateKey } from '../domain/dateKey'
import { addDays } from '../domain/dateKey'
import type { BudgetDatabase } from './db'
import { replaceAllData } from './repositories'

export interface BackupPayloadV1 {
  format: 'budget-calendar-backup'
  version: 1
  exportedAt: string
  cycles: Cycle[]
  projects: Project[]
  projectPresets: ProjectPreset[]
  transactions: LedgerTransaction[]
  settings: SettingRecord[]
}

const dateKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    try {
      return addDays(value as DateKey, 0) === value
    } catch {
      return false
    }
  }, 'Invalid local date')

const timestampSchema = z.string().datetime()
const positiveCentsSchema = z.number().int().positive()

const cycleSchema = z.object({
  id: z.string().min(1),
  startDate: dateKeySchema,
  endDate: dateKeySchema,
  expectedNextPayDate: dateKeySchema,
  totalBudgetCents: positiveCentsSchema,
  status: z.enum(['active', 'archived']),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})

const projectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  icon: z.string(),
  color: z.string(),
  expenseType: z.enum(['budget', 'fixed']),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})

const presetSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  amountCents: positiveCentsSchema,
  sortOrder: z.number().int(),
})

const transactionSchema = z.object({
  id: z.string().min(1),
  cycleId: z.string().min(1),
  projectId: z.string().min(1),
  expenseType: z.enum(['budget', 'fixed']),
  amountCents: positiveCentsSchema,
  localDate: dateKeySchema,
  note: z.string(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})

const settingSchema = z.object({ key: z.string().min(1), value: z.unknown() })

const backupSchema = z
  .object({
    format: z.literal('budget-calendar-backup'),
    version: z.literal(1),
    exportedAt: timestampSchema,
    cycles: z.array(cycleSchema),
    projects: z.array(projectSchema),
    projectPresets: z.array(presetSchema),
    transactions: z.array(transactionSchema),
    settings: z.array(settingSchema),
  })
  .superRefine((payload, context) => {
    const unique = (values: string[], label: string) => {
      if (new Set(values).size !== values.length) {
        context.addIssue({ code: 'custom', message: `Duplicate ${label} ID` })
      }
    }
    unique(payload.cycles.map((item) => item.id), 'cycle')
    unique(payload.projects.map((item) => item.id), 'project')
    unique(payload.projectPresets.map((item) => item.id), 'preset')
    unique(payload.transactions.map((item) => item.id), 'transaction')
    unique(payload.settings.map((item) => item.key), 'setting')

    const cycleById = new Map(payload.cycles.map((item) => [item.id, item]))
    const projectIds = new Set(payload.projects.map((item) => item.id))
    if (payload.cycles.filter((item) => item.status === 'active').length > 1) {
      context.addIssue({ code: 'custom', message: 'Only one active cycle is allowed' })
    }
    for (const cycle of payload.cycles) {
      if (cycle.expectedNextPayDate <= cycle.startDate || cycle.endDate < cycle.startDate) {
        context.addIssue({ code: 'custom', message: `Invalid date range for cycle ${cycle.id}` })
      }
      if (
        cycle.status === 'active' &&
        cycle.endDate !== addDays(cycle.expectedNextPayDate as DateKey, -1)
      ) {
        context.addIssue({ code: 'custom', message: `Active cycle ${cycle.id} end mismatch` })
      }
    }
    for (const preset of payload.projectPresets) {
      if (!projectIds.has(preset.projectId)) {
        context.addIssue({ code: 'custom', message: `Unknown project for preset ${preset.id}` })
      }
    }
    for (const entry of payload.transactions) {
      const cycle = cycleById.get(entry.cycleId)
      if (!cycle) {
        context.addIssue({ code: 'custom', message: `Unknown cycle for transaction ${entry.id}` })
      } else if (entry.localDate < cycle.startDate || entry.localDate > cycle.endDate) {
        context.addIssue({ code: 'custom', message: `Transaction ${entry.id} is outside its cycle` })
      }
      if (!projectIds.has(entry.projectId)) {
        context.addIssue({ code: 'custom', message: `Unknown project for transaction ${entry.id}` })
      }
    }
  })

function validatePayload(value: unknown): BackupPayloadV1 {
  return backupSchema.parse(value) as BackupPayloadV1
}

export async function exportBackup(db: BudgetDatabase): Promise<BackupPayloadV1> {
  const [cycles, projects, projectPresets, transactions, settings] = await Promise.all([
    db.cycles.toArray(),
    db.projects.toArray(),
    db.projectPresets.toArray(),
    db.transactions.toArray(),
    db.settings.toArray(),
  ])
  return {
    format: 'budget-calendar-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    cycles,
    projects,
    projectPresets,
    transactions,
    settings,
  }
}

export function parseBackup(text: string): BackupPayloadV1 {
  return validatePayload(JSON.parse(text))
}

export async function restoreBackup(
  db: BudgetDatabase,
  payload: BackupPayloadV1,
): Promise<void> {
  const validated = validatePayload(payload)
  await exportBackup(db)
  for (const cycle of validated.cycles) {
    calculateCycleProjection(
      cycle,
      validated.transactions.filter((entry) => entry.cycleId === cycle.id),
      addDays(cycle.endDate, 1),
    )
  }
  await replaceAllData(db, validated)
}
