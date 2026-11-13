import { computed, onMounted, onScopeDispose, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { readGoogleDriveConfig } from '../utils/google-drive-config'
import { loadGoogleDriveServices, requestGoogleDriveAccessToken } from '../utils/google-drive-auth'
import { GoogleDriveCancelledError } from '../utils/google-drive-auth'
import type { GoogleDriveAccessToken } from '../utils/google-drive-auth'

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
  readonly hasAccessToken: ComputedRef<boolean>
  retryLoading(): Promise<void>
  requestAccessToken(signal?: AbortSignal): Promise<string>
  invalidateAccessToken(accessToken: string): void
  forgetAccessToken(): void
}

export interface GoogleDriveSignInDependencies {
  loadServices(): Promise<void>
  requestAccessToken(clientId: string, signal?: AbortSignal): Promise<GoogleDriveAccessToken>
}

const defaultDependencies: GoogleDriveSignInDependencies = {
  loadServices: loadGoogleDriveServices,
  requestAccessToken: (clientId, signal) => requestGoogleDriveAccessToken(clientId, signal),
}

const TOKEN_EXPIRY_SAFETY_WINDOW_MS = 30_000

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
  const tokenAvailable = ref(false)
  const hasAccessToken = computed(() => tokenAvailable.value)
  let disposed = false
  let loadAttempt = 0
  let loadingPromise: Promise<void> | undefined
  let cachedToken: GoogleDriveAccessToken | undefined
  let cacheExpiryTimer: ReturnType<typeof setTimeout> | undefined
  let activeAuthAttempt = 0
  let activeAuthController: AbortController | undefined
  let activeAuthCallerSignal: AbortSignal | undefined
  let activeAuthCallerAbort: (() => void) | undefined

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
    if (disposed || signal?.aborted) return Promise.reject(new GoogleDriveCancelledError())

    const now = Date.now()
    if (cachedToken?.expiresAt && cachedToken.expiresAt - now > TOKEN_EXPIRY_SAFETY_WINDOW_MS) {
      return Promise.resolve(cachedToken.accessToken)
    }
    clearCachedToken()

    if (activeAuthController) {
      return Promise.reject(new Error('A Google Drive sign-in is already in progress. Finish or close it before starting another Drive action.'))
    }

    const controller = new AbortController()
    const attempt = ++activeAuthAttempt
    const abortFromCaller = () => controller.abort()
    activeAuthController = controller
    activeAuthCallerSignal = signal
    activeAuthCallerAbort = abortFromCaller
    signal?.addEventListener('abort', abortFromCaller, { once: true })
    if (signal?.aborted) abortFromCaller()

    const cleanup = () => {
      signal?.removeEventListener('abort', abortFromCaller)
      if (activeAuthAttempt === attempt) {
        activeAuthController = undefined
        activeAuthCallerSignal = undefined
        activeAuthCallerAbort = undefined
      }
    }

    let authorization: Promise<GoogleDriveAccessToken>
    try {
      // Keep GIS request invocation in the click stack; moving it into a microtask loses popup activation.
      authorization = dependencies.requestAccessToken(config.clientId, controller.signal)
    } catch (error) {
      cleanup()
      return Promise.reject(error)
    }

    return authorization.then((credential) => {
      if (disposed || attempt !== activeAuthAttempt || controller.signal.aborted) throw new GoogleDriveCancelledError()
      if (credential.expiresAt && credential.expiresAt - Date.now() > TOKEN_EXPIRY_SAFETY_WINDOW_MS) {
        cachedToken = credential
        tokenAvailable.value = true
        const expiresAt = credential.expiresAt
        cacheExpiryTimer = setTimeout(() => clearCachedToken(), Math.max(0, expiresAt - Date.now() - TOKEN_EXPIRY_SAFETY_WINDOW_MS))
      }
      return credential.accessToken
    }).finally(cleanup)
  }

  function invalidateAccessToken(accessToken: string): void {
    if (cachedToken?.accessToken === accessToken) clearCachedToken()
  }

  /** Clears only this page's short-lived token; it does not revoke access or sign out of Google. */
  function forgetAccessToken(): void {
    activeAuthAttempt += 1
    activeAuthController?.abort()
    if (activeAuthCallerSignal && activeAuthCallerAbort) {
      activeAuthCallerSignal.removeEventListener('abort', activeAuthCallerAbort)
    }
    activeAuthController = undefined
    activeAuthCallerSignal = undefined
    activeAuthCallerAbort = undefined
    clearCachedToken()
  }

  function clearCachedToken(): void {
    cachedToken = undefined
    tokenAvailable.value = false
    if (cacheExpiryTimer !== undefined) clearTimeout(cacheExpiryTimer)
    cacheExpiryTimer = undefined
  }

  function isCurrent(attempt: number): boolean {
    return !disposed && attempt === loadAttempt
  }

  onMounted(() => { void retryLoading() })
  onScopeDispose(() => {
    disposed = true
    loadAttempt += 1
    forgetAccessToken()
  })

  return { status, message, ready, hasAccessToken, retryLoading, requestAccessToken, invalidateAccessToken, forgetAccessToken }
}
