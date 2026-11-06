import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import '../i18n'
import { ErrorBoundary } from './ErrorBoundary'

afterEach(() => vi.restoreAllMocks())

function Boom(): never {
  throw new Error('Failed to fetch dynamically imported module')
}

it('replaces a crashed page with a reload prompt instead of a blank screen', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const reload = vi.fn()
  render(
    <ErrorBoundary onReload={reload}>
      <Boom />
    </ErrorBoundary>,
  )
  expect(screen.getByRole('alert')).toHaveTextContent('页面出错了')
  await userEvent.click(screen.getByRole('button', { name: '刷新' }))
  expect(reload).toHaveBeenCalledOnce()
})

it('renders children when nothing throws', () => {
  render(
    <ErrorBoundary>
      <p>fine</p>
    </ErrorBoundary>,
  )
  expect(screen.getByText('fine')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
