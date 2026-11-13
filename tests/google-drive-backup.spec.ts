import { expect, test } from './fixtures'
import { effectScope } from 'vue'
import {
  GoogleDriveApiError,
  generateGoogleDriveFileId,
  verifyPrivateGoogleDriveFolder,
  uploadGoogleDriveBackup,
} from '../utils/google-drive-api'
import { createLocalWorkspace, exportJumpCluster } from '../domain/workspace'
import { createGoogleDriveBackupSnapshot } from '../utils/google-drive-backup-snapshot'
import { useGoogleDriveBackup } from '../composables/useGoogleDriveBackup'
import {
  GoogleDriveCancelledError,
  pickGoogleDriveBackupFile,
  requestGoogleDriveAccessToken,
} from '../utils/google-drive-picker'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

test('a private writable folder can receive a backup @pure', async () => {
  const requests: string[] = []
  const fetcher = async (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input)
    requests.push(url)
    if (url.includes('/permissions')) {
      return jsonResponse({
        permissions: [{ id: 'owner', type: 'user', role: 'owner', emailAddress: 'warden@example.com' }],
      })
    }

    return jsonResponse({
      id: 'folder-1',
      name: 'Private backups',
      mimeType: 'application/vnd.google-apps.folder',
      ownedByMe: true,
      shared: false,
      trashed: false,
      capabilities: { canAddChildren: true },
    })
  }

  const folder = await verifyPrivateGoogleDriveFolder('token', 'folder-1', fetcher)

  expect(folder).toEqual({ id: 'folder-1', name: 'Private backups' })
  expect(requests).toHaveLength(2)
})

test('a shared or incomplete folder permission list is refused @pure', async () => {
  const folderResponse = jsonResponse({
    id: 'folder-1',
    name: 'Shared backups',
    mimeType: 'application/vnd.google-apps.folder',
    ownedByMe: true,
    shared: false,
    trashed: false,
    capabilities: { canAddChildren: true },
  })
  const shared = await verifyPrivateGoogleDriveFolder('token', 'folder-1', async input => {
    if (String(input).includes('/permissions')) return jsonResponse({
      permissions: [
        { id: 'owner', type: 'user', role: 'owner' },
        { id: 'link', type: 'anyone', role: 'reader' },
      ],
    })
    return jsonResponse({
      id: 'folder-1',
      name: 'Shared backups',
      mimeType: 'application/vnd.google-apps.folder',
      ownedByMe: true,
      shared: true,
      trashed: false,
      capabilities: { canAddChildren: true },
    })
  }).catch(error => error)

  const incomplete = await verifyPrivateGoogleDriveFolder('token', 'folder-1', async input => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/permissions') && !url.searchParams.has('pageToken')) {
      return jsonResponse({
        permissions: [{ id: 'owner', type: 'user', role: 'owner' }],
        nextPageToken: 'more',
      })
    }
    if (url.pathname.endsWith('/permissions')) {
      return jsonResponse({ permissions: [{ id: 'domain', type: 'domain', role: 'reader' }] })
    }
    return folderResponse
  }).catch(error => error)

  expect(shared).toBeInstanceOf(Error)
  expect(incomplete).toBeInstanceOf(Error)
})

test('a backup snapshot contains a dated complete export captured before later edits @pure', async () => {
  const workspace = createLocalWorkspace('Ember Reach', 'Vesper')
  const expectedExport = JSON.parse(JSON.stringify(exportJumpCluster(workspace)))
  const snapshot = createGoogleDriveBackupSnapshot(workspace, new Date('2026-11-13T10:00:00.000Z'))

  workspace.cluster.name = 'Later edit'

  expect(snapshot.filename).toBe('Ember Reach-jump-cluster-2026-11-13-10-00-00-000Z.json')
  expect(JSON.parse(snapshot.contents)).toEqual(expectedExport)
  expect(JSON.parse(snapshot.contents).cluster.name).toBe('Ember Reach')
})

test('a generated Drive ID is requested once for a logical backup operation @pure', async () => {
  const urls: string[] = []
  const fileId = await generateGoogleDriveFileId('token', async input => {
    urls.push(String(input))
    return jsonResponse({ ids: ['backup-1'] })
  })

  expect(fileId).toBe('backup-1')
  expect(urls[0]).toContain('/files/generateIds?')
  expect(urls[0]).toContain('space=drive')
})

test('a confirmed upload uses the upload endpoint, bypasses default visibility, and stores the dated JSON file @pure', async () => {
  const contents = '{"format":"map","type":"cluster"}'
  let request: { url: string, init?: RequestInit } | undefined
  const result = await uploadGoogleDriveBackup({
    accessToken: 'token',
    folderId: 'folder-1',
    folderName: 'Private backups',
    fileId: 'backup-1',
    filename: 'Ember-jump-cluster-2026-11-13-100000.json',
    contents,
    fetcher: async (input, init) => {
      request = { url: String(input), init }
      return jsonResponse({
        id: 'backup-1',
        name: 'Ember-jump-cluster-2026-11-13-100000.json',
        mimeType: 'application/json',
        parents: ['folder-1'],
        size: String(new TextEncoder().encode(contents).byteLength),
        trashed: false,
        webViewLink: 'https://drive.google.com/file/d/backup-1/view',
      })
    },
  })

  expect(request?.url).toContain('https://www.googleapis.com/upload/drive/v3/files?')
  expect(request?.url).toContain('ignoreDefaultVisibility=true')
  expect(request?.init?.method).toBe('POST')
  expect(String(request?.init?.body)).toContain('"id":"backup-1"')
  expect(String(request?.init?.body)).toContain(contents)
  expect(result).toMatchObject({
    id: 'backup-1',
    folderId: 'folder-1',
    folderName: 'Private backups',
    folderUrl: 'https://drive.google.com/drive/folders/folder-1',
  })
})

test('a lost upload acknowledgement is reconciled against its pre-generated Drive ID @pure', async () => {
  const contents = '{"format":"map","type":"cluster"}'
  const requests: Array<{ url: string, method: string }> = []
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    requests.push({ url, method })
    if (method === 'POST') throw new TypeError('connection lost after dispatch')
    if (url.includes('alt=media')) return new Response(contents)
    return jsonResponse({
      id: 'backup-1',
      name: 'Ember-jump-cluster-2026-11-13-100000.json',
      mimeType: 'application/json',
      parents: ['folder-1'],
      size: String(new TextEncoder().encode(contents).byteLength),
      trashed: false,
    })
  }

  const result = await uploadGoogleDriveBackup({
    accessToken: 'token',
    folderId: 'folder-1',
    folderName: 'Private backups',
    fileId: 'backup-1',
    filename: 'Ember-jump-cluster-2026-11-13-100000.json',
    contents,
    fetcher,
  })

  expect(result.id).toBe('backup-1')
  expect(result.name).toBe('Ember-jump-cluster-2026-11-13-100000.json')
  expect(requests.map(request => request.method)).toEqual(['POST', 'GET', 'GET'])
  expect(requests[1]?.url).toContain('/files/backup-1?')
  expect(requests[2]?.url).toContain('alt=media')
})

test('a JSON backup larger than five MiB uses resumable upload and rechecks privacy before file data @pure', async () => {
  const contents = 'x'.repeat(5 * 1024 * 1024 + 1)
  const sessionUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=session'
  const requests: Array<{ url: string, method: string, init?: RequestInit }> = []
  const order: string[] = []
  const result = await uploadGoogleDriveBackup({
    accessToken: 'token',
    folderId: 'folder-1',
    folderName: 'Private backups',
    fileId: 'backup-large',
    filename: 'Large-jump-cluster-2026-11-13.json',
    contents,
    verifyBeforeMediaUpload: async () => { order.push('verified-private-folder') },
    fetcher: async (input, init) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      requests.push({ url, method, init })
      order.push(method)
      if (method === 'POST') return new Response(null, { status: 200, headers: { Location: sessionUrl } })
      return jsonResponse({
        id: 'backup-large',
        name: 'Large-jump-cluster-2026-11-13.json',
        mimeType: 'application/json',
        parents: ['folder-1'],
        size: String(new TextEncoder().encode(contents).byteLength),
        trashed: false,
      })
    },
  })

  expect(result.id).toBe('backup-large')
  expect(requests).toHaveLength(2)
  expect(requests[0]?.url).toContain('/upload/drive/v3/files?')
  expect(requests[0]?.url).toContain('uploadType=resumable')
  expect(order).toEqual(['POST', 'verified-private-folder', 'PUT'])
  expect(new Headers(requests[0]?.init?.headers).get('X-Upload-Content-Length'))
    .toBe(String(new TextEncoder().encode(contents).byteLength))
  expect(requests[1]?.url).toBe(sessionUrl)
  expect(requests[1]?.method).toBe('PUT')
  expect(new Headers(requests[1]?.init?.headers).get('Content-Type')).toContain('application/json')
  expect(new Headers(requests[1]?.init?.headers).has('Content-Range')).toBe(false)
  expect(new Headers(requests[1]?.init?.headers).has('Authorization')).toBe(false)
})

test('a failed second privacy check stops a resumable upload before sending file bytes @pure', async () => {
  const contents = 'x'.repeat(5 * 1024 * 1024 + 1)
  const requests: string[] = []
  const error = await uploadGoogleDriveBackup({
    accessToken: 'token',
    folderId: 'folder-1',
    folderName: 'Private backups',
    fileId: 'backup-large',
    filename: 'Large-jump-cluster-2026-11-13.json',
    contents,
    verifyBeforeMediaUpload: async () => {
      throw new GoogleDriveApiError('private-folder-required', 'The folder is no longer private.')
    },
    fetcher: async (input, init) => {
      requests.push(`${init?.method ?? 'GET'} ${String(input)}`)
      return new Response(null, {
        status: 200,
        headers: { Location: 'https://www.googleapis.com/upload/drive/v3/files?upload_id=session' },
      })
    },
  }).catch(value => value)

  expect(error).toMatchObject({ code: 'private-folder-required', outcomeUncertain: false })
  expect(requests).toHaveLength(1)
  expect(requests[0]).toContain('POST https://www.googleapis.com/upload/drive/v3/files?')
})

test('a closed Google authorization popup is reported as cancellation @pure', async () => {
  const error = await withWindow({
    google: {
      accounts: {
        oauth2: {
          initTokenClient: (options: { callback: (response: { error: string, scope?: string }) => void }) => ({
            requestAccessToken: () => options.callback({ error: 'access_denied' }),
          }),
        },
      },
    },
  }, async () => requestGoogleDriveAccessToken('client-id').catch(value => value))

  expect(error).toBeInstanceOf(GoogleDriveCancelledError)
})

test('the token request asks only for drive.file and checks the granted scope @pure', async () => {
  let optionsSeen: { scope: string, include_granted_scopes: false } | undefined
  const token = await withWindow({
    google: {
      accounts: {
        oauth2: {
          initTokenClient: (options: {
            scope: string
            include_granted_scopes: false
            callback: (response: { access_token: string, scope: string }) => void
          }) => {
            optionsSeen = options
            return { requestAccessToken: () => options.callback({
              access_token: 'short-lived-token',
              scope: 'https://www.googleapis.com/auth/drive.file',
            }) }
          },
        },
      },
    },
  }, () => requestGoogleDriveAccessToken('client-id'))

  expect(token).toBe('short-lived-token')
  expect(optionsSeen).toMatchObject({
    scope: 'https://www.googleapis.com/auth/drive.file',
    include_granted_scopes: false,
  })
})

test('Google Picker file selection keeps manually uploaded JSON files eligible @pure', async () => {
  let selectedView: FakeDocsView | undefined
  let pickerCallback: ((data: { action: string, docs: Array<{ id: string, name: string, mimeType: string }> }) => void) | undefined
  const visibility: boolean[] = []
  const fakeGoogle = {
    accounts: { oauth2: {} },
    picker: {
      ViewId: { FOLDERS: 'folders', DOCS: 'docs' },
      DocsViewMode: { LIST: 'list' },
      Action: { PICKED: 'picked', CANCEL: 'cancel', ERROR: 'error' },
      DocsView: class extends FakeDocsView {
        constructor(viewId: string) {
          super(viewId)
        }
      },
      PickerBuilder: class {
        addView(view: FakeDocsView) { selectedView = view; return this }
        setOAuthToken() { return this }
        setDeveloperKey() { return this }
        setAppId() { return this }
        setCallback(callback: typeof pickerCallback) { pickerCallback = callback; return this }
        build() {
          return { setVisible: (visible: boolean) => {
            visibility.push(visible)
            if (visible) pickerCallback?.({ action: 'picked', docs: [{ id: 'json-file', name: 'backup.json', mimeType: 'application/json' }] })
          } }
        }
      },
    },
  }

  const selected = await withWindow({ google: fakeGoogle }, () => pickGoogleDriveBackupFile({
    accessToken: 'token',
    config: { apiKey: 'api-key', projectNumber: '12345' },
  }))

  expect(selected).toEqual({ id: 'json-file', name: 'backup.json', mimeType: 'application/json' })
  expect(selectedView?.viewId).toBe('docs')
  expect(selectedView?.mimeTypes).toBeUndefined()
  expect(selectedView?.mode).toBe('list')
  expect(visibility).toEqual([true, false])
})

test('aborting a Google Picker action hides and settles the picker @pure', async () => {
  let pickerCallback: ((data: { action: string }) => void) | undefined
  const visibility: boolean[] = []
  const fakeGoogle = {
    accounts: { oauth2: {} },
    picker: {
      ViewId: { FOLDERS: 'folders', DOCS: 'docs' },
      DocsViewMode: { LIST: 'list' },
      Action: { PICKED: 'picked', CANCEL: 'cancel', ERROR: 'error' },
      DocsView: class extends FakeDocsView {},
      PickerBuilder: class {
        addView() { return this }
        setOAuthToken() { return this }
        setDeveloperKey() { return this }
        setAppId() { return this }
        setCallback(callback: typeof pickerCallback) { pickerCallback = callback; return this }
        build() {
          return { setVisible: (visible: boolean) => { visibility.push(visible) } }
        }
      },
    },
  }

  const error = await withWindow({ google: fakeGoogle }, async () => {
    const controller = new AbortController()
    const pending = pickGoogleDriveBackupFile({
      accessToken: 'token',
      config: { apiKey: 'api-key', projectNumber: '12345' },
      signal: controller.signal,
    }).catch(value => value)
    await new Promise(resolve => setTimeout(resolve, 0))
    controller.abort()
    return pending
  })

  expect(error).toBeInstanceOf(GoogleDriveCancelledError)
  expect(pickerCallback).toBeDefined()
  expect(visibility).toEqual([true, false])
})

test('a Google Picker deadline hides the picker and settles the pending selection @pure', async () => {
  const visibility: boolean[] = []
  const fakeGoogle = {
    accounts: { oauth2: {} },
    picker: {
      ViewId: { FOLDERS: 'folders', DOCS: 'docs' },
      DocsViewMode: { LIST: 'list' },
      Action: { PICKED: 'picked', CANCEL: 'cancel', ERROR: 'error' },
      DocsView: class extends FakeDocsView {},
      PickerBuilder: class {
        addView() { return this }
        setOAuthToken() { return this }
        setDeveloperKey() { return this }
        setAppId() { return this }
        setCallback() { return this }
        build() { return { setVisible: (visible: boolean) => { visibility.push(visible) } } }
      },
    },
  }

  const error = await withWindow({
    google: fakeGoogle,
    setTimeout: (callback: () => void) => { queueMicrotask(callback); return 1 },
    clearTimeout: () => undefined,
  }, () => pickGoogleDriveBackupFile({
    accessToken: 'token',
    config: { apiKey: 'api-key', projectNumber: '12345' },
  }).catch(value => value))

  expect(error).toMatchObject({ message: 'Google Drive Picker did not finish. Try again.' })
  expect(visibility).toEqual([true, false])
})

test('a 409 with an unavailable reconciliation read stays retryable under the same Drive ID @pure', async () => {
  const error = await uploadGoogleDriveBackup({
    accessToken: 'token',
    folderId: 'folder-1',
    folderName: 'Private backups',
    fileId: 'backup-1',
    filename: 'Ember-jump-cluster-2026-11-13.json',
    contents: '{"type":"cluster"}',
    fetcher: async (input, init) => {
      if (init?.method === 'POST') return jsonResponse({ error: { message: 'Conflict' } }, 409)
      return jsonResponse({ error: { message: 'Access temporarily unavailable' } }, 403)
    },
  }).catch(value => value)

  expect(error).toMatchObject({ code: 'outcome-uncertain', outcomeUncertain: true })
})

test('a timed-out upload request returns an uncertain result for the same retained ID @pure', async () => {
  const originalSetTimeout = globalThis.setTimeout
  let requestCount = 0
  globalThis.setTimeout = ((handler: TimerHandler) => {
    if (typeof handler === 'function') queueMicrotask(() => handler())
    return 1 as unknown as ReturnType<typeof setTimeout>
  }) as unknown as typeof setTimeout

  let error: unknown
  try {
    error = await uploadGoogleDriveBackup({
      accessToken: 'token',
      folderId: 'folder-1',
      folderName: 'Private backups',
      fileId: 'backup-1',
      filename: 'Ember-jump-cluster-2026-11-13.json',
      contents: '{"type":"cluster"}',
      fetcher: async () => {
        requestCount += 1
        return new Promise<Response>(() => undefined)
      },
    }).catch(value => value)
  } finally {
    globalThis.setTimeout = originalSetTimeout
  }

  expect(error).toMatchObject({ code: 'outcome-uncertain', outcomeUncertain: true })
  expect(requestCount).toBe(2)
})

test('an unconfirmed retry remains available after 404 until explicitly replaced by a new backup @pure', async () => {
  const workspace = createLocalWorkspace('Ember Reach', 'Vesper')
  const uploadIds: string[] = []
  const requestUrls: string[] = []
  let createIdCount = 0
  let uploadCount = 0
  const fakeGoogle = {
    accounts: {
      oauth2: {
        initTokenClient: (options: { callback: (response: { access_token: string, scope: string }) => void }) => ({
          requestAccessToken: () => options.callback({
            access_token: 'short-lived-token',
            scope: 'https://www.googleapis.com/auth/drive.file',
          }),
        }),
      },
    },
    picker: {
      ViewId: { FOLDERS: 'folders', DOCS: 'docs' },
      DocsViewMode: { LIST: 'list' },
      Action: { PICKED: 'picked', CANCEL: 'cancel', ERROR: 'error' },
      DocsView: class extends FakeDocsView {},
      PickerBuilder: class {
        callback?: (data: { action: string, docs: Array<{ id: string, name: string, mimeType: string }> }) => void
        addView() { return this }
        setOAuthToken() { return this }
        setDeveloperKey() { return this }
        setAppId() { return this }
        setCallback(callback: NonNullable<this['callback']>) { this.callback = callback; return this }
        build() {
          return { setVisible: (visible: boolean) => {
            if (visible) this.callback?.({
              action: 'picked',
              docs: [{ id: 'folder-1', name: 'Private backups', mimeType: 'application/vnd.google-apps.folder' }],
            })
          } }
        }
      },
    },
  }

  await withWindow({ google: fakeGoogle }, async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input))
      const method = init?.method ?? 'GET'
      requestUrls.push(`${method} ${url.toString()}`)
      if (url.pathname.endsWith('/files/generateIds')) {
        createIdCount += 1
        return jsonResponse({ ids: [createIdCount === 1 ? 'backup-1' : 'backup-2'] })
      }
      if (url.pathname.endsWith('/files/folder-1/permissions')) {
        return jsonResponse({ permissions: [{ id: 'owner', type: 'user', role: 'owner' }] })
      }
      if (url.pathname.endsWith('/files/folder-1')) {
        return jsonResponse({
          id: 'folder-1',
          name: 'Private backups',
          mimeType: 'application/vnd.google-apps.folder',
          ownedByMe: true,
          shared: false,
          trashed: false,
          capabilities: { canAddChildren: true },
        })
      }
      if (url.pathname.includes('/upload/drive/v3/files')) {
        uploadCount += 1
        const body = String(init?.body)
        const id = body.match(/"id":"([^"]+)"/)?.[1]
        if (id) uploadIds.push(id)
        if (uploadCount === 1) throw new TypeError('lost acknowledgement')
        if (uploadCount === 2) return jsonResponse({ error: { message: 'Drive rejected this retry.' } }, 403)
        const filename = body.match(/"name":"([^"]+)"/)?.[1]
        const mediaMarker = 'Content-Transfer-Encoding: 8bit\r\n\r\n'
        const mediaStart = body.indexOf(mediaMarker) + mediaMarker.length
        const mediaEnd = body.lastIndexOf('\r\n--')
        const uploadedContents = body.slice(mediaStart, mediaEnd)
        return jsonResponse({
          id,
          name: filename,
          mimeType: 'application/json',
          parents: ['folder-1'],
          size: String(new TextEncoder().encode(uploadedContents).byteLength),
          trashed: false,
        })
      }
      if (url.pathname.endsWith('/files/backup-1') && uploadCount === 1) {
        return jsonResponse({ error: { message: 'Reconciliation is unavailable.' } }, 403)
      }
      if (url.pathname.endsWith('/files/backup-1')) return jsonResponse({ error: { message: 'Not found.' } }, 404)
      throw new Error(`Unexpected Drive request: ${method} ${url.toString()}`)
    }

    const scope = effectScope()
    try {
      const controller = scope.run(() => useGoogleDriveBackup(() => workspace, {
        public: {
          googleDriveClientId: 'client-id',
          googleDriveProjectNumber: '12345',
          googleDriveApiKey: 'api-key',
        },
      }))
      if (!controller) throw new Error('The backup controller did not initialize.')

      controller.activate()
      await expect.poll(() => controller.state.value, { timeout: 3_000 }).toBe('retry')
      const firstIdRequest = requestUrls.findIndex(url => url.includes('/files/generateIds'))
      const firstFolderCheck = requestUrls.findIndex(url => url.includes('/files/folder-1?'))
      expect(firstIdRequest).toBeLessThan(firstFolderCheck)

      controller.activate()
      await expect.poll(() => controller.state.value, { timeout: 3_000 }).toBe('retry')
      expect(controller.message.value).toContain('earlier outcome remains unknown')
      expect(uploadIds).toEqual(['backup-1', 'backup-1'])

      controller.startNewBackupInstead()
      await expect.poll(() => controller.state.value, { timeout: 3_000 }).toBe('idle')
      expect(uploadIds).toEqual(['backup-1', 'backup-1', 'backup-2'])
      expect(controller.message.value).toContain('At least one earlier backup may already be saved')
      expect(controller.message.value).toContain('Saved ')
      expect(controller.destination.value).toEqual({
        name: 'Private backups',
        url: 'https://drive.google.com/drive/folders/folder-1',
      })
    } finally {
      scope.stop()
      globalThis.fetch = originalFetch
    }
  })
})

class FakeDocsView {
  mimeTypes?: string
  mode?: string

  constructor(readonly viewId: string) {}

  setMode(value: string): this { this.mode = value; return this }
  setIncludeFolders(): this { return this }
  setSelectFolderEnabled(): this { return this }
  setMimeTypes(value: string): this { this.mimeTypes = value; return this }
}

async function withWindow<T>(fakeWindow: object, run: () => Promise<T>): Promise<T> {
  const oldDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
      ...fakeWindow,
    },
  })
  try {
    return await run()
  } finally {
    if (oldDescriptor) Object.defineProperty(globalThis, 'window', oldDescriptor)
    else Reflect.deleteProperty(globalThis, 'window')
  }
}
