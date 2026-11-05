import { roundTo } from './round'

export type SensorReadings = Record<string, { t: number; h: number }>

export const MAX_TEMP_SPREAD = 1
export const MAX_HUMIDITY_SPREAD = 5

export function sensorAverage(sensors: SensorReadings): { t: number; h: number } | null {
  const values = Object.values(sensors)
  if (values.length === 0) return null
  const mean = (xs: number[]) => roundTo(xs.reduce((a, b) => a + b, 0) / xs.length, 2)
  return { t: mean(values.map((v) => v.t)), h: mean(values.map((v) => v.h)) }
}

export function agreement(sensors: SensorReadings): { dt: number; dh: number; ok: boolean } | null {
  const values = Object.values(sensors)
  if (values.length < 2) return null
  const spread = (xs: number[]) => roundTo(Math.max(...xs) - Math.min(...xs), 2)
  const dt = spread(values.map((v) => v.t))
  const dh = spread(values.map((v) => v.h))
  return { dt, dh, ok: dt <= MAX_TEMP_SPREAD && dh <= MAX_HUMIDITY_SPREAD }
}
