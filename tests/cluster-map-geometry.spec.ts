import { expect, test } from '@playwright/test'
import type { JumpPointReference, JumpRoute } from '../domain/workspace'
import { clusterRouteGeometry } from '../utils/cluster-map-geometry'

test('unresolved route geometry uses its saved scene target without clamping it', { tag: '@pure' }, () => {
  const fromSystem = { id: 'system-a', name: 'Aster', objects: [], orbits: [] }
  const fromPoint = {
    id: 'point-a',
    family: 'JumpPoint',
    subtype: 'jump-point',
    locationKey: 'JP1',
    name: 'North Gate',
    description: '',
    placement: { kind: 'system', x: 0.5, y: 0.5 },
  } as const
  const jumpPoints = new Map<string, JumpPointReference>([
    [fromPoint.id, { point: fromPoint, system: fromSystem }],
  ])
  const route: JumpRoute = {
    id: 'route-a',
    fromPointId: fromPoint.id,
    toPointId: null,
    unresolvedExit: 'Rim',
    jumpLevel: 2,
  }

  const geometry = clusterRouteGeometry(
    route,
    0,
    jumpPoints,
    { [fromSystem.id]: { x: 0.5, y: 0.5 } },
    undefined,
    { [route.id]: { x: 1200, y: 900 } },
  )

  expect(geometry.exitPoint).toEqual({ x: 1200, y: 900 })
  expect(geometry.path.endsWith('1200 900')).toBe(true)
  expect(geometry.labelX).toBeGreaterThan(860)
})
