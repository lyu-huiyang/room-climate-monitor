import { afterEach, expect, it, vi } from 'vitest'
import { api, type HistoryOut } from './client'

afterEach(() => {
  vi.restoreAllMocks()
})

it('history types expose range, bucket_s, sensors and points', () => {
  const h: HistoryOut = { range: '24h', bucket_s: 60, sensors: ['sht40'], points: [[1, 24.3, 50.1]] }
  expect(h.points[0]).toHaveLength(3)
})

it('calls the history endpoint with the room id and range', async () => {
  const body: HistoryOut = { range: '7d', bucket_s: 900, sensors: [], points: [] }
  const fetchSpy = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } }))
  const { data } = await api.GET('/api/rooms/{room_id}/history', {
    params: { path: { room_id: 'living-room' }, query: { range: '7d' } },
  })
  const request = fetchSpy.mock.calls[0][0] as Request
  expect(new URL(request.url).pathname + new URL(request.url).search).toBe('/api/rooms/living-room/history?range=7d')
  expect(data).toEqual(body)
})
