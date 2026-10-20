/**
 * Owns resumable object and Orbit drafts above Inspector presentation and applies them to latest workspace memory.
 */
import { computed, ref, watch, type Ref } from 'vue'
import {
  canPlaceObjectInOrbit,
  defaultOrbitRadius,
  isCustomFieldApplicableToObject,
  minimumOrbitRadius,
  normalizeOrbitRotation,
  planMapEntityDeletion,
  replaceWorkspaceSystem,
  updateSystemObject,
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
  ObjectDraft,
  ObjectEditBaseline,
  OrbitDraft,
  OrbitEditBaseline,
} from './types'

type ApplyWorkspace = (workspace: LocalWorkspace) => { durable: Promise<void> }

interface EntityInspectorSessionOptions {
  workspace: Readonly<Ref<LocalWorkspace | null>>
  applyWorkspace: ApplyWorkspace
}

interface DraftDependencySnapshots {
  sessionId: number
  placements: Map<string, EntityDependencyBaseline>
  stations: Map<string, Pick<SystemObject, 'id' | 'family' | 'subtype'>>
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

function objectDraftFor(object: SystemObject, settings: ObjectFieldSettings): ObjectDraft {
  const placement = object.placement.kind === 'orbit'
    ? `orbit:${object.placement.orbitId}`
    : 'system'
  const customFieldIds = new Set([
    ...settings.customFields.map(field => field.id),
    ...Object.keys(object.customFieldValues ?? {}),
  ])
  const customFieldValues = Object.fromEntries([...customFieldIds].map(fieldId => {
    const value = object.customFieldValues?.[fieldId]
    return [fieldId, value === undefined ? '' : String(value)]
  }))

  return {
    locationKey: object.locationKey,
    name: object.name,
    description: object.description,
    subtype: object.subtype,
    placement,
    x: object.placement.kind === 'system' ? String(object.placement.x) : '',
    y: object.placement.kind === 'system' ? String(object.placement.y) : '',
    atmosphere: object.atmosphere ?? '',
    portClass: object.portClass ?? '',
    jumpStationId: object.jumpStationId ?? '',
    customFieldValues,
  }
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
    values: clone(objectDraftFor(object, settings)),
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
} {
  const objects = new Set<string>()
  const orbits = new Set<string>()
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
  }
  return { objects, orbits }
}

function globalObject(workspace: LocalWorkspace, objectId: string): SystemObject | undefined {
  return workspace.cluster.systems
    .flatMap(system => system.objects)
    .find(object => object.id === objectId)
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
  }
  return false
}

function customValueForDraft(
  value: string,
  definition: CustomFieldDefinition,
): { value: string | number | boolean } | { error: string } | null {
  if (value === '') return null
  if (definition.type === 'number') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? { value: parsed } : { error: `${definition.name} must be a finite number.` }
  }
  if (definition.type === 'boolean') {
    if (value === 'true') return { value: true }
    if (value === 'false') return { value: false }
    return { error: `Choose Yes, No, or Not recorded for ${definition.name}.` }
  }
  if (definition.type === 'single-select' && !definition.options.includes(value)) {
    return { error: `Choose an available ${definition.name} option.` }
  }
  return { value }
}

function parseFiniteInput(value: string, label: string, errors: Record<string, string>, key: string): number | null {
  if (!value.trim()) {
    errors[key] = `${label} is required.`
    return null
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    errors[key] = `${label} must be a finite number.`
    return null
  }
  return parsed
}

function resolveObjectDraft(
  workspace: LocalWorkspace,
  system: StarSystem,
  object: SystemObject,
  session: Extract<EntityInspectorSession, { kind: 'object' }>,
): { object: SystemObject | null; errors: Record<string, string> } {
  const errors: Record<string, string> = {}
  const draft = session.draft
  const initial = session.initial.values
  const changes: Parameters<typeof updateSystemObject>[2] = {}
  const locationKey = draft.locationKey.trim()
  const name = draft.name.trim()
  const subtype = draft.subtype.trim()
  if (!locationKey) errors.locationKey = 'Location key is required.'
  if (system.objects.some(candidate => candidate.id !== object.id && candidate.locationKey === locationKey)) {
    errors.locationKey = `Location key "${locationKey}" is already used in this star system.`
  }
  if (!name) errors.name = 'Object name is required.'
  if (name.length > 80) errors.name = 'Object name must be 80 characters or fewer.'
  if (!subtype) errors.subtype = 'Object type is required.'
  if (object.family !== 'Other' && subtype !== object.subtype) {
    errors.subtype = 'This catalogue type cannot be changed.'
  }
  if (locationKey !== initial.locationKey) changes.locationKey = locationKey
  if (name !== initial.name) changes.name = name
  if (draft.description !== initial.description) changes.description = draft.description
  if (subtype !== initial.subtype) changes.subtype = subtype

  if (draft.placement === 'system') {
    const x = parseFiniteInput(draft.x, 'Schematic X', errors, 'x')
    const y = parseFiniteInput(draft.y, 'Schematic Y', errors, 'y')
    const wasSystemPlacement = object.placement.kind === 'system'
    const placementChanged = draft.placement !== initial.placement
      || (wasSystemPlacement && (
        draft.x !== initial.x
        || draft.y !== initial.y
      ))
    if (placementChanged && x !== null && y !== null) {
      changes.placement = { kind: 'system', x, y }
    }
  } else {
    const orbitId = parseOrbitPlacement(draft.placement)
    if (!orbitId) {
      errors.placement = 'Choose a valid map placement.'
    } else if (!canPlaceObjectInOrbit(system, object.id, orbitId)) {
      errors.placement = 'Choose an Orbit that does not create a circular relationship.'
    } else if (draft.placement !== initial.placement) {
      changes.placement = { kind: 'orbit', orbitId }
    }
  }

  const jumpStationId = draft.jumpStationId
  if (jumpStationId && !system.objects.some(candidate => candidate.id === jumpStationId && isPhysicalStation(candidate))) {
    errors.jumpStationId = 'Choose an existing Physical Station.'
  }
  if (jumpStationId !== initial.jumpStationId) changes.jumpStationId = jumpStationId || null

  const settings = workspace.objectFieldSettings
  if (draft.atmosphere !== initial.atmosphere) {
    if (draft.atmosphere && !settings.atmosphereOptions.includes(draft.atmosphere)) {
      errors['native:atmosphere'] = 'Choose an available Atmosphere option.'
    } else if (draft.atmosphere && (object.family !== 'CelestialBody' || (subtype !== 'planet' && subtype !== 'moon'))) {
      errors['native:atmosphere'] = 'Atmosphere is only available for planets and moons.'
    } else {
      changes.atmosphere = draft.atmosphere || undefined
    }
  }
  if (draft.portClass !== initial.portClass) {
    if (draft.portClass && !settings.portClassOptions.includes(draft.portClass)) {
      errors['native:portClass'] = 'Choose an available Port class option.'
    } else if (draft.portClass && object.family !== 'Installation') {
      errors['native:portClass'] = 'Port class is only available for Physical Stations and other installations.'
    } else {
      changes.portClass = draft.portClass || undefined
    }
  }

  const customFieldValues = { ...(object.customFieldValues ?? {}) }
  let customFieldValuesChanged = false
  const definitionIds = new Set([
    ...Object.keys(initial.customFieldValues),
    ...Object.keys(draft.customFieldValues),
  ])
  for (const fieldId of definitionIds) {
    const currentValue = draft.customFieldValues[fieldId] ?? ''
    const originalValue = initial.customFieldValues[fieldId] ?? ''
    if (currentValue === originalValue) continue
    const definition = settings.customFields.find(field => field.id === fieldId)
    if (!definition) {
      errors[`custom:${fieldId}`] = 'This custom field definition is no longer available.'
      continue
    }
    const parsed = customValueForDraft(currentValue, definition)
    if (parsed && 'error' in parsed) {
      errors[`custom:${fieldId}`] = parsed.error
      continue
    }
    customFieldValuesChanged = true
    if (parsed === null) delete customFieldValues[fieldId]
    else customFieldValues[fieldId] = parsed.value
  }
  if (customFieldValuesChanged) changes.customFieldValues = customFieldValues

  if (Object.keys(errors).length) return { object: null, errors }
  try {
    const updatedSystem = updateSystemObject(system, object.id, changes, settings)
    return { object: updatedSystem.objects.find(candidate => candidate.id === object.id) ?? null, errors }
  } catch (error) {
    return {
      object: null,
      errors: { form: error instanceof Error ? error.message : String(error) },
    }
  }
}

export function useEntityInspectorSession({ workspace, applyWorkspace }: EntityInspectorSessionOptions) {
  const entitySession = ref<EntityInspectorSession | null>(null)
  let sessionSequence = 0
  let draftDependencies: DraftDependencySnapshots | null = null

  function captureDraftDependencies(): void {
    const session = entitySession.value
    const currentWorkspace = workspace.value
    if (!session || session.kind !== 'object' || !currentWorkspace) return
    if (!draftDependencies || draftDependencies.sessionId !== session.id) {
      draftDependencies = { sessionId: session.id, placements: new Map(), stations: new Map() }
    }
    const system = plannedSystem(currentWorkspace, session.systemId)
    if (!system) return
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
      : null
  }, captureDraftDependencies, { flush: 'sync' })

  const hasModifiedEntitySession = computed(() => {
    const session = entitySession.value
    if (!session) return false
    return !sameValue(session.draft, session.initial.values)
  })

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

    const initial = captureObjectBaseline(currentWorkspace, system, object)
    draftDependencies = {
      sessionId: sessionSequence + 1,
      placements: new Map(),
      stations: new Map(initial.linkedStations.map(station => [station.id, station])),
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

  function beginOrbitSession(clusterId: string, systemId: string, orbitId: string): void {
    const currentWorkspace = workspace.value
    const system = currentWorkspace?.cluster.systems.find(candidate => candidate.id === systemId)
    const orbit = system?.orbits.find(candidate => candidate.id === orbitId)
    if (!currentWorkspace || currentWorkspace.cluster.id !== clusterId || !system || !orbit) return
    const active = entitySession.value
    if (active?.kind === 'orbit' && active.clusterId === clusterId
      && active.systemId === systemId && active.targetId === orbitId) return

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
      errors: {},
      error: '',
    }
  }

  function discardEntitySession(expectedId?: number): void {
    const active = entitySession.value
    if (!active || (expectedId !== undefined && active.id !== expectedId)) return
    entitySession.value = null
    draftDependencies = null
  }

  function applyEntitySession(expectedId?: number): boolean {
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
      session.error = staleError
      return false
    }

    try {
      let nextWorkspace: LocalWorkspace
      if (session.kind === 'object') {
        const object = system.objects.find(candidate => candidate.id === session.targetId)
        if (!object) {
          session.error = 'The map object for this draft no longer exists.'
          return false
        }
        const result = resolveObjectDraft(currentWorkspace, system, object, session)
        session.errors = result.errors
        if (!result.object) {
          session.error = Object.values(result.errors).join(' ')
          return false
        }
        const updatedSystem = {
          ...system,
          objects: system.objects.map(candidate => candidate.id === object.id ? result.object! : candidate),
        }
        nextWorkspace = replaceWorkspaceSystem(currentWorkspace, updatedSystem)
      } else {
        const result = applyOrbitDraft(currentWorkspace, system, session)
        session.errors = result.errors
        if (!result.workspace) {
          session.error = Object.values(result.errors).join(' ')
          return false
        }
        nextWorkspace = result.workspace
      }

      const { durable } = applyWorkspace(nextWorkspace)
      if (entitySession.value?.id === session.id) {
        entitySession.value = null
        draftDependencies = null
      }
      void durable.catch(() => undefined)
      return true
    } catch (error) {
      session.error = error instanceof Error ? error.message : String(error)
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
    if (!session || !currentWorkspace || !hasModifiedEntitySession.value) return false

    if (command.kind === 'deletion') {
      return deletionChangesOwnedDependencies(currentWorkspace, session, command.target, draftDependencies)
    }
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
      return session.kind === 'orbit' && command.hostId === session.initial.orbit.hostId
    }
    if (command.kind === 'object-create') {
      // Appending a new occupant does not change the selected entity or any captured host dependency.
      return false
    }
    if (command.kind === 'orbit-geometry') {
      return ids.orbits.has(command.orbitId)
    }

    if (ids.orbits.has(command.orbitId)) return true
    if (session.kind === 'object' && command.hostId !== null && ids.objects.has(command.hostId)) return true
    if (session.kind === 'orbit') {
      const initialHostId = session.initial.orbit.hostId
      const siblingIds = new Set(session.initial.siblings.map(sibling => sibling.id))
      return siblingIds.has(command.orbitId) || command.hostId === initialHostId
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
        .some(entity => entity.id === session.targetId)
      && (hasModifiedEntitySession.value || getEntitySessionStaleError(session) === null)) return
    if (!hasModifiedEntitySession.value) discardEntitySession(session.id)
  })

  return {
    entitySession,
    hasModifiedEntitySession,
    beginObjectSession,
    beginOrbitSession,
    applyEntitySession,
    discardEntitySession,
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
  const targetOrder = parseFiniteInput(draft.targetOrder, 'Orbit order', errors, 'targetOrder')
  const horizontalRadius = parseFiniteInput(draft.horizontalRadius, 'Horizontal radius', errors, 'horizontalRadius')
  const verticalRadius = parseFiniteInput(draft.verticalRadius, 'Vertical radius', errors, 'verticalRadius')
  const rotation = parseFiniteInput(draft.rotation, 'Rotation', errors, 'rotation')
  const orbit = system.orbits.find(candidate => candidate.id === session.targetId)
  if (!orbit) return { workspace: null, errors: { form: 'The Orbit for this draft no longer exists.' } }

  const siblings = system.orbits.filter(candidate => candidate.hostId === orbit.hostId)
  if (targetOrder !== null && (!Number.isSafeInteger(targetOrder) || targetOrder < 1 || targetOrder > siblings.length)) {
    errors.targetOrder = `Choose an Orbit order from 1 to ${siblings.length}.`
  }
  const minimum = minimumOrbitRadius(system, orbit)
  if (horizontalRadius !== null && horizontalRadius < minimum) {
    errors.horizontalRadius = `Horizontal radius must be at least ${minimum}.`
  }
  if (verticalRadius !== null && verticalRadius < minimum) {
    errors.verticalRadius = `Vertical radius must be at least ${minimum}.`
  }

  let center: Point | undefined
  if (orbit.hostId === null) {
    const centerX = parseFiniteInput(draft.centerX, 'Center X', errors, 'centerX')
    const centerY = parseFiniteInput(draft.centerY, 'Center Y', errors, 'centerY')
    if (centerX !== null && centerY !== null) center = { x: centerX, y: centerY }
  }
  if (Object.keys(errors).length || targetOrder === null || horizontalRadius === null
    || verticalRadius === null || rotation === null) return { workspace: null, errors }

  let updatedSystem = system
  let currentOrder = orbit.order
  while (currentOrder !== targetOrder) {
    const direction = currentOrder < targetOrder ? 1 : -1
    updatedSystem = moveOrbitOnce(updatedSystem, orbit.id, direction)
    currentOrder += direction
  }
  if (center && orbit.hostId === null) {
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
  const changedRadii = horizontalRadius !== session.initial.effectiveRadii.horizontal
    || verticalRadius !== session.initial.effectiveRadii.vertical
  if (changedRadii) {
    const updatedDefault = defaultOrbitRadius(updatedSystem, updatedOrbit)
    if (horizontalRadius === updatedDefault && verticalRadius === updatedDefault) delete orbitRadii[orbit.id]
    else orbitRadii[orbit.id] = { horizontal: horizontalRadius, vertical: verticalRadius }
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
