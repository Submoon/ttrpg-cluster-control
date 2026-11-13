import { expect, test } from './fixtures'
import {
  generateGoogleDriveFileId,
  verifyPrivateGoogleDriveFolder,
  uploadGoogleDriveBackup,
} from '../utils/google-drive-api'
import { createLocalWorkspace, exportJumpCluster } from '../domain/workspace'
import { createGoogleDriveBackupSnapshot } from '../utils/google-drive-backup-snapshot'
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
  expect(result).toMatchObject({ id: 'backup-1', folderId: 'folder-1', folderName: 'Private backups' })
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

test('a JSON backup larger than five MiB uses resumable upload without forwarding OAuth to its session URL @pure', async () => {
  const contents = 'x'.repeat(5 * 1024 * 1024 + 1)
  const sessionUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=session'
  const requests: Array<{ url: string, method: string, init?: RequestInit }> = []
  const result = await uploadGoogleDriveBackup({
    accessToken: 'token',
    folderId: 'folder-1',
    folderName: 'Private backups',
    fileId: 'backup-large',
    filename: 'Large-jump-cluster-2026-11-13.json',
    contents,
    fetcher: async (input, init) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      requests.push({ url, method, init })
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
  expect(new Headers(requests[0]?.init?.headers).get('X-Upload-Content-Length'))
    .toBe(String(new TextEncoder().encode(contents).byteLength))
  expect(requests[1]?.url).toBe(sessionUrl)
  expect(requests[1]?.method).toBe('PUT')
  expect(new Headers(requests[1]?.init?.headers).get('Content-Type')).toContain('application/json')
  expect(new Headers(requests[1]?.init?.headers).has('Content-Range')).toBe(false)
  expect(new Headers(requests[1]?.init?.headers).has('Authorization')).toBe(false)
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
  const fakeGoogle = {
    accounts: { oauth2: {} },
    picker: {
      ViewId: { FOLDERS: 'folders', DOCS: 'docs' },
      Action: { PICKED: 'picked', CANCEL: 'cancel' },
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

class FakeDocsView {
  mimeTypes?: string

  constructor(readonly viewId: string) {}

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
