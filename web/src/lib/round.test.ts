import { describe, expect, it } from 'vitest'
import { roundTo } from './round'

describe('roundTo', () => {
  it('rounds decimal halves up despite binary representation', () => {
    expect(roundTo(0.245, 2)).toBe(0.25)
    expect(roundTo(1.005, 2)).toBe(1.01)
  })
  it('rounds negative halves away from zero', () => {
    expect(roundTo(-2.45, 1)).toBe(-2.5)
  })
  it('handles tiny float noise from subtraction', () => {
    expect(roundTo(3.5e-15, 2)).toBe(0)
    expect(roundTo(24.3 - 24.299999999999997, 2)).toBe(0)
  })
})
