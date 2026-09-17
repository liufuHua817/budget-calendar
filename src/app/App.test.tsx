import { render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { BudgetDatabase } from '../data/db'
import { BudgetAppProvider } from './AppStore'
import { AppRoutes } from './router'

const database = new BudgetDatabase(`app-test-${crypto.randomUUID()}`)
afterEach(async () => database.delete())

test('opens first-run setup when there is no local cycle', async () => {
  render(<BudgetAppProvider database={database} today={() => '2026-09-16'}>
    <MemoryRouter><AppRoutes /></MemoryRouter>
  </BudgetAppProvider>)
  expect(await screen.findByRole('heading', { name: '开始第一个发薪周期' })).toBeInTheDocument()
})
