import { computed, effectScope, ref } from 'vue'
import { readFile } from 'node:fs/promises'
import type { BrowserContext } from '@playwright/test'
import { expect, test } from './fixtures'
import { useDropboxRestore } from '../composables/useDropboxRestore'
import type { WorkspaceRestoreSource } from '../composables/useWorkspaceRestore'
import type { DropboxGrant } from '../utils/dropbox-auth'
import type { DropboxSignInController } from '../composables/useDropboxSignIn'
import campaignBaselineFixture from './fixtures/workspace-data-campaign-baseline.json' with { type: 'json' }
import { captureMapExportBlobs, downloadJson, openMapFilesSection, waitForWorkspaceSaved, waitForWorkspaceStartup } from './helpers'
import {
  DropboxApiError,
  deleteDropboxBackup,
  listDropboxBackups,
  readDropboxBackup,
  readDropboxBackupBytes,
} from '../utils/dropbox-api'
import type { DropboxBackupFile } from '../utils/dropbox-api'
import { DROPBOX_BACKUP_LIMIT, isDropboxDatedBackupName } from '../utils/dropbox-backup-snapshot'

function jsonResponse(value: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json', ...Object.fromEntries(new Headers(headers)) },
  })
}

function fileMetadata(file: DropboxBackupFile, overrides: Record<string, unknown> = {}) {
  return {
    '.tag': 'file',
    id: file.id,
    name: file.name,
    rev: file.rev,
    path_display: `/${file.name}`,
    server_modified: file.serverModified,
    size: file.size,
    ...overrides,
  }
}

function datedBackup(id: string, date: string): DropboxBackupFile {
  const filenameId = id.replace(/[^a-f\d]/gi, '').toLowerCase().padEnd(32, 'a').slice(0, 32)
  return {
    id: id.startsWith('id:') ? id : `id:${id}`,
    name: `Ember Reach-jump-cluster-${date}-${filenameId}.json`,
    rev: id.replace(/[^a-f\d]/gi, '').toLowerCase().padEnd(10, 'a').slice(0, 16),
    serverModified: `${date.slice(0, 10)}T10:00:00Z`,
    size: 24,
  }
}

function readyDropboxSignIn(): {
  signIn: DropboxSignInController
  accountId: ReturnType<typeof ref<string | null>>
  requestedSignals: Array<AbortSignal | undefined>
} {
  const accountId = ref<string | null>(null)
  const requestedSignals: Array<AbortSignal | undefined> = []
  const grant: DropboxGrant = {
    accessToken: 'dropbox-token',
    accountId: 'dbid:warden-one',
    expiresAt: Date.now() + 60_000,
  }
  return {
    accountId,
    requestedSignals,
    signIn: {
      status: ref('ready'),
      message: ref(''),
      ready: computed(() => true),
      hasAccessToken: computed(() => accountId.value !== null),
      accountId: computed(() => accountId.value),
      async requestGrant(signal) {
        requestedSignals.push(signal)
        accountId.value = grant.accountId
        return grant
      },
      invalidateAccessToken() { accountId.value = null },
      forgetAccount() { accountId.value = null },
    },
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(complete => { resolve = complete })
  return { promise, resolve }
}

test('Dropbox restore lists root JSON files including renamed backups across every page @pure', async () => {
  const first = { ...datedBackup('id:file-one', '2026-11-13-10-00-00-000Z'), name: 'Warden renamed.json' }
  const second = { ...datedBackup('id:file-two', '2026-11-12-10-00-00-000Z'), name: 'Legacy campaign.json' }
  const requests: Array<{ url: string; body: string }> = []
  const files = await listDropboxBackups('token', async (input, init) => {
    requests.push({ url: String(input), body: String(init?.body) })
    if (requests.length === 1) {
      return jsonResponse({
        entries: [fileMetadata(first), { '.tag': 'folder', name: 'renamed.json' }, { '.tag': 'file', name: 'readme.txt' }],
        cursor: 'folder-cursor-1',
        has_more: true,
      })
    }
    return jsonResponse({ entries: [fileMetadata(second)], cursor: 'folder-cursor-2', has_more: false })
  })

  expect(files).toEqual([first, second])
  expect(requests.map(request => request.url)).toEqual([
    'https://api.dropboxapi.com/2/files/list_folder',
    'https://api.dropboxapi.com/2/files/list_folder/continue',
  ])
  expect(JSON.parse(requests[0]!.body)).toMatchObject({ path: '', recursive: false, include_deleted: false })
  expect(JSON.parse(requests[1]!.body)).toEqual({ cursor: 'folder-cursor-1' })
})

test('Dropbox restore rejects a repeated continuation cursor instead of returning a partial list @pure', async () => {
  let requestCount = 0
  const error = await listDropboxBackups('token', async () => {
    requestCount += 1
    return jsonResponse({ entries: [], cursor: 'same-cursor', has_more: true })
  }).catch(reason => reason)

  expect(error).toBeInstanceOf(DropboxApiError)
  expect(requestCount).toBe(2)
  expect((error as Error).message).toMatch(/complete backup list/i)
})

test('Dropbox restore downloads the listed revision and verifies its file identity @pure', async () => {
  const content = '{"cluster":"Ember Reach"}'
  const file = { ...datedBackup('id:backup-one', '2026-11-13-10-00-00-000Z'), size: new TextEncoder().encode(content).byteLength }
  const requests: Array<{ url: string; arg: string }> = []
  const downloaded = await readDropboxBackup('token', file, async (input, init) => {
    requests.push({ url: String(input), arg: String(new Headers(init?.headers).get('Dropbox-API-Arg')) })
    return new Response(content, {
      headers: { 'Dropbox-API-Result': JSON.stringify(fileMetadata(file)) },
    })
  })

  expect(downloaded).toBe(content)
  expect(requests).toEqual([{
    url: 'https://content.dropboxapi.com/2/files/download',
    arg: JSON.stringify({ path: `rev:${file.rev}` }),
  }])
})

test('Dropbox byte reads preserve a UTF-8 BOM while restore reads decode the same revision @pure', async () => {
  const restoredContent = '{"cluster":"Ember Reach"}'
  const contentBytes = Uint8Array.from([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(restoredContent)])
  const contentBuffer = new ArrayBuffer(contentBytes.byteLength)
  new Uint8Array(contentBuffer).set(contentBytes)
  const file = { ...datedBackup('id:backup-bom', '2026-11-13-10-00-00-000Z'), size: contentBytes.byteLength }
  const fetcher = async () => new Response(contentBuffer, {
    headers: { 'Dropbox-API-Result': JSON.stringify(fileMetadata(file)) },
  })

  const downloadedBytes = await readDropboxBackupBytes('token', file, fetcher)
  const restoredText = await readDropboxBackup('token', file, fetcher)

  expect(Array.from(downloadedBytes)).toEqual(Array.from(contentBytes))
  expect(restoredText).toBe(restoredContent)
})

test('Dropbox restore rejects changed or substituted file revisions before admission @pure', async () => {
  const file = datedBackup('id:backup-one', '2026-11-13-10-00-00-000Z')
  const error = await readDropboxBackup('token', file, async () => new Response('{}', {
    headers: {
      'Dropbox-API-Result': JSON.stringify(fileMetadata(file, { id: 'id:other-file', rev: 'rev-other' })),
    },
  })).catch(reason => reason)

  expect(error).toBeInstanceOf(DropboxApiError)
  expect((error as Error).message).toMatch(/selected backup changed/i)
})

test('Dropbox manual deletion is bound to the listed root path and revision @pure', async () => {
  const file = { ...datedBackup('id:backup-delete', '2026-11-13-10-00-00-000Z'), rev: 'a1b2c3d4e5' }
  const requests: Array<{ url: string; body: string }> = []
  await deleteDropboxBackup('token', file, async (input, init) => {
    requests.push({ url: String(input), body: String(init?.body) })
    return jsonResponse({ metadata: fileMetadata(file) })
  })

  expect(requests).toEqual([{
    url: 'https://api.dropboxapi.com/2/files/delete_v2',
    body: JSON.stringify({ path: `/${file.name}`, parent_rev: file.rev }),
  }])
})

test('Dropbox chooser opens the restore owner before authorization and passes the selected backup unchanged @pure', async () => {
  const file = datedBackup('id:backup-one', '2026-11-13-10-00-00-000Z')
  const events: string[] = []
  const sources: WorkspaceRestoreSource[] = []
  const requestedSignals: Array<AbortSignal | undefined> = []
  const fileReads: Array<{ accessToken: string; file: DropboxBackupFile; signal?: AbortSignal }> = []
  const restoreFinished = deferred<void>()
  const { signIn, accountId } = readyDropboxSignIn()
  signIn.requestGrant = async signal => {
    requestedSignals.push(signal)
    accountId.value = 'dbid:warden-one'
    events.push('authorized')
    return { accessToken: 'dropbox-token', accountId: 'dbid:warden-one', expiresAt: Date.now() + 60_000 }
  }
  const restore = {
    async openFrom(load: (signal?: AbortSignal) => Promise<WorkspaceRestoreSource | null>, signal?: AbortSignal): Promise<boolean> {
      events.push('restore lease')
      const source = await load(signal)
      if (source) sources.push(source)
      restoreFinished.resolve()
      return true
    },
  }
  const scope = effectScope()
  const controller = scope.run(() => useDropboxRestore(restore, signIn, {
    listBackups: async (_accessToken, signal) => {
      events.push('listed')
      requestedSignals.push(signal)
      return [file]
    },
    readFile: async (accessToken, listedFile, signal) => {
      fileReads.push({ accessToken, file: listedFile, signal })
      return '{"backup":"unchanged"}'
    },
    deleteFile: async () => undefined,
  }))
  if (!controller) throw new Error('The Dropbox restore controller did not initialize.')

  try {
    controller.activate()
    expect(events).toEqual(['restore lease', 'authorized'])
    await expect.poll(() => controller.state.value).toBe('choosing')
    expect(controller.dialogOpen.value).toBe(true)
    expect(controller.busy.value).toBe(false)
    expect(controller.backups.value).toEqual([{
      id: file.id,
      name: file.name,
      rev: file.rev,
      modifiedAt: file.serverModified,
    }])

    controller.select(file.id)
    await restoreFinished.promise

    expect(events).toEqual(['restore lease', 'authorized', 'listed'])
    expect(fileReads).toHaveLength(1)
    expect(fileReads[0]).toMatchObject({ accessToken: 'dropbox-token', file })
    expect(sources).toEqual([{
      name: file.name,
      content: '{"backup":"unchanged"}',
      sourceKind: 'dropbox',
    }])
    expect(requestedSignals).toHaveLength(2)
    expect(requestedSignals.every(signal => signal === requestedSignals[0])).toBe(true)
  } finally {
    scope.stop()
  }
})

test('Dropbox direct download uses the listed revision and leaves the chooser ready for restore @pure', async () => {
  const older = { ...datedBackup('id:backup-older', '2026-11-13-10-00-00-000Z'), serverModified: '2026-11-13T11:30:00+02:00' }
  const newer = { ...datedBackup('id:backup-newer', '2026-11-13-10-00-00-000Z'), name: 'Current: campaign?.json' }
  const fileByteReads: Array<{ accessToken: string; file: DropboxBackupFile; signal?: AbortSignal }> = []
  const downloads: Array<{ filename: string; content: number[] }> = []
  const sources: WorkspaceRestoreSource[] = []
  const restoreFinished = deferred<void>()
  const { signIn } = readyDropboxSignIn()
  const restore = {
    async openFrom(load: (signal?: AbortSignal) => Promise<WorkspaceRestoreSource | null>, signal?: AbortSignal): Promise<boolean> {
      const source = await load(signal)
      if (source) sources.push(source)
      restoreFinished.resolve()
      return true
    },
  }
  const scope = effectScope()
  const controller = scope.run(() => useDropboxRestore(restore, signIn, {
    listBackups: async () => [older, newer],
    readFile: async () => '{"backup":"unchanged"}',
    readFileBytes: async (accessToken, file, signal) => {
      fileByteReads.push({ accessToken, file, signal })
      if (fileByteReads.length === 1) throw new Error('Dropbox could not read this backup.')
      return Uint8Array.from([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('{"backup":"unchanged"}')])
    },
    deleteFile: async () => undefined,
    downloadFile: (filename, content) => downloads.push({ filename, content: Array.from(content) }),
  }))
  if (!controller) throw new Error('The Dropbox restore controller did not initialize.')

  try {
    controller.activate()
    await expect.poll(() => controller.state.value).toBe('choosing')
    expect(controller.backups.value.map(file => file.id)).toEqual([newer.id, older.id])

    controller.downloadBackup(newer.id)
    await expect.poll(() => controller.state.value).toBe('choosing')
    expect(controller.message.value).toBe('Dropbox could not read this backup.')
    expect(controller.completedDownloads.value).toBe(0)
    expect(downloads).toEqual([])

    controller.downloadBackup(newer.id)
    await expect.poll(() => controller.completedDownloads.value).toBe(1)
    expect(controller.state.value).toBe('choosing')
    expect(controller.dialogOpen.value).toBe(true)
    expect(controller.busy.value).toBe(false)
    expect(fileByteReads).toHaveLength(2)
    expect(fileByteReads[0]).toMatchObject({ accessToken: 'dropbox-token', file: newer })
    expect(fileByteReads[0]?.file).toBe(newer)
    expect(downloads).toEqual([{
      filename: 'Current- campaign-.json',
      content: [0xef, 0xbb, 0xbf, ...new TextEncoder().encode('{"backup":"unchanged"}')],
    }])
    expect(sources).toEqual([])
    expect(newer.name).toBe('Current: campaign?.json')

    controller.select(newer.id)
    await restoreFinished.promise
    expect(sources).toEqual([{
      name: newer.name,
      content: '{"backup":"unchanged"}',
      sourceKind: 'dropbox',
    }])
  } finally {
    scope.stop()
  }
})

test('Dropbox dated-file deletion stays in the restore lease and requires the listed revision @pure', async () => {
  const dated = datedBackup('id:backup-to-delete', '2026-11-13-10-00-00-000Z')
  const generic = { ...datedBackup('id:legacy-json', '2026-11-12-10-00-00-000Z'), name: 'Legacy campaign.json' }
  const deleteStarted = deferred<void>()
  const deletion = deferred<void>()
  const restoreFinished = deferred<void>()
  const deleteRequests: Array<{ accessToken: string; file: DropboxBackupFile; signal?: AbortSignal }> = []
  const sources: WorkspaceRestoreSource[] = []
  const { signIn } = readyDropboxSignIn()
  const restore = {
    async openFrom(load: (signal?: AbortSignal) => Promise<WorkspaceRestoreSource | null>, signal?: AbortSignal): Promise<boolean> {
      const source = await load(signal)
      if (source) sources.push(source)
      restoreFinished.resolve()
      return true
    },
  }
  const scope = effectScope()
  const controller = scope.run(() => useDropboxRestore(restore, signIn, {
    listBackups: async () => [dated, generic],
    readFile: async () => '{"restored":"legacy"}',
    deleteFile: async (accessToken, file, signal) => {
      deleteRequests.push({ accessToken, file, signal })
      deleteStarted.resolve()
      await deletion.promise
    },
  }))
  if (!controller) throw new Error('The Dropbox restore controller did not initialize.')

  try {
    controller.activate()
    await expect.poll(() => controller.state.value).toBe('choosing')
    controller.deleteBackup(dated.id, 'stale-revision')
    expect(deleteRequests).toEqual([])

    controller.deleteBackup(dated.id, dated.rev)
    await deleteStarted.promise
    expect(controller.state.value).toBe('deleting')
    expect(controller.dialogOpen.value).toBe(true)
    expect(controller.busy.value).toBe(true)
    expect(controller.canCancel.value).toBe(false)
    expect(deleteRequests).toHaveLength(1)
    expect(deleteRequests[0]).toMatchObject({ accessToken: 'dropbox-token', file: dated })
    expect(deleteRequests[0]?.signal?.aborted).toBe(false)

    controller.cancel(false)
    expect(controller.state.value).toBe('deleting')
    deletion.resolve()
    await expect.poll(() => controller.state.value).toBe('choosing')

    expect(controller.backups.value.map(backup => backup.id)).toEqual([generic.id])
    expect(controller.completedDeletions.value).toBe(1)
    expect(controller.message.value).toBe('')
    controller.deleteBackup(generic.id, generic.rev)
    expect(deleteRequests).toHaveLength(1)
    expect(controller.message.value).toMatch(/only dated Jump Cluster backups/i)

    controller.select(generic.id)
    await restoreFinished.promise
    expect(sources).toEqual([{
      name: generic.name,
      content: '{"restored":"legacy"}',
      sourceKind: 'dropbox',
    }])
  } finally {
    scope.stop()
  }
})

test('an uncertain Dropbox delete requires a fresh listing before another delete @pure', async () => {
  const file = datedBackup('id:backup-uncertain-delete', '2026-11-13-10-00-00-000Z')
  let listCount = 0
  let deleteCount = 0
  const { signIn } = readyDropboxSignIn()
  const restore = {
    async openFrom(load: (signal?: AbortSignal) => Promise<WorkspaceRestoreSource | null>, signal?: AbortSignal): Promise<boolean> {
      await load(signal)
      return true
    },
  }
  const scope = effectScope()
  const controller = scope.run(() => useDropboxRestore(restore, signIn, {
    listBackups: async () => {
      listCount += 1
      return listCount === 1 ? [file] : []
    },
    readFile: async () => '{}',
    deleteFile: async () => {
      deleteCount += 1
      throw new DropboxApiError('outcome-uncertain', 'Dropbox connection closed before the result arrived.', true)
    },
  }))
  if (!controller) throw new Error('The Dropbox restore controller did not initialize.')

  try {
    controller.activate()
    await expect.poll(() => controller.state.value).toBe('choosing')
    controller.deleteBackup(file.id, file.rev)
    await expect.poll(() => controller.state.value).toBe('choosing')

    expect(controller.refreshRequired.value).toBe(true)
    expect(controller.backups.value).toHaveLength(1)
    expect(controller.message.value).toMatch(/could not confirm whether .* was deleted/i)
    controller.deleteBackup(file.id, file.rev)
    expect(deleteCount).toBe(1)

    controller.refresh()
    await expect.poll(() => controller.backups.value).toEqual([])
    expect(controller.refreshRequired.value).toBe(false)
    expect(listCount).toBe(2)
  } finally {
    controller.cancel(false)
    scope.stop()
  }
})

test('a Dropbox list failure stays in its provider message without reaching the workspace restore alert @pure', async () => {
  const listStarted = deferred<void>()
  const listError = new Error('Dropbox could not list this account.')
  let workspaceRestoreError = ''
  let deliveredSource: WorkspaceRestoreSource | null | undefined
  const { signIn } = readyDropboxSignIn()
  const restore = {
    async openFrom(load: (signal?: AbortSignal) => Promise<WorkspaceRestoreSource | null>, signal?: AbortSignal): Promise<boolean> {
      try {
        deliveredSource = await load(signal)
      } catch (error) {
        workspaceRestoreError = error instanceof Error ? error.message : String(error)
      }
      return true
    },
  }
  const scope = effectScope()
  const controller = scope.run(() => useDropboxRestore(restore, signIn, {
    listBackups: async () => {
      listStarted.resolve()
      throw listError
    },
    readFile: async () => '{}',
    deleteFile: async () => undefined,
  }))
  if (!controller) throw new Error('The Dropbox restore controller did not initialize.')

  try {
    controller.activate()
    await listStarted.promise
    await expect.poll(() => controller.state.value).toBe('idle')

    expect(deliveredSource).toBeNull()
    expect(workspaceRestoreError).toBe('')
    expect(controller.message.value).toBe(listError.message)
  } finally {
    scope.stop()
  }
})

test('Dropbox restore rejects a selection after the authorized account changes @pure', async () => {
  const file = datedBackup('id:backup-one', '2026-11-13-10-00-00-000Z')
  const { signIn, accountId } = readyDropboxSignIn()
  const sources: WorkspaceRestoreSource[] = []
  let readCount = 0
  const restore = {
    async openFrom(load: (signal?: AbortSignal) => Promise<WorkspaceRestoreSource | null>): Promise<boolean> {
      const source = await load()
      if (source) sources.push(source)
      return true
    },
  }
  const scope = effectScope()
  const controller = scope.run(() => useDropboxRestore(restore, signIn, {
    listBackups: async () => [file],
    readFile: async () => { readCount += 1; return '{}' },
    deleteFile: async () => undefined,
  }))
  if (!controller) throw new Error('The Dropbox restore controller did not initialize.')

  try {
    controller.activate()
    await expect.poll(() => controller.state.value).toBe('choosing')
    accountId.value = 'dbid:warden-two'
    controller.select(file.id)
    await expect.poll(() => controller.state.value).toBe('idle')

    expect(readCount).toBe(0)
    expect(sources).toEqual([])
    expect(controller.backups.value).toEqual([])
    expect(controller.message.value).toMatch(/account changed/i)
  } finally {
    scope.stop()
  }
})

test('canceling a Dropbox restore aborts a pending list and ignores its late result @pure', async () => {
  const file = datedBackup('id:backup-one', '2026-11-13-10-00-00-000Z')
  const pendingList = deferred<DropboxBackupFile[]>()
  const listStarted = deferred<AbortSignal | undefined>()
  const restoreFinished = deferred<void>()
  let completedSource: WorkspaceRestoreSource | null | undefined
  const { signIn } = readyDropboxSignIn()
  const restore = {
    async openFrom(load: (signal?: AbortSignal) => Promise<WorkspaceRestoreSource | null>, signal?: AbortSignal): Promise<boolean> {
      completedSource = await load(signal)
      restoreFinished.resolve()
      return true
    },
  }
  const scope = effectScope()
  const controller = scope.run(() => useDropboxRestore(restore, signIn, {
    listBackups: async (_accessToken, signal) => {
      listStarted.resolve(signal)
      return pendingList.promise
    },
    readFile: async () => '{}',
    deleteFile: async () => undefined,
  }))
  if (!controller) throw new Error('The Dropbox restore controller did not initialize.')

  try {
    controller.activate()
    const signal = await listStarted.promise
    controller.cancel(false)
    pendingList.resolve([file])
    await restoreFinished.promise
    await expect.poll(() => controller.state.value).toBe('idle')

    expect(signal?.aborted).toBe(true)
    expect(controller.backups.value).toEqual([])
    expect(completedSource).toBeNull()
  } finally {
    scope.stop()
  }
})

test('a Warden backs up to Dropbox and restores the same Jump Cluster in a fresh profile', async ({ page, context, browser, baseURL, previewCookies }) => {
  // Each isolated profile loads the editor and OAuth callback and closes its browser context.
  test.setTimeout(150_000)
  const appKey = 'controlled-public-app-key'
  const olderFiles = Array.from({ length: DROPBOX_BACKUP_LIMIT }, (_, index) =>
    datedBackup(`id:retention-seed-${index}`, `2026-10-${String(index + 1).padStart(2, '0')}-10-00-00-000Z`))
  const unrelatedFile = { ...datedBackup('id:unrelated-json', '2026-09-30-10-00-00-000Z'), name: 'Reference campaign.json' }
  const unrelatedBackup = createControlledDropboxBackup(unrelatedFile, JSON.stringify(campaignBaselineFixture))
  const backups: ControlledDropboxBackup[] = [
    ...olderFiles.map(file => createControlledDropboxBackup(file, JSON.stringify(campaignBaselineFixture))),
    unrelatedBackup,
  ]
  const providerCalls: string[] = []

  await injectDropboxPublicKey(context, appKey)
  await installControlledDropbox(context, appKey, backups, providerCalls)
  await captureMapExportBlobs(page)

  await page.goto('/')
  await waitForWorkspaceStartup(page)
  const localFile = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Open local Jump Cluster backup', exact: true }).click()
  await (await localFile).setFiles({
    name: 'Synthetic Jump Cluster.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(campaignBaselineFixture)),
  })
  await page.getByRole('dialog', { name: 'Open Jump Cluster', exact: true })
    .getByRole('button', { name: 'Open Jump Cluster', exact: true }).click()
  await waitForWorkspaceSaved(page)
  const original = await downloadJson(page, 'Export Jump Cluster JSON')

  const backupMenu = await openMapFilesSection(page, 'Download or back up')
  const dropboxBackupItem = backupMenu.getByRole('menuitem', { name: /^Back up Jump Cluster to Dropbox/ })
  const retentionHint = /GM notes in the Dropbox App Folder.*cleanup keeps the 10 newest dated backups per account/i
  await expect(dropboxBackupItem).toBeEnabled()
  await expect(dropboxBackupItem).toHaveText('Back up Jump Cluster to Dropbox', { useInnerText: true })
  await expect(dropboxBackupItem).toHaveAccessibleDescription(retentionHint)
  await dropboxBackupItem.hover()
  // The tooltip renders a separate accessibility node alongside its painted message.
  await expect(page.getByText(retentionHint).and(page.locator('[data-slot="text"]'))).toBeVisible()
  await dropboxBackupItem.click()
  await expect(page.getByRole('dialog', { name: 'Back up Jump Cluster to Dropbox' })).toHaveCount(0)
  const backupNotifications = page.getByLabel('Notifications (F8)')
  await expect(backupNotifications.getByText('Backed up to Dropbox', { exact: true })).toBeVisible({ timeout: 15_000 })
  await expect.poll(() => backups.filter(backup => isDropboxDatedBackupName(backup.metadata.name)).length).toBe(DROPBOX_BACKUP_LIMIT)
  expect(backups.some(backup => backup.metadata.id === olderFiles[0]?.id)).toBe(false)
  expect(backups.some(backup => backup.metadata.id === unrelatedFile.id)).toBe(true)
  const firstSaved = backups.find(backup => !olderFiles.some(file => file.id === backup.metadata.id)
    && backup.metadata.id !== unrelatedFile.id)
  expect(firstSaved).toBeDefined()
  const backupFilename = firstSaved!.metadata.name
  expect(backupFilename).toMatch(/Kestrel Reach Prime-jump-cluster-.+\.json$/)
  expect(JSON.parse(firstSaved!.content)).toEqual(original)
  await expect(backupNotifications.getByText(`${backupFilename} in this app’s Dropbox App Folder`, { exact: true })).toBeVisible()

  const secondBackupMenu = await openMapFilesSection(page, 'Download or back up')
  await secondBackupMenu.getByRole('menuitem', { name: /^Back up Jump Cluster to Dropbox/ }).click()
  await expect.poll(() => providerCalls.filter(call => call === 'upload to App Folder').length).toBe(2)
  await expect.poll(() => backups.filter(backup => isDropboxDatedBackupName(backup.metadata.name)).length).toBe(DROPBOX_BACKUP_LIMIT)
  expect(backups.some(backup => backup.metadata.id === olderFiles[1]?.id)).toBe(false)
  expect(providerCalls.filter(call => call === 'token exchange')).toHaveLength(1)
  const savedFiles = backups
    .filter(backup => !olderFiles.some(file => file.id === backup.metadata.id) && backup.metadata.id !== unrelatedFile.id)
    .sort((left, right) => left.metadata.server_modified.localeCompare(right.metadata.server_modified))
  expect(savedFiles).toHaveLength(2)
  const saved = savedFiles.at(-1)!
  expect(saved.metadata.name).not.toBe(firstSaved!.metadata.name)
  expect(JSON.parse(saved.content)).toEqual(original)

  const freshContext = await browser.newContext({ baseURL })
  try {
    if (previewCookies.length) await freshContext.addCookies(previewCookies)
    await injectDropboxPublicKey(freshContext, appKey)
    await installControlledDropbox(freshContext, appKey, backups, providerCalls)
    const fresh = await freshContext.newPage()
    await captureMapExportBlobs(fresh)
    await fresh.goto('/')
    await waitForWorkspaceStartup(fresh)
    await fresh.getByRole('button', { name: 'Restore Jump Cluster from Dropbox', exact: true }).click()

    const chooser = fresh.getByRole('dialog', { name: 'Dropbox backups', exact: true })
    await expect(chooser.getByRole('button', { name: `Restore ${unrelatedFile.name}`, exact: true })).toBeVisible({ timeout: 15_000 })
    await expect(chooser.getByRole('button', { name: `Delete ${unrelatedFile.name} from Dropbox`, exact: true })).toHaveCount(0)
    const backupDownload = fresh.waitForEvent('download')
    await chooser.getByRole('button', { name: `Download JSON for ${saved.metadata.name}`, exact: true }).click()
    const download = await backupDownload
    expect(download.suggestedFilename()).toBe(saved.metadata.name)
    const downloadPath = await download.path()
    if (!downloadPath) throw new Error('The Dropbox backup download has no local file path.')
    expect(await readFile(downloadPath, 'utf8')).toBe(saved.content)
    await expect(chooser.getByLabel('Dropbox restore notifications').getByText('Backup downloaded from Dropbox', { exact: true })).toBeVisible()

    const manualDelete = olderFiles[2]!
    await chooser.getByRole('button', { name: `Delete ${manualDelete.name} from Dropbox`, exact: true }).click()
    const deleteConfirmation = chooser.getByRole('group', { name: `Confirm delete ${manualDelete.name}` })
    await expect(deleteConfirmation).toContainText(manualDelete.name)
    await expect(deleteConfirmation.getByRole('button', { name: 'Keep backup', exact: true })).toBeFocused()
    await deleteConfirmation.getByRole('button', { name: `Confirm delete ${manualDelete.name} from Dropbox`, exact: true }).click()
    await expect(chooser.getByLabel('Dropbox restore notifications').getByText('Backup deleted from Dropbox', { exact: true })).toBeVisible()
    await expect(chooser.getByText(`Deleted ${manualDelete.name} from Dropbox.`, { exact: true })).toHaveCount(0)
    await expect(chooser.getByRole('button', { name: `Restore ${manualDelete.name}`, exact: true })).toHaveCount(0)
    await chooser.getByRole('button', { name: `Restore ${saved.metadata.name}`, exact: true }).click()
    const review = fresh.getByRole('dialog', { name: 'Open Jump Cluster', exact: true })
    await expect(review).toContainText(campaignBaselineFixture.cluster.name)
    await expect(review).toContainText(saved.metadata.name)
    await review.getByRole('button', { name: 'Open Jump Cluster', exact: true }).click()

    await expect(fresh.getByLabel('Notifications (F8)').getByText('Restored from Dropbox', { exact: true })).toBeVisible()
    await waitForWorkspaceSaved(fresh)
    expect(providerCalls.filter(call => call === 'token exchange')).toHaveLength(2)
    expect(providerCalls.filter(call => call === 'upload to App Folder')).toHaveLength(2)
    expect(providerCalls.filter(call => call === 'delete from App Folder').length).toBeGreaterThanOrEqual(3)
    expect(providerCalls).toContain('download selected revision')
    await fresh.reload()
    await waitForWorkspaceStartup(fresh)
    expect(await downloadJson(fresh, 'Export Jump Cluster JSON')).toEqual(original)
  } finally {
    await freshContext.close()
  }
})

async function injectDropboxPublicKey(context: BrowserContext, appKey: string): Promise<void> {
  await context.addInitScript((publicAppKey) => {
    type RuntimeConfig = { public?: Record<string, unknown> }
    type NuxtGlobal = Window & { __NUXT__?: Record<string, unknown> }
    const browserWindow = window as NuxtGlobal
    const addPublicKey = (value: unknown): unknown => {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) return value
      const runtimeConfig = value as RuntimeConfig
      const publicConfig = typeof runtimeConfig.public === 'object' && runtimeConfig.public !== null
        ? runtimeConfig.public
        : {}
      return { ...runtimeConfig, public: { ...publicConfig, dropboxAppKey: publicAppKey } }
    }
    const wrapNuxtState = (value: unknown): unknown => {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) return value
      return new Proxy(value as Record<string, unknown>, {
        set(target, property, nextValue) {
          return Reflect.set(target, property, property === 'config' ? addPublicKey(nextValue) : nextValue)
        },
      })
    }
    let nuxtState = wrapNuxtState(browserWindow.__NUXT__)
    Object.defineProperty(browserWindow, '__NUXT__', {
      configurable: true,
      get: () => nuxtState,
      set: (value: unknown) => { nuxtState = wrapNuxtState(value) },
    })
  }, appKey)
}

interface ControlledDropboxBackup {
  metadata: {
    id: string
    name: string
    rev: string
    path_display: string
    server_modified: string
    size: number
  }
  content: string
}

function createControlledDropboxBackup(file: DropboxBackupFile, content: string): ControlledDropboxBackup {
  return {
    metadata: {
      id: file.id,
      name: file.name,
      rev: file.rev,
      path_display: `/${file.name}`,
      server_modified: file.serverModified,
      size: file.size,
    },
    content,
  }
}

async function installControlledDropbox(
  context: BrowserContext,
  appKey: string,
  backups: ControlledDropboxBackup[],
  calls: string[],
): Promise<void> {
  let uploadSequence = 0
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type, dropbox-api-arg, dropbox-api-path-root',
    'Access-Control-Expose-Headers': 'Dropbox-API-Result',
    'Access-Control-Max-Age': '600',
  }
  const fulfillCors = async (
    route: import('@playwright/test').Route,
    body: string,
    contentType = 'application/json',
    responseHeaders: Record<string, string> = {},
  ) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders })
      return
    }
    await route.fulfill({
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': contentType, ...responseHeaders },
      body,
    })
  }

  await context.route('https://www.dropbox.com/oauth2/authorize**', async (route) => {
    const authorizeUrl = new URL(route.request().url())
    const callback = new URL(authorizeUrl.searchParams.get('redirect_uri') ?? '')
    if (callback.pathname !== '/dropbox/oauth/callback') throw new Error('Dropbox authorization requested an unexpected callback URL.')
    callback.searchParams.set('code', 'controlled-authorization-code')
    callback.searchParams.set('state', authorizeUrl.searchParams.get('state') ?? '')
    calls.push('authorization')
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: `<!doctype html><script>window.location.replace(${JSON.stringify(callback.toString())})</script>`,
    })
  })
  await context.route('https://api.dropboxapi.com/oauth2/token', async (route) => {
    const body = new URLSearchParams(route.request().postData() ?? '')
    expect(body.get('client_id')).toBe(appKey)
    expect(body.get('code')).toBe('controlled-authorization-code')
    expect(body.get('code_verifier')).toBeTruthy()
    calls.push('token exchange')
    await fulfillCors(route, JSON.stringify({
      access_token: 'controlled-access-token',
      token_type: 'bearer',
      expires_in: 14_400,
      account_id: 'dbid:controlled-account',
      scope: 'files.metadata.read files.content.read files.content.write',
    }))
  })
  await context.route('https://content.dropboxapi.com/2/files/upload', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await fulfillCors(route, '')
      return
    }
    const args = JSON.parse(route.request().headers()['dropbox-api-arg'] ?? '{}') as { path: string }
    expect(args.path).toMatch(/^\/[^/]+\.json$/)
    const content = route.request().postData() ?? ''
    uploadSequence += 1
    const metadata = {
      id: `id:controlled-${uploadSequence}`,
      name: args.path.slice(1),
      rev: `abcde${uploadSequence.toString(16).padStart(8, '0')}`,
      path_display: args.path,
      server_modified: new Date(Date.now() + uploadSequence * 1_000).toISOString(),
      size: new TextEncoder().encode(content).byteLength,
    }
    backups.push({ metadata, content })
    calls.push('upload to App Folder')
    await fulfillCors(route, JSON.stringify(metadata))
  })
  await context.route('https://api.dropboxapi.com/2/files/list_folder', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await fulfillCors(route, '')
      return
    }
    const request = JSON.parse(route.request().postData() ?? '{}') as { path?: string; recursive?: boolean }
    expect(request).toMatchObject({ path: '', recursive: false })
    calls.push('list App Folder')
    const entries = backups.map(backup => ({ '.tag': 'file', ...backup.metadata }))
    await fulfillCors(route, JSON.stringify({ entries, cursor: 'controlled-cursor', has_more: false }))
  })
  await context.route('https://api.dropboxapi.com/2/files/delete_v2', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await fulfillCors(route, '')
      return
    }
    const request = JSON.parse(route.request().postData() ?? '{}') as { path?: string; parent_rev?: string }
    expect(request.path).toMatch(/^\/[^/]+\.json$/)
    const index = backups.findIndex(backup => `/${backup.metadata.name}` === request.path)
    if (index < 0) throw new Error('Dropbox delete must target an existing file in the App Folder root.')
    const backup = backups[index]!
    expect(request.parent_rev).toBe(backup.metadata.rev)
    backups.splice(index, 1)
    calls.push('delete from App Folder')
    await fulfillCors(route, JSON.stringify({ metadata: { '.tag': 'file', ...backup.metadata } }))
  })
  await context.route('https://content.dropboxapi.com/2/files/download', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await fulfillCors(route, '')
      return
    }
    const apiArgument = JSON.parse(route.request().headers()['dropbox-api-arg'] ?? '{}') as { path?: string }
    const backup = backups.find(candidate => apiArgument.path === `rev:${candidate.metadata.rev}`)
    if (!backup) throw new Error('Dropbox download must use the saved backup revision.')
    calls.push('download selected revision')
    await fulfillCors(route, backup.content, 'application/octet-stream', {
      'Dropbox-API-Result': JSON.stringify(backup.metadata),
    })
  })
}
