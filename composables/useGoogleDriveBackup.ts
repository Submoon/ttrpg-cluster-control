import { computed, onScopeDispose, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import type { LocalWorkspace } from '../domain/workspace'
import {
  GoogleDriveApiError,
  generateGoogleDriveFileId,
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

export interface GoogleDriveBackupController {
  readonly state: Readonly<Ref<GoogleDriveBackupState>>
  readonly message: Readonly<Ref<string>>
  readonly busy: ComputedRef<boolean>
  readonly canCancel: ComputedRef<boolean>
  readonly buttonLabel: ComputedRef<string>
  activate(): void
  cancelBeforeUpload(): void
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
export function useGoogleDriveBackup(workspace: () => LocalWorkspace | null | undefined): GoogleDriveBackupController {
  const runtimeConfig = useRuntimeConfig()
  const state = ref<GoogleDriveBackupState>('idle')
  const message = ref('')
  const snapshot = ref<GoogleDriveBackupSnapshot>()
  const retryAttempt = ref<BackupAttempt>()
  const isDisposed = ref(false)
  let operationSequence = 0
  let activeOperation = 0

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

  function startBackup(): void {
    const config = readConfig()
    if (!config) {
      message.value = 'Google Drive backup is not configured for this site.'
      return
    }

    const appliedWorkspace = workspace()
    if (!appliedWorkspace) {
      message.value = 'Open a Jump Cluster before starting a Google Drive backup.'
      return
    }

    let nextSnapshot: GoogleDriveBackupSnapshot
    try {
      // Capture the applied data synchronously before scripts, authorization, or Picker can yield.
      nextSnapshot = createGoogleDriveBackupSnapshot(appliedWorkspace)
    } catch (error) {
      message.value = getErrorMessage(error, 'The applied Jump Cluster could not be captured for backup.')
      return
    }

    const operation = beginOperation()
    snapshot.value = nextSnapshot
    retryAttempt.value = undefined
    message.value = ''

    if (googleDriveServicesAreLoaded()) {
      void authorizeAndSelectFolder(operation)
      return
    }

    state.value = 'preparing'
    void loadGoogleDriveServices().then(() => {
      if (!isCurrent(operation)) return
      state.value = 'continue'
      message.value = 'Google Drive is ready. Continue to sign in and choose a private folder.'
    }).catch(error => {
      if (!isCurrent(operation)) return
      snapshot.value = undefined
      state.value = 'idle'
      message.value = getErrorMessage(error, 'Google Drive could not be loaded. Your local map is unchanged.')
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
      })
      if (!isCurrent(operation)) return
      if (!selected) {
        finishCanceledAttempt(operation, 'Google Drive folder selection was canceled. No backup was created.')
        return
      }

      const folder = await verifyPrivateGoogleDriveFolder(accessToken, selected.id)
      if (!isCurrent(operation)) return
      const fileId = await generateGoogleDriveFileId(accessToken)
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
      await saveBackup(accessToken, { ...attempt, folderName: folder.name }, operation)
    } catch (error) {
      if (!isCurrent(operation)) return
      if (error instanceof GoogleDriveCancelledError) {
        state.value = 'retry'
        message.value = 'Google Drive authorization was canceled. You can retry the same backup.'
        return
      }
      // The previous upload might already exist even if this retry cannot check or write it.
      state.value = 'retry'
      message.value = `${getErrorMessage(error, 'Google Drive could not check the backup.')} The earlier upload outcome is still unconfirmed; retry the same backup to check its file.`
    }
  }

  async function saveBackup(accessToken: string, attempt: BackupAttempt, operation: number): Promise<void> {
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
      })
      if (!isCurrent(operation)) return

      state.value = 'idle'
      snapshot.value = undefined
      retryAttempt.value = undefined
      message.value = `Saved ${saved.name} to ${saved.folderName}.`
    } catch (error) {
      if (!isCurrent(operation)) return
      finishFailedAttempt(operation, error)
    }
  }

  function cancelBeforeUpload(): void {
    if (!canCancel.value) return
    ++operationSequence
    activeOperation = operationSequence

    if (retryAttempt.value) {
      state.value = 'retry'
      message.value = 'Canceled before another upload. The earlier upload outcome is still unconfirmed; retry the same backup to check its file.'
      return
    }

    state.value = 'idle'
    snapshot.value = undefined
    message.value = 'Backup canceled before upload. No backup file was created.'
  }

  function finishCanceledAttempt(operation: number, status: string): void {
    if (!isCurrent(operation)) return
    state.value = 'idle'
    snapshot.value = undefined
    retryAttempt.value = undefined
    message.value = status
  }

  function finishFailedAttempt(operation: number, error: unknown): void {
    if (!isCurrent(operation)) return
    if (error instanceof GoogleDriveApiError && error.outcomeUncertain && retryAttempt.value) {
      state.value = 'retry'
      message.value = error.message
      return
    }

    state.value = 'idle'
    snapshot.value = undefined
    retryAttempt.value = undefined
    message.value = getErrorMessage(error, 'Google Drive backup failed. Your local map is unchanged.')
  }

  function beginOperation(): number {
    activeOperation = ++operationSequence
    return activeOperation
  }

  function isCurrent(operation: number): boolean {
    return !isDisposed.value && operation === activeOperation
  }

  function readConfig(): { clientId: string, projectNumber: string, apiKey: string } | undefined {
    const clientId = runtimeConfig.public.googleDriveClientId
    const projectNumber = runtimeConfig.public.googleDriveProjectNumber
    const apiKey = runtimeConfig.public.googleDriveApiKey
    if (!clientId.trim() || !projectNumber.trim() || !apiKey.trim()) return undefined
    return { clientId, projectNumber, apiKey }
  }

  onScopeDispose(() => {
    isDisposed.value = true
    activeOperation = ++operationSequence
  })

  return {
    state,
    message,
    busy,
    canCancel,
    buttonLabel,
    activate,
    cancelBeforeUpload,
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}
