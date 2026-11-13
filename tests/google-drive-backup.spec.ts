import { computed, effectScope, ref } from 'vue'
import { expect, test } from './fixtures'
import { createLocalWorkspace, exportJumpCluster } from '../domain/workspace'
import { useGoogleDriveBackup } from '../composables/useGoogleDriveBackup'
import type { GoogleDriveSignInController, GoogleDriveSignInStatus } from '../composables/useGoogleDriveSignIn'
import { readGoogleDriveConfig } from '../utils/google-drive-config'
import { createGoogleDriveBackupSnapshot } from '../utils/google-drive-backup-snapshot'
import {
  GoogleDriveApiError,
  generateGoogleDriveFileId,
  listGoogleDriveBackups,
  readGoogleDriveFile,
  uploadGoogleDriveBackup,
} from '../utils/google-drive-api'

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

function readySignIn(
  requestAccessToken: (signal?: AbortSignal) => Promise<string> = async () => 'short-lived-token',
): GoogleDriveSignInController {
  const status = ref<GoogleDriveSignInStatus>('ready')
  return {
    status,
    message: ref(''),
    ready: computed(() => status.value === 'ready'),
    retryLoading: async () => undefined,
    requestAccessToken,
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
      controller.activate()
      await expect.poll(() => controller.state.value).toBe('retry')
      expect(uploadIds).toEqual(['backup-1', 'backup-1'])
      expect(uploadNames[0]).toContain('Ember Reach-jump-cluster-')

      controller.startNewBackupInstead()
      await expect.poll(() => controller.state.value).toBe('idle')
      expect(uploadIds).toEqual(['backup-1', 'backup-1', 'backup-2'])
      expect(controller.message.value).toContain('At least one earlier backup may already be saved')
      expect(controller.message.value).toContain('Saved Edited after initial click-jump-cluster-')
      expect(controller.message.value).toContain('Google Drive app data')
    } finally {
      scope.stop()
      globalThis.fetch = oldFetch
    }
  }
})

test('canceling OAuth for an uncertain retry leaves a fresh signal for the same backup ID @pure', async () => {
  const workspace = createLocalWorkspace('Ember Reach', 'Vesper')
  const uploadedIds: string[] = []
  const authorizationSignals: AbortSignal[] = []
  let requestCount = 0
  let generateCount = 0
  let uploadCount = 0
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
      if (uploadCount === 1) throw new TypeError('The first acknowledgement was lost.')
      const contentsStart = body.indexOf('Content-Transfer-Encoding: 8bit\r\n\r\n') + 'Content-Transfer-Encoding: 8bit\r\n\r\n'.length
      const contentsEnd = body.lastIndexOf('\r\n--')
      const contents = body.slice(contentsStart, contentsEnd)
      return jsonResponse(confirmedFile(id ?? '', filename, contents))
    }
    if (url.pathname.endsWith('/files/backup-1')) return jsonResponse({ error: 'temporarily unavailable' }, 403)
    throw new Error(`Unexpected Google Drive request: ${url.toString()}`)
  }

  const scope = effectScope()
  try {
    const controller = scope.run(() => useGoogleDriveBackup(() => workspace, signIn))
    if (!controller) throw new Error('The backup controller did not initialize.')

    controller.activate()
    await expect.poll(() => controller.state.value).toBe('retry')
    controller.activate()
    await expect.poll(() => requestCount).toBe(2)
    expect(controller.state.value).toBe('authorizing')
    controller.cancelBeforeUpload()
    expect(controller.state.value).toBe('retry')
    expect(authorizationSignals[1]?.aborted).toBe(true)

    controller.activate()
    await expect.poll(() => controller.state.value).toBe('idle')
    expect(generateCount).toBe(1)
    expect(uploadedIds).toEqual(['backup-1', 'backup-1'])
    expect(authorizationSignals[2]?.aborted).toBe(false)
  } finally {
    scope.stop()
    globalThis.fetch = oldFetch
  }
})
