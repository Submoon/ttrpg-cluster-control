/** Page-owned admission, freshness review and durable replacement for complete local or remote backups. */
import { computed, onBeforeUnmount, readonly, ref, type Ref } from 'vue'
import type { LocalWorkspace } from '../domain/workspace'
import { createWorkspaceSnapshot, type WorkspaceStorageVersion } from '../utils/workspace-storage'
import { restoreJumpClusterBackup } from '../domain/workspace-json-import'

export type WorkspaceRestoreSourceKind = 'local-file' | 'google-drive'

export interface WorkspaceRestoreSource {
  name: string
  content: unknown
  sourceKind: WorkspaceRestoreSourceKind
}

export interface WorkspaceRestoreReview {
  sourceName: string
  activeName: string
  incomingName: string
  canDownloadCurrent: boolean
  hasDrafts: boolean
  discardDraftsConfirmed: boolean
  confirming: boolean
  stale: boolean
  error: string
}

interface CapturedRestoreReview {
  id: number
  sourceKind: WorkspaceRestoreSourceKind
  presentation: WorkspaceRestoreReview
  incoming: LocalWorkspace
  active: LocalWorkspace | null
  activeSignature: string
  appliedRevision: number
  durableVersion: WorkspaceStorageVersion
  draftSignature: string
}

interface RestoreOperationContext {
  workspaceSignature: string
  appliedRevision: number
  durableVersionSignature: string
  draftSignature: string
}

interface WorkspaceRestoreOptions {
  workspace: Readonly<Ref<LocalWorkspace | null>>
  appliedRevision: Readonly<Ref<number>>
  durableVersion: Readonly<Ref<WorkspaceStorageVersion | null>>
  getDraftConsentState(): { signature: string; hasDrafts: boolean }
  replaceFromBackup(workspace: LocalWorkspace, expected: WorkspaceStorageVersion): Promise<void>
  downloadCurrent(workspace: LocalWorkspace): void
  afterReplacement(sourceKind: WorkspaceRestoreSourceKind): void
}

function valueSignature(value: unknown): string {
  return JSON.stringify(value)
}

function durableVersionSignature(version: WorkspaceStorageVersion | null): string {
  if (!version) return ''
  return JSON.stringify({
    revision: version.revision,
    recordStatus: version.recordStatus,
    fingerprint: version.fingerprint,
    ownerId: version.ownerId,
    workspace: version.workspace,
  })
}

function captureOperationContext(options: WorkspaceRestoreOptions): RestoreOperationContext {
  return {
    workspaceSignature: valueSignature(options.workspace.value),
    appliedRevision: options.appliedRevision.value,
    durableVersionSignature: durableVersionSignature(options.durableVersion.value),
    draftSignature: options.getDraftConsentState().signature,
  }
}

function operationContextIsCurrent(options: WorkspaceRestoreOptions, context: RestoreOperationContext): boolean {
  return valueSignature(options.workspace.value) === context.workspaceSignature
    && options.appliedRevision.value === context.appliedRevision
    && durableVersionSignature(options.durableVersion.value) === context.durableVersionSignature
    && options.getDraftConsentState().signature === context.draftSignature
}

function parseJsonContent(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value) as unknown
  } catch {
    throw new Error('The selected file is not valid JSON.')
  }
}

/**
 * Owns one editor restore flow. Provider loading is passed as a callback so operation ownership starts before OAuth,
 * backup listing or file reads; only a still-current load may replace the visible review.
 */
export function useWorkspaceRestore(options: WorkspaceRestoreOptions) {
  const mutableReview = ref<CapturedRestoreReview | null>(null)
  const loadError = ref('')
  const loading = ref(false)
  let operationSequence = 0
  let activeOperationAbortController: AbortController | undefined

  const review = computed(() => mutableReview.value?.presentation ?? null)

  function errorText(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
  }

  function captureReview(
    sourceName: string,
    sourceKind: WorkspaceRestoreSourceKind,
    incoming: LocalWorkspace,
    id: number,
    stale: boolean,
  ): boolean {
    const active = options.workspace.value
    const durableVersion = options.durableVersion.value
    if (!durableVersion) {
      loadError.value = 'The local workspace version is not ready. Retry after the current save finishes.'
      mutableReview.value = null
      return false
    }

    const activeSnapshot = active ? createWorkspaceSnapshot(active) : null
    const draftState = options.getDraftConsentState()
    const captured: CapturedRestoreReview = {
      id,
      sourceKind,
      incoming,
      active: activeSnapshot,
      activeSignature: valueSignature(activeSnapshot),
      appliedRevision: options.appliedRevision.value,
      durableVersion,
      draftSignature: draftState.signature,
      presentation: {
        sourceName,
        activeName: activeSnapshot?.cluster.name ?? 'No active local Jump Cluster',
        incomingName: incoming.cluster.name,
        canDownloadCurrent: activeSnapshot !== null,
        hasDrafts: draftState.hasDrafts,
        discardDraftsConfirmed: !draftState.hasDrafts,
        confirming: false,
        stale,
        error: '',
      },
    }
    mutableReview.value = captured
    return true
  }

  function reviewIsStale(captured: CapturedRestoreReview): boolean {
    const active = options.workspace.value
    if ((active === null) !== (captured.active === null)) return true
    return options.appliedRevision.value !== captured.appliedRevision
      || valueSignature(active) !== captured.activeSignature
      || durableVersionSignature(options.durableVersion.value) !== durableVersionSignature(captured.durableVersion)
      || options.getDraftConsentState().signature !== captured.draftSignature
  }

  /** Starts a new operation before awaiting external work; stale provider responses are ignored. */
  async function openFrom(
    load: (signal?: AbortSignal) => Promise<WorkspaceRestoreSource | null>,
    signal?: AbortSignal,
  ): Promise<boolean> {
    if (mutableReview.value?.presentation.confirming || signal?.aborted) return false
    const operationId = ++operationSequence
    activeOperationAbortController?.abort()
    const operationAbortController = new AbortController()
    activeOperationAbortController = operationAbortController
    const relayExternalAbort = () => operationAbortController.abort()
    signal?.addEventListener('abort', relayExternalAbort, { once: true })
    const initialContext = captureOperationContext(options)
    mutableReview.value = null
    loadError.value = ''
    loading.value = true

    let onAbort: (() => void) | undefined
    const aborted = new Promise<{ kind: 'aborted' }>(resolve => {
      onAbort = () => {
        if (operationSequence === operationId
          && activeOperationAbortController === operationAbortController
          && !mutableReview.value?.presentation.confirming) {
          operationSequence += 1
          activeOperationAbortController = undefined
          loading.value = false
          mutableReview.value = null
          loadError.value = ''
        }
        resolve({ kind: 'aborted' })
      }
      operationAbortController.signal.addEventListener('abort', onAbort, { once: true })
    })

    try {
      // Invoke the loader synchronously so gesture-gated providers can start OAuth before the first await.
      const loadResult = load(operationAbortController.signal).then(value => ({ kind: 'loaded' as const, value }))
      const outcome = await Promise.race([loadResult, aborted])
      if (outcome.kind === 'aborted' || operationId !== operationSequence) return false
      const source = outcome.value
      if (!source) return true
      if (!operationContextIsCurrent(options, initialContext)) {
        loadError.value = 'The active workspace or draft state changed while choosing a backup. Start restore again to review the latest state.'
        return true
      }
      const parsed = parseJsonContent(source.content)
      const incoming = restoreJumpClusterBackup(parsed)
      if (operationId !== operationSequence) return false
      captureReview(source.name, source.sourceKind, incoming, operationId, false)
      return true
    } catch (error) {
      if (operationId === operationSequence) loadError.value = errorText(error)
      return true
    } finally {
      if (signal) signal.removeEventListener('abort', relayExternalAbort)
      if (onAbort) operationAbortController.signal.removeEventListener('abort', onAbort)
      if (activeOperationAbortController === operationAbortController) activeOperationAbortController = undefined
      if (operationId === operationSequence) loading.value = false
    }
  }

  /** Reads one selected local JSON file and clears the input so it can be selected again. */
  async function openLocalFile(event: Event): Promise<void> {
    const input = event.target
    if (!(input instanceof HTMLInputElement)) return
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    await openFrom(async () => ({ name: file.name, content: await file.text(), sourceKind: 'local-file' }))
  }

  function setDiscardDraftsConfirmed(confirmed: boolean): void {
    const captured = mutableReview.value
    if (!captured || captured.presentation.confirming || !captured.presentation.hasDrafts) return
    captured.presentation.discardDraftsConfirmed = confirmed
  }

  function cancel(): void {
    if (mutableReview.value?.presentation.confirming) return
    operationSequence += 1
    activeOperationAbortController?.abort()
    activeOperationAbortController = undefined
    loading.value = false
    mutableReview.value = null
    loadError.value = ''
  }

  /** Downloads the applied workspace snapshot shown by this review, without applying or clearing any drafts. */
  function downloadReviewedCurrent(): void {
    const captured = mutableReview.value
    if (!captured || !captured.active) return
    try {
        options.downloadCurrent(captured.active)
      captured.presentation.error = ''
    } catch (error) {
      captured.presentation.error = errorText(error)
    }
  }

  async function confirm(): Promise<void> {
    const captured = mutableReview.value
    if (!captured || captured.presentation.confirming) return
    if (reviewIsStale(captured)) {
      captureReview(captured.presentation.sourceName, captured.sourceKind, captured.incoming, captured.id, true)
      return
    }
    if (captured.presentation.hasDrafts && !captured.presentation.discardDraftsConfirmed) {
      captured.presentation.error = 'Confirm that the current drafts may be discarded after the replacement is saved.'
      return
    }

    captured.presentation.confirming = true
    captured.presentation.error = ''
    try {
      await options.replaceFromBackup(captured.incoming, captured.durableVersion)
      if (operationSequence !== captured.id || mutableReview.value?.id !== captured.id) return
      options.afterReplacement(captured.sourceKind)
      mutableReview.value = null
      loadError.value = ''
      operationSequence += 1
    } catch (error) {
      if (mutableReview.value?.id === captured.id) {
        captured.presentation.confirming = false
        captured.presentation.error = errorText(error)
      }
    }
  }

  onBeforeUnmount(() => {
    operationSequence += 1
    loading.value = false
    mutableReview.value = null
  })

  return {
    review: readonly(review),
    loading: readonly(loading),
    error: readonly(loadError),
    openFrom,
    openLocalFile,
    setDiscardDraftsConfirmed,
    downloadReviewedCurrent,
    confirm,
    cancel,
  }
}
