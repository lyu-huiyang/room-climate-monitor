import { describe, expect, it } from 'vitest'
import { OFFLINE_AFTER_S } from '../../../src/lib/freshness'
import { roundTo } from '../../../src/lib/round'
import { DEMO_ROOMS, historyOut, lastReadingTs, listRooms, readingAt } from './data'

// A whole minute, the same instant the app's own tests use.
const NOW = 1_792_308_900

const room = (id: string) => DEMO_ROOMS.find((r) => r.id === id)!
const byId = (nowS: number, lang: 'zh-CN' | 'en' = 'zh-CN') =>
  Object.fromEntries(listRooms(nowS, lang).map((r) => [r.id, r]))

describe('rooms', () => {
  it('are sorted by id', () => {
    expect(listRooms(NOW, 'zh-CN').map((r) => r.id)).toEqual(['balcony', 'bedroom', 'living-room', 'study'])
  })

  it('names follow the language', () => {
    expect(byId(NOW, 'zh-CN').bedroom.name).toBe('卧室')
    expect(byId(NOW, 'en').bedroom.name).toBe('Bedroom')
  })

  it('use the server default comfort range', () => {
    for (const r of listRooms(NOW, 'en')) expect(r.comfort).toEqual({ t: [22, 26], h: [40, 60] })
  })
})

describe('latest', () => {
  it('readings are deterministic', () => {
    expect(readingAt(room('bedroom'), NOW)).toEqual(readingAt(room('bedroom'), NOW))
    const a = listRooms(NOW, 'en').map((r) => r.latest?.ts)
    const b = listRooms(NOW + 30, 'en').map((r) => r.latest?.ts)
    expect(b).toEqual(a)
  })

  it('online rooms report the current minute', () => {
    for (const id of ['bedroom', 'living-room', 'study']) {
      expect(byId(NOW)[id].latest).toMatchObject({ ts: NOW, age_s: 0 })
      expect(byId(NOW + 45)[id].latest).toMatchObject({ ts: NOW, age_s: 45 })
    }
  })

  it('balcony is offline', () => {
    const age = byId(NOW).balcony.latest!.age_s
    expect(age).toBe(3 * 3600)
    expect(age).toBeGreaterThan(OFFLINE_AFTER_S)
  })

  it('carries both sensors and a signal strength', () => {
    const latest = byId(NOW).bedroom.latest!
    expect(Object.keys(latest.sensors).sort()).toEqual(['aht20', 'sht40'])
    expect(latest.rssi).toBeGreaterThanOrEqual(-70)
    expect(latest.rssi).toBeLessThanOrEqual(-50)
  })
})

describe('history', () => {
  it('matches the server buckets', () => {
    const expected = { '8h': [481, 60], '24h': [1441, 60], '7d': [673, 900] } as const
    for (const range of ['8h', '24h', '7d'] as const) {
      const h = historyOut(room('bedroom'), range, NOW)
      expect(h.range).toBe(range)
      expect([h.points.length, h.bucket_s]).toEqual(expected[range])
      expect(h.sensors).toEqual(['aht20', 'sht40'])
      const ts = h.points.map((p) => p[0] as number)
      expect(ts.every((t) => t % h.bucket_s === 0)).toBe(true)
      expect(ts).toEqual([...ts].sort((x, y) => x - y))
    }
    expect(historyOut(room('bedroom'), '7d', NOW).points.at(-1)![0]).toBe(1_792_308_600)
  })

  it('values are rounded averages of the minute readings', () => {
    const point = historyOut(room('living-room'), '7d', NOW).points[10]
    const bucket = point[0] as number
    const minutes = Array.from({ length: 15 }, (_, i) => readingAt(room('living-room'), bucket + i * 60))
    const mean = minutes.reduce((sum, r) => sum + r.sht40.t, 0) / minutes.length
    expect(point[3]).toBe(roundTo(mean, 2))
  })

  it('a later request redraws the same points', () => {
    // The window slides with the clock (as on the server), so compare the buckets both contain.
    const before = new Map(historyOut(room('study'), '24h', NOW).points.map((p) => [p[0], p]))
    const after = historyOut(room('study'), '24h', NOW + 90).points
    const shared = after.filter((p) => before.has(p[0]))
    expect(shared.length).toBeGreaterThan(1400)
    for (const p of shared) expect(p).toEqual(before.get(p[0]))
  })

  it('offline history stops at the last reading', () => {
    const balcony = room('balcony')
    expect(historyOut(balcony, '24h', NOW).points.at(-1)![0]).toBeLessThanOrEqual(lastReadingTs(balcony, NOW))
  })

  it('study leaves the comfort range during the day', () => {
    const points = historyOut(room('study'), '24h', NOW).points
    expect(points.some((p) => (p[3] as number) > 26)).toBe(true)
  })
})
