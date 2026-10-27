/**
 * Translates map and inspector intents into workspace commits; transient SVG drag previews stay renderer-local.
 */
import { computed, ref, type Ref, type ShallowRef } from 'vue'
import {
  canPlaceObjectInOrbit,
  defaultOrbitRadius,
  detachOrbit,
  minimumOrbitRadius,
  moveOrbitCenter,
  normalizeOrbitRotation,
  replaceWorkspaceSystem,
  updateWorkspaceObject,
  type LocalWorkspace,
  type OrbitRadii,
  type Point,
} from '../../domain/workspace'
import type {
  EntityCommand,
  SystemMapHandle,
  TransitionOptions,
} from './types'
import type { WorkspaceMutationExecutor, WorkspaceMutationResult } from './workspace-mutations'
import { useEditorUiStore } from '../../stores/editor-ui'

interface MapWorkflowOptions {
  workspace: Readonly<Ref<LocalWorkspace | null>>
  mutations: WorkspaceMutationExecutor
  systemMapRef: ShallowRef<SystemMapHandle | null>
  resolveTransition: (options?: TransitionOptions) => Promise<boolean>
  beginObjectSession: (clusterId: string, systemId: string, objectId: string) => void
  beginOrbitSession: (clusterId: string, systemId: string, orbitId: string) => void
  isEntityCommandBlocked: (command: EntityCommand) => boolean
  editorError: Ref<string>
}

/**
 * Builds system-map commands around the page publication and parent-owned draft-session boundaries.
 * @param options Current selection refs, renderer handles, draft-transition resolver, and persistence callback.
 * @returns Map edit commands; rejected edits are exposed through editorError rather than thrown to the UI.
 */
export function useMapWorkflows({
  workspace,
  mutations,
  systemMapRef,
  resolveTransition,
  beginObjectSession,
  beginOrbitSession,
  isEntityCommandBlocked,
  editorError,
}: MapWorkflowOptions) {
  const store = useEditorUiStore()
  const selectedSystem = computed(() => workspace.value?.cluster.systems.find(system => system.id === store.selectedSystemId))
  const selectedObject = computed(() => selectedSystem.value?.objects.find(object => object.id === store.selectedObjectId))
  const selectedOrbit = computed(() => selectedSystem.value?.orbits.find(orbit => orbit.id === store.selectedOrbitId))
  const orbitAdjustmentNotice = ref('')

  function rejectBlockedEntityCommand(command: EntityCommand): boolean {
    if (!isEntityCommandBlocked(command)) return false
    editorError.value = 'Resolve the Inspector draft before changing this object, Orbit, or a related dependency.'
    return true
  }

  function errorText(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
  }

  function throwIfRejected(result: WorkspaceMutationResult): void {
    if (result.status === 'rejected') throw new Error(result.message)
  }

  /**
   * Persists a cluster-map drag position after clamping each normalized coordinate to [0, 1].
   * @param systemId System being moved.
   * @param position Proposed normalized cluster-map position.
   * @returns A promise that resolves after the attempt; invalid coordinates or save failures populate editorError.
   */
  async function moveSystem(systemId: string, position: Point): Promise<void> {
    const currentWorkspace = workspace.value
    const system = currentWorkspace?.cluster.systems.find(candidate => candidate.id === systemId)
    if (!currentWorkspace || !system) return

    try {
      if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
        throw new Error('A map position must contain finite coordinates.')
      }
      const clusterId = currentWorkspace.cluster.id
      const result = await mutations.execute({
        action: {
          kind: 'move',
          label: `Move ${system.name} on Jump Cluster`,
          target: { kind: 'system', id: systemId },
          parent: { kind: 'cluster', id: clusterId },
        },
        isCurrent: () => {
          const latest = workspace.value
          return latest !== null && latest.cluster.id === clusterId
            && latest.cluster.systems.some(candidate => candidate.id === systemId)
        },
        prepare: (latest) => {
          if (latest.cluster.id !== clusterId || !latest.cluster.systems.some(candidate => candidate.id === systemId)) {
            throw new Error('The selected star system is no longer available.')
          }
          return {
            ...latest,
            layout: {
              ...latest.layout,
              systemPositions: {
                ...latest.layout.systemPositions,
                [systemId]: {
                  x: Math.max(0, Math.min(1, position.x)),
                  y: Math.max(0, Math.min(1, position.y)),
                },
              },
            },
          }
        },
      })
      throwIfRejected(result)
      if (result.status === 'applied') await result.durable
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
    if (!currentWorkspace || !system || !object) return
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
      const clusterId = currentWorkspace.cluster.id
      const originalPlacement = object.placement
      const result = await mutations.execute({
        action: {
          kind: 'move',
          label: `Move ${object.name}`,
          target: { kind: 'object', id: object.id, systemId: system.id },
          parent: { kind: 'system', id: system.id },
        },
        isCurrent: () => {
          const latest = workspace.value
          return latest !== null && latest.cluster.id === clusterId
            && store.selectedSystemId === system.id
            && latest.cluster.systems.some(candidate => candidate.id === system.id
              && candidate.objects.some(item => item.id === object.id && JSON.stringify(item.placement) === JSON.stringify(originalPlacement)))
        },
        prepare: (latest) => {
          const latestSystem = latest.cluster.systems.find(candidate => candidate.id === system.id)
          const latestObject = latestSystem?.objects.find(candidate => candidate.id === object.id)
          if (!latestSystem || !latestObject) throw new Error('The selected map object is no longer available.')
          if (rejectBlockedEntityCommand({
            kind: 'object-placement', objectId: object.id,
            fromOrbitId: latestObject.placement.kind === 'orbit' ? latestObject.placement.orbitId : null,
            toOrbitId: null,
          })) throw new Error('Resolve the Inspector draft before changing this object, Orbit, or a related dependency.')
          return updateWorkspaceObject(latest, latestSystem.id, latestObject.id, {
            placement: { kind: 'system', x: position.x, y: position.y },
          })
        },
      })
      throwIfRejected(result)
      if (result.status === 'applied') await result.durable
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
    if (!currentWorkspace || !system || !object) return
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
      const clusterId = currentWorkspace.cluster.id
      const sourcePlacement = object.placement
      const result = await mutations.execute({
        action: {
          kind: 'place',
          label: `Place ${object.name} in Orbit`,
          target: { kind: 'object', id: object.id, systemId: system.id },
          parent: { kind: 'orbit', id: orbitId, systemId: system.id },
        },
        isCurrent: () => {
          const latest = workspace.value
          return latest !== null && latest.cluster.id === clusterId
            && store.selectedSystemId === system.id
            && latest.cluster.systems.some(candidate => candidate.id === system.id
              && candidate.objects.some(item => item.id === object.id && JSON.stringify(item.placement) === JSON.stringify(sourcePlacement)))
            && latest.cluster.systems.some(candidate => candidate.id === system.id && candidate.orbits.some(item => item.id === orbitId))
        },
        prepare: (latest) => {
          const latestSystem = latest.cluster.systems.find(candidate => candidate.id === system.id)
          const latestObject = latestSystem?.objects.find(candidate => candidate.id === object.id)
          if (!latestSystem || !latestObject) throw new Error('The selected map object is no longer available.')
          if (!canPlaceObjectInOrbit(latestSystem, latestObject.id, orbitId)) throw new Error('Choose a valid Orbit for this object.')
          if (rejectBlockedEntityCommand({
            kind: 'object-placement', objectId: latestObject.id,
            fromOrbitId: latestObject.placement.kind === 'orbit' ? latestObject.placement.orbitId : null,
            toOrbitId: orbitId,
          })) throw new Error('Resolve the Inspector draft before changing this object, Orbit, or a related dependency.')
          return updateWorkspaceObject(latest, latestSystem.id, latestObject.id, {
            placement: { kind: 'orbit', orbitId },
          }, { angle })
        },
      })
      throwIfRejected(result)
      if (result.status === 'applied') await result.durable
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
      const systemId = selectedSystem.value!.id
      const clusterId = currentWorkspace.cluster.id
      const currentAngle = currentWorkspace.layout.objectAngles[objectId]
      const result = await mutations.execute({
        action: {
          kind: 'rotate',
          label: `Rotate ${object.name} in Orbit`,
          target: { kind: 'object', id: objectId, systemId },
          parent: { kind: 'system', id: systemId },
        },
        isCurrent: () => {
          const latest = workspace.value
          return latest !== null && latest.cluster.id === clusterId
            && store.selectedSystemId === systemId
            && latest.cluster.systems.some(candidate => candidate.id === systemId
              && candidate.objects.some(item => item.id === objectId && item.placement.kind === 'orbit'))
            && latest.layout.objectAngles[objectId] === currentAngle
        },
        prepare: (latest) => {
          const latestSystem = latest.cluster.systems.find(candidate => candidate.id === systemId)
          const latestObject = latestSystem?.objects.find(candidate => candidate.id === objectId)
          if (!latestObject || latestObject.placement.kind !== 'orbit') throw new Error('The selected object is no longer placed in an Orbit.')
          if (rejectBlockedEntityCommand({
            kind: 'object-placement', objectId,
            fromOrbitId: latestObject.placement.orbitId,
            toOrbitId: latestObject.placement.orbitId,
          })) throw new Error('Resolve the Inspector draft before changing this object, Orbit, or a related dependency.')
          return {
            ...latest,
            layout: {
              ...latest.layout,
              objectAngles: { ...latest.layout.objectAngles, [objectId]: angle },
            },
          }
        },
      })
      throwIfRejected(result)
      if (result.status === 'applied') await result.durable
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
      if (!Number.isFinite(radii.horizontal) || !Number.isFinite(radii.vertical)) {
        throw new Error('Orbit radii must be finite.')
      }
      const systemId = system.id
      const clusterId = currentWorkspace.cluster.id
      const result = await mutations.execute({
        action: {
          kind: 'resize',
          label: `Resize Orbit ${orbit.order}`,
          target: { kind: 'orbit', id: orbitId, systemId },
          parent: { kind: 'system', id: systemId },
        },
        isCurrent: () => {
          const latest = workspace.value
          return latest !== null && latest.cluster.id === clusterId
            && store.selectedSystemId === systemId
            && latest.cluster.systems.some(candidate => candidate.id === systemId && candidate.orbits.some(item => item.id === orbitId))
        },
        prepare: (latest) => {
          const latestSystem = latest.cluster.systems.find(candidate => candidate.id === systemId)
          const latestOrbit = latestSystem?.orbits.find(candidate => candidate.id === orbitId)
          if (!latestSystem || !latestOrbit) throw new Error('The selected Orbit is no longer available.')
          if (rejectBlockedEntityCommand({ kind: 'orbit-geometry', orbitId })) throw new Error('Resolve the Inspector draft before changing this object, Orbit, or a related dependency.')
          const minimum = minimumOrbitRadius(latestSystem, latestOrbit)
          return {
            ...latest,
            layout: {
              ...latest.layout,
              orbitRadii: {
                ...latest.layout.orbitRadii,
                [orbitId]: {
                  horizontal: Math.max(minimum, Math.round(radii.horizontal)),
                  vertical: Math.max(minimum, Math.round(radii.vertical)),
                },
              },
            },
          }
        },
      })
      throwIfRejected(result)
      if (result.status === 'applied') await result.durable
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
      const systemId = system.id
      const clusterId = currentWorkspace.cluster.id
      const result = await mutations.execute({
        action: {
          kind: 'rotate',
          label: `Rotate Orbit ${system.orbits.find(candidate => candidate.id === orbitId)?.order ?? ''}`.trim(),
          target: { kind: 'orbit', id: orbitId, systemId },
          parent: { kind: 'system', id: systemId },
        },
        isCurrent: () => {
          const latest = workspace.value
          return latest !== null && latest.cluster.id === clusterId
            && store.selectedSystemId === systemId
            && latest.cluster.systems.some(candidate => candidate.id === systemId && candidate.orbits.some(item => item.id === orbitId))
        },
        prepare: (latest) => {
          const latestSystem = latest.cluster.systems.find(candidate => candidate.id === systemId)
          if (!latestSystem?.orbits.some(candidate => candidate.id === orbitId)) throw new Error('The selected Orbit is no longer available.')
          if (rejectBlockedEntityCommand({ kind: 'orbit-geometry', orbitId })) throw new Error('Resolve the Inspector draft before changing this object, Orbit, or a related dependency.')
          return {
            ...latest,
            layout: {
              ...latest.layout,
              orbitRotations: { ...latest.layout.orbitRotations, [orbitId]: normalizeOrbitRotation(degrees) },
            },
          }
        },
      })
      throwIfRejected(result)
      if (result.status === 'applied') await result.durable
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
      const clusterId = currentWorkspace.cluster.id
      const selectedSystemId = system.id
      let adjustedMinimum: number | undefined
      const result = await mutations.execute({
        action: {
          kind: 'move',
          label: hostId === null ? `Move Orbit ${currentOrbit.order}` : `Attach Orbit ${currentOrbit.order}`,
          target: { kind: 'orbit', id: orbitId, systemId: selectedSystemId },
          parent: { kind: 'system', id: selectedSystemId },
        },
        isCurrent: () => {
          const latest = workspace.value
          return latest !== null && latest.cluster.id === clusterId
            && store.selectedSystemId === selectedSystemId
            && latest.cluster.systems.some(candidate => candidate.id === selectedSystemId && candidate.orbits.some(item => item.id === orbitId))
            && !rejectBlockedEntityCommand(command)
        },
        prepare: (latest) => {
          const latestSystem = latest.cluster.systems.find(candidate => candidate.id === selectedSystemId)
          if (!latestSystem?.orbits.some(candidate => candidate.id === orbitId)) throw new Error('The selected Orbit is no longer available.')
          const orbitRadii = { ...latest.layout.orbitRadii }
          if (hostId !== null) {
            for (const freeOrbit of latestSystem.orbits.filter(candidate => candidate.hostId === null)) {
              const savedRadii = latest.layout.orbitRadii[freeOrbit.id]
              const defaultRadius = defaultOrbitRadius(latestSystem, freeOrbit)
              orbitRadii[freeOrbit.id] = savedRadii
                ? { horizontal: savedRadii.horizontal, vertical: savedRadii.vertical }
                : { horizontal: defaultRadius, vertical: defaultRadius }
            }
          }
          const updatedSystem = moveOrbitCenter(latestSystem, orbitId, center, hostId)
          let prepared = replaceWorkspaceSystem(
            hostId !== null ? { ...latest, layout: { ...latest.layout, orbitRadii } } : latest,
            updatedSystem,
          )
          const updatedOrbit = updatedSystem.orbits.find(candidate => candidate.id === orbitId)
          const minimum = hostId !== null && updatedOrbit ? minimumOrbitRadius(updatedSystem, updatedOrbit) : undefined
          const sourceRadii = minimum !== undefined ? orbitRadii[orbitId] : undefined
          const adjustedRadii = sourceRadii && minimum !== undefined
            ? { horizontal: Math.max(sourceRadii.horizontal, minimum), vertical: Math.max(sourceRadii.vertical, minimum) }
            : undefined
          const adjusted = adjustedRadii !== undefined && sourceRadii !== undefined && (
            adjustedRadii.horizontal !== sourceRadii.horizontal || adjustedRadii.vertical !== sourceRadii.vertical
          )
          adjustedMinimum = adjusted ? minimum : undefined
          if (adjustedRadii) {
            prepared = {
              ...prepared,
              layout: { ...prepared.layout, orbitRadii: { ...prepared.layout.orbitRadii, [orbitId]: adjustedRadii } },
            }
          }
          return prepared
        },
      })
      throwIfRejected(result)
      editorError.value = ''
      orbitAdjustmentNotice.value = ''
      if (result.status === 'applied') {
        if (adjustedMinimum !== undefined) {
          orbitAdjustmentNotice.value = `Orbit radii increased to the new host minimum of ${adjustedMinimum}.`
        }
        await result.durable
      }
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
      const clusterId = currentWorkspace.cluster.id
      const result = await mutations.execute({
        action: {
          kind: 'detach',
          label: `Detach Orbit ${orbit.order}`,
          target: { kind: 'orbit', id: orbit.id, systemId },
          parent: { kind: 'system', id: systemId },
        },
        isCurrent: () => {
          const latest = workspace.value
          return latest !== null && latest.cluster.id === clusterId
            && store.selectedSystemId === systemId
            && store.selectedOrbitId === orbitId
            && latest.cluster.systems.some(candidate => candidate.id === systemId && candidate.orbits.some(item => item.id === orbitId && item.hostId !== null))
            && !rejectBlockedEntityCommand({ kind: 'orbit-host', orbitId, hostId: null })
        },
        prepare: (latest) => {
          const latestSystem = latest.cluster.systems.find(candidate => candidate.id === systemId)
          const latestOrbit = latestSystem?.orbits.find(candidate => candidate.id === orbitId)
          if (!latestSystem || !latestOrbit || latestOrbit.hostId === null) throw new Error('The selected Orbit is no longer hosted.')
          const latestMap = systemMapRef.value
          if (!latestMap) throw new Error('The system map is not ready.')
          const latestCenter = latestMap.getDetachedOrbitCenter(latestOrbit.id)
          if (!latestCenter) throw new Error('Could not find a nearby empty location for this Orbit.')
          const prepared = replaceWorkspaceSystem(latest, detachOrbit(latestSystem, latestOrbit.id, latestCenter))
          const defaultRadius = defaultOrbitRadius(latestSystem, latestOrbit)
          return {
            ...prepared,
            layout: {
              ...prepared.layout,
              orbitRadii: {
                ...prepared.layout.orbitRadii,
                [latestOrbit.id]: latest.layout.orbitRadii[latestOrbit.id]
                  ?? { horizontal: defaultRadius, vertical: defaultRadius },
              },
            },
          }
        },
      })
      throwIfRejected(result)
      if (result.status === 'applied') await result.durable
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
  }
}
