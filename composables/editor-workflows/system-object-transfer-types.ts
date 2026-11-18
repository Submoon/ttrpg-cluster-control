import type { DeepReadonly } from 'vue'
import type {
  LocalWorkspace,
  Point,
  StarSystem,
  SystemObjectTransferPlacement,
  SystemObjectTransferRequest,
  SystemObjectTransferReview,
} from '../../domain/workspace'

export interface SystemObjectTransferReviewState {
  readonly sessionId: number
  readonly open: boolean
  readonly placingOnMap: boolean
  readonly confirming: boolean
  readonly error: string | null
  readonly sourceSystemId: string
  readonly rootObjectId: string
  readonly destinationSystemId: string | null
  readonly destinationSystems: readonly DeepReadonly<StarSystem>[]
  readonly placement: DeepReadonly<SystemObjectTransferPlacement> | null
  readonly inputGeneration: number
  readonly request: DeepReadonly<SystemObjectTransferRequest> | null
  readonly review: DeepReadonly<SystemObjectTransferReview> | null
  readonly sourceWorkspace: DeepReadonly<LocalWorkspace> | null
  readonly previewWorkspace: DeepReadonly<LocalWorkspace> | null
  readonly movedObjectIds: readonly string[]
  readonly movedOrbitIds: readonly string[]
  readonly locationKeys: ReadonlyMap<string, string>
  readonly validationErrors: ReadonlyMap<string, string>
  readonly canAccept: boolean
  readonly stale: boolean
}

export type SystemObjectTransferIntent =
  | { kind: 'open'; sourceSystemId: string; rootObjectId: string }
  | { kind: 'select-destination'; sessionId: number; systemId: string }
  | { kind: 'choose-free-placement'; sessionId: number; point: Point }
  | { kind: 'choose-orbit-placement'; sessionId: number; orbitId: string; angle: number }
  | { kind: 'set-location-key'; sessionId: number; objectId: string; value: string }
  | { kind: 'place-on-map'; sessionId: number }
  | { kind: 'cancel-map-placement'; sessionId: number; lease: SystemObjectTransferMapPlacementLease }
  | { kind: 'apply'; sessionId: number }
  | { kind: 'cancel'; sessionId: number }

/** A single-use map-input lease tied to the transfer and the exact mounted destination renderer. */
export interface SystemObjectTransferMapPlacementLease {
  readonly sessionId: number
  readonly inputGeneration: number
  readonly placementGeneration: number
  readonly destinationSystemId: string
  readonly rootObjectId: string
  /** The explicit Free or Orbit choice captured when map input begins. Pointer position supplies only its coordinates/angle. */
  readonly placementCandidate: DeepReadonly<SystemObjectTransferPlacement>
  readonly workspaceReference: LocalWorkspace
  readonly appliedRevision: number
  readonly mapOwner: object
}

/** One accepted primary-pointer release expressed in destination-local normalized coordinates. */
export interface SystemObjectTransferMapAnchor {
  readonly lease: SystemObjectTransferMapPlacementLease
  readonly placement: SystemObjectTransferPlacement
}

/** Pointer movement may leave the map while the placement gesture remains captured. */
export interface SystemObjectTransferMapPointerPreview {
  readonly lease: SystemObjectTransferMapPlacementLease
  readonly placement: SystemObjectTransferPlacement | null
}

export interface SystemObjectTransferWorkflowState {
  readonly session: SystemObjectTransferReviewState | null
  readonly pendingMapPlacement: SystemObjectTransferMapPlacementLease | null
}

/** Renderer-only ghost branch; never merged into map images or exported geometry. */
export interface SystemObjectTransferMapPreview {
  readonly sessionId: number
  readonly sourceSystemId: string
  readonly rootObjectId: string
  readonly destinationSystemId: string
  readonly previewWorkspace: DeepReadonly<LocalWorkspace>
  readonly movedObjectIds: readonly string[]
  readonly movedOrbitIds: readonly string[]
}
