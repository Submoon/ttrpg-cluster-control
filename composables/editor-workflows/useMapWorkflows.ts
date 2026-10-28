/**
 * Translates map and inspector intents into workspace commits; transient SVG drag previews stay renderer-local.
 */
import { computed, ref, type Ref, type ShallowRef } from 'vue'
import {
  canPlaceObjectInOrbit,
  defaultObjectOrbitAngle,
  defaultOrbitRadius,
  detachOrbit,
  minimumOrbitRadius,
  moveOrbitCenter,
  normalizeOrbitRotation,
  replaceWorkspaceSystem,
  updateWorkspaceObject,
  type LocalWorkspace,
  type ObjectPlacement,
  type OrbitRadii,
  type Point,
} from '../../domain/workspace'
import type {
  OrbitAdjustmentGeometry,
  OrbitAdjustmentIntent,
  createContinuousOrbitAdjustmentController,
} from './continuous-orbit-adjustments'
import type {
  CommittedObjectPosition,
  EntityCommand,
  SystemMapHandle,
  TransitionOptions,
} from './types'
import type { WorkspaceMutationExecutor, WorkspaceMutationRequest, WorkspaceMutationResult } from './workspace-mutations'
import { useEditorUiStore } from '../../stores/editor-ui'
import { objectPositions, orbitCenter as resolveOrbitCenter, orbitRadii as resolveOrbitRadii, orbitRotation as resolveOrbitRotation, toNormalizedMapPoint } from '../../utils/system-map-geometry'

type OrbitAdjustmentController = Pick<ReturnType<typeof createContinuousOrbitAdjustmentController>, 'update'>

function sameGeometryNumber(left: number, right: number): boolean {
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(left), Math.abs(right)) * 4
  return Math.abs(left - right) <= tolerance
}

interface MapWorkflowOptions {
  workspace: Readonly<Ref<LocalWorkspace | null>>
  mutations: WorkspaceMutationExecutor
  systemMapRef: ShallowRef<SystemMapHandle | null>
  resolveTransition: (options?: TransitionOptions) => Promise<boolean>
  beginObjectSession: (clusterId: string, systemId: string, objectId: string) => void
  beginOrbitSession: (clusterId: string, systemId: string, orbitId: string) => void
  isEntityCommandBlocked: (command: EntityCommand) => boolean
  acceptCommittedPosition?: (change: CommittedObjectPosition) => boolean
  acceptCommittedOrbitCenter?: (change: {
    orbitId: string
    previous: Point
    next: Point
    command: Extract<EntityCommand, { kind: 'orbit-center-position' }>
  }) => void
  editorError: Ref<string>
  orbitAdjustments: OrbitAdjustmentController
  beforeWorkspaceOperation(): Promise<boolean>
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
  acceptCommittedPosition,
  acceptCommittedOrbitCenter,
  editorError,
  orbitAdjustments,
  beforeWorkspaceOperation,
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

  function readOrbitAdjustmentGeometry(intent: OrbitAdjustmentIntent): OrbitAdjustmentGeometry {
    const currentWorkspace = workspace.value
    if (!currentWorkspace || currentWorkspace.id !== intent.workspaceId) {
      throw new Error('The workspace changed before this Orbit adjustment could be read.')
    }
    const system = currentWorkspace.cluster.systems.find(candidate => candidate.id === intent.systemId)
    const orbit = system?.orbits.find(candidate => candidate.id === intent.orbitId)
    if (!system || !orbit) throw new Error('The selected Orbit is no longer available.')
    const mapGeometry = {
      objectAngles: currentWorkspace.layout.objectAngles,
      orbitRadii: currentWorkspace.layout.orbitRadii,
      orbitRotations: currentWorkspace.layout.orbitRotations,
    }
    const positions = objectPositions(system, mapGeometry)
    return {
      center: toNormalizedMapPoint(resolveOrbitCenter(orbit, positions)),
      radii: resolveOrbitRadii(system, orbit, mapGeometry),
      rotation: resolveOrbitRotation(orbit, mapGeometry),
    }
  }

  function buildOrbitAdjustmentRequest(
    intent: OrbitAdjustmentIntent,
    geometry: OrbitAdjustmentGeometry,
  ): WorkspaceMutationRequest {
    const currentWorkspace = workspace.value
    const system = currentWorkspace?.cluster.systems.find(candidate => candidate.id === intent.systemId)
    const orbit = system?.orbits.find(candidate => candidate.id === intent.orbitId)
    if (!currentWorkspace || currentWorkspace.id !== intent.workspaceId || !system || !orbit) {
      throw new Error('The selected Orbit is no longer available.')
    }
    const clusterId = currentWorkspace.cluster.id
    const change = intent.change
    if (change.kind === 'center' && orbit.hostId !== null) {
      throw new Error('Only an unoccupied Orbit center can be moved.')
    }
    const command: EntityCommand = { kind: 'orbit-geometry', orbitId: intent.orbitId }
    const actionKind = change.kind === 'radii' ? 'resize' as const : change.kind === 'rotation' ? 'rotate' as const : 'move' as const
    const label = change.kind === 'radii'
      ? `Resize Orbit ${orbit.order}`
      : change.kind === 'rotation'
        ? `Rotate Orbit ${orbit.order}`
        : `Move Orbit ${orbit.order}`

    return {
      action: {
        kind: actionKind,
        label,
        target: { kind: 'orbit', id: orbit.id, systemId: system.id },
        parent: { kind: 'system', id: system.id },
      },
      isCurrent: () => {
        const latest = workspace.value
        const latestOrbit = latest?.cluster.systems.find(candidate => candidate.id === system.id)
          ?.orbits.find(item => item.id === orbit.id)
        return latest !== null && latest.id === intent.workspaceId && latest.cluster.id === clusterId
          && store.activeView === 'system' && store.selectedSystemId === system.id
          && latestOrbit !== undefined
          && (change.kind !== 'center' || latestOrbit.hostId === null)
          && !isEntityCommandBlocked(command)
      },
      prepare: (latest) => {
        const latestSystem = latest.cluster.systems.find(candidate => candidate.id === system.id)
        const latestOrbit = latestSystem?.orbits.find(candidate => candidate.id === orbit.id)
        if (!latestSystem || !latestOrbit) throw new Error('The selected Orbit is no longer available.')
        if (change.kind === 'center' && latestOrbit.hostId !== null) {
          throw new Error('Only an unoccupied Orbit center can be moved.')
        }
        if (isEntityCommandBlocked(command)) throw new Error('Resolve the Inspector draft before changing this Orbit.')
        if (change.kind === 'radii') {
          const minimum = minimumOrbitRadius(latestSystem, latestOrbit)
          const currentRadii = resolveOrbitRadii(latestSystem, latestOrbit, {
            objectAngles: latest.layout.objectAngles,
            orbitRadii: latest.layout.orbitRadii,
            orbitRotations: latest.layout.orbitRotations,
          })
          if (sameGeometryNumber(geometry.radii.horizontal, currentRadii.horizontal)
            && sameGeometryNumber(geometry.radii.vertical, currentRadii.vertical)) return latest

          return {
            ...latest,
            layout: {
              ...latest.layout,
              orbitRadii: {
                ...latest.layout.orbitRadii,
                [orbit.id]: {
                  horizontal: change.axis === 'vertical'
                    ? currentRadii.horizontal
                    : Math.max(minimum, Math.round(geometry.radii.horizontal)),
                  vertical: change.axis === 'horizontal'
                    ? currentRadii.vertical
                    : Math.max(minimum, Math.round(geometry.radii.vertical)),
                },
              },
            },
          }
        }
        if (change.kind === 'rotation') {
          const currentRotation = resolveOrbitRotation(latestOrbit, {
            objectAngles: latest.layout.objectAngles,
            orbitRadii: latest.layout.orbitRadii,
            orbitRotations: latest.layout.orbitRotations,
          })
          const nextRotation = normalizeOrbitRotation(geometry.rotation)
          if (sameGeometryNumber(nextRotation, currentRotation)) return latest
          return {
            ...latest,
            layout: {
              ...latest.layout,
              orbitRotations: { ...latest.layout.orbitRotations, [orbit.id]: nextRotation },
            },
          }
        }
        const currentCenter = toNormalizedMapPoint(resolveOrbitCenter(latestOrbit, objectPositions(latestSystem, {
          objectAngles: latest.layout.objectAngles,
          orbitRadii: latest.layout.orbitRadii,
          orbitRotations: latest.layout.orbitRotations,
        })))
        if (sameGeometryNumber(geometry.center.x, currentCenter.x)
          && sameGeometryNumber(geometry.center.y, currentCenter.y)) return latest
        return replaceWorkspaceSystem(latest, moveOrbitCenter(latestSystem, orbit.id, geometry.center, null))
      },
    }
  }

  async function updateOrbitAdjustment(intent: OrbitAdjustmentIntent) {
    const command: EntityCommand = { kind: 'orbit-geometry', orbitId: intent.orbitId }
    if (store.activeView !== 'system' || store.mapMode !== 'move' || store.selectedSystemId !== intent.systemId) {
      return { status: 'rejected', reason: 'stale', message: 'The selected system changed before this Orbit adjustment was received.' } as const
    }
    if (rejectBlockedEntityCommand(command)) {
      return { status: 'rejected', reason: 'unavailable', message: 'Resolve the Inspector draft before changing this Orbit.' } as const
    }
    const result = await orbitAdjustments.update(
      intent,
      () => readOrbitAdjustmentGeometry(intent),
      geometry => buildOrbitAdjustmentRequest(intent, geometry),
    )
    if (result.status === 'rejected') editorError.value = result.message
    else editorError.value = ''
    return result
  }

  function effectiveObjectAngle(currentWorkspace: LocalWorkspace, systemId: string, objectId: string): number | undefined {
    const system = currentWorkspace.cluster.systems.find(candidate => candidate.id === systemId)
    const object = system?.objects.find(candidate => candidate.id === objectId)
    if (!system || !object || object.placement.kind !== 'orbit') return undefined
    const orbitId = object.placement.orbitId
    const saved = currentWorkspace.layout.objectAngles[objectId]
    if (typeof saved === 'number' && Number.isFinite(saved)) return saved
    const siblings = system.objects.filter(candidate =>
      candidate.placement.kind === 'orbit' && candidate.placement.orbitId === orbitId,
    )
    return defaultObjectOrbitAngle(siblings.findIndex(candidate => candidate.id === objectId), siblings.length)
  }

  /**
   * Persists a cluster-map drag position after clamping each normalized coordinate to [0, 1].
   * @param systemId System being moved.
   * @param position Proposed normalized cluster-map position.
   * @returns A promise that resolves after the attempt; invalid coordinates or save failures populate editorError.
   */
  async function moveSystem(systemId: string, position: Point): Promise<void> {
    if (!await beforeWorkspaceOperation()) return
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
    if (!await beforeWorkspaceOperation()) return
    const currentWorkspace = workspace.value
    const selectedSystemId = selectedSystem.value?.id
    const system = currentWorkspace?.cluster.systems.find(candidate => candidate.id === selectedSystemId)
    const object = system?.objects.find(candidate => candidate.id === objectId)
    if (!currentWorkspace || !system || !object) return
    const command: Extract<EntityCommand, { kind: 'object-placement' }> = {
      kind: 'object-placement',
      objectId,
      fromOrbitId: object.placement.kind === 'orbit' ? object.placement.orbitId : null,
      toOrbitId: null,
    }
    if (rejectBlockedEntityCommand(command)) return

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
      if (result.status === 'applied') {
        const nextPlacement: ObjectPlacement = { kind: 'system', x: position.x, y: position.y }
        acceptCommittedPosition?.({
          objectId,
          previousPlacement: object.placement,
          nextPlacement,
          ...(object.placement.kind === 'orbit'
            ? { previousAngle: effectiveObjectAngle(currentWorkspace, system.id, objectId) }
            : {}),
          command,
        })
        await result.durable
      }
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
    if (!await beforeWorkspaceOperation()) return
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
      if (result.status === 'applied') {
        acceptCommittedPosition?.({
          objectId,
          previousPlacement: object.placement,
          nextPlacement: { kind: 'orbit', orbitId },
          ...(object.placement.kind === 'orbit'
            ? { previousAngle: effectiveObjectAngle(currentWorkspace, system.id, objectId) }
            : {}),
          nextAngle: angle,
          command: {
            kind: 'object-placement',
            objectId,
            fromOrbitId: object.placement.kind === 'orbit' ? object.placement.orbitId : null,
            toOrbitId: orbitId,
          },
        })
        await result.durable
      }
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
    if (!await beforeWorkspaceOperation()) return
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
      const previousAngle = effectiveObjectAngle(currentWorkspace, systemId, objectId)
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
      if (result.status === 'applied') {
        acceptCommittedPosition?.({
          objectId,
          previousPlacement: object.placement,
          nextPlacement: object.placement,
          ...(previousAngle !== undefined ? { previousAngle } : {}),
          nextAngle: angle,
          command: {
            kind: 'object-placement',
            objectId,
            fromOrbitId: object.placement.orbitId,
            toOrbitId: object.placement.orbitId,
          },
        })
        await result.durable
      }
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
    if (!await beforeWorkspaceOperation()) return
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
    if (!await beforeWorkspaceOperation()) return
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
    operationIsCurrent?: () => boolean,
  ): Promise<boolean> {
    if (!await beforeWorkspaceOperation()) return false
    const currentWorkspace = workspace.value
    const selectedSystemId = selectedSystem.value?.id
    const system = currentWorkspace?.cluster.systems.find(candidate => candidate.id === selectedSystemId)
    if (!currentWorkspace || !system) return false
    const currentOrbit = system.orbits.find(candidate => candidate.id === orbitId)
    if (!currentOrbit) return false
    const isFreeCenterMove = currentOrbit.hostId === null && hostId === null
    const previousCenter = isFreeCenterMove ? { ...currentOrbit.center } : null
    const command: EntityCommand = isFreeCenterMove
      ? { kind: 'orbit-center-position', orbitId }
      : currentOrbit.hostId === hostId
        ? { kind: 'orbit-geometry', orbitId }
        : { kind: 'orbit-host', orbitId, hostId }
    if (rejectBlockedEntityCommand(command)) return false

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
          const latestOrbit = latest?.cluster.systems.find(candidate => candidate.id === selectedSystemId)
            ?.orbits.find(item => item.id === orbitId)
          const centerUnchanged = !isFreeCenterMove || (latestOrbit?.hostId === null
            && previousCenter !== null
            && latestOrbit.center.x === previousCenter.x
            && latestOrbit.center.y === previousCenter.y)
          return latest !== null && latest.cluster.id === clusterId
            && store.selectedSystemId === selectedSystemId
            && latestOrbit !== undefined
            && latestOrbit.hostId === currentOrbit.hostId
            && centerUnchanged
            && (operationIsCurrent === undefined || operationIsCurrent())
            && !rejectBlockedEntityCommand(command)
        },
        prepare: (latest) => {
          if (operationIsCurrent && !operationIsCurrent()) {
            throw new Error('The Orbit-center move was canceled or replaced before it could be applied.')
          }
          const latestSystem = latest.cluster.systems.find(candidate => candidate.id === selectedSystemId)
          const latestOrbit = latestSystem?.orbits.find(candidate => candidate.id === orbitId)
          if (!latestSystem || !latestOrbit) throw new Error('The selected Orbit is no longer available.')
          if (latestOrbit.hostId !== currentOrbit.hostId) {
            throw new Error('The Orbit center or host changed before this move could be applied.')
          }
          if (isFreeCenterMove && (latestOrbit.hostId !== null || previousCenter === null
            || latestOrbit.center.x !== previousCenter.x || latestOrbit.center.y !== previousCenter.y)) {
            throw new Error('The Orbit center or host changed before this move could be applied.')
          }
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
        if (isFreeCenterMove && previousCenter) {
          acceptCommittedOrbitCenter?.({
            orbitId,
            previous: previousCenter,
            next: { ...center },
            command: { kind: 'orbit-center-position', orbitId },
          })
        }
        if (adjustedMinimum !== undefined) {
          orbitAdjustmentNotice.value = `Orbit radii increased to the new host minimum of ${adjustedMinimum}.`
        }
        void result.durable.catch(() => undefined)
      }
      return result.status === 'applied' || result.status === 'unchanged'
    } catch (error) {
      editorError.value = errorText(error)
      return false
    }
  }

  /**
   * Finds a point-clear unoccupied center, detaches the selected Orbit, and preserves its effective radii.
   * The search does not promise clearance between the full rings of separate Orbits.
   * @returns A promise that resolves after the attempt or any early guard; failures populate editorError.
   */
  async function detachSelectedOrbit(): Promise<void> {
    if (!await beforeWorkspaceOperation()) return
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
    updateOrbitAdjustment,
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
