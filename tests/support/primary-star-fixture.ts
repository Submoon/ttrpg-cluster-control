import {
  addStarSystem,
  createLocalWorkspace,
  createSystemObject,
  replaceWorkspaceSystem,
  type LocalWorkspace,
  type StarSystem,
} from '../../domain/workspace'

/** Supplies the centered stellar host used by legacy campaign fixtures. */
function withPrimaryStar(zone: StarSystem): StarSystem {
  const star = createSystemObject(zone, 'star')
  return {
    ...zone,
    objects: [...zone.objects, {
      ...star,
      name: 'Primary Star',
      locationKey: 'A',
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
  const system = withPrimaryStar(added.system)
  return { workspace: replaceWorkspaceSystem(added.workspace, system), system }
}
