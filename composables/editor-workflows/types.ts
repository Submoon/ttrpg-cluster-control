/**
 * Shared editor contracts. Refs cross workflow boundaries; imperative handles acknowledge draft saves.
 */
import type { Ref } from 'vue'
import type {
  CustomFieldApplicabilityTarget,
  CustomFieldType,
  LocalWorkspace,
  OrbitRadii,
  Point,
  SystemObjectChanges,
} from '../../domain/workspace'
import type { MapImageExporter } from '../../utils/map-image-export'

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'
export type TransitionGuard = 'chart' | 'inspector' | null
export type TransitionDecision = 'apply' | 'discard' | 'stay'
export interface TransitionOptions {
  /** Keeps a resumable chart-name session open for a command independent of its captured chart target. */
  leaveChart?: boolean
}

export interface EditorWorkflowOptions {
  /** Current committed in-memory workspace, or null before one exists. */
  workspace: Readonly<Ref<LocalWorkspace | null>>
  /** Current durable-save status, distinct from immediate in-memory publication. */
  saveState: Readonly<Ref<SaveState>>
  /** Most recent durable-save failure, if any. */
  saveError: Readonly<Ref<string | null>>
  /** Page-owned ordered persistence operation. */
  commit: (nextWorkspace: LocalWorkspace) => Promise<void>
  /** Synchronously validates and publishes applied memory, returning its independent durable write. */
  applyWorkspace: (nextWorkspace: LocalWorkspace) => { durable: Promise<void> }
}

/** Imperative bridge from workflow commands to inspector-local draft state. */
export interface MapInspectorHandle {
  /** Whether any child inspector currently has unsaved form edits. */
  hasUnsavedEdits(): boolean
  /** Whether the specified object editor owns an active draft. */
  isEditingObject(objectId: string): boolean
  /** Discards all active inspector drafts. */
  cancelEdits(): void
  /** Starts a route-creation draft. */
  beginRoute(): void
  /** Starts the currently selected object draft. */
  startObjectEdit(): void
  /** Starts the currently selected Orbit draft. */
  startOrbitEdit(): void
  /** Starts the currently selected route draft. */
  startRouteEdit(): void
  /** Acknowledges a successful parent commit so the object editor may reset its draft. */
  objectSaveSucceeded(): void
  /** Acknowledges a successful parent commit so the Orbit editor may reset its draft. */
  orbitSaveSucceeded(): void
  /** Acknowledges a successful parent commit so the route editor may reset its draft. */
  routeSaveSucceeded(): void
}

/** Renderer capabilities needed by system-map workflows. */
export interface SystemMapHandle extends MapImageExporter {
  /**
   * Finds a clear normalized center for detaching this Orbit.
   * Clearance is checked against object positions and other unoccupied centers, not whole Orbit rings.
   * @param orbitId Hosted Orbit whose former center is being relocated.
   * @returns Normalized map coordinates, or undefined when no candidate passes the point-clearance checks.
   */
  getDetachedOrbitCenter(orbitId: string): Point | undefined
}

/** Values submitted from a field-definition draft after the UI's confirmation step. */
export interface FieldDefinitionUpdateRequest {
  fieldId: string
  name: string
  options: string[]
  applicability: CustomFieldApplicabilityTarget[] | undefined
}

/** New reusable field submitted by the definition dialog. */
export interface CustomFieldCreateRequest {
  name: string
  type: CustomFieldType
  options: string[]
}

/** One validated candidate object edit awaiting a parent commit. */
export interface ObjectEditRequest {
  objectId: string
  changes: SystemObjectChanges
}

/** Orbit form values; radii use scene units and center, when present, is normalized map position. */
export interface OrbitEditRequest {
  orbitId: string
  targetOrder: number
  radii: OrbitRadii
  center?: Point
}

/** Route form values; null destination requires an unresolved-exit label. */
export interface JumpRouteSaveRequest {
  routeId: string | null
  jumpLevel: number
  fromPointId: string
  toPointId: string | null
  unresolvedExit: string
}
