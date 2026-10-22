/**
 * Cluster commands coordinate selection and confirmation, then delegate persistence through the injected commit.
 */
import { nextTick, onMounted, onUnmounted, ref, type ComputedRef, type Ref, type ShallowRef } from 'vue'
import {
  addStarSystem,
  planMapEntityDeletion,
  type JumpRoute,
  type LocalWorkspace,
  type MapDeletionPlan,
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
  WorkspaceDeletionReview,
} from './types'
import type { RouteInspectorSession } from './useRouteInspectorSession'

interface ClusterWorkflowOptions {
  workspace: Readonly<Ref<LocalWorkspace | null>>
  commit: (nextWorkspace: LocalWorkspace) => Promise<void>
  applyWorkspace: (nextWorkspace: LocalWorkspace) => { durable: Promise<void> }
  onDeletionApplied: (plan: MapDeletionPlan) => void
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
  applyWorkspace,
  onDeletionApplied,
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
  const deletionReview = ref<WorkspaceDeletionReview | null>(null)
  let deletionReviewSequence = 0

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
  function openDeletionReview(target: MapDeletionTarget): void {
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
      const { durable } = applyWorkspace(acceptedPlan.workspace)
      deletionReview.value = null
      onDeletionApplied(acceptedPlan)
      editorError.value = ''
      void durable.catch(() => undefined)
    } catch (error) {
      refreshDeletionReview(reviewId, target)
      if (deletionReview.value?.id === reviewId) deletionReview.value.error = errorText(error)
    }
  }

  function deleteSystem(systemId: string): void {
    openDeletionReview({ kind: 'system', systemId })
  }

  function deleteSelectedObject(): void {
    const system = selectedSystem.value
    const object = selectedObject.value
    if (system && object) openDeletionReview({ kind: 'object', systemId: system.id, objectId: object.id })
  }

  function deleteSelectedOrbit(): void {
    const system = selectedSystem.value
    const orbit = selectedOrbit.value
    if (system && orbit) openDeletionReview({ kind: 'orbit', systemId: system.id, orbitId: orbit.id })
  }

  function deleteSelectedRoute(): void {
    const route = selectedRoute.value
    if (route) openDeletionReview({ kind: 'route', routeId: route.id })
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
    deletionReview,
    openDeletionReview,
    cancelDeletionReview,
    confirmDeletionReview,
  }
}
