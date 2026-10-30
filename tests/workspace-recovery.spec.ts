import { expect, test } from './fixtures'
import { waitForWorkspaceSaved, openWorkspaceHierarchy } from './helpers'
import { returnToClusterMap, jsonMapImportInput } from './helpers'
import { setJsonFile } from './helpers'
import { importReviewDialog, resolveImportReview } from './helpers'

const workspaceStorageModulePath = `/_nuxt/@fs/${decodeURIComponent(
  new URL('../utils/workspace-storage.ts', import.meta.url).pathname,
).replace(/^\/+/, '')}`

type StoredWorkspace = {
  cluster: {
    systems: Array<{
      id: string
      name: string
      objects: Array<{ id: string; subtype: string }>
      orbits: unknown[]
    }>
  }
  objectFieldSettings: Record<string, unknown>
}

type WorkspaceRecordKey = 'current' | 'last-valid'

async function readWorkspaceRecord(
  page: import('@playwright/test').Page,
  key: WorkspaceRecordKey,
): Promise<unknown> {
  return page.evaluate(async (recordKey) => {
    const request = indexedDB.open('ttrpg-cluster-control', 1)
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

async function overwriteWorkspaceRecord(
  page: import('@playwright/test').Page,
  key: WorkspaceRecordKey,
  value: unknown,
): Promise<void> {
  await page.evaluate(async (stored) => {
    const request = indexedDB.open('ttrpg-cluster-control', 1)
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Could not open the workspace database.'))
    })

    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction('workspace', 'readwrite')
        transaction.objectStore('workspace').put(stored.value, stored.key)
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error ?? new Error('Could not corrupt the workspace snapshot.'))
        transaction.onabort = () => reject(transaction.error ?? new Error('Could not corrupt the workspace snapshot.'))
      })
    } finally {
      database.close()
    }
  }, { key, value })
}

async function deleteWorkspaceRecord(
  page: import('@playwright/test').Page,
  key: WorkspaceRecordKey,
): Promise<void> {
  await page.evaluate(async (recordKey) => {
    const request = indexedDB.open('ttrpg-cluster-control', 1)
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Could not open the workspace database.'))
    })

    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction('workspace', 'readwrite')
        transaction.objectStore('workspace').delete(recordKey)
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error ?? new Error('Could not remove the workspace snapshot.'))
        transaction.onabort = () => reject(transaction.error ?? new Error('Could not remove the workspace snapshot.'))
      })
    } finally {
      database.close()
    }
  }, key)
}

test('an attached Orbit with undersized imported radii is rejected without losing current data', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await waitForWorkspaceSaved(page)
  await expect(page.getByRole('alert')).toHaveCount(0)

  const workspace = await readCurrentWorkspace(page) as StoredWorkspace
  const sourceSystem = workspace.cluster.systems[0]
  const primaryStar = sourceSystem?.objects.find(object => object.subtype === 'star')
  if (!sourceSystem || !primaryStar) throw new Error('The initial workspace is missing its primary star.')
  const importedSystem = {
    ...sourceSystem,
    id: 'small-orbit-system',
    name: 'Small Orbit Test',
    orbits: [{ id: 'small-orbit', hostId: primaryStar.id, order: 1 }],
  }
  const map = {
    format: 'ttrpg-cluster-control-map',
    version: 1,
    type: 'system',
    system: importedSystem,
    objectFieldSettings: workspace.objectFieldSettings,
    layout: {
      version: 1,
      orbitRadii: { 'small-orbit': { horizontal: 16, vertical: 24 } },
      orbitRotations: {},
      objectAngles: {},
    },
  }
  const input = jsonMapImportInput(page)
  await setJsonFile(input, 'small-orbit.json', JSON.stringify(map))

  await expect(page.getByRole('alert')).toContainText('Choose a valid version 1')
  await expect(page.getByRole('group', { name: 'Vesper star system map' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Map context and commands' })).toContainText('Vesper')
  const unchanged = await readCurrentWorkspace(page) as StoredWorkspace
  expect(unchanged.cluster.systems.map(system => system.name)).toEqual(['Vesper'])

  const correctedMap = {
    ...map,
    layout: {
      ...map.layout,
      orbitRadii: { 'small-orbit': { horizontal: 39, vertical: 40 } },
    },
  }
  await setJsonFile(input, 'small-orbit.json', JSON.stringify(correctedMap))
  const preview = importReviewDialog(page)
  const previewSummary = await preview.innerText()
  expect(previewSummary).toContain('star system')
  await resolveImportReview(preview, 'confirm')

  await returnToClusterMap(page)
  await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  const systems = page.getByRole('navigation', { name: 'Star systems' })
  await expect(systems.getByRole('button', { name: 'Open Small Orbit Test system map' })).toBeVisible()
  await expect.poll(async () =>
    (await readCurrentWorkspace(page) as StoredWorkspace).cluster.systems.map(system => system.name),
  ).toContain('Small Orbit Test')
  await page.reload()
  await openWorkspaceHierarchy(page)
  await expect(page.getByRole('navigation', { name: 'Star systems' })
    .getByRole('button', { name: 'SY Small Orbit Test 1 map objects' })).toBeVisible()
})

test('the last valid workspace can be restored after the current snapshot fails to load', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await waitForWorkspaceSaved(page)

  const inspector = page.getByRole('complementary', { name: 'Object inspector' })
  await page.getByRole('button', { name: 'Chart details' }).click()
  await inspector.getByRole('button', { name: 'Edit chart names' }).click()
  const chartNamesDialog = page.getByRole('dialog', { name: 'Edit chart names' })
  await chartNamesDialog.getByLabel('Jump Cluster').fill('Current Reach')
  await chartNamesDialog.getByRole('button', { name: 'Apply names' }).click()
  await waitForWorkspaceSaved(page)

  await overwriteWorkspaceRecord(page, 'current', { damaged: true })
  await page.reload()

  await expect(page.getByRole('heading', { name: 'Your workspace could not be opened.' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Restore last valid backup' })).toBeVisible()
  await page.getByRole('button', { name: 'Restore last valid backup' }).click()

  await expect(page.getByRole('navigation', { name: 'Map context and commands' })).toContainText('Vesper')
  await returnToClusterMap(page)
  await expect(page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('navigation', { name: 'Map context and commands' })).toContainText('Vesper')
  await returnToClusterMap(page)
  await expect(page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })).toBeVisible()
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
        this.transaction.abort()
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

test('the recovery screen explains when no local backup is available', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 500 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await waitForWorkspaceSaved(page)

  await overwriteWorkspaceRecord(page, 'current', { damaged: true })
  await deleteWorkspaceRecord(page, 'last-valid')
  await page.reload()

  await expect(page.getByRole('heading', { name: 'Your workspace could not be opened.' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Try again' })).toBeInViewport({ ratio: 1 })
  await expect(page.getByRole('button', { name: 'Restore last valid backup' })).toBeInViewport({ ratio: 1 })
  await page.getByRole('button', { name: 'Restore last valid backup' }).click()
  await expect(page.getByRole('alert')).toContainText('No local backup is available to restore.')
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
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

  await overwriteWorkspaceRecord(page, 'current', { damaged: true })
  await overwriteWorkspaceRecord(page, 'last-valid', { damaged: true })
  await page.reload()
  await page.getByRole('button', { name: 'Restore last valid backup' }).click()

  await expect(page.getByRole('alert')).toContainText('local backup has an unsupported or damaged format')
  await expect(page.getByRole('heading', { name: 'Your workspace could not be opened.' })).toBeVisible()
  await expect(readCurrentWorkspace(page)).resolves.toEqual({ damaged: true })
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
