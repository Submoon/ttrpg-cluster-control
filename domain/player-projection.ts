/** Allowlisted Warden-side player projection with no dependency on editor or persistence state. */
import type { LocalWorkspace, Point } from './workspace-model'
import { clusterSystemPosition } from '../utils/cluster-map-geometry'

export type PlayerSystemMarker = {
  id: string
  position: Point
} & (
  | { disclosure: 'unknown'; label: 'Unknown presence' }
  | { disclosure: 'known-type'; type: 'star-system'; label: 'Star system' }
  | { disclosure: 'revealed'; type: 'star-system'; label: string }
)

/** Public Cluster document. Its shape is intentionally independent from the full source workspace. */
export interface PlayerClusterDocument {
  format: 'ttrpg-cluster-control-player'
  version: 1
  title: string
  systems: PlayerSystemMarker[]
}

/**
 * Builds the public marker document from committed Cluster data using an explicit field allowlist.
 * Public IDs are assigned after Hidden systems are filtered, and saved normalized positions are
 * converted into scene coordinates without accepting gesture or preview overrides.
 */
export function projectPlayerCluster(workspace: LocalWorkspace): PlayerClusterDocument {
  const systems: PlayerSystemMarker[] = []
  for (const system of workspace.cluster.systems) {
    if (system.publication === 'hidden') continue

    const markerId = `system-${systems.length + 1}`
    const position = clusterSystemPosition(workspace.layout.systemPositions, system.id)
    if (system.publication === 'unknown') {
      systems.push({ id: markerId, position, disclosure: 'unknown', label: 'Unknown presence' })
    } else if (system.publication === 'known-type') {
      systems.push({
        id: markerId,
        position,
        disclosure: 'known-type',
        type: 'star-system',
        label: 'Star system',
      })
    } else if (system.publication === 'revealed') {
      systems.push({
        id: markerId,
        position,
        disclosure: 'revealed',
        type: 'star-system',
        label: system.name,
      })
    }
  }

  return {
    format: 'ttrpg-cluster-control-player',
    version: 1,
    title: workspace.cluster.playerTitle,
    systems,
  }
}
