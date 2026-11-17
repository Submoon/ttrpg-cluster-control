import { computed, onScopeDispose, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import type { LocalWorkspace } from '../domain/workspace'
import { DropboxApiError, createDropboxBackup, reconcileDropboxBackup } from '../utils/dropbox-api'
import type { DropboxBackupReceipt, DropboxBackupReconciliation } from '../utils/dropbox-api'
import { DropboxCancelledError } from '../utils/dropbox-auth'
import type { DropboxGrant } from '../utils/dropbox-auth'
import { createDropboxBackupSnapshot } from '../utils/dropbox-backup-snapshot'
import type { DropboxBackupSnapshot } from '../utils/dropbox-backup-snapshot'
import type { DropboxSignInController } from './useDropboxSignIn'

export type DropboxBackupState = 'idle' | 'prepared' | 'authorizing' | 'uploading' | 'retry' | 'conflict'

export interface DropboxBackupRequest {
  accessToken: string
  path: string
  contents: string
  signal?: AbortSignal
}

export interface DropboxBackupDependencies {
  createBackup(request: DropboxBackupRequest): Promise<DropboxBackupReceipt>
  reconcileBackup(request: DropboxBackupRequest): Promise<DropboxBackupReconciliation>
}

export interface DropboxBackupController {
  readonly state: Readonly<Ref<DropboxBackupState>>
  readonly message: Readonly<Ref<string>>
  readonly lastSaved: Readonly<Ref<DropboxBackupReceipt | undefined>>
  readonly busy: ComputedRef<boolean>
  readonly canCancel: ComputedRef<boolean>
  readonly buttonLabel: ComputedRef<string>
  /** Captures applied data synchronously before the user confirms the transfer. */
  prepare(): boolean
  /** Clears only an unsubmitted snapshot; unresolved writes remain available for same-path retry. */
  discardPrepared(): void
  activate(): void
  cancelBeforeUpload(): void
  /** Captures a new path without transferring until the user explicitly activates it. */
  startNewBackup(): void
}

export interface DropboxBackupOptions {
  onCanceled?: () => void
}

interface BackupAttempt {
  snapshot: DropboxBackupSnapshot
  accountId: string
  hadAmbiguousDispatch: boolean
}

const defaultDependencies: DropboxBackupDependencies = {
  createBackup: request => createDropboxBackup(request),
  reconcileBackup: request => reconcileDropboxBackup(request),
}

/** Owns one captured, dated Dropbox backup and its account-bound uncertain-write retry. */
export function useDropboxBackup(
  workspace: () => LocalWorkspace | null | undefined,
  signIn: DropboxSignInController,
  dependencies: DropboxBackupDependencies = defaultDependencies,
  options: DropboxBackupOptions = {},
): DropboxBackupController {
  const state = ref<DropboxBackupState>('idle')
  const operationMessage = ref('')
  const lastSaved = ref<DropboxBackupReceipt>()
  const unresolvedPaths = ref<string[]>([])
  const uncertaintyNotice = computed(() => unresolvedPaths.value.length > 0
    ? unresolvedPaths.value.length === 1
      ? `An earlier Dropbox backup may still be saved at ${unresolvedPaths.value[0]}, but Dropbox could not verify it.`
      : `${unresolvedPaths.value.length} earlier Dropbox backups may still be saved, but Dropbox could not verify them.`
    : '')
  const message = computed(() => [uncertaintyNotice.value, operationMessage.value].filter(Boolean).join(' '))
  const busy = computed(() => state.value === 'authorizing' || state.value === 'uploading')
  const canCancel = computed(() => state.value === 'authorizing')
  const buttonLabel = computed(() => {
    if (state.value === 'retry') return 'Retry the same Dropbox backup'
    if (state.value === 'conflict') return 'Prepare a new Dropbox backup'
    if (state.value === 'authorizing') return 'Authorizing Dropbox…'
    if (state.value === 'uploading') return 'Saving to Dropbox…'
    return 'Back up to Dropbox'
  })
  let snapshot: DropboxBackupSnapshot | undefined
  let retryAttempt: BackupAttempt | undefined
  let disposed = false
  let operationSequence = 0
  let activeOperation = 0
  let activeAbortController: AbortController | undefined

  function prepare(): boolean {
    if (state.value === 'retry') return true
    if (state.value === 'prepared') return true
    if (state.value === 'conflict') {
      return stageNewSnapshot('The previous path was already occupied. A new dated path is ready.')
    }
    if (busy.value || !signIn.ready.value) {
      if (!signIn.ready.value) operationMessage.value = signIn.message.value || 'Dropbox is not ready. Configure the App Folder app and try again.'
      return false
    }
    return stageNewSnapshot('')
  }

  function discardPrepared(): void {
    if (state.value === 'authorizing') {
      cancelBeforeUpload()
      if (retryAttempt) return
    }
    if (state.value !== 'prepared') return
    snapshot = undefined
    retryAttempt = undefined
    state.value = 'idle'
    operationMessage.value = ''
  }

  function activate(): void {
    if (state.value === 'conflict') {
      stageNewSnapshot('The previous path was already occupied. A new dated path is ready.')
      return
    }
    if (state.value !== 'prepared' && state.value !== 'retry') return
    const operation = beginOperation()
    void authorizeAndSave(operation)
  }

  function cancelBeforeUpload(): void {
    if (!canCancel.value) return
    activeAbortController?.abort()
    activeOperation = ++operationSequence
    activeAbortController = undefined
    if (retryAttempt) {
      state.value = 'retry'
      operationMessage.value = 'Dropbox authorization was canceled. The earlier upload outcome is still unconfirmed; retry the same backup or start a new one.'
    } else {
      state.value = 'prepared'
      operationMessage.value = 'Dropbox authorization was canceled. Your captured backup is ready if you want to try again.'
    }
    options.onCanceled?.()
  }

  function startNewBackup(): void {
    if (busy.value) return
    if (retryAttempt) unresolvedPaths.value = [...unresolvedPaths.value, retryAttempt.snapshot.path]
    retryAttempt = undefined
    snapshot = undefined
    state.value = 'idle'
    stageNewSnapshot('')
  }

  function stageNewSnapshot(notice: string): boolean {
    const appliedWorkspace = workspace()
    if (!appliedWorkspace) {
      operationMessage.value = 'Open a Jump Cluster before starting a Dropbox backup.'
      return false
    }
    try {
      // Synchronous serialization freezes the applied export before authorization can yield.
      snapshot = createDropboxBackupSnapshot(appliedWorkspace)
      retryAttempt = undefined
      lastSaved.value = undefined
      operationMessage.value = notice
      state.value = 'prepared'
      return true
    } catch (error) {
      operationMessage.value = getErrorMessage(error, 'The applied Jump Cluster could not be captured for backup.')
      state.value = 'idle'
      return false
    }
  }

  async function authorizeAndSave(operation: number): Promise<void> {
    if (!snapshot || !isCurrent(operation)) return
    state.value = 'authorizing'
    const signal = activeAbortController?.signal
    let grant: DropboxGrant | undefined
    try {
      // This is called in the explicit consent click stack so the popup is not blocked.
      grant = await signIn.requestGrant(signal)
      if (!isCurrent(operation)) return
      if (retryAttempt) {
        if (grant.accountId !== retryAttempt.accountId) {
          signIn.invalidateAccessToken(grant.accessToken)
          state.value = 'retry'
          operationMessage.value = 'This backup belongs to a different Dropbox account. Choose the same account to retry its file safely.'
          return
        }
        await retrySameBackup(grant, retryAttempt, operation)
        return
      }

      const attempt: BackupAttempt = { snapshot, accountId: grant.accountId, hadAmbiguousDispatch: false }
      retryAttempt = attempt
      await createBackup(grant, attempt, operation, false)
    } catch (error) {
      if (!isCurrent(operation)) return
      invalidateAfterUnauthorized(error, grant?.accessToken)
      if (error instanceof DropboxCancelledError) {
        state.value = retryAttempt ? 'retry' : 'prepared'
        operationMessage.value = retryAttempt
          ? 'Dropbox authorization was canceled. The earlier upload outcome is still unconfirmed; retry the same backup or start a new one.'
          : 'Dropbox authorization was canceled. Your captured backup is ready if you want to try again.'
        options.onCanceled?.()
        return
      }
      if (retryAttempt) {
        state.value = 'retry'
        operationMessage.value = `${getErrorMessage(error, 'Dropbox could not check the backup.')} The earlier upload outcome is still unconfirmed; retry the same backup or start a new one.`
      } else {
        state.value = 'prepared'
        operationMessage.value = getErrorMessage(error, 'Dropbox authorization failed. Your local map is unchanged.')
      }
    }
  }

  async function createBackup(
    grant: DropboxGrant,
    attempt: BackupAttempt,
    operation: number,
    fromRetry: boolean,
  ): Promise<void> {
    if (!isCurrent(operation)) return
    state.value = 'uploading'
    try {
      const receipt = await dependencies.createBackup({
        accessToken: grant.accessToken,
        path: attempt.snapshot.path,
        contents: attempt.snapshot.contents,
        signal: activeAbortController?.signal,
      })
      if (!isCurrent(operation)) return
      if (!isValidReceipt(receipt, attempt.snapshot)) {
        if (fromRetry) {
          await reconcileAfterAmbiguousCreate(grant, attempt, operation, 'Dropbox returned a receipt for a different path.')
        } else {
          attempt.hadAmbiguousDispatch = true
          await reconcileAfterAmbiguousCreate(grant, attempt, operation, 'Dropbox returned an incomplete receipt.')
        }
        return
      }
      finishSaved(receipt, attempt)
    } catch (error) {
      if (!isCurrent(operation)) return
      invalidateAfterUnauthorized(error, grant.accessToken)
      if (error instanceof DropboxApiError && error.code === 'path-conflict' && !attempt.hadAmbiguousDispatch) {
        retryAttempt = undefined
        state.value = 'conflict'
        operationMessage.value = error.message
        return
      }
      if (error instanceof DropboxApiError && error.outcomeUncertain) {
        attempt.hadAmbiguousDispatch = true
        await reconcileAfterAmbiguousCreate(grant, attempt, operation, error.message)
        return
      }
      if (fromRetry) {
        state.value = 'retry'
        operationMessage.value = `${getErrorMessage(error, 'Dropbox could not retry the backup.')} The earlier upload outcome remains unconfirmed.`
      } else {
        retryAttempt = undefined
        state.value = 'prepared'
        operationMessage.value = getErrorMessage(error, 'Dropbox rejected the backup. Your local map and earlier backups are unchanged.')
      }
    }
  }

  async function retrySameBackup(grant: DropboxGrant, attempt: BackupAttempt, operation: number): Promise<void> {
    state.value = 'uploading'
    let reconciliation: DropboxBackupReconciliation
    try {
      reconciliation = await dependencies.reconcileBackup({
        accessToken: grant.accessToken,
        path: attempt.snapshot.path,
        contents: attempt.snapshot.contents,
        signal: activeAbortController?.signal,
      })
    } catch {
      reconciliation = { kind: 'unresolved' }
    }
    if (!isCurrent(operation)) return
    if (reconciliation.kind === 'confirmed' && isValidReceipt(reconciliation.receipt, attempt.snapshot)) {
      finishSaved(reconciliation.receipt, attempt)
      return
    }
    if (reconciliation.kind !== 'not-found') {
      if (reconciliation.kind === 'unauthorized') signIn.invalidateAccessToken(grant.accessToken)
      state.value = 'retry'
      operationMessage.value = reconciliation.kind === 'mismatch'
        ? 'Dropbox found a different file at the intended path. The earlier backup outcome remains unresolved; it was not overwritten.'
        : 'Dropbox could not verify whether the earlier upload finished. Retry the same backup or start a new one.'
      return
    }

    await createBackup(grant, attempt, operation, true)
  }

  async function reconcileAfterAmbiguousCreate(
    grant: DropboxGrant,
    attempt: BackupAttempt,
    operation: number,
    providerMessage: string,
  ): Promise<void> {
    let reconciliation: DropboxBackupReconciliation
    try {
      reconciliation = await dependencies.reconcileBackup({
        accessToken: grant.accessToken,
        path: attempt.snapshot.path,
        contents: attempt.snapshot.contents,
        signal: activeAbortController?.signal,
      })
    } catch {
      reconciliation = { kind: 'unresolved' }
    }
    if (!isCurrent(operation)) return
    if (reconciliation.kind === 'confirmed' && isValidReceipt(reconciliation.receipt, attempt.snapshot)) {
      finishSaved(reconciliation.receipt, attempt)
      return
    }
    if (reconciliation.kind === 'unauthorized') signIn.invalidateAccessToken(grant.accessToken)
    state.value = 'retry'
    operationMessage.value = reconciliation.kind === 'mismatch'
      ? `${providerMessage} Dropbox found different bytes at the intended path. The result is unresolved and the file was not overwritten.`
      : `${providerMessage} Retry the same backup to check ${attempt.snapshot.path}; Dropbox will only create it after a typed not-found result.`
  }

  function finishSaved(receipt: DropboxBackupReceipt, attempt: BackupAttempt): void {
    lastSaved.value = receipt
    if (retryAttempt?.snapshot.path === attempt.snapshot.path) retryAttempt = undefined
    snapshot = undefined
    state.value = 'idle'
    operationMessage.value = ''
  }

  function beginOperation(): number {
    activeAbortController?.abort()
    activeAbortController = new AbortController()
    activeOperation = ++operationSequence
    return activeOperation
  }

  function invalidateAfterUnauthorized(error: unknown, accessToken: string | undefined): void {
    if (accessToken && error instanceof DropboxApiError && error.httpStatus === 401) signIn.invalidateAccessToken(accessToken)
  }

  function isCurrent(operation: number): boolean {
    return !disposed && operation === activeOperation
  }

  function isValidReceipt(receipt: DropboxBackupReceipt, backup: DropboxBackupSnapshot): boolean {
    return Boolean(receipt && receipt.id && receipt.name === backup.filename && receipt.path === backup.path)
  }

  onScopeDispose(() => {
    disposed = true
    activeAbortController?.abort()
    activeOperation = ++operationSequence
    snapshot = undefined
    retryAttempt = undefined
  })

  return {
    state,
    message,
    lastSaved,
    busy,
    canCancel,
    buttonLabel,
    prepare,
    discardPrepared,
    activate,
    cancelBeforeUpload,
    startNewBackup,
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}
