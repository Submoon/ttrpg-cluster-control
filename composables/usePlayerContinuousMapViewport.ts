/** Owns one independent D3 camera for a continuous public player map. */
import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import { select, zoom, zoomIdentity, type ZoomBehavior } from 'd3'
import type { PlayerUsableRectReader } from '../utils/player-inspection'
import { fitPlayerContinuousTarget } from '../utils/player-continuous-map-layout'
import {
  clientRectToSvgViewportRect,
  clampMapViewport,
  fitMapViewport,
  getSvgViewportRect,
  MAP_ZOOM_MAX_SCALE,
  MAP_ZOOM_MIN_SCALE,
  svgViewportExtent,
  type MapViewport,
  type SvgViewportRect as CameraBounds,
} from '../utils/map-zoom'

interface PlayerContinuousMapViewportOptions {
  element: Readonly<Ref<SVGSVGElement | null>>
  contentBounds: Readonly<Ref<CameraBounds>>
  active: Readonly<Ref<boolean>>
  getUsableClientRect: Readonly<Ref<PlayerUsableRectReader | undefined>>
  onCameraChange?: (camera: MapViewport) => void
  onManualCameraInteraction?: () => void
}

interface MousePan {
  pointerId: number
  element: SVGSVGElement
  view: Window
  startClientX: number
  startClientY: number
  lastClientX: number
  lastClientY: number
  dragging: boolean
}

/**
 * Keeps camera state in the mounted player view. It reads only the public scene bounds supplied by
 * its caller and never writes or derives state from the Warden editor.
 */
export function usePlayerContinuousMapViewport(options: PlayerContinuousMapViewportOptions) {
  const camera = ref<MapViewport>({ x: 0, y: 0, k: 1 })
  const minimumScale = ref(MAP_ZOOM_MIN_SCALE)
  const svgPixelScale = ref(1)
  const cameraInitialized = ref(false)
  const canZoomIn = computed(() => options.active.value && camera.value.k < MAP_ZOOM_MAX_SCALE - 0.001)
  const canZoomOut = computed(() => options.active.value && camera.value.k > minimumScale.value + 0.001)
  const sceneTransform = computed(() => `translate(${camera.value.x} ${camera.value.y}) scale(${camera.value.k})`)
  const screenLayerTransform = computed(() =>
    `translate(${-camera.value.x / camera.value.k} ${-camera.value.y / camera.value.k}) scale(${1 / camera.value.k})`,
  )
  let zoomBehavior: ZoomBehavior<SVGSVGElement, unknown> | undefined
  let resizeObserver: ResizeObserver | undefined
  let disposed = false
  let mousePan: MousePan | undefined
  let draggedClick: { view: Window; pointerId: number; timeout: number } | undefined

  onMounted(() => {
    attachZoom()
    measureSvg()
    const element = options.element.value
    if (typeof ResizeObserver !== 'undefined' && element) {
      resizeObserver = new ResizeObserver(() => {
        measureSvg()
        if (!cameraInitialized.value) fitPlayerMap()
      })
      resizeObserver.observe(element)
    }
    if (options.active.value) fitPlayerMap()
  })

  onBeforeUnmount(() => {
    disposed = true
    resizeObserver?.disconnect()
    detachInput()
  })

  watch(options.active, active => {
    if (active) {
      attachZoom()
      measureSvg()
      if (!cameraInitialized.value) fitPlayerMap()
    } else {
      detachInput()
    }
  }, { flush: 'sync' })

  function attachZoom(): void {
    const element = options.element.value
    if (disposed || !element || !options.active.value) return
    if (!zoomBehavior) {
      zoomBehavior = zoom<SVGSVGElement, unknown>()
        .filter(event => !disposed && options.active.value
          // D3's native mouse gesture installs window listeners that outlive a hidden SVG.
          && event.type !== 'mousedown'
          && (!event.ctrlKey || event.type === 'wheel')
          && !event.button)
        .scaleExtent([minimumScale.value, MAP_ZOOM_MAX_SCALE])
        .touchable(() => true)
        .on('zoom.player', function (event) {
          if (disposed || !options.active.value || options.element.value !== this || !this.isConnected) return
          const next = { x: event.transform.x, y: event.transform.y, k: event.transform.k }
          camera.value = next
          options.onCameraChange?.(next)
        })
    } else {
      zoomBehavior.scaleExtent([minimumScale.value, MAP_ZOOM_MAX_SCALE])
    }
    select(element).call(zoomBehavior)
      .on('pointerdown.player-camera', startMousePan)
      .on('lostpointercapture.player-camera', cancelMousePan)
  }

  function detachInput(): void {
    cancelMousePan()
    clearDraggedClick()
    const element = options.element.value
    if (element) select(element).interrupt().on('.zoom', null).on('.player-camera', null)
  }

  function startMousePan(event: PointerEvent): void {
    clearDraggedClick()
    if (disposed || !options.active.value || !event.isPrimary || event.pointerType === 'touch'
      || event.button !== 0 || event.ctrlKey) return
    cancelMousePan()
    const element = options.element.value
    const view = element?.ownerDocument.defaultView
    if (!element || !element.isConnected || !element.getScreenCTM() || !view) return
    select(element).interrupt()
    mousePan = {
      pointerId: event.pointerId, element, view,
      startClientX: event.clientX, startClientY: event.clientY,
      lastClientX: event.clientX, lastClientY: event.clientY, dragging: false,
    }
    view.addEventListener('pointermove', moveMousePan, true)
    view.addEventListener('pointerup', finishMousePan, true)
    view.addEventListener('pointercancel', cancelMousePan, true)
    view.addEventListener('blur', cancelMousePan)
    view.addEventListener('dragstart', preventMouseSelection, true)
    view.addEventListener('selectstart', preventMouseSelection, true)
  }

  function moveMousePan(event: PointerEvent): void {
    const pan = mousePan
    if (!pan || pan.pointerId !== event.pointerId) return
    if (disposed || !options.active.value || options.element.value !== pan.element || !pan.element.isConnected
      || event.buttons !== 1) {
      cancelMousePan()
      return
    }
    if (!pan.dragging) {
      if (Math.hypot(event.clientX - pan.startClientX, event.clientY - pan.startClientY) < 4) return
      pan.dragging = true
      options.onManualCameraInteraction?.()
      if (mousePan !== pan || disposed || !options.active.value) return
      try {
        pan.element.setPointerCapture(pan.pointerId)
      } catch {
        // The owned window listeners still finish a contact when capture is unavailable.
      }
    }
    event.preventDefault()
    const matrix = pan.element.getScreenCTM()
    if (!matrix) {
      cancelMousePan()
      return
    }
    // Translate the current camera by only this delivered movement, retaining intervening zoom or keys.
    const screenToSvg = matrix.inverse()
    const previous = new DOMPoint(pan.lastClientX, pan.lastClientY).matrixTransform(screenToSvg)
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(screenToSvg)
    pan.lastClientX = event.clientX
    pan.lastClientY = event.clientY
    applyCamera({ x: camera.value.x + point.x - previous.x, y: camera.value.y + point.y - previous.y, k: camera.value.k })
  }

  function preventMouseSelection(event: Event): void {
    if (mousePan) event.preventDefault()
  }

  function finishMousePan(event: PointerEvent): void {
    const pan = mousePan
    if (!pan || pan.pointerId !== event.pointerId) return
    cancelMousePan()
    if (!pan.dragging || disposed || !options.active.value) return
    // Suppress only this released drag's immediate compatibility click, before map inspection.
    draggedClick = { view: pan.view, pointerId: pan.pointerId, timeout: pan.view.setTimeout(clearDraggedClick, 0) }
    pan.view.addEventListener('click', suppressDraggedClick, true)
  }

  function cancelMousePan(event?: Event): void {
    const pan = mousePan
    if (!pan || (event && 'pointerId' in event && event.pointerId !== pan.pointerId)) return
    mousePan = undefined
    pan.view.removeEventListener('pointermove', moveMousePan, true)
    pan.view.removeEventListener('pointerup', finishMousePan, true)
    pan.view.removeEventListener('pointercancel', cancelMousePan, true)
    pan.view.removeEventListener('blur', cancelMousePan)
    pan.view.removeEventListener('dragstart', preventMouseSelection, true)
    pan.view.removeEventListener('selectstart', preventMouseSelection, true)
    if (pan.element.hasPointerCapture(pan.pointerId)) pan.element.releasePointerCapture(pan.pointerId)
  }

  function clearDraggedClick(): void {
    if (!draggedClick) return
    draggedClick.view.clearTimeout(draggedClick.timeout)
    draggedClick.view.removeEventListener('click', suppressDraggedClick, true)
    draggedClick = undefined
  }

  function suppressDraggedClick(event: MouseEvent): void {
    if (!draggedClick || !event.isTrusted || event.detail === 0 || event.button !== 0) return
    if ('pointerId' in event && event.pointerId !== draggedClick.pointerId) return
    clearDraggedClick()
    event.preventDefault()
    event.stopImmediatePropagation()
  }

  function measureSvg(): void {
    if (disposed) return
    const element = options.element.value
    if (!element) return
    // D3 uses the drawable SVG for input; explicit framing measures the unobstructed area below.
    zoomBehavior?.extent(svgViewportExtent(getSvgViewportRect(element)))
    const matrix = element.getScreenCTM()
    if (!matrix) return
    const horizontal = Math.hypot(matrix.a, matrix.b)
    const vertical = Math.hypot(matrix.c, matrix.d)
    const measured = Math.min(horizontal, vertical)
    if (Number.isFinite(measured) && measured > 0) svgPixelScale.value = measured
  }

  function usableViewportRect(): CameraBounds | undefined {
    const element = options.element.value
    if (!element) return undefined
    const full = getSvgViewportRect(element)
    const reader = options.getUsableClientRect.value
    if (!reader) return full
    const client = element.getBoundingClientRect()
    const mapClientRect = {
      left: client.left + element.clientLeft,
      top: client.top + element.clientTop,
      right: client.left + element.clientLeft + element.clientWidth,
      bottom: client.top + element.clientTop + element.clientHeight,
    }
    const usableClientRect = reader(mapClientRect)
    if (!usableClientRect) return undefined
    const usable = clientRectToSvgViewportRect(element, usableClientRect)
    if (!usable) return undefined
    const left = Math.max(full.x, usable.x)
    const top = Math.max(full.y, usable.y)
    const right = Math.min(full.x + full.width, usable.x + usable.width)
    const bottom = Math.min(full.y + full.height, usable.y + usable.height)
    return right > left && bottom > top
      ? { x: left, y: top, width: right - left, height: bottom - top }
      : undefined
  }

  function updateMinimumScale(rect = usableViewportRect(), allowIncrease = false): void {
    const fitted = rect ? fitMapViewport(options.contentBounds.value, rect, Number.MIN_VALUE) : undefined
    const fittedMinimum = fitted ? Math.min(MAP_ZOOM_MIN_SCALE, fitted.k) : MAP_ZOOM_MIN_SCALE
    minimumScale.value = allowIncrease ? fittedMinimum : Math.min(minimumScale.value, fittedMinimum)
    zoomBehavior?.scaleExtent([minimumScale.value, MAP_ZOOM_MAX_SCALE])
  }

  function applyCamera(next: MapViewport): void {
    if (disposed || !options.active.value) return
    const element = options.element.value
    const bounded = clampMapViewport(next, minimumScale.value)
    if (!element || !bounded) return
    if (zoomBehavior && options.active.value) {
      select(element).call(zoomBehavior.transform, zoomIdentity.translate(bounded.x, bounded.y).scale(bounded.k))
    } else {
      camera.value = bounded
      options.onCameraChange?.(bounded)
    }
  }

  function frameBounds(
    bounds: SvgViewportRect,
    preferredScale?: number,
    requiredScale = minimumScale.value,
  ): boolean {
    if (disposed || !options.active.value) return false
    const viewport = usableViewportRect()
    if (!viewport) return false
    updateMinimumScale(viewport)
    const fitted = fitPlayerContinuousTarget(bounds, viewport, minimumScale.value, preferredScale, requiredScale)
    if (!fitted) return false
    applyCamera(fitted)
    cameraInitialized.value = true
    return true
  }

  /** Applies a camera calculated by a pure viewport solver through the mounted D3 camera. */
  function setViewport(next: MapViewport): boolean {
    if (disposed || !options.active.value) return false
    updateMinimumScale()
    const bounded = clampMapViewport(next, minimumScale.value)
    if (!bounded) return false
    applyCamera(bounded)
    cameraInitialized.value = true
    return true
  }

  function fitPlayerMap(): boolean {
    if (disposed || !options.active.value) return false
    const viewport = usableViewportRect()
    if (!viewport) return false
    updateMinimumScale(viewport, true)
    const fitted = fitMapViewport(options.contentBounds.value, viewport, minimumScale.value)
    if (!fitted) return false
    applyCamera(fitted)
    cameraInitialized.value = true
    return true
  }

  function zoomBy(factor: number): void {
    if (disposed || !options.active.value || !Number.isFinite(factor) || factor <= 0) return
    const element = options.element.value
    if (!element || !zoomBehavior) return
    options.onManualCameraInteraction?.()
    select(element).call(zoomBehavior.scaleBy, factor)
  }

  function panBy(horizontal: number, vertical: number): void {
    if (disposed || !options.active.value || !Number.isFinite(horizontal) || !Number.isFinite(vertical)) return
    options.onManualCameraInteraction?.()
    applyCamera({
      x: camera.value.x + horizontal,
      y: camera.value.y + vertical,
      k: camera.value.k,
    })
  }

  function handleMapKeydown(event: KeyboardEvent): void {
    if (disposed || !options.active.value) return
    switch (event.key) {
      case 'ArrowLeft': panBy(40, 0); break
      case 'ArrowRight': panBy(-40, 0); break
      case 'ArrowUp': panBy(0, 40); break
      case 'ArrowDown': panBy(0, -40); break
      case '+':
      case '=': zoomBy(1.2); break
      case '-': zoomBy(1 / 1.2); break
      case '0':
        options.onManualCameraInteraction?.()
        fitPlayerMap()
        break
      default: return
    }
    event.preventDefault()
  }

  function focusMap(): void {
    if (disposed || !options.active.value) return
    options.element.value?.focus({ preventScroll: true })
  }

  return {
    camera,
    canZoomIn,
    canZoomOut,
    fitPlayerMap,
    focusMap,
    frameBounds,
    getUsableViewportRect: usableViewportRect,
    handleMapKeydown,
    measureSvg,
    minimumScale,
    panBy,
    sceneTransform,
    screenLayerTransform,
    setViewport,
    svgPixelScale,
    zoomBy,
  }
}
