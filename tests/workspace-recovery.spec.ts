import { expect, test } from './fixtures'
import campaignBaselineFixture from './fixtures/workspace-data-campaign-baseline.json' with { type: 'json' }
import { openChartDetailsEditor, waitForWorkspaceSaved, waitForWorkspaceStartup, overwriteWorkspaceRecord } from './helpers'
import { createLocalWorkspace } from '../domain/workspace'

const workspaceStorageModulePath = `/_nuxt/@fs/${decodeURIComponent(
  new URL('../utils/workspace-storage.ts', import.meta.url).pathname,
).replace(/^\/+/, '')}`

type WorkspaceRecordKey = 'current' | 'last-valid'

async function readWorkspaceRecord(
  page: import('@playwright/test').Page,
  key: WorkspaceRecordKey,
): Promise<unknown> {
  return page.evaluate(async (recordKey) => {
    const request = indexedDB.open('ttrpg-cluster-control')
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Could not open the workspace database.'))
    })

    try {
      return await new Promise<unknown>((resolve, reject) => {
        const transaction = database.transaction('workspace', 'readonly')
        const read = transaction.objectStore('workspace').get(recordKey)
        read.onsuccess = () => resolve(read.result)
        read.onerror = () => reject(read.error ?? new Error('Could not read the workspace record.'))
      })
    } finally {
      database.close()
    }
  }, key)
}

async function readCurrentWorkspace(page: import('@playwright/test').Page): Promise<unknown> {
  return readWorkspaceRecord(page, 'current')
}

test('the last valid workspace can be restored after the current snapshot fails to load', async ({ page }) => {
  test.setTimeout(90_000)
  const legacyWorkspace = createLocalWorkspace('Kestrel Reach', 'Vesper')
  await page.route('**/__legacy-v1.html', route => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: '<!doctype html><html><body>Legacy IndexedDB fixture</body></html>',
  }))
  await page.goto('/__legacy-v1.html')
  await page.evaluate(async (workspace) => {
    const request = indexedDB.open('ttrpg-cluster-control', 1)
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onupgradeneeded = () => request.result.createObjectStore('workspace')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Could not create the version 1 workspace database.'))
    })
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction('workspace', 'readwrite')
        transaction.objectStore('workspace').put(workspace, 'current')
        transaction.oncomplete = () => resolve()
        transaction.onabort = () => reject(transaction.error ?? new Error('Could not seed the version 1 workspace.'))
        transaction.onerror = () => reject(transaction.error ?? new Error('Could not seed the version 1 workspace.'))
      })
    } finally {
      database.close()
    }
  }, legacyWorkspace)
  await page.goto('/')
  await waitForWorkspaceStartup(page)
  await expect(page.getByRole('region', { name: 'Current Jump Cluster' }).getByRole('heading', { name: 'Kestrel Reach' })).toBeVisible()
  const legacyOpenResult = await page.evaluate(() => new Promise<string>((resolve) => {
    const request = indexedDB.open('ttrpg-cluster-control', 1)
    request.onsuccess = () => {
      request.result.close()
      resolve('opened')
    }
    request.onerror = () => resolve(request.error?.name ?? 'unknown')
  }))
  expect(legacyOpenResult).toBe('VersionError')

  const chartEditor = await openChartDetailsEditor(page)
  await chartEditor.getByLabel('Jump Cluster').fill('Current Reach')
  await chartEditor.getByRole('button', { name: 'Apply details' }).click()
  await waitForWorkspaceSaved(page)

  await overwriteWorkspaceRecord(page, 'current', { damaged: true })
  await page.reload()

  await expect(page.getByRole('heading', { name: 'Your workspace could not be opened.' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Restore last valid backup' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open local Jump Cluster backup' })).toBeVisible()
  const recoveryCopy = await readWorkspaceRecord(page, 'last-valid')
  const recoveryFileChooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Open local Jump Cluster backup' }).click()
  await (await recoveryFileChooser).setFiles({
    name: 'campaign-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(campaignBaselineFixture)),
  })
  const recoveryReview = page.getByRole('dialog')
  await expect(recoveryReview).toContainText('Kestrel Reach Prime')
  await recoveryReview.getByRole('button', { name: /(?:Open|Replace) Jump Cluster/ }).click()

  await expect(page.getByRole('region', { name: 'Current Jump Cluster' }).getByRole('heading', { name: 'Kestrel Reach Prime' })).toBeVisible()
  await expect(readWorkspaceRecord(page, 'last-valid')).resolves.toEqual(recoveryCopy)

  await page.reload()
  await waitForWorkspaceStartup(page)
  await expect(page.getByRole('region', { name: 'Current Jump Cluster' }).getByRole('heading', { name: 'Kestrel Reach Prime' })).toBeVisible()

  await page.evaluate(async () => {
    const request = indexedDB.open('ttrpg-cluster-control')
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Could not open the workspace database.'))
    })
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction('workspace', 'readwrite')
        transaction.objectStore('workspace').clear()
        transaction.oncomplete = () => resolve()
        transaction.onabort = () => reject(transaction.error ?? new Error('Could not clear the test workspace.'))
        transaction.onerror = () => reject(transaction.error ?? new Error('Could not clear the test workspace.'))
      })
    } finally {
      database.close()
    }
  })
  await page.reload()
  await expect(page.getByRole('button', { name: 'Create local workspace' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open local Jump Cluster backup' })).toBeVisible()
  const welcomeFileChooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Open local Jump Cluster backup' }).click()
  await (await welcomeFileChooser).setFiles({
    name: 'campaign-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(campaignBaselineFixture)),
  })
  const welcomeReview = page.getByRole('dialog')
  await expect(welcomeReview).toContainText('Kestrel Reach Prime')
  await welcomeReview.getByRole('button', { name: /(?:Open|Replace) Jump Cluster/ }).click()

  await expect(page.getByRole('region', { name: 'Current Jump Cluster' }).getByRole('heading', { name: 'Kestrel Reach Prime' })).toBeVisible()
  await page.reload()
  await waitForWorkspaceStartup(page)
  await expect(page.getByRole('region', { name: 'Current Jump Cluster' }).getByRole('heading', { name: 'Kestrel Reach Prime' })).toBeVisible()
  const restored = await readCurrentWorkspace(page) as {
    cluster: { name: string; systems: Array<{ name: string; objects: Array<{ id: string; customFieldValues?: Record<string, string> }> }>; routes: Array<{ id: string }> }
    objectFieldSettings: { customFields: Array<{ name: string }> }
    layout: { systemPositions: Record<string, { x: number; y: number }> }
  }
  expect(restored.cluster.name).toBe('Kestrel Reach Prime')
  expect(restored.cluster.systems.map(system => system.name)).toEqual(['Vesper Prime', 'Harrow'])
  expect(restored.cluster.routes.map(route => route.id)).toContain('campaign-baseline-route')
  expect(restored.cluster.systems[0]?.objects.find(object => object.id === 'campaign-baseline-iria')?.customFieldValues)
    .toEqual({ 'campaign-baseline-warden-notes': 'Existing campaign record.' })
  expect(restored.objectFieldSettings.customFields.map(field => field.name)).toContain('Warden notes')
  expect(restored.layout.systemPositions['campaign-baseline-vesper']).toEqual({ x: 0.35, y: 0.5 })
})

test('a failed backup restore stays unavailable and preserves both records until a retry succeeds', async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await waitForWorkspaceSaved(page)

  const backupBefore = await readWorkspaceRecord(page, 'last-valid')
  await overwriteWorkspaceRecord(page, 'current', { damaged: true })
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Your workspace could not be opened.' })).toBeVisible()

  await page.evaluate(() => {
    const transactionPrototype = IDBTransaction.prototype
    const storePrototype = IDBObjectStore.prototype
    const originalAddEventListener = transactionPrototype.addEventListener
    const originalPut = storePrototype.put
    const hooks = window as typeof window & {
      __restoreFaultHooks?: {
        originalAddEventListener: typeof originalAddEventListener
        originalPut: typeof originalPut
        pending: Array<() => void>
        released: boolean
      }
    }

    hooks.__restoreFaultHooks = { originalAddEventListener, originalPut, pending: [], released: false }
    transactionPrototype.addEventListener = function (
      this: IDBTransaction,
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ): void {
      if ((type !== 'abort' && type !== 'error') || this.mode !== 'readwrite') {
        return originalAddEventListener.call(this, type, listener, options)
      }

      // eslint-disable-next-line @typescript-eslint/no-this-alias -- Deferred IDB listeners must retain the transaction receiver.
      const transaction = this
      const deferredListener: EventListener = (event) => {
        const deliver = () => {
          if (typeof listener === 'function') listener.call(transaction, event)
          else listener.handleEvent(event)
        }

        if (hooks.__restoreFaultHooks?.released) deliver()
        else hooks.__restoreFaultHooks?.pending.push(deliver)
      }
      return originalAddEventListener.call(this, type, deferredListener, options)
    }
    storePrototype.put = function (value: unknown, key?: IDBValidKey) {
      const request = originalPut.call(this, value, key)
      if (this.name === 'workspace' && key === 'current' && this.transaction.mode === 'readwrite') {
        const transaction = this.transaction
        queueMicrotask(() => transaction.abort())
      }
      return request
    }
  })

  try {
    await page.getByRole('button', { name: 'Restore last valid backup' }).click()
    await expect(page.getByRole('heading', { name: "Opening this browser's workspace..." })).toBeVisible()
    await expect(page.getByLabel('Jump Cluster')).toHaveCount(0)
    await expect(page.getByLabel('First star system')).toHaveCount(0)
    await expect(page.getByRole('group', { name: /Jump Cluster map|star system map/ })).toHaveCount(0)
    await expect(page.getByRole('complementary')).toHaveCount(0)
    await page.waitForFunction(() => {
      const hooks = window as typeof window & { __restoreFaultHooks?: { pending: Array<unknown> } }
      return (hooks.__restoreFaultHooks?.pending.length ?? 0) > 0
    })
    await page.evaluate(() => {
      const hooks = window as typeof window & {
        __restoreFaultHooks?: { pending: Array<() => void>; released: boolean }
      }
      if (!hooks.__restoreFaultHooks) return

      hooks.__restoreFaultHooks.released = true
      for (const release of hooks.__restoreFaultHooks.pending.splice(0)) release()
    })
    await expect(page.getByRole('alert')).toContainText(/abort|transaction failed/i, { timeout: 10_000 })
  } finally {
    await page.evaluate(() => {
      const hooks = window as typeof window & {
        __restoreFaultHooks?: {
          originalAddEventListener: typeof IDBTransaction.prototype.addEventListener
          originalPut: typeof IDBObjectStore.prototype.put
          pending: Array<() => void>
          released: boolean
        }
      }
      if (!hooks.__restoreFaultHooks) return

      hooks.__restoreFaultHooks.released = true
      for (const release of hooks.__restoreFaultHooks.pending.splice(0)) release()
      IDBTransaction.prototype.addEventListener = hooks.__restoreFaultHooks.originalAddEventListener
      IDBObjectStore.prototype.put = hooks.__restoreFaultHooks.originalPut
      delete hooks.__restoreFaultHooks
    })
  }

  await expect(readCurrentWorkspace(page)).resolves.toEqual({ damaged: true })
  await expect(readWorkspaceRecord(page, 'last-valid')).resolves.toEqual(backupBefore)
  await expect(page.getByRole('heading', { name: 'Your workspace could not be opened.' })).toBeVisible()
  await expect(page.getByRole('group', { name: /Jump Cluster map|star system map/ })).toHaveCount(0)
  await expect(page.getByRole('complementary')).toHaveCount(0)
  await page.getByRole('button', { name: 'Restore last valid backup' }).click()
  await expect(page.getByRole('navigation', { name: 'Map context and commands' })).toContainText('Vesper')
  await page.reload()
  await expect(page.getByRole('navigation', { name: 'Map context and commands' })).toContainText('Vesper')
})

test('a failed IndexedDB save preserves current and backup snapshots @development-storage', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await waitForWorkspaceSaved(page)

  const snapshots = await page.evaluate(async (modulePath) => {
    const storage = await import(modulePath) as {
      loadWorkspace: () => Promise<{ cluster: { name: string; [key: string]: unknown }; [key: string]: unknown } | null>
      saveWorkspace: (workspace: unknown) => Promise<void>
      restoreWorkspaceBackup: () => Promise<{ cluster: { name: string }; } | null>
    }
    const initial = await storage.loadWorkspace()
    if (!initial) throw new Error('The created workspace could not be loaded.')

    let invalidSaveError = ''
    try {
      await storage.saveWorkspace({ damaged: true })
    } catch (error) {
      invalidSaveError = error instanceof Error ? error.message : String(error)
    }
    const afterInvalidSave = await storage.loadWorkspace()

    const current = { ...initial, cluster: { ...initial.cluster, name: 'Current Reach' } }
    await storage.saveWorkspace(current)

    const rejected = { ...current, cluster: { ...current.cluster, name: 'Rejected Reach' } }
    const prototype = IDBObjectStore.prototype
    const originalPut = prototype.put
    let writeCount = 0
    prototype.put = function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
      const request = originalPut.call(this, value, key)
      writeCount += 1
      if (writeCount === 2) {
        this.transaction.abort()
      }
      return request
    }

    let failedSave = ''
    try {
      await storage.saveWorkspace(rejected)
    } catch (error) {
      failedSave = error instanceof Error ? error.message : String(error)
    } finally {
      prototype.put = originalPut
    }

    const afterFailure = await storage.loadWorkspace()
    const restoredBackup = await storage.restoreWorkspaceBackup()
    return {
      invalidSaveError,
      nameAfterInvalidSave: afterInvalidSave?.cluster.name,
      failedSave,
      currentName: afterFailure?.cluster.name,
      backupName: restoredBackup?.cluster.name,
    }
  }, workspaceStorageModulePath)

  expect(snapshots.invalidSaveError).not.toBe('')
  expect(snapshots.nameAfterInvalidSave).toBe('Kestrel Reach')
  expect(snapshots.failedSave).not.toBe('')
  expect(snapshots.currentName).toBe('Current Reach')
  expect(snapshots.backupName).toBe('Kestrel Reach')
})

test('a damaged backup is rejected without replacing the current record', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await waitForWorkspaceSaved(page)

  const damagedCurrentRecord = { damaged: 'current record sentinel' }
  const damagedBackupRecord = { damaged: 'last-valid record sentinel' }
  await overwriteWorkspaceRecord(page, 'current', damagedCurrentRecord)
  await overwriteWorkspaceRecord(page, 'last-valid', damagedBackupRecord)
  await page.reload()
  await page.getByRole('button', { name: 'Restore last valid backup' }).click()

  await expect(page.getByRole('alert')).toContainText('local backup has an unsupported or damaged format')
  await expect(page.getByRole('heading', { name: 'Your workspace could not be opened.' })).toBeVisible()
  await expect(readCurrentWorkspace(page)).resolves.toEqual(damagedCurrentRecord)
  await expect(readWorkspaceRecord(page, 'last-valid')).resolves.toEqual(damagedBackupRecord)
})

test('a temporary IndexedDB opening failure can be retried without exposing a partial workspace', async ({ page }) => {
  test.setTimeout(60_000)
  await page.addInitScript(() => {
    const prototype = IDBFactory.prototype
    const originalOpen = prototype.open
    let failFirstOpen = true

    prototype.open = function (databaseName: string, version?: number): IDBOpenDBRequest {
      if (failFirstOpen) {
        failFirstOpen = false
        throw new DOMException('IndexedDB is temporarily unavailable.', 'UnknownError')
      }

      return originalOpen.call(this, databaseName, version)
    }
  })
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Your workspace could not be opened.' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('alert')).toContainText('IndexedDB is temporarily unavailable.')
  await expect(page.getByLabel('Jump Cluster')).toHaveCount(0)
  await expect(page.getByLabel('First star system')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Restore last valid backup' })).toBeVisible()

  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByLabel('Jump Cluster')).toBeVisible({ timeout: 30_000 })
  await page.getByLabel('Jump Cluster').fill('Liminal Reach')
  await page.getByLabel('First star system').fill('Aster')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  await expect(page.getByRole('navigation', { name: 'Map context and commands' })).toContainText('Aster')
  await waitForWorkspaceSaved(page)
})
