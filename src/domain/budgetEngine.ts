import type { Cycle, CycleProjection, LedgerTransaction } from './models'
import type { DateKey } from './dateKey'
import { addDays, daysBetween } from './dateKey'
import { distributeCents } from './money'

export function createInitialAllocations(totalBudgetCents: number, dayCount: number): number[] {
  return distributeCents(totalBudgetCents, dayCount)
}

export function calculateCycleProjection(
  cycle: Cycle,
  transactions: LedgerTransaction[],
  asOfDate: DateKey,
): CycleProjection {
  const dayCount = daysBetween(cycle.startDate, cycle.endDate) + 1
  if (dayCount <= 0) throw new RangeError('Cycle end must not precede its start')

  const allocations = createInitialAllocations(cycle.totalBudgetCents, dayCount)
  const dates = allocations.map((_, index) => addDays(cycle.startDate, index))
  const budgetSpentByDate = new Map<DateKey, number>()
  const fixedSpentByDate = new Map<DateKey, number>()

  for (const entry of transactions) {
    if (entry.cycleId !== cycle.id) continue
    const target = entry.expenseType === 'budget' ? budgetSpentByDate : fixedSpentByDate
    target.set(entry.localDate, (target.get(entry.localDate) ?? 0) + entry.amountCents)
  }

  let carryInCents = 0
  let cumulativeBudgetSpent = 0
  const days = [] as CycleProjection['days']

  for (let index = 0; index < dayCount; index += 1) {
    const date = dates[index]
    const baseBudgetCents = allocations[index]
    const isReached = date <= asOfDate
    const isClosed = date < asOfDate
    const budgetSpentCents = budgetSpentByDate.get(date) ?? 0
    const fixedSpentCents = fixedSpentByDate.get(date) ?? 0
    const effectiveCarryIn = isReached ? carryInCents : 0
    const availableCents = Math.max(0, baseBudgetCents + effectiveCarryIn)
    cumulativeBudgetSpent += budgetSpentCents
    const overspentCents = isReached ? Math.max(0, budgetSpentCents - availableCents) : 0
    const remainder = isReached ? Math.max(0, availableCents - budgetSpentCents) : 0

    days.push({
      date,
      dayIndex: index,
      weekIndex: Math.floor(index / 7),
      baseBudgetCents,
      carryInCents: effectiveCarryIn,
      availableCents,
      budgetSpentCents,
      fixedSpentCents,
      carryOutCents: remainder,
      overspentCents,
    })

    if (!isReached) continue

    if (budgetSpentCents > availableCents) {
      const remaining = Math.max(0, cycle.totalBudgetCents - cumulativeBudgetSpent)
      const futureCount = dayCount - index - 1
      if (futureCount > 0) {
        allocations.splice(index + 1, futureCount, ...distributeCents(remaining, futureCount))
      }
      carryInCents = 0
      continue
    }

    if (!isClosed) {
      carryInCents = 0
      continue
    }

    const isWeekEnd = index % 7 === 6
    if (isWeekEnd && index < dayCount - 1) {
      const nextWeekStart = index + 1
      const nextWeekLength = Math.min(7, dayCount - nextWeekStart)
      const nextWeekTotal =
        allocations
          .slice(nextWeekStart, nextWeekStart + nextWeekLength)
          .reduce((sum, value) => sum + value, 0) + remainder
      allocations.splice(
        nextWeekStart,
        nextWeekLength,
        ...distributeCents(nextWeekTotal, nextWeekLength),
      )
      carryInCents = 0
    } else {
      carryInCents = remainder
    }
  }

  const budgetSpentCents = transactions
    .filter((entry) => entry.cycleId === cycle.id && entry.expenseType === 'budget')
    .reduce((sum, entry) => sum + entry.amountCents, 0)
  const fixedSpentCents = transactions
    .filter((entry) => entry.cycleId === cycle.id && entry.expenseType === 'fixed')
    .reduce((sum, entry) => sum + entry.amountCents, 0)
  const balanceCents = cycle.totalBudgetCents - budgetSpentCents

  return {
    cycleId: cycle.id,
    days,
    budgetSpentCents,
    fixedSpentCents,
    remainingBudgetCents: Math.max(0, balanceCents),
    surplusCents: Math.max(0, balanceCents),
    overspendCents: Math.max(0, -balanceCents),
  }
}
