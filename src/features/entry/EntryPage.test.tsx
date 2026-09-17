import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { BudgetAppProvider } from '../../app/AppStore'
import { AppRoutes } from '../../app/router'
import { BudgetDatabase } from '../../data/db'
import type { Project } from '../../domain/models'
import { createFirstCycle } from '../../services/cycleService'

const databases: BudgetDatabase[] = []
const projects: Project[] = [
  { id: 'food', name: '餐饮', icon: 'utensils', color: '#ff8b5c', expenseType: 'budget', sortOrder: 0, isActive: true, createdAt: '2026-09-16T00:00:00Z', updatedAt: '2026-09-16T00:00:00Z' },
  { id: 'rent', name: '房租', icon: 'house', color: '#6b7cff', expenseType: 'fixed', sortOrder: 1, isActive: true, createdAt: '2026-09-16T00:00:00Z', updatedAt: '2026-09-16T00:00:00Z' },
]

async function setup() {
  const database = new BudgetDatabase(`entry-test-${crypto.randomUUID()}`)
  databases.push(database)
  await createFirstCycle(database, '2026-09-16', '2026-10-16', 150_000)
  await database.projects.bulkAdd(projects)
  await database.projectPresets.add({ id: 'food-1280', projectId: 'food', amountCents: 1280, sortOrder: 0 })
  return database
}

function renderAt(database: BudgetDatabase, path = '/entry') {
  return render(<BudgetAppProvider database={database} today={() => '2026-09-18'}>
    <MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>
  </BudgetAppProvider>)
}

afterEach(async () => Promise.all(databases.splice(0).map((database) => database.delete())))

describe('manual entry', () => {
  test('saves a custom budget expense in integer cents', async () => {
    const database = await setup()
    renderAt(database)
    const user = userEvent.setup()

    expect(await screen.findByRole('heading', { name: '记一笔' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '预算消费' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: '餐饮' }))
    await user.type(screen.getByLabelText('金额'), '53.58')
    await user.clear(screen.getByLabelText('日期'))
    await user.type(screen.getByLabelText('日期'), '2026-09-17')
    await user.type(screen.getByLabelText('备注'), '晚餐')
    await user.click(screen.getByRole('button', { name: '保存账目' }))

    await waitFor(async () => {
      expect(await database.transactions.count()).toBe(1)
      expect((await database.transactions.toArray())[0]).toMatchObject({
        projectId: 'food', expenseType: 'budget', amountCents: 5358,
        localDate: '2026-09-17', note: '晚餐',
      })
    })
  })

  test('switches to fixed spending and supports project presets', async () => {
    const database = await setup()
    renderAt(database)
    const user = userEvent.setup()

    await screen.findByRole('heading', { name: '记一笔' })
    await user.click(screen.getByRole('button', { name: '餐饮 ¥12.80' }))
    expect(screen.getByLabelText('金额')).toHaveValue('12.80')
    await user.click(screen.getByRole('button', { name: '固定支出' }))
    expect(screen.getByRole('button', { name: '固定支出' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '房租' })).toBeInTheDocument()
  })

  test('shows validation instead of saving an invalid amount', async () => {
    const database = await setup()
    renderAt(database)
    const user = userEvent.setup()
    await screen.findByRole('heading', { name: '记一笔' })
    await user.click(screen.getByRole('button', { name: '保存账目' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('请输入有效金额')
    expect(await database.transactions.count()).toBe(0)
  })
})
