<template>
  <div class="map-view flex h-full min-h-0 min-w-0 flex-1 flex-col">
    <div v-if="showZoomControls" class="map-navigation flex shrink-0 items-center gap-1 border-b border-[var(--line-soft)] bg-[var(--panel-bg)] px-2 py-1" role="toolbar" aria-label="Map navigation">
      <button type="button" aria-label="Zoom out" :disabled="zoomLevel <= MAP_ZOOM_MIN_SCALE * 100" @click="zoomBy(1 / 1.2)">−</button>
      <output aria-label="Zoom level" aria-live="polite">{{ zoomLevel }}%</output>
      <button type="button" aria-label="Zoom in" :disabled="zoomLevel >= MAP_ZOOM_MAX_SCALE * 100" @click="zoomBy(1.2)">+</button>
      <button type="button" aria-label="Fit map" @click="fitMap">Fit</button>
    </div>
    <svg
      ref="svgElement"
      class="cluster-map-svg block h-full min-h-0 w-full flex-1"
      :class="{ 'map-touch-surface': touchNavigation }"
      viewBox="0 0 960 560"
      role="group"
      :aria-label="`${cluster.name} Jump Cluster map`"
      aria-description="Focus this map and use the arrow keys to pan. Focus a map item to use its keyboard controls."
      tabindex="0"
      @touchstart.capture="startTouchNavigation"
      @keydown="activateClusterTargetFromKeyboard"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * D3 owns the SVG scene and gestures; Vue owns controls/events, with unscoped styles targeting D3-created nodes.
 */
import { drag, pointer, select, zoom, zoomIdentity, zoomTransform, type ZoomBehavior } from 'd3'
import { captureD3MouseGesture, type D3MouseGestureDisposer } from './maps/d3-mouse-gesture'
import {
  jumpPointsInCluster,
  type JumpCluster,
  type JumpRoute,
  type Point,
  type StarSystem,
} from '../domain/workspace'
import {
  clusterRouteGeometry,
  clusterRouteLabel,
  clusterSystemPosition,
} from '../utils/cluster-map-geometry'
import { exportMapImage, type MapImageFormat, type MapImagePalette } from '../utils/map-image-export'
import {
  clampMapViewport,
  fitMapViewport,
  getSvgViewportRect,
  MAP_ZOOM_MAX_SCALE,
  MAP_ZOOM_MIN_SCALE,
  normalizeSvgViewportRect,
  svgViewportExtent,
  type MapViewport,
  type SvgViewportRect,
} from '../utils/map-zoom'

const props = withDefaults(defineProps<{
  cluster: JumpCluster
  systemPositions: Record<string, Point>
  selectedSystemId: string | null
  selectedRouteId: string | null
  moveEnabled?: boolean
  systemActivation?: 'open' | 'select' | 'inspect'
  clusterAddType?: 'system' | 'route' | null
  clusterChooserOpen?: boolean
  clusterMoveTargeting?: boolean
  touchNavigation?: boolean
  showZoomControls?: boolean
}>(), {
  moveEnabled: true,
  systemActivation: 'open',
  clusterAddType: null,
  clusterChooserOpen: false,
  clusterMoveTargeting: false,
  touchNavigation: false,
  showZoomControls: true,
})

const emit = defineEmits<{
  'activate-system': [id: string]
  'open-system': [id: string]
  'cluster-target': [point: Point, systemIds: string[]]
  'cancel-cluster-preview': []
  'editing-gesture-change': [active: boolean]
  'select-route': [id: string]
  'move-system': [id: string, position: Point]
  'viewport-change': [viewport: MapViewport]
}>()

const svgElement = ref<SVGSVGElement | null>(null)
const zoomLevel = ref(100)
let zoomBehavior: ZoomBehavior<SVGSVGElement, unknown> | undefined
type ClusterTouchGesture =
  | { mode: 'pinch'; transform: ReturnType<typeof zoomTransform>; distance: number; anchor: [number, number] }
  | { mode: 'pan'; transform: ReturnType<typeof zoomTransform>; start: [number, number] }
let touchGesture: ClusterTouchGesture | null = null
let viewPan: { transform: ReturnType<typeof zoomTransform>; start: [number, number] } | null = null
let zoomExtentOverride: SvgViewportRect | undefined
const activeSystemGestures = new Map<SVGGElement, { rollback: () => void; mouseGesture: D3MouseGestureDisposer }>()
const cancelledSystemGestures = new WeakSet<SVGGElement>()
let refreshLiveRouteGeometry: (() => void) | undefined
let applyClusterSystemPositionPreview: ((systemId: string, position: Point | null) => void) | undefined

/** Returns the current D3 transform as the map's public viewport state. */
function getViewport(): MapViewport {
  const transform = svgElement.value ? zoomTransform(svgElement.value) : zoomIdentity
  return { x: transform.x, y: transform.y, k: transform.k }
}

/** Applies a finite viewport through D3 so scene transforms and zoom feedback stay synchronized. */
function setViewport(viewport: MapViewport): void {
  const element = svgElement.value
  const next = clampMapViewport(viewport)
  if (!element || !zoomBehavior || !next) return
  select(element).call(zoomBehavior.transform, zoomIdentity.translate(next.x, next.y).scale(next.k))
}

/** Applies a positive relative D3 zoom factor to the mounted SVG. */
function zoomBy(factor: number): void {
  if (!Number.isFinite(factor) || factor <= 0 || !svgElement.value || !zoomBehavior) return
  select(svgElement.value).call(zoomBehavior.scaleBy, factor)
}

/** Pans by a delta in SVG viewport user coordinates. */
function panBy(dx: number, dy: number): void {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return
  const viewport = getViewport()
  setViewport({ ...viewport, x: viewport.x + dx, y: viewport.y + dy })
}

/**
 * Exports the complete Cluster-map scene without adding a system title band.
 * @param format Requested SVG or PNG output.
 * @returns Export blob.
 * @throws If the SVG is not mounted or scene export/rasterization fails.
 */
function prepareExportClone(clone: SVGSVGElement): void {
  const jumpPoints = new Map(
    jumpPointsInCluster(props.cluster).map(reference => [reference.point.id, reference]),
  )

  clone.querySelectorAll<SVGGElement>('.cluster-system-node[data-system-id]').forEach(mark => {
    const systemId = mark.getAttribute('data-system-id')
    if (!systemId) return
    const position = clusterSystemPosition(props.systemPositions, systemId)
    mark.setAttribute('transform', `translate(${position.x} ${position.y})`)
  })

  clone.querySelectorAll<SVGGElement>('.cluster-route[data-route-id]').forEach(mark => {
    const routeId = mark.getAttribute('data-route-id')
    const index = props.cluster.routes.findIndex(route => route.id === routeId)
    const route = props.cluster.routes[index]
    if (!route || index < 0) return

    const geometry = clusterRouteGeometry(route, index, jumpPoints, props.systemPositions)
    const label = `Jump-${route.jumpLevel}`
    const labelWidth = Math.max(78, label.length * 7 + 18)
    mark.querySelector<SVGPathElement>('.cluster-route-line')?.setAttribute('d', geometry.path)
    const labelBackground = mark.querySelector<SVGRectElement>('.cluster-route-label-bg')
    labelBackground?.setAttribute('x', String(geometry.labelX - labelWidth / 2))
    labelBackground?.setAttribute('y', String(geometry.labelY - 12))
    const routeLabel = mark.querySelector<SVGTextElement>('.cluster-route-label')
    routeLabel?.setAttribute('x', String(geometry.labelX))
    routeLabel?.setAttribute('y', String(geometry.labelY + 2))
    const exitMark = mark.querySelector<SVGCircleElement>('.cluster-exit-mark')
    const exitLabel = mark.querySelector<SVGTextElement>('.cluster-exit-label')
    if (geometry.exitPoint) {
      exitMark?.setAttribute('cx', String(geometry.exitPoint.x))
      exitMark?.setAttribute('cy', String(geometry.exitPoint.y))
      exitLabel?.setAttribute('x', String(geometry.exitPoint.x - 10))
      exitLabel?.setAttribute('y', String(geometry.exitPoint.y + 24))
    }
  })
}

async function exportImage(format: MapImageFormat, palette: MapImagePalette = 'active'): Promise<Blob> {
  const element = svgElement.value
  if (!element) throw new Error('The Jump Cluster map is not ready to export.')
  return exportMapImage(element, format, undefined, palette, prepareExportClone)
}

/**
 * Fits route and system-card bounds inside the drawable viewport, clamping to supported zoom limits.
 * Empty or invalid geometry resets the view to the identity transform.
 */
function fitMap(usableRect?: SvgViewportRect): void {
  const element = svgElement.value
  const features = element?.querySelector<SVGGElement>('.cluster-map-items')
  if (!element || !features || !zoomBehavior) return

  const requestedRect = usableRect ? normalizeSvgViewportRect(usableRect) : undefined
  const rect = requestedRect ?? getSvgViewportRect(element)
  zoomExtentOverride = requestedRect
  zoomBehavior.extent(() => svgViewportExtent(zoomExtentOverride ?? getSvgViewportRect(element)))

  let bounds: DOMRect
  try {
    bounds = features.getBBox()
  } catch {
    setViewport({ x: 0, y: 0, k: 1 })
    return
  }
  const viewport = fitMapViewport(bounds, rect)
  setViewport(viewport ?? { x: 0, y: 0, k: 1 })
}

function touchPoint(touch: Touch, element: SVGSVGElement): [number, number] {
  return pointer(touch, element) as [number, number]
}

function beginTouchPinch(touches: TouchList): void {
  const element = svgElement.value
  if (!element || !zoomBehavior || touches.length < 2) return
  const first = touchPoint(touches[0]!, element)
  const second = touchPoint(touches[1]!, element)
  const center: [number, number] = [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2]
  const dx = second[0] - first[0]
  const dy = second[1] - first[1]
  const transform = zoomTransform(element)
  touchGesture = {
    mode: 'pinch',
    transform,
    distance: Math.max(1, Math.hypot(dx, dy)),
    anchor: transform.invert(center),
  }
}

function startTouchNavigation(event: TouchEvent): void {
  if (!props.touchNavigation || event.touches.length < 2) return
  cancelActiveGesture()
  beginTouchPinch(event.touches)
  event.preventDefault()
  event.stopPropagation()
}

function moveTouchNavigation(event: TouchEvent): void {
  const element = svgElement.value
  if (!props.touchNavigation || !element || !zoomBehavior || !touchGesture) return
  event.preventDefault()
  event.stopImmediatePropagation()

  if (touchGesture.mode === 'pinch' && event.touches.length >= 2) {
    const first = touchPoint(event.touches[0]!, element)
    const second = touchPoint(event.touches[1]!, element)
    const center: [number, number] = [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2]
    const ratio = Math.hypot(second[0] - first[0], second[1] - first[1]) / touchGesture.distance
    const scale = Math.max(MAP_ZOOM_MIN_SCALE, Math.min(MAP_ZOOM_MAX_SCALE, touchGesture.transform.k * ratio))
    const [anchorX, anchorY] = touchGesture.anchor
    select(element).call(zoomBehavior.transform, zoomIdentity.translate(center[0] - anchorX * scale, center[1] - anchorY * scale).scale(scale))
  } else if (touchGesture.mode === 'pan' && event.touches.length >= 1) {
    const point = touchPoint(event.touches[0]!, element)
    select(element).call(zoomBehavior.transform, zoomIdentity
      .translate(touchGesture.transform.x + point[0] - touchGesture.start[0], touchGesture.transform.y + point[1] - touchGesture.start[1])
      .scale(touchGesture.transform.k))
  }
}

function endTouchNavigation(event: TouchEvent): void {
  const element = svgElement.value
  if (!props.touchNavigation || !element || !touchGesture) return
  if (event.touches.length >= 2) {
    beginTouchPinch(event.touches)
  } else if (event.touches.length === 1) {
    touchGesture = { mode: 'pan', transform: zoomTransform(element), start: touchPoint(event.touches[0]!, element) }
  } else {
    touchGesture = null
  }
}

function cancelActiveGesture(): void {
  touchGesture = null
  viewPan = null
  for (const [node, gesture] of activeSystemGestures) {
    cancelledSystemGestures.add(node)
    gesture.rollback()
    gesture.mouseGesture.cancel()
  }
  activeSystemGestures.clear()
  emit('editing-gesture-change', false)
  refreshLiveRouteGeometry?.()
}

/** Starts a view-only pan, including when a different button owns an unfinished edit. */
function startViewPan(event: MouseEvent): void {
  const element = svgElement.value
  if (!element || !zoomBehavior) return
  cancelActiveGesture()
  viewPan = { transform: zoomTransform(element), start: pointer(event, element) as [number, number] }
}

function moveViewPan(event: MouseEvent): void {
  const element = svgElement.value
  if (!element || !zoomBehavior || !viewPan) return
  const point = pointer(event, element)
  select(element).call(zoomBehavior.transform, zoomIdentity
    .translate(viewPan.transform.x + point[0] - viewPan.start[0], viewPan.transform.y + point[1] - viewPan.start[1])
    .scale(viewPan.transform.k))
}

function endViewPan(): void { viewPan = null }

/** Emits both the new explicit activation and the legacy compatibility event. */
function activateSystem(systemId: string): void {
  emit('activate-system', systemId)
  emit('open-system', systemId)
}

/** Emits one completed Add target in normalized cluster coordinates, including every card under it. */
function emitClusterTargetAt(scenePoint: Point): void {
  if ((props.clusterAddType === null && !props.clusterMoveTargeting) || props.clusterChooserOpen) return
  const point = {
    x: Math.max(0, Math.min(1, (scenePoint.x - 112) / 736)),
    y: Math.max(0, Math.min(1, (scenePoint.y - 96) / 368)),
  }
  const systemIds = props.cluster.systems
    .filter((system) => {
      const position = clusterSystemPosition(props.systemPositions, system.id)
      return Math.abs(scenePoint.x - position.x) <= 78
        && Math.abs(scenePoint.y - position.y) <= 38
    })
    .map(system => system.id)
  emit('cluster-target', point, systemIds)
}

function emitClusterTargetFromPointer(event: MouseEvent): void {
  const content = svgElement.value?.querySelector<SVGGElement>('.cluster-map-content')
  if (!content) return
  const [x, y] = pointer(event, content)
  emitClusterTargetAt({ x, y })
}

function activateClusterTargetFromKeyboard(event: KeyboardEvent): void {
  const map = svgElement.value
  if (!map || event.target !== map
    || (props.clusterAddType === null && !props.clusterMoveTargeting)
    || props.clusterChooserOpen) return
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  event.stopPropagation()
  emitClusterTargetAt({ x: 480, y: 280 })
}

/**
 * Rebuilds D3 route/system nodes while preserving the user's temporary pan and zoom transform.
 * System drag positions remain preview-only until drag end; the emitted save position is normalized and clamped.
 */
function render(): void {
  const element = svgElement.value
  if (!element) return

  const focusedElement = element.ownerDocument.activeElement
  const focusedSystemId = focusedElement instanceof Element && element.contains(focusedElement)
    ? focusedElement.closest<SVGGElement>('.cluster-system-node[data-system-id]')?.getAttribute('data-system-id')
    : null
  const focusedRouteId = focusedElement instanceof Element && element.contains(focusedElement)
    ? focusedElement.closest<SVGGElement>('.cluster-route[data-route-id]')?.getAttribute('data-route-id')
    : null
  refreshLiveRouteGeometry = undefined
  applyClusterSystemPositionPreview = undefined
  cancelActiveGesture()
  const svg = select(element)
  const currentTransform = zoomTransform(element)
  const liveSystemPositions = new Map<string, Point>()
  const jumpPoints = new Map(
    jumpPointsInCluster(props.cluster).map(reference => [reference.point.id, reference]),
  )
  svg.selectAll('*').remove()

  const content = svg.append('g').attr('class', 'cluster-map-content')
  const grid = content.append('defs')
    .append('pattern')
    .attr('id', 'cluster-map-grid')
    .attr('width', 28)
    .attr('height', 28)
    .attr('patternUnits', 'userSpaceOnUse')
  grid.append('path')
    .attr('d', 'M 28 0 L 0 0 0 28')
    .attr('class', 'cluster-map-grid-line')

  content.append('rect')
    .attr('class', 'cluster-map-background')
    .attr('width', 960)
    .attr('height', 560)
  content.append('rect')
    .attr('class', 'cluster-map-grid')
    .attr('width', 960)
    .attr('height', 560)

  const items = content.append('g').attr('class', 'cluster-map-items')
  const routeMarks = items.selectAll<SVGGElement, JumpRoute>('g.cluster-route')
    .data(props.cluster.routes)
    .join('g')
    .attr('data-route-id', route => route.id)
    .attr('class', route => `cluster-route${route.toPointId ? '' : ' is-unresolved'}${props.selectedRouteId === route.id ? ' is-selected' : ''}`)
    .attr('role', 'button')
    .attr('tabindex', 0)
    .attr('aria-label', route => clusterRouteLabel(route, jumpPoints))

  routeMarks.each(function (route, index) {
    const geometry = clusterRouteGeometry(route, index, jumpPoints, props.systemPositions)
    const mark = select(this)
    const label = `Jump-${route.jumpLevel}`
    const labelWidth = Math.max(78, label.length * 7 + 18)

    mark.append('path')
      .attr('class', 'cluster-route-line')
      .attr('d', geometry.path)
    mark.append('rect')
      .attr('class', 'cluster-route-label-bg')
      .attr('x', geometry.labelX - labelWidth / 2)
      .attr('y', geometry.labelY - 12)
      .attr('width', labelWidth)
      .attr('height', 21)
      .attr('rx', 10)
    mark.append('text')
      .attr('class', 'cluster-route-label')
      .attr('x', geometry.labelX)
      .attr('y', geometry.labelY + 2)
      .text(label)

    if (route.toPointId === null && geometry.exitPoint) {
      mark.append('circle')
        .attr('class', 'cluster-exit-mark')
        .attr('cx', geometry.exitPoint.x)
        .attr('cy', geometry.exitPoint.y)
        .attr('r', 7)
      mark.append('text')
        .attr('class', 'cluster-exit-label')
        .attr('x', geometry.exitPoint.x - 10)
        .attr('y', geometry.exitPoint.y + 24)
        .attr('text-anchor', 'end')
        .text(`Unknown: ${route.unresolvedExit}`)
    }
  })
  /** Recomputes route paths and labels against temporary scene-space system positions during a drag. */
  function updateRouteGeometry(): void {
    routeMarks.each(function (route, index) {
      const geometry = clusterRouteGeometry(
        route,
        index,
        jumpPoints,
        props.systemPositions,
        liveSystemPositions,
      )
      const mark = select(this)
      const label = `Jump-${route.jumpLevel}`
      const labelWidth = Math.max(78, label.length * 7 + 18)
      mark.select('.cluster-route-line').attr('d', geometry.path)
      mark.select('.cluster-route-label-bg')
        .attr('x', geometry.labelX - labelWidth / 2)
        .attr('y', geometry.labelY - 12)
      mark.select('.cluster-route-label')
        .attr('x', geometry.labelX)
        .attr('y', geometry.labelY + 2)

      if (route.toPointId === null && geometry.exitPoint) {
        mark.select('.cluster-exit-mark')
          .attr('cx', geometry.exitPoint.x)
          .attr('cy', geometry.exitPoint.y)
        mark.select('.cluster-exit-label')
          .attr('x', geometry.exitPoint.x - 10)
          .attr('y', geometry.exitPoint.y + 24)
      }
    })
  }
  refreshLiveRouteGeometry = updateRouteGeometry
  routeMarks
    .on('click', (event, route) => {
      event.stopPropagation()
      if (event.defaultPrevented || event.detail === 0) return
      if (props.clusterAddType !== null) {
        if (!props.clusterChooserOpen) emitClusterTargetFromPointer(event)
        return
      }
      emit('select-route', route.id)
    })
    .on('keydown', (event, route) => {
      if (event.key === 'Enter' || event.key === ' ') {
        if (event.defaultPrevented) return
        event.preventDefault()
        if (props.clusterAddType !== null) {
          event.stopPropagation()
          return
        }
        emit('select-route', route.id)
      }
    })

  const systemMarks = items.selectAll<SVGGElement, StarSystem>('g.cluster-system-node')
    .data(props.cluster.systems)
    .join('g')
    .attr('data-system-id', system => system.id)
    .attr('class', system => `cluster-system-node${props.selectedSystemId === system.id ? ' is-selected' : ''}`)
    .attr('transform', system => {
      const position = clusterSystemPosition(props.systemPositions, system.id)
      return `translate(${position.x} ${position.y})`
    })
    .attr('role', 'button')
    .attr('tabindex', 0)
    .attr('aria-label', system => props.systemActivation === 'inspect'
      ? `Inspect ${system.name} system details`
      : props.systemActivation === 'select'
        ? `Select ${system.name} system`
        : `Open ${system.name} system map`)

  systemMarks.append('rect')
    .attr('class', 'cluster-system-card')
    .attr('x', -78)
    .attr('y', -38)
    .attr('width', 156)
    .attr('height', 76)
    .attr('rx', 4)
  systemMarks.append('circle')
    .attr('class', 'cluster-system-seal')
    .attr('cx', -57)
    .attr('cy', -17)
    .attr('r', 4)
  systemMarks.append('text')
    .attr('class', 'cluster-system-name')
    .attr('x', 4)
    .attr('y', -6)
    .text(system => system.name)
  systemMarks.append('text')
    .attr('class', 'cluster-system-meta')
    .attr('x', 0)
    .attr('y', 17)
    .text(system => {
      const stars = system.objects.filter(object => object.subtype === 'star').length
      return `${stars} STAR${stars === 1 ? '' : 'S'} / ${system.objects.length} OBJECTS`
    })
  const movedSystems = new WeakSet<SVGGElement>()
  systemMarks
    .on('click', (event, system) => {
      event.stopPropagation()
      if (event.defaultPrevented || event.detail === 0) return
      if (props.clusterAddType !== null) {
        if (!props.clusterChooserOpen) emitClusterTargetFromPointer(event)
        return
      }
      if (movedSystems.has(event.currentTarget as SVGGElement)) {
        movedSystems.delete(event.currentTarget as SVGGElement)
        return
      }
      activateSystem(system.id)
    })
    .on('keydown', (event, system) => {
      if (event.key === 'Enter' || event.key === ' ') {
        if (event.defaultPrevented) return
        event.preventDefault()
        if (props.clusterAddType !== null) {
          event.stopPropagation()
          const position = clusterSystemPosition(props.systemPositions, system.id)
          emitClusterTargetAt(position)
          return
        }
        activateSystem(system.id)
      }
    })

  const systemDrag = drag<SVGGElement, StarSystem>()
    .filter(event => props.moveEnabled && !event.ctrlKey && !event.button
      && (!('touches' in event) || event.touches.length === 1))
    .clickDistance(6)
    .container(() => content.node()!)
    .subject((_event, system) => clusterSystemPosition(props.systemPositions, system.id))
    .on('start', function (event, system) {
      // D3 has already installed its next window listeners when start runs. Claim first so
      // cancelling a stale drag cannot feed its mouseup into the replacement gesture.
      const mouseGesture = captureD3MouseGesture(event.sourceEvent)
      if (activeSystemGestures.size) cancelActiveGesture()
      if (liveSystemPositions.has(system.id)) emit('cancel-cluster-preview')
      movedSystems.delete(this)
      cancelledSystemGestures.delete(this)
      const committedPosition = clusterSystemPosition(props.systemPositions, system.id)
      activeSystemGestures.set(this, {
        rollback: () => {
          movedSystems.delete(this)
          liveSystemPositions.delete(system.id)
          select(this).classed('is-dragging', false).attr('transform', `translate(${committedPosition.x} ${committedPosition.y})`)
          refreshLiveRouteGeometry?.()
        },
        mouseGesture,
      })
      emit('editing-gesture-change', true)
      select(this).classed('is-dragging', true)
    })
    .on('drag', function (event, system) {
      if (cancelledSystemGestures.has(this)) return
      if (event.dx || event.dy) movedSystems.add(this)
      select(this).attr('transform', `translate(${event.x} ${event.y})`)
      liveSystemPositions.set(system.id, { x: event.x, y: event.y })
      updateRouteGeometry()
    })
    .on('end', function (event, system) {
      activeSystemGestures.get(this)?.mouseGesture.complete()
      activeSystemGestures.delete(this)
      emit('editing-gesture-change', activeSystemGestures.size > 0)
      select(this).classed('is-dragging', false)
      if (cancelledSystemGestures.has(this)) {
        cancelledSystemGestures.delete(this)
        movedSystems.delete(this)
        return
      }
      if (!movedSystems.has(this)) return
      setTimeout(() => movedSystems.delete(this), 0)
      emit('move-system', system.id, {
        x: Math.max(0, Math.min(1, (event.x - 112) / 736)),
        y: Math.max(0, Math.min(1, (event.y - 96) / 368)),
      })
    })
  systemMarks.call(systemDrag)
  applyClusterSystemPositionPreview = (systemId, position) => {
    const mark = systemMarks.filter(system => system.id === systemId)
    if (mark.empty()) return
    if (position) {
      const scenePosition = {
        x: 112 + position.x * 736,
        y: 96 + position.y * 368,
      }
      liveSystemPositions.set(systemId, scenePosition)
      mark.classed('is-move-preview', true).attr('transform', `translate(${scenePosition.x} ${scenePosition.y})`)
    } else {
      liveSystemPositions.delete(systemId)
      const committedPosition = clusterSystemPosition(props.systemPositions, systemId)
      mark.classed('is-move-preview', false).attr('transform', `translate(${committedPosition.x} ${committedPosition.y})`)
    }
    updateRouteGeometry()
  }

  if (props.cluster.systems.length === 0) {
    items.append('text')
      .attr('class', 'cluster-map-empty')
      .attr('x', 480)
      .attr('y', 268)
      .attr('text-anchor', 'middle')
      .text('No systems on this chart yet.')
  }

  zoomBehavior = zoom<SVGSVGElement, unknown>()
    .extent(() => svgViewportExtent(zoomExtentOverride ?? getSvgViewportRect(element)))
    .scaleExtent([MAP_ZOOM_MIN_SCALE, MAP_ZOOM_MAX_SCALE])
    .clickDistance(6)
    .filter((event) => {
      const target = event.target
      const isMapMark = target instanceof Element
        && target.closest('.cluster-system-node, .cluster-route')
      const touchPinch = event.type.startsWith('touch')
        && 'touches' in event
        && event.touches.length > 1
      return (!isMapMark || !props.moveEnabled || event.type === 'wheel' || touchPinch)
        && (!props.moveEnabled || !event.ctrlKey || event.type === 'wheel')
        && !('button' in event && event.button)
    })
    .on('zoom', (event) => {
      content.attr('transform', event.transform.toString())
      zoomLevel.value = Math.round(event.transform.k * 100)
      emit('viewport-change', {
        x: event.transform.x,
        y: event.transform.y,
        k: event.transform.k,
      })
    })
  svg.call(zoomBehavior)
  svg.on('click.cluster-target', (event: MouseEvent) => {
    if (event.detail === 0 || event.defaultPrevented
      || (props.clusterAddType === null && !props.clusterMoveTargeting)
      || props.clusterChooserOpen) return
    emitClusterTargetFromPointer(event)
  })
  content.attr('transform', currentTransform.toString())
  zoomLevel.value = Math.round(currentTransform.k * 100)

  const focusMayBeRestored = focusedSystemId !== null || focusedRouteId !== null
  const activeAfterRedraw = element.ownerDocument.activeElement
  if (focusMayBeRestored && (activeAfterRedraw === element.ownerDocument.body || activeAfterRedraw === focusedElement)) {
    if (focusedSystemId) systemMarks.filter(system => system.id === focusedSystemId).node()?.focus()
    else if (focusedRouteId) routeMarks.filter(route => route.id === focusedRouteId).node()?.focus()
  }
}

onMounted(() => {
  render()
  window.addEventListener('blur', cancelActiveGesture)
})
onBeforeUnmount(() => {
  window.removeEventListener('blur', cancelActiveGesture)
  refreshLiveRouteGeometry = undefined
  applyClusterSystemPositionPreview = undefined
  cancelActiveGesture()
})
watch(() => props.cluster, render, { deep: true })
watch(() => props.systemPositions, render, { deep: true })
watch(() => props.selectedSystemId, render)
watch(() => props.selectedRouteId, render)
watch(() => props.systemActivation, render)

defineExpose({
  exportImage,
  getViewport,
  setViewport,
  zoomBy,
  panBy,
  fitMap,
  cancelActiveGesture,
  startViewPan,
  moveViewPan,
  endViewPan,
  startTouchNavigation,
  moveTouchNavigation,
  endTouchNavigation,
  setClusterSystemPositionPreview: (systemId: string, position: Point | null) =>
    applyClusterSystemPositionPreview?.(systemId, position),
})
</script>

<style>
.map-view {
  position: relative;
}

.cluster-map-svg {
  background: var(--map-bg);
}

.map-touch-surface { touch-action: none; }

.map-navigation {
  position: absolute;
  z-index: 2;
  bottom: 0.75rem;
  left: 50%;
  transform: translateX(-50%);
  border: 1px solid var(--line);
  border-radius: 3px;
  background: rgba(18, 28, 30, 0.94);
  box-shadow: 0 0.7rem 2rem rgba(0, 0, 0, 0.32);
  backdrop-filter: blur(12px);
}

.map-navigation button {
  min-width: 2rem;
  border: 1px solid var(--line);
  border-radius: 2px;
  background: var(--control-bg);
  color: var(--text-primary);
  font: 12px Consolas, monospace;
  line-height: 1.5rem;
}

.map-navigation button:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 1px;
}

.map-navigation button:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.map-navigation output {
  min-width: 3.5rem;
  color: var(--text-primary);
  font: 11px Consolas, monospace;
  text-align: center;
}

.cluster-map-background {
  fill: var(--map-bg);
  pointer-events: none;
}

.cluster-map-grid {
  fill: url(#cluster-map-grid);
  pointer-events: none;
}

.cluster-map-grid-line {
  fill: none;
  stroke: var(--map-grid-line);
  stroke-width: 1;
}

.cluster-route {
  cursor: pointer;
  pointer-events: all;
}

.cluster-route-line {
  fill: none;
  stroke: var(--map-route);
  stroke-width: 2.4;
}

.cluster-route.is-unresolved .cluster-route-line {
  stroke: var(--map-unresolved);
  stroke-dasharray: 8 7;
}

.cluster-route.is-selected .cluster-route-line,
.cluster-route:focus .cluster-route-line {
  stroke: var(--map-selected);
  stroke-width: 3.5;
}

.cluster-route:focus,
.cluster-system-node:focus {
  outline: none;
}

.cluster-route-label-bg {
  fill: var(--map-label-bg);
  stroke: var(--map-label-border);
  pointer-events: auto;
}

.cluster-route-label,
.cluster-exit-label {
  fill: var(--map-text);
  font: 10px Consolas, monospace;
}

.cluster-route-label {
  text-anchor: middle;
  pointer-events: auto;
}

.cluster-exit-mark {
  fill: var(--map-card);
  stroke: var(--map-unresolved);
  stroke-width: 2;
}

.cluster-exit-label {
  fill: var(--map-unresolved);
  pointer-events: none;
}

.cluster-system-node {
  cursor: pointer;
  pointer-events: all;
}

.cluster-system-node.is-dragging {
  cursor: grabbing;
}

.cluster-system-card {
  fill: var(--map-card);
  stroke: var(--map-label-border);
  stroke-width: 1.5;
}

.cluster-system-node:hover .cluster-system-card,
.cluster-system-node:focus .cluster-system-card,
.cluster-system-node.is-selected .cluster-system-card {
  stroke: var(--map-selected);
  stroke-width: 2.5;
}

.cluster-system-node.is-move-preview .cluster-system-card {
  stroke: var(--map-selected);
  stroke-dasharray: 5 4;
  stroke-width: 3;
}

.cluster-system-seal {
  fill: var(--map-installation);
}

.cluster-system-name {
  fill: var(--map-text);
  font: 14px Georgia, serif;
  text-anchor: middle;
  pointer-events: none;
}

.cluster-system-meta {
  fill: var(--map-muted);
  font: 9px Consolas, monospace;
  text-anchor: middle;
  pointer-events: none;
}

.cluster-map-empty {
  fill: var(--map-muted);
  font: 16px Georgia, serif;
}
</style>
