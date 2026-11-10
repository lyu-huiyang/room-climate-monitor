import { afterEach, expect, it, vi } from 'vitest'
import { api } from '../../../src/api/client'
import { handleApiRequest, installMockApi } from './mockApi'

const NOW = 1_792_308_900
const call = (path: string, method = 'GET') => handleApiRequest(new URL(path, 'https://example.test'), method, NOW, 'en')

const realFetch = globalThis.fetch
let restore: (() => void) | undefined
afterEach(() => {
  restore?.()
  restore = undefined
  globalThis.fetch = realFetch
})

it('lists four rooms', async () => {
  const res = call('/api/rooms')
  expect(res.status).toBe(200)
  expect(res.headers.get('Content-Type')).toBe('application/json')
  expect(await res.json()).toHaveLength(4)
})

it('returns one room', async () => {
  const res = call('/api/rooms/bedroom')
  expect(res.status).toBe(200)
  expect((await res.json()).id).toBe('bedroom')
})

it('unknown room is 404', async () => {
  for (const path of ['/api/rooms/nope', '/api/rooms/nope/history']) {
    const res = call(path)
    expect(res.status).toBe(404)
    expect((await res.json()).detail).toBe('room not found')
  }
})

it('a malformed room id is 404 like the server', async () => {
  const res = call('/api/rooms/%E0')
  expect(res.status).toBe(404)
  expect((await res.json()).detail).toBe('room not found')
})

it('history defaults to 24h', async () => {
  expect((await call('/api/rooms/bedroom/history').json()).range).toBe('24h')
  expect((await call('/api/rooms/bedroom/history?range=7d').json()).bucket_s).toBe(900)
})

it('bad range is 400', () => {
  expect(call('/api/rooms/bedroom/history?range=1y').status).toBe(400)
})

it('other paths and methods are 404', () => {
  expect(call('/api/health/extra').status).toBe(404)
  expect(call('/api/rooms', 'POST').status).toBe(404)
})

it('install routes only /api', async () => {
  const original = vi.fn(async () => new Response('elsewhere'))
  globalThis.fetch = original
  restore = installMockApi(() => 'en')
  expect(await (await fetch('https://example.test/api/rooms')).json()).toHaveLength(4)
  expect(original).not.toHaveBeenCalled()
  expect(await (await fetch('https://example.test/other')).text()).toBe('elsewhere')
  expect(original).toHaveBeenCalledTimes(1)
  restore()
  restore = undefined
  expect(globalThis.fetch).toBe(original)
})

it('passes other requests through with their body intact', async () => {
  const original = vi.fn(async (input: RequestInfo | URL) => new Response(await (input as Request).text()))
  globalThis.fetch = original as typeof fetch
  restore = installMockApi(() => 'en')
  const res = await fetch(new Request('https://example.test/upload', { method: 'POST', body: 'payload' }))
  expect(await res.text()).toBe('payload')
})

it('works through the real client', async () => {
  restore = installMockApi(() => 'en')
  const { data } = await api.GET('/api/rooms/{room_id}', { params: { path: { room_id: 'study' } } })
  expect(data?.name).toBe('Study')
})
