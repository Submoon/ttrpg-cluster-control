import type { JumpCluster, Point, StarSystem } from '../../domain/workspace'
import type { SystemMapGeometry } from '../../utils/system-map-geometry'

/** Scene-only projected content; Warden commands continue to use the applied map props. */
export interface WardenClusterMapPresentation {
  cluster: JumpCluster
  systemPositions: Record<string, Point>
  unresolvedExitPositions: Record<string, Point>
}

/** Scene-only projected content; Warden commands continue to use the applied map props. */
export interface WardenSystemMapPresentation {
  system: StarSystem
  geometry: SystemMapGeometry
}
