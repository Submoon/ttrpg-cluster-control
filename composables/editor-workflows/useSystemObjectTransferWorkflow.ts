/** Coordinates guarded review, map ownership, and one reversible transfer publication. */
import { computed, readonly, ref, shallowRef, toRaw, watch } from 'vue'
import type { Ref } from 'vue'
import type { LocalWorkspace, SystemObjectTransferPlacement, SystemObjectTransferReview } from '../../domain/workspace'
import {
  applySystemObjectTransfer,
  prepareSystemObjectTransfer,
  resolveSystemObjectBranch,
  setWorkspaceSystemFrame,
  workspaceSystemFrame,
} from '../../domain/workspace'
import { useSystemObjectTransferDraft } from '../useSystemObjectTransferDraft'
import type { SystemObjectTransferAcceptance } from '../useSystemObjectTransferDraft'
import type {
  SystemObjectTransferDrop,
  SystemObjectTransferIntent,
  SystemObjectTransferMapPlacementLease,
  SystemObjectTransferMapPreview,
  SystemObjectTransferReviewState,
} from './system-object-transfer-types'
import type {
  WorkspaceHistoryCoordinator,
  WorkspaceMutationResult,
} from './workspace-mutations'

interface TransferMapPlacementOwner {
  destinationSystemId: string
  mapOwner: object
  placementGeneration: number
}

interface ActiveTransferSession {
  id: number
  sourceSystemId: string
  rootObjectId: string
  workspaceReference: LocalWorkspace
  appliedRevision: number
  draft: ReturnType<typeof useSystemObjectTransferDraft>
  open: Ref<boolean>
  placingOnMap: Ref<boolean>
  confirming: Ref<boolean>
  error: Ref<string | null>
  mapPlacementOwner: TransferMapPlacementOwner | null
  drop?: SystemObjectTransferDrop
}

export interface SystemObjectTransferWorkflowOptions {
  workspace: { readonly value: LocalWorkspace | null }
  appliedRevision: { readonly value: number }
  history: WorkspaceHistoryCoordinator
  /** Resolve existing Inspector or related drafts before the transfer captures applied state. */
  resolveBeforeTransfer(): Promise<boolean>
  resolveBeforeDrop?(
    review: SystemObjectTransferReview,
    ownsDrop: () => boolean,
    onDraftApplied: () => void,
  ): Promise<boolean>
  canApplyDrop?(review: SystemObjectTransferReview): boolean
  captureDropInspection?(review: SystemObjectTransferReview): (() => void) | undefined
  /** Settles a pending map adjustment before the transfer session captures its workspace and revision. */
  beforeWorkspaceOperation(): Promise<boolean>
  /** Moves and frames the chosen destination map before this transfer acquires map input. */
  prepareDestinationMap?(systemId: string, isCurrent: () => boolean): Promise<boolean>
  /** Reads reactive editor state for drafts that can change the destination's displayed geometry. */
  hasDestinationGeometryDraft?(systemId: string): boolean
  /** Returns the exact currently mounted destination renderer, if it owns the requested destination. */
  captureDestinationMapOwner(systemId: string): object | null
  /** Confirms both renderer identity and its destination ownership on map-placement completion/apply. */
  isDestinationMapOwnerCurrent(systemId: string, mapOwner: object): boolean
  /** Retargets to the moved object after the history coordinator has published this action. */
  onApplied?(target: { rootObjectId: string; sourceSystemId: string; destinationSystemId: string }): void
}

function rejected(
  reason: 'stale' | 'invalid' | 'failed' | 'cancelled' | 'busy' | 'unavailable',
  message: string,
): Extract<WorkspaceMutationResult, { status: 'rejected' }> {
  return { status: 'rejected', reason, message }
}

function currentSystem(workspace: LocalWorkspace, systemId: string) {
  return workspace.cluster.systems.find(system => system.id === systemId)
}

const destinationDraftMessage = 'Finish editing the destination system before continuing the transfer.'

/**
 * Owns the editor-side transfer lifetime while sharing the normal history and writer path.
 * It deliberately captures source workspace/revision after guarded preflight and refuses to
 * recompute a displayed review into a different accepted operation.
 */
export function useSystemObjectTransferWorkflow(options: SystemObjectTransferWorkflowOptions) {
  const activeSession = shallowRef<ActiveTransferSession | null>(null)
  const pendingMapPlacement = shallowRef<SystemObjectTransferMapPlacementLease | null>(null)
  const mapPointerPreview = shallowRef<{
    lease: SystemObjectTransferMapPlacementLease
    preview: SystemObjectTransferMapPreview
  } | null>(null)
  const lastError = ref<string | null>(null)
  let nextSessionId = 1
  let openGeneration = 0

  const session = readonly(computed<SystemObjectTransferReviewState | null>(() => {
    const current = activeSession.value
    if (!current) return null
    const draft = current.draft
    const currentReview = draft.review.value
    const stale = draft.isStale.value
      || options.workspace.value !== current.workspaceReference
      || options.appliedRevision.value !== current.appliedRevision
    return {
      sessionId: current.id,
      open: current.open.value,
      placingOnMap: current.placingOnMap.value,
      confirming: current.confirming.value,
      error: current.error.value,
      sourceSystemId: current.sourceSystemId,
      rootObjectId: current.rootObjectId,
      destinationSystemId: draft.destinationSystemId.value,
      destinationSystems: draft.destinationSystems.value,
      placement: draft.placement.value,
      inputGeneration: draft.inputGeneration.value,
      request: draft.request.value,
      review: currentReview,
      sourceWorkspace: currentReview?.sourceWorkspace ?? null,
      previewWorkspace: currentReview?.previewWorkspace ?? null,
      movedObjectIds: currentReview?.branch.objectIds ?? [],
      movedOrbitIds: currentReview?.branch.orbitIds ?? [],
      locationKeys: draft.locationKeys.value,
      validationErrors: draft.validationErrors.value,
      canAccept: draft.canAccept.value && !stale,
      stale,
    }
  }))

  function setSessionError(current: ActiveTransferSession | null, message: string): void {
    if (current && activeSession.value === current) current.error.value = message
    else lastError.value = message
  }

  const mapPreview = readonly(computed<SystemObjectTransferMapPreview | null>(() => {
    const pointerPreview = mapPointerPreview.value
    if (pointerPreview && ownsMapPlacement(pointerPreview.lease)) return pointerPreview.preview
    const current = activeSession.value
    if (!current || options.workspace.value !== current.workspaceReference
      || options.appliedRevision.value !== current.appliedRevision || current.draft.isStale.value) return null
    const review = current?.draft.review.value
    if (!review) return null
    return {
      sessionId: current.id,
      sourceSystemId: current.sourceSystemId,
      rootObjectId: current.rootObjectId,
      destinationSystemId: review.request.destinationSystemId,
      previewWorkspace: review.previewWorkspace,
      movedObjectIds: review.branch.objectIds,
      movedOrbitIds: review.branch.orbitIds,
    }
  }))

  async function open(sourceSystemId: string, rootObjectId: string): Promise<void> {
    const epoch = ++openGeneration
    const previous = activeSession.value
    previous?.draft.cancel()
    activeSession.value = null
    pendingMapPlacement.value = null
    mapPointerPreview.value = null
    lastError.value = null

    try {
      if (!await options.resolveBeforeTransfer()) return
      if (epoch !== openGeneration) return
      if (!await options.beforeWorkspaceOperation()) return
      if (epoch !== openGeneration) return

      const current = options.workspace.value
      if (!current) throw new Error('There is no applied workspace to change.')
      const source = currentSystem(current, sourceSystemId)
      const root = source?.objects.find(object => object.id === rootObjectId)
      if (!source || !root || !resolveSystemObjectBranch(source, rootObjectId)) {
        throw new Error('The selected map object no longer exists in its source system.')
      }
      activeSession.value = createSession(current, sourceSystemId, rootObjectId)
    } catch (error) {
      lastError.value = error instanceof Error ? error.message : 'The transfer review could not be opened.'
    }
  }

  function createSession(
    current: LocalWorkspace,
    sourceSystemId: string,
    rootObjectId: string,
    drop?: SystemObjectTransferDrop,
  ): ActiveTransferSession {
    const draft = useSystemObjectTransferDraft(() => {
      const latest = options.workspace.value
      if (!latest) throw new Error('There is no applied workspace to change.')
      return latest
    }, sourceSystemId, rootObjectId)
    return {
      id: nextSessionId++,
      sourceSystemId,
      rootObjectId,
      workspaceReference: current,
      appliedRevision: options.appliedRevision.value,
      draft,
      open: ref(!drop),
      placingOnMap: ref(false),
      confirming: ref(false),
      error: ref(null),
      mapPlacementOwner: null,
      drop,
    }
  }

  async function dropObject(drop: SystemObjectTransferDrop): Promise<void> {
    const workspaceSnapshot = options.workspace.value
    if (activeSession.value || !workspaceSnapshot || toRaw(workspaceSnapshot) !== toRaw(drop.workspaceSnapshot)) return
    const epoch = ++openGeneration
    const { sourceSystemId, rootObjectId, destinationSystemId, placement } = drop
    const request = { sourceSystemId, rootObjectId, destinationSystemId, placement }
    const ownsContext = (): boolean => epoch === openGeneration && activeSession.value === null
      && options.workspace.value?.id === workspaceSnapshot.id
      && options.workspace.value.cluster.id === workspaceSnapshot.cluster.id
    let admittedWorkspace = workspaceSnapshot
    let admittedRevision = options.appliedRevision.value
    const ownsDrop = (): boolean => ownsContext()
      && options.workspace.value === admittedWorkspace && options.appliedRevision.value === admittedRevision
    const onDraftApplied = (): void => {
      const current = options.workspace.value
      const revision = options.appliedRevision.value
      if (!current || !ownsContext() || revision !== admittedRevision + 1) return
      admittedWorkspace = current
      admittedRevision = revision
    }
    lastError.value = null
    try {
      if (!await options.beforeWorkspaceOperation() || !ownsDrop()) return
      const preview = prepareSystemObjectTransfer(workspaceSnapshot, request)
      if (options.resolveBeforeDrop && !await options.resolveBeforeDrop(preview, ownsDrop, onDraftApplied)) return
      if (!ownsDrop()) return
      // An explicitly applied draft may have published during the guard. Seed the review against
      // the resulting workspace and let normal admission revalidate the chosen destination.
      const next = createSession(admittedWorkspace, sourceSystemId, rootObjectId, drop)
      next.draft.selectDestination(destinationSystemId)
      if (placement.kind === 'orbit') next.draft.chooseOrbitPlacement(placement.orbitId, placement.angle)
      else next.draft.chooseFreePlacement({ x: placement.x, y: placement.y })
      const review = next.draft.review.value
      if (!review) throw new Error(next.draft.error.value ?? 'The dropped position is no longer available.')
      activeSession.value = next
      if (review.keyConflicts.length || review.detachedRouteAttachments.length || review.clearedStationLinks.length) {
        next.open.value = true
      } else {
        const result = await apply(next.id)
        if (activeSession.value === next && result.status !== 'applied') {
          cancel(next.id)
          if (result.status === 'rejected') lastError.value = result.message
        }
      }
    } catch (error) {
      if (ownsDrop()) lastError.value = error instanceof Error ? error.message : 'The dropped object could not change systems.'
    }
  }

  function ownsSession(sessionId: number): ActiveTransferSession | null {
    const current = activeSession.value
    return current?.id === sessionId ? current : null
  }

  async function beginMapPlacement(current: ActiveTransferSession): Promise<void> {
    const destinationSystemId = current.draft.destinationSystemId.value
    if (!destinationSystemId) {
      current.error.value = 'Choose a destination star system before placing the object.'
      return
    }
    const workspace = options.workspace.value
    if (!workspace || workspace !== current.workspaceReference
      || options.appliedRevision.value !== current.appliedRevision) {
      current.error.value = 'The applied workspace changed after this review. Start a fresh review before placing the object.'
      return
    }
    if (options.hasDestinationGeometryDraft?.(destinationSystemId)) {
      current.error.value = destinationDraftMessage
      return
    }
    const revision = options.appliedRevision.value
    const inputGeneration = current.draft.inputGeneration.value
    const placementGeneration = current.draft.placementGeneration.value
    const selectedPlacement = current.draft.placement.value
    const placementCandidate: SystemObjectTransferPlacement = selectedPlacement?.kind === 'orbit'
      ? { kind: 'orbit', orbitId: selectedPlacement.orbitId, angle: selectedPlacement.angle }
      : {
          kind: 'system',
          x: selectedPlacement?.x ?? 0.5,
          y: selectedPlacement?.y ?? 0.5,
        }
    const isCurrent = (): boolean => activeSession.value === current
      && options.workspace.value === workspace
      && options.appliedRevision.value === revision
      && current.draft.inputGeneration.value === inputGeneration
      && current.draft.placementGeneration.value === placementGeneration
      && current.draft.destinationSystemId.value === destinationSystemId
    if (options.prepareDestinationMap) {
      try {
        const prepared = await options.prepareDestinationMap(destinationSystemId, isCurrent)
        if (!prepared || !isCurrent()) {
          if (activeSession.value === current) {
            current.error.value = isCurrent()
              ? 'The destination map could not be prepared for placement.'
              : 'The transfer review changed before map placement could start.'
          }
          return
        }
      } catch (error) {
        if (activeSession.value === current) {
          current.error.value = error instanceof Error
            ? error.message
            : 'The destination map could not be prepared for placement.'
        }
        return
      }
    }
    if (!isCurrent()) {
      if (activeSession.value === current) {
        current.error.value = 'The transfer review changed before map placement could start.'
      }
      return
    }
    if (options.hasDestinationGeometryDraft?.(destinationSystemId)) {
      current.error.value = destinationDraftMessage
      return
    }
    const mapOwner = options.captureDestinationMapOwner(destinationSystemId)
    if (!mapOwner || !options.isDestinationMapOwnerCurrent(destinationSystemId, mapOwner)) {
      current.error.value = 'Open the selected destination map before placing the transferred object.'
      return
    }
    current.error.value = null
    current.open.value = false
    current.placingOnMap.value = true
    mapPointerPreview.value = null
    pendingMapPlacement.value = Object.freeze({
      sessionId: current.id,
      inputGeneration: current.draft.inputGeneration.value,
      placementGeneration: current.draft.placementGeneration.value,
      destinationSystemId,
      rootObjectId: current.rootObjectId,
      placementCandidate: Object.freeze(placementCandidate),
      workspaceReference: workspace,
      appliedRevision: options.appliedRevision.value,
      mapOwner,
    })
  }

  function failMapPlacement(current: ActiveTransferSession, message: string): false {
    current.open.value = true
    current.placingOnMap.value = false
    current.error.value = message
    pendingMapPlacement.value = null
    mapPointerPreview.value = null
    return false
  }

  function ownsMapPlacement(lease: SystemObjectTransferMapPlacementLease): boolean {
    const current = ownsSession(lease.sessionId)
    return !!current
      && pendingMapPlacement.value === lease
      && options.workspace.value === lease.workspaceReference
      && options.appliedRevision.value === lease.appliedRevision
      && current.draft.inputGeneration.value === lease.inputGeneration
      && current.draft.placementGeneration.value === lease.placementGeneration
      && current.draft.destinationSystemId.value === lease.destinationSystemId
      && !options.hasDestinationGeometryDraft?.(lease.destinationSystemId)
      && options.isDestinationMapOwnerCurrent(lease.destinationSystemId, lease.mapOwner)
  }

  watch(() => {
    const lease = pendingMapPlacement.value
    return lease && options.hasDestinationGeometryDraft?.(lease.destinationSystemId) ? lease : null
  }, lease => {
    const current = lease && ownsSession(lease.sessionId)
    if (current) failMapPlacement(current, destinationDraftMessage)
  }, { flush: 'sync' })

  function completeMapPlacement(
    lease: SystemObjectTransferMapPlacementLease,
    placement: SystemObjectTransferPlacement,
  ): boolean {
    const current = ownsSession(lease.sessionId)
    if (!current || pendingMapPlacement.value !== lease) return false
    if (!ownsMapPlacement(lease)) {
      return failMapPlacement(current, 'The destination map changed during placement. Review the transfer and place it again.')
    }

    if (placement.kind === 'system') current.draft.chooseFreePlacement({ x: placement.x, y: placement.y })
    else current.draft.chooseOrbitPlacement(placement.orbitId, placement.angle)
    mapPointerPreview.value = null
    current.mapPlacementOwner = {
      destinationSystemId: lease.destinationSystemId,
      mapOwner: lease.mapOwner,
      placementGeneration: current.draft.placementGeneration.value,
    }
    current.placingOnMap.value = false
    current.open.value = true
    current.error.value = current.draft.error.value
    pendingMapPlacement.value = null
    return true
  }

  function previewMapPlacement(
    lease: SystemObjectTransferMapPlacementLease,
    placement: SystemObjectTransferPlacement | null,
  ): boolean {
    const current = ownsSession(lease.sessionId)
    if (!current || !ownsMapPlacement(lease)) return false
    if (!placement) {
      mapPointerPreview.value = null
      return true
    }
    try {
      const review = prepareSystemObjectTransfer(lease.workspaceReference, {
        sourceSystemId: current.sourceSystemId,
        rootObjectId: current.rootObjectId,
        destinationSystemId: lease.destinationSystemId,
        placement,
      })
      mapPointerPreview.value = {
        lease,
        preview: {
          sessionId: lease.sessionId,
          sourceSystemId: review.request.sourceSystemId,
          rootObjectId: review.request.rootObjectId,
          destinationSystemId: review.request.destinationSystemId,
          previewWorkspace: review.previewWorkspace,
          movedObjectIds: review.branch.objectIds,
          movedOrbitIds: review.branch.orbitIds,
        },
      }
      return true
    } catch {
      mapPointerPreview.value = null
      return false
    }
  }

  async function apply(sessionId: number): Promise<WorkspaceMutationResult> {
    const current = ownsSession(sessionId)
    if (!current) return rejected('stale', 'This transfer review is no longer active.')
    if (current.confirming.value) return rejected('busy', 'The transfer is already being applied.')
    if (current.placingOnMap.value) return rejected('busy', 'Finish or cancel map placement before applying the transfer.')
    let acceptance: SystemObjectTransferAcceptance
    let dropReview: SystemObjectTransferReview | undefined
    try {
      acceptance = current.draft.captureAcceptance()
      if (current.drop) dropReview = prepareSystemObjectTransfer(acceptance.workspaceReference, acceptance.request)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The transfer review is not valid.'
      setSessionError(current, message)
      return rejected(current.draft.isStale.value ? 'stale' : 'invalid', message)
    }
    const destinationSystemId = acceptance.request.destinationSystemId
    const canApplyToDestination = (): boolean => dropReview
      ? options.canApplyDrop?.(dropReview) ?? true
      : !options.hasDestinationGeometryDraft?.(destinationSystemId)
    if (!canApplyToDestination()) {
      const message = dropReview ? 'Finish the Inspector draft affected by this transfer first.' : destinationDraftMessage
      setSessionError(current, message)
      return rejected('unavailable', message)
    }
    const workspace = options.workspace.value
    const revision = options.appliedRevision.value
    if (!workspace || workspace !== acceptance.workspaceReference
      || workspace !== current.workspaceReference || revision !== current.appliedRevision) {
      const message = 'The applied workspace changed after this review. Start a fresh review before accepting.'
      setSessionError(current, message)
      return rejected('stale', message)
    }
    const mapOwnerAtApply = current.mapPlacementOwner
    if (mapOwnerAtApply && (
      mapOwnerAtApply.destinationSystemId !== acceptance.request.destinationSystemId
      || mapOwnerAtApply.placementGeneration !== current.draft.placementGeneration.value
      || !options.isDestinationMapOwnerCurrent(mapOwnerAtApply.destinationSystemId, mapOwnerAtApply.mapOwner)
    )) {
      const message = 'The destination map changed after placement. Place the object again before accepting.'
      setSessionError(current, message)
      return rejected('stale', message)
    }

    current.confirming.value = true
    current.error.value = null
    const restoreDropInspection = dropReview ? options.captureDropInspection?.(dropReview) : undefined
    const isCurrent = (): boolean => activeSession.value === current
      && current.draft.isAcceptanceCurrent(acceptance)
      && options.workspace.value === acceptance.workspaceReference
      && options.appliedRevision.value === revision
      && canApplyToDestination()
      && (!mapOwnerAtApply
        || options.isDestinationMapOwnerCurrent(mapOwnerAtApply.destinationSystemId, mapOwnerAtApply.mapOwner))
    const root = currentSystem(workspace, current.sourceSystemId)?.objects
      .find(object => object.id === current.rootObjectId)
    const request = {
      action: {
        kind: 'transfer' as const,
        label: `Change system for ${root?.name ?? 'map object'}`,
        target: { kind: 'object' as const, id: current.rootObjectId, systemId: current.sourceSystemId },
        parent: { kind: 'system' as const, id: acceptance.request.destinationSystemId },
      },
      isCurrent,
      prepare: (latest: LocalWorkspace): LocalWorkspace => {
        // The shared history pipeline prepares against a detached snapshot. `isCurrent` binds
        // that snapshot to the exact reviewed owner, revision, and input generation.
        if (!isCurrent()) throw new Error('The transfer review changed before it could be applied.')
        let next = applySystemObjectTransfer(latest, acceptance.request, acceptance.locationKeys)
        if (current.drop?.sourceFrameInsets && !workspaceSystemFrame(next, current.sourceSystemId)) {
          next = setWorkspaceSystemFrame(next, current.sourceSystemId, current.drop.sourceFrameInsets)
        }
        if (current.drop?.destinationFrameInsets && acceptance.request.destinationSystemId === current.drop.destinationSystemId
          && !workspaceSystemFrame(next, acceptance.request.destinationSystemId)) {
          next = setWorkspaceSystemFrame(next, acceptance.request.destinationSystemId, current.drop.destinationFrameInsets)
        }
        return next
      },
    }

    let result: WorkspaceMutationResult
    try {
      result = await options.history.execute(request)
    } catch (error) {
      result = rejected('failed', error instanceof Error ? error.message : String(error))
    }
    current.confirming.value = false
    if (result.status === 'applied') {
      if (activeSession.value === current && current.draft.inputGeneration.value === acceptance.inputGeneration) {
        try {
          if (!current.drop) options.onApplied?.({
            rootObjectId: current.rootObjectId,
            sourceSystemId: current.sourceSystemId,
            destinationSystemId: acceptance.request.destinationSystemId,
          })
        } catch {
          // A navigation effect cannot change the already-published mutation verdict.
        }
        current.draft.cancel()
        activeSession.value = null
        pendingMapPlacement.value = null
        try {
          restoreDropInspection?.()
        } catch {
          // Inspection recovery is separate from an already-published transfer.
        }
      }
      return result
    }
    if (activeSession.value === current) {
      current.error.value = result.status === 'rejected' ? result.message : null
      current.open.value = true
      current.placingOnMap.value = false
    }
    return result
  }

  function cancel(sessionId: number): void {
    const current = ownsSession(sessionId)
    if (!current || current.confirming.value) return
    current.draft.cancel()
    activeSession.value = null
    pendingMapPlacement.value = null
    mapPointerPreview.value = null
  }

  async function handleIntent(intent: SystemObjectTransferIntent): Promise<WorkspaceMutationResult | void> {
    if (intent.kind === 'open') return open(intent.sourceSystemId, intent.rootObjectId)
    const current = ownsSession(intent.sessionId)
    if (!current) return rejected('stale', 'This transfer review is no longer active.')
    if (current.confirming.value) return rejected('busy', 'Finish applying the transfer before editing this review.')
    if (current.placingOnMap.value
      && intent.kind !== 'cancel-map-placement'
      && intent.kind !== 'cancel') {
      return rejected('busy', 'Finish or cancel map placement before editing this review.')
    }

    try {
      switch (intent.kind) {
        case 'select-destination':
          current.draft.selectDestination(intent.systemId)
          current.mapPlacementOwner = null
          mapPointerPreview.value = null
          current.error.value = null
          break
        case 'choose-free-placement':
          current.draft.chooseFreePlacement(intent.point)
          current.mapPlacementOwner = null
          mapPointerPreview.value = null
          current.error.value = current.draft.error.value
          break
        case 'choose-orbit-placement':
          current.draft.chooseOrbitPlacement(intent.orbitId, intent.angle)
          current.mapPlacementOwner = null
          mapPointerPreview.value = null
          current.error.value = current.draft.error.value
          break
        case 'set-location-key':
          current.draft.setLocationKey(intent.objectId, intent.value)
          current.error.value = null
          break
        case 'place-on-map':
          await beginMapPlacement(current)
          break
        case 'cancel-map-placement':
          if (pendingMapPlacement.value === intent.lease) {
            pendingMapPlacement.value = null
            mapPointerPreview.value = null
            current.placingOnMap.value = false
            current.open.value = true
            current.error.value = null
          }
          break
        case 'apply':
          return apply(intent.sessionId)
        case 'cancel':
          cancel(intent.sessionId)
          break
      }
      return undefined
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The transfer review could not be updated.'
      setSessionError(current, message)
      return rejected(current.draft.isStale.value ? 'stale' : 'invalid', message)
    }
  }

  function dispose(): void {
    openGeneration += 1
    activeSession.value?.draft.cancel()
    activeSession.value = null
    pendingMapPlacement.value = null
    mapPointerPreview.value = null
  }

  return {
    session,
    pendingMapPlacement: computed(() => pendingMapPlacement.value),
    mapPreview,
    lastError: readonly(lastError),
    handleIntent,
    dropObject,
    ownsMapPlacement,
    previewMapPlacement,
    completeMapPlacement,
    dispose,
  }
}
