import { computed, onScopeDispose, ref, watch } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import type { WorkspaceRestoreSource } from './useWorkspaceRestore'
import type { DropboxSignInController } from './useDropboxSignIn'
import { DropboxApiError, deleteDropboxBackup, listDropboxBackups, readDropboxBackup, readDropboxBackupBytes } from '../utils/dropbox-api'
import type { DropboxBackupFile } from '../utils/dropbox-api'
import { isDropboxDatedBackupName } from '../utils/dropbox-backup-snapshot'
import { DropboxCancelledError } from '../utils/dropbox-auth'
import { downloadBlob, jsonDownloadFilename } from '../utils/browser-download'

export interface DropboxRestoreBackup {
  id: string
  name: string
  rev: string
  modifiedAt: string
}

export type DropboxRestoreState = 'idle' | 'authorizing' | 'listing' | 'choosing' | 'reading' | 'downloading' | 'deleting' | 'refreshing'

interface WorkspaceRestoreOwner {
  openFrom(load: (signal?: AbortSignal) => Promise<WorkspaceRestoreSource | null>, signal?: AbortSignal): Promise<boolean>
}

export interface DropboxRestoreDependencies {
  listBackups(accessToken: string, signal?: AbortSignal): Promise<DropboxBackupFile[]>
  readFile(accessToken: string, file: DropboxBackupFile, signal?: AbortSignal): Promise<string>
  readFileBytes?(accessToken: string, file: DropboxBackupFile, signal?: AbortSignal): Promise<Uint8Array>
  deleteFile(accessToken: string, file: DropboxBackupFile, signal?: AbortSignal): Promise<void>
  downloadFile?(filename: string, content: Uint8Array): void
}

export interface DropboxRestoreOptions {
  onCanceled?: () => void
}

export interface DropboxRestoreController {
  readonly state: Readonly<Ref<DropboxRestoreState>>
  readonly message: Readonly<Ref<string>>
  readonly backups: Readonly<Ref<readonly DropboxRestoreBackup[]>>
  readonly completedDownloads: Readonly<Ref<number>>
  readonly completedDeletions: Readonly<Ref<number>>
  readonly refreshRequired: Readonly<Ref<boolean>>
  readonly dialogOpen: ComputedRef<boolean>
  readonly busy: ComputedRef<boolean>
  readonly canCancel: ComputedRef<boolean>
  activate(): void
  cancel(notifyCancellation?: boolean): void
  select(id: string): void
  downloadBackup(id: string): void
  deleteBackup(id: string, rev: string): void
  refresh(): void
}

const defaultDependencies: Required<DropboxRestoreDependencies> = {
  listBackups: (accessToken, signal) => listDropboxBackups(accessToken, fetch, signal),
  readFile: (accessToken, file, signal) => readDropboxBackup(accessToken, file, fetch, signal),
  readFileBytes: (accessToken, file, signal) => readDropboxBackupBytes(accessToken, file, fetch, signal),
  deleteFile: (accessToken, file, signal) => deleteDropboxBackup(accessToken, file, fetch, signal),
  downloadFile: (filename, content) => {
    const buffer = new ArrayBuffer(content.byteLength)
    new Uint8Array(buffer).set(content)
    downloadBlob(filename, new Blob([buffer], { type: 'application/json' }))
  },
}

/** Starts the shared restore lease before Dropbox authorization and keeps each selection tied to its account and revision. */
export function useDropboxRestore(
  workspaceRestore: WorkspaceRestoreOwner,
  signIn: DropboxSignInController,
  dependencies: DropboxRestoreDependencies = defaultDependencies,
  options: DropboxRestoreOptions = {},
): DropboxRestoreController {
  const state = ref<DropboxRestoreState>('idle')
  const message = ref('')
  const backups = ref<DropboxRestoreBackup[]>([])
  const completedDownloads = ref(0)
  const completedDeletions = ref(0)
  const refreshRequired = ref(false)
  const dialogOpen = computed(() => state.value !== 'idle')
  const busy = computed(() => state.value !== 'idle' && state.value !== 'choosing')
  const canCancel = computed(() => state.value !== 'idle' && state.value !== 'deleting' && state.value !== 'refreshing')
  let operationSequence = 0
  let activeOperation = 0
  let activeAbortController: AbortController | undefined
  let activeProviderSignal: AbortSignal | undefined
  let activeAccessToken: string | undefined
  let activeAccountId: string | undefined
  let listedFiles: DropboxBackupFile[] = []
  let resolveSelection: ((source: WorkspaceRestoreSource | null) => void) | undefined
  let selectionAbortHandler: (() => void) | undefined
  const readFileBytes = dependencies.readFileBytes ?? defaultDependencies.readFileBytes
  const downloadFile = dependencies.downloadFile ?? defaultDependencies.downloadFile

  function isCurrent(operation: number, signal?: AbortSignal): boolean {
    return activeOperation === operation && !activeAbortController?.signal.aborted && !signal?.aborted
  }

  function beginOperation(): number {
    activeAbortController?.abort()
    activeAbortController = new AbortController()
    activeProviderSignal = undefined
    activeAccessToken = undefined
    activeAccountId = undefined
    listedFiles = []
    backups.value = []
    refreshRequired.value = false
    message.value = ''
    activeOperation = ++operationSequence
    return activeOperation
  }

  function activate(): void {
    if (busy.value || state.value === 'choosing') return
    if (!signIn.ready.value) {
      message.value = signIn.message.value || 'Dropbox is not ready. Try again when it is available.'
      return
    }
    void openBackupList(beginOperation())
  }

  async function openBackupList(operation: number): Promise<void> {
    const callerAbort = activeAbortController
    if (!callerAbort || !isCurrent(operation)) return
    state.value = 'authorizing'

    let providerSignal: AbortSignal | undefined
    let accessToken: string | undefined
    let oauthCanceled = false
    const accepted = await workspaceRestore.openFrom(async signal => {
      const operationSignal = signal ?? callerAbort.signal
      providerSignal = operationSignal
      activeProviderSignal = operationSignal
      try {
        // Request the grant in the original click stack so Dropbox can open its authorization window.
        const grantRequest = signIn.requestGrant(operationSignal)
        const grant = await grantRequest
        if (!isCurrent(operation, operationSignal)) return null
        accessToken = grant.accessToken
        activeAccessToken = grant.accessToken
        activeAccountId = grant.accountId
        if (!accountIsCurrent(operation, operationSignal)) return null

        state.value = 'listing'
        const files = await dependencies.listBackups(grant.accessToken, operationSignal)
        if (!isCurrent(operation, operationSignal)) return null
        if (!accountIsCurrent(operation, operationSignal)) return null
        setListedFiles(files)
        state.value = 'choosing'
        message.value = files.length ? '' : 'No Dropbox Jump Cluster backups are available in this App Folder.'
        return await waitForSelection(operationSignal)
      } catch (error) {
        if (operationSignal.aborted) return null
        if (invalidateAfterUnauthorized(error, accessToken)) {
          message.value = 'Dropbox authorization expired. Open Dropbox restore again to authorize and refresh the list.'
          return null
        }
        if (error instanceof DropboxCancelledError) {
          oauthCanceled = isCurrent(operation, operationSignal)
          return null
        }
        message.value = getErrorMessage(error, 'Dropbox could not list your backups. Try again.')
        return null
      } finally {
        if (isCurrent(operation)) clearOperationState()
      }
    }, callerAbort.signal)

    if (isCurrent(operation)) {
      if (!accepted && !providerSignal?.aborted) {
        message.value = 'Finish the current restore before starting a Dropbox restore.'
      }
      clearOperationState()
      if (oauthCanceled) options.onCanceled?.()
    }
  }

  function waitForSelection(signal: AbortSignal): Promise<WorkspaceRestoreSource | null> {
    return new Promise(resolve => {
      resolveSelection = resolve
      selectionAbortHandler = () => settleSelection(null)
      signal.addEventListener('abort', selectionAbortHandler, { once: true })
    })
  }

  function settleSelection(source: WorkspaceRestoreSource | null): void {
    if (activeProviderSignal && selectionAbortHandler) {
      activeProviderSignal.removeEventListener('abort', selectionAbortHandler)
    }
    selectionAbortHandler = undefined
    const resolve = resolveSelection
    resolveSelection = undefined
    resolve?.(source)
  }

  function select(id: string): void {
    if (state.value !== 'choosing' || !activeAccessToken || !activeProviderSignal || activeProviderSignal.aborted) return
    if (!accountIsCurrent(activeOperation, activeProviderSignal)) return
    const file = listedFiles.find(candidate => candidate.id === id)
    if (!file) return

    const operation = activeOperation
    const accessToken = activeAccessToken
    const signal = activeProviderSignal
    state.value = 'reading'
    message.value = ''

    void dependencies.readFile(accessToken, file, signal).then(content => {
      if (!isCurrent(operation, signal) || !accountIsCurrent(operation, signal)) return
      state.value = 'idle'
      settleSelection({ name: file.name, content, sourceKind: 'dropbox' })
    }).catch((error: unknown) => {
      if (!isCurrent(operation, signal)) return
      if (closeForUnauthorized(error, accessToken)) return
      message.value = getErrorMessage(error, 'Dropbox could not download this backup. Refresh the list and try again.')
      state.value = 'choosing'
    })
  }

  function downloadBackup(id: string): void {
    if (state.value !== 'choosing' || !activeAccessToken || !activeProviderSignal || activeProviderSignal.aborted) return
    if (!accountIsCurrent(activeOperation, activeProviderSignal)) return
    const file = listedFiles.find(candidate => candidate.id === id)
    if (!file) return

    const operation = activeOperation
    const accessToken = activeAccessToken
    const signal = activeProviderSignal
    state.value = 'downloading'
    message.value = ''

    void readFileBytes(accessToken, file, signal).then(content => {
      if (!isCurrent(operation, signal) || !accountIsCurrent(operation, signal)) return
      downloadFile(jsonDownloadFilename(file.name), content)
      if (!isCurrent(operation, signal) || !accountIsCurrent(operation, signal)) return
      state.value = 'choosing'
      completedDownloads.value += 1
    }).catch((error: unknown) => {
      if (!isCurrent(operation, signal)) return
      if (closeForUnauthorized(error, accessToken)) return
      if (!accountIsCurrent(operation, signal)) return
      message.value = getErrorMessage(error, 'Dropbox could not download this backup. Refresh the list and try again.')
      state.value = 'choosing'
    })
  }

  function deleteBackup(id: string, rev: string): void {
    if (state.value !== 'choosing' || !activeAccessToken || !activeProviderSignal || activeProviderSignal.aborted) return
    if (refreshRequired.value) {
      message.value = 'Refresh the Dropbox list before trying another delete.'
      return
    }
    if (!accountIsCurrent(activeOperation, activeProviderSignal)) return
    const file = listedFiles.find(candidate => candidate.id === id && candidate.rev === rev)
    if (!file) return
    if (!isDropboxDatedBackupName(file.name)) {
      message.value = 'Only dated Jump Cluster backups can be deleted from this list.'
      return
    }

    const operation = activeOperation
    const accessToken = activeAccessToken
    const signal = activeProviderSignal
    state.value = 'deleting'
    message.value = ''

    void dependencies.deleteFile(accessToken, file, signal).then(() => {
      if (!isCurrent(operation, signal) || !accountIsCurrent(operation, signal)) return
      setListedFiles(listedFiles.filter(candidate => candidate.id !== file.id || candidate.rev !== file.rev))
      refreshRequired.value = false
      state.value = 'choosing'
      message.value = ''
      completedDeletions.value += 1
    }).catch((error: unknown) => {
      if (!isCurrent(operation, signal)) return
      if (closeForUnauthorized(error, accessToken)) return
      if (!accountIsCurrent(operation, signal)) return
      state.value = 'choosing'
      refreshRequired.value = true
      message.value = error instanceof DropboxApiError && error.outcomeUncertain
        ? `Dropbox could not confirm whether ${file.name} was deleted. Refresh the list or reopen Dropbox restore before trying again.`
        : `Dropbox could not delete ${file.name}. ${getErrorMessage(error, 'Refresh the list and try again.')}`
    })
  }

  function refresh(): void {
    if (state.value !== 'choosing' || !activeAccessToken || !activeProviderSignal || activeProviderSignal.aborted) return
    if (!accountIsCurrent(activeOperation, activeProviderSignal)) return

    const operation = activeOperation
    const accessToken = activeAccessToken
    const signal = activeProviderSignal
    state.value = 'refreshing'
    message.value = ''

    void dependencies.listBackups(accessToken, signal).then((files) => {
      if (!isCurrent(operation, signal) || !accountIsCurrent(operation, signal)) return
      setListedFiles(files)
      refreshRequired.value = false
      state.value = 'choosing'
      message.value = files.length ? '' : 'No Dropbox Jump Cluster backups are available in this App Folder.'
    }).catch((error: unknown) => {
      if (!isCurrent(operation, signal)) return
      if (closeForUnauthorized(error, accessToken)) return
      if (!accountIsCurrent(operation, signal)) return
      state.value = 'choosing'
      refreshRequired.value = true
      message.value = getErrorMessage(error, 'Dropbox could not refresh your backups. Try again.')
    })
  }

  function setListedFiles(files: DropboxBackupFile[]): void {
    listedFiles = files
      .map((file, index) => ({ file, index }))
      .sort((left, right) => Date.parse(right.file.serverModified) - Date.parse(left.file.serverModified) || left.index - right.index)
      .map(({ file }) => file)
    backups.value = listedFiles.map(file => ({
      id: file.id,
      name: file.name,
      rev: file.rev,
      modifiedAt: file.serverModified,
    }))
  }

  function accountIsCurrent(operation: number, signal?: AbortSignal): boolean {
    if (!isCurrent(operation, signal)) return false
    if (activeAccountId && signIn.accountId.value === activeAccountId) return true
    stopForAccountChange()
    message.value = 'The Dropbox account changed. Open Dropbox restore again to refresh its backup list.'
    return false
  }

  function cancel(notifyCancellation = true): void {
    if (!canCancel.value) return
    abortCurrentOperation()
    if (notifyCancellation) options.onCanceled?.()
  }

  function abortCurrentOperation(): void {
    activeAbortController?.abort()
    activeAbortController = undefined
    activeOperation = ++operationSequence
    settleSelection(null)
    clearOperationState()
  }

  function stopForAccountChange(): void {
    if (state.value === 'idle') return
    abortCurrentOperation()
  }

  function clearOperationState(): void {
    activeAccessToken = undefined
    activeAccountId = undefined
    activeProviderSignal = undefined
    activeAbortController = undefined
    listedFiles = []
    backups.value = []
    refreshRequired.value = false
    state.value = 'idle'
  }

  function invalidateAfterUnauthorized(error: unknown, accessToken: string | undefined): boolean {
    if (!accessToken || !(error instanceof DropboxApiError) || error.httpStatus !== 401) return false
    signIn.invalidateAccessToken(accessToken)
    return true
  }

  function closeForUnauthorized(error: unknown, accessToken: string): boolean {
    if (!invalidateAfterUnauthorized(error, accessToken)) return false
    abortCurrentOperation()
    message.value = 'Dropbox authorization expired. Open Dropbox restore again to authorize and refresh the list.'
    return true
  }

  watch(() => signIn.accountId.value, (accountId) => {
    if (!activeAccountId || accountId === activeAccountId || state.value === 'idle') return
    stopForAccountChange()
    message.value = 'The Dropbox account changed. Open Dropbox restore again to refresh its backup list.'
  })

  onScopeDispose(() => {
    activeAbortController?.abort()
    activeOperation = ++operationSequence
    settleSelection(null)
  })

  return { state, message, backups, completedDownloads, completedDeletions, refreshRequired, dialogOpen, busy, canCancel, activate, cancel, select, downloadBackup, deleteBackup, refresh }
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}
