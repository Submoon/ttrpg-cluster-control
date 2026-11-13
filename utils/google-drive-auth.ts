const GOOGLE_IDENTITY_SCRIPT = 'https://accounts.google.com/gsi/client'
const DRIVE_APP_DATA_SCOPE = 'https://www.googleapis.com/auth/drive.appdata'
const SCRIPT_DEADLINE_MS = 15_000
const AUTH_DEADLINE_MS = 120_000

/** OAuth cancellation is an expected user choice, not an operation failure. */
export class GoogleDriveCancelledError extends Error {
  constructor(message = 'Google Drive authorization was canceled.') {
    super(message)
    this.name = 'GoogleDriveCancelledError'
  }
}

interface IdentityTokenResponse {
  access_token?: string
  scope?: string
  error?: string
}

interface IdentityTokenClient {
  requestAccessToken(): void
}

interface GoogleBrowserWindow extends Window {
  google?: {
    accounts?: {
      oauth2?: {
        initTokenClient(options: {
          client_id: string
          scope: string
          include_granted_scopes: false
          callback: (response: IdentityTokenResponse) => void
          error_callback?: (error: { type?: string }) => void
        }): IdentityTokenClient
      }
    }
  }
}

let servicesLoading: Promise<void> | undefined

/** Warms Google Identity Services only; it never requests user access or opens an OAuth popup. */
export function loadGoogleDriveServices(): Promise<void> {
  const browser = getBrowserWindow()
  if (hasGoogleDriveServices(browser)) return Promise.resolve()

  servicesLoading ??= loadIdentityScript().then(() => {
    if (!hasGoogleDriveServices(browser)) {
      throw new Error('Google Drive sign-in could not be loaded. Check your connection and try again.')
    }
  }).catch(error => {
    servicesLoading = undefined
    throw error
  })

  return servicesLoading
}

/** Starts Google's short-lived app-data token flow directly from a user gesture. */
export function requestGoogleDriveAccessToken(clientId: string, signal?: AbortSignal): Promise<string> {
  if (!clientId.trim()) return Promise.reject(new Error('Google Drive is not configured for this site.'))
  if (signal?.aborted) return Promise.reject(canceledError())

  const browser = getBrowserWindow()
  const oauth2 = browser.google?.accounts?.oauth2
  if (!oauth2) return Promise.reject(new Error('Google sign-in has not finished loading. Try again.'))

  return new Promise((resolve, reject) => {
    let settled = false
    const timeout = browser.setTimeout(() => finishReject(new Error('Google Drive sign-in did not finish. Try again.')), AUTH_DEADLINE_MS)
    const cleanup = () => {
      browser.clearTimeout(timeout)
      signal?.removeEventListener('abort', onAbort)
    }
    const finishResolve = (token: string) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(token)
    }
    const finishReject = (error: Error) => {
      if (settled) return
      settled = true
      cleanup()
      reject(error)
    }
    const onAbort = () => finishReject(canceledError())

    signal?.addEventListener('abort', onAbort, { once: true })
    if (signal?.aborted) {
      onAbort()
      return
    }

    try {
      const client = oauth2.initTokenClient({
        client_id: clientId,
        scope: DRIVE_APP_DATA_SCOPE,
        include_granted_scopes: false,
        callback: response => {
          if (settled) return
          if (response.access_token
            && typeof response.scope === 'string'
            && response.scope.split(/\s+/).includes(DRIVE_APP_DATA_SCOPE)) {
            finishResolve(response.access_token)
            return
          }
          if (response.error === 'access_denied' || response.error === 'popup_closed') {
            finishReject(canceledError())
            return
          }
          finishReject(new Error('Google Drive authorization failed or did not grant the required access. Try again.'))
        },
        error_callback: error => {
          if (settled) return
          if (error.type === 'popup_closed' || error.type === 'user_closed') {
            finishReject(canceledError())
            return
          }
          finishReject(new Error('Google Drive could not open its sign-in window. Try again.'))
        },
      })
      client.requestAccessToken()
    } catch {
      finishReject(new Error('Google Drive could not open its sign-in window. Try again.'))
    }
  })
}

function loadIdentityScript(): Promise<void> {
  if (typeof document === 'undefined') return Promise.reject(new Error('Google Drive is only available in a browser.'))
  const existing = document.getElementById('google-identity-services') as HTMLScriptElement | null
  if (existing?.dataset.loaded === 'true') return Promise.resolve()

  return new Promise((resolve, reject) => {
    const script = existing ?? document.createElement('script')
    let settled = false
    const timeout = window.setTimeout(() => finishReject(), SCRIPT_DEADLINE_MS)
    const cleanup = () => {
      window.clearTimeout(timeout)
      script.removeEventListener('load', onLoad)
      script.removeEventListener('error', onError)
    }
    const finishReject = () => {
      if (settled) return
      settled = true
      cleanup()
      script.remove()
      reject(new Error('Google Drive sign-in could not be loaded. Check your connection and try again.'))
    }
    const onLoad = () => {
      if (!hasGoogleDriveServices(window as GoogleBrowserWindow)) {
        finishReject()
        return
      }
      if (settled) return
      settled = true
      script.dataset.loaded = 'true'
      cleanup()
      resolve()
    }
    const onError = () => finishReject()

    if (existing?.src === GOOGLE_IDENTITY_SCRIPT && existing.dataset.loaded === 'true') {
      window.clearTimeout(timeout)
      resolve()
      return
    }
    script.id = 'google-identity-services'
    script.src = GOOGLE_IDENTITY_SCRIPT
    script.async = true
    script.addEventListener('load', onLoad, { once: true })
    script.addEventListener('error', onError, { once: true })
    if (!existing) document.head.append(script)
  })
}

function hasGoogleDriveServices(browser: GoogleBrowserWindow): boolean {
  return Boolean(browser.google?.accounts?.oauth2)
}

function getBrowserWindow(): GoogleBrowserWindow {
  if (typeof window === 'undefined') throw new Error('Google Drive is only available in a browser.')
  return window as GoogleBrowserWindow
}

function canceledError(): GoogleDriveCancelledError {
  return new GoogleDriveCancelledError('Google Drive authorization was canceled. You can try again.')
}
