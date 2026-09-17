import { render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { BudgetAppProvider } from '../../app/AppStore'
import { AppRoutes } from '../../app/router'
import { BudgetDatabase } from '../../data/db'
import type { LedgerTransaction, Project } from '../../domain/models'
import { createFirstCycle } from '../../services/cycleService'

const databases: BudgetDatabase[] = []

async function seed() {
  const database = new BudgetDatabase(`history-test-${crypto.randomUUID()}`)
  databases.push(database)
  const cycle = await createFirstCycle(database, '2026-09-16', '2026-10-16', 150_000)
  const projects: Project[] = [
    { id: 'food', name: '餐饮', icon: 'food', color: '#ff8b5c', expenseType: 'budget', sortOrder: 0, isActive: true, createdAt: '', updatedAt: '' },
    { id: 'metro', name: '地铁', icon: 'train', color: '#246bfe', expenseType: 'budget', sortOrder: 1, isActive: true, createdAt: '', updatedAt: '' },
    { id: 'phone', name: '话费', icon: 'phone', color: '#7b61ff', expenseType: 'fixed', sortOrder: 2, isActive: true, createdAt: '', updatedAt: '' },
  ]
  await database.projects.bulkAdd(projects)
  const transactions: LedgerTransaction[] = [
    { id: 'a', cycleId: cycle.id, projectId: 'food', expenseType: 'budget', amountCents: 10000, localDate: '2026-09-18', note: '', createdAt: '', updatedAt: '' },
    { id: 'b', cycleId: cycle.id, projectId: 'metro', expenseType: 'budget', amountCents: 7360, localDate: '2026-10-15', note: '', createdAt: '', updatedAt: '' },
    { id: 'c', cycleId: cycle.id, projectId: 'phone', expenseType: 'fixed', amountCents: 500000, localDate: '2026-09-18', note: '', createdAt: '', updatedAt: '' },
  ]
  await database.transactions.bulkAdd(transactions)
  return database
}

afterEach(async () => Promise.all(databases.splice(0).map((database) => database.delete())))

test('shows independent cycle totals, five actual weeks, and project totals', async () => {
  const database = await seed()
  const { container } = render(<BudgetAppProvider database={database} today={() => '2026-10-15'}>
    <MemoryRouter initialEntries={['/history']}><AppRoutes /></MemoryRouter>
  </BudgetAppProvider>)

  expect(await screen.findByRole('heading', { name: '周期统计' })).toBeInTheDocument()
  expect(screen.getByText('¥1,500.00')).toBeInTheDocument()
  expect(screen.getByText('¥173.60')).toBeInTheDocument()
  expect(screen.getByText('¥1,326.40')).toBeInTheDocument()
  expect(screen.getByText('¥5,000.00')).toBeInTheDocument()
  expect(screen.getByText('不占预算')).toBeInTheDocument()
  expect(container.querySelectorAll('[data-week-bar]')).toHaveLength(5)
  expect(screen.getByText('第5周 · 2天')).toBeInTheDocument()
  expect(screen.getByText('餐饮')).toBeInTheDocument()
  expect(screen.getByText('地铁')).toBeInTheDocument()
  expect(screen.getAllByText('¥100.00')).toHaveLength(2)
  expect(screen.getAllByText('¥73.60')).toHaveLength(2)
})

test('shows full surplus and no misleading category chart without spending', async () => {
  const database = new BudgetDatabase(`history-empty-${crypto.randomUUID()}`)
  databases.push(database)
  await createFirstCycle(database, '2026-09-16', '2026-10-16', 150_000)
  render(<BudgetAppProvider database={database} today={() => '2026-09-18'}>
    <MemoryRouter initialEntries={['/history']}><AppRoutes /></MemoryRouter>
  </BudgetAppProvider>)
  expect(await screen.findByText('本周期还没有预算消费')).toBeInTheDocument()
  expect(screen.getByText('¥1,500.00')).toBeInTheDocument()
})
