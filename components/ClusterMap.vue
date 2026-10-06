<script setup lang="ts">
import { drag, select, zoom, zoomIdentity, zoomTransform, type ZoomBehavior } from 'd3'
import {
  jumpPointsInCluster,
  type JumpCluster,
  type JumpPointReference,
  type JumpRoute,
  type Point,
  type StarSystem,
} from '../domain/workspace'
import { exportMapImage, type MapImageFormat } from '../utils/map-image-export'
import { MAP_ZOOM_MAX_SCALE, MAP_ZOOM_MIN_SCALE } from '../utils/map-zoom'

const props = defineProps<{
  cluster: JumpCluster
  systemPositions: Record<string, Point>
  selectedSystemId: string | null
  selectedRouteId: string | null
}>()

const emit = defineEmits<{
  'open-system': [id: string]
  'select-route': [id: string]
  'move-system': [id: string, position: Point]
}>()

const svgElement = ref<SVGSVGElement | null>(null)
const zoomLevel = ref(100)
let zoomBehavior: ZoomBehavior<SVGSVGElement, unknown> | undefined

interface RouteGeometry {
  path: string
  labelX: number
  labelY: number
  exitPoint?: Point
}

function systemPosition(systemId: string, overrides?: ReadonlyMap<string, Point>): Point {
  const override = overrides?.get(systemId)
  if (override) return override
  const position = props.systemPositions[systemId]
  if (!position) {
    throw new Error(`No cluster-map position exists for star system "${systemId}".`)
  }

  return { x: 112 + position.x * 736, y: 96 + position.y * 368 }
}

function requiredJumpPoint(
  jumpPoints: Map<string, JumpPointReference>,
  pointId: string,
): JumpPointReference {
  const reference = jumpPoints.get(pointId)
  if (!reference) {
    throw new Error(`Jump Route references missing Jump Point "${pointId}".`)
  }
  return reference
}

function routeGeometry(
  route: JumpRoute,
  index: number,
  jumpPoints: Map<string, JumpPointReference>,
  positionOverrides?: ReadonlyMap<string, Point>,
): RouteGeometry {
  const from = requiredJumpPoint(jumpPoints, route.fromPointId)
  const start = systemPosition(from.system.id, positionOverrides)
  const to = route.toPointId === null
    ? undefined
    : requiredJumpPoint(jumpPoints, route.toPointId)

  if (to?.system.id === from.system.id) {
    const controlY = start.y - 126 - (index % 2) * 20
    return {
      path: `M ${start.x - 46} ${start.y - 38} Q ${start.x} ${controlY} ${start.x + 46} ${start.y - 38}`,
      labelX: start.x,
      labelY: controlY + 20,
    }
  }

  const exitPoint = to
    ? undefined
    : { x: 860, y: Math.min(500, Math.max(88, start.y + 128 + (index % 3) * 24)) }
  const end = to ? systemPosition(to.system.id, positionOverrides) : exitPoint!
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.max(1, Math.hypot(dx, dy))
  const ux = dx / length
  const uy = dy / length
  const x1 = start.x + ux * 84
  const y1 = start.y + uy * 40
  const x2 = to ? end.x - ux * 84 : end.x
  const y2 = to ? end.y - uy * 40 : end.y
  const bend = to ? (index % 2 === 0 ? 32 : -32) : 18
  const controlX = (x1 + x2) / 2 - uy * bend
  const controlY = (y1 + y2) / 2 + ux * bend

  return {
    path: `M ${x1} ${y1} Q ${controlX} ${controlY} ${x2} ${y2}`,
    labelX: (x1 + 2 * controlX + x2) / 4,
    labelY: (y1 + 2 * controlY + y2) / 4 - 8,
    exitPoint,
  }
}

function routeLabel(route: JumpRoute, jumpPoints: Map<string, JumpPointReference>): string {
  const from = requiredJumpPoint(jumpPoints, route.fromPointId)
  const origin = `${from.point.name} (${from.system.name})`
  if (route.toPointId !== null) {
    const to = requiredJumpPoint(jumpPoints, route.toPointId)
    return `Select Jump Level ${route.jumpLevel} route from ${origin} to ${to.point.name} (${to.system.name})`
  }
  return `Select Jump Level ${route.jumpLevel} route from ${origin} to unknown destination: ${route.unresolvedExit}`
}

function zoomBy(factor: number): void {
  if (svgElement.value && zoomBehavior) {
    select(svgElement.value).call(zoomBehavior.scaleBy, factor)
  }
}

async function exportImage(format: MapImageFormat): Promise<Blob> {
  const element = svgElement.value
  if (!element) throw new Error('The Jump Cluster map is not ready to export.')
  return exportMapImage(element, format)
}

function fitMap(): void {
  const element = svgElement.value
  const features = element?.querySelector<SVGGElement>('.cluster-map-items')
  if (!element || !features || !zoomBehavior) return

  const bounds = features.getBBox()
  if (!bounds.width || !bounds.height) {
    select(element).call(zoomBehavior.transform, zoomIdentity)
    return
  }

  const scale = Math.max(MAP_ZOOM_MIN_SCALE, Math.min(
    MAP_ZOOM_MAX_SCALE,
    (960 - 80) / bounds.width,
    (560 - 80) / bounds.height,
  ))
  const x = (960 - bounds.width * scale) / 2 - bounds.x * scale
  const y = (560 - bounds.height * scale) / 2 - bounds.y * scale
  select(element).call(zoomBehavior.transform, zoomIdentity.translate(x, y).scale(scale))
}

function render(): void {
  const element = svgElement.value
  if (!element) return

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
    .attr('class', route => `cluster-route${route.toPointId ? '' : ' is-unresolved'}${props.selectedRouteId === route.id ? ' is-selected' : ''}`)
    .attr('role', 'button')
    .attr('tabindex', 0)
    .attr('aria-label', route => routeLabel(route, jumpPoints))

  routeMarks.each(function (route, index) {
    const geometry = routeGeometry(route, index, jumpPoints)
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
  function updateRouteGeometry(): void {
    routeMarks.each(function (route, index) {
      const geometry = routeGeometry(route, index, jumpPoints, liveSystemPositions)
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
  routeMarks
    .on('click', (event, route) => {
      event.stopPropagation()
      emit('select-route', route.id)
    })
    .on('keydown', (event, route) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        emit('select-route', route.id)
      }
    })

  const systemMarks = items.selectAll<SVGGElement, StarSystem>('g.cluster-system-node')
    .data(props.cluster.systems)
    .join('g')
    .attr('class', system => `cluster-system-node${props.selectedSystemId === system.id ? ' is-selected' : ''}`)
    .attr('transform', system => {
      const position = systemPosition(system.id)
      return `translate(${position.x} ${position.y})`
    })
    .attr('role', 'button')
    .attr('tabindex', 0)
    .attr('aria-label', system => `Open ${system.name} system map`)

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
      if (movedSystems.has(event.currentTarget as SVGGElement)) {
        movedSystems.delete(event.currentTarget as SVGGElement)
        return
      }
      emit('open-system', system.id)
    })
    .on('keydown', (event, system) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        emit('open-system', system.id)
      }
    })

  const systemDrag = drag<SVGGElement, StarSystem>()
    .container(() => content.node()!)
    .subject((_event, system) => systemPosition(system.id))
    .on('start', function () {
      movedSystems.delete(this)
      select(this).classed('is-dragging', true)
    })
    .on('drag', function (event, system) {
      if (event.dx || event.dy) movedSystems.add(this)
      select(this).attr('transform', `translate(${event.x} ${event.y})`)
      liveSystemPositions.set(system.id, { x: event.x, y: event.y })
      updateRouteGeometry()
    })
    .on('end', function (event, system) {
      select(this).classed('is-dragging', false)
      if (!movedSystems.has(this)) return
      setTimeout(() => movedSystems.delete(this), 0)
      emit('move-system', system.id, {
        x: Math.max(0, Math.min(1, (event.x - 112) / 736)),
        y: Math.max(0, Math.min(1, (event.y - 96) / 368)),
      })
    })
  systemMarks.call(systemDrag)

  if (props.cluster.systems.length === 0) {
    items.append('text')
      .attr('class', 'cluster-map-empty')
      .attr('x', 480)
      .attr('y', 268)
      .attr('text-anchor', 'middle')
      .text('No systems on this chart yet.')
  }

  zoomBehavior = zoom<SVGSVGElement, unknown>()
    .extent([[0, 0], [960, 560]])
    .scaleExtent([MAP_ZOOM_MIN_SCALE, MAP_ZOOM_MAX_SCALE])
    .filter((event) => {
      const target = event.target
      const isMapMark = target instanceof Element
        && target.closest('.cluster-system-node, .cluster-route')
      const touchPinch = event.type.startsWith('touch')
        && 'touches' in event
        && event.touches.length > 1
      return (!isMapMark || event.type === 'wheel' || touchPinch)
        && (!event.ctrlKey || event.type === 'wheel')
        && !('button' in event && event.button)
    })
    .on('zoom', (event) => {
      content.attr('transform', event.transform.toString())
      zoomLevel.value = Math.round(event.transform.k * 100)
    })
  svg.call(zoomBehavior)
  content.attr('transform', currentTransform.toString())
  zoomLevel.value = Math.round(currentTransform.k * 100)
}

onMounted(render)
watch(() => props.cluster, render, { deep: true })
watch(() => props.systemPositions, render, { deep: true })
watch(() => props.selectedSystemId, render)
watch(() => props.selectedRouteId, render)

defineExpose({ exportImage })
</script>

<template>
  <div class="map-view flex h-full min-h-0 min-w-0 flex-1 flex-col">
    <div class="map-navigation flex shrink-0 items-center gap-1 border-b border-[var(--line-soft)] bg-[var(--panel-bg)] px-2 py-1" role="toolbar" aria-label="Map navigation">
      <button type="button" aria-label="Zoom out" :disabled="zoomLevel <= MAP_ZOOM_MIN_SCALE * 100" @click="zoomBy(1 / 1.2)">−</button>
      <output aria-label="Zoom level" aria-live="polite">{{ zoomLevel }}%</output>
      <button type="button" aria-label="Zoom in" :disabled="zoomLevel >= MAP_ZOOM_MAX_SCALE * 100" @click="zoomBy(1.2)">+</button>
      <button type="button" aria-label="Fit map" @click="fitMap">Fit</button>
    </div>
    <svg
      ref="svgElement"
      class="cluster-map-svg block h-full min-h-0 w-full flex-1"
      viewBox="0 0 960 560"
      role="group"
      :aria-label="`${cluster.name} Jump Cluster map`"
    />
  </div>
</template>

<style>
.map-view {
  position: relative;
}

.cluster-map-svg {
  background: var(--map-bg);
}

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
  pointer-events: none;
}

.cluster-route-label,
.cluster-exit-label {
  fill: var(--map-text);
  font: 10px Consolas, monospace;
  pointer-events: none;
}

.cluster-route-label {
  text-anchor: middle;
}

.cluster-exit-mark {
  fill: var(--map-card);
  stroke: var(--map-unresolved);
  stroke-width: 2;
}

.cluster-exit-label {
  fill: var(--map-unresolved);
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
