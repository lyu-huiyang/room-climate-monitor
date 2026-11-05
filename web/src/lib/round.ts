/** Round half away from zero at a decimal position, without binary float surprises (0.245 → 0.25). */
export function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits
  // toPrecision(15) drops the binary noise in value * factor (0.245 * 100 = 24.499999999999996).
  const scaled = Number((Math.abs(value) * factor).toPrecision(15))
  const rounded = Math.round(scaled) / factor
  return value < 0 && rounded !== 0 ? -rounded : rounded
}
