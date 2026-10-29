/**
 * Cluster commands coordinate selection and confirmation, then delegate persistence through the injected commit.
 */
import { computed, nextTick, onMounted, onUnmounted, ref, type ComputedRef, type Ref } from 'vue'
import {
  planMapEntityDeletion,
  type LocalWorkspace,
  type MapDeletionPlan,
  type MapDeletionTarget,
} from '../../domain/workspace'
import type {
  EntityCommand,
  SaveState,
  TransitionOptions,
  WorkspaceDeletionReview,
} from './types'
import type { RouteInspectorSession } from './useRouteInspectorSession'
import type { WorkspaceMutationExecutor, WorkspaceMutationResult, WorkspaceMutationTarget } from './workspace-mutations'
import { useEditorUiStore } from '../../stores/editor-ui'

interface ClusterWorkflowOptions {
  workspace: Readonly<Ref<LocalWorkspace | null>>
  mutations: WorkspaceMutationExecutor
  onDeletionApplied: (plan: MapDeletionPlan) => void
  saveState: Readonly<Ref<SaveState>>
  chartNamesDialogOpen: Readonly<ComputedRef<boolean>>
  fieldDefinitionDialogOpen: Ref<boolean>
  beginRouteSession: (routeId?: string | null) => number | null
  routeSession: Readonly<Ref<RouteInspectorSession | null>>
  armRouteAdd: () => void
  resolveTransition: (options?: TransitionOptions) => Promise<boolean>
  isEntityDraftCommandBlocked: (command: EntityCommand) => boolean
  isRouteCommandBlocked: (command: EntityCommand) => boolean
  isChartDraftTarget: (systemId: string) => boolean
  editorError: Ref<string>
  beforeWorkspaceOperation?: () => Promise<boolean>
}

/**
 * Composes guarded route editing, dependent deletion, and keyboard-delete behavior.
 * @param options Workspace, draft guards, deletion lifecycle, and page-owned writer.
 * @returns Guarded route and deletion commands; validation failures are surfaced through editorError.
 */
export function useClusterWorkflows({
  workspace,
  mutations,
  onDeletionApplied,
  saveState,
  chartNamesDialogOpen,
  fieldDefinitionDialogOpen,
  beginRouteSession,
  routeSession,
  armRouteAdd,
  resolveTransition,
  isEntityDraftCommandBlocked,
  isRouteCommandBlocked,
  isChartDraftTarget,
  editorError,
  beforeWorkspaceOperation = async () => true,
}: ClusterWorkflowOptions) {
  const store = useEditorUiStore()
  const selectedSystem = computed(() => workspace.value?.cluster.systems.find(system => system.id === store.selectedSystemId))
  const selectedObject = computed(() => selectedSystem.value?.objects.find(object => object.id === store.selectedObjectId))
  const selectedOrbit = computed(() => selectedSystem.value?.orbits.find(orbit => orbit.id === store.selectedOrbitId))
  const selectedRoute = computed(() => workspace.value?.cluster.routes.find(route => route.id === store.selectedRouteId))
  const deletionReview = ref<WorkspaceDeletionReview | null>(null)
  let deletionReviewSequence = 0

  function errorText(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
  }

  function throwIfRejected(result: WorkspaceMutationResult): void {
    if (result.status === 'rejected') throw new Error(result.message)
  }

  function mutationTarget(target: MapDeletionTarget, clusterId: string): { target: WorkspaceMutationTarget; parent: WorkspaceMutationTarget } {
    switch (target.kind) {
      case 'system':
        return {
          target: { kind: 'system', id: target.systemId },
          parent: { kind: 'cluster', id: clusterId },
        }
      case 'route':
        return {
          target: { kind: 'route', id: target.routeId },
          parent: { kind: 'cluster', id: clusterId },
        }
      case 'object':
        return {
          target: { kind: 'object', id: target.objectId, systemId: target.systemId },
          parent: { kind: 'system', id: target.systemId },
        }
      case 'orbit':
        return {
          target: { kind: 'orbit', id: target.orbitId, systemId: target.systemId },
          parent: { kind: 'system', id: target.systemId },
        }
    }
  }

  /** Starts route creation after the inspector-draft guard accepts or discards other edits. */
  async function beginRoute(): Promise<void> {
    if (!await beforeWorkspaceOperation()) return
    const currentWorkspace = workspace.value
    const existing = routeSession.value
    if (currentWorkspace && store.activeView === 'cluster'
      && existing?.routeId === null && existing.clusterId === currentWorkspace.cluster.id) {
      store.setSelection({ selectedRouteId: null })
      armRouteAdd()
      editorError.value = ''
      return
    }
    if (!await resolveTransition({ leaveChart: false })) return
    const latestWorkspace = workspace.value
    if (!latestWorkspace || store.activeView !== 'cluster') return
    store.setSelection({ selectedRouteId: null })
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
    if (!await beforeWorkspaceOperation()) return
    if (selectedRoute.value?.id !== routeId) return
    if (!await resolveTransition({ leaveChart: false })) return
    if (selectedRoute.value?.id !== routeId) return
    if (beginRouteSession(routeId) === null) return
    editorError.value = ''
  }

  function deletionCommand(target: MapDeletionTarget, plan: MapDeletionPlan): EntityCommand {
    return {
      kind: 'deletion',
      target,
      affectedSystemIds: plan.removedSystemIds,
      affectedObjectIds: plan.removedObjectIds,
      affectedRouteIds: plan.removedRouteIds,
    }
  }

  function makeDeletionReview(
    id: number,
    clusterId: string,
    target: MapDeletionTarget,
    plan: MapDeletionPlan,
    notice = '',
  ): WorkspaceDeletionReview {
    return {
      id,
      clusterId,
      open: true,
      suspended: false,
      confirming: false,
      target,
      entityLabel: plan.entityLabel,
      affectedEntities: [...plan.affectedEntities],
      effectSignature: plan.effectSignature,
      notice,
      error: '',
    }
  }

  function refreshDeletionReview(id: number, target: MapDeletionTarget, notice = ''): void {
    const currentWorkspace = workspace.value
    if (!currentWorkspace) {
      deletionReview.value = {
        id, clusterId: '', open: true, suspended: false, confirming: false, target,
        entityLabel: 'Deletion unavailable', affectedEntities: [], effectSignature: '', notice,
        error: 'The workspace is no longer available.',
      }
      return
    }
    try {
      deletionReview.value = makeDeletionReview(id, currentWorkspace.cluster.id, target, planMapEntityDeletion(currentWorkspace, target), notice)
    } catch (error) {
      deletionReview.value = {
        id, clusterId: currentWorkspace.cluster.id, open: true, suspended: false, confirming: false, target,
        entityLabel: 'Deletion unavailable', affectedEntities: [], effectSignature: '', notice,
        error: errorText(error),
      }
    }
  }

  /** Prepares a current cascade without changing applied data or resolving any drafts. */
  async function openDeletionReview(target: MapDeletionTarget): Promise<void> {
    if (!await beforeWorkspaceOperation()) return
    if (!workspace.value || saveState.value === 'saving' || deletionReview.value?.confirming) return
    const id = ++deletionReviewSequence
    editorError.value = ''
    refreshDeletionReview(id, target)
  }

  function cancelDeletionReview(): void {
    if (deletionReview.value?.confirming) return
    deletionReviewSequence += 1
    deletionReview.value = null
  }

  /** Confirms only the currently displayed effects, resolving intersecting drafts before publication. */
  async function confirmDeletionReview(): Promise<void> {
    const active = deletionReview.value
    if (!active || !active.open || active.suspended || active.confirming || active.error) return
    if (!await beforeWorkspaceOperation()) return
    const reviewId = active.id
    const target = active.target
    active.confirming = true

    const currentWorkspace = workspace.value
    if (!currentWorkspace || currentWorkspace.cluster.id !== active.clusterId) {
      deletionReview.value = null
      return
    }

    let prepared: MapDeletionPlan
    try {
      prepared = planMapEntityDeletion(currentWorkspace, target)
    } catch (error) {
      refreshDeletionReview(reviewId, target)
      if (deletionReview.value?.id === reviewId) deletionReview.value.error = errorText(error)
      return
    }
    if (prepared.effectSignature !== active.effectSignature) {
      deletionReview.value = makeDeletionReview(
        reviewId,
        active.clusterId,
        target,
        prepared,
        'The deletion effects changed. Review the updated consequences and confirm again.',
      )
      return
    }

    const command = deletionCommand(target, prepared)
    const entityConflict = isEntityDraftCommandBlocked(command)
    const routeConflict = isRouteCommandBlocked(command)
    const chartConflict = target.kind === 'system' && isChartDraftTarget(target.systemId)
    let acceptedPlan = prepared
    if (entityConflict || routeConflict || chartConflict) {
      active.open = false
      active.suspended = true
      await nextTick()
      const accepted = await resolveTransition({
        leaveChart: target.kind === 'system' && isChartDraftTarget(target.systemId),
        leaveEntitySession: entityConflict,
        leaveRouteSession: routeConflict,
      })
      if (deletionReview.value?.id !== reviewId) return
      const latestWorkspace = workspace.value
      if (!latestWorkspace || latestWorkspace.cluster.id !== active.clusterId) {
        deletionReview.value = null
        return
      }
      if (!accepted) {
        refreshDeletionReview(reviewId, target)
        return
      }
      try {
        acceptedPlan = planMapEntityDeletion(latestWorkspace, target)
      } catch (error) {
        refreshDeletionReview(reviewId, target)
        if (deletionReview.value?.id === reviewId) deletionReview.value.error = errorText(error)
        return
      }
      if (acceptedPlan.effectSignature !== active.effectSignature) {
        deletionReview.value = makeDeletionReview(
          reviewId,
          active.clusterId,
          target,
          acceptedPlan,
          'Applying the Inspector draft changed the deletion effects. Review the updated consequences and confirm again.',
        )
        return
      }
      const refreshedCommand = deletionCommand(target, acceptedPlan)
      if (isEntityDraftCommandBlocked(refreshedCommand) || isRouteCommandBlocked(refreshedCommand)) {
        refreshDeletionReview(reviewId, target, 'Resolve the Inspector draft before confirming this deletion.')
        return
      }
    }

    if (deletionReview.value?.id !== reviewId) return
    try {
      const selectedTarget = mutationTarget(target, active.clusterId)
      let appliedPlan: MapDeletionPlan | null = null
      const result = await mutations.execute({
        action: {
          kind: 'delete',
          label: `Delete ${acceptedPlan.entityLabel}`,
          target: selectedTarget.target,
          parent: selectedTarget.parent,
        },
        isCurrent: () => {
          const currentReview = deletionReview.value
          const latestWorkspace = workspace.value
          return currentReview?.id === reviewId
            && currentReview.confirming
            && currentReview.clusterId === active.clusterId
            && latestWorkspace !== null
            && latestWorkspace.cluster.id === active.clusterId
        },
        prepare: (latest) => {
          if (latest.cluster.id !== active.clusterId) throw new Error('The Jump Cluster changed before this deletion could be applied.')
          const freshPlan = planMapEntityDeletion(latest, target)
          if (freshPlan.effectSignature !== acceptedPlan.effectSignature) {
            throw new Error('The deletion effects changed. Review the updated consequences and confirm again.')
          }
          appliedPlan = freshPlan
          return freshPlan.workspace
        },
      })
      if (result.status === 'applied') void result.durable.catch(() => undefined)
      throwIfRejected(result)
      if (deletionReview.value?.id !== reviewId) return
      deletionReview.value = null
      if (result.status === 'applied' && appliedPlan) onDeletionApplied(appliedPlan)
      editorError.value = ''
    } catch (error) {
      if (deletionReview.value?.id !== reviewId) return
      refreshDeletionReview(reviewId, target)
      if (deletionReview.value?.id === reviewId) deletionReview.value.error = errorText(error)
    }
  }

  async function deleteSystem(systemId: string): Promise<void> {
    await openDeletionReview({ kind: 'system', systemId })
  }

  async function deleteSelectedObject(): Promise<void> {
    const system = selectedSystem.value
    const object = selectedObject.value
    if (system && object) await openDeletionReview({ kind: 'object', systemId: system.id, objectId: object.id })
  }

  async function deleteSelectedOrbit(): Promise<void> {
    const system = selectedSystem.value
    const orbit = selectedOrbit.value
    if (system && orbit) await openDeletionReview({ kind: 'orbit', systemId: system.id, orbitId: orbit.id })
  }

  async function deleteSelectedRoute(): Promise<void> {
    const route = selectedRoute.value
    if (route) await openDeletionReview({ kind: 'route', routeId: route.id })
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
      || store.searchOpen
      || chartNamesDialogOpen.value
      || fieldDefinitionDialogOpen.value
    ) return

    const removeSelected = store.activeView === 'cluster'
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
    beginRoute,
    beginRouteEdit,
    deleteSystem,
    deleteSelectedObject,
    deleteSelectedOrbit,
    deleteSelectedRoute,
    deletionReview,
    cancelDeletionReview,
    confirmDeletionReview,
  }
}
