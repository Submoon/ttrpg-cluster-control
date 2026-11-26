import { expect, test } from '@playwright/test'
import {
  applySystemObjectTransfer,
  createLocalWorkspace,
  exportJumpCluster,
  prepareSystemObjectTransfer,
  prepareCatalogueObjectTransfer,
  createJumpRoute,
  routeContentsFor,
  resolveSystemObjectHistoryTarget,
  restoreJumpClusterBackup,
  type LocalWorkspace,
  type StarSystem,
  type SystemObject,
} from '../domain/workspace'
import { objectPositions } from '../utils/system-map-geometry'
import { workspaceWithRouteObjects } from './support/route-objects-fixture'

function object(
  id: string,
  placement: SystemObject['placement'],
  values: Partial<Pick<SystemObject, 'family' | 'subtype' | 'locationKey' | 'jumpStationId'>> = {},
): SystemObject {
  return {
    id,
    publication: 'revealed',
    family: values.family ?? 'CelestialBody',
    subtype: values.subtype ?? 'planet',
    locationKey: values.locationKey ?? id,
    name: id,
    description: '',
    playerText: '',
    playerFieldMasks: [],
    placement,
    ...(values.jumpStationId !== undefined ? { jumpStationId: values.jumpStationId } : {}),
  }
}

function secondSystem(base: LocalWorkspace, objects: SystemObject[], orbits: StarSystem['orbits'] = []): StarSystem {
  const source = base.cluster.systems[0]!
  return {
    ...source,
    id: 'destination',
    name: 'Destination',
    objects,
    orbits,
  }
}

function workspaceWithSystems(
  base: LocalWorkspace,
  source: StarSystem,
  destination: StarSystem,
  routes: LocalWorkspace['cluster']['routes'] = [],
  layout: Partial<LocalWorkspace['layout']> = {},
): LocalWorkspace {
  const baseSystem = base.cluster.systems[0]!
  return {
    ...base,
    cluster: {
      ...base.cluster,
      systems: [source, destination],
      routes,
    },
    layout: {
      ...base.layout,
      systemPositions: {
        [baseSystem.id]: { x: 0.3, y: 0.4 },
        [destination.id]: { x: 0.7, y: 0.6 },
        ...layout.systemPositions,
      },
      ...layout,
    },
  }
}

function geometryOf(workspace: LocalWorkspace) {
  return {
    objectAngles: workspace.layout.objectAngles,
    orbitRadii: workspace.layout.orbitRadii,
    orbitRotations: workspace.layout.orbitRotations,
  }
}

function nestedBranchWorkspace(): LocalWorkspace {
  const base = createLocalWorkspace('Kestrel Reach', 'Source')
  const sourceBase = base.cluster.systems[0]!
  const source: StarSystem = {
    ...sourceBase,
    objects: [
      object('sun', { kind: 'system', x: 0.5, y: 0.5 }, { subtype: 'star', locationKey: 'STAR-01' }),
      object('root', { kind: 'orbit', orbitId: 'source-parent' }, { locationKey: 'PL-01' }),
      object('source-survivor', { kind: 'orbit', orbitId: 'source-parent' }, { locationKey: 'PL-02' }),
      object('moon', { kind: 'orbit', orbitId: 'root-ring' }, { subtype: 'moon', locationKey: 'MO-01' }),
      object('nested', { kind: 'orbit', orbitId: 'moon-ring' }, { subtype: 'moon', locationKey: 'MO-02' }),
    ],
    orbits: [
      { id: 'source-parent', hostId: 'sun', order: 1 },
      { id: 'root-ring', hostId: 'root', order: 1 },
      { id: 'root-empty', hostId: 'root', order: 2 },
      { id: 'moon-ring', hostId: 'moon', order: 1 },
    ],
  }
  const destination = secondSystem(base, [
    object('destination-host', { kind: 'system', x: 0.25, y: 0.35 }, { subtype: 'star', locationKey: 'STAR-02' }),
    object('destination-inherited', { kind: 'orbit', orbitId: 'destination-ring' }, { locationKey: 'PL-03' }),
    object('destination-explicit', { kind: 'orbit', orbitId: 'destination-ring' }, { locationKey: 'PL-04' }),
  ], [{ id: 'destination-ring', hostId: 'destination-host', order: 1 }])
  return workspaceWithSystems(base, source, destination, [], {
    orbitRadii: {
      'source-parent': { horizontal: 120, vertical: 58 },
      'root-ring': { horizontal: 53, vertical: 35 },
      'root-empty': { horizontal: 84, vertical: 62 },
      'moon-ring': { horizontal: 37, vertical: 33 },
      'destination-ring': { horizontal: 114, vertical: 47 },
    },
    orbitRotations: {
      'source-parent': 28,
      'root-ring': 71,
      'root-empty': 19,
      'moon-ring': 36,
      'destination-ring': 43,
    },
    objectAngles: { root: 0.45, 'destination-explicit': 2.1 },
  })
}

test('a hosted branch transfers with nested geometry and effective neighboring angles intact @pure', () => {
  const workspace = nestedBranchWorkspace()
  const source = workspace.cluster.systems[0]!
  const destination = workspace.cluster.systems[1]!
  const beforeSource = objectPositions(source, geometryOf(workspace))
  const beforeDestination = objectPositions(destination, geometryOf(workspace))
  const relativeMoon = {
    x: beforeSource.get('moon')!.x - beforeSource.get('root')!.x,
    y: beforeSource.get('moon')!.y - beforeSource.get('root')!.y,
  }
  const relativeNested = {
    x: beforeSource.get('nested')!.x - beforeSource.get('moon')!.x,
    y: beforeSource.get('nested')!.y - beforeSource.get('moon')!.y,
  }
  const request = {
    sourceSystemId: source.id,
    rootObjectId: 'root',
    destinationSystemId: destination.id,
    placement: { kind: 'orbit' as const, orbitId: 'destination-ring', angle: 1.2 },
  }

  const review = prepareSystemObjectTransfer(workspace, request)
  expect(review.branch.objectIds).toEqual(['root', 'moon', 'nested'])
  expect(review.branch.orbitIds).toEqual(['root-ring', 'moon-ring', 'root-empty'])
  const next = applySystemObjectTransfer(workspace, request)
  const nextSource = next.cluster.systems[0]!
  const nextDestination = next.cluster.systems[1]!
  const afterSource = objectPositions(nextSource, geometryOf(next))
  const afterDestination = objectPositions(nextDestination, geometryOf(next))

  expect(nextSource.objects.map(candidate => candidate.id)).toEqual(['sun', 'source-survivor'])
  expect(nextSource.orbits.map(candidate => candidate.id)).toEqual(['source-parent'])
  expect(nextDestination.objects.map(candidate => candidate.id)).toEqual([
    'destination-host', 'destination-inherited', 'destination-explicit', 'root', 'moon', 'nested',
  ])
  expect(nextDestination.orbits.map(candidate => candidate.id)).toEqual([
    'destination-ring', 'root-ring', 'root-empty', 'moon-ring',
  ])
  expect(next.layout.orbitRadii['root-empty']).toEqual({ horizontal: 84, vertical: 62 })
  expect(next.layout.orbitRotations['root-empty']).toBe(19)
  expect(afterSource.get('source-survivor')).toEqual(beforeSource.get('source-survivor'))
  expect(afterDestination.get('destination-inherited')).toEqual(beforeDestination.get('destination-inherited'))
  expect(afterDestination.get('destination-explicit')).toEqual(beforeDestination.get('destination-explicit'))
  expect(next.layout.objectAngles.root).toBe(1.2)
  expect(afterDestination.get('moon')!.x - afterDestination.get('root')!.x).toBeCloseTo(relativeMoon.x, 8)
  expect(afterDestination.get('moon')!.y - afterDestination.get('root')!.y).toBeCloseTo(relativeMoon.y, 8)
  expect(afterDestination.get('nested')!.x - afterDestination.get('moon')!.x).toBeCloseTo(relativeNested.x, 8)
  expect(afterDestination.get('nested')!.y - afterDestination.get('moon')!.y).toBeCloseTo(relativeNested.y, 8)
  expect(workspace.cluster.systems[0]!.objects.map(candidate => candidate.id)).toContain('root')
  expect(workspace.layout.objectAngles.root).toBe(0.45)
})

test('history reveal resolves the transferred root to its actual owner in each snapshot @pure', () => {
  const before = nestedBranchWorkspace()
  const sourceId = before.cluster.systems[0]!.id
  const destinationId = before.cluster.systems[1]!.id
  const request = {
    sourceSystemId: sourceId,
    rootObjectId: 'root',
    destinationSystemId: destinationId,
    placement: { kind: 'system' as const, x: 0.61, y: 0.35 },
  }
  const after = applySystemObjectTransfer(before, request)

  expect(resolveSystemObjectHistoryTarget(before, 'root'))
    .toEqual({ kind: 'object', id: 'root', systemId: sourceId })
  expect(resolveSystemObjectHistoryTarget(after, 'root'))
    .toEqual({ kind: 'object', id: 'root', systemId: destinationId })
  expect(resolveSystemObjectHistoryTarget(after, 'missing')).toBeNull()
})

test('transfer clears only cross-owner route attachments and Station links in both directions @pure', () => {
  const base = createLocalWorkspace('Kestrel Reach', 'Source')
  const sourceBase = base.cluster.systems[0]!
  const source: StarSystem = {
    ...sourceBase,
    objects: [
      object('transfer-root', { kind: 'system', x: 0.5, y: 0.5 }, { subtype: 'star', locationKey: 'STAR-01' }),
      object('moved-station', { kind: 'orbit', orbitId: 'transfer-ring' }, {
        family: 'Installation', subtype: 'station', locationKey: 'ST-01',
      }),
      object('moved-jp-outgoing', { kind: 'orbit', orbitId: 'transfer-ring' }, {
        family: 'JumpPoint', subtype: 'jump-point', locationKey: 'JP-01', jumpStationId: 'station-stays',
      }),
      object('moved-jp-internal', { kind: 'orbit', orbitId: 'transfer-ring' }, {
        family: 'JumpPoint', subtype: 'jump-point', locationKey: 'JP-02', jumpStationId: 'moved-station',
      }),
      object('source-jp-incoming', { kind: 'system', x: 0.3, y: 0.4 }, {
        family: 'JumpPoint', subtype: 'jump-point', locationKey: 'JP-03', jumpStationId: 'moved-station',
      }),
      object('source-jp-stable', { kind: 'system', x: 0.7, y: 0.4 }, {
        family: 'JumpPoint', subtype: 'jump-point', locationKey: 'JP-04', jumpStationId: 'station-stays',
      }),
      object('station-stays', { kind: 'system', x: 0.7, y: 0.7 }, {
        family: 'Installation', subtype: 'station', locationKey: 'ST-02',
      }),
    ],
    orbits: [{ id: 'transfer-ring', hostId: 'transfer-root', order: 1 }],
  }
  const destination = secondSystem(base, [
    object('destination-jp', { kind: 'system', x: 0.4, y: 0.5 }, {
      family: 'JumpPoint', subtype: 'jump-point', locationKey: 'JP-01',
    }),
  ])
  const sourceId = source.id
  const destinationId = destination.id
  const routes: LocalWorkspace['cluster']['routes'] = [
    {
      id: 'outbound', name: 'Outbound', jumpLevel: 3, fromSystemId: sourceId,
      fromPointId: 'moved-jp-outgoing', toSystemId: destinationId, toPointId: 'destination-jp', playerShared: true,
    },
    {
      id: 'inbound', name: 'Inbound', jumpLevel: 4, fromSystemId: destinationId,
      fromPointId: 'destination-jp', toSystemId: sourceId, toPointId: 'moved-jp-internal', playerShared: false,
    },
    {
      id: 'unresolved', name: 'Unknown', jumpLevel: 8, fromSystemId: sourceId,
      fromPointId: 'moved-jp-internal', toSystemId: null, toPointId: null,
      unresolvedExit: 'Far Reach', playerShared: true,
    },
    {
      id: 'untouched', jumpLevel: 1, fromSystemId: sourceId,
      fromPointId: 'source-jp-stable', toSystemId: destinationId,
      toPointId: 'destination-jp', playerShared: false,
    },
  ]
  const { branch, workspace: routeFixture } = workspaceWithRouteObjects()
  const workspace = workspaceWithSystems(base, source, destination, routes, {
    unresolvedExitPositions: { unresolved: { x: 1320, y: 360 } },
    ...geometryOf(routeFixture),
  })
  workspace.cluster.routeContents.outbound = branch
  const request = {
    sourceSystemId: sourceId,
    rootObjectId: 'transfer-root',
    destinationSystemId: destinationId,
    placement: { kind: 'system' as const, x: 0.8, y: 0.2 },
  }
  const review = prepareSystemObjectTransfer(workspace, request)
  expect(review.detachedRouteAttachments).toEqual([
    { routeId: 'outbound', end: 'from', pointId: 'moved-jp-outgoing' },
    { routeId: 'inbound', end: 'to', pointId: 'moved-jp-internal' },
    { routeId: 'unresolved', end: 'from', pointId: 'moved-jp-internal' },
  ])
  expect(review.clearedStationLinks).toEqual([
    { objectId: 'moved-jp-outgoing', stationId: 'station-stays', direction: 'outgoing' },
    { objectId: 'source-jp-incoming', stationId: 'moved-station', direction: 'incoming' },
  ])

  const next = applySystemObjectTransfer(workspace, request)
  expect(next.cluster.routes).toEqual([
    { ...routes[0]!, fromPointId: null },
    { ...routes[1]!, toPointId: null },
    { ...routes[2]!, fromPointId: null },
    routes[3],
  ])
  expect(next.layout.unresolvedExitPositions).toEqual({ unresolved: { x: 1320, y: 360 } })
  expect(next.cluster.routeContents.outbound).toEqual(branch)
  expect(geometryOf(next)).toMatchObject(geometryOf(routeFixture))
  const nextSource = next.cluster.systems[0]!
  const nextDestination = next.cluster.systems[1]!
  expect(nextSource.objects.find(candidate => candidate.id === 'source-jp-incoming')?.jumpStationId).toBeNull()
  expect(nextSource.objects.find(candidate => candidate.id === 'source-jp-stable')?.jumpStationId).toBe('station-stays')
  expect(nextDestination.objects.find(candidate => candidate.id === 'moved-jp-outgoing')?.jumpStationId).toBeNull()
  expect(nextDestination.objects.find(candidate => candidate.id === 'moved-jp-internal')?.jumpStationId).toBe('moved-station')
})

test('the accepted transfer is a complete backup round trip with the original snapshot available for Undo @pure', () => {
  const before = nestedBranchWorkspace()
  const source = before.cluster.systems[0]!
  const destination = before.cluster.systems[1]!
  const request = {
    sourceSystemId: source.id,
    rootObjectId: 'root',
    destinationSystemId: destination.id,
    placement: { kind: 'system' as const, x: 0.6, y: 0.3 },
  }
  const accepted = applySystemObjectTransfer(before, request)
  const restored = restoreJumpClusterBackup(exportJumpCluster(accepted))

  expect(restored.cluster).toEqual(accepted.cluster)
  expect(restored.layout).toEqual(accepted.layout)
  expect(Object.hasOwn(accepted.layout.objectAngles, 'root')).toBe(false)
  expect(before.cluster.systems[0]!.objects.map(candidate => candidate.id)).toContain('root')
  expect(accepted.cluster.systems[0]!.objects.map(candidate => candidate.id)).not.toContain('root')
  expect(accepted.cluster.systems[1]!.objects.map(candidate => candidate.id)).toContain('root')
})

test('prototype-looking legacy entity IDs remain map keys through branch angle changes @pure', () => {
  const base = createLocalWorkspace('Kestrel Reach', 'Source')
  const sourceBase = base.cluster.systems[0]!
  const source: StarSystem = {
    ...sourceBase,
    objects: [
      object('legacy-sun', { kind: 'system', x: 0.5, y: 0.5 }, { subtype: 'star', locationKey: 'STAR-01' }),
      object('__proto__', { kind: 'orbit', orbitId: 'legacy-parent' }, { locationKey: 'PL-01' }),
      object('constructor', { kind: 'orbit', orbitId: 'legacy-parent' }, { locationKey: 'PL-02' }),
      object('legacy-nested', { kind: 'orbit', orbitId: 'legacy-root-ring' }, { subtype: 'moon', locationKey: 'MO-01' }),
    ],
    orbits: [
      { id: 'legacy-parent', hostId: 'legacy-sun', order: 1 },
      { id: 'legacy-root-ring', hostId: '__proto__', order: 1 },
    ],
  }
  const destination = secondSystem(base, [
    object('legacy-destination-host', { kind: 'system', x: 0.25, y: 0.3 }, { subtype: 'star', locationKey: 'STAR-01' }),
    object('legacy-destination-occupant', { kind: 'orbit', orbitId: 'legacy-destination-ring' }, { locationKey: 'PL-01' }),
  ], [{ id: 'legacy-destination-ring', hostId: 'legacy-destination-host', order: 1 }])
  const workspace = workspaceWithSystems(base, source, destination, [], {
    orbitRadii: {
      'legacy-parent': { horizontal: 100, vertical: 65 },
      'legacy-root-ring': { horizontal: 43, vertical: 37 },
      'legacy-destination-ring': { horizontal: 92, vertical: 61 },
    },
    objectAngles: Object.fromEntries([
      ['__proto__', 0.7],
      ['legacy-destination-occupant', 1.6],
    ]),
  })
  const sourceBefore = objectPositions(source, geometryOf(workspace))
  const request = {
    sourceSystemId: source.id,
    rootObjectId: '__proto__',
    destinationSystemId: destination.id,
    placement: { kind: 'orbit' as const, orbitId: 'legacy-destination-ring', angle: 2.3 },
  }
  const next = applySystemObjectTransfer(workspace, request)
  const sourceAfter = objectPositions(next.cluster.systems[0]!, geometryOf(next))

  expect(next.cluster.systems[1]!.objects.find(candidate => candidate.id === '__proto__')?.locationKey)
    .toBe('PL-01')
  expect(Object.hasOwn(next.layout.objectAngles, '__proto__')).toBe(true)
  expect(next.layout.objectAngles['__proto__']).toBe(2.3)
  expect(Object.hasOwn(next.layout.objectAngles, 'constructor')).toBe(true)
  expect(Object.hasOwn(workspace.layout.objectAngles, 'constructor')).toBe(false)
  expect(next.layout.objectAngles.constructor).toBeCloseTo(Math.PI / 2, 12)
  expect(sourceAfter.get('constructor')).toEqual(sourceBefore.get('constructor'))
})

test('a Zone Orbit occupant carries its complete branch to a Jump Route and back @pure', () => {
  const workspace = nestedBranchWorkspace()
  const [source, destination] = workspace.cluster.systems
  const route = createJumpRoute(workspace.cluster, {
    jumpLevel: 2,
    fromSystemId: source!.id,
    fromPointId: null,
    toSystemId: destination!.id,
    toPointId: null,
  })
  workspace.cluster.routes.push(route)
  const before = objectPositions(source!, geometryOf(workspace))
  const departure = prepareCatalogueObjectTransfer(workspace, {
    source: { kind: 'system', systemId: source!.id },
    rootObjectId: 'root',
    landing: { kind: 'route', routeId: route.id, progression: 1 },
  })
  const inTransit = departure.previewWorkspace
  expect(routeContentsFor(inTransit.cluster, route.id)?.objects.map(object => [object.id, object.locationKey]))
    .toEqual([['root', 'PL-01'], ['moon', 'MO-01'], ['nested', 'MO-02']])
  expect(routeContentsFor(inTransit.cluster, route.id)?.objects[0]?.placement).toEqual({ kind: 'route', progression: 1 })
  expect(objectPositions(inTransit.cluster.systems[0]!, geometryOf(inTransit)).get('source-survivor'))
    .toEqual(before.get('source-survivor'))
  const arrival = prepareCatalogueObjectTransfer(inTransit, {
    source: { kind: 'route', routeId: route.id },
    rootObjectId: 'root',
    landing: { kind: 'system', systemId: destination!.id, placement: { kind: 'system', x: 0.61, y: 0.35 } },
  })
  const landed = arrival.previewWorkspace
  const after = objectPositions(landed.cluster.systems[1]!, geometryOf(landed))
  expect(routeContentsFor(landed.cluster, route.id)?.objects ?? []).toEqual([])
  expect(landed.cluster.systems[1]?.orbits.map(orbit => orbit.id)).toEqual([
    'destination-ring', 'root-ring', 'root-empty', 'moon-ring',
  ])
  expect(landed.layout.orbitRotations['moon-ring']).toBe(36)
  expect(landed.layout.orbitRadii['moon-ring']).toEqual({ horizontal: 37, vertical: 33 })
  expect(after.get('nested')!.x - after.get('root')!.x).toBeCloseTo(before.get('nested')!.x - before.get('root')!.x, 8)
  expect(after.get('nested')!.y - after.get('root')!.y).toBeCloseTo(before.get('nested')!.y - before.get('root')!.y, 8)
})
