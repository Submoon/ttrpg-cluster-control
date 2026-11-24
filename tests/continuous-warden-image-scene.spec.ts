import { expect, test } from '@playwright/test'
import type { JumpCluster, StarSystem } from '../domain/workspace'
import { projectWardenSystem } from '../utils/continuous-map-projection'
import {
  prepareContinuousWardenImageScene,
  type ContinuousWardenImageSceneRequest,
} from '../utils/continuous-warden-image-scene'

test('selected-system export fits the supplied label metrics independently of the editor camera @pure', () => {
  const selected: StarSystem = {
    id: 'selected',
    name: 'Selected system',
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
