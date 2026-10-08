import { customFieldApplicabilityTargetKey } from './workspace-model'
import type {
  CustomFieldApplicabilityTarget,
  CustomFieldDefinition,
  JumpClusterExport,
  JumpRoute,
  JsonImportSummary,
  LocalWorkspace,
  Orbit,
  PreparedJsonImport,
  StarSystem,
  StarSystemExport,
} from './workspace-model'
import { initialClusterSystemPosition } from './workspace-cluster'
import {
  isLocalWorkspace,
  isStarSystem,
  withDefaultJumpLevels,
  withoutLegacyObjectApplicabilityTargets,
} from './workspace-schema'
import { minimumOrbitRadius, normalizeOrbitRadii, normalizeOrbitRotations, orbitRadiiMeetMinimum } from './workspace-orbits'
import { isObjectFieldSettings, isRecord, objectFieldValidationError } from './workspace-validation'

function isImportedMap(value: unknown): value is JumpClusterExport | StarSystemExport {
  if (!isRecord(value)) return false
  const settings = value.objectFieldSettings
  const layout = value.layout
  if (
    value.format !== 'mothership-campaign-map'
    || value.version !== 1
    || !isObjectFieldSettings(settings)
    || !isRecord(layout)
    || layout.version !== 1
  ) {
    return false
  }

  if (value.type === 'cluster') {
    const cluster = value.cluster
    if (!isRecord(cluster)) return false
    const orbitRadii = normalizeOrbitRadii(
      layout.orbitRadii ?? {},
      layout.orbitEllipseRadii ?? {},
    )
    if (!orbitRadii) return false
    const orbitRotations = normalizeOrbitRotations(layout.orbitRotations ?? {})
    if (!orbitRotations) return false
    const validationIds = new Set<string>([cluster.id as string])
    for (const system of Array.isArray(cluster.systems) ? cluster.systems : []) {
      if (isRecord(system) && typeof system.id === 'string') validationIds.add(system.id)
      if (isRecord(system) && Array.isArray(system.objects)) {
        for (const object of system.objects) {
          if (isRecord(object) && typeof object.id === 'string') validationIds.add(object.id)
        }
      }
      if (isRecord(system) && Array.isArray(system.orbits)) {
        for (const orbit of system.orbits) {
          if (isRecord(orbit) && typeof orbit.id === 'string') validationIds.add(orbit.id)
        }
      }
    }
    for (const route of Array.isArray(cluster.routes) ? cluster.routes : []) {
      if (isRecord(route) && typeof route.id === 'string') validationIds.add(route.id)
    }
    for (const field of settings.customFields) validationIds.add(field.id)
    let validationId = crypto.randomUUID()
    while (validationIds.has(validationId)) validationId = crypto.randomUUID()

    const candidate = {
      id: validationId,
      cluster,
      objectFieldSettings: settings,
      layout: {
        systemPositions: layout.systemPositions,
        orbitRadii,
        orbitRotations,
        objectAngles: layout.objectAngles,
      },
    }
    if (!isLocalWorkspace(candidate)) return false

    const systemIds = new Set(candidate.cluster.systems.map(system => system.id))
    return Object.keys(candidate.layout.systemPositions).every(systemId => systemIds.has(systemId))
  }

  const system = value.system
  if (value.type !== 'system' || !isStarSystem(system)) return false
  if (!isRecord(layout.orbitRadii) || !isRecord(layout.objectAngles)) return false

  const orbitIds = new Set(system.orbits.map(orbit => orbit.id))
  const orbitRadii = normalizeOrbitRadii(layout.orbitRadii, layout.orbitEllipseRadii ?? {})
  if (!orbitRadii) return false
  const orbitRotations = normalizeOrbitRotations(layout.orbitRotations ?? {})
  if (!orbitRotations) return false
  const orbitalObjectIds = new Set(system.objects
    .filter(object => object.placement.kind === 'orbit')
    .map(object => object.id))
  return Object.entries(orbitRadii).every(([orbitId, radii]) => {
    const orbit = system.orbits.find(candidate => candidate.id === orbitId)
    return orbitIds.has(orbitId)
      && orbit !== undefined
      && orbitRadiiMeetMinimum(radii, minimumOrbitRadius(system, orbit))
  })
    && Object.keys(orbitRotations).every(orbitId => orbitIds.has(orbitId))
    && Object.values(layout.objectAngles).every(angle => typeof angle === 'number' && Number.isFinite(angle))
    && Object.keys(layout.objectAngles).every(objectId => orbitalObjectIds.has(objectId))
    && system.objects.every(object =>
      objectFieldValidationError(object, settings) === null,
    )
}

function workspaceEntityNames(workspace: LocalWorkspace): Map<string, string> {
  const entities = new Map<string, string>([
    [workspace.id, 'Local workspace'],
    [workspace.cluster.id, `Jump Cluster "${workspace.cluster.name}"`],
  ])
  for (const system of workspace.cluster.systems) {
    entities.set(system.id, `Star system "${system.name}"`)
    for (const object of system.objects) {
      entities.set(object.id, `${object.subtype} "${object.name}" in "${system.name}"`)
    }
    for (const orbit of system.orbits) {
      entities.set(orbit.id, `Orbit ${orbit.order} in "${system.name}"`)
    }
  }
  for (const route of workspace.cluster.routes) {
    entities.set(route.id, `Jump Route (Level ${route.jumpLevel})`)
  }
  for (const field of workspace.objectFieldSettings.customFields) {
    entities.set(field.id, `Custom field "${field.name}"`)
  }
  return entities
}

function sameFieldDefinition(
  left: CustomFieldDefinition,
  right: CustomFieldDefinition,
): boolean {
  return left.type === right.type
    && (left.type !== 'single-select'
      || (right.type === 'single-select'
        && left.options.length === right.options.length
        && left.options.every((option, index) => option === right.options[index])))
}

function unionCustomFieldApplicability(
  first: CustomFieldApplicabilityTarget[],
  second: CustomFieldApplicabilityTarget[],
): CustomFieldApplicabilityTarget[] {
  const targets = new Map(first.map(target => [customFieldApplicabilityTargetKey(target), target]))
  for (const target of second) targets.set(customFieldApplicabilityTargetKey(target), target)
  return [...targets.values()]
}

function remapImportedSystem(
  system: StarSystem,
  ids: Map<string, string>,
  fieldIds: Map<string, string>,
): StarSystem {
  return {
    ...system,
    id: ids.get(system.id)!,
    objects: system.objects.map(object => ({
      ...object,
      id: ids.get(object.id)!,
      placement: object.placement.kind === 'orbit'
        ? { kind: 'orbit', orbitId: ids.get(object.placement.orbitId)! }
        : object.placement,
      ...(object.jumpStationId
        ? { jumpStationId: ids.get(object.jumpStationId)! }
        : {}),
      ...(object.customFieldValues
        ? {
            customFieldValues: Object.fromEntries(
              Object.entries(object.customFieldValues)
                .map(([fieldId, value]) => [fieldIds.get(fieldId)!, value]),
            ),
          }
        : {}),
    })),
    orbits: system.orbits.map((orbit): Orbit => orbit.hostId === null
      ? { ...orbit, id: ids.get(orbit.id)! }
      : { ...orbit, id: ids.get(orbit.id)!, hostId: ids.get(orbit.hostId)! }),
  }
}

export function prepareJsonImport(workspace: LocalWorkspace, value: unknown): PreparedJsonImport {
  const map = withDefaultJumpLevels(withoutLegacyObjectApplicabilityTargets(value))
  if (!isImportedMap(map)) {
    throw new Error('Choose a valid version 1 Jump Cluster or star system JSON export.')
  }

  const sourceSystems = map.type === 'cluster' ? map.cluster.systems : [map.system]
  const sourceRoutes = map.type === 'cluster' ? map.cluster.routes : []
  const sourceSettings = map.objectFieldSettings
  const existingNames = workspaceEntityNames(workspace)
  const sourceEntities = [
    ...sourceSystems.flatMap(system => [
      { id: system.id, entity: 'Star system', name: system.name },
      ...system.objects.map(object => ({ id: object.id, entity: object.subtype, name: object.name })),
      ...system.orbits.map(orbit => ({ id: orbit.id, entity: 'Orbit', name: `Orbit ${orbit.order}` })),
    ]),
    ...sourceRoutes.map(route => ({ id: route.id, entity: 'Jump Route', name: `Jump Level ${route.jumpLevel}` })),
    ...sourceSettings.customFields.map(field => ({ id: field.id, entity: 'Custom field', name: field.name })),
  ]
  const idCollisions = sourceEntities.flatMap(entity => {
    const existingEntity = existingNames.get(entity.id)
    return existingEntity
      ? [{ entity: entity.entity, name: `${entity.name} (matches ${existingEntity})`, id: entity.id }]
      : []
  })
  const possibleMatches: JsonImportSummary['possibleMatches'] = []
  for (const sourceSystem of sourceSystems) {
    const existingSystems = workspace.cluster.systems.filter(system =>
      system.name.toLowerCase() === sourceSystem.name.toLowerCase(),
    )
    for (const existingSystem of existingSystems) {
      possibleMatches.push({
        entity: 'Star system',
        name: sourceSystem.name,
        existingSystem: existingSystem.name,
        reason: 'same name',
      })
      for (const sourceObject of sourceSystem.objects) {
        const matchingObjects = existingSystem.objects.filter(object =>
          object.name.toLowerCase() === sourceObject.name.toLowerCase()
          || object.locationKey.toLowerCase() === sourceObject.locationKey.toLowerCase(),
        )
        for (const existingObject of matchingObjects) {
          const sameName = existingObject.name.toLowerCase() === sourceObject.name.toLowerCase()
          const sameKey = existingObject.locationKey.toLowerCase() === sourceObject.locationKey.toLowerCase()
          possibleMatches.push({
            entity: `${sourceObject.subtype} "${sourceObject.name}"`,
            name: existingObject.name,
            existingSystem: existingSystem.name,
            reason: sameName && sameKey
              ? `same name and location key (${existingObject.locationKey})`
              : sameName
                ? 'same name'
                : `same location key (${existingObject.locationKey})`,
          })
        }
      }
    }
  }

  const summary: JsonImportSummary = {
    type: map.type,
    systems: sourceSystems.length,
    objects: sourceSystems.reduce((count, system) => count + system.objects.length, 0),
    orbits: sourceSystems.reduce((count, system) => count + system.orbits.length, 0),
    routes: sourceRoutes.length,
    customFields: sourceSettings.customFields.length,
    idCollisions,
    possibleMatches,
  }

  const usedIds = new Set(existingNames.keys())
  const allocateId = (): string => {
    let id = crypto.randomUUID()
    while (usedIds.has(id)) id = crypto.randomUUID()
    usedIds.add(id)
    return id
  }
  const ids = new Map<string, string>()
  for (const system of sourceSystems) {
    ids.set(system.id, allocateId())
    for (const object of system.objects) ids.set(object.id, allocateId())
    for (const orbit of system.orbits) ids.set(orbit.id, allocateId())
  }
  for (const route of sourceRoutes) ids.set(route.id, allocateId())

  const customFields = [...workspace.objectFieldSettings.customFields]
  const fieldIds = new Map<string, string>()
  for (const sourceField of sourceSettings.customFields) {
    const sameName = customFields.find(field =>
      field.name.toLowerCase() === sourceField.name.toLowerCase(),
    )
    const applicability = sourceField.applicability
    if (sameName) {
      if (!sameFieldDefinition(sameName, sourceField)) {
        throw new Error(`Custom field "${sourceField.name}" conflicts with an existing field definition.`)
      }
      fieldIds.set(sourceField.id, sameName.id)
      if (sameName.applicability !== undefined) {
        customFields[customFields.indexOf(sameName)] = applicability === undefined
          ? { ...sameName, applicability: undefined }
          : {
              ...sameName,
              applicability: unionCustomFieldApplicability(sameName.applicability, applicability),
            }
      }
      continue
    }

    const id = allocateId()
    fieldIds.set(sourceField.id, id)
    customFields.push({ ...sourceField, id })
  }

  const importedSystems = sourceSystems.map(system => remapImportedSystem(system, ids, fieldIds))
  const importedRoutes: JumpRoute[] = sourceRoutes.map((route): JumpRoute =>
    route.toPointId === null
      ? {
          id: ids.get(route.id)!,
          ...(route.name !== undefined ? { name: route.name } : {}),
          jumpLevel: route.jumpLevel,
          fromPointId: ids.get(route.fromPointId)!,
          toPointId: null,
          unresolvedExit: route.unresolvedExit,
        }
      : {
          id: ids.get(route.id)!,
          ...(route.name !== undefined ? { name: route.name } : {}),
          jumpLevel: route.jumpLevel,
          fromPointId: ids.get(route.fromPointId)!,
          toPointId: ids.get(route.toPointId)!,
        },
  )
  const layout = {
    systemPositions: { ...workspace.layout.systemPositions },
    orbitRadii: { ...workspace.layout.orbitRadii },
    orbitRotations: { ...workspace.layout.orbitRotations },
    objectAngles: { ...workspace.layout.objectAngles },
  }
  const addedSystemIds = importedSystems.map(system => system.id)
  if (map.type === 'cluster') {
    for (const [sourceId, position] of Object.entries(map.layout.systemPositions)) {
      layout.systemPositions[ids.get(sourceId)!] = position
    }
  } else {
    layout.systemPositions[addedSystemIds[0]] = initialClusterSystemPosition(
      workspace.cluster.systems.length,
    )
  }
  const importedOrbitRadii = normalizeOrbitRadii(
    map.layout.orbitRadii,
    map.layout.orbitEllipseRadii ?? {},
  )
  if (!importedOrbitRadii) {
    throw new Error('Choose a valid version 1 Jump Cluster or star system JSON export.')
  }
  for (const [sourceId, radii] of Object.entries(importedOrbitRadii)) {
    layout.orbitRadii[ids.get(sourceId)!] = radii
  }
  const importedOrbitRotations = normalizeOrbitRotations(map.layout.orbitRotations ?? {})
  if (!importedOrbitRotations) {
    throw new Error('Choose a valid version 1 Jump Cluster or star system JSON export.')
  }
  for (const [sourceId, rotation] of Object.entries(importedOrbitRotations)) {
    layout.orbitRotations[ids.get(sourceId)!] = rotation
  }
  for (const [sourceId, angle] of Object.entries(map.layout.objectAngles)) {
    layout.objectAngles[ids.get(sourceId)!] = angle
  }

  const nextWorkspace: LocalWorkspace = {
    ...workspace,
    cluster: {
      ...workspace.cluster,
      systems: [...workspace.cluster.systems, ...importedSystems],
      routes: [...workspace.cluster.routes, ...importedRoutes],
    },
    layout,
    objectFieldSettings: {
      atmosphereOptions: mergeFieldOptions(
        workspace.objectFieldSettings.atmosphereOptions,
        sourceSettings.atmosphereOptions,
      ),
      portClassOptions: mergeFieldOptions(
        workspace.objectFieldSettings.portClassOptions,
        sourceSettings.portClassOptions,
      ),
      customFields,
    },
  }
  if (!isLocalWorkspace(nextWorkspace)) {
    throw new Error('The imported map could not be safely added to this workspace.')
  }

  return { workspace: nextWorkspace, addedSystemIds, summary }
}

function mergeFieldOptions(existing: string[], incoming: string[]): string[] {
  const merged = [...existing]
  const existingOptions = new Set(existing.map(option => option.toLowerCase()))
  for (const option of incoming) {
    if (!existingOptions.has(option.toLowerCase())) {
      merged.push(option)
      existingOptions.add(option.toLowerCase())
    }
  }
  return merged
}
