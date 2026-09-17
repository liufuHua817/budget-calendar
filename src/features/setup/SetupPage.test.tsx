import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { BudgetAppProvider } from '../../app/AppStore'
import { AppRoutes } from '../../app/router'
import { BudgetDatabase } from '../../data/db'
import { createFirstCycle } from '../../services/cycleService'

const databases: BudgetDatabase[] = []

function createDatabase() {
  const database = new BudgetDatabase(`setup-test-${crypto.randomUUID()}`)
  databases.push(database)
  return database
}

function renderApp(database: BudgetDatabase, initialPath = '/') {
  return render(
    <BudgetAppProvider database={database} today={() => '2026-09-16'}>
      <MemoryRouter initialEntries={[initialPath]}>
        <AppRoutes />
      </MemoryRouter>
    </BudgetAppProvider>,
  )
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.delete()))
})

describe('first-run setup', () => {
  test('routes an empty database to salary-cycle setup', async () => {
    renderApp(createDatabase())

    expect(await screen.findByRole('heading', { name: '开始第一个发薪周期' })).toBeInTheDocument()
    expect(screen.getByLabelText('本次工资到账日')).toHaveValue('2026-09-16')
    expect(screen.getByLabelText('下次预计发薪日')).toHaveValue('2026-10-16')
    expect(screen.getByLabelText('本周期可花预算')).toBeInTheDocument()
    expect(screen.getByText(/工资 - 房租 - 还款 - 固定账单 - 应急预留/)).toBeInTheDocument()
  })

  test('creates the first cycle and returns to the budget home', async () => {
    const database = createDatabase()
    renderApp(database)
    const user = userEvent.setup()

    await user.type(await screen.findByLabelText('本周期可花预算'), '1500')
    await user.click(screen.getByRole('button', { name: '开始记账' }))

    expect(await screen.findByRole('heading', { name: '预算日历' })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: '记账' }))
    expect(await screen.findByRole('button', { name: '餐饮' })).toBeInTheDocument()
    await user.type(screen.getByLabelText('金额'), '20')
    await user.click(screen.getByRole('button', { name: '保存账目' }))
    await waitFor(async () => expect(await database.transactions.count()).toBe(1))
    await waitFor(async () => {
      expect((await database.cycles.toArray())[0]).toMatchObject({
        startDate: '2026-09-16',
        expectedNextPayDate: '2026-10-16',
        totalBudgetCents: 150_000,
      })
    })
  })

  test('routes an existing current cycle to the home screen', async () => {
    const database = createDatabase()
    await createFirstCycle(database, '2026-09-16', '2026-10-16', 150_000)
    renderApp(database)

    expect(await screen.findByRole('heading', { name: '预算日历' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '开始第一个发薪周期' })).not.toBeInTheDocument()
  })
})
