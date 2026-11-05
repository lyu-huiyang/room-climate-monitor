export const OFFLINE_AFTER_S = 300

export function freshness(ts: number | null, nowS: number): { ageS: number | null; online: boolean } {
  if (ts === null) return { ageS: null, online: false }
  const ageS = Math.max(0, nowS - ts)
  return { ageS, online: ageS <= OFFLINE_AFTER_S }
}
