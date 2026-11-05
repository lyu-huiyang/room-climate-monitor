import { describe, expect, it } from 'vitest'
import { formatValue } from './format'

describe('formatValue', () => {
  it('shows a placeholder for null', () => {
    expect(formatValue(null)).toBe('--')
  })
  it('rounds to one decimal by default', () => {
    expect(formatValue(24.43)).toBe('24.4')
    expect(formatValue(24)).toBe('24.0')
  })
  it('accepts a digit count', () => {
    expect(formatValue(0.245, 2)).toBe('0.25')
    expect(formatValue(51.45, 0)).toBe('51')
  })
})
