import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { BudgetAppProvider } from '../../app/AppStore'
import { AppRoutes } from '../../app/router'
import { BudgetDatabase } from '../../data/db'
import type { LedgerTransaction, Project } from '../../domain/models'
import { createFirstCycle } from '../../services/cycleService'

const databases: BudgetDatabase[] = []

function createDatabase() {
  const database = new BudgetDatabase(`home-test-${crypto.randomUUID()}`)
  databases.push(database)
  return database
}

const project: Project = {
  id: 'metro',
  name: '地铁',
  icon: 'train',
  color: '#246bfe',
  expenseType: 'budget',
  sortOrder: 0,
  isActive: true,
  createdAt: '2026-09-16T00:00:00.000Z',
  updatedAt: '2026-09-16T00:00:00.000Z',
}

async function seedThirtyDayCycle(database: BudgetDatabase) {
  const cycle = await createFirstCycle(database, '2026-09-16', '2026-10-16', 150_000)
  await database.projects.add(project)
  await database.projectPresets.bulkAdd([
    { id: 'metro-270', projectId: project.id, amountCents: 270, sortOrder: 0 },
    { id: 'metro-360', projectId: project.id, amountCents: 360, sortOrder: 1 },
  ])
  const amounts = [4000, 4783, 8577]
  const dates = ['2026-09-16', '2026-09-17', '2026-09-18'] as const
  const transactions: LedgerTransaction[] = amounts.map((amountCents, index) => ({
    id: `entry-${index}`,
    cycleId: cycle.id,
    projectId: project.id,
    expenseType: 'budget',
    amountCents,
    localDate: dates[index],
    note: '',
    createdAt: `2026-09-${16 + index}T01:00:00.000Z`,
    updatedAt: `2026-09-${16 + index}T01:00:00.000Z`,
  }))
  await database.transactions.bulkAdd(transactions)
}

function renderHome(database: BudgetDatabase, today = '2026-09-18' as const) {
  return render(<BudgetAppProvider database={database} today={() => today}>
    <MemoryRouter><AppRoutes /></MemoryRouter>
  </BudgetAppProvider>)
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.delete()))
})

describe('hybrid home', () => {
  test('shows the exact daily summary and every day in a variable cycle', async () => {
    const database = createDatabase()
    await seedThirtyDayCycle(database)
    const { container } = renderHome(database)

    expect(await screen.findByRole('heading', { name: '预算日历' })).toBeInTheDocument()
    expect(screen.getByText('¥62.17')).toBeInTheDocument()
    expect(screen.getByText('¥1,326.40')).toBeInTheDocument()
    expect(screen.getByText('剩余 28 天')).toBeInTheDocument()
    expect(container.querySelectorAll('[data-calendar-day]')).toHaveLength(30)
    expect(container.querySelectorAll('[data-week="5"]')).toHaveLength(2)
    expect(container.querySelector('[data-date="2026-09-18"]')).toHaveAttribute('aria-current', 'date')
  })

  test('renders 31 cells when the salary interval has 31 days', async () => {
    const database = createDatabase()
    await createFirstCycle(database, '2026-09-16', '2026-10-17', 155_000)
    const { container } = renderHome(database)
    await screen.findByRole('heading', { name: '预算日历' })
    expect(container.querySelectorAll('[data-calendar-day]')).toHaveLength(31)
    expect(container.querySelectorAll('[data-week="5"]')).toHaveLength(3)
  })

  test('records a preset with one tap and offers undo', async () => {
    const database = createDatabase()
    await seedThirtyDayCycle(database)
    renderHome(database)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: '地铁 ¥3.60' }))

    expect(await screen.findByText('已记录')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '撤销' })).toBeInTheDocument()
    await waitFor(async () => {
      const matching = (await database.transactions.toArray()).filter((entry) => entry.amountCents === 360)
      expect(matching).toHaveLength(1)
      expect(matching[0]).toMatchObject({
        projectId: 'metro',
        expenseType: 'budget',
        localDate: '2026-09-18',
      })
    })
  })
})
