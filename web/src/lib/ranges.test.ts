import { expect, it } from 'vitest'
import { parseRange } from './ranges'

it('accepts known ranges and falls back to 24h', () => {
  expect(parseRange('7d')).toBe('7d')
  expect(parseRange('8h')).toBe('8h')
  expect(parseRange(null)).toBe('24h')
  expect(parseRange('1y')).toBe('24h')
})
