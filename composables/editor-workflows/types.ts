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

export interface EditorWorkflowOptions {
  workspace: Readonly<Ref<LocalWorkspace | null>>
  saveState: Readonly<Ref<SaveState>>
  saveError: Readonly<Ref<string | null>>
  commit: (nextWorkspace: LocalWorkspace) => Promise<void>
}

export interface MapInspectorHandle {
  hasUnsavedEdits(): boolean
  isEditingObject(objectId: string): boolean
  cancelEdits(): void
  beginRoute(): void
  startObjectEdit(): void
  startOrbitEdit(): void
  startRouteEdit(): void
  objectSaveSucceeded(): void
  orbitSaveSucceeded(): void
  routeSaveSucceeded(): void
}

export interface SystemMapHandle extends MapImageExporter {
  getDetachedOrbitCenter(orbitId: string): Point | undefined
}

export interface FieldDefinitionUpdateRequest {
  fieldId: string
  name: string
  options: string[]
  applicability: CustomFieldApplicabilityTarget[] | undefined
}

export interface CustomFieldCreateRequest {
  name: string
  type: CustomFieldType
  options: string[]
}

export interface ObjectEditRequest {
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
