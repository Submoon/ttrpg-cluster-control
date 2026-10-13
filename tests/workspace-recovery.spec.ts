import { expect, test } from '@playwright/test'
import { setJsonFile } from './helpers'

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

async function readCurrentWorkspace(page: import('@playwright/test').Page): Promise<unknown> {
  return page.evaluate(async () => {
    const request = indexedDB.open('ttrpg-cluster-control', 1)
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Could not open the workspace database.'))
    })

    try {
      return await new Promise<unknown>((resolve, reject) => {
        const transaction = database.transaction('workspace', 'readonly')
        const read = transaction.objectStore('workspace').get('current')
        read.onsuccess = () => resolve(read.result)
        read.onerror = () => reject(read.error ?? new Error('Could not read the current workspace.'))
      })
    } finally {
      database.close()
    }
  })
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
  await expect(page.getByText('Saved on this device')).toBeVisible()

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
  const input = page.getByLabel('JSON map file')
  await setJsonFile(input, 'small-orbit.json', JSON.stringify(map))

  await expect(page.getByRole('alert')).toContainText('Choose a valid version 1')
  await expect(page.getByRole('group', { name: 'Vesper star system map' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Vesper', level: 1 })).toBeVisible()
  const unchanged = await readCurrentWorkspace(page) as StoredWorkspace
  expect(unchanged.cluster.systems.map(system => system.name)).toEqual(['Vesper'])

  const correctedMap = {
    ...map,
    layout: {
      ...map.layout,
      orbitRadii: { 'small-orbit': { horizontal: 39, vertical: 40 } },
    },
  }
  const previewPromise = page.waitForEvent('dialog')
  await setJsonFile(input, 'small-orbit.json', JSON.stringify(correctedMap))
  const preview = await previewPromise
  expect(preview.message()).toContain('star system')
  await preview.accept()

  const systems = page.getByRole('navigation', { name: 'Star systems' })
  await expect(systems.getByRole('button', { name: /Small Orbit Test/ })).toBeVisible()
  await expect.poll(async () =>
    (await readCurrentWorkspace(page) as StoredWorkspace).cluster.systems.map(system => system.name),
  ).toContain('Small Orbit Test')
  await page.reload()
  await expect(page.getByRole('navigation', { name: 'Star systems' })
    .getByRole('button', { name: /Small Orbit Test/ })).toBeVisible()
})

test('the last valid workspace can be restored after the current snapshot fails to load', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await expect(page.getByText('Saved on this device')).toBeVisible()

  const inspector = page.getByRole('complementary', { name: 'Object inspector' })
  await page.getByRole('button', { name: 'Chart details' }).click()
  await inspector.getByRole('button', { name: 'Edit chart names' }).click()
  await inspector.getByLabel('Jump Cluster').fill('Current Reach')
  await inspector.getByRole('button', { name: 'Save chart names' }).click()
  await expect(page.getByText('Saved on this device')).toBeVisible()

  await overwriteWorkspaceRecord(page, 'current', { damaged: true })
  await page.reload()

  await expect(page.getByRole('heading', { name: 'Your workspace could not be opened.' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Restore last valid backup' })).toBeVisible()
  await page.getByRole('button', { name: 'Restore last valid backup' }).click()

  await expect(page.getByRole('heading', { name: 'Vesper', level: 1 })).toBeVisible()
  await page.getByRole('button', { name: 'Cluster map' }).click()
  await expect(page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Vesper', level: 1 })).toBeVisible()
  await page.getByRole('button', { name: 'Cluster map' }).click()
  await expect(page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })).toBeVisible()
})

test('the recovery screen explains when no local backup is available', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await expect(page.getByText('Saved on this device')).toBeVisible()

  await overwriteWorkspaceRecord(page, 'current', { damaged: true })
  await deleteWorkspaceRecord(page, 'last-valid')
  await page.reload()

  await expect(page.getByRole('heading', { name: 'Your workspace could not be opened.' })).toBeVisible()
  await page.getByRole('button', { name: 'Restore last valid backup' }).click()
  await expect(page.getByRole('alert')).toContainText('No local backup is available to restore.')
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
})

test('a failed IndexedDB save preserves current and backup snapshots', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await expect(page.getByText('Saved on this device')).toBeVisible()

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
  await expect(page.getByText('Saved on this device')).toBeVisible()

  await overwriteWorkspaceRecord(page, 'current', { damaged: true })
  await overwriteWorkspaceRecord(page, 'last-valid', { damaged: true })
  await page.reload()
  await page.getByRole('button', { name: 'Restore last valid backup' }).click()

  await expect(page.getByRole('alert')).toContainText('local backup has an unsupported or damaged format')
  await expect(page.getByRole('heading', { name: 'Your workspace could not be opened.' })).toBeVisible()
  await expect(readCurrentWorkspace(page)).resolves.toEqual({ damaged: true })
})
