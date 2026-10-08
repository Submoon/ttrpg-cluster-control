import type { JumpPointReference, JumpRoute, Point } from '../domain/workspace'

export interface ClusterRouteGeometry {
  path: string
  labelX: number
  labelY: number
  exitPoint?: Point
}

export function clusterSystemPosition(
  systemPositions: Readonly<Record<string, Point>>,
  systemId: string,
  overrides?: ReadonlyMap<string, Point>,
): Point {
  const override = overrides?.get(systemId)
  if (override) return override
  const position = systemPositions[systemId]
  if (!position) {
    throw new Error(`No cluster-map position exists for star system "${systemId}".`)
  }

  return { x: 112 + position.x * 736, y: 96 + position.y * 368 }
}

export function requiredJumpPoint(
  jumpPoints: ReadonlyMap<string, JumpPointReference>,
  pointId: string,
): JumpPointReference {
  const reference = jumpPoints.get(pointId)
  if (!reference) {
    throw new Error(`Jump Route references missing Jump Point "${pointId}".`)
  }
  return reference
}

export function clusterRouteGeometry(
  route: JumpRoute,
  index: number,
  jumpPoints: ReadonlyMap<string, JumpPointReference>,
  systemPositions: Readonly<Record<string, Point>>,
  positionOverrides?: ReadonlyMap<string, Point>,
): ClusterRouteGeometry {
  const from = requiredJumpPoint(jumpPoints, route.fromPointId)
  const start = clusterSystemPosition(systemPositions, from.system.id, positionOverrides)
  const to = route.toPointId === null
    ? undefined
    : requiredJumpPoint(jumpPoints, route.toPointId)

  if (to?.system.id === from.system.id) {
    const controlY = start.y - 126 - (index % 2) * 20
    return {
      path: `M ${start.x - 46} ${start.y - 38} Q ${start.x} ${controlY} ${start.x + 46} ${start.y - 38}`,
      labelX: start.x,
      labelY: controlY + 20,
    }
  }

  const exitPoint = to
    ? undefined
    : { x: 860, y: Math.min(500, Math.max(88, start.y + 128 + (index % 3) * 24)) }
  const end = to
    ? clusterSystemPosition(systemPositions, to.system.id, positionOverrides)
    : exitPoint!
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.max(1, Math.hypot(dx, dy))
  const ux = dx / length
  const uy = dy / length
  const x1 = start.x + ux * 84
  const y1 = start.y + uy * 40
  const x2 = to ? end.x - ux * 84 : end.x
  const y2 = to ? end.y - uy * 40 : end.y
  const bend = to ? (index % 2 === 0 ? 32 : -32) : 18
  const controlX = (x1 + x2) / 2 - uy * bend
  const controlY = (y1 + y2) / 2 + ux * bend

  return {
    path: `M ${x1} ${y1} Q ${controlX} ${controlY} ${x2} ${y2}`,
    labelX: (x1 + 2 * controlX + x2) / 4,
    labelY: (y1 + 2 * controlY + y2) / 4 - 8,
    exitPoint,
  }
}

export function clusterRouteLabel(
  route: JumpRoute,
  jumpPoints: ReadonlyMap<string, JumpPointReference>,
): string {
  const from = requiredJumpPoint(jumpPoints, route.fromPointId)
  const origin = `${from.point.name} (${from.system.name})`
  if (route.toPointId !== null) {
    const to = requiredJumpPoint(jumpPoints, route.toPointId)
    return `Select Jump Level ${route.jumpLevel} route from ${origin} to ${to.point.name} (${to.system.name})`
  }
  return `Select Jump Level ${route.jumpLevel} route from ${origin} to unknown destination: ${route.unresolvedExit}`
}
