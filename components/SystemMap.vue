<script setup lang="ts">
import { drag, select, zoom, zoomIdentity, zoomTransform, type ZoomBehavior } from 'd3'
import {
  defaultOrbitRadius,
  minimumOrbitRadius,
  type Orbit,
  type Point,
  type StarSystem,
  type SystemObject,
} from '../domain/workspace'
import { exportMapImage, type MapImageFormat } from '../utils/map-image-export'

const props = defineProps<{
  system: StarSystem
  orbitRadii: Record<string, number>
  objectAngles: Record<string, number>
  selectedObjectId: string | null
  selectedOrbitId: string | null
}>()

const emit = defineEmits<{
  'select-object': [id: string]
  'select-orbit': [id: string]
  'move-object': [id: string, position: Point]
  'rotate-object': [id: string, angle: number]
  'resize-orbit': [id: string, radius: number]
}>()

const svgElement = ref<SVGSVGElement | null>(null)
const zoomLevel = ref(100)
let zoomBehavior: ZoomBehavior<SVGSVGElement, unknown> | undefined

function orbitHost(system: StarSystem, orbit: Orbit): SystemObject {
  const host = system.objects.find(object => object.id === orbit.hostId)
  if (!host) {
    throw new Error(`Orbit "${orbit.id}" has no host object.`)
  }
  return host
}

function orbitRadius(system: StarSystem, orbit: Orbit): number {
  return props.orbitRadii[orbit.id] ?? defaultOrbitRadius(system, orbit)
}

function objectPositions(system: StarSystem): Map<string, Point> {
  const objectsById = new Map(system.objects.map(object => [object.id, object]))
  const childrenByOrbit = new Map<string, SystemObject[]>()
  const positions = new Map<string, Point>()
  const visiting = new Set<string>()

  for (const object of system.objects) {
    const placement = object.placement
    if (placement.kind === 'orbit') {
      const children = childrenByOrbit.get(placement.orbitId) ?? []
      children.push(object)
      childrenByOrbit.set(placement.orbitId, children)
    }
  }

  function locate(object: SystemObject): Point {
    const cached = positions.get(object.id)
    if (cached) return cached
    if (visiting.has(object.id)) {
      throw new Error('The system map contains a circular Orbit relationship.')
    }
    visiting.add(object.id)

    let point: Point
    if (object.placement.kind === 'system') {
      point = {
        x: 64 + object.placement.x * 832,
        y: 72 + object.placement.y * 416,
      }
    } else {
      const placement = object.placement
      const orbit = system.orbits.find(candidate => candidate.id === placement.orbitId)
      const host = orbit ? objectsById.get(orbit.hostId) : undefined
      if (!orbit || !host) {
        throw new Error('The system map contains an object with an invalid Orbit host.')
      }

      const center = locate(host)
      const siblings = childrenByOrbit.get(orbit.id) ?? []
      const index = siblings.findIndex(candidate => candidate.id === object.id)
      const angle = props.objectAngles[object.id]
        ?? -Math.PI / 2 + (index / Math.max(1, siblings.length)) * Math.PI * 2
      const radius = orbitRadius(system, orbit)
      point = {
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius,
      }
    }

    visiting.delete(object.id)
    positions.set(object.id, point)
    return point
  }

  for (const object of system.objects) locate(object)
  return positions
}

function requiredPosition(positions: Map<string, Point>, objectId: string): Point {
  const position = positions.get(objectId)
  if (!position) {
    throw new Error(`No schematic position exists for map object "${objectId}".`)
  }
  return position
}

function zoomBy(factor: number): void {
  if (svgElement.value && zoomBehavior) {
    select(svgElement.value).call(zoomBehavior.scaleBy, factor)
  }
}

async function exportImage(format: MapImageFormat): Promise<Blob> {
  const element = svgElement.value
  if (!element) throw new Error('The star system map is not ready to export.')
  return exportMapImage(element, format)
}

function fitMap(): void {
  const element = svgElement.value
  if (!element || !zoomBehavior) return

  const bounds = ['.system-map-items', '.system-orbits', '.orbit-resize-handles']
    .map(selector => element.querySelector<SVGGElement>(selector)?.getBBox())
    .filter((box): box is DOMRect => box !== undefined && (box.width > 0 || box.height > 0))
  if (!bounds.length) {
    select(element).call(zoomBehavior.transform, zoomIdentity)
    return
  }

  const left = Math.min(...bounds.map(box => box.x))
  const top = Math.min(...bounds.map(box => box.y))
  const right = Math.max(...bounds.map(box => box.x + box.width))
  const bottom = Math.max(...bounds.map(box => box.y + box.height))
  const width = right - left
  const height = bottom - top
  const scale = Math.max(0.25, Math.min(
    4,
    (960 - 80) / width,
    (560 - 80) / height,
  ))
  const x = (960 - width * scale) / 2 - left * scale
  const y = (560 - height * scale) / 2 - top * scale
  select(element).call(zoomBehavior.transform, zoomIdentity.translate(x, y).scale(scale))
}

function render(): void {
  const element = svgElement.value
  if (!element) return

  const system = props.system
  const positions = objectPositions(system)
  const svg = select(element)
  const currentTransform = zoomTransform(element)
  const focusedOrbitId = element.querySelector<SVGCircleElement>('.orbit-resize-handle:focus')
    ?.getAttribute('data-orbit-id')
  svg.selectAll('*').remove()

  const content = svg.append('g').attr('class', 'system-map-content')
  const grid = content.append('defs')
    .append('pattern')
    .attr('id', 'system-map-grid')
    .attr('width', 28)
    .attr('height', 28)
    .attr('patternUnits', 'userSpaceOnUse')
  grid.append('path')
    .attr('d', 'M 28 0 L 0 0 0 28')
    .attr('class', 'map-grid-line')

  content.append('rect')
    .attr('class', 'map-background')
    .attr('width', 960)
    .attr('height', 560)
  content.append('rect')
    .attr('class', 'map-grid')
    .attr('width', 960)
    .attr('height', 560)

  const stars = system.objects.filter(object => object.subtype === 'star').length
  content.append('text')
    .attr('class', 'map-title')
    .attr('x', 32)
    .attr('y', 36)
    .text(system.name)
  content.append('text')
    .attr('class', 'map-caption')
    .attr('x', 32)
    .attr('y', 56)
    .text(`SYSTEM / ${stars} STAR${stars === 1 ? '' : 'S'} / SCHEMATIC, NOT TO SCALE`)
  content.append('text')
    .attr('class', 'map-count')
    .attr('x', 928)
    .attr('y', 36)
    .attr('text-anchor', 'end')
    .text(`${system.objects.length} OBJECTS / ${system.orbits.length} ORBITS`)

  const orbitMarks = content.append('g').attr('class', 'system-orbits')
    .selectAll<SVGGElement, Orbit>('g.orbit-mark')
    .data(system.orbits.slice().sort((left, right) => left.order - right.order))
    .join('g')
    .attr('class', orbit => `orbit-mark${props.selectedOrbitId === orbit.id ? ' is-selected' : ''}`)
    .attr('role', 'group')
    .attr('aria-label', orbit => `Orbit ${orbit.order} around ${orbitHost(system, orbit).name}`)

  orbitMarks.append('circle')
    .attr('class', 'orbit-ring')
    .attr('cx', orbit => requiredPosition(positions, orbit.hostId).x)
    .attr('cy', orbit => requiredPosition(positions, orbit.hostId).y)
    .attr('r', orbit => orbitRadius(system, orbit))
  const orbitSelectors = orbitMarks.append('circle')
    .attr('class', 'orbit-hit-target')
    .attr('cx', orbit => requiredPosition(positions, orbit.hostId).x)
    .attr('cy', orbit => requiredPosition(positions, orbit.hostId).y)
    .attr('r', orbit => orbitRadius(system, orbit))
    .attr('role', 'button')
    .attr('tabindex', 0)
    .attr('aria-label', orbit => `Select Orbit ${orbit.order} around ${orbitHost(system, orbit).name}`)
  orbitMarks.append('text')
    .attr('class', 'orbit-label')
    .attr('x', orbit => requiredPosition(positions, orbit.hostId).x)
    .attr('y', orbit => {
      return requiredPosition(positions, orbit.hostId).y - orbitRadius(system, orbit) * 0.72
    })
    .text(orbit => `ORBIT ${orbit.order}`)
  orbitSelectors
    .on('click', (event, orbit) => {
      event.stopPropagation()
      emit('select-orbit', orbit.id)
    })
    .on('keydown', (event, orbit) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        emit('select-orbit', orbit.id)
      }
    })

  const items = content.append('g').attr('class', 'system-map-items')
  const objectMarks = items.selectAll<SVGGElement, SystemObject>('g.system-object')
    .data(system.objects)
    .join('g')
    .attr('class', object => `system-object${props.selectedObjectId === object.id ? ' is-selected' : ''}`)
    .attr('transform', object => {
      const point = requiredPosition(positions, object.id)
      return `translate(${point.x} ${point.y})`
    })
    .attr('role', 'button')
    .attr('tabindex', 0)
    .attr('aria-label', object => `Select ${object.locationKey}, ${object.name} (${object.family} / ${object.subtype})`)

  objectMarks.each(function (object) {
    const mark = select(this)
    mark.append('circle')
      .attr('class', 'object-hit-target')
      .attr('r', 28)
      .attr('aria-hidden', 'true')

    if (object.subtype === 'star') {
      mark.append('circle').attr('class', 'object-core star-halo').attr('r', 23)
      mark.append('circle').attr('class', 'object-core star-core').attr('r', 14)
    } else if (object.family === 'Installation') {
      mark.append('rect')
        .attr('class', 'object-core installation')
        .attr('x', -10)
        .attr('y', -10)
        .attr('width', 20)
        .attr('height', 20)
        .attr('rx', 2)
    } else if (object.family === 'SmallBody/Field') {
      mark.append('path')
        .attr('class', 'object-core small-body')
        .attr('d', 'M 0 -12 L 12 0 0 12 -12 0 Z')
    } else if (object.family === 'Vessel') {
      mark.append('path')
        .attr('class', 'object-core vessel')
        .attr('d', 'M 0 -13 L 12 10 -12 10 Z')
    } else if (object.family === 'JumpPoint') {
      mark.append('circle').attr('class', 'object-core jump-point').attr('r', 11)
      mark.append('path').attr('class', 'jump-point-cross').attr('d', 'M -5 0 H 5 M 0 -5 V 5')
    } else if (object.family === 'Phenomenon') {
      mark.append('path')
        .attr('class', 'object-core phenomenon')
        .attr('d', 'M 0 -12 L 12 0 0 12 -12 0 Z')
    } else if (object.family === 'Other') {
      mark.append('path')
        .attr('class', 'object-core other-object')
        .attr('d', 'M -10 -6 L 0 -12 10 -6 10 6 0 12 -10 6 Z')
    } else {
      mark.append('circle')
        .attr('class', `object-core ${object.subtype === 'moon' ? 'moon' : 'celestial-body'}`)
        .attr('r', object.subtype === 'moon' ? 7 : 9)
    }

    mark.append('text')
      .attr('class', 'object-key')
      .attr('y', 31)
      .text(object.locationKey)
    mark.append('text')
      .attr('class', 'object-name')
      .attr('y', 46)
      .text(object.name)
  })
  const movedObjects = new WeakSet<SVGGElement>()
  objectMarks
    .on('click', (event, object) => {
      event.stopPropagation()
      if (movedObjects.has(event.currentTarget as SVGGElement)) {
        movedObjects.delete(event.currentTarget as SVGGElement)
        return
      }
      emit('select-object', object.id)
    })
    .on('keydown', (event, object) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        emit('select-object', object.id)
      }
    })
  const objectDrag = drag<SVGGElement, SystemObject>()
    .container(() => content.node()!)
    .subject((_event, object) => requiredPosition(positions, object.id))
    .on('start', function () {
      movedObjects.delete(this)
      select(this).classed('is-dragging', true)
    })
    .on('drag', function (event) {
      if (event.dx || event.dy) movedObjects.add(this)
      select(this).attr('transform', `translate(${event.x} ${event.y})`)
    })
    .on('end', function (event, object) {
      select(this).classed('is-dragging', false)
      if (!movedObjects.has(this)) return
      setTimeout(() => movedObjects.delete(this), 0)

      if (object.placement.kind === 'orbit') {
        const { orbitId } = object.placement
        const orbit = system.orbits.find(candidate => candidate.id === orbitId)
        if (!orbit) throw new Error(`Object "${object.id}" references a missing Orbit.`)
        const host = requiredPosition(positions, orbit.hostId)
        emit('rotate-object', object.id, Math.atan2(event.y - host.y, event.x - host.x))
        return
      }

      emit('move-object', object.id, {
        x: Math.max(0, Math.min(1, (event.x - 64) / 832)),
        y: Math.max(0, Math.min(1, (event.y - 72) / 416)),
      })
    })
  objectMarks.call(objectDrag)

  if (system.objects.length === 0) {
    items.append('text')
      .attr('class', 'map-empty')
      .attr('x', 480)
      .attr('y', 268)
      .attr('text-anchor', 'middle')
      .text('No locations charted yet.')
  }

  const resizeHandles = content.append('g')
    .attr('class', 'orbit-resize-handles')
    .selectAll<SVGCircleElement, Orbit>('circle.orbit-resize-handle')
    .data(system.orbits)
    .join('circle')
    .attr('class', 'orbit-resize-handle')
    .attr('data-orbit-id', orbit => orbit.id)
    .attr('cx', orbit => requiredPosition(positions, orbit.hostId).x + orbitRadius(system, orbit))
    .attr('cy', orbit => requiredPosition(positions, orbit.hostId).y)
    .attr('r', 7)
    .attr('role', 'slider')
    .attr('tabindex', 0)
    .attr('aria-label', orbit => `Resize Orbit ${orbit.order} around ${orbitHost(system, orbit).name}`)
    .attr('aria-valuemin', orbit => minimumOrbitRadius(system, orbit))
    .attr('aria-valuemax', orbit => orbitRadius(system, orbit) + 400)
    .attr('aria-valuenow', orbit => Math.round(orbitRadius(system, orbit)))
    .attr('aria-valuetext', orbit => `${Math.round(orbitRadius(system, orbit))} map units`)
    .on('keydown', (event, orbit) => {
      const currentRadius = orbitRadius(system, orbit)
      const step = event.shiftKey ? 10 : 1
      if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
        event.preventDefault()
        emit('resize-orbit', orbit.id, Math.max(minimumOrbitRadius(system, orbit), currentRadius - step))
      } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
        event.preventDefault()
        emit('resize-orbit', orbit.id, currentRadius + step)
      } else if (event.key === 'Home') {
        event.preventDefault()
        emit('resize-orbit', orbit.id, minimumOrbitRadius(system, orbit))
      } else if (event.key === 'End') {
        event.preventDefault()
        emit('resize-orbit', orbit.id, currentRadius + 400)
      }
    })

  resizeHandles.call(
    drag<SVGCircleElement, Orbit>()
      .container(() => content.node()!)
      .on('drag', function (event, orbit) {
        const host = requiredPosition(positions, orbit.hostId)
        const radius = Math.max(
          minimumOrbitRadius(system, orbit),
          Math.round(Math.hypot(event.x - host.x, event.y - host.y)),
        )
        select(this)
          .attr('cx', host.x + radius)
          .attr('cy', host.y)
          .attr('aria-valuenow', radius)
          .attr('aria-valuemax', radius + 400)
          .attr('aria-valuetext', `${radius} map units`)
      })
      .on('end', (event, orbit) => {
        const host = requiredPosition(positions, orbit.hostId)
        const radius = Math.max(
          minimumOrbitRadius(system, orbit),
          Math.round(Math.hypot(event.x - host.x, event.y - host.y)),
        )
        emit('resize-orbit', orbit.id, radius)
      }),
  )

  zoomBehavior = zoom<SVGSVGElement, unknown>()
    .extent([[0, 0], [960, 560]])
    .scaleExtent([0.25, 4])
    .filter((event) => {
      const target = event.target
      const isMapMark = target instanceof Element
        && target.closest('.system-object, .orbit-hit-target, .orbit-resize-handle')
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
  if (focusedOrbitId) {
    resizeHandles.filter(orbit => orbit.id === focusedOrbitId).node()?.focus()
  }
}

onMounted(render)
watch(() => props.system, render, { deep: true })
watch(() => props.orbitRadii, render, { deep: true })
watch(() => props.objectAngles, render, { deep: true })
watch(() => props.selectedObjectId, render)
watch(() => props.selectedOrbitId, render)

defineExpose({ exportImage })
</script>

<template>
  <div class="map-view flex h-full min-h-[31rem] min-w-0 flex-1 flex-col">
    <div class="map-navigation flex shrink-0 items-center gap-1 border-b border-[#d5cbbb] bg-[#f4eee2] px-2 py-1" role="toolbar" aria-label="Map navigation">
      <button type="button" aria-label="Zoom out" :disabled="zoomLevel <= 25" @click="zoomBy(1 / 1.2)">−</button>
      <output aria-label="Zoom level" aria-live="polite">{{ zoomLevel }}%</output>
      <button type="button" aria-label="Zoom in" :disabled="zoomLevel >= 400" @click="zoomBy(1.2)">+</button>
      <button type="button" aria-label="Fit map" @click="fitMap">Fit</button>
    </div>
    <svg
      ref="svgElement"
      class="system-map-svg block h-full min-h-0 w-full flex-1"
      viewBox="0 0 960 560"
      role="group"
      :aria-label="`${system.name} star system map`"
    />
  </div>
</template>

<style>
.system-map-svg {
  background: #f4eee2;
}

.map-navigation button {
  min-width: 2rem;
  border: 1px solid #bdb3a0;
  border-radius: 2px;
  background: #fffaf0;
  color: #29332d;
  font: 12px Consolas, monospace;
  line-height: 1.5rem;
}

.map-navigation button:focus-visible {
  outline: 2px solid #a45138;
  outline-offset: 1px;
}

.map-navigation button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.map-navigation output {
  min-width: 3.5rem;
  color: #29332d;
  font: 11px Consolas, monospace;
  text-align: center;
}

.map-background {
  fill: #f4eee2;
  pointer-events: none;
}

.map-grid {
  fill: url(#system-map-grid);
  pointer-events: none;
}

.map-grid-line {
  fill: none;
  stroke: #e1d7c6;
  stroke-width: 1;
}

.map-title {
  fill: #29332d;
  font: 500 20px Georgia, serif;
}

.map-caption,
.map-count {
  fill: #69746a;
  font: 10px Consolas, monospace;
  letter-spacing: 0.08em;
}

.map-title,
.map-caption,
.map-count {
  pointer-events: none;
}

.orbit-ring {
  fill: none;
  stroke: #aa9b83;
  stroke-width: 2;
  stroke-dasharray: 3 6;
  pointer-events: none;
}

.orbit-hit-target {
  fill: transparent;
  stroke: transparent;
  stroke-width: 16;
  pointer-events: stroke;
}

.orbit-mark {
  pointer-events: none;
}

.orbit-hit-target {
  cursor: pointer;
}

.orbit-mark:has(.orbit-hit-target:hover, .orbit-hit-target:focus) .orbit-ring,
.orbit-mark.is-selected .orbit-ring {
  stroke: #a45138;
  stroke-width: 2.4;
}

.orbit-hit-target:focus,
.orbit-resize-handle:focus,
.system-object:focus {
  outline: none;
}

.orbit-label {
  fill: #788074;
  font: 9px Consolas, monospace;
  text-anchor: middle;
  pointer-events: none;
}

.system-object {
  cursor: pointer;
  pointer-events: all;
}

.system-object.is-dragging {
  cursor: grabbing;
}

.orbit-resize-handle {
  fill: #fffaf0;
  stroke: #a45138;
  stroke-width: 2;
  cursor: ew-resize;
}

.orbit-resize-handle:hover,
.orbit-resize-handle:focus {
  fill: #d4b26f;
  stroke-width: 3;
}

.object-hit-target {
  fill: transparent;
  pointer-events: all;
}

.object-core {
  stroke: #435a4d;
  stroke-width: 1.7;
}

.system-object:hover .object-core,
.system-object:focus .object-core,
.system-object.is-selected .object-core {
  stroke: #a45138;
  stroke-width: 3;
}

.star-halo {
  fill: none;
  stroke: #c8a867;
  stroke-width: 1.2;
}

.star-core {
  fill: #d4b26f;
  stroke: #8c7040;
}

.installation {
  fill: #6c8174;
}

.small-body {
  fill: #8c988e;
}

.vessel {
  fill: #d4c7a7;
}

.jump-point {
  fill: #fffaf0;
  stroke: #a45138;
  stroke-width: 2.2;
}

.jump-point-cross {
  stroke: #a45138;
  stroke-width: 1.5;
}

.phenomenon {
  fill: #b75f46;
  stroke: #823e2f;
}

.other-object {
  fill: #81917b;
}

.celestial-body {
  fill: #d5bd8d;
}

.moon {
  fill: #d9d4c8;
}

.object-key {
  fill: #9a563d;
  font: 9px Consolas, monospace;
  text-anchor: middle;
}

.object-name {
  fill: #2e3831;
  font: 12px Georgia, serif;
  text-anchor: middle;
}

.map-empty {
  fill: #69746a;
  font: 16px Georgia, serif;
}
</style>
