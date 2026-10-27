/**
 * Owns resumable object and Orbit drafts above Inspector presentation and applies them to latest workspace memory.
 */
import { computed, ref, watch, type Ref } from 'vue'
import {
  defaultOrbitRadius,
  initialSystemPlacement,
  isCustomFieldApplicableToObject,
  minimumOrbitRadius,
  moveOrbitCenter,
  normalizeOrbitRotation,
  planMapEntityDeletion,
  replaceWorkspaceSystem,
  type CustomFieldDefinition,
  type LocalWorkspace,
  type MapDeletionTarget,
  type ObjectFieldSettings,
  type Orbit,
  type OrbitRadii,
  type Point,
  type StarSystem,
  type SystemObject,
} from '../../domain/workspace'
import type {
  EntityCommand,
  EntityDependencyBaseline,
  EntityInspectorSession,
  ObjectEditBaseline,
  OrbitCenterMoveCandidate,
  OrbitEditBaseline,
  OrbitPlacementPreview,
} from './types'
import type { WorkspaceMutationExecutor } from './workspace-mutations'
import { objectDraftValuesFor } from './entity-draft-values'
import { parseFiniteInput, validateObjectDraft } from './entity-draft-validation'
import { objectPositions, objectsMovedWithOrbit } from '../../utils/system-map-geometry'
import { catalogueObjectLabel } from '../../utils/catalogue-labels'

interface EntityInspectorSessionOptions {
  workspace: Readonly<Ref<LocalWorkspace | null>>
  mutations: WorkspaceMutationExecutor
}

interface DraftDependencySnapshots {
  sessionId: number
  placements: Map<string, EntityDependencyBaseline>
  stations: Map<string, Pick<SystemObject, 'id' | 'family' | 'subtype'>>
  orbitHosts: Map<string, OrbitHostDependencySnapshot>
}

interface OrbitHostDependencySnapshot {
  object: Pick<SystemObject, 'id' | 'family' | 'subtype' | 'placement'>
  placement: EntityDependencyBaseline
  siblings: Array<Pick<Orbit, 'id' | 'hostId' | 'order'>>
  scenePosition: Point
}

interface OrbitPlacementPreviewState {
  sessionId: number
  orbitId: string
  hostId: string
  signature: string
  preview: OrbitPlacementPreview
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function isPhysicalStation(object: SystemObject): boolean {
  return object.family === 'Installation' && object.subtype === 'station'
}

function effectiveOrbitRadii(workspace: LocalWorkspace, system: StarSystem, orbit: Orbit): OrbitRadii {
  const saved = workspace.layout.orbitRadii[orbit.id]
  const fallback = defaultOrbitRadius(system, orbit)
  return saved ? { horizontal: saved.horizontal, vertical: saved.vertical } : { horizontal: fallback, vertical: fallback }
}

function captureOrbitDependencies(
  workspace: LocalWorkspace,
  system: StarSystem,
  firstOrbitId: string,
): EntityDependencyBaseline {
  const objects = new Map<string, Pick<SystemObject, 'id' | 'family' | 'subtype' | 'placement'>>()
  const orbits = new Map<string, Orbit>()
  const orbitRadii: Record<string, OrbitRadii> = {}
  const orbitRotations: Record<string, number> = {}
  const visitedOrbits = new Set<string>()
  const visitedObjects = new Set<string>()
  let orbitId: string | undefined = firstOrbitId

  while (orbitId && !visitedOrbits.has(orbitId)) {
    visitedOrbits.add(orbitId)
    const orbit = system.orbits.find(candidate => candidate.id === orbitId)
    if (!orbit) break
    orbits.set(orbit.id, clone(orbit))
    orbitRadii[orbit.id] = effectiveOrbitRadii(workspace, system, orbit)
    orbitRotations[orbit.id] = workspace.layout.orbitRotations[orbit.id] ?? 0
    if (orbit.hostId === null) break

    const host = system.objects.find(candidate => candidate.id === orbit.hostId)
    if (!host) break
    objects.set(host.id, {
      id: host.id,
      family: host.family,
      subtype: host.subtype,
      placement: clone(host.placement),
    })
    if (visitedObjects.has(host.id) || host.placement.kind !== 'orbit') break
    visitedObjects.add(host.id)
    orbitId = host.placement.orbitId
  }

  return {
    objects: [...objects.values()],
    orbits: [...orbits.values()],
    orbitRadii,
    orbitRotations,
  }
}

function captureObjectPlacementDependencies(
  workspace: LocalWorkspace,
  system: StarSystem,
  object: SystemObject,
): EntityDependencyBaseline {
  return object.placement.kind === 'orbit'
    ? captureOrbitDependencies(workspace, system, object.placement.orbitId)
    : { objects: [], orbits: [], orbitRadii: {}, orbitRotations: {} }
}

function captureOrbitHostDependencies(
  workspace: LocalWorkspace,
  system: StarSystem,
  hostId: string,
): OrbitHostDependencySnapshot | undefined {
  const host = system.objects.find(object => object.id === hostId)
  if (!host) return undefined
  try {
    const scenePosition = objectPositions(system, {
      objectAngles: workspace.layout.objectAngles,
      orbitRadii: workspace.layout.orbitRadii,
      orbitRotations: workspace.layout.orbitRotations,
    }).get(hostId)
    if (!scenePosition) return undefined
    return {
      object: {
        id: host.id,
        family: host.family,
        subtype: host.subtype,
        placement: clone(host.placement),
      },
      placement: captureObjectPlacementDependencies(workspace, system, host),
      siblings: system.orbits
        .filter(orbit => orbit.hostId === hostId)
        .sort((left, right) => left.order - right.order)
        .map(orbit => ({ id: orbit.id, hostId: orbit.hostId, order: orbit.order })),
      scenePosition: clone(scenePosition),
    }
  } catch {
    return undefined
  }
}

function validateOrbitCenterMoveCandidate(
  currentWorkspace: LocalWorkspace,
  system: StarSystem,
  orbit: Orbit,
  candidate: OrbitCenterMoveCandidate,
): OrbitCenterMoveCandidate {
  if (candidate.target.kind !== 'host') return { ...candidate }
  const hostId = candidate.target.objectId
  const host = system.objects.find(object => object.id === hostId)
  let error = candidate.error
  if (!error) {
    if (!host) error = 'This map object is no longer available as an Orbit host.'
    else if (objectsMovedWithOrbit(system, orbit.id).has(host.id)) {
      error = 'Choose a host outside this Orbit and its nested contents.'
    } else if (!captureOrbitHostDependencies(currentWorkspace, system, host.id)) {
      error = 'This host or its parent placement no longer has a valid map position.'
    }
  }
  return {
    ...candidate,
    label: host ? catalogueObjectLabel(host) : candidate.label,
    error,
  }
}

function objectDefinitionBaseline(object: SystemObject, settings: ObjectFieldSettings): CustomFieldDefinition[] {
  return settings.customFields
    .filter(field => Object.hasOwn(object.customFieldValues ?? {}, field.id)
      || isCustomFieldApplicableToObject(field, object))
    .map(field => clone(field))
}

function captureObjectBaseline(
  workspace: LocalWorkspace,
  system: StarSystem,
  object: SystemObject,
): ObjectEditBaseline {
  const settings = workspace.objectFieldSettings
  const nativeFieldOptions: ObjectEditBaseline['nativeFieldOptions'] = {}
  if (object.family === 'CelestialBody' && (object.subtype === 'planet' || object.subtype === 'moon')) {
    nativeFieldOptions.atmosphereOptions = [...settings.atmosphereOptions]
  }
  if (object.family === 'Installation') {
    nativeFieldOptions.portClassOptions = [...settings.portClassOptions]
  }

  return {
    object: clone(object),
    values: clone(objectDraftValuesFor(object, settings)),
    dependencies: captureObjectPlacementDependencies(workspace, system, object),
    linkedStations: system.objects.filter(isPhysicalStation).map(station => ({
      id: station.id,
      family: station.family,
      subtype: station.subtype,
    })),
    customFieldDefinitions: objectDefinitionBaseline(object, settings),
    nativeFieldOptions,
  }
}

function captureOrbitBaseline(
  workspace: LocalWorkspace,
  system: StarSystem,
  orbit: Orbit,
): OrbitEditBaseline {
  const radii = effectiveOrbitRadii(workspace, system, orbit)
  const rotation = workspace.layout.orbitRotations[orbit.id] ?? 0
  const siblings = system.orbits
    .filter(candidate => candidate.hostId === orbit.hostId)
    .sort((left, right) => left.order - right.order)
    .map(candidate => ({ id: candidate.id, hostId: candidate.hostId, order: candidate.order }))
  return {
    orbit: clone(orbit),
    values: {
      hostId: orbit.hostId,
      targetOrder: String(orbit.order),
      horizontalRadius: String(radii.horizontal),
      verticalRadius: String(radii.vertical),
      centerX: orbit.hostId === null ? String(orbit.center.x) : '',
      centerY: orbit.hostId === null ? String(orbit.center.y) : '',
      rotation: String(rotation),
    },
    effectiveRadii: radii,
    rotation,
    siblings,
    dependencies: captureOrbitDependencies(workspace, system, orbit.id),
  }
}

function parseOrbitPlacement(placement: string): string | null {
  return placement.startsWith('orbit:') && placement.length > 'orbit:'.length
    ? placement.slice('orbit:'.length)
    : null
}

function sameDependencyBaseline(expected: EntityDependencyBaseline, current: EntityDependencyBaseline): boolean {
  return sameValue(expected, current)
}

function dependencyIds(session: EntityInspectorSession, drafts: DraftDependencySnapshots | null): {
  objects: Set<string>
  orbits: Set<string>
  destinationOrbitSiblings: Set<string>
} {
  const objects = new Set<string>()
  const orbits = new Set<string>()
  const destinationOrbitSiblings = new Set<string>()
  const add = (baseline: EntityDependencyBaseline | undefined) => {
    if (!baseline) return
    for (const object of baseline.objects) objects.add(object.id)
    for (const orbit of baseline.orbits) orbits.add(orbit.id)
  }

  if (session.kind === 'object') {
    objects.add(session.targetId)
    add(session.initial.dependencies)
    const orbitId = parseOrbitPlacement(session.draft.placement)
    if (orbitId) {
      add(drafts?.sessionId === session.id ? drafts.placements.get(orbitId) : undefined)
    }
    const stationIds = [session.initial.object.jumpStationId, session.draft.jumpStationId]
      .filter((id): id is string => !!id)
    for (const stationId of stationIds) objects.add(stationId)
  } else {
    orbits.add(session.targetId)
    add(session.initial.dependencies)
    if (session.initial.orbit.hostId === null && session.draft.hostId !== null) {
      const host = drafts?.sessionId === session.id
        ? drafts.orbitHosts.get(session.draft.hostId)
        : undefined
      if (host) {
        objects.add(host.object.id)
        add(host.placement)
        for (const sibling of host.siblings) destinationOrbitSiblings.add(sibling.id)
      }
    }
  }
  return { objects, orbits, destinationOrbitSiblings }
}

function plannedSystem(workspace: LocalWorkspace, systemId: string): StarSystem | undefined {
  return workspace.cluster.systems.find(system => system.id === systemId)
}

function deletionChangesOwnedDependencies(
  workspace: LocalWorkspace,
  session: EntityInspectorSession,
  target: MapDeletionTarget,
  snapshots: DraftDependencySnapshots | null,
): boolean {
  let planned: LocalWorkspace
  try {
    planned = planMapEntityDeletion(workspace, target).workspace
  } catch {
    return false
  }
  const currentSystem = plannedSystem(workspace, session.systemId)
  const nextSystem = plannedSystem(planned, session.systemId)
  if (!currentSystem || !nextSystem) return true

  const ids = dependencyIds(session, snapshots)
  const systemObjectsById = new Map(nextSystem.objects.map(object => [object.id, object]))
  for (const objectId of ids.objects) {
    const currentObject = currentSystem.objects.find(object => object.id === objectId)
    if (!currentObject) continue
    const nextObject = systemObjectsById.get(objectId)
    if (!nextObject) return true
    if (session.kind === 'object' && objectId === session.targetId) {
      if (!sameValue(currentObject, nextObject)) return true
    } else if (!sameValue(
      { id: currentObject.id, family: currentObject.family, subtype: currentObject.subtype, placement: currentObject.placement },
      { id: nextObject.id, family: nextObject.family, subtype: nextObject.subtype, placement: nextObject.placement },
    )) {
      return true
    }
  }

  const nextOrbitsById = new Map(nextSystem.orbits.map(orbit => [orbit.id, orbit]))
  for (const orbitId of ids.orbits) {
    const currentOrbit = currentSystem.orbits.find(orbit => orbit.id === orbitId)
    if (!currentOrbit) continue
    const nextOrbit = nextOrbitsById.get(orbitId)
    if (!nextOrbit || !sameValue(currentOrbit, nextOrbit)) return true
    if (session.kind === 'orbit') {
      const currentRadius = effectiveOrbitRadii(workspace, currentSystem, currentOrbit)
      const nextRadius = effectiveOrbitRadii(planned, nextSystem, nextOrbit)
      if (!sameValue(currentRadius, nextRadius)
        || (workspace.layout.orbitRotations[orbitId] ?? 0) !== (planned.layout.orbitRotations[orbitId] ?? 0)) {
        return true
      }
    }
  }

  if (session.kind === 'orbit') {
    const targetOrbit = currentSystem.orbits.find(orbit => orbit.id === session.targetId)
    const plannedOrbit = nextSystem.orbits.find(orbit => orbit.id === session.targetId)
    if (!targetOrbit || !plannedOrbit) return true
    const siblings = currentSystem.orbits
      .filter(orbit => orbit.hostId === targetOrbit.hostId)
      .map(orbit => ({ id: orbit.id, hostId: orbit.hostId, order: orbit.order }))
      .sort((left, right) => left.order - right.order)
    const nextSiblings = nextSystem.orbits
      .filter(orbit => orbit.hostId === plannedOrbit.hostId)
      .map(orbit => ({ id: orbit.id, hostId: orbit.hostId, order: orbit.order }))
      .sort((left, right) => left.order - right.order)
    if (!sameValue(siblings, nextSiblings)) return true
    if (session.initial.orbit.hostId === null && session.draft.hostId !== null) {
      const currentHost = captureOrbitHostDependencies(workspace, currentSystem, session.draft.hostId)
      const nextHost = captureOrbitHostDependencies(planned, nextSystem, session.draft.hostId)
      if (!currentHost || !nextHost || !sameValue(currentHost, nextHost)) return true
    }
  }
  return false
}

export function useEntityInspectorSession({ workspace, mutations }: EntityInspectorSessionOptions) {
  const entitySession = ref<EntityInspectorSession | null>(null)
  const orbitPlacementPreview = ref<OrbitPlacementPreviewState | null>(null)
  let sessionSequence = 0
  let draftDependencies: DraftDependencySnapshots | null = null

  function captureDraftDependencies(): void {
    const session = entitySession.value
    const currentWorkspace = workspace.value
    if (!session || !currentWorkspace) return
    if (!draftDependencies || draftDependencies.sessionId !== session.id) {
      draftDependencies = {
        sessionId: session.id,
        placements: new Map(),
        stations: new Map(),
        orbitHosts: new Map(),
      }
    }
    const system = plannedSystem(currentWorkspace, session.systemId)
    if (!system) return
    if (session.kind === 'orbit') {
      const hostId = session.initial.orbit.hostId === null ? session.draft.hostId : null
      if (hostId && !draftDependencies.orbitHosts.has(hostId)) {
        const snapshot = captureOrbitHostDependencies(currentWorkspace, system, hostId)
        if (snapshot) draftDependencies.orbitHosts.set(hostId, snapshot)
      }
      return
    }
    const orbitId = parseOrbitPlacement(session.draft.placement)
    if (orbitId && !draftDependencies.placements.has(orbitId)) {
      draftDependencies.placements.set(orbitId, captureOrbitDependencies(currentWorkspace, system, orbitId))
    }
    const stationId = session.draft.jumpStationId
    if (stationId && !draftDependencies.stations.has(stationId)) {
      const station = system.objects.find(object => object.id === stationId && isPhysicalStation(object))
      if (station) {
        draftDependencies.stations.set(stationId, {
          id: station.id,
          family: station.family,
          subtype: station.subtype,
        })
      }
    }
  }

  watch(() => {
    const session = entitySession.value
    return session?.kind === 'object'
      ? [session.id, session.draft.placement, session.draft.jumpStationId] as const
      : session?.kind === 'orbit'
        ? [session.id, session.draft.hostId] as const
        : null
  }, captureDraftDependencies, { flush: 'sync' })

  watch(() => {
    const session = entitySession.value
    return session?.kind === 'orbit'
      ? [
          session.id,
          session.draft.hostId,
          session.draft.targetOrder,
          session.draft.horizontalRadius,
          session.draft.verticalRadius,
          session.draft.centerX,
          session.draft.centerY,
          session.draft.rotation,
        ] as const
      : null
  }, values => {
    const preview = orbitPlacementPreview.value
    if (!preview || !values || preview.sessionId !== values[0]) return
    if (preview.signature !== JSON.stringify(values.slice(1))) orbitPlacementPreview.value = null
  }, { flush: 'sync' })

  function cancelOrbitPlacementPreview(): void {
    orbitPlacementPreview.value = null
  }

  watch([workspace, orbitPlacementPreview], () => {
    const preview = orbitPlacementPreview.value
    const session = entitySession.value
    if (!preview) return
    if (!session || session.kind !== 'orbit' || session.id !== preview.sessionId
      || getEntitySessionStaleError(session) !== null) {
      orbitPlacementPreview.value = null
    }
  }, { flush: 'sync' })

  const hasModifiedEntitySession = computed(() => {
    const session = entitySession.value
    if (!session) return false
    return !sameValue(session.draft, session.initial.values)
  })
  const hasPendingHistoryChoice = computed(() => {
    const session = entitySession.value
    return session?.kind === 'orbit' && session.centerMoveCandidates !== null
  })

  /** Ends a clean, choice-free session after history restores its previously selected entity. */
  function endCleanHistorySession(): void {
    const session = entitySession.value
    if (session && !hasModifiedEntitySession.value && !hasPendingHistoryChoice.value) {
      discardEntitySession(session.id)
    }
  }

  function getEntitySessionStaleError(session: EntityInspectorSession): string | null {
    const currentWorkspace = workspace.value
    if (!currentWorkspace || currentWorkspace.cluster.id !== session.clusterId) {
      return 'The Jump Cluster for this draft no longer exists.'
    }
    const system = plannedSystem(currentWorkspace, session.systemId)
    if (!system) return 'The star system for this draft no longer exists.'

    if (session.kind === 'object') {
      const currentObject = system.objects.find(object => object.id === session.targetId)
      if (!currentObject) return 'The map object for this draft no longer exists.'
      if (!sameValue(currentObject, session.initial.object)) {
        return 'This map object changed while its Inspector was open. Review the latest values before applying.'
      }
      const currentInitialDependencies = captureObjectPlacementDependencies(currentWorkspace, system, session.initial.object)
      if (!sameDependencyBaseline(session.initial.dependencies, currentInitialDependencies)) {
        return 'The object placement or one of its Orbit hosts changed while this Inspector was open.'
      }
      const orbitId = parseOrbitPlacement(session.draft.placement)
      if (orbitId) {
        const expected = draftDependencies?.sessionId === session.id
          ? draftDependencies.placements.get(orbitId)
          : undefined
        const actual = captureOrbitDependencies(currentWorkspace, system, orbitId)
        if (!expected || !sameDependencyBaseline(expected, actual)) {
          return 'The selected Orbit or one of its hosts changed while this Inspector was open.'
        }
      }
      for (const definition of session.initial.customFieldDefinitions) {
        const currentDefinition = currentWorkspace.objectFieldSettings.customFields.find(field => field.id === definition.id)
        if (!currentDefinition || !sameValue(currentDefinition, definition)) {
          return 'A custom field used by this object changed while its Inspector was open.'
        }
      }
      if (session.initial.nativeFieldOptions.atmosphereOptions
        && !sameValue(session.initial.nativeFieldOptions.atmosphereOptions, currentWorkspace.objectFieldSettings.atmosphereOptions)) {
        return 'Atmosphere options changed while this Inspector was open.'
      }
      if (session.initial.nativeFieldOptions.portClassOptions
        && !sameValue(session.initial.nativeFieldOptions.portClassOptions, currentWorkspace.objectFieldSettings.portClassOptions)) {
        return 'Port class options changed while this Inspector was open.'
      }
      const stationId = session.draft.jumpStationId
      if (stationId) {
        const expected = session.initial.linkedStations.find(station => station.id === stationId)
          ?? (draftDependencies?.sessionId === session.id ? draftDependencies.stations.get(stationId) : undefined)
        const currentStation = system.objects.find(object => object.id === stationId && isPhysicalStation(object))
        if (!expected || !currentStation || !sameValue(expected, {
          id: currentStation.id,
          family: currentStation.family,
          subtype: currentStation.subtype,
        })) {
          return 'The selected Physical Station changed while this Inspector was open.'
        }
      }
      return null
    }

    const currentOrbit = system.orbits.find(orbit => orbit.id === session.targetId)
    if (!currentOrbit) return 'The Orbit for this draft no longer exists.'
    if (!sameValue(currentOrbit, session.initial.orbit)) {
      return 'This Orbit changed while its Inspector was open. Review the latest geometry before applying.'
    }
    const currentDependencies = captureOrbitDependencies(currentWorkspace, system, session.initial.orbit.id)
    if (!sameDependencyBaseline(session.initial.dependencies, currentDependencies)) {
      return 'The Orbit host or one of its parent placements changed while this Inspector was open.'
    }
    const currentSiblings = system.orbits
      .filter(orbit => orbit.hostId === session.initial.orbit.hostId)
      .sort((left, right) => left.order - right.order)
      .map(orbit => ({ id: orbit.id, hostId: orbit.hostId, order: orbit.order }))
    if (!sameValue(currentSiblings, session.initial.siblings)) {
      return 'The sibling Orbit order changed while this Inspector was open.'
    }
    if (!sameValue(effectiveOrbitRadii(currentWorkspace, system, currentOrbit), session.initial.effectiveRadii)) {
      return 'Orbit radii changed while this Inspector was open.'
    }
    if ((currentWorkspace.layout.orbitRotations[currentOrbit.id] ?? 0) !== session.initial.rotation) {
      return 'Orbit rotation changed while this Inspector was open.'
    }
    if (session.initial.orbit.hostId === null && session.draft.hostId !== null) {
      if (objectsMovedWithOrbit(system, currentOrbit.id).has(session.draft.hostId)) {
        return 'Choose a host outside this Orbit and its nested contents.'
      }
      const expectedHost = draftDependencies?.sessionId === session.id
        ? draftDependencies.orbitHosts.get(session.draft.hostId)
        : undefined
      const currentHost = captureOrbitHostDependencies(currentWorkspace, system, session.draft.hostId)
      if (!expectedHost || !currentHost || !sameValue(expectedHost, currentHost)) {
        return 'The proposed host, its parent placement, or its sibling Orbit order changed while this Inspector was open.'
      }
    }
    return null
  }

  function beginObjectSession(clusterId: string, systemId: string, objectId: string): void {
    const currentWorkspace = workspace.value
    const system = currentWorkspace?.cluster.systems.find(candidate => candidate.id === systemId)
    const object = system?.objects.find(candidate => candidate.id === objectId)
    if (!currentWorkspace || currentWorkspace.cluster.id !== clusterId || !system || !object) return
    const active = entitySession.value
    if (active?.kind === 'object' && active.clusterId === clusterId
      && active.systemId === systemId && active.targetId === objectId) return

    orbitPlacementPreview.value = null
    const initial = captureObjectBaseline(currentWorkspace, system, object)
    draftDependencies = {
      sessionId: sessionSequence + 1,
      placements: new Map(),
      stations: new Map(initial.linkedStations.map(station => [station.id, station])),
      orbitHosts: new Map(),
    }
    if (object.placement.kind === 'orbit') {
      draftDependencies.placements.set(
        object.placement.orbitId,
        captureOrbitDependencies(currentWorkspace, system, object.placement.orbitId),
      )
    }
    sessionSequence += 1
    entitySession.value = {
      id: sessionSequence,
      clusterId,
      systemId,
      targetId: objectId,
      kind: 'object',
      initial,
      draft: clone(initial.values),
      errors: {},
      error: '',
    }
  }

  /** Updates placement and its dependent free-position defaults only for the current object draft. */
  function updateObjectPlacement(expectedId: number, placement: string): void {
    const session = entitySession.value
    if (!session || session.id !== expectedId || session.kind !== 'object') return
    const currentWorkspace = workspace.value
    const system = currentWorkspace ? plannedSystem(currentWorkspace, session.systemId) : undefined
    if (!system) return

    const wasOrbitPlaced = session.draft.placement.startsWith('orbit:')
    session.draft.placement = placement
    if (wasOrbitPlaced && placement === 'system') {
      if (session.initial.values.placement !== 'system') {
        const position = initialSystemPlacement(system)
        if (!session.draft.x.trim()) session.draft.x = String(position.x)
        if (!session.draft.y.trim()) session.draft.y = String(position.y)
      }
    }

    const errors = { ...session.errors }
    delete errors.placement
    if (placement !== 'system') {
      delete errors.x
      delete errors.y
    } else if (wasOrbitPlaced) {
      delete errors.x
      delete errors.y
    }
    session.errors = errors
  }

  function beginOrbitSession(clusterId: string, systemId: string, orbitId: string): void {
    const currentWorkspace = workspace.value
    const system = currentWorkspace?.cluster.systems.find(candidate => candidate.id === systemId)
    const orbit = system?.orbits.find(candidate => candidate.id === orbitId)
    if (!currentWorkspace || currentWorkspace.cluster.id !== clusterId || !system || !orbit) return
    const active = entitySession.value
    if (active?.kind === 'orbit' && active.clusterId === clusterId
      && active.systemId === systemId && active.targetId === orbitId) return

    orbitPlacementPreview.value = null
    sessionSequence += 1
    draftDependencies = null
    const initial = captureOrbitBaseline(currentWorkspace, system, orbit)
    entitySession.value = {
      id: sessionSequence,
      clusterId,
      systemId,
      targetId: orbitId,
      kind: 'orbit',
      initial,
      draft: clone(initial.values),
      centerMoveCandidates: null,
      errors: {},
      error: '',
    }
  }

  function offerOrbitCenterCandidates(expectedId: number, candidates: OrbitCenterMoveCandidate[]): boolean {
    const session = entitySession.value
    if (!session || session.id !== expectedId || session.kind !== 'orbit'
      || session.initial.orbit.hostId !== null || session.draft.hostId !== null) return false
    const currentWorkspace = workspace.value
    const system = currentWorkspace ? plannedSystem(currentWorkspace, session.systemId) : undefined
    const orbit = system?.orbits.find(candidate => candidate.id === session.targetId)
    if (!currentWorkspace || !system || !orbit || orbit.hostId !== null) {
      session.centerMoveCandidates = null
      session.error = 'The unoccupied Orbit changed before its overlapping host choices could be reviewed.'
      return false
    }
    const staleError = getEntitySessionStaleError(session)
    if (staleError) {
      session.centerMoveCandidates = null
      session.error = staleError
      return false
    }

    const hasNamedHost = candidates.some(candidate => candidate.target.kind === 'host')
    if (!hasNamedHost) return false
    session.centerMoveCandidates = candidates.map(candidate =>
      validateOrbitCenterMoveCandidate(currentWorkspace, system, orbit, candidate),
    )
    session.errors = {}
    session.error = ''
    return true
  }

  function updateOrbitHost(expectedId: number, hostId: string | null): boolean {
    const session = entitySession.value
    if (!session || session.id !== expectedId || session.kind !== 'orbit'
      || session.initial.orbit.hostId !== null) return false
    orbitPlacementPreview.value = null

    const currentWorkspace = workspace.value
    const system = currentWorkspace ? plannedSystem(currentWorkspace, session.systemId) : undefined
    const orbit = system?.orbits.find(candidate => candidate.id === session.targetId)
    if (!currentWorkspace || !system || !orbit) {
      session.error = 'The Orbit for this draft no longer exists.'
      return false
    }
    if (session.centerMoveCandidates !== null) {
      const staleError = getEntitySessionStaleError(session)
      if (staleError) {
        session.centerMoveCandidates = null
        session.errors = { hostId: staleError }
        session.error = staleError
        return false
      }
      if (hostId === null) {
        const error = 'Choose a named host from the overlapping map targets before previewing this Orbit.'
        session.errors = { hostId: error }
        session.error = error
        return false
      }
      const candidate = session.centerMoveCandidates.find(item =>
        item.target.kind === 'host' && item.target.objectId === hostId,
      )
      if (!candidate) {
        const error = 'Choose one of the named hosts that overlapped the Orbit center.'
        session.errors = { hostId: error }
        session.error = error
        return false
      }
      if (candidate.error) {
        session.errors = { hostId: candidate.error }
        session.error = candidate.error
        return false
      }
      const currentCandidate = validateOrbitCenterMoveCandidate(currentWorkspace, system, orbit, candidate)
      if (currentCandidate.error) {
        session.centerMoveCandidates = session.centerMoveCandidates.map(item =>
          item.key === candidate.key ? currentCandidate : item,
        )
        session.errors = { hostId: currentCandidate.error }
        session.error = currentCandidate.error
        return false
      }
    }
    if (hostId !== null) {
      if (!system.objects.some(object => object.id === hostId)) {
        session.errors = { hostId: 'Choose an existing map object as the Orbit host.' }
        session.error = session.errors.hostId!
        return false
      }
      if (objectsMovedWithOrbit(system, orbit.id).has(hostId)) {
        session.errors = { hostId: 'Choose a host outside this Orbit and its nested contents.' }
        session.error = session.errors.hostId!
        return false
      }
    }

    session.draft.hostId = hostId
    session.centerMoveCandidates = null
    if (hostId === null) {
      session.draft.targetOrder = String(session.initial.orbit.order)
    } else {
      const siblings = system.orbits.filter(candidate => candidate.hostId === hostId)
      session.draft.targetOrder = String(siblings.reduce((highest, sibling) => Math.max(highest, sibling.order), 0) + 1)
    }
    session.errors = {}
    session.error = ''
    return true
  }

  function previewOrbitPlacement(expectedId: number): boolean {
    const session = entitySession.value
    if (!session || session.id !== expectedId || session.kind !== 'orbit'
      || session.initial.orbit.hostId !== null) return false
    orbitPlacementPreview.value = null

    if (session.centerMoveCandidates !== null) {
      const error = 'Choose a named host from the overlapping map targets before previewing this Orbit.'
      session.errors = { hostId: error }
      session.error = error
      return false
    }
    if (session.draft.hostId === null) return false

    const staleError = getEntitySessionStaleError(session)
    if (staleError) {
      session.error = staleError
      return false
    }

    const currentWorkspace = workspace.value
    const system = currentWorkspace ? plannedSystem(currentWorkspace, session.systemId) : undefined
    const orbit = system?.orbits.find(candidate => candidate.id === session.targetId)
    const host = system?.objects.find(candidate => candidate.id === session.draft.hostId)
    if (!currentWorkspace || !system || !orbit || !host) {
      session.error = 'The Orbit or proposed host for this preview no longer exists.'
      return false
    }
    if (orbit.hostId !== null || !orbit.center) {
      const error = 'This Orbit is already hosted; detach it before choosing a new host.'
      session.errors = { hostId: error }
      session.error = error
      return false
    }
    if (objectsMovedWithOrbit(system, orbit.id).has(host.id)) {
      session.errors = { hostId: 'Choose a host outside this Orbit and its nested contents.' }
      session.error = session.errors.hostId!
      return false
    }

    const errors: Record<string, string> = {}
    const horizontal = parseFiniteInput(session.draft.horizontalRadius, 'Horizontal radius', errors, 'horizontalRadius')
    const vertical = parseFiniteInput(session.draft.verticalRadius, 'Vertical radius', errors, 'verticalRadius')
    const rotation = parseFiniteInput(session.draft.rotation, 'Rotation', errors, 'rotation')
    if (horizontal === null || vertical === null || rotation === null) {
      session.errors = errors
      session.error = Object.values(errors).join(' ')
      return false
    }

    try {
      const sourceCenter = orbit.center
      const attachedSystem = moveOrbitCenter(system, orbit.id, sourceCenter, host.id)
      const attachedOrbit = attachedSystem.orbits.find(candidate => candidate.id === orbit.id)
      if (!attachedOrbit) throw new Error('The Orbit could not be attached to the proposed host.')
      const minimum = minimumOrbitRadius(attachedSystem, attachedOrbit)
      const radii = {
        horizontal: Math.max(horizontal, minimum),
        vertical: Math.max(vertical, minimum),
      }
      const positions = objectPositions(system, {
        objectAngles: currentWorkspace.layout.objectAngles,
        orbitRadii: currentWorkspace.layout.orbitRadii,
        orbitRotations: currentWorkspace.layout.orbitRotations,
      })
      const center = positions.get(host.id)
      if (!center) throw new Error('The proposed host has no resolved map position.')

      session.draft.targetOrder = String(attachedOrbit.order)
      session.draft.horizontalRadius = String(radii.horizontal)
      session.draft.verticalRadius = String(radii.vertical)
      session.errors = {}
      session.error = ''
      const signature = JSON.stringify([
        session.draft.hostId,
        session.draft.targetOrder,
        session.draft.horizontalRadius,
        session.draft.verticalRadius,
        session.draft.centerX,
        session.draft.centerY,
        session.draft.rotation,
      ])
      orbitPlacementPreview.value = {
        sessionId: session.id,
        orbitId: orbit.id,
        hostId: host.id,
        signature,
        preview: { center, radii, rotation: normalizeOrbitRotation(rotation) },
      }
      return true
    } catch (error) {
      session.error = error instanceof Error ? error.message : String(error)
      return false
    }
  }

  function discardEntitySession(expectedId?: number): void {
    const active = entitySession.value
    if (!active || (expectedId !== undefined && active.id !== expectedId)) return
    if (orbitPlacementPreview.value?.sessionId === active.id) orbitPlacementPreview.value = null
    entitySession.value = null
    draftDependencies = null
  }

  /**
   * Validates the active draft before finishing its session. Changed drafts publish to memory and start an
   * ordered save; a clean draft finishes after the same target and dependency guards without publishing.
   * A true result means this exact draft was applied or validated unchanged; durability is tracked separately.
   */
  async function applyEntitySession(expectedId?: number): Promise<boolean> {
    const session = entitySession.value
    if (!session || (expectedId !== undefined && session.id !== expectedId)) return false
    const currentWorkspace = workspace.value
    if (!currentWorkspace || currentWorkspace.cluster.id !== session.clusterId) {
      session.error = 'The Jump Cluster for this draft no longer exists.'
      return false
    }
    const system = plannedSystem(currentWorkspace, session.systemId)
    if (!system) {
      session.error = 'The star system for this draft no longer exists.'
      return false
    }
    const staleError = getEntitySessionStaleError(session)
    if (staleError) {
      if (orbitPlacementPreview.value?.sessionId === session.id) orbitPlacementPreview.value = null
      session.error = staleError
      return false
    }
    if (session.kind === 'orbit' && session.centerMoveCandidates !== null) {
      const error = 'Choose a named host from the overlapping map targets before applying this Orbit.'
      session.errors = { hostId: error }
      session.error = error
      return false
    }

    const submittedSignature = JSON.stringify({
      id: session.id,
      clusterId: session.clusterId,
      systemId: session.systemId,
      targetId: session.targetId,
      kind: session.kind,
      initial: session.initial,
      draft: session.draft,
      centerMoveCandidates: session.kind === 'orbit' ? session.centerMoveCandidates : null,
    })
    const submittedPreview = orbitPlacementPreview.value?.sessionId === session.id
      ? JSON.stringify(orbitPlacementPreview.value)
      : null
    const isSubmittedDraftCurrent = (): boolean => {
      const active = entitySession.value
      return active?.id === session.id
        && JSON.stringify({
          id: active.id,
          clusterId: active.clusterId,
          systemId: active.systemId,
          targetId: active.targetId,
          kind: active.kind,
          initial: active.initial,
          draft: active.draft,
          centerMoveCandidates: active.kind === 'orbit' ? active.centerMoveCandidates : null,
        }) === submittedSignature
    }
    const isSubmittedPreviewCurrent = (): boolean => {
      const currentPreview = orbitPlacementPreview.value?.sessionId === session.id
        ? JSON.stringify(orbitPlacementPreview.value)
        : null
      return currentPreview === submittedPreview
    }
    const isSubmittedMutationCurrent = (): boolean => isSubmittedDraftCurrent() && isSubmittedPreviewCurrent()

    try {
      let nextWorkspace: LocalWorkspace
      if (session.kind === 'object') {
        const object = system.objects.find(candidate => candidate.id === session.targetId)
        if (!object) {
          session.error = 'The map object for this draft no longer exists.'
          return false
        }
        const result = validateObjectDraft(currentWorkspace, system, object, session.initial.values, session.draft)
        session.errors = result.errors
        if (!result.workspace) {
          session.error = Object.values(result.errors).join(' ')
          return false
        }
        nextWorkspace = result.workspace
      } else {
        if (session.initial.orbit.hostId === null && session.draft.hostId !== null) {
          const preview = orbitPlacementPreview.value
          const signature = JSON.stringify([
            session.draft.hostId,
            session.draft.targetOrder,
            session.draft.horizontalRadius,
            session.draft.verticalRadius,
            session.draft.centerX,
            session.draft.centerY,
            session.draft.rotation,
          ])
          if (!preview || preview.sessionId !== session.id || preview.orbitId !== session.targetId
            || preview.hostId !== session.draft.hostId || preview.signature !== signature) {
            session.errors = { form: 'Preview placement again before applying these host and geometry changes.' }
            session.error = session.errors.form!
            return false
          }
        }
        const result = applyOrbitDraft(currentWorkspace, system, session)
        session.errors = result.errors
        if (!result.workspace) {
          session.error = Object.values(result.errors).join(' ')
          return false
        }
        nextWorkspace = result.workspace
      }

      if (!hasModifiedEntitySession.value) {
        if (entitySession.value?.id === session.id) {
          if (orbitPlacementPreview.value?.sessionId === session.id) orbitPlacementPreview.value = null
          entitySession.value = null
          draftDependencies = null
        }
        return true
      }

      const target = session.kind === 'object'
        ? { kind: 'object' as const, id: session.targetId, systemId: session.systemId }
        : { kind: 'orbit' as const, id: session.targetId, systemId: session.systemId }
      const result = await mutations.execute({
        action: { kind: 'update', label: session.kind === 'object' ? 'Edit map object' : 'Edit Orbit', target },
        prepare: () => nextWorkspace,
        isCurrent: isSubmittedMutationCurrent,
      })
      if (result.status === 'rejected') {
        if (isSubmittedDraftCurrent()) session.error = result.message
        return false
      }

      if (result.status === 'applied') void result.durable.catch(() => undefined)
      if (!isSubmittedDraftCurrent()) return false
      if (orbitPlacementPreview.value?.sessionId === session.id) orbitPlacementPreview.value = null
      entitySession.value = null
      draftDependencies = null
      return true
    } catch (error) {
      if (isSubmittedDraftCurrent()) session.error = error instanceof Error ? error.message : String(error)
      return false
    }
  }

  function sessionFieldDefinitionIds(session: Extract<EntityInspectorSession, { kind: 'object' }>): Set<string> {
    return new Set([
      ...session.initial.customFieldDefinitions.map(field => field.id),
      ...Object.keys(session.initial.object.customFieldValues ?? {}),
    ])
  }

  function isEntityCommandBlocked(command: EntityCommand): boolean {
    const session = entitySession.value
    const currentWorkspace = workspace.value
    if (!session || !currentWorkspace) return false

    if (command.kind === 'deletion') {
      return deletionChangesOwnedDependencies(currentWorkspace, session, command.target, draftDependencies)
    }
    if (!hasModifiedEntitySession.value) return false
    if (command.kind === 'definition-mutation') {
      if (session.kind !== 'object') return false
      if (sessionFieldDefinitionIds(session).has(command.fieldId)) return true
      const currentDefinition = currentWorkspace.objectFieldSettings.customFields
        .find(field => field.id === command.fieldId)
      if (currentDefinition && isCustomFieldApplicableToObject(currentDefinition, session.initial.object)) {
        return true
      }
      return (command.fieldId === 'native:atmosphere' && !!session.initial.nativeFieldOptions.atmosphereOptions)
        || (command.fieldId === 'native:port-class' && !!session.initial.nativeFieldOptions.portClassOptions)
    }

    const ids = dependencyIds(session, draftDependencies)
    if (command.kind === 'object-placement') {
      // An occupant's placement or angle can change independently of the Orbit's geometry and sibling order.
      // Conflicts are limited to editing an object whose own state anchors this draft's dependencies.
      return ids.objects.has(command.objectId)
    }
    if (command.kind === 'orbit-create') {
      return session.kind === 'orbit'
        && (command.hostId === session.initial.orbit.hostId
          || (session.initial.orbit.hostId === null
            && session.draft.hostId !== null
            && command.hostId === session.draft.hostId))
    }
    if (command.kind === 'object-create') {
      // A new occupant is independent unless it can change the proposed host's resolved placement.
      return session.kind === 'orbit'
        && session.initial.orbit.hostId === null
        && session.draft.hostId !== null
        && command.orbitId !== null
        && ids.orbits.has(command.orbitId)
    }
    if (command.kind === 'orbit-geometry') {
      return ids.orbits.has(command.orbitId)
    }

    if (ids.orbits.has(command.orbitId)) return true
    if (session.kind === 'object' && command.hostId !== null && ids.objects.has(command.hostId)) return true
    if (session.kind === 'orbit') {
      const initialHostId = session.initial.orbit.hostId
      const siblingIds = new Set(session.initial.siblings.map(sibling => sibling.id))
      return siblingIds.has(command.orbitId)
        || ids.destinationOrbitSiblings.has(command.orbitId)
        || command.hostId === initialHostId
        || (session.initial.orbit.hostId === null
          && session.draft.hostId !== null
          && command.hostId === session.draft.hostId)
    }
    return false
  }

  function isEntityDraftTarget(kind: 'object' | 'orbit', id: string): boolean {
    return entitySession.value?.kind === kind && entitySession.value.targetId === id
  }

  watch(workspace, currentWorkspace => {
    const session = entitySession.value
    if (!session) return
    if (!currentWorkspace) {
      if (!hasModifiedEntitySession.value) discardEntitySession(session.id)
      return
    }
    if (currentWorkspace.cluster.id === session.clusterId
      && plannedSystem(currentWorkspace, session.systemId)?.[session.kind === 'object' ? 'objects' : 'orbits']
        .some(entity => entity.id === session.targetId)) {
      const staleError = getEntitySessionStaleError(session)
      if (session.kind === 'orbit' && session.centerMoveCandidates !== null && staleError) {
        session.centerMoveCandidates = null
        session.errors = { hostId: staleError }
        session.error = staleError
        orbitPlacementPreview.value = null
      }
      if (hasModifiedEntitySession.value || staleError === null) return
    }
    if (!hasModifiedEntitySession.value) discardEntitySession(session.id)
  })

  return {
    entitySession,
    hasModifiedEntitySession,
    hasPendingHistoryChoice,
    orbitPlacementPreview,
    beginObjectSession,
    updateObjectPlacement,
    beginOrbitSession,
    offerOrbitCenterCandidates,
    updateOrbitHost,
    previewOrbitPlacement,
    cancelOrbitPlacementPreview,
    applyEntitySession,
    discardEntitySession,
    endCleanHistorySession,
    isEntityCommandBlocked,
    isEntityDraftTarget,
  }
}

function applyOrbitDraft(
  currentWorkspace: LocalWorkspace,
  system: StarSystem,
  session: Extract<EntityInspectorSession, { kind: 'orbit' }>,
): { workspace: LocalWorkspace | null; errors: Record<string, string> } {
  const errors: Record<string, string> = {}
  const draft = session.draft
  const attaching = session.initial.orbit.hostId === null && draft.hostId !== null
  const targetOrder = attaching ? null : parseFiniteInput(draft.targetOrder, 'Orbit order', errors, 'targetOrder')
  const horizontalRadius = parseFiniteInput(draft.horizontalRadius, 'Horizontal radius', errors, 'horizontalRadius')
  const verticalRadius = parseFiniteInput(draft.verticalRadius, 'Vertical radius', errors, 'verticalRadius')
  const rotation = parseFiniteInput(draft.rotation, 'Rotation', errors, 'rotation')
  const orbit = system.orbits.find(candidate => candidate.id === session.targetId)
  if (!orbit) return { workspace: null, errors: { form: 'The Orbit for this draft no longer exists.' } }

  const siblings = system.orbits.filter(candidate => candidate.hostId === orbit.hostId)
  if (!attaching && targetOrder !== null
    && (!Number.isSafeInteger(targetOrder) || targetOrder < 1 || targetOrder > siblings.length)) {
    errors.targetOrder = `Choose an Orbit order from 1 to ${siblings.length}.`
  }
  let updatedSystem = system
  let minimum = minimumOrbitRadius(system, orbit)
  if (attaching) {
    if (orbit.hostId !== null || !orbit.center) {
      errors.hostId = 'This Orbit is already hosted; detach it before choosing a new host.'
    } else {
      const sourceCenter = orbit.center
      const hostId = draft.hostId
      const host = hostId === null ? undefined : system.objects.find(object => object.id === hostId)
      if (!host) errors.hostId = 'Choose an existing map object as the Orbit host.'
      else if (objectsMovedWithOrbit(system, orbit.id).has(host.id)) {
        errors.hostId = 'Choose a host outside this Orbit and its nested contents.'
      } else {
        updatedSystem = moveOrbitCenter(system, orbit.id, sourceCenter, host.id)
        const attachedOrbit = updatedSystem.orbits.find(candidate => candidate.id === orbit.id)
        if (!attachedOrbit) return { workspace: null, errors: { form: 'The Orbit could not be attached.' } }
        minimum = minimumOrbitRadius(updatedSystem, attachedOrbit)
      }
    }
  } else {
    if (draft.hostId !== orbit.hostId) errors.hostId = 'Hosted Orbits can only be detached with the existing Detach action.'
    if (horizontalRadius !== null && horizontalRadius < minimum) {
      errors.horizontalRadius = `Horizontal radius must be at least ${minimum}.`
    }
    if (verticalRadius !== null && verticalRadius < minimum) {
      errors.verticalRadius = `Vertical radius must be at least ${minimum}.`
    }
  }

  let center: Point | undefined
  if (orbit.hostId === null && !attaching) {
    const centerX = parseFiniteInput(draft.centerX, 'Center X', errors, 'centerX')
    const centerY = parseFiniteInput(draft.centerY, 'Center Y', errors, 'centerY')
    if (centerX !== null && centerY !== null) center = { x: centerX, y: centerY }
  }
  if (Object.keys(errors).length || (!attaching && targetOrder === null) || horizontalRadius === null
    || verticalRadius === null || rotation === null) return { workspace: null, errors }

  let finalHorizontal = horizontalRadius
  let finalVertical = verticalRadius
  if (attaching) {
    finalHorizontal = Math.max(horizontalRadius, minimum)
    finalVertical = Math.max(verticalRadius, minimum)
  } else if (targetOrder !== null) {
    let currentOrder = orbit.order
    while (currentOrder !== targetOrder) {
      const direction = currentOrder < targetOrder ? 1 : -1
      updatedSystem = moveOrbitOnce(updatedSystem, orbit.id, direction)
      currentOrder += direction
    }
  }
  if (center && orbit.hostId === null && !attaching) {
    updatedSystem = {
      ...updatedSystem,
      orbits: updatedSystem.orbits.map(candidate => candidate.id === orbit.id && candidate.hostId === null
        ? { ...candidate, center }
        : candidate),
    }
  }

  const nextWorkspace = replaceWorkspaceSystem(currentWorkspace, updatedSystem)
  const updatedOrbit = updatedSystem.orbits.find(candidate => candidate.id === orbit.id)!
  const updatedLayout = { ...nextWorkspace.layout }
  const orbitRadii = { ...updatedLayout.orbitRadii }
  for (const sibling of siblings) {
    const reorderedSibling = updatedSystem.orbits.find(candidate => candidate.id === sibling.id)
    if (reorderedSibling && reorderedSibling.order !== sibling.order) {
      orbitRadii[sibling.id] = effectiveOrbitRadii(currentWorkspace, system, sibling)
    }
  }
  const changedRadii = finalHorizontal !== session.initial.effectiveRadii.horizontal
    || finalVertical !== session.initial.effectiveRadii.vertical
  if (attaching) {
    const updatedDefault = defaultOrbitRadius(updatedSystem, updatedOrbit)
    if (finalHorizontal === updatedDefault && finalVertical === updatedDefault) delete orbitRadii[orbit.id]
    else orbitRadii[orbit.id] = { horizontal: finalHorizontal, vertical: finalVertical }
  } else if (changedRadii) {
    const updatedDefault = defaultOrbitRadius(updatedSystem, updatedOrbit)
    if (finalHorizontal === updatedDefault && finalVertical === updatedDefault) delete orbitRadii[orbit.id]
    else orbitRadii[orbit.id] = { horizontal: finalHorizontal, vertical: finalVertical }
  }

  const orbitRotations = { ...updatedLayout.orbitRotations }
  const normalizedRotation = normalizeOrbitRotation(rotation)
  if (normalizedRotation !== session.initial.rotation) {
    if (normalizedRotation === 0) delete orbitRotations[orbit.id]
    else orbitRotations[orbit.id] = normalizedRotation
  }
  return {
    workspace: {
      ...nextWorkspace,
      layout: { ...updatedLayout, orbitRadii, orbitRotations },
    },
    errors,
  }
}

function moveOrbitOnce(system: StarSystem, orbitId: string, direction: -1 | 1): StarSystem {
  const orbit = system.orbits.find(candidate => candidate.id === orbitId)
  if (!orbit) throw new Error('The selected Orbit no longer exists.')
  const siblings = system.orbits
    .filter(candidate => candidate.hostId === orbit.hostId)
    .sort((left, right) => left.order - right.order)
  const index = siblings.findIndex(candidate => candidate.id === orbitId)
  const adjacent = siblings[index + direction]
  if (!adjacent) return system
  return {
    ...system,
    orbits: system.orbits.map(candidate => {
      if (candidate.id === orbit.id) return { ...candidate, order: adjacent.order }
      if (candidate.id === adjacent.id) return { ...candidate, order: orbit.order }
      return candidate
    }),
  }
}
