import { computed, onScopeDispose, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import type { LocalWorkspace } from '../domain/workspace'
import { DropboxApiError, createDropboxBackup, reconcileDropboxBackup } from '../utils/dropbox-api'
import type { DropboxBackupReceipt, DropboxBackupReconciliation } from '../utils/dropbox-api'
import { DropboxCancelledError } from '../utils/dropbox-auth'
import type { DropboxGrant } from '../utils/dropbox-auth'
import { pruneDropboxBackups } from '../utils/dropbox-backup-retention'
import type { DropboxBackupRetentionResult } from '../utils/dropbox-backup-retention'
import { createDropboxBackupSnapshot } from '../utils/dropbox-backup-snapshot'
import type { DropboxBackupSnapshot } from '../utils/dropbox-backup-snapshot'
import type { DropboxSignInController } from './useDropboxSignIn'

export type DropboxBackupState = 'idle' | 'authorizing' | 'uploading' | 'retry' | 'cleanup-retry'

export interface DropboxBackupRequest {
  accessToken: string
  path: string
  contents: string
  signal?: AbortSignal
}

export interface DropboxBackupCleanupRequest {
  accessToken: string
  receipt: DropboxBackupReceipt
  signal?: AbortSignal
  requireReceipt?: boolean
}

export interface DropboxBackupDependencies {
  createBackup(request: DropboxBackupRequest): Promise<DropboxBackupReceipt>
  reconcileBackup(request: DropboxBackupRequest): Promise<DropboxBackupReconciliation>
  pruneBackups(request: DropboxBackupCleanupRequest): Promise<DropboxBackupRetentionResult>
}

export interface DropboxBackupController {
  readonly state: Readonly<Ref<DropboxBackupState>>
  readonly message: Readonly<Ref<string>>
  readonly lastSaved: Readonly<Ref<DropboxBackupReceipt | undefined>>
  readonly busy: ComputedRef<boolean>
  readonly canCancel: ComputedRef<boolean>
  activate(): void
  cancelBeforeUpload(): void
  /** Captures current applied data synchronously and starts a new OAuth/upload attempt. */
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

interface CleanupAttempt {
  receipt: DropboxBackupReceipt
  accountId: string
}

const defaultDependencies: DropboxBackupDependencies = {
  createBackup: request => createDropboxBackup(request),
  reconcileBackup: request => reconcileDropboxBackup(request),
  pruneBackups: request => pruneDropboxBackups(request),
}

/** Owns one captured Dropbox backup, its account-bound retry, and post-save retention cleanup. */
export function useDropboxBackup(
  workspace: () => LocalWorkspace | null | undefined,
  signIn: DropboxSignInController,
  dependencies: Partial<DropboxBackupDependencies> = {},
  options: DropboxBackupOptions = {},
): DropboxBackupController {
  const actions = { ...defaultDependencies, ...dependencies }
  const state = ref<DropboxBackupState>('idle')
  const operationMessage = ref('')
  const lastSaved = ref<DropboxBackupReceipt>()
  const unresolvedPaths = ref<string[]>([])
  const pendingCleanups = ref<CleanupAttempt[]>([])
  const cleanupAttempt = ref<CleanupAttempt>()
  const cleaning = ref(false)
  const disposed = ref(false)
  const uncertaintyNotice = computed(() => unresolvedPaths.value.length > 0
    ? unresolvedPaths.value.length === 1
      ? `An earlier Dropbox backup may still be saved at ${unresolvedPaths.value[0]}, but Dropbox could not verify it.`
      : `${unresolvedPaths.value.length} earlier Dropbox backups may still be saved, but Dropbox could not verify them.`
    : '')
  const message = computed(() => [uncertaintyNotice.value, operationMessage.value].filter(Boolean).join(' '))
  const busy = computed(() => state.value === 'authorizing' || state.value === 'uploading')
  const canCancel = computed(() => state.value === 'authorizing' && !cleaning.value)
  let retryAttempt: BackupAttempt | undefined
  let operationSequence = 0
  let activeOperation = 0
  let activeAbortController: AbortController | undefined
  const unresolvedAttemptPaths = new Set<string>()

  function activate(): void {
    if (state.value === 'retry') {
      retryUncertainBackup()
      return
    }
    if (state.value === 'cleanup-retry') {
      retryPendingCleanup()
      return
    }
    if (state.value === 'idle') startBackup()
  }

  function startNewBackup(): void {
    if (busy.value) return
    const previousRetry = retryAttempt
    startBackup(
      previousRetry ? 'uncertain' : state.value === 'cleanup-retry' ? 'cleanup' : undefined,
      previousRetry,
    )
  }

  function retryPendingCleanup(): void {
    if (busy.value || !signIn.ready.value) return
    const pending = pendingCleanups.value.at(-1)
    if (!pending) return
    cleanupAttempt.value = pending
    const operation = beginOperation()
    void authorizeAndRetryCleanup(operation)
  }

  function startBackup(reason?: 'uncertain' | 'cleanup', supersededRetry?: BackupAttempt): void {
    if (!signIn.ready.value) {
      operationMessage.value = signIn.message.value || 'Dropbox is not ready. Configure the App Folder app and try again.'
      restorePendingCleanupState()
      return
    }

    const appliedWorkspace = workspace()
    if (!appliedWorkspace) {
      operationMessage.value = 'Open a Jump Cluster before starting a Dropbox backup.'
      restorePendingCleanupState()
      return
    }

    let snapshot: DropboxBackupSnapshot
    try {
      // Capture applied data synchronously in the user gesture before OAuth can open or yield.
      snapshot = createDropboxBackupSnapshot(appliedWorkspace)
    } catch (error) {
      operationMessage.value = getErrorMessage(error, 'The applied Jump Cluster could not be captured for backup.')
      restorePendingCleanupState()
      return
    }

    if (supersededRetry) {
      rememberUncertainty(supersededRetry)
      retryAttempt = undefined
    }

    const operation = beginOperation()
    lastSaved.value = undefined
    cleanupAttempt.value = undefined
    operationMessage.value = reason === 'uncertain'
      ? 'Starting a separate dated backup. The earlier backup may still be saved in Dropbox.'
      : reason === 'cleanup'
        ? 'Starting another dated backup. Cleanup for the previously saved backup remains pending for its original Dropbox account.'
        : ''
    void authorizeAndSave(snapshot, operation)
  }

  async function authorizeAndSave(snapshot: DropboxBackupSnapshot, operation: number): Promise<void> {
    if (!isCurrent(operation)) return
    state.value = 'authorizing'
    let grant: DropboxGrant | undefined
    try {
      // This call stays in the explicit click stack so Dropbox can open its authorization window.
      grant = await signIn.requestGrant(activeAbortController?.signal)
      if (!isCurrent(operation)) return
      const attempt: BackupAttempt = { snapshot, accountId: grant.accountId, hadAmbiguousDispatch: false }
      retryAttempt = attempt
      await createBackup(grant, attempt, operation, false)
    } catch (error) {
      if (!isCurrent(operation)) return
      invalidateAfterUnauthorized(error, grant?.accessToken)
      if (error instanceof DropboxCancelledError) {
        state.value = 'idle'
        operationMessage.value = 'Dropbox authorization was canceled. No backup was uploaded.'
        restorePendingCleanupState()
        options.onCanceled?.()
        return
      }
      finishFailedAttempt(operation, error)
    }
  }

  function retryUncertainBackup(): void {
    const attempt = retryAttempt
    if (!attempt || busy.value || !signIn.ready.value) return
    const operation = beginOperation()
    void authorizeAndRetryBackup(attempt, operation)
  }

  async function authorizeAndRetryBackup(attempt: BackupAttempt, operation: number): Promise<void> {
    if (!isCurrent(operation)) return
    state.value = 'authorizing'
    let grant: DropboxGrant | undefined
    try {
      grant = await signIn.requestGrant(activeAbortController?.signal)
      if (!isCurrent(operation)) return
      if (grant.accountId !== attempt.accountId) {
        signIn.invalidateAccessToken(grant.accessToken)
        state.value = 'retry'
        operationMessage.value = 'This backup belongs to a different Dropbox account. Choose the same account to retry its file safely.'
        return
      }
      await retrySameBackup(grant, attempt, operation)
    } catch (error) {
      if (!isCurrent(operation)) return
      invalidateAfterUnauthorized(error, grant?.accessToken)
      if (error instanceof DropboxCancelledError) {
        state.value = 'retry'
        operationMessage.value = 'Dropbox authorization was canceled. The earlier upload outcome is still unconfirmed; retry the same backup or start a new one.'
        options.onCanceled?.()
        return
      }
      state.value = 'retry'
      operationMessage.value = `${getErrorMessage(error, 'Dropbox could not check the backup.')} The earlier upload outcome is still unconfirmed; retry the same backup or start a new one.`
    }
  }

  async function authorizeAndRetryCleanup(operation: number): Promise<void> {
    let attempt = cleanupAttempt.value
    if (!attempt || !isCurrent(operation)) return
    state.value = 'authorizing'
    let grant: DropboxGrant | undefined
    try {
      grant = await signIn.requestGrant(activeAbortController?.signal)
      if (!isCurrent(operation)) return
      const matchingAttempt = pendingCleanups.value.find(pending => pending.accountId === grant?.accountId)
        ?? pendingCleanups.value.at(-1)
      if (!matchingAttempt) {
        cleanupAttempt.value = undefined
        state.value = 'idle'
        operationMessage.value = ''
        return
      }
      attempt = matchingAttempt
      cleanupAttempt.value = attempt
      if (grant.accountId !== attempt.accountId) {
        signIn.invalidateAccessToken(grant.accessToken)
        throw new Error('This backup belongs to a different Dropbox account. Choose the account that saved it to retry cleanup safely.')
      }
      await cleanUpBackups(grant, attempt, operation, false)
    } catch (error) {
      if (!isCurrent(operation)) return
      invalidateAfterUnauthorized(error, grant?.accessToken)
      if (error instanceof DropboxCancelledError) {
        state.value = 'cleanup-retry'
        operationMessage.value = 'The backup was saved. Cleanup was canceled; retry it to remove older backups.'
        options.onCanceled?.()
        return
      }
      const failedAttempt = attempt ?? cleanupAttempt.value
      if (failedAttempt) finishCleanupFailure(operation, failedAttempt, error)
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
      const receipt = await actions.createBackup({
        accessToken: grant.accessToken,
        path: attempt.snapshot.path,
        contents: attempt.snapshot.contents,
        signal: activeAbortController?.signal,
      })
      if (!isCurrent(operation)) return
      if (!isValidReceipt(receipt, attempt.snapshot)) {
        if (!fromRetry) attempt.hadAmbiguousDispatch = true
        await reconcileAfterAmbiguousCreate(grant, attempt, operation, 'Dropbox returned an incomplete receipt.')
        return
      }
      if (fromRetry) resolveUncertainty(attempt)
      await finishConfirmedSave(grant, attempt, receipt, operation)
    } catch (error) {
      if (!isCurrent(operation)) return
      invalidateAfterUnauthorized(error, grant.accessToken)
      if (error instanceof DropboxApiError && error.code === 'path-conflict' && !attempt.hadAmbiguousDispatch) {
        retryAttempt = undefined
        state.value = 'idle'
        operationMessage.value = error.message
        restorePendingCleanupState()
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
        state.value = 'idle'
        operationMessage.value = getErrorMessage(error, 'Dropbox rejected the backup. Your local map and earlier backups are unchanged.')
        restorePendingCleanupState()
      }
    }
  }

  async function retrySameBackup(grant: DropboxGrant, attempt: BackupAttempt, operation: number): Promise<void> {
    state.value = 'uploading'
    let reconciliation: DropboxBackupReconciliation
    try {
      reconciliation = await actions.reconcileBackup({
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
      resolveUncertainty(attempt)
      await finishConfirmedSave(grant, attempt, reconciliation.receipt, operation)
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
      reconciliation = await actions.reconcileBackup({
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
      resolveUncertainty(attempt)
      await finishConfirmedSave(grant, attempt, reconciliation.receipt, operation)
      return
    }
    if (reconciliation.kind === 'unauthorized') signIn.invalidateAccessToken(grant.accessToken)
    state.value = 'retry'
    operationMessage.value = reconciliation.kind === 'mismatch'
      ? `${providerMessage} Dropbox found different bytes at the intended path. The result is unresolved and the file was not overwritten.`
      : `${providerMessage} Retry the same backup to check ${attempt.snapshot.path}; Dropbox will only create it after a typed not-found result.`
  }

  async function finishConfirmedSave(
    grant: DropboxGrant,
    attempt: BackupAttempt,
    receipt: DropboxBackupReceipt,
    operation: number,
  ): Promise<void> {
    if (!isCurrent(operation)) return
    retryAttempt = undefined
    const cleanup = { receipt, accountId: attempt.accountId }
    rememberCleanup(cleanup)
    cleanupAttempt.value = cleanup
    await cleanUpBackups(grant, cleanup, operation, true)
  }

  async function cleanUpBackups(
    grant: DropboxGrant,
    attempt: CleanupAttempt,
    operation: number,
    requireReceipt: boolean,
  ): Promise<DropboxBackupRetentionResult | undefined> {
    if (!isCurrent(operation)) return undefined
    state.value = 'uploading'
    cleaning.value = true
    try {
      const result = await actions.pruneBackups({
        accessToken: grant.accessToken,
        receipt: attempt.receipt,
        signal: activeAbortController?.signal,
        requireReceipt,
      })
      if (!isCurrent(operation)) return undefined
      pendingCleanups.value = pendingCleanups.value.filter(pending => pending.accountId !== attempt.accountId)
      cleanupAttempt.value = undefined
      cleaning.value = false
      if (result === 'retained') lastSaved.value = attempt.receipt
      setCleanupCompletionMessage(result)
      state.value = 'idle'
      restorePendingCleanupState()
      return result
    } catch (error) {
      if (!isCurrent(operation)) return undefined
      invalidateAfterUnauthorized(error, grant.accessToken)
      finishCleanupFailure(operation, attempt, error)
      return undefined
    }
  }

  function cancelBeforeUpload(): void {
    if (!canCancel.value) return
    const wasRetry = retryAttempt !== undefined && state.value === 'authorizing'
    const wasCleanupRetry = cleanupAttempt.value !== undefined && state.value === 'authorizing'
    activeAbortController?.abort()
    activeOperation = ++operationSequence
    activeAbortController = undefined
    cleaning.value = false
    if (wasRetry) {
      state.value = 'retry'
      operationMessage.value = 'Dropbox authorization was canceled. The earlier upload outcome is still unconfirmed; retry the same backup or start a new one.'
    } else if (wasCleanupRetry) {
      state.value = 'cleanup-retry'
      operationMessage.value = 'The backup was saved. Cleanup was canceled; retry it to remove older backups.'
    } else {
      state.value = 'idle'
      operationMessage.value = 'Dropbox authorization was canceled. No backup was uploaded.'
      restorePendingCleanupState()
    }
    options.onCanceled?.()
  }

  function finishFailedAttempt(operation: number, error: unknown): void {
    if (!isCurrent(operation)) return
    retryAttempt = undefined
    cleanupAttempt.value = undefined
    cleaning.value = false
    state.value = 'idle'
    operationMessage.value = getErrorMessage(error, 'Dropbox backup failed. Your local map is unchanged.')
    restorePendingCleanupState()
  }

  function finishCleanupFailure(operation: number, attempt: CleanupAttempt, error: unknown): void {
    if (!isCurrent(operation)) return
    cleaning.value = false
    state.value = 'cleanup-retry'
    operationMessage.value = `Dropbox confirmed that ${attempt.receipt.name} was saved, but older backups could not all be removed. ${getErrorMessage(error, 'Retry cleanup to finish keeping the newest ten backups.')}`
  }

  function rememberCleanup(attempt: CleanupAttempt): void {
    pendingCleanups.value = [
      ...pendingCleanups.value.filter(pending => pending.accountId !== attempt.accountId),
      attempt,
    ]
  }

  function setCleanupCompletionMessage(result: DropboxBackupRetentionResult): void {
    if (result === 'removed') {
      operationMessage.value = 'Cleanup completed, but the saved backup was removed to keep only the ten newest backups.'
    } else if (result === 'absent') {
      operationMessage.value = 'Cleanup completed. The previously saved backup is no longer listed in Dropbox.'
    } else {
      operationMessage.value = ''
    }
  }

  function restorePendingCleanupState(): void {
    if (state.value === 'authorizing' || state.value === 'uploading' || state.value === 'retry') return
    if (pendingCleanups.value.length > 0) {
      state.value = 'cleanup-retry'
      if (!operationMessage.value) operationMessage.value = 'A saved Dropbox backup still needs cleanup; retry it or save another backup.'
    } else if (state.value === 'cleanup-retry') {
      state.value = 'idle'
    }
  }

  function beginOperation(): number {
    activeAbortController?.abort()
    activeAbortController = new AbortController()
    activeOperation = ++operationSequence
    return activeOperation
  }

  function rememberUncertainty(attempt: BackupAttempt): void {
    if (unresolvedAttemptPaths.has(attempt.snapshot.path)) return
    unresolvedAttemptPaths.add(attempt.snapshot.path)
    unresolvedPaths.value = [...unresolvedAttemptPaths]
  }

  function resolveUncertainty(attempt: BackupAttempt): void {
    if (!unresolvedAttemptPaths.delete(attempt.snapshot.path)) return
    unresolvedPaths.value = [...unresolvedAttemptPaths]
  }

  function invalidateAfterUnauthorized(error: unknown, accessToken: string | undefined): void {
    if (accessToken && error instanceof DropboxApiError && error.httpStatus === 401) {
      signIn.invalidateAccessToken(accessToken)
    }
  }

  function isCurrent(operation: number): boolean {
    return !disposed.value && operation === activeOperation
  }

  function isValidReceipt(receipt: DropboxBackupReceipt, backup: DropboxBackupSnapshot): boolean {
    return Boolean(receipt && receipt.id && receipt.name === backup.filename && receipt.path === backup.path)
  }

  onScopeDispose(() => {
    disposed.value = true
    activeAbortController?.abort()
    activeOperation = ++operationSequence
  })

  return { state, message, lastSaved, busy, canCancel, activate, cancelBeforeUpload, startNewBackup }
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}
