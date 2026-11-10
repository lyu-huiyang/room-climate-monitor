// Simulated rooms for the demo site. Every value is a pure function of the room and the
// timestamp, so a reload redraws the same curves; bucketing mirrors server/src/rcm/readings.py.
import type { HistoryOut, HistoryRange, RoomOut } from '../../../src/api/client'
import type { Language } from '../../../src/i18n'
import { roundTo } from '../../../src/lib/round'

export type DemoRoom = {
  id: string
  names: Record<Language, string>
  /** Daily mean temperature (°C) and relative humidity (%). */
  t0: number
  h0: number
  /** Half of the daily swing. */
  tAmp: number
  hAmp: number
  /** The board went quiet this long ago. */
  offlineForS?: number
}

// Sorted by id, like the server's room list.
export const DEMO_ROOMS: readonly DemoRoom[] = [
  { id: 'balcony', names: { 'zh-CN': '阳台', en: 'Balcony' }, t0: 21, h0: 58, tAmp: 3, hAmp: 8, offlineForS: 3 * 3600 },
  { id: 'bedroom', names: { 'zh-CN': '卧室', en: 'Bedroom' }, t0: 23.6, h0: 52, tAmp: 1, hAmp: 4 },
  { id: 'living-room', names: { 'zh-CN': '客厅', en: 'Living room' }, t0: 24.2, h0: 48, tAmp: 1.4, hAmp: 5 },
  // Warm enough to leave the comfort range in the afternoon.
  { id: 'study', names: { 'zh-CN': '书房', en: 'Study' }, t0: 25.2, h0: 45, tAmp: 1.6, hAmp: 5 },
]

export const COMFORT: RoomOut['comfort'] = { t: [22, 26], h: [40, 60] }

export const RANGES: Record<HistoryRange, { spanS: number; bucketS: number }> = {
  '8h': { spanS: 8 * 3600, bucketS: 60 },
  '24h': { spanS: 24 * 3600, bucketS: 60 },
  '7d': { spanS: 7 * 24 * 3600, bucketS: 900 },
}

const SENSORS = ['aht20', 'sht40'] as const
const DAY_S = 86_400
const PEAK_S = 15 * 3600 // warmest at 15:00 local time

type Reading = { sht40: { t: number; h: number }; aht20: { t: number; h: number }; rssi: number }

/** A uniform value in [0, 1) determined by the room, the timestamp and a salt. */
function unit(id: string, ts: number, salt: number): number {
  let x = 2166136261
  for (let i = 0; i < id.length; i++) x = Math.imul(x ^ id.charCodeAt(i), 16777619)
  x = Math.imul(x ^ ts, 2654435761) ^ Math.imul(salt + 1, 0x9e3779b1)
  x = Math.imul(x ^ (x >>> 15), 0x85ebca6b)
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35)
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296
}

export function readingAt(room: DemoRoom, ts: number): Reading {
  const localS = ts - new Date(ts * 1000).getTimezoneOffset() * 60
  const phase = (2 * Math.PI * ((((localS - PEAK_S) % DAY_S) + DAY_S) % DAY_S)) / DAY_S
  const t = room.t0 + room.tAmp * Math.cos(phase) + (unit(room.id, ts, 0) - 0.5) * 0.06
  const h = room.h0 - room.hAmp * Math.cos(phase) + (unit(room.id, ts, 1) - 0.5) * 0.3
  return {
    sht40: { t: roundTo(t, 2), h: roundTo(h, 2) },
    aht20: { t: roundTo(t + 0.3, 2), h: roundTo(h - 1.2, 2) },
    rssi: -50 - Math.floor(unit(room.id, ts, 2) * 21),
  }
}

export function lastReadingTs(room: DemoRoom, nowS: number): number {
  return Math.floor(nowS / 60) * 60 - (room.offlineForS ?? 0)
}

export function roomOut(room: DemoRoom, nowS: number, lang: Language): RoomOut {
  const ts = lastReadingTs(room, nowS)
  const { rssi, ...sensors } = readingAt(room, ts)
  return {
    id: room.id,
    name: room.names[lang],
    comfort: COMFORT,
    latest: { ts, age_s: Math.max(0, nowS - ts), sensors, rssi },
  }
}

export function listRooms(nowS: number, lang: Language): RoomOut[] {
  return DEMO_ROOMS.map((room) => roomOut(room, nowS, lang))
}

export function historyOut(room: DemoRoom, range: HistoryRange, nowS: number): HistoryOut {
  const { spanS, bucketS } = RANGES[range]
  const first = Math.ceil((nowS - spanS) / 60) * 60
  // The server's window reaches FUTURE_LIMIT_S past now, but simulated readings never lie in the future.
  const last = lastReadingTs(room, nowS)
  const buckets = new Map<number, Reading[]>()
  for (let ts = first; ts <= last; ts += 60) {
    const bucket = ts - (ts % bucketS)
    const list = buckets.get(bucket)
    if (list) list.push(readingAt(room, ts))
    else buckets.set(bucket, [readingAt(room, ts)])
  }
  const mean = (list: Reading[], pick: (r: Reading) => number) =>
    roundTo(list.reduce((sum, r) => sum + pick(r), 0) / list.length, 2)
  const points = [...buckets].map(([bucket, list]) => [
    bucket,
    ...SENSORS.flatMap((s) => [mean(list, (r) => r[s].t), mean(list, (r) => r[s].h)]),
  ])
  return { range, bucket_s: bucketS, sensors: [...SENSORS], points }
}
