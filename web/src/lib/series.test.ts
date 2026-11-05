import { describe, expect, it } from 'vitest'
import type { HistoryOut } from '../api/client'
import { historyToSeries } from './series'

const base = 1_792_308_000

describe('historyToSeries', () => {
  it('splits columns per sensor and converts seconds to milliseconds', () => {
    const h: HistoryOut = {
      range: '24h',
      bucket_s: 60,
      sensors: ['aht20', 'sht40'],
      points: [
        [base, 24.5, 50.8, 24.3, 52.1],
        [base + 60, 24.6, 50.9, 24.4, 52.2],
      ],
    }
    expect(historyToSeries(h)).toEqual({
      sensors: ['aht20', 'sht40'],
      temp: {
        aht20: [[base * 1000, 24.5], [(base + 60) * 1000, 24.6]],
        sht40: [[base * 1000, 24.3], [(base + 60) * 1000, 24.4]],
      },
      hum: {
        aht20: [[base * 1000, 50.8], [(base + 60) * 1000, 50.9]],
        sht40: [[base * 1000, 52.1], [(base + 60) * 1000, 52.2]],
      },
    })
  })

  it('keeps nulls for a sensor missing in a bucket', () => {
    const h: HistoryOut = { range: '24h', bucket_s: 60, sensors: ['aht20', 'sht40'], points: [[base, null, null, 24, 50]] }
    const s = historyToSeries(h)
    expect(s.temp.aht20).toEqual([[base * 1000, null]])
    expect(s.hum.sht40).toEqual([[base * 1000, 50]])
  })

  it('inserts a null after a gap longer than two buckets', () => {
    const h: HistoryOut = {
      range: '24h',
      bucket_s: 60,
      sensors: ['sht40'],
      points: [
        [base, 24, 50],
        [base + 120, 25, 51],
        [base + 600, 26, 52],
      ],
    }
    expect(historyToSeries(h).temp.sht40).toEqual([
      [base * 1000, 24],
      [(base + 120) * 1000, 25],
      [(base + 180) * 1000, null],
      [(base + 600) * 1000, 26],
    ])
  })

  it('returns empty series for empty history', () => {
    expect(historyToSeries({ range: '8h', bucket_s: 60, sensors: [], points: [] })).toEqual({
      sensors: [],
      temp: {},
      hum: {},
    })
  })
})
