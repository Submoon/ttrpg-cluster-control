import { effectScope } from 'vue'
import { expect, test } from './fixtures'
import { createLocalWorkspace, exportJumpCluster } from '../domain/workspace'
import { useGoogleDriveBackup } from '../composables/useGoogleDriveBackup'
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
  const fakeGoogle = {
    accounts: {
      oauth2: {
        initTokenClient: (options: { callback: (response: { access_token: string, scope: string }) => void }) => ({
          requestAccessToken: () => options.callback({
            access_token: 'short-lived-token',
            scope: 'https://www.googleapis.com/auth/drive.appdata',
          }),
        }),
      },
    },
  }

  await withWindow({ google: fakeGoogle }, async () => {
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
      const controller = scope.run(() => useGoogleDriveBackup(() => workspace, {
        public: { googleDriveClientId: 'client-id' },
      }))
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
  })
})

async function withWindow<T>(fakeWindow: object, run: () => Promise<T>): Promise<T> {
  const oldDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { setTimeout: globalThis.setTimeout.bind(globalThis), clearTimeout: globalThis.clearTimeout.bind(globalThis), ...fakeWindow },
  })
  try {
    return await run()
  } finally {
    if (oldDescriptor) Object.defineProperty(globalThis, 'window', oldDescriptor)
    else Reflect.deleteProperty(globalThis, 'window')
  }
}
