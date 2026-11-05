import { roundTo } from './round'

export function formatValue(v: number | null, digits = 1): string {
  return v === null ? '--' : roundTo(v, digits).toFixed(digits)
}
