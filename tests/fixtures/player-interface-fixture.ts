import {
  createLocalWorkspace,
  defaultObjectFieldSettings,
  parsePlayerJson,
  projectPlayerCluster,
  serializePlayerJson,
} from '../../domain/workspace'
import type { PlayerClusterDocument, Point, SystemObject } from '../../domain/workspace'

/** Builds the shared public input for player interface regression scenarios. */
export function createPlayerInterfaceFixture(
  unoccupiedOrbitCenter: Point = { x: 0.8, y: 0.72 },
): { document: PlayerClusterDocument; json: string } {
  const workspace = createLocalWorkspace('PRIVATE_SOURCE_CLUSTER_NAME', 'PRIVATE_SOURCE_SYSTEM_NAME')
  const system = workspace.cluster.systems[0]!
  const star: SystemObject = {
    id: 'source-star',
    publication: 'revealed',
    family: 'CelestialBody',
    subtype: 'star',
    locationKey: 'PRIVATE_SOURCE_STAR_KEY',
    name: 'Public Star',
    description: 'PRIVATE_SOURCE_STAR_GM_NOTES',
    playerText: 'A bright star anchors the system.',
    playerFieldMasks: [],
    placement: { kind: 'system', x: 0.5, y: 0.5 },
  }
  const hiddenHost: SystemObject = {
    id: 'source-hidden-host',
    publication: 'hidden',
    family: 'Installation',
    subtype: 'station',
    locationKey: 'PRIVATE_SOURCE_HOST_KEY',
    name: 'PRIVATE_SOURCE_HOST_NAME',
    description: 'PRIVATE_SOURCE_HOST_GM_NOTES',
    playerText: '',
    playerFieldMasks: [],
    placement: { kind: 'system', x: 0.29, y: 0.35 },
  }
  const harborWorld: SystemObject = {
    id: 'source-harbor',
    publication: 'revealed',
    family: 'CelestialBody',
    subtype: 'planet',
    locationKey: 'PRIVATE_SOURCE_HARBOR_KEY',
    name: 'Harbor World',
    description: 'PRIVATE_SOURCE_HARBOR_GM_NOTES',
    playerText: 'A calm world with a sheltered landing basin.',
    playerFieldMasks: [],
    placement: { kind: 'orbit', orbitId: 'source-host-orbit' },
    atmosphere: 'Breathable',
    customFieldValues: {
      'field-survey-index': 0,
      'field-safe-route': false,
      'field-private-code': 'PRIVATE_SOURCE_FIELD_VALUE',
    },
  }
  const moon: SystemObject = {
    id: 'source-moon',
    publication: 'revealed',
    family: 'CelestialBody',
    subtype: 'moon',
    locationKey: 'PRIVATE_SOURCE_MOON_KEY',
    name: 'Quiet Moon',
    description: 'PRIVATE_SOURCE_MOON_GM_NOTES',
    playerText: 'Its horizon glows softly at night.',
    playerFieldMasks: [],
    placement: { kind: 'orbit', orbitId: 'source-harbor-orbit' },
  }
  const station: SystemObject = {
    id: 'source-station',
    publication: 'revealed',
    family: 'Installation',
    subtype: 'station',
    locationKey: 'PRIVATE_SOURCE_STATION_KEY',
    name: 'Public Station',
    description: 'PRIVATE_SOURCE_STATION_GM_NOTES',
    playerText: 'A quiet exchange station.',
    playerFieldMasks: [],
    placement: { kind: 'system', x: 0.73, y: 0.32 },
  }
  const gatePoint: SystemObject = {
    id: 'source-gate-point',
    publication: 'revealed',
    family: 'JumpPoint',
    subtype: 'jump-point',
    locationKey: 'PRIVATE_SOURCE_GATE_KEY',
    name: 'Gate Point',
    description: 'PRIVATE_SOURCE_GATE_GM_NOTES',
    playerText: 'A stable transit aperture.',
    playerFieldMasks: [],
    placement: { kind: 'system', x: 0.7, y: 0.68 },
    jumpStationId: station.id,
  }
  const outpost: SystemObject = {
    id: 'source-outpost',
    publication: 'known-type',
    family: 'Installation',
    subtype: 'base',
    locationKey: 'PRIVATE_SOURCE_OUTPOST_KEY',
    name: 'PRIVATE_SOURCE_OUTPOST_NAME',
    description: 'PRIVATE_SOURCE_OUTPOST_GM_NOTES',
    playerText: '',
    playerFieldMasks: [],
    placement: { kind: 'orbit', orbitId: 'source-unoccupied-orbit' },
  }

  system.name = 'Public System'
  system.publication = 'revealed'
  system.objects = [star, hiddenHost, harborWorld, moon, station, gatePoint, outpost]
  system.orbits = [
    { id: 'source-host-orbit', hostId: hiddenHost.id, order: 1 },
    { id: 'source-harbor-orbit', hostId: harborWorld.id, order: 1 },
    { id: 'source-unoccupied-orbit', hostId: null, center: unoccupiedOrbitCenter, order: 1 },
  ]
  workspace.cluster.name = 'PRIVATE_SOURCE_CLUSTER_NAME'
  workspace.cluster.playerTitle = 'Interface Reach'
  workspace.objectFieldSettings = {
    ...defaultObjectFieldSettings(),
    nativePlayerSharing: { atmosphere: true, portClass: false },
    customFields: [
      { id: 'field-survey-index', name: 'Survey index', type: 'number', playerShared: true },
      { id: 'field-safe-route', name: 'Safe route', type: 'boolean', playerShared: true },
      {
        id: 'field-private-code',
        name: 'PRIVATE_SOURCE_FIELD_NAME',
        type: 'text',
        playerShared: false,
      },
    ],
  }
  workspace.layout.orbitRadii = {
    'source-host-orbit': { horizontal: 150, vertical: 112 },
    'source-harbor-orbit': { horizontal: 56, vertical: 42 },
    'source-unoccupied-orbit': { horizontal: 72, vertical: 72 },
  }
  workspace.layout.objectAngles = {
    [harborWorld.id]: 0.7,
    [moon.id]: 2.2,
    [outpost.id]: 4.1,
  }

  const projected = projectPlayerCluster(workspace)
  const json = serializePlayerJson(projected)
  const privateSourceSentinels = [
    'PRIVATE_SOURCE_',
  ]
  if (privateSourceSentinels.some(sentinel => json.includes(sentinel))) {
    throw new Error('The player interface fixture exposed private source data.')
  }

  return { document: parsePlayerJson(json), json }
}
