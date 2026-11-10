import { expect, it } from 'vitest'
import en from './en.json'
import zh from './zh-CN.json'

function keys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix]
  return Object.entries(value).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k))
}

it('has the same site keys in every language', () => {
  expect(keys(en).sort()).toEqual(keys(zh).sort())
})
