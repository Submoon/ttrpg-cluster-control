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
    resizeObserver?.disconnect()
    const element = options.element.value
    if (element) select(element).on('.zoom', null)
  })

  watch(options.active, active => {
    const element = options.element.value
    if (!element) return
    if (active) {
      attachZoom()
      if (!cameraInitialized.value) fitPlayerMap()
    } else {
      select(element).on('.zoom', null)
    }
  }, { flush: 'sync' })

  function attachZoom(): void {
    const element = options.element.value
    if (!element || !options.active.value) return
    if (!zoomBehavior) {
      zoomBehavior = zoom<SVGSVGElement, unknown>()
        .filter(event => options.active.value
          && (!event.ctrlKey || event.type === 'wheel')
          && !event.button)
        .extent(() => {
          const rect = getSvgViewportRect(element)
          return [[rect.x, rect.y], [rect.x + rect.width, rect.y + rect.height]]
        })
        .scaleExtent([minimumScale.value, MAP_ZOOM_MAX_SCALE])
        .touchable(() => true)
        .on('zoom.player', event => {
          const next = { x: event.transform.x, y: event.transform.y, k: event.transform.k }
          camera.value = next
          options.onCameraChange?.(next)
        })
    } else {
      zoomBehavior.scaleExtent([minimumScale.value, MAP_ZOOM_MAX_SCALE])
    }
    select(element).call(zoomBehavior)
  }

  function measureSvg(): void {
    const matrix = options.element.value?.getScreenCTM()
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
    if (!options.active.value) return false
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
    if (!options.active.value) return false
    updateMinimumScale()
    const bounded = clampMapViewport(next, minimumScale.value)
    if (!bounded) return false
    applyCamera(bounded)
    cameraInitialized.value = true
    return true
  }

  function fitPlayerMap(): boolean {
    if (!options.active.value) return false
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
    if (!options.active.value || !Number.isFinite(factor) || factor <= 0) return
    const element = options.element.value
    if (!element || !zoomBehavior) return
    options.onManualCameraInteraction?.()
    select(element).call(zoomBehavior.scaleBy, factor)
  }

  function panBy(horizontal: number, vertical: number): void {
    if (!options.active.value || !Number.isFinite(horizontal) || !Number.isFinite(vertical)) return
    options.onManualCameraInteraction?.()
    applyCamera({
      x: camera.value.x + horizontal,
      y: camera.value.y + vertical,
      k: camera.value.k,
    })
  }

  function handleMapKeydown(event: KeyboardEvent): void {
    if (!options.active.value) return
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
