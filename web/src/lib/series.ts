import type { HistoryOut } from '../api/client'

export type SeriesPoint = [number, number | null]

export interface ClimateSeries {
  sensors: string[]
  temp: Record<string, SeriesPoint[]>
  hum: Record<string, SeriesPoint[]>
}

/** Split columnar history into per-sensor series (ms timestamps), breaking lines at gaps. */
export function historyToSeries(h: HistoryOut): ClimateSeries {
  const temp: Record<string, SeriesPoint[]> = {}
  const hum: Record<string, SeriesPoint[]> = {}
  h.sensors.forEach((name) => {
    temp[name] = []
    hum[name] = []
  })
  let prevTs: number | null = null
  for (const point of h.points) {
    const ts = point[0] as number
    if (prevTs !== null && ts - prevTs > 2 * h.bucket_s) {
      const gapMs = (prevTs + h.bucket_s) * 1000
      h.sensors.forEach((name) => {
        temp[name].push([gapMs, null])
        hum[name].push([gapMs, null])
      })
    }
    h.sensors.forEach((name, i) => {
      temp[name].push([ts * 1000, point[1 + 2 * i] ?? null])
      hum[name].push([ts * 1000, point[2 + 2 * i] ?? null])
    })
    prevTs = ts
  }
  return { sensors: [...h.sensors], temp, hum }
}
