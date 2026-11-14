import { computed, onScopeDispose, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import type { LocalWorkspace } from '../domain/workspace'
import { GoogleDriveApiError, generateGoogleDriveFileId, getGoogleDrivePermissionId, uploadGoogleDriveBackup } from '../utils/google-drive-api'
import type { GoogleDriveBackupFile } from '../utils/google-drive-api'
import { GoogleDriveCancelledError } from '../utils/google-drive-auth'
import type { GoogleDriveSignInController } from './useGoogleDriveSignIn'
import { createGoogleDriveBackupSnapshot } from '../utils/google-drive-backup-snapshot'
import type { GoogleDriveBackupSnapshot } from '../utils/google-drive-backup-snapshot'
import { pruneGoogleDriveBackups } from '../utils/google-drive-backup-retention'
import type { GoogleDriveBackupRetentionResult } from '../utils/google-drive-backup-retention'

export type GoogleDriveBackupState = 'idle' | 'authorizing' | 'uploading' | 'retry' | 'cleanup-retry'

export interface GoogleDriveBackupController {
  readonly state: Readonly<Ref<GoogleDriveBackupState>>
  readonly message: Readonly<Ref<string>>
  readonly lastSaved: Readonly<Ref<GoogleDriveBackupFile | undefined>>
  readonly busy: ComputedRef<boolean>
  readonly canCancel: ComputedRef<boolean>
  readonly buttonLabel: ComputedRef<string>
  activate(): void
  cancelBeforeUpload(): void
  startNewBackupInstead(): void
  retryCleanup(): void
}

export interface GoogleDriveBackupOptions {
  onCanceled?: () => void
}

interface BackupAttempt {
  snapshot: GoogleDriveBackupSnapshot
  fileId: string
  permissionId: string
}

interface CleanupAttempt {
  receipt: GoogleDriveBackupFile
  permissionId: string
}

/**
 * Owns one page-lifetime Drive backup flow so closing a Map files popover cannot discard its
 * captured bytes, retry identity, or result. The workspace getter is read only at initial click.
 */
export function useGoogleDriveBackup(
  workspace: () => LocalWorkspace | null | undefined,
  signIn: GoogleDriveSignInController,
  options: GoogleDriveBackupOptions = {},
): GoogleDriveBackupController {
  const state = ref<GoogleDriveBackupState>('idle')
  const operationMessage = ref('')
  const unresolvedAttemptCount = ref(0)
  const uncertaintyNotice = computed(() => unresolvedAttemptCount.value > 0
    ? 'At least one earlier backup may already be saved in Google Drive; its status was not confirmed.'
    : '')
  const message = computed(() => [uncertaintyNotice.value, operationMessage.value].filter(Boolean).join(' '))
  const lastSaved = ref<GoogleDriveBackupFile>()
  const snapshot = ref<GoogleDriveBackupSnapshot>()
  const retryAttempt = ref<BackupAttempt>()
  const cleanupAttempt = ref<CleanupAttempt>()
  const pendingCleanups = ref<CleanupAttempt[]>([])
  const cleaning = ref(false)
  const isDisposed = ref(false)
  let operationSequence = 0
  let activeOperation = 0
  let activeAbortController: AbortController | undefined
  const unresolvedAttemptIds = new Set<string>()

  const busy = computed(() => ['authorizing', 'uploading'].includes(state.value))
  const canCancel = computed(() => state.value === 'authorizing' && !cleanupAttempt.value)
  const buttonLabel = computed(() => {
    if (state.value === 'retry') return 'Retry the same backup'
    if (state.value === 'cleanup-retry') return 'Retry cleanup'
    if (cleaning.value) return 'Removing older backups…'
    return 'Back up to Google Drive'
  })

  function activate(): void {
    if (state.value === 'retry') {
      void retryUncertainBackup(activeOperation)
      return
    }
    if (state.value === 'cleanup-retry') {
      retryCleanup()
      return
    }
    if (state.value === 'idle') startBackup()
  }

  function retryCleanup(): void {
    if (state.value !== 'cleanup-retry' || !signIn.ready.value) return
    const pending = pendingCleanups.value[0]
    if (!pending) return
    cleanupAttempt.value = pending
    const operation = beginOperation()
    void authorizeAndRetryCleanup(operation)
  }

  function startNewBackupInstead(): void {
    if (state.value === 'retry') startBackup('uncertain')
    else if (state.value === 'cleanup-retry') startBackup('cleanup')
  }

  function startBackup(reason?: 'uncertain' | 'cleanup'): void {
    if (!signIn.ready.value) {
      operationMessage.value = signIn.message.value || 'Google Drive is still loading. Try again when it is ready.'
      return
    }

    const appliedWorkspace = workspace()
    if (!appliedWorkspace) {
      operationMessage.value = 'Open a Jump Cluster before starting a Google Drive backup.'
      return
    }

    let nextSnapshot: GoogleDriveBackupSnapshot
    try {
      // Capture applied data synchronously before scripts, authorization, or upload can yield.
      nextSnapshot = createGoogleDriveBackupSnapshot(appliedWorkspace)
    } catch (error) {
      operationMessage.value = getErrorMessage(error, 'The applied Jump Cluster could not be captured for backup.')
      return
    }

    const operation = beginOperation()
    snapshot.value = nextSnapshot
    retryAttempt.value = undefined
    cleanupAttempt.value = undefined
    operationMessage.value = reason === 'uncertain'
      ? 'Starting a separate dated backup. The earlier backup may still be in Drive.'
      : reason === 'cleanup'
        ? 'Starting another dated backup. Cleanup for the previously saved backup remains pending for its original Google account.'
        : ''

    void authorizeAndUpload(operation)
  }

  async function authorizeAndUpload(operation: number): Promise<void> {
    const currentSnapshot = snapshot.value
    const signal = activeAbortController?.signal
    if (!currentSnapshot || !isCurrent(operation)) return

    state.value = 'authorizing'
    let accessToken: string | undefined
    try {
      // This call runs synchronously with the button event so Google can open its token popup.
      accessToken = await signIn.requestAccessToken(signal)
      if (!isCurrent(operation)) return

      const [fileId, permissionId] = await Promise.all([
        generateGoogleDriveFileId(accessToken, fetch, signal),
        getGoogleDrivePermissionId(accessToken, fetch, signal),
      ])
      if (!isCurrent(operation)) return

      const attempt = { snapshot: currentSnapshot, fileId, permissionId }
      retryAttempt.value = attempt
      await saveBackup(accessToken, attempt, operation)
    } catch (error) {
      if (!isCurrent(operation)) return
      invalidateAfterUnauthorized(error, accessToken)
      if (error instanceof GoogleDriveCancelledError) {
        finishCanceledAttempt(operation)
        return
      }
      finishFailedAttempt(operation, error)
    }
  }

  async function retryUncertainBackup(operation: number): Promise<void> {
    const attempt = retryAttempt.value
    const signal = activeAbortController?.signal
    if (!attempt || !isCurrent(operation)) return

    state.value = 'authorizing'
    let accessToken: string | undefined
    try {
      // Retry preserves the original bytes and ID so one logical backup cannot create duplicates.
      accessToken = await signIn.requestAccessToken(signal)
      if (!isCurrent(operation)) return
      const permissionId = await getGoogleDrivePermissionId(accessToken, fetch, signal)
      if (!isCurrent(operation)) return
      if (permissionId !== attempt.permissionId) {
        signIn.invalidateAccessToken(accessToken)
        throw new Error('The signed-in Google account differs from the account that started this backup. Choose the original account to retry this file safely.')
      }
      await saveBackup(accessToken, attempt, operation, true)
    } catch (error) {
      if (!isCurrent(operation)) return
      invalidateAfterUnauthorized(error, accessToken)
      if (error instanceof GoogleDriveCancelledError) {
        state.value = 'retry'
        operationMessage.value = 'The earlier upload outcome is still unconfirmed. You can retry the same backup or start a new one.'
        options.onCanceled?.()
        return
      }
      // The original create may exist even if this retry cannot check it.
      state.value = 'retry'
      operationMessage.value = `${getErrorMessage(error, 'Google Drive could not check the backup.')} The earlier upload outcome is still unconfirmed; retry the same file or start a new dated backup.`
    }
  }

  async function authorizeAndRetryCleanup(operation: number): Promise<void> {
    const attempt = cleanupAttempt.value
    const signal = activeAbortController?.signal
    if (!attempt || !isCurrent(operation)) return

    state.value = 'authorizing'
    let accessToken: string | undefined
    try {
      accessToken = await signIn.requestAccessToken(signal)
      if (!isCurrent(operation)) return
      const permissionId = await getGoogleDrivePermissionId(accessToken, fetch, signal)
      if (!isCurrent(operation)) return
      if (permissionId !== attempt.permissionId) {
        signIn.invalidateAccessToken(accessToken)
        throw new Error('The signed-in Google account differs from the account that saved this backup. Choose the original account to retry cleanup safely.')
      }
      const result = await cleanUpBackups(accessToken, attempt, operation, false)
      if (result === 'removed') {
        operationMessage.value = 'Cleanup completed, but the saved backup was removed to keep only the ten newest backups.'
      } else if (result === 'absent') {
        operationMessage.value = 'Cleanup completed. The previously saved backup is no longer listed in Google Drive.'
      }
    } catch (error) {
      if (!isCurrent(operation)) return
      invalidateAfterUnauthorized(error, accessToken)
      if (error instanceof GoogleDriveCancelledError) {
        state.value = 'cleanup-retry'
        operationMessage.value = 'The backup was saved. Cleanup was canceled; retry it to remove older backups.'
        return
      }
      finishCleanupFailure(operation, error)
    }
  }

  async function saveBackup(
    accessToken: string,
    attempt: BackupAttempt,
    operation: number,
    preservingUncertainty = false,
  ): Promise<void> {
    if (!isCurrent(operation)) return
    state.value = 'uploading'
    retryAttempt.value = attempt
    try {
      const saved = await uploadGoogleDriveBackup({
        accessToken,
        fileId: attempt.fileId,
        filename: attempt.snapshot.filename,
        contents: attempt.snapshot.contents,
        signal: activeAbortController?.signal,
      })
      if (!isCurrent(operation)) return

      if (preservingUncertainty) resolveUncertainty(attempt)
      snapshot.value = undefined
      retryAttempt.value = undefined
      const cleanup = { receipt: saved, permissionId: attempt.permissionId }
      rememberCleanup(cleanup)
      cleanupAttempt.value = cleanup
      const retentionResult = await cleanUpBackups(accessToken, cleanup, operation, true)
      if (retentionResult === 'removed') {
        operationMessage.value = [operationMessage.value, 'The upload was confirmed, but this backup was removed to keep only the ten newest backups.'].filter(Boolean).join(' ')
      } else if (retentionResult === 'absent') {
        operationMessage.value = [operationMessage.value, 'The upload was confirmed, but the backup is no longer listed in Google Drive.'].filter(Boolean).join(' ')
      } else {
        // A failed cleanup does not change the confirmed upload; keep success visible and allow a
        // retry without sending the bytes again.
        lastSaved.value = saved
      }
    } catch (error) {
      if (!isCurrent(operation)) return
      invalidateAfterUnauthorized(error, accessToken)
      if (preservingUncertainty && retryAttempt.value) {
        rememberUncertainty(attempt)
        state.value = 'retry'
        operationMessage.value = `${getErrorMessage(error, 'Google Drive could not confirm the backup.')} The earlier outcome remains unknown; retry the same file or start a new dated backup.`
        return
      }
      finishFailedAttempt(operation, error)
    }
  }

  function cancelBeforeUpload(): void {
    if (!canCancel.value) return
    activeAbortController?.abort()
    ++operationSequence
    activeOperation = operationSequence

    if (retryAttempt.value) {
      // The canceled retry retains its file identity, but the next activation needs a fresh signal.
      activeAbortController = new AbortController()
      state.value = 'retry'
      operationMessage.value = 'The earlier upload outcome is still unconfirmed. You can retry the same backup or start a new one.'
      options.onCanceled?.()
      return
    }

    state.value = 'idle'
    snapshot.value = undefined
    cleaning.value = false
    if (pendingCleanups.value.length > 0) {
      state.value = 'cleanup-retry'
      operationMessage.value = 'The backup attempt was canceled. A previously saved backup still needs cleanup; retry it or save another backup.'
    } else {
      operationMessage.value = ''
    }
    options.onCanceled?.()
  }

  function finishCanceledAttempt(operation: number): void {
    if (!isCurrent(operation)) return
    state.value = 'idle'
    snapshot.value = undefined
    retryAttempt.value = undefined
    cleanupAttempt.value = undefined
    cleaning.value = false
    if (pendingCleanups.value.length > 0) {
      state.value = 'cleanup-retry'
      operationMessage.value = 'The backup attempt was canceled. A previously saved backup still needs cleanup; retry it or save another backup.'
    } else {
      operationMessage.value = ''
    }
    options.onCanceled?.()
  }

  function finishFailedAttempt(operation: number, error: unknown): void {
    if (!isCurrent(operation)) return
    if (error instanceof GoogleDriveApiError && error.outcomeUncertain && retryAttempt.value) {
      rememberUncertainty(retryAttempt.value)
      state.value = 'retry'
      operationMessage.value = error.message
      return
    }

    state.value = 'idle'
    snapshot.value = undefined
    retryAttempt.value = undefined
    cleanupAttempt.value = undefined
    cleaning.value = false
    const errorMessage = getErrorMessage(error, 'Google Drive backup failed. Your local map is unchanged.')
    if (pendingCleanups.value.length > 0) {
      state.value = 'cleanup-retry'
      operationMessage.value = `${errorMessage} A previously saved backup still needs cleanup; retry it or save another backup.`
    } else {
      operationMessage.value = errorMessage
    }
  }

  async function cleanUpBackups(
    accessToken: string,
    attempt: CleanupAttempt,
    operation: number,
    requireReceipt: boolean,
  ): Promise<GoogleDriveBackupRetentionResult | undefined> {
    if (!isCurrent(operation)) return undefined
    state.value = 'uploading'
    cleaning.value = true
    try {
      const result = await pruneGoogleDriveBackups({
        accessToken,
        receipt: attempt.receipt,
        signal: activeAbortController?.signal,
        requireReceipt,
      })
      if (!isCurrent(operation)) return
      pendingCleanups.value = pendingCleanups.value.filter(pending => pending.permissionId !== attempt.permissionId)
      cleanupAttempt.value = undefined
      cleaning.value = false
      if (pendingCleanups.value.length > 0) {
        operationMessage.value = 'Cleanup for this Google account completed. Another Google account still has backups awaiting cleanup.'
        state.value = 'cleanup-retry'
      } else {
        operationMessage.value = ''
        state.value = 'idle'
      }
      return result
    } catch (error) {
      if (!isCurrent(operation)) return
      invalidateAfterUnauthorized(error, accessToken)
      finishCleanupFailure(operation, error)
      return undefined
    }
  }

  function finishCleanupFailure(operation: number, error: unknown): void {
    if (!isCurrent(operation)) return
    cleaning.value = false
    state.value = 'cleanup-retry'
    operationMessage.value = `The backup was saved, but older backups could not all be removed. ${getErrorMessage(error, 'Retry cleanup to finish keeping the newest ten backups.')}`
  }

  function rememberCleanup(attempt: CleanupAttempt): void {
    pendingCleanups.value = [
      ...pendingCleanups.value.filter(pending => pending.permissionId !== attempt.permissionId),
      attempt,
    ]
  }

  function beginOperation(): number {
    activeAbortController?.abort()
    activeAbortController = new AbortController()
    activeOperation = ++operationSequence
    return activeOperation
  }

  function rememberUncertainty(attempt: BackupAttempt): void {
    if (unresolvedAttemptIds.has(attempt.fileId)) return
    unresolvedAttemptIds.add(attempt.fileId)
    unresolvedAttemptCount.value = unresolvedAttemptIds.size
  }

  function resolveUncertainty(attempt: BackupAttempt): void {
    if (!unresolvedAttemptIds.delete(attempt.fileId)) return
    unresolvedAttemptCount.value = unresolvedAttemptIds.size
  }

  function invalidateAfterUnauthorized(error: unknown, accessToken: string | undefined): void {
    if (accessToken && error instanceof GoogleDriveApiError && error.httpStatus === 401) {
      signIn.invalidateAccessToken(accessToken)
    }
  }

  function isCurrent(operation: number): boolean {
    return !isDisposed.value && operation === activeOperation
  }

  onScopeDispose(() => {
    isDisposed.value = true
    activeAbortController?.abort()
    activeOperation = ++operationSequence
  })

  return { state, message, lastSaved, busy, canCancel, buttonLabel, activate, cancelBeforeUpload, startNewBackupInstead, retryCleanup }
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}
