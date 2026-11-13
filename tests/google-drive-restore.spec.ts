import { effectScope } from 'vue'
import { expect, test } from './fixtures'
import { useGoogleDriveRestore } from '../composables/useGoogleDriveRestore'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((complete) => { resolve = complete })
  return { promise, resolve }
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
    controller = useGoogleDriveRestore(restore, { public: {
      googleDriveClientId: 'client.apps.googleusercontent.com',
    } }, {
      servicesAreLoaded: () => false,
      loadServices: async () => { events.push('scripts loaded') },
      requestAccessToken: (_clientId, signal) => {
        events.push('token requested')
        if (signal) providerSignals.push(signal)
        return Promise.resolve('drive-token')
      },
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
    expect(events).toEqual(['scripts loaded'])
    await Promise.resolve()
    expect(controller.state.value).toBe('continue')

    controller.activate()
    expect(events.slice(1, 3)).toEqual(['restore lease', 'token requested'])
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
      'scripts loaded',
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
    controller = useGoogleDriveRestore(restore, { public: {
      googleDriveClientId: 'client.apps.googleusercontent.com',
    } }, {
      servicesAreLoaded: () => true,
      loadServices: async () => undefined,
      requestAccessToken: (_clientId, signal) => {
        events.push('token requested')
        return new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => reject(new Error('sign-in canceled')), { once: true })
        })
      },
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

test('canceling script preparation does not open the restore lease or start a later authorization @pure', async () => {
  const scripts = deferred<void>()
  const events: string[] = []
  const restore = {
    async openFrom(): Promise<boolean> { events.push('restore lease'); return false },
  }
  const scope = effectScope()
  let controller: ReturnType<typeof useGoogleDriveRestore> | undefined
  scope.run(() => {
    controller = useGoogleDriveRestore(restore, { public: {
      googleDriveClientId: 'client.apps.googleusercontent.com',
    } }, {
      servicesAreLoaded: () => false,
      loadServices: () => scripts.promise,
      requestAccessToken: () => { events.push('token requested'); return Promise.resolve('drive-token') },
      listBackups: async () => ({ files: [] }),
      readFile: async () => '',
      downloadFile: () => undefined,
    })
  })
  if (!controller) throw new Error('The Google Drive restore controller did not initialize.')

  try {
    controller.activate()
    controller.cancel()
    scripts.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(events).toEqual([])
    expect(controller.state.value).toBe('idle')
  } finally {
    scope.stop()
  }
})
