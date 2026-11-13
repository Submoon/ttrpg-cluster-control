const GOOGLE_IDENTITY_SCRIPT = 'https://accounts.google.com/gsi/client'
const GOOGLE_API_SCRIPT = 'https://apis.google.com/js/api.js'
const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
const GOOGLE_FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder'

export interface GoogleDrivePickerConfig {
  apiKey: string
  projectNumber: string
}

export interface GoogleDrivePickerItem {
  id: string
  name: string
  mimeType?: string
}

/** OAuth/picker cancellation is an expected user choice, not an operation failure. */
export class GoogleDriveCancelledError extends Error {
  constructor(message = 'Google Drive authorization or selection was canceled.') {
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

interface PickerDocument {
  id?: string
  name?: string
  mimeType?: string
}

interface PickerData {
  action?: string
  error?: string
  docs?: PickerDocument[]
}

interface PickerView {
  setIncludeFolders(value: boolean): PickerView
  setSelectFolderEnabled(value: boolean): PickerView
  setMimeTypes(value: string): PickerView
}

interface PickerInstance {
  setVisible(value: boolean): void
}

interface PickerBuilder {
  addView(view: PickerView): PickerBuilder
  setOAuthToken(token: string): PickerBuilder
  setDeveloperKey(key: string): PickerBuilder
  setAppId(projectNumber: string): PickerBuilder
  setCallback(callback: (data: PickerData) => void): PickerBuilder
  build(): PickerInstance
}

interface GooglePickerApi {
  DocsView: new (viewId: string) => PickerView
  PickerBuilder: new () => PickerBuilder
  ViewId: { FOLDERS: string, DOCS: string }
  Action: { PICKED: string, CANCEL: string, ERROR: string }
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
          error_callback?: (error: { type?: string, message?: string }) => void
        }): IdentityTokenClient
      }
    }
    picker?: GooglePickerApi
  }
  gapi?: {
    load(name: string, options: {
      callback: () => void
      onerror: () => void
      ontimeout: () => void
      timeout: number
    }): void
  }
}

let servicesLoading: Promise<void> | undefined

/** Loads Google Identity Services and Picker only when the Warden starts a cloud action. */
export function loadGoogleDriveServices(): Promise<void> {
  const browser = getBrowserWindow()
  if (hasGoogleDriveServices(browser)) return Promise.resolve()

  servicesLoading ??= Promise.all([
    loadScript('google-identity-services', GOOGLE_IDENTITY_SCRIPT),
    loadScript('google-api-client', GOOGLE_API_SCRIPT),
  ]).then(() => loadPickerApi(browser)).catch(error => {
    servicesLoading = undefined
    throw error
  })

  return servicesLoading
}

/** Returns synchronously so a caller can open Google's token popup from a real click. */
export function googleDriveServicesAreLoaded(): boolean {
  return typeof window !== 'undefined' && hasGoogleDriveServices(window as GoogleBrowserWindow)
}

/** Starts Google's short-lived `drive.file` token flow directly from the caller's user gesture. */
export function requestGoogleDriveAccessToken(clientId: string): Promise<string> {
  if (!clientId.trim()) return Promise.reject(new Error('Google Drive is not configured for this site.'))

  const browser = getBrowserWindow()
  const oauth2 = browser.google?.accounts?.oauth2
  if (!oauth2) return Promise.reject(new Error('Google sign-in has not finished loading. Try again.'))

  return new Promise((resolve, reject) => {
    let settled = false
    const timeout = browser.setTimeout(() => finishReject(new Error('Google Drive sign-in did not finish. Try again.')), 120_000)
    const finishResolve = (token: string) => {
      if (settled) return
      settled = true
      browser.clearTimeout(timeout)
      resolve(token)
    }
    const finishReject = (error: Error) => {
      if (settled) return
      settled = true
      browser.clearTimeout(timeout)
      reject(error)
    }

    try {
      const client = oauth2.initTokenClient({
        client_id: clientId,
        scope: DRIVE_FILE_SCOPE,
        include_granted_scopes: false,
        callback: response => {
          if (response.access_token
            && typeof response.scope === 'string'
            && response.scope.split(/\s+/).includes(DRIVE_FILE_SCOPE)) {
            finishResolve(response.access_token)
            return
          }
          if (response.error === 'access_denied' || response.error === 'popup_closed') {
            finishReject(new GoogleDriveCancelledError())
            return
          }
          finishReject(new Error('Google Drive authorization failed or did not grant the required access. Try again.'))
        },
        error_callback: error => {
          if (error.type === 'popup_closed' || error.type === 'user_closed') {
            finishReject(new GoogleDriveCancelledError())
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

/** Opens Google Picker for one writable private-folder choice. */
export async function pickGoogleDriveFolder(options: {
  accessToken: string
  config: GoogleDrivePickerConfig
}): Promise<GoogleDrivePickerItem | null> {
  const picker = await getPickerApi()
  const view = new picker.DocsView(picker.ViewId.FOLDERS)
    .setIncludeFolders(true)
    .setSelectFolderEnabled(true)
    .setMimeTypes(GOOGLE_FOLDER_MIME_TYPE)

  return openPicker(picker, options.accessToken, options.config, view)
}

/**
 * Opens a file view without a MIME filter, so hand-uploaded JSON files remain selectable.
 * Complete-map validation belongs to the restore admission workflow.
 */
export async function pickGoogleDriveBackupFile(options: {
  accessToken: string
  config: GoogleDrivePickerConfig
}): Promise<GoogleDrivePickerItem | null> {
  const picker = await getPickerApi()
  const view = new picker.DocsView(picker.ViewId.DOCS).setIncludeFolders(false)
  return openPicker(picker, options.accessToken, options.config, view)
}

async function getPickerApi(): Promise<GooglePickerApi> {
  await loadGoogleDriveServices()
  const picker = getBrowserWindow().google?.picker
  if (!picker) throw new Error('Google Drive Picker could not be loaded. Try again.')
  return picker
}

function openPicker(
  picker: GooglePickerApi,
  accessToken: string,
  config: GoogleDrivePickerConfig,
  view: PickerView,
): Promise<GoogleDrivePickerItem | null> {
  if (!config.apiKey.trim() || !config.projectNumber.trim()) {
    return Promise.reject(new Error('Google Drive Picker is not configured for this site.'))
  }

  return new Promise((resolve, reject) => {
    const instance = new picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(accessToken)
      .setDeveloperKey(config.apiKey)
      .setAppId(config.projectNumber)
      .setCallback(data => {
        if (data.action === picker.Action.CANCEL) {
          resolve(null)
          return
        }
        if (data.action === picker.Action.ERROR) {
          reject(new Error('Google Drive Picker failed. Check its configuration and try again.'))
          return
        }
        if (data.action !== picker.Action.PICKED) return
        const item = data.docs?.[0]
        if (!item || typeof item.id !== 'string' || typeof item.name !== 'string') {
          reject(new Error('Google Drive did not return a valid selection.'))
          return
        }
        resolve({
          id: item.id,
          name: item.name,
          ...(typeof item.mimeType === 'string' ? { mimeType: item.mimeType } : {}),
        })
      })
      .build()

    try {
      instance.setVisible(true)
    } catch {
      reject(new Error('Google Drive Picker could not be opened. Try again.'))
    }
  })
}

function loadPickerApi(browser: GoogleBrowserWindow): Promise<void> {
  if (browser.google?.picker) return Promise.resolve()
  const gapi = browser.gapi
  if (!gapi) return Promise.reject(new Error('Google Drive Picker could not be loaded. Try again.'))

  return new Promise((resolve, reject) => {
    gapi.load('picker', {
      callback: () => browser.google?.picker ? resolve() : reject(new Error('Google Drive Picker could not be loaded. Try again.')),
      onerror: () => reject(new Error('Google Drive Picker could not be loaded. Try again.')),
      ontimeout: () => reject(new Error('Google Drive Picker took too long to load. Try again.')),
      timeout: 15_000,
    })
  })
}

function loadScript(id: string, source: string): Promise<void> {
  if (typeof document === 'undefined') return Promise.reject(new Error('Google Drive is only available in a browser.'))
  const existing = document.getElementById(id) as HTMLScriptElement | null
  if (existing?.dataset.loaded === 'true') return Promise.resolve()

  return new Promise((resolve, reject) => {
    const script = existing ?? document.createElement('script')
    const timeout = window.setTimeout(() => {
      script.remove()
      reject(new Error('Google Drive services took too long to load. Check your connection and try again.'))
    }, 15_000)
    script.id = id
    script.src = source
    script.async = true
    script.onload = () => {
      window.clearTimeout(timeout)
      script.dataset.loaded = 'true'
      resolve()
    }
    script.onerror = () => {
      window.clearTimeout(timeout)
      script.remove()
      reject(new Error('Google Drive services could not be loaded. Check your connection and try again.'))
    }
    if (!existing) document.head.append(script)
  })
}

function hasGoogleDriveServices(browser: GoogleBrowserWindow): boolean {
  return Boolean(browser.google?.accounts?.oauth2 && browser.google?.picker)
}

function getBrowserWindow(): GoogleBrowserWindow {
  if (typeof window === 'undefined') throw new Error('Google Drive is only available in a browser.')
  return window as GoogleBrowserWindow
}
