import { expect, test } from './fixtures'
import { createLocalWorkspace, updateChartDetails } from '../domain/workspace'
import type { LocalWorkspace, Orbit, StarSystem, SystemObject } from '../domain/workspace'
import { projectPlayerCluster } from '../domain/player-projection'

function object(
  id: string,
  publication: SystemObject['publication'],
  placement: SystemObject['placement'],
  overrides: Partial<SystemObject> = {},
): SystemObject {
  return {
    id,
    publication,
    family: 'CelestialBody',
    subtype: 'planet',
    locationKey: `PRIVATE-${id}`,
    name: `PRIVATE NAME ${id}`,
    description: `PRIVATE DESCRIPTION ${id}`,
    playerText: '',
    playerFieldMasks: [],
    placement,
    ...overrides,
  }
}

function withSystem(workspace: LocalWorkspace, system: StarSystem): LocalWorkspace {
  return {
    ...workspace,
    cluster: {
      ...workspace.cluster,
      systems: [system],
    },
  }
}

test('object disclosure modes are allowlisted and remain saved when the system gate changes @pure', () => {
  const workspace = createLocalWorkspace('PRIVATE CLUSTER NAME', 'Revealed System')
  const primary = workspace.cluster.systems[0]!.objects[0]!
  const star: SystemObject = { ...primary, publication: 'hidden' }
  const station = object('SECRET-STATION-ID', 'hidden', { kind: 'system', x: 0.9, y: 0.8 }, {
    family: 'Installation',
    subtype: 'station',
    name: 'SECRET STATION NAME',
  })
  const unknown = {
    ...object('SECRET-UNKNOWN-ID', 'unknown', { kind: 'system', x: 0.2, y: 0.2 }, {
      family: 'Vessel',
      subtype: 'vessel',
      locationKey: 'SECRET-UNKNOWN-KEY',
      name: 'SECRET UNKNOWN NAME',
      description: 'SECRET UNKNOWN DESCRIPTION',
      customFieldValues: { 'SECRET-FIELD-ID': 'SECRET FIELD VALUE' },
    }),
    privateExtension: 'SECRET UNKNOWN EXTENSION',
  }
  const known = object('SECRET-KNOWN-ID', 'known-type', { kind: 'system', x: 0.4, y: 0.3 }, {
    family: 'CelestialBody',
    subtype: 'moon',
    locationKey: 'SECRET-KNOWN-KEY',
    name: 'SECRET KNOWN NAME',
    description: 'SECRET KNOWN DESCRIPTION',
  })
  const revealed = object('SECRET-REVEALED-ID', 'revealed', { kind: 'system', x: 0.6, y: 0.4 }, {
    family: 'JumpPoint',
    subtype: 'jump-point',
    locationKey: 'SECRET-REVEALED-KEY',
    name: 'Public Jump Point',
    description: 'SECRET REVEALED DESCRIPTION',
    jumpStationId: station.id,
  })
  const hidden = object('SECRET-HIDDEN-ID', 'hidden', { kind: 'system', x: 0.8, y: 0.6 }, {
    family: 'Phenomenon',
    subtype: 'anomaly',
    name: 'SECRET HIDDEN NAME',
  })
  const system: StarSystem = {
    ...workspace.cluster.systems[0]!,
    publication: 'known-type',
    objects: [star, unknown, known, revealed, hidden, station],
  }
  const source = withSystem(workspace, system)
  const sourceModes = system.objects.map(candidate => candidate.publication)
  const gated = updateChartDetails(source, system.id, {
    clusterName: source.cluster.name,
    systemName: system.name,
    playerTitle: source.cluster.playerTitle,
    publication: 'unknown',
  })
  expect(projectPlayerCluster(gated).systems[0]).not.toHaveProperty('map')

  const revealedParent = updateChartDetails(gated, system.id, {
    clusterName: gated.cluster.name,
    systemName: system.name,
    playerTitle: gated.cluster.playerTitle,
    publication: 'revealed',
  })
  expect(revealedParent.cluster.systems[0]?.objects.map(candidate => candidate.publication)).toEqual(sourceModes)
  const projected = projectPlayerCluster(revealedParent)
  const marker = projected.systems[0]
  if (!marker || marker.disclosure !== 'revealed') throw new Error('Expected a revealed system marker.')
  expect(marker.map.objects).toHaveLength(3)
  expect(marker.map.objects.map(candidate => candidate.disclosure)).toEqual([
    'unknown', 'known-type', 'revealed',
  ])
  expect(marker.map.objects[0]).not.toHaveProperty('family')
  expect(marker.map.objects[0]).not.toHaveProperty('subtype')
  expect(marker.map.objects[0]).toMatchObject({ label: 'Unknown presence' })
  expect(marker.map.objects[1]).toMatchObject({
    disclosure: 'known-type',
    family: 'CelestialBody',
    subtype: 'moon',
    label: 'Moon',
  })
  expect(marker.map.objects[1]).not.toHaveProperty('name')
  expect(marker.map.objects[2]).toMatchObject({
    disclosure: 'revealed',
    family: 'JumpPoint',
    subtype: 'jump-point',
    label: 'Public Jump Point',
  })
  const json = JSON.stringify(projected)
  expect(json).toContain('Public Jump Point')
  expect(json).not.toMatch(/SECRET|PRIVATE/)
})

test('published objects retain full-source default geometry and only their required host chain @pure', () => {
  const workspace = createLocalWorkspace('Private Cluster', 'Revealed System')
  const primary = workspace.cluster.systems[0]!.objects[0]!
  const star: SystemObject = {
    ...primary,
    id: 'SECRET-STAR-ID',
    publication: 'hidden',
    name: 'SECRET STAR NAME',
    locationKey: 'SECRET STAR KEY',
  }
  const siblingOrbit = (id: string, order: number, hostId = star.id): Orbit => ({ id, order, hostId })
  const publicOrbit = siblingOrbit('SECRET-PUBLIC-ORBIT-ID', 3)
  const unrelatedOrbit = siblingOrbit('SECRET-UNRELATED-ORBIT-ID', 1, 'SECRET-UNRELATED-HOST')
  const system: StarSystem = {
    ...workspace.cluster.systems[0]!,
    publication: 'revealed',
    objects: [
      star,
      object('SECRET-HIDDEN-FIRST-ID', 'hidden', { kind: 'orbit', orbitId: publicOrbit.id }),
      object('SECRET-PUBLIC-ID', 'known-type', { kind: 'orbit', orbitId: publicOrbit.id }, {
        name: 'SECRET PUBLIC SOURCE NAME',
      }),
      object('SECRET-HIDDEN-THIRD-ID', 'hidden', { kind: 'orbit', orbitId: publicOrbit.id }),
      object('SECRET-HIDDEN-FOURTH-ID', 'hidden', { kind: 'orbit', orbitId: publicOrbit.id }),
      object('SECRET-UNRELATED-HOST', 'hidden', { kind: 'system', x: 0.1, y: 0.1 }),
      object('SECRET-UNRELATED-CHILD', 'hidden', { kind: 'orbit', orbitId: unrelatedOrbit.id }),
    ],
    orbits: [
      siblingOrbit('SECRET-EMPTY-ORBIT-ONE', 1),
      siblingOrbit('SECRET-EMPTY-ORBIT-TWO', 2),
      publicOrbit,
      unrelatedOrbit,
    ],
  }
  const source = withSystem(workspace, system)
  const before = structuredClone(source)

  const projected = projectPlayerCluster(source)
  const map = projected.systems[0]!.disclosure === 'revealed'
    ? projected.systems[0]!.map
    : null

  expect(map).not.toBeNull()
  expect(map?.objects.map(marker => marker.id)).toEqual(['object-1', 'object-2'])
  expect(map?.objects[0]).toMatchObject({
    id: 'object-1',
    position: { x: 480, y: 280 },
    placement: { kind: 'system' },
    disclosure: 'unknown',
    label: 'Unknown presence',
  })
  expect(map?.objects[0]).not.toHaveProperty('family')
  expect(map?.objects[0]).not.toHaveProperty('subtype')
  expect(map?.objects[0]).not.toHaveProperty('name')
  expect(map?.objects[1]).toMatchObject({
    id: 'object-2',
    position: { x: 708, y: 280 },
    placement: { kind: 'orbit', orbitId: 'orbit-1', angle: 0 },
    disclosure: 'known-type',
    family: 'CelestialBody',
    subtype: 'planet',
    label: 'Planet',
  })
  expect(map?.orbits).toEqual([{
    id: 'orbit-1',
    hostId: 'object-1',
    center: { x: 480, y: 280 },
    radii: { horizontal: 228, vertical: 228 },
    rotation: 0,
  }])
  const json = JSON.stringify(projected)
  expect(json).not.toMatch(/SECRET|PRIVATE/)
  expect(json).not.toContain('order')

  if (!map) throw new Error('Revealed system projection is missing its map.')
  map.objects[0]!.position.x = -10
  map.orbits[0]!.center.y = -20
  map.orbits[0]!.radii.horizontal = -30
  expect(source).toEqual(before)
})

test('nested hidden hosts retain rotated parent and default child Orbit geometry @pure', () => {
  const workspace = createLocalWorkspace('Private Cluster', 'Revealed System')
  const primary = workspace.cluster.systems[0]!.objects[0]!
  const star: SystemObject = {
    ...primary,
    id: 'SECRET-ROOT-ID',
    publication: 'hidden',
    name: 'SECRET ROOT STAR',
  }
  const outer: Orbit = { id: 'SECRET-OUTER-ORBIT', order: 1, hostId: star.id }
  const planetId = 'SECRET-HIDDEN-PLANET-ID'
  const planet = object(planetId, 'hidden', { kind: 'orbit', orbitId: outer.id }, {
    family: 'CelestialBody',
    subtype: 'planet',
    name: 'SECRET HIDDEN PLANET',
  })
  const childOrbit: Orbit = { id: 'SECRET-CHILD-ORBIT', order: 2, hostId: planetId }
  const emptySibling: Orbit = {
    id: 'SECRET-EMPTY-CHILD-ORBIT',
    order: 1,
    hostId: planetId,
  }
  const child: StarSystem = {
    ...workspace.cluster.systems[0]!,
    publication: 'revealed',
    objects: [
      star,
      planet,
      object('SECRET-CHILD-SIBLING-ID', 'hidden', { kind: 'orbit', orbitId: childOrbit.id }),
      object('SECRET-PUBLIC-MOON-ID', 'revealed', { kind: 'orbit', orbitId: childOrbit.id }, {
        family: 'CelestialBody',
        subtype: 'moon',
        name: 'Published Moon',
      }),
    ],
    orbits: [outer, emptySibling, childOrbit],
  }
  const source = withSystem(workspace, child)
  source.layout.orbitRadii[outer.id] = { horizontal: 200, vertical: 100 }
  source.layout.orbitRotations[outer.id] = 90
  source.layout.objectAngles[planetId] = 0

  const projected = projectPlayerCluster(source)
  const map = projected.systems[0]!.disclosure === 'revealed'
    ? projected.systems[0]!.map
    : null

  expect(map?.objects).toHaveLength(3)
  expect(map?.objects.map(marker => marker.disclosure)).toEqual(['unknown', 'unknown', 'revealed'])
  expect(map?.objects[1]).toMatchObject({
    position: { x: 480, y: 480 },
    placement: { kind: 'orbit', orbitId: 'orbit-1', angle: 0 },
    label: 'Unknown presence',
  })
  expect(map?.objects[2]).toMatchObject({
    id: 'object-3',
    position: { x: 480, y: 554 },
    placement: { kind: 'orbit', orbitId: 'orbit-2', angle: Math.PI / 2 },
    family: 'CelestialBody',
    subtype: 'moon',
    label: 'Published Moon',
  })
  expect(map?.orbits).toEqual([
    {
      id: 'orbit-1',
      hostId: 'object-1',
      center: { x: 480, y: 280 },
      radii: { horizontal: 200, vertical: 100 },
      rotation: 90,
    },
    {
      id: 'orbit-2',
      hostId: 'object-2',
      center: { x: 480, y: 480 },
      radii: { horizontal: 74, vertical: 74 },
      rotation: 0,
    },
  ])
  const json = JSON.stringify(projected)
  expect(json).not.toMatch(/SECRET/)
  expect(json).toContain('Published Moon')
})

test('an unoccupied Orbit center remains geometry without inventing a host @pure', () => {
  const workspace = createLocalWorkspace('Private Cluster', 'Revealed System')
  const primary = workspace.cluster.systems[0]!.objects[0]!
  const star: SystemObject = { ...primary, publication: 'hidden' }
  const emptyCenterOrbit: Orbit = {
    id: 'SECRET-EMPTY-CENTER-ORBIT',
    order: 1,
    hostId: null,
    center: { x: 0.75, y: 0.2 },
  }
  const occupiedCenterOrbit: Orbit = {
    id: 'SECRET-OCCUPIED-CENTER-ORBIT',
    order: 2,
    hostId: null,
    center: { x: 0.25, y: 0.75 },
  }
  const system: StarSystem = {
    ...workspace.cluster.systems[0]!,
    publication: 'revealed',
    objects: [
      star,
      object('SECRET-CENTER-OBJECT-ID', 'known-type', {
        kind: 'orbit',
        orbitId: occupiedCenterOrbit.id,
      }, {
        name: 'SECRET CENTER OBJECT NAME',
      }),
    ],
    orbits: [emptyCenterOrbit, occupiedCenterOrbit],
  }

  const projected = projectPlayerCluster(withSystem(workspace, system))
  const map = projected.systems[0]!.disclosure === 'revealed'
    ? projected.systems[0]!.map
    : null

  expect(map?.objects).toHaveLength(1)
  expect(map?.objects[0]).toMatchObject({
    id: 'object-1',
    position: { x: 272, y: 214 },
    placement: { kind: 'orbit', orbitId: 'orbit-1', angle: -Math.PI / 2 },
    disclosure: 'known-type',
    family: 'CelestialBody',
    subtype: 'planet',
    label: 'Planet',
  })
  expect(map?.orbits).toEqual([{
    id: 'orbit-1',
    hostId: null,
    center: { x: 272, y: 384 },
    radii: { horizontal: 170, vertical: 170 },
    rotation: 0,
  }])
})

test('shared required hosts appear once and keep their saved disclosure @pure', () => {
  const workspace = createLocalWorkspace('Private Cluster', 'Revealed System')
  const primary = workspace.cluster.systems[0]!.objects[0]!
  const star: SystemObject = { ...primary, id: 'SECRET-ROOT-ID', publication: 'hidden' }
  const outer: Orbit = { id: 'SECRET-OUTER-ID', hostId: star.id, order: 1 }
  const host = object('SECRET-SHARED-HOST-ID', 'known-type', {
    kind: 'orbit',
    orbitId: outer.id,
  }, {
    family: 'CelestialBody',
    subtype: 'planet',
    name: 'SECRET SHARED HOST NAME',
  })
  const firstOrbit: Orbit = { id: 'SECRET-FIRST-CHILD-ORBIT', hostId: host.id, order: 1 }
  const secondOrbit: Orbit = { id: 'SECRET-SECOND-CHILD-ORBIT', hostId: host.id, order: 2 }
  const system: StarSystem = {
    ...workspace.cluster.systems[0]!,
    publication: 'revealed',
    objects: [
      star,
      host,
      object('SECRET-FIRST-PUBLISHED-ID', 'known-type', { kind: 'orbit', orbitId: firstOrbit.id }),
      object('SECRET-SECOND-PUBLISHED-ID', 'revealed', { kind: 'orbit', orbitId: secondOrbit.id }, {
        name: 'Published Satellite',
      }),
    ],
    orbits: [outer, firstOrbit, secondOrbit],
  }

  const projected = projectPlayerCluster(withSystem(workspace, system))
  const map = projected.systems[0]!.disclosure === 'revealed'
    ? projected.systems[0]!.map
    : null

  expect(map?.objects.map(marker => marker.id)).toEqual([
    'object-1', 'object-2', 'object-3', 'object-4',
  ])
  expect(map?.objects.filter(marker => marker.disclosure === 'unknown')).toHaveLength(1)
  expect(map?.objects[1]).toMatchObject({
    disclosure: 'known-type',
    family: 'CelestialBody',
    subtype: 'planet',
    label: 'Planet',
  })
  expect(map?.orbits.map(orbit => orbit.id)).toEqual(['orbit-1', 'orbit-2', 'orbit-3'])
  expect(map?.orbits.map(orbit => orbit.hostId)).toEqual(['object-1', 'object-2', 'object-2'])
  expect(JSON.stringify(map)).not.toContain('SECRET')
})
