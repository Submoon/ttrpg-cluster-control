import { expect, test } from './fixtures'
import {
  addCustomFieldDefinition,
  createJumpRoute,
  createLocalWorkspace,
  createSystemObject,
  exportJumpCluster,
  isLocalWorkspace,
  nativePlayerFieldIds,
  prepareJsonImport,
  projectPlayerCluster,
  removeCustomFieldDefinition,
  replaceWorkspaceSystem,
  restoreLocalWorkspace,
  updateJumpRoute,
  updateFieldPlayerSharing,
  updateCustomFieldApplicability,
  updateChartDetails,
  updateSystemObject,
} from '../domain/workspace'

function legacyReservedFieldIdFixture(): {
  workspace: ReturnType<typeof createLocalWorkspace>
  legacyWorkspace: Record<string, unknown>
  legacyExport: Record<string, unknown>
} {
  let workspace = createLocalWorkspace('Legacy Alias Reach', 'Legacy System')
  workspace = addCustomFieldDefinition(workspace, 'Atmosphere Alias', 'text')
  workspace = addCustomFieldDefinition(workspace, 'Port Class Alias', 'text')
  workspace = addCustomFieldDefinition(workspace, 'Existing Legacy Alias', 'text')
  const fields = workspace.objectFieldSettings.customFields
  const initialSystem = workspace.cluster.systems[0]!
  const planet = createSystemObject(initialSystem, 'planet')
  const systemWithPlanet = { ...initialSystem, objects: [...initialSystem.objects, planet] }
  const station = createSystemObject(systemWithPlanet, 'station')
  const systemWithEntities = { ...systemWithPlanet, objects: [...systemWithPlanet.objects, station] }
  const planetEdited = updateSystemObject(
    systemWithEntities,
    planet.id,
    {
      atmosphere: 'Vacuum',
      customFieldValues: {
        [fields[0]!.id]: 'CUSTOM ATMOSPHERE ALIAS VALUE',
        [fields[1]!.id]: 'CUSTOM PORT ALIAS ON PLANET',
        [fields[2]!.id]: 'EXISTING ALIAS VALUE',
      },
    },
    workspace.objectFieldSettings,
  )
  const stationEdited = updateSystemObject(
    planetEdited,
    station.id,
    {
      portClass: 'Class II',
      customFieldValues: {
        [fields[0]!.id]: 'CUSTOM ATMOSPHERE ALIAS ON STATION',
        [fields[1]!.id]: 'CUSTOM PORT ALIAS VALUE',
        [fields[2]!.id]: 'EXISTING ALIAS ON STATION',
      },
    },
    workspace.objectFieldSettings,
  )
  workspace = replaceWorkspaceSystem(workspace, stationEdited)

  function makeV3(value: unknown): Record<string, unknown> {
    const legacy = structuredClone(value) as unknown as Record<string, unknown>
    legacy.version = 3
    const settings = legacy.objectFieldSettings as {
      customFields: Array<{ id: string; name: string; playerShared?: boolean }>
      nativePlayerSharing?: unknown
    }
    const legacyIdsByName = new Map([
      ['Atmosphere Alias', 'native:atmosphere'],
      ['Port Class Alias', 'native:port-class'],
      ['Existing Legacy Alias', 'legacy-custom-field-1'],
    ])
    const oldToLegacyId = new Map(settings.customFields.map(field => [
      field.id,
      legacyIdsByName.get(field.name)!,
    ]))
    for (const field of settings.customFields) {
      field.id = legacyIdsByName.get(field.name)!
      delete field.playerShared
    }
    delete settings.nativePlayerSharing

    const cluster = legacy.cluster as {
      systems: Array<{ objects: Array<Record<string, unknown>> }>
      routes: Array<Record<string, unknown>>
    }
    for (const system of cluster.systems) {
      for (const object of system.objects) {
        delete object.playerText
        delete object.playerFieldMasks
        if (object.customFieldValues !== undefined) {
          const values = object.customFieldValues as Record<string, unknown>
          object.customFieldValues = Object.fromEntries(Object.entries(values).map(([fieldId, fieldValue]) => [
            oldToLegacyId.get(fieldId) ?? fieldId,
            fieldValue,
          ]))
        }
      }
    }
    for (const route of cluster.routes) delete route.playerShared
    return legacy
  }

  return {
    workspace,
    legacyWorkspace: makeV3(workspace),
    legacyExport: makeV3(exportJumpCluster(workspace)),
  }
}

test('new player-sharing data starts private and empty @pure', () => {
  const workspace = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const system = workspace.cluster.systems[0]!
  const newObject = createSystemObject(system, 'planet')
  const fromPoint = createSystemObject(system, 'jump-point')
  const toPoint = createSystemObject(system, 'jump-point')
  const clusterWithPoints = {
    ...workspace.cluster,
    systems: [{ ...system, objects: [...system.objects, fromPoint, toPoint] }],
  }
  const route = createJumpRoute(clusterWithPoints, 1, fromPoint.id, toPoint.id)
  const withField = addCustomFieldDefinition(workspace, 'Faction', 'single-select', ['Merchants'])
  const customField = withField.objectFieldSettings.customFields[0]!

  expect(workspace.version).toBe(4)
  expect(system.objects[0]).toMatchObject({ playerText: '', playerFieldMasks: [] })
  expect(newObject).toMatchObject({ playerText: '', playerFieldMasks: [] })
  expect(withField.objectFieldSettings.nativePlayerSharing).toEqual({ atmosphere: false, portClass: false })
  expect(customField.playerShared).toBe(false)
  expect(route.playerShared).toBe(false)
})

test('version 3 workspaces migrate publication additions privately while retaining GM notes @pure', () => {
  const workspace = createLocalWorkspace('Kestrel Reach', 'Vesper')
  expect(isLocalWorkspace(workspace)).toBe(true)
  const system = workspace.cluster.systems[0]!
  const fromPoint = createSystemObject(system, 'jump-point')
  const systemWithFromPoint = { ...system, objects: [...system.objects, fromPoint] }
  const toPoint = createSystemObject(systemWithFromPoint, 'jump-point')
  const systemWithPoints = {
    ...system,
    publication: 'revealed' as const,
    objects: [
      { ...system.objects[0]!, description: 'PRIVATE GM NOTES' },
      fromPoint,
      toPoint,
    ],
  }
  const clusterWithPoints = { ...workspace.cluster, systems: [systemWithPoints] }
  const route = createJumpRoute(clusterWithPoints, 2, fromPoint.id, toPoint.id)
  const withField = addCustomFieldDefinition(workspace, 'Faction', 'single-select', ['Merchants'])
  const legacy = structuredClone({
    ...withField,
    version: 3,
    cluster: { ...clusterWithPoints, routes: [route] },
  }) as unknown as Record<string, unknown>
  const legacySystem = (legacy.cluster as { systems: Array<{ objects: Array<Record<string, unknown>> }> }).systems[0]!
  for (const object of legacySystem.objects) {
    delete object.playerText
    delete object.playerFieldMasks
  }
  const legacyCluster = legacy.cluster as { routes: Array<Record<string, unknown>> }
  delete legacyCluster.routes[0]?.playerShared
  const legacySettings = legacy.objectFieldSettings as {
    customFields: Array<Record<string, unknown>>
    nativePlayerSharing?: unknown
  }
  delete legacySettings.nativePlayerSharing
  delete legacySettings.customFields[0]?.playerShared

  const restored = restoreLocalWorkspace(legacy)

  expect(restored).not.toBeNull()
  if (!restored) throw new Error('Expected the supported v3 workspace to restore.')
  expect(restored.version).toBe(4)
  expect(restored.cluster.systems[0]).toHaveProperty('publication', 'revealed')
  expect(restored.cluster.systems[0]?.objects[0]).toMatchObject({
    description: 'PRIVATE GM NOTES',
    playerText: '',
    playerFieldMasks: [],
  })
  expect(restored.cluster.routes[0]).toMatchObject({ jumpLevel: 2, playerShared: false })
  expect(restored.objectFieldSettings.nativePlayerSharing).toEqual({ atmosphere: false, portClass: false })
  expect(restored.objectFieldSettings.customFields[0]).toMatchObject({ name: 'Faction', playerShared: false })
})

test('version 4 workspace data requires every sharing field and rejects unsupported versions @pure', () => {
  const workspace = createLocalWorkspace('Kestrel Reach', 'Vesper')
  expect(isLocalWorkspace(workspace)).toBe(true)
  expect(restoreLocalWorkspace(workspace)).toMatchObject({ version: 4 })

  const missingPlayerText = structuredClone(workspace) as unknown as Record<string, unknown>
  const missingTextCluster = missingPlayerText.cluster as {
    systems: Array<{ objects: Array<Record<string, unknown>> }>
  }
  delete missingTextCluster.systems[0]!.objects[0]!.playerText

  const missingNativeSharing = structuredClone(workspace) as unknown as Record<string, unknown>
  const missingSettings = missingNativeSharing.objectFieldSettings as Record<string, unknown>
  delete missingSettings.nativePlayerSharing

  const unsupportedVersion = { ...workspace, version: 5 }

  expect(isLocalWorkspace(missingPlayerText)).toBe(false)
  expect(restoreLocalWorkspace(missingPlayerText)).toBeNull()
  expect(isLocalWorkspace(missingNativeSharing)).toBe(false)
  expect(restoreLocalWorkspace(missingNativeSharing)).toBeNull()
  expect(restoreLocalWorkspace(unsupportedVersion)).toBeNull()
})

test('versions 1 and 2 keep their prior disclosure rules and receive private sharing defaults @pure', () => {
  const workspace = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const versionTwo = structuredClone(workspace) as unknown as Record<string, unknown>
  versionTwo.version = 2
  const versionTwoCluster = versionTwo.cluster as {
    playerTitle: string
    systems: Array<{ publication: string; objects: Array<Record<string, unknown>> }>
  }
  versionTwoCluster.playerTitle = 'Aster Reach'
  versionTwoCluster.systems[0]!.publication = 'revealed'
  delete versionTwoCluster.systems[0]!.objects[0]!.publication
  delete versionTwoCluster.systems[0]!.objects[0]!.playerText
  delete versionTwoCluster.systems[0]!.objects[0]!.playerFieldMasks
  delete (versionTwo.objectFieldSettings as Record<string, unknown>).nativePlayerSharing

  const unversioned = structuredClone(workspace) as unknown as Record<string, unknown>
  delete unversioned.version
  delete unversioned.objectFieldSettings
  const unversionedCluster = unversioned.cluster as {
    playerTitle?: string
    systems: Array<{ publication?: string; objects: Array<Record<string, unknown>> }>
  }
  delete unversionedCluster.playerTitle
  delete unversionedCluster.systems[0]!.publication
  delete unversionedCluster.systems[0]!.objects[0]!.publication
  delete unversionedCluster.systems[0]!.objects[0]!.playerText
  delete unversionedCluster.systems[0]!.objects[0]!.playerFieldMasks

  const restoredV2 = restoreLocalWorkspace(versionTwo)
  const restoredV1 = restoreLocalWorkspace(unversioned)

  expect(restoredV2).toMatchObject({
    version: 4,
    cluster: {
      playerTitle: 'Aster Reach',
      systems: [{ publication: 'revealed', objects: [{ publication: 'hidden', playerText: '', playerFieldMasks: [] }] }],
    },
    objectFieldSettings: { nativePlayerSharing: { atmosphere: false, portClass: false } },
  })
  expect(restoredV1).toMatchObject({
    version: 4,
    cluster: {
      name: workspace.cluster.name,
      playerTitle: 'Player Jump Cluster',
      systems: [{ name: workspace.cluster.systems[0]!.name, publication: 'hidden', objects: [{ publication: 'hidden', playerText: '', playerFieldMasks: [] }] }],
    },
  })
})

test('route edits preserve or explicitly change player sharing @pure', () => {
  const workspace = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const system = workspace.cluster.systems[0]!
  const fromPoint = createSystemObject(system, 'jump-point')
  const withFrom = { ...system, objects: [...system.objects, fromPoint] }
  const toPoint = createSystemObject(withFrom, 'jump-point')
  const cluster = {
    ...workspace.cluster,
    systems: [{ ...system, objects: [...system.objects, fromPoint, toPoint] }],
  }
  const unshared = createJumpRoute(cluster, 1, fromPoint.id, toPoint.id)
  const createdShared = createJumpRoute(cluster, 1, fromPoint.id, toPoint.id, 'Uncharted exit', true)
  const shared = { ...unshared, id: 'shared-route', playerShared: true }
  const clusterWithRoutes = { ...cluster, routes: [unshared, shared] }

  const editedUnshared = updateJumpRoute(clusterWithRoutes, unshared.id, 2, fromPoint.id, toPoint.id)
  const editedShared = updateJumpRoute(clusterWithRoutes, shared.id, 3, fromPoint.id, toPoint.id)
  const sharedNow = updateJumpRoute(
    clusterWithRoutes,
    unshared.id,
    4,
    fromPoint.id,
    toPoint.id,
    'Uncharted exit',
    true,
  )

  expect(editedUnshared.playerShared).toBe(false)
  expect(editedShared.playerShared).toBe(true)
  expect(sharedNow.playerShared).toBe(true)
  expect(createdShared.playerShared).toBe(true)
})

test('version 4 backup restore and independent import preserve private notes and remap Field masks @pure', () => {
  const initial = createLocalWorkspace('Source Reach', 'Aster')
  const withFaction = addCustomFieldDefinition(initial, 'Faction', 'single-select', ['Merchants', 'Cult'], true)
  const faction = withFaction.objectFieldSettings.customFields[0]!
  const system = withFaction.cluster.systems[0]!
  const star = system.objects[0]!
  const updatedSystem = updateSystemObject(
    system,
    star.id,
    {
      description: 'PRIVATE BACKUP NOTES',
      playerText: 'PUBLIC BACKUP TEXT',
      playerFieldMasks: [faction.id, nativePlayerFieldIds.atmosphere],
      customFieldValues: { [faction.id]: 'Merchants' },
    },
    withFaction.objectFieldSettings,
  )
  const firstPoint = createSystemObject(updatedSystem, 'jump-point')
  const systemWithFirstPoint = { ...updatedSystem, objects: [...updatedSystem.objects, firstPoint] }
  const secondPoint = createSystemObject(systemWithFirstPoint, 'jump-point')
  const sourceSystem = { ...systemWithFirstPoint, objects: [...systemWithFirstPoint.objects, secondPoint] }
  const sourceWithPoints = replaceWorkspaceSystem(withFaction, sourceSystem)
  const sharedRoute = createJumpRoute(
    sourceWithPoints.cluster,
    6,
    firstPoint.id,
    secondPoint.id,
    'PRIVATE ROUTE EXIT LABEL',
    true,
  )
  const sourceRoute = { ...sharedRoute, name: 'PRIVATE ROUTE NAME' }
  const source = {
    ...sourceWithPoints,
    cluster: { ...sourceWithPoints.cluster, routes: [sourceRoute] },
  }
  const restored = restoreLocalWorkspace(structuredClone(source))
  const backup = exportJumpCluster(source)

  expect(restored).not.toBeNull()
  if (!restored) throw new Error('Expected the version 4 source workspace to restore.')
  expect(restored.version).toBe(4)
  expect(restored.cluster.systems[0]?.objects[0]).toMatchObject({
    description: 'PRIVATE BACKUP NOTES',
    playerText: 'PUBLIC BACKUP TEXT',
  })
  expect(backup.version).toBe(4)
  expect(restored?.cluster.routes[0]).toMatchObject({ jumpLevel: 6, playerShared: true })
  expect(backup.cluster.routes[0]).toMatchObject({ jumpLevel: 6, playerShared: true })

  const imported = prepareJsonImport(createLocalWorkspace('Destination Reach', 'Boreal'), backup)
  const importedSystem = imported.workspace.cluster.systems.find(candidate => candidate.name === 'Aster')
  const importedFaction = imported.workspace.objectFieldSettings.customFields.find(field => field.name === 'Faction')
  const importedRoute = imported.workspace.cluster.routes[0]
  expect(importedSystem?.objects[0]).toMatchObject({
    description: 'PRIVATE BACKUP NOTES',
    playerText: 'PUBLIC BACKUP TEXT',
    customFieldValues: { [importedFaction!.id]: 'Merchants' },
    playerFieldMasks: [importedFaction!.id, nativePlayerFieldIds.atmosphere],
  })
  expect(importedFaction).toMatchObject({ playerShared: true, options: ['Merchants', 'Cult'] })
  expect(importedFaction?.id).not.toBe(faction.id)
  expect(importedRoute).toMatchObject({ jumpLevel: 6, playerShared: true, name: 'PRIVATE ROUTE NAME' })
  expect(importedRoute?.id).not.toBe(sourceRoute.id)
  expect(importedRoute?.fromPointId).not.toBe(sourceRoute.fromPointId)
  expect(importedRoute?.toPointId).not.toBe(sourceRoute.toPointId)
  expect(importedSystem?.objects.map(object => object.id)).toContain(importedRoute?.fromPointId)
  expect(importedSystem?.objects.map(object => object.id)).toContain(importedRoute?.toPointId)
})

test('object masks reject unknown and duplicate IDs and custom definitions reserve native IDs @pure', () => {
  const workspace = createLocalWorkspace('Mask Reach', 'Aster')
  const system = workspace.cluster.systems[0]!
  const star = system.objects[0]!

  expect(() => updateSystemObject(
    system,
    star.id,
    { playerFieldMasks: ['missing-field-id'] },
    workspace.objectFieldSettings,
  )).toThrow(/valid player Field masks/)
  expect(() => updateSystemObject(
    system,
    star.id,
    { playerFieldMasks: [nativePlayerFieldIds.atmosphere, nativePlayerFieldIds.atmosphere] },
    workspace.objectFieldSettings,
  )).toThrow(/valid player Field masks/)

  const reservedDefinition = structuredClone(workspace) as unknown as Record<string, unknown>
  const fieldSettings = reservedDefinition.objectFieldSettings as { customFields: Array<Record<string, unknown>> }
  fieldSettings.customFields.push({
    id: nativePlayerFieldIds.atmosphere,
    name: 'Reserved Native ID',
    type: 'text',
    playerShared: true,
  })
  expect(restoreLocalWorkspace(reservedDefinition)).toBeNull()
})

test('native Field sharing conflicts reject full-map imports in either direction @pure', () => {
  for (const [sourcePolicy, destinationPolicy] of [[true, false], [false, true]] as const) {
    const source = updateFieldPlayerSharing(
      createLocalWorkspace('Source Reach', 'Aster'),
      nativePlayerFieldIds.atmosphere,
      sourcePolicy,
    )
    const destination = updateFieldPlayerSharing(
      createLocalWorkspace('Destination Reach', 'Boreal'),
      nativePlayerFieldIds.atmosphere,
      destinationPolicy,
    )
    const destinationBefore = structuredClone(destination)

    expect(() => prepareJsonImport(destination, exportJumpCluster(source)))
      .toThrow(/Native Field "Atmosphere" has a conflicting player-sharing setting/)
    expect(destination).toEqual(destinationBefore)
  }
})

test('same-name custom Field sharing conflicts reject full-map imports in either direction @pure', () => {
  for (const [sourcePolicy, destinationPolicy] of [[true, false], [false, true]] as const) {
    const source = addCustomFieldDefinition(
      createLocalWorkspace('Source Reach', 'Aster'),
      'Faction',
      'single-select',
      ['Merchants', 'Cult'],
      sourcePolicy,
    )
    const destination = addCustomFieldDefinition(
      createLocalWorkspace('Destination Reach', 'Boreal'),
      'Faction',
      'single-select',
      ['Merchants', 'Cult'],
      destinationPolicy,
    )
    const destinationBefore = structuredClone(destination)

    expect(() => prepareJsonImport(destination, exportJumpCluster(source)))
      .toThrow(/Custom field "Faction" has a conflicting player-sharing setting/)
    expect(destination).toEqual(destinationBefore)
  }
})

test('shared custom applicability conflicts reject union while private compatible scopes may union @pure', () => {
  const sharedSourceBase = addCustomFieldDefinition(
    createLocalWorkspace('Source Reach', 'Aster'),
    'Presence',
    'text',
    [],
    true,
  )
  const sharedSourceField = sharedSourceBase.objectFieldSettings.customFields[0]!
  const sharedSource = updateCustomFieldApplicability(
    sharedSourceBase,
    sharedSourceField.id,
    [{ kind: 'category', family: 'CelestialBody' }],
  )
  const sharedDestinationBase = addCustomFieldDefinition(
    createLocalWorkspace('Destination Reach', 'Boreal'),
    'Presence',
    'text',
    [],
    true,
  )
  const sharedDestination = updateCustomFieldApplicability(
    sharedDestinationBase,
    sharedDestinationBase.objectFieldSettings.customFields[0]!.id,
    [{ kind: 'category', family: 'Installation' }],
  )
  const destinationBeforeConflict = structuredClone(sharedDestination)

  expect(() => prepareJsonImport(sharedDestination, exportJumpCluster(sharedSource)))
    .toThrow(/Shared custom field "Presence" has conflicting applicability/)
  expect(sharedDestination).toEqual(destinationBeforeConflict)

  const privateSourceBase = addCustomFieldDefinition(
    createLocalWorkspace('Source Reach', 'Aster'),
    'Access zone',
    'text',
  )
  const privateSource = updateCustomFieldApplicability(
    privateSourceBase,
    privateSourceBase.objectFieldSettings.customFields[0]!.id,
    [{ kind: 'category', family: 'CelestialBody' }],
  )
  const privateDestinationBase = addCustomFieldDefinition(
    createLocalWorkspace('Destination Reach', 'Boreal'),
    'Access zone',
    'text',
  )
  const privateDestination = updateCustomFieldApplicability(
    privateDestinationBase,
    privateDestinationBase.objectFieldSettings.customFields[0]!.id,
    [{ kind: 'category', family: 'Installation' }],
  )

  const merged = prepareJsonImport(privateDestination, exportJumpCluster(privateSource))
  const mergedField = merged.workspace.objectFieldSettings.customFields.find(field => field.name === 'Access zone')

  expect(mergedField?.playerShared).toBe(false)
  expect(mergedField?.applicability).toEqual([
    { kind: 'category', family: 'Installation' },
    { kind: 'category', family: 'CelestialBody' },
  ])
})

test('masks remain on private, inapplicable, and unassigned Fields until their definitions are deleted @pure', () => {
  let workspace = createLocalWorkspace('Mask Reach', 'Aster')
  workspace = addCustomFieldDefinition(workspace, 'Private Clue', 'text')
  workspace = addCustomFieldDefinition(workspace, 'Planet Habitat', 'text', [], true)
  workspace = addCustomFieldDefinition(workspace, 'Unassigned Public Field', 'boolean', [], true)
  const privateField = workspace.objectFieldSettings.customFields[0]!
  const inapplicableField = workspace.objectFieldSettings.customFields[1]!
  const unassignedField = workspace.objectFieldSettings.customFields[2]!
  workspace = updateCustomFieldApplicability(
    workspace,
    inapplicableField.id,
    [{ kind: 'subtype', family: 'CelestialBody', subtype: 'planet' }],
  )
  const system = workspace.cluster.systems[0]!
  const star = system.objects[0]!
  const updatedSystem = updateSystemObject(
    system,
    star.id,
    {
      publication: 'revealed',
      playerText: 'Public text stays separate.',
      customFieldValues: {
        [privateField.id]: 'ONLY GM PRIVATE VALUE',
        [inapplicableField.id]: 'INACTIVE PRIVATE VALUE',
      },
      playerFieldMasks: [
        privateField.id,
        inapplicableField.id,
        unassignedField.id,
        nativePlayerFieldIds.atmosphere,
      ],
    },
    workspace.objectFieldSettings,
  )
  workspace = replaceWorkspaceSystem(workspace, updatedSystem)
  workspace = updateChartDetails(workspace, system.id, {
    clusterName: workspace.cluster.name,
    systemName: system.name,
    playerTitle: workspace.cluster.playerTitle,
    publication: 'revealed',
  })

  expect(isLocalWorkspace(workspace)).toBe(true)
  const restored = restoreLocalWorkspace(structuredClone(workspace))
  expect(restored?.cluster.systems[0]?.objects[0]?.playerFieldMasks).toEqual([
    privateField.id,
    inapplicableField.id,
    unassignedField.id,
    nativePlayerFieldIds.atmosphere,
  ])
  const document = projectPlayerCluster(workspace)
  const revealedSystem = document.systems[0]
  if (!revealedSystem || revealedSystem.disclosure !== 'revealed') {
    throw new Error('Expected the masked Field fixture system to be Revealed.')
  }
  expect(revealedSystem.map.objects[0]).toMatchObject({
    playerText: 'Public text stays separate.',
    fields: [],
  })
  const serialized = JSON.stringify(document)
  expect(serialized).not.toContain('Private Clue')
  expect(serialized).not.toContain('Planet Habitat')
  expect(serialized).not.toContain('Unassigned Public Field')
  expect(serialized).not.toContain('ONLY GM PRIVATE VALUE')
  expect(serialized).not.toContain('INACTIVE PRIVATE VALUE')

  let withoutDefinitions = removeCustomFieldDefinition(workspace, privateField.id)
  withoutDefinitions = removeCustomFieldDefinition(withoutDefinitions, inapplicableField.id)
  withoutDefinitions = removeCustomFieldDefinition(withoutDefinitions, unassignedField.id)
  const cleanedObject = withoutDefinitions.cluster.systems[0]?.objects[0]
  expect(cleanedObject?.playerFieldMasks).toEqual([nativePlayerFieldIds.atmosphere])
  expect(cleanedObject?.customFieldValues).toEqual({})
  expect(isLocalWorkspace(withoutDefinitions)).toBe(true)
})

test('v3 restore remaps reserved custom IDs without merging native values or colliding with existing IDs @pure', () => {
  const { legacyWorkspace } = legacyReservedFieldIdFixture()

  const restored = restoreLocalWorkspace(legacyWorkspace)

  expect(restored).not.toBeNull()
  if (!restored) throw new Error('Expected the valid v3 workspace to restore.')
  const fields = restored.objectFieldSettings.customFields
  const atmosphereAlias = fields.find(field => field.name === 'Atmosphere Alias')
  const portAlias = fields.find(field => field.name === 'Port Class Alias')
  const existingAlias = fields.find(field => field.name === 'Existing Legacy Alias')
  expect(atmosphereAlias?.id).not.toBe(nativePlayerFieldIds.atmosphere)
  expect(portAlias?.id).not.toBe(nativePlayerFieldIds.portClass)
  expect(existingAlias?.id).toBe('legacy-custom-field-1')
  expect(new Set(fields.map(field => field.id)).size).toBe(fields.length)
  expect([atmosphereAlias?.id, portAlias?.id]).not.toContain(existingAlias?.id)

  const objects = restored.cluster.systems[0]!.objects
  const planet = objects.find(object => object.subtype === 'planet')!
  const station = objects.find(object => object.subtype === 'station')!
  expect(planet.atmosphere).toBe('Vacuum')
  expect(station.portClass).toBe('Class II')
  expect(planet.customFieldValues?.[atmosphereAlias!.id]).toBe('CUSTOM ATMOSPHERE ALIAS VALUE')
  expect(planet.customFieldValues?.[portAlias!.id]).toBe('CUSTOM PORT ALIAS ON PLANET')
  expect(planet.customFieldValues?.[existingAlias!.id]).toBe('EXISTING ALIAS VALUE')
  expect(station.customFieldValues?.[atmosphereAlias!.id]).toBe('CUSTOM ATMOSPHERE ALIAS ON STATION')
  expect(station.customFieldValues?.[portAlias!.id]).toBe('CUSTOM PORT ALIAS VALUE')
  expect(restored.cluster.systems[0]?.objects.every(object =>
    object.playerText === '' && object.playerFieldMasks.length === 0,
  )).toBe(true)
})

test('v3 portable imports remap reserved custom IDs and preserve independent native fields @pure', () => {
  const { legacyExport } = legacyReservedFieldIdFixture()

  const prepared = prepareJsonImport(createLocalWorkspace('Destination Reach', 'Boreal'), legacyExport)

  const fields = prepared.workspace.objectFieldSettings.customFields
  const atmosphereAlias = fields.find(field => field.name === 'Atmosphere Alias')
  const portAlias = fields.find(field => field.name === 'Port Class Alias')
  const existingAlias = fields.find(field => field.name === 'Existing Legacy Alias')
  expect(atmosphereAlias?.id).not.toBe(nativePlayerFieldIds.atmosphere)
  expect(portAlias?.id).not.toBe(nativePlayerFieldIds.portClass)
  expect(existingAlias?.id).not.toBe('legacy-custom-field-1')
  expect(new Set(fields.map(field => field.id)).size).toBe(fields.length)

  const importedSystem = prepared.workspace.cluster.systems.find(system => system.name === 'Legacy System')
  const planet = importedSystem?.objects.find(object => object.subtype === 'planet')
  const station = importedSystem?.objects.find(object => object.subtype === 'station')
  expect(planet?.atmosphere).toBe('Vacuum')
  expect(station?.portClass).toBe('Class II')
  expect(planet?.customFieldValues?.[atmosphereAlias!.id]).toBe('CUSTOM ATMOSPHERE ALIAS VALUE')
  expect(planet?.customFieldValues?.[portAlias!.id]).toBe('CUSTOM PORT ALIAS ON PLANET')
  expect(planet?.customFieldValues?.[existingAlias!.id]).toBe('EXISTING ALIAS VALUE')
  expect(station?.customFieldValues?.[atmosphereAlias!.id]).toBe('CUSTOM ATMOSPHERE ALIAS ON STATION')
  expect(station?.customFieldValues?.[portAlias!.id]).toBe('CUSTOM PORT ALIAS VALUE')
})

test('legacy standalone system import preserves its separate entity ID namespace @pure', () => {
  const { legacyExport } = legacyReservedFieldIdFixture()
  const standalone = structuredClone(legacyExport)
  const cluster = standalone.cluster as {
    systems: Array<{
      objects: Array<{ subtype: string; id: string }>
      orbits: Array<{ id: string; order: number; hostId: null; center: { x: number; y: number } }>
    }>
  }
  standalone.type = 'system'
  standalone.system = cluster.systems[0]
  delete standalone.cluster
  const standaloneSystem = standalone.system as typeof cluster.systems[number]
  const planet = standaloneSystem.objects
    .find(object => object.subtype === 'planet')!
  planet.id = nativePlayerFieldIds.atmosphere
  standaloneSystem.orbits.push({
    id: nativePlayerFieldIds.portClass,
    order: 1,
    hostId: null,
    center: { x: 0.25, y: 0.25 },
  })

  const imported = prepareJsonImport(createLocalWorkspace('Separate Namespace Destination', 'Boreal'), standalone)

  const importedField = imported.workspace.objectFieldSettings.customFields
    .find(field => field.name === 'Atmosphere Alias')
  const importedPlanet = imported.workspace.cluster.systems
    .flatMap(system => system.objects)
    .find(object => object.subtype === 'planet')
  expect(importedField?.id).not.toBe(nativePlayerFieldIds.atmosphere)
  expect(importedPlanet?.customFieldValues?.[importedField!.id]).toBe('CUSTOM ATMOSPHERE ALIAS VALUE')
})

test('v4 portable import remains strict about reserved custom Field IDs @pure', () => {
  const { workspace } = legacyReservedFieldIdFixture()
  const currentExport = exportJumpCluster(workspace)
  const settings = currentExport.objectFieldSettings
  const atmosphereAlias = settings.customFields.find(field => field.name === 'Atmosphere Alias')!
  const previousId = atmosphereAlias.id
  atmosphereAlias.id = nativePlayerFieldIds.atmosphere
  for (const system of currentExport.cluster.systems) {
    for (const object of system.objects) {
      if (!object.customFieldValues || !(previousId in object.customFieldValues)) continue
      const values = { ...object.customFieldValues }
      values[nativePlayerFieldIds.atmosphere] = values[previousId]!
      delete values[previousId]
      object.customFieldValues = values
    }
  }

  expect(() => prepareJsonImport(
    createLocalWorkspace('Reserved V4 Destination', 'Boreal'),
    currentExport,
  )).toThrow(/valid version 1, version 2, version 3, or version 4/)
})

test('legacy migration rejects a reserved custom ID that originally collides with an object ID @pure', () => {
  const { legacyWorkspace, legacyExport } = legacyReservedFieldIdFixture()

  function collideAtmosphereDefinitionWithObject(value: Record<string, unknown>): Record<string, unknown> {
    const malformed = structuredClone(value)
    const cluster = malformed.cluster as {
      systems: Array<{ objects: Array<{ subtype: string; id: string }> }>
    }
    const planet = cluster.systems[0]!.objects.find(object => object.subtype === 'planet')!
    planet.id = nativePlayerFieldIds.atmosphere
    return malformed
  }

  expect(restoreLocalWorkspace(collideAtmosphereDefinitionWithObject(legacyWorkspace))).toBeNull()
  expect(() => prepareJsonImport(
    createLocalWorkspace('Entity Collision Destination', 'Boreal'),
    collideAtmosphereDefinitionWithObject(legacyExport),
  )).toThrow(/valid version 1, version 2, version 3, or version 4/)
})

test('legacy migration keeps previously valid workspace and cluster ID overlap @pure', () => {
  const { legacyWorkspace } = legacyReservedFieldIdFixture()
  const overlappingIds = structuredClone(legacyWorkspace)
  const cluster = overlappingIds.cluster as { id: string }
  overlappingIds.id = cluster.id
  overlappingIds.system = { id: nativePlayerFieldIds.atmosphere }

  const restored = restoreLocalWorkspace(overlappingIds)

  expect(restored).not.toBeNull()
  expect(restored?.id).toBe(restored?.cluster.id)
})

test('legacy migration rejects duplicate original custom field IDs @pure', () => {
  const { legacyWorkspace, legacyExport } = legacyReservedFieldIdFixture()

  function duplicateFirstTwoFieldIds(value: Record<string, unknown>): Record<string, unknown> {
    const malformed = structuredClone(value)
    const settings = malformed.objectFieldSettings as {
      customFields: Array<{ id: string }>
    }
    settings.customFields[1]!.id = settings.customFields[0]!.id
    return malformed
  }

  expect(restoreLocalWorkspace(duplicateFirstTwoFieldIds(legacyWorkspace))).toBeNull()
  expect(() => prepareJsonImport(
    createLocalWorkspace('Duplicate Alias Destination', 'Boreal'),
    duplicateFirstTwoFieldIds(legacyExport),
  )).toThrow(/valid version 1, version 2, version 3, or version 4/)
})
