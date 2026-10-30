/** Owns temporary camera state and mounted-map input for a read-only player map. */
import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue'

export interface PlayerMapSceneBounds {
  left: number
  top: number
  width: number
  height: number
}

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
  active: Readonly<Ref<boolean>>
  maximumZoom: Readonly<Ref<number>>
  isInteractiveTarget: (target: EventTarget | null) => boolean
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
  const canPan = computed(() => options.active.value && zoomLevel.value > 1.001)
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
    viewportBounds.value = clampViewport({ left, top, width, height }, fitted)
  }

  function panView(horizontal: -1 | 0 | 1, vertical: -1 | 0 | 1): void {
    if (!canPan.value) return
    const current = currentBounds.value
    viewportBounds.value = clampViewport({
      left: current.left + horizontal * current.width * 0.16,
      top: current.top + vertical * current.height * 0.16,
      width: current.width,
      height: current.height,
    }, options.fittedBounds.value)
  }

  function clampViewport(candidate: PlayerMapSceneBounds, fitted: PlayerMapSceneBounds): PlayerMapSceneBounds {
    const width = Math.min(candidate.width, fitted.width)
    const height = Math.min(candidate.height, fitted.height)
    return {
      left: Math.max(fitted.left, Math.min(fitted.left + fitted.width - width, candidate.left)),
      top: Math.max(fitted.top, Math.min(fitted.top + fitted.height - height, candidate.top)),
      width,
      height,
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
      || options.isInteractiveTarget(event.target)) return
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
    viewportBounds.value = clampViewport({
      left: gesture.startBounds.left - (current.x - gesture.startX),
      top: gesture.startBounds.top - (current.y - gesture.startY),
      width: gesture.startBounds.width,
      height: gesture.startBounds.height,
    }, options.fittedBounds.value)
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
    resetViewport,
    zoomIn,
    zoomOut,
    startPan,
    finishPan,
    cancelPan,
    viewBox,
  }
}
