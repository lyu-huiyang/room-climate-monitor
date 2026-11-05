import { describe, expect, it } from 'vitest'
import { agreement, sensorAverage } from './agreement'

describe('sensorAverage', () => {
  it('returns null without sensors', () => {
    expect(sensorAverage({})).toBeNull()
  })
  it('averages temperature and humidity to 2 decimals', () => {
    expect(sensorAverage({ sht40: { t: 24.31, h: 52.1 }, aht20: { t: 24.55, h: 50.8 } })).toEqual({ t: 24.43, h: 51.45 })
  })
  it('returns the single sensor unchanged', () => {
    expect(sensorAverage({ sht40: { t: 24.31, h: 52.1 } })).toEqual({ t: 24.31, h: 52.1 })
  })
})

describe('agreement', () => {
  it('is null with fewer than two sensors', () => {
    expect(agreement({})).toBeNull()
    expect(agreement({ sht40: { t: 24, h: 50 } })).toBeNull()
  })
  it('uses the spread across three sensors', () => {
    expect(agreement({ a: { t: 24.31, h: 52.1 }, b: { t: 24.55, h: 50.8 }, c: { t: 23.9, h: 55.0 } })).toEqual({
      dt: 0.65,
      dh: 4.2,
      ok: true,
    })
  })
  it('accepts exactly 1 °C and 5 % as agreeing', () => {
    expect(agreement({ a: { t: 24, h: 50 }, b: { t: 25, h: 55 } })?.ok).toBe(true)
  })
  it('flags a temperature spread above 1 °C', () => {
    expect(agreement({ a: { t: 24, h: 50 }, b: { t: 25.5, h: 50 } })).toEqual({ dt: 1.5, dh: 0, ok: false })
  })
  it('flags a humidity spread above 5 %', () => {
    expect(agreement({ a: { t: 24, h: 50 }, b: { t: 24, h: 55.1 } })?.ok).toBe(false)
  })
})
