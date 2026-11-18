import { MAP_ZOOM_MAX_SCALE } from '../../utils/map-zoom'

export type MapTouchSurface = 'cluster' | 'system'

export const MAP_TOUCH_PAN_THRESHOLD_PX = 9
const MAX_TAP_DURATION_MS = 250
const DOUBLE_TAP_INTERVAL_MS = 300
const DOUBLE_TAP_RADIUS_PX = 24

export interface MapTouchPoint {
  clientX: number
  clientY: number
  identifier?: number
}

/** The native touch fields and event methods used by the mounted map controller. */
export interface MapTouchEvent {
  readonly touches: ArrayLike<MapTouchPoint>
  readonly target: EventTarget | null
  readonly ctrlKey: boolean
  readonly type?: string
  readonly timeStamp?: number
  readonly changedTouches?: ArrayLike<MapTouchPoint>
  preventDefault(): void
  stopPropagation(): void
  stopImmediatePropagation(): void
}

export interface MapTouchViewport {
  x: number
  y: number
  k: number
}

/** A mounted map's live D3 camera adapter. Coordinates are converted to SVG viewport units. */
export interface MapTouchCamera {
  isPinchReady(): boolean
  getViewport(): MapTouchViewport
  pointFromClient(point: MapTouchPoint): [number, number]
  minimumZoomScale(): number
  applyViewport(viewport: MapTouchViewport): void
  interrupt(): void
}

export interface MapTouchNavigationOptions {
  surface: MapTouchSurface
  isEnabled(): boolean
  moveEnabled(): boolean
  getCamera(): MapTouchCamera | null
  canDoubleTap?(target: EventTarget | null): boolean
  /** Cancels the map's local editing/placement previews before an ordinary multi-touch takeover. */
  onPinchTakeover(): void
}

const ZOOM_MARK_SELECTORS: Record<MapTouchSurface, string> = {
  cluster: '.cluster-system-node, .cluster-route',
  system: '.system-object, .orbit-hit-target, .orbit-axis-handle, .orbit-rotation-handle, .orbit-center-handle',
}

/** Matches the exact map-mark set excluded by the map's D3 zoom filter while Move owns a mark drag. */
export function isMapZoomMark(target: EventTarget | null, surface: MapTouchSurface): boolean {
  return typeof Element !== 'undefined'
    && target instanceof Element
    && target.closest(ZOOM_MARK_SELECTORS[surface]) !== null
}

/** Move keeps D3 mark drags intact while allowing single-touch view pans on the map background. */
export function isSingleTouchPanEligible(
  target: EventTarget | null,
  moveEnabled: boolean,
  surface: MapTouchSurface,
): boolean {
  return !moveEnabled || !isMapZoomMark(target, surface)
}

type TouchGesture =
  | {
      kind: 'pending-pan'
      viewport: MapTouchViewport
      start: [number, number]
      startClient: [number, number]
      tap: { id: number; startedAt: number } | null
    }
  | { kind: 'pan'; viewport: MapTouchViewport; start: [number, number] }
  | {
      kind: 'pinch'
      viewport: MapTouchViewport
      distance: number
      anchor: [number, number]
    }

/**
 * Owns one mounted Warden map's touch camera state. The map supplies live camera reads and D3
 * application; this controller keeps the pending threshold, pan/pinch baselines, rebases,
 * cancellation and native event consumption in one place.
 */
export function createMapTouchNavigation(options: MapTouchNavigationOptions) {
  let gesture: TouchGesture | null = null
  let previousTap: { point: MapTouchPoint; endedAt: number; viewport: MapTouchViewport } | null = null

  function clearDoubleTap(): void {
    previousTap = null
    if (gesture?.kind === 'pending-pan') gesture.tap = null
  }

  function finishTap(pending: Extract<TouchGesture, { kind: 'pending-pan' }>, event: MapTouchEvent, camera: MapTouchCamera): void {
    const prior = previousTap
    previousTap = null
    const release = event.changedTouches?.[0]
    const endedAt = event.timeStamp
    if (!pending.tap || !release || event.changedTouches?.length !== 1 || event.type !== 'touchend'
      || release.identifier !== pending.tap.id || typeof endedAt !== 'number' || !Number.isFinite(endedAt)
      || endedAt < pending.tap.startedAt || endedAt - pending.tap.startedAt > MAX_TAP_DURATION_MS
      || Math.hypot(release.clientX - pending.startClient[0], release.clientY - pending.startClient[1]) > MAP_TOUCH_PAN_THRESHOLD_PX
      || !camera.isPinchReady() || !options.canDoubleTap?.(event.target)) return

    const viewport = camera.getViewport()
    if (!prior || pending.tap.startedAt < prior.endedAt || endedAt - prior.endedAt > DOUBLE_TAP_INTERVAL_MS
      || Math.hypot(release.clientX - prior.point.clientX, release.clientY - prior.point.clientY) > DOUBLE_TAP_RADIUS_PX
      || viewport.x !== prior.viewport.x || viewport.y !== prior.viewport.y || viewport.k !== prior.viewport.k) {
      previousTap = { point: { clientX: release.clientX, clientY: release.clientY }, endedAt, viewport }
      return
    }

    const [x, y] = camera.pointFromClient(release)
    const k = Math.min(MAP_ZOOM_MAX_SCALE, viewport.k * 2)
    const ratio = k / viewport.k
    camera.applyViewport({ x: x - (x - viewport.x) * ratio, y: y - (y - viewport.y) * ratio, k })
    event.preventDefault()
    event.stopImmediatePropagation()
  }

  function beginPinch(camera: MapTouchCamera | null, points: readonly MapTouchPoint[]): void {
    if (!camera || !camera.isPinchReady() || points.length < 2) return
    const first = camera.pointFromClient(points[0]!)
    const second = camera.pointFromClient(points[1]!)
    const center: [number, number] = [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2]
    const viewport = camera.getViewport()
    gesture = {
      kind: 'pinch',
      viewport,
      distance: Math.max(1, Math.hypot(second[0] - first[0], second[1] - first[1])),
      anchor: [(center[0] - viewport.x) / viewport.k, (center[1] - viewport.y) / viewport.k],
    }
  }

  function applyPinch(camera: MapTouchCamera, points: readonly MapTouchPoint[]): void {
    if (gesture?.kind !== 'pinch' || !camera.isPinchReady() || points.length < 2) return
    const first = camera.pointFromClient(points[0]!)
    const second = camera.pointFromClient(points[1]!)
    const center: [number, number] = [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2]
    const ratio = Math.hypot(second[0] - first[0], second[1] - first[1]) / gesture.distance
    const scale = Math.max(
      camera.minimumZoomScale(),
      Math.min(MAP_ZOOM_MAX_SCALE, gesture.viewport.k * ratio),
    )
    camera.applyViewport({
      x: center[0] - gesture.anchor[0] * scale,
      y: center[1] - gesture.anchor[1] * scale,
      k: scale,
    })
  }

  function start(event: MapTouchEvent): void {
    if (!options.isEnabled()) {
      cancel()
      return
    }
    const points = Array.from(event.touches)
    if (points.length === 1) {
      const camera = options.getCamera()
      if (!camera || (options.moveEnabled() && event.ctrlKey)
        || !isSingleTouchPanEligible(event.target, options.moveEnabled(), options.surface)) {
        cancel()
        return
      }
      camera.interrupt()
      const liveCamera = options.getCamera()
      if (!liveCamera) {
        cancel()
        return
      }
      const point = points[0]!
      const startedAt = event.timeStamp
      const tap = event.type === 'touchstart' && typeof startedAt === 'number' && Number.isFinite(startedAt)
        && point.identifier !== undefined && options.canDoubleTap?.(event.target)
        ? { id: point.identifier, startedAt }
        : null
      if (!tap) clearDoubleTap()
      gesture = {
        kind: 'pending-pan',
        viewport: liveCamera.getViewport(),
        start: liveCamera.pointFromClient(point),
        startClient: [point.clientX, point.clientY],
        tap,
      }
      return
    }
    clearDoubleTap()
    if (points.length < 2) return

    // Takeover can synchronously cancel this controller or redraw its map, so reacquire the
    // mounted camera only after the local edit owner has completed its cancellation.
    options.onPinchTakeover()
    options.getCamera()?.interrupt()
    beginPinch(options.getCamera(), points)
    event.preventDefault()
    event.stopPropagation()
  }

  function move(event: MapTouchEvent): void {
    if (!options.isEnabled() || !gesture) return
    const camera = options.getCamera()
    if (!camera || !camera.isPinchReady()) return
    const points = Array.from(event.touches)
    if (gesture.kind === 'pending-pan') {
      if (points.length !== 1) clearDoubleTap()
      const touch = points[0]
      if (!touch || Math.hypot(
        touch.clientX - gesture.startClient[0],
        touch.clientY - gesture.startClient[1],
      ) <= MAP_TOUCH_PAN_THRESHOLD_PX) return
      clearDoubleTap()
      gesture = { kind: 'pan', viewport: gesture.viewport, start: gesture.start }
    }

    event.preventDefault()
    event.stopImmediatePropagation()

    if (gesture.kind === 'pinch') {
      applyPinch(camera, points)
    } else if (gesture.kind === 'pan' && points.length >= 1) {
      const point = camera.pointFromClient(points[0]!)
      camera.applyViewport({
        x: gesture.viewport.x + point[0] - gesture.start[0],
        y: gesture.viewport.y + point[1] - gesture.start[1],
        k: gesture.viewport.k,
      })
    }
  }

  function end(event: MapTouchEvent): void {
    if (!options.isEnabled() || !gesture) {
      clearDoubleTap()
      return
    }
    const camera = options.getCamera()
    if (!camera || (options.surface === 'system' && !camera.isPinchReady())) {
      clearDoubleTap()
      return
    }
    const points = Array.from(event.touches)
    if (points.length >= 2) {
      beginPinch(camera, points)
    } else if (points.length === 1) {
      if (camera.isPinchReady() || options.surface === 'cluster') {
        gesture = {
          kind: 'pan',
          viewport: camera.getViewport(),
          start: camera.pointFromClient(points[0]!),
        }
      }
    } else {
      if (gesture.kind === 'pending-pan') finishTap(gesture, event, camera)
      else clearDoubleTap()
      gesture = null
    }
  }

  /** Starts an Orbit-owned pinch without triggering ordinary edit takeover or DOM consumption. */
  function startPinch(points: readonly MapTouchPoint[]): void {
    if (!options.isEnabled() || points.length < 2) return
    clearDoubleTap()
    options.getCamera()?.interrupt()
    beginPinch(options.getCamera(), points)
  }

  /** Updates the camera from Orbit-owned pointer contacts without taking over placement. */
  function movePinch(points: readonly MapTouchPoint[]): void {
    if (!options.isEnabled() || points.length < 2) return
    const camera = options.getCamera()
    if (camera) applyPinch(camera, points)
  }

  function cancel(): void {
    gesture = null
    clearDoubleTap()
  }

  return { start, move, end, startPinch, movePinch, endPinch: cancel, cancel, clearDoubleTap }
}
