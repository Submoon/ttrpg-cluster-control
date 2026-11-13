import { computed, effectScope, ref } from 'vue'
import { expect, test } from './fixtures'
import { useGoogleDriveRestore } from '../composables/useGoogleDriveRestore'
import type { GoogleDriveSignInController, GoogleDriveSignInStatus } from '../composables/useGoogleDriveSignIn'
import { GoogleDriveApiError } from '../utils/google-drive-api'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((complete) => { resolve = complete })
  return { promise, resolve }
}

function readySignIn(
  requestAccessToken: (signal?: AbortSignal) => Promise<string>,
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

test('Drive appData backups can be paged, downloaded as JSON, and passed unchanged to shared restore @pure', async () => {
  const events: string[] = []
  const sources: Array<{ name: string; content: unknown }> = []
  const downloads: Array<{ filename: string; content: string }> = []
  const providerSignals: AbortSignal[] = []
  const listStarted = deferred<void>()
  const restoreFinished = deferred<void>()
  const fileOne = { id: 'backup-1', name: 'Ember Reach-jump-cluster-2026-11-13.json', createdTime: '2026-11-13T10:00:00.000Z' }
  const fileTwo = { id: 'backup-2', name: 'Ember Reach-jump-cluster-2026-11-12.json', createdTime: '2026-11-12T10:00:00.000Z' }
  const restore = {
    async openFrom(load: (signal?: AbortSignal) => Promise<{ name: string; content: unknown } | null>, signal?: AbortSignal): Promise<boolean> {
      events.push('restore lease')
      const source = await load(signal)
      if (source) sources.push(source)
      restoreFinished.resolve()
      return true
    },
  }
  const scope = effectScope()
  let controller: ReturnType<typeof useGoogleDriveRestore> | undefined
  scope.run(() => {
    controller = useGoogleDriveRestore(restore, readySignIn(signal => {
        events.push('token requested')
        if (signal) providerSignals.push(signal)
        return Promise.resolve('drive-token')
      }), {
      listBackups: async (_token, pageToken, signal) => {
        if (signal) providerSignals.push(signal)
        events.push(pageToken ? `listed:${pageToken}` : 'listed:first')
        listStarted.resolve()
        return pageToken
          ? { files: [fileOne, fileTwo] }
          : { files: [fileOne], nextPageToken: 'page-2' }
      },
      readFile: async (_token, fileId, signal) => {
        if (signal) providerSignals.push(signal)
        events.push(`read:${fileId}`)
        return `{"backup":"${fileId}"}`
      },
      downloadFile: (filename, content) => { downloads.push({ filename, content }) },
    })
  })
  if (!controller) throw new Error('The Google Drive restore controller did not initialize.')

  try {
    controller.activate()
    expect(events).toEqual(['restore lease', 'token requested'])
    await listStarted.promise
    await Promise.resolve()
    expect(controller.state.value).toBe('choosing')
    expect(controller.backups.value).toEqual([fileOne])
    expect(controller.canLoadMore.value).toBe(true)

    controller.loadMore()
    await Promise.resolve()
    expect(controller.backups.value).toEqual([fileOne, fileTwo])
    expect(controller.nextPageToken.value).toBeUndefined()

    controller.downloadBackup(fileOne.id)
    await Promise.resolve()
    await Promise.resolve()
    expect(downloads).toEqual([{
      filename: fileOne.name,
      content: '{"backup":"backup-1"}',
    }])

    controller.openBackup(fileTwo.id)
    await restoreFinished.promise

    expect(events).toEqual([
      'restore lease',
      'token requested',
      'listed:first',
      'listed:page-2',
      'read:backup-1',
      'read:backup-2',
    ])
    expect(sources).toEqual([{
      name: fileTwo.name,
      content: '{"backup":"backup-2"}',
    }])
    expect(providerSignals.length).toBe(5)
    expect(providerSignals.every(signal => signal === providerSignals[0])).toBe(true)
  } finally {
    scope.stop()
  }
})

test('canceling during OAuth aborts the owned request and prevents listing stale backups @pure', async () => {
  const events: string[] = []
  const restoreFinished = deferred<void>()
  const restore = {
    async openFrom(load: (signal?: AbortSignal) => Promise<{ name: string; content: unknown } | null>, signal?: AbortSignal): Promise<boolean> {
      await load(signal)
      restoreFinished.resolve()
      return true
    },
  }
  const scope = effectScope()
  let controller: ReturnType<typeof useGoogleDriveRestore> | undefined
  scope.run(() => {
    controller = useGoogleDriveRestore(restore, readySignIn(signal => {
        events.push('token requested')
        return new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => reject(new Error('sign-in canceled')), { once: true })
        })
      }), {
      listBackups: async () => { events.push('list requested'); return { files: [] } },
      readFile: async () => '',
      downloadFile: () => undefined,
    })
  })
  if (!controller) throw new Error('The Google Drive restore controller did not initialize.')

  try {
    controller.activate()
    expect(events).toEqual(['token requested'])
    controller.cancel()
    await restoreFinished.promise

    expect(events).toEqual(['token requested'])
    expect(controller.state.value).toBe('idle')
    expect(controller.backups.value).toEqual([])
  } finally {
    scope.stop()
  }
})

test('a list 401 invalidates its token so the next explicit restore requests authorization again @pure', async () => {
  const restore = {
    async openFrom(load: (signal?: AbortSignal) => Promise<{ name: string; content: unknown } | null>, signal?: AbortSignal): Promise<boolean> {
      try {
        await load(signal)
      } catch {
        // The real restore owner reports loader failures through its page-level review state.
      }
      return true
    },
  }
  const tokens: string[] = []
  const invalidated: string[] = []
  let listCount = 0
  const scope = effectScope()
  const controller = scope.run(() => useGoogleDriveRestore(
    restore,
    readySignIn(async () => {
      const token = `token-${tokens.length + 1}`
      tokens.push(token)
      return token
    }, token => invalidated.push(token)),
    {
      listBackups: async () => {
        listCount += 1
        if (listCount === 1) throw new GoogleDriveApiError('request-failed', 'Expired.', false, 401)
        return { files: [] }
      },
      readFile: async () => '',
      downloadFile: () => undefined,
    },
  ))
  if (!controller) throw new Error('The Google Drive restore controller did not initialize.')

  try {
    controller.activate()
    await expect.poll(() => controller.state.value).toBe('idle')
    expect(invalidated).toEqual(['token-1'])
    expect(controller.message.value).toMatch(/authorization expired/i)
    controller.activate()
    await expect.poll(() => listCount).toBe(2)
    expect(tokens).toEqual(['token-1', 'token-2'])
    controller.cancel(false)
  } finally {
    scope.stop()
  }
})

test('a selected-file 401 invalidates the token and closes the stale backup list @pure', async () => {
  const file = { id: 'backup-1', name: 'Backup.json', createdTime: '2026-11-13T10:00:00Z' }
  const restore = {
    async openFrom(load: (signal?: AbortSignal) => Promise<{ name: string; content: unknown } | null>, signal?: AbortSignal): Promise<boolean> {
      await load(signal)
      return true
    },
  }
  const invalidated: string[] = []
  let listCount = 0
  const scope = effectScope()
  const controller = scope.run(() => useGoogleDriveRestore(
    restore,
    readySignIn(async () => 'cached-token', token => invalidated.push(token)),
    {
      listBackups: async () => { listCount += 1; return { files: [file] } },
      readFile: async () => { throw new GoogleDriveApiError('request-failed', 'Expired.', false, 401) },
      downloadFile: () => undefined,
    },
  ))
  if (!controller) throw new Error('The Google Drive restore controller did not initialize.')

  try {
    controller.activate()
    await expect.poll(() => controller.state.value).toBe('choosing')
    controller.openBackup(file.id)
    await expect.poll(() => controller.state.value).toBe('idle')
    expect(invalidated).toEqual(['cached-token'])
    expect(controller.backups.value).toEqual([])
    expect(controller.message.value).toMatch(/authorization expired/i)
    expect(controller.dialogOpen.value).toBe(false)
    controller.activate()
    await expect.poll(() => listCount).toBe(2)
    expect(controller.state.value).toBe('choosing')
    controller.cancel(false)
  } finally {
    scope.stop()
  }
})
