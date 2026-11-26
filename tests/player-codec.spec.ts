import { expect, test } from './fixtures'
import {
  createLocalWorkspace,
  PlayerDocumentError,
  parsePlayerJson,
  projectPlayerCluster,
  restorePlayerDocument,
  serializePlayerJson,
  updateChartDetails,
} from '../domain/workspace'
import type {
  PlayerClusterDocument,
  PlayerFieldValue,
  PlayerObjectMarker,
  PlayerOrbit,
} from '../domain/workspace'
import { MAX_PLAYER_JSON_BYTES } from '../domain/player-codec'

function validPlayerDocument(): PlayerClusterDocument {
  const fields: PlayerFieldValue[] = [
    { name: 'Narrative', type: 'text', value: 'A shared description.' },
    { name: 'Count', type: 'number', value: 0 },
    { name: 'Available', type: 'boolean', value: false },
    { name: 'Faction', type: 'single-select', value: 'Merchants' },
  ]
  const objects: PlayerObjectMarker[] = [
    {
      id: 'object-1',
      position: { x: 120, y: 100 },
      placement: { kind: 'system' },
      disclosure: 'unknown',
      label: 'Unknown presence',
    },
    {
      id: 'object-2',
      position: { x: 240, y: 180 },
      placement: { kind: 'orbit', orbitId: 'orbit-1', angle: 1.25 },
      disclosure: 'known-type',
      family: 'Other',
      subtype: '  Ancient megastructure  ',
      label: 'Ancient megastructure',
    },
    {
      id: 'object-3',
      position: { x: 360, y: 260 },
      placement: { kind: 'orbit', orbitId: 'orbit-2', angle: 2.5 },
      disclosure: 'revealed',
      family: 'JumpPoint',
      subtype: 'jump-point',
      label: 'Open Route Point',
      playerText: 'The route is safe for travelers.',
      fields,
      stationId: 'object-4',
    },
    {
      id: 'object-4',
      position: { x: 420, y: 300 },
      placement: { kind: 'orbit', orbitId: 'orbit-3', angle: 3.75 },
      disclosure: 'revealed',
      family: 'Installation',
      subtype: 'station',
      label: 'Public Station',
      playerText: '',
      fields: [],
    },
    {
      id: 'object-5',
      position: { x: 470, y: 340 },
      placement: { kind: 'orbit', orbitId: 'orbit-4', angle: 4.5 },
      disclosure: 'revealed',
      family: 'CelestialBody',
      subtype: 'moon',
      label: 'Outer Moon',
      playerText: '',
      fields: [],
    },
    {
      id: 'object-6',
      position: { x: 520, y: 390 },
      placement: { kind: 'orbit', orbitId: 'orbit-5', angle: 5.25 },
      disclosure: 'unknown',
      label: 'Unknown presence',
    },
  ]
  const orbit = (id: string, hostId: string | null, offset: number): PlayerOrbit => ({
    id,
    hostId,
    center: { x: 300 + offset, y: 250 + offset },
    radii: { horizontal: 60 + offset, vertical: 40 + offset },
    rotation: offset,
  })

  return {
    format: 'ttrpg-cluster-control-player',
    version: 2,
    title: 'Pilgrim Reach',
    systems: [
      { id: 'system-1', position: { x: 120, y: 100 }, disclosure: 'unknown', label: 'Unknown presence' },
      {
        id: 'system-2',
        position: { x: 240, y: 180 },
        disclosure: 'known-type',
        type: 'star-system',
        label: 'Zone',
      },
      {
        id: 'system-3',
        position: { x: 360, y: 260 },
        disclosure: 'revealed',
        type: 'star-system',
        label: 'Revealed Haven',
        map: {
          objects,
          orbits: [
            orbit('orbit-1', 'object-1', 1),
            orbit('orbit-2', 'object-2', 2),
            orbit('orbit-3', 'object-3', 3),
            orbit('orbit-4', 'object-4', 4),
            orbit('orbit-5', null, 5),
          ],
        },
      },
      {
        id: 'system-4',
        position: { x: 480, y: 340 },
        disclosure: 'revealed',
        type: 'star-system',
        label: 'Empty Haven',
        map: { objects: [], orbits: [] },
      },
    ],
    routes: [
      {
        id: 'route-1',
        jumpLevel: 3,
        fromSystemId: 'system-3',
        destination: { kind: 'system', systemId: 'system-2' },
      },
      {
        id: 'route-2',
        jumpLevel: 4,
        fromSystemId: 'system-3',
        destination: {
          kind: 'unknown',
          position: { x: 9_876, y: -456 },
          label: 'Unknown destination',
        },
      },
    ],
  }
}

function expectPlayerDocumentError(
  action: () => unknown,
  code: string,
  privateMarker?: string,
): void {
  let caught: unknown
  try {
    action()
  } catch (error) {
    caught = error
  }
  expect(caught).toBeInstanceOf(PlayerDocumentError)
  if (!(caught instanceof PlayerDocumentError)) throw new Error('Expected a player document error.')
  expect(caught.code).toBe(code)
  if (privateMarker) expect(caught.message).not.toContain(privateMarker)
}

test('player JSON codec round-trips public documents and drops unknown extensions @pure', () => {
  const workspace = createLocalWorkspace('PRIVATE cluster name', 'Pilgrim System')
  const sourceSystem = workspace.cluster.systems[0]!
  const published = updateChartDetails(workspace, sourceSystem.id, {
    clusterName: workspace.cluster.name,
    systemName: sourceSystem.name,
    playerTitle: 'Pilgrim Reach',
    publication: 'revealed',
  })
  const document = projectPlayerCluster(published)
  const extendedDocument = {
    ...document,
    privateExtension: 'PRIVATE extension payload',
    systems: document.systems.map(system => system.disclosure === 'revealed'
      ? {
          ...system,
          privateExtension: 'PRIVATE system extension',
          map: {
            ...system.map,
            privateExtension: 'PRIVATE map extension',
            objects: system.map.objects.map(object => ({
              ...object,
              privateExtension: 'PRIVATE object extension',
            })),
          },
        }
      : { ...system, privateExtension: 'PRIVATE system extension' }),
  }

  const serialized = serializePlayerJson(extendedDocument)

  expect(serialized).not.toContain('PRIVATE')
  expect(parsePlayerJson(serialized)).toEqual(document)
  expect(restorePlayerDocument(extendedDocument)).toEqual(document)
})

test('player file admission removes resolved same-system loops after validating the complete document @pure', () => {
  const document = validPlayerDocument()
  const loop = {
    id: 'route-3',
    jumpLevel: 5,
    fromSystemId: 'system-3',
    destination: { kind: 'system' as const, systemId: 'system-3' },
  }
  const legacyDocument = {
    ...document,
    version: 1 as const,
    routes: [
      { ...document.routes[0]!, fromPointId: 'ignored-former-extension', destination: { ...document.routes[0]!.destination, pointId: 'ignored-former-extension' } },
      { ...loop, fromPointId: { malformed: true }, destination: { ...loop.destination, pointId: 'ignored-former-extension' } },
      document.routes[1]!,
    ],
  }

  const parsedLegacy = parsePlayerJson(JSON.stringify(legacyDocument))
  expect(parsedLegacy.version).toBe(2)
  expect(parsedLegacy.routes).toEqual(document.routes)
  expectPlayerDocumentError(
    () => parsePlayerJson(JSON.stringify({ ...legacyDocument, routes: [...legacyDocument.routes, { ...loop, jumpLevel: 0 }] })),
    'invalid-document',
  )
  expectPlayerDocumentError(() => parsePlayerJson(JSON.stringify({ ...document, routes: [...document.routes, loop] })), 'invalid-document')
  expectPlayerDocumentError(() => serializePlayerJson({ ...document, routes: [...document.routes, loop] }), 'invalid-document')
})

function playerDocumentWithPublishedRouteAttachments(): PlayerClusterDocument {
  const document = validPlayerDocument()
  const systems = document.systems.map(system => system.id === 'system-2'
    ? {
        id: system.id,
        position: system.position,
        disclosure: 'revealed' as const,
        type: 'star-system' as const,
        label: 'Distant Haven',
        map: {
          objects: [
            {
              id: 'object-1',
              position: { x: 240, y: 180 },
              placement: { kind: 'system' as const },
              disclosure: 'revealed' as const,
              family: 'JumpPoint' as const,
              subtype: 'jump-point',
              label: 'North Gate',
              playerText: '',
              fields: [],
            },
          ],
          orbits: [],
        },
      }
    : system)
  const routes = document.routes.map(route => route.id === 'route-1'
    ? {
        ...route,
        fromPointId: 'object-3',
        destination: { kind: 'system' as const, systemId: 'system-2', pointId: 'object-1' },
      }
    : route)
  return { ...document, systems, routes }
}

test('player JSON v2 round-trips only attached Revealed Jump Points @pure', () => {
  const document = playerDocumentWithPublishedRouteAttachments()
  const serialized = serializePlayerJson(document)

  expect(JSON.parse(serialized)).toMatchObject({
    version: 2,
    routes: [
      { fromPointId: 'object-3', destination: { pointId: 'object-1' } },
      { destination: { kind: 'unknown' } },
    ],
  })
  expect(parsePlayerJson(serialized)).toEqual(document)
  expect(restorePlayerDocument(document)).toEqual(document)
})

test('player JSON v2 rejects route attachments outside their own Revealed Jump Point maps @pure', () => {
  const document = playerDocumentWithPublishedRouteAttachments()
  const invalidOriginOwner = {
    ...document,
    routes: document.routes.map(route => route.id === 'route-1' ? { ...route, fromPointId: 'object-1' } : route),
  }
  const invalidOriginDisclosure = {
    ...document,
    routes: document.routes.map(route => route.id === 'route-1' ? { ...route, fromPointId: 'object-6' } : route),
  }
  const invalidOriginType = {
    ...document,
    routes: document.routes.map(route => route.id === 'route-1' ? { ...route, fromPointId: 'object-4' } : route),
  }
  const invalidDestinationOwner = {
    ...document,
    routes: document.routes.map(route => route.id === 'route-1'
      ? { ...route, destination: { kind: 'system' as const, systemId: 'system-2', pointId: 'object-3' } }
      : route),
  }
  const invalidDestinationDisclosure = {
    ...document,
    systems: document.systems.map(system => system.id === 'system-2' && system.disclosure === 'revealed'
      ? { ...system, map: { ...system.map, objects: [{ ...system.map.objects[0]!, disclosure: 'known-type' as const, family: 'JumpPoint' as const, subtype: 'jump-point', label: 'Jump Point' }] } }
      : system),
  }
  const invalidUnknownAttachment = {
    ...document,
    routes: document.routes.map(route => route.id === 'route-2'
      ? { ...route, destination: { ...route.destination, pointId: 'object-1' } }
      : route),
  }

  for (const invalid of [
    invalidOriginOwner,
    invalidOriginDisclosure,
    invalidOriginType,
    invalidDestinationOwner,
    invalidDestinationDisclosure,
    invalidUnknownAttachment,
  ]) {
    expectPlayerDocumentError(() => restorePlayerDocument(invalid), 'invalid-document')
  }
})

test('player JSON displays a generic Zone while admitting the legacy Known type label @pure', () => {
  const document = validPlayerDocument()
  const legacy = {
    ...document,
    systems: document.systems.map(system => system.disclosure === 'known-type'
      ? { ...system, label: 'Star system' }
      : system),
  }

  const restored = parsePlayerJson(JSON.stringify(legacy))
  expect(restored.systems[1]).toMatchObject({ disclosure: 'known-type', label: 'Zone' })
  expect(restored.systems[2]).toEqual(document.systems[2])
  expect(parsePlayerJson(serializePlayerJson(restored))).toEqual(restored)
})

test('player JSON admits all disclosure modes, permitted values, and public relationship graphs @pure', () => {
  const document = validPlayerDocument()
  const serialized = serializePlayerJson(document)
  const parsed = parsePlayerJson(serialized)
  const restored = restorePlayerDocument(document)

  expect(parsed).toEqual(document)
  expect(restored).toEqual(document)
  expect(restored).not.toBe(document)
  expect(restored.systems[0]).toMatchObject({ disclosure: 'unknown', label: 'Unknown presence' })
  expect(restored.systems[0]).not.toHaveProperty('map')
  expect(restored.systems[1]).toMatchObject({ disclosure: 'known-type', label: 'Zone' })
  expect(restored.systems[1]).not.toHaveProperty('map')

  const revealed = restored.systems[2]
  if (!revealed || revealed.disclosure !== 'revealed') throw new Error('Expected a Revealed system.')
  expect(revealed.map.objects[1]).toMatchObject({
    disclosure: 'known-type',
    family: 'Other',
    subtype: '  Ancient megastructure  ',
    label: 'Ancient megastructure',
  })
  expect(revealed.map.objects[2]).toMatchObject({
    disclosure: 'revealed',
    family: 'JumpPoint',
    stationId: 'object-4',
    fields: [
      { name: 'Narrative', type: 'text', value: 'A shared description.' },
      { name: 'Count', type: 'number', value: 0 },
      { name: 'Available', type: 'boolean', value: false },
      { name: 'Faction', type: 'single-select', value: 'Merchants' },
    ],
  })
  expect(revealed.map.orbits.map(orbit => orbit.hostId)).toEqual([
    'object-1', 'object-2', 'object-3', 'object-4', null,
  ])
  expect(restored.systems[3]).toMatchObject({
    disclosure: 'revealed',
    map: { objects: [], orbits: [] },
  })
  expect(restored.routes).toMatchObject([
    { fromSystemId: 'system-3', destination: { kind: 'system', systemId: 'system-2' } },
    {
      fromSystemId: 'system-3',
      destination: { kind: 'unknown', position: { x: 9_876, y: -456 }, label: 'Unknown destination' },
    },
  ])
})

test('player JSON preserves strict per-object marker colors and drops them from Unknown objects @pure', () => {
  const document = validPlayerDocument()
  const revealed = document.systems[2]
  if (!revealed || revealed.disclosure !== 'revealed') throw new Error('Expected a Revealed system.')
  const unknownObject = revealed.map.objects[0]!
  const knownObject = revealed.map.objects[1]!
  const revealedObject = revealed.map.objects[2]!
  Object.assign(unknownObject, { markerColor: '#FFFFFF' })
  Object.assign(knownObject, { markerColor: '#a1B2c3' })
  Object.assign(revealedObject, { markerColor: '#Ff00aA' })

  const serialized = serializePlayerJson(document)
  const parsed = parsePlayerJson(serialized)
  const restoredSystem = parsed.systems[2]
  if (!restoredSystem || restoredSystem.disclosure !== 'revealed') {
    throw new Error('Expected a Revealed system after JSON restoration.')
  }

  expect(restoredSystem.map.objects[0]).not.toHaveProperty('markerColor')
  expect(restoredSystem.map.objects[1]).toMatchObject({ markerColor: '#a1B2c3' })
  expect(restoredSystem.map.objects[2]).toMatchObject({ markerColor: '#Ff00aA' })
  expect(serialized).toContain('"markerColor":"#a1B2c3"')
  expect(serialized).toContain('"markerColor":"#Ff00aA"')
})

test('player JSON rejects malformed marker colors on public object records @pure', () => {
  for (const markerColor of ['#12345', '#1234567', '123456', '#GGGGGG', '#12 456', null, 123]) {
    const document = validPlayerDocument()
    const revealed = document.systems[2]
    if (!revealed || revealed.disclosure !== 'revealed') throw new Error('Expected a Revealed system.')
    Object.assign(revealed.map.objects[1]!, { markerColor })

    expectPlayerDocumentError(() => restorePlayerDocument(document), 'invalid-document')
  }
})

test('player JSON rejects malformed, unsupported, and unsafe data with fixed errors @pure', () => {
  const document = validPlayerDocument()
  const privateMarker = 'PRIVATE-GM-DIAGNOSTIC-MARKER-72'

  expectPlayerDocumentError(
    () => parsePlayerJson(`{"private":"${privateMarker}"`),
    'invalid-json',
    privateMarker,
  )
  expectPlayerDocumentError(() => parsePlayerJson('   '), 'empty-document')
  expectPlayerDocumentError(
    () => restorePlayerDocument({ ...document, format: privateMarker }),
    'unsupported-format',
    privateMarker,
  )
  expectPlayerDocumentError(
    () => restorePlayerDocument({ ...document, version: 3 }),
    'unsupported-version',
  )
  expectPlayerDocumentError(
    () => restorePlayerDocument({ ...document, systems: [] }),
    'empty-document',
  )
  expectPlayerDocumentError(
    () => parsePlayerJson(' '.repeat(4 * 1024 * 1024 + 1)),
    'too-large',
  )
  expectPlayerDocumentError(
    () => parsePlayerJson(`${'['.repeat(65)}0${']'.repeat(65)}`),
    'too-large',
  )
  const excessiveSystems = JSON.stringify({
    format: document.format,
    version: document.version,
    title: document.title,
    systems: Array.from({ length: 257 }, () => null),
    routes: [],
  })
  expectPlayerDocumentError(() => parsePlayerJson(excessiveSystems), 'too-large')

  const invalidIdentity = {
    ...document,
    systems: document.systems.map(system => system.id === 'system-3'
      ? { ...system, id: privateMarker }
      : system),
  }
  expectPlayerDocumentError(() => restorePlayerDocument(invalidIdentity), 'invalid-document', privateMarker)

  const duplicateObjectIdentity = {
    ...document,
    systems: document.systems.map(system => system.disclosure === 'revealed' && system.id === 'system-3'
      ? {
          ...system,
          map: {
            ...system.map,
            objects: system.map.objects.map(object => object.id === 'object-2'
              ? { ...object, id: 'object-1' }
              : object),
          },
        }
      : system),
  }
  expectPlayerDocumentError(() => restorePlayerDocument(duplicateObjectIdentity), 'invalid-document')

  const missingRouteOrigin = {
    ...document,
    routes: document.routes.map(route => route.id === 'route-1'
      ? { ...route, fromSystemId: 'system-99' }
      : route),
  }
  expectPlayerDocumentError(() => restorePlayerDocument(missingRouteOrigin), 'invalid-document')

  const missingOrbit = {
    ...document,
    systems: document.systems.map(system => system.disclosure === 'revealed' && system.id === 'system-3'
      ? {
          ...system,
          map: {
            ...system.map,
            objects: system.map.objects.map(object => object.id === 'object-2'
              ? { ...object, placement: { kind: 'orbit', orbitId: 'orbit-99', angle: 1.25 } }
              : object),
          },
        }
      : system),
  }
  expectPlayerDocumentError(() => restorePlayerDocument(missingOrbit), 'invalid-document')

  const missingHost = {
    ...document,
    systems: document.systems.map(system => system.disclosure === 'revealed' && system.id === 'system-3'
      ? {
          ...system,
          map: {
            ...system.map,
            orbits: system.map.orbits.map(orbit => orbit.id === 'orbit-1'
              ? { ...orbit, hostId: 'object-99' }
              : orbit),
          },
        }
      : system),
  }
  expectPlayerDocumentError(() => restorePlayerDocument(missingHost), 'invalid-document')

  const hostCycle = {
    ...document,
    systems: document.systems.map(system => system.disclosure === 'revealed' && system.id === 'system-3'
      ? {
          ...system,
          map: {
            ...system.map,
            orbits: system.map.orbits.map(orbit => orbit.id === 'orbit-1'
              ? { ...orbit, hostId: 'object-2' }
              : orbit),
          },
        }
      : system),
  }
  expectPlayerDocumentError(() => restorePlayerDocument(hostCycle), 'invalid-document')

  const invalidStationPair = {
    ...document,
    systems: document.systems.map(system => system.disclosure === 'revealed' && system.id === 'system-3'
      ? {
          ...system,
          map: {
            ...system.map,
            objects: system.map.objects.map(object => object.id === 'object-3'
              ? { ...object, stationId: 'object-2' }
              : object),
          },
        }
      : system),
  }
  expectPlayerDocumentError(() => restorePlayerDocument(invalidStationPair), 'invalid-document')

  const invalidOtherLabel = {
    ...document,
    systems: document.systems.map(system => system.disclosure === 'revealed' && system.id === 'system-3'
      ? {
          ...system,
          map: {
            ...system.map,
            objects: system.map.objects.map(object => object.id === 'object-2'
              ? { ...object, label: '  Ancient megastructure  ' }
              : object),
          },
        }
      : system),
  }
  expectPlayerDocumentError(() => restorePlayerDocument(invalidOtherLabel), 'invalid-document')

  const invalidFieldValue = {
    ...document,
    systems: document.systems.map(system => system.disclosure === 'revealed' && system.id === 'system-3'
      ? {
          ...system,
          map: {
            ...system.map,
            objects: system.map.objects.map(object => object.id === 'object-3' && object.disclosure === 'revealed'
              ? {
                  ...object,
                  fields: object.fields.map(field => field.name === 'Count'
                    ? { ...field, value: privateMarker }
                    : field),
                }
              : object),
          },
        }
      : system),
  }
  expectPlayerDocumentError(() => restorePlayerDocument(invalidFieldValue), 'invalid-document', privateMarker)

  const invalidGeometry = {
    ...document,
    systems: document.systems.map(system => system.id === 'system-1'
      ? { ...system, position: { x: Number.POSITIVE_INFINITY, y: system.position.y } }
      : system),
  }
  expectPlayerDocumentError(() => restorePlayerDocument(invalidGeometry), 'invalid-document')

  const invalidOrbitGeometry = {
    ...document,
    systems: document.systems.map(system => system.disclosure === 'revealed' && system.id === 'system-3'
      ? {
          ...system,
          map: {
            ...system.map,
            orbits: system.map.orbits.map(orbit => orbit.id === 'orbit-1'
              ? { ...orbit, radii: { ...orbit.radii, horizontal: 0 } }
              : orbit),
          },
        }
      : system),
  }
  expectPlayerDocumentError(() => restorePlayerDocument(invalidOrbitGeometry), 'invalid-document')

  const excessiveObjects = {
    ...document,
    systems: document.systems.map(system => system.disclosure === 'revealed' && system.id === 'system-3'
      ? { ...system, map: { ...system.map, objects: Array.from({ length: 2_001 }, () => null) } }
      : system),
  }
  expectPlayerDocumentError(() => restorePlayerDocument(excessiveObjects), 'too-large')

  const excessiveFields = {
    ...document,
    systems: document.systems.map(system => system.disclosure === 'revealed' && system.id === 'system-3'
      ? {
          ...system,
          map: {
            ...system.map,
            objects: system.map.objects.map(object => object.id === 'object-3' && object.disclosure === 'revealed'
              ? { ...object, fields: Array.from({ length: 20_001 }, () => null) }
              : object),
          },
        }
      : system),
  }
  expectPlayerDocumentError(() => restorePlayerDocument(excessiveFields), 'too-large')
})

test('player document restoration rejects cumulative output beyond the JSON byte limit @pure', () => {
  const workspace = createLocalWorkspace('PRIVATE cluster name', 'Pilgrim System')
  const sourceSystem = workspace.cluster.systems[0]!
  const published = updateChartDetails(workspace, sourceSystem.id, {
    clusterName: workspace.cluster.name,
    systemName: sourceSystem.name,
    playerTitle: 'Pilgrim Reach',
    publication: 'revealed',
  })
  const document = projectPlayerCluster(published)
  // Backslashes double in JSON, so repeated values exceed the document limit while each stays small.
  const sharedText = '\\'.repeat(64 * 1024)
  const objects: PlayerObjectMarker[] = Array.from({ length: 33 }, (_, index) => ({
    id: `object-${index + 1}`,
    position: { x: index, y: 0 },
    placement: { kind: 'system' },
    disclosure: 'revealed',
    family: 'CelestialBody',
    subtype: 'planet',
    label: `Public planet ${index + 1}`,
    playerText: sharedText,
    fields: [],
  }))
  const oversizedDocument = {
    ...document,
    systems: document.systems.map(system => system.disclosure === 'revealed'
      ? { ...system, map: { ...system.map, objects } }
      : system),
  }
  let errorCode: string | undefined

  try {
    restorePlayerDocument(oversizedDocument)
  } catch (error) {
    if (!(error instanceof PlayerDocumentError)) throw error
    errorCode = error.code
  }

  expect(errorCode).toBe('too-large')
})

test('player JSON byte accounting includes the optional marker color property @pure', () => {
  const textLimit = 256 * 1024
  const objects: PlayerObjectMarker[] = Array.from({ length: 16 }, (_, index) => ({
    id: `object-${index + 1}`,
    position: { x: index, y: 0 },
    placement: { kind: 'system' },
    disclosure: 'revealed',
    family: 'CelestialBody',
    subtype: 'planet',
    label: `Public planet ${index + 1}`,
    playerText: '',
    fields: [],
  }))
  const legacyDocument: Omit<PlayerClusterDocument, 'version'> & { version: 1 } = {
    format: 'ttrpg-cluster-control-player',
    version: 1,
    title: 'Public Reach',
    systems: [{
      id: 'system-1',
      position: { x: 0, y: 0 },
      disclosure: 'revealed',
      type: 'star-system',
      label: 'Aster',
      map: { objects, orbits: [] },
    }],
    routes: [],
  }
  const legacyProjectionBytes = () => new TextEncoder().encode(
    serializePlayerJson(restorePlayerDocument(legacyDocument)),
  ).byteLength
  const emptyTextBytes = legacyProjectionBytes()
  const lastTextLength = MAX_PLAYER_JSON_BYTES - emptyTextBytes - 15 * textLimit
  for (const object of objects.slice(0, 15)) {
    if (object.disclosure !== 'revealed') throw new Error('Expected a Revealed object.')
    object.playerText = 'x'.repeat(textLimit)
  }
  const finalObject = objects[15]
  if (!finalObject || finalObject.disclosure !== 'revealed') throw new Error('Expected a final Revealed object.')
  finalObject.playerText = 'x'.repeat(lastTextLength)

  expect(legacyProjectionBytes()).toBe(MAX_PLAYER_JSON_BYTES)
  Object.assign(objects[0]!, { markerColor: '#123456' })
  expectPlayerDocumentError(() => restorePlayerDocument(legacyDocument), 'too-large')
})
