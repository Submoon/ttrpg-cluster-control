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

  async function saveSystem(system: StarSystem): Promise<void> {
    const currentWorkspace = workspace.value
    if (!currentWorkspace) {
      throw new Error('Create a local workspace before editing a star system.')
    }
    await commit(replaceWorkspaceSystem(currentWorkspace, system))
  }

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

  function beginObjectEdit(): void {
    if (!selectedObject.value || !confirmDiscardInspectorEdits()) return
    mapInspectorRef.value?.startObjectEdit()
    editorError.value = ''
  }

  function beginOrbitEdit(): void {
    if (!selectedOrbit.value || !confirmDiscardInspectorEdits()) return
    mapInspectorRef.value?.startOrbitEdit()
    editorError.value = ''
  }

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

  function handleOrbitDrop(point: Point, hostId: string | null): Promise<void> {
    return addOrbit(hostId, point)
  }

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
