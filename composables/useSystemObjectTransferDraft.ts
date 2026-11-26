/** Editor-owned reactive draft for reviewing and validating one hosted branch transfer. */
import { computed, readonly, ref, shallowRef } from 'vue'
import type { LocalWorkspace, Point } from '../domain/workspace'
import {
  applySystemObjectTransfer,
  prepareSystemObjectTransfer,
  validateSystemObjectTransferKeys,
} from '../domain/workspace'
import type {
  SystemObjectTransferPlacement,
  SystemObjectTransferRequest,
  SystemObjectTransferReview,
} from '../domain/workspace'

type TransferDraftStatus = 'choose-destination' | 'choose-placement' | 'ready' | 'invalid' | 'cancelled'

export interface SystemObjectTransferAcceptance {
  readonly workspaceReference: LocalWorkspace
  readonly inputGeneration: number
  readonly request: SystemObjectTransferRequest
  readonly locationKeys: ReadonlyMap<string, string>
}

interface ReviewState {
  review: SystemObjectTransferReview | null
  error: string | null
  stale: boolean
}

function copyRequest(request: SystemObjectTransferRequest): SystemObjectTransferRequest {
  return {
    sourceSystemId: request.sourceSystemId,
    rootObjectId: request.rootObjectId,
    destinationSystemId: request.destinationSystemId,
    placement: { ...request.placement },
  }
}

/**
 * Owns one transient destination, placement, and editable-key draft. It never publishes workspace data;
 * the caller receives an immutable acceptance capture and owns guards, history, and persistence.
 *
 * The exact applied workspace reference is captured when the draft opens. If it changes, the review
 * displays the latest consequences but cannot accept until the owner starts a new guarded review.
 */
export function useSystemObjectTransferDraft(
  getWorkspace: () => LocalWorkspace,
  sourceSystemId: string,
  rootObjectId: string,
) {
  const capturedWorkspace = shallowRef(getWorkspace())
  const destinationSystemId = ref<string | null>(null)
  const placement = shallowRef<SystemObjectTransferPlacement | null>(null)
  const editedKeys = shallowRef(new Map<string, string>())
  const cancelled = ref(false)
  const inputGeneration = ref(0)
  const placementGeneration = ref(0)

  const rawRequest = computed<SystemObjectTransferRequest | null>(() => {
    if (cancelled.value || !destinationSystemId.value || !placement.value) return null
    return {
      sourceSystemId,
      rootObjectId,
      destinationSystemId: destinationSystemId.value,
      placement: { ...placement.value },
    }
  })
  const request = readonly(rawRequest)

  const initialReview = computed<SystemObjectTransferReview | null>(() => {
    const currentRequest = rawRequest.value
    if (!currentRequest || cancelled.value) return null
    try {
      return prepareSystemObjectTransfer(capturedWorkspace.value, currentRequest)
    } catch {
      return null
    }
  })

  const reviewState = computed<ReviewState>(() => {
    const currentRequest = rawRequest.value
    if (!currentRequest || cancelled.value) return { review: null, error: null, stale: false }
    if (getWorkspace() === capturedWorkspace.value) {
      try {
        return {
          review: prepareSystemObjectTransfer(capturedWorkspace.value, currentRequest),
          error: null,
          stale: false,
        }
      } catch (error) {
        return {
          review: null,
          error: error instanceof Error ? error.message : 'The transfer preview is no longer valid.',
          stale: false,
        }
      }
    }

    try {
      return {
        review: prepareSystemObjectTransfer(getWorkspace(), currentRequest),
        error: 'The applied workspace changed after this review. Start a fresh review before accepting.',
        stale: true,
      }
    } catch (error) {
      return {
        review: null,
        error: error instanceof Error ? error.message : 'The transfer preview is no longer valid.',
        stale: true,
      }
    }
  })

  const review = readonly(computed(() => reviewState.value.review))
  const error = computed(() => reviewState.value.error)
  const isStale = computed(() => reviewState.value.stale)
  const locationKeys = readonly(computed<ReadonlyMap<string, string>>(() => {
    const initial = initialReview.value
    if (!initial) return new Map()
    const keys = new Map(initial.suggestedLocationKeys)
    for (const [objectId, value] of editedKeys.value) {
      if (initial.branch.objectIds.includes(objectId)) keys.set(objectId, value)
    }
    return keys
  }))
  const validationErrors = readonly(computed<ReadonlyMap<string, string>>(() => {
    const currentReview = review.value
    return currentReview
      ? validateSystemObjectTransferKeys(currentReview, locationKeys.value)
      : new Map()
  }))
  const canAccept = computed(() => !!review.value
    && !isStale.value
    && validationErrors.value.size === 0
    && !cancelled.value)
  const status = computed<TransferDraftStatus>(() => {
    if (cancelled.value) return 'cancelled'
    if (!destinationSystemId.value) return 'choose-destination'
    if (!placement.value) return 'choose-placement'
    if (error.value || validationErrors.value.size > 0) return 'invalid'
    return canAccept.value ? 'ready' : 'invalid'
  })
  const destinationSystems = readonly(computed(() => getWorkspace().cluster.systems
    .filter(system => system.id !== sourceSystemId)))

  function ensureOpen(): void {
    if (cancelled.value) throw new Error('This transfer draft has been cancelled.')
  }

  function ensureDestination(): void {
    ensureOpen()
    if (!destinationSystemId.value) throw new Error('Choose a destination Zone first.')
  }

  function selectDestination(systemId: string): void {
    ensureOpen()
    destinationSystemId.value = systemId
    placement.value = null
    editedKeys.value = new Map()
    inputGeneration.value += 1
    placementGeneration.value += 1
  }

  function chooseFreePlacement(point: Point): void {
    ensureDestination()
    placement.value = { kind: 'system', x: point.x, y: point.y }
    inputGeneration.value += 1
    placementGeneration.value += 1
  }

  function chooseOrbitPlacement(orbitId: string, angle: number): void {
    ensureDestination()
    placement.value = { kind: 'orbit', orbitId, angle }
    inputGeneration.value += 1
    placementGeneration.value += 1
  }

  function setLocationKey(objectId: string, value: string): void {
    ensureOpen()
    if (isStale.value) throw new Error('Start a fresh transfer review before changing Location keys.')
    if (!initialReview.value?.keyConflicts.some(conflict => conflict.objectId === objectId)) {
      throw new Error('Only a conflicting Location key can be replaced during transfer.')
    }
    const next = new Map(editedKeys.value)
    next.set(objectId, value)
    editedKeys.value = next
    inputGeneration.value += 1
  }

  function captureAcceptance(): SystemObjectTransferAcceptance {
    ensureOpen()
    const currentRequest = rawRequest.value
    if (!currentRequest) throw new Error('Choose a destination and placement before accepting the transfer.')
    if (getWorkspace() !== capturedWorkspace.value || isStale.value) {
      throw new Error(error.value ?? 'The applied workspace changed after this review. Start a fresh review before accepting.')
    }
    const currentReview = review.value
    if (!currentReview) throw new Error(error.value ?? 'The transfer review is no longer valid.')
    const currentKeys = new Map(locationKeys.value)
    const issues = validateSystemObjectTransferKeys(currentReview, currentKeys)
    const firstIssue = issues.values().next().value
    if (firstIssue) throw new Error(firstIssue)
    const capturedRequest = copyRequest(currentRequest)
    Object.freeze(capturedRequest.placement)
    Object.freeze(capturedRequest)
    return Object.freeze({
      workspaceReference: capturedWorkspace.value,
      inputGeneration: inputGeneration.value,
      request: capturedRequest,
      locationKeys: readonly(currentKeys),
    })
  }

  function isAcceptanceCurrent(capture: SystemObjectTransferAcceptance): boolean {
    return !cancelled.value
      && capture.workspaceReference === capturedWorkspace.value
      && getWorkspace() === capture.workspaceReference
      && inputGeneration.value === capture.inputGeneration
  }

  function applyAcceptance(
    capture: SystemObjectTransferAcceptance,
    currentWorkspace = getWorkspace(),
  ): LocalWorkspace {
    if (!isAcceptanceCurrent(capture) || currentWorkspace !== capture.workspaceReference) {
      throw new Error('The transfer review changed before it could be accepted.')
    }
    return applySystemObjectTransfer(currentWorkspace, capture.request, capture.locationKeys)
  }

  function accept(): LocalWorkspace {
    const capture = captureAcceptance()
    return applyAcceptance(capture)
  }

  function cancel(): void {
    cancelled.value = true
    destinationSystemId.value = null
    placement.value = null
    editedKeys.value = new Map()
    inputGeneration.value += 1
  }

  return {
    destinationSystemId: readonly(destinationSystemId),
    destinationSystems,
    placement: readonly(placement),
    request,
    review,
    locationKeys,
    validationErrors,
    canAccept,
    status,
    error,
    isStale,
    inputGeneration: readonly(inputGeneration),
    placementGeneration: readonly(placementGeneration),
    selectDestination,
    chooseFreePlacement,
    chooseOrbitPlacement,
    setLocationKey,
    captureAcceptance,
    isAcceptanceCurrent,
    applyAcceptance,
    accept,
    cancel,
  }
}
