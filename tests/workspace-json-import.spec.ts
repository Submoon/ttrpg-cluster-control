import { expect, test } from './fixtures'
import {
  createLocalWorkspace,
  defaultObjectFieldSettings,
  prepareJsonImport,
  type CustomFieldDefinition,
  type JumpClusterExport,
  type LocalWorkspace,
  type StarSystem,
} from '../domain/workspace'

function sourceFieldValue(field: CustomFieldDefinition): string | number | boolean {
  switch (field.type) {
    case 'text': return 'Imported survey record.'
    case 'number': return 14
    case 'boolean': return true
    case 'single-select': return field.options[0] ?? ''
  }
}

function sourceClusterExport(options: {
  primaryStarId?: string
  field?: CustomFieldDefinition
} = {}): JumpClusterExport {
  const field = options.field ?? { id: 'source-survey-field', name: 'Survey notes', type: 'text', playerShared: false }
  const primaryStarId = options.primaryStarId ?? 'source-primary-star'
  const fieldValue = sourceFieldValue(field)
  const alpha: StarSystem = {
    id: 'source-alpha',
    name: 'Imported Alpha',
    publication: 'known-type',
    objects: [
      {
        id: primaryStarId,
        family: 'CelestialBody',
        subtype: 'star',
        locationKey: 'A',
        name: 'Primary Star',
        description: '',
        publication: 'known-type',
        playerText: '',
        playerFieldMasks: [] as string[],
        placement: { kind: 'system', x: 0.5, y: 0.5 },
      },
      {
        id: 'source-station',
        family: 'Installation',
        subtype: 'station',
        locationKey: 'ST-01',
        name: 'Relay Station',
        description: '',
        publication: 'known-type',
        playerText: '',
        playerFieldMasks: [] as string[],
        placement: { kind: 'system', x: 0.7, y: 0.35 },
      },
      {
        id: 'source-origin-point',
        family: 'JumpPoint',
        subtype: 'jump-point',
        locationKey: 'JP-01',
        name: 'Alpha Gate',
        description: '',
        publication: 'known-type',
        playerText: '',
        playerFieldMasks: [] as string[],
        placement: { kind: 'system', x: 0.75, y: 0.45 },
        jumpStationId: 'source-station',
      },
      {
        id: 'source-planet',
        family: 'CelestialBody',
        subtype: 'planet',
        locationKey: 'PL-01',
        name: 'Iria',
        description: '',
        publication: 'known-type',
        playerText: '',
        playerFieldMasks: [] as string[],
        placement: { kind: 'orbit', orbitId: 'source-primary-orbit' },
        customFieldValues: { [field.id]: fieldValue },
      },
      {
        id: 'source-moon',
        family: 'CelestialBody',
        subtype: 'moon',
        locationKey: 'MO-01',
        name: 'Nix',
        description: '',
        publication: 'known-type',
        playerText: '',
        playerFieldMasks: [] as string[],
        placement: { kind: 'orbit', orbitId: 'source-free-orbit' },
      },
    ],
    orbits: [
      { id: 'source-primary-orbit', hostId: primaryStarId, order: 1 },
      { id: 'source-free-orbit', hostId: null, center: { x: 0.2, y: 0.8 }, order: 1 },
    ],
  }
  const beta: StarSystem = {
    id: 'source-beta',
    name: 'Imported Beta',
    publication: 'known-type',
    objects: [{
      id: 'source-destination-point',
      family: 'JumpPoint',
      subtype: 'jump-point',
      locationKey: 'JP-02',
      name: 'Beta Gate',
      description: '',
      publication: 'known-type',
      playerText: '',
      playerFieldMasks: [] as string[],
      placement: { kind: 'system', x: 0.5, y: 0.5 },
    }],
    orbits: [],
  }

  return {
    format: 'ttrpg-cluster-control-map',
    version: 4,
    type: 'cluster',
    cluster: {
      id: 'source-cluster',
      name: 'Imported Reach',
      playerTitle: 'Public Reach',
      systems: [alpha, beta],
      routes: [
        {
          id: 'source-known-route',
          name: 'Known corridor',
          playerShared: false,
          jumpLevel: 7,
          fromPointId: 'source-origin-point',
          toPointId: 'source-destination-point',
        },
        {
          id: 'source-unresolved-route',
          name: 'Rimward corridor',
          playerShared: false,
          jumpLevel: 12,
          fromPointId: 'source-destination-point',
          toPointId: null,
          unresolvedExit: 'The Quiet Expanse',
        },
      ],
    },
    objectFieldSettings: {
      ...defaultObjectFieldSettings(),
      customFields: [field],
    },
    layout: {
      version: 1,
      systemPositions: {
        'source-alpha': { x: 0.24, y: 0.71 },
        'source-beta': { x: 0.82, y: 0.28 },
      },
      unresolvedExitPositions: { 'source-unresolved-route': { x: 1250, y: -340 } },
      orbitRadii: {
        'source-primary-orbit': { horizontal: 140, vertical: 90 },
        'source-free-orbit': { horizontal: 67, vertical: 54 },
      },
      orbitRotations: {
        'source-primary-orbit': 36,
        'source-free-orbit': 212,
      },
      objectAngles: {
        'source-planet': 2.23,
        'source-moon': 5.18,
      },
    },
  }
}

function importedCopyEntityIds(prepared: ReturnType<typeof prepareJsonImport>): string[] {
  const systems = prepared.addedSystemIds.map(id => {
    const system = prepared.workspace.cluster.systems.find(candidate => candidate.id === id)
    if (!system) throw new Error(`Imported system ${id} is missing from the prepared workspace.`)
    return system
  })
  const pointIds = new Set(systems.flatMap(system => system.objects
    .filter(object => object.family === 'JumpPoint')
    .map(object => object.id)))
  const routes = prepared.workspace.cluster.routes.filter(route =>
    pointIds.has(route.fromPointId)
    || (route.toPointId !== null && pointIds.has(route.toPointId)),
  )
  return [
    ...systems.flatMap(system => [
      system.id,
      ...system.objects.map(object => object.id),
      ...system.orbits.map(orbit => orbit.id),
    ]),
    ...routes.map(route => route.id),
  ]
}

function workspaceWithOriginalRecords(): LocalWorkspace {
  const workspace = createLocalWorkspace('Local Reach', 'Home System')
  const home = workspace.cluster.systems[0]
  if (!home) throw new Error('The local workspace is missing its initial system.')
  const primaryStar = home.objects.find(object => object.subtype === 'star')
  if (!primaryStar) throw new Error('The local workspace is missing its Primary Star.')
  const field: CustomFieldDefinition = { id: 'local-warden-notes', name: 'Warden notes', type: 'text', playerShared: false }
  const existingOrbit = { id: 'local-primary-orbit', hostId: primaryStar.id, order: 1 } as const
  const existingPlanet = {
    id: 'local-existing-planet',
    family: 'CelestialBody',
    subtype: 'planet',
    locationKey: 'PL-01',
    name: 'Local World',
    description: '',
    publication: 'known-type',
    playerText: '',
    playerFieldMasks: [] as string[],
    placement: { kind: 'orbit', orbitId: existingOrbit.id },
    customFieldValues: { [field.id]: 'Keep this world note.' },
  } as const
  const origin = {
    id: 'local-origin-point',
    family: 'JumpPoint',
    subtype: 'jump-point',
    locationKey: 'JP-01',
    name: 'Local Gate',
    description: '',
    publication: 'known-type',
    playerText: '',
    playerFieldMasks: [] as string[],
    placement: { kind: 'system', x: 0.72, y: 0.4 },
  } as const
  const destination = { ...origin, id: 'local-destination-point', locationKey: 'JP-02', name: 'Other Gate' }
  const originalSystem = {
    ...home,
    objects: [
      ...home.objects.map(object => object.id === primaryStar.id
        ? { ...object, customFieldValues: { [field.id]: 'Keep this note.' } }
        : object),
      origin,
      destination,
      existingPlanet,
    ],
    orbits: [existingOrbit],
  }
  return {
    ...workspace,
    cluster: {
      ...workspace.cluster,
      systems: [originalSystem],
      routes: [{
        id: 'local-route',
        name: 'Original lane',
        playerShared: false,
        jumpLevel: 4,
        fromPointId: origin.id,
        toPointId: destination.id,
      }],
    },
    layout: {
      ...workspace.layout,
      systemPositions: { [home.id]: { x: 0.31, y: 0.64 } },
      orbitRadii: { [existingOrbit.id]: { horizontal: 143, vertical: 87 } },
      orbitRotations: { [existingOrbit.id]: 27 },
      objectAngles: { [existingPlanet.id]: 1.25 },
    },
    objectFieldSettings: {
      ...workspace.objectFieldSettings,
      customFields: [field],
    },
  }
}

test('cluster import remaps identities and preserves exact relationships and geometry @pure', () => {
  const current = createLocalWorkspace('Local Reach', 'Home System')
  const source = sourceClusterExport()

  const prepared = prepareJsonImport(current, source)
  const [alphaId, betaId] = prepared.addedSystemIds
  const alpha = prepared.workspace.cluster.systems.find(system => system.id === alphaId)
  const beta = prepared.workspace.cluster.systems.find(system => system.id === betaId)
  if (!alpha || !beta) throw new Error('The prepared Cluster is missing an imported system.')
  const importedStar = alpha.objects.find(object => object.name === 'Primary Star')
  const importedStation = alpha.objects.find(object => object.name === 'Relay Station')
  const importedOrigin = alpha.objects.find(object => object.name === 'Alpha Gate')
  const importedPlanet = alpha.objects.find(object => object.name === 'Iria')
  const importedMoon = alpha.objects.find(object => object.name === 'Nix')
  const importedDestination = beta.objects.find(object => object.name === 'Beta Gate')
  const hostedOrbit = alpha.orbits.find(orbit => orbit.hostId === importedStar?.id)
  const freeOrbit = alpha.orbits.find(orbit => orbit.hostId === null)
  const knownRoute = prepared.workspace.cluster.routes.find(route => route.name === 'Known corridor')
  const unresolvedRoute = prepared.workspace.cluster.routes.find(route => route.name === 'Rimward corridor')
  const importedField = prepared.workspace.objectFieldSettings.customFields.find(field => field.name === 'Survey notes')
  if (
    !importedStar || !importedStation || !importedOrigin || !importedPlanet || !importedMoon
    || !importedDestination || !hostedOrbit || !freeOrbit || !knownRoute || !unresolvedRoute || !importedField
  ) {
    throw new Error('The imported Cluster is missing one of its linked records.')
  }

  expect(prepared.summary).toMatchObject({
    type: 'cluster',
    systems: 2,
    objects: 6,
    orbits: 2,
    routes: 2,
    customFields: 1,
    idCollisions: [],
    possibleMatches: [],
  })
  expect(prepared.addedSystemIds.map(id => prepared.workspace.cluster.systems
    .find(system => system.id === id)?.name)).toEqual(['Imported Alpha', 'Imported Beta'])
  expect(prepared.workspace.cluster.id).toBe(current.cluster.id)
  expect(prepared.workspace.cluster.name).toBe('Local Reach')
  expect([alpha.id, beta.id]).not.toContain('source-alpha')
  expect([alpha.id, beta.id]).not.toContain('source-beta')
  expect([alpha.id, beta.id]).not.toContain(current.cluster.systems[0]?.id)

  expect(importedStar.id).not.toBe('source-primary-star')
  expect(importedStation.id).not.toBe('source-station')
  expect(importedOrigin.id).not.toBe('source-origin-point')
  expect(importedOrigin.jumpStationId).toBe(importedStation.id)
  expect(importedPlanet.placement).toEqual({ kind: 'orbit', orbitId: hostedOrbit.id })
  expect(importedMoon.placement).toEqual({ kind: 'orbit', orbitId: freeOrbit.id })
  expect(hostedOrbit.hostId).toBe(importedStar.id)
  expect(freeOrbit).toMatchObject({ hostId: null, center: { x: 0.2, y: 0.8 } })
  expect(importedPlanet.customFieldValues).toEqual({ [importedField.id]: 'Imported survey record.' })
  expect(importedField.id).not.toBe('source-survey-field')
  expect(knownRoute).toMatchObject({
    playerShared: false,
    jumpLevel: 7,
    fromPointId: importedOrigin.id,
    toPointId: importedDestination.id,
  })
  expect(unresolvedRoute).toMatchObject({
    playerShared: false,
    jumpLevel: 12,
    fromPointId: importedDestination.id,
    toPointId: null,
    unresolvedExit: 'The Quiet Expanse',
  })
  expect(prepared.workspace.layout.systemPositions).toEqual({
    [current.cluster.systems[0]!.id]: { x: 0.18, y: 0.35 },
    [alpha.id]: { x: 0.24, y: 0.71 },
    [beta.id]: { x: 0.82, y: 0.28 },
  })
  expect(prepared.workspace.layout.unresolvedExitPositions).toEqual({
    [unresolvedRoute.id]: { x: 1250, y: -340 },
  })
  expect(prepared.workspace.layout.orbitRadii).toEqual({
    [hostedOrbit.id]: { horizontal: 140, vertical: 90 },
    [freeOrbit.id]: { horizontal: 67, vertical: 54 },
  })
  expect(prepared.workspace.layout.orbitRotations).toEqual({
    [hostedOrbit.id]: 36,
    [freeOrbit.id]: 212,
  })
  expect(prepared.workspace.layout.objectAngles).toEqual({
    [importedPlanet.id]: 2.23,
    [importedMoon.id]: 5.18,
  })
})

test('second import creates a disjoint entity copy while reusing a compatible field @pure', () => {
  const current = createLocalWorkspace('Local Reach', 'Home System')
  const source = sourceClusterExport()

  const first = prepareJsonImport(current, source)
  const second = prepareJsonImport(first.workspace, source)
  const firstIds = importedCopyEntityIds(first)
  const secondIds = importedCopyEntityIds(second)

  expect(new Set([...firstIds, ...secondIds]).size).toBe(firstIds.length + secondIds.length)
  expect(second.summary.possibleMatches).toContainEqual(expect.objectContaining({
    entity: 'Star system',
    name: 'Imported Alpha',
    existingSystem: 'Imported Alpha',
    reason: 'same name',
  }))
  expect(first.workspace.objectFieldSettings.customFields).toHaveLength(1)
  expect(second.workspace.objectFieldSettings.customFields).toEqual(first.workspace.objectFieldSettings.customFields)
  for (const sourceId of [
    'source-alpha', 'source-beta', 'source-primary-star', 'source-station', 'source-origin-point',
    'source-planet', 'source-moon', 'source-primary-orbit', 'source-free-orbit',
    'source-destination-point', 'source-known-route', 'source-unresolved-route',
  ]) {
    expect([...firstIds, ...secondIds]).not.toContain(sourceId)
  }
})

test('compatible imported scopes union in order and ignore legacy object targets @pure', () => {
  const current = createLocalWorkspace('Local Reach', 'Home System')
  const existingField: CustomFieldDefinition = {
    id: 'existing-survey-field',
    name: 'Survey notes',
    type: 'text',
    playerShared: false,
    applicability: [{ kind: 'category', family: 'CelestialBody' }],
  }
  const destination: LocalWorkspace = {
    ...current,
    objectFieldSettings: { ...current.objectFieldSettings, customFields: [existingField] },
  }
  const sourceField: CustomFieldDefinition = {
    id: 'source-survey-field',
    name: 'Survey notes',
    type: 'text',
    playerShared: false,
    applicability: [{ kind: 'subtype', family: 'CelestialBody', subtype: 'planet' }],
  }
  const validExport = sourceClusterExport({ field: sourceField })
  const legacyExport: unknown = {
    ...validExport,
    version: 1,
    objectFieldSettings: {
      ...validExport.objectFieldSettings,
      customFields: validExport.objectFieldSettings.customFields.map(field => field.id === sourceField.id
        ? {
            ...field,
            applicability: [
              ...(field.applicability ?? []),
              { kind: 'object', objectId: 'source-planet' },
            ],
          }
        : field),
    },
  }

  const prepared = prepareJsonImport(destination, legacyExport)
  const importedAlpha = prepared.workspace.cluster.systems.find(system => system.name === 'Imported Alpha')
  const importedPlanet = importedAlpha?.objects.find(object => object.name === 'Iria')
  const reusedField = prepared.workspace.objectFieldSettings.customFields.find(field => field.name === 'Survey notes')

  expect(prepared.workspace.objectFieldSettings.customFields).toHaveLength(1)
  expect(reusedField?.id).toBe(existingField.id)
  expect(reusedField?.applicability).toEqual([
    { kind: 'category', family: 'CelestialBody' },
    { kind: 'subtype', family: 'CelestialBody', subtype: 'planet' },
  ])
  expect(importedPlanet?.id).not.toBe('source-planet')
  expect(importedPlanet?.customFieldValues).toEqual({ [existingField.id]: 'Imported survey record.' })
})

test('invalid version and foreign layout reject without changing the destination @pure', () => {
  const destination = createLocalWorkspace('Local Reach', 'Home System')
  const before = structuredClone(destination)
  const validExport = sourceClusterExport()
  const invalidVersion: unknown = { ...validExport, version: 999 }
  const foreignSystemLayout: unknown = {
    ...validExport,
    layout: {
      ...validExport.layout,
      systemPositions: {
        ...validExport.layout.systemPositions,
        'not-in-this-cluster': { x: 0.5, y: 0.5 },
      },
    },
  }

  expect(() => prepareJsonImport(destination, invalidVersion))
    .toThrow('Choose a valid version 1, version 2, version 3, or version 4 Jump Cluster or star system JSON export.')
  expect(destination).toEqual(before)
  expect(() => prepareJsonImport(destination, foreignSystemLayout))
    .toThrow('Choose a valid version 1, version 2, version 3, or version 4 Jump Cluster or star system JSON export.')
  expect(destination).toEqual(before)
})

test('original data survives an ID collision and a separate conflicting field rejection @pure', () => {
  const destination = workspaceWithOriginalRecords()
  const originalSnapshot = structuredClone(destination)
  const originalSystem = destination.cluster.systems[0]
  const existingStar = destination.cluster.systems[0]?.objects.find(object => object.subtype === 'star')
  const existingOrbit = originalSystem?.orbits[0]
  const existingPlanet = originalSystem?.objects.find(object => object.name === 'Local World')
  if (!originalSystem || !existingStar || !existingOrbit || !existingPlanet) {
    throw new Error('The existing campaign fixture is missing its Primary Star, Orbit, or planet.')
  }
  expect(originalSnapshot.layout.orbitRadii).toEqual({
    [existingOrbit.id]: { horizontal: 143, vertical: 87 },
  })
  expect(originalSnapshot.layout.orbitRotations).toEqual({ [existingOrbit.id]: 27 })
  expect(originalSnapshot.layout.objectAngles).toEqual({ [existingPlanet.id]: 1.25 })

  const collided = prepareJsonImport(destination, sourceClusterExport({ primaryStarId: existingStar.id }))
  const importedStar = collided.workspace.cluster.systems
    .find(system => system.name === 'Imported Alpha')?.objects.find(object => object.name === 'Primary Star')
  expect(collided.summary.idCollisions).toEqual([expect.objectContaining({ id: existingStar.id, entity: 'star' })])
  expect(importedStar?.id).not.toBe(existingStar.id)
  expect(collided.workspace.cluster.systems[0]).toEqual(originalSystem)
  expect(collided.workspace.cluster.routes.find(route => route.id === originalSnapshot.cluster.routes[0]?.id))
    .toEqual(originalSnapshot.cluster.routes[0])
  expect(collided.workspace.layout.systemPositions[originalSystem.id])
    .toEqual(originalSnapshot.layout.systemPositions[originalSystem.id])
  expect(collided.workspace.layout.orbitRadii[existingOrbit.id])
    .toEqual(originalSnapshot.layout.orbitRadii[existingOrbit.id])
  expect(collided.workspace.layout.orbitRotations[existingOrbit.id])
    .toBe(originalSnapshot.layout.orbitRotations[existingOrbit.id])
  expect(collided.workspace.layout.objectAngles[existingPlanet.id])
    .toBe(originalSnapshot.layout.objectAngles[existingPlanet.id])
  expect(collided.workspace.objectFieldSettings.customFields).toContainEqual(
    originalSnapshot.objectFieldSettings.customFields[0],
  )

  const conflictingField: CustomFieldDefinition = {
    id: 'source-survey-field',
    name: 'Warden notes',
    type: 'single-select',
    playerShared: false,
    options: ['Reviewed', 'Pending'],
  }
  const beforeConflict = structuredClone(destination)
  expect(() => prepareJsonImport(destination, sourceClusterExport({ field: conflictingField })))
    .toThrow('Custom field "Warden notes" conflicts with an existing field definition.')
  expect(destination).toEqual(beforeConflict)
  expect(destination).toEqual(originalSnapshot)
})
