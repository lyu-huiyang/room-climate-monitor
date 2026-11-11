import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { makeRoom, mockApi, renderRoute } from '../test/render'
import { RoomPage } from './RoomPage'

const history = (range = '24h') => ({
  range,
  bucket_s: range === '7d' ? 900 : 60,
  sensors: ['aht20', 'sht40', 'bme280'].sort(),
  points: [[1_792_308_000, 24.6, 50.9, 23.9, 55.0, 24.4, 52.2]],
})

it('shows one card per sensor, failure for a sensor missing from latest, and both charts', async () => {
  mockApi({
    '/api/rooms/living-room': { body: makeRoom() },
    '/api/rooms/living-room/history': { body: history() },
  })
  renderRoute('/rooms/:roomId', <RoomPage />, '/rooms/living-room')
  expect(await screen.findByRole('heading', { name: '客厅' })).toBeInTheDocument()
  expect(screen.getByText('24.3 °C')).toBeInTheDocument()
  expect(await screen.findByText('读取失败')).toBeInTheDocument()
  expect(screen.getByText(/一致/)).toBeInTheDocument()
  expect(await screen.findByRole('heading', { name: /^温度/ })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: /^湿度/ })).toBeInTheDocument()
})

it('renders a room without any data without crashing', async () => {
  mockApi({
    '/api/rooms/living-room': { body: makeRoom({ latest: null }) },
    '/api/rooms/living-room/history': { body: { range: '24h', bucket_s: 60, sensors: [], points: [] } },
  })
  renderRoute('/rooms/:roomId', <RoomPage />, '/rooms/living-room')
  expect(await screen.findByRole('heading', { name: '客厅' })).toBeInTheDocument()
  expect(screen.getAllByText('暂无数据').length).toBeGreaterThan(0)
  expect(await screen.findAllByText('这段时间没有数据')).toHaveLength(2)
})

it('switches range through the tabs', async () => {
  const fetchSpy = mockApi({
    '/api/rooms/living-room': { body: makeRoom() },
    '/api/rooms/living-room/history?range=24h': { body: history('24h') },
    '/api/rooms/living-room/history?range=7d': { body: history('7d') },
  })
  renderRoute('/rooms/:roomId', <RoomPage />, '/rooms/living-room')
  await userEvent.click(await screen.findByRole('button', { name: '7 天' }))
  expect(screen.getByRole('button', { name: '7 天' })).toHaveAttribute('aria-pressed', 'true')
  const urls = fetchSpy.mock.calls.map(([req]) => new URL((req as Request).url).search)
  expect(urls).toContain('?range=7d')
})

it('shows not found for an unknown room', async () => {
  mockApi({})
  renderRoute('/rooms/:roomId', <RoomPage />, '/rooms/nope')
  expect(await screen.findByText('房间不存在')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '返回首页' })).toHaveAttribute('href', '/')
})

it('says when the history fails to load and retries on request', async () => {
  const fetchSpy = mockApi({
    '/api/rooms/living-room': { body: makeRoom() },
    '/api/rooms/living-room/history': { status: 503, body: { detail: 'database busy' } },
  })
  renderRoute('/rooms/:roomId', <RoomPage />, '/rooms/living-room')
  expect(await screen.findByText('历史曲线加载失败')).toBeInTheDocument()
  const historyCalls = () => fetchSpy.mock.calls.filter(([r]) => (r as Request).url.includes('/history')).length
  const before = historyCalls()
  await userEvent.click(screen.getByRole('button', { name: '重试' }))
  expect(historyCalls()).toBe(before + 1)
})

it('links back to all rooms when there are several', async () => {
  mockApi({
    '/api/rooms': { body: [makeRoom({ id: 'bedroom', name: '卧室' }), makeRoom()] },
    '/api/rooms/living-room': { body: makeRoom() },
    '/api/rooms/living-room/history': { body: history() },
  })
  renderRoute('/rooms/:roomId', <RoomPage />, '/rooms/living-room')
  await userEvent.click(await screen.findByRole('link', { name: '所有房间' }))
  expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/)
})

it('has no back link when the only room is this one', async () => {
  // The overview opens the only room directly, so a link back would bounce straight here.
  mockApi({
    '/api/rooms': { body: [makeRoom()] },
    '/api/rooms/living-room': { body: makeRoom() },
    '/api/rooms/living-room/history': { body: history() },
  })
  renderRoute('/rooms/:roomId', <RoomPage />, '/rooms/living-room')
  expect(await screen.findByRole('heading', { name: '客厅' })).toBeInTheDocument()
  await screen.findByRole('heading', { name: /^温度/ })
  expect(screen.queryByRole('link', { name: '所有房间' })).not.toBeInTheDocument()
})
