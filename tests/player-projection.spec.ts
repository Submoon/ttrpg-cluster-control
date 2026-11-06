import { expect, test } from './fixtures'
import {
  addStarSystem,
  createLocalWorkspace,
  replaceWorkspaceSystem,
  updateChartDetails,
} from '../domain/workspace'
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
  const withRevealed = addStarSystem(withKnown.workspace, 'Revealed Name')
  workspace = withRevealed.workspace
  workspace = setPublication(workspace, hiddenId, 'hidden')
  workspace = setPublication(workspace, withUnknown.system.id, 'unknown')
  workspace = setPublication(workspace, withKnown.system.id, 'known-type')
  workspace = setPublication(workspace, withRevealed.system.id, 'revealed')

  const document = projectPlayerCluster(workspace)

  expect(document).toMatchObject({
    format: 'ttrpg-cluster-control-player',
    version: 1,
    title: 'Player Jump Cluster',
    systems: [
      { id: 'system-1', disclosure: 'unknown', label: 'Unknown presence' },
      { id: 'system-2', disclosure: 'known-type', type: 'star-system', label: 'Star system' },
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
  const extended = {
    ...hidden,
    privateExtension: 'UNKNOWN WORKSPACE PROPERTY',
    cluster: {
      ...hidden.cluster,
      privateExtension: 'UNKNOWN CLUSTER PROPERTY',
      name: 'Changed Private Cluster Name',
      routes: [{ id: 'SECRET ROUTE ID', name: 'SECRET ROUTE NAME', jumpLevel: 1, playerShared: false, fromPointId: 'SECRET POINT', toPointId: null, unresolvedExit: 'SECRET EXIT' }],
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
  expect(projected.systems).toHaveLength(1)
  expect(projected.systems[0]?.id).toBe('system-1')
  expect(JSON.stringify(projected)).not.toMatch(/SECRET|UNKNOWN|Far Hidden System|Secret Internal Name/)
  expect(hidden).toEqual(before)
})
