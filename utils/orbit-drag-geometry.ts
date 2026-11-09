/** A forbidden circular radius interval; both endpoints remain available. */
interface OpenRadiusInterval {
  start: number
  end: number
}

function mergedForbiddenIntervals(radii: number[], clearance: number): OpenRadiusInterval[] {
  const intervals = radii
    .filter(radius => Number.isFinite(radius) && radius >= 0)
    .map(radius => ({ start: radius - clearance, end: radius + clearance }))
    .sort((left, right) => left.start - right.start || left.end - right.end)

  const merged: OpenRadiusInterval[] = []
  for (const interval of intervals) {
    const previous = merged[merged.length - 1]
    // Touching open intervals leave their shared boundary legal.
    if (previous && interval.start < previous.end) {
      previous.end = Math.max(previous.end, interval.end)
    } else {
      merged.push({ ...interval })
    }
  }
  return merged
}

/**
 * Tests whether a circular radius clears every concentric circular Orbit by the supplied scene gap.
 * Open interval boundaries are legal, including a shared boundary between touching intervals.
 */
export function isCircularOrbitRadiusAvailable(
  radius: number,
  minimumRadius: number,
  existingRadii: number[],
  sceneClearance: number,
): boolean {
  if (!Number.isFinite(radius) || !Number.isFinite(minimumRadius) || !Number.isFinite(sceneClearance)
    || minimumRadius < 0 || sceneClearance < 0 || radius < minimumRadius) return false

  return !mergedForbiddenIntervals(existingRadii, sceneClearance)
    .some(interval => interval.start < radius && radius < interval.end)
}

/**
 * Chooses the nearest radius at or above the target minimum that clears every concentric circle.
 * An equal-distance adjustment chooses the larger radius.
 */
export function nearestAvailableCircularOrbitRadius(
  proposedRadius: number,
  minimumRadius: number,
  existingRadii: number[],
  sceneClearance: number,
): number | undefined {
  if (!Number.isFinite(proposedRadius) || !Number.isFinite(minimumRadius)
    || !Number.isFinite(sceneClearance) || minimumRadius < 0 || sceneClearance < 0) return undefined

  const radius = Math.max(minimumRadius, proposedRadius)
  const intervals = mergedForbiddenIntervals(existingRadii, sceneClearance)
  const conflict = intervals.find(interval => interval.start < radius && radius < interval.end)
  if (!conflict) return radius

  const candidates = [Math.max(minimumRadius, conflict.start), conflict.end]
    .filter(candidate => isCircularOrbitRadiusAvailable(
      candidate,
      minimumRadius,
      existingRadii,
      sceneClearance,
    ))
  if (!candidates.length) return undefined

  return candidates.reduce((closest, candidate) => {
    const candidateDistance = Math.abs(candidate - radius)
    const closestDistance = Math.abs(closest - radius)
    return candidateDistance < closestDistance
      || candidateDistance === closestDistance && candidate > closest
      ? candidate
      : closest
  })
}
