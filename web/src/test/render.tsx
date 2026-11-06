import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { vi } from 'vitest'
import type { RoomOut } from '../api/client'

export const NOW_S = 1_792_308_900

export function renderWithProviders(ui: ReactElement, { route = '/' }: { route?: string } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

/** Renders `page` at `path` plus a probe that prints the current location. */
export function renderRoute(path: string, page: ReactElement, route: string) {
  function Where() {
    return <output data-testid="location">{useLocation().pathname}</output>
  }
  return renderWithProviders(
    <>
      <Routes>
        <Route path={path} element={page} />
        <Route path="*" element={null} />
      </Routes>
      <Where />
    </>,
    { route },
  )
}

type Reply = { status?: number; body: unknown }

/** Answer fetch calls by URL path (optionally with query string). */
export function mockApi(replies: Record<string, Reply>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = new URL((input as Request).url)
    const reply = replies[url.pathname + url.search] ?? replies[url.pathname]
    if (!reply) return new Response(JSON.stringify({ detail: 'Not Found' }), { status: 404 })
    return new Response(JSON.stringify(reply.body), {
      status: reply.status ?? 200,
      headers: { 'Content-Type': 'application/json' },
    })
  })
}

export function makeRoom(overrides: Partial<RoomOut> = {}): RoomOut {
  return {
    id: 'living-room',
    name: '客厅',
    comfort: { t: [22, 26], h: [40, 60] },
    latest: {
      ts: NOW_S - 42,
      age_s: 42,
      sensors: { sht40: { t: 24.31, h: 52.1 }, aht20: { t: 24.55, h: 50.8 } },
      rssi: -58,
    },
    ...overrides,
  }
}
