import { computed, onScopeDispose, ref, watch } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import type { WorkspaceRestoreSource } from './useWorkspaceRestore'
import type { DropboxSignInController } from './useDropboxSignIn'
import { DropboxApiError, listDropboxBackups, readDropboxBackup } from '../utils/dropbox-api'
import type { DropboxBackupFile } from '../utils/dropbox-api'
import { DropboxCancelledError } from '../utils/dropbox-auth'

export interface DropboxRestoreBackup {
  id: string
  name: string
  modifiedAt: string
}

export type DropboxRestoreState = 'idle' | 'authorizing' | 'listing' | 'choosing' | 'downloading'

interface WorkspaceRestoreOwner {
  openFrom(load: (signal?: AbortSignal) => Promise<WorkspaceRestoreSource | null>, signal?: AbortSignal): Promise<boolean>
}

export interface DropboxRestoreDependencies {
  listBackups(accessToken: string, signal?: AbortSignal): Promise<DropboxBackupFile[]>
  readFile(accessToken: string, file: DropboxBackupFile, signal?: AbortSignal): Promise<string>
}

export interface DropboxRestoreOptions {
  onCanceled?: () => void
}

export interface DropboxRestoreController {
  readonly state: Readonly<Ref<DropboxRestoreState>>
  readonly message: Readonly<Ref<string>>
  readonly backups: Readonly<Ref<readonly DropboxRestoreBackup[]>>
  readonly dialogOpen: ComputedRef<boolean>
  readonly busy: ComputedRef<boolean>
  readonly canCancel: ComputedRef<boolean>
  activate(): void
  cancel(notifyCancellation?: boolean): void
  select(id: string): void
}

const defaultDependencies: DropboxRestoreDependencies = {
  listBackups: (accessToken, signal) => listDropboxBackups(accessToken, fetch, signal),
  readFile: (accessToken, file, signal) => readDropboxBackup(accessToken, file, fetch, signal),
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
  const dialogOpen = computed(() => state.value !== 'idle')
  const busy = computed(() => state.value !== 'idle' && state.value !== 'choosing')
  const canCancel = computed(() => state.value !== 'idle')
  let operationSequence = 0
  let activeOperation = 0
  let activeAbortController: AbortController | undefined
  let activeProviderSignal: AbortSignal | undefined
  let activeAccessToken: string | undefined
  let activeAccountId: string | undefined
  let listedFiles: DropboxBackupFile[] = []
  let resolveSelection: ((source: WorkspaceRestoreSource | null) => void) | undefined
  let selectionAbortHandler: (() => void) | undefined

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
        listedFiles = files
        backups.value = files.map(file => ({
          id: file.id,
          name: file.name,
          modifiedAt: file.serverModified,
        }))
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
        throw error
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
    state.value = 'downloading'
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

  function accountIsCurrent(operation: number, signal?: AbortSignal): boolean {
    if (!isCurrent(operation, signal)) return false
    if (activeAccountId && signIn.accountId.value === activeAccountId) return true
    cancel(false)
    message.value = 'The Dropbox account changed. Open Dropbox restore again to refresh its backup list.'
    return false
  }

  function cancel(notifyCancellation = true): void {
    if (!canCancel.value) return
    activeAbortController?.abort()
    activeAbortController = undefined
    activeOperation = ++operationSequence
    settleSelection(null)
    clearOperationState()
    if (notifyCancellation) options.onCanceled?.()
  }

  function clearOperationState(): void {
    activeAccessToken = undefined
    activeAccountId = undefined
    activeProviderSignal = undefined
    activeAbortController = undefined
    listedFiles = []
    backups.value = []
    state.value = 'idle'
  }

  function invalidateAfterUnauthorized(error: unknown, accessToken: string | undefined): boolean {
    if (!accessToken || !(error instanceof DropboxApiError) || error.httpStatus !== 401) return false
    signIn.invalidateAccessToken(accessToken)
    return true
  }

  function closeForUnauthorized(error: unknown, accessToken: string): boolean {
    if (!invalidateAfterUnauthorized(error, accessToken)) return false
    cancel(false)
    message.value = 'Dropbox authorization expired. Open Dropbox restore again to authorize and refresh the list.'
    return true
  }

  watch(() => signIn.accountId.value, (accountId) => {
    if (!activeAccountId || accountId === activeAccountId || !canCancel.value) return
    cancel(false)
    message.value = 'The Dropbox account changed. Open Dropbox restore again to refresh its backup list.'
  })

  onScopeDispose(() => {
    activeAbortController?.abort()
    activeOperation = ++operationSequence
    settleSelection(null)
  })

  return { state, message, backups, dialogOpen, busy, canCancel, activate, cancel, select }
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}
