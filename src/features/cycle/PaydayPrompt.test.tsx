import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import type { Cycle, LedgerTransaction } from '../../domain/models'
import { PaydayPrompt } from './PaydayPrompt'

const cycle: Cycle = {
  id: 'cycle-1',
  startDate: '2026-09-16',
  endDate: '2026-10-15',
  expectedNextPayDate: '2026-10-16',
  totalBudgetCents: 150_000,
  status: 'active',
  createdAt: '2026-09-16T00:00:00.000Z',
  updatedAt: '2026-09-16T00:00:00.000Z',
}

const sameDayEntry: LedgerTransaction = {
  id: 'entry-1',
  cycleId: cycle.id,
  projectId: 'metro',
  expenseType: 'budget',
  amountCents: 360,
  localDate: '2026-10-16',
  note: '',
  createdAt: cycle.createdAt,
  updatedAt: cycle.updatedAt,
}

describe('payday confirmation', () => {
  test('reschedules the current cycle when salary has not arrived', async () => {
    const onReschedule = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(
      <PaydayPrompt
        cycle={cycle}
        today="2026-10-16"
        transactions={[]}
        onReschedule={onReschedule}
        onStartNextCycle={vi.fn()}
      />,
    )

    expect(screen.getByRole('heading', { name: '工资到账了吗？' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '还未到账' }))
    await user.clear(screen.getByLabelText('新的预计发薪日'))
    await user.type(screen.getByLabelText('新的预计发薪日'), '2026-10-18')
    await user.click(screen.getByRole('button', { name: '延长当前周期' }))

    expect(onReschedule).toHaveBeenCalledWith('2026-10-18')
  })

  test('starts a confirmed new cycle and warns about same-day entries', async () => {
    const onStartNextCycle = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(
      <PaydayPrompt
        cycle={cycle}
        today="2026-10-16"
        transactions={[sameDayEntry]}
        onReschedule={vi.fn()}
        onStartNextCycle={onStartNextCycle}
      />,
    )

    await user.click(screen.getByRole('button', { name: '工资已到账' }))
    expect(screen.getByText('当天已有 1 笔账目，将转入新周期。')).toBeInTheDocument()
    await user.clear(screen.getByLabelText('下次预计发薪日'))
    await user.type(screen.getByLabelText('下次预计发薪日'), '2026-11-16')
    await user.click(screen.getByRole('button', { name: '确认开始新周期' }))

    expect(onStartNextCycle).toHaveBeenCalledWith({
      actualStartDate: '2026-10-16',
      expectedNextPayDate: '2026-11-16',
      budgetCents: 150_000,
    })
  })
})
