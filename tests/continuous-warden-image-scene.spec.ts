import { expect, test } from '@playwright/test'
import type { JumpCluster, StarSystem } from '../domain/workspace'
import { projectWardenSystem } from '../utils/continuous-map-projection'
import {
  prepareContinuousWardenImageScene,
  type ContinuousWardenImageSceneRequest,
} from '../utils/continuous-warden-image-scene'
import { workspaceWithRouteObjects } from './support/route-objects-fixture'

const measurements = {
  systemNameWidthPixels: (name: string) => name.length * 8,
  textWidth: (text: string, size: number) => text.length * size * .6,
}

test('entire-Cluster export shows route roots at overview detail @pure', () => {
  const { workspace, root } = workspaceWithRouteObjects()
  const request: ContinuousWardenImageSceneRequest = {
    cluster: workspace.cluster,
    layout: workspace.layout,
    projections: [
      projectWardenSystem(workspace.cluster.systems[0]!, { x: .2, y: .5 }, workspace.layout),
      projectWardenSystem(workspace.cluster.systems[1]!, { x: .8, y: .5 }, workspace.layout),
    ],
    scope: 'cluster',
    format: 'svg',
    viewport: { x: -500, y: 10, k: 30 },
    viewportRect: { x: 0, y: 0, width: 800, height: 600 },
    svgPixelScale: 1,
    detailSystemIds: new Set(workspace.cluster.systems.map(system => system.id)),
    dimmedObjectIds: [root.id],
  }
  const scene = prepareContinuousWardenImageScene(request, measurements)
  const branch = scene.routes[0]?.branch
  expect(branch?.objects.map(({ object }) => object.id)).toEqual([root.id])
  expect(branch?.orbits).toEqual([])
  expect(scene.dimmedObjectIds.has(root.id)).toBe(false)
  const mark = branch!.objects[0]!.point
  expect(Math.abs(mark.y - 280)).toBeCloseTo(18)
  expect(mark.x).toBeGreaterThan(259)
  expect(mark.x).toBeLessThan(480)
  expect(mark.y - 14).toBeGreaterThan(scene.frame.y)
  expect(mark.x - 14).toBeGreaterThan(scene.frame.x)
})

test('viewport export follows route detail, selected-object reveal and applied filtering @pure', () => {
  const { workspace, root, orbit, occupant } = workspaceWithRouteObjects()
  const request: ContinuousWardenImageSceneRequest = {
    cluster: workspace.cluster,
    layout: workspace.layout,
    projections: workspace.cluster.systems.map((system, index) =>
      projectWardenSystem(system, { x: .2 + .6 * index, y: .5 }, workspace.layout)),
    scope: 'viewport',
    format: 'svg',
    viewport: { x: -480, y: -520, k: 4 },
    viewportRect: { x: 20, y: 35, width: 780, height: 550 },
    svgPixelScale: 1,
    detailSystemIds: new Set(),
    dimmedObjectIds: [occupant.id],
  }
  const detail = prepareContinuousWardenImageScene(request, measurements)
  expect(detail.frame).toMatchObject(request.viewportRect)
  expect(detail.sceneViewport).toEqual(request.viewport)
  expect(detail.dimmedObjectIds).toEqual(new Set([occupant.id]))
  const branch = detail.routes[0]?.branch
  expect(branch?.objects.map(({ object }) => object.id)).toEqual([root.id, occupant.id])
  expect(branch?.orbits[0]).toMatchObject({ id: orbit.id, rotation: 90, vertical: 9 })
  expect(branch?.orbits[0]?.horizontal).toBeCloseTo(18.4)
  expect(branch?.objects[1]?.point.y).toBeCloseTo(branch!.objects[0]!.point.y + 18.4)

  const overview = { ...request, svgPixelScale: .5 }
  const overviewScene = prepareContinuousWardenImageScene(overview, measurements)
  expect(overviewScene.routes[0]?.branch?.objects.map(({ object }) => object.id)).toEqual([root.id])
  const selectedScene = prepareContinuousWardenImageScene({ ...overview, selectedRouteObjectId: occupant.id }, measurements)
  expect(selectedScene.routes[0]?.branch?.objects.map(({ object }) => object.id)).toEqual([root.id, occupant.id])
  expect(selectedScene.routes[0]?.branch?.orbits).toEqual([])
})

test('selected-system export fits the supplied label metrics independently of the editor camera @pure', () => {
  const selected: StarSystem = {
    id: 'selected',
    name: 'Selected Zone',
    publication: 'hidden',
    objects: [],
    orbits: [],
  }
  const neighbor: StarSystem = { ...selected, id: 'neighbor', name: 'Neighbor' }
  const cluster: JumpCluster = {
    id: 'cluster',
    name: 'Cluster',
    playerTitle: '',
    systems: [selected, neighbor],
    routeContents: {},
    routes: [{
      id: 'incoming',
      jumpLevel: 2,
      fromSystemId: neighbor.id,
      toSystemId: selected.id,
      fromPointId: null,
      toPointId: null,
      playerShared: false,
    }],
  }
  const geometry = { objectAngles: {}, orbitRadii: {}, orbitRotations: {} }
  const request: ContinuousWardenImageSceneRequest = {
    cluster,
    layout: geometry,
    projections: [
      projectWardenSystem(selected, { x: .3, y: .3 }, geometry),
      projectWardenSystem(neighbor, { x: .7, y: .7 }, geometry),
    ],
    scope: 'system',
    selectedSystemId: selected.id,
    format: 'svg',
    viewport: { x: 0, y: 0, k: 1 },
    viewportRect: { x: 0, y: 0, width: 800, height: 600 },
    svgPixelScale: 1,
    detailSystemIds: new Set(),
  }
  const measurements = {
    systemNameWidthPixels: (name: string) => name.length * 50,
    textWidth: (text: string, size: number) => text.length * size * .6,
  }
  const scene = prepareContinuousWardenImageScene(request, measurements)
  const alternateCamera = prepareContinuousWardenImageScene({
    ...request,
    viewport: { x: -368, y: 120, k: 4 },
    viewportRect: { x: 5, y: 10, width: 240, height: 320 },
    svgPixelScale: .4,
    detailSystemIds: new Set([neighbor.id]),
  }, measurements)
  const narrowerTitle = prepareContinuousWardenImageScene(request, {
    ...measurements,
    systemNameWidthPixels: name => name.length * 8,
  })

  expect(alternateCamera.frame).toEqual(scene.frame)
  const { branch, workspace } = workspaceWithRouteObjects()
  const sceneWithDistantBranch = prepareContinuousWardenImageScene({
    ...request,
    cluster: { ...cluster, routeContents: { incoming: branch } },
    layout: workspace.layout,
  }, measurements)
  expect(sceneWithDistantBranch.frame).toEqual(scene.frame)
  expect(sceneWithDistantBranch.routes[0]?.branch).toBeUndefined()
  const title = scene.labels[0]
  expect(title?.width).toBeGreaterThan(narrowerTitle.labels[0]?.width ?? 0)
  if (!title) throw new Error('Expected a fitted title for the selected system.')
  const caption = scene.routes[0]?.systemCaption
  expect(caption?.destinationLabel).toBe(neighbor.name)
  if (!caption) throw new Error('Expected a fitted caption for the incoming route.')
  const titleBounds = { x: title.centerX - title.width / 2, y: title.top, width: title.width, height: title.height }
  for (const bounds of [titleBounds, caption.bounds]) {
    expect(bounds.x).toBeGreaterThan(scene.frame.x)
    expect(bounds.y).toBeGreaterThan(scene.frame.y)
    expect(bounds.x + bounds.width).toBeLessThan(scene.frame.x + scene.frame.width)
    expect(bounds.y + bounds.height).toBeLessThan(scene.frame.y + scene.frame.height)
  }
})
