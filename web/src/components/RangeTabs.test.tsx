import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { RangeTabs } from './RangeTabs'

it('marks the active range with aria-pressed and calls onChange', async () => {
  const onChange = vi.fn()
  render(<RangeTabs value="24h" onChange={onChange} />)
  expect(screen.getByRole('button', { name: '24 小时' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: '8 小时' })).toHaveAttribute('aria-pressed', 'false')
  await userEvent.click(screen.getByRole('button', { name: '7 天' }))
  expect(onChange).toHaveBeenCalledWith('7d')
})
