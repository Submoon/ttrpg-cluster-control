import { createRenderer } from 'vue'
import type { GoogleDriveSignInController } from '../composables/useGoogleDriveSignIn'
import { useGoogleDriveSignIn } from '../composables/useGoogleDriveSignIn'
import type { GoogleDriveAccessToken } from '../utils/google-drive-auth'
import { GoogleDriveCancelledError } from '../utils/google-drive-auth'
import { expect, test } from './fixtures'

interface TestNode {
  kind: string
  text?: string
  children: TestNode[]
  parent?: TestNode
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((complete) => { resolve = complete })
  return { promise, resolve }
}

function mountSignIn(dependencies: {
  loadServices(): Promise<void>
  requestAccessToken(clientId: string, signal?: AbortSignal): Promise<GoogleDriveAccessToken>
}, configured = true): { controller: GoogleDriveSignInController, unmount(): void } {
  let controller: GoogleDriveSignInController | undefined
  const renderer = createRenderer<TestNode, TestNode>({
    patchProp: () => undefined,
    insert(child, parent, anchor) {
      child.parent = parent
      const index = anchor ? parent.children.indexOf(anchor) : -1
      if (index < 0) parent.children.push(child)
      else parent.children.splice(index, 0, child)
    },
    remove(child) {
      const index = child.parent?.children.indexOf(child) ?? -1
      if (index >= 0) child.parent?.children.splice(index, 1)
      child.parent = undefined
    },
    createElement(kind) { return { kind, children: [] } },
    createText(text) { return { kind: '#text', text, children: [] } },
    createComment(text) { return { kind: '#comment', text, children: [] } },
    setText(node, text) { node.text = text },
    setElementText(node, text) { node.text = text; node.children = [] },
    parentNode(node) { return node.parent ?? null },
    nextSibling(node) {
      const siblings = node.parent?.children
      const index = siblings?.indexOf(node) ?? -1
      return index < 0 ? null : siblings?.[index + 1] ?? null
    },
  })
  const app = renderer.createApp({
    setup() {
      controller = useGoogleDriveSignIn({ public: { googleDriveClientId: configured ? 'client-id' : '' } }, dependencies)
      return () => null
    },
  })
  app.mount({ kind: 'root', children: [] })
  if (!controller) throw new Error('Google Drive sign-in did not initialize.')
  return { controller, unmount: () => app.unmount() }
}

test('mount warms Google services without requesting a token, and the first explicit action can request one @pure', async () => {
  const services = deferred<void>()
  let loadCount = 0
  let tokenCount = 0
  const mounted = mountSignIn({
    loadServices: () => { loadCount += 1; return services.promise },
    requestAccessToken: async clientId => {
      tokenCount += 1
      expect(clientId).toBe('client-id')
      return { accessToken: 'short-lived-token', expiresAt: Date.now() + 60_000 }
    },
  })

  try {
    const warmup = mounted.controller.retryLoading()
    expect(mounted.controller.status.value).toBe('warming')
    await Promise.resolve()
    expect(loadCount).toBe(1)
    expect(tokenCount).toBe(0)
    services.resolve()
    await warmup
    expect(mounted.controller.ready.value).toBe(true)
    expect(tokenCount).toBe(0)

    await expect(mounted.controller.requestAccessToken()).resolves.toBe('short-lived-token')
    expect(tokenCount).toBe(1)
    expect(mounted.controller.hasAccessToken.value).toBe(true)
    await expect(mounted.controller.requestAccessToken()).resolves.toBe('short-lived-token')
    expect(tokenCount).toBe(1)
  } finally {
    mounted.unmount()
  }
})

test('a failed Google service warmup exposes retry and succeeds without authorizing @pure', async () => {
  let loadCount = 0
  let tokenCount = 0
  const mounted = mountSignIn({
    loadServices: () => {
      loadCount += 1
      return loadCount === 1 ? Promise.reject(new Error('Google script failed.')) : Promise.resolve()
    },
    requestAccessToken: async () => { tokenCount += 1; return { accessToken: 'token', expiresAt: Date.now() + 60_000 } },
  })

  try {
    await mounted.controller.retryLoading()
    expect(mounted.controller.status.value).toBe('error')
    expect(mounted.controller.message.value).toBe('Google script failed.')
    expect(tokenCount).toBe(0)

    await mounted.controller.retryLoading()
    expect(mounted.controller.status.value).toBe('ready')
    expect(tokenCount).toBe(0)
  } finally {
    mounted.unmount()
  }
})

test('an unconfigured page does not load Google services or request a token @pure', async () => {
  let loadCount = 0
  let tokenCount = 0
  const mounted = mountSignIn({
    loadServices: async () => { loadCount += 1 },
    requestAccessToken: async () => { tokenCount += 1; return { accessToken: 'token', expiresAt: Date.now() + 60_000 } },
  }, false)

  try {
    await mounted.controller.retryLoading()
    expect(mounted.controller.status.value).toBe('unavailable')
    expect(mounted.controller.ready.value).toBe(false)
    expect(loadCount).toBe(0)
    await expect(mounted.controller.requestAccessToken()).rejects.toThrow(/not configured/i)
    expect(tokenCount).toBe(0)
  } finally {
    mounted.unmount()
  }
})

test('cached tokens expire early and a later explicit click requests a fresh token @pure', async () => {
  let now = 1_000_000
  const originalNow = Date.now
  Date.now = () => now
  let tokenCount = 0
  const mounted = mountSignIn({
    loadServices: async () => undefined,
    requestAccessToken: async () => ({ accessToken: `token-${++tokenCount}`, expiresAt: now + 60_000 }),
  })

  try {
    await mounted.controller.retryLoading()
    await expect(mounted.controller.requestAccessToken()).resolves.toBe('token-1')
    expect(mounted.controller.hasAccessToken.value).toBe(true)
    now += 31_000
    await expect(mounted.controller.requestAccessToken()).resolves.toBe('token-2')
    expect(tokenCount).toBe(2)
    expect(mounted.controller.hasAccessToken.value).toBe(true)
  } finally {
    mounted.unmount()
    Date.now = originalNow
  }
})

test('concurrent cold authorization is blocked without sharing caller cancellation @pure', async () => {
  const authorization = deferred<GoogleDriveAccessToken>()
  let authSignal: AbortSignal | undefined
  const mounted = mountSignIn({
    loadServices: async () => undefined,
    requestAccessToken: async (_clientId, signal) => { authSignal = signal; return authorization.promise },
  })

  try {
    await mounted.controller.retryLoading()
    const caller = new AbortController()
    const first = mounted.controller.requestAccessToken(caller.signal).catch(error => error)
    const second = await mounted.controller.requestAccessToken().catch(error => error)
    expect(second).toBeInstanceOf(Error)
    expect((second as Error).message).toMatch(/already in progress/i)
    expect(authSignal).toBeDefined()
    expect(authSignal).not.toBe(caller.signal)
    caller.abort()
    expect(authSignal?.aborted).toBe(true)
    authorization.resolve({ accessToken: 'late-token', expiresAt: Date.now() + 60_000 })
    await expect(first).resolves.toBeInstanceOf(GoogleDriveCancelledError)
    expect(mounted.controller.hasAccessToken.value).toBe(false)
  } finally {
    mounted.unmount()
  }
})

test('a stale 401 invalidates only its matching cached token and forgetting clears page memory @pure', async () => {
  let tokenCount = 0
  const mounted = mountSignIn({
    loadServices: async () => undefined,
    requestAccessToken: async () => ({ accessToken: `token-${++tokenCount}`, expiresAt: Date.now() + 60_000 }),
  })

  try {
    await mounted.controller.retryLoading()
    await mounted.controller.requestAccessToken()
    mounted.controller.invalidateAccessToken('older-token')
    expect(mounted.controller.hasAccessToken.value).toBe(true)
    mounted.controller.invalidateAccessToken('token-1')
    expect(mounted.controller.hasAccessToken.value).toBe(false)
    await mounted.controller.requestAccessToken()
    expect(tokenCount).toBe(2)
    mounted.controller.forgetAccessToken()
    expect(mounted.controller.hasAccessToken.value).toBe(false)
    expect(tokenCount).toBe(2)
  } finally {
    mounted.unmount()
  }
})

test('forgetting during authorization fences a late token callback @pure', async () => {
  const authorization = deferred<GoogleDriveAccessToken>()
  const mounted = mountSignIn({
    loadServices: async () => undefined,
    requestAccessToken: async () => authorization.promise,
  })

  try {
    await mounted.controller.retryLoading()
    const pending = mounted.controller.requestAccessToken().catch(error => error)
    mounted.controller.forgetAccessToken()
    authorization.resolve({ accessToken: 'late-token', expiresAt: Date.now() + 60_000 })
    await expect(pending).resolves.toBeInstanceOf(GoogleDriveCancelledError)
    expect(mounted.controller.hasAccessToken.value).toBe(false)
  } finally {
    mounted.unmount()
  }
})
