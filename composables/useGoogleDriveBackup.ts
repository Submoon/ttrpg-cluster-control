import { computed, onScopeDispose, ref } from 'vue'
import { readGoogleDriveConfig } from '../utils/google-drive-config'
import type { ComputedRef, Ref } from 'vue'
import type { LocalWorkspace } from '../domain/workspace'
import {
  GoogleDriveApiError,
  generateGoogleDriveFileId,
  googleDriveFolderUrl,
  uploadGoogleDriveBackup,
  verifyPrivateGoogleDriveFolder,
} from '../utils/google-drive-api'
import {
  GoogleDriveCancelledError,
  googleDriveServicesAreLoaded,
  loadGoogleDriveServices,
  pickGoogleDriveFolder,
  requestGoogleDriveAccessToken,
} from '../utils/google-drive-picker'
import { createGoogleDriveBackupSnapshot } from '../utils/google-drive-backup-snapshot'
import type { GoogleDriveBackupSnapshot } from '../utils/google-drive-backup-snapshot'

export type GoogleDriveBackupState = 'idle' | 'preparing' | 'continue' | 'authorizing' | 'selecting' | 'uploading' | 'retry'

interface GoogleDriveRuntimeConfig {
  public: {
    googleDriveClientId: string
    googleDriveProjectNumber: string
    googleDriveApiKey: string
  }
}

export interface GoogleDriveBackupController {
  readonly state: Readonly<Ref<GoogleDriveBackupState>>
  readonly message: Readonly<Ref<string>>
  readonly destination: Readonly<Ref<{ name: string, url: string } | undefined>>
  readonly busy: ComputedRef<boolean>
  readonly canCancel: ComputedRef<boolean>
  readonly buttonLabel: ComputedRef<string>
  activate(): void
  cancelBeforeUpload(): void
  startNewBackupInstead(): void
}

interface BackupAttempt {
  snapshot: GoogleDriveBackupSnapshot
  fileId: string
  folderId: string
  folderName: string
}

/**
 * Owns one page-lifetime Drive backup flow so closing a Map files popover cannot discard its
 * captured bytes, retry identity, or result. The workspace getter is read only at initial click.
 */
export function useGoogleDriveBackup(
  workspace: () => LocalWorkspace | null | undefined,
  runtimeConfig: GoogleDriveRuntimeConfig = useRuntimeConfig(),
): GoogleDriveBackupController {
  const state = ref<GoogleDriveBackupState>('idle')
  const operationMessage = ref('')
  const unresolvedAttemptCount = ref(0)
  const uncertaintyNotice = computed(() => unresolvedAttemptCount.value > 0
    ? 'At least one earlier backup may already be saved in Google Drive; its status was not confirmed.'
    : '')
  const message = computed(() => [uncertaintyNotice.value, operationMessage.value].filter(Boolean).join(' '))
  const destination = ref<{ name: string, url: string }>()
  const snapshot = ref<GoogleDriveBackupSnapshot>()
  const retryAttempt = ref<BackupAttempt>()
  const isDisposed = ref(false)
  let operationSequence = 0
  let activeOperation = 0
  let activeAbortController: AbortController | undefined
  const unresolvedAttemptIds = new Set<string>()

  const busy = computed(() => ['preparing', 'authorizing', 'selecting', 'uploading'].includes(state.value))
  const canCancel = computed(() => ['preparing', 'continue', 'authorizing', 'selecting'].includes(state.value))
  const buttonLabel = computed(() => {
    if (state.value === 'continue') return 'Continue to Google Drive'
    if (state.value === 'retry') return 'Retry the same backup'
    return 'Back up to Google Drive'
  })

  function activate(): void {
    if (state.value === 'continue') {
      void authorizeAndSelectFolder(activeOperation)
      return
    }
    if (state.value === 'retry') {
      void retryUncertainBackup(activeOperation)
      return
    }
    if (state.value === 'idle') startBackup()
  }

  function startNewBackupInstead(): void {
    if (state.value === 'retry') startBackup(true)
  }

  function startBackup(abandonUncertainAttempt = false): void {
    const config = readConfig()
    if (!config) {
      operationMessage.value = 'Google Drive backup is not configured for this site.'
      return
    }

    const appliedWorkspace = workspace()
    if (!appliedWorkspace) {
      operationMessage.value = 'Open a Jump Cluster before starting a Google Drive backup.'
      return
    }

    let nextSnapshot: GoogleDriveBackupSnapshot
    try {
      // Capture the applied data synchronously before scripts, authorization, or Picker can yield.
      nextSnapshot = createGoogleDriveBackupSnapshot(appliedWorkspace)
    } catch (error) {
      operationMessage.value = getErrorMessage(error, 'The applied Jump Cluster could not be captured for backup.')
      return
    }

    const operation = beginOperation()
    snapshot.value = nextSnapshot
    retryAttempt.value = undefined
    operationMessage.value = abandonUncertainAttempt
      ? 'Starting a separate dated backup. The earlier backup may still be in Drive.'
      : ''

    if (googleDriveServicesAreLoaded()) {
      void authorizeAndSelectFolder(operation)
      return
    }

    state.value = 'preparing'
    void loadGoogleDriveServices().then(() => {
      if (!isCurrent(operation)) return
      state.value = 'continue'
      operationMessage.value = 'Google Drive is ready. Continue to sign in and choose a private folder.'
    }).catch(error => {
      if (!isCurrent(operation)) return
      snapshot.value = undefined
      state.value = 'idle'
      operationMessage.value = getErrorMessage(error, 'Google Drive could not be loaded. Your local map is unchanged.')
    })
  }

  async function authorizeAndSelectFolder(operation: number): Promise<void> {
    const currentSnapshot = snapshot.value
    const config = readConfig()
    if (!currentSnapshot || !config || !isCurrent(operation)) return

    state.value = 'authorizing'
    try {
      // This must run synchronously with the button event so Google can open its token popup.
      const tokenRequest = requestGoogleDriveAccessToken(config.clientId)
      const accessToken = await tokenRequest
      if (!isCurrent(operation)) return

      state.value = 'selecting'
      const selected = await pickGoogleDriveFolder({
        accessToken,
        config: { apiKey: config.apiKey, projectNumber: config.projectNumber },
        signal: activeAbortController?.signal,
      })
      if (!isCurrent(operation)) return
      if (!selected) {
        finishCanceledAttempt(operation, 'Google Drive folder selection was canceled. No backup was created.')
        return
      }

      const fileId = await generateGoogleDriveFileId(accessToken)
      if (!isCurrent(operation)) return
      const folder = await verifyPrivateGoogleDriveFolder(accessToken, selected.id)
      if (!isCurrent(operation)) return

      const attempt: BackupAttempt = {
        snapshot: currentSnapshot,
        fileId,
        folderId: folder.id,
        folderName: folder.name,
      }
      await saveBackup(accessToken, attempt, operation)
    } catch (error) {
      if (!isCurrent(operation)) return
      if (error instanceof GoogleDriveCancelledError) {
        finishCanceledAttempt(operation, 'Google Drive authorization was canceled. No backup was created.')
        return
      }
      finishFailedAttempt(operation, error)
    }
  }

  async function retryUncertainBackup(operation: number): Promise<void> {
    const attempt = retryAttempt.value
    const config = readConfig()
    if (!attempt || !config || !isCurrent(operation)) return

    state.value = 'authorizing'
    try {
      // Retry preserves the original bytes and ID so a previous create cannot be duplicated.
      const tokenRequest = requestGoogleDriveAccessToken(config.clientId)
      const accessToken = await tokenRequest
      if (!isCurrent(operation)) return

      const folder = await verifyPrivateGoogleDriveFolder(accessToken, attempt.folderId)
      if (!isCurrent(operation)) return
      await saveBackup(accessToken, { ...attempt, folderName: folder.name }, operation, true)
    } catch (error) {
      if (!isCurrent(operation)) return
      if (error instanceof GoogleDriveCancelledError) {
        state.value = 'retry'
        operationMessage.value = 'Google Drive authorization was canceled. You can retry the same backup or start a new one.'
        return
      }
      // The previous upload might already exist even if this retry cannot check or write it.
      state.value = 'retry'
      operationMessage.value = `${getErrorMessage(error, 'Google Drive could not check the backup.')} The earlier upload outcome is still unconfirmed; retry the same file or start a new dated backup.`
    }
  }

  async function saveBackup(
    accessToken: string,
    attempt: BackupAttempt,
    operation: number,
    preserveUncertaintyOnFailure = false,
  ): Promise<void> {
    if (!isCurrent(operation)) return
    state.value = 'uploading'
    retryAttempt.value = attempt
    try {
      const saved = await uploadGoogleDriveBackup({
        accessToken,
        folderId: attempt.folderId,
        folderName: attempt.folderName,
        fileId: attempt.fileId,
        filename: attempt.snapshot.filename,
        contents: attempt.snapshot.contents,
        verifyBeforeMediaUpload: async () => {
          if (!isCurrent(operation)) {
            throw new GoogleDriveApiError('request-failed', 'Backup canceled before the file data was sent.')
          }
          await verifyPrivateGoogleDriveFolder(accessToken, attempt.folderId)
          if (!isCurrent(operation)) {
            throw new GoogleDriveApiError('request-failed', 'Backup canceled before the file data was sent.')
          }
        },
      })
      if (!isCurrent(operation)) return

      state.value = 'idle'
      snapshot.value = undefined
      retryAttempt.value = undefined
      if (preserveUncertaintyOnFailure) resolveUncertainty(attempt)
      destination.value = { name: saved.folderName, url: saved.folderUrl || googleDriveFolderUrl(attempt.folderId) }
      operationMessage.value = `Saved ${saved.name} to ${saved.folderName}.`
    } catch (error) {
      if (!isCurrent(operation)) return
      if (preserveUncertaintyOnFailure && retryAttempt.value) {
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
      state.value = 'retry'
      operationMessage.value = 'Canceled before another upload. The earlier upload outcome is still unconfirmed.'
      return
    }

    state.value = 'idle'
    snapshot.value = undefined
    operationMessage.value = 'Backup canceled before upload. No backup file was created.'
  }

  function finishCanceledAttempt(operation: number, status: string): void {
    if (!isCurrent(operation)) return
    state.value = 'idle'
    snapshot.value = undefined
    retryAttempt.value = undefined
    operationMessage.value = status
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
    operationMessage.value = getErrorMessage(error, 'Google Drive backup failed. Your local map is unchanged.')
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

  function isCurrent(operation: number): boolean {
    return !isDisposed.value && operation === activeOperation
  }

  function readConfig(): { clientId: string, projectNumber: string, apiKey: string } | undefined {
    return readGoogleDriveConfig(runtimeConfig.public)
  }

  onScopeDispose(() => {
    isDisposed.value = true
    activeAbortController?.abort()
    activeOperation = ++operationSequence
  })

  return {
    state,
    message,
    destination,
    busy,
    canCancel,
    buttonLabel,
    activate,
    cancelBeforeUpload,
    startNewBackupInstead,
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}
