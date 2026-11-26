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
import { serializeContinuousPlayerMapImage, type PlayerImageViewportSnapshot } from '../utils/continuous-player-image-export'
import { workspaceWithRouteObjects } from './support/route-objects-fixture'

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
    version: 3,
    routeBranches: [],
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

test('the entire player image shows published names, attached routes and the anonymous exit @pure', () => {
  const image = serializeContinuousPlayerMapImage(publicDocument(), { scope: 'cluster' }, 'print-light')

  expect(image.svg).toContain('Public &lt;Reach&gt;')
  expect(image.svg).toContain('River &amp; Vale')
  expect(image.svg).toContain('Empty Reach')
  expect(image.svg).toContain('Unknown destination')
  expect(image.svg).not.toContain('Unknown presence')
  expect(image.svg).not.toContain('Local &lt;Gate&gt;')
  expect(image.svg).not.toContain('Inspector text')
  // Overview routes meet the public frames' east and west edges.
  expect(image.svg).toMatch(/d="M 479\.2\d* 210\.8 C [^"]+ 2562 494\.818\d*"/)
  // The anonymous route has no local point and starts at the public frame's east edge (x = 479.2).
  expect(image.svg).toMatch(/d="M 479\.2\d* [^"]+ 3000 -170"/)
  expect(image.width).toBeGreaterThan(2950)
})

test('an anonymous exit remains above a coincident public anchor in overview and viewport images @pure', () => {
  const document = publicDocument()
  const route = document.routes[2]
  if (route?.destination.kind !== 'unknown') throw new Error('The fixture has no anonymous exit.')
  route.destination.position = { x: 2600, y: 500 }
  const drawable = { x: 0, y: 0, width: 3000, height: 800 }
  const scopes = [
    { scope: 'cluster' },
    {
      scope: 'viewport',
      snapshot: {
        camera: { x: 0, y: 0, k: 1 }, drawable, nameViewport: drawable, svgPixelScale: 1,
        detailSystemIds: ['system-2'], dimmedObjects: null, selectedRouteId: null,
      },
    },
  ] as const

  for (const scope of scopes) {
    const { svg } = serializeContinuousPlayerMapImage(document, scope, 'print-light')
    const routeIndex = svg.search(/d="M 479\.2\d* [^"]+ 2600 500"/)
    const anchorIndex = svg.lastIndexOf('class="player-continuous-system"')
    const captionIndex = svg.indexOf('Unknown destination')
    expect(routeIndex).toBeGreaterThanOrEqual(0)
    expect(routeIndex).toBeLessThan(anchorIndex)
    expect(captionIndex).toBeGreaterThan(anchorIndex)
    expect(svg).toMatch(/transform="translate\(2600 500\) scale\(1\)">[^<]*<text[^>]*>Unknown destination<\/text><circle r="7"/)
  }
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
  expect(image.svg).not.toContain('player-continuous-system-envelope')
  expect(image.svg).not.toContain('translate(400 200) scale(')
  const nameTextIndex = image.svg.indexOf('River &amp; Vale</text>')
  const nameGroupStart = image.svg.lastIndexOf('<g transform="translate(', nameTextIndex)
  const nameGroup = image.svg.slice(nameGroupStart, nameTextIndex)
  const nameX = Number(nameGroup.match(/translate\(([-\d.]+) /)?.[1])
  const nameY = Number(nameGroup.match(/translate\([^ ]+ ([^)]+)\)/)?.[1])
  expect(nameX).toBeGreaterThan(400)
  expect(nameY).toBeLessThan(180)
  expect(nameGroup).not.toContain('<line ')
  expect(image.svg).toContain('Jump-2')
  expect(image.svg).toContain('Jump-3')
  expect(image.svg).toContain('Remote Reach')
  expect(image.svg).not.toContain('Remote Gate')
  expect(image.svg).not.toContain('Unknown destination')
  expect(image.svg).not.toContain('Inspector text')
  expect(image.svg.match(/class="cluster-route-line player-image-route-stub"/g)).toHaveLength(3)
  expect(image.svg.match(/class="player-image-system-route-caption"/g)).toHaveLength(3)
  expect(image.svg.match(/d="M 416 240 C [^"]+"/g)).toHaveLength(2)
  expect(image.svg).toContain('stroke-dasharray="6 5"')
  const viewBox = image.svg.match(/viewBox="([^"]+)"/)?.[1]
  if (!viewBox) throw new Error('The selected player image has no viewBox.')
  const [viewX, viewY, viewWidth, viewHeight] = viewBox.split(/\s+/).map(Number)
  const captionBounds: Array<{ x: number; y: number; width: number; height: number }> = []
  for (const [, centerX, centerY, body] of image.svg.matchAll(/<g class="player-image-system-route-caption" transform="translate\(([-\d.]+) ([-\d.]+)\)">([\s\S]*?)<\/g>/gu)) {
    const rect = body?.match(/<rect[^>]*x="([-\d.]+)"[^>]*y="([-\d.]+)"[^>]*width="([-\d.]+)"[^>]*height="([-\d.]+)"/)
    if (!centerX || !centerY || !rect) throw new Error('The selected player route caption has no measurable bounds.')
    const x = Number(centerX) + Number(rect[1])
    const y = Number(centerY) + Number(rect[2])
    const width = Number(rect[3])
    const height = Number(rect[4])
    captionBounds.push({ x, y, width, height })
    expect(x).toBeGreaterThanOrEqual(viewX!)
    expect(y).toBeGreaterThanOrEqual(viewY!)
    expect(x + width).toBeLessThanOrEqual(viewX! + viewWidth!)
    expect(y + height).toBeLessThanOrEqual(viewY! + viewHeight!)
  }
  const nameTransform = nameGroup.match(/transform="translate\(([-\d.]+) ([-\d.]+)\)"/)
  const nameRectAttributes = nameGroup.match(/<rect([^>]*)>/)?.[1]
  const nameAttribute = (attribute: string) => nameRectAttributes?.match(new RegExp(`${attribute}="([-\\d.]+)"`))?.[1]
  if (!nameTransform || !nameRectAttributes || !nameAttribute('x') || !nameAttribute('width') || !nameAttribute('height')) {
    throw new Error('The selected player title has no measurable bounds.')
  }
  const title = {
    x: Number(nameTransform[1]) + Number(nameAttribute('x')),
    y: Number(nameTransform[2]) + Number(nameAttribute('y') ?? 0),
    width: Number(nameAttribute('width')),
    height: Number(nameAttribute('height')),
  }
  for (const caption of captionBounds) {
    const overlapsTitle = caption.x < title.x + title.width && caption.x + caption.width > title.x
      && caption.y < title.y + title.height && caption.y + caption.height > title.y
    expect(overlapsTitle).toBe(false)
  }
  expect(image.width).toBeLessThan(500)
})

test('a selected player route reveals a destination name only for a Revealed opposite system @pure', () => {
  const document = publicDocument()
  document.systems[1] = {
    id: 'system-2',
    position: { x: 2600, y: 500 },
    disclosure: 'known-type',
    type: 'star-system',
    label: 'Zone',
  }
  const image = serializeContinuousPlayerMapImage(
    document,
    { scope: 'system', systemId: 'system-1' },
    'print-light',
  )

  expect(image.svg).toContain('Jump-2')
  expect(image.svg).toContain('Jump-3')
  expect(image.svg).not.toContain('Zone')
  expect(image.svg).not.toContain('Remote Reach')
  expect(image.svg).not.toContain('Remote Gate')
  expect(image.svg).not.toContain('Unknown destination')
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

test('Selected system rejects marker-only disclosure instead of exporting a name-only marker image @pure', () => {
  const document = publicDocument()
  document.systems[2] = {
    id: 'system-3',
    position: { x: 1800, y: 460 },
    disclosure: 'known-type',
    type: 'star-system',
    label: 'Zone',
  }

  expect(() => serializeContinuousPlayerMapImage(
    document,
    { scope: 'system', systemId: 'system-3' },
    'print-light',
  )).toThrow('Select a Revealed public Zone')
})

test('a Revealed empty system frames its published name without the cluster anchor @pure', () => {
  const image = serializeContinuousPlayerMapImage(
    publicDocument(),
    { scope: 'system', systemId: 'system-4' },
    'print-light',
  )

  expect(image.svg).toContain('Empty Reach')
  expect(image.svg).not.toContain('player-continuous-system-envelope')
  expect(image.svg).not.toContain('translate(100 450) scale(')
  expect(image.width).toBeLessThan(300)
})

test('a legacy share exports only the retained route and never infers an attachment @pure', () => {
  const current = publicDocument()
  const restored = parsePlayerJson(JSON.stringify({
    ...current,
    routeBranches: undefined,
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
  expect(legacyImage.svg).toMatch(/d="M 479\.2\d* [^"]+"/)
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


test('a detached player branch supplies Cluster bounds at overview detail without private route context @pure', () => {
  const { workspace, route, root, occupant, orbit } = workspaceWithRouteObjects()
  workspace.cluster.systems.forEach(zone => { zone.publication = 'hidden' })
  root.publication = 'revealed'
  occupant.publication = 'revealed'
  const document = projectPlayerCluster(workspace)
  const branch = document.routeBranches[0]!
  if (branch.anchor.kind !== 'detached') throw new Error('Expected a detached public branch.')

  const image = serializeContinuousPlayerMapImage(document, { scope: 'cluster' }, 'print-light')
  const { x, y } = branch.anchor.position
  expect(image.svg).toContain(`translate(${x} ${y}) scale(1)`)
  expect(image.svg).toContain(root.name)
  expect(image.svg).not.toContain(root.playerText)
  expect(image.svg).not.toContain(root.description)
  expect(image.svg).not.toContain(occupant.name)
  expect(image.svg).not.toContain(route.id)
  expect(image.svg).not.toContain(orbit.id)
  expect(image.svg).not.toMatch(/Vesper|Aster|Jump-3|Unknown destination/)
  expect(image.width).toBeLessThan(100)
  expect(image.height).toBeLessThan(100)

  occupant.publication = 'hidden'
  const publicRootOnly = serializeContinuousPlayerMapImage(projectPlayerCluster(workspace), { scope: 'cluster' }, 'print-light')
  workspace.layout.orbitRadii[orbit.id] = { horizontal: 9000, vertical: 4500 }
  const distantHiddenBranch = serializeContinuousPlayerMapImage(projectPlayerCluster(workspace), { scope: 'cluster' }, 'print-light')
  expect(distantHiddenBranch).toEqual(publicRootOnly)
})


test('an attached route object follows the exported public curve and stays outside a selected Zone image @pure', () => {
  const { workspace, root } = workspaceWithRouteObjects()
  root.publication = 'revealed'
  const branch = projectPlayerCluster(workspace).routeBranches[0]!
  const document = publicDocument()
  document.routes = [document.routes[0]!]
  const systemScope = { scope: 'system', systemId: 'system-1' } as const
  const selectedZone = serializeContinuousPlayerMapImage(document, systemScope, 'print-light')
  document.routeBranches = [{
    ...branch,
    anchor: { kind: 'route', routeId: document.routes[0]!.id, progression: .25 },
  }]
  const drawable = { x: 0, y: 0, width: 3100, height: 900 }
  const scopes = [
    { scope: 'cluster' },
    {
      scope: 'viewport',
      snapshot: {
        camera: { x: 0, y: 0, k: 1 }, drawable, nameViewport: drawable, svgPixelScale: 1,
        detailSystemIds: ['system-1'], dimmedObjects: null, selectedRouteId: null,
      },
    },
  ] as const
  const markerPositions = scopes.map((scope) => {
    const { svg } = serializeContinuousPlayerMapImage(document, scope, 'print-light')
    const route = svg.match(/class="cluster-route-line" d="M ([^"]+)"/)?.[1]?.replace('C ', '').split(' ').map(Number)
    const marker = svg.match(/class="player-branch-marker" transform="translate\(([^ ]+) ([^)]+)\)/)
    if (!route || !marker) throw new Error('The SVG is missing the public route or its attached marker.')
    const [startX, startY, controlX1, controlY1, controlX2, controlY2, endX, endY] = route as [
      number, number, number, number, number, number, number, number,
    ]
    // The explicit Bernstein weights at one quarter of the SVG cubic.
    expect(Number(marker[1])).toBeCloseTo((27 * startX + 27 * controlX1 + 9 * controlX2 + endX) / 64, 6)
    expect(Number(marker[2])).toBeCloseTo((27 * startY + 27 * controlY1 + 9 * controlY2 + endY) / 64, 6)
    return [Number(marker[1]), Number(marker[2])]
  })
  expect(markerPositions[0]).not.toEqual(markerPositions[1])
  expect(serializeContinuousPlayerMapImage(document, systemScope, 'print-light')).toEqual(selectedZone)
})

test('a player viewport keeps branch selection and dimming local and renders ordinary Orbit detail at readable zoom @pure', () => {
  const { workspace, root, occupant } = workspaceWithRouteObjects()
  workspace.cluster.systems.forEach(zone => { zone.publication = 'hidden' })
  root.publication = 'revealed'
  occupant.publication = 'revealed'
  const document = projectPlayerCluster(workspace)
  const branch = document.routeBranches[0]!
  document.routeBranches.push({
    ...branch,
    id: 'second-branch',
    anchor: { kind: 'detached', position: { x: 350, y: 420 } },
  })
  const object = branch.map.objects.find(object => object.label === occupant.name)!
  const drawable = { x: 12, y: -8, width: 640, height: 380 }
  const snapshot: PlayerImageViewportSnapshot = {
    camera: { x: -30, y: 20, k: 1 },
    drawable, nameViewport: drawable, svgPixelScale: 1,
    detailSystemIds: [], dimmedObjects: null, selectedRouteId: null,
    selectedBranchTarget: { branchId: branch.id, target: { kind: 'object', id: object.id } },
    dimmedBranchObjects: [{ branchId: branch.id, ids: [object.id] }],
  }
  const overview = serializeContinuousPlayerMapImage(document, { scope: 'viewport', snapshot }, 'print-light')

  expect(overview.svg).toContain('viewBox="12 -8 640 380"')
  expect(overview.svg).toContain('translate(-30 20) scale(1)')
  expect(overview.svg.match(/<title>Captured echo<\/title>/g)).toHaveLength(1)
  expect(overview.svg).toMatch(/opacity="\.4"><title>Captured echo<\/title><circle[^>]+stroke-width="3"/)
  expect(overview.svg).not.toContain('<ellipse')

  const detail = serializeContinuousPlayerMapImage(document, {
    scope: 'viewport',
    snapshot: { ...snapshot, camera: { ...snapshot.camera, k: 4 }, selectedBranchTarget: null },
  }, 'print-light')
  expect(detail.svg.match(/<title>Captured echo<\/title>/g)).toHaveLength(2)
  expect(detail.svg.match(/opacity="\.4"/g)).toHaveLength(1)
  expect(detail.svg.match(/<ellipse/g)).toHaveLength(2)
  expect(detail.svg).toContain('translate(350 420) scale(0.25)')
  expect(detail.svg).not.toContain('route-vessel-orbit')
})
