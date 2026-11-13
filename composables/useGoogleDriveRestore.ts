import { computed, onScopeDispose, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import type { WorkspaceRestoreSource } from './useWorkspaceRestore'
import type { GoogleDriveSignInController } from './useGoogleDriveSignIn'
import { GoogleDriveCancelledError } from '../utils/google-drive-auth'
import { GoogleDriveApiError, listGoogleDriveBackups, readGoogleDriveFile } from '../utils/google-drive-api'
import { downloadBlob } from '../utils/browser-download'

export interface GoogleDriveRestoreFile {
  id: string
  name: string
  createdTime: string
}

export interface GoogleDriveRestorePage {
  files: GoogleDriveRestoreFile[]
  nextPageToken?: string
}

export type GoogleDriveRestoreState = 'idle' | 'authorizing' | 'listing' | 'choosing' | 'listing-more' | 'reading' | 'downloading'

interface WorkspaceRestoreOwner {
  openFrom(load: (signal?: AbortSignal) => Promise<WorkspaceRestoreSource | null>, signal?: AbortSignal): Promise<boolean>
}

export interface GoogleDriveRestoreDependencies {
  listBackups(accessToken: string, pageToken: string | undefined, signal?: AbortSignal): Promise<GoogleDriveRestorePage>
  readFile(accessToken: string, fileId: string, signal?: AbortSignal): Promise<string>
  downloadFile(filename: string, content: string): void
}

export interface GoogleDriveRestoreController {
  readonly state: Readonly<Ref<GoogleDriveRestoreState>>
  readonly message: Readonly<Ref<string>>
  readonly selectionError: Readonly<Ref<string>>
  readonly backups: Readonly<Ref<readonly GoogleDriveRestoreFile[]>>
  readonly nextPageToken: Readonly<Ref<string | undefined>>
  readonly dialogOpen: ComputedRef<boolean>
  readonly busy: ComputedRef<boolean>
  readonly canCancel: ComputedRef<boolean>
  readonly canLoadMore: ComputedRef<boolean>
  readonly buttonLabel: ComputedRef<string>
  activate(): void
  cancel(showMessage?: boolean): void
  openBackup(fileId: string): void
  downloadBackup(fileId: string): void
  loadMore(): void
}

const defaultDependencies: GoogleDriveRestoreDependencies = {
  listBackups: (accessToken, pageToken, signal) => listGoogleDriveBackups(accessToken, pageToken, fetch, signal),
  readFile: (accessToken, fileId, signal) => readGoogleDriveFile(accessToken, fileId, fetch, signal),
  downloadFile: (filename, content) => downloadBlob(filename, new Blob([content], { type: 'application/json' })),
}

/**
 * Owns appDataFolder authorization and selection for the page lifetime. The shared restore operation starts
 * before OAuth and keeps its signal through listing and download, so a newer local restore can supersede it.
 */
export function useGoogleDriveRestore(
  workspaceRestore: WorkspaceRestoreOwner,
  signIn: GoogleDriveSignInController,
  dependencies: GoogleDriveRestoreDependencies = defaultDependencies,
): GoogleDriveRestoreController {
  const state = ref<GoogleDriveRestoreState>('idle')
  const message = ref('')
  const selectionError = ref('')
  const backups = ref<GoogleDriveRestoreFile[]>([])
  const nextPageToken = ref<string>()
  let operationSequence = 0
  let activeOperation = 0
  let activeAbortController: AbortController | undefined
  let activeProviderSignal: AbortSignal | undefined
  let activeAccessToken: string | undefined
  let resolveSelection: ((source: WorkspaceRestoreSource | null) => void) | undefined
  let selectionAbortHandler: (() => void) | undefined

  const dialogOpen = computed(() => ['listing', 'choosing', 'listing-more', 'reading', 'downloading'].includes(state.value))
  const busy = computed(() => ['authorizing', 'listing', 'listing-more', 'reading', 'downloading'].includes(state.value))
  const canCancel = computed(() => state.value !== 'idle')
  const canLoadMore = computed(() => state.value === 'choosing' && Boolean(nextPageToken.value))
  const buttonLabel = computed(() => busy.value ? 'Opening from Google Drive…' : 'Open from Google Drive')

  function isCurrent(operation: number, signal?: AbortSignal): boolean {
    return activeOperation === operation && !activeAbortController?.signal.aborted && !signal?.aborted
  }

  function beginOperation(): number {
    activeAbortController?.abort()
    activeAbortController = new AbortController()
    activeProviderSignal = undefined
    activeAccessToken = undefined
    backups.value = []
    nextPageToken.value = undefined
    selectionError.value = ''
    message.value = ''
    activeOperation = ++operationSequence
    return activeOperation
  }

  function activate(): void {
    if (busy.value || state.value === 'choosing' || state.value === 'listing-more') return
    if (!signIn.ready.value) {
      message.value = signIn.message.value || 'Google Drive is still loading. Try again when it is ready.'
      return
    }

    const operation = beginOperation()
    void openBackupList(operation)
  }

  async function openBackupList(operation: number): Promise<void> {
    if (!isCurrent(operation)) return
    const callerAbort = activeAbortController
    if (!callerAbort) return
    state.value = 'authorizing'
    let providerSignal: AbortSignal | undefined
    let accessToken: string | undefined
    const accepted = await workspaceRestore.openFrom(async signal => {
      const operationSignal = signal ?? callerAbort.signal
      providerSignal = operationSignal
      activeProviderSignal = operationSignal
      try {
        // Start OAuth synchronously with the button click so Google can open its token window.
        const tokenRequest = signIn.requestAccessToken(operationSignal)
        accessToken = await tokenRequest
        if (!isCurrent(operation, operationSignal)) return null
        activeAccessToken = accessToken

        state.value = 'listing'
        const page = await dependencies.listBackups(accessToken, undefined, operationSignal)
        if (!isCurrent(operation, operationSignal)) return null
        backups.value = page.files
        nextPageToken.value = page.nextPageToken
        state.value = 'choosing'
        message.value = ''
        return await waitForSelection(operationSignal)
      } catch (error) {
        if (operationSignal.aborted) return null
        if (invalidateAfterUnauthorized(error, accessToken)) return null
        if (error instanceof GoogleDriveCancelledError) {
          message.value = 'Google Drive sign-in was canceled. Your workspace is unchanged.'
          return null
        }
        throw error
      } finally {
        if (isCurrent(operation)) {
          state.value = 'idle'
          activeAccessToken = undefined
          activeProviderSignal = undefined
          activeAbortController = undefined
          backups.value = []
          nextPageToken.value = undefined
        }
      }
    }, callerAbort.signal)

    if (isCurrent(operation)) {
      if (!accepted && !providerSignal?.aborted) message.value = 'Finish the current restore before starting a Google Drive restore.'
      state.value = 'idle'
      activeAccessToken = undefined
      activeProviderSignal = undefined
      activeAbortController = undefined
      backups.value = []
      nextPageToken.value = undefined
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

  function openBackup(fileId: string): void {
    if (state.value !== 'choosing' || !activeAccessToken || !activeProviderSignal || activeProviderSignal.aborted) return
    const file = backups.value.find(candidate => candidate.id === fileId)
    if (!file) return
    const operation = activeOperation
    const accessToken = activeAccessToken
    const signal = activeProviderSignal
    state.value = 'reading'
    message.value = ''
    selectionError.value = ''

    void dependencies.readFile(accessToken, file.id, signal).then(content => {
      if (!isCurrent(operation, signal)) return
      state.value = 'idle'
      settleSelection({ name: file.name, content })
    }).catch((error: unknown) => {
      if (!isCurrent(operation, signal)) return
      if (closeForUnauthorized(error, accessToken)) return
      selectionError.value = error instanceof Error ? error.message : 'Google Drive could not read this backup.'
      state.value = 'choosing'
    })
  }

  function loadMore(): void {
    if (!canLoadMore.value || !activeAccessToken || !activeProviderSignal) return
    const operation = activeOperation
    const accessToken = activeAccessToken
    const pageToken = nextPageToken.value
    const signal = activeProviderSignal
    state.value = 'listing-more'
    message.value = ''
    selectionError.value = ''
    void dependencies.listBackups(accessToken, pageToken, signal).then(page => {
      if (!isCurrent(operation, signal)) return
      const seen = new Set(backups.value.map(file => file.id))
      backups.value = [...backups.value, ...page.files.filter(file => !seen.has(file.id))]
      nextPageToken.value = page.nextPageToken
      state.value = 'choosing'
    }).catch((error: unknown) => {
      if (!isCurrent(operation, signal)) return
      if (closeForUnauthorized(error, accessToken)) return
      selectionError.value = error instanceof Error ? error.message : 'Google Drive could not list more backups.'
      state.value = 'choosing'
    })
  }

  function downloadBackup(fileId: string): void {
    if (state.value !== 'choosing' || !activeAccessToken || !activeProviderSignal || activeProviderSignal.aborted) return
    const file = backups.value.find(candidate => candidate.id === fileId)
    if (!file) return
    const operation = activeOperation
    const accessToken = activeAccessToken
    const signal = activeProviderSignal
    state.value = 'downloading'
    selectionError.value = ''

    void dependencies.readFile(accessToken, file.id, signal).then(content => {
      if (!isCurrent(operation, signal)) return
      dependencies.downloadFile(jsonDownloadFilename(file.name), content)
      message.value = `Downloaded ${file.name}.`
      state.value = 'choosing'
    }).catch((error: unknown) => {
      if (!isCurrent(operation, signal)) return
      if (closeForUnauthorized(error, accessToken)) return
      selectionError.value = error instanceof Error ? error.message : 'Google Drive could not download this backup.'
      state.value = 'choosing'
    })
  }

  function cancel(showMessage = true): void {
    if (!canCancel.value) return
    activeAbortController?.abort()
    activeAbortController = undefined
    activeOperation = ++operationSequence
    settleSelection(null)
    activeProviderSignal = undefined
    activeAccessToken = undefined
    state.value = 'idle'
    backups.value = []
    nextPageToken.value = undefined
    selectionError.value = ''
    message.value = showMessage ? 'Google Drive restore canceled. Your workspace is unchanged.' : ''
  }

  function invalidateAfterUnauthorized(error: unknown, accessToken: string | undefined): boolean {
    if (!accessToken || !(error instanceof GoogleDriveApiError) || error.httpStatus !== 401) return false
    signIn.invalidateAccessToken(accessToken)
    message.value = 'Google Drive authorization expired. Open Google Drive again to sign in.'
    return true
  }

  function closeForUnauthorized(error: unknown, accessToken: string): boolean {
    if (!invalidateAfterUnauthorized(error, accessToken)) return false
    cancel(false)
    message.value = 'Google Drive authorization expired. Open Google Drive again to sign in.'
    return true
  }

  onScopeDispose(() => {
    activeAbortController?.abort()
    activeOperation = ++operationSequence
    settleSelection(null)
  })

  return {
    state,
    message,
    selectionError,
    backups,
    nextPageToken,
    dialogOpen,
    busy,
    canCancel,
    canLoadMore,
    buttonLabel,
    activate,
    cancel,
    openBackup,
    downloadBackup,
    loadMore,
  }
}

function jsonDownloadFilename(filename: string): string {
  const safeName = filename.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-').trim().replace(/[. ]+$/g, '') // eslint-disable-line no-control-regex -- Replace filesystem-reserved C0 controls.
  const fallback = safeName || 'jump-cluster-backup'
  return /\.json$/i.test(fallback) ? fallback : `${fallback}.json`
}
