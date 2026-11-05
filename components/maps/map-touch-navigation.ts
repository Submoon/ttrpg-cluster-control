type MapSurface = 'cluster' | 'system'

const ZOOM_MARK_SELECTORS: Record<MapSurface, string> = {
  cluster: '.cluster-system-node, .cluster-route',
  system: '.system-object, .orbit-hit-target, .orbit-axis-handle, .orbit-rotation-handle, .orbit-center-handle',
}

/** Matches the exact map-mark set excluded by the map's D3 zoom filter while Move owns a mark drag. */
export function isMapZoomMark(target: EventTarget | null, surface: MapSurface): boolean {
  return target instanceof Element && target.closest(ZOOM_MARK_SELECTORS[surface]) !== null
}

/** Move keeps D3 mark drags intact while allowing single-touch view pans on the map background. */
export function isSingleTouchPanEligible(
  target: EventTarget | null,
  moveEnabled: boolean,
  surface: MapSurface,
): boolean {
  return !moveEnabled || !isMapZoomMark(target, surface)
}
