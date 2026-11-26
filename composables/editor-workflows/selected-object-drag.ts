import { computed, watch, type Ref } from 'vue'
import type { LocalWorkspace, ObjectPlacement, Point } from '../../domain/workspace'
import type { CommittedObjectPosition, EntityCommand, MapInteractionMode } from './types'
import type { WorkspaceMutationExecutor } from './workspace-mutations'
import type { SvgViewportRect } from '../../utils/map-zoom'
import { useEditorUiStore } from '../../stores/editor-ui'
import {
  fitSelectedObjectTranslation,
  prepareContinuousSelectedObjectTranslation,
  prepareSelectedObjectTranslation,
  type ContinuousSelectedObjectTranslationPlan,
  type OwnedSelectedObjectPlacementChange,
  type SelectedObjectPlacementChange,
  type SelectedObjectTranslationPlan,
} from '../../utils/selected-object-placement'

/** Scene-coordinate preview for one collective selected-object drag. */
export interface SelectedObjectDragPreview {
  /** Proposed owner-local positions for selected objects and carried descendants. */
  positions: ReadonlyMap<string, Point>
  /** Owning systems for the positions map; included for cross-system Cluster previews. */
  objectSystemIds: ReadonlyMap<string, string>
  /** Selected objects that will detach from their current Orbit at the exact translated point. */
  departingObjectIds: ReadonlySet<string>
  /** Exact displayed Zone frames from this collective landing proposal. */
  frames: ReadonlyMap<string, SvgViewportRect>
  /** Independently moving group members that will attach to an exact eligible Orbit destination. */
  arrivingObjectIds: ReadonlySet<string>
}

/** Single-use pointer gesture whose proposal remains transient until its complete call. */
export interface SelectedObjectDrag {
  /** Receives local map units in a system map and Cluster-scene units on the continuous map. */
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
  activeView: 'cluster' | 'system'
  mapMode: Extract<MapInteractionMode, 'select' | 'move'>
  selectedSystemId: string | null
  inspectedTargetSignature: string
  objectIds: readonly string[]
}

type DragPlan = SelectedObjectTranslationPlan | ContinuousSelectedObjectTranslationPlan

function ownedChanges(plan: DragPlan): OwnedSelectedObjectPlacementChange[] {
  return 'systemPlans' in plan
    ? [...plan.changes]
    : plan.changes.map(change => ({ systemId: '', change }))
}

function planUpdates(plan: DragPlan): OwnedSelectedObjectPlacementChange[] {
  return 'systemPlans' in plan
    ? [...plan.updates]
    : plan.updates.map(change => ({ systemId: '', change }))
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
    store.inspectedTarget,
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
      && store.activeView === captured.activeView
      && store.mapMode === captured.mapMode
      && store.selectedSystemId === captured.selectedSystemId
      && JSON.stringify(store.inspectedTarget) === captured.inspectedTargetSignature
      && store.selectedObjectIds.length === captured.objectIds.length
      && store.selectedObjectIds.every((objectId, index) => objectId === captured.objectIds[index])
  }

  function validatePlan(plan: DragPlan): boolean {
    for (const { change } of ownedChanges(plan)) {
      if (isEntityCommandBlocked(placementCommand(change))) {
        return false
      }
    }
    return true
  }

  function beginSelectedObjectDrag(
    anchorId: string,
    continuousSystemScales?: ReadonlyMap<string, number>,
    expectedMode: Extract<MapInteractionMode, 'select' | 'move'> = 'move',
    pixelsPerSceneUnit?: number,
  ): SelectedObjectDrag | null {
    const currentWorkspace = workspace.value
    const selectedIds = [...store.selectedObjectIds]
    if (!currentWorkspace || store.mapMode !== expectedMode || selectedIds.length < 2 || !selectedIds.includes(anchorId)) return null
    const ownerSystemId = currentWorkspace.cluster.systems.find(system => system.objects.some(object => object.id === anchorId))?.id
    if (!ownerSystemId) return null
    const continuous = store.activeView === 'cluster'
    if ((!continuous && (store.activeView !== 'system' || store.selectedSystemId !== ownerSystemId))
      || (continuous && !continuousSystemScales)) return null
    let preparedPlan: ((delta: Point) => DragPlan | null) | null
    try {
      if (continuous) {
        const prepare = prepareContinuousSelectedObjectTranslation(
          currentWorkspace,
          selectedIds,
          ownerSystemId,
          anchorId,
          continuousSystemScales!,
        )
        preparedPlan = prepare
      } else {
        const prepare = prepareSelectedObjectTranslation(currentWorkspace, ownerSystemId, selectedIds, anchorId)
        preparedPlan = prepare
      }
    } catch (error) {
      moveError.value = error instanceof Error ? error.message : String(error)
      return null
    }
    if (!preparedPlan) return null

    const id = ++gestureSequence
    activeGestureId = id
    feedbackGestureId = id
    moveError.value = ''
    const captured: CapturedGesture = {
      id,
      anchorId,
      workspace: currentWorkspace,
      revision: appliedRevision?.value,
      systemId: ownerSystemId,
      activeView: store.activeView,
      mapMode: expectedMode,
      selectedSystemId: store.selectedSystemId,
      inspectedTargetSignature: JSON.stringify(store.inspectedTarget),
      objectIds: selectedIds,
    }
    let completed = false
    let released = false
    let externallyCancelled = false

    let cached: { delta: Point; plan: DragPlan; fitted: ReturnType<typeof fitSelectedObjectTranslation> } | undefined

    function currentProposal(delta: Point) {
      if (!contextIsCurrent(captured)) return null
      if (cached?.delta.x === delta.x && cached.delta.y === delta.y) return cached
      const plan = preparedPlan!(delta)
      if (!plan) return null
      const fitted = fitSelectedObjectTranslation(captured.workspace, plan, captured.systemId, anchorId, pixelsPerSceneUnit)
      cached = { delta: { ...delta }, plan, fitted }
      return cached
    }

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
          const proposal = currentProposal(delta)
          if (!proposal) {
            if (!contextIsCurrent(captured)) setError('The selected objects or map context changed. Preview the move again.')
            return null
          }
          const { plan, fitted } = proposal
          if (!validatePlan(plan)) {
            setError('Resolve the Inspector draft before changing an object or its placement.')
            return null
          }
          return {
            positions: plan.positions,
            frames: fitted.frames,
            objectSystemIds: 'objectSystemIds' in plan
              ? plan.objectSystemIds
              : new Map(plan.movedObjectIds.map(objectId => [objectId, ownerSystemId])),
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
          const proposal = currentProposal(delta)
          if (!proposal) {
            setError('The selected objects or map context changed. Preview the move again.')
            return
          }
          const { plan, fitted } = proposal
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

          if (!contextIsCurrent(captured)) {
            setError('The selected objects or map context changed. Preview the move again.')
            return
          }
          if (!validatePlan(plan)) {
            setError('Resolve the Inspector draft before changing an object or its placement.')
            return
          }

          const handlers = planUpdates(plan)
            .map(({ change }) => options.createCommittedPositionAppliedHandler?.(committedPosition(change)))
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
            prepare: () => {
              if (!contextIsCurrent(captured)) {
                throw new Error(staleMessage)
              }
              if (!validatePlan(plan)) {
                throw new Error('Resolve the Inspector draft before changing an object or its placement.')
              }
              return fitted.workspace
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
