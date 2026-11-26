import {
  addStarSystem,
  createLocalWorkspace,
  createSystemObject,
  replaceWorkspaceSystem,
  type LocalWorkspace,
  type StarSystem,
  type CatalogueObject,
} from '../../domain/workspace'
import { clusterObjects } from '../../domain/workspace-location-keys'

/** Supplies the centered stellar host used by legacy campaign fixtures. */
function withPrimaryStar(zone: StarSystem, keyOwners?: readonly CatalogueObject[]): StarSystem {
  const star = createSystemObject(zone, 'star', undefined, keyOwners)
  return {
    ...zone,
    objects: [...zone.objects, {
      ...star,
      name: 'Primary Star',
      locationKey: keyOwners === undefined ? 'A' : star.locationKey,
      placement: { kind: 'system', x: 0.5, y: 0.5 },
    }],
  }
}

export function createWorkspaceWithPrimaryStar(clusterName: string, zoneName: string): LocalWorkspace {
  const workspace = createLocalWorkspace(clusterName, zoneName)
  return replaceWorkspaceSystem(workspace, withPrimaryStar(workspace.cluster.systems[0]!))
}

export function addZoneWithPrimaryStar(workspace: LocalWorkspace, zoneName?: string) {
  const added = addStarSystem(workspace, zoneName)
  const system = withPrimaryStar(added.system, clusterObjects(workspace.cluster))
  return { workspace: replaceWorkspaceSystem(added.workspace, system), system }
}
