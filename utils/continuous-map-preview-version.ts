/** Module-lifetime sequence prevents a remounted map from reusing a pending preview's token. */
let nextVersion = 0

export function nextContinuousMapPreviewVersion(): number {
  nextVersion += 1
  return nextVersion
}
