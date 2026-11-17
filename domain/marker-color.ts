/** Checks whether an unknown value is a strict six-digit hexadecimal marker color. */
export function isMarkerColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[\da-fA-F]{6}$/.test(value)
}
