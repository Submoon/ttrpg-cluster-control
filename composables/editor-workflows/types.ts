/**
 * Shared editor contracts. Refs cross workflow boundaries; imperative handles acknowledge draft saves.
 */
import type { Ref } from 'vue'
import type {
  CatalogueSubtype,
  CustomFieldDefinition,
  CustomFieldApplicabilityTarget,
  CustomFieldType,
  LocalWorkspace,
  MapDeletionTarget,
  Orbit,
  OrbitRadii,
  Point,
  SystemObject,
  SystemObjectChanges,
} from '../../domain/workspace'
import type { MapImageExporter } from '../../utils/map-image-export'
import type { MapViewport, SvgViewportRect } from '../../utils/map-zoom'

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'
export type TransitionGuard = 'chart' | 'inspector' | null
export type TransitionDecision = 'apply' | 'discard' | 'stay'
export interface TransitionOptions {
  /** Keeps a resumable chart-name session open for a command independent of its captured chart target. */
  leaveChart?: boolean
  /** Lets a read-only dialog open while an entity draft remains owned by its Inspector session. */
  leaveEntitySession?: boolean
  /** Keeps a Jump Route draft open for a command independent of its captured route target. */
  leaveRouteSession?: boolean
}

/** String-backed form values owned above the object Inspector's presentation lifetime. */
export interface ObjectDraft {
  locationKey: string
  name: string
  description: string
  subtype: string
  placement: string
  x: string
  y: string
  atmosphere: string
  portClass: string
  jumpStationId: string
  customFieldValues: Record<string, string>
}

/** String-backed Orbit inputs; Detach remains an explicit map command. */
export interface OrbitDraft {
  targetOrder: string
  horizontalRadius: string
  verticalRadius: string
  centerX: string
  centerY: string
  rotation: string
}

/** Relationship values needed to detect changes to a captured host/placement chain. */
export interface EntityDependencyBaseline {
  objects: Array<Pick<SystemObject, 'id' | 'family' | 'subtype' | 'placement'>>
  orbits: Orbit[]
  orbitRadii: Record<string, OrbitRadii>
  orbitRotations: Record<string, number>
}

/** Immutable object values and definitions used to create one object draft. */
export interface ObjectEditBaseline {
  object: SystemObject
  values: ObjectDraft
  dependencies: EntityDependencyBaseline
  linkedStations: Array<Pick<SystemObject, 'id' | 'family' | 'subtype'>>
  customFieldDefinitions: CustomFieldDefinition[]
  nativeFieldOptions: {
    atmosphereOptions?: string[]
    portClassOptions?: string[]
  }
}

/** Immutable Orbit geometry, sibling ordering, and host-chain values used to create one Orbit draft. */
export interface OrbitEditBaseline {
  orbit: Orbit
  values: OrbitDraft
  effectiveRadii: OrbitRadii
  rotation: number
  siblings: Array<Pick<Orbit, 'id' | 'hostId' | 'order'>>
  dependencies: EntityDependencyBaseline
}

/** Parent-owned edit session that remains available while an Inspector is hidden or reflowed. */
export type EntityInspectorSession = {
  id: number
  clusterId: string
  systemId: string
  targetId: string
  errors: Record<string, string>
  error: string
} & (
  | { kind: 'object'; initial: ObjectEditBaseline; draft: ObjectDraft }
  | { kind: 'orbit'; initial: OrbitEditBaseline; draft: OrbitDraft }
)

/** Specific map/data commands checked against the active entity session's captured dependencies. */
export type EntityCommand =
  | { kind: 'object-placement'; objectId: string; fromOrbitId?: string | null; toOrbitId?: string | null }
  | { kind: 'object-create'; orbitId: string | null }
  | { kind: 'orbit-geometry'; orbitId: string }
  | { kind: 'orbit-host'; orbitId: string; hostId: string | null }
  | { kind: 'orbit-create'; hostId: string | null }
  | { kind: 'definition-mutation'; fieldId: string }
  | { kind: 'deletion'; target: MapDeletionTarget }

/** Persistent catalogue choice for one system-map creation session. */
export type SystemCreationType =
  | { kind: 'object'; subtype: CatalogueSubtype }
  | { kind: 'orbit' }

/** A normalized free point, Orbit parameter angle, or object host selected for creation. */
export type SystemCreationTarget =
  | { kind: 'free'; point: Point }
  | { kind: 'orbit'; orbitId: string; angle: number }
  | { kind: 'host'; objectId: string }

/** Named target offered to the Warden, including any current Inspector conflict. */
export interface SystemCreationCandidate {
  key: string
  label: string
  target: SystemCreationTarget
  error: string | null
}

/** One transient, single-use target preview. Orbit geometry is expressed in scene units. */
export interface SystemCreationPreview {
  id: number
  target: SystemCreationTarget
  radii?: OrbitRadii
  rotation?: number
}

/** Parent-owned Add state; presentation changes do not discard its type or form strings. */
export interface SystemCreationSession {
  id: number
  clusterId: string
  systemId: string
  type: SystemCreationType
  candidates: SystemCreationCandidate[]
  preview: SystemCreationPreview | null
  inputs: {
    x: string
    y: string
    orbitId: string
    angleDegrees: string
    hostId: string
    horizontalRadius: string
    verticalRadius: string
    rotation: string
    otherType: string
  }
  errors: Record<string, string>
  notice: string
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
  /** Whether a legacy presentation-local inspector form currently has unsaved edits. */
  hasUnsavedEdits(): boolean
  /** Whether the specified object editor owns an active draft. */
  isEditingObject(objectId: string): boolean
  /** Discards all active inspector drafts. */
  cancelEdits(): void
  /** Starts the currently selected object draft. */
  startObjectEdit(): void
  /** Starts the currently selected Orbit draft. */
  startOrbitEdit(): void
  /** Acknowledges a successful parent commit so the object editor may reset its draft. */
  objectSaveSucceeded(): void
  /** Acknowledges a successful parent commit so the Orbit editor may reset its draft. */
  orbitSaveSucceeded(): void
}

/** Shared SVG-coordinate view controls exposed by both map wrappers. */
export interface MapNavigationHandle extends MapImageExporter {
  getViewport(): MapViewport
  setViewport(viewport: MapViewport): void
  zoomBy(factor: number): void
  panBy(dx: number, dy: number): void
  fitMap(usableRect?: SvgViewportRect): void
  cancelActiveGesture(): void
  startViewPan(event: MouseEvent): void
  moveViewPan(event: MouseEvent): void
  endViewPan(): void
  startTouchNavigation(event: TouchEvent): void
  moveTouchNavigation(event: TouchEvent): void
  endTouchNavigation(event: TouchEvent): void
  /** Shows or clears one transient cluster-system move preview without rebuilding the map. */
  setClusterSystemPositionPreview?(systemId: string, position: Point | null): void
}

/** Session-only selection saved for one map visit. */
export type MapInteractionMode = 'navigate' | 'select' | 'move'
export type ClusterAddType = 'system' | 'route'
export type ClusterSystemPositionInput = 'x' | 'y'
export type ClusterSystemPositionInputs = Record<ClusterSystemPositionInput, string>
export interface ClusterSystemMovePreview {
  token: number
  clusterId: string
  sourceSystemId: string
  /** Saved normalized origin position, used to reject a stale source before confirmation. */
  originPosition: Point
  /** Normalized destination position shared by the form, map API, and workspace layout. */
  targetPosition: Point
}
export type WorkspacePanel = 'hierarchy' | 'inspector'
export type TransitionResult = { accepted: boolean }

export type MapVisitSelection =
  | { kind: 'system'; id: string; inspect?: boolean }
  | { kind: 'route'; id: string }
  | { kind: 'object'; id: string }
  | { kind: 'orbit'; id: string }
  | { kind: 'none' }

/** Session-only camera and selection, keyed by the owning cluster or system ID. */
export interface MapVisitMemory {
  viewport: MapViewport
  selection: MapVisitSelection
}

/** Renderer capabilities needed by system-map workflows. */
export interface SystemMapHandle extends MapNavigationHandle {
  /**
   * Finds a clear normalized center for detaching this Orbit.
   * Clearance is checked against object positions and other unoccupied centers, not whole Orbit rings.
   * @param orbitId Hosted Orbit whose former center is being relocated.
   * @returns Normalized map coordinates, or undefined when no candidate passes the point-clearance checks.
   */
  getDetachedOrbitCenter(orbitId: string): Point | undefined
  /** Resolves all named creation targets near a raw SVG scene point. */
  getCreationCandidates(point: Point, type: SystemCreationType): SystemCreationCandidate[]
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
