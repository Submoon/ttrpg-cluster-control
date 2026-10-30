import { expect, test } from './fixtures'
import {
  addStarSystem,
  createJumpRoute,
  createLocalWorkspace,
  createSystemObject,
  jumpPointsInCluster,
  projectPlayerCluster,
  replaceWorkspaceSystem,
  updateChartDetails,
  updateSystemObject,
} from '../domain/workspace'
import { clusterRouteGeometry } from '../utils/cluster-map-geometry'

function addJumpPointPair(
  workspace: ReturnType<typeof createLocalWorkspace>,
  systemId: string,
) {
  const system = workspace.cluster.systems.find(candidate => candidate.id === systemId)
  if (!system) throw new Error('Route projection fixture system is missing.')
  const first = createSystemObject(system, 'jump-point')
  const withFirst = { ...system, objects: [...system.objects, first] }
  const second = createSystemObject(withFirst, 'jump-point')
  const nextWorkspace = replaceWorkspaceSystem(workspace, {
    ...withFirst,
    objects: [...withFirst.objects, second],
  })
  return { workspace: nextWorkspace, points: [first, second] as const }
}

function setSystemPublication(
  workspace: ReturnType<typeof createLocalWorkspace>,
  systemId: string,
  publication: 'hidden' | 'unknown' | 'known-type' | 'revealed',
): ReturnType<typeof createLocalWorkspace> {
  const system = workspace.cluster.systems.find(candidate => candidate.id === systemId)
  if (!system) throw new Error('Route projection fixture system is missing.')
  return updateChartDetails(workspace, system.id, {
    clusterName: workspace.cluster.name,
    systemName: system.name,
    playerTitle: workspace.cluster.playerTitle,
    publication,
  })
}

test('shared routes between retained systems use safe public references and filtered ordinals @pure', () => {
  const firstWorkspace = createLocalWorkspace('PRIVATE REACH', 'OPEN SYSTEM NAME')
  const added = addStarSystem(firstWorkspace, 'SECOND SYSTEM NAME')
  const firstId = firstWorkspace.cluster.systems[0]!.id
  const secondId = added.system.id
  const firstPair = addJumpPointPair(added.workspace, firstId)
  const secondPair = addJumpPointPair(firstPair.workspace, secondId)
  let workspace = setSystemPublication(secondPair.workspace, firstId, 'unknown')
  workspace = setSystemPublication(workspace, secondId, 'known-type')

  const privateRoute = {
    ...createJumpRoute(workspace.cluster, 7, firstPair.points[0].id, secondPair.points[0].id),
    id: 'PRIVATE_ROUTE_ID',
    name: 'PRIVATE_ROUTE_NAME',
  }
  const privateCluster = { ...workspace.cluster, routes: [privateRoute] }
  const sharedRoute = {
    ...createJumpRoute(privateCluster, 3, firstPair.points[1].id, secondPair.points[1].id, 'PRIVATE_EXIT_LABEL', true),
    id: 'SHARED_SOURCE_ROUTE_ID',
    name: 'PRIVATE_SHARED_ROUTE_NAME',
  }
  const source = {
    ...workspace,
    cluster: { ...workspace.cluster, routes: [privateRoute, sharedRoute] },
  }

  const document = projectPlayerCluster(source)

  expect(document.routes).toEqual([{
    id: 'route-1',
    jumpLevel: 3,
    fromSystemId: 'system-1',
    destination: { kind: 'system', systemId: 'system-2' },
  }])
  const serialized = JSON.stringify(document)
  for (const privateText of [
    'PRIVATE REACH',
    'OPEN SYSTEM NAME',
    'SECOND SYSTEM NAME',
    'PRIVATE_ROUTE_ID',
    'PRIVATE_ROUTE_NAME',
    'SHARED_SOURCE_ROUTE_ID',
    'PRIVATE_SHARED_ROUTE_NAME',
    'PRIVATE_EXIT_LABEL',
    firstPair.points[1].id,
    secondPair.points[1].id,
  ]) {
    expect(serialized).not.toContain(privateText)
  }
})

test('routes to Hidden systems expose only exact anonymous positions from the retained side @pure', () => {
  const initial = createLocalWorkspace('Private Cluster', 'Hidden Origin')
  const retained = addStarSystem(initial, 'Retained Destination')
  const hiddenTarget = addStarSystem(retained.workspace, 'Another Hidden System')
  const originId = initial.cluster.systems[0]!.id
  const retainedId = retained.system.id
  const hiddenTargetId = hiddenTarget.system.id
  const originPair = addJumpPointPair(hiddenTarget.workspace, originId)
  const retainedPair = addJumpPointPair(originPair.workspace, retainedId)
  const hiddenPair = addJumpPointPair(retainedPair.workspace, hiddenTargetId)
  let workspace = setSystemPublication(hiddenPair.workspace, originId, 'hidden')
  workspace = setSystemPublication(workspace, retainedId, 'known-type')
  workspace = setSystemPublication(workspace, hiddenTargetId, 'hidden')

  const originToRetained = createJumpRoute(
    workspace.cluster,
    2,
    originPair.points[0].id,
    retainedPair.points[0].id,
    'PRIVATE LABEL ONE',
    true,
  )
  const withFirstRoute = { ...workspace.cluster, routes: [originToRetained] }
  const retainedToOrigin = createJumpRoute(
    withFirstRoute,
    4,
    retainedPair.points[1].id,
    originPair.points[1].id,
    'PRIVATE LABEL TWO',
    true,
  )
  const withTwoRoutes = { ...workspace.cluster, routes: [originToRetained, retainedToOrigin] }
  const hiddenToHidden = createJumpRoute(
    withTwoRoutes,
    8,
    originPair.points[1].id,
    hiddenPair.points[0].id,
    'PRIVATE LABEL THREE',
    true,
  )
  const source = {
    ...workspace,
    cluster: { ...workspace.cluster, routes: [originToRetained, retainedToOrigin, hiddenToHidden] },
  }

  const document = projectPlayerCluster(source)

  expect(document.routes).toHaveLength(2)
  expect(document.routes[0]).toMatchObject({
    id: 'route-1',
    jumpLevel: 2,
    fromSystemId: 'system-1',
    destination: { kind: 'unknown', label: 'Unknown destination' },
  })
  expect(document.routes[1]).toMatchObject({
    id: 'route-2',
    jumpLevel: 4,
    fromSystemId: 'system-1',
    destination: { kind: 'unknown', label: 'Unknown destination' },
  })
  for (const route of document.routes) {
    if (route.destination.kind !== 'unknown') throw new Error('Expected an anonymous route destination.')
    expect(route.destination.position.x).toBeCloseTo(244.48, 8)
    expect(route.destination.position.y).toBeCloseTo(224.8, 8)
  }
  const serialized = JSON.stringify(document)
  for (const privateText of [
    'Hidden Origin',
    'Another Hidden System',
    'PRIVATE LABEL ONE',
    'PRIVATE LABEL TWO',
    'PRIVATE LABEL THREE',
    originId,
    hiddenTargetId,
    originPair.points[0].id,
    retainedPair.points[0].id,
    hiddenPair.points[0].id,
  ]) {
    expect(serialized).not.toContain(privateText)
  }
})

test('shared routes between points in the same retained system remain public loops @pure', () => {
  const initial = createLocalWorkspace('Loop Cluster', 'Loop System')
  const systemId = initial.cluster.systems[0]!.id
  const pair = addJumpPointPair(initial, systemId)
  const workspace = setSystemPublication(pair.workspace, systemId, 'revealed')
  const route = createJumpRoute(workspace.cluster, 9, pair.points[0].id, pair.points[1].id, 'PRIVATE LOOP EXIT', true)
  const source = { ...workspace, cluster: { ...workspace.cluster, routes: [{ ...route, name: 'PRIVATE LOOP NAME' }] } }

  const document = projectPlayerCluster(source)

  expect(document.routes).toEqual([{
    id: 'route-1',
    jumpLevel: 9,
    fromSystemId: 'system-1',
    destination: { kind: 'system', systemId: 'system-1' },
  }])
  expect(JSON.stringify(document)).not.toContain('PRIVATE LOOP NAME')
  expect(JSON.stringify(document)).not.toContain('PRIVATE LOOP EXIT')
  expect(JSON.stringify(document)).not.toContain(pair.points[0].id)
  expect(JSON.stringify(document)).not.toContain(pair.points[1].id)
})

test('shared unresolved routes keep source geometry but receive public-only ordinals and labels @pure', () => {
  const initial = createLocalWorkspace('Private External Cluster', 'Visible Origin')
  const hiddenAdded = addStarSystem(initial, 'Hidden External Origin')
  const visibleId = initial.cluster.systems[0]!.id
  const hiddenId = hiddenAdded.system.id
  const visiblePair = addJumpPointPair(hiddenAdded.workspace, visibleId)
  const hiddenPair = addJumpPointPair(visiblePair.workspace, hiddenId)
  let workspace = setSystemPublication(hiddenPair.workspace, visibleId, 'unknown')
  workspace = setSystemPublication(workspace, hiddenId, 'hidden')

  const privateBefore = {
    ...createJumpRoute(workspace.cluster, 1, visiblePair.points[0].id, null, 'PRIVATE EARLY EXIT'),
    id: 'PRIVATE_EARLY_ROUTE_ID',
    name: 'PRIVATE EARLY ROUTE NAME',
  }
  const withPrivateBefore = { ...workspace.cluster, routes: [privateBefore] }
  const savedShared = {
    ...createJumpRoute(withPrivateBefore, 3, visiblePair.points[0].id, null, 'PRIVATE SHARED EXIT', true),
    id: 'SHARED_SAVED_ROUTE_ID',
    name: 'PRIVATE SHARED ROUTE NAME',
  }
  const withSavedShared = { ...workspace.cluster, routes: [privateBefore, savedShared] }
  const privateAfter = {
    ...createJumpRoute(withSavedShared, 5, visiblePair.points[0].id, null, 'PRIVATE LATE EXIT'),
    id: 'PRIVATE_LATE_ROUTE_ID',
    name: 'PRIVATE LATE ROUTE NAME',
  }
  const withPrivateAfter = { ...workspace.cluster, routes: [privateBefore, savedShared, privateAfter] }
  const automaticShared = {
    ...createJumpRoute(withPrivateAfter, 7, visiblePair.points[0].id, null, 'PRIVATE AUTOMATIC EXIT', true),
    id: 'SHARED_AUTOMATIC_ROUTE_ID',
  }
  const withVisibleRoutes = { ...workspace.cluster, routes: [privateBefore, savedShared, privateAfter, automaticShared] }
  const hiddenOriginRoute = {
    ...createJumpRoute(withVisibleRoutes, 8, hiddenPair.points[0].id, null, 'HIDDEN ROUTE EXIT', true),
    id: 'SHARED_HIDDEN_ORIGIN_ID',
  }
  const source = {
    ...workspace,
    cluster: {
      ...workspace.cluster,
      routes: [privateBefore, savedShared, privateAfter, automaticShared, hiddenOriginRoute],
    },
    layout: {
      ...workspace.layout,
      unresolvedExitPositions: { [savedShared.id]: { x: 1234.5, y: 678.25 } },
    },
  }
  const jumpPoints = new Map(jumpPointsInCluster(source.cluster)
    .map(reference => [reference.point.id, reference]))
  const sourceSavedGeometry = clusterRouteGeometry(
    savedShared,
    source.cluster,
    jumpPoints,
    source.layout.systemPositions,
    undefined,
    source.layout.unresolvedExitPositions,
  )
  const sourceAutomaticGeometry = clusterRouteGeometry(
    automaticShared,
    source.cluster,
    jumpPoints,
    source.layout.systemPositions,
    undefined,
    source.layout.unresolvedExitPositions,
  )

  const document = projectPlayerCluster(source)

  expect(document.routes).toHaveLength(2)
  expect(document.routes[0]).toMatchObject({
    id: 'route-1',
    jumpLevel: 3,
    fromSystemId: 'system-1',
    destination: { kind: 'unknown', label: 'Unknown destination', position: sourceSavedGeometry.exitPoint },
  })
  expect(document.routes[1]).toMatchObject({
    id: 'route-2',
    jumpLevel: 7,
    fromSystemId: 'system-1',
    destination: { kind: 'unknown', label: 'Unknown destination', position: sourceAutomaticGeometry.exitPoint },
  })
  const serialized = JSON.stringify(document)
  for (const privateText of [
    'Private External Cluster',
    'Visible Origin',
    'Hidden External Origin',
    'PRIVATE EARLY EXIT',
    'PRIVATE SHARED EXIT',
    'PRIVATE LATE EXIT',
    'PRIVATE AUTOMATIC EXIT',
    'HIDDEN ROUTE EXIT',
    'PRIVATE EARLY ROUTE NAME',
    'PRIVATE SHARED ROUTE NAME',
    'PRIVATE LATE ROUTE NAME',
    'PRIVATE_EARLY_ROUTE_ID',
    'SHARED_SAVED_ROUTE_ID',
    'PRIVATE_LATE_ROUTE_ID',
    'SHARED_AUTOMATIC_ROUTE_ID',
    'SHARED_HIDDEN_ORIGIN_ID',
    hiddenId,
    hiddenPair.points[0].id,
  ]) {
    expect(serialized).not.toContain(privateText)
  }
})

test('physical Station associations require both linked objects to be Revealed @pure', () => {
  const modes = ['hidden', 'unknown', 'known-type', 'revealed'] as const

  for (const jumpPointMode of modes) {
    for (const stationMode of modes) {
      const initial = createLocalWorkspace('Station Cluster', 'Station System')
      const system = initial.cluster.systems[0]!
      const jumpPoint = createSystemObject(system, 'jump-point')
      const withJumpPoint = { ...system, objects: [...system.objects, jumpPoint] }
      const station = createSystemObject(withJumpPoint, 'station')
      const withBothObjects = { ...withJumpPoint, objects: [...withJumpPoint.objects, station] }
      const linked = updateSystemObject(
        withBothObjects,
        jumpPoint.id,
        { name: 'Nexus Jump Point', publication: jumpPointMode, jumpStationId: station.id },
        initial.objectFieldSettings,
      )
      const withStationMode = updateSystemObject(
        linked,
        station.id,
        { name: 'Nexus Station', publication: stationMode },
        initial.objectFieldSettings,
      )
      const withSystem = replaceWorkspaceSystem(initial, withStationMode)
      const published = updateChartDetails(withSystem, system.id, {
        clusterName: withSystem.cluster.name,
        systemName: system.name,
        playerTitle: withSystem.cluster.playerTitle,
        publication: 'revealed',
      })
      const document = projectPlayerCluster(published)
      const systemDocument = document.systems[0]
      if (!systemDocument || systemDocument.disclosure !== 'revealed') {
        throw new Error('Expected the Station fixture system to be Revealed.')
      }
      const linkedMarkers = systemDocument.map.objects.filter(marker => 'stationId' in marker)

      if (jumpPointMode === 'revealed' && stationMode === 'revealed') {
        const stationMarker = systemDocument.map.objects.find(marker =>
          marker.disclosure === 'revealed'
          && marker.family === 'Installation'
          && marker.subtype === 'station',
        )
        expect(linkedMarkers).toHaveLength(1)
        expect(linkedMarkers[0]).toHaveProperty('stationId', stationMarker?.id)
      } else {
        expect(linkedMarkers).toHaveLength(0)
      }

      if (stationMode === 'hidden') {
        expect(systemDocument.map.objects.some(marker =>
          marker.disclosure !== 'unknown'
          && marker.family === 'Installation'
          && marker.subtype === 'station',
        )).toBe(false)
      }
    }
  }
})
