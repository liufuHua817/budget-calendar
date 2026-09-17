import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { BudgetAppProvider } from '../../app/AppStore'
import { AppRoutes } from '../../app/router'
import { BudgetDatabase } from '../../data/db'
import type { LedgerTransaction, Project } from '../../domain/models'
import { createFirstCycle } from '../../services/cycleService'

const databases: BudgetDatabase[] = []

async function setup() {
  const database = new BudgetDatabase(`day-test-${crypto.randomUUID()}`)
  databases.push(database)
  const cycle = await createFirstCycle(database, '2026-09-16', '2026-10-16', 150_000)
  const projects: Project[] = [
    { id: 'food', name: '餐饮', icon: 'utensils', color: '#ff8b5c', expenseType: 'budget', sortOrder: 0, isActive: true, createdAt: '2026-09-16T00:00:00Z', updatedAt: '2026-09-16T00:00:00Z' },
    { id: 'phone', name: '话费', icon: 'phone', color: '#6b7cff', expenseType: 'fixed', sortOrder: 1, isActive: true, createdAt: '2026-09-16T00:00:00Z', updatedAt: '2026-09-16T00:00:00Z' },
  ]
  await database.projects.bulkAdd(projects)
  const entries: LedgerTransaction[] = [
    { id: 'food-entry', cycleId: cycle.id, projectId: 'food', expenseType: 'budget', amountCents: 3200, localDate: '2026-09-18', note: '午餐', createdAt: '2026-09-18T01:00:00Z', updatedAt: '2026-09-18T01:00:00Z' },
    { id: 'phone-entry', cycleId: cycle.id, projectId: 'phone', expenseType: 'fixed', amountCents: 5000, localDate: '2026-09-18', note: '', createdAt: '2026-09-18T02:00:00Z', updatedAt: '2026-09-18T02:00:00Z' },
  ]
  await database.transactions.bulkAdd(entries)
  return database
}

afterEach(async () => Promise.all(databases.splice(0).map((database) => database.delete())))

test('shows daily budget values and separates budget from fixed entries', async () => {
  const database = await setup()
  render(<BudgetAppProvider database={database} today={() => '2026-09-18'}>
    <MemoryRouter initialEntries={['/day/2026-09-18']}><AppRoutes /></MemoryRouter>
  </BudgetAppProvider>)

  expect(await screen.findByRole('heading', { name: '9月18日' })).toBeInTheDocument()
  expect(screen.getByText('基础预算')).toBeInTheDocument()
  expect(screen.getByText('滚入结余')).toBeInTheDocument()
  expect(screen.getByText('今日可用')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: '预算消费' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: '固定支出' })).toBeInTheDocument()
  expect(screen.getByText('餐饮')).toBeInTheDocument()
  expect(screen.getByText('话费')).toBeInTheDocument()
  expect(screen.getByText('不占预算')).toBeInTheDocument()
})

test('deletes an entry only after confirmation', async () => {
  const database = await setup()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  render(<BudgetAppProvider database={database} today={() => '2026-09-18'}>
    <MemoryRouter initialEntries={['/day/2026-09-18']}><AppRoutes /></MemoryRouter>
  </BudgetAppProvider>)
  const user = userEvent.setup()

  await user.click(await screen.findByRole('button', { name: '删除餐饮' }))
  expect(window.confirm).toHaveBeenCalledWith('确定删除这笔账目吗？')
  await waitFor(async () => expect(await database.transactions.get('food-entry')).toBeUndefined())
})
