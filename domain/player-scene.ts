import type { PlayerClusterDocument, PlayerSystemDocument } from './player-projection'

/** A complete public cluster scene or the currently eligible Revealed system scene. */
export type CurrentPlayerMapScene =
  | { kind: 'jump-cluster'; document: PlayerClusterDocument }
  | { kind: 'star-system'; document: PlayerSystemDocument; label: string }

/** Cluster and viewport image exporters must handle every branch before dropping this guard. */
export const PLAYER_ROUTE_BRANCH_IMAGES_UNAVAILABLE = 'Cluster and viewport image export is unavailable while this player map contains route objects.'
