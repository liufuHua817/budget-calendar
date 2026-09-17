import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import { BudgetDatabase } from '../data/db'
import { exportBackup, restoreBackup, type BackupPayloadV1 } from '../data/backup'
import { getActiveCycle, getTransactionsForCycle } from '../data/repositories'
import { calculateCycleProjection } from '../domain/budgetEngine'
import type { DateKey } from '../domain/dateKey'
import type { Cycle, ExpenseType, LedgerTransaction, Project, ProjectPreset } from '../domain/models'
import {
  confirmPaydayAndStartNextCycle,
  createFirstCycle as createFirstCycleRecord,
  getCycleAttentionState,
  rescheduleExpectedPayday as rescheduleCycle,
} from '../services/cycleService'
import {
  deleteTransaction,
  recordTransaction,
  updateTransaction,
  type RecordTransactionInput,
  type UpdateTransactionInput,
} from '../services/transactionService'
import { BudgetAppContext, type BudgetAppValue } from './BudgetAppContext'
const defaultDatabase = new BudgetDatabase()

function localToday(): DateKey {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}` as DateKey
}

interface BudgetAppProviderProps {
  database?: BudgetDatabase
  today?: () => DateKey
}

async function readSnapshot(database: BudgetDatabase) {
  const [cycle, cycles, projects, presets, allTransactions] = await Promise.all([
    getActiveCycle(database),
    database.cycles.orderBy('startDate').reverse().toArray(),
    database.projects.orderBy('sortOrder').toArray(),
    database.projectPresets.orderBy('sortOrder').toArray(),
    database.transactions.toArray(),
  ])
  const transactions = cycle ? await getTransactionsForCycle(database, cycle.id) : []
  return { cycle, cycles, projects, presets, transactions, allTransactions }
}

export function BudgetAppProvider({
  children,
  database = defaultDatabase,
  today: getToday = localToday,
}: PropsWithChildren<BudgetAppProviderProps>) {
  const today = getToday()
  const [loading, setLoading] = useState(true)
  const [cycle, setCycle] = useState<Cycle>()
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [presets, setPresets] = useState<ProjectPreset[]>([])
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([])
  const [allTransactions, setAllTransactions] = useState<LedgerTransaction[]>([])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const snapshot = await readSnapshot(database)
      setCycle(snapshot.cycle)
      setCycles(snapshot.cycles)
      setProjects(snapshot.projects)
      setPresets(snapshot.presets)
      setTransactions(snapshot.transactions)
      setAllTransactions(snapshot.allTransactions)
    } finally {
      setLoading(false)
    }
  }, [database])

  useEffect(() => {
    let cancelled = false
    async function loadInitialSnapshot() {
      const snapshot = await readSnapshot(database)
      if (cancelled) return
      setCycle(snapshot.cycle)
      setCycles(snapshot.cycles)
      setProjects(snapshot.projects)
      setPresets(snapshot.presets)
      setTransactions(snapshot.transactions)
      setAllTransactions(snapshot.allTransactions)
      setLoading(false)
    }
    void loadInitialSnapshot()
    return () => { cancelled = true }
  }, [database])

  const createFirstCycle = useCallback(
    async (startDate: DateKey, expectedNextPayDate: DateKey, budgetCents: number) => {
      await createFirstCycleRecord(database, startDate, expectedNextPayDate, budgetCents)
      await refresh()
    },
    [database, refresh],
  )

  const rescheduleExpectedPayday = useCallback(
    async (expectedNextPayDate: DateKey) => {
      if (!cycle) throw new Error('没有正在进行的周期')
      await rescheduleCycle(database, cycle.id, expectedNextPayDate)
      await refresh()
    },
    [cycle, database, refresh],
  )

  const startNextCycle = useCallback(
    async (input: {
      actualStartDate: DateKey
      expectedNextPayDate: DateKey
      budgetCents: number
    }) => {
      if (!cycle) throw new Error('没有正在进行的周期')
      await confirmPaydayAndStartNextCycle(database, {
        activeCycleId: cycle.id,
        actualStartDate: input.actualStartDate,
        expectedNextPayDate: input.expectedNextPayDate,
        totalBudgetCents: input.budgetCents,
      })
      await refresh()
    },
    [cycle, database, refresh],
  )

  const addTransaction = useCallback(async (input: RecordTransactionInput) => {
    const transaction = await recordTransaction(database, input)
    await refresh()
    return transaction
  }, [database, refresh])

  const editTransaction = useCallback(async (id: string, patch: UpdateTransactionInput) => {
    await updateTransaction(database, id, patch)
    await refresh()
  }, [database, refresh])

  const removeTransaction = useCallback(async (id: string) => {
    await deleteTransaction(database, id)
    await refresh()
  }, [database, refresh])

  const saveProject = useCallback(async (input: {
    id?: string
    name: string
    icon: string
    color: string
    expenseType: ExpenseType
    presetAmountsCents: number[]
  }) => {
    const name = input.name.trim()
    if (!name) throw new Error('项目名称不能为空')
    if (input.presetAmountsCents.some((amount) => !Number.isSafeInteger(amount) || amount <= 0)) {
      throw new Error('预设金额必须大于 0')
    }
    const duplicate = await database.projects.filter((project) =>
      project.isActive && project.name === name && project.id !== input.id).first()
    if (duplicate) throw new Error('项目名称不能重复')
    const now = new Date().toISOString()
    const existing = input.id ? await database.projects.get(input.id) : undefined
    const id = existing?.id ?? crypto.randomUUID()
    const project: Project = {
      id,
      name,
      icon: input.icon,
      color: input.color,
      expenseType: input.expenseType,
      sortOrder: existing?.sortOrder ?? await database.projects.count(),
      isActive: true,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    await database.transaction('rw', [database.projects, database.projectPresets], async () => {
      await database.projects.put(project)
      await database.projectPresets.where('projectId').equals(id).delete()
      if (input.presetAmountsCents.length) {
        await database.projectPresets.bulkAdd(input.presetAmountsCents.map((amountCents, index) => ({
          id: crypto.randomUUID(), projectId: id, amountCents, sortOrder: index,
        })))
      }
    })
    await refresh()
  }, [database, refresh])

  const deactivateProject = useCallback(async (id: string) => {
    await database.projects.update(id, { isActive: false, updatedAt: new Date().toISOString() })
    await refresh()
  }, [database, refresh])

  const moveProject = useCallback(async (id: string, direction: -1 | 1) => {
    const ordered = await database.projects.orderBy('sortOrder').toArray()
    const index = ordered.findIndex((project) => project.id === id)
    const target = ordered[index + direction]
    const current = ordered[index]
    if (!current || !target) return
    await database.transaction('rw', database.projects, async () => {
      await database.projects.update(current.id, { sortOrder: target.sortOrder })
      await database.projects.update(target.id, { sortOrder: current.sortOrder })
    })
    await refresh()
  }, [database, refresh])

  const createBackup = useCallback(() => exportBackup(database), [database])
  const restoreFromBackup = useCallback(async (payload: BackupPayloadV1) => {
    await restoreBackup(database, payload)
    await refresh()
  }, [database, refresh])

  const value = useMemo<BudgetAppValue>(() => ({
    loading,
    today,
    cycle,
    cycles,
    projects,
    presets,
    transactions,
    allTransactions,
    projection: cycle ? calculateCycleProjection(cycle, transactions, today) : undefined,
    attentionState: cycle ? getCycleAttentionState(cycle, today) : undefined,
    refresh,
    createFirstCycle,
    rescheduleExpectedPayday,
    startNextCycle,
    addTransaction,
    editTransaction,
    removeTransaction,
    saveProject,
    deactivateProject,
    moveProject,
    createBackup,
    restoreFromBackup,
  }), [
    loading, today, cycle, cycles, projects, presets, transactions, allTransactions, refresh,
    createFirstCycle, rescheduleExpectedPayday, startNextCycle,
    addTransaction, editTransaction, removeTransaction,
    saveProject, deactivateProject, moveProject, createBackup, restoreFromBackup,
  ])

  return <BudgetAppContext.Provider value={value}>{children}</BudgetAppContext.Provider>
}
