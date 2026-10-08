/**
 * Typed commands and exposed handles connect draft-owning inspector panels to page-owned workflows.
 */
import type {
  OrbitRadii,
  Point,
  SystemObjectChanges,
} from '../../domain/workspace'

export interface MapObjectSaveRequest {
  /** Stable object identity in the selected system. */
  objectId: string
  /** Changed object values; omitted fields retain their committed values. */
  changes: SystemObjectChanges
}

/** Candidate Orbit form values sent to the parent after local validation. */
export interface OrbitEditRequest {
  /** Stable Orbit identity. */
  orbitId: string
  /** One-based sibling order under the same host. */
  targetOrder: number
  /** Horizontal/vertical radii in SVG scene units. */
  radii: OrbitRadii
  /** Normalized map center, present only for an unoccupied Orbit. */
  center?: Point
}

/** Candidate route form values; destination null denotes an unresolved external exit. */
export interface JumpRouteSaveRequest {
  /** Existing route ID for edit, or null to create. */
  routeId: string | null
  jumpLevel: number
  fromPointId: string
  toPointId: string | null
  /** Required domain label for an external destination; ignored for a known endpoint. */
  unresolvedExit: string
}

/** Imperative boundary for local object drafts and parent save acknowledgements. */
export interface MapObjectInspectorHandle {
  /** True while this panel has an active unsaved object draft. */
  hasUnsavedEdits(): boolean
  /** Checks whether a particular object ID owns the active draft. */
  isEditingObject(objectId: string): boolean
  /** Discards the draft and optionally clears the parent-visible error. */
  cancelEdits(clearError?: boolean): void
  startObjectEdit(): void
  /** Clears the submitted draft only after the parent workspace commit succeeds. */
  objectSaveSucceeded(): void
}

/** Imperative boundary for local Orbit drafts and parent save acknowledgements. */
export interface OrbitInspectorHandle {
  hasUnsavedEdits(): boolean
  cancelEdits(clearError?: boolean): void
  startOrbitEdit(): void
  /** Clears the submitted draft only after the parent workspace commit succeeds. */
  orbitSaveSucceeded(): void
}

/** Imperative boundary for local route drafts and parent save acknowledgements. */
export interface JumpRouteInspectorHandle {
  hasUnsavedEdits(): boolean
  cancelEdits(clearError?: boolean): void
  beginRoute(): void
  startRouteEdit(): void
  /** Closes the submitted form only after the parent workspace commit succeeds. */
  routeSaveSucceeded(): void
}
