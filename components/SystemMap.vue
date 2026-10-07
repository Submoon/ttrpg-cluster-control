<script setup lang="ts">
import { drag, pointer, select, zoom, zoomIdentity, zoomTransform, type ZoomBehavior } from 'd3'
import {
  canPlaceObjectInOrbit,
  catalogueTypes,
  defaultOrbitRadius,
  minimumOrbitRadius,
  normalizeOrbitRotation,
  type CatalogueSubtype,
  type Orbit,
  type OrbitRadii,
  type Point,
  type StarSystem,
  type SystemObject,
} from '../domain/workspace'
import { objectMark } from '../utils/catalogue-marks'
import { exportMapImage, type MapImageFormat } from '../utils/map-image-export'
import { MAP_ZOOM_MAX_SCALE, MAP_ZOOM_MIN_SCALE } from '../utils/map-zoom'

const mapSurfacePadding = 160

const props = defineProps<{
  system: StarSystem
  orbitRadii: Record<string, OrbitRadii>
  orbitRotations: Record<string, number>
  objectAngles: Record<string, number>
  selectedObjectId: string | null
  selectedOrbitId: string | null
}>()

const emit = defineEmits<{
  'select-object': [id: string]
  'select-orbit': [id: string]
  'move-object': [id: string, position: Point]
  'move-orbit-center': [id: string, center: Point, hostId: string | null]
  'rotate-object': [id: string, angle: number]
  'resize-orbit': [id: string, radii: OrbitRadii]
  'rotate-orbit': [id: string, rotation: number]
  'place-object-in-orbit': [id: string, orbitId: string, angle: number]
  'drop-orbit': [point: Point, hostId: string | null]
  'drop-object': [subtype: CatalogueSubtype, point: Point, orbitId: string | null, angle: number | null]
}>()

const svgElement = ref<SVGSVGElement | null>(null)
const zoomLevel = ref(100)
let zoomBehavior: ZoomBehavior<SVGSVGElement, unknown> | undefined
const orbitRotationWheelEvents = new WeakSet<Event>()
let rotateOrbitFromWheel: (event: WheelEvent) => boolean = () => false

function captureOrbitRotationWheel(event: WheelEvent): void {
  if (!rotateOrbitFromWheel(event)) return
  event.preventDefault()
  orbitRotationWheelEvents.add(event)
}

interface MapGeometryOverrides {
  positions: ReadonlyMap<string, Point>
  orbitCenters: ReadonlyMap<string, Point>
  orbitRadii: ReadonlyMap<string, OrbitRadii>
  orbitRotations: ReadonlyMap<string, number>
}

type OrbitResizeAxis = 'global' | 'horizontal' | 'vertical'

interface OrbitResizeGesture {
  axis: OrbitResizeAxis
  center: Point
  startRadii: OrbitRadii
  startDistance: number
}

interface OrbitRotationGesture {
  center: Point
  lastPointerAngle: number
  rotation: number
}

function orbitLabel(system: StarSystem, orbit: Orbit): string {
  if (orbit.hostId === null) return `Orbit ${orbit.order} around unoccupied center`
  const host = system.objects.find(object => object.id === orbit.hostId)
  if (!host) {
    throw new Error(`Orbit "${orbit.id}" has no host object.`)
  }
  return `Orbit ${orbit.order} around ${host.name}`
}

function orbitCenter(
  orbit: Orbit,
  positions: Map<string, Point>,
  overrides?: ReadonlyMap<string, Point>,
): Point {
  if (orbit.hostId === null) {
    const override = overrides?.get(orbit.id)
    if (override) return override
    return {
      x: 64 + orbit.center.x * 832,
      y: 72 + orbit.center.y * 416,
    }
  }
  return requiredPosition(positions, orbit.hostId)
}

function toNormalizedMapPoint(point: Point): Point {
  return {
    x: (point.x - 64) / 832,
    y: (point.y - 72) / 416,
  }
}

function orbitRadii(
  system: StarSystem,
  orbit: Orbit,
  overrides?: ReadonlyMap<string, OrbitRadii>,
): OrbitRadii {
  const radius = defaultOrbitRadius(system, orbit)
  return overrides?.get(orbit.id)
    ?? props.orbitRadii[orbit.id]
    ?? { horizontal: radius, vertical: radius }
}

function orbitRotation(
  orbit: Orbit,
  overrides?: ReadonlyMap<string, number>,
): number {
  return overrides?.get(orbit.id) ?? props.orbitRotations[orbit.id] ?? 0
}

function rotatePoint(point: Point, center: Point, degrees: number): Point {
  const radians = degrees * Math.PI / 180
  const cosine = Math.cos(radians)
  const sine = Math.sin(radians)
  const x = point.x - center.x
  const y = point.y - center.y
  return {
    x: center.x + x * cosine - y * sine,
    y: center.y + x * sine + y * cosine,
  }
}

function orbitPointAtAngle(
  center: Point,
  radii: OrbitRadii,
  angle: number,
  rotation: number,
): Point {
  return rotatePoint({
    x: center.x + Math.cos(angle) * radii.horizontal,
    y: center.y + Math.sin(angle) * radii.vertical,
  }, center, rotation)
}

function orbitRotationHandlePoint(
  center: Point,
  radii: OrbitRadii,
  rotation: number,
): Point {
  return rotatePoint({
    x: center.x,
    y: center.y - radii.vertical - 28,
  }, center, rotation)
}

function orbitAxisCursor(axis: 'horizontal' | 'vertical', rotation: number): string {
  const axisRotation = normalizeOrbitRotation(rotation + (axis === 'vertical' ? 90 : 0)) % 180
  const direction = Math.round(axisRotation / 45) % 4
  return ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'][direction]!
}

function orbitAngleAtPoint(
  point: Point,
  center: Point,
  radii: OrbitRadii,
  rotation: number,
): number {
  const localPoint = rotatePoint(point, center, -rotation)
  const x = localPoint.x - center.x
  const y = localPoint.y - center.y
  if (radii.horizontal === radii.vertical) return Math.atan2(y, x)

  const distanceSquared = (angle: number) => {
    const dx = x - Math.cos(angle) * radii.horizontal
    const dy = y - Math.sin(angle) * radii.vertical
    return dx * dx + dy * dy
  }
  const step = (Math.PI * 2) / 32
  let closestAngle = 0
  let closestDistance = Number.POSITIVE_INFINITY
  for (let index = 0; index < 32; index += 1) {
    const angle = index * step
    const distance = distanceSquared(angle)
    if (distance < closestDistance) {
      closestAngle = angle
      closestDistance = distance
    }
  }

  let lower = closestAngle - step
  let upper = closestAngle + step
  const ratio = (Math.sqrt(5) - 1) / 2
  let first = upper - (upper - lower) * ratio
  let second = lower + (upper - lower) * ratio
  let firstDistance = distanceSquared(first)
  let secondDistance = distanceSquared(second)
  // ponytail: <=5.2e-6 rad interval; use a scale-aware analytic solver if extreme radii expose error.
  for (let iteration = 0; iteration < 24; iteration += 1) {
    if (firstDistance < secondDistance) {
      upper = second
      second = first
      secondDistance = firstDistance
      first = upper - (upper - lower) * ratio
      firstDistance = distanceSquared(first)
    } else {
      lower = first
      first = second
      firstDistance = secondDistance
      second = lower + (upper - lower) * ratio
      secondDistance = distanceSquared(second)
    }
  }

  const angle = (lower + upper) / 2
  return Math.atan2(Math.sin(angle), Math.cos(angle))
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
      if (!orbit) {
        throw new Error('The system map contains an object with an invalid Orbit host.')
      }

      let center: Point
      if (orbit.hostId === null) {
        center = orbitCenter(orbit, positions, overrides?.orbitCenters)
      } else {
        const host = objectsById.get(orbit.hostId)
        if (!host) {
          throw new Error('The system map contains an object with an invalid Orbit host.')
        }
        center = locate(host)
      }
      const siblings = childrenByOrbit.get(orbit.id) ?? []
      const index = siblings.findIndex(candidate => candidate.id === object.id)
      const angle = props.objectAngles[object.id]
        ?? -Math.PI / 2 + (index / Math.max(1, siblings.length)) * Math.PI * 2
      const radii = orbitRadii(system, orbit, overrides?.orbitRadii)
      point = orbitPointAtAngle(
        center,
        radii,
        angle,
        orbitRotation(orbit, overrides?.orbitRotations),
      )
    }

    visiting.delete(object.id)
    positions.set(object.id, point)
    return point
  }

  for (const object of system.objects) locate(object)
  return positions
}

function objectsMovedWithOrbit(system: StarSystem, orbitId: string): Set<string> {
  const pendingOrbitIds = [orbitId]
  const visitedOrbitIds = new Set<string>()
  const objectIds = new Set<string>()

  while (pendingOrbitIds.length > 0) {
    const currentOrbitId = pendingOrbitIds.pop()
    if (!currentOrbitId || visitedOrbitIds.has(currentOrbitId)) continue
    visitedOrbitIds.add(currentOrbitId)

    for (const object of system.objects) {
      if (
        object.placement.kind !== 'orbit'
        || object.placement.orbitId !== currentOrbitId
        || objectIds.has(object.id)
      ) {
        continue
      }
      objectIds.add(object.id)
      for (const childOrbit of system.orbits) {
        if (childOrbit.hostId === object.id) pendingOrbitIds.push(childOrbit.id)
      }
    }
  }

  return objectIds
}

function getDetachedOrbitCenter(orbitId: string): Point | undefined {
  const system = props.system
  const orbit = system.orbits.find(candidate => candidate.id === orbitId)
  if (!orbit || orbit.hostId === null) return undefined

  const positions = objectPositions(system)
  const origin = orbitCenter(orbit, positions)
  const movingObjectIds = objectsMovedWithOrbit(system, orbit.id)
  const occupiedPoints = [
    ...Array.from(positions.entries())
      .filter(([objectId]) => !movingObjectIds.has(objectId))
      .map(([, point]) => point),
    ...system.orbits
      .filter(candidate => candidate.id !== orbit.id && candidate.hostId === null)
      .map(candidate => orbitCenter(candidate, positions)),
  ]
  const centerClearance = 40
  const distanceStep = 32
  const maxOccupiedDistance = occupiedPoints.reduce(
    (farthest, point) => Math.max(
      farthest,
      Math.hypot(point.x - origin.x, point.y - origin.y),
    ),
    0,
  )
  const searchLimit = maxOccupiedDistance + centerClearance + distanceStep
  if (!Number.isFinite(searchLimit)) {
    throw new Error('Could not find a finite nearby center for this Orbit.')
  }

  for (let radius = 48; radius <= searchLimit; radius += distanceStep) {
    for (let direction = 0; direction < 8; direction += 1) {
      const angle = direction * Math.PI / 4
      const center = {
        x: origin.x + Math.cos(angle) * radius,
        y: origin.y + Math.sin(angle) * radius,
      }
      if (occupiedPoints.every(point =>
        Math.hypot(point.x - center.x, point.y - center.y) >= centerClearance,
      )) {
        return toNormalizedMapPoint(center)
      }
    }
  }

  throw new Error('Could not find an empty nearby location for this Orbit.')
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
  orbitRadiiOverrides?: ReadonlyMap<string, OrbitRadii>,
  orbitRotationsOverrides?: ReadonlyMap<string, number>,
  orbitCenterOverrides?: ReadonlyMap<string, Point>,
): Orbit | undefined {
  return system.orbits
    .map(orbit => ({
      orbit,
      distance: (() => {
        const center = orbitCenter(orbit, positions, orbitCenterOverrides)
        const radii = orbitRadii(system, orbit, orbitRadiiOverrides)
        const rotation = orbitRotation(orbit, orbitRotationsOverrides)
        const angle = orbitAngleAtPoint(point, center, radii, rotation)
        const nearestPoint = orbitPointAtAngle(center, radii, angle, rotation)
        return Math.hypot(
          point.x - nearestPoint.x,
          point.y - nearestPoint.y,
        )
      })(),
    }))
    .filter(({ orbit, distance }) =>
      distance <= 16 && (!objectId || canPlaceObjectInOrbit(system, objectId, orbit.id)),
    )
    .sort((left, right) => left.distance - right.distance)[0]?.orbit
}

function handleObjectDrop(event: DragEvent): void {
  const orbitDrag = event.dataTransfer?.getData('application/x-mothership-map-orbit')
  if (orbitDrag) {
    const content = svgElement.value?.querySelector<SVGGElement>('.system-map-content')
    if (!content) return

    const [x, y] = pointer(event, content)
    const hostId = event.target instanceof Element
      ? event.target.closest('.system-object')?.getAttribute('data-object-id') ?? null
      : null
    emit('drop-orbit', { x, y }, hostId)
    return
  }

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
  const center = orbit ? orbitCenter(orbit, positions) : undefined
  emit(
    'drop-object',
    catalogueType.value,
    point,
    orbit?.id ?? null,
    orbit && center
      ? orbitAngleAtPoint(
          point,
          center,
          orbitRadii(props.system, orbit),
          orbitRotation(orbit),
        )
      : null,
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
  return exportMapImage(element, format, props.system.name)
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
  const scale = Math.max(MAP_ZOOM_MIN_SCALE, Math.min(
    MAP_ZOOM_MAX_SCALE,
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
  const liveOrbitCenters = new Map<string, Point>()
  const liveOrbitRadii = new Map<string, OrbitRadii>()
  const liveOrbitRotations = new Map<string, number>()
  const currentPositions = () => objectPositions(system, {
    positions: livePositions,
    orbitCenters: liveOrbitCenters,
    orbitRadii: liveOrbitRadii,
    orbitRotations: liveOrbitRotations,
  })
  const positions = currentPositions()
  const svg = select(element)
  const currentTransform = zoomTransform(element)
  const focusedOrbitCenterId = element.querySelector<SVGElement>('.orbit-center-handle:focus')
    ?.getAttribute('data-orbit-id')
  const focusedOrbitId = element.querySelector<SVGElement>('.orbit-hit-target:focus')
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

  const mapBackground = content.append('rect').attr('class', 'map-background')
  const mapGrid = content.append('rect').attr('class', 'map-grid')

  const orbitMarks = content.append('g').attr('class', 'system-orbits')
    .selectAll<SVGGElement, Orbit>('g.orbit-mark')
    .data(system.orbits.slice().sort((left, right) => left.order - right.order))
    .join('g')
    .attr('class', orbit => `orbit-mark${props.selectedOrbitId === orbit.id ? ' is-selected' : ''}`)
    .attr('data-orbit-id', orbit => orbit.id)
    .attr('role', 'group')
    .attr('aria-label', orbit => orbitLabel(system, orbit))

  orbitMarks.each(function (orbit) {
    const mark = select(this)
    const center = orbitCenter(orbit, positions, liveOrbitCenters)
    const radii = orbitRadii(system, orbit)
    const rotation = orbitRotation(orbit, liveOrbitRotations)
    const rotationTransform = `rotate(${rotation} ${center.x} ${center.y})`
    const horizontalHandle = orbitPointAtAngle(center, radii, 0, rotation)
    const verticalHandle = orbitPointAtAngle(center, radii, -Math.PI / 2, rotation)
    const rotationHandle = orbitRotationHandlePoint(center, radii, rotation)
    mark.append<SVGEllipseElement>('ellipse')
      .attr('class', 'orbit-ring')
      .attr('cx', center.x)
      .attr('cy', center.y)
      .attr('rx', radii.horizontal)
      .attr('ry', radii.vertical)
      .attr('transform', rotationTransform)
    mark.append<SVGEllipseElement>('ellipse')
      .attr('class', 'orbit-hit-target')
      .attr('data-orbit-id', orbit.id)
      .attr('cx', center.x)
      .attr('cy', center.y)
      .attr('rx', radii.horizontal)
      .attr('ry', radii.vertical)
      .attr('transform', rotationTransform)
      .attr('role', 'slider')
      .attr('tabindex', 0)
      .attr('aria-label', `Resize ${orbitLabel(system, orbit)}`)
      .attr('aria-valuemin', minimumOrbitRadius(system, orbit))
      .attr('aria-valuemax', radii.horizontal + 400)
      .attr('aria-valuenow', Math.round(radii.horizontal))
      .attr('aria-valuetext', `${Math.round(radii.horizontal)} by ${Math.round(radii.vertical)} map units`)
    for (const [axis, x, y, label] of [
      ['horizontal', horizontalHandle.x, horizontalHandle.y, 'Drag to resize horizontally'],
      ['vertical', verticalHandle.x, verticalHandle.y, 'Drag to resize vertically'],
    ] as const) {
      mark.append('circle')
        .attr('class', `orbit-edit-control orbit-axis-handle orbit-axis-handle--${axis}`)
        .attr('data-resize-axis', axis)
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', 6)
        .style('cursor', orbitAxisCursor(axis, rotation))
        .attr('aria-hidden', 'true')
        .append('title')
        .text(label)
    }
    if (orbit.hostId === null) {
      mark.append<SVGCircleElement>('circle')
        .attr('class', 'orbit-edit-control orbit-center-handle')
        .attr('data-orbit-id', orbit.id)
        .attr('cx', center.x)
        .attr('cy', center.y)
        .attr('r', 7)
        .attr('role', 'button')
        .attr('tabindex', props.selectedOrbitId === orbit.id ? 0 : -1)
        .attr('aria-hidden', props.selectedOrbitId === orbit.id ? 'false' : 'true')
        .attr('aria-label', `Move center of ${orbitLabel(system, orbit)}`)
        .append('title')
        .text('Drag to move the Orbit center')
    }
    mark.append<SVGLineElement>('line')
      .attr('class', 'orbit-edit-control orbit-rotation-stem')
      .attr('x1', verticalHandle.x)
      .attr('y1', verticalHandle.y)
      .attr('x2', rotationHandle.x)
      .attr('y2', rotationHandle.y)
    mark.append<SVGCircleElement>('circle')
      .attr('class', 'orbit-edit-control orbit-rotation-handle')
      .attr('data-orbit-id', orbit.id)
      .attr('cx', rotationHandle.x)
      .attr('cy', rotationHandle.y)
      .attr('r', 7)
      .attr('role', 'slider')
      .attr('tabindex', props.selectedOrbitId === orbit.id ? 0 : -1)
      .attr('aria-hidden', props.selectedOrbitId === orbit.id ? 'false' : 'true')
      .attr('aria-label', `Rotate ${orbitLabel(system, orbit)}`)
      .attr('aria-valuemin', 0)
      .attr('aria-valuemax', 359)
      .attr('aria-valuenow', Math.round(rotation))
      .attr('aria-valuetext', `${Math.round(rotation)} degrees`)
      .append('title')
      .text('Drag to rotate; Ctrl+wheel over the Orbit to fine-tune')
  })
  orbitMarks.filter(orbit => orbit.id === props.selectedOrbitId).raise()
  const orbitSelectors = orbitMarks.selectAll<SVGElement, Orbit>('.orbit-hit-target')
  const orbitAxisHandles = orbitMarks.selectAll<SVGCircleElement, Orbit>('.orbit-axis-handle')
  const orbitRotationHandles = orbitMarks.selectAll<SVGCircleElement, Orbit>(
    '.orbit-rotation-handle',
  )
  const orbitCenterHandles = orbitMarks.selectAll<SVGCircleElement, Orbit>(
    '.orbit-center-handle',
  )
  const movedOrbitCenters = new WeakSet<SVGCircleElement>()
  const orbitResizeTargets = orbitMarks.selectAll<SVGElement, Orbit>(
    '.orbit-hit-target, .orbit-axis-handle',
  )
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

      const current = orbitRadii(system, orbit, liveOrbitRadii)
      const step = event.shiftKey ? 10 : 1
      const minimum = minimumOrbitRadius(system, orbit)
      let horizontal = current.horizontal
      let vertical = current.vertical
      if (event.key === 'ArrowLeft') horizontal = Math.max(minimum, current.horizontal - step)
      else if (event.key === 'ArrowRight') horizontal += step
      else if (event.key === 'ArrowDown') vertical = Math.max(minimum, current.vertical - step)
      else if (event.key === 'ArrowUp') vertical += step
      else if (event.key === 'Home') horizontal = vertical = minimum
      else if (event.key === 'End') {
        horizontal += 400
        vertical += 400
      } else return

      event.preventDefault()
      emit('resize-orbit', orbit.id, { horizontal, vertical })
    })
  orbitAxisHandles.on('click', (event, orbit) => {
    event.stopPropagation()
    emit('select-orbit', orbit.id)
  })
  orbitCenterHandles
    .on('click', (event, orbit) => {
      event.stopPropagation()
      const handle = event.currentTarget as SVGCircleElement
      if (movedOrbitCenters.has(handle)) {
        movedOrbitCenters.delete(handle)
        return
      }
      emit('select-orbit', orbit.id)
    })
    .on('keydown', (event, orbit) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        emit('select-orbit', orbit.id)
        return
      }

      const step = event.shiftKey ? 10 : 1
      const center = orbitCenter(orbit, currentPositions(), liveOrbitCenters)
      let x = center.x
      let y = center.y
      if (event.key === 'ArrowLeft') x -= step
      else if (event.key === 'ArrowRight') x += step
      else if (event.key === 'ArrowUp') y -= step
      else if (event.key === 'ArrowDown') y += step
      else return

      event.preventDefault()
      const nextCenter = { x, y }
      liveOrbitCenters.set(orbit.id, nextCenter)
      updateLiveGeometry()
      emit('move-orbit-center', orbit.id, toNormalizedMapPoint(nextCenter), null)
    })
  orbitRotationHandles
    .on('click', (event, orbit) => {
      event.stopPropagation()
      emit('select-orbit', orbit.id)
    })
    .on('keydown', (event, orbit) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      event.preventDefault()
      const step = event.shiftKey ? 10 : 1
      const direction = event.key === 'ArrowRight' ? 1 : -1
      const rotation = normalizeOrbitRotation(
        orbitRotation(orbit, liveOrbitRotations) + step * direction,
      )
      liveOrbitRotations.set(orbit.id, rotation)
      updateLiveGeometry()
      emit('rotate-orbit', orbit.id, rotation)
    })

  const items = content.append('g').attr('class', 'system-map-items')
  const objectMarks = items.selectAll<SVGGElement, SystemObject>('g.system-object')
    .data(system.objects)
    .join('g')
    .attr('class', object => `system-object${props.selectedObjectId === object.id ? ' is-selected' : ''}`)
    .attr('data-object-id', object => object.id)
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

    if (object.subtype === 'star') mark.append('circle')
      .attr('class', 'object-glyph-halo')
      .attr('r', 18)
    mark.append('text')
      .attr('class', 'system-object-glyph')
      .attr('y', 8)
      .attr('text-anchor', 'middle')
      .text(objectMark(object))

    mark.append('text')
      .attr('class', 'object-key')
      .attr('y', 31)
      .text(object.locationKey)
    const nameLabel = mark.append('text')
      .attr('class', 'object-name')
      .attr('y', 46)
      .text(object.name)
    mark.append('text')
      .attr('class', 'object-type-mark')
      .attr('x', (nameLabel.node()?.getComputedTextLength() ?? 0) / 2 + 6)
      .attr('y', 46)
      .attr('text-anchor', 'start')
      .text(objectMark(object))
  })

  function updateMapSurface(): void {
    const bounds = [items.node()?.getBBox(), orbitMarks.node()?.getBBox()]
      .filter((box): box is DOMRect => box !== undefined && (box.width > 0 || box.height > 0))
    const left = Math.floor(Math.min(0, ...bounds.map(box => box.x - mapSurfacePadding)))
    const top = Math.floor(Math.min(0, ...bounds.map(box => box.y - mapSurfacePadding)))
    const right = Math.ceil(Math.max(
      960,
      ...bounds.map(box => box.x + box.width + mapSurfacePadding),
    ))
    const bottom = Math.ceil(Math.max(
      560,
      ...bounds.map(box => box.y + box.height + mapSurfacePadding),
    ))

    for (const surface of [mapBackground, mapGrid]) {
      surface
        .attr('x', left)
        .attr('y', top)
        .attr('width', right - left)
        .attr('height', bottom - top)
    }
  }

  function updateLiveGeometry(): void {
    const positions = currentPositions()
    objectMarks.attr('transform', object => {
      const point = requiredPosition(positions, object.id)
      return `translate(${point.x} ${point.y})`
    })
    orbitMarks.each(function (orbit) {
      const center = orbitCenter(orbit, positions, liveOrbitCenters)
      const radii = orbitRadii(system, orbit, liveOrbitRadii)
      const rotation = orbitRotation(orbit, liveOrbitRotations)
      const rotationTransform = `rotate(${rotation} ${center.x} ${center.y})`
      const horizontalHandle = orbitPointAtAngle(center, radii, 0, rotation)
      const verticalHandle = orbitPointAtAngle(center, radii, -Math.PI / 2, rotation)
      const rotationHandle = orbitRotationHandlePoint(center, radii, rotation)
      const mark = select(this)
      mark.selectAll<SVGElement, Orbit>('.orbit-ring, .orbit-hit-target')
        .attr('cx', center.x)
        .attr('cy', center.y)
        .attr('rx', radii.horizontal)
        .attr('ry', radii.vertical)
        .attr('transform', rotationTransform)
      mark.select<SVGCircleElement>('.orbit-center-handle')
        .attr('cx', center.x)
        .attr('cy', center.y)
      mark.select<SVGCircleElement>('.orbit-axis-handle--horizontal')
        .attr('cx', horizontalHandle.x)
        .attr('cy', horizontalHandle.y)
        .style('cursor', orbitAxisCursor('horizontal', rotation))
      mark.select<SVGCircleElement>('.orbit-axis-handle--vertical')
        .attr('cx', verticalHandle.x)
        .attr('cy', verticalHandle.y)
        .style('cursor', orbitAxisCursor('vertical', rotation))
      mark.select<SVGLineElement>('.orbit-rotation-stem')
        .attr('x1', verticalHandle.x)
        .attr('y1', verticalHandle.y)
        .attr('x2', rotationHandle.x)
        .attr('y2', rotationHandle.y)
      mark.select<SVGCircleElement>('.orbit-rotation-handle')
        .attr('cx', rotationHandle.x)
        .attr('cy', rotationHandle.y)
        .attr('aria-valuenow', Math.round(rotation))
        .attr('aria-valuetext', `${Math.round(rotation)} degrees`)
    })
    orbitSelectors
      .attr('aria-valuenow', orbit => Math.round(orbitRadii(system, orbit, liveOrbitRadii).horizontal))
      .attr('aria-valuemax', orbit => orbitRadii(system, orbit, liveOrbitRadii).horizontal + 400)
      .attr('aria-valuetext', orbit => {
        const radii = orbitRadii(system, orbit, liveOrbitRadii)
        return `${Math.round(radii.horizontal)} by ${Math.round(radii.vertical)} map units`
      })
    updateMapSurface()
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
        const targetOrbit = orbitAtPoint(
          system,
          point,
          positions,
          object.id,
          liveOrbitRadii,
          liveOrbitRotations,
          liveOrbitCenters,
        )
        if (targetOrbit) {
          const center = orbitCenter(targetOrbit, positions, liveOrbitCenters)
          emit('place-object-in-orbit', object.id, targetOrbit.id, orbitAngleAtPoint(
            point,
            center,
            orbitRadii(system, targetOrbit, liveOrbitRadii),
            orbitRotation(targetOrbit, liveOrbitRotations),
          ))
        } else {
          const center = orbitCenter(orbit, positions, liveOrbitCenters)
          emit('rotate-object', object.id, orbitAngleAtPoint(
            point,
            center,
            orbitRadii(system, orbit, liveOrbitRadii),
            orbitRotation(orbit, liveOrbitRotations),
          ))
        }
        return
      }

      const positions = currentPositions()
      const point = { x: event.x, y: event.y }
      const targetOrbit = orbitAtPoint(
        system,
        point,
        positions,
        object.id,
        liveOrbitRadii,
        liveOrbitRotations,
        liveOrbitCenters,
      )
      if (targetOrbit) {
        const center = orbitCenter(targetOrbit, positions, liveOrbitCenters)
        emit('place-object-in-orbit', object.id, targetOrbit.id, orbitAngleAtPoint(
          point,
          center,
          orbitRadii(system, targetOrbit, liveOrbitRadii),
          orbitRotation(targetOrbit, liveOrbitRotations),
        ))
      } else {
        emit('move-object', object.id, {
          x: (event.x - 64) / 832,
          y: (event.y - 72) / 416,
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
  updateMapSurface()

  rotateOrbitFromWheel = (event) => {
    if (!event.ctrlKey || !event.deltaY || !props.selectedOrbitId) return false
    const targetOrbitId = event.target instanceof Element
      ? event.target.closest('.orbit-mark')?.getAttribute('data-orbit-id')
      : null
    const targetedOrbit = system.orbits.find(orbit => orbit.id === targetOrbitId)
    const contentElement = content.node()
    if (!contentElement) return false
    const [x, y] = pointer(event, contentElement)
    const orbit = targetedOrbit ?? orbitAtPoint(
      system,
      { x, y },
      currentPositions(),
      undefined,
      liveOrbitRadii,
      liveOrbitRotations,
      liveOrbitCenters,
    )
    if (orbit?.id !== props.selectedOrbitId) return false

    const rotation = normalizeOrbitRotation(
      orbitRotation(orbit, liveOrbitRotations) + event.deltaY * 0.05,
    )
    liveOrbitRotations.set(orbit.id, rotation)
    updateLiveGeometry()
    emit('rotate-orbit', orbit.id, rotation)
    return true
  }

  const resizedOrbits = new WeakSet<SVGElement>()
  const orbitResizeGestures = new WeakMap<SVGElement, OrbitResizeGesture>()
  function resizedRadii(
    point: Point,
    orbit: Orbit,
    gesture: OrbitResizeGesture,
  ): OrbitRadii {
    const { axis, center } = gesture
    const minimum = minimumOrbitRadius(system, orbit)
    if (axis === 'global') {
      const minimumScale = Math.max(
        minimum / gesture.startRadii.horizontal,
        minimum / gesture.startRadii.vertical,
      )
      const scale = Math.max(
        minimumScale,
        Math.hypot(point.x - center.x, point.y - center.y) / gesture.startDistance,
      )
      return {
        horizontal: Math.round(gesture.startRadii.horizontal * scale),
        vertical: Math.round(gesture.startRadii.vertical * scale),
      }
    }

    const current = orbitRadii(system, orbit, liveOrbitRadii)
    const localPoint = rotatePoint(
      point,
      center,
      -orbitRotation(orbit, liveOrbitRotations),
    )
    return {
      horizontal: axis === 'horizontal'
        ? Math.max(minimum, Math.round(Math.abs(localPoint.x - center.x)))
        : current.horizontal,
      vertical: axis === 'vertical'
        ? Math.max(minimum, Math.round(Math.abs(localPoint.y - center.y)))
        : current.vertical,
    }
  }
  orbitResizeTargets.call(
    drag<SVGElement, Orbit>()
      .container(() => content.node()!)
      .subject(event => ({ x: event.x, y: event.y }))
      .on('start', function (event, orbit) {
        resizedOrbits.delete(this)
        const center = orbitCenter(orbit, currentPositions(), liveOrbitCenters)
        const handleAxis = this.getAttribute('data-resize-axis')
        const axis: OrbitResizeAxis = handleAxis === 'horizontal' || handleAxis === 'vertical'
          ? handleAxis
          : 'global'
        orbitResizeGestures.set(this, {
          axis,
          center,
          startRadii: orbitRadii(system, orbit, liveOrbitRadii),
          startDistance: Math.hypot(event.x - center.x, event.y - center.y),
        })
        select(this).classed('is-resizing', true)
      })
      .on('drag', function (event, orbit) {
        if (event.dx || event.dy) resizedOrbits.add(this)
        const gesture = orbitResizeGestures.get(this)
        if (!gesture) return
        liveOrbitRadii.set(orbit.id, resizedRadii({ x: event.x, y: event.y }, orbit, gesture))
        updateLiveGeometry()
      })
      .on('end', function (event, orbit) {
        select(this).classed('is-resizing', false)
        const gesture = orbitResizeGestures.get(this)
        orbitResizeGestures.delete(this)
        if (!gesture || !resizedOrbits.has(this)) return
        const radii = resizedRadii({ x: event.x, y: event.y }, orbit, gesture)
        liveOrbitRadii.set(orbit.id, radii)
        updateLiveGeometry()
        emit('resize-orbit', orbit.id, radii)
      }),
  )

  orbitCenterHandles.call(
    drag<SVGCircleElement, Orbit>()
      .container(() => content.node()!)
      .subject(event => ({ x: event.x, y: event.y }))
      .on('start', function () {
        movedOrbitCenters.delete(this)
        select(this).classed('is-moving', true)
      })
      .on('drag', function (event, orbit) {
        if (event.dx || event.dy) movedOrbitCenters.add(this)
        liveOrbitCenters.set(orbit.id, { x: event.x, y: event.y })
        updateLiveGeometry()
      })
      .on('end', function (event, orbit) {
        select(this).classed('is-moving', false)
        if (!movedOrbitCenters.has(this)) return
        const center = { x: event.x, y: event.y }
        liveOrbitCenters.set(orbit.id, center)
        updateLiveGeometry()
        const target = event.sourceEvent.target
        const hostId = target instanceof Element
          ? target.closest('.system-object')?.getAttribute('data-object-id') ?? null
          : null
        emit('move-orbit-center', orbit.id, toNormalizedMapPoint(center), hostId)
      }),
  )

  const rotatedOrbits = new WeakSet<SVGCircleElement>()
  const orbitRotationGestures = new WeakMap<SVGCircleElement, OrbitRotationGesture>()
  orbitRotationHandles.call(
    drag<SVGCircleElement, Orbit>()
      .container(() => content.node()!)
      .subject(event => ({ x: event.x, y: event.y }))
      .on('start', function (event, orbit) {
        rotatedOrbits.delete(this)
        const center = orbitCenter(orbit, currentPositions(), liveOrbitCenters)
        orbitRotationGestures.set(this, {
          center,
          lastPointerAngle: Math.atan2(event.y - center.y, event.x - center.x),
          rotation: orbitRotation(orbit, liveOrbitRotations),
        })
        select(this).classed('is-rotating', true)
      })
      .on('drag', function (event, orbit) {
        if (event.dx || event.dy) rotatedOrbits.add(this)
        const gesture = orbitRotationGestures.get(this)
        if (!gesture) return
        const pointerAngle = Math.atan2(
          event.y - gesture.center.y,
          event.x - gesture.center.x,
        )
        let delta = pointerAngle - gesture.lastPointerAngle
        if (delta > Math.PI) delta -= Math.PI * 2
        else if (delta < -Math.PI) delta += Math.PI * 2
        gesture.rotation = normalizeOrbitRotation(gesture.rotation + delta * 180 / Math.PI)
        gesture.lastPointerAngle = pointerAngle
        liveOrbitRotations.set(orbit.id, gesture.rotation)
        updateLiveGeometry()
      })
      .on('end', function (_event, orbit) {
        select(this).classed('is-rotating', false)
        const gesture = orbitRotationGestures.get(this)
        orbitRotationGestures.delete(this)
        if (!gesture || !rotatedOrbits.has(this)) return
        emit('rotate-orbit', orbit.id, gesture.rotation)
      }),
  )

  zoomBehavior = zoom<SVGSVGElement, unknown>()
    .extent([[0, 0], [960, 560]])
    .scaleExtent([MAP_ZOOM_MIN_SCALE, MAP_ZOOM_MAX_SCALE])
    .filter((event) => {
      if (orbitRotationWheelEvents.has(event as Event)) return false
      const target = event.target
      const isMapMark = target instanceof Element
        && target.closest(
          '.system-object, .orbit-hit-target, .orbit-axis-handle, .orbit-rotation-handle, .orbit-center-handle',
        )
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
  if (focusedOrbitCenterId) {
    orbitCenterHandles.filter(orbit => orbit.id === focusedOrbitCenterId).node()?.focus()
  } else if (focusedOrbitId) {
    orbitSelectors.filter(orbit => orbit.id === focusedOrbitId).node()?.focus()
  }
}

onMounted(render)
watch(() => props.system, render, { deep: true })
watch(() => props.orbitRadii, render, { deep: true })
watch(() => props.orbitRotations, render, { deep: true })
watch(() => props.objectAngles, render, { deep: true })
watch(() => props.selectedObjectId, render)
watch(() => props.selectedOrbitId, render)

defineExpose({ exportImage, getDetachedOrbitCenter })
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
      class="system-map-svg block h-full min-h-0 w-full flex-1"
      viewBox="0 0 960 560"
      role="group"
      :aria-label="`${system.name} star system map`"
      @wheel.capture="captureOrbitRotationWheel"
      @dragover.prevent
      @drop.prevent="handleObjectDrop"
    />
  </div>
</template>

<style>
.map-view {
  position: relative;
}

.system-map-svg {
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

.map-background {
  fill: var(--map-bg);
  pointer-events: none;
}

.map-grid {
  fill: url(#system-map-grid);
  pointer-events: none;
}

.map-grid-line {
  fill: none;
  stroke: var(--map-grid-line);
  stroke-width: 1;
}

.orbit-ring {
  fill: none;
  stroke: var(--map-orbit);
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
  stroke: var(--map-selected);
  stroke-width: 2.4;
}

.orbit-axis-handle {
  fill: var(--map-bg);
  stroke: var(--map-selected);
  stroke-width: 2;
  opacity: 0;
  pointer-events: none;
  transition: opacity 120ms ease-out;
}

.orbit-center-handle {
  fill: var(--map-bg);
  stroke: var(--map-selected);
  stroke-width: 2;
  cursor: move;
  opacity: 0;
  pointer-events: none;
  transition: opacity 120ms ease-out;
}

.orbit-center-handle.is-moving {
  cursor: grabbing;
}

.orbit-rotation-stem {
  stroke: var(--map-selected);
  stroke-width: 1.5;
  opacity: 0;
  pointer-events: none;
  transition: opacity 120ms ease-out;
}

.orbit-rotation-handle {
  fill: var(--map-selected);
  stroke: var(--map-bg);
  stroke-width: 2;
  cursor: grab;
  opacity: 0;
  pointer-events: none;
  transition: opacity 120ms ease-out;
}

.orbit-rotation-handle.is-rotating {
  cursor: grabbing;
}

.orbit-mark.is-selected .orbit-axis-handle,
.orbit-mark:has(.orbit-hit-target:hover, .orbit-axis-handle:hover, .orbit-hit-target:focus) .orbit-axis-handle {
  opacity: 1;
  pointer-events: all;
}

.orbit-mark.is-selected .orbit-center-handle,
.orbit-mark:has(.orbit-hit-target:hover, .orbit-center-handle:hover, .orbit-hit-target:focus) .orbit-center-handle {
  opacity: 1;
  pointer-events: all;
}

.orbit-mark.is-selected .orbit-rotation-stem,
.orbit-mark.is-selected .orbit-rotation-handle,
.orbit-mark:has(.orbit-hit-target:hover, .orbit-rotation-handle:hover, .orbit-hit-target:focus) .orbit-rotation-stem,
.orbit-mark:has(.orbit-hit-target:hover, .orbit-rotation-handle:hover, .orbit-hit-target:focus) .orbit-rotation-handle {
  opacity: 1;
  pointer-events: all;
}

.orbit-hit-target:focus,
.system-object:focus {
  outline: none;
}

.system-object {
  cursor: pointer;
  pointer-events: none;
}

.system-object.is-dragging {
  cursor: grabbing;
}

.orbit-rotation-handle:focus-visible {
  stroke: var(--focus);
  stroke-width: 3;
}

.orbit-center-handle:focus-visible {
  stroke: var(--focus);
  stroke-width: 3;
}

.object-hit-target {
  fill: transparent;
  pointer-events: all;
}

.object-glyph-halo {
  fill: none;
  stroke: var(--map-star-halo);
  stroke-width: 1.2;
}

.system-object-glyph {
  fill: var(--map-text);
  font: 20px Consolas, monospace;
  pointer-events: none;
}

.system-object:hover .system-object-glyph,
.system-object:focus .system-object-glyph,
.system-object.is-selected .system-object-glyph {
  fill: var(--map-selected);
}

.object-key {
  fill: var(--map-unresolved);
  font: 9px Consolas, monospace;
  text-anchor: middle;
  pointer-events: none;
}

.object-name {
  fill: var(--map-text);
  font: 12px Georgia, serif;
  text-anchor: middle;
  pointer-events: none;
}

.object-type-mark {
  fill: var(--map-text);
  font: 10px Consolas, monospace;
  pointer-events: none;
}

.map-empty {
  fill: var(--map-muted);
  font: 16px Georgia, serif;
}
</style>
