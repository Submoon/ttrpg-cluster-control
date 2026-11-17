import type { CatalogueSubtype, LocalWorkspace, OrbitRadii, Point } from '../domain/workspace'
import type { SystemCreationCandidate } from '../composables/editor-workflows/types'
import { orbitPointAtAngle } from './system-map-geometry'

export interface ContinuousObjectAddOwner {
  systemId: string
  candidates: SystemCreationCandidate[]
}

/** A click-time Add request carries its owning workspace independently from Inspector selection. */
export interface ContinuousObjectAddTarget {
  subtype: CatalogueSubtype
  otherType?: string
  workspaceSnapshot: LocalWorkspace
  directTarget: { kind: 'object' | 'orbit'; id: string } | null
  requiresOwnerChoice: boolean
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

export interface ContinuousObjectOwnerResolution {
  systemIds: string[]
  requiresOwnerChoice: boolean
}

export interface ContinuousOrbitAddKeyboardGeometry {
  sceneCenter: Point
  sceneRadii: OrbitRadii
  rotation: number
}

export interface ContinuousObjectAddCandidateSelection {
  candidate?: SystemCreationCandidate
  error: string | null
}

/** Resolves a definite hit first, then distinguishes a unique envelope from an ambiguous point. */
export function resolveContinuousObjectOwnerResolution(
  point: Point,
  systems: readonly ContinuousObjectOwnerEnvelope[],
  definiteOwnerId?: string | null,
): ContinuousObjectOwnerResolution {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    return { systemIds: [], requiresOwnerChoice: false }
  }
  if (definiteOwnerId && systems.some(system => system.id === definiteOwnerId)) {
    return { systemIds: [definiteOwnerId], requiresOwnerChoice: false }
  }

  const matches = systems.filter(({ envelope }) => point.x >= envelope.x
    && point.x <= envelope.x + envelope.width
    && point.y >= envelope.y
    && point.y <= envelope.y + envelope.height)
  if (matches.length === 1) return { systemIds: [matches[0]!.id], requiresOwnerChoice: false }
  if (matches.length > 1) return { systemIds: matches.map(system => system.id), requiresOwnerChoice: true }
  return { systemIds: systems.map(system => system.id), requiresOwnerChoice: systems.length > 0 }
}

/** Resolves a definite hit first; otherwise returns the unique envelope or all choices for ambiguity. */
export function resolveContinuousObjectOwnerIds(
  point: Point,
  systems: readonly ContinuousObjectOwnerEnvelope[],
  definiteOwnerId?: string | null,
): string[] {
  return resolveContinuousObjectOwnerResolution(point, systems, definiteOwnerId).systemIds
}

/** Chooses a legal creation target for an object or Orbit hit without mistaking occupied marks for placement. */
export function selectContinuousObjectAddCandidate(
  candidates: readonly SystemCreationCandidate[],
  directTarget: ContinuousObjectAddTarget['directTarget'],
): ContinuousObjectAddCandidateSelection {
  if (directTarget?.kind === 'object') {
    const nearbyOrbit = candidates.find(candidate => candidate.target.kind === 'orbit' && candidate.error === null)
    return nearbyOrbit
      ? { candidate: nearbyOrbit, error: null }
      : { error: 'This object mark is occupied. Choose an Orbit or clear map position.' }
  }
  if (directTarget?.kind === 'orbit') {
    const directOrbit = candidates.find(candidate => candidate.target.kind === 'orbit'
      && candidate.target.orbitId === directTarget.id)
    return directOrbit
      ? { candidate: directOrbit, error: directOrbit.error }
      : { error: 'Choose an eligible Orbit in the owning system.' }
  }
  const candidate = candidates[0]
  return candidate
    ? { candidate, error: candidate.error } as ContinuousObjectAddCandidateSelection
    : { error: 'Choose a valid placement target in the owning system.' }
}

/** Returns a keyboard placement point on the Orbit ring, translated into the Cluster scene. */
export function continuousOrbitAddKeyboardPoint(
  orbit: ContinuousOrbitAddKeyboardGeometry,
  sceneOffset: Point,
): Point {
  const point = orbitPointAtAngle(orbit.sceneCenter, orbit.sceneRadii, 0, orbit.rotation)
  return { x: point.x + sceneOffset.x, y: point.y + sceneOffset.y }
}
