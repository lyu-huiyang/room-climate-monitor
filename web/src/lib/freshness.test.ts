import { describe, expect, it } from 'vitest'
import { freshness } from './freshness'

describe('freshness', () => {
  it('is offline with unknown age when there is no reading', () => {
    expect(freshness(null, 1000)).toEqual({ ageS: null, online: false })
  })
  it('is online up to and including 300 seconds', () => {
    expect(freshness(700, 1000)).toEqual({ ageS: 300, online: true })
  })
  it('is offline after 300 seconds', () => {
    expect(freshness(699, 1000)).toEqual({ ageS: 301, online: false })
  })
  it('clamps future timestamps to age 0', () => {
    expect(freshness(1100, 1000)).toEqual({ ageS: 0, online: true })
  })
})
