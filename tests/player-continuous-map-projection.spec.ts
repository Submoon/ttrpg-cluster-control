import { expect, test } from './fixtures'
import { addStarSystem, createLocalWorkspace, isLocalWorkspace, updateChartDetails } from '../domain/workspace'
import { projectPlayerCluster, type PlayerClusterDocument } from '../domain/player-projection'
import {
  playerContinuousDetailSystemIds,
  projectPlayerContinuousMap,
} from '../utils/player-continuous-map-projection'
import {
  fitPlayerContinuousTarget,
  layoutPlayerContinuousNameLabels,
  playerContinuousTargetBounds,
  playerContinuousTargetMinimumScale,
} from '../utils/player-continuous-map-layout'
import { fitMapViewport } from '../utils/map-zoom'

function publicDocument(): PlayerClusterDocument {
  return {
    format: 'ttrpg-cluster-control-player',
    version: 2,
    title: 'Pilgrim Reach',
    systems: [
      {
        id: 'system-1',
        position: { x: 100, y: 120 },
        disclosure: 'unknown',
        label: 'Unknown presence',
      },
      {
        id: 'system-2',
        position: { x: 500, y: 300 },
        disclosure: 'known-type',
        type: 'star-system',
        label: 'Star system',
      },
      {
        id: 'system-3',
        position: { x: 900, y: 500 },
        disclosure: 'revealed',
        type: 'star-system',
        label: 'Vesper',
        map: {
          objects: [{
            id: 'object-1',
            position: { x: 280, y: 200 },
            placement: { kind: 'system' },
            disclosure: 'revealed',
            family: 'CelestialBody',
            subtype: 'planet',
            label: 'Pilgrim World',
            playerText: '',
            fields: [],
          }],
          orbits: [{
            id: 'orbit-1',
            hostId: null,
            center: { x: 260, y: 240 },
            radii: { horizontal: 90, vertical: 40 },
            rotation: 30,
          }],
        },
      },
      {
        id: 'system-4',
        position: { x: 1300, y: 750 },
        disclosure: 'revealed',
        type: 'star-system',
        label: 'Empty Reach',
        map: { objects: [], orbits: [] },
      },
    ],
    routes: [
      { id: 'route-1', jumpLevel: 2, fromSystemId: 'system-2', destination: { kind: 'system', systemId: 'system-3' } },
      {
        id: 'route-2',
        jumpLevel: 4,
        fromSystemId: 'system-3',
        destination: { kind: 'unknown', position: { x: 1180, y: 530 }, label: 'Unknown destination' },
      },
    ],
  }
}

test('player continuous geometry keeps generic anchors and projects only public interior geometry @pure', () => {
  const projection = projectPlayerContinuousMap(publicDocument())

  expect(projection.systems).toHaveLength(4)
  expect(projection.systems[0]).toMatchObject({ id: 'system-1', disclosure: 'unknown', anchor: { x: 100, y: 120 } })
  expect(projection.systems[1]).toMatchObject({ id: 'system-2', disclosure: 'known-type', anchor: { x: 500, y: 300 } })
  expect(projection.systems[0]?.geometry).toBeUndefined()
  expect(projection.systems[1]?.geometry).toBeUndefined()

  const revealed = projection.systems[2]
  expect(revealed?.geometry?.objects[0]).toMatchObject({
    id: 'object-1',
    name: 'Pilgrim World',
    position: { x: 280, y: 200 },
    scenePosition: { x: 860, y: 484 },
    locationKey: '',
  })
  expect(revealed?.geometry?.orbits[0]).toMatchObject({
    id: 'orbit-1',
    sceneCenter: { x: 856, y: 492 },
    sceneRadii: { horizontal: 18, vertical: 8 },
    rotation: 30,
  })
  expect(revealed?.geometry?.envelope).toEqual(expect.objectContaining({ width: expect.any(Number), height: expect.any(Number) }))
  expect(projection.systems[3]?.geometry?.envelope.width).toBeGreaterThanOrEqual(120)
  expect(projection.systems[3]?.geometry?.envelope.height).toBeGreaterThanOrEqual(88)
  expect(projection.bounds.x).toBeLessThan(100)
  expect(projection.bounds.y).toBeLessThan(120)
  expect(projection.bounds.x + projection.bounds.width).toBeGreaterThan(1300)
  expect(projection.routes.map(route => route.id)).toEqual(['route-1', 'route-2'])
  expect(projection.routes[0]?.path).toBe('M 500 300 L 900 500')
  expect(projection.routes[1]?.path).toBe('M 900 500 L 1180 530')
})

test('coincident public endpoints get a visible curve while same-ID loops stay omitted @pure', () => {
  const document = publicDocument()
  document.systems[2]!.position = { x: 500, y: 300 }
  document.routes.push(
    { id: 'route-3', jumpLevel: 3, fromSystemId: 'system-2', destination: { kind: 'unknown', position: { x: 500, y: 300 }, label: 'Unknown destination' } },
    { id: 'route-4', jumpLevel: 5, fromSystemId: 'system-2', destination: { kind: 'system', systemId: 'system-2' } },
  )

  const routes = projectPlayerContinuousMap(document).routes
  const coincidentResolved = routes.find(route => route.id === 'route-1')
  const coincidentAnonymous = routes.find(route => route.id === 'route-3')

  expect(coincidentResolved?.path).toMatch(/^M 500 300 Q .+ 500 300$/)
  expect(coincidentResolved?.foreground).toBe(true)
  expect(coincidentAnonymous?.path).toMatch(/^M 500 300 Q .+ 500 300$/)
  expect(coincidentAnonymous?.foreground).toBe(true)
  expect(coincidentAnonymous?.destination?.position).toEqual({ x: 500, y: 300 })
  expect(routes.map(route => route.id)).toEqual(['route-1', 'route-2', 'route-3'])
})

test('player continuous bounds and camera inputs ignore data outside the detached public document @pure', () => {
  const publicProjection = projectPlayerContinuousMap(publicDocument())
  const extendedInput = {
    ...publicDocument(),
    privateSystems: [{ position: { x: 900_000_000, y: -900_000_000 } }],
    privateBounds: { width: 1_000_000_000, height: 1_000_000_000 },
  }
  const extendedProjection = projectPlayerContinuousMap(extendedInput)

  expect(extendedProjection.bounds).toEqual(publicProjection.bounds)
  expect(JSON.parse(JSON.stringify(extendedProjection.systems))).toEqual(JSON.parse(JSON.stringify(publicProjection.systems)))
})

test('hidden source geometry cannot change the public continuous envelope or fit camera @pure', () => {
  const base = createLocalWorkspace('Private Source', 'Public System')
  const publicSystem = base.cluster.systems[0]!
  const revealed = updateChartDetails(base, publicSystem.id, {
    clusterName: base.cluster.name,
    systemName: publicSystem.name,
    playerTitle: base.cluster.playerTitle,
    publication: 'revealed',
  })
  const added = addStarSystem(revealed, 'Distant Hidden System')
  const privateWorkspace = updateChartDetails(added.workspace, added.system.id, {
    clusterName: added.workspace.cluster.name,
    systemName: added.system.name,
    playerTitle: added.workspace.cluster.playerTitle,
    publication: 'hidden',
  })
  const farHiddenWorkspace = structuredClone(privateWorkspace)
  farHiddenWorkspace.layout.systemPositions[added.system.id] = { x: 1000, y: -1000 }

  expect(isLocalWorkspace(privateWorkspace)).toBe(true)
  expect(isLocalWorkspace(farHiddenWorkspace)).toBe(true)
  const publicProjection = projectPlayerContinuousMap(projectPlayerCluster(privateWorkspace))
  const farProjection = projectPlayerContinuousMap(projectPlayerCluster(farHiddenWorkspace))
  const publicSystemProjection = publicProjection.systems.find(system => system.disclosure === 'revealed')
  const farSystemProjection = farProjection.systems.find(system => system.disclosure === 'revealed')
  const viewport = { x: 0, y: 0, width: 960, height: 560 }

  expect(farSystemProjection?.geometry?.envelope).toEqual(publicSystemProjection?.geometry?.envelope)
  expect(farProjection.bounds).toEqual(publicProjection.bounds)
  expect(fitMapViewport(farProjection.bounds, viewport, Number.MIN_VALUE))
    .toEqual(fitMapViewport(publicProjection.bounds, viewport, Number.MIN_VALUE))
})

test('player continuous names use screen coordinates and independently fit the unobstructed viewport @pure', () => {
  const projection = projectPlayerContinuousMap(publicDocument())
  const labels = layoutPlayerContinuousNameLabels(
    projection.systems,
    { x: 80, y: 20, k: .2 },
    2,
    { x: 20, y: 10, width: 300, height: 200 },
  )

  expect(labels.map(label => label.systemId)).toEqual(['system-2', 'system-3', 'system-4'])
  expect(new Set(labels.map(label => `${label.x}:${label.y}`)).size).toBe(labels.length)
  for (const label of labels) {
    expect(label.anchorX).toBeCloseTo(80 + projection.systems.find(system => system.id === label.systemId)!.anchor.x * .2)
    expect(label.anchorY).toBeCloseTo(20 + projection.systems.find(system => system.id === label.systemId)!.anchor.y * .2)
    expect(label.width * 2).toBeGreaterThanOrEqual(72)
    expect(label.height * 2).toBeCloseTo(28)
    expect(label.x - label.width / 2).toBeGreaterThanOrEqual(24)
    expect(label.x + label.width / 2).toBeLessThanOrEqual(316)
    expect(label.y).toBeGreaterThanOrEqual(14)
    expect(label.y + label.height).toBeLessThanOrEqual(206)
  }
})

test('player continuous long names stay inside compact viewports and clear their own anchor @pure', () => {
  const projection = projectPlayerContinuousMap(publicDocument())
  const source = projection.systems[1]!
  const longSystem = { ...source, label: 'L'.repeat(80) }
  const viewport = { x: 0, y: 0, width: 300, height: 200 }
  const [label] = layoutPlayerContinuousNameLabels(
    [longSystem],
    { x: -200, y: -288, k: 1 },
    1,
    viewport,
  )

  if (!label) throw new Error('The public long-name label was not laid out.')
  expect(label.name).toBe('L'.repeat(80))
  expect(label.displayName).toMatch(/…$/)
  expect(label.displayName.length).toBeLessThan(80)
  expect(label.width).toBeLessThanOrEqual(viewport.width - 16)
  expect(label.textWidth).toBeLessThanOrEqual(label.width - 24)
  expect(label.y).toBeGreaterThanOrEqual(label.anchorY + 18)
})

test('player continuous target framing includes long labels, rotated orbits, and detail scale @pure', () => {
  const projection = projectPlayerContinuousMap(publicDocument())
  const system = projection.systems[2]!
  const geometry = system.geometry!
  const objectBounds = playerContinuousTargetBounds(geometry, { kind: 'object', id: 'object-1' })
  const orbitBounds = playerContinuousTargetBounds(geometry, { kind: 'orbit', id: 'orbit-1' })
  const detailScale = playerContinuousTargetMinimumScale(system, 1, false)
  const retainedDetailScale = playerContinuousTargetMinimumScale(system, 1, true)
  const extent = Math.max(geometry.envelope.width, geometry.envelope.height)

  expect(objectBounds?.width).toBeGreaterThanOrEqual(Array.from('Pilgrim World').length * 7 + 22)
  const angle = Math.PI / 6
  const extentX = Math.hypot(18 * Math.cos(angle), 8 * Math.sin(angle))
  const extentY = Math.hypot(18 * Math.sin(angle), 8 * Math.cos(angle))
  expect(orbitBounds?.width).toBeCloseTo(extentX * 2 + 28)
  expect(orbitBounds?.height).toBeCloseTo(extentY * 2 + 28)
  expect(detailScale).toBeCloseTo(Math.max(380 / extent, 3.25))
  expect(retainedDetailScale).toBeCloseTo(Math.max(320 / extent, 2.75))

  if (!objectBounds) throw new Error('The public object has no framing bounds.')
  const viewport = { x: 0, y: 0, width: 960, height: 560 }
  const framed = fitPlayerContinuousTarget(objectBounds, viewport, .25, 16, retainedDetailScale)
  expect(framed?.k).toBeLessThan(16)
})

test('player continuous target Center preserves fitting zoom and expands only for semantic detail @pure', () => {
  const bounds = { x: 100, y: 70, width: 100, height: 80 }
  const viewport = { x: 0, y: 0, width: 400, height: 300 }
  const currentFit = fitPlayerContinuousTarget(bounds, viewport, .25, 1)
  const oversized = fitPlayerContinuousTarget(bounds, viewport, .25, 10)
  const belowDetailFloor = fitPlayerContinuousTarget(bounds, viewport, .25, 1, 2.2)

  expect(currentFit?.k).toBe(1)
  expect(oversized?.k).toBeCloseTo(2.75)
  expect(belowDetailFloor?.k).toBe(2.2)
  for (const camera of [currentFit, oversized, belowDetailFloor]) {
    expect(camera).toBeDefined()
    expect(camera!.x + (bounds.x + bounds.width / 2) * camera!.k).toBeCloseTo(viewport.width / 2)
    expect(camera!.y + (bounds.y + bounds.height / 2) * camera!.k).toBeCloseTo(viewport.height / 2)
  }
})

test('player system detail uses independent public envelope thresholds with collapse hysteresis @pure', () => {
  const projection = projectPlayerContinuousMap(publicDocument())
  const fitDetail = playerContinuousDetailSystemIds(projection.systems, 1, 1, new Set())
  const revealedDetail = playerContinuousDetailSystemIds(projection.systems, 3.5, 1, new Set())
  const retainedDetail = playerContinuousDetailSystemIds(projection.systems, 3, 1, new Set(['system-3']))
  const collapsedDetail = playerContinuousDetailSystemIds(projection.systems, 3, 1, new Set())

  expect(fitDetail).not.toContain('system-3')
  expect(revealedDetail).toContain('system-3')
  expect(retainedDetail).toContain('system-3')
  expect(collapsedDetail).not.toContain('system-3')
  expect(revealedDetail).not.toContain('system-1')
  expect(revealedDetail).not.toContain('system-2')
})

test('player route detail membership stays stable between threshold crossings @pure', () => {
  const { systems } = projectPlayerContinuousMap(publicDocument())
  const overview = new Set<string>()
  expect(playerContinuousDetailSystemIds(systems, 1, 1, overview)).toBe(overview)

  const revealed = playerContinuousDetailSystemIds(systems, 3.5, 1, overview)
  expect(revealed).toEqual(new Set(['system-3', 'system-4']))
  expect(playerContinuousDetailSystemIds(systems, 3, 1, revealed)).toBe(revealed)

  const collapsed = playerContinuousDetailSystemIds(systems, 1, 1, revealed)
  expect(collapsed).toEqual(overview)
  expect(collapsed).not.toBe(revealed)
})

test('tiny constrained frames still reveal public interior detail at maximum zoom @pure', () => {
  const source = projectPlayerContinuousMap(publicDocument()).systems[2]
  if (!source?.geometry) throw new Error('The public fixture system has no interior.')
  const system = {
    ...source,
    geometry: { ...source.geometry, envelope: { x: 0, y: 0, width: .01, height: .01 } },
  }

  expect(playerContinuousDetailSystemIds([system], 16, 1, new Set())).toContain(system.id)
  expect(system.geometry.objects).toEqual(source.geometry.objects)
})

test('player Center and detail agree at a fractional CSS scale @pure', () => {
  const source = projectPlayerContinuousMap(publicDocument()).systems[2]
  if (!source?.geometry) throw new Error('The public fixture system has no interior.')
  const system = {
    ...source,
    geometry: { ...source.geometry, envelope: { x: 0, y: 0, width: 183, height: 120 } },
  }
  const svgPixelScale = 1280 / 960
  const requiredScale = playerContinuousTargetMinimumScale(system, svgPixelScale, false)
  if (requiredScale === undefined) throw new Error('The public system cannot be framed.')
  expect(playerContinuousDetailSystemIds([system], requiredScale, svgPixelScale, new Set())).toContain(system.id)
})
