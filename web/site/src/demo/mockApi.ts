// Answers the app's read API in the browser, with the same status codes as the server
// (docs/design/server-web.md §4.2, §4.3), so the demo needs no backend.
import type { HistoryRange } from '../../../src/api/client'
import type { Language } from '../../../src/i18n'
import { DEMO_ROOMS, historyOut, listRooms, RANGES, roomOut } from './data'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const isRange = (value: string): value is HistoryRange => Object.hasOwn(RANGES, value)

/** A malformed escape such as `%E0` names no room; the server answers 404 too. */
function safeDecode(segment: string): string | null {
  try {
    return decodeURIComponent(segment)
  } catch {
    return null
  }
}

export function handleApiRequest(url: URL, method: string, nowS: number, lang: Language): Response {
  const notFound = json({ detail: 'Not Found' }, 404)
  if (method !== 'GET') return notFound
  if (url.pathname === '/api/rooms') return json(listRooms(nowS, lang))

  const match = /^\/api\/rooms\/([^/]+)(\/history)?$/.exec(url.pathname)
  if (!match) return notFound
  const room = DEMO_ROOMS.find((r) => r.id === safeDecode(match[1]))
  if (!match[2]) return room ? json(roomOut(room, nowS, lang)) : json({ detail: 'room not found' }, 404)

  const range = url.searchParams.get('range') ?? '24h'
  if (!isRange(range)) return json({ detail: 'invalid request parameters' }, 400)
  if (!room) return json({ detail: 'room not found' }, 404)
  return json(historyOut(room, range, nowS))
}

/** Route `/api/...` fetches to the simulation; returns a function that puts the old fetch back. */
export function installMockApi(
  getLang: () => Language,
  now: () => number = () => Math.floor(Date.now() / 1000),
): () => void {
  const original = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init)
    const url = new URL(request.url)
    // Pass the Request built above: building it consumed the body of a Request input.
    if (!url.pathname.startsWith('/api/')) return original(request)
    return handleApiRequest(url, request.method, now(), getLang())
  }
  return () => {
    globalThis.fetch = original
  }
}
