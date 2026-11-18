import { expect, test } from './fixtures'
import { effectScope } from 'vue'
import {
  buildDropboxAuthorizationUrl,
  DropboxCancelledError,
  exchangeDropboxAuthorizationCode,
  publishDropboxOAuthCallback,
  startDropboxAuthorization,
} from '../utils/dropbox-auth'
import { readDropboxConfig } from '../utils/dropbox-config'
import { useDropboxSignIn } from '../composables/useDropboxSignIn'
import type { DropboxAuthorizationDependencies } from '../utils/dropbox-auth'

test('Dropbox authorization requests exactly the App Folder file scopes with PKCE S256 @pure', () => {
  const url = new URL(buildDropboxAuthorizationUrl({
    appKey: 'public-app-key',
    redirectUri: 'http://localhost:3051/dropbox/oauth/callback',
    state: 'state-value',
    codeChallenge: 'challenge-value',
  }))

  expect(url.origin + url.pathname).toBe('https://www.dropbox.com/oauth2/authorize')
  expect(url.searchParams.get('client_id')).toBe('public-app-key')
  expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3051/dropbox/oauth/callback')
  expect(url.searchParams.get('response_type')).toBe('code')
  expect(url.searchParams.get('code_challenge_method')).toBe('S256')
  expect(url.searchParams.get('code_challenge')).toBe('challenge-value')
  expect(url.searchParams.get('state')).toBe('state-value')
  expect(url.searchParams.get('token_access_type')).toBe('online')
  expect(url.searchParams.get('scope')).toBe('files.metadata.read files.content.read files.content.write')
  expect(url.searchParams.has('client_secret')).toBe(false)
})

test('Dropbox code exchange binds the PKCE verifier and captures short-lived account identity @pure', async () => {
  let requestUrl = ''
  let requestBody = ''
  const grant = await exchangeDropboxAuthorizationCode({
    appKey: 'public-app-key',
    code: 'authorization-code',
    codeVerifier: 'A'.repeat(43),
    redirectUri: 'http://localhost:3051/dropbox/oauth/callback',
    fetcher: async (input, init) => {
      requestUrl = String(input)
      requestBody = String(init?.body)
      return new Response(JSON.stringify({
        access_token: 'short-lived-token',
        token_type: 'bearer',
        expires_in: 14_400,
        account_id: 'dbid:account',
        scope: 'files.metadata.read files.content.read files.content.write',
      }), { headers: { 'Content-Type': 'application/json' } })
    },
  })

  const form = new URLSearchParams(requestBody)
  expect(requestUrl).toBe('https://api.dropboxapi.com/oauth2/token')
  expect(form.get('grant_type')).toBe('authorization_code')
  expect(form.get('code')).toBe('authorization-code')
  expect(form.get('client_id')).toBe('public-app-key')
  expect(form.get('redirect_uri')).toBe('http://localhost:3051/dropbox/oauth/callback')
  expect(form.get('code_verifier')).toBe('A'.repeat(43))
  expect(form.has('client_secret')).toBe(false)
  expect(grant).toMatchObject({ accessToken: 'short-lived-token', accountId: 'dbid:account' })
  expect(grant.expiresAt).toBeGreaterThan(Date.now())
})

test('Dropbox authorization requires the exact popup source and state and consumes one callback once @pure', async () => {
  const channels = new Map<string, FakeChannel>()
  let requestedUrl = ''
  let exchangedCodes: string[] = []
  const popup: FakePopup = {
    closed: false,
    location: { replace: (url: string) => { requestedUrl = url } },
    close: () => { popup.closed = true },
  }
  const dependencies = fakeAuthorizationDependencies({
    popup,
    channels,
    exchangeCode: async ({ code }) => {
      exchangedCodes = [...exchangedCodes, code]
      return { accessToken: 'short-lived-token', accountId: 'dbid:account', expiresAt: Date.now() + 60_000 }
    },
  })

  const pending = startDropboxAuthorization('public-app-key', undefined, dependencies)
  await waitFor(() => requestedUrl !== '')
  const channel = [...channels.values()][0]
  if (!channel) throw new Error('Expected the state-keyed callback channel.')
  const state = new URL(requestedUrl).searchParams.get('state') ?? ''
  const verifier = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
  expect(state).toHaveLength(43)
  expect(new URL(requestedUrl).searchParams.get('code_challenge_method')).toBe('S256')
  expect(new URL(requestedUrl).searchParams.get('code_challenge')).toBe(await expectedCodeChallenge(verifier))
  dependencies.dispatchWindowMessage({
    origin: 'http://localhost:3051',
    source: {} as MessageEventSource,
    data: { source: 'ttrpg-dropbox-oauth-callback', state, code: 'spoofed-code' },
  } as MessageEvent)
  channel.dispatch({ source: 'ttrpg-dropbox-oauth-callback', state: 'stale-state', code: 'stale-code' })
  expect(exchangedCodes).toEqual([])

  dependencies.dispatchWindowMessage({
    origin: 'http://localhost:3051',
    source: popup as unknown as MessageEventSource,
    data: { source: 'ttrpg-dropbox-oauth-callback', state, code: 'first-code' },
  } as MessageEvent)
  const grant = await pending
  channel.dispatch({ source: 'ttrpg-dropbox-oauth-callback', state, code: 'replayed-code' })

  expect(grant.accountId).toBe('dbid:account')
  expect(exchangedCodes).toEqual(['first-code'])
  expect(popup.closed).toBe(true)
  expect(channel.closed).toBe(true)
})

test('canceling Dropbox authorization closes the popup and releases its callback channel @pure', async () => {
  const channels = new Map<string, FakeChannel>()
  let requestedUrl = ''
  const popup: FakePopup = {
    closed: false,
    location: { replace: (url: string) => { requestedUrl = url } },
    close: () => { popup.closed = true },
  }
  const abort = new AbortController()
  const pending = startDropboxAuthorization('public-app-key', abort.signal, fakeAuthorizationDependencies({ popup, channels }))
  await waitFor(() => requestedUrl !== '')
  abort.abort()
  const error = await pending.catch(reason => reason)

  expect(error).toBeInstanceOf(DropboxCancelledError)
  expect(popup.closed).toBe(true)
  expect([...channels.values()][0]?.closed).toBe(true)
})

test('Dropbox authorization accepts a delayed callback after the popup reference is detached @pure', async () => {
  const channels = new Map<string, FakeChannel>()
  let requestedUrl = ''
  const popup: FakePopup = {
    closed: false,
    location: { replace: (url: string) => { requestedUrl = url } },
    close: () => { popup.closed = true },
  }
  const dependencies = fakeAuthorizationDependencies({ popup, channels })
  const pending = startDropboxAuthorization('public-app-key', undefined, dependencies)
  await waitFor(() => requestedUrl !== '')

  popup.closed = true
  dependencies.pulseIntervals(30)
  const state = new URL(requestedUrl).searchParams.get('state') ?? ''
  const channel = [...channels.values()][0]
  if (!channel) throw new Error('Expected the state-keyed callback channel.')
  channel.dispatch({ source: 'ttrpg-dropbox-oauth-callback', state, code: 'delayed-code' })

  await expect(pending).resolves.toMatchObject({ accountId: 'dbid:unused' })
  expect(channel.closed).toBe(true)
})

test('Dropbox callback removes credentials from history before notifying the opener @pure', () => {
  const oldDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'BroadcastChannel')
  const validState = 'B'.repeat(43)
  let channelName = ''
  let sentMessage: unknown
  let redacted = false
  let channelClosed = false
  const origin = 'http://localhost:3051'
  class CallbackChannel {
    constructor(name: string) { channelName = name }
    postMessage(message: unknown) {
      expect(redacted).toBe(true)
      sentMessage = message
    }
    close() { channelClosed = true }
  }
  Object.defineProperty(globalThis, 'BroadcastChannel', { configurable: true, value: CallbackChannel })
  try {
    publishDropboxOAuthCallback({
      location: { origin, search: `?code=temporary-code&state=${validState}` },
      history: { replaceState: () => { redacted = true } },
      opener: {
        closed: false,
        postMessage: (message: unknown, targetOrigin: string) => {
          expect(redacted).toBe(true)
          expect(targetOrigin).toBe(origin)
          sentMessage = message
        },
      },
    } as unknown as Pick<Window, 'location' | 'history' | 'opener'>)

    expect(channelName).toBe(`ttrpg-dropbox-oauth:${validState}`)
    expect(sentMessage).toEqual({ source: 'ttrpg-dropbox-oauth-callback', state: validState, code: 'temporary-code' })
    expect(channelClosed).toBe(true)
  } finally {
    if (oldDescriptor) Object.defineProperty(globalThis, 'BroadcastChannel', oldDescriptor)
    else Reflect.deleteProperty(globalThis, 'BroadcastChannel')
  }
})

test('Dropbox configuration reads the public app key and treats blank values as unavailable @pure', () => {
  expect(readDropboxConfig({ dropboxAppKey: ' public-key ' })).toEqual({ appKey: 'public-key' })
  expect(readDropboxConfig({ dropboxAppKey: ' ' })).toBeUndefined()
  expect(readDropboxConfig({ dropboxAppKey: 42 })).toBeUndefined()
})

test('the page sign-in owner caches only a live memory grant and forgetting it requires fresh consent @pure', async () => {
  const scope = effectScope()
  let authorizationCount = 0
  try {
    const controller = scope.run(() => useDropboxSignIn({ public: { dropboxAppKey: 'public-key' } }, {
      authorize: async () => {
        authorizationCount += 1
        return { accessToken: `token-${authorizationCount}`, accountId: 'dbid:account', expiresAt: Date.now() + 120_000 }
      },
    }))
    if (!controller) throw new Error('The Dropbox sign-in controller did not initialize.')

    const first = await controller.requestGrant()
    const cached = await controller.requestGrant()
    expect(controller.ready.value).toBe(true)
    expect(controller.hasAccessToken.value).toBe(true)
    expect(controller.accountId.value).toBe('dbid:account')
    expect(cached).toEqual(first)
    expect(authorizationCount).toBe(1)

    controller.forgetAccount()
    expect(controller.hasAccessToken.value).toBe(false)
    expect(controller.accountId.value).toBeNull()
    expect((await controller.requestGrant()).accessToken).toBe('token-2')
    expect(authorizationCount).toBe(2)
  } finally {
    scope.stop()
  }
})

function fakeAuthorizationDependencies(options: {
  popup: FakePopup
  channels: Map<string, FakeChannel>
  exchangeCode?: DropboxAuthorizationDependencies['exchangeCode']
}): DropboxAuthorizationDependencies & {
  dispatchWindowMessage(event: MessageEvent): void
  pulseIntervals(count: number): void
} {
  const listeners = new Set<(event: MessageEvent) => void>()
  const intervals = new Map<number, TimerHandler>()
  let nextIntervalId = 0
  const browser = {
    location: { origin: 'http://localhost:3051' },
    open: () => options.popup,
    addEventListener: (_type: 'message', listener: (event: MessageEvent) => void) => { listeners.add(listener) },
    removeEventListener: (_type: 'message', listener: (event: MessageEvent) => void) => { listeners.delete(listener) },
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
    setInterval: (handler: TimerHandler) => {
      const intervalId = ++nextIntervalId
      intervals.set(intervalId, handler)
      return intervalId
    },
    clearInterval: (intervalId: number) => { intervals.delete(intervalId) },
  }
  return {
    browser,
    dispatchWindowMessage: (event: MessageEvent) => { for (const listener of listeners) listener(event) },
    pulseIntervals: (count: number) => {
      for (let pulse = 0; pulse < count; pulse += 1) {
        for (const handler of intervals.values()) {
          if (typeof handler === 'function') handler()
        }
      }
    },
    createChannel: (name) => {
      const channel = new FakeChannel()
      options.channels.set(name, channel)
      return channel
    },
    randomValue: () => 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    createCodeChallenge: expectedCodeChallenge,
    exchangeCode: options.exchangeCode ?? (async () => ({
      accessToken: 'unused-token',
      accountId: 'dbid:unused',
      expiresAt: Date.now() + 60_000,
    })),
  }
}

class FakeChannel {
  closed = false
  private readonly listeners = new Set<(event: MessageEvent) => void>()

  addEventListener(_type: 'message', listener: (event: MessageEvent) => void): void {
    this.listeners.add(listener)
  }

  removeEventListener(_type: 'message', listener: (event: MessageEvent) => void): void {
    this.listeners.delete(listener)
  }

  close(): void {
    this.closed = true
  }

  dispatch(data: unknown): void {
    for (const listener of this.listeners) listener({ data } as MessageEvent)
  }
}

interface FakePopup {
  closed: boolean
  location: { replace(url: string): void }
  close(): void
}

async function waitFor(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 1000
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for the authorization window.')
    await new Promise(resolve => setTimeout(resolve, 0))
  }
}

async function expectedCodeChallenge(verifier: string): Promise<string> {
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))
  let binary = ''
  for (const byte of digest) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
}
