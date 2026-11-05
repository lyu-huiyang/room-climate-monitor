import { describe, expect, it } from 'vitest'
import { sensorColor } from './colors'

describe('sensorColor', () => {
  it('uses the light palette in order', () => {
    expect([0, 1, 2, 3].map((i) => sensorColor(i, false))).toEqual(['#2a78d6', '#eb6834', '#1baf7a', '#eda100'])
  })
  it('uses the dark palette in dark mode', () => {
    expect([0, 1, 2, 3].map((i) => sensorColor(i, true))).toEqual(['#3987e5', '#d95926', '#199e70', '#c98500'])
  })
  it('wraps around for a fifth sensor', () => {
    expect(sensorColor(4, false)).toBe('#2a78d6')
  })
})
