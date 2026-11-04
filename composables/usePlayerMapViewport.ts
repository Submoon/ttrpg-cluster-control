/** Owns temporary camera state and mounted-map input for a read-only player map. */
import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue'
import type { ClientRectBounds } from '../utils/map-usable-area'
import type { PlayerUsableRectReader } from '../utils/player-inspection'
import {
  playerMapObstructionInsets,
  revealPlayerMapPoint,
  type PlayerMapSceneBounds,
  type PlayerMapViewportSize,
} from '../utils/player-map-fit'

interface PanGesture {
  pointerId: number
  startX: number
  startY: number
  startBounds: PlayerMapSceneBounds
  startedAtFit: boolean
  screenToScene: DOMMatrix
}

interface PlayerMapViewportOptions {
  element: Readonly<Ref<SVGSVGElement | null>>
  fittedBounds: Readonly<Ref<PlayerMapSceneBounds>>
  viewportSize: Readonly<Ref<PlayerMapViewportSize>>
  active: Readonly<Ref<boolean>>
  maximumZoom: Readonly<Ref<number>>
  getUsableClientRect: Readonly<Ref<PlayerUsableRectReader | undefined>>
  isInteractiveTarget: (target: EventTarget | null) => boolean
}

interface CameraLimits {
  minLeft: number
  maxLeft: number
  minTop: number
  maxTop: number
}

interface ViewportGeometry {
  viewport: PlayerMapViewportSize
  usable: ClientRectBounds | null
}

/** Keeps navigation camera state local to one rendered player map, never the editor workspace. */
export function usePlayerMapViewport(options: PlayerMapViewportOptions) {
  const viewportBounds = ref<PlayerMapSceneBounds | null>(null)
  const panGesture = ref<PanGesture | null>(null)
  const zoomStep = 1.2
  const currentBounds = computed(() => viewportBounds.value ?? options.fittedBounds.value)
  const zoomLevel = computed(() => options.fittedBounds.value.width / currentBounds.value.width)
  const canZoomIn = computed(() => options.active.value
    && zoomLevel.value < options.maximumZoom.value - 0.001)
  const canZoomOut = computed(() => options.active.value && zoomLevel.value > 1.001)
  const canPan = computed(() => {
    if (!options.active.value) return false
    const current = currentBounds.value
    const limits = cameraLimits(options.fittedBounds.value, current.width, current.height)
    if (!limits) return false
    const epsilon = 0.001
    return current.left > limits.minLeft + epsilon
      || current.left < limits.maxLeft - epsilon
      || current.top > limits.minTop + epsilon
      || current.top < limits.maxTop - epsilon
  })
  const viewBox = computed(() => {
    const bounds = currentBounds.value
    return `${bounds.left} ${bounds.top} ${bounds.width} ${bounds.height}`
  })

  watch(options.active, active => {
    if (!active) cancelOwnedPan(true)
  }, { flush: 'sync' })
  onBeforeUnmount(() => cancelOwnedPan(false))

  function resetViewport(): void {
    cancelOwnedPan(false)
    viewportBounds.value = null
  }

  function fitPlayerMap(): void {
    resetViewport()
  }

  function zoomIn(): void {
    zoomView(zoomStep)
  }

  function zoomOut(): void {
    zoomView(1 / zoomStep)
  }

  function zoomView(factor: number, anchor?: DOMPoint): void {
    if (!options.active.value || !Number.isFinite(factor) || factor <= 0) return
    const fitted = options.fittedBounds.value
    const current = currentBounds.value
    const nextZoom = Math.max(1, Math.min(options.maximumZoom.value, zoomLevel.value * factor))
    if (nextZoom <= 1.001) {
      viewportBounds.value = null
      return
    }

    const width = fitted.width / nextZoom
    const height = fitted.height / nextZoom
    const centerX = anchor?.x ?? current.left + current.width / 2
    const centerY = anchor?.y ?? current.top + current.height / 2
    const ratio = width / current.width
    const left = centerX - (centerX - current.left) * ratio
    const top = centerY - (centerY - current.top) * ratio
    const clamped = clampViewport({ left, top, width, height }, fitted)
    if (clamped) viewportBounds.value = clamped
  }

  function panView(horizontal: -1 | 0 | 1, vertical: -1 | 0 | 1): void {
    if (!canPan.value) return
    const current = currentBounds.value
    const clamped = clampViewport({
      left: current.left + horizontal * current.width * 0.16,
      top: current.top + vertical * current.height * 0.16,
      width: current.width,
      height: current.height,
    }, options.fittedBounds.value)
    if (clamped) viewportBounds.value = clamped
  }

  function clampViewport(
    candidate: PlayerMapSceneBounds,
    fitted: PlayerMapSceneBounds,
  ): PlayerMapSceneBounds | undefined {
    const width = Math.min(candidate.width, fitted.width)
    const height = Math.min(candidate.height, fitted.height)
    const limits = cameraLimits(fitted, width, height)
    if (!limits) return undefined
    return {
      left: clamp(candidate.left, limits.minLeft, limits.maxLeft),
      top: clamp(candidate.top, limits.minTop, limits.maxTop),
      width,
      height,
    }
  }

  function cameraLimits(
    fitted: PlayerMapSceneBounds,
    width: number,
    height: number,
  ): CameraLimits | undefined {
    const geometry = viewportGeometry()
    if (!geometry || !geometry.usable) return undefined
    const insets = playerMapObstructionInsets(fitted, geometry.viewport, geometry.usable, {
      left: fitted.left,
      top: fitted.top,
      width,
      height,
    })
    if (!insets) return undefined
    return {
      minLeft: fitted.left - insets.left,
      maxLeft: fitted.left + fitted.width - width + insets.right,
      minTop: fitted.top - insets.top,
      maxTop: fitted.top + fitted.height - height + insets.bottom,
    }
  }

  /** Reads DOM geometry for each input so panel changes never rely on a cached usable rectangle. */
  function viewportGeometry(): ViewportGeometry | undefined {
    const svg = options.element.value
    if (!svg) return undefined
    const rect = svg.getBoundingClientRect()
    if (!Number.isFinite(rect.left) || !Number.isFinite(rect.top) || rect.width <= 0 || rect.height <= 0) {
      return undefined
    }

    const viewport = {
      width: svg.clientWidth || options.viewportSize.value.width,
      height: svg.clientHeight || options.viewportSize.value.height,
    }
    if (!Number.isFinite(viewport.width) || !Number.isFinite(viewport.height)
      || viewport.width <= 0 || viewport.height <= 0) return undefined
    const mapClientRect = {
      left: rect.left + svg.clientLeft,
      top: rect.top + svg.clientTop,
      right: rect.left + svg.clientLeft + viewport.width,
      bottom: rect.top + svg.clientTop + viewport.height,
    }
    const reader = options.getUsableClientRect.value
    const absoluteUsable = reader ? reader(mapClientRect) : mapClientRect
    if (!absoluteUsable) return { viewport, usable: null }
    return {
      viewport,
      usable: {
        left: absoluteUsable.left - mapClientRect.left,
        top: absoluteUsable.top - mapClientRect.top,
        right: absoluteUsable.right - mapClientRect.left,
        bottom: absoluteUsable.bottom - mapClientRect.top,
      },
    }
  }

  function handleMapKeydown(event: KeyboardEvent): void {
    if (!options.active.value) return
    switch (event.key) {
      case 'ArrowLeft': panView(-1, 0); break
      case 'ArrowRight': panView(1, 0); break
      case 'ArrowUp': panView(0, -1); break
      case 'ArrowDown': panView(0, 1); break
      case '+':
      case '=': zoomView(zoomStep); break
      case '-': zoomView(1 / zoomStep); break
      case '0': fitPlayerMap(); break
      default: return
    }
    event.preventDefault()
  }

  function handleWheel(event: WheelEvent): void {
    if (!options.active.value) return
    const transform = options.element.value?.getScreenCTM()
    const anchor = transform
      ? new DOMPoint(event.clientX, event.clientY).matrixTransform(transform.inverse())
      : undefined
    zoomView(event.deltaY < 0 ? zoomStep : 1 / zoomStep, anchor)
  }

  function startPan(event: PointerEvent): void {
    if (!options.active.value || event.button !== 0 || !event.isPrimary
      || !canPan.value || options.isInteractiveTarget(event.target)) return
    const svg = options.element.value
    const screenMatrix = svg?.getScreenCTM()
    if (!svg || !screenMatrix) return

    const screenToScene = screenMatrix.inverse()
    const start = new DOMPoint(event.clientX, event.clientY).matrixTransform(screenToScene)
    panGesture.value = {
      pointerId: event.pointerId,
      startX: start.x,
      startY: start.y,
      startBounds: { ...currentBounds.value },
      startedAtFit: viewportBounds.value === null,
      screenToScene,
    }
    svg.setPointerCapture(event.pointerId)
    event.preventDefault()
  }

  function movePan(event: PointerEvent): void {
    const gesture = panGesture.value
    if (!options.active.value || !gesture || gesture.pointerId !== event.pointerId) return
    const current = new DOMPoint(event.clientX, event.clientY).matrixTransform(gesture.screenToScene)
    const clamped = clampViewport({
      left: gesture.startBounds.left - (current.x - gesture.startX),
      top: gesture.startBounds.top - (current.y - gesture.startY),
      width: gesture.startBounds.width,
      height: gesture.startBounds.height,
    }, options.fittedBounds.value)
    if (clamped) viewportBounds.value = clamped
  }

  function revealPoint(point: { x: number; y: number }): boolean {
    if (!options.active.value || panGesture.value) return false
    const geometry = viewportGeometry()
    if (!geometry || !geometry.usable) return false
    const revealed = revealPlayerMapPoint({
      point,
      current: currentBounds.value,
      fitted: options.fittedBounds.value,
      viewport: geometry.viewport,
      usable: geometry.usable,
    })
    if (!revealed) return false

    viewportBounds.value = sameBounds(revealed, options.fittedBounds.value) ? null : revealed
    return true
  }

  function finishPan(event: PointerEvent): void {
    if (panGesture.value?.pointerId !== event.pointerId) return
    panGesture.value = null
    releasePanCapture(event.pointerId)
  }

  function cancelPan(event: PointerEvent): void {
    if (panGesture.value?.pointerId !== event.pointerId) return
    cancelOwnedPan(true)
  }

  function cancelOwnedPan(restoreStart: boolean): void {
    const gesture = panGesture.value
    if (!gesture) return
    if (restoreStart) viewportBounds.value = gesture.startedAtFit ? null : gesture.startBounds
    panGesture.value = null
    releasePanCapture(gesture.pointerId)
  }

  function releasePanCapture(pointerId: number): void {
    const svg = options.element.value
    if (svg?.hasPointerCapture(pointerId)) svg.releasePointerCapture(pointerId)
  }

  function sameBounds(left: PlayerMapSceneBounds, right: PlayerMapSceneBounds): boolean {
    return left.left === right.left
      && left.top === right.top
      && left.width === right.width
      && left.height === right.height
  }

  function clamp(value: number, minimum: number, maximum: number): number {
    return Math.max(minimum, Math.min(maximum, value))
  }

  return {
    canPan,
    canZoomIn,
    canZoomOut,
    fitPlayerMap,
    handleMapKeydown,
    handleWheel,
    movePan,
    panGesture,
    panView,
    revealPoint,
    resetViewport,
    zoomIn,
    zoomOut,
    startPan,
    finishPan,
    cancelPan,
    viewBox,
  }
}
