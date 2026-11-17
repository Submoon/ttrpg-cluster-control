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
  readonly workspaceReference: LocalWorkspace
  readonly appliedRevision: number
  readonly mapOwner: object
}

export interface SystemObjectTransferWorkflowState {
  readonly session: SystemObjectTransferReviewState | null
  readonly pendingMapPlacement: SystemObjectTransferMapPlacementLease | null
}
