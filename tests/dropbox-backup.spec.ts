import { expect, test } from './fixtures'
import { computed, effectScope, ref } from 'vue'
import { useDropboxBackup } from '../composables/useDropboxBackup'
import type { DropboxGrant } from '../utils/dropbox-auth'
import { createLocalWorkspace, exportJumpCluster } from '../domain/workspace'
import { createDropboxBackupSnapshot } from '../utils/dropbox-backup-snapshot'
import { createDropboxApiArg, createDropboxBackup, DropboxApiError, reconcileDropboxBackup } from '../utils/dropbox-api'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

test('a Dropbox backup captures the versioned applied Jump Cluster at one dated unique path @pure', () => {
  const workspace = createLocalWorkspace('Ember Reach', 'Vesper')
  const expected = JSON.parse(JSON.stringify(exportJumpCluster(workspace)))
  const snapshot = createDropboxBackupSnapshot(
    workspace,
    new Date('2026-11-17T12:13:14.015Z'),
    '0123456789abcdef0123456789abcdef',
  )

  workspace.cluster.name = 'Later edit'

  expect(snapshot).toEqual({
    filename: 'Ember Reach-jump-cluster-2026-11-17-12-13-14-015Z-0123456789abcdef0123456789abcdef.json',
    path: '/Ember Reach-jump-cluster-2026-11-17-12-13-14-015Z-0123456789abcdef0123456789abcdef.json',
    contents: JSON.stringify(expected),
  })
})

test('a Dropbox backup filename stays within Dropbox component limits for long Unicode cluster names @pure', () => {
  const workspace = createLocalWorkspace('群'.repeat(80), 'Vesper')
  const snapshot = createDropboxBackupSnapshot(
    workspace,
    new Date('2026-11-17T12:13:14.015Z'),
    '0123456789abcdef0123456789abcdef',
  )

  expect(new TextEncoder().encode(snapshot.filename).byteLength).toBeLessThanOrEqual(255)
  expect(snapshot.filename.endsWith('-2026-11-17-12-13-14-015Z-0123456789abcdef0123456789abcdef.json')).toBe(true)
})

test('a confirmed backup is created once under the App Folder without replacement @pure', async () => {
  const contents = '{"format":"ttrpg-cluster-control-map","version":4,"type":"cluster"}'
  const requests: Array<{ url: string, init?: RequestInit }> = []
  const receipt = await createDropboxBackup({
    accessToken: 'short-lived-token',
    path: '/Ember Reach-jump-cluster-2026-11-17-12-13-14-015Z-0123456789abcdef0123456789abcdef.json',
    contents,
    fetcher: async (input, init) => {
      requests.push({ url: String(input), init })
      return jsonResponse({
        id: 'id:backup',
        name: 'Ember Reach-jump-cluster-2026-11-17-12-13-14-015Z-0123456789abcdef0123456789abcdef.json',
        path_display: '/Ember Reach-jump-cluster-2026-11-17-12-13-14-015Z-0123456789abcdef0123456789abcdef.json',
        path_lower: '/ember reach-jump-cluster-2026-11-17-12-13-14-015z-0123456789abcdef0123456789abcdef.json',
        size: new TextEncoder().encode(contents).byteLength,
        server_modified: '2026-11-17T12:13:15Z',
      })
    },
  })

  const request = requests[0]
  const headers = new Headers(request?.init?.headers)
  const args = JSON.parse(headers.get('Dropbox-API-Arg') ?? '{}') as Record<string, unknown>
  const body = request?.init?.body

  expect(request?.url).toBe('https://content.dropboxapi.com/2/files/upload')
  expect(args).toMatchObject({
    path: '/Ember Reach-jump-cluster-2026-11-17-12-13-14-015Z-0123456789abcdef0123456789abcdef.json',
    mode: 'add',
    autorename: false,
    strict_conflict: true,
  })
  expect(headers.get('Authorization')).toBe('Bearer short-lived-token')
  expect(headers.get('Content-Type')).toBe('application/octet-stream')
  expect(await new Response(body).text()).toBe(contents)
  expect(receipt).toEqual({
    id: 'id:backup',
    name: 'Ember Reach-jump-cluster-2026-11-17-12-13-14-015Z-0123456789abcdef0123456789abcdef.json',
    path: '/Ember Reach-jump-cluster-2026-11-17-12-13-14-015Z-0123456789abcdef0123456789abcdef.json',
  })
})

test('a Dropbox 401 response invalidates authorization without reading its stalled body @pure', async () => {
  const abort = new AbortController()
  let signalReadStarted!: () => void
  let signalBodyCanceled!: () => void
  const readStarted = new Promise<void>(resolve => { signalReadStarted = resolve })
  const bodyCanceled = new Promise<void>(resolve => { signalBodyCanceled = resolve })
  const response = {
    status: 401,
    ok: false,
    headers: new Headers(),
    body: {
      getReader: () => {
        signalReadStarted()
        return {
          read: () => new Promise<ReadableStreamReadResult<Uint8Array>>(() => undefined),
          cancel: async () => undefined,
          releaseLock: () => undefined,
        }
      },
      cancel: () => {
        signalBodyCanceled()
        return new Promise<void>(() => undefined)
      },
    },
  } as unknown as Response
  const request = createDropboxBackup({
    accessToken: 'stale-token',
    path: '/Backup.json',
    contents: '{}',
    signal: abort.signal,
    fetcher: async () => response,
  }).catch(error => error)

  const bodyAction = await Promise.race([
    readStarted.then(() => 'read' as const),
    bodyCanceled.then(() => 'canceled' as const),
  ])
  if (bodyAction === 'read') abort.abort()
  const error = await request

  expect(bodyAction).toBe('canceled')
  expect(error).toBeInstanceOf(DropboxApiError)
  expect(error).toMatchObject({ httpStatus: 401, code: 'request-failed' })
})

test('Dropbox API argument headers preserve Unicode names using ASCII JSON escapes @pure', async () => {
  let headerValue = ''
  await createDropboxBackup({
    accessToken: 'short-lived-token',
    path: '/群星-jump-cluster-2026-11-17.json',
    contents: '{}',
    fetcher: async (_input, init) => {
      headerValue = new Headers(init?.headers).get('Dropbox-API-Arg') ?? ''
      return jsonResponse({
        id: 'id:backup',
        name: '群星-jump-cluster-2026-11-17.json',
        path_display: '/群星-jump-cluster-2026-11-17.json',
        path_lower: '/群星-jump-cluster-2026-11-17.json',
        size: 2,
        server_modified: '2026-11-17T12:13:15Z',
      })
    },
  })

  expect([...headerValue].every(character => character.charCodeAt(0) <= 0x7f)).toBe(true)
  expect(headerValue).toContain('\\u7fa4\\u661f')
})

test('an uncertain Dropbox create reconciles only the exact App Folder path and saved bytes @pure', async () => {
  const contents = '{"type":"cluster","notes":"秘密"}'
  const path = '/群星-jump-cluster-2026-11-17.json'
  const requests: string[] = []
  const result = await reconcileDropboxBackup({
    accessToken: 'short-lived-token',
    path,
    contents,
    fetcher: async (input, init) => {
      requests.push(`${String(input)} ${init?.method ?? 'GET'}`)
      if (String(input).endsWith('/files/get_metadata')) {
        return jsonResponse({ '.tag': 'file', id: 'id:backup', name: '群星-jump-cluster-2026-11-17.json', path_display: path, size: new TextEncoder().encode(contents).byteLength })
      }
      return new Response(new TextEncoder().encode(contents), {
        headers: {
          'Dropbox-API-Result': createDropboxApiArg({ id: 'id:backup', name: '群星-jump-cluster-2026-11-17.json', path_display: path, size: new TextEncoder().encode(contents).byteLength }),
        },
      })
    },
  })

  expect(result).toEqual({
    kind: 'confirmed',
    receipt: { id: 'id:backup', name: '群星-jump-cluster-2026-11-17.json', path },
  })
  expect(requests).toHaveLength(2)
  expect(requests[0]).toContain('/files/get_metadata POST')
  expect(requests[1]).toContain('/files/download POST')
})

test('only a typed Dropbox path not-found result permits retrying the same create @pure', async () => {
  const path = '/Backup.json'
  const typedMissing = await reconcileDropboxBackup({
    accessToken: 'token',
    path,
    contents: '{}',
    fetcher: async () => jsonResponse({ error: { '.tag': 'path', path: { '.tag': 'not_found' } } }, 409),
  })
  const genericMissing = await reconcileDropboxBackup({
    accessToken: 'token',
    path,
    contents: '{}',
    fetcher: async () => jsonResponse({ error: 'not found' }, 404),
  })

  expect(typedMissing).toEqual({ kind: 'not-found' })
  expect(genericMissing).toEqual({ kind: 'unresolved' })
})

test('a Dropbox add conflict is reported without treating an identical existing file as this save @pure', async () => {
  const error = await createDropboxBackup({
    accessToken: 'token',
    path: '/Backup.json',
    contents: '{}',
    fetcher: async () => jsonResponse({ error: { '.tag': 'path', path: { '.tag': 'conflict' } } }, 409),
  }).catch(reason => reason)

  expect(error).toBeInstanceOf(DropboxApiError)
  expect(error).toMatchObject({ code: 'path-conflict', outcomeUncertain: false, httpStatus: 409 })
})

test('backup consent uploads the applied snapshot captured before authorization can yield @pure', async () => {
  const workspace = createLocalWorkspace('Ember Reach', 'Vesper')
  const expectedContents = JSON.stringify(exportJumpCluster(workspace))
  let finishAuthorization: ((grant: DropboxGrant) => void) | undefined
  let uploadedContents = ''
  let uploadedPath = ''
  const signIn = readyDropboxSignIn(() => new Promise(resolve => { finishAuthorization = resolve }))
  const scope = effectScope()
  try {
    const controller = scope.run(() => useDropboxBackup(() => workspace, signIn, {
      createBackup: async ({ path, contents }) => {
        uploadedContents = contents
        uploadedPath = path
        return { id: 'id:backup', name: path.slice(1), path }
      },
      reconcileBackup: async () => ({ kind: 'unresolved' }),
    }))
    if (!controller) throw new Error('The Dropbox backup controller did not initialize.')

    expect(controller.prepare()).toBe(true)
    workspace.cluster.name = 'Changed while consent is open'
    controller.activate()
    expect(controller.state.value).toBe('authorizing')
    finishAuthorization?.(grant('dbid:account'))
    await expect.poll(() => controller.state.value).toBe('idle')

    expect(uploadedContents).toBe(expectedContents)
    expect(uploadedPath).toMatch(/^\/Ember Reach-jump-cluster-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}-\d{3}Z-[a-f\d]{32}\.json$/u)
    expect(controller.lastSaved.value).toEqual({ id: 'id:backup', name: uploadedPath.slice(1), path: uploadedPath })
  } finally {
    scope.stop()
  }
})

test('an uncertain Dropbox write retries the same account, path, and bytes without another upload when found @pure', async () => {
  const workspace = createLocalWorkspace('Ember Reach', 'Vesper')
  const createRequests: Array<{ path: string, contents: string }> = []
  const reconciliationRequests: Array<{ path: string, contents: string }> = []
  const signIn = readyDropboxSignIn()
  let reconciliationCount = 0
  const scope = effectScope()
  try {
    const controller = scope.run(() => useDropboxBackup(() => workspace, signIn, {
      createBackup: async request => {
        createRequests.push(request)
        throw new DropboxApiError('outcome-uncertain', 'The response was lost.', true)
      },
      reconcileBackup: async request => {
        reconciliationRequests.push(request)
        reconciliationCount += 1
        return reconciliationCount === 1
          ? { kind: 'not-found' }
          : { kind: 'confirmed', receipt: { id: 'id:backup', name: request.path.slice(1), path: request.path } }
      },
    }))
    if (!controller) throw new Error('The Dropbox backup controller did not initialize.')

    controller.prepare()
    controller.activate()
    await expect.poll(() => controller.state.value).toBe('retry')
    controller.activate()
    await expect.poll(() => controller.state.value).toBe('idle')

    expect(createRequests).toHaveLength(1)
    expect(reconciliationRequests).toHaveLength(2)
    expect(reconciliationRequests[0]?.path).toBe(reconciliationRequests[1]?.path)
    expect(reconciliationRequests[0]?.contents).toBe(reconciliationRequests[1]?.contents)
    expect(controller.lastSaved.value?.path).toBe(createRequests[0]?.path)
  } finally {
    scope.stop()
  }
})

test('a retry refuses to reconcile or create under a different Dropbox account @pure', async () => {
  const workspace = createLocalWorkspace('Ember Reach', 'Vesper')
  const grants = [grant('dbid:first'), grant('dbid:second')]
  let reconcileCount = 0
  let createCount = 0
  const signIn = readyDropboxSignIn(async () => grants.shift() ?? grant('dbid:second'))
  const scope = effectScope()
  try {
    const controller = scope.run(() => useDropboxBackup(() => workspace, signIn, {
      createBackup: async () => {
        createCount += 1
        throw new DropboxApiError('outcome-uncertain', 'The response was lost.', true)
      },
      reconcileBackup: async () => {
        reconcileCount += 1
        return { kind: 'not-found' }
      },
    }))
    if (!controller) throw new Error('The Dropbox backup controller did not initialize.')

    controller.prepare()
    controller.activate()
    await expect.poll(() => controller.state.value).toBe('retry')
    controller.activate()
    await expect.poll(() => controller.state.value).toBe('retry')

    expect(createCount).toBe(1)
    expect(reconcileCount).toBe(1)
    expect(controller.message.value).toMatch(/different Dropbox account/i)
  } finally {
    scope.stop()
  }
})

test('a first-dispatch Dropbox path conflict stays a collision even if bytes might match @pure', async () => {
  const workspace = createLocalWorkspace('Ember Reach', 'Vesper')
  let reconcileCount = 0
  const attemptedPaths: string[] = []
  let createCount = 0
  const scope = effectScope()
  try {
    const controller = scope.run(() => useDropboxBackup(() => workspace, readyDropboxSignIn(), {
      createBackup: async ({ path }) => {
        attemptedPaths.push(path)
        createCount += 1
        throw new DropboxApiError('path-conflict', 'Path exists.', false, 409)
      },
      reconcileBackup: async () => {
        reconcileCount += 1
        return { kind: 'confirmed', receipt: { id: 'old-file', name: 'Backup.json', path: '/Backup.json' } }
      },
    }))
    if (!controller) throw new Error('The Dropbox backup controller did not initialize.')

    controller.prepare()
    controller.activate()
    await expect.poll(() => controller.state.value).toBe('conflict')

    expect(reconcileCount).toBe(0)
    expect(controller.state.value).toBe('conflict')
    controller.activate()
    expect(controller.state.value).toBe('prepared')
    expect(createCount).toBe(1)
    controller.activate()
    await expect.poll(() => controller.state.value).toBe('conflict')
    expect(createCount).toBe(2)
    expect(attemptedPaths[0]).not.toBe(attemptedPaths[1])
  } finally {
    scope.stop()
  }
})

test('starting a new backup after an unresolved result stages current data without uploading early @pure', async () => {
  const workspace = createLocalWorkspace('Ember Reach', 'Vesper')
  const creates: Array<{ path: string, contents: string }> = []
  const signIn = readyDropboxSignIn()
  const scope = effectScope()
  try {
    const controller = scope.run(() => useDropboxBackup(() => workspace, signIn, {
      createBackup: async request => {
        creates.push(request)
        if (creates.length === 1) throw new DropboxApiError('outcome-uncertain', 'The response was lost.', true)
        return { id: 'id:new', name: request.path.slice(1), path: request.path }
      },
      reconcileBackup: async () => ({ kind: 'not-found' }),
    }))
    if (!controller) throw new Error('The Dropbox backup controller did not initialize.')

    controller.prepare()
    controller.activate()
    await expect.poll(() => controller.state.value).toBe('retry')
    const earlierPath = creates[0]?.path
    workspace.cluster.name = 'Newly edited map'
    controller.startNewBackup()
    expect(controller.state.value).toBe('prepared')
    expect(creates).toHaveLength(1)
    expect(controller.message.value).toContain(earlierPath)

    controller.activate()
    await expect.poll(() => controller.state.value).toBe('idle')
    expect(creates).toHaveLength(2)
    expect(creates[1]?.path).not.toBe(earlierPath)
    expect(JSON.parse(creates[1]?.contents ?? '{}').cluster.name).toBe('Newly edited map')
  } finally {
    scope.stop()
  }
})

test('canceling authorization before upload keeps the staged backup available and unchanged @pure', async () => {
  const workspace = createLocalWorkspace('Ember Reach', 'Vesper')
  let createCount = 0
  const signIn = readyDropboxSignIn(signal => new Promise((_resolve, reject) => {
    signal?.addEventListener('abort', () => reject(new Error('Canceled.')), { once: true })
  }))
  const scope = effectScope()
  try {
    const controller = scope.run(() => useDropboxBackup(() => workspace, signIn, {
      createBackup: async () => {
        createCount += 1
        return { id: 'id:backup', name: 'Backup.json', path: '/Backup.json' }
      },
      reconcileBackup: async () => ({ kind: 'unresolved' }),
    }))
    if (!controller) throw new Error('The Dropbox backup controller did not initialize.')

    controller.prepare()
    controller.activate()
    expect(controller.canCancel.value).toBe(true)
    controller.cancelBeforeUpload()
    await expect.poll(() => controller.state.value).toBe('prepared')
    expect(controller.message.value).toMatch(/authorization was canceled/i)
    expect(createCount).toBe(0)
  } finally {
    scope.stop()
  }
})

function readyDropboxSignIn(requestGrant: (signal?: AbortSignal) => Promise<DropboxGrant> = async () => grant('dbid:account')) {
  const status = ref<'ready'>('ready')
  return {
    status,
    message: ref(''),
    ready: computed(() => true),
    hasAccessToken: computed(() => false),
    accountId: computed(() => null),
    requestGrant,
    invalidateAccessToken: () => undefined,
    forgetAccount: () => undefined,
  }
}

function grant(accountId: string): DropboxGrant {
  return { accessToken: `token-${accountId}`, accountId, expiresAt: Date.now() + 60_000 }
}
