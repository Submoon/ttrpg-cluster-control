/**
 * D3 owns the system SVG scene and gestures; Vue receives selection and completed-edit actions through handlers.
 */
import { drag, pointer, select, zoom, zoomTransform, type ZoomBehavior } from 'd3'
import { captureD3MouseGesture, type D3MouseGestureDisposer } from './d3-mouse-gesture'
import {
  catalogueTypes,
  minimumOrbitRadius,
  normalizeOrbitRotation,
  type Orbit,
  type OrbitRadii,
  type Point,
  type StarSystem,
  type SystemObject,
} from '../../domain/workspace'
import type {
  EntityCommand,
  OrbitCenterMoveCandidate,
  OrbitPlacementPreview,
  SystemObjectMoveCandidate,
} from '../../composables/editor-workflows/types'
import type {
  SystemCreationCandidate,
  SystemCreationPreview,
  SystemCreationType,
} from '../../composables/editor-workflows/types'
import { catalogueMarks, objectMark } from '../../utils/catalogue-marks'
import { catalogueObjectLabel } from '../../utils/catalogue-labels'
import {
  getSvgViewportRect,
  MAP_ZOOM_MAX_SCALE,
  MAP_ZOOM_MIN_SCALE,
  svgViewportExtent,
  type MapViewport,
} from '../../utils/map-zoom'
import {
  orbitAtPoint,
  orbitAxisCursor,
  orbitCenter,
  objectPositions,
  orbitPointAtAngle,
  orbitPlacementHitsAtPoint,
  orbitRadii,
  orbitRotation,
  orbitRotationHandlePoint,
  requiredPosition,
  rotatePoint,
  creationCandidatesAtPoint,
  objectsMovedWithOrbit,
  toNormalizedMapPoint,
  type SystemMapGeometry,
} from '../../utils/system-map-geometry'

const mapSurfacePadding = 160
const objectHitRadius = 28

function dragClientPoint(sourceEvent: Event): Point | null {
  if (sourceEvent instanceof MouseEvent) {
    return { x: sourceEvent.clientX, y: sourceEvent.clientY }
  }
  if (sourceEvent instanceof TouchEvent) {
    const touch = sourceEvent.changedTouches[0] ?? sourceEvent.touches[0]
    return touch ? { x: touch.clientX, y: touch.clientY } : null
  }
  return null
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

export interface SystemMapEventHandlers {
  /** Select an existing system object. */
  selectObject(id: string): void
  /** Checks whether a pending entity command touches an active inspector draft. */
  isEntityCommandBlocked(command: EntityCommand): boolean
  /** Reports a blocked pending entity command before the map preview changes. */
  entityCommandBlocked(command: EntityCommand): void
  /** Cancels a parent-owned object placement preview before direct map manipulation begins. */
  cancelObjectPlacementPreview(): void
  /** Cancels a parent-owned Orbit geometry preview before direct map manipulation begins. */
  cancelOrbitPlacementPreview(): void
  /** Checks whether the inspector currently owns a draft for this object. */
  isObjectMoveBlocked(id: string): boolean
  /** Reports a blocked drag after the pointer has crossed D3's client-pixel click threshold. */
  objectMoveBlocked(id: string): void
  /** Offers every raw Orbit hit for an ambiguous or cycle-invalid existing-object drop. */
  objectMoveCandidates(id: string, candidates: SystemObjectMoveCandidate[]): void
  /** Offers named host or free-center choices when moving an unoccupied Orbit is ambiguous or blocked. */
  orbitCenterCandidates(id: string, candidates: OrbitCenterMoveCandidate[]): void
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
  /** Offers the named map targets for a user click while Add is armed. */
  creationTarget(candidates: SystemCreationCandidate[]): void
  /** Supplies a raw SVG scene point selected for a parent-owned object move preview. */
  moveTarget(point: Point): void
  /** Resolves a native palette release through the same creation candidate path as an armed Add click. */
  creationDropTarget(type: SystemCreationType, candidates: SystemCreationCandidate[]): void
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
  /** Persistent map Add type and its transient placement preview. */
  creationType: SystemCreationType | null
  creationPreview: SystemCreationPreview | null
  creationChooserOpen: boolean
  /** A parent-owned object move is armed; its map clicks must take priority over Add/selection. */
  moveTargeting: boolean
  /** Parent-owned object position previews retained across renderer rebuilds by the wrapper. */
  objectPlacementPreviews: ReadonlyMap<string, Point>
  /** Parent-owned Orbit center and radii previews retained across renderer rebuilds by the wrapper. */
  orbitPlacementPreviews: ReadonlyMap<string, OrbitPlacementPreview>
  /** Parent-owned Orbit center target overlays retained independently from Inspector geometry previews. */
  orbitCenterMovePreviews: ReadonlyMap<string, Point>
  /** Enables object and Orbit drag editing; Navigation keeps marks available for selection and zoom. */
  moveEnabled: boolean
  /** Event identities already captured for Orbit rotation so D3 zoom can ignore them. */
  orbitRotationWheelEvents: WeakSet<Event>
  /** Callbacks for selection and completed edits; gesture previews remain local to the renderer. */
  handlers: SystemMapEventHandlers
  /** Receives the current percentage zoom for Vue's accessible controls. */
  setZoomLevel(zoomLevel: number): void
  /** Publishes every D3 viewport change, including changes applied by the Vue wrapper. */
  onViewportChange(viewport: MapViewport): void
}

/** Live D3 capabilities exposed to the Vue wrapper. */
export interface SystemMapRenderer {
  zoomBehavior: ZoomBehavior<SVGSVGElement, unknown>
  /** Projects the saved object and Orbit geometry onto an isolated export copy. */
  prepareExportClone(clone: SVGSVGElement): void
  /** Cancels and rolls back active local previews without publishing geometry. */
  cancelActiveGesture(): void
  /** Updates a parent-owned preview without publishing it to workspace state. */
  setObjectPlacementPreview(objectId: string, scenePoint: Point | null): void
  /** Updates a parent-owned proposed-host Orbit preview without publishing workspace geometry. */
  setOrbitPlacementPreview(orbitId: string, preview: OrbitPlacementPreview | null): void
  /** Updates a parent-owned Orbit center overlay without replacing committed radii or rotation. */
  setOrbitCenterMovePreview(orbitId: string, scenePoint: Point | null): void
  /** Captures Ctrl+wheel rotation before the same event reaches D3's zoom behavior. */
  captureOrbitRotationWheel(event: WheelEvent): void
  /** Resolves a supported palette drag into a scene-coordinate map-add intent. */
  handleObjectDrop(event: DragEvent): void
  /** Consumes a map click in Add and offers its candidates in raw scene coordinates. */
  handleCreationClick(event: MouseEvent): void
  /** Consumes Enter/Space in Add and offers candidates at the visible map center. */
  handleCreationKeydown(event: KeyboardEvent): void
  /** Consumes a map click while a parent-owned object move is armed. */
  handleMoveTargetClick(event: MouseEvent): void
  /** Resolves candidates from an unclamped SVG scene point using the same calculation as map clicks. */
  getCreationCandidates(point: Point, type: SystemCreationType): SystemCreationCandidate[]
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
  creationType,
  creationPreview,
  creationChooserOpen,
  moveTargeting,
  objectPlacementPreviews,
  orbitPlacementPreviews,
  orbitCenterMovePreviews,
  moveEnabled,
  orbitRotationWheelEvents,
  handlers,
  setZoomLevel,
  onViewportChange,
}: SystemMapRendererOptions): SystemMapRenderer {
  let rotateOrbitFromWheel: (event: WheelEvent) => boolean = () => false

  function blockEntityCommand(command: EntityCommand): boolean {
    if (!handlers.isEntityCommandBlocked(command)) return false
    handlers.entityCommandBlocked(command)
    return true
  }

  /**
   * Prevents selected-Orbit Ctrl+wheel rotation from also becoming a D3 map-zoom gesture.
   * @param event Native wheel event captured by Vue on the SVG.
   */
  function captureOrbitRotationWheel(event: WheelEvent): void {
    if (!moveEnabled || !rotateOrbitFromWheel(event)) return
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
    const orbitDrag = event.dataTransfer?.getData('application/x-ttrpg-cluster-control-map-orbit')
    if (orbitDrag) {
      const content = element.querySelector<SVGGElement>('.system-map-content')
      if (!content) return

      const [x, y] = pointer(event, content)
      const type: SystemCreationType = { kind: 'orbit' }
      handlers.creationDropTarget(type, creationCandidatesAtPoint(system, { x, y }, type, geometry))
      return
    }

    const subtype = event.dataTransfer?.getData('application/x-ttrpg-cluster-control-map-object')
    const catalogueType = catalogueTypes.find(type => type.value === subtype)
    const content = element.querySelector<SVGGElement>('.system-map-content')
    if (!catalogueType || !content) return

    const [x, y] = pointer(event, content)
    const type: SystemCreationType = { kind: 'object', subtype: catalogueType.value }
    handlers.creationDropTarget(type, creationCandidatesAtPoint(system, { x, y }, type, geometry))
  }

  const livePositions = new Map<string, Point>()
  const effectivePositions = new Map(objectPlacementPreviews)
  const previewOrbitCenters = new Map<string, Point>()
  const previewOrbitRadii = new Map<string, OrbitRadii>()
  const previewOrbitRotations = new Map<string, number>()
  const centerMovePreviewCenters = new Map(orbitCenterMovePreviews)
  for (const [orbitId, preview] of orbitPlacementPreviews) {
    previewOrbitCenters.set(orbitId, { ...preview.center })
    previewOrbitRadii.set(orbitId, { ...preview.radii })
    if (preview.rotation !== undefined) previewOrbitRotations.set(orbitId, preview.rotation)
  }
  const liveOrbitCenters = new Map<string, Point>()
  const liveOrbitRadii = new Map<string, OrbitRadii>()
  const liveOrbitRotations = new Map<string, number>()
  const effectiveOrbitCenters = new Map(previewOrbitCenters)
  for (const [orbitId, center] of centerMovePreviewCenters) effectiveOrbitCenters.set(orbitId, { ...center })
  const effectiveOrbitRadii = new Map(previewOrbitRadii)
  const effectiveOrbitRotations = new Map(previewOrbitRotations)
  const activeGestures = new Map<Element, () => void>()
  const activeGestureDisposers = new Map<Element, D3MouseGestureDisposer>()
  const cancelledGestures = new WeakSet<Element>()
  const draftBlockedObjectGestures = new WeakSet<SVGGElement>()
  const draftBlockFeedbackShown = new WeakSet<SVGGElement>()
  const blockedObjectCommands = new WeakMap<SVGGElement, EntityCommand>()
  const objectDragStartClient = new WeakMap<SVGGElement, Point>()
  const objectDragOriginalPositions = new WeakMap<SVGGElement, Point>()
  function setLiveOrbitCenter(orbitId: string, center: Point): void {
    liveOrbitCenters.set(orbitId, center)
    effectiveOrbitCenters.set(orbitId, center)
  }
  function clearLiveOrbitCenter(orbitId: string): void {
    liveOrbitCenters.delete(orbitId)
    const previewCenter = centerMovePreviewCenters.get(orbitId) ?? previewOrbitCenters.get(orbitId)
    if (previewCenter) effectiveOrbitCenters.set(orbitId, previewCenter)
    else effectiveOrbitCenters.delete(orbitId)
  }
  function setLiveOrbitRadii(orbitId: string, radii: OrbitRadii): void {
    liveOrbitRadii.set(orbitId, radii)
    effectiveOrbitRadii.set(orbitId, radii)
  }
  function clearLiveOrbitRadii(orbitId: string): void {
    liveOrbitRadii.delete(orbitId)
    const previewRadii = previewOrbitRadii.get(orbitId)
    if (previewRadii) effectiveOrbitRadii.set(orbitId, previewRadii)
    else effectiveOrbitRadii.delete(orbitId)
  }
  function setLiveOrbitRotation(orbitId: string, rotation: number): void {
    liveOrbitRotations.set(orbitId, rotation)
    effectiveOrbitRotations.set(orbitId, rotation)
  }
  function clearLiveOrbitRotation(orbitId: string): void {
    liveOrbitRotations.delete(orbitId)
    const previewRotation = previewOrbitRotations.get(orbitId)
    if (previewRotation !== undefined) effectiveOrbitRotations.set(orbitId, previewRotation)
    else effectiveOrbitRotations.delete(orbitId)
  }
  function beginGesture(
    element: Element,
    rollback: () => void,
    cancelPlacementPreview = true,
    sourceEvent?: Event,
  ): void {
    // D3 installs the new window listeners before this callback; claim ownership first so an old
    // gesture's cancellation cannot send its mouseup into the newly installed transport.
    const mouseGesture = sourceEvent
      ? captureD3MouseGesture(sourceEvent)
      : { cancel: () => undefined, complete: () => undefined }
    if (activeGestures.size) cancelActiveGesture()
    if (cancelPlacementPreview) {
      handlers.cancelObjectPlacementPreview()
      handlers.cancelOrbitPlacementPreview()
    }
    cancelledGestures.delete(element)
    activeGestures.set(element, rollback)
    activeGestureDisposers.set(element, mouseGesture)
  }
  function finishGesture(element: Element): boolean {
    activeGestureDisposers.get(element)?.complete()
    activeGestures.delete(element)
    activeGestureDisposers.delete(element)
    const cancelled = cancelledGestures.has(element)
    if (cancelled) cancelledGestures.delete(element)
    return cancelled
  }
  function cancelActiveGesture(): void {
    for (const [element, rollback] of activeGestures) {
      cancelledGestures.add(element)
      rollback()
      activeGestureDisposers.get(element)?.cancel()
    }
    activeGestures.clear()
    activeGestureDisposers.clear()
    updateLiveGeometry()
  }
  function cancelGesture(element: Element): void {
    const rollback = activeGestures.get(element)
    if (!rollback) return
    cancelledGestures.add(element)
    activeGestures.delete(element)
    rollback()
    // This dispatches D3's end callback synchronously; callers must snapshot needed drag data first.
    activeGestureDisposers.get(element)?.cancel()
    activeGestureDisposers.delete(element)
    updateLiveGeometry()
  }
  function setLivePosition(objectId: string, scenePoint: Point): void {
    livePositions.set(objectId, scenePoint)
    effectivePositions.set(objectId, scenePoint)
  }
  function clearLivePosition(objectId: string): void {
    livePositions.delete(objectId)
    const placementPreview = objectPlacementPreviews.get(objectId)
    if (placementPreview) effectivePositions.set(objectId, placementPreview)
    else effectivePositions.delete(objectId)
  }
  function setObjectPlacementPreview(objectId: string, scenePoint: Point | null): void {
    if (scenePoint) effectivePositions.set(objectId, scenePoint)
    else {
      const livePosition = livePositions.get(objectId)
      if (livePosition) effectivePositions.set(objectId, livePosition)
      else effectivePositions.delete(objectId)
    }
    updateLiveGeometry()
  }
  function setOrbitPlacementPreview(orbitId: string, preview: OrbitPlacementPreview | null): void {
    if (preview) {
      const center = { ...preview.center }
      const radii = { ...preview.radii }
      previewOrbitCenters.set(orbitId, center)
      previewOrbitRadii.set(orbitId, radii)
      if (preview.rotation !== undefined) previewOrbitRotations.set(orbitId, preview.rotation)
      else previewOrbitRotations.delete(orbitId)
      if (!liveOrbitCenters.has(orbitId)) {
        effectiveOrbitCenters.set(orbitId, centerMovePreviewCenters.get(orbitId) ?? center)
      }
      if (!liveOrbitRadii.has(orbitId)) effectiveOrbitRadii.set(orbitId, radii)
      if (!liveOrbitRotations.has(orbitId)) {
        if (preview.rotation !== undefined) effectiveOrbitRotations.set(orbitId, preview.rotation)
        else effectiveOrbitRotations.delete(orbitId)
      }
    } else {
      previewOrbitCenters.delete(orbitId)
      previewOrbitRadii.delete(orbitId)
      previewOrbitRotations.delete(orbitId)
      if (!liveOrbitCenters.has(orbitId)) {
        const centerMovePreview = centerMovePreviewCenters.get(orbitId)
        if (centerMovePreview) effectiveOrbitCenters.set(orbitId, centerMovePreview)
        else effectiveOrbitCenters.delete(orbitId)
      }
      if (!liveOrbitRadii.has(orbitId)) effectiveOrbitRadii.delete(orbitId)
      if (!liveOrbitRotations.has(orbitId)) effectiveOrbitRotations.delete(orbitId)
    }
    updateLiveGeometry()
  }
  function setOrbitCenterMovePreview(orbitId: string, scenePoint: Point | null): void {
    if (scenePoint) {
      const center = { ...scenePoint }
      centerMovePreviewCenters.set(orbitId, center)
      if (!liveOrbitCenters.has(orbitId)) effectiveOrbitCenters.set(orbitId, center)
    } else {
      centerMovePreviewCenters.delete(orbitId)
      if (!liveOrbitCenters.has(orbitId)) {
        const placementPreview = previewOrbitCenters.get(orbitId)
        if (placementPreview) effectiveOrbitCenters.set(orbitId, placementPreview)
        else effectiveOrbitCenters.delete(orbitId)
      }
    }
    updateLiveGeometry()
  }
  const currentPositions = () => objectPositions(system, geometry, {
    positions: effectivePositions,
    orbitCenters: effectiveOrbitCenters,
    orbitRadii: effectiveOrbitRadii,
    orbitRotations: effectiveOrbitRotations,
  })
  const appliedPositions = () => objectPositions(system, geometry)
  function prepareExportClone(clone: SVGSVGElement): void {
    const positions = appliedPositions()
    clone.querySelectorAll<SVGGElement>('.system-object[data-object-id]').forEach(mark => {
      const objectId = mark.getAttribute('data-object-id')
      if (!objectId) return
      const point = requiredPosition(positions, objectId)
      mark.setAttribute('transform', `translate(${point.x} ${point.y})`)
    })

    clone.querySelectorAll<SVGGElement>('.orbit-mark[data-orbit-id]').forEach(mark => {
      const orbitId = mark.getAttribute('data-orbit-id')
      const orbit = system.orbits.find(candidate => candidate.id === orbitId)
      const ring = mark.querySelector<SVGEllipseElement>('.orbit-ring')
      if (!orbit || !ring) return
      const center = orbitCenter(orbit, positions)
      const radii = orbitRadii(system, orbit, geometry)
      const rotation = orbitRotation(orbit, geometry)
      ring.setAttribute('cx', String(center.x))
      ring.setAttribute('cy', String(center.y))
      ring.setAttribute('rx', String(radii.horizontal))
      ring.setAttribute('ry', String(radii.vertical))
      ring.setAttribute('transform', `rotate(${rotation} ${center.x} ${center.y})`)
    })
  }
  const objectPlacementCarriedOrbitIds = new Map<string, Set<string>>()
  function carriedOrbitIdsForObject(objectId: string): Set<string> {
    const cached = objectPlacementCarriedOrbitIds.get(objectId)
    if (cached) return cached

    const carriedObjectIds = new Set([objectId])
    for (const orbit of system.orbits) {
      if (orbit.hostId !== objectId) continue
      for (const carriedObjectId of objectsMovedWithOrbit(system, orbit.id)) {
        carriedObjectIds.add(carriedObjectId)
      }
    }
    const carriedOrbitIds = new Set(system.orbits
      .filter(orbit => orbit.hostId !== null && carriedObjectIds.has(orbit.hostId))
      .map(orbit => orbit.id))
    objectPlacementCarriedOrbitIds.set(objectId, carriedOrbitIds)
    return carriedOrbitIds
  }
  function objectPlacementHits(objectId: string, point: Point) {
    return orbitPlacementHitsAtPoint(
      system,
      point,
      appliedPositions(),
      geometry,
      objectId,
      effectiveOrbitRadii,
      effectiveOrbitRotations,
      effectiveOrbitCenters,
    ).filter(hit => !carriedOrbitIdsForObject(objectId).has(hit.orbit.id))
  }
  function objectPlacementCommand(object: SystemObject, point: Point): EntityCommand {
    const targetOrbit = objectPlacementHits(object.id, point).find(hit => hit.valid)?.orbit
    return {
      kind: 'object-placement',
      objectId: object.id,
      fromOrbitId: object.placement.kind === 'orbit' ? object.placement.orbitId : null,
      toOrbitId: targetOrbit?.id ?? null,
    }
  }
  function objectDragPreviewPosition(object: SystemObject, point: Point, originalPosition: Point): Point {
    const hits = objectPlacementHits(object.id, point)
    const eligibleHits = hits.filter(hit => hit.valid)
    if (eligibleHits.length > 1 || (hits.length > 0 && eligibleHits.length === 0)) return originalPosition
    if (eligibleHits.length === 1) return eligibleHits[0]!.point
    return point
  }

  function resolveOrbitCenterMove(orbit: Orbit, point: Point): {
    candidates: OrbitCenterMoveCandidate[]
    candidate: OrbitCenterMoveCandidate | null
    center: Point | null
    radii: OrbitRadii
  } {
    const positions = appliedPositions()
    const movingObjectIds = objectsMovedWithOrbit(system, orbit.id)
    const geometryBlocked = handlers.isEntityCommandBlocked({ kind: 'orbit-center-position', orbitId: orbit.id })
    const candidates: OrbitCenterMoveCandidate[] = []
    const nearbyHosts = Number.isFinite(point.x) && Number.isFinite(point.y)
      ? system.objects
        .map((object, index) => {
          const position = requiredPosition(positions, object.id)
          return {
            object,
            index,
            distance: Math.hypot(point.x - position.x, point.y - position.y),
          }
        })
        .filter(candidate => candidate.distance <= objectHitRadius)
        .sort((left, right) => left.distance - right.distance || left.index - right.index)
      : []

    for (const { object } of nearbyHosts) {
      const hostId = object.id
      const hostBlocked = handlers.isEntityCommandBlocked({ kind: 'orbit-host', orbitId: orbit.id, hostId })
      const cycleError = movingObjectIds.has(hostId)
        ? 'This Orbit cannot be hosted by an object in its own hierarchy.'
        : null
      candidates.push({
        key: `host:${hostId}`,
        label: `Center on ${object.name}`,
        target: { kind: 'host', objectId: hostId },
        error: cycleError
          ?? (geometryBlocked ? 'Resolve the Inspector draft before moving this Orbit.' : null)
          ?? (hostBlocked ? 'Resolve the Inspector draft before changing this Orbit host.' : null),
      })
    }

    if (nearbyHosts.length === 0 && Number.isFinite(point.x) && Number.isFinite(point.y)) {
      candidates.push({
        key: `free:${point.x}:${point.y}`,
        label: 'Free Orbit center',
        target: { kind: 'free', point: toNormalizedMapPoint(point) },
        error: geometryBlocked
          ? 'Resolve the Inspector draft before moving this Orbit.'
          : null,
      })
    }
    const eligible = candidates.filter(candidate => candidate.error === null)
    if (eligible.length !== 1) {
      return { candidates, candidate: null, center: null, radii: orbitRadii(system, orbit, geometry) }
    }

    const candidate = eligible[0]!
    if (candidate.target.kind === 'host') {
      const center = requiredPosition(positions, candidate.target.objectId)
      const hostedOrbit: Orbit = {
        id: orbit.id,
        hostId: candidate.target.objectId,
        order: orbit.order,
      }
      const minimum = minimumOrbitRadius(system, hostedOrbit)
      const radii = orbitRadii(system, orbit, geometry)
      return {
        candidates,
        candidate,
        center,
        radii: {
          horizontal: Math.max(radii.horizontal, minimum),
          vertical: Math.max(radii.vertical, minimum),
        },
      }
    }

    return {
      candidates,
      candidate,
      center: point,
      radii: orbitRadii(system, orbit, geometry),
    }
  }

  const positions = currentPositions()

  function getCreationCandidates(point: Point, type: SystemCreationType): SystemCreationCandidate[] {
    return creationCandidatesAtPoint(system, point, type, geometry)
  }

  function offerCreationTarget(point: Point): void {
    if (!creationType || creationChooserOpen) return
    handlers.creationTarget(getCreationCandidates(point, creationType))
  }

  function handleCreationClick(event: MouseEvent): void {
    if (!creationType) return
    if (event.detail === 0) return
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    if (creationChooserOpen) return
    const contentNode = element.querySelector<SVGGElement>('.system-map-content')
    if (!contentNode) return
    const [x, y] = pointer(event, contentNode)
    offerCreationTarget({ x, y })
  }

  /** Uses the transformed visible center so keyboard Add follows the current pan and zoom. */
  function handleCreationKeydown(event: KeyboardEvent): void {
    if (!creationType || creationChooserOpen || event.target !== element
      || (event.key !== 'Enter' && event.key !== ' ')) return
    const contentNode = element.querySelector<SVGGElement>('.system-map-content')
    const inverse = contentNode?.getScreenCTM()?.inverse()
    if (!contentNode || !inverse) return

    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    const bounds = element.getBoundingClientRect()
    const center = new DOMPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2)
      .matrixTransform(inverse)
    offerCreationTarget({ x: center.x, y: center.y })
  }

  /** Consumes a target click before D3 selection or Add handling and reports the unbounded scene point. */
  function handleMoveTargetClick(event: MouseEvent): void {
    if (!moveTargeting || event.detail === 0) return
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    const contentNode = element.querySelector<SVGGElement>('.system-map-content')
    if (!contentNode) return
    const [x, y] = pointer(event, contentNode)
    handlers.moveTarget({ x, y })
  }

  const svg = select(element)
  const currentTransform = zoomTransform(element)
  const focusedElement = element.ownerDocument.activeElement
  const sceneOwnedFocus = focusedElement instanceof Element && element.contains(focusedElement)
  const focusedObjectId = sceneOwnedFocus
    ? focusedElement.closest<SVGGElement>('.system-object[data-object-id]')?.getAttribute('data-object-id')
    : null
  const focusedOrbitCenterId = element.querySelector<SVGElement>('.orbit-center-handle:focus')
    ?.getAttribute('data-orbit-id')
  const focusedOrbitId = element.querySelector<SVGElement>('.orbit-hit-target:focus')
    ?.getAttribute('data-orbit-id')
  const focusedOrbitAxis = element.querySelector<SVGElement>('.orbit-axis-handle:focus')
  const focusedOrbitAxisId = focusedOrbitAxis?.getAttribute('data-orbit-id')
  const focusedOrbitAxisDirection = focusedOrbitAxis?.getAttribute('data-resize-axis')
  const focusedOrbitRotationId = element.querySelector<SVGElement>('.orbit-rotation-handle:focus')
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
    const center = orbitCenter(orbit, positions, effectiveOrbitCenters)
    const radii = orbitRadii(system, orbit, geometry, effectiveOrbitRadii)
    const rotation = orbitRotation(orbit, geometry, effectiveOrbitRotations)
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
      .attr('role', moveEnabled ? 'slider' : 'button')
      .attr('tabindex', 0)
      .attr('aria-label', `${moveEnabled ? 'Resize' : 'Inspect'} ${orbitLabel(system, orbit)}`)
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
        .attr('data-orbit-id', orbit.id)
        .attr('data-resize-axis', axis)
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', 6)
        .style('cursor', orbitAxisCursor(axis, rotation))
        .attr('role', moveEnabled ? 'slider' : 'button')
        .attr('tabindex', selectedOrbitId === orbit.id ? 0 : -1)
        .attr('aria-hidden', selectedOrbitId === orbit.id ? 'false' : 'true')
        .attr('aria-label', moveEnabled
          ? `Resize ${axis} radius of ${orbitLabel(system, orbit)}`
          : `Inspect ${orbitLabel(system, orbit)}`)
        .attr('aria-valuemin', minimumOrbitRadius(system, orbit))
        .attr('aria-valuemax', radii[axis] + 400)
        .attr('aria-valuenow', Math.round(radii[axis]))
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
        .attr('aria-label', moveEnabled
          ? `Center of ${orbitLabel(system, orbit)}; drag to move or use Move center on map for click and keyboard placement`
          : `Inspect center of ${orbitLabel(system, orbit)}`)
        .append('title')
        .text('Drag to move the Orbit center; use Move center on map for click or keyboard placement')
    }
    mark.append<SVGLineElement>('line')
      .attr('class', 'orbit-edit-control orbit-rotation-stem')
      .attr('x1', verticalHandle.x)
      .attr('y1', verticalHandle.y)
      .attr('x2', rotationHandle.x)
      .attr('y2', rotationHandle.y)
      .style('pointer-events', 'none')
    mark.append<SVGCircleElement>('circle')
      .attr('class', 'orbit-edit-control orbit-rotation-handle')
      .attr('data-orbit-id', orbit.id)
      .attr('cx', rotationHandle.x)
      .attr('cy', rotationHandle.y)
      .attr('r', 7)
      .attr('role', moveEnabled ? 'slider' : 'button')
      .attr('tabindex', selectedOrbitId === orbit.id ? 0 : -1)
      .attr('aria-hidden', selectedOrbitId === orbit.id ? 'false' : 'true')
      .attr('aria-label', `${moveEnabled ? 'Rotate' : 'Inspect'} ${orbitLabel(system, orbit)}`)
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
      if (event.defaultPrevented) return
      handlers.selectOrbit(orbit.id)
    })
    .on('keydown', (event, orbit) => {
      if (event.key === 'Enter' || event.key === ' ') {
        if (event.defaultPrevented) return
        event.preventDefault()
        handlers.selectOrbit(orbit.id)
        return
      }

      if (!moveEnabled || !['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
      handlers.cancelOrbitPlacementPreview()
      const current = orbitRadii(system, orbit, geometry, effectiveOrbitRadii)
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
      if (blockEntityCommand({ kind: 'orbit-geometry', orbitId: orbit.id })) return
      handlers.resizeOrbit(orbit.id, { horizontal, vertical })
    })
  orbitAxisHandles
    .on('click', (event, orbit) => {
      event.stopPropagation()
      if (event.defaultPrevented) return
      handlers.selectOrbit(orbit.id)
    })
    .on('keydown', function (event, orbit) {
      if (event.key === 'Enter' || event.key === ' ') {
        if (event.defaultPrevented) return
        event.preventDefault()
        handlers.selectOrbit(orbit.id)
        return
      }
      if (!moveEnabled || !['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
      handlers.cancelOrbitPlacementPreview()
      const axis = this.getAttribute('data-resize-axis') === 'vertical' ? 'vertical' : 'horizontal'
      const current = orbitRadii(system, orbit, geometry, effectiveOrbitRadii)
      const step = event.shiftKey ? 10 : 1
      let radius = current[axis]
      if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') radius -= step
      else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') radius += step
      else if (event.key === 'Home') radius = minimumOrbitRadius(system, orbit)
      else if (event.key === 'End') radius += 400
      else return
      event.preventDefault()
      if (blockEntityCommand({ kind: 'orbit-geometry', orbitId: orbit.id })) return
      handlers.resizeOrbit(orbit.id, { ...current, [axis]: Math.max(minimumOrbitRadius(system, orbit), radius) })
    })
  orbitCenterHandles
    .on('click', (event, orbit) => {
      event.stopPropagation()
      if (event.defaultPrevented) return
      const handle = event.currentTarget as SVGCircleElement
      if (movedOrbitCenters.has(handle)) {
        movedOrbitCenters.delete(handle)
        return
      }
      handlers.selectOrbit(orbit.id)
    })
    .on('keydown', (event, orbit) => {
      if (event.key === 'Enter' || event.key === ' ') {
        if (event.defaultPrevented) return
        event.preventDefault()
        handlers.selectOrbit(orbit.id)
        return
      }

      if (!moveEnabled || !['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp'].includes(event.key)) return
      // Position changes from this handle require the explicit map Move preview and confirmation.
      // The armed workflow captures arrows at the SVG boundary before they reach this handler.
      if (moveTargeting) return
      event.preventDefault()
      handlers.selectOrbit(orbit.id)
    })
  orbitRotationHandles
    .on('click', (event, orbit) => {
      event.stopPropagation()
      if (event.defaultPrevented) return
      handlers.selectOrbit(orbit.id)
    })
    .on('keydown', (event, orbit) => {
      if (event.key === 'Enter' || event.key === ' ') {
        if (event.defaultPrevented) return
        event.preventDefault()
        handlers.selectOrbit(orbit.id)
        return
      }
      if (!moveEnabled || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return
      event.preventDefault()
      const step = event.shiftKey ? 10 : 1
      const direction = event.key === 'ArrowRight' ? 1 : -1
      handlers.cancelOrbitPlacementPreview()
      const rotation = normalizeOrbitRotation(
        orbitRotation(orbit, geometry, effectiveOrbitRotations) + step * direction,
      )
      if (blockEntityCommand({ kind: 'orbit-geometry', orbitId: orbit.id })) return
      setLiveOrbitRotation(orbit.id, rotation)
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
    .attr('aria-label', object => `Select ${catalogueObjectLabel(object)}`)

  objectMarks.each(function (object) {
    const mark = select(this)
    mark.append('circle')
      .attr('class', 'object-hit-target')
      .attr('r', objectHitRadius)
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

  if (creationType && creationPreview) {
    const previewGroup = content.append('g')
      .attr('class', 'system-creation-preview')
      .attr('aria-hidden', 'true')
      .style('pointer-events', 'none')

    if (creationType.kind === 'object') {
      const subtypeLabel = catalogueTypes.find(candidate => candidate.value === creationType.subtype)?.label
        ?? creationType.subtype
      let point: Point | undefined
      let targetLabel: string
      if (creationPreview.target.kind === 'free') {
        point = {
          x: 64 + creationPreview.target.point.x * 832,
          y: 72 + creationPreview.target.point.y * 416,
        }
        targetLabel = 'Free map position'
      } else if (creationPreview.target.kind === 'orbit') {
        const orbitTarget = creationPreview.target
        const orbit = system.orbits.find(candidate => candidate.id === orbitTarget.orbitId)
        if (orbit) {
          const center = orbitCenter(orbit, positions, effectiveOrbitCenters)
          const radii = creationPreview.radii ?? orbitRadii(system, orbit, geometry, effectiveOrbitRadii)
          const rotation = creationPreview.rotation ?? orbitRotation(orbit, geometry, effectiveOrbitRotations)
          point = orbitPointAtAngle(center, radii, orbitTarget.angle, rotation)
          previewGroup.append('ellipse')
            .attr('class', 'system-creation-preview-orbit')
            .attr('cx', center.x)
            .attr('cy', center.y)
            .attr('rx', radii.horizontal)
            .attr('ry', radii.vertical)
            .attr('transform', `rotate(${rotation} ${center.x} ${center.y})`)
          targetLabel = orbitLabel(system, orbit)
        } else {
          targetLabel = 'Orbit'
        }
      } else {
        targetLabel = 'Unavailable target'
      }

      if (point) {
        const marker = previewGroup.append('g')
          .attr('class', 'system-creation-preview-object')
          .attr('transform', `translate(${point.x} ${point.y})`)
        marker.append('circle')
          .attr('class', 'system-creation-preview-ring')
          .attr('r', 24)
        marker.append('text')
          .attr('class', 'system-creation-preview-glyph')
          .attr('y', 7)
          .attr('text-anchor', 'middle')
          .text(catalogueMarks[creationType.subtype])
        marker.append('text')
          .attr('class', 'system-creation-preview-label')
          .attr('y', -30)
          .attr('text-anchor', 'middle')
          .text(`Preview · ${subtypeLabel} · ${targetLabel}`)
      }
    } else {
      let center: Point | undefined
      let targetLabel: string
      if (creationPreview.target.kind === 'free') {
        center = {
          x: 64 + creationPreview.target.point.x * 832,
          y: 72 + creationPreview.target.point.y * 416,
        }
        targetLabel = 'New unoccupied center'
      } else if (creationPreview.target.kind === 'host') {
        const hostTarget = creationPreview.target
        center = positions.get(hostTarget.objectId)
        const host = system.objects.find(object => object.id === hostTarget.objectId)
        targetLabel = host ? `around ${host.name}` : 'Unavailable host'
      } else {
        targetLabel = 'Unavailable target'
      }

      if (center && creationPreview.radii) {
        const rotation = creationPreview.rotation ?? 0
        previewGroup.append('ellipse')
          .attr('class', 'system-creation-preview-orbit')
          .attr('cx', center.x)
          .attr('cy', center.y)
          .attr('rx', creationPreview.radii.horizontal)
          .attr('ry', creationPreview.radii.vertical)
          .attr('transform', `rotate(${rotation} ${center.x} ${center.y})`)
        previewGroup.append('circle')
          .attr('class', 'system-creation-preview-center')
          .attr('cx', center.x)
          .attr('cy', center.y)
          .attr('r', 6)
        previewGroup.append('text')
          .attr('class', 'system-creation-preview-label')
          .attr('x', center.x)
          .attr('y', center.y - creationPreview.radii.vertical - 30)
          .attr('text-anchor', 'middle')
          .text(`Preview · Orbit ${targetLabel}`)
      }
    }
  }

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
      const center = orbitCenter(orbit, positions, effectiveOrbitCenters)
      const radii = orbitRadii(system, orbit, geometry, effectiveOrbitRadii)
      const rotation = orbitRotation(orbit, geometry, effectiveOrbitRotations)
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
        .attr('aria-valuenow', Math.round(radii.horizontal))
        .attr('aria-valuemax', radii.horizontal + 400)
        .style('cursor', orbitAxisCursor('horizontal', rotation))
      mark.select<SVGCircleElement>('.orbit-axis-handle--vertical')
        .attr('cx', verticalHandle.x)
        .attr('cy', verticalHandle.y)
        .attr('aria-valuenow', Math.round(radii.vertical))
        .attr('aria-valuemax', radii.vertical + 400)
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
      .attr('aria-valuenow', orbit => Math.round(orbitRadii(system, orbit, geometry, effectiveOrbitRadii).horizontal))
      .attr('aria-valuemax', orbit => orbitRadii(system, orbit, geometry, effectiveOrbitRadii).horizontal + 400)
      .attr('aria-valuetext', orbit => {
        const radii = orbitRadii(system, orbit, geometry, effectiveOrbitRadii)
        return `${Math.round(radii.horizontal)} by ${Math.round(radii.vertical)} map units`
      })
    updateMapSurface()
  }

  const movedObjects = new WeakSet<SVGGElement>()
  objectMarks
    .on('click', (event, object) => {
      event.stopPropagation()
      if (event.defaultPrevented) return
      if (movedObjects.has(event.currentTarget as SVGGElement)) {
        movedObjects.delete(event.currentTarget as SVGGElement)
        return
      }
      handlers.selectObject(object.id)
    })
    .on('keydown', (event, object) => {
      if (event.key === 'Enter' || event.key === ' ') {
        if (event.defaultPrevented) return
        event.preventDefault()
        handlers.selectObject(object.id)
      }
    })
  const objectDrag = drag<SVGGElement, SystemObject>()
    .filter(event => moveEnabled && !moveTargeting && !creationType && !event.ctrlKey && !event.button
      && (!('touches' in event) || event.touches.length === 1))
    .clickDistance(6)
    .container(() => content.node()!)
    .subject((_event, object) => {
      // Clear parent-owned precision before D3 captures the object subject.
      handlers.cancelObjectPlacementPreview()
      handlers.cancelOrbitPlacementPreview()
      return requiredPosition(appliedPositions(), object.id)
    })
    .on('start', function (event, object) {
      movedObjects.delete(this)
      objectDragOriginalPositions.set(this, { ...requiredPosition(appliedPositions(), object.id) })
      const startPoint = dragClientPoint(event.sourceEvent)
      if (startPoint) objectDragStartClient.set(this, startPoint)
      beginGesture(this, () => {
        movedObjects.delete(this)
        clearLivePosition(object.id)
        select(this).classed('is-dragging', false)
      }, false, event.sourceEvent)
      select(this).classed('is-dragging', true)
      const command = objectPlacementCommand(object, { x: event.x, y: event.y })
      if (handlers.isObjectMoveBlocked(object.id) || handlers.isEntityCommandBlocked(command)) {
        draftBlockedObjectGestures.add(this)
        blockedObjectCommands.set(this, command)
      }
    })
    .on('drag', function (event, object) {
      let becameBlocked = false
      if (!draftBlockedObjectGestures.has(this) && !cancelledGestures.has(this)) {
        const command = objectPlacementCommand(object, { x: event.x, y: event.y })
        if (handlers.isObjectMoveBlocked(object.id) || handlers.isEntityCommandBlocked(command)) {
          draftBlockedObjectGestures.add(this)
          blockedObjectCommands.set(this, command)
          becameBlocked = true
        }
      }
      if (draftBlockedObjectGestures.has(this)) {
        // Once a mid-drag dependency becomes blocked, roll back its preview but retain D3's
        // transport until the pointer crosses the established attempt threshold.
        if (becameBlocked) {
          activeGestures.get(this)?.()
          updateLiveGeometry()
        }
        const start = objectDragStartClient.get(this)
        const current = dragClientPoint(event.sourceEvent)
        if (start && current && !draftBlockFeedbackShown.has(this)
          && Math.hypot(current.x - start.x, current.y - start.y) > 6) {
          draftBlockFeedbackShown.add(this)
          const blockedCommand = blockedObjectCommands.get(this)
          if (blockedCommand) handlers.entityCommandBlocked(blockedCommand)
          else handlers.objectMoveBlocked(object.id)
          cancelGesture(this)
        }
        return
      }
      if (cancelledGestures.has(this)) return
      if (event.dx || event.dy) {
        movedObjects.add(this)
        const originalPosition = objectDragOriginalPositions.get(this)
          ?? requiredPosition(appliedPositions(), object.id)
        setLivePosition(object.id, objectDragPreviewPosition(object, { x: event.x, y: event.y }, originalPosition))
        updateLiveGeometry()
      }
    })
    .on('end', function (event, object) {
      draftBlockedObjectGestures.delete(this)
      draftBlockFeedbackShown.delete(this)
      blockedObjectCommands.delete(this)
      objectDragStartClient.delete(this)
      if (finishGesture(this)) {
        select(this).classed('is-dragging', false)
        movedObjects.delete(this)
        objectDragOriginalPositions.delete(this)
        return
      }
      select(this).classed('is-dragging', false)
      if (!movedObjects.has(this)) {
        objectDragOriginalPositions.delete(this)
        return
      }
      setTimeout(() => movedObjects.delete(this), 0)
      const point = { x: event.x, y: event.y }
      const fromOrbitId = object.placement.kind === 'orbit' ? object.placement.orbitId : null
      const hits = objectPlacementHits(object.id, point)
      const candidates: SystemObjectMoveCandidate[] = hits.map(hit => {
        const command: EntityCommand = {
          kind: 'object-placement',
          objectId: object.id,
          fromOrbitId,
          toOrbitId: hit.orbit.id,
        }
        const error = !hit.valid
          ? 'This Orbit is hosted by the object or one of its descendants.'
          : handlers.isEntityCommandBlocked(command)
            ? 'Resolve the Inspector draft before moving this object into this Orbit.'
            : null
        return {
          key: `orbit:${hit.orbit.id}`,
          label: orbitLabel(system, hit.orbit),
          target: { kind: 'orbit', orbitId: hit.orbit.id, angle: hit.angle },
          error,
        }
      })
      const eligibleCandidates = candidates.filter(candidate => candidate.error === null)
      clearLivePosition(object.id)
      updateLiveGeometry()
      objectDragOriginalPositions.delete(this)

      if (hits.length > 0) {
        if (eligibleCandidates.length !== 1) {
          handlers.objectMoveCandidates(object.id, candidates)
          return
        }
        const [candidate] = eligibleCandidates
        if (!candidate) return
        const command: EntityCommand = {
          kind: 'object-placement',
          objectId: object.id,
          fromOrbitId,
          toOrbitId: candidate.target.orbitId,
        }
        if (blockEntityCommand(command)) return
        handlers.placeObjectInOrbit(object.id, candidate.target.orbitId, candidate.target.angle)
        return
      }

      if (blockEntityCommand({
        kind: 'object-placement',
        objectId: object.id,
        fromOrbitId,
        toOrbitId: null,
      })) return
      handlers.moveObject(object.id, {
        x: (point.x - 64) / 832,
        y: (point.y - 72) / 416,
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
      effectiveOrbitRadii,
      effectiveOrbitRotations,
      effectiveOrbitCenters,
    )
    if (orbit?.id !== selectedOrbitId) return false

    handlers.cancelOrbitPlacementPreview()
    const rotation = normalizeOrbitRotation(
      orbitRotation(orbit, geometry, effectiveOrbitRotations) + event.deltaY * 0.05,
    )
    if (blockEntityCommand({ kind: 'orbit-geometry', orbitId: orbit.id })) return true
    setLiveOrbitRotation(orbit.id, rotation)
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

    const current = orbitRadii(system, orbit, geometry, effectiveOrbitRadii)
    const localPoint = rotatePoint(
      point,
      center,
      -orbitRotation(orbit, geometry, effectiveOrbitRotations),
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
      .filter(event => moveEnabled && !moveTargeting && !creationType && !event.ctrlKey && !event.button
        && (!('touches' in event) || event.touches.length === 1))
      .clickDistance(6)
      .container(() => content.node()!)
      .subject(event => ({ x: event.x, y: event.y }))
      .on('start', function (event, orbit) {
        resizedOrbits.delete(this)
        beginGesture(this, () => {
          resizedOrbits.delete(this)
          orbitResizeGestures.delete(this)
          clearLiveOrbitRadii(orbit.id)
          select(this).classed('is-resizing', false)
        }, true, event.sourceEvent)
        const center = orbitCenter(orbit, currentPositions(), effectiveOrbitCenters)
        const handleAxis = this.getAttribute('data-resize-axis')
        const axis: OrbitResizeAxis = handleAxis === 'horizontal' || handleAxis === 'vertical'
          ? handleAxis
          : 'global'
        orbitResizeGestures.set(this, {
          axis,
          center,
          startRadii: orbitRadii(system, orbit, geometry, effectiveOrbitRadii),
          startDistance: Math.hypot(event.x - center.x, event.y - center.y),
        })
        select(this).classed('is-resizing', true)
      })
      .on('drag', function (event, orbit) {
        if (cancelledGestures.has(this)) return
        if (event.dx || event.dy) resizedOrbits.add(this)
        const gesture = orbitResizeGestures.get(this)
        if (!gesture) return
        if (blockEntityCommand({ kind: 'orbit-geometry', orbitId: orbit.id })) {
          cancelGesture(this)
          return
        }
        setLiveOrbitRadii(orbit.id, resizedRadii({ x: event.x, y: event.y }, orbit, gesture))
        updateLiveGeometry()
      })
      .on('end', function (event, orbit) {
        if (finishGesture(this)) {
          orbitResizeGestures.delete(this)
          resizedOrbits.delete(this)
          select(this).classed('is-resizing', false)
          return
        }
        select(this).classed('is-resizing', false)
        const gesture = orbitResizeGestures.get(this)
        orbitResizeGestures.delete(this)
        if (!gesture || !resizedOrbits.has(this)) return
        const radii = resizedRadii({ x: event.x, y: event.y }, orbit, gesture)
        if (blockEntityCommand({ kind: 'orbit-geometry', orbitId: orbit.id })) {
          clearLiveOrbitRadii(orbit.id)
          updateLiveGeometry()
          return
        }
        setLiveOrbitRadii(orbit.id, radii)
        updateLiveGeometry()
        handlers.resizeOrbit(orbit.id, radii)
      }),
  )

  orbitCenterHandles.call(
    drag<SVGCircleElement, Orbit>()
      .filter(event => moveEnabled && !moveTargeting && !creationType && !event.ctrlKey && !event.button
        && (!('touches' in event) || event.touches.length === 1))
      .clickDistance(6)
      .container(() => content.node()!)
      .subject(event => ({ x: event.x, y: event.y }))
      .on('start', function (event, orbit) {
        movedOrbitCenters.delete(this)
        beginGesture(this, () => {
          movedOrbitCenters.delete(this)
          clearLiveOrbitCenter(orbit.id)
          clearLiveOrbitRadii(orbit.id)
          select(this).classed('is-moving', false)
        }, true, event.sourceEvent)
        select(this).classed('is-moving', true)
      })
      .on('drag', function (event, orbit) {
        if (cancelledGestures.has(this)) return
        if (event.dx || event.dy) movedOrbitCenters.add(this)
        const resolution = resolveOrbitCenterMove(orbit, { x: event.x, y: event.y })
        if (!resolution.candidate || !resolution.center) {
          clearLiveOrbitCenter(orbit.id)
          clearLiveOrbitRadii(orbit.id)
        } else {
          setLiveOrbitCenter(orbit.id, resolution.center)
          setLiveOrbitRadii(orbit.id, resolution.radii)
        }
        updateLiveGeometry()
      })
      .on('end', function (event, orbit) {
        if (finishGesture(this)) {
          movedOrbitCenters.delete(this)
          select(this).classed('is-moving', false)
          return
        }
        select(this).classed('is-moving', false)
        if (!movedOrbitCenters.has(this)) return
        const resolution = resolveOrbitCenterMove(orbit, { x: event.x, y: event.y })
        const candidate = resolution.candidate
        if (!candidate || !resolution.center) {
          clearLiveOrbitCenter(orbit.id)
          clearLiveOrbitRadii(orbit.id)
          updateLiveGeometry()
          handlers.orbitCenterCandidates(orbit.id, resolution.candidates)
          movedOrbitCenters.delete(this)
          return
        }

        const hostId = candidate.target.kind === 'host' ? candidate.target.objectId : null
        const blocked = candidate.target.kind === 'host'
          ? blockEntityCommand({ kind: 'orbit-host', orbitId: orbit.id, hostId })
          : blockEntityCommand({ kind: 'orbit-center-position', orbitId: orbit.id })
        if (blocked) {
          clearLiveOrbitCenter(orbit.id)
          clearLiveOrbitRadii(orbit.id)
          updateLiveGeometry()
          handlers.orbitCenterCandidates(orbit.id, resolution.candidates.map(entry => entry.key === candidate.key
            ? { ...entry, error: 'Resolve the Inspector draft before applying this Orbit center move.' }
            : entry))
          movedOrbitCenters.delete(this)
          return
        }

        setLiveOrbitCenter(orbit.id, resolution.center)
        setLiveOrbitRadii(orbit.id, resolution.radii)
        updateLiveGeometry()
        handlers.moveOrbitCenter(orbit.id, toNormalizedMapPoint(resolution.center), hostId)
        clearLiveOrbitCenter(orbit.id)
        clearLiveOrbitRadii(orbit.id)
        updateLiveGeometry()
        movedOrbitCenters.delete(this)
      }),
  )

  const rotatedOrbits = new WeakSet<SVGCircleElement>()
  const orbitRotationGestures = new WeakMap<SVGCircleElement, OrbitRotationGesture>()
  orbitRotationHandles.call(
    drag<SVGCircleElement, Orbit>()
      .filter(event => moveEnabled && !moveTargeting && !creationType && !event.ctrlKey && !event.button
        && (!('touches' in event) || event.touches.length === 1))
      .clickDistance(6)
      .container(() => content.node()!)
      .subject(event => ({ x: event.x, y: event.y }))
      .on('start', function (event, orbit) {
        rotatedOrbits.delete(this)
        beginGesture(this, () => {
          rotatedOrbits.delete(this)
          orbitRotationGestures.delete(this)
          clearLiveOrbitRotation(orbit.id)
          select(this).classed('is-rotating', false)
        }, true, event.sourceEvent)
        const center = orbitCenter(orbit, currentPositions(), effectiveOrbitCenters)
        orbitRotationGestures.set(this, {
          center,
          lastPointerAngle: Math.atan2(event.y - center.y, event.x - center.x),
          rotation: orbitRotation(orbit, geometry, effectiveOrbitRotations),
        })
        select(this).classed('is-rotating', true)
      })
      .on('drag', function (event, orbit) {
        if (cancelledGestures.has(this)) return
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
        if (blockEntityCommand({ kind: 'orbit-geometry', orbitId: orbit.id })) {
          cancelGesture(this)
          return
        }
        setLiveOrbitRotation(orbit.id, gesture.rotation)
        updateLiveGeometry()
      })
      .on('end', function (_event, orbit) {
        if (finishGesture(this)) {
          orbitRotationGestures.delete(this)
          rotatedOrbits.delete(this)
          select(this).classed('is-rotating', false)
          return
        }
        select(this).classed('is-rotating', false)
        const gesture = orbitRotationGestures.get(this)
        orbitRotationGestures.delete(this)
        if (!gesture || !rotatedOrbits.has(this)) return
        if (blockEntityCommand({ kind: 'orbit-geometry', orbitId: orbit.id })) {
          clearLiveOrbitRotation(orbit.id)
          updateLiveGeometry()
          return
        }
        handlers.rotateOrbit(orbit.id, gesture.rotation)
      }),
  )

  const zoomBehavior = zoom<SVGSVGElement, unknown>()
    .extent(() => svgViewportExtent(getSvgViewportRect(element)))
    .scaleExtent([MAP_ZOOM_MIN_SCALE, MAP_ZOOM_MAX_SCALE])
    .clickDistance(6)
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
      return (!isMapMark || !moveEnabled || event.type === 'wheel' || touchPinch)
        && (!moveEnabled || !event.ctrlKey || event.type === 'wheel')
        && !('button' in event && event.button)
    })
    .on('zoom', (event) => {
      content.attr('transform', event.transform.toString())
      setZoomLevel(Math.round(event.transform.k * 100))
      onViewportChange({ x: event.transform.x, y: event.transform.y, k: event.transform.k })
    })
  svg.call(zoomBehavior)
  content.attr('transform', currentTransform.toString())
  setZoomLevel(Math.round(currentTransform.k * 100))
  const activeAfterRedraw = element.ownerDocument.activeElement
  const focusMayBeRestored = sceneOwnedFocus
    && (activeAfterRedraw === element.ownerDocument.body || activeAfterRedraw === focusedElement)
  if (focusMayBeRestored) {
    if (focusedOrbitAxisId) {
      orbitAxisHandles.filter(function (orbit) {
        return orbit.id === focusedOrbitAxisId && this.getAttribute('data-resize-axis') === focusedOrbitAxisDirection
      }).node()?.focus()
    } else if (focusedOrbitRotationId) {
      orbitRotationHandles.filter(orbit => orbit.id === focusedOrbitRotationId).node()?.focus()
    } else if (focusedOrbitCenterId) {
      orbitCenterHandles.filter(orbit => orbit.id === focusedOrbitCenterId).node()?.focus()
    } else if (focusedOrbitId) {
      orbitSelectors.filter(orbit => orbit.id === focusedOrbitId).node()?.focus()
    } else if (focusedObjectId) {
      objectMarks.filter(object => object.id === focusedObjectId).node()?.focus()
    }
  }

  return {
    zoomBehavior,
    prepareExportClone,
    cancelActiveGesture,
    setObjectPlacementPreview,
    setOrbitPlacementPreview,
    setOrbitCenterMovePreview,
    captureOrbitRotationWheel,
    handleObjectDrop,
    handleCreationClick,
    handleCreationKeydown,
    handleMoveTargetClick,
    getCreationCandidates,
  }
}
