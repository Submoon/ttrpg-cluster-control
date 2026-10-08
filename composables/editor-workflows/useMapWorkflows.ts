/**
 * Translates map and inspector intents into workspace commits; transient SVG drag previews stay renderer-local.
 */
import type { ComputedRef, Ref, ShallowRef } from 'vue'
import {
  canPlaceObjectInOrbit,
  createOrbit,
  createSystemObject,
  defaultOrbitRadius,
  detachOrbit,
  minimumOrbitRadius,
  moveOrbit,
  moveOrbitCenter,
  normalizeOrbitRotation,
  replaceWorkspaceSystem,
  updateSystemObject,
  type CatalogueSubtype,
  type LocalWorkspace,
  type Orbit,
  type OrbitRadii,
  type Point,
  type StarSystem,
  type SystemObject,
} from '../../domain/workspace'
import type {
  MapInspectorHandle,
  ObjectEditRequest,
  OrbitEditRequest,
  SystemMapHandle,
} from './types'

interface MapWorkflowOptions {
  workspace: Readonly<Ref<LocalWorkspace | null>>
  commit: (nextWorkspace: LocalWorkspace) => Promise<void>
  selectedSystem: Readonly<ComputedRef<StarSystem | undefined>>
  selectedObject: Readonly<ComputedRef<SystemObject | undefined>>
  selectedOrbit: Readonly<ComputedRef<Orbit | undefined>>
  selectedObjectId: Ref<string | null>
  selectedOrbitId: Ref<string | null>
  mapInspectorRef: ShallowRef<MapInspectorHandle | null>
  systemMapRef: ShallowRef<SystemMapHandle | null>
  confirmDiscardInspectorEdits: () => boolean
  editorError: Ref<string>
}

/**
 * Builds system-map commands around the page commit and inspector draft-acknowledgement boundaries.
 * @param options Current selection refs, renderer handles, discard guard, and persistence callback.
 * @returns Map edit commands; rejected edits are exposed through editorError rather than thrown to the UI.
 */
export function useMapWorkflows({
  workspace,
  commit,
  selectedSystem,
  selectedObject,
  selectedOrbit,
  selectedObjectId,
  selectedOrbitId,
  mapInspectorRef,
  systemMapRef,
  confirmDiscardInspectorEdits,
  editorError,
}: MapWorkflowOptions) {
  function errorText(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
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
    if (mapInspectorRef.value?.isEditingObject(objectId)) return
    const system = selectedSystem.value
    const object = system?.objects.find(candidate => candidate.id === objectId)
    const objectFieldSettings = workspace.value?.objectFieldSettings
    if (!system || !object || !objectFieldSettings) return

    try {
      if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
        throw new Error('A map position must contain finite coordinates.')
      }
      const updatedSystem = updateSystemObject(system, object.id, {
        placement: {
          kind: 'system',
          x: position.x,
          y: position.y,
        },
      }, objectFieldSettings)
      await saveSystem(updatedSystem)
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
    if (mapInspectorRef.value?.isEditingObject(objectId)) return
    const currentWorkspace = workspace.value
    const system = selectedSystem.value
    const object = system?.objects.find(candidate => candidate.id === objectId)
    const objectFieldSettings = currentWorkspace?.objectFieldSettings
    if (!currentWorkspace || !system || !object || !objectFieldSettings) return

    try {
      if (!Number.isFinite(angle)) throw new Error('An orbital angle must be finite.')
      if (!canPlaceObjectInOrbit(system, object.id, orbitId)) {
        throw new Error('Choose a valid Orbit for this object.')
      }
      const updatedSystem = updateSystemObject(system, object.id, {
        placement: { kind: 'orbit', orbitId },
      }, objectFieldSettings)
      const nextWorkspace = replaceWorkspaceSystem(currentWorkspace, updatedSystem)
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
    if (mapInspectorRef.value?.isEditingObject(objectId)) return
    const currentWorkspace = workspace.value
    const object = selectedSystem.value?.objects.find(candidate => candidate.id === objectId)
    if (!currentWorkspace || object?.placement.kind !== 'orbit') return

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
    const system = selectedSystem.value
    if (!system) return

    try {
      await saveSystem(moveOrbitCenter(system, orbitId, center, hostId))
      editorError.value = ''
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
    const currentWorkspace = workspace.value
    const system = selectedSystem.value
    const orbit = selectedOrbit.value
    if (
      !currentWorkspace
      || !system
      || !orbit
      || orbit.hostId === null
      || !confirmDiscardInspectorEdits()
    ) return

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
  function beginObjectEdit(): void {
    if (!selectedObject.value || !confirmDiscardInspectorEdits()) return
    mapInspectorRef.value?.startObjectEdit()
    editorError.value = ''
  }

  /** Starts the selected Orbit draft only after any other inspector draft is accepted or discarded. */
  function beginOrbitEdit(): void {
    if (!selectedOrbit.value || !confirmDiscardInspectorEdits()) return
    mapInspectorRef.value?.startOrbitEdit()
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
   * Adds a catalogue object from a click/keyboard intent or a map drop.
   * Drop points use SVG scene coordinates and are converted to normalized initial-scene placement;
   * an Orbit drop angle, when supplied, is stored in radians. Click/keyboard additions to a selected Orbit
   * leave the angle unset so geometry uses its sibling-order default.
   * @param subtype Catalogue subtype to add.
   * @param dropPoint Optional drop position in SVG scene coordinates.
   * @param dropOrbitId Optional Orbit under a map drop; omitted click/keyboard intents use the selected Orbit.
   * @param dropAngle Optional orbital position for an Orbit drop, in radians.
   * @returns A promise that resolves after the attempt; validation and save errors populate editorError.
   */
  async function addObject(
    subtype: CatalogueSubtype,
    dropPoint?: Point,
    dropOrbitId?: string | null,
    dropAngle?: number | null,
  ): Promise<void> {
    const system = selectedSystem.value
    const currentWorkspace = workspace.value
    if (!system || !currentWorkspace || !confirmDiscardInspectorEdits()) return

    try {
      const orbitId = dropPoint
        ? dropOrbitId ?? undefined
        : selectedOrbitId.value ?? undefined
      let object = createSystemObject(system, subtype, orbitId)
      if (dropPoint && !orbitId) {
        if (!Number.isFinite(dropPoint.x) || !Number.isFinite(dropPoint.y)) {
          throw new Error('The dropped map position must contain finite coordinates.')
        }
        object = {
          ...object,
          placement: {
            kind: 'system',
            x: (dropPoint.x - 64) / 832,
            y: (dropPoint.y - 72) / 416,
          },
        }
      }

      let nextWorkspace = replaceWorkspaceSystem(currentWorkspace, {
        ...system,
        objects: [...system.objects, object],
      })
      if (dropPoint && orbitId && dropAngle !== null && dropAngle !== undefined) {
        if (!Number.isFinite(dropAngle)) {
          throw new Error('An orbital angle must be finite.')
        }
        nextWorkspace = {
          ...nextWorkspace,
          layout: {
            ...nextWorkspace.layout,
            objectAngles: {
              ...nextWorkspace.layout.objectAngles,
              [object.id]: dropAngle,
            },
          },
        }
      }

      selectedObjectId.value = object.id
      selectedOrbitId.value = null
      editorError.value = ''
      await commit(nextWorkspace)
    } catch (error) {
      editorError.value = errorText(error)
    }
  }

  /**
   * Adds an Orbit under a host or at a dropped unoccupied center.
   * A dropped center is in SVG scene coordinates and is stored in normalized map coordinates.
   * @param hostId Host object ID, or null for an unoccupied center; defaults to selected object or no host.
   * @param dropPoint Optional center supplied by the map renderer.
   * @returns A promise that resolves after the attempt; validation and save errors populate editorError.
   */
  async function addOrbit(
    hostId: string | null = selectedObject.value?.id ?? null,
    dropPoint?: Point,
  ): Promise<void> {
    const system = selectedSystem.value
    if (!system || !confirmDiscardInspectorEdits()) return

    try {
      const orbit = createOrbit(system, hostId)
      if (dropPoint && (!Number.isFinite(dropPoint.x) || !Number.isFinite(dropPoint.y))) {
        throw new Error('The dropped map position must contain finite coordinates.')
      }
      const placedOrbit: Orbit = hostId === null && dropPoint
        ? {
            ...orbit,
            hostId: null,
            center: {
              x: (dropPoint.x - 64) / 832,
              y: (dropPoint.y - 72) / 416,
            },
          }
        : orbit
      selectedOrbitId.value = placedOrbit.id
      selectedObjectId.value = null
      editorError.value = ''
      await saveSystem({ ...system, orbits: [...system.orbits, placedOrbit] })
    } catch (error) {
      editorError.value = errorText(error)
    }
  }

  /**
   * Adapts the renderer's Orbit-drop event to the shared Orbit creation command.
   * @param point Drop position in SVG scene coordinates.
   * @param hostId Object under the drop, or null for an unoccupied center.
   * @returns The addOrbit attempt.
   */
  function handleOrbitDrop(point: Point, hostId: string | null): Promise<void> {
    return addOrbit(hostId, point)
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
    addObject,
    addOrbit,
    handleOrbitDrop,
    saveOrbitEdit,
  }
}
