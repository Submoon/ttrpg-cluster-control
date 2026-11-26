import { expect, test } from './fixtures'
import { parsePlayerJson, serializePlayerJson } from '../domain/player-codec'
import { workspaceWithRouteObjects } from './support/route-objects-fixture'
import { addZoneWithPrimaryStar } from './support/primary-star-fixture'
import {
  addCustomFieldDefinition,
  addStarSystem,
  createLocalWorkspace,
  replaceWorkspaceSystem,
  updateChartDetails,
} from '../domain/workspace'
import { projectPlayerContinuousMap } from '../utils/player-continuous-map-projection'
import { projectPlayerRouteBranch } from '../utils/player-route-branch-geometry'
import { continuousMapRouteCurve } from '../utils/continuous-map-route-geometry'
import { projectPlayerCluster } from '../domain/player-projection'

function setPublication(
  workspace: ReturnType<typeof createLocalWorkspace>,
  systemId: string,
  publication: 'hidden' | 'unknown' | 'known-type' | 'revealed',
): ReturnType<typeof createLocalWorkspace> {
  const system = workspace.cluster.systems.find(candidate => candidate.id === systemId)
  if (!system) throw new Error('Projection fixture system is missing.')
  return updateChartDetails(workspace, system.id, {
    clusterName: workspace.cluster.name,
    systemName: system.name,
    playerTitle: workspace.cluster.playerTitle,
    publication,
  })
}

test('player projection emits only the marker information allowed by each publication mode @pure', () => {
  let workspace = createLocalWorkspace('Private Reach', 'Hidden Name')
  const hiddenId = workspace.cluster.systems[0]!.id
  const withUnknown = addStarSystem(workspace, 'Unknown Name')
  const withKnown = addStarSystem(withUnknown.workspace, 'Known Name')
  const withRevealed = addZoneWithPrimaryStar(withKnown.workspace, 'Revealed Name')
  workspace = withRevealed.workspace
  workspace = setPublication(workspace, hiddenId, 'hidden')
  workspace = setPublication(workspace, withUnknown.system.id, 'unknown')
  workspace = setPublication(workspace, withKnown.system.id, 'known-type')
  workspace = setPublication(workspace, withRevealed.system.id, 'revealed')

  const document = projectPlayerCluster(workspace)

  expect(document).toMatchObject({
    format: 'ttrpg-cluster-control-player',
    version: 3,
    title: 'Player Jump Cluster',
    systems: [
      { id: 'system-1', disclosure: 'unknown', label: 'Unknown presence' },
      { id: 'system-2', disclosure: 'known-type', type: 'star-system', label: 'Zone' },
      { id: 'system-3', disclosure: 'revealed', type: 'star-system', label: 'Revealed Name' },
    ],
  })
  expect(document.systems[0]!.position.x).toBeCloseTo(480)
  expect(document.systems[0]!.position.y).toBeCloseTo(224.8)
  expect(document.systems[1]!.position.x).toBeCloseTo(715.52)
  expect(document.systems[1]!.position.y).toBeCloseTo(224.8)
  expect(document.systems[2]!.position.x).toBeCloseTo(244.48)
  expect(document.systems[2]!.position.y).toBeCloseTo(335.2)
  expect(document.systems[0]).not.toHaveProperty('map')
  expect(document.systems[1]).not.toHaveProperty('map')
  const revealedMarker = document.systems[2]
  if (!revealedMarker || revealedMarker.disclosure !== 'revealed') {
    throw new Error('Expected the revealed player system marker.')
  }
  expect(revealedMarker.map).toMatchObject({
    objects: [{
      id: 'object-1',
      position: { x: 480, y: 280 },
      placement: { kind: 'system' },
      disclosure: 'known-type',
      family: 'CelestialBody',
      subtype: 'star',
      label: 'Star',
    }],
    orbits: [],
  })
  expect(JSON.stringify(document)).not.toContain('Private Reach')
  expect(JSON.stringify(document)).not.toContain(hiddenId)
  expect(JSON.stringify(document)).not.toContain(withUnknown.system.name)
  expect(JSON.stringify(document)).not.toContain(withKnown.system.name)
})

test('hidden distant systems and private source extensions do not affect the public document @pure', () => {
  const workspace = createLocalWorkspace('Secret Internal Name', 'Revealed System')
  const initialSystem = workspace.cluster.systems[0]!
  const revealed = setPublication(workspace, initialSystem.id, 'revealed')
  const revealedWithHiddenChildren = replaceWorkspaceSystem(revealed, {
    ...revealed.cluster.systems[0]!,
    objects: revealed.cluster.systems[0]!.objects.map(object => ({ ...object, publication: 'hidden' })),
  })
  const withHiddenSystem = addStarSystem(revealedWithHiddenChildren, 'Far Hidden System')
  const hidden = setPublication(withHiddenSystem.workspace, withHiddenSystem.system.id, 'hidden')
  hidden.layout.systemPositions[withHiddenSystem.system.id] = { x: 100_000, y: -100_000 }
  const before = structuredClone(hidden)
  const projected = projectPlayerCluster(hidden)
  const withPrivateFrame = {
    ...hidden,
    layout: {
      ...hidden.layout,
      systemFrames: {
        [initialSystem.id]: { left: 50_000, top: 60_000, right: 70_000, bottom: 80_000 },
      },
    },
  }
  const extended = {
    ...hidden,
    privateExtension: 'UNKNOWN WORKSPACE PROPERTY',
    cluster: {
      ...hidden.cluster,
      privateExtension: 'UNKNOWN CLUSTER PROPERTY',
      name: 'Changed Private Cluster Name',
      routes: [{ id: 'SECRET ROUTE ID', name: 'SECRET ROUTE NAME', jumpLevel: 1, playerShared: false, fromSystemId: initialSystem.id, fromPointId: 'SECRET POINT', toSystemId: null, toPointId: null, unresolvedExit: 'SECRET EXIT' }],
      systems: hidden.cluster.systems.map(system => system.id === initialSystem.id
        ? {
            ...system,
            privateExtension: 'UNKNOWN SYSTEM PROPERTY',
            objects: system.objects.map(object => ({
              ...object,
              id: 'SECRET OBJECT ID',
              locationKey: 'SECRET LOCATION KEY',
              name: 'SECRET OBJECT NAME',
              description: 'SECRET DESCRIPTION',
              customFieldValues: { SECRET_FIELD_ID: 'SECRET FIELD VALUE' },
            })),
            orbits: [{ id: 'SECRET ORBIT ID', hostId: null, center: { x: 0.5, y: 0.5 }, order: 1 }],
          }
        : system),
    },
    objectFieldSettings: {
      ...hidden.objectFieldSettings,
      customFields: [{ id: 'SECRET FIELD ID', name: 'SECRET FIELD NAME', type: 'text' as const, playerShared: false }],
    },
  }

  expect(projectPlayerCluster(extended)).toEqual(projected)
  expect(projectPlayerCluster(withPrivateFrame)).toEqual(projected)
  expect(projected.systems).toHaveLength(1)
  expect(projected.systems[0]?.id).toBe('system-1')
  expect(JSON.stringify(projected)).not.toMatch(/SECRET|UNKNOWN|Far Hidden System|Secret Internal Name/)
  expect(hidden).toEqual(before)
})

test('a visible route descendant publishes as an independent branch with only its required host @pure', () => {
  const { workspace, route, root, occupant, orbit } = workspaceWithRouteObjects()
  for (const system of workspace.cluster.systems) system.publication = 'hidden'
  workspace.layout.systemFrames = Object.fromEntries(workspace.cluster.systems.map(system => [
    system.id, { left: 20, right: 20, top: 20, bottom: 20 },
  ]))
  const withSharedField = addCustomFieldDefinition(workspace, 'Reading', 'text', [], true)
  const campaign = addCustomFieldDefinition(withSharedField, 'Origin', 'text', [], true)
  const [shared, masked] = campaign.objectFieldSettings.customFields
  campaign.cluster.routeContents[route.id]!.objects = [
    { ...root, publication: 'hidden' },
    {
      ...occupant, publication: 'revealed', playerText: 'An echo aboard', playerFieldMasks: [masked!.id],
      customFieldValues: { [shared!.id]: 'Low', [masked!.id]: 'Secret origin' },
    },
  ]
  const document = projectPlayerCluster(campaign)
  expect(document.systems).toEqual([])
  expect(document.routes).toEqual([])
  expect(document.routeBranches).toEqual([
    {
      id: 'branch-1',
      anchor: { kind: 'detached', position: { x: expect.closeTo(313.36), y: expect.any(Number) } },
      map: {
        objects: [
          { id: 'object-1', position: { x: 0, y: 0 }, placement: { kind: 'branch-root' }, disclosure: 'unknown', label: 'Unknown presence' },
          {
            id: 'object-2', position: { x: expect.closeTo(0), y: expect.closeTo(18.4) },
            placement: { kind: 'orbit', orbitId: 'orbit-1', angle: 0 },
            disclosure: 'revealed', family: occupant.family, subtype: 'anomaly', label: 'Captured echo',
            playerText: 'An echo aboard', fields: [{ name: 'Reading', type: 'text', value: 'Low' }],
          },
        ],
        orbits: [{ id: 'orbit-1', hostId: 'object-1', center: { x: 0, y: 0 }, radii: { horizontal: expect.closeTo(18.4), vertical: 9 }, rotation: 90 }],
      },
    },
  ])
  const anchor = document.routeBranches[0]!.anchor
  if (anchor.kind !== 'detached') throw new Error('Expected detached branch geometry.')
  // A single lane's 32-unit control-point offset contributes 18 units at quarter progression.
  expect(Math.abs(anchor.position.y - 224.8)).toBeCloseTo(18)
  const text = serializePlayerJson(document)
  expect(parsePlayerJson(text)).toEqual(document)
  for (const secret of [route.id, root.id, orbit.id, occupant.id, root.name, root.description, root.playerText, 'Vesper', 'Aster', 'progression', 'Secret origin', shared!.id, masked!.id]) {
    expect(text).not.toContain(secret)
  }
  const withPrivateMetadata = structuredClone(campaign)
  withPrivateMetadata.cluster.routes[0]!.name = 'Secret detour'
  withPrivateMetadata.cluster.routes[0]!.jumpLevel = 6
  withPrivateMetadata.cluster.routes[0]!.playerShared = true
  withPrivateMetadata.cluster.routeContents[route.id]!.objects[0]!.playerText = 'Private note'
  expect(serializePlayerJson(projectPlayerCluster(withPrivateMetadata))).toBe(text)
})

test('a shared route publishes only admitted branch content and reorients progression for its public origin @pure', () => {
  const { workspace, route, root, occupant } = workspaceWithRouteObjects()
  workspace.cluster.routes[0]!.playerShared = true
  workspace.cluster.systems[0]!.publication = 'hidden'
  workspace.cluster.systems[1]!.publication = 'revealed'
  const branch = workspace.cluster.routeContents[route.id]!
  const atRoute = { kind: 'route', progression: 0.75 } as const
  branch.objects = [
    { ...root, publication: 'known-type' },
    { ...occupant, publication: 'unknown' },
    { ...root, id: 'private-cargo', name: 'Secret cargo', placement: atRoute, publication: 'hidden' },
  ]
  const document = projectPlayerCluster(workspace)
  expect(document.routes).toMatchObject([{
    id: 'route-1',
    fromSystemId: 'system-1',
    destination: { kind: 'unknown', label: 'Unknown destination' },
  }])
  expect(document.routeBranches.map(branch => branch.anchor)).toEqual([{ kind: 'route', routeId: 'route-1', progression: 0.75 }])
  expect(document.routeBranches[0]!.map.objects).toMatchObject([
    { label: 'Vessel', disclosure: 'known-type', subtype: 'vessel', markerColor: '#2299ff' },
    { label: 'Unknown presence', disclosure: 'unknown' },
  ])
  const json = serializePlayerJson(document)
  for (const secret of [root.name, root.playerText, occupant.name, 'Secret cargo', 'Vesper']) {
    expect(json).not.toContain(secret)
  }

  const publicCurve = continuousMapRouteCurve(
    { x: 100, y: 200 }, { x: 120, y: 200 }, { x: 140, y: 200 }, { x: 160, y: 200 },
  )
  const displayed = projectPlayerRouteBranch(document.routeBranches[0]!, new Map([['route-1', publicCurve]]))
  expect(displayed?.anchor).toEqual({ x: 145, y: 200 })
  expect(displayed?.orbits[0]?.center).toEqual(displayed?.anchor)
  expect(displayed?.objects[1]?.point.y).toBeCloseTo(218.4)

  const privateVariant = structuredClone(workspace)
  const variant = privateVariant.cluster.routeContents[route.id]!
  variant.orbits.push({ id: 'hidden-orbit', order: 1, hostId: 'private-cargo' })
  variant.objects.push({
    ...occupant, id: 'hidden-occupant', placement: { kind: 'orbit', orbitId: 'hidden-orbit' }, publication: 'hidden',
  })
  privateVariant.layout.orbitRadii['hidden-orbit'] = { horizontal: 80_000, vertical: 50_000 }
  privateVariant.layout.systemFrames = { [workspace.cluster.systems[0]!.id]: { left: 1024, right: 1024, top: 1024, bottom: 1024 } }
  const projectedVariant = projectPlayerCluster(privateVariant)
  expect(serializePlayerJson(projectedVariant)).toBe(json)
  expect(projectPlayerContinuousMap(projectedVariant).bounds).toEqual(projectPlayerContinuousMap(document).bounds)
})
