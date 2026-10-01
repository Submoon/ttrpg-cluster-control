<script setup lang="ts">
import { select } from 'd3'
import type { Orbit, Point, StarSystem, SystemObject } from '../domain/workspace'

const props = defineProps<{
  system: StarSystem
  selectedObjectId: string | null
  selectedOrbitId: string | null
}>()

const emit = defineEmits<{
  'select-object': [id: string]
  'select-orbit': [id: string]
}>()

const svgElement = ref<SVGSVGElement | null>(null)

function orbitHost(system: StarSystem, orbit: Orbit): SystemObject {
  const host = system.objects.find(object => object.id === orbit.hostId)
  if (!host) {
    throw new Error(`Orbit "${orbit.id}" has no host object.`)
  }
  return host
}

function orbitRadius(system: StarSystem, orbit: Orbit): number {
  const starHost = orbitHost(system, orbit).subtype === 'star'
  return starHost
    ? 112 + (orbit.order - 1) * 58
    : 46 + (orbit.order - 1) * 28
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
      const angle = -Math.PI / 2 + (index / Math.max(1, siblings.length)) * Math.PI * 2
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

function render(): void {
  const element = svgElement.value
  if (!element) return

  const system = props.system
  const positions = objectPositions(system)
  const svg = select(element)
  svg.selectAll('*').remove()

  const grid = svg.append('defs')
    .append('pattern')
    .attr('id', 'system-map-grid')
    .attr('width', 28)
    .attr('height', 28)
    .attr('patternUnits', 'userSpaceOnUse')
  grid.append('path')
    .attr('d', 'M 28 0 L 0 0 0 28')
    .attr('class', 'map-grid-line')

  svg.append('rect')
    .attr('class', 'map-background')
    .attr('width', 960)
    .attr('height', 560)
  svg.append('rect')
    .attr('class', 'map-grid')
    .attr('width', 960)
    .attr('height', 560)

  const stars = system.objects.filter(object => object.subtype === 'star').length
  svg.append('text')
    .attr('class', 'map-title')
    .attr('x', 32)
    .attr('y', 36)
    .text(system.name)
  svg.append('text')
    .attr('class', 'map-caption')
    .attr('x', 32)
    .attr('y', 56)
    .text(`SYSTEM / ${stars} STAR${stars === 1 ? '' : 'S'} / SCHEMATIC, NOT TO SCALE`)
  svg.append('text')
    .attr('class', 'map-count')
    .attr('x', 928)
    .attr('y', 36)
    .attr('text-anchor', 'end')
    .text(`${system.objects.length} OBJECTS / ${system.orbits.length} ORBITS`)

  const orbitMarks = svg.selectAll<SVGGElement, Orbit>('g.orbit-mark')
    .data(system.orbits.slice().sort((left, right) => left.order - right.order))
    .join('g')
    .attr('class', orbit => `orbit-mark${props.selectedOrbitId === orbit.id ? ' is-selected' : ''}`)
    .attr('role', 'button')
    .attr('tabindex', 0)
    .attr('aria-label', orbit => `Orbit ${orbit.order} around ${orbitHost(system, orbit).name}`)

  orbitMarks.append('circle')
    .attr('class', 'orbit-ring')
    .attr('cx', orbit => requiredPosition(positions, orbit.hostId).x)
    .attr('cy', orbit => requiredPosition(positions, orbit.hostId).y)
    .attr('r', orbit => orbitRadius(system, orbit))
  orbitMarks.append('circle')
    .attr('class', 'orbit-hit-target')
    .attr('cx', orbit => requiredPosition(positions, orbit.hostId).x)
    .attr('cy', orbit => requiredPosition(positions, orbit.hostId).y)
    .attr('r', orbit => orbitRadius(system, orbit))
  orbitMarks.append('text')
    .attr('class', 'orbit-label')
    .attr('x', orbit => requiredPosition(positions, orbit.hostId).x)
    .attr('y', orbit => {
      return requiredPosition(positions, orbit.hostId).y - orbitRadius(system, orbit) * 0.72
    })
    .text(orbit => `ORBIT ${orbit.order}`)
  orbitMarks
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

  const objectMarks = svg.selectAll<SVGGElement, SystemObject>('g.system-object')
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
  objectMarks
    .on('click', (event, object) => {
      event.stopPropagation()
      emit('select-object', object.id)
    })
    .on('keydown', (event, object) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        emit('select-object', object.id)
      }
    })

  if (system.objects.length === 0) {
    svg.append('text')
      .attr('class', 'map-empty')
      .attr('x', 480)
      .attr('y', 268)
      .attr('text-anchor', 'middle')
      .text('No locations charted yet.')
  }
}

onMounted(render)
watch(() => props.system, render, { deep: true })
watch(() => props.selectedObjectId, render)
watch(() => props.selectedOrbitId, render)
</script>

<template>
  <svg
    ref="svgElement"
    class="system-map-svg block h-full min-h-[31rem] w-full"
    viewBox="0 0 960 560"
    role="group"
    :aria-label="`${system.name} star system map`"
  />
</template>

<style>
.system-map-svg {
  background: #f4eee2;
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
  pointer-events: stroke;
}

.orbit-hit-target {
  fill: none;
  stroke: transparent;
  stroke-width: 16;
  pointer-events: none;
}

.orbit-mark {
  cursor: pointer;
  pointer-events: all;
}

.orbit-mark:hover .orbit-ring,
.orbit-mark:focus .orbit-ring,
.orbit-mark.is-selected .orbit-ring {
  stroke: #a45138;
  stroke-width: 2.4;
}

.orbit-mark:focus,
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
