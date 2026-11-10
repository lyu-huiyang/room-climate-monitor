import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { HttpError } from './api/http'
import { createQueryClient } from './queryClient'
import { Root } from './Root'
import { mockApi } from './test/render'

it('renders the overview under a hash router', async () => {
  window.location.hash = '#/'
  mockApi({ '/api/rooms': { body: [] } })
  render(<Root queryClient={createQueryClient()} router="hash" />)
  expect(await screen.findByText('还没有房间')).toBeInTheDocument()
})

it('createQueryClient does not retry a 404', () => {
  const retry = createQueryClient().getDefaultOptions().queries!.retry as (n: number, e: unknown) => boolean
  expect(retry(0, new HttpError(404))).toBe(false)
  expect(retry(0, new HttpError(500))).toBe(true)
  expect(retry(3, new HttpError(500))).toBe(false)
})
