import { computed, watch, type Ref } from 'vue'
import type { LocalWorkspace, ObjectPlacement, Point } from '../../domain/workspace'
import type { CommittedObjectPosition, EntityCommand } from './types'
import type { WorkspaceMutationExecutor } from './workspace-mutations'
import { useEditorUiStore } from '../../stores/editor-ui'
import {
  applySelectedObjectTranslation,
  planSelectedObjectTranslation,
  type SelectedObjectPlacementChange,
} from '../../utils/selected-object-placement'

/** Scene-coordinate preview for one collective selected-object drag. */
export interface SelectedObjectDragPreview {
  /** Proposed positions for selected objects and every descendant carried with their hosted branches. */
  positions: ReadonlyMap<string, Point>
  /** Selected objects that will detach from their current Orbit at the exact translated point. */
  departingObjectIds: ReadonlySet<string>
  /** Independently moving group members that will attach to an exact eligible Orbit destination. */
  arrivingObjectIds: ReadonlySet<string>
}

/** Single-use pointer gesture whose proposal remains transient until its complete call. */
export interface SelectedObjectDrag {
  preview(delta: Point): SelectedObjectDragPreview | null
  complete(delta: Point): Promise<void>
  cancel(): void
}

export interface SelectedObjectDragOptions {
  workspace: Readonly<Ref<LocalWorkspace | null>>
  appliedRevision?: Readonly<Ref<number>>
  mutations: WorkspaceMutationExecutor
  isEntityCommandBlocked(command: EntityCommand): boolean
  createCommittedPositionAppliedHandler?(change: CommittedObjectPosition): () => void
  error: Ref<string>
  beforeWorkspaceOperation(): Promise<boolean>
}

interface CapturedGesture {
  id: number
  anchorId: string
  workspace: LocalWorkspace
  revision: number | undefined
  systemId: string
  objectIds: readonly string[]
}

function orbitIdOf(placement: ObjectPlacement): string | null {
  return placement.kind === 'orbit' ? placement.orbitId : null
}

function placementCommand(change: SelectedObjectPlacementChange): Extract<EntityCommand, { kind: 'object-placement' }> {
  return {
    kind: 'object-placement',
    objectId: change.objectId,
    fromOrbitId: orbitIdOf(change.previousPlacement),
    toOrbitId: orbitIdOf(change.nextPlacement),
  }
}

function committedPosition(change: SelectedObjectPlacementChange): CommittedObjectPosition {
  return {
    objectId: change.objectId,
    previousPlacement: change.previousPlacement,
    nextPlacement: change.nextPlacement,
    ...(change.previousAngle !== undefined ? { previousAngle: change.previousAngle } : {}),
    ...(change.nextAngle !== undefined ? { nextAngle: change.nextAngle } : {}),
    command: {
      kind: 'object-placement',
      objectId: change.objectId,
      fromOrbitId: orbitIdOf(change.previousPlacement),
      toOrbitId: orbitIdOf(change.nextPlacement),
    },
  }
}

/** Coordinates the transient drag with exact selection ownership, draft guards, and one history publication. */
export function useSelectedObjectDrag(options: SelectedObjectDragOptions) {
  const { workspace, appliedRevision, mutations, isEntityCommandBlocked, error, beforeWorkspaceOperation } = options
  const store = useEditorUiStore()
  const moveError = error
  let gestureSequence = 0
  let activeGestureId = 0
  let feedbackGestureId = 0

  const gestureOwnerSignature = computed(() => JSON.stringify([
    workspace.value?.id ?? null,
    workspace.value?.cluster.id ?? null,
    store.activeView,
    store.selectedSystemId,
    store.mapMode,
    store.selectedObjectIds,
  ]))
  watch(gestureOwnerSignature, () => {
    activeGestureId = 0
    feedbackGestureId = 0
    moveError.value = ''
  }, { flush: 'sync' })

  function contextIsCurrent(captured: CapturedGesture): boolean {
    const currentWorkspace = workspace.value
    return activeGestureId === captured.id
      && currentWorkspace === captured.workspace
      && currentWorkspace?.id === captured.workspace.id
      && currentWorkspace.cluster.id === captured.workspace.cluster.id
      && (appliedRevision === undefined || appliedRevision.value === captured.revision)
      && store.activeView === 'system'
      && store.mapMode === 'move'
      && store.selectedSystemId === captured.systemId
      && store.selectedObjectIds.length === captured.objectIds.length
      && store.selectedObjectIds.every((objectId, index) => objectId === captured.objectIds[index])
  }

  function currentPlan(captured: CapturedGesture, delta: Point) {
    if (!contextIsCurrent(captured)) return null
    return planSelectedObjectTranslation(
      captured.workspace,
      captured.systemId,
      captured.objectIds,
      delta,
    )
  }

  function validatePlan(plan: NonNullable<ReturnType<typeof planSelectedObjectTranslation>>): boolean {
    for (const change of plan.changes) {
      if (isEntityCommandBlocked(placementCommand(change))) {
        return false
      }
    }
    return true
  }

  function beginSelectedObjectDrag(anchorId: string): SelectedObjectDrag | null {
    const currentWorkspace = workspace.value
    const systemId = store.selectedSystemId
    const selectedIds = [...store.selectedObjectIds]
    if (!currentWorkspace || store.activeView !== 'system' || store.mapMode !== 'move'
      || !systemId || selectedIds.length < 2 || !selectedIds.includes(anchorId)) return null
    const system = currentWorkspace.cluster.systems.find(candidate => candidate.id === systemId)
    if (!system || selectedIds.some(objectId => !system.objects.some(object => object.id === objectId))) return null

    const id = ++gestureSequence
    activeGestureId = id
    feedbackGestureId = id
    moveError.value = ''
    const captured: CapturedGesture = {
      id,
      anchorId,
      workspace: currentWorkspace,
      revision: appliedRevision?.value,
      systemId,
      objectIds: selectedIds,
    }
    let completed = false
    let released = false
    let externallyCancelled = false

    function setError(message: string): void {
      if (feedbackGestureId === captured.id && !externallyCancelled) moveError.value = message
    }

    function clearError(): void {
      if (feedbackGestureId === captured.id) moveError.value = ''
    }

    function finish(): void {
      completed = true
      if (activeGestureId === captured.id) activeGestureId = 0
    }

    function cancel(): void {
      if (completed) return
      externallyCancelled = true
      finish()
    }

    return {
      preview(delta) {
        if (completed || released) return null
        try {
          const plan = currentPlan(captured, delta)
          if (!plan) {
            if (!contextIsCurrent(captured)) setError('The selected objects or map context changed. Preview the move again.')
            return null
          }
          if (!validatePlan(plan)) {
            setError('Resolve the Inspector draft before changing an object or its placement.')
            return null
          }
          return {
            positions: plan.positions,
            departingObjectIds: plan.departingObjectIds,
            arrivingObjectIds: plan.arrivingObjectIds,
          }
        } catch (error) {
          setError(error instanceof Error ? error.message : String(error))
          return null
        }
      },
      async complete(delta) {
        if (completed || released) return
        released = true
        try {
          let plan = currentPlan(captured, delta)
          if (!plan) {
            setError('The selected objects or map context changed. Preview the move again.')
            return
          }
          if (!validatePlan(plan)) {
            setError('Resolve the Inspector draft before changing an object or its placement.')
            return
          }
          if (plan.updates.length === 0) {
            clearError()
            return
          }

          let preflightAllowed: boolean
          try {
            preflightAllowed = await beforeWorkspaceOperation()
          } catch (error) {
            setError(error instanceof Error ? error.message : String(error))
            return
          }
          if (completed) return
          if (!preflightAllowed) {
            setError('Finish the current workspace operation before moving the selection.')
            return
          }

          plan = currentPlan(captured, delta)
          if (!plan) {
            setError('The selected objects or map context changed. Preview the move again.')
            return
          }
          if (!validatePlan(plan)) {
            setError('Resolve the Inspector draft before changing an object or its placement.')
            return
          }
          if (plan.updates.length === 0) {
            clearError()
            return
          }

          const handlers = plan.updates
            .map(change => options.createCommittedPositionAppliedHandler?.(committedPosition(change)))
            .filter((handler): handler is () => void => handler !== undefined)
          const staleMessage = 'The selected objects or map context changed before the move could be applied.'
          let draftGuardBlocked = false
          const result = await mutations.execute({
            action: {
              kind: 'move',
              label: 'Move selected objects',
              target: { kind: 'object', id: captured.anchorId, systemId: captured.systemId },
              parent: { kind: 'system', id: captured.systemId },
            },
            isCurrent: () => {
              if (!contextIsCurrent(captured)) return false
              if (!validatePlan(plan)) {
                draftGuardBlocked = true
                setError('Resolve the Inspector draft before changing an object or its placement.')
                return false
              }
              return true
            },
            prepare: latestWorkspace => {
              if (!contextIsCurrent(captured)) {
                throw new Error(staleMessage)
              }
              if (!validatePlan(plan)) {
                throw new Error('Resolve the Inspector draft before changing an object or its placement.')
              }
              return applySelectedObjectTranslation(latestWorkspace, captured.systemId, plan)
            },
            ...(handlers.length ? { onApplied: () => handlers.forEach(handler => handler()) } : {}),
          })
          if (result.status === 'rejected') {
            if (!draftGuardBlocked) setError(result.message)
          }
          else if (result.status === 'applied') {
            clearError()
            void result.durable.catch(error => {
              setError(error instanceof Error ? error.message : String(error))
            })
          } else if (result.status === 'unchanged') clearError()
        } catch (error) {
          setError(error instanceof Error ? error.message : String(error))
        } finally {
          finish()
        }
      },
      cancel,
    }
  }

  return { beginSelectedObjectDrag }
}
