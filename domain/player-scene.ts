import type { PlayerClusterDocument, PlayerSystemDocument } from './player-projection'

/** A complete public cluster scene or the currently eligible Revealed system scene. */
export type CurrentPlayerMapScene =
  | { kind: 'jump-cluster'; document: PlayerClusterDocument }
  | { kind: 'star-system'; document: PlayerSystemDocument; label: string }

export function playerClusterHasPublicFeatures(document: PlayerClusterDocument): boolean {
  return document.systems.length > 0 || document.routes.length > 0 || document.routeBranches.length > 0
}
