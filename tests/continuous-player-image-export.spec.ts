import { expect, test } from './fixtures'
import type { PlayerClusterDocument, PlayerObjectMarker } from '../domain/player-projection'
import {
  addStarSystem,
  createJumpRoute,
  createLocalWorkspace,
  createSystemObject,
  isLocalWorkspace,
  parsePlayerJson,
  projectPlayerCluster,
  replaceWorkspaceSystem,
  updateChartDetails,
} from '../domain/workspace'
import { serializeContinuousPlayerMapImage } from '../utils/continuous-player-image-export'

function publicJumpPoint(label: string, x: number, y: number): PlayerObjectMarker {
  return {
    id: 'object-1',
    position: { x, y },
    placement: { kind: 'system' },
    disclosure: 'revealed',
    family: 'JumpPoint',
    subtype: 'jump-point',
    label,
    playerText: 'Inspector text is not painted',
    fields: [],
  }
}

function publicDocument(): PlayerClusterDocument {
  return {
    format: 'ttrpg-cluster-control-player',
    version: 2,
    title: 'Public <Reach>',
    systems: [
      {
        id: 'system-1',
        position: { x: 400, y: 200 },
        disclosure: 'revealed',
        type: 'star-system',
        label: 'River & Vale',
        map: {
          objects: [
            publicJumpPoint('Local <Gate>', 560, 480),
            {
              id: 'object-2',
              position: { x: 477.9422863405995, y: 325 },
              placement: { kind: 'orbit', orbitId: 'orbit-1', angle: 0 },
              disclosure: 'unknown',
              label: 'Unknown presence',
            },
          ],
          orbits: [{ id: 'orbit-1', hostId: null, center: { x: 400, y: 280 }, radii: { horizontal: 90, vertical: 40 }, rotation: 30 }],
        },
      },
      {
        id: 'system-2',
        position: { x: 2600, y: 500 },
        disclosure: 'revealed',
        type: 'star-system',
        label: 'Remote Reach',
        map: { objects: [publicJumpPoint('Remote Gate', 650, 360)], orbits: [] },
      },
      {
        id: 'system-3',
        position: { x: 1800, y: 460 },
        disclosure: 'unknown',
        label: 'Unknown presence',
      },
      {
        id: 'system-4',
        position: { x: 100, y: 450 },
        disclosure: 'revealed',
        type: 'star-system',
        label: 'Empty Reach',
        map: { objects: [], orbits: [] },
      },
    ],
    routes: [
      { id: 'route-1', jumpLevel: 2, fromSystemId: 'system-1', fromPointId: 'object-1', destination: { kind: 'system', systemId: 'system-2', pointId: 'object-1' } },
      { id: 'route-2', jumpLevel: 3, fromSystemId: 'system-2', destination: { kind: 'system', systemId: 'system-1', pointId: 'object-1' } },
      { id: 'route-3', jumpLevel: 4, fromSystemId: 'system-1', destination: { kind: 'unknown', position: { x: 3000, y: -170 }, label: 'Unknown destination' } },
    ],
  }
}

test('the entire player image shows published system names and anchor routes, including the anonymous exit @pure', () => {
  const image = serializeContinuousPlayerMapImage(publicDocument(), { scope: 'cluster' }, 'print-light')

  expect(image.svg).toContain('Public &lt;Reach&gt;')
  expect(image.svg).toContain('River &amp; Vale')
  expect(image.svg).toContain('Empty Reach')
  expect(image.svg).toContain('Unknown destination')
  expect(image.svg).not.toContain('Unknown presence')
  expect(image.svg).not.toContain('Local &lt;Gate&gt;')
  expect(image.svg).not.toContain('Inspector text')
  expect(image.svg).toMatch(/d="M 400 200 C [^"]+ 2600 500"/)
  expect(image.svg).toMatch(/d="M 400 200 C [^"]+ 3000 -170"/)
  expect(image.width).toBeGreaterThan(2950)
})

test('a selected player system includes its full detail and bounded incoming and outgoing route segments @pure', () => {
  const image = serializeContinuousPlayerMapImage(
    publicDocument(),
    { scope: 'system', systemId: 'system-1' },
    'print-light',
  )

  expect(image.svg).toContain('Local &lt;Gate&gt;')
  expect(image.svg).toContain('River &amp; Vale')
  expect(image.svg).toContain('rotate(30 384 200)')
  expect(image.svg).not.toContain('Remote Reach')
  expect(image.svg).not.toContain('Remote Gate')
  expect(image.svg).not.toContain('Unknown destination')
  expect(image.svg).not.toContain('Inspector text')
  expect(image.svg.match(/class="cluster-route-line player-image-route-stub"/g)).toHaveLength(3)
  expect(image.svg.match(/d="M 416 240 C [^"]+"/g)).toHaveLength(2)
  expect(image.svg).toContain('stroke-dasharray="6 5"')
  expect(image.width).toBeLessThan(500)
})

test('the current player image uses its drawable crop and dims repeated public IDs only in the filtered system @pure', () => {
  const image = serializeContinuousPlayerMapImage(
    publicDocument(),
    {
      scope: 'viewport',
      snapshot: {
        camera: { x: -5, y: 10, k: 2 },
        drawable: { x: -16, y: 5, width: 6000, height: 1300 },
        nameViewport: { x: 150, y: 10, width: 5700, height: 1150 },
        svgPixelScale: .5,
        detailSystemIds: ['system-1', 'system-2'],
        dimmedObjects: { systemId: 'system-1', ids: ['object-1'] },
        selectedRouteId: null,
      },
    },
    'print-light',
  )

  expect(image.svg).toContain('viewBox="-16 5 6000 1300"')
  expect(image.svg).toContain('translate(-5 10) scale(2)')
  expect(image.svg).toMatch(/<g class="player-continuous-object"[^>]*opacity="\.14"[^>]*>.*?Local &lt;Gate&gt;<\/text><\/g>/)
  expect(image.svg).toMatch(/<g class="player-continuous-object" transform="translate\(2634 516\)">.*?Remote Gate<\/text><\/g>/)
  expect(image.svg).toMatch(/d="M 416 240 C [^"]+ 2634 516"/)
  expect(image.width).toBe(3000)
  expect(image.height).toBe(650)
})

test('a generic system image shows its public marker without a system envelope or interior @pure', () => {
  const image = serializeContinuousPlayerMapImage(
    publicDocument(),
    { scope: 'system', systemId: 'system-3' },
    'print-light',
  )

  expect(image.svg).toContain('r="18"')
  expect(image.svg).not.toContain('player-continuous-system-envelope')
  expect(image.svg).not.toContain('player-continuous-system-detail')
  expect(image.svg).not.toContain('River &amp; Vale')
  expect(image.width).toBeLessThan(250)
})

test('a legacy share exports only the retained route and never infers an attachment @pure', () => {
  const current = publicDocument()
  const restored = parsePlayerJson(JSON.stringify({
    ...current,
    version: 1,
    routes: [
      current.routes[0],
      { id: 'route-4', jumpLevel: 9, fromSystemId: 'system-1', destination: { kind: 'system', systemId: 'system-1' } },
    ],
  }))
  const scope = { scope: 'system', systemId: 'system-1' } as const
  const legacyImage = serializeContinuousPlayerMapImage(restored, scope, 'print-light')
  const currentImage = serializeContinuousPlayerMapImage(current, scope, 'print-light')

  expect(legacyImage.svg).toContain('Local &lt;Gate&gt;')
  expect(legacyImage.svg).toMatch(/d="M 400 200 C [^"]+"/)
  expect(legacyImage.svg.match(/player-image-route-stub/g)).toHaveLength(1)
  expect(legacyImage.svg).not.toContain('d="M 416 240')
  expect(currentImage.svg).toContain('d="M 416 240')
})

test('moving unrelated private extents leaves all three public images unchanged @pure', () => {
  const base = createLocalWorkspace('Private cluster name', 'Published System')
  const local = base.cluster.systems[0]!
  const secretPoint = { ...createSystemObject(local, 'jump-point'), name: 'PRIVATE GATE', publication: 'hidden' as const }
  const disclosed = replaceWorkspaceSystem(base, { ...local, publication: 'revealed', objects: [...local.objects, secretPoint] })
  const added = addStarSystem(disclosed, 'PRIVATE SYSTEM')
  const hidden = updateChartDetails(added.workspace, added.system.id, {
    clusterName: base.cluster.name,
    systemName: added.system.name,
    playerTitle: 'Published Reach',
    publication: 'hidden',
  })
  const route = createJumpRoute(hidden.cluster, {
    fromSystemId: local.id,
    fromPointId: secretPoint.id,
    toSystemId: null,
    toPointId: null,
    unresolvedExit: 'PRIVATE EXIT LABEL',
    jumpLevel: 4,
    playerShared: true,
  })
  hidden.cluster.routes = [route]
  hidden.layout.unresolvedExitPositions = { [route.id]: { x: 1.24, y: -.4 } }
  const distant = structuredClone(hidden)
  distant.layout.systemPositions[added.system.id] = { x: -500, y: 700 }
  const distantSecret = distant.cluster.systems[0]!.objects.find(object => object.id === secretPoint.id)!
  distantSecret.placement = { kind: 'system', x: 300, y: -600 }
  expect(isLocalWorkspace(hidden)).toBe(true)
  expect(isLocalWorkspace(distant)).toBe(true)

  const first = projectPlayerCluster(hidden)
  const second = projectPlayerCluster(distant)
  const localId = first.systems[0]!.id
  expect(first.routes[0]?.destination).toMatchObject({ kind: 'unknown', label: 'Unknown destination' })
  expect(first.routes[0]?.fromPointId).toBeUndefined()

  const drawable = { x: -100, y: -1000, width: 1500, height: 1800 }
  const scopes = [
    { scope: 'cluster' },
    { scope: 'system', systemId: localId },
    {
      scope: 'viewport',
      snapshot: {
        camera: { x: 0, y: 0, k: 1 }, drawable, nameViewport: drawable, svgPixelScale: 1,
        detailSystemIds: [localId], dimmedObjects: null, selectedRouteId: null,
      },
    },
  ] as const
  for (const scope of scopes) {
    const firstImage = serializeContinuousPlayerMapImage(first, scope, 'print-light')
    expect(serializeContinuousPlayerMapImage(second, scope, 'print-light')).toEqual(firstImage)
    expect(firstImage.svg).not.toMatch(/PRIVATE|private cluster name/)
  }
})
