import { onMounted, onUnmounted, type ComputedRef, type Ref, type ShallowRef } from 'vue'
import {
  addStarSystem,
  createJumpRoute,
  planMapEntityDeletion,
  updateJumpRoute,
  type JumpRoute,
  type LocalWorkspace,
  type MapDeletionTarget,
  type Orbit,
  type StarSystem,
  type SystemObject,
} from '../../domain/workspace'
import type { MapInspectorHandle, SaveState, JumpRouteSaveRequest } from './types'

interface ClusterWorkflowOptions {
  workspace: Readonly<Ref<LocalWorkspace | null>>
  commit: (nextWorkspace: LocalWorkspace) => Promise<void>
  saveState: Readonly<Ref<SaveState>>
  activeView: Ref<'cluster' | 'system'>
  selectedSystemId: Ref<string | null>
  selectedObjectId: Ref<string | null>
  selectedOrbitId: Ref<string | null>
  selectedRouteId: Ref<string | null>
  chartNamesEditing: Ref<boolean>
  fieldDefinitionDialogOpen: Ref<boolean>
  selectedSystem: Readonly<ComputedRef<StarSystem | undefined>>
  selectedObject: Readonly<ComputedRef<SystemObject | undefined>>
  selectedOrbit: Readonly<ComputedRef<Orbit | undefined>>
  selectedRoute: Readonly<ComputedRef<JumpRoute | undefined>>
  mapInspectorRef: ShallowRef<MapInspectorHandle | null>
  confirmDiscardInspectorEdits: () => boolean
  editorError: Ref<string>
}

export function useClusterWorkflows({
  workspace,
  commit,
  saveState,
  activeView,
  selectedSystemId,
  selectedObjectId,
  selectedOrbitId,
  selectedRouteId,
  chartNamesEditing,
  fieldDefinitionDialogOpen,
  selectedSystem,
  selectedObject,
  selectedOrbit,
  selectedRoute,
  mapInspectorRef,
  confirmDiscardInspectorEdits,
  editorError,
}: ClusterWorkflowOptions) {
  function errorText(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
  }

  async function createSystem(): Promise<void> {
    const currentWorkspace = workspace.value
    if (!currentWorkspace || !confirmDiscardInspectorEdits()) return

    try {
      const result = addStarSystem(currentWorkspace)
      selectedSystemId.value = result.system.id
      selectedObjectId.value = null
      selectedOrbitId.value = null
      selectedRouteId.value = null
      editorError.value = ''
      await commit(result.workspace)
    } catch (error) {
      editorError.value = errorText(error)
    }
  }

  function beginRoute(): void {
    if (!confirmDiscardInspectorEdits()) return
    selectedRouteId.value = null
    mapInspectorRef.value?.beginRoute()
    editorError.value = ''
  }

  function beginRouteEdit(routeId: string): void {
    if (selectedRoute.value?.id !== routeId || !confirmDiscardInspectorEdits()) return
    mapInspectorRef.value?.startRouteEdit()
    editorError.value = ''
  }

  function restoreRouteSelection(routeId: string | null): void {
    selectedRouteId.value = routeId
  }

  async function submitRoute(request: JumpRouteSaveRequest): Promise<void> {
    const currentWorkspace = workspace.value
    if (!currentWorkspace) return

    try {
      const route = request.routeId
        ? updateJumpRoute(
            currentWorkspace.cluster,
            request.routeId,
            request.jumpLevel,
            request.fromPointId,
            request.toPointId,
            request.unresolvedExit,
          )
        : createJumpRoute(
            currentWorkspace.cluster,
            request.jumpLevel,
            request.fromPointId,
            request.toPointId,
            request.unresolvedExit,
          )
      const routes = currentWorkspace.cluster.routes.some(existing => existing.id === route.id)
        ? currentWorkspace.cluster.routes.map(existing => existing.id === route.id ? route : existing)
        : [...currentWorkspace.cluster.routes, route]
      await commit({
        ...currentWorkspace,
        cluster: {
          ...currentWorkspace.cluster,
          routes,
        },
      })
      selectedRouteId.value = route.id
      mapInspectorRef.value?.routeSaveSucceeded()
      editorError.value = ''
    } catch (error) {
      editorError.value = errorText(error)
    }
  }

  async function deleteMapEntity(target: MapDeletionTarget): Promise<void> {
    const currentWorkspace = workspace.value
    if (!currentWorkspace || saveState.value === 'saving') return

    try {
      const plan = planMapEntityDeletion(currentWorkspace, target)
      const confirmation = plan.affectedEntities.length
        ? `Delete ${plan.entityLabel}?\n\nThis also removes or updates:\n${plan.affectedEntities.map(entity => `- ${entity}`).join('\n')}`
        : `Delete ${plan.entityLabel}?`
      if (!window.confirm(confirmation)) {
        return
      }
      editorError.value = ''
      await commit(plan.workspace)
    } catch (error) {
      editorError.value = errorText(error)
    }
  }

  function deleteSystem(systemId: string): Promise<void> {
    return confirmDiscardInspectorEdits()
      ? deleteMapEntity({ kind: 'system', systemId })
      : Promise.resolve()
  }

  function deleteSelectedObject(): Promise<void> {
    const system = selectedSystem.value
    const object = selectedObject.value
    return system && object
      ? deleteMapEntity({ kind: 'object', systemId: system.id, objectId: object.id })
      : Promise.resolve()
  }

  function deleteSelectedOrbit(): Promise<void> {
    const system = selectedSystem.value
    const orbit = selectedOrbit.value
    return system && orbit
      ? deleteMapEntity({ kind: 'orbit', systemId: system.id, orbitId: orbit.id })
      : Promise.resolve()
  }

  function deleteSelectedRoute(): Promise<void> {
    const route = selectedRoute.value
    return route
      ? deleteMapEntity({ kind: 'route', routeId: route.id })
      : Promise.resolve()
  }

  function handleDeleteShortcut(event: KeyboardEvent): void {
    const target = event.target
    if (
      event.key !== 'Delete'
      || event.repeat
      || event.defaultPrevented
      || event.altKey
      || event.ctrlKey
      || event.metaKey
      || (target instanceof HTMLElement && (
        target.isContentEditable
        || target.closest('input, textarea, select, [contenteditable="true"]')
      ))
      || saveState.value === 'saving'
      || (mapInspectorRef.value?.hasUnsavedEdits() ?? false)
      || chartNamesEditing.value
      || fieldDefinitionDialogOpen.value
    ) return

    const removeSelected = activeView.value === 'cluster'
      ? selectedRoute.value ? deleteSelectedRoute : undefined
      : selectedObject.value
        ? deleteSelectedObject
        : selectedOrbit.value
          ? deleteSelectedOrbit
          : undefined
    if (!removeSelected) return

    event.preventDefault()
    void removeSelected()
  }

  onMounted(() => {
    window.addEventListener('keydown', handleDeleteShortcut)
  })
  onUnmounted(() => window.removeEventListener('keydown', handleDeleteShortcut))

  return {
    createSystem,
    beginRoute,
    beginRouteEdit,
    restoreRouteSelection,
    submitRoute,
    deleteSystem,
    deleteSelectedObject,
    deleteSelectedOrbit,
    deleteSelectedRoute,
  }
}
