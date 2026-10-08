import type {
  OrbitRadii,
  Point,
  SystemObjectChanges,
} from '../../domain/workspace'

export interface MapObjectSaveRequest {
  objectId: string
  changes: SystemObjectChanges
}

export interface OrbitEditRequest {
  orbitId: string
  targetOrder: number
  radii: OrbitRadii
  center?: Point
}

export interface JumpRouteSaveRequest {
  routeId: string | null
  jumpLevel: number
  fromPointId: string
  toPointId: string | null
  unresolvedExit: string
}

export interface MapObjectInspectorHandle {
  hasUnsavedEdits(): boolean
  isEditingObject(objectId: string): boolean
  cancelEdits(clearError?: boolean): void
  startObjectEdit(): void
  objectSaveSucceeded(): void
}

export interface OrbitInspectorHandle {
  hasUnsavedEdits(): boolean
  cancelEdits(clearError?: boolean): void
  startOrbitEdit(): void
  orbitSaveSucceeded(): void
}

export interface JumpRouteInspectorHandle {
  hasUnsavedEdits(): boolean
  cancelEdits(clearError?: boolean): void
  beginRoute(): void
  startRouteEdit(): void
  routeSaveSucceeded(): void
}
