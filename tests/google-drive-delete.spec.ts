import { expect, test } from './fixtures'
import { useGoogleDriveRestore } from '../composables/useGoogleDriveRestore'
import type { WorkspaceRestoreSource } from '../composables/useWorkspaceRestore'
import { computed, effectScope, ref } from 'vue'
import type { GoogleDriveSignInController, GoogleDriveSignInStatus } from '../composables/useGoogleDriveSignIn'
import {
  deleteGoogleDriveBackup,
  GoogleDriveApiError,
  isGoogleDriveBackupName,
  listGoogleDriveBackups,
} from '../utils/google-drive-api'

const file = {
  id: 'backup-1',
  name: 'Ember Reach-jump-cluster-2026-11-13-16-13-19-519Z.json',
  createdTime: '2026-11-13T16:13:19.519Z',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function metadata(overrides: Record<string, unknown> = {}) {
  return {
    ...file,
    mimeType: 'application/json',
    spaces: ['appDataFolder'],
    trashed: false,
    capabilities: { canDelete: true },
    ...overrides,
  }
}

test('dated backup name predicate recognizes generated timestamps, including Unicode separators @pure', () => {
  expect(isGoogleDriveBackupName(file.name)).toBe(true)
  expect(isGoogleDriveBackupName(`Ember\u2028Reach-jump-cluster-2026-11-13-16-13-19-519Z.json`)).toBe(true)
  expect(isGoogleDriveBackupName('Ember Reach-jump-cluster-2026-02-31-16-13-19-519Z.json')).toBe(false)
  expect(isGoogleDriveBackupName('Other.json')).toBe(false)
})

test('delete verifies the exact appData backup metadata before issuing permanent DELETE @pure', async () => {
  const requests: Array<{ url: string; method: string; authorization: string | null }> = []
  await deleteGoogleDriveBackup('drive-token', file, async (input, init) => {
    requests.push({
      url: String(input),
      method: init?.method ?? 'GET',
      authorization: new Headers(init?.headers).get('Authorization'),
    })
    return init?.method === 'DELETE' ? new Response(null, { status: 204 }) : jsonResponse(metadata())
  })

  expect(requests).toHaveLength(2)
  expect(requests[0]?.url).toContain('/files/backup-1?')
  expect(requests[0]?.url).toContain('fields=id%2Cname%2CcreatedTime%2CmimeType%2Cspaces%2Ctrashed%2Ccapabilities%28canDelete%29')
  expect(requests[0]?.method).toBe('GET')
  expect(requests[1]).toEqual({
    url: 'https://www.googleapis.com/drive/v3/files/backup-1',
    method: 'DELETE',
    authorization: 'Bearer drive-token',
  })
})

test('delete refuses a stale or foreign file before permanent DELETE @pure', async () => {
  const changedMetadata = [
    metadata({ id: 'another-file' }),
    metadata({ name: 'Other-jump-cluster-2026-11-13-16-13-19-519Z.json' }),
    metadata({ createdTime: '2026-11-13T16:13:19.520Z' }),
    metadata({ mimeType: 'text/plain' }),
    metadata({ spaces: ['drive'] }),
    metadata({ trashed: true }),
    metadata({ capabilities: { canDelete: false } }),
    metadata({ capabilities: { canDelete: 'false' } }),
  ]
  for (const changed of changedMetadata) {
    const requests: string[] = []
    const error = await deleteGoogleDriveBackup('drive-token', file, async input => {
      requests.push(String(input))
      return jsonResponse(changed)
    }).catch(value => value)

    expect(error).toBeInstanceOf(GoogleDriveApiError)
    expect(requests).toHaveLength(1)
    expect(requests[0]).toContain('/files/backup-1?')
  }
})

test('delete rejects unowned names and an explicit canDelete denial without a provider request @pure', async () => {
  let requestCount = 0
  const fetcher = async () => { requestCount += 1; return new Response(null, { status: 204 }) }
  await expect(deleteGoogleDriveBackup('token', { ...file, name: 'Notes.json' }, fetcher)).rejects.toThrow(/dated/i)
  await expect(deleteGoogleDriveBackup('token', { ...file, canDelete: false }, fetcher)).rejects.toThrow(/dated/i)
  expect(requestCount).toBe(0)
})

test('missing files are idempotent, while expired authorization remains a visible 401 @pure', async () => {
  let deleteCalls = 0
  await deleteGoogleDriveBackup('token', file, async () => new Response(null, { status: 404 }))
  const error = await deleteGoogleDriveBackup('token', file, async () => new Response(null, { status: 401 })).catch(value => value)
  const deleted = await deleteGoogleDriveBackup('token', file, async (_input, init) => {
    if (init?.method === 'DELETE') {
      deleteCalls += 1
      return new Response(null, { status: 404 })
    }
    return jsonResponse(metadata())
  })

  expect(error).toBeInstanceOf(GoogleDriveApiError)
  expect(error.httpStatus).toBe(401)
  expect(deleteCalls).toBe(1)
  expect(deleted).toBeUndefined()
})

test('incomplete or invalid list results fail closed, and strict mode rejects foreign dated files @pure', async () => {
  await expect(listGoogleDriveBackups('token', undefined, async () => jsonResponse({ incompleteSearch: true, files: [] })))
    .rejects.toThrow(/complete backup list/i)
  await expect(listGoogleDriveBackups('token', undefined, async () => jsonResponse({ incompleteSearch: null, files: [] })))
    .rejects.toThrow(/complete backup list/i)
  await expect(listGoogleDriveBackups('token', undefined, async () => jsonResponse({
    files: [metadata({ spaces: ['drive'] })],
  }), undefined, true)).rejects.toThrow(/unverified metadata/i)
})

function readySignIn(invalidateAccessToken: (accessToken: string) => void = () => undefined): GoogleDriveSignInController {
  const status = ref<GoogleDriveSignInStatus>('ready')
  return {
    status,
    message: ref(''),
    ready: computed(() => status.value === 'ready'),
    hasAccessToken: computed(() => false),
    retryLoading: async () => undefined,
    requestAccessToken: async () => 'drive-token',
    invalidateAccessToken,
    forgetAccessToken: () => undefined,
  }
}

function restoreOwner() {
  return {
    async openFrom(load: (signal?: AbortSignal) => Promise<WorkspaceRestoreSource | null>, signal?: AbortSignal): Promise<boolean> {
      await load(signal)
      return true
    },
  }
}

test('controller deletes only the listed exact file, blocks cancellation while deleting, and keeps list selection @pure', async () => {
  const secondFile = { ...file, id: 'backup-2', name: 'Ember Reach-jump-cluster-2026-11-12-16-13-19-519Z.json' }
  const requests: string[] = []
  let releaseDelete!: () => void
  const pendingDelete = new Promise<void>(resolve => { releaseDelete = resolve })
  const scope = effectScope()
  const controller = scope.run(() => useGoogleDriveRestore(restoreOwner(), readySignIn(), {
    listBackups: async () => ({ files: [file, secondFile], nextPageToken: 'page-2' }),
    readFile: async () => '',
    deleteBackup: async (_token, candidate) => { requests.push(candidate.id); await pendingDelete },
    downloadFile: () => undefined,
  }))
  if (!controller) throw new Error('The Google Drive restore controller did not initialize.')
  try {
    controller.activate()
    await expect.poll(() => controller.state.value).toBe('choosing')

    controller.deleteBackup({ ...file, createdTime: '2026-11-13T16:13:19.520Z' })
    expect(controller.state.value).toBe('choosing')
    expect(controller.selectionError.value).toMatch(/no longer in the current list/i)
    expect(requests).toEqual([])

    controller.deleteBackup({ ...file })
    expect(controller.state.value).toBe('deleting')
    expect(controller.busy.value).toBe(true)
    expect(controller.canCancel.value).toBe(false)
    controller.cancel()
    expect(controller.state.value).toBe('deleting')
    expect(controller.backups.value).toEqual([file, secondFile])
    releaseDelete()
    await expect.poll(() => controller.completedDeletions.value).toBe(1)
    expect(controller.state.value).toBe('choosing')
    expect(controller.backups.value).toEqual([secondFile])
    expect(controller.refreshRequired.value).toBe(true)
    expect(controller.canCancel.value).toBe(true)

    controller.deleteBackup(secondFile)
    await expect.poll(() => controller.completedDeletions.value).toBe(2)
    expect(controller.backups.value).toEqual([])
    expect(controller.refreshRequired.value).toBe(true)
    expect(controller.canRefresh.value).toBe(true)
    expect(requests).toEqual(['backup-1', 'backup-2'])
  } finally {
    scope.stop()
  }
})

test('an uncertain delete keeps the list open and requires a refresh @pure', async () => {
  let listCount = 0
  const scope = effectScope()
  const controller = scope.run(() => useGoogleDriveRestore(restoreOwner(), readySignIn(), {
    listBackups: async () => { listCount += 1; return { files: [file] } },
    readFile: async () => '',
    deleteBackup: async () => {
      throw new GoogleDriveApiError('outcome-uncertain', 'Google Drive did not confirm the delete.', true)
    },
    downloadFile: () => undefined,
  }))
  if (!controller) throw new Error('The Google Drive restore controller did not initialize.')
  try {
    controller.activate()
    await expect.poll(() => controller.state.value).toBe('choosing')
    controller.deleteBackup(file)
    await expect.poll(() => controller.selectionError.value).toMatch(/did not confirm/i)
    expect(controller.backups.value).toEqual([file])
    expect(controller.refreshRequired.value).toBe(true)
    expect(controller.canRefresh.value).toBe(true)

    controller.refreshBackups()
    await expect.poll(() => listCount).toBe(2)
    expect(controller.refreshRequired.value).toBe(false)
    expect(controller.backups.value).toEqual([file])
  } finally {
    scope.stop()
  }
})

test('a delete 401 invalidates the token and closes the stale backup list @pure', async () => {
  const invalidated: string[] = []
  const scope = effectScope()
  const controller = scope.run(() => useGoogleDriveRestore(restoreOwner(), readySignIn(token => invalidated.push(token)), {
    listBackups: async () => ({ files: [file] }),
    readFile: async () => '',
    deleteBackup: async () => { throw new GoogleDriveApiError('request-failed', 'Expired.', false, 401) },
    downloadFile: () => undefined,
  }))
  if (!controller) throw new Error('The Google Drive restore controller did not initialize.')
  try {
    controller.activate()
    await expect.poll(() => controller.state.value).toBe('choosing')
    controller.deleteBackup(file)
    await expect.poll(() => controller.state.value).toBe('idle')
    expect(invalidated).toEqual(['drive-token'])
    expect(controller.backups.value).toEqual([])
    expect(controller.message.value).toMatch(/authorization expired/i)
  } finally {
    scope.stop()
  }
})
