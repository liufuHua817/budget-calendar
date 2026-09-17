import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Link } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { RouteScroll } from './RouteScroll'

afterEach(() => vi.restoreAllMocks())

test('resets scroll when navigating to another page', async () => {
  const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  render(<MemoryRouter><RouteScroll ready /><Link to="/entry">记账</Link></MemoryRouter>)
  scroll.mockClear()
  await userEvent.click(screen.getByRole('link', { name: '记账' }))
  expect(scroll).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' })
})

test('scrolls to a section only after the initial data is ready', () => {
  const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  const intoView = vi.fn()
  const { rerender } = render(<MemoryRouter initialEntries={['/settings#projects']}>
    <RouteScroll ready={false} /><section id="projects" ref={(node) => { if (node) node.scrollIntoView = intoView }} />
  </MemoryRouter>)
  expect(scroll).not.toHaveBeenCalled()
  rerender(<MemoryRouter initialEntries={['/settings#projects']}>
    <RouteScroll ready /><section id="projects" />
  </MemoryRouter>)
  expect(intoView).toHaveBeenCalledWith({ block: 'start', behavior: 'instant' })
})
