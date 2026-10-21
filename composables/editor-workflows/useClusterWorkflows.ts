/**
 * Cluster commands coordinate selection and confirmation, then delegate persistence through the injected commit.
 */
import { onMounted, onUnmounted, type ComputedRef, type Ref, type ShallowRef } from 'vue'
import {
  addStarSystem,
  planMapEntityDeletion,
  type JumpRoute,
  type LocalWorkspace,
  type MapDeletionTarget,
  type Orbit,
  type StarSystem,
  type SystemObject,
} from '../../domain/workspace'
import type {
  MapInspectorHandle,
  EntityCommand,
  SaveState,
  TransitionOptions,
} from './types'
import type { RouteInspectorSession } from './useRouteInspectorSession'

interface ClusterWorkflowOptions {
  workspace: Readonly<Ref<LocalWorkspace | null>>
  commit: (nextWorkspace: LocalWorkspace) => Promise<void>
  saveState: Readonly<Ref<SaveState>>
  activeView: Ref<'cluster' | 'system'>
  selectedSystemId: Ref<string | null>
  selectedObjectId: Ref<string | null>
  selectedOrbitId: Ref<string | null>
  selectedRouteId: Ref<string | null>
  chartNamesDialogOpen: Readonly<ComputedRef<boolean>>
  fieldDefinitionDialogOpen: Ref<boolean>
  selectedSystem: Readonly<ComputedRef<StarSystem | undefined>>
  selectedObject: Readonly<ComputedRef<SystemObject | undefined>>
  selectedOrbit: Readonly<ComputedRef<Orbit | undefined>>
  selectedRoute: Readonly<ComputedRef<JumpRoute | undefined>>
  mapInspectorRef: ShallowRef<MapInspectorHandle | null>
  beginRouteSession: (routeId?: string | null) => number | null
  routeSession: Readonly<Ref<RouteInspectorSession | null>>
  armRouteAdd: () => void
  resolveTransition: (options?: TransitionOptions) => Promise<boolean>
  isEntityCommandBlocked: (command: EntityCommand) => boolean
  isEntityDraftCommandBlocked: (command: EntityCommand) => boolean
  isRouteCommandBlocked: (command: EntityCommand) => boolean
  isChartDraftTarget: (systemId: string) => boolean
  contextStamp: () => string
  selectCreatedSystem: (systemId: string, originStamp: string) => Promise<void>
  editorError: Ref<string>
}

/**
 * Composes cluster/system creation, route editing, dependent deletion, and keyboard-delete behavior.
 * @param options Editor refs, inspector bridge, draft-transition resolver, and page-owned commit.
 * @returns Cluster commands; commit and validation failures are surfaced through editorError.
 */
export function useClusterWorkflows({
  workspace,
  commit,
  saveState,
  activeView,
  selectedSystemId,
  selectedObjectId,
  selectedOrbitId,
  selectedRouteId,
  chartNamesDialogOpen,
  fieldDefinitionDialogOpen,
  selectedSystem,
  selectedObject,
  selectedOrbit,
  selectedRoute,
  mapInspectorRef,
  beginRouteSession,
  routeSession,
  armRouteAdd,
  resolveTransition,
  isEntityCommandBlocked,
  isEntityDraftCommandBlocked,
  isRouteCommandBlocked,
  isChartDraftTarget,
  contextStamp,
  selectCreatedSystem,
  editorError,
}: ClusterWorkflowOptions) {
  function errorText(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
  }

  /**
   * Creates and selects a new system before committing it to the workspace.
   * @returns A promise that resolves after the attempt; commit failures populate editorError.
   */
  async function createSystem(): Promise<void> {
    if (!workspace.value || !await resolveTransition()) return
    const currentWorkspace = workspace.value
    if (!currentWorkspace) return
    const originStamp = contextStamp()

    let createdSystemId: string | null = null
    try {
      const result = addStarSystem(currentWorkspace)
      createdSystemId = result.system.id
      editorError.value = ''
      await commit(result.workspace)
    } catch (error) {
      editorError.value = errorText(error)
    }
    // Commit publishes memory before waiting for durability. If the user changed context while
    // that write was pending, the new chart remains saved in the cluster without stealing focus.
    if (createdSystemId && contextStamp() === originStamp) {
      await selectCreatedSystem(createdSystemId, originStamp)
    }
  }

  /** Starts route creation after the inspector-draft guard accepts or discards other edits. */
  async function beginRoute(): Promise<void> {
    const currentWorkspace = workspace.value
    const existing = routeSession.value
    if (currentWorkspace && activeView.value === 'cluster'
      && existing?.routeId === null && existing.clusterId === currentWorkspace.cluster.id) {
      selectedRouteId.value = null
      armRouteAdd()
      editorError.value = ''
      return
    }
    if (!await resolveTransition({ leaveChart: false })) return
    const latestWorkspace = workspace.value
    if (!latestWorkspace || activeView.value !== 'cluster') return
    selectedRouteId.value = null
    const sessionId = beginRouteSession(null)
    if (sessionId === null) return
    armRouteAdd()
    editorError.value = ''
  }

  /**
   * Starts an edit draft only if routeId is still selected and other inspector edits are resolved.
   * @param routeId Route expected to own the edit draft.
   */
  async function beginRouteEdit(routeId: string): Promise<void> {
    if (selectedRoute.value?.id !== routeId) return
    if (!await resolveTransition({ leaveChart: false })) return
    if (selectedRoute.value?.id !== routeId) return
    if (beginRouteSession(routeId) === null) return
    editorError.value = ''
  }

  /**
   * Previews dependent effects, asks for confirmation, then commits the planned deletion.
   * Deletion is skipped while a prior write is visibly pending.
   * @param target Object, Orbit, route, or system selected for removal.
   * @returns A promise that resolves after cancellation or the commit attempt; failures populate editorError.
   */
  async function deleteMapEntity(
    target: MapDeletionTarget,
    resolveBeforeCommit?: () => Promise<boolean>,
  ): Promise<void> {
    const currentWorkspace = workspace.value
    if (!currentWorkspace || saveState.value === 'saving') return

    try {
      const confirmationFor = (plan: ReturnType<typeof planMapEntityDeletion>) => plan.affectedEntities.length
        ? `Delete ${plan.entityLabel}?\n\nThis also removes or updates:\n${plan.affectedEntities.map(entity => `- ${entity}`).join('\n')}`
        : `Delete ${plan.entityLabel}?`
      const initialPlan = planMapEntityDeletion(currentWorkspace, target)
      if (!window.confirm(confirmationFor(initialPlan))) return

      let acceptedPlan = initialPlan
      const entityConflict = isEntityCommandBlocked({ kind: 'deletion', target })
      if (resolveBeforeCommit || entityConflict) {
        const accepted = resolveBeforeCommit
          ? await resolveBeforeCommit()
          : await resolveTransition({ leaveChart: false })
        if (!accepted) return
        const latestWorkspace = workspace.value
        if (!latestWorkspace) return
        const refreshedPlan = planMapEntityDeletion(latestWorkspace, target)
        if (
          latestWorkspace !== currentWorkspace
          && !window.confirm(confirmationFor(refreshedPlan))
        ) return
        acceptedPlan = refreshedPlan
      }

      editorError.value = ''
      await commit(acceptedPlan.workspace)
    } catch (error) {
      editorError.value = errorText(error)
    }
  }

  /** Reviews a system cascade before resolving any draft that targets the system being removed. */
  async function deleteSystem(systemId: string): Promise<void> {
    const command: EntityCommand = { kind: 'deletion', target: { kind: 'system', systemId } }
    await deleteMapEntity(
      { kind: 'system', systemId },
      () => resolveTransition({
        leaveChart: isChartDraftTarget(systemId),
        leaveEntitySession: isEntityDraftCommandBlocked(command),
        leaveRouteSession: isRouteCommandBlocked(command),
      }),
    )
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

  /**
   * Handles an unmodified Delete key only when an eligible map selection is safe to remove.
   * Inputs, open drafts/dialogs, repeats, and pending saves retain their native behavior.
   * @param event Window keydown event.
   */
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
      || chartNamesDialogOpen.value
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
    deleteSystem,
    deleteSelectedObject,
    deleteSelectedOrbit,
    deleteSelectedRoute,
  }
}
