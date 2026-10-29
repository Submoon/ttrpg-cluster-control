/**
 * Shared editor contracts for parent-owned sessions and map interactions.
 */
import type { Ref } from 'vue'
import type {
  CatalogueSubtype,
  CustomFieldDefinition,
  CustomFieldApplicabilityTarget,
  CustomFieldType,
  CustomFieldValue,
  LocalWorkspace,
  MapDeletionTarget,
  ObjectPlacement,
  Orbit,
  OrbitRadii,
  Point,
  SystemObject,
} from '../../domain/workspace'
import type { MapImageExporter } from '../../utils/map-image-export'
import type { MapViewport, SvgViewportRect } from '../../utils/map-zoom'
import type { WorkspaceHistoryCoordinator } from './workspace-mutations'

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'
export type MapHistoryTarget =
  | { kind: 'system' | 'route'; id: string }
  | { kind: 'object' | 'orbit'; id: string; systemId: string }
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

/** Current human-readable cascade summary owned by the deletion review workflow. */
export interface WorkspaceDeletionReview {
  id: number
  clusterId: string
  open: boolean
  suspended: boolean
  confirming: boolean
  target: MapDeletionTarget
  entityLabel: string
  affectedEntities: string[]
  effectSignature: string
  notice: string
  error: string
}

/** String-backed form values owned above the object Inspector's presentation lifetime. */
export interface ObjectDraft {
  locationKey: string
  name: string
  description: string
  subtype: string
  placement: string
  atmosphere: string
  portClass: string
  jumpStationId: string
  customFieldValues: Record<string, string>
}

/** String-backed Orbit inputs; Detach remains an explicit map command. */
export interface OrbitDraft {
  /** Proposed host for an Orbit whose committed center is unoccupied. */
  hostId: string | null
  targetOrder: string
  horizontalRadius: string
  verticalRadius: string
  rotation: string
}

/** Transient scene-space geometry for previewing a proposed host on an unoccupied Orbit. */
export interface OrbitPlacementPreview {
  center: Point
  radii: OrbitRadii
  /** Optional draft rotation in degrees; omitted previews use the committed value. */
  rotation?: number
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
  | {
      kind: 'orbit'
      initial: OrbitEditBaseline
      draft: OrbitDraft
      /** Pending named choices raised by an ambiguous unoccupied-center drag. */
      centerMoveCandidates: OrbitCenterMoveCandidate[] | null
    }
)

/** Specific map/data commands checked against the active entity session's captured dependencies. */
export type EntityCommand =
  | { kind: 'object-placement'; objectId: string; fromOrbitId?: string | null; toOrbitId?: string | null }
  | { kind: 'object-create'; orbitId: string | null }
  | { kind: 'orbit-geometry'; orbitId: string }
  | { kind: 'orbit-center-position'; orbitId: string }
  | { kind: 'orbit-host'; orbitId: string; hostId: string | null }
  | { kind: 'orbit-create'; hostId: string | null }
  | { kind: 'definition-mutation'; fieldId: string }
  | {
      kind: 'deletion'
      target: MapDeletionTarget
      /** IDs in the prepared cascade, including nested objects and routes removed through endpoints. */
      affectedSystemIds?: readonly string[]
      affectedObjectIds?: readonly string[]
      affectedRouteIds?: readonly string[]
    }

/** Explicit destination for an existing object. */
export type SystemObjectMoveTarget =
  | { kind: 'orbit'; orbitId: string; angle: number }
  | { kind: 'free'; point: Point }

export const FREE_SYSTEM_OBJECT_PLACEMENT = '__free__'

/** Accessible label/value pair offered by the existing-object Destination selector. */
export interface SystemObjectMoveDestinationOption {
  label: string
  value: string
}

/** One Orbit ring intersected by an existing-object drag release. */
export interface SystemObjectMoveCandidate {
  key: string
  label: string
  target: Extract<SystemObjectMoveTarget, { kind: 'orbit' }>
  /** Null means the candidate remains eligible after the latest parent-side validation. */
  error: string | null
}

/** One transient, single-use placement preview for an existing system object. */
export interface SystemObjectMovePreview {
  token: number
  clusterId: string
  systemId: string
  objectId: string
  target: SystemObjectMoveTarget
}

/** A single-use unoccupied-center preview; both centers use normalized system-map coordinates. */
export interface OrbitCenterMovePreview {
  token: number
  clusterId: string
  systemId: string
  orbitId: string
  previousCenter: Point
  targetCenter: Point
}

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

/** Host or free-center choice raised when an Orbit center drag overlaps multiple candidates. */
export type OrbitCenterMoveCandidate = Omit<SystemCreationCandidate, 'target'> & {
  target: Extract<SystemCreationTarget, { kind: 'host' | 'free' }>
}

/** One transient, single-use target preview. Orbit geometry is expressed in scene units. */
export interface SystemCreationPreview {
  id: number
  target: SystemCreationTarget
  radii?: OrbitRadii
  rotation?: number
}

export interface SystemCreationInputs {
  x: string
  y: string
  orbitId: string
  hostId: string
  horizontalRadius: string
  verticalRadius: string
  rotation: string
  otherType: string
}

/** Parent-owned Add state; presentation changes do not discard its type or form strings. */
export interface SystemCreationSession {
  id: number
  clusterId: string
  systemId: string
  type: SystemCreationType
  candidates: SystemCreationCandidate[]
  preview: SystemCreationPreview | null
  inputs: SystemCreationInputs
  /** Values after the latest applied placement, so an armed clean Add tool doesn't block history. */
  appliedInputs: SystemCreationInputs
  errors: Record<string, string>
  notice: string
}

export interface EditorWorkflowOptions {
  /** Current committed in-memory workspace, or null before one exists. */
  workspace: Readonly<Ref<LocalWorkspace | null>>
  /** Shared application boundary for ordinary editor mutations. */
  mutations: WorkspaceHistoryCoordinator
  /** Publishes the first workspace as an explicit baseline, not as an editing action. */
  initializeWorkspace: (nextWorkspace: LocalWorkspace) => Promise<void>
  /** Current durable-save status, distinct from immediate in-memory publication. */
  saveState: Readonly<Ref<SaveState>>
  /** Most recent durable-save failure, if any. */
  saveError: Readonly<Ref<string | null>>
}

/** Trusted position-only publication; angles are effective radians only for Orbit placements. */
export interface CommittedObjectPosition {
  objectId: string
  previousPlacement: ObjectPlacement
  nextPlacement: ObjectPlacement
  previousAngle?: number
  nextAngle?: number
  command: Extract<EntityCommand, { kind: 'object-placement' }>
}

/** Accepted map move of an unoccupied Orbit center, used to rebase only its originating Inspector session. */
export interface CommittedOrbitCenterPosition {
  orbitId: string
  previous: Point
  next: Point
  command: Extract<EntityCommand, { kind: 'orbit-center-position' }>
}

/** Shared SVG-coordinate view controls exposed by both map wrappers. */
export interface MapNavigationHandle extends MapImageExporter {
  /** Focuses the current SVG so a map-based placement can use keyboard targeting. */
  focusMap?(): void
  getViewport(): MapViewport
  /** Scene-dependent camera floor; maps without an expanded scene retain the shared default. */
  getMinimumZoomScale?(): number
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
  /** Minimally pans to reveal a retained-history target without changing zoom or panel state. */
  revealHistoryTarget?(target: MapHistoryTarget): boolean
  /** Stable keyboard target when a traversal removes the focused map item. */
  focusMap?(): void
  /** Shows or clears one transient cluster-system move preview without rebuilding the map. */
  setClusterSystemPositionPreview?(systemId: string, position: Point | null): void
  /** Shows or clears a transient unresolved target in scene coordinates. */
  setUnresolvedExitPositionPreview?(routeId: string, position: Point | null): void
}

/** Session-only selection saved for one map visit. */
export type MapInteractionMode = 'navigate' | 'select' | 'move'
export type ClusterAddType = 'system' | 'route'
export interface ClusterSystemMovePreview {
  token: number
  clusterId: string
  sourceSystemId: string
  /** Saved normalized origin position, used to reject a stale source before confirmation. */
  originPosition: Point
  /** Normalized destination shared by the map preview and durable workspace layout. */
  targetPosition: Point
}
export type WorkspacePanel = 'hierarchy' | 'inspector'

/** Single-use request to focus a newly created object's first edit field after its Inspector renders. */
export interface ObjectInspectorFocusRequest {
  id: number
  objectId: string
}

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
  focusMap(): void
  /** Shows or clears one transient existing-object placement preview in SVG scene coordinates. */
  setObjectPlacementPreview(objectId: string, scenePoint: Point | null): void
  /** Shows or clears one transient proposed-host preview in SVG scene coordinates. */
  setOrbitPlacementPreview(orbitId: string, preview: OrbitPlacementPreview | null): void
  /** Owns a center-move overlay independently from an Inspector's proposed-host preview. */
  setOrbitCenterMovePreview(orbitId: string, scenePoint: Point | null): void
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
export type FieldDefinitionsScreen = 'list' | 'detail' | 'edit' | 'new'

/** Raw strings owned by the parent session while a definition is being edited. */
export interface FieldDefinitionDraft {
  name: string
  type: CustomFieldType
  /** Newline-delimited option input, retained even while another type is selected. */
  options: string
  applicability: CustomFieldApplicabilityTarget[] | undefined
}

/** Read-only record for the two built-in object fields shown beside reusable definitions. */
export interface NativeFieldDefinitionSnapshot {
  id: 'native:atmosphere' | 'native:port-class'
  name: string
  type: 'single-select'
  options: string[]
  applicability?: undefined
}

export type FieldDefinitionSnapshot = CustomFieldDefinition | NativeFieldDefinitionSnapshot

/** Parent-owned field management state; keeping this plain lets Vue props stay unwrapped. */
export interface FieldDefinitionsSessionState {
  open: boolean
  screen: FieldDefinitionsScreen
  selectedId: string | null
  draft: (FieldDefinitionDraft & { baseline: FieldDefinitionSnapshot }) | null
  createDraft: FieldDefinitionDraft | null
  pendingGuard: FieldDefinitionsIntent | null
  review: FieldDefinitionMutationReview | null
  error: string | null
  listPosition: { scrollTop: number; focusedFieldId: string | null }
  /** Monotonic parent acknowledgement after a field mutation is applied in memory. */
  appliedAck: number
}

/** User actions emitted by the field-management presentation for parent-side resolution. */
export type FieldDefinitionsIntent =
  | { kind: 'open' }
  | { kind: 'close' }
  | { kind: 'back' }
  | { kind: 'select-field'; fieldId: string }
  | { kind: 'edit-field'; fieldId: string }
  | { kind: 'new-field' }
  | { kind: 'cancel-create' }
  | { kind: 'cancel-edit' }
  | { kind: 'patch-definition'; patch: Partial<FieldDefinitionDraft> }
  | { kind: 'patch-create'; patch: Partial<FieldDefinitionDraft> }
  | { kind: 'remember-list'; position: { scrollTop: number; focusedFieldId: string | null } }
  | { kind: 'save-field' }
  | { kind: 'delete-field'; fieldId: string }
  | { kind: 'confirm-review' }
  | { kind: 'cancel-review' }
  | { kind: 'resolve-transition'; decision: TransitionDecision }

/** Consequence shown before resolving an entity draft or applying a field mutation. */
export interface FieldDefinitionReviewImpact {
  systemId: string
  systemName: string
  objectId: string
  objectName: string
  value: CustomFieldValue
  nextValue?: CustomFieldValue
  resolution: 'preserve' | 'clear' | 'remove'
}

/** Read-only prepared consequences for the currently selected field mutation. */
export interface FieldDefinitionMutationReview {
  fieldId: string
  fieldName: string
  operation: 'update' | 'remove'
  fromType?: CustomFieldType
  toType?: CustomFieldType
  removedOptions?: string[]
  impacts: FieldDefinitionReviewImpact[]
}

export interface FieldDefinitionUpdateRequest {
  fieldId: string
  name: string
  type: CustomFieldType
  options: string[]
  applicability: CustomFieldApplicabilityTarget[] | undefined
}

/** New reusable field submitted by the definition dialog. */
export interface CustomFieldCreateRequest {
  name: string
  type: CustomFieldType
  options: string[]
}
