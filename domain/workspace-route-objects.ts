import type {
  CatalogueObject, CatalogueSubtype, JumpCluster, LocalWorkspace, RouteContents, RouteObject, SystemObjectChanges,
} from './workspace-model'
import { clusterObjects } from './workspace-location-keys'
import { createCatalogueObject, updateCatalogueObject } from './workspace-system-objects'
import { validName } from './workspace-validation'

/** A logical route landing, independent of the camera and the current curve geometry. */
export interface RouteLanding {
  routeId: string
  progression: number
}

function routePlacement(progression: number): Extract<RouteObject['placement'], { kind: 'route' }> {
  if (!Number.isFinite(progression) || progression < 0 || progression > 1) {
    throw new Error('Route position must be between 0% and 100%.')
  }
  return { kind: 'route', progression }
}

/** Returns the authored contents for a route, including only an explicitly stored own key. */
export function routeContentsFor(cluster: Pick<JumpCluster, 'routeContents'>, routeId: string): RouteContents | undefined {
  return Object.hasOwn(cluster.routeContents, routeId) ? cluster.routeContents[routeId] : undefined
}

/** Creates a new catalogue root on an existing route with a Cluster-wide Location key. */
export function createWorkspaceRouteObject(
  workspace: LocalWorkspace,
  routeId: string,
  subtype: CatalogueSubtype,
  progression: number,
  otherType?: string,
): { workspace: LocalWorkspace; object: RouteObject } {
  if (!workspace.cluster.routes.some(route => route.id === routeId)) {
    throw new Error('Choose a valid Jump Route for this object.')
  }
  const placement = routePlacement(progression)
  const label = subtype === 'other' && otherType !== undefined ? validName(otherType, 'Object type') : undefined
  const contents = routeContentsFor(workspace.cluster, routeId) ?? { objects: [], orbits: [] }
  const generated = createCatalogueObject(contents.objects, subtype, placement, clusterObjects(workspace.cluster))
  const object = label ? { ...generated, subtype: label } : generated
  return {
    object,
    workspace: replaceRouteContents(workspace, routeId, { ...contents, objects: [...contents.objects, object] }),
  }
}

/** Updates authored data and optional root progression while retaining the full hosted branch. */
export function updateWorkspaceRouteObject(
  workspace: LocalWorkspace,
  routeId: string,
  objectId: string,
  changes: Omit<SystemObjectChanges, 'placement'> & { progression?: number },
): LocalWorkspace {
  const contents = routeContentsFor(workspace.cluster, routeId)
  const object = contents?.objects.find(candidate => candidate.id === objectId)
  if (!object || !contents) throw new Error('The selected route object no longer exists.')
  const { progression, ...authored } = changes
  if (progression !== undefined && object.placement.kind !== 'route') {
    throw new Error('Only a route root has a route position.')
  }
  const placement = progression === undefined ? object.placement : routePlacement(progression)
  const updated = updateCatalogueObject(
    contents.objects, object, authored, workspace.objectFieldSettings, clusterObjects(workspace.cluster), placement,
  )
  return replaceRouteContents(workspace, routeId, {
    ...contents,
    objects: contents.objects.map(candidate => candidate.id === objectId ? updated : candidate),
  })
}

function replaceRouteContents(workspace: LocalWorkspace, routeId: string, contents: RouteContents): LocalWorkspace {
  return {
    ...workspace,
    cluster: {
      ...workspace.cluster,
      routeContents: {
        ...workspace.cluster.routeContents,
        [routeId]: contents,
      },
    },
  }
}

/** Lists each private catalogue scope alongside its authored objects. */
export function catalogueBranches(cluster: JumpCluster) {
  return [
    ...cluster.systems,
    ...cluster.routes.flatMap(route => {
      const contents = routeContentsFor(cluster, route.id)
      return contents ? [{
        id: route.id,
        name: route.name || `Jump Route (Level ${route.jumpLevel})`,
        ...contents,
      }] : []
    }),
  ]
}

/** Maps fields common to every catalogue object while retaining each distinct placement type. */
export function mapCatalogueObjects(
  cluster: JumpCluster,
  transform: <T extends CatalogueObject>(object: T) => T,
): JumpCluster {
  return {
    ...cluster,
    systems: cluster.systems.map(system => ({ ...system, objects: system.objects.map(transform) })),
    routeContents: Object.fromEntries(Object.entries(cluster.routeContents).map(([id, contents]) => [
      id, { ...contents, objects: contents.objects.map(transform) },
    ])),
  }
}
