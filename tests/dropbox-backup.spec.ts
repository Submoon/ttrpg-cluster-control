import { expect, test } from './fixtures'
import { computed, effectScope, ref } from 'vue'
import { useDropboxBackup } from '../composables/useDropboxBackup'
import type { DropboxGrant } from '../utils/dropbox-auth'
import { createLocalWorkspace, exportJumpCluster } from '../domain/workspace'
import { createDropboxBackupSnapshot, DROPBOX_BACKUP_LIMIT, isDropboxDatedBackupName } from '../utils/dropbox-backup-snapshot'
import { createDropboxApiArg, createDropboxBackup, deleteDropboxBackup, DropboxApiError, reconcileDropboxBackup } from '../utils/dropbox-api'
import type { DropboxBackupFile } from '../utils/dropbox-api'
import { pruneDropboxBackups } from '../utils/dropbox-backup-retention'

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

test('Dropbox retention recognizes only generated dated names with a valid UTC date @pure', () => {
  expect(isDropboxDatedBackupName('Ember Reach-jump-cluster-2024-02-29-12-13-14-015Z-0123456789abcdef0123456789abcdef.json')).toBe(true)
  expect(isDropboxDatedBackupName('Ember Reach-jump-cluster-2023-02-29-12-13-14-015Z-0123456789abcdef0123456789abcdef.json')).toBe(false)
  expect(isDropboxDatedBackupName('manual-export.json')).toBe(false)
  expect(DROPBOX_BACKUP_LIMIT).toBe(10)
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

test('Dropbox deletes only the listed root file revision and verifies the returned metadata @pure', async () => {
  const file = listedBackupFile('2026-11-17-12-13-14-015Z', '0123456789abcdef0123456789abcdef', 'id:listed', 'abcdef012345')
  let requestUrl = ''
  let requestBody: unknown
  let requestHeaders: Headers | undefined
  await deleteDropboxBackup('short-lived-token', file, async (input, init) => {
    requestUrl = String(input)
    requestBody = JSON.parse(String(init?.body ?? '{}')) as unknown
    requestHeaders = new Headers(init?.headers)
    return jsonResponse({ metadata: deletedMetadata(file) })
  })

  expect(requestUrl).toBe('https://api.dropboxapi.com/2/files/delete_v2')
  expect(requestHeaders?.get('Authorization')).toBe('Bearer short-lived-token')
  expect(requestBody).toEqual({ path: `/${file.name}`, parent_rev: file.rev })
})

test('Dropbox deletion treats a typed missing path as definite and mismatched success metadata as uncertain @pure', async () => {
  const file = listedBackupFile('2026-11-17-12-13-14-015Z', '0123456789abcdef0123456789abcdef', 'id:listed', 'abcdef012345')
  const missing = await deleteDropboxBackup('token', file, async () => jsonResponse({
    error: { '.tag': 'path_lookup', path_lookup: { '.tag': 'not_found' } },
  }, 409)).catch(error => error)
  const mismatch = await deleteDropboxBackup('token', file, async () => jsonResponse({
    metadata: { ...deletedMetadata(file), rev: 'abcdef999999' },
  })).catch(error => error)

  expect(missing).toMatchObject({ code: 'request-failed', outcomeUncertain: false, httpStatus: 409 })
  expect(mismatch).toMatchObject({ code: 'outcome-uncertain', outcomeUncertain: true })
})

test('Dropbox retention paginates completely, orders provider-time ties by capture time, and ignores other JSON @pure', async () => {
  const files = Array.from({ length: 12 }, (_, index) => retentionFile(index + 1))
  files.push({
    id: 'id:manual',
    name: 'manual-export.json',
    rev: 'abcdef012345',
    serverModified: '2020-01-01T00:00:00Z',
    size: 10,
  })
  const store = createRetentionFetcher(files)
  const receipt = files[11]
  if (!receipt) throw new Error('The receipt fixture did not initialize.')

  const result = await pruneDropboxBackups({
    accessToken: 'token',
    receipt: { id: receipt.id, name: receipt.name, path: `/${receipt.name}` },
    fetcher: store.fetcher,
  })

  expect(result).toBe('retained')
  expect(store.deletedNames).toEqual([files[0]?.name, files[1]?.name])
  expect(store.remaining).toHaveLength(11)
  expect(store.remaining.some(file => file.name === 'manual-export.json')).toBe(true)
  expect(store.scanCount.value).toBeGreaterThan(2)
})

test('Dropbox retention refuses to prune until the confirmed receipt is visible in complete listings @pure', async () => {
  const files = Array.from({ length: 11 }, (_, index) => retentionFile(index + 1))
  const store = createRetentionFetcher(files)
  const absentReceipt = retentionFile(12)

  await expect(pruneDropboxBackups({
    accessToken: 'token',
    receipt: { id: absentReceipt.id, name: absentReceipt.name, path: `/${absentReceipt.name}` },
    fetcher: store.fetcher,
  })).rejects.toThrow(/has not listed the saved backup/i)

  expect(store.deletedNames).toHaveLength(0)
  expect(store.scanCount.value).toBe(2)
})

test('Dropbox retention does not prune after a repeated continuation cursor @pure', async () => {
  const files = Array.from({ length: 11 }, (_, index) => retentionFile(index + 1))
  let deleteCount = 0
  const fetcher = async (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input)
    if (url.endsWith('/files/list_folder')) {
      return jsonResponse({ entries: files.slice(0, 6).map(listEntry), has_more: true, cursor: 'repeated' })
    }
    if (url.endsWith('/files/list_folder/continue')) {
      return jsonResponse({ entries: files.slice(6).map(listEntry), has_more: true, cursor: 'repeated' })
    }
    if (url.endsWith('/files/delete_v2')) deleteCount += 1
    return jsonResponse({})
  }
  const receipt = files[10]
  if (!receipt) throw new Error('The receipt fixture did not initialize.')

  await expect(pruneDropboxBackups({
    accessToken: 'token',
    receipt: { id: receipt.id, name: receipt.name, path: `/${receipt.name}` },
    fetcher,
  })).rejects.toThrow(/complete backup list/i)

  expect(deleteCount).toBe(0)
})

test('Dropbox retention reports when deterministic pruning removes the just-saved receipt @pure', async () => {
  const files = Array.from({ length: 11 }, (_, index) => retentionFile(index + 1))
  const store = createRetentionFetcher(files)
  const receipt = files[0]
  if (!receipt) throw new Error('The receipt fixture did not initialize.')

  const result = await pruneDropboxBackups({
    accessToken: 'token',
    receipt: { id: receipt.id, name: receipt.name, path: `/${receipt.name}` },
    fetcher: store.fetcher,
  })

  expect(result).toBe('removed')
  expect(store.deletedNames).toEqual([receipt.name])
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

test('backup activation captures the applied snapshot before opening Dropbox authorization @pure', async () => {
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
      pruneBackups: async () => 'retained',
    }))
    if (!controller) throw new Error('The Dropbox backup controller did not initialize.')

    controller.activate()
    expect(controller.state.value).toBe('authorizing')
    workspace.cluster.name = 'Changed while consent is open'
    finishAuthorization?.(grant('dbid:account'))
    await expect.poll(() => controller.state.value).toBe('idle')

    expect(uploadedContents).toBe(expectedContents)
    expect(uploadedPath).toMatch(/^\/Ember Reach-jump-cluster-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}-\d{3}Z-[a-f\d]{32}\.json$/u)
    expect(controller.lastSaved.value).toEqual({ id: 'id:backup', name: uploadedPath.slice(1), path: uploadedPath })
  } finally {
    scope.stop()
  }
})

test('a confirmed Dropbox upload retries retention without creating its bytes again @pure', async () => {
  const workspace = createLocalWorkspace('Ember Reach', 'Vesper')
  const grants = [grant('dbid:account'), grant('dbid:account')]
  let createCount = 0
  let pruneCount = 0
  const scope = effectScope()
  try {
    const controller = scope.run(() => useDropboxBackup(() => workspace, readyDropboxSignIn(async () => grants.shift() ?? grant('dbid:account')), {
      createBackup: async request => {
        createCount += 1
        return { id: 'id:backup', name: request.path.slice(1), path: request.path }
      },
      pruneBackups: async () => {
        pruneCount += 1
        if (pruneCount === 1) throw new Error('The complete backup list was unavailable.')
        return 'retained'
      },
    }))
    if (!controller) throw new Error('The Dropbox backup controller did not initialize.')

    controller.activate()
    await expect.poll(() => controller.state.value).toBe('cleanup-retry')
    const savedName = controller.message.value.match(/Ember Reach-jump-cluster-[^ ]+\.json/u)?.[0]
    expect(createCount).toBe(1)
    expect(savedName).toBeTruthy()
    expect(controller.lastSaved.value).toBeUndefined()

    controller.activate()
    await expect.poll(() => controller.state.value).toBe('idle')

    expect(createCount).toBe(1)
    expect(pruneCount).toBe(2)
    expect(controller.lastSaved.value?.name).toBe(savedName)
  } finally {
    scope.stop()
  }
})

test('Dropbox cleanup retry remains bound to the account that saved its receipt @pure', async () => {
  const workspace = createLocalWorkspace('Ember Reach', 'Vesper')
  const grants = [grant('dbid:first'), grant('dbid:second')]
  let createCount = 0
  let pruneCount = 0
  const scope = effectScope()
  try {
    const controller = scope.run(() => useDropboxBackup(() => workspace, readyDropboxSignIn(async () => grants.shift() ?? grant('dbid:second')), {
      createBackup: async request => {
        createCount += 1
        return { id: 'id:backup', name: request.path.slice(1), path: request.path }
      },
      pruneBackups: async () => {
        pruneCount += 1
        throw new Error('The list is unavailable.')
      },
    }))
    if (!controller) throw new Error('The Dropbox backup controller did not initialize.')

    controller.activate()
    await expect.poll(() => controller.state.value).toBe('cleanup-retry')
    controller.activate()
    await expect.poll(() => controller.state.value).toBe('cleanup-retry')

    expect(controller.message.value).toMatch(/different Dropbox account/i)
    expect(createCount).toBe(1)
    expect(pruneCount).toBe(1)
  } finally {
    scope.stop()
  }
})

test('Dropbox cleanup retry prefers the pending receipt for the granted account @pure', async () => {
  const workspace = createLocalWorkspace('Ember Reach', 'Vesper')
  const grants = [grant('dbid:first'), grant('dbid:second'), grant('dbid:second'), grant('dbid:first')]
  const cleanupTokens: string[] = []
  let createCount = 0
  let pruneCount = 0
  const scope = effectScope()
  try {
    const controller = scope.run(() => useDropboxBackup(() => workspace, readyDropboxSignIn(async () => grants.shift() ?? grant('dbid:second')), {
      createBackup: async request => {
        createCount += 1
        return { id: `id:backup-${createCount}`, name: request.path.slice(1), path: request.path }
      },
      pruneBackups: async request => {
        pruneCount += 1
        cleanupTokens.push(request.accessToken)
        if (pruneCount < 3) throw new Error('The list is unavailable.')
        return 'retained'
      },
    }))
    if (!controller) throw new Error('The Dropbox backup controller did not initialize.')

    controller.activate()
    await expect.poll(() => controller.state.value).toBe('cleanup-retry')
    controller.startNewBackup()
    await expect.poll(() => controller.state.value).toBe('cleanup-retry')
    const secondReceiptName = controller.message.value.match(/Dropbox confirmed that (.+?\.json) was saved/u)?.[1]
    expect(secondReceiptName).toBeTruthy()

    controller.activate()
    await expect.poll(() => pruneCount).toBe(3)

    expect(createCount).toBe(2)
    expect(cleanupTokens).toEqual(['token-dbid:first', 'token-dbid:second', 'token-dbid:second'])
    expect(controller.lastSaved.value?.name).toBe(secondReceiptName)
    expect(controller.state.value).toBe('cleanup-retry')

    controller.activate()
    await expect.poll(() => controller.state.value).toBe('idle')

    expect(pruneCount).toBe(4)
    expect(cleanupTokens[3]).toBe('token-dbid:first')
  } finally {
    scope.stop()
  }
})

test('a saved receipt removed by retention is reported without a completed-save receipt @pure', async () => {
  const workspace = createLocalWorkspace('Ember Reach', 'Vesper')
  let createCount = 0
  const scope = effectScope()
  try {
    const controller = scope.run(() => useDropboxBackup(() => workspace, readyDropboxSignIn(), {
      createBackup: async request => {
        createCount += 1
        return { id: 'id:backup', name: request.path.slice(1), path: request.path }
      },
      pruneBackups: async () => 'removed',
    }))
    if (!controller) throw new Error('The Dropbox backup controller did not initialize.')

    controller.activate()
    await expect.poll(() => controller.state.value).toBe('idle')

    expect(createCount).toBe(1)
    expect(controller.lastSaved.value).toBeUndefined()
    expect(controller.message.value).toMatch(/removed to keep only the ten newest backups/i)
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
      pruneBackups: async () => 'retained',
    }))
    if (!controller) throw new Error('The Dropbox backup controller did not initialize.')

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

test('a first-dispatch Dropbox path conflict stays a collision and the next activation captures a fresh path @pure', async () => {
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

    controller.activate()
    await expect.poll(() => controller.state.value).toBe('idle')

    expect(reconcileCount).toBe(0)
    expect(controller.message.value).toContain('Path exists.')
    controller.activate()
    await expect.poll(() => createCount).toBe(2)
    await expect.poll(() => controller.state.value).toBe('idle')
    expect(attemptedPaths[0]).not.toBe(attemptedPaths[1])
  } finally {
    scope.stop()
  }
})

test('starting a new backup after an unresolved result immediately captures and starts current data @pure', async () => {
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
      pruneBackups: async () => 'retained',
    }))
    if (!controller) throw new Error('The Dropbox backup controller did not initialize.')

    controller.activate()
    await expect.poll(() => controller.state.value).toBe('retry')
    const earlierPath = creates[0]?.path
    workspace.cluster.name = 'Newly edited map'
    controller.startNewBackup()
    expect(controller.message.value).toContain(earlierPath)

    await expect.poll(() => controller.state.value).toBe('idle')
    expect(creates).toHaveLength(2)
    expect(creates[1]?.path).not.toBe(earlierPath)
    expect(JSON.parse(creates[1]?.contents ?? '{}').cluster.name).toBe('Newly edited map')
  } finally {
    scope.stop()
  }
})

test('canceling Dropbox authorization before upload leaves the local map unchanged @pure', async () => {
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

    controller.activate()
    expect(controller.canCancel.value).toBe(true)
    controller.cancelBeforeUpload()
    await expect.poll(() => controller.state.value).toBe('idle')
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

function listedBackupFile(timestamp: string, fileId: string, id: string, rev: string): DropboxBackupFile {
  const name = `Ember Reach-jump-cluster-${timestamp}-${fileId}.json`
  return {
    id,
    name,
    rev,
    serverModified: '2026-11-17T12:13:15Z',
    size: 64,
  }
}

function retentionFile(day: number): DropboxBackupFile {
  const dayText = String(day).padStart(2, '0')
  const id = day.toString(16).padStart(32, '0')
  return listedBackupFile(`2026-11-${dayText}-12-13-14-015Z`, id, `id:backup-${dayText}`, 'abcdef012345')
}

function deletedMetadata(file: DropboxBackupFile): Record<string, unknown> {
  return {
    '.tag': 'file',
    id: file.id,
    name: file.name,
    path_display: `/${file.name}`,
    rev: file.rev,
  }
}

function listEntry(file: DropboxBackupFile): Record<string, unknown> {
  return {
    ...deletedMetadata(file),
    server_modified: file.serverModified,
    size: file.size,
    is_downloadable: true,
  }
}

function createRetentionFetcher(initialFiles: DropboxBackupFile[]) {
  const remaining = [...initialFiles]
  const deletedNames: string[] = []
  const continuationPages = new Map<string, DropboxBackupFile[]>()
  const scanCount = ref(0)
  let cursorSequence = 0

  const fetcher = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input)
    const request = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
    if (url.endsWith('/files/list_folder')) {
      scanCount.value += 1
      const cursor = `scan-${cursorSequence++}`
      continuationPages.set(cursor, remaining.slice(6))
      const page = remaining.slice(0, 6)
      return jsonResponse({
        entries: page.map(listEntry),
        has_more: remaining.length > page.length,
        cursor,
      })
    }
    if (url.endsWith('/files/list_folder/continue')) {
      const page = continuationPages.get(String(request.cursor)) ?? []
      return jsonResponse({ entries: page.map(listEntry), has_more: false })
    }
    if (url.endsWith('/files/delete_v2')) {
      const index = remaining.findIndex(file => `/${file.name}` === request.path && file.rev === request.parent_rev)
      if (index < 0) {
        return jsonResponse({ error: { '.tag': 'path_lookup', path_lookup: { '.tag': 'not_found' } } }, 409)
      }
      const [file] = remaining.splice(index, 1)
      if (!file) throw new Error('The selected fixture file disappeared.')
      deletedNames.push(file.name)
      return jsonResponse({ metadata: deletedMetadata(file) })
    }
    throw new Error(`Unexpected Dropbox API endpoint: ${url}`)
  }

  return { fetcher, remaining, deletedNames, scanCount }
}

function grant(accountId: string): DropboxGrant {
  return { accessToken: `token-${accountId}`, accountId, expiresAt: Date.now() + 60_000 }
}
