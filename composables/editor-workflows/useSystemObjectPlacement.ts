/** Owns precise, single-use placement previews for existing system objects. */
import { computed, nextTick, ref, shallowRef, watch, type ComputedRef, type Ref } from 'vue'
import {
  canPlaceObjectInOrbit,
  defaultObjectOrbitAngle,
  updateWorkspaceObject,
  type LocalWorkspace,
  type Orbit,
  type Point,
  type StarSystem,
  type SystemObject,
} from '../../domain/workspace'
import {
  objectPositions,
  orbitCenter,
  orbitPointAtAngle,
  orbitRadii,
  orbitRotation,
  toNormalizedMapPoint,
  type SystemMapGeometry,
} from '../../utils/system-map-geometry'
import type {
  EntityCommand,
  SystemObjectMoveCandidate,
  SystemMapHandle,
  SystemObjectMoveDestinationOption,
  SystemObjectMovePreview,
  SystemObjectMoveTarget,
} from './types'
import type { WorkspaceMutationExecutor, WorkspaceMutationResult } from './workspace-mutations'
import { FREE_SYSTEM_OBJECT_PLACEMENT } from './types'
import { useEditorUiStore } from '../../stores/editor-ui'

interface SystemObjectPlacementOptions {
  workspace: Readonly<Ref<LocalWorkspace | null>>
  creationActive: Readonly<ComputedRef<boolean>>
  systemMapRef: Readonly<Ref<SystemMapHandle | null>>
  mutations: WorkspaceMutationExecutor
  isEntityCommandBlocked: (command: EntityCommand) => boolean
  beforeWorkspaceOperation?: () => Promise<boolean>
}

interface CurrentObject {
  workspace: LocalWorkspace
  system: StarSystem
  object: SystemObject
}

interface PreparedPlacementBaseline {
  fingerprint: string
}

interface PlacementInputValues {
  destination: string
  position: string
  x: string
  y: string
}

interface PlacementInputBaseline {
  objectIdentity: string
  values: PlacementInputValues
}

function geometryForWorkspace(workspace: LocalWorkspace): SystemMapGeometry {
  return {
    objectAngles: workspace.layout.objectAngles,
    orbitRadii: workspace.layout.orbitRadii,
    orbitRotations: workspace.layout.orbitRotations,
  }
}

function effectiveObjectAngle(workspace: LocalWorkspace, system: StarSystem, object: SystemObject): number {
  const savedAngle = workspace.layout.objectAngles[object.id]
  if (typeof savedAngle === 'number' && Number.isFinite(savedAngle)) return savedAngle
  if (object.placement.kind !== 'orbit') return 0

  const orbitId = object.placement.orbitId
  const siblings = system.objects.filter(candidate =>
    candidate.placement.kind === 'orbit' && candidate.placement.orbitId === orbitId,
  )
  const index = siblings.findIndex(candidate => candidate.id === object.id)
  return defaultObjectOrbitAngle(index, siblings.length)
}

function sourceOrbitId(object: SystemObject): string | null {
  return object.placement.kind === 'orbit' ? object.placement.orbitId : null
}

function targetOrbitId(target: SystemObjectMoveTarget): string | null {
  return target.kind === 'orbit' ? target.orbitId : null
}

function orbitPlacementLabel(system: StarSystem, orbit: Orbit): string {
  const host = orbit.hostId === null
    ? 'unoccupied center'
    : system.objects.find(object => object.id === orbit.hostId)?.name ?? 'unknown host'
  return `Orbit ${orbit.order} around ${host}`
}

function orbitGeometryFingerprint(current: CurrentObject, orbitId: string): unknown {
  const { workspace, system } = current
  const geometry = geometryForWorkspace(workspace)
  const positions = objectPositions(system, geometry)
  const lineage: Array<Record<string, unknown>> = []
  const seenOrbits = new Set<string>()
  const seenObjects = new Set<string>()

  function addOrbit(id: string): void {
    const orbit = system.orbits.find(candidate => candidate.id === id)
    if (!orbit || seenOrbits.has(orbit.id)) throw new Error('The selected Orbit host chain is no longer valid.')
    seenOrbits.add(orbit.id)
    lineage.push({
      id: orbit.id,
      hostId: orbit.hostId,
      order: orbit.order,
      center: orbit.hostId === null ? orbit.center : undefined,
      radii: orbitRadii(system, orbit, geometry),
      rotation: orbitRotation(orbit, geometry),
      sceneCenter: orbitCenter(orbit, positions),
      occupants: system.objects
        .filter(object => object.placement.kind === 'orbit' && object.placement.orbitId === orbit.id)
        .map(object => ({ id: object.id, angle: effectiveObjectAngle(workspace, system, object) })),
    })
    if (orbit.hostId === null) return

    const host = system.objects.find(candidate => candidate.id === orbit.hostId)
    if (!host || seenObjects.has(host.id)) throw new Error('The selected Orbit host chain is no longer valid.')
    seenObjects.add(host.id)
    lineage.push({
      objectId: host.id,
      subtype: host.subtype,
      placement: host.placement,
      angle: host.placement.kind === 'orbit' ? effectiveObjectAngle(workspace, system, host) : undefined,
    })
    if (host.placement.kind === 'orbit') {
      const parentOrbitId = host.placement.orbitId
      addOrbit(parentOrbitId)
    }
  }

  addOrbit(orbitId)
  return lineage
}

/** Captures the moved object, source occupancy and target/ancestor geometry only. */
function placementFingerprint(current: CurrentObject, target: SystemObjectMoveTarget): string {
  const { workspace, system, object } = current
  const sourceId = sourceOrbitId(object)
  return JSON.stringify({
    objectId: object.id,
    sourcePlacement: object.placement,
    sourceAngle: sourceId ? effectiveObjectAngle(workspace, system, object) : undefined,
    sourceGeometry: sourceId ? orbitGeometryFingerprint(current, sourceId) : undefined,
    targetGeometry: target.kind === 'orbit' ? orbitGeometryFingerprint(current, target.orbitId) : undefined,
    targetKind: target.kind,
  })
}

function scenePointForTarget(current: CurrentObject, target: SystemObjectMoveTarget): Point {
  if (target.kind === 'free') {
    const point = {
      x: 64 + target.point.x * 832,
      y: 72 + target.point.y * 416,
    }
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      throw new Error('Enter finite X and Y coordinates for free placement.')
    }
    return point
  }
  const orbit = current.system.orbits.find(candidate => candidate.id === target.orbitId)
  if (!orbit) throw new Error('Choose an existing Orbit for this object.')
  const geometry = geometryForWorkspace(current.workspace)
  const positions = objectPositions(current.system, geometry)
  const point = orbitPointAtAngle(
    orbitCenter(orbit, positions),
    orbitRadii(current.system, orbit, geometry),
    target.angle,
    orbitRotation(orbit, geometry),
  )
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new Error('Enter a finite Orbit position in degrees.')
  }
  return point
}

function moveCommand(current: CurrentObject, target: SystemObjectMoveTarget): EntityCommand {
  return {
    kind: 'object-placement',
    objectId: current.object.id,
    fromOrbitId: sourceOrbitId(current.object),
    toOrbitId: targetOrbitId(target),
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function throwIfRejected(result: WorkspaceMutationResult): void {
  if (result.status === 'rejected') throw new Error(result.message)
}

/** Builds explicit existing-object placement around the page-owned memory publication boundary. */
export function useSystemObjectPlacement({
  workspace,
  creationActive,
  systemMapRef,
  mutations,
  isEntityCommandBlocked,
  beforeWorkspaceOperation = async () => true,
}: SystemObjectPlacementOptions) {
  const store = useEditorUiStore()
  const selectedSystem = computed(() => workspace.value?.cluster.systems.find(system => system.id === store.selectedSystemId))
  const selectedObject = computed(() => selectedSystem.value?.objects.find(object => object.id === store.selectedObjectId))
  const systemObjectMoveDestination = ref(FREE_SYSTEM_OBJECT_PLACEMENT)
  const systemObjectPositionInput = ref('0')
  const systemObjectPositionXInput = ref('')
  const systemObjectPositionYInput = ref('')
  const systemObjectMoveCandidates = ref<SystemObjectMoveCandidate[]>([])
  const systemObjectMoveCandidateRequest = ref(0)
  const systemObjectMovePreview = ref<SystemObjectMovePreview | null>(null)
  const systemObjectMoveError = ref('')
  const nextPreviewToken = ref(0)
  let pendingConfirmationToken: number | null = null
  let ownerKey = ''
  const inputBaseline = shallowRef<PlacementInputBaseline | null>(null)
  let preparedBaseline: PreparedPlacementBaseline | null = null
  let candidateBaselines = new Map<string, string>()

  function currentObject(): CurrentObject | null {
    const currentWorkspace = workspace.value
    const system = selectedSystem.value
    const object = selectedObject.value
    if (!currentWorkspace || !system || !object
      || system.id !== store.selectedSystemId
      || object.id !== store.selectedObjectId
      || !currentWorkspace.cluster.systems.some(candidate => candidate.id === system.id)
      || !system.objects.some(candidate => candidate.id === object.id)) return null
    return { workspace: currentWorkspace, system, object }
  }

  function moveCandidateError(current: CurrentObject, candidate: SystemObjectMoveCandidate): string | null {
    const orbit = current.system.orbits.find(item => item.id === candidate.target.orbitId)
    if (!orbit) return 'This Orbit is no longer available.'
    if (!Number.isFinite(candidate.target.angle)) return 'This Orbit position is not finite.'
    if (!canPlaceObjectInOrbit(current.system, current.object.id, orbit.id)) {
      return candidate.error ?? 'This Orbit would create a circular placement relationship.'
    }
    if (isEntityCommandBlocked(moveCommand(current, candidate.target))) {
      return candidate.error ?? 'Resolve the Inspector draft before changing this object or its placement.'
    }
    return null
  }

  const systemObjectMoveAvailable = computed(() => store.activeView === 'system'
    && store.mapMode === 'move'
    && !creationActive.value
    && currentObject() !== null)

  const hasPendingHistoryInput = computed(() => {
    const current = currentObject()
    if (!current) return false
    const baseline = inputBaseline.value
    return !baseline || baseline.objectIdentity !== objectIdentityKeyFor(current)
      || !placementInputValuesEqual(readPlacementInputValues(), baseline.values)
  })

  const systemObjectMoveDestinationOptions = computed<SystemObjectMoveDestinationOption[]>(() => {
    const current = currentObject()
    const orbits = current
      ? current.system.orbits
        .filter(orbit => canPlaceObjectInOrbit(current.system, current.object.id, orbit.id))
        .map(orbit => ({ label: orbitPlacementLabel(current.system, orbit), value: orbit.id }))
      : []
    return [
      { label: 'Free placement', value: FREE_SYSTEM_OBJECT_PLACEMENT },
      ...orbits,
    ]
  })

  function objectIdentityKeyFor(current: CurrentObject | null): string {
    if (!current) return ''
    return `${current.workspace.cluster.id}:${current.system.id}:${current.object.id}`
  }

  function ownerKeyFor(current: CurrentObject | null): string {
    if (!current) return ''
    const placement = current.object.placement.kind === 'orbit'
      ? `orbit:${current.object.placement.orbitId}:${effectiveObjectAngle(current.workspace, current.system, current.object)}`
      : `system:${current.object.placement.x}:${current.object.placement.y}`
    let currentPoint = ''
    try {
      const point = freePointForObject(current)
      currentPoint = `:${point.x}:${point.y}`
    } catch {
      // Missing geometry is reported by the existing placement validation path.
    }
    return `${objectIdentityKeyFor(current)}:${placement}${currentPoint}`
  }

  function readPlacementInputValues(): PlacementInputValues {
    return {
      destination: systemObjectMoveDestination.value,
      position: systemObjectPositionInput.value,
      x: systemObjectPositionXInput.value,
      y: systemObjectPositionYInput.value,
    }
  }

  function placementInputValuesEqual(left: PlacementInputValues, right: PlacementInputValues): boolean {
    return left.destination === right.destination
      && left.position === right.position
      && left.x === right.x
      && left.y === right.y
  }

  function placementInputsMatchBaseline(objectIdentity: string): boolean {
    const baseline = inputBaseline.value
    return baseline?.objectIdentity === objectIdentity
      && placementInputValuesEqual(readPlacementInputValues(), baseline.values)
  }

  function clearPreview(): void {
    const preview = systemObjectMovePreview.value
    if (preview) systemMapRef.value?.setObjectPlacementPreview(preview.objectId, null)
    systemObjectMovePreview.value = null
    preparedBaseline = null
  }

  function clearMoveCandidates(): void {
    systemObjectMoveCandidates.value = []
    candidateBaselines = new Map()
  }

  function freePointForObject(current: CurrentObject): Point {
    if (current.object.placement.kind === 'system') {
      return { x: current.object.placement.x, y: current.object.placement.y }
    }
    const scenePoint = objectPositions(current.system, geometryForWorkspace(current.workspace)).get(current.object.id)
    if (!scenePoint) throw new Error('The selected object position is no longer available.')
    return toNormalizedMapPoint(scenePoint)
  }

  function setInputsToCurrentObject(current: CurrentObject | null): void {
    if (!current) {
      systemObjectMoveDestination.value = FREE_SYSTEM_OBJECT_PLACEMENT
      systemObjectPositionInput.value = '0'
      systemObjectPositionXInput.value = ''
      systemObjectPositionYInput.value = ''
      inputBaseline.value = null
      return
    }
    if (current.object.placement.kind === 'orbit') {
      systemObjectMoveDestination.value = current.object.placement.orbitId
      systemObjectPositionInput.value = String(effectiveObjectAngle(
        current.workspace,
        current.system,
        current.object,
      ) * 180 / Math.PI)
    } else {
      systemObjectMoveDestination.value = FREE_SYSTEM_OBJECT_PLACEMENT
      systemObjectPositionInput.value = '0'
    }
    try {
      const point = freePointForObject(current)
      systemObjectPositionXInput.value = String(point.x)
      systemObjectPositionYInput.value = String(point.y)
    } catch {
      systemObjectPositionXInput.value = ''
      systemObjectPositionYInput.value = ''
    }
    inputBaseline.value = {
      objectIdentity: objectIdentityKeyFor(current),
      values: readPlacementInputValues(),
    }
  }

  function updateSystemObjectMoveDestination(value: string): void {
    systemObjectMoveDestination.value = String(value ?? '')
    clearPreview()
    clearMoveCandidates()
    systemObjectMoveError.value = ''
  }

  function updateSystemObjectPositionInput(value: string): void {
    systemObjectPositionInput.value = String(value ?? '')
    clearPreview()
    clearMoveCandidates()
    systemObjectMoveError.value = ''
  }

  function updateSystemObjectPositionXInput(value: string): void {
    systemObjectPositionXInput.value = String(value ?? '')
    clearPreview()
    clearMoveCandidates()
    systemObjectMoveError.value = ''
  }

  function updateSystemObjectPositionYInput(value: string): void {
    systemObjectPositionYInput.value = String(value ?? '')
    clearPreview()
    clearMoveCandidates()
    systemObjectMoveError.value = ''
  }

  /** Offers ambiguous ring hits without committing or changing the current selection. */
  function offerObjectMoveCandidates(objectId: string, candidates: SystemObjectMoveCandidate[]): void {
    clearPreview()
    clearMoveCandidates()
    systemObjectMoveError.value = ''
    const current = currentObject()
    if (creationActive.value || !systemObjectMoveAvailable.value
      || !current || current.object.id !== objectId || candidates.length === 0) return

    systemObjectMoveCandidates.value = candidates.map(candidate => {
      const orbit = current.system.orbits.find(item => item.id === candidate.target.orbitId)
      let error = moveCandidateError(current, candidate)
      if (!error) {
        try {
          candidateBaselines.set(candidate.key, placementFingerprint(current, candidate.target))
        } catch {
          error = 'The object or Orbit geometry changed. Drag again before choosing a destination.'
        }
      }
      return {
        ...candidate,
        label: orbit ? orbitPlacementLabel(current.system, orbit) : candidate.label,
        error,
      }
    })
    systemObjectMoveCandidateRequest.value += 1
  }

  /** Converts a selected ring hit into the existing explicit preview flow; confirmation remains separate. */
  function chooseObjectMoveCandidate(key: string): boolean {
    const candidate = systemObjectMoveCandidates.value.find(item => item.key === key)
    const current = currentObject()
    if (creationActive.value || !candidate || !systemObjectMoveAvailable.value || !current) return false
    const error = moveCandidateError(current, candidate)
    const candidateBaseline = candidateBaselines.get(key)
    let changedGeometry = false
    if (error === null && candidateBaseline) {
      try {
        changedGeometry = placementFingerprint(current, candidate.target) !== candidateBaseline
      } catch {
        changedGeometry = true
      }
    }
    if (error !== null || !candidateBaseline || changedGeometry) {
      const candidateError = error
        ?? (changedGeometry
          ? 'The object or Orbit geometry changed. Drag again before choosing a destination.'
          : 'This Orbit candidate is no longer available. Drag again to choose a destination.')
      systemObjectMoveCandidates.value = systemObjectMoveCandidates.value.map(item =>
        item.key === key ? { ...item, error: candidateError } : item,
      )
      systemObjectMoveError.value = candidateError
      return false
    }

    const orbit = current.system.orbits.find(item => item.id === candidate.target.orbitId)
    if (!orbit) return false
    clearMoveCandidates()
    systemObjectMoveDestination.value = orbit.id
    systemObjectPositionInput.value = String(candidate.target.angle * 180 / Math.PI)
    systemObjectMoveError.value = ''
    return previewSystemObjectMoveFromInputs()
  }

  function targetFromInputs(current: CurrentObject): SystemObjectMoveTarget {
    if (systemObjectMoveDestination.value === FREE_SYSTEM_OBJECT_PLACEMENT) {
      const rawX = systemObjectPositionXInput.value.trim()
      const rawY = systemObjectPositionYInput.value.trim()
      const x = rawX ? Number(rawX) : Number.NaN
      const y = rawY ? Number(rawY) : Number.NaN
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        throw new Error('Enter finite X and Y coordinates for free placement.')
      }
      return { kind: 'free', point: { x, y } }
    }

    const orbitId = systemObjectMoveDestination.value
    const orbit = current.system.orbits.find(candidate => candidate.id === orbitId)
    if (!orbit || !canPlaceObjectInOrbit(current.system, current.object.id, orbit.id)) {
      throw new Error('Choose a valid Orbit for this object.')
    }
    const rawDegrees = systemObjectPositionInput.value.trim()
    const degrees = rawDegrees ? Number(rawDegrees) : Number.NaN
    if (!Number.isFinite(degrees)) throw new Error('Enter a finite Orbit position in degrees.')
    const angle = (degrees % 360) * Math.PI / 180
    if (!Number.isFinite(angle)) throw new Error('Enter a finite Orbit position in degrees.')
    return { kind: 'orbit', orbitId: orbit.id, angle }
  }

  function cancelSystemObjectMovePreview(): void {
    const preview = systemObjectMovePreview.value
    clearPreview()
    clearMoveCandidates()
    systemObjectMoveError.value = ''
    if (!preview) return
    const current = currentObject()
    if (current?.object.id === preview.objectId && current.system.id === preview.systemId) {
      setInputsToCurrentObject(current)
    }
  }

  function previewSystemObjectMoveFromInputs(): boolean {
    clearPreview()
    clearMoveCandidates()
    systemObjectMoveError.value = ''
    const current = currentObject()
    if (creationActive.value || !systemObjectMoveAvailable.value || !current) return false

    try {
      const target = targetFromInputs(current)
      if (isEntityCommandBlocked(moveCommand(current, target))) {
        throw new Error('Resolve the Inspector draft before changing this object or its placement.')
      }
      const fingerprint = placementFingerprint(current, target)
      const scenePoint = scenePointForTarget(current, target)
      const preview: SystemObjectMovePreview = {
        token: ++nextPreviewToken.value,
        clusterId: current.workspace.cluster.id,
        systemId: current.system.id,
        objectId: current.object.id,
        target,
      }
      preparedBaseline = { fingerprint }
      systemObjectMovePreview.value = preview
      systemMapRef.value?.setObjectPlacementPreview(current.object.id, scenePoint)
      return true
    } catch (error) {
      systemObjectMoveError.value = errorMessage(error)
      return false
    }
  }

  async function confirmSystemObjectMove(token: number): Promise<boolean> {
    if (!await beforeWorkspaceOperation()) return false
    const preview = systemObjectMovePreview.value
    const baseline = preparedBaseline
    const current = currentObject()
    if (creationActive.value || !preview || preview.token !== token || !baseline) return false
    if (!systemObjectMoveAvailable.value || !current) {
      clearPreview()
      systemObjectMoveError.value = 'The selected object or map mode changed. Preview the position again.'
      return false
    }
    if (preview.clusterId !== current.workspace.cluster.id
      || preview.systemId !== current.system.id
      || preview.objectId !== current.object.id) {
      clearPreview()
      systemObjectMoveError.value = 'The selected object changed. Preview the position again.'
      return false
    }
    if (preview.target.kind === 'orbit') {
      if (!Number.isFinite(preview.target.angle)
        || !canPlaceObjectInOrbit(current.system, current.object.id, preview.target.orbitId)) {
        clearPreview()
        systemObjectMoveError.value = 'Choose a valid Orbit and finite position for this object.'
        return false
      }
    } else if (!Number.isFinite(preview.target.point.x) || !Number.isFinite(preview.target.point.y)) {
      clearPreview()
      systemObjectMoveError.value = 'Enter finite X and Y coordinates for free placement.'
      return false
    }
    if (isEntityCommandBlocked(moveCommand(current, preview.target))) {
      clearPreview()
      systemObjectMoveError.value = 'Resolve the Inspector draft before changing this object or its placement.'
      return false
    }

    try {
      if (placementFingerprint(current, preview.target) !== baseline.fingerprint) {
        clearPreview()
        systemObjectMoveError.value = 'The object placement or Orbit geometry changed. Preview the position again.'
        return false
      }
    } catch (error) {
      clearPreview()
      systemObjectMoveError.value = errorMessage(error)
      return false
    }

    pendingConfirmationToken = preview.token
    try {
      const result = await mutations.execute({
        action: {
          kind: preview.target.kind === 'orbit' ? 'place' : 'move',
          label: preview.target.kind === 'orbit'
            ? `Place ${current.object.name} in Orbit`
            : `Move ${current.object.name}`,
          target: { kind: 'object', id: current.object.id, systemId: current.system.id },
          parent: preview.target.kind === 'orbit'
            ? { kind: 'orbit', id: preview.target.orbitId, systemId: current.system.id }
            : { kind: 'system', id: current.system.id },
        },
        isCurrent: () => {
          if (systemObjectMovePreview.value?.token !== preview.token
            || creationActive.value
            || store.activeView !== 'system'
            || store.mapMode !== 'move') return false
          const latest = currentObject()
          if (!latest || latest.workspace.cluster.id !== preview.clusterId
            || latest.system.id !== preview.systemId || latest.object.id !== preview.objectId
            || isEntityCommandBlocked(moveCommand(latest, preview.target))) return false
          try {
            return placementFingerprint(latest, preview.target) === baseline.fingerprint
          } catch {
            return false
          }
        },
        prepare: (latestWorkspace) => {
          const latestSystem = latestWorkspace.cluster.systems.find(system => system.id === preview.systemId)
          const latestObject = latestSystem?.objects.find(object => object.id === preview.objectId)
          if (!latestSystem || !latestObject) throw new Error('The selected object is no longer available.')
          const latest: CurrentObject = { workspace: latestWorkspace, system: latestSystem, object: latestObject }
          if (isEntityCommandBlocked(moveCommand(latest, preview.target))) {
            throw new Error('Resolve the Inspector draft before changing this object or its placement.')
          }
          if (placementFingerprint(latest, preview.target) !== baseline.fingerprint) {
            throw new Error('The object placement or Orbit geometry changed. Preview the position again.')
          }
          const placement = preview.target.kind === 'orbit'
            ? { kind: 'orbit' as const, orbitId: preview.target.orbitId }
            : { kind: 'system' as const, x: preview.target.point.x, y: preview.target.point.y }
          return updateWorkspaceObject(
            latestWorkspace,
            latestSystem.id,
            latestObject.id,
            { placement },
            preview.target.kind === 'orbit' ? { angle: preview.target.angle } : undefined,
          )
        },
      })
      if (result.status === 'applied') void result.durable.catch(() => undefined)
      throwIfRejected(result)
      if (systemObjectMovePreview.value?.token === preview.token) {
        clearPreview()
        clearMoveCandidates()
        systemObjectMoveError.value = ''
        const latest = currentObject()
        if (latest) {
          ownerKey = ownerKeyFor(latest)
          setInputsToCurrentObject(latest)
        }
      }
      return true
    } catch (error) {
      if (systemObjectMovePreview.value?.token === preview.token) {
        systemObjectMoveError.value = errorMessage(error)
      }
      return false
    } finally {
      if (pendingConfirmationToken === preview.token) pendingConfirmationToken = null
    }
  }

  const currentMoveCommandBlocked = computed(() => {
    const current = currentObject()
    if (!current) return false
    try {
      return isEntityCommandBlocked(moveCommand(current, targetFromInputs(current)))
    } catch {
      return false
    }
  })

  watch([workspace, () => store.activeView, () => store.mapMode, creationActive, () => store.selectedSystemId, () => store.selectedObjectId], () => {
    if (pendingConfirmationToken !== null) return
    const current = currentObject()
    const nextOwnerKey = ownerKeyFor(current)
    const nextObjectIdentity = objectIdentityKeyFor(current)
    const identityChanged = inputBaseline.value?.objectIdentity !== nextObjectIdentity
    if (identityChanged) {
      const hadPreview = systemObjectMovePreview.value !== null
      clearPreview()
      clearMoveCandidates()
      ownerKey = nextOwnerKey
      setInputsToCurrentObject(current)
      systemObjectMoveError.value = hadPreview
        ? 'The selected object or placement changed. Preview the position again.'
        : ''
      return
    }

    if (nextOwnerKey !== ownerKey) {
      const hadPreview = systemObjectMovePreview.value !== null
      clearPreview()
      clearMoveCandidates()
      ownerKey = nextOwnerKey
      if (current && placementInputsMatchBaseline(nextObjectIdentity)) setInputsToCurrentObject(current)
      systemObjectMoveError.value = hadPreview
        ? 'The selected object or placement changed. Preview the position again.'
        : ''
      return
    }

    if (creationActive.value) {
      clearPreview()
      clearMoveCandidates()
      systemObjectMoveError.value = ''
      return
    }

    const preview = systemObjectMovePreview.value
    if (!preview) {
      if (current && systemObjectMoveDestination.value !== FREE_SYSTEM_OBJECT_PLACEMENT
        && !systemObjectMoveDestinationOptions.value.some(option => option.value === systemObjectMoveDestination.value)
        && placementInputsMatchBaseline(nextObjectIdentity)) {
        setInputsToCurrentObject(current)
      }
      return
    }
    if (store.activeView !== 'system' || store.mapMode !== 'move') {
      clearPreview()
      clearMoveCandidates()
      systemObjectMoveError.value = ''
      return
    }
    if (!current || preview.clusterId !== current.workspace.cluster.id
      || preview.systemId !== current.system.id
      || preview.objectId !== current.object.id) {
      clearPreview()
      clearMoveCandidates()
      systemObjectMoveError.value = 'The selected object changed. Preview the position again.'
      return
    }
    if (isEntityCommandBlocked(moveCommand(current, preview.target))) {
      clearPreview()
      systemObjectMoveError.value = 'Resolve the Inspector draft before changing this object or its placement.'
      return
    }

    try {
      if (!preparedBaseline || placementFingerprint(current, preview.target) !== preparedBaseline.fingerprint) {
        clearPreview()
        systemObjectMoveError.value = 'The object placement or Orbit geometry changed. Preview the position again.'
        return
      }
    } catch (error) {
      clearPreview()
      systemObjectMoveError.value = errorMessage(error)
      return
    }

    const token = preview.token
    void nextTick(() => {
      if (systemObjectMovePreview.value?.token !== token) return
      const latest = currentObject()
      if (!latest || !preparedBaseline
        || placementFingerprint(latest, preview.target) !== preparedBaseline.fingerprint) {
        clearPreview()
        systemObjectMoveError.value = 'The object placement or Orbit geometry changed. Preview the position again.'
        return
      }
      systemMapRef.value?.setObjectPlacementPreview(preview.objectId, scenePointForTarget(latest, preview.target))
    })
  }, { flush: 'sync', immediate: true })

  watch(currentMoveCommandBlocked, blocked => {
    if (!blocked || !systemObjectMovePreview.value) return
    clearPreview()
    systemObjectMoveError.value = 'Resolve the Inspector draft before changing this object or its placement.'
  }, { flush: 'sync' })

  return {
    systemObjectMoveAvailable,
    hasPendingHistoryInput,
    systemObjectMoveDestination,
    systemObjectMoveDestinationOptions,
    systemObjectPositionInput,
    systemObjectPositionXInput,
    systemObjectPositionYInput,
    systemObjectMoveCandidates,
    systemObjectMoveCandidateRequest,
    systemObjectMovePreview,
    systemObjectMoveError,
    updateSystemObjectMoveDestination,
    updateSystemObjectPositionInput,
    updateSystemObjectPositionXInput,
    updateSystemObjectPositionYInput,
    offerObjectMoveCandidates,
    chooseObjectMoveCandidate,
    previewSystemObjectMoveFromInputs,
    confirmSystemObjectMove,
    cancelSystemObjectMovePreview,
  }
}
