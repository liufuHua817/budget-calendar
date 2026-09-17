import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { BudgetAppProvider } from '../../app/AppStore'
import { AppRoutes } from '../../app/router'
import { BudgetDatabase } from '../../data/db'
import type { LedgerTransaction, Project } from '../../domain/models'
import { createFirstCycle } from '../../services/cycleService'
import type { DateKey } from '../../domain/dateKey'
import Dexie from 'dexie'

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

function renderHome(database: BudgetDatabase, today: DateKey = '2026-09-18') {
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
    expect(within(screen.getByRole('region', { name: '预算概览' })).getByText('今日已超支')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: '预算概览' })).getByText('¥23.60')).toBeInTheDocument()
    expect(screen.getByText('¥1,326.40')).toBeInTheDocument()
    expect(screen.getByText('28 天')).toBeInTheDocument()
    expect(container.querySelectorAll('[data-calendar-day]')).toHaveLength(15)
    expect(container.querySelector('[data-date="2026-09-18"]')).toHaveAttribute('aria-current', 'date')
    await userEvent.click(screen.getByRole('button', { name: '下个月' }))
    expect(container.querySelectorAll('[data-calendar-day]')).toHaveLength(15)
    expect(container.querySelector('[data-date="2026-10-15"]')).toBeInTheDocument()
  })

  test('renders 31 cells when the salary interval has 31 days', async () => {
    const database = createDatabase()
    await createFirstCycle(database, '2026-09-16', '2026-10-17', 155_000)
    const { container } = renderHome(database)
    await screen.findByRole('heading', { name: '预算日历' })
    expect(container.querySelectorAll('[data-calendar-day]')).toHaveLength(15)
    await userEvent.click(screen.getByRole('button', { name: '下个月' }))
    expect(container.querySelectorAll('[data-calendar-day]')).toHaveLength(16)
  })

  test('records a preset with one tap and offers undo', async () => {
    const database = createDatabase()
    await seedThirtyDayCycle(database)
    renderHome(database)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: '地铁 ¥3.60' }))

    expect(await screen.findByRole('status')).toHaveTextContent('已记录')
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

  test('keeps the page mounted while saving, updates remaining money and really undoes the entry', async () => {
    const database = createDatabase()
    await createFirstCycle(database, '2026-09-16', '2026-10-16', 150_000)
    await database.projects.add(project)
    await database.projectPresets.add({ id: 'metro-270', projectId: project.id, amountCents: 270, sortOrder: 0 })
    renderHome(database, '2026-09-16')
    const heading = await screen.findByRole('heading', { name: '预算日历' })
    const read = database.transactions.toArray.bind(database.transactions)
    const delayedRead = vi.spyOn(database.transactions, 'toArray').mockImplementation(() =>
      Dexie.Promise.resolve(new Promise((resolve) => setTimeout(resolve, 60))).then(() => read()))
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '地铁 ¥2.70' }))
    expect(screen.getByRole('heading', { name: '预算日历' })).toBe(heading)
    expect(await screen.findByRole('status')).toHaveTextContent('地铁')
    expect(within(screen.getByRole('region', { name: '预算概览' })).getByText('¥47.30')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '撤销' }))
    await waitFor(async () => expect(await database.transactions.count()).toBe(0))
    await waitFor(() => expect(screen.queryByRole('button', { name: '撤销' })).not.toBeInTheDocument())
    delayedRead.mockRestore()
  })

  test('keeps seven shortcuts visible and makes overflow presets usable without leaving home', async () => {
    const database = createDatabase()
    await createFirstCycle(database, '2026-09-16', '2026-10-16', 150_000)
    await database.projects.add(project)
    await database.projectPresets.bulkAdd(Array.from({ length: 10 }, (_, i) => ({
      id: `preset-${i}`, projectId: project.id, amountCents: (i + 1) * 100, sortOrder: i,
    })))
    renderHome(database)
    const user = userEvent.setup()
    await screen.findByRole('heading', { name: '预算日历' })
    expect(screen.getByRole('button', { name: '地铁 ¥7.00' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '地铁 ¥8.00' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '展开全部快捷记账' }))
    await user.click(screen.getByRole('button', { name: '地铁 ¥10.00' }))
    await waitFor(async () => expect((await database.transactions.toArray())[0].amountCents).toBe(1000))
    expect(screen.getByRole('heading', { name: '预算日历' })).toBeInTheDocument()
  })
})
