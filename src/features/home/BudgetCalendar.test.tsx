import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import { BudgetCalendar } from './BudgetCalendar'
import type { CycleProjection, DailyProjection } from '../../domain/models'

function day(date: DailyProjection['date'], available: number, spent: number): DailyProjection {
  return { date, dayIndex: 0, weekIndex: 0, baseBudgetCents: available, carryInCents: 0,
    availableCents: available, budgetSpentCents: spent, fixedSpentCents: 0,
    carryOutCents: Math.max(0, available - spent), overspentCents: Math.max(0, spent - available) }
}

test('shows signed daily balances, provisional today and no future surplus; aligns real weekdays', async () => {
  const projection: CycleProjection = { cycleId: 'cycle', budgetSpentCents: 0, fixedSpentCents: 0,
    remainingBudgetCents: 10000, surplusCents: 10000, overspendCents: 0,
    days: [day('2026-09-15', 5000, 4200), day('2026-09-16', 5000, 6200),
      day('2026-09-17', 5000, 2000), day('2026-09-18', 5000, 0), day('2026-10-01', 5000, 0)] }
  const { container } = render(<MemoryRouter><BudgetCalendar projection={projection} today="2026-09-17" /></MemoryRouter>)
  expect(screen.getByRole('link', { name: '9月15日，结余8元' })).toHaveTextContent('+8')
  expect(screen.getByRole('link', { name: '9月16日，超支12元' })).toHaveTextContent('−12')
  expect(screen.getByRole('link', { name: '9月17日，今日暂余30元' })).toHaveAttribute('aria-current', 'date')
  expect(screen.getByRole('link', { name: '9月18日，未到' })).toHaveTextContent('—')
  expect(container.querySelector('.calendar-grid')?.children[1]).toHaveTextContent('1')
  await userEvent.click(screen.getByRole('button', { name: '下个月' }))
  expect(screen.getByRole('link', { name: '10月1日，未到' })).toHaveAttribute('href', '/day/2026-10-01')
  expect(screen.getByRole('button', { name: '下个月' })).toBeDisabled()
})
