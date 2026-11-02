import type { PlayerClusterDocument, PlayerSystemDocument } from './player-projection'

/** A complete public cluster scene or the currently eligible Revealed system scene. */
export type CurrentPlayerMapScene =
  | { kind: 'jump-cluster'; document: PlayerClusterDocument }
  | { kind: 'star-system'; document: PlayerSystemDocument; label: string }
