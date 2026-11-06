import { screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { makeRoom, mockApi, renderRoute } from '../test/render'
import { OverviewPage } from './OverviewPage'

it('redirects to the only room', async () => {
  mockApi({ '/api/rooms': { body: [makeRoom()] } })
  renderRoute('/', <OverviewPage />, '/')
  expect(await screen.findByText('/rooms/living-room')).toBeInTheDocument()
})

it('renders one card per room', async () => {
  mockApi({ '/api/rooms': { body: [makeRoom({ id: 'bedroom', name: '卧室' }), makeRoom()] } })
  renderRoute('/', <OverviewPage />, '/')
  expect(await screen.findByText('卧室')).toBeInTheDocument()
  expect(screen.getByText('客厅')).toBeInTheDocument()
  expect(screen.getAllByRole('link')).toHaveLength(2)
})

it('explains how to add a room when the list is empty', async () => {
  mockApi({ '/api/rooms': { body: [] } })
  renderRoute('/', <OverviewPage />, '/')
  expect(await screen.findByText(/rcm room add/)).toBeInTheDocument()
})

it('shows an error with retry when loading fails', async () => {
  mockApi({ '/api/rooms': { status: 503, body: { detail: 'down' } } })
  renderRoute('/', <OverviewPage />, '/')
  expect(await screen.findByText('加载失败')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument()
})
