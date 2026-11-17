import type { CatalogueSubtype, LocalWorkspace, Point } from '../domain/workspace'
import type { SystemCreationCandidate } from '../composables/editor-workflows/types'

export interface ContinuousObjectAddOwner {
  systemId: string
  candidates: SystemCreationCandidate[]
}

/** A click-time Add request carries its owning workspace independently from Inspector selection. */
export interface ContinuousObjectAddTarget {
  subtype: CatalogueSubtype
  workspaceSnapshot: LocalWorkspace
  directTarget: { kind: 'object' | 'orbit' | 'system'; id: string } | null
  owners: ContinuousObjectAddOwner[]
}

/** A committed Move request keeps the source owner and workspace captured by the gesture. */
export interface ContinuousObjectMoveTarget {
  systemId: string
  objectId: string
  position: Point
  workspaceSnapshot: LocalWorkspace
}

export interface ContinuousObjectOwnerEnvelope {
  id: string
  envelope: { x: number; y: number; width: number; height: number }
}

/** Resolves a definite hit first; otherwise returns the unique envelope or all choices for ambiguity. */
export function resolveContinuousObjectOwnerIds(
  point: Point,
  systems: readonly ContinuousObjectOwnerEnvelope[],
  definiteOwnerId?: string | null,
): string[] {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return []
  if (definiteOwnerId && systems.some(system => system.id === definiteOwnerId)) return [definiteOwnerId]

  const matches = systems.filter(({ envelope }) => point.x >= envelope.x
    && point.x <= envelope.x + envelope.width
    && point.y >= envelope.y
    && point.y <= envelope.y + envelope.height)
  if (matches.length === 1) return [matches[0]!.id]
  return (matches.length > 1 ? matches : systems).map(system => system.id)
}
