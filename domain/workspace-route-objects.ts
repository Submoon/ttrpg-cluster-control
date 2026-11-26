import type { CatalogueObject, JumpCluster, LocalWorkspace, RouteContents, SystemObjectChanges } from './workspace-model'
import { clusterObjects } from './workspace-location-keys'
import { updateCatalogueObject } from './workspace-system-objects'

/** Returns the authored contents for a route, including only an explicitly stored own key. */
export function routeContentsFor(cluster: Pick<JumpCluster, 'routeContents'>, routeId: string): RouteContents | undefined {
  return Object.hasOwn(cluster.routeContents, routeId) ? cluster.routeContents[routeId] : undefined
}

/** Updates authored data in place, preserving the object's route placement and full hosted branch. */
export function updateWorkspaceRouteObject(
  workspace: LocalWorkspace,
  routeId: string,
  objectId: string,
  changes: Omit<SystemObjectChanges, 'placement'>,
): LocalWorkspace {
  const contents = routeContentsFor(workspace.cluster, routeId)
  const object = contents?.objects.find(candidate => candidate.id === objectId)
  if (!object || !contents) throw new Error('The selected route object no longer exists.')
  const updated = updateCatalogueObject(
    contents.objects, object, changes, workspace.objectFieldSettings, clusterObjects(workspace.cluster),
  )
  return {
    ...workspace,
    cluster: {
      ...workspace.cluster,
      routeContents: {
        ...workspace.cluster.routeContents,
        [routeId]: {
          ...contents,
          objects: contents.objects.map(candidate => candidate.id === objectId ? updated : candidate),
        },
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
