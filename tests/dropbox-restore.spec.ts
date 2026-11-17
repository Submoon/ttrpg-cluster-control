import { computed, effectScope, ref } from 'vue'
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
  listDropboxBackups,
  readDropboxBackup,
} from '../utils/dropbox-api'
import type { DropboxBackupFile } from '../utils/dropbox-api'

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
    rev: `rev-${id}`,
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
  const appKey = 'controlled-public-app-key'
  const backups: ControlledDropboxBackup[] = []
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
  await backupMenu.getByRole('menuitem', { name: 'Back up Jump Cluster to Dropbox', exact: true }).click()
  const backupDialog = page.getByRole('dialog', { name: 'Back up Jump Cluster to Dropbox', exact: true })
  await expect(backupDialog).toContainText('Dropbox App Folder')
  await backupDialog.getByRole('button', { name: 'Back up to Dropbox', exact: true }).click()
  await expect(page.getByText('Backed up to Dropbox', { exact: true })).toBeVisible()
  expect(backups).toHaveLength(1)
  const saved = backups[0]!
  const backupFilename = saved.metadata.name
  expect(backupFilename).toMatch(/Kestrel Reach Prime-jump-cluster-.+\.json$/)
  expect(JSON.parse(saved.content)).toEqual(original)
  await expect(page.getByText(`${backupFilename} in this app’s Dropbox App Folder`, { exact: true })).toBeVisible()

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

    const chooser = fresh.getByRole('dialog', { name: 'Restore Jump Cluster from Dropbox', exact: true })
    await chooser.getByRole('button', { name: `Restore ${backupFilename}`, exact: true }).click()
    const review = fresh.getByRole('dialog', { name: 'Open Jump Cluster', exact: true })
    await expect(review).toContainText(campaignBaselineFixture.cluster.name)
    await expect(review).toContainText(backupFilename)
    await review.getByRole('button', { name: 'Open Jump Cluster', exact: true }).click()

    await expect(fresh.getByText('Restored from Dropbox', { exact: true })).toBeVisible()
    await waitForWorkspaceSaved(fresh)
    expect(providerCalls).toEqual([
      'authorization', 'token exchange', 'upload to App Folder',
      'authorization', 'token exchange', 'list App Folder', 'download selected revision',
    ])
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

async function installControlledDropbox(
  context: BrowserContext,
  appKey: string,
  backups: ControlledDropboxBackup[],
  calls: string[],
): Promise<void> {
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
    const metadata = {
      id: 'id:controlled-restore',
      name: args.path.slice(1),
      rev: 'a1b2c3d4e5',
      path_display: args.path,
      server_modified: '2026-11-13T10:00:00Z',
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
