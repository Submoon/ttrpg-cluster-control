/** Typed workflow requests and sessions are shared between the Inspector and editor owner. */
export type {
  EntityCommand,
  EntityInspectorSession,
  JumpRouteSaveRequest,
  ObjectDraft,
  ObjectEditBaseline,
  ObjectEditRequest as MapObjectSaveRequest,
  OrbitDraft,
  OrbitEditBaseline,
  OrbitEditRequest,
} from '../../composables/editor-workflows/types'

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
