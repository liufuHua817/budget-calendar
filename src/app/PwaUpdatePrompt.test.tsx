import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ update: vi.fn(), dismiss: vi.fn() }))

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [true, mocks.dismiss],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: mocks.update,
  }),
}))

import { PwaUpdatePrompt } from './PwaUpdatePrompt'

test('waits for explicit confirmation before applying an update', async () => {
  render(<PwaUpdatePrompt />)
  expect(screen.getByText('新版本已准备好')).toBeInTheDocument()
  expect(mocks.update).not.toHaveBeenCalled()
  await userEvent.setup().click(screen.getByRole('button', { name: '安全更新' }))
  expect(mocks.update).toHaveBeenCalledWith(true)
})
