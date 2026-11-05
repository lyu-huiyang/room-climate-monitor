import type { HistoryRange } from '../api/client'

export const RANGES: HistoryRange[] = ['8h', '24h', '7d']
export const DEFAULT_RANGE: HistoryRange = '24h'

export function parseRange(value: string | null): HistoryRange {
  return RANGES.find((r) => r === value) ?? DEFAULT_RANGE
}
