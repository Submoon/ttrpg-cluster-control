import { expect, test } from '@playwright/test'
import {
  catalogueTypes,
  createSystemObject,
  createWorkspaceRouteObject,
  replaceWorkspaceSystem,
  routeContentsFor,
} from '../domain/workspace'
import { projectPointOntoRoute } from '../utils/continuous-map-route-hit'
import { workspaceWithRouteObjects } from './support/route-objects-fixture'

test('any catalogue subtype can be created directly on a route with a Cluster-wide key @pure', () => {
  const fixture = workspaceWithRouteObjects()
  const zone = fixture.workspace.cluster.systems[0]!
  const seeded = replaceWorkspaceSystem(fixture.workspace, { ...zone, objects: [createSystemObject(zone, 'hazard')] })
  let workspace = seeded
  const routeId = fixture.route.id
  for (const [index, type] of catalogueTypes.entries()) {
    const progression = index / (catalogueTypes.length - 1)
    const { workspace: next, object } = createWorkspaceRouteObject(workspace, routeId, type.value, progression)
    expect(object).toMatchObject({
      family: type.family, subtype: type.value, publication: 'known-type',
      placement: { kind: 'route', progression },
      description: '', playerText: '', playerFieldMasks: [],
    })
    expect(routeContentsFor(next.cluster, routeId)?.objects.at(-1)).toEqual(object)
    workspace = next
  }
  const objects = [...workspace.cluster.systems.flatMap(system => system.objects),
    ...routeContentsFor(workspace.cluster, routeId)!.objects]
  expect(new Set(objects.map(object => object.locationKey)).size).toBe(objects.length)
  expect(workspace.cluster.systems).toEqual(seeded.cluster.systems)
})

test('invalid route creation cannot change the source or allocate route ownership @pure', () => {
  const { workspace, route } = workspaceWithRouteObjects()
  const empty = { ...workspace, cluster: { ...workspace.cluster, routeContents: {} } }
  const before = JSON.stringify(empty)
  for (const progression of [NaN, Infinity, -0.01, 1.01]) {
    expect(() => createWorkspaceRouteObject(empty, route.id, 'anomaly', progression)).toThrow(/0% and 100%/)
  }
  expect(() => createWorkspaceRouteObject(empty, 'missing', 'anomaly', 0.5)).toThrow(/valid Jump Route/)
  expect(JSON.stringify(empty)).toBe(before)
  const created = createWorkspaceRouteObject(empty, route.id, 'other', 0, 'Debris field')
  expect(created.object).toMatchObject({ subtype: 'Debris field', placement: { kind: 'route', progression: 0 } })
  expect(routeContentsFor(created.workspace.cluster, route.id)).toEqual({ objects: [created.object], orbits: [] })
})

test('projection resolves the actual cubic progression and clamps to the route endpoints @pure', () => {
  const curve = {
    start: { x: 0, y: 0 }, control1: { x: 0, y: 0 },
    control2: { x: 0, y: 0 }, end: { x: 64, y: 0 },
  }
  expect(projectPointOntoRoute({ x: 1, y: 20 }, curve)).toBeCloseTo(0.25, 5)
  expect(projectPointOntoRoute({ x: -12, y: 4 }, curve)).toBe(0)
  expect(projectPointOntoRoute({ x: 80, y: -4 }, curve)).toBe(1)
  const arched = { ...curve, control1: { x: 0, y: 64 }, control2: { x: 64, y: 64 } }
  expect(projectPointOntoRoute({ x: 32, y: 72 }, arched)).toBeCloseTo(0.5, 5)
  expect(projectPointOntoRoute({ x: NaN, y: 10 }, curve)).toBeNull()
})
