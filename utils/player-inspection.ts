import type { ClientRectBounds } from './map-usable-area'

/** Public target selected for consultation or a request to reveal on a player map. */
export type PlayerInspectionTarget =
  | { kind: 'object'; id: string }
  | { kind: 'orbit'; id: string }

/**
 * Reads the unobstructed client rectangle for a rendered map.
 * Returning null means a visible overlay currently blocks the map; an omitted reader keeps the full map usable.
 */
export type PlayerUsableRectReader = (mapClientRect: ClientRectBounds) => ClientRectBounds | null
