import type { LocalWorkspace, Point, StarSystem, SystemObject } from './workspace-model'
import { workspaceSystemFrame } from './workspace-system-frames'
import { CONTINUOUS_MAP_LOCAL_ORIGIN, CONTINUOUS_MAP_SYSTEM_SCALE } from '../utils/continuous-map-projection'
import { continuousMapRoundedFrameContains } from '../utils/continuous-map-elastic-placement'
import { objectPositions } from '../utils/system-map-geometry'

type RetainedPlacement = NonNullable<SystemObject['legacyZonePlacement']>

/** Older workspaces may carry placements beyond their authored Zone frame. Keep each specific position. */
export function retainLegacyZonePlacements(workspace: LocalWorkspace): LocalWorkspace {
  return mapFramedZoneObjects(workspace, (object, placement, fits) => {
    if (fits) return object
    return { ...object, legacyZonePlacement: placement }
  })
}

/** Current files require exact placement exceptions for object positions outside an authored frame. */
export function hasValidZonePlacements(workspace: LocalWorkspace): boolean {
  try {
    mapFramedZoneObjects(workspace, (object, placement, fits) => {
      const exception = object.legacyZonePlacement
      if ((!fits || exception !== undefined) && !matchesPlacement(exception, placement)) {
        throw new Error('An object lies outside the Zone frame without a matching retained placement.')
      }
      return object
    })
    return workspace.cluster.systems.every(system => workspaceSystemFrame(workspace, system.id)
      || system.objects.every(object => object.legacyZonePlacement === undefined))
  } catch {
    return false
  }
}

/** Retires an exception when an applied edit changes the retained context or effective position. */
export function withoutChangedLegacyZonePlacements(workspace: LocalWorkspace): LocalWorkspace {
  if (!workspace.cluster.systems.some(system => system.objects.some(object => object.legacyZonePlacement !== undefined))) {
    return workspace
  }
  const cleaned = mapFramedZoneObjects(workspace, (object, placement) => object.legacyZonePlacement === undefined
    || matchesPlacement(object.legacyZonePlacement, placement) ? object : withoutException(object))
  const systems = cleaned.cluster.systems.map(system => workspaceSystemFrame(cleaned, system.id)
    ? system : mapObjects(system, withoutException))
  return systems.some((system, index) => system !== cleaned.cluster.systems[index])
    ? { ...cleaned, cluster: { ...cleaned.cluster, systems } }
    : cleaned
}

function matchesPlacement(value: unknown, placement: RetainedPlacement): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return 'systemId' in value && value.systemId === placement.systemId
    && 'orbitId' in value && value.orbitId === placement.orbitId
    && 'x' in value && value.x === placement.x
    && 'y' in value && value.y === placement.y
}

function withoutException(object: SystemObject): SystemObject {
  if (object.legacyZonePlacement === undefined) return object
  const next = { ...object }
  delete next.legacyZonePlacement
  return next
}

function mapObjects(system: StarSystem, transform: (object: SystemObject) => SystemObject): StarSystem {
  const objects = system.objects.map(transform)
  return objects.some((object, index) => object !== system.objects[index]) ? { ...system, objects } : system
}

function mapFramedZoneObjects(
  workspace: LocalWorkspace,
  transform: (object: SystemObject, placement: RetainedPlacement, fits: boolean) => SystemObject,
): LocalWorkspace {
  const systems = workspace.cluster.systems.map(system => {
    const insets = workspaceSystemFrame(workspace, system.id)
    if (!insets) return system
    const frame = { x: -insets.left, y: -insets.top, width: insets.left + insets.right, height: insets.top + insets.bottom }
    const positions = objectPositions(system, workspace.layout)
    return mapObjects(system, object => {
      const local = positions.get(object.id)
      if (!local) throw new Error('No local position exists for this Zone object.')
      const point: Point = {
        x: (local.x - CONTINUOUS_MAP_LOCAL_ORIGIN.x) * CONTINUOUS_MAP_SYSTEM_SCALE,
        y: (local.y - CONTINUOUS_MAP_LOCAL_ORIGIN.y) * CONTINUOUS_MAP_SYSTEM_SCALE,
      }
      const placement = {
        systemId: system.id,
        orbitId: object.placement.kind === 'orbit' ? object.placement.orbitId : null,
        x: local.x,
        y: local.y,
      }
      return transform(object, placement, continuousMapRoundedFrameContains(point, frame))
    })
  })
  return systems.some((system, index) => system !== workspace.cluster.systems[index])
    ? { ...workspace, cluster: { ...workspace.cluster, systems } }
    : workspace
}
