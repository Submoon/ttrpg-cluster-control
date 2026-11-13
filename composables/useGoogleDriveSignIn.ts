import { computed, onMounted, onScopeDispose, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { readGoogleDriveConfig } from '../utils/google-drive-config'
import { loadGoogleDriveServices, requestGoogleDriveAccessToken } from '../utils/google-drive-auth'

export type GoogleDriveSignInStatus = 'warming' | 'ready' | 'unavailable' | 'error'

interface GoogleDriveRuntimeConfig {
  public: {
    googleDriveClientId?: unknown
  }
}

export interface GoogleDriveSignInController {
  readonly status: Readonly<Ref<GoogleDriveSignInStatus>>
  readonly message: Readonly<Ref<string>>
  readonly ready: ComputedRef<boolean>
  retryLoading(): Promise<void>
  requestAccessToken(signal?: AbortSignal): Promise<string>
}

export interface GoogleDriveSignInDependencies {
  loadServices(): Promise<void>
  requestAccessToken(clientId: string, signal?: AbortSignal): Promise<string>
}

const defaultDependencies: GoogleDriveSignInDependencies = {
  loadServices: loadGoogleDriveServices,
  requestAccessToken: (clientId, signal) => requestGoogleDriveAccessToken(clientId, signal),
}

/**
 * Warms Google Identity Services at page mount without opening OAuth. The returned token action
 * stays user-triggered, so backup and restore can launch Google's consent window on the first click.
 */
export function useGoogleDriveSignIn(
  runtimeConfig: GoogleDriveRuntimeConfig = useRuntimeConfig(),
  dependencies: GoogleDriveSignInDependencies = defaultDependencies,
): GoogleDriveSignInController {
  const config = readGoogleDriveConfig(runtimeConfig.public)
  const status = ref<GoogleDriveSignInStatus>(config ? 'warming' : 'unavailable')
  const message = ref(config ? '' : 'Google Drive is not configured for this site.')
  const ready = computed(() => status.value === 'ready')
  let disposed = false
  let loadAttempt = 0
  let loadingPromise: Promise<void> | undefined

  function retryLoading(): Promise<void> {
    if (!config) {
      status.value = 'unavailable'
      message.value = 'Google Drive is not configured for this site.'
      return Promise.resolve()
    }
    if (status.value === 'warming' && loadingPromise) return loadingPromise

    status.value = 'warming'
    message.value = ''
    const attempt = ++loadAttempt
    const task = Promise.resolve().then(() => dependencies.loadServices()).then(() => {
      if (isCurrent(attempt)) status.value = 'ready'
    }).catch((error: unknown) => {
      if (isCurrent(attempt)) {
        status.value = 'error'
        message.value = error instanceof Error && error.message
          ? error.message
          : 'Google Drive sign-in could not be loaded. Check your connection and retry.'
      }
    }).finally(() => {
      if (attempt === loadAttempt) loadingPromise = undefined
    })
    loadingPromise = task
    return task
  }

  function requestAccessToken(signal?: AbortSignal): Promise<string> {
    if (!config) return Promise.reject(new Error('Google Drive is not configured for this site.'))
    if (!ready.value) return Promise.reject(new Error(message.value || 'Google Drive is still loading. Try again when it is ready.'))
    return dependencies.requestAccessToken(config.clientId, signal)
  }

  function isCurrent(attempt: number): boolean {
    return !disposed && attempt === loadAttempt
  }

  onMounted(() => { void retryLoading() })
  onScopeDispose(() => {
    disposed = true
    loadAttempt += 1
  })

  return { status, message, ready, retryLoading, requestAccessToken }
}
