/** Editor-owned reactive draft for reviewing and validating one hosted branch transfer. */
import { computed, ref, shallowRef, readonly } from 'vue'
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

interface ReviewState {
  review: SystemObjectTransferReview | null
  error: string | null
}

/**
 * Owns one transient destination, placement, and editable-key draft. It never publishes workspace data;
 * the caller receives an immutable candidate and owns draft guards, history, and persistence.
 *
 * `getWorkspace` should read the current applied workspace so a changed or removed source target
 * invalidates the preview before acceptance.
 */
export function useSystemObjectTransferDraft(
  getWorkspace: () => LocalWorkspace,
  sourceSystemId: string,
  rootObjectId: string,
) {
  const destinationSystemId = ref<string | null>(null)
  const placement = shallowRef<SystemObjectTransferPlacement | null>(null)
  const editedKeys = shallowRef(new Map<string, string>())
  const cancelled = ref(false)

  const request = computed<SystemObjectTransferRequest | null>(() => {
    if (cancelled.value || !destinationSystemId.value || !placement.value) return null
    return {
      sourceSystemId,
      rootObjectId,
      destinationSystemId: destinationSystemId.value,
      placement: placement.value,
    }
  })

  const reviewState = computed<ReviewState>(() => {
    if (!request.value) return { review: null, error: null }
    try {
      return { review: prepareSystemObjectTransfer(getWorkspace(), request.value), error: null }
    } catch (error) {
      return {
        review: null,
        error: error instanceof Error ? error.message : 'The transfer preview is no longer valid.',
      }
    }
  })

  const review = computed(() => reviewState.value.review)
  const error = computed(() => reviewState.value.error)
  const locationKeys = computed<ReadonlyMap<string, string>>(() => {
    const currentReview = review.value
    if (!currentReview) return new Map()
    const keys = new Map(currentReview.suggestedLocationKeys)
    for (const [objectId, value] of editedKeys.value) {
      if (currentReview.branch.objectIds.includes(objectId)) keys.set(objectId, value)
    }
    return keys
  })
  const validationErrors = computed<ReadonlyMap<string, string>>(() => {
    const currentReview = review.value
    return currentReview
      ? validateSystemObjectTransferKeys(currentReview, locationKeys.value)
      : new Map()
  })
  const canAccept = computed(() => !!review.value && validationErrors.value.size === 0 && !cancelled.value)
  const status = computed<TransferDraftStatus>(() => {
    if (cancelled.value) return 'cancelled'
    if (!destinationSystemId.value) return 'choose-destination'
    if (!placement.value) return 'choose-placement'
    if (error.value || validationErrors.value.size > 0) return 'invalid'
    return canAccept.value ? 'ready' : 'invalid'
  })
  const destinationSystems = computed(() => getWorkspace().cluster.systems
    .filter(system => system.id !== sourceSystemId))

  function ensureOpen(): void {
    if (cancelled.value) throw new Error('This transfer draft has been cancelled.')
  }

  function ensureDestination(): void {
    ensureOpen()
    if (!destinationSystemId.value) throw new Error('Choose a destination star system first.')
  }

  function selectDestination(systemId: string): void {
    ensureOpen()
    destinationSystemId.value = systemId
    placement.value = null
    editedKeys.value = new Map()
  }

  function chooseFreePlacement(point: Point): void {
    ensureDestination()
    placement.value = { kind: 'system', x: point.x, y: point.y }
  }

  function chooseOrbitPlacement(orbitId: string, angle: number): void {
    ensureDestination()
    placement.value = { kind: 'orbit', orbitId, angle }
  }

  function setLocationKey(objectId: string, value: string): void {
    ensureOpen()
    if (!review.value?.branch.objectIds.includes(objectId)) {
      throw new Error('Choose a Location key for an object in the reviewed branch.')
    }
    const next = new Map(editedKeys.value)
    next.set(objectId, value)
    editedKeys.value = next
  }

  function accept(): LocalWorkspace {
    ensureOpen()
    const currentRequest = request.value
    if (!currentRequest) throw new Error('Choose a destination and placement before accepting the transfer.')

    const currentWorkspace = getWorkspace()
    const currentReview = prepareSystemObjectTransfer(currentWorkspace, currentRequest)
    const currentKeys = new Map(currentReview.suggestedLocationKeys)
    for (const [objectId, value] of editedKeys.value) {
      if (currentReview.branch.objectIds.includes(objectId)) currentKeys.set(objectId, value)
    }
    const issues = validateSystemObjectTransferKeys(currentReview, currentKeys)
    const firstIssue = issues.values().next().value
    if (firstIssue) throw new Error(firstIssue)
    return applySystemObjectTransfer(currentWorkspace, currentRequest, currentKeys)
  }

  function cancel(): void {
    cancelled.value = true
    destinationSystemId.value = null
    placement.value = null
    editedKeys.value = new Map()
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
    selectDestination,
    chooseFreePlacement,
    chooseOrbitPlacement,
    setLocationKey,
    accept,
    cancel,
  }
}
