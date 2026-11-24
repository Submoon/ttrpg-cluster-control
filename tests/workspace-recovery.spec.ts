import { expect, test } from './fixtures'
import { createSingleSystemWorkspace, openChartDetailsEditor, waitForWorkspaceSaved, waitForWorkspaceStartup, overwriteWorkspaceRecord, wardenMap } from './helpers'

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

test('recover the last valid workspace after the current snapshot becomes unreadable', async ({ page }) => {
  const { clusterName } = await createSingleSystemWorkspace(page)
  const editor = await openChartDetailsEditor(page)
  await editor.getByLabel('Jump Cluster', { exact: true }).fill('Current Reach')
  await editor.getByRole('button', { name: 'Apply details', exact: true }).click()
  await waitForWorkspaceSaved(page)

  const backup = await readWorkspaceRecord(page, 'last-valid')
  expect(backup).toMatchObject({ cluster: { name: clusterName } })
  expect(await readCurrentWorkspace(page)).toMatchObject({ cluster: { name: 'Current Reach' } })
  await overwriteWorkspaceRecord(page, 'current', { damaged: true })
  await page.reload()

  await expect(page.getByRole('heading', { name: 'Your workspace could not be opened.' })).toBeVisible()
  await page.getByRole('button', { name: 'Restore last valid backup', exact: true }).click()
  const map = wardenMap(page)
  await expect(map).toHaveAccessibleName(`${clusterName} continuous map`)
  await expect(map.getByRole('button', { name: 'Select Vesper', exact: true }).first()).toBeVisible()
  await expect.poll(() => readCurrentWorkspace(page)).toMatchObject({ cluster: { name: clusterName } })

  await page.reload()
  await waitForWorkspaceStartup(page)
  await expect(map).toHaveAccessibleName(`${clusterName} continuous map`)
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
