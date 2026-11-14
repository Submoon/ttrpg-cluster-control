import { computed, effectScope, ref } from 'vue'
import { expect, test } from './fixtures'
import { createLocalWorkspace, exportJumpCluster } from '../domain/workspace'
import { useGoogleDriveBackup } from '../composables/useGoogleDriveBackup'
import type { GoogleDriveSignInController, GoogleDriveSignInStatus } from '../composables/useGoogleDriveSignIn'
import { readGoogleDriveConfig } from '../utils/google-drive-config'
import { createGoogleDriveBackupSnapshot } from '../utils/google-drive-backup-snapshot'
import { pruneGoogleDriveBackups } from '../utils/google-drive-backup-retention'
import { GoogleDriveCancelledError } from '../utils/google-drive-auth'
import {
  GoogleDriveApiError,
  generateGoogleDriveFileId,
  getGoogleDrivePermissionId,
  listGoogleDriveBackups,
  readGoogleDriveFile,
  uploadGoogleDriveBackup,
} from '../utils/google-drive-api'
import type { GoogleDriveBackupFile } from '../utils/google-drive-api'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function confirmedFile(id: string, name: string, contents: string): Record<string, unknown> {
  return {
    id,
    name,
    createdTime: '2026-11-13T10:00:00.000Z',
    mimeType: 'application/json',
    parents: ['concrete-app-data-parent'],
    spaces: ['appDataFolder'],
    size: String(new TextEncoder().encode(contents).byteLength),
    trashed: false,
  }
}

function datedDriveBackup(id: string, secondsAfterBase: number): Record<string, unknown> & GoogleDriveBackupFile {
  const createdAt = new Date(Date.parse('2026-11-13T10:00:00.000Z') + secondsAfterBase * 1000)
  const stamp = createdAt.toISOString().replace('T', '-').replaceAll(':', '-').replace('.', '-')
  return {
    id,
    name: `Ember Reach-jump-cluster-${stamp}.json`,
    createdTime: createdAt.toISOString(),
    mimeType: 'application/json',
    spaces: ['appDataFolder'],
    trashed: false,
    capabilities: { canDelete: true },
  }
}

function readySignIn(
  requestAccessToken: (signal?: AbortSignal) => Promise<string> = async () => 'short-lived-token',
  invalidateAccessToken: (accessToken: string) => void = () => undefined,
): GoogleDriveSignInController {
  const status = ref<GoogleDriveSignInStatus>('ready')
  return {
    status,
    message: ref(''),
    ready: computed(() => status.value === 'ready'),
    hasAccessToken: computed(() => false),
    retryLoading: async () => undefined,
    requestAccessToken,
    invalidateAccessToken,
    forgetAccessToken: () => undefined,
  }
}

test('Google Drive configuration requires only a client ID @pure', () => {
  expect(readGoogleDriveConfig({ googleDriveClientId: ' client.apps.googleusercontent.com ' })).toEqual({
    clientId: 'client.apps.googleusercontent.com',
  })
  expect(readGoogleDriveConfig({ googleDriveClientId: ' ' })).toBeUndefined()
})
test('a dated backup snapshot is detached from later workspace edits @pure', () => {
  const workspace = createLocalWorkspace('Ember Reach', 'Vesper')
  const expected = JSON.parse(JSON.stringify(exportJumpCluster(workspace)))
  const snapshot = createGoogleDriveBackupSnapshot(workspace, new Date('2026-11-13T10:00:00.000Z'))
  workspace.cluster.name = 'Later edit'

  expect(snapshot.filename).toBe('Ember Reach-jump-cluster-2026-11-13-10-00-00-000Z.json')
  expect(JSON.parse(snapshot.contents)).toEqual(expected)
})

test('retention scans every page, ignores unrelated app-data JSON, and removes oldest backups first @pure', async () => {
  const backups = Array.from({ length: 12 }, (_, index) => datedDriveBackup(`backup-${String(index).padStart(2, '0')}`, index))
  const unrelated = { ...datedDriveBackup('profile', 100), name: 'profile.json' }
  const receiptRecord = backups[11]
  if (!receiptRecord) throw new Error('Expected a backup receipt.')
  const receipt: GoogleDriveBackupFile = {
    id: String(receiptRecord.id),
    name: String(receiptRecord.name),
    createdTime: String(receiptRecord.createdTime),
  }
  const remaining = [...backups, unrelated]
  const deletedIds: string[] = []
  let listPageCount = 0

  await pruneGoogleDriveBackups({
    accessToken: 'token',
    receipt,
    fetcher: async (input, init) => {
      const url = new URL(String(input))
      const method = init?.method ?? 'GET'
      if (url.pathname.endsWith('/files') && !url.pathname.includes('/generateIds')) {
        listPageCount += 1
        const nextPage = remaining.slice(6)
        if (url.searchParams.get('pageToken') === 'next') {
          return jsonResponse({ incompleteSearch: false, files: nextPage })
        }
        return jsonResponse({ incompleteSearch: false, files: remaining.slice(0, 6), nextPageToken: 'next' })
      }
      const id = decodeURIComponent(url.pathname.split('/').at(-1) ?? '')
      if (method === 'DELETE') {
        deletedIds.push(id)
        const index = remaining.findIndex(file => file.id === id)
        if (index >= 0) remaining.splice(index, 1)
        return new Response(null, { status: 204 })
      }
      const metadata = remaining.find(file => file.id === id)
      return metadata ? jsonResponse(metadata) : jsonResponse({ error: 'not found' }, 404)
    },
  })

  expect(listPageCount).toBe(8)
  expect(deletedIds).toEqual(['backup-00', 'backup-01'])
})

test('retention does not delete from an incomplete Drive listing @pure', async () => {
  const receiptRecord = datedDriveBackup('receipt', 0)
  const receipt: GoogleDriveBackupFile = {
    id: String(receiptRecord.id),
    name: String(receiptRecord.name),
    createdTime: String(receiptRecord.createdTime),
  }
  let deleteCount = 0

  const error = await pruneGoogleDriveBackups({
    accessToken: 'token',
    receipt,
    fetcher: async (_input, init) => {
      if (init?.method === 'DELETE') deleteCount += 1
      return jsonResponse({ incompleteSearch: true, files: [] })
    },
  }).catch(reason => reason)

  expect(error).toBeInstanceOf(GoogleDriveApiError)
  expect(deleteCount).toBe(0)
})

test('retention re-ranks after each deletion when a retained backup is removed concurrently @pure', async () => {
  const remaining = Array.from({ length: 12 }, (_, index) => datedDriveBackup(`backup-${String(index).padStart(2, '0')}`, index))
  const receiptRecord = remaining[11]
  if (!receiptRecord) throw new Error('Expected a backup receipt.')
  const receipt: GoogleDriveBackupFile = {
    id: receiptRecord.id,
    name: receiptRecord.name,
    createdTime: receiptRecord.createdTime,
  }
  const deletedIds: string[] = []

  await pruneGoogleDriveBackups({
    accessToken: 'token',
    receipt,
    fetcher: async (input, init) => {
      const url = new URL(String(input))
      const method = init?.method ?? 'GET'
      if (url.pathname.endsWith('/files') && !url.pathname.includes('/generateIds')) {
        return jsonResponse({ incompleteSearch: false, files: remaining })
      }
      const id = decodeURIComponent(url.pathname.split('/').at(-1) ?? '')
      if (method === 'DELETE') {
        deletedIds.push(id)
        const candidateIndex = remaining.findIndex(file => file.id === id)
        if (candidateIndex >= 0) remaining.splice(candidateIndex, 1)
        // Simulate another tab removing a file that was among the retained newest ten.
        const concurrentIndex = remaining.findIndex(file => file.id === 'backup-11')
        if (concurrentIndex >= 0) remaining.splice(concurrentIndex, 1)
        return new Response(null, { status: 204 })
      }
      const metadata = remaining.find(file => file.id === id)
      return metadata ? jsonResponse(metadata) : jsonResponse({ error: 'not found' }, 404)
    },
  })

  expect(deletedIds).toEqual(['backup-00'])
  expect(remaining).toHaveLength(10)
})

test('a stable generated file ID is reserved in appDataFolder @pure', async () => {
  let requestedUrl = ''
  const id = await generateGoogleDriveFileId('token', async input => {
    requestedUrl = String(input)
    return jsonResponse({ ids: ['app-data-file'], space: 'appDataFolder' })
  })

  expect(id).toBe('app-data-file')
  expect(requestedUrl).toContain('/files/generateIds?')
  expect(new URL(requestedUrl).searchParams.get('space')).toBe('appDataFolder')
})

test('Drive about identity returns the opaque permission ID with the app-data scope @pure', async () => {
  let requestedUrl = ''
  const permissionId = await getGoogleDrivePermissionId('token', async input => {
    requestedUrl = String(input)
    return jsonResponse({ user: { permissionId: 'opaque-account-id' } })
  })

  expect(permissionId).toBe('opaque-account-id')
  expect(new URL(requestedUrl).pathname).toBe('/drive/v3/about')
  expect(new URL(requestedUrl).searchParams.get('fields')).toBe('user(permissionId)')
})

test('Drive API 401 responses retain their HTTP status for cached-token invalidation @pure', async () => {
  const error = await getGoogleDrivePermissionId('expired-token', async () => jsonResponse({ error: 'unauthorized' }, 401))
    .catch(reason => reason)

  expect(error).toBeInstanceOf(GoogleDriveApiError)
  expect(error).toMatchObject({ httpStatus: 401, outcomeUncertain: false })
})

test('Drive 401 is recognized from headers while its response body remains pending @pure', async () => {
  let bodyCanceled = false
  const error = await getGoogleDrivePermissionId('expired-token', async () => new Response(new ReadableStream({
    cancel() { bodyCanceled = true },
  }), { status: 401 })).catch(reason => reason)

  expect(error).toMatchObject({ httpStatus: 401 })
  expect(bodyCanceled).toBe(true)
})

test('a 401 during reconciliation preserves an uncertain backup and its status @pure', async () => {
  const error = await uploadGoogleDriveBackup({
    accessToken: 'expired-token',
    fileId: 'backup-uncertain',
    filename: 'Backup.json',
    contents: '{}',
    fetcher: async input => new URL(String(input)).pathname.includes('/upload/drive/v3/files')
      ? jsonResponse({ error: 'server error' }, 503)
      : jsonResponse({ error: 'unauthorized' }, 401),
  }).catch(reason => reason)

  expect(error).toMatchObject({ code: 'outcome-uncertain', outcomeUncertain: true, httpStatus: 401 })
})

test('a generated ID from another Drive space is refused @pure', async () => {
  const error = await generateGoogleDriveFileId('token', async () => jsonResponse({ ids: ['wrong-space'], space: 'drive' }))
    .catch(reason => reason)
  expect(error).toBeInstanceOf(GoogleDriveApiError)
})

test('a confirmed upload creates the dated JSON under the hidden app-data parent @pure', async () => {
  const contents = '{"format":"jump-cluster"}'
  let requestUrl = ''
  let requestBody = ''
  const saved = await uploadGoogleDriveBackup({
    accessToken: 'token',
    fileId: 'app-data-file',
    filename: 'Ember-jump-cluster-2026-11-13.json',
    contents,
    fetcher: async (input, init) => {
      requestUrl = String(input)
      requestBody = String(init?.body)
      return jsonResponse(confirmedFile('app-data-file', 'Ember-jump-cluster-2026-11-13.json', contents))
    },
  })

  expect(requestUrl).toContain('https://www.googleapis.com/upload/drive/v3/files?')
  expect(new URL(requestUrl).searchParams.get('uploadType')).toBe('multipart')
  expect(requestBody).toContain('"id":"app-data-file"')
  expect(requestBody).toContain('"parents":["appDataFolder"]')
  expect(saved).toEqual({
    id: 'app-data-file',
    name: 'Ember-jump-cluster-2026-11-13.json',
    createdTime: '2026-11-13T10:00:00.000Z',
  })
})

test('an uncertain create is reconciled by ID, app-data space, and exact bytes @pure', async () => {
  const contents = '{"format":"jump-cluster","systems":[]}'
  const requests: string[] = []
  const saved = await uploadGoogleDriveBackup({
    accessToken: 'token',
    fileId: 'app-data-file',
    filename: 'Ember-jump-cluster-2026-11-13.json',
    contents,
    fetcher: async (input, init) => {
      const url = String(input)
      requests.push(`${init?.method ?? 'GET'} ${url}`)
      if (init?.method === 'POST') throw new TypeError('response lost after dispatch')
      if (url.includes('alt=media')) return new Response(contents)
      return jsonResponse(confirmedFile('app-data-file', 'Ember-jump-cluster-2026-11-13.json', contents))
    },
  })

  expect(saved.id).toBe('app-data-file')
  expect(requests.map(request => request.split(' ')[0])).toEqual(['POST', 'GET', 'GET'])
  expect(requests[1]).toContain('/files/app-data-file?')
  expect(requests[2]).toContain('alt=media')
})

test('an unconfirmed create stays retryable when the app-data file cannot be checked @pure', async () => {
  const error = await uploadGoogleDriveBackup({
    accessToken: 'token',
    fileId: 'app-data-file',
    filename: 'Backup.json',
    contents: '{}',
    fetcher: async (_input, init) => init?.method === 'POST'
      ? jsonResponse({ error: 'conflict' }, 409)
      : jsonResponse({ error: 'access unavailable' }, 403),
  }).catch(reason => reason)

  expect(error).toMatchObject({ code: 'outcome-uncertain', outcomeUncertain: true })
})

test('the backup list requests only appDataFolder and validates visible JSON entries @pure', async () => {
  let requestedUrl = ''
  const result = await listGoogleDriveBackups('token', undefined, async input => {
    requestedUrl = String(input)
    return jsonResponse({
      files: [
        { id: 'backup-1', name: 'Ember-jump-cluster-2026.json', createdTime: '2026-11-13T10:00:00.000Z', mimeType: 'application/json', spaces: ['appDataFolder'], trashed: false },
        { id: 'drive-file', name: 'Other.json', createdTime: '2026-11-13T11:00:00.000Z', mimeType: 'application/json', spaces: ['drive'], trashed: false },
        { id: 'not-json', name: 'Other.bin', createdTime: '2026-11-13T12:00:00.000Z', mimeType: 'application/octet-stream', spaces: ['appDataFolder'], trashed: false },
      ],
      nextPageToken: 'next-page',
    })
  })

  const query = new URL(requestedUrl).searchParams
  expect(query.get('spaces')).toBe('appDataFolder')
  expect(query.get('orderBy')).toBe('createdTime desc')
  expect(query.get('q')).toBe('trashed = false')
  expect(result).toEqual({
    files: [{ id: 'backup-1', name: 'Ember-jump-cluster-2026.json', createdTime: '2026-11-13T10:00:00.000Z' }],
    nextPageToken: 'next-page',
  })
})

test('an empty protobuf JSON page without files is returned as an empty page @pure', async () => {
  const result = await listGoogleDriveBackups('token', undefined, async () => jsonResponse({ nextPageToken: 'more' }))
  expect(result).toEqual({ files: [], nextPageToken: 'more' })
})

test('backup list pagination passes its opaque page token to Drive @pure', async () => {
  let requestedUrl = ''
  await listGoogleDriveBackups('token', 'page-token', async input => {
    requestedUrl = String(input)
    return jsonResponse({ files: [] })
  })
  expect(new URL(requestedUrl).searchParams.get('pageToken')).toBe('page-token')
})

test('reading a selected file verifies app-data membership before returning its bytes @pure', async () => {
  const contents = '{"type":"cluster"}'
  const requests: string[] = []
  const result = await readGoogleDriveFile('token', 'backup-1', async input => {
    const url = String(input)
    requests.push(url)
    if (url.includes('alt=media')) return new Response(contents)
    return jsonResponse({ id: 'backup-1', name: 'Backup.json', mimeType: 'application/json', spaces: ['appDataFolder'], trashed: false })
  })

  expect(result).toBe(contents)
  expect(requests).toHaveLength(2)
  expect(requests[0]).toContain('/files/backup-1?')
  expect(requests[1]).toContain('alt=media')
})

test('reading a file outside appDataFolder does not request its content @pure', async () => {
  const requests: string[] = []
  const error = await readGoogleDriveFile('token', 'drive-file', async input => {
    requests.push(String(input))
    return jsonResponse({ id: 'drive-file', name: 'Backup.json', mimeType: 'application/json', spaces: ['drive'], trashed: false })
  }).catch(reason => reason)

  expect(error).toBeInstanceOf(GoogleDriveApiError)
  expect(requests).toHaveLength(1)
})

test('caller abort cancels a pending media body after response headers @pure', async () => {
  const abortController = new AbortController()
  const signals: AbortSignal[] = []
  let bodyStartedResolve: (() => void) | undefined
  const bodyStarted = new Promise<void>(resolve => { bodyStartedResolve = resolve })
  let chunkSent = false
  let streamCanceled = false
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (init?.signal) signals.push(init.signal)
    if (!String(input).includes('alt=media')) {
      return jsonResponse({ id: 'backup-1', name: 'Backup.json', mimeType: 'application/json', spaces: ['appDataFolder'], trashed: false })
    }
    return new Response(new ReadableStream<Uint8Array>({
      pull(controller) {
        if (chunkSent) return
        chunkSent = true
        controller.enqueue(new TextEncoder().encode('{'))
        bodyStartedResolve?.()
      },
      cancel() { streamCanceled = true },
    }))
  }

  const pendingRead = readGoogleDriveFile('token', 'backup-1', fetcher, abortController.signal).catch(error => error)
  await bodyStarted
  abortController.abort()
  const error = await pendingRead

  expect(error).toBeInstanceOf(GoogleDriveApiError)
  expect(signals.length).toBe(2)
  expect(signals[1]?.aborted).toBe(true)
  expect(streamCanceled).toBe(true)
})

test('the Drive deadline remains active until a pending response body is consumed @pure', async () => {
  const originalSetTimeout = globalThis.setTimeout
  const originalClearTimeout = globalThis.clearTimeout
  const deadlines: Array<{ cleared: boolean, fire(): void }> = []
  let bodyStartedResolve: (() => void) | undefined
  const bodyStarted = new Promise<void>(resolve => { bodyStartedResolve = resolve })
  let chunkSent = false
  let streamCanceled = false
  globalThis.setTimeout = ((handler: TimerHandler, delay?: number) => {
    if (delay === 60_000 && typeof handler === 'function') {
      const deadline = { cleared: false, fire: () => handler() }
      deadlines.push(deadline)
      return deadline as unknown as ReturnType<typeof setTimeout>
    }
    return originalSetTimeout(handler, delay)
  }) as typeof setTimeout
  globalThis.clearTimeout = ((timer?: ReturnType<typeof setTimeout>) => {
    const deadlineHandle = timer as unknown as Array<{ cleared: boolean, fire(): void }>[number] | undefined
    const deadline = deadlines.find(candidate => candidate === deadlineHandle)
    if (deadline) {
      deadline.cleared = true
      return
    }
    originalClearTimeout(timer)
  }) as typeof clearTimeout

  try {
    const fetcher = async (input: RequestInfo | URL): Promise<Response> => {
      if (!String(input).includes('alt=media')) {
        return jsonResponse({ id: 'backup-1', name: 'Backup.json', mimeType: 'application/json', spaces: ['appDataFolder'], trashed: false })
      }
      return new Response(new ReadableStream<Uint8Array>({
        pull(controller) {
          if (chunkSent) return
          chunkSent = true
          controller.enqueue(new TextEncoder().encode('{'))
          bodyStartedResolve?.()
        },
        cancel() { streamCanceled = true },
      }))
    }

    const pendingRead = readGoogleDriveFile('token', 'backup-1', fetcher).catch(error => error)
    await bodyStarted
    expect(deadlines).toHaveLength(2)
    expect(deadlines[0]?.cleared).toBe(true)
    expect(deadlines[1]?.cleared).toBe(false)
    deadlines[1]?.fire()
    const error = await pendingRead

    expect(error).toBeInstanceOf(GoogleDriveApiError)
    expect(streamCanceled).toBe(true)
    expect(deadlines[1]?.cleared).toBe(true)
  } finally {
    globalThis.setTimeout = originalSetTimeout
    globalThis.clearTimeout = originalClearTimeout
  }
})

test('an upload aborted while its response body is pending skips reconciliation @pure', async () => {
  const abortController = new AbortController()
  const requests: string[] = []
  let bodyStartedResolve: (() => void) | undefined
  const bodyStarted = new Promise<void>(resolve => { bodyStartedResolve = resolve })
  let chunkSent = false
  let streamCanceled = false
  const fetcher = async (input: RequestInfo | URL): Promise<Response> => {
    requests.push(String(input))
    return new Response(new ReadableStream<Uint8Array>({
      pull(controller) {
        if (chunkSent) return
        chunkSent = true
        controller.enqueue(new TextEncoder().encode('{'))
        bodyStartedResolve?.()
      },
      cancel() { streamCanceled = true },
    }))
  }

  const pendingUpload = uploadGoogleDriveBackup({
    accessToken: 'token',
    fileId: 'backup-1',
    filename: 'Backup.json',
    contents: '{}',
    fetcher,
    signal: abortController.signal,
  }).catch(error => error)
  await bodyStarted
  abortController.abort()
  const error = await pendingUpload

  expect(error).toBeInstanceOf(GoogleDriveApiError)
  expect(requests).toHaveLength(1)
  expect(streamCanceled).toBe(true)
})

test('large backups use a resumable app-data upload without sending the token to the session URL @pure', async () => {
  const contents = 'x'.repeat(5 * 1024 * 1024 + 1)
  const sessionUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=session'
  const requests: Array<{ url: string, init?: RequestInit }> = []
  const saved = await uploadGoogleDriveBackup({
    accessToken: 'token',
    fileId: 'large-backup',
    filename: 'Large-jump-cluster.json',
    contents,
    fetcher: async (input, init) => {
      const url = String(input)
      requests.push({ url, init })
      if (init?.method === 'POST') return new Response(null, { headers: { Location: sessionUrl } })
      return jsonResponse(confirmedFile('large-backup', 'Large-jump-cluster.json', contents))
    },
  })

  expect(saved.id).toBe('large-backup')
  expect(requests).toHaveLength(2)
  expect(requests[0]?.url).toContain('uploadType=resumable')
  expect(String(requests[0]?.init?.body)).toContain('"parents":["appDataFolder"]')
  expect(requests[1]?.url).toBe(sessionUrl)
  expect(new Headers(requests[1]?.init?.headers).has('Authorization')).toBe(false)
  expect(requests[1]?.init?.body).toBe(contents)
})

test('the controller captures the applied map before Google access and retains uncertain retries by ID @pure', async () => {
  const workspace = createLocalWorkspace('Ember Reach', 'Vesper')
  const uploadIds: string[] = []
  const uploadNames: string[] = []
  let generateCount = 0
  let uploadCount = 0
  {
    const oldFetch = globalThis.fetch
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input))
      if (url.pathname.endsWith('/about')) return jsonResponse({ user: { permissionId: 'warden-account' } })
      if (url.pathname.endsWith('/files/generateIds')) {
        generateCount += 1
        return jsonResponse({ ids: [generateCount === 1 ? 'backup-1' : 'backup-2'], space: 'appDataFolder' })
      }
      if (url.pathname.includes('/upload/drive/v3/files')) {
        uploadCount += 1
        const body = String(init?.body)
        const id = body.match(/"id":"([^"]+)"/)?.[1]
        const name = body.match(/"name":"([^"]+)"/)?.[1]
        if (id) uploadIds.push(id)
        if (name) uploadNames.push(name)
        if (uploadCount === 1) throw new TypeError('lost acknowledgement')
        if (uploadCount === 2) return jsonResponse({ error: 'retry still uncertain' }, 409)
        const filename = name ?? 'backup.json'
        const contentsStart = body.indexOf('Content-Transfer-Encoding: 8bit\r\n\r\n') + 'Content-Transfer-Encoding: 8bit\r\n\r\n'.length
        const contentsEnd = body.lastIndexOf('\r\n--')
        const contents = body.slice(contentsStart, contentsEnd)
        return jsonResponse(confirmedFile(id ?? '', filename, contents))
      }
      if (url.pathname.endsWith('/files')) {
        const lastIndex = uploadIds.length - 1
        return jsonResponse({ incompleteSearch: false, files: lastIndex < 0 ? [] : [{
          id: uploadIds[lastIndex],
          name: uploadNames[lastIndex],
          createdTime: '2026-11-13T10:00:00.000Z',
          mimeType: 'application/json',
          spaces: ['appDataFolder'],
          trashed: false,
          capabilities: { canDelete: true },
        }] })
      }
      if (url.pathname.endsWith('/files/backup-1')) return jsonResponse({ error: 'temporarily unavailable' }, 403)
      throw new Error(`Unexpected Google Drive request: ${url.toString()}`)
    }

    const scope = effectScope()
    try {
      const controller = scope.run(() => useGoogleDriveBackup(() => workspace, readySignIn()))
      if (!controller) throw new Error('The backup controller did not initialize.')

      controller.activate()
      workspace.cluster.name = 'Edited after initial click'
      await expect.poll(() => controller.state.value).toBe('retry')
      expect(controller.message.value).toContain('Retry this same backup')
      expect(controller.lastSaved.value).toBeUndefined()
      controller.activate()
      await expect.poll(() => controller.state.value).toBe('retry')
      expect(uploadIds).toEqual(['backup-1', 'backup-1'])
      expect(uploadNames[0]).toContain('Ember Reach-jump-cluster-')

      controller.startNewBackupInstead()
      await expect.poll(() => controller.state.value).toBe('idle')
      expect(uploadIds).toEqual(['backup-1', 'backup-1', 'backup-2'])
      expect(controller.message.value).toContain('At least one earlier backup may already be saved')
      expect(controller.lastSaved.value).toMatchObject({ id: 'backup-2', name: uploadNames[2] })
      expect(controller.message.value).not.toContain(uploadNames[2])
    } finally {
      scope.stop()
      globalThis.fetch = oldFetch
    }
  }
})

test('the backup controller invalidates a cached token after a definitive Drive 401 @pure', async () => {
  const workspace = createLocalWorkspace('Ember Reach', 'Vesper')
  const invalidatedTokens: string[] = []
  let uploadCount = 0
  const oldFetch = globalThis.fetch
  globalThis.fetch = async input => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/about')) return jsonResponse({ user: { permissionId: 'warden-account' } })
    if (url.pathname.endsWith('/files/generateIds')) return jsonResponse({ ids: ['backup-401'], space: 'appDataFolder' })
    if (url.pathname.includes('/upload/drive/v3/files')) {
      uploadCount += 1
      return jsonResponse({ error: 'unauthorized' }, 401)
    }
    throw new Error(`Unexpected Google Drive request: ${url.toString()}`)
  }

  const scope = effectScope()
  try {
    const controller = scope.run(() => useGoogleDriveBackup(
      () => workspace,
      readySignIn(async () => 'expired-token', token => invalidatedTokens.push(token)),
    ))
    if (!controller) throw new Error('The backup controller did not initialize.')

    controller.activate()
    await expect.poll(() => controller.state.value).toBe('idle')
    expect(uploadCount).toBe(1)
    expect(invalidatedTokens).toEqual(['expired-token'])
    expect(controller.message.value).toMatch(/authorization expired/i)
  } finally {
    scope.stop()
    globalThis.fetch = oldFetch
  }
})

test('the controller does not announce a backup removed by the ten-file retention pass @pure', async () => {
  const workspace = createLocalWorkspace('Ember Reach', 'Vesper')
  const newerBackups = Array.from({ length: 10 }, (_, index) => datedDriveBackup(`newer-${String(index).padStart(2, '0')}`, index + 1))
  const files: Array<Record<string, unknown>> = [...newerBackups]
  let receipt: Record<string, unknown> | undefined
  let uploadCount = 0
  const oldFetch = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input))
    const method = init?.method ?? 'GET'
    if (url.pathname.endsWith('/about')) return jsonResponse({ user: { permissionId: 'test-account' } })
    if (url.pathname.endsWith('/generateIds')) return jsonResponse({ ids: ['older-receipt'], space: 'appDataFolder' })
    if (url.pathname.includes('/upload/drive/v3/files')) {
      uploadCount += 1
      const body = String(init?.body)
      const id = body.match(/"id":"([^"]+)"/)?.[1] ?? ''
      const name = body.match(/"name":"([^"]+)"/)?.[1] ?? 'backup.json'
      const contentsStart = body.indexOf('Content-Transfer-Encoding: 8bit\r\n\r\n') + 'Content-Transfer-Encoding: 8bit\r\n\r\n'.length
      const contentsEnd = body.lastIndexOf('\r\n--')
      receipt = {
        ...confirmedFile(id, name, body.slice(contentsStart, contentsEnd)),
        createdTime: '2026-11-13T09:00:00.000Z',
        capabilities: { canDelete: true },
      }
      files.push(receipt)
      return jsonResponse(receipt)
    }
    if (url.pathname === '/drive/v3/files') return jsonResponse({ incompleteSearch: false, files })
    if (url.pathname.startsWith('/drive/v3/files/')) {
      const id = decodeURIComponent(url.pathname.split('/').at(-1) ?? '')
      const file = files.find(candidate => candidate.id === id)
      if (!file) return jsonResponse({ error: 'not found' }, 404)
      if (method === 'DELETE') {
        const index = files.indexOf(file)
        files.splice(index, 1)
        return new Response(null, { status: 204 })
      }
      return jsonResponse(file)
    }
    throw new Error(`Unexpected Google Drive request: ${url.toString()}`)
  }

  const scope = effectScope()
  try {
    const controller = scope.run(() => useGoogleDriveBackup(() => workspace, readySignIn()))
    if (!controller) throw new Error('The backup controller did not initialize.')

    controller.activate()
    await expect.poll(() => controller.state.value).toBe('idle')
    expect(uploadCount).toBe(1)
    expect(files).toHaveLength(10)
    expect(files.some(file => file.id === 'older-receipt')).toBe(false)
    expect(controller.lastSaved.value).toBeUndefined()
    expect(controller.message.value).toMatch(/upload was confirmed, but this backup was removed/i)
  } finally {
    scope.stop()
    globalThis.fetch = oldFetch
  }
})

test('a cleanup retry keeps the confirmed upload and never uploads it again @pure', async () => {
  const workspace = createLocalWorkspace('Ember Reach', 'Vesper')
  const invalidatedTokens: string[] = []
  const uploadedIds: string[] = []
  const olderBackups = Array.from({ length: 10 }, (_, index) => datedDriveBackup(`old-${String(index).padStart(2, '0')}`, index - 20))
  const remaining = [...olderBackups]
  let listCount = 0
  let uploadCount = 0
  let generateCount = 0
  let receipt: Record<string, unknown> | undefined
  const oldFetch = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input))
    const method = init?.method ?? 'GET'
    if (url.pathname.endsWith('/about')) return jsonResponse({ user: { permissionId: 'test-account' } })
    if (url.pathname.endsWith('/generateIds')) {
      generateCount += 1
      return jsonResponse({ ids: ['receipt-id'], space: 'appDataFolder' })
    }
    if (url.pathname.includes('/upload/drive/v3/files')) {
      uploadCount += 1
      const body = String(init?.body)
      const id = body.match(/"id":"([^"]+)"/)?.[1] ?? ''
      const name = body.match(/"name":"([^"]+)"/)?.[1] ?? 'backup.json'
      uploadedIds.push(id)
      const contentsStart = body.indexOf('Content-Transfer-Encoding: 8bit\r\n\r\n') + 'Content-Transfer-Encoding: 8bit\r\n\r\n'.length
      const contentsEnd = body.lastIndexOf('\r\n--')
      receipt = {
        ...confirmedFile(id, name, body.slice(contentsStart, contentsEnd)),
        capabilities: { canDelete: true },
      }
      return jsonResponse(receipt)
    }
    if (url.pathname === '/drive/v3/files') {
      listCount += 1
      if (listCount === 1) return jsonResponse({ error: 'authorization expired' }, 401)
      return jsonResponse({ incompleteSearch: false, files: [...remaining, receipt] })
    }
    if (url.pathname.startsWith('/drive/v3/files/')) {
      const id = decodeURIComponent(url.pathname.split('/').at(-1) ?? '')
      if (method === 'DELETE') {
        const index = remaining.findIndex(file => file.id === id)
        if (index >= 0) remaining.splice(index, 1)
        return new Response(null, { status: 204 })
      }
      const file = remaining.find(candidate => candidate.id === id) ?? (receipt?.id === id ? receipt : undefined)
      return file ? jsonResponse(file) : jsonResponse({ error: 'not found' }, 404)
    }
    throw new Error(`Unexpected Google Drive request: ${url.toString()}`)
  }

  const tokenRequests: string[] = []
  const scope = effectScope()
  try {
    const controller = scope.run(() => useGoogleDriveBackup(
      () => workspace,
      readySignIn(async () => {
        const token = `token-${tokenRequests.length + 1}`
        tokenRequests.push(token)
        return token
      }, token => invalidatedTokens.push(token)),
    ))
    if (!controller) throw new Error('The backup controller did not initialize.')

    controller.activate()
    await expect.poll(() => controller.state.value).toBe('cleanup-retry')
    expect(controller.lastSaved.value).toMatchObject({ id: 'receipt-id' })
    expect(controller.buttonLabel.value).toBe('Retry cleanup')
    expect(controller.message.value).toMatch(/backup was saved, but older backups could not all be removed/i)
    expect(invalidatedTokens).toEqual(['token-1'])

    controller.activate()
    await expect.poll(() => controller.state.value).toBe('idle')
    expect(tokenRequests).toEqual(['token-1', 'token-2'])
    expect(uploadCount).toBe(1)
    expect(generateCount).toBe(1)
    expect(uploadedIds).toEqual(['receipt-id'])
    expect(remaining).toHaveLength(9)
  } finally {
    scope.stop()
    globalThis.fetch = oldFetch
  }
})

test('closing Google Drive authorization reports a backup cancellation without inline status @pure', async () => {
  const workspace = createLocalWorkspace('Ember Reach', 'Vesper')
  let canceledCount = 0
  const scope = effectScope()
  try {
    const controller = scope.run(() => useGoogleDriveBackup(
      () => workspace,
      readySignIn(async () => { throw new GoogleDriveCancelledError() }),
      { onCanceled: () => { canceledCount += 1 } },
    ))
    if (!controller) throw new Error('The backup controller did not initialize.')

    controller.activate()
    await expect.poll(() => controller.state.value).toBe('idle')
    expect(canceledCount).toBe(1)
    expect(controller.message.value).toBe('')
  } finally {
    scope.stop()
  }
})

test('an uncertain backup retry verifies account identity and can resume under the original account @pure', async () => {
  const workspace = createLocalWorkspace('Ember Reach', 'Vesper')
  const tokenRequests: string[] = []
  const invalidatedTokens: string[] = []
  const uploadedIds: string[] = []
  const uploadedNames: string[] = []
  let accountRead = 0
  let generateCount = 0
  let uploadCount = 0
  const signIn = readySignIn(async () => {
    const token = `token-${tokenRequests.length + 1}`
    tokenRequests.push(token)
    return token
  }, token => invalidatedTokens.push(token))
  const oldFetch = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/about')) {
      accountRead += 1
      return jsonResponse({ user: { permissionId: accountRead === 2 ? 'different-account' : 'original-account' } })
    }
    if (url.pathname.endsWith('/files/generateIds')) {
      generateCount += 1
      return jsonResponse({ ids: ['same-backup-id'], space: 'appDataFolder' })
    }
    if (url.pathname.includes('/upload/drive/v3/files')) {
      uploadCount += 1
      const body = String(init?.body)
      const id = body.match(/"id":"([^"]+)"/)?.[1] ?? ''
      const filename = body.match(/"name":"([^"]+)"/)?.[1] ?? 'backup.json'
      uploadedIds.push(id)
      uploadedNames.push(filename)
      if (uploadCount === 1) throw new TypeError('The first acknowledgement was lost.')
      const contentsStart = body.indexOf('Content-Transfer-Encoding: 8bit\r\n\r\n') + 'Content-Transfer-Encoding: 8bit\r\n\r\n'.length
      const contentsEnd = body.lastIndexOf('\r\n--')
      return jsonResponse(confirmedFile(id, filename, body.slice(contentsStart, contentsEnd)))
    }
    if (url.pathname.endsWith('/files')) {
      return jsonResponse({ incompleteSearch: false, files: [{
        id: 'same-backup-id',
        name: uploadedNames.at(-1),
        createdTime: '2026-11-13T10:00:00.000Z',
        mimeType: 'application/json',
        spaces: ['appDataFolder'],
        trashed: false,
        capabilities: { canDelete: true },
      }] })
    }
    if (url.pathname.endsWith('/files/same-backup-id')) return jsonResponse({ error: 'temporarily unavailable' }, 403)
    throw new Error(`Unexpected Google Drive request: ${url.toString()}`)
  }

  const scope = effectScope()
  try {
    const controller = scope.run(() => useGoogleDriveBackup(() => workspace, signIn))
    if (!controller) throw new Error('The backup controller did not initialize.')

    controller.activate()
    await expect.poll(() => controller.state.value).toBe('retry')
    controller.activate()
    await expect.poll(() => controller.state.value).toBe('retry')
    expect(controller.message.value).toMatch(/differs from the account that started this backup/i)
    expect(uploadCount).toBe(1)
    expect(invalidatedTokens).toEqual(['token-2'])

    controller.activate()
    await expect.poll(() => controller.state.value).toBe('idle')
    expect(tokenRequests).toEqual(['token-1', 'token-2', 'token-3'])
    expect(generateCount).toBe(1)
    expect(uploadedIds).toEqual(['same-backup-id', 'same-backup-id'])
  } finally {
    scope.stop()
    globalThis.fetch = oldFetch
  }
})

test('canceling OAuth for an uncertain retry leaves a fresh signal for the same backup ID @pure', async () => {
  const workspace = createLocalWorkspace('Ember Reach', 'Vesper')
  const uploadedIds: string[] = []
  const uploadedNames: string[] = []
  const authorizationSignals: AbortSignal[] = []
  let requestCount = 0
  let generateCount = 0
  let uploadCount = 0
  let canceledCount = 0
  const signIn = readySignIn((signal) => {
    requestCount += 1
    if (signal) authorizationSignals.push(signal)
    if (signal?.aborted) return Promise.reject(new Error('The previous retry signal is aborted.'))
    if (requestCount === 2) {
      return new Promise<string>((resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new Error('Authorization was canceled.')), { once: true })
      })
    }
    return Promise.resolve('short-lived-token')
  })

  const oldFetch = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/about')) return jsonResponse({ user: { permissionId: 'warden-account' } })
    if (url.pathname.endsWith('/files/generateIds')) {
      generateCount += 1
      return jsonResponse({ ids: ['backup-1'], space: 'appDataFolder' })
    }
    if (url.pathname.includes('/upload/drive/v3/files')) {
      uploadCount += 1
      const body = String(init?.body)
      const id = body.match(/"id":"([^"]+)"/)?.[1]
      const filename = body.match(/"name":"([^"]+)"/)?.[1] ?? 'backup.json'
      if (id) uploadedIds.push(id)
      uploadedNames.push(filename)
      if (uploadCount === 1) throw new TypeError('The first acknowledgement was lost.')
      const contentsStart = body.indexOf('Content-Transfer-Encoding: 8bit\r\n\r\n') + 'Content-Transfer-Encoding: 8bit\r\n\r\n'.length
      const contentsEnd = body.lastIndexOf('\r\n--')
      const contents = body.slice(contentsStart, contentsEnd)
      return jsonResponse(confirmedFile(id ?? '', filename, contents))
    }
    if (url.pathname.endsWith('/files')) {
      return jsonResponse({ incompleteSearch: false, files: [{
        id: 'backup-1',
        name: uploadedNames.at(-1),
        createdTime: '2026-11-13T10:00:00.000Z',
        mimeType: 'application/json',
        spaces: ['appDataFolder'],
        trashed: false,
        capabilities: { canDelete: true },
      }] })
    }
    if (url.pathname.endsWith('/files/backup-1')) return jsonResponse({ error: 'temporarily unavailable' }, 403)
    throw new Error(`Unexpected Google Drive request: ${url.toString()}`)
  }

  const scope = effectScope()
  try {
    const controller = scope.run(() => useGoogleDriveBackup(() => workspace, signIn, {
      onCanceled: () => { canceledCount += 1 },
    }))
    if (!controller) throw new Error('The backup controller did not initialize.')

    controller.activate()
    await expect.poll(() => controller.state.value).toBe('retry')
    controller.activate()
    await expect.poll(() => requestCount).toBe(2)
    expect(controller.state.value).toBe('authorizing')
    controller.cancelBeforeUpload()
    controller.cancelBeforeUpload()
    expect(controller.state.value).toBe('retry')
    expect(authorizationSignals[1]?.aborted).toBe(true)
    expect(canceledCount).toBe(1)
    expect(controller.message.value).toMatch(/earlier upload outcome is still unconfirmed/i)

    controller.activate()
    await expect.poll(() => controller.state.value).toBe('idle')
    expect(generateCount).toBe(1)
    expect(uploadedIds).toEqual(['backup-1', 'backup-1'])
    expect(authorizationSignals[2]?.aborted).toBe(false)
    expect(canceledCount).toBe(1)
  } finally {
    scope.stop()
    globalThis.fetch = oldFetch
  }
})
