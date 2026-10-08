/**
 * D3 owns the system SVG scene and gestures; Vue receives selection and completed-edit actions through handlers.
 */
import { drag, pointer, select, zoom, zoomTransform, type ZoomBehavior } from 'd3'
import {
  canPlaceObjectInOrbit,
  catalogueTypes,
  minimumOrbitRadius,
  normalizeOrbitRotation,
  type CatalogueSubtype,
  type Orbit,
  type OrbitRadii,
  type Point,
  type StarSystem,
  type SystemObject,
} from '../../domain/workspace'
import { objectMark } from '../../utils/catalogue-marks'
import { MAP_ZOOM_MAX_SCALE, MAP_ZOOM_MIN_SCALE } from '../../utils/map-zoom'
import {
  orbitAngleAtPoint,
  orbitAtPoint,
  orbitAxisCursor,
  orbitCenter,
  objectPositions,
  orbitPointAtAngle,
  orbitRadii,
  orbitRotation,
  orbitRotationHandlePoint,
  requiredPosition,
  rotatePoint,
  toNormalizedMapPoint,
  type SystemMapGeometry,
} from '../../utils/system-map-geometry'

const mapSurfacePadding = 160

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

export interface SystemMapEventHandlers {
  /** Select an existing system object. */
  selectObject(id: string): void
  /** Select an existing Orbit. */
  selectOrbit(id: string): void
  /** Commit a system-level object position in normalized initial-scene coordinates. */
  moveObject(id: string, position: Point): void
  /** Commit an unoccupied Orbit center in normalized coordinates, optionally attaching it to a host object. */
  moveOrbitCenter(id: string, center: Point, hostId: string | null): void
  /** Commit an object's Orbit parameter angle in radians. */
  rotateObject(id: string, angle: number): void
  /** Commit horizontal and vertical Orbit radii in SVG scene units. */
  resizeOrbit(id: string, radii: OrbitRadii): void
  /** Commit an Orbit ellipse rotation in degrees. */
  rotateOrbit(id: string, rotation: number): void
  /** Commit object placement into an Orbit using a parameter angle in radians. */
  placeObjectInOrbit(id: string, orbitId: string, angle: number): void
  /** Handle Orbit drops at an SVG scene point, with an optional object host. */
  dropOrbit(point: Point, hostId: string | null): void
  /** Handle catalogue-object drops in scene coordinates; angle is radians or null outside an Orbit. */
  dropObject(
    subtype: CatalogueSubtype,
    point: Point,
    orbitId: string | null,
    angle: number | null,
  ): void
}

export interface SystemMapRendererOptions {
  /** SVG element whose children are owned and rebuilt by D3. */
  element: SVGSVGElement
  /** Current domain entities and their saved Orbit/angle geometry. */
  system: StarSystem
  geometry: SystemMapGeometry
  /** Selected identities used for rendering and keyboard focus restoration. */
  selectedObjectId: string | null
  selectedOrbitId: string | null
  /** Event identities already captured for Orbit rotation so D3 zoom can ignore them. */
  orbitRotationWheelEvents: WeakSet<Event>
  /** Callbacks for selection and completed edits; gesture previews remain local to the renderer. */
  handlers: SystemMapEventHandlers
  /** Receives the current percentage zoom for Vue's accessible controls. */
  setZoomLevel(zoomLevel: number): void
}

/** Live D3 capabilities exposed to the Vue wrapper. */
export interface SystemMapRenderer {
  zoomBehavior: ZoomBehavior<SVGSVGElement, unknown>
  /** Captures Ctrl+wheel rotation before the same event reaches D3's zoom behavior. */
  captureOrbitRotationWheel(event: WheelEvent): void
  /** Resolves a supported palette drag into a scene-coordinate map-add intent. */
  handleObjectDrop(event: DragEvent): void
}

function orbitLabel(system: StarSystem, orbit: Orbit): string {
  if (orbit.hostId === null) return `Orbit ${orbit.order} around unoccupied center`
  const host = system.objects.find(object => object.id === orbit.hostId)
  if (!host) {
    throw new Error(`Orbit "${orbit.id}" has no host object.`)
  }
  return `Orbit ${orbit.order} around ${host.name}`
}

/**
 * Rebuilds the SVG scene and installs local pan/zoom, selection, drop, and Orbit/object gestures.
 * Re-rendering preserves the user's temporary zoom transform and focused Orbit control; drag previews stay local
 * and only completed geometry is sent through handlers. Scene bounds expand to include content outside the viewBox.
 * @param options SVG host, current system/layout/selection, and event callbacks.
 * @returns D3 zoom behavior and Vue-facing wheel/drop adapters.
 * @throws If nested system geometry has missing references or an invalid host/cycle.
 */
export function renderSystemMap({
  element,
  system,
  geometry,
  selectedObjectId,
  selectedOrbitId,
  orbitRotationWheelEvents,
  handlers,
  setZoomLevel,
}: SystemMapRendererOptions): SystemMapRenderer {
  let rotateOrbitFromWheel: (event: WheelEvent) => boolean = () => false

  /**
   * Prevents selected-Orbit Ctrl+wheel rotation from also becoming a D3 map-zoom gesture.
   * @param event Native wheel event captured by Vue on the SVG.
   */
  function captureOrbitRotationWheel(event: WheelEvent): void {
    if (!rotateOrbitFromWheel(event)) return
    event.preventDefault()
    orbitRotationWheelEvents.add(event)
  }

  /**
   * Resolves palette Orbit/object MIME payloads to scene-coordinate intents without persisting them.
   * Object drops resolve the Orbit under the pointer and its parameter angle in radians when applicable.
   * @param event Native drop event on the map.
   * @throws If current nested system geometry cannot be resolved.
   */
  function handleObjectDrop(event: DragEvent): void {
    const orbitDrag = event.dataTransfer?.getData('application/x-mothership-map-orbit')
    if (orbitDrag) {
      const content = element.querySelector<SVGGElement>('.system-map-content')
      if (!content) return

      const [x, y] = pointer(event, content)
      const hostId = event.target instanceof Element
        ? event.target.closest('.system-object')?.getAttribute('data-object-id') ?? null
        : null
      handlers.dropOrbit({ x, y }, hostId)
      return
    }

    const subtype = event.dataTransfer?.getData('application/x-mothership-map-object')
    const catalogueType = catalogueTypes.find(type => type.value === subtype)
    const content = element.querySelector<SVGGElement>('.system-map-content')
    if (!catalogueType || !content) return

    const [x, y] = pointer(event, content)
    const point = { x, y }
    const positions = objectPositions(system, geometry)
    const targetOrbitId = event.target instanceof Element
      ? event.target.closest('.orbit-hit-target')?.getAttribute('data-orbit-id')
      : null
    const orbit = system.orbits.find(candidate => candidate.id === targetOrbitId)
      ?? orbitAtPoint(system, point, positions, geometry)
    const center = orbit ? orbitCenter(orbit, positions) : undefined
    handlers.dropObject(
      catalogueType.value,
      point,
      orbit?.id ?? null,
      orbit && center
        ? orbitAngleAtPoint(
            point,
            center,
            orbitRadii(system, orbit, geometry),
            orbitRotation(orbit, geometry),
          )
        : null,
    )
  }

  const livePositions = new Map<string, Point>()
  const liveOrbitCenters = new Map<string, Point>()
  const liveOrbitRadii = new Map<string, OrbitRadii>()
  const liveOrbitRotations = new Map<string, number>()
  const currentPositions = () => objectPositions(system, geometry, {
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
    .attr('class', orbit => `orbit-mark${selectedOrbitId === orbit.id ? ' is-selected' : ''}`)
    .attr('data-orbit-id', orbit => orbit.id)
    .attr('role', 'group')
    .attr('aria-label', orbit => orbitLabel(system, orbit))

  orbitMarks.each(function (orbit) {
    const mark = select(this)
    const center = orbitCenter(orbit, positions, liveOrbitCenters)
    const radii = orbitRadii(system, orbit, geometry)
    const rotation = orbitRotation(orbit, geometry, liveOrbitRotations)
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
        .attr('tabindex', selectedOrbitId === orbit.id ? 0 : -1)
        .attr('aria-hidden', selectedOrbitId === orbit.id ? 'false' : 'true')
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
      .attr('tabindex', selectedOrbitId === orbit.id ? 0 : -1)
      .attr('aria-hidden', selectedOrbitId === orbit.id ? 'false' : 'true')
      .attr('aria-label', `Rotate ${orbitLabel(system, orbit)}`)
      .attr('aria-valuemin', 0)
      .attr('aria-valuemax', 359)
      .attr('aria-valuenow', Math.round(rotation))
      .attr('aria-valuetext', `${Math.round(rotation)} degrees`)
      .append('title')
      .text('Drag to rotate; Ctrl+wheel over the Orbit to fine-tune')
  })
  orbitMarks.filter(orbit => orbit.id === selectedOrbitId).raise()
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
      handlers.selectOrbit(orbit.id)
    })
    .on('keydown', (event, orbit) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        handlers.selectOrbit(orbit.id)
        return
      }

      const current = orbitRadii(system, orbit, geometry, liveOrbitRadii)
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
      handlers.resizeOrbit(orbit.id, { horizontal, vertical })
    })
  orbitAxisHandles.on('click', (event, orbit) => {
    event.stopPropagation()
    handlers.selectOrbit(orbit.id)
  })
  orbitCenterHandles
    .on('click', (event, orbit) => {
      event.stopPropagation()
      const handle = event.currentTarget as SVGCircleElement
      if (movedOrbitCenters.has(handle)) {
        movedOrbitCenters.delete(handle)
        return
      }
      handlers.selectOrbit(orbit.id)
    })
    .on('keydown', (event, orbit) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        handlers.selectOrbit(orbit.id)
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
      handlers.moveOrbitCenter(orbit.id, toNormalizedMapPoint(nextCenter), null)
    })
  orbitRotationHandles
    .on('click', (event, orbit) => {
      event.stopPropagation()
      handlers.selectOrbit(orbit.id)
    })
    .on('keydown', (event, orbit) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      event.preventDefault()
      const step = event.shiftKey ? 10 : 1
      const direction = event.key === 'ArrowRight' ? 1 : -1
      const rotation = normalizeOrbitRotation(
        orbitRotation(orbit, geometry, liveOrbitRotations) + step * direction,
      )
      liveOrbitRotations.set(orbit.id, rotation)
      updateLiveGeometry()
      handlers.rotateOrbit(orbit.id, rotation)
    })

  const items = content.append('g').attr('class', 'system-map-items')
  const objectMarks = items.selectAll<SVGGElement, SystemObject>('g.system-object')
    .data(system.objects)
    .join('g')
    .attr('class', object => `system-object${selectedObjectId === object.id ? ' is-selected' : ''}`)
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

  /**
   * Expands the background and grid around both object and Orbit bounds beyond the initial SVG viewBox.
   */
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

  /** Applies temporary drag overrides to rendered objects, Orbit handles, accessibility values, and scene bounds. */
  function updateLiveGeometry(): void {
    const positions = currentPositions()
    objectMarks.attr('transform', object => {
      const point = requiredPosition(positions, object.id)
      return `translate(${point.x} ${point.y})`
    })
    orbitMarks.each(function (orbit) {
      const center = orbitCenter(orbit, positions, liveOrbitCenters)
      const radii = orbitRadii(system, orbit, geometry, liveOrbitRadii)
      const rotation = orbitRotation(orbit, geometry, liveOrbitRotations)
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
      .attr('aria-valuenow', orbit => Math.round(orbitRadii(system, orbit, geometry, liveOrbitRadii).horizontal))
      .attr('aria-valuemax', orbit => orbitRadii(system, orbit, geometry, liveOrbitRadii).horizontal + 400)
      .attr('aria-valuetext', orbit => {
        const radii = orbitRadii(system, orbit, geometry, liveOrbitRadii)
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
      handlers.selectObject(object.id)
    })
    .on('keydown', (event, object) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        handlers.selectObject(object.id)
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
          geometry,
          object.id,
          liveOrbitRadii,
          liveOrbitRotations,
          liveOrbitCenters,
        )
        if (targetOrbit) {
          const center = orbitCenter(targetOrbit, positions, liveOrbitCenters)
          handlers.placeObjectInOrbit(object.id, targetOrbit.id, orbitAngleAtPoint(
            point,
            center,
            orbitRadii(system, targetOrbit, geometry, liveOrbitRadii),
            orbitRotation(targetOrbit, geometry, liveOrbitRotations),
          ))
        } else {
          const center = orbitCenter(orbit, positions, liveOrbitCenters)
          handlers.rotateObject(object.id, orbitAngleAtPoint(
            point,
            center,
            orbitRadii(system, orbit, geometry, liveOrbitRadii),
            orbitRotation(orbit, geometry, liveOrbitRotations),
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
        geometry,
        object.id,
        liveOrbitRadii,
        liveOrbitRotations,
        liveOrbitCenters,
      )
      if (targetOrbit) {
        const center = orbitCenter(targetOrbit, positions, liveOrbitCenters)
        handlers.placeObjectInOrbit(object.id, targetOrbit.id, orbitAngleAtPoint(
          point,
          center,
          orbitRadii(system, targetOrbit, geometry, liveOrbitRadii),
          orbitRotation(targetOrbit, geometry, liveOrbitRotations),
        ))
      } else {
        handlers.moveObject(object.id, {
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

  /**
   * Applies a fine degree-based rotation only when Ctrl+wheel targets the selected Orbit.
   * @param event Wheel event captured before D3 zoom.
   * @returns True when this handler consumed the event as an Orbit rotation.
   */
  rotateOrbitFromWheel = (event) => {
    if (!event.ctrlKey || !event.deltaY || !selectedOrbitId) return false
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
      geometry,
      undefined,
      liveOrbitRadii,
      liveOrbitRotations,
      liveOrbitCenters,
    )
    if (orbit?.id !== selectedOrbitId) return false

    const rotation = normalizeOrbitRotation(
      orbitRotation(orbit, geometry, liveOrbitRotations) + event.deltaY * 0.05,
    )
    liveOrbitRotations.set(orbit.id, rotation)
    updateLiveGeometry()
    handlers.rotateOrbit(orbit.id, rotation)
    return true
  }

  const resizedOrbits = new WeakSet<SVGElement>()
  const orbitResizeGestures = new WeakMap<SVGElement, OrbitResizeGesture>()
  /**
   * Converts a scene-space resize pointer into minimum-clamped radii.
   * Global gestures scale both axes together; axis handles measure in the rotated ellipse's local frame.
   * @param point Current pointer in SVG scene coordinates.
   * @param orbit Orbit being resized.
   * @param gesture Captured start radii, center, distance, and handle axis.
   * @returns Proposed horizontal/vertical radii in SVG scene units.
   */
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

    const current = orbitRadii(system, orbit, geometry, liveOrbitRadii)
    const localPoint = rotatePoint(
      point,
      center,
      -orbitRotation(orbit, geometry, liveOrbitRotations),
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
          startRadii: orbitRadii(system, orbit, geometry, liveOrbitRadii),
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
        handlers.resizeOrbit(orbit.id, radii)
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
        handlers.moveOrbitCenter(orbit.id, toNormalizedMapPoint(center), hostId)
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
          rotation: orbitRotation(orbit, geometry, liveOrbitRotations),
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
        handlers.rotateOrbit(orbit.id, gesture.rotation)
      }),
  )

  const zoomBehavior = zoom<SVGSVGElement, unknown>()
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
      setZoomLevel(Math.round(event.transform.k * 100))
    })
  svg.call(zoomBehavior)
  content.attr('transform', currentTransform.toString())
  setZoomLevel(Math.round(currentTransform.k * 100))
  if (focusedOrbitCenterId) {
    orbitCenterHandles.filter(orbit => orbit.id === focusedOrbitCenterId).node()?.focus()
  } else if (focusedOrbitId) {
    orbitSelectors.filter(orbit => orbit.id === focusedOrbitId).node()?.focus()
  }

  return { zoomBehavior, captureOrbitRotationWheel, handleObjectDrop }
}
