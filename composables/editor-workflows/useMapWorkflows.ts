/**
 * Translates map and inspector intents into workspace commits; transient SVG drag previews stay renderer-local.
 */
import { ref, type ComputedRef, type Ref, type ShallowRef } from 'vue'
import {
  canPlaceObjectInOrbit,
  defaultOrbitRadius,
  detachOrbit,
  minimumOrbitRadius,
  moveOrbit,
  moveOrbitCenter,
  normalizeOrbitRotation,
  replaceWorkspaceSystem,
  updateSystemObject,
  type LocalWorkspace,
  type Orbit,
  type OrbitRadii,
  type Point,
  type StarSystem,
  type SystemObject,
} from '../../domain/workspace'
import type {
  MapInspectorHandle,
  EntityCommand,
  ObjectEditRequest,
  OrbitEditRequest,
  SystemMapHandle,
  TransitionOptions,
} from './types'

interface MapWorkflowOptions {
  workspace: Readonly<Ref<LocalWorkspace | null>>
  commit: (nextWorkspace: LocalWorkspace) => Promise<void>
  applyWorkspace: (nextWorkspace: LocalWorkspace) => { durable: Promise<void> }
  selectedSystem: Readonly<ComputedRef<StarSystem | undefined>>
  selectedObject: Readonly<ComputedRef<SystemObject | undefined>>
  selectedOrbit: Readonly<ComputedRef<Orbit | undefined>>
  mapInspectorRef: ShallowRef<MapInspectorHandle | null>
  systemMapRef: ShallowRef<SystemMapHandle | null>
  resolveTransition: (options?: TransitionOptions) => Promise<boolean>
  beginObjectSession: (clusterId: string, systemId: string, objectId: string) => void
  beginOrbitSession: (clusterId: string, systemId: string, orbitId: string) => void
  isEntityCommandBlocked: (command: EntityCommand) => boolean
  editorError: Ref<string>
}

/**
 * Builds system-map commands around the page publication and inspector draft-acknowledgement boundaries.
 * @param options Current selection refs, renderer handles, draft-transition resolver, and persistence callback.
 * @returns Map edit commands; rejected edits are exposed through editorError rather than thrown to the UI.
 */
export function useMapWorkflows({
  workspace,
  commit,
  applyWorkspace,
  selectedSystem,
  selectedObject,
  selectedOrbit,
  mapInspectorRef,
  systemMapRef,
  resolveTransition,
  beginObjectSession,
  beginOrbitSession,
  isEntityCommandBlocked,
  editorError,
}: MapWorkflowOptions) {
  const orbitAdjustmentNotice = ref('')

  function rejectBlockedEntityCommand(command: EntityCommand): boolean {
    if (!isEntityCommandBlocked(command)) return false
    editorError.value = 'Resolve the Inspector draft before changing this object, Orbit, or a related dependency.'
    return true
  }

  function errorText(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
  }

  function materializeEffectiveAngles(system: StarSystem, orbitId: string, objectAngles: Record<string, number>): void {
    const siblings = system.objects.filter(object =>
      object.placement.kind === 'orbit' && object.placement.orbitId === orbitId,
    )
    siblings.forEach((object, index) => {
      if (objectAngles[object.id] !== undefined) return
      objectAngles[object.id] = -Math.PI / 2 + (index / Math.max(1, siblings.length)) * Math.PI * 2
    })
  }

  /**
   * Replaces one system in the current workspace and waits for the page-owned durable commit.
   * @param system Complete updated system.
   * @throws If the workspace is unavailable, the system replacement is invalid, or persistence fails.
   */
  async function saveSystem(system: StarSystem): Promise<void> {
    const currentWorkspace = workspace.value
    if (!currentWorkspace) {
      throw new Error('Create a local workspace before editing a star system.')
    }
    await commit(replaceWorkspaceSystem(currentWorkspace, system))
  }

  /**
   * Persists a cluster-map drag position after clamping each normalized coordinate to [0, 1].
   * @param systemId System being moved.
   * @param position Proposed normalized cluster-map position.
   * @returns A promise that resolves after the attempt; invalid coordinates or save failures populate editorError.
   */
  async function moveSystem(systemId: string, position: Point): Promise<void> {
    const currentWorkspace = workspace.value
    if (!currentWorkspace?.cluster.systems.some(system => system.id === systemId)) return

    try {
      if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
        throw new Error('A map position must contain finite coordinates.')
      }
      await commit({
        ...currentWorkspace,
        layout: {
          ...currentWorkspace.layout,
          systemPositions: {
            ...currentWorkspace.layout.systemPositions,
            [systemId]: {
              x: Math.max(0, Math.min(1, position.x)),
              y: Math.max(0, Math.min(1, position.y)),
            },
          },
        },
      })
      editorError.value = ''
    } catch (error) {
      editorError.value = errorText(error)
    }
  }

  /**
   * Persists a system-map object position unless its inspector currently owns an edit draft.
   * Position coordinates are normalized against the initial scene body and may extend outside [0, 1].
   * @param objectId Object being moved.
   * @param position Proposed normalized system-map coordinates.
   * @returns A promise that resolves after the attempt; validation and save errors populate editorError.
   */
  async function moveMapObject(objectId: string, position: Point): Promise<void> {
    const currentWorkspace = workspace.value
    const selectedSystemId = selectedSystem.value?.id
    const system = currentWorkspace?.cluster.systems.find(candidate => candidate.id === selectedSystemId)
    const object = system?.objects.find(candidate => candidate.id === objectId)
    const objectFieldSettings = currentWorkspace?.objectFieldSettings
    if (!currentWorkspace || !system || !object || !objectFieldSettings) return
    if (rejectBlockedEntityCommand({
      kind: 'object-placement',
      objectId,
      fromOrbitId: object.placement.kind === 'orbit' ? object.placement.orbitId : null,
      toOrbitId: null,
    })) return

    try {
      if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
        throw new Error('A map position must contain finite coordinates.')
      }
      const objectAngles = { ...currentWorkspace.layout.objectAngles }
      const fromOrbitId = object.placement.kind === 'orbit' ? object.placement.orbitId : null
      if (fromOrbitId) materializeEffectiveAngles(system, fromOrbitId, objectAngles)
      const workspaceWithAngles: LocalWorkspace = {
        ...currentWorkspace,
        layout: { ...currentWorkspace.layout, objectAngles },
      }
      const updatedSystem = updateSystemObject(system, object.id, {
        placement: {
          kind: 'system',
          x: position.x,
          y: position.y,
        },
      }, objectFieldSettings)
      await commit(replaceWorkspaceSystem(workspaceWithAngles, updatedSystem))
      editorError.value = ''
    } catch (error) {
      editorError.value = errorText(error)
    }
  }

  /**
   * Moves an object to an Orbit and persists its orbital angle in radians.
   * Editing objects in the inspector blocks map placement until that draft is resolved.
   * @param objectId Object to place.
   * @param orbitId Destination Orbit, validated against recursive host placement.
   * @param angle Orbital position in radians.
   * @returns A promise that resolves after the attempt; validation and save errors populate editorError.
   */
  async function placeMapObjectInOrbit(objectId: string, orbitId: string, angle: number): Promise<void> {
    const currentWorkspace = workspace.value
    const selectedSystemId = selectedSystem.value?.id
    const system = currentWorkspace?.cluster.systems.find(candidate => candidate.id === selectedSystemId)
    const object = system?.objects.find(candidate => candidate.id === objectId)
    const objectFieldSettings = currentWorkspace?.objectFieldSettings
    if (!currentWorkspace || !system || !object || !objectFieldSettings) return
    if (rejectBlockedEntityCommand({
      kind: 'object-placement',
      objectId,
      fromOrbitId: object.placement.kind === 'orbit' ? object.placement.orbitId : null,
      toOrbitId: orbitId,
    })) return

    try {
      if (!Number.isFinite(angle)) throw new Error('An orbital angle must be finite.')
      if (!canPlaceObjectInOrbit(system, object.id, orbitId)) {
        throw new Error('Choose a valid Orbit for this object.')
      }
      const objectAngles = { ...currentWorkspace.layout.objectAngles }
      const fromOrbitId = object.placement.kind === 'orbit' ? object.placement.orbitId : null
      if (fromOrbitId !== orbitId) {
        if (fromOrbitId) materializeEffectiveAngles(system, fromOrbitId, objectAngles)
        materializeEffectiveAngles(system, orbitId, objectAngles)
      }
      const workspaceWithAngles: LocalWorkspace = {
        ...currentWorkspace,
        layout: { ...currentWorkspace.layout, objectAngles },
      }
      const updatedSystem = updateSystemObject(system, object.id, {
        placement: { kind: 'orbit', orbitId },
      }, objectFieldSettings)
      const nextWorkspace = replaceWorkspaceSystem(workspaceWithAngles, updatedSystem)
      await commit({
        ...nextWorkspace,
        layout: {
          ...nextWorkspace.layout,
          objectAngles: {
            ...nextWorkspace.layout.objectAngles,
            [objectId]: angle,
          },
        },
      })
      editorError.value = ''
    } catch (error) {
      editorError.value = errorText(error)
    }
  }

  /**
   * Persists an object's Orbit angle without changing its placement.
   * @param objectId Object whose current placement must be an Orbit.
   * @param angle Orbital position in radians.
   * @returns A promise that resolves after the attempt; invalid angles and save failures populate editorError.
   */
  async function rotateMapObject(objectId: string, angle: number): Promise<void> {
    const currentWorkspace = workspace.value
    const object = selectedSystem.value?.objects.find(candidate => candidate.id === objectId)
    if (!currentWorkspace || object?.placement.kind !== 'orbit') return
    if (rejectBlockedEntityCommand({
      kind: 'object-placement',
      objectId,
      fromOrbitId: object.placement.orbitId,
      toOrbitId: object.placement.orbitId,
    })) return

    try {
      if (!Number.isFinite(angle)) throw new Error('An orbital angle must be finite.')
      await commit({
        ...currentWorkspace,
        layout: {
          ...currentWorkspace.layout,
          objectAngles: {
            ...currentWorkspace.layout.objectAngles,
            [objectId]: angle,
          },
        },
      })
      editorError.value = ''
    } catch (error) {
      editorError.value = errorText(error)
    }
  }

  /**
   * Saves Orbit radii in SVG scene units, rounding and clamping both axes to the host-specific minimum.
   * @param orbitId Orbit to resize.
   * @param radii Proposed horizontal and vertical radii.
   * @returns A promise that resolves after the attempt; invalid radii and save failures populate editorError.
   */
  async function resizeMapOrbit(orbitId: string, radii: OrbitRadii): Promise<void> {
    const currentWorkspace = workspace.value
    const system = selectedSystem.value
    const orbit = system?.orbits.find(candidate => candidate.id === orbitId)
    if (!currentWorkspace || !system || !orbit) return
    if (rejectBlockedEntityCommand({ kind: 'orbit-geometry', orbitId })) return

    try {
      const minimum = minimumOrbitRadius(system, orbit)
      const orbitRadii = { ...currentWorkspace.layout.orbitRadii }
      if (!Number.isFinite(radii.horizontal) || !Number.isFinite(radii.vertical)) {
        throw new Error('Orbit radii must be finite.')
      }
      orbitRadii[orbitId] = {
        horizontal: Math.max(minimum, Math.round(radii.horizontal)),
        vertical: Math.max(minimum, Math.round(radii.vertical)),
      }
      await commit({
        ...currentWorkspace,
        layout: {
          ...currentWorkspace.layout,
          orbitRadii,
        },
      })
      editorError.value = ''
    } catch (error) {
      editorError.value = errorText(error)
    }
  }

  /**
   * Persists an Orbit ellipse rotation normalized to [0, 360) degrees.
   * @param orbitId Orbit to rotate.
   * @param degrees Proposed rotation in degrees.
   * @returns A promise that resolves after the attempt; invalid input or save failures populate editorError.
   */
  async function rotateMapOrbit(orbitId: string, degrees: number): Promise<void> {
    const currentWorkspace = workspace.value
    const system = selectedSystem.value
    if (!currentWorkspace || !system?.orbits.some(orbit => orbit.id === orbitId)) return
    if (rejectBlockedEntityCommand({ kind: 'orbit-geometry', orbitId })) return

    try {
      const orbitRotations = {
        ...currentWorkspace.layout.orbitRotations,
        [orbitId]: normalizeOrbitRotation(degrees),
      }
      await commit({
        ...currentWorkspace,
        layout: {
          ...currentWorkspace.layout,
          orbitRotations,
        },
      })
      editorError.value = ''
    } catch (error) {
      editorError.value = errorText(error)
    }
  }

  /**
   * Moves an unoccupied Orbit center or attaches that Orbit to an object host.
   * Attaching preserves effective radii across free-Orbit reindexing and clamps each axis to the new host minimum.
   * A correction notice follows successful memory publication, independent of durable persistence.
   * @param orbitId Orbit whose center or host changes.
   * @param center Proposed normalized map center, used when hostId is null.
   * @param hostId Object to host the Orbit, or null to leave it unoccupied.
   * @returns A promise that resolves after the attempt; domain and save failures populate editorError.
   */
  async function moveMapOrbitCenter(
    orbitId: string,
    center: Point,
    hostId: string | null,
  ): Promise<void> {
    const currentWorkspace = workspace.value
    const selectedSystemId = selectedSystem.value?.id
    const system = currentWorkspace?.cluster.systems.find(candidate => candidate.id === selectedSystemId)
    if (!currentWorkspace || !system) return
    const currentOrbit = system.orbits.find(candidate => candidate.id === orbitId)
    if (!currentOrbit) return
    const command: EntityCommand = currentOrbit.hostId === hostId
      ? { kind: 'orbit-geometry', orbitId }
      : { kind: 'orbit-host', orbitId, hostId }
    if (rejectBlockedEntityCommand(command)) return

    try {
      const orbitRadii = { ...currentWorkspace.layout.orbitRadii }
      if (hostId !== null) {
        for (const freeOrbit of system.orbits.filter(candidate => candidate.hostId === null)) {
          const savedRadii = currentWorkspace.layout.orbitRadii[freeOrbit.id]
          const defaultRadius = defaultOrbitRadius(system, freeOrbit)
          orbitRadii[freeOrbit.id] = savedRadii
            ? { horizontal: savedRadii.horizontal, vertical: savedRadii.vertical }
            : { horizontal: defaultRadius, vertical: defaultRadius }
        }
      }
      const workspaceWithEffectiveRadii = hostId !== null
        ? { ...currentWorkspace, layout: { ...currentWorkspace.layout, orbitRadii } }
        : currentWorkspace
      const updatedSystem = moveOrbitCenter(system, orbitId, center, hostId)
      let nextWorkspace = replaceWorkspaceSystem(workspaceWithEffectiveRadii, updatedSystem)
      const updatedOrbit = updatedSystem.orbits.find(candidate => candidate.id === orbitId)
      const minimum = hostId !== null && updatedOrbit
        ? minimumOrbitRadius(updatedSystem, updatedOrbit)
        : undefined
      const sourceRadii = minimum !== undefined ? orbitRadii[orbitId] : undefined
      const adjustedRadii = sourceRadii && minimum !== undefined
        ? {
            horizontal: Math.max(sourceRadii.horizontal, minimum),
            vertical: Math.max(sourceRadii.vertical, minimum),
          }
        : undefined
      const adjusted = adjustedRadii !== undefined && sourceRadii !== undefined && (
        adjustedRadii.horizontal !== sourceRadii.horizontal
        || adjustedRadii.vertical !== sourceRadii.vertical
      )

      if (adjustedRadii) {
        nextWorkspace = {
          ...nextWorkspace,
          layout: {
            ...nextWorkspace.layout,
            orbitRadii: { ...nextWorkspace.layout.orbitRadii, [orbitId]: adjustedRadii },
          },
        }
      }
      const { durable } = applyWorkspace(nextWorkspace)
      editorError.value = ''
      orbitAdjustmentNotice.value = ''
      if (adjusted && minimum !== undefined) {
        orbitAdjustmentNotice.value = `Orbit radii increased to the new host minimum of ${minimum}.`
      }
      await durable
    } catch (error) {
      editorError.value = errorText(error)
    }
  }

  /**
   * Finds a point-clear unoccupied center, detaches the selected Orbit, and preserves its effective radii.
   * The search does not promise clearance between the full rings of separate Orbits.
   * @returns A promise that resolves after the attempt or any early guard; failures populate editorError.
   */
  async function detachSelectedOrbit(): Promise<void> {
    const systemId = selectedSystem.value?.id
    const orbitId = selectedOrbit.value?.id
    if (
      !systemId
      || !orbitId
      || selectedOrbit.value?.hostId === null
    ) return
    if (rejectBlockedEntityCommand({ kind: 'orbit-host', orbitId, hostId: null })) return
    if (!await resolveTransition({ leaveChart: false, leaveEntitySession: false })) return

    const currentWorkspace = workspace.value
    const system = currentWorkspace?.cluster.systems.find(candidate => candidate.id === systemId)
    const orbit = system?.orbits.find(candidate => candidate.id === orbitId)
    if (!currentWorkspace || !system || !orbit || selectedSystem.value?.id !== systemId) return

    try {
      const map = systemMapRef.value
      if (!map) throw new Error('The system map is not ready.')
      const center = map.getDetachedOrbitCenter(orbit.id)
      if (!center) throw new Error('Could not find a nearby empty location for this Orbit.')
      const nextWorkspace = replaceWorkspaceSystem(
        currentWorkspace,
        detachOrbit(system, orbit.id, center),
      )
      const defaultRadius = defaultOrbitRadius(system, orbit)
      const orbitRadii = {
        ...nextWorkspace.layout.orbitRadii,
        [orbit.id]: currentWorkspace.layout.orbitRadii[orbit.id]
          ?? { horizontal: defaultRadius, vertical: defaultRadius },
      }
      await commit({
        ...nextWorkspace,
        layout: {
          ...nextWorkspace.layout,
          orbitRadii,
        },
      })
      editorError.value = ''
    } catch (error) {
      editorError.value = errorText(error)
    }
  }

  /** Starts the selected object draft only after any other inspector draft is accepted or discarded. */
  async function beginObjectEdit(): Promise<void> {
    const objectId = selectedObject.value?.id
    if (!objectId || !await resolveTransition({ leaveChart: false })) return
    const currentWorkspace = workspace.value
    const system = selectedSystem.value
    if (!currentWorkspace || !system || selectedObject.value?.id !== objectId) return
    beginObjectSession(currentWorkspace.cluster.id, system.id, objectId)
    editorError.value = ''
  }

  /** Starts the selected Orbit draft only after any other inspector draft is accepted or discarded. */
  async function beginOrbitEdit(): Promise<void> {
    const orbitId = selectedOrbit.value?.id
    if (!orbitId || !await resolveTransition({ leaveChart: false })) return
    const currentWorkspace = workspace.value
    const system = selectedSystem.value
    if (!currentWorkspace || !system || selectedOrbit.value?.id !== orbitId) return
    beginOrbitSession(currentWorkspace.cluster.id, system.id, orbitId)
    editorError.value = ''
  }

  /**
   * Validates and commits the inspector's object candidate, acknowledging the draft only after success.
   * @param request Object ID and proposed field changes.
   * @returns A promise that resolves after the attempt; errors populate editorError and leave the draft active.
   */
  async function saveObjectEdit(request: ObjectEditRequest): Promise<void> {
    const system = selectedSystem.value
    const currentWorkspace = workspace.value
    const object = system?.objects.find(candidate => candidate.id === request.objectId)
    if (!system || !currentWorkspace || !object) return
    if (rejectBlockedEntityCommand({ kind: 'object-placement', objectId: request.objectId })) return

    try {
      await saveSystem(updateSystemObject(
        system,
        object.id,
        request.changes,
        currentWorkspace.objectFieldSettings,
      ))
      mapInspectorRef.value?.objectSaveSucceeded()
      editorError.value = ''
    } catch (error) {
      editorError.value = errorText(error)
    }
  }

  /**
   * Applies sibling order, optional unoccupied center, and scene-unit radii from the Orbit draft.
   * The inspector receives a save acknowledgement only after the workspace commit succeeds.
   * @param request Orbit ID, target sibling order, radii, and optional normalized center.
   * @returns A promise that resolves after the attempt; failures populate editorError and retain the draft.
   */
  async function saveOrbitEdit(request: OrbitEditRequest): Promise<void> {
    const currentWorkspace = workspace.value
    const system = selectedSystem.value
    const orbit = system?.orbits.find(candidate => candidate.id === request.orbitId)
    if (!currentWorkspace || !system || !orbit) return
    if (rejectBlockedEntityCommand({ kind: 'orbit-geometry', orbitId: request.orbitId })) return

    try {
      let updatedSystem = system
      let currentOrder = orbit.order
      while (currentOrder !== request.targetOrder) {
        const direction = currentOrder < request.targetOrder ? 1 : -1
        updatedSystem = moveOrbit(updatedSystem, orbit.id, direction)
        currentOrder += direction
      }
      if (request.center) {
        updatedSystem = {
          ...updatedSystem,
          orbits: updatedSystem.orbits.map(candidate =>
            candidate.id === orbit.id && candidate.hostId === null
              ? { ...candidate, center: request.center! }
              : candidate,
          ),
        }
      }
      const nextWorkspace = replaceWorkspaceSystem(currentWorkspace, updatedSystem)
      const orbitRadii = { ...nextWorkspace.layout.orbitRadii }
      const defaultRadius = defaultOrbitRadius(system, orbit)
      const savedRadii = currentWorkspace.layout.orbitRadii[orbit.id]
        ?? { horizontal: defaultRadius, vertical: defaultRadius }
      if (
        savedRadii.horizontal !== request.radii.horizontal
        || savedRadii.vertical !== request.radii.vertical
      ) {
        orbitRadii[orbit.id] = request.radii
      }
      await commit({
        ...nextWorkspace,
        layout: {
          ...nextWorkspace.layout,
          orbitRadii,
        },
      })
      mapInspectorRef.value?.orbitSaveSucceeded()
      editorError.value = ''
    } catch (error) {
      editorError.value = errorText(error)
    }
  }

  return {
    orbitAdjustmentNotice,
    moveSystem,
    moveMapObject,
    placeMapObjectInOrbit,
    rotateMapObject,
    resizeMapOrbit,
    rotateMapOrbit,
    moveMapOrbitCenter,
    detachSelectedOrbit,
    beginObjectEdit,
    beginOrbitEdit,
    saveObjectEdit,
    saveOrbitEdit,
  }
}
