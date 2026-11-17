/** Browser OAuth authorization-code flow for one configured Dropbox App Folder app. */

import type { DropboxFetcher } from './dropbox-api'

export const DROPBOX_REDIRECT_PATH = '/dropbox/oauth/callback'
export const DROPBOX_AUTHORIZATION_SCOPES = 'files.metadata.read files.content.read files.content.write'

const DROPBOX_AUTHORIZE_URL = 'https://www.dropbox.com/oauth2/authorize'
const DROPBOX_TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token'
const CALLBACK_CHANNEL_PREFIX = 'ttrpg-dropbox-oauth:'
const AUTHORIZATION_TIMEOUT_MS = 120_000
const POPUP_CLOSED_GRACE_POLLS = 30
const POPUP_POLL_INTERVAL_MS = 500
const TOKEN_TIMEOUT_MS = 20_000

/** OAuth cancellation is an expected user choice, not a failed backup or restore. */
export class DropboxCancelledError extends Error {
  constructor(message = 'Dropbox authorization was canceled.') {
    super(message)
    this.name = 'DropboxCancelledError'
  }
}

/** A short-lived grant retained only in the current page's JavaScript memory. */
export interface DropboxGrant {
  accessToken: string
  accountId: string
  expiresAt: number
}

export interface DropboxCodeExchangeRequest {
  appKey: string
  code: string
  codeVerifier: string
  redirectUri: string
}

interface DropboxCallbackMessage {
  source: 'ttrpg-dropbox-oauth-callback'
  state: string
  code?: string
  error?: string
}

export interface DropboxPopupWindow {
  closed: boolean
  location: { replace(url: string): void }
  close(): void
}

export interface DropboxCallbackChannel {
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void
  removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void
  close(): void
}

export interface DropboxOAuthWindow {
  location: { origin: string }
  open(url: string, target: string, features: string): DropboxPopupWindow | null
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void
  removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void
  setTimeout(handler: TimerHandler, timeout?: number): number
  clearTimeout(timeoutId: number): void
  setInterval(handler: TimerHandler, timeout?: number): number
  clearInterval(intervalId: number): void
}

export interface DropboxAuthorizationDependencies {
  browser: DropboxOAuthWindow
  createChannel(name: string): DropboxCallbackChannel
  randomValue(): string
  createCodeChallenge(codeVerifier: string): Promise<string>
  exchangeCode(request: DropboxCodeExchangeRequest, signal: AbortSignal): Promise<DropboxGrant>
}

const defaultDependencies: Omit<DropboxAuthorizationDependencies, 'browser'> = {
  createChannel: name => new BroadcastChannel(name),
  randomValue: createRandomOAuthValue,
  createCodeChallenge,
  exchangeCode: (request, signal) => exchangeDropboxAuthorizationCode({ ...request, signal }),
}

/** Builds the exact Dropbox consent URL; the PKCE verifier never leaves this page. */
export function buildDropboxAuthorizationUrl(input: {
  appKey: string
  redirectUri: string
  state: string
  codeChallenge: string
}): string {
  const url = new URL(DROPBOX_AUTHORIZE_URL)
  url.searchParams.set('client_id', input.appKey)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('redirect_uri', input.redirectUri)
  url.searchParams.set('code_challenge', input.codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('state', input.state)
  url.searchParams.set('token_access_type', 'online')
  url.searchParams.set('scope', DROPBOX_AUTHORIZATION_SCOPES)
  return url.toString()
}

/**
 * Opens the popup synchronously in the caller's click stack, then completes PKCE and callback
 * handling without relying on window.opener surviving Dropbox's cross-origin navigation.
 */
export function startDropboxAuthorization(
  appKey: string,
  signal?: AbortSignal,
  dependencies: Partial<DropboxAuthorizationDependencies> = {},
): Promise<DropboxGrant> {
  const trimmedAppKey = appKey.trim()
  if (!trimmedAppKey) return Promise.reject(new Error('Dropbox is not configured for this site.'))
  if (signal?.aborted) return Promise.reject(canceledError())

  const browser = dependencies.browser ?? getBrowserWindow()
  const services = { ...defaultDependencies, ...dependencies, browser }
  const state = services.randomValue()
  const codeVerifier = services.randomValue()
  if (!isOAuthValue(state) || !isOAuthValue(codeVerifier)) {
    return Promise.reject(new Error('Dropbox authorization could not create a secure request.'))
  }

  const redirectUri = `${browser.location.origin}${DROPBOX_REDIRECT_PATH}`
  const channelName = `${CALLBACK_CHANNEL_PREFIX}${state}`
  let popup: DropboxPopupWindow | null
  try {
    popup = browser.open('about:blank', `dropbox-${state}`, 'popup,width=520,height=720')
  } catch {
    return Promise.reject(new Error('Dropbox could not open its authorization window.'))
  }
  if (!popup) return Promise.reject(new Error('Dropbox could not open its authorization window. Allow popups and try again.'))

  let channel: DropboxCallbackChannel
  try {
    channel = services.createChannel(channelName)
  } catch {
    popup.close()
    return Promise.reject(new Error('Dropbox could not prepare a secure authorization callback.'))
  }

  return new Promise((resolve, reject) => {
    const operation = new AbortController()
    let settled = false
    let exchanging = false
    let popupClosedPolls = 0
    let popupPoll: number | undefined

    const cleanup = (closePopup: boolean) => {
      browser.clearTimeout(timeout)
      if (popupPoll !== undefined) browser.clearInterval(popupPoll)
      signal?.removeEventListener('abort', onAbort)
      channel.removeEventListener('message', onChannelMessage)
      browser.removeEventListener('message', onWindowMessage)
      channel.close()
      if (closePopup && !popup.closed) popup.close()
    }
    const finishReject = (error: Error) => {
      if (settled) return
      settled = true
      operation.abort()
      cleanup(true)
      reject(error)
    }
    const finishResolve = (grant: DropboxGrant) => {
      if (settled) return
      settled = true
      cleanup(true)
      resolve(grant)
    }
    const onAbort = () => finishReject(canceledError())
    const onWindowMessage = (event: MessageEvent) => {
      if (event.origin !== browser.location.origin || event.source !== popup) return
      consumeCallback(event.data)
    }
    const onChannelMessage = (event: MessageEvent) => consumeCallback(event.data)
    const consumeCallback = (value: unknown) => {
      if (settled || exchanging || !isCallbackMessage(value) || value.state !== state) return
      if (value.error) {
        if (value.error === 'access_denied' || value.error === 'user_cancelled') finishReject(canceledError())
        else finishReject(new Error('Dropbox authorization failed. Try again.'))
        return
      }
      if (!value.code || value.code.length > 8192) {
        finishReject(new Error('Dropbox returned an invalid authorization callback.'))
        return
      }

      exchanging = true
      if (popupPoll !== undefined) browser.clearInterval(popupPoll)
      popupPoll = undefined
      void services.exchangeCode({ appKey: trimmedAppKey, code: value.code, codeVerifier, redirectUri }, operation.signal)
        .then(grant => finishResolve(grant))
        .catch(error => finishReject(error instanceof Error ? error : new Error('Dropbox authorization failed. Try again.')))
    }

    const timeout = browser.setTimeout(() => finishReject(new Error('Dropbox authorization did not finish. Try again.')), AUTHORIZATION_TIMEOUT_MS)
    signal?.addEventListener('abort', onAbort, { once: true })
    channel.addEventListener('message', onChannelMessage)
    browser.addEventListener('message', onWindowMessage)
    popupPoll = browser.setInterval(() => {
      if (exchanging || !popup.closed) {
        popupClosedPolls = 0
        return
      }
      popupClosedPolls += 1
      // COOP may sever the popup reference before its callback posts on the fallback channel.
      if (popupClosedPolls >= POPUP_CLOSED_GRACE_POLLS) finishReject(canceledError())
    }, POPUP_POLL_INTERVAL_MS)
    if (signal?.aborted) {
      onAbort()
      return
    }

    void services.createCodeChallenge(codeVerifier).then((codeChallenge) => {
      if (settled) return
      const authorizationUrl = buildDropboxAuthorizationUrl({
        appKey: trimmedAppKey,
        redirectUri,
        state,
        codeChallenge,
      })
      popup.location.replace(authorizationUrl)
    }).catch(() => finishReject(new Error('Dropbox could not prepare secure authorization. Try again.')))
  })
}

/** Exchanges a PKCE authorization code for a short-lived online grant without a client secret. */
export async function exchangeDropboxAuthorizationCode(options: DropboxCodeExchangeRequest & {
  fetcher?: DropboxFetcher
  signal?: AbortSignal
}): Promise<DropboxGrant> {
  if (!options.appKey.trim() || !options.code || !isOAuthValue(options.codeVerifier)) {
    throw new Error('Dropbox returned an invalid authorization response.')
  }
  if (options.signal?.aborted) throw canceledError()

  const controller = new AbortController()
  const onAbort = () => controller.abort()
  options.signal?.addEventListener('abort', onAbort, { once: true })
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort()
        reject(new Error('Dropbox token exchange timed out.'))
      }, TOKEN_TIMEOUT_MS)
    })
    const fetchRequest = (options.fetcher ?? fetch)(DROPBOX_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: options.code,
        client_id: options.appKey,
        redirect_uri: options.redirectUri,
        code_verifier: options.codeVerifier,
      }),
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) throw new Error('Dropbox could not finish authorization. Check the app key and callback URL, then try again.')
      const body: unknown = await response.json()
      return readDropboxGrant(body)
    })
    return await Promise.race([fetchRequest, timeout])
  } catch (error) {
    if (options.signal?.aborted) throw canceledError()
    const message = error instanceof Error && error.message ? error.message : 'Dropbox authorization failed. Try again.'
    throw new Error(message, { cause: error })
  } finally {
    if (timer !== undefined) clearTimeout(timer)
    options.signal?.removeEventListener('abort', onAbort)
  }
}

/** Immediately removes callback credentials from the address bar, then notifies its state-keyed opener channel. */
export function publishDropboxOAuthCallback(browser: Pick<Window, 'location' | 'history' | 'opener'> = window): void {
  const query = new URLSearchParams(browser.location.search)
  const state = query.get('state') ?? ''
  const code = query.get('code') ?? undefined
  const error = query.get('error') ?? undefined
  browser.history.replaceState(null, '', DROPBOX_REDIRECT_PATH)
  if (!isOAuthState(state) || (!code && !error)) return

  const message: DropboxCallbackMessage = {
    source: 'ttrpg-dropbox-oauth-callback',
    state,
    ...(code ? { code } : {}),
    ...(error ? { error } : {}),
  }
  const origin = browser.location.origin
  if (browser.opener && !browser.opener.closed) {
    browser.opener.postMessage(message, origin)
  }
  const channel = new BroadcastChannel(`${CALLBACK_CHANNEL_PREFIX}${state}`)
  channel.postMessage(message)
  channel.close()
}

async function createCodeChallenge(codeVerifier: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier))
  return base64Url(new Uint8Array(digest))
}

function createRandomOAuthValue(): string {
  if (!globalThis.crypto?.getRandomValues) throw new Error('A secure browser context is required for Dropbox authorization.')
  const bytes = new Uint8Array(32)
  globalThis.crypto.getRandomValues(bytes)
  return base64Url(bytes)
}

function base64Url(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  let encoded = ''
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0
    const second = bytes[index + 1]
    const third = bytes[index + 2]
    encoded += alphabet[first >> 2]
    encoded += alphabet[((first & 3) << 4) | ((second ?? 0) >> 4)]
    if (second !== undefined) encoded += alphabet[((second & 15) << 2) | ((third ?? 0) >> 6)]
    if (third !== undefined) encoded += alphabet[third & 63]
  }
  return encoded
}

function readDropboxGrant(value: unknown): DropboxGrant {
  if (!isRecord(value)
    || typeof value.access_token !== 'string'
    || value.access_token.length === 0
    || typeof value.account_id !== 'string'
    || value.account_id.length === 0
    || typeof value.expires_in !== 'number'
    || !Number.isFinite(value.expires_in)
    || value.expires_in <= 0
    || typeof value.scope !== 'string'
    || typeof value.token_type !== 'string'
    || value.token_type.toLocaleLowerCase() !== 'bearer') {
    throw new Error('Dropbox did not return a valid short-lived account grant.')
  }
  const grantedScopes = new Set(value.scope.split(/\s+/u).filter(Boolean))
  if (!DROPBOX_AUTHORIZATION_SCOPES.split(' ').every(scope => grantedScopes.has(scope))) {
    throw new Error('Dropbox did not grant all required App Folder file permissions.')
  }
  return {
    accessToken: value.access_token,
    accountId: value.account_id,
    expiresAt: Date.now() + value.expires_in * 1000,
  }
}

function isCallbackMessage(value: unknown): value is DropboxCallbackMessage {
  if (!isRecord(value)
    || value.source !== 'ttrpg-dropbox-oauth-callback'
    || !isOAuthState(value.state)) return false
  if (value.code !== undefined && (typeof value.code !== 'string' || value.code.length === 0)) return false
  if (value.error !== undefined && (typeof value.error !== 'string' || value.error.length === 0)) return false
  return Boolean(value.code || value.error)
}

function isOAuthValue(value: string): boolean {
  return /^[A-Za-z0-9_-]{43,128}$/u.test(value)
}

function isOAuthState(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/u.test(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getBrowserWindow(): DropboxOAuthWindow {
  if (typeof window === 'undefined') throw new Error('Dropbox is only available in a browser.')
  return window as unknown as DropboxOAuthWindow
}

function canceledError(): DropboxCancelledError {
  return new DropboxCancelledError('Dropbox authorization was canceled. You can try again.')
}
