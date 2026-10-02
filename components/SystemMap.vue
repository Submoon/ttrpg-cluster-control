<script setup lang="ts">
import { drag, pointer, select, zoom, zoomIdentity, zoomTransform, type ZoomBehavior } from 'd3'
import {
  canPlaceObjectInOrbit,
  catalogueTypes,
  defaultOrbitRadius,
  minimumOrbitRadius,
  type CatalogueSubtype,
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
  'place-object-in-orbit': [id: string, orbitId: string, angle: number]
  'drop-object': [subtype: CatalogueSubtype, point: Point, orbitId: string | null, angle: number | null]
}>()

const svgElement = ref<SVGSVGElement | null>(null)
const zoomLevel = ref(100)
let zoomBehavior: ZoomBehavior<SVGSVGElement, unknown> | undefined

interface MapGeometryOverrides {
  positions: ReadonlyMap<string, Point>
  orbitRadii: ReadonlyMap<string, number>
}

function orbitHost(system: StarSystem, orbit: Orbit): SystemObject {
  const host = system.objects.find(object => object.id === orbit.hostId)
  if (!host) {
    throw new Error(`Orbit "${orbit.id}" has no host object.`)
  }
  return host
}

function orbitRadius(
  system: StarSystem,
  orbit: Orbit,
  overrides?: ReadonlyMap<string, number>,
): number {
  return overrides?.get(orbit.id) ?? props.orbitRadii[orbit.id] ?? defaultOrbitRadius(system, orbit)
}

function objectPositions(system: StarSystem, overrides?: MapGeometryOverrides): Map<string, Point> {
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
    const override = overrides?.positions.get(object.id)
    if (override) {
      positions.set(object.id, override)
      return override
    }
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
      const radius = orbitRadius(system, orbit, overrides?.orbitRadii)
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

function orbitAtPoint(
  system: StarSystem,
  point: Point,
  positions: Map<string, Point>,
  objectId?: string,
  orbitRadii?: ReadonlyMap<string, number>,
): Orbit | undefined {
  return system.orbits
    .map(orbit => ({
      orbit,
      distance: Math.abs(
        Math.hypot(
          point.x - requiredPosition(positions, orbit.hostId).x,
          point.y - requiredPosition(positions, orbit.hostId).y,
        ) - orbitRadius(system, orbit, orbitRadii),
      ),
    }))
    .filter(({ orbit, distance }) =>
      distance <= 16 && (!objectId || canPlaceObjectInOrbit(system, objectId, orbit.id)),
    )
    .sort((left, right) => left.distance - right.distance)[0]?.orbit
}

function handleObjectDrop(event: DragEvent): void {
  const subtype = event.dataTransfer?.getData('application/x-mothership-map-object')
  const catalogueType = catalogueTypes.find(type => type.value === subtype)
  const content = svgElement.value?.querySelector<SVGGElement>('.system-map-content')
  if (!catalogueType || !content) return

  const [x, y] = pointer(event, content)
  const point = { x, y }
  const positions = objectPositions(props.system)
  const targetOrbitId = event.target instanceof Element
    ? event.target.closest('.orbit-hit-target')?.getAttribute('data-orbit-id')
    : null
  const orbit = props.system.orbits.find(candidate => candidate.id === targetOrbitId)
    ?? orbitAtPoint(props.system, point, positions)
  const host = orbit ? requiredPosition(positions, orbit.hostId) : undefined
  emit(
    'drop-object',
    catalogueType.value,
    point,
    orbit?.id ?? null,
    host ? Math.atan2(point.y - host.y, point.x - host.x) : null,
  )
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

  const bounds = ['.system-map-items', '.system-orbits']
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
  const livePositions = new Map<string, Point>()
  const liveOrbitRadii = new Map<string, number>()
  const currentPositions = () => objectPositions(system, {
    positions: livePositions,
    orbitRadii: liveOrbitRadii,
  })
  const positions = currentPositions()
  const svg = select(element)
  const currentTransform = zoomTransform(element)
  const focusedOrbitId = element.querySelector<SVGCircleElement>('.orbit-hit-target:focus')
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

  content.append('text')
    .attr('class', 'map-title')
    .attr('x', 32)
    .attr('y', 36)
    .text(system.name)
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
    .attr('data-orbit-id', orbit => orbit.id)
    .attr('cx', orbit => requiredPosition(positions, orbit.hostId).x)
    .attr('cy', orbit => requiredPosition(positions, orbit.hostId).y)
    .attr('r', orbit => orbitRadius(system, orbit))
    .attr('role', 'slider')
    .attr('tabindex', 0)
    .attr('aria-label', orbit => `Resize Orbit ${orbit.order} around ${orbitHost(system, orbit).name}`)
    .attr('aria-valuemin', orbit => minimumOrbitRadius(system, orbit))
    .attr('aria-valuemax', orbit => orbitRadius(system, orbit) + 400)
    .attr('aria-valuenow', orbit => Math.round(orbitRadius(system, orbit)))
    .attr('aria-valuetext', orbit => `${Math.round(orbitRadius(system, orbit))} map units`)
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
        return
      }

      const currentRadius = orbitRadius(system, orbit, liveOrbitRadii)
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

  function updateLiveGeometry(): void {
    const positions = currentPositions()
    objectMarks.attr('transform', object => {
      const point = requiredPosition(positions, object.id)
      return `translate(${point.x} ${point.y})`
    })
    orbitMarks.select<SVGCircleElement>('.orbit-ring')
      .attr('cx', orbit => requiredPosition(positions, orbit.hostId).x)
      .attr('cy', orbit => requiredPosition(positions, orbit.hostId).y)
      .attr('r', orbit => orbitRadius(system, orbit, liveOrbitRadii))
    orbitSelectors
      .attr('cx', orbit => requiredPosition(positions, orbit.hostId).x)
      .attr('cy', orbit => requiredPosition(positions, orbit.hostId).y)
      .attr('r', orbit => orbitRadius(system, orbit, liveOrbitRadii))
      .attr('aria-valuenow', orbit => Math.round(orbitRadius(system, orbit, liveOrbitRadii)))
      .attr('aria-valuemax', orbit => orbitRadius(system, orbit, liveOrbitRadii) + 400)
      .attr('aria-valuetext', orbit => `${Math.round(orbitRadius(system, orbit, liveOrbitRadii))} map units`)
    orbitMarks.select<SVGTextElement>('.orbit-label')
      .attr('x', orbit => requiredPosition(positions, orbit.hostId).x)
      .attr('y', orbit => requiredPosition(positions, orbit.hostId).y - orbitRadius(system, orbit, liveOrbitRadii) * 0.72)
  }

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
    .on('drag', function (event, object) {
      if (event.dx || event.dy) {
        movedObjects.add(this)
        livePositions.set(object.id, { x: event.x, y: event.y })
        updateLiveGeometry()
      }
    })
    .on('end', function (event, object) {
      select(this).classed('is-dragging', false)
      if (!movedObjects.has(this)) return
      setTimeout(() => movedObjects.delete(this), 0)

      if (object.placement.kind === 'orbit') {
        const { orbitId } = object.placement
        const orbit = system.orbits.find(candidate => candidate.id === orbitId)
        if (!orbit) throw new Error(`Object "${object.id}" references a missing Orbit.`)
        const positions = currentPositions()
        const point = { x: event.x, y: event.y }
        const targetOrbit = orbitAtPoint(system, point, positions, object.id, liveOrbitRadii)
        if (targetOrbit) {
          const host = requiredPosition(positions, targetOrbit.hostId)
          emit('place-object-in-orbit', object.id, targetOrbit.id, Math.atan2(event.y - host.y, event.x - host.x))
        } else {
          const host = requiredPosition(positions, orbit.hostId)
          emit('rotate-object', object.id, Math.atan2(event.y - host.y, event.x - host.x))
        }
        return
      }

      const positions = currentPositions()
      const point = { x: event.x, y: event.y }
      const targetOrbit = orbitAtPoint(system, point, positions, object.id, liveOrbitRadii)
      if (targetOrbit) {
        const host = requiredPosition(positions, targetOrbit.hostId)
        emit('place-object-in-orbit', object.id, targetOrbit.id, Math.atan2(event.y - host.y, event.x - host.x))
      } else {
        emit('move-object', object.id, {
          x: Math.max(0, Math.min(1, (event.x - 64) / 832)),
          y: Math.max(0, Math.min(1, (event.y - 72) / 416)),
        })
      }
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

  const resizedOrbits = new WeakSet<SVGCircleElement>()
  orbitSelectors.call(
    drag<SVGCircleElement, Orbit>()
      .container(() => content.node()!)
      .subject(event => ({ x: event.x, y: event.y }))
      .on('start', function () {
        resizedOrbits.delete(this)
        select(this).classed('is-resizing', true)
      })
      .on('drag', function (event, orbit) {
        if (event.dx || event.dy) resizedOrbits.add(this)
        const host = requiredPosition(currentPositions(), orbit.hostId)
        const radius = Math.max(
          minimumOrbitRadius(system, orbit),
          Math.round(Math.hypot(event.x - host.x, event.y - host.y)),
        )
        liveOrbitRadii.set(orbit.id, radius)
        updateLiveGeometry()
      })
      .on('end', function (event, orbit) {
        select(this).classed('is-resizing', false)
        if (!resizedOrbits.has(this)) return
        const host = requiredPosition(currentPositions(), orbit.hostId)
        const radius = Math.max(
          minimumOrbitRadius(system, orbit),
          Math.round(Math.hypot(event.x - host.x, event.y - host.y)),
        )
        liveOrbitRadii.set(orbit.id, radius)
        updateLiveGeometry()
        emit('resize-orbit', orbit.id, radius)
      }),
  )

  zoomBehavior = zoom<SVGSVGElement, unknown>()
    .extent([[0, 0], [960, 560]])
    .scaleExtent([0.25, 4])
    .filter((event) => {
      const target = event.target
      const isMapMark = target instanceof Element
        && target.closest('.system-object, .orbit-hit-target')
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
    orbitSelectors.filter(orbit => orbit.id === focusedOrbitId).node()?.focus()
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
      @dragover.prevent
      @drop.prevent="handleObjectDrop"
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

.map-count {
  fill: #69746a;
  font: 10px Consolas, monospace;
  letter-spacing: 0.08em;
}

.map-title,
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
  cursor: grab;
}

.orbit-hit-target.is-resizing {
  cursor: grabbing;
}

.orbit-mark:has(.orbit-hit-target:hover, .orbit-hit-target:focus) .orbit-ring,
.orbit-mark.is-selected .orbit-ring {
  stroke: #a45138;
  stroke-width: 2.4;
}

.orbit-hit-target:focus,
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
  pointer-events: none;
}

.system-object.is-dragging {
  cursor: grabbing;
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
  pointer-events: none;
}

.object-name {
  fill: #2e3831;
  font: 12px Georgia, serif;
  text-anchor: middle;
  pointer-events: none;
}

.map-empty {
  fill: #69746a;
  font: 16px Georgia, serif;
}
</style>
