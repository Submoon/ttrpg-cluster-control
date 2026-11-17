import { computed, onScopeDispose, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { DropboxCancelledError, startDropboxAuthorization } from '../utils/dropbox-auth'
import type { DropboxGrant } from '../utils/dropbox-auth'
import { readDropboxConfig } from '../utils/dropbox-config'

export type DropboxSignInStatus = 'ready' | 'unavailable' | 'authorizing' | 'error'

interface DropboxRuntimeConfig {
  public: { dropboxAppKey?: unknown }
}

export interface DropboxSignInDependencies {
  authorize(appKey: string, signal?: AbortSignal): Promise<DropboxGrant>
}

export interface DropboxSignInController {
  readonly status: Readonly<Ref<DropboxSignInStatus>>
  readonly message: Readonly<Ref<string>>
  readonly ready: ComputedRef<boolean>
  readonly hasAccessToken: ComputedRef<boolean>
  readonly accountId: ComputedRef<string | null>
  requestGrant(signal?: AbortSignal): Promise<DropboxGrant>
  invalidateAccessToken(accessToken: string): void
  forgetAccount(): void
}

const defaultDependencies: DropboxSignInDependencies = {
  authorize: (appKey, signal) => startDropboxAuthorization(appKey, signal),
}

const TOKEN_EXPIRY_SAFETY_WINDOW_MS = 30_000

/** Keeps one short-lived Dropbox grant in page memory for backup and restore operations. */
export function useDropboxSignIn(
  runtimeConfig: DropboxRuntimeConfig = useRuntimeConfig(),
  dependencies: DropboxSignInDependencies = defaultDependencies,
): DropboxSignInController {
  const config = readDropboxConfig(runtimeConfig.public)
  const status = ref<DropboxSignInStatus>(config ? 'ready' : 'unavailable')
  const message = ref(config ? '' : 'Dropbox is not configured for this site.')
  const ready = computed(() => Boolean(config) && !disposed)
  const grantState = ref<DropboxGrant>()
  const hasAccessToken = computed(() => Boolean(grantState.value && grantState.value.expiresAt - Date.now() > TOKEN_EXPIRY_SAFETY_WINDOW_MS))
  const accountId = computed(() => hasAccessToken.value ? grantState.value?.accountId ?? null : null)
  let disposed = false
  let authAttempt = 0
  let activeController: AbortController | undefined
  let callerSignal: AbortSignal | undefined
  let callerAbort: (() => void) | undefined
  let expiryTimer: ReturnType<typeof setTimeout> | undefined

  function requestGrant(signal?: AbortSignal): Promise<DropboxGrant> {
    if (!config) {
      status.value = 'unavailable'
      message.value = 'Dropbox is not configured for this site.'
      return Promise.reject(new Error(message.value))
    }
    if (disposed || signal?.aborted) return Promise.reject(new DropboxCancelledError())
    if (hasAccessToken.value && grantState.value) return Promise.resolve(grantState.value)
    clearGrant()
    if (activeController) {
      return Promise.reject(new Error('A Dropbox authorization is already in progress. Finish or close it before starting another Dropbox action.'))
    }

    const controller = new AbortController()
    const attempt = ++authAttempt
    const abortFromCaller = () => controller.abort()
    activeController = controller
    callerSignal = signal
    callerAbort = abortFromCaller
    signal?.addEventListener('abort', abortFromCaller, { once: true })
    status.value = 'authorizing'
    message.value = ''
    if (signal?.aborted) abortFromCaller()

    const cleanup = () => {
      signal?.removeEventListener('abort', abortFromCaller)
      if (authAttempt === attempt) {
        activeController = undefined
        callerSignal = undefined
        callerAbort = undefined
      }
    }
    let authorization: Promise<DropboxGrant>
    try {
      // Keep popup creation in the caller's gesture stack.
      authorization = dependencies.authorize(config.appKey, controller.signal)
    } catch (error) {
      cleanup()
      status.value = 'ready'
      return Promise.reject(error)
    }

    return authorization.then((grant) => {
      if (disposed || attempt !== authAttempt || controller.signal.aborted) throw new DropboxCancelledError()
      if (!grant.accessToken || !grant.accountId || !Number.isFinite(grant.expiresAt)
        || grant.expiresAt - Date.now() <= TOKEN_EXPIRY_SAFETY_WINDOW_MS) {
        throw new Error('Dropbox returned a grant that is already expired or missing its account identity.')
      }
      grantState.value = grant
      status.value = 'ready'
      message.value = ''
      expiryTimer = setTimeout(() => clearGrant(), Math.max(0, grant.expiresAt - Date.now() - TOKEN_EXPIRY_SAFETY_WINDOW_MS))
      return grant
    }).catch((error: unknown) => {
      if (attempt === authAttempt && !disposed) {
        status.value = 'ready'
        message.value = error instanceof DropboxCancelledError
          ? ''
          : error instanceof Error && error.message
            ? error.message
            : 'Dropbox authorization failed. Try again.'
      }
      throw error
    }).finally(cleanup)
  }

  function invalidateAccessToken(accessToken: string): void {
    if (grantState.value?.accessToken !== accessToken) return
    clearGrant()
    message.value = 'Dropbox authorization expired. Authorize again to continue.'
  }

  /** Clears this page's short-lived grant; Dropbox authorization itself remains under account settings. */
  function forgetAccount(): void {
    authAttempt += 1
    activeController?.abort()
    if (callerSignal && callerAbort) callerSignal.removeEventListener('abort', callerAbort)
    activeController = undefined
    callerSignal = undefined
    callerAbort = undefined
    clearGrant()
    message.value = ''
    status.value = config ? 'ready' : 'unavailable'
  }

  function clearGrant(): void {
    grantState.value = undefined
    if (expiryTimer !== undefined) clearTimeout(expiryTimer)
    expiryTimer = undefined
  }

  onScopeDispose(() => {
    disposed = true
    authAttempt += 1
    activeController?.abort()
    if (callerSignal && callerAbort) callerSignal.removeEventListener('abort', callerAbort)
    activeController = undefined
    callerSignal = undefined
    callerAbort = undefined
    clearGrant()
  })

  return { status, message, ready, hasAccessToken, accountId, requestGrant, invalidateAccessToken, forgetAccount }
}
