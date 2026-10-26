import { expect, test } from '@playwright/test'
import { activeWorkspaceFeedback, addClusterSystem, returnToClusterMap, openWorkspaceHierarchy, clickDockAction, jsonMapImportInput, setWorkspaceMapMode } from './helpers'
import { deletionReviewDialog, importReviewDialog, resolveDeletionReview, resolveImportReview } from './helpers'
import {
  createJumpRoute,
  createLocalWorkspace,
  createSystemObject,
  exportJumpCluster,
} from '../domain/workspace'
import {
  addCatalogueObject,
  downloadJson,
  setHeaderMapActionsOpen,
  setJsonFile,
  type DownloadWindow,
} from './helpers'

type ChartWriteGate = {
  originalAddEventListener: typeof IDBTransaction.prototype.addEventListener
  originalPut: typeof IDBObjectStore.prototype.put
  originalRequestOnError?: PropertyDescriptor
  pending: Array<{ transaction: IDBTransaction; type: string; release: () => void }>
  holdCompletions: boolean
  holdFailures: boolean
  abortCurrentWrites: number
  writeCount: number
}

type ChartWriteGateWindow = Window & { __chartWriteGate?: ChartWriteGate }

async function captureExportedJson(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(() => {
    const downloadWindow = window as DownloadWindow
    downloadWindow.__mapExportBlobs = []
    const createObjectURL = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (object) => {
      if (object instanceof Blob) downloadWindow.__mapExportBlobs?.push(object)
      return createObjectURL(object)
    }
  })
}

async function beforeUnloadIsPrevented(page: import('@playwright/test').Page): Promise<boolean> {
  return page.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent
    window.dispatchEvent(event)
    return event.defaultPrevented
  })
}

async function installChartWriteGate(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    const transactionPrototype = IDBTransaction.prototype
    const storePrototype = IDBObjectStore.prototype
    const requestErrorDescriptor = Object.getOwnPropertyDescriptor(IDBRequest.prototype, 'onerror')
    const gate: ChartWriteGate = {
      originalAddEventListener: transactionPrototype.addEventListener,
      originalPut: storePrototype.put,
      originalRequestOnError: requestErrorDescriptor,
      pending: [],
      holdCompletions: false,
      holdFailures: false,
      abortCurrentWrites: 0,
      writeCount: 0,
    }
    ;(window as ChartWriteGateWindow).__chartWriteGate = gate

    transactionPrototype.addEventListener = function (
      this: IDBTransaction,
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ): void {
      const isWorkspaceWrite = this.db.name === 'ttrpg-cluster-control'
        && this.mode === 'readwrite'
        && this.objectStoreNames.contains('workspace')
      const shouldHold = type === 'complete'
        ? gate.holdCompletions
        : (type === 'error' || type === 'abort') && gate.holdFailures
      if (!isWorkspaceWrite || !shouldHold) {
        return gate.originalAddEventListener.call(this, type, listener, options)
      }

      const transaction = this
      const deferredListener: EventListener = (event) => {
        const release = () => {
          if (typeof listener === 'function') listener.call(transaction, event)
          else listener.handleEvent(event)
        }
        if (shouldHold) gate.pending.push({ transaction, type, release })
        else release()
      }
      return gate.originalAddEventListener.call(this, type, deferredListener, options)
    }

    if (requestErrorDescriptor?.set) {
      Object.defineProperty(IDBRequest.prototype, 'onerror', {
        ...requestErrorDescriptor,
        set(this: IDBRequest, listener: ((this: IDBRequest, event: Event) => unknown) | null) {
          if (!listener || !requestErrorDescriptor.set) {
            requestErrorDescriptor.set?.call(this, listener)
            return
          }
          const request = this
          const transaction = request.transaction
          if (!transaction || transaction.db.name !== 'ttrpg-cluster-control'
            || transaction.mode !== 'readwrite' || !transaction.objectStoreNames.contains('workspace')) {
            requestErrorDescriptor.set.call(this, listener)
            return
          }
          const deferredListener = function (this: IDBRequest, event: Event): void {
            if (gate.holdFailures) {
              gate.pending.push({
                transaction,
                type: 'request-error',
                release: () => listener.call(request, event),
              })
            } else {
              listener.call(request, event)
            }
          }
          requestErrorDescriptor.set.call(this, deferredListener)
        },
      })
    }

    storePrototype.put = function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
      const request = gate.originalPut.call(this, value, key)
      if (this.transaction.db.name === 'ttrpg-cluster-control' && this.name === 'workspace') {
        gate.writeCount += 1
        if (key === 'current' && gate.abortCurrentWrites > 0) {
          gate.abortCurrentWrites -= 1
          this.transaction.abort()
        }
      }
      return request
    }
  })
}

async function setChartWriteGate(
  page: import('@playwright/test').Page,
  change: Partial<Pick<ChartWriteGate, 'holdCompletions' | 'holdFailures' | 'abortCurrentWrites'>>,
): Promise<void> {
  await page.evaluate((next) => {
    const gate = (window as ChartWriteGateWindow).__chartWriteGate
    if (!gate) throw new Error('The chart write gate is not installed.')
    Object.assign(gate, next)
  }, change)
}

async function readChartWriteGate(page: import('@playwright/test').Page): Promise<{
  pendingTransactions: number
  writeCount: number
}> {
  return page.evaluate(() => {
    const gate = (window as ChartWriteGateWindow).__chartWriteGate
    if (!gate) throw new Error('The chart write gate is not installed.')
    return {
      pendingTransactions: new Set(gate.pending.map(item => item.transaction)).size,
      writeCount: gate.writeCount,
    }
  })
}

async function releasePendingChartWrites(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    const gate = (window as ChartWriteGateWindow).__chartWriteGate
    if (!gate) return
    gate.holdCompletions = false
    for (const item of gate.pending.splice(0)) item.release()
  })
}

async function releaseChartWriteGate(page: import('@playwright/test').Page): Promise<void> {
  await releasePendingChartWrites(page)
  await page.evaluate(() => {
    const trackedWindow = window as ChartWriteGateWindow
    const gate = trackedWindow.__chartWriteGate
    if (!gate) return
    IDBTransaction.prototype.addEventListener = gate.originalAddEventListener
    IDBObjectStore.prototype.put = gate.originalPut
    if (gate.originalRequestOnError) {
      Object.defineProperty(IDBRequest.prototype, 'onerror', gate.originalRequestOnError)
    }
    delete trackedWindow.__chartWriteGate
  })
}

async function releaseFirstChartWriteNotification(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    const gate = (window as ChartWriteGateWindow).__chartWriteGate
    if (!gate) throw new Error('The chart write gate is not installed.')
    const notification = gate.pending.shift()
    if (!notification) throw new Error('No chart write notification is being held.')
    notification.release()
  })
}

async function releaseFirstChartWriteFailure(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    const gate = (window as ChartWriteGateWindow).__chartWriteGate
    if (!gate) throw new Error('The chart write gate is not installed.')
    const transaction = gate.pending[0]?.transaction
    if (!transaction) throw new Error('No chart write failure is being held.')
    const notifications = gate.pending.filter(item => item.transaction === transaction)
    gate.pending = gate.pending.filter(item => item.transaction !== transaction)
    for (const notification of notifications) notification.release()
  })
}

async function readCurrentWorkspace(page: import('@playwright/test').Page): Promise<{
  cluster: {
    name: string
    systems: Array<{
      id: string
      name: string
      objects: Array<{ id: string; name: string }>
      orbits: Array<{ id: string; order: number }>
    }>
    routes: Array<{ id: string; jumpLevel: number; fromPointId: string; toPointId: string | null }>
  }
}> {
  return page.evaluate(async () => {
    const request = indexedDB.open('ttrpg-cluster-control', 1)
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Could not open the workspace database.'))
    })
    try {
      return await new Promise((resolve, reject) => {
        const read = database.transaction('workspace', 'readonly').objectStore('workspace').get('current')
        read.onsuccess = () => resolve(read.result)
        read.onerror = () => reject(read.error ?? new Error('Could not read the current workspace.'))
      }) as {
        cluster: {
          name: string
          systems: Array<{
            id: string
            name: string
            objects: Array<{ id: string; name: string }>
            orbits: Array<{ id: string; order: number }>
          }>
          routes: Array<{ id: string; jumpLevel: number; fromPointId: string; toPointId: string | null }>
        }
      }
    } finally {
      database.close()
    }
  })
}

function incomingClusterJson(): string {
  const source = createLocalWorkspace('Incoming Reach', 'Incoming Vesper')
  const sourceSystem = source.cluster.systems[0]
  if (!sourceSystem) throw new Error('The import fixture needs its initial star system.')
  const firstPoint = createSystemObject(sourceSystem, 'jump-point')
  const systemWithFirstPoint = { ...sourceSystem, objects: [...sourceSystem.objects, firstPoint] }
  const secondPoint = createSystemObject(systemWithFirstPoint, 'jump-point')
  const incomingSystem = {
    ...systemWithFirstPoint,
    objects: [...systemWithFirstPoint.objects, secondPoint],
  }
  const clusterWithSystem = { ...source.cluster, systems: [incomingSystem] }
  const route = createJumpRoute(clusterWithSystem, 1, firstPoint.id, secondPoint.id)
  return JSON.stringify(exportJumpCluster({
    ...source,
    cluster: { ...clusterWithSystem, routes: [route] },
  }))
}

async function createWorkspace(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Give the unknown a name.' })).toBeVisible({ timeout: 30_000 })
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toHaveText('Saved on this device')
}

async function beginHiddenChartDraft(
  page: import('@playwright/test').Page,
  options: { clusterName?: string; systemName?: string; view?: 'cluster' | 'system' } = {},
): Promise<import('@playwright/test').Locator> {
  const hierarchyName = options.view === 'cluster' ? 'Jump Cluster contents' : 'System hierarchy'
  const hierarchy = await openWorkspaceHierarchy(page, hierarchyName)
  await hierarchy.getByRole('button', { name: 'Edit chart names' }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit chart names' })
  if (options.clusterName !== undefined) await dialog.getByLabel('Jump Cluster').fill(options.clusterName)
  if (options.systemName !== undefined) await dialog.getByLabel('Star system').fill(options.systemName)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  return dialog
}

async function acceptImportWithHeldAcknowledgement(
  page: import('@playwright/test').Page,
  fixture = incomingClusterJson(),
  hierarchyName: 'System hierarchy' | 'Jump Cluster contents' = 'System hierarchy',
): Promise<void> {
  await setHeaderMapActionsOpen(page, true)
  await page.getByRole('button', { name: 'Import JSON copy' }).click()
  await setHeaderMapActionsOpen(page, false)
  await setChartWriteGate(page, { holdCompletions: true })
  await setJsonFile(jsonMapImportInput(page), 'incoming-reach.json', fixture)
  const preview = importReviewDialog(page)
  const previewSummary = await preview.innerText()
  expect(previewSummary).toContain('Star systems: 1')
  expect(previewSummary).toContain('Jump Routes: 1')
  await resolveImportReview(preview, 'confirm')
  await setHeaderMapActionsOpen(page, false)
  await expect.poll(async () => (await readChartWriteGate(page)).pendingTransactions).toBe(1)
  await openWorkspaceHierarchy(page, hierarchyName)
  await expect(page.getByRole('navigation', { name: 'Star systems' })
    .getByRole('button', { name: /Incoming Vesper/ }).first()).toBeVisible()
}

async function resolveSelectionGuard(
  page: import('@playwright/test').Page,
  decision: 'apply' | 'discard',
): Promise<void> {
  const dialog = page.getByRole('dialog', { name: 'Edit chart names' })
  await expect(dialog.getByRole('button', { name: 'Apply and continue' })).toBeVisible()
  await dialog.getByRole('button', {
    name: decision === 'apply' ? 'Apply and continue' : 'Discard and continue',
  }).click()
}

async function finishHeldImportAndVerifyExport(
  page: import('@playwright/test').Page,
  expectedClusterName: string,
  expectedFirstSystemName: string,
): Promise<void> {
  await releaseChartWriteGate(page)
  await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toHaveText('Saved on this device')
  await expectImportedWorkspace(page, expectedClusterName, expectedFirstSystemName)

  await returnToClusterMap(page)
  const exported = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(exported.cluster?.name).toBe(expectedClusterName)
  expect(exported.cluster?.systems).toHaveLength(2)
  expect(exported.cluster?.systems.map(system => system.name)).toEqual([
    expectedFirstSystemName,
    'Incoming Vesper',
  ])
  const exportedIncoming = exported.cluster?.systems.find(system => system.name === 'Incoming Vesper')
  expect(exportedIncoming?.objects.filter(object => object.subtype === 'jump-point')).toHaveLength(2)
  expect(new Set(exportedIncoming?.objects.map(object => object.id)).size).toBe(3)
  expect(exported.cluster?.routes).toHaveLength(1)
  const exportedIncomingIds = new Set(exportedIncoming?.objects.map(object => object.id))
  expect(exportedIncomingIds.has(exported.cluster?.routes[0]?.fromPointId ?? '')).toBe(true)
  expect(exportedIncomingIds.has(exported.cluster?.routes[0]?.toPointId ?? '')).toBe(true)
}

async function expectImportedWorkspace(
  page: import('@playwright/test').Page,
  expectedClusterName: string,
  expectedFirstSystemName: string,
): Promise<void> {
  const current = await readCurrentWorkspace(page)
  expect(current.cluster.name).toBe(expectedClusterName)
  expect(current.cluster.systems.map(system => system.name)).toEqual([
    expectedFirstSystemName,
    'Incoming Vesper',
  ])
  expect(current.cluster.systems.filter(system => system.name === 'Incoming Vesper')).toHaveLength(1)
  expect(new Set(current.cluster.systems.map(system => system.id)).size).toBe(2)
  const importedSystem = current.cluster.systems.find(system => system.name === 'Incoming Vesper')
  expect(importedSystem?.objects).toHaveLength(3)
  expect(new Set(importedSystem?.objects.map(object => object.id)).size).toBe(3)
  expect(current.cluster.routes).toHaveLength(1)
  const importedObjectIds = new Set(importedSystem?.objects.map(object => object.id))
  expect(importedObjectIds.has(current.cluster.routes[0]?.fromPointId ?? '')).toBe(true)
  expect(importedObjectIds.has(current.cluster.routes[0]?.toPointId ?? '')).toBe(true)
}

test('hiding the chart-name dialog keeps the draft available to resume', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Give the unknown a name.' })).toBeVisible({ timeout: 30_000 })
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()

  await page.getByRole('button', { name: 'Chart details' }).click()
  await page.getByRole('complementary', { name: 'Object inspector' })
    .getByRole('button', { name: 'Edit chart names' })
    .click()
  const dialog = page.getByRole('dialog', { name: 'Edit chart names' })
  const editNames = page.getByRole('complementary', { name: 'Object inspector' })
    .getByRole('button', { name: 'Edit chart names' })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Jump Cluster').fill('Unapplied Reach')
  await page.keyboard.press('Escape')

  await expect(dialog).toBeHidden()
  await expect(page.getByRole('complementary', { name: 'Object inspector' })
    .getByRole('button', { name: 'Resume chart name draft' })).toBeFocused()
  const resume = activeWorkspaceFeedback(page).getByRole('button', { name: 'Resume chart name draft' })
  await expect(resume).toBeVisible()
  await resume.click()
  await expect(dialog.getByLabel('Jump Cluster')).toHaveValue('Unapplied Reach')
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
  await expect(resume).toBeFocused()
})

test('dismissing Chromium beforeunload keeps a modified hidden chart draft', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toHaveText('Saved on this device')

  const inspector = page.getByRole('complementary', { name: 'Object inspector' })
  await inspector.getByRole('button', { name: 'Edit chart names' }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit chart names' })
  await dialog.getByLabel('Jump Cluster').fill('Unapplied Reach')
  await page.keyboard.press('Escape')

  const prompt = page.waitForEvent('dialog', { timeout: 5_000 })
  await page.close({ runBeforeUnload: true })
  const beforeUnload = await prompt
  expect(beforeUnload.type()).toBe('beforeunload')
  await beforeUnload.dismiss()
  expect(page.isClosed()).toBe(false)
  await expect(activeWorkspaceFeedback(page).getByRole('button', { name: 'Resume chart name draft' }))
    .toBeVisible()
  await activeWorkspaceFeedback(page).getByRole('button', { name: 'Resume chart name draft' }).click()
  await expect(dialog.getByLabel('Jump Cluster')).toHaveValue('Unapplied Reach')
})

test('adding a system preserves a dirty chart-name draft while committing the system', async ({ page }) => {
  await captureExportedJson(page)
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()

  await returnToClusterMap(page)
  const hierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  await hierarchy.getByRole('button', { name: 'Edit chart names' }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit chart names' })
  await dialog.getByLabel('Jump Cluster').fill('Kestrel Reach Prime')
  await dialog.getByLabel('Star system').fill('Vesper Prime')
  await page.keyboard.press('Escape')

  await addClusterSystem(page)
  await expect(dialog).toBeHidden()
  await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toHaveText('Saved on this device')
  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await setWorkspaceMapMode(page, 'Navigate')
  await expect(clusterMap.getByRole('button', { name: 'Open New System 2 system map' })).toBeVisible()

  const persisted = await readCurrentWorkspace(page)
  expect(persisted.cluster.name).toBe('Kestrel Reach')
  expect(persisted.cluster.systems.map(system => system.name)).toEqual(['Vesper', 'New System 2'])

  const exported = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(exported.cluster?.name).toBe('Kestrel Reach')
  expect(exported.cluster?.systems.map(system => system.name)).toEqual(['Vesper', 'New System 2'])

  await activeWorkspaceFeedback(page).getByRole('button', { name: 'Resume chart name draft' }).click()
  await expect(dialog.getByLabel('Jump Cluster')).toHaveValue('Kestrel Reach Prime')
  await expect(dialog.getByLabel('Star system')).toHaveValue('Vesper Prime')
  await page.keyboard.press('Escape')
})

test('a hidden invalid chart draft survives an unrelated object placement and stays out of export', async ({ page }) => {
  await captureExportedJson(page)
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()

  await page.getByRole('button', { name: 'Chart details' }).click()
  const inspector = page.getByRole('complementary', { name: 'Object inspector' })
  await inspector.getByRole('button', { name: 'Edit chart names' }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit chart names' })
  await dialog.getByLabel('Jump Cluster').fill('')
  await dialog.getByLabel('Star system').fill('Unapplied Vesper')
  await dialog.getByRole('button', { name: 'Apply names' }).click()
  const validation = dialog.getByRole('alert')
  await expect(validation).toHaveText('Jump Cluster name is required.')
  await expect(dialog.getByLabel('Jump Cluster')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()

  await addCatalogueObject(page, 'jump-point', { preserveDraft: true, noSelection: true })
  await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toHaveText('Saved on this device')
  await activeWorkspaceFeedback(page).getByRole('button', { name: 'Resume chart name draft' }).click()
  await expect(dialog.getByLabel('Jump Cluster')).toHaveValue('')
  await expect(dialog.getByRole('alert')).toHaveText('Jump Cluster name is required.')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()

  await (await openWorkspaceHierarchy(page))
    .getByRole('button', { name: 'Cluster map' }).click()
  await expect(dialog.getByRole('button', { name: 'Apply and continue' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Apply and continue' }).click()
  await expect(dialog.getByRole('alert')).toHaveText('Jump Cluster name is required.')
  await expect(dialog.getByLabel('Jump Cluster')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('group', { name: 'Vesper star system map' })).toBeVisible()

  const exported = await downloadJson(page, 'Export star system JSON')
  expect(exported.type).toBe('system')
  expect(exported.system?.name).toBe('Vesper')
  expect(exported.system?.objects.some(object => object.name === 'Unapplied Vesper')).toBe(false)
})

test('restoring both committed names makes a stale validation error a clean transition', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()

  const inspector = page.getByRole('complementary', { name: 'Object inspector' })
  await inspector.getByRole('button', { name: 'Edit chart names' }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit chart names' })
  await dialog.getByLabel('Jump Cluster').fill('')
  await dialog.getByRole('button', { name: 'Apply names' }).click()
  await expect(dialog.getByRole('alert')).toHaveText('Jump Cluster name is required.')
  await expect(dialog.getByLabel('Jump Cluster')).toHaveAttribute('aria-invalid', 'true')
  await expect(dialog.getByLabel('Star system')).toHaveAttribute('aria-invalid', 'false')

  await dialog.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await dialog.getByLabel('Star system').fill('Vesper')
  await expect(dialog.getByRole('alert')).toHaveText('Jump Cluster name is required.')
  expect(await beforeUnloadIsPrevented(page)).toBe(false)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()

  await (await openWorkspaceHierarchy(page))
    .getByRole('button', { name: 'Cluster map' }).click()
  await expect(page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })).toBeVisible()
  await expect(dialog).toBeHidden()
  await expect(activeWorkspaceFeedback(page).getByRole('button', { name: 'Resume chart name draft' }))
    .toHaveCount(0)
})

test('a guarded transition can stay with the draft or discard it and continue', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()

  const inspector = page.getByRole('complementary', { name: 'Object inspector' })
  await inspector.getByRole('button', { name: 'Edit chart names' }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit chart names' })
  await dialog.getByLabel('Jump Cluster').fill('Draft Reach')
  await page.keyboard.press('Escape')

  const hierarchy = await openWorkspaceHierarchy(page)
  await hierarchy.getByRole('button', { name: 'Cluster map' }).click()
  await expect(dialog.getByText('Continue without this draft?')).toBeVisible()
  await dialog.getByRole('button', { name: 'Stay here' }).click()
  await expect(dialog.getByLabel('Jump Cluster')).toHaveValue('Draft Reach')
  await expect(dialog.getByRole('button', { name: 'Apply names' })).toBeVisible()

  await page.keyboard.press('Escape')
  await hierarchy.getByRole('button', { name: 'Cluster map' }).click()
  await expect(dialog.getByRole('button', { name: 'Discard and continue' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Discard and continue' }).click()
  await expect(page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })).toBeVisible()
  await expect(activeWorkspaceFeedback(page).getByRole('button', { name: 'Resume chart name draft' }))
    .toHaveCount(0)
})

test('export failures stay separate from chart draft and workspace save feedback', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toHaveText('Saved on this device')

  await page.getByRole('complementary', { name: 'Object inspector' })
    .getByRole('button', { name: 'Edit chart names' }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit chart names' })
  await dialog.getByLabel('Jump Cluster').fill('Unapplied Reach')
  await page.keyboard.press('Escape')

  await page.evaluate(() => {
    const trackedWindow = window as Window & { __ticket20OriginalCreateObjectUrl?: typeof URL.createObjectURL }
    trackedWindow.__ticket20OriginalCreateObjectUrl = URL.createObjectURL.bind(URL)
    URL.createObjectURL = () => { throw new Error('Synthetic export failure.') }
  })
  try {
    await setHeaderMapActionsOpen(page, true)
    await page.getByRole('button', { name: 'Export star system JSON' }).click()
    const feedback = activeWorkspaceFeedback(page)
    const detailsTrigger = feedback.getByRole('button', { name: 'Recovery details', exact: true })
    await detailsTrigger.click()
    const recoveryDetails = page.getByRole('group', { name: 'Workspace recovery details', exact: true })
    await expect(recoveryDetails.getByRole('alert'))
      .toContainText('Export failed: Synthetic export failure.')
    await page.keyboard.press('Escape')
    await expect(detailsTrigger).toBeFocused()
    await expect(feedback.locator('.save-feedback')).toHaveText('Saved on this device')
    await expect(feedback.getByRole('button', { name: 'Resume chart name draft' }))
      .toBeVisible()
    await feedback.getByRole('button', { name: 'Resume chart name draft' }).click()
    await expect(dialog.getByLabel('Jump Cluster')).toHaveValue('Unapplied Reach')
  } finally {
    await page.evaluate(() => {
      const trackedWindow = window as Window & { __ticket20OriginalCreateObjectUrl?: typeof URL.createObjectURL }
      if (trackedWindow.__ticket20OriginalCreateObjectUrl) {
        URL.createObjectURL = trackedWindow.__ticket20OriginalCreateObjectUrl
        delete trackedWindow.__ticket20OriginalCreateObjectUrl
      }
    })
  }
})

test('failed chart writes keep applied memory and Retry saves the latest workspace without replaying placement', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()
  await installChartWriteGate(page)

  try {
    await setChartWriteGate(page, { abortCurrentWrites: 1 })
    await page.getByRole('button', { name: 'Inspect', exact: true }).click()
    await page.getByRole('button', { name: 'Chart details' }).click()
    const inspector = page.getByRole('dialog', { name: 'Object inspector' })
    await inspector.getByRole('button', { name: 'Edit chart names' }).click()
    const dialog = page.getByRole('dialog', { name: 'Edit chart names' })
    await dialog.getByLabel('Jump Cluster').fill('Current Reach')
    await dialog.getByLabel('Star system').fill('Vesper Prime')
    expect(await beforeUnloadIsPrevented(page)).toBe(true)
    await dialog.getByRole('button', { name: 'Apply names' }).click()
    await expect(dialog).toBeHidden()
    await expect(inspector).toBeVisible()
    await expect(inspector.getByRole('heading', { name: 'Vesper Prime' })).toBeVisible()
    const compactRecovery = page.getByRole('region', { name: 'Workspace save and recovery' })
    await expect(compactRecovery.getByRole('alert')).toContainText('Not saved.')
    await expect(compactRecovery.getByRole('button', { name: 'Retry save' })).toBeVisible()
    await expect(compactRecovery.getByRole('button', { name: 'Export current Jump Cluster JSON' })).toBeVisible()
    expect(await beforeUnloadIsPrevented(page)).toBe(true)

    await setChartWriteGate(page, { holdCompletions: true })
    await compactRecovery.getByRole('button', { name: 'Retry save' }).click()
    await expect(compactRecovery.getByRole('status')).toContainText('Saving to this browser. A previous write failed:')
    await expect.poll(async () => (await readChartWriteGate(page)).pendingTransactions).toBeGreaterThan(0)
    await releasePendingChartWrites(page)
    await expect(compactRecovery.getByRole('status')).toHaveText('Saved on this device')
    expect(await beforeUnloadIsPrevented(page)).toBe(false)

    await page.getByRole('button', { name: 'Close inspector panel' }).click()
    await expect(page.getByRole('navigation', { name: 'Map context and commands' }).getByRole('heading', { name: 'Vesper Prime' })).toBeVisible()
    await page.setViewportSize({ width: 1440, height: 960 })

    await setChartWriteGate(page, { abortCurrentWrites: 1 })
    await addCatalogueObject(page, 'jump-point')
    await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toContainText('Not saved.')
    await expect.poll(async () => (await readChartWriteGate(page)).writeCount).toBeGreaterThanOrEqual(4)
    await expect.poll(async () => (await readCurrentWorkspace(page)).cluster.name).toBe('Current Reach')

    await setChartWriteGate(page, { holdCompletions: true })
    await activeWorkspaceFeedback(page).getByRole('button', { name: 'Retry save' }).click()
    await expect(activeWorkspaceFeedback(page).locator('.save-feedback'))
      .toContainText('Saving to this browser. A previous write failed:')
    await expect.poll(async () => (await readChartWriteGate(page)).pendingTransactions).toBeGreaterThan(0)
    expect((await readChartWriteGate(page)).writeCount).toBeGreaterThanOrEqual(6)
    await releaseChartWriteGate(page)
    await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toHaveText('Saved on this device')
    expect(await beforeUnloadIsPrevented(page)).toBe(false)

    const saved = await readCurrentWorkspace(page)
    expect(saved.cluster.name).toBe('Current Reach')
    expect(saved.cluster.systems.map(system => system.name)).toEqual(['Vesper Prime'])
    expect(saved.cluster.systems[0]?.objects.filter(object => object.name.startsWith('New jump point'))).toHaveLength(1)
    await page.reload()
    await openWorkspaceHierarchy(page)
    await expect(page.getByRole('complementary', { name: 'System hierarchy' })
      .getByRole('button', { name: /New jump point/ })).toBeVisible()
  } finally {
    await releaseChartWriteGate(page)
  }
})

test('an older successful write cannot mark a newer applied workspace saved or end its draft', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toHaveText('Saved on this device')
  await installChartWriteGate(page)

  try {
    await setChartWriteGate(page, { holdCompletions: true })
    const inspector = page.getByRole('complementary', { name: 'Object inspector' })
    await inspector.getByRole('button', { name: 'Edit chart names' }).click()
    let dialog = page.getByRole('dialog', { name: 'Edit chart names' })
    await dialog.getByLabel('Jump Cluster').fill('Older Applied Reach')
    await dialog.getByRole('button', { name: 'Apply names' }).click()
    await expect(dialog).toBeHidden()
    await expect.poll(async () => (await readChartWriteGate(page)).pendingTransactions).toBe(1)

    await inspector.getByRole('button', { name: 'Edit chart names' }).click()
    dialog = page.getByRole('dialog', { name: 'Edit chart names' })
    await dialog.getByLabel('Jump Cluster').fill('Latest Applied Reach')
    await dialog.getByRole('button', { name: 'Apply names' }).click()
    await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toHaveText('Saving to this browser...')

    await inspector.getByRole('button', { name: 'Edit chart names' }).click()
    dialog = page.getByRole('dialog', { name: 'Edit chart names' })
    await dialog.getByLabel('Jump Cluster').fill('Newer Unapplied Draft')
    await page.keyboard.press('Escape')
    await expect(activeWorkspaceFeedback(page).getByRole('button', { name: 'Resume chart name draft' }))
      .toBeVisible()

    await releaseFirstChartWriteNotification(page)
    await expect.poll(async () => (await readChartWriteGate(page)).pendingTransactions).toBe(1)
    await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toHaveText('Saving to this browser...')
    await activeWorkspaceFeedback(page).getByRole('button', { name: 'Resume chart name draft' }).click()
    await expect(dialog.getByLabel('Jump Cluster')).toHaveValue('Newer Unapplied Draft')
    await page.keyboard.press('Escape')

    await releaseChartWriteGate(page)
    await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toHaveText('Saved on this device')
    expect((await readCurrentWorkspace(page)).cluster.name).toBe('Latest Applied Reach')
    await page.reload()
    await returnToClusterMap(page)
    await expect(page.getByRole('group', { name: 'Latest Applied Reach Jump Cluster map' })).toBeVisible()
  } finally {
    await releaseChartWriteGate(page)
  }
})

test('an older failed write cannot replace newer saving feedback or clear a draft', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toHaveText('Saved on this device')
  await installChartWriteGate(page)

  try {
    await setChartWriteGate(page, { abortCurrentWrites: 1, holdFailures: true, holdCompletions: true })
    const inspector = page.getByRole('complementary', { name: 'Object inspector' })
    await inspector.getByRole('button', { name: 'Edit chart names' }).click()
    let dialog = page.getByRole('dialog', { name: 'Edit chart names' })
    await dialog.getByLabel('Jump Cluster').fill('Older Failed Reach')
    await dialog.getByRole('button', { name: 'Apply names' }).click()
    await expect(dialog).toBeHidden()
    await expect.poll(async () => (await readChartWriteGate(page)).pendingTransactions).toBe(1)

    await inspector.getByRole('button', { name: 'Edit chart names' }).click()
    dialog = page.getByRole('dialog', { name: 'Edit chart names' })
    await dialog.getByLabel('Jump Cluster').fill('Latest Applied Reach')
    await dialog.getByRole('button', { name: 'Apply names' }).click()
    await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toHaveText('Saving to this browser...')

    await inspector.getByRole('button', { name: 'Edit chart names' }).click()
    dialog = page.getByRole('dialog', { name: 'Edit chart names' })
    await dialog.getByLabel('Jump Cluster').fill('Newer Unapplied Draft')
    await page.keyboard.press('Escape')
    await releaseFirstChartWriteFailure(page)

    await expect.poll(async () => (await readChartWriteGate(page)).pendingTransactions).toBe(1)
    await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toHaveText('Saving to this browser...')
    await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).not.toContainText('Not saved.')
    await activeWorkspaceFeedback(page).getByRole('button', { name: 'Resume chart name draft' }).click()
    await expect(dialog.getByLabel('Jump Cluster')).toHaveValue('Newer Unapplied Draft')
    await page.keyboard.press('Escape')

    await releaseChartWriteGate(page)
    await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toHaveText('Saved on this device')
    expect((await readCurrentWorkspace(page)).cluster.name).toBe('Latest Applied Reach')
  } finally {
    await releaseChartWriteGate(page)
  }
})

test('canceling the initial system-delete review leaves a hidden chart draft and error untouched', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()
  await returnToClusterMap(page)
  await addClusterSystem(page)
  await returnToClusterMap(page)
  const hierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  const deleteSystemButton = hierarchy.getByRole('button', { name: 'Delete New System 2 system' })
  await expect(deleteSystemButton).toBeVisible()
  await expect(deleteSystemButton).toBeEnabled()
  await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toHaveText('Saved on this device')

  await hierarchy.getByRole('button', { name: 'Edit chart names' }).click()
  const chartDialog = page.getByRole('dialog', { name: 'Edit chart names' })
  await chartDialog.getByLabel('Jump Cluster').fill('Draft Reach')
  await chartDialog.getByLabel('Star system').fill('')
  await chartDialog.getByRole('button', { name: 'Apply names' }).click()
  await expect(chartDialog.getByRole('alert')).toHaveText('Star system name is required.')
  await page.keyboard.press('Escape')
  await expect(chartDialog).toBeHidden()

  await page.evaluate(() => {
    const trackedWindow = window as Window & {
      __deleteWriteCount?: number
      __deleteOriginalPut?: typeof IDBObjectStore.prototype.put
    }
    const prototype = IDBObjectStore.prototype
    const originalPut = prototype.put
    trackedWindow.__deleteWriteCount = 0
    trackedWindow.__deleteOriginalPut = originalPut
    prototype.put = function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
      if (this.transaction.db.name === 'ttrpg-cluster-control' && this.name === 'workspace') {
        trackedWindow.__deleteWriteCount = (trackedWindow.__deleteWriteCount ?? 0) + 1
      }
      return originalPut.call(this, value, key)
    }
  })

  try {
    await deleteSystemButton.click()
    const deletionReview = deletionReviewDialog(page)
    const deletionSummary = await deletionReview.innerText()
    expect(deletionSummary).toContain('New System 2')
    await resolveDeletionReview(deletionReview, 'cancel')
    await expect(chartDialog).toBeHidden()

    await activeWorkspaceFeedback(page).getByRole('button', { name: 'Resume chart name draft' }).click()
    await expect(chartDialog.getByLabel('Jump Cluster')).toHaveValue('Draft Reach')
    await expect(chartDialog.getByLabel('Star system')).toHaveValue('')
    await expect(chartDialog.getByRole('alert')).toHaveText('Star system name is required.')
    await expect(chartDialog.getByLabel('Star system')).toBeFocused()
    expect(await page.evaluate(() =>
      (window as Window & { __deleteWriteCount?: number }).__deleteWriteCount ?? -1,
    )).toBe(0)
  } finally {
    await page.evaluate(() => {
      const trackedWindow = window as Window & {
        __deleteWriteCount?: number
        __deleteOriginalPut?: typeof IDBObjectStore.prototype.put
      }
      if (!trackedWindow.__deleteOriginalPut) return
      IDBObjectStore.prototype.put = trackedWindow.__deleteOriginalPut
      delete trackedWindow.__deleteOriginalPut
      delete trackedWindow.__deleteWriteCount
    })
  }
})

test('system deletion resolves its chart target after review and asks again for the refreshed plan', async ({ page }) => {
  await captureExportedJson(page)
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()
  await returnToClusterMap(page)
  await addClusterSystem(page, { open: true })
  await returnToClusterMap(page)
  await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toHaveText('Saved on this device')

  const hierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  const deleteSystemButton = hierarchy.getByRole('button', { name: 'Delete New System 2 system' })
  await expect(deleteSystemButton).toBeEnabled()
  await hierarchy.getByRole('button', { name: 'Edit chart names' }).click()
  const chartDialog = page.getByRole('dialog', { name: 'Edit chart names' })
  await chartDialog.getByLabel('Jump Cluster').fill('Kestrel Reach Prime')
  await chartDialog.getByLabel('Star system').fill('Current System 2')
  await page.keyboard.press('Escape')

  await deleteSystemButton.click()
  const initialReview = deletionReviewDialog(page)
  const initialSummary = await initialReview.innerText()
  expect(initialSummary).toContain('New System 2')
  await resolveDeletionReview(initialReview, 'confirm')
  await expect(chartDialog.getByRole('button', { name: 'Apply and continue' })).toBeVisible()
  await chartDialog.getByRole('button', { name: 'Apply and continue' }).click()
  const refreshedReview = deletionReviewDialog(page)
  await expect(refreshedReview).toContainText('Current System 2')
  const refreshedSummary = await refreshedReview.innerText()
  expect(refreshedSummary).toContain('Current System 2')
  await resolveDeletionReview(refreshedReview, 'confirm')

  await expect(hierarchy.getByRole('button', { name: 'Delete Current System 2 system' })).toHaveCount(0)
  await setWorkspaceMapMode(page, 'Navigate')
  await expect(page.getByRole('group', { name: 'Kestrel Reach Prime Jump Cluster map' })
    .getByRole('button', { name: 'Open Current System 2 system map' })).toHaveCount(0)
  await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toHaveText('Saved on this device')

  const exported = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(exported.cluster?.name).toBe('Kestrel Reach Prime')
  expect(exported.cluster?.systems.map(system => system.name)).toEqual(['Vesper'])
  await page.reload()
  await returnToClusterMap(page)
  await expect(page.getByRole('group', { name: 'Kestrel Reach Prime Jump Cluster map' })).toBeVisible()
})

test('chart-name dialog buttons show the semantic keyboard focus outline', async ({ page }) => {
  await createWorkspace(page)
  await (await openWorkspaceHierarchy(page))
    .getByRole('button', { name: 'Edit chart names' }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit chart names' })
  await expect(dialog.getByLabel('Jump Cluster')).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(dialog.getByLabel('Star system')).toBeFocused()
  await page.keyboard.press('Tab')

  const focusedButton = await page.evaluate(() => {
    const element = document.activeElement
    if (!(element instanceof HTMLButtonElement)) return null
    const style = getComputedStyle(element)
    const context = document.createElement('canvas').getContext('2d')
    if (!context) throw new Error('Could not inspect the keyboard outline color.')
    const rgba = (color: string): [number, number, number, number] => {
      context.clearRect(0, 0, 1, 1)
      context.fillStyle = color
      context.fillRect(0, 0, 1, 1)
      const data = context.getImageData(0, 0, 1, 1).data
      return [data[0] ?? 0, data[1] ?? 0, data[2] ?? 0, (data[3] ?? 0) / 255]
    }
    const linear = (channel: number): number => {
      const normalized = channel / 255
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
    }
    let panel: HTMLElement | null = element.parentElement
    let panelColor: [number, number, number, number] | null = null
    while (panel && !panelColor) {
      const candidate = rgba(getComputedStyle(panel).backgroundColor)
      if (candidate[3] >= 0.99) panelColor = candidate
      else panel = panel.parentElement
    }
    const outline = rgba(style.outlineColor)
    if (!panelColor) throw new Error('Could not find the modal background behind the focused button.')
    const outlineLuminance = 0.2126 * linear(outline[0])
      + 0.7152 * linear(outline[1])
      + 0.0722 * linear(outline[2])
    const panelLuminance = 0.2126 * linear(panelColor[0])
      + 0.7152 * linear(panelColor[1])
      + 0.0722 * linear(panelColor[2])
    const contrastRatio = (Math.max(outlineLuminance, panelLuminance) + 0.05)
      / (Math.min(outlineLuminance, panelLuminance) + 0.05)
    return {
      insideDialog: !!element.closest('[role="dialog"]'),
      outlineWidth: Number.parseFloat(style.outlineWidth),
      outlineAlpha: outline[3],
      contrastRatio,
      elementOpacity: Number.parseFloat(style.opacity),
    }
  })
  expect(focusedButton).not.toBeNull()
  expect(focusedButton?.insideDialog).toBe(true)
  expect(focusedButton?.outlineWidth).toBeGreaterThan(0)
  expect(focusedButton?.outlineAlpha).toBe(1)
  expect(focusedButton?.contrastRatio).toBeGreaterThanOrEqual(3)
  expect(focusedButton?.elementOpacity).toBe(1)
})

for (const selectionKind of ['object', 'orbit', 'route'] as const) {
  test(`a delayed import acknowledgement does not take ownership of a pending ${selectionKind} guard`, async ({ page }) => {
    await captureExportedJson(page)
    await createWorkspace(page)

    const hierarchy = await openWorkspaceHierarchy(page)
    if (selectionKind === 'object') {
      await addCatalogueObject(page, 'planet')
      await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toHaveText('Saved on this device')
    } else if (selectionKind === 'orbit') {
      await addCatalogueObject(page, 'planet')
      await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toHaveText('Saved on this device')
      await clickDockAction(page, 'Add orbit', { target: { kind: 'host', name: 'New planet 1' } })
      await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toHaveText('Saved on this device')
      await hierarchy.getByRole('button', { name: /Select PL-01, New planet 1/ }).click()
      await expect(page.getByRole('button', { name: 'Add to map', exact: true })).toHaveAttribute('aria-expanded', 'false')
      await expect(page.getByRole('region', { name: 'Object palette' })).toBeHidden()
      await clickDockAction(page, 'Add orbit', { target: { kind: 'host', name: 'New planet 1' } })
      await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toHaveText('Saved on this device')
    } else {
      await returnToClusterMap(page)
    }

    await installChartWriteGate(page)
    try {
      await acceptImportWithHeldAcknowledgement(
        page,
        incomingClusterJson(),
        selectionKind === 'route' ? 'Jump Cluster contents' : 'System hierarchy',
      )
      const entryView = selectionKind === 'route' ? 'cluster' : 'system'
      const dialog = await beginHiddenChartDraft(page, {
        clusterName: 'Kestrel Reach Prime',
        systemName: 'Vesper Prime',
        view: entryView,
      })

      let target: import('@playwright/test').Locator
      if (selectionKind === 'object') {
        target = hierarchy.getByRole('button', { name: 'Select A, Primary Star', exact: true })
      } else if (selectionKind === 'orbit') {
        target = hierarchy.getByRole('button', { name: /Orbit 1 around New planet 1/ })
      } else {
        target = page.getByRole('navigation', { name: 'Jump Routes' })
          .getByRole('button', { name: /Select Jump Level 1:/ })
      }

      await target.click()
      await expect(dialog.getByRole('button', { name: 'Apply and continue' })).toBeVisible()
      await releaseFirstChartWriteNotification(page)
      await expect(dialog.getByRole('button', { name: 'Apply and continue' })).toBeVisible()
      await expect(dialog.getByText('Continue without this draft?')).toBeVisible()

      await resolveSelectionGuard(page, 'apply')
      await expect(dialog).toBeHidden()
      await expect(target).toHaveAttribute('aria-current', 'true')
      await expect(page.getByRole('navigation', { name: 'Map context and commands' }).getByRole('heading', {
        name: entryView === 'cluster' ? 'Kestrel Reach Prime' : 'Vesper Prime',
      })).toBeVisible()
      await finishHeldImportAndVerifyExport(page, 'Kestrel Reach Prime', 'Vesper Prime')
      await page.reload()
      await returnToClusterMap(page)
      await expect(page.getByRole('navigation', { name: 'Map context and commands' })
        .getByRole('heading', { name: 'Kestrel Reach Prime', level: 2 })).toBeVisible()
      await expectImportedWorkspace(page, 'Kestrel Reach Prime', 'Vesper Prime')
    } finally {
      await releaseChartWriteGate(page)
    }
  })
}

test('a delayed import save stays on Vesper until explicit navigation meets an invalid draft', async ({ page }) => {
  await createWorkspace(page)
  await installChartWriteGate(page)
  try {
    await acceptImportWithHeldAcknowledgement(page)
    const hierarchy = await openWorkspaceHierarchy(page)
    await hierarchy.getByRole('button', { name: 'Edit chart names' }).click()
    const dialog = page.getByRole('dialog', { name: 'Edit chart names' })
    await dialog.getByLabel('Jump Cluster').fill('')
    await dialog.getByLabel('Star system').fill('Unapplied Vesper')
    await dialog.getByRole('button', { name: 'Apply names' }).click()
    await expect(dialog.getByRole('alert')).toHaveText('Jump Cluster name is required.')
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()

    await releaseFirstChartWriteNotification(page)
    await expect(dialog.getByRole('button', { name: 'Stay here' })).toHaveCount(0)
    const context = page.getByRole('navigation', { name: 'Map context and commands' })
    await expect(context.getByRole('heading', { name: 'Vesper', exact: true })).toBeVisible()
    await context.getByRole('button', { name: 'Back to Jump Cluster', exact: true }).click()
    await expect(dialog.getByRole('button', { name: 'Stay here' })).toBeVisible()
    await dialog.getByRole('button', { name: 'Stay here' }).click()
    await expect(dialog.getByLabel('Jump Cluster')).toHaveValue('')
    await expect(dialog.getByLabel('Star system')).toHaveValue('Unapplied Vesper')
    await expect(dialog.getByRole('alert')).toHaveText('Jump Cluster name is required.')
    await expect(dialog.getByLabel('Jump Cluster')).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('navigation', { name: 'Map context and commands' }).getByRole('heading', { name: 'Vesper' })).toBeVisible()
    await expect(activeWorkspaceFeedback(page).getByRole('button', { name: 'Resume chart name draft' }))
      .toBeVisible()

    await releaseChartWriteGate(page)
    await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toHaveText('Saved on this device')
    await expectImportedWorkspace(page, 'Kestrel Reach', 'Vesper')
  } finally {
    await releaseChartWriteGate(page)
  }
})

for (const decision of ['apply', 'discard'] as const) {
  test(`a delayed import save honors ${decision} after explicit Back navigation`, async ({ page }) => {
    await createWorkspace(page)
    await installChartWriteGate(page)
    try {
      await acceptImportWithHeldAcknowledgement(page)
      await beginHiddenChartDraft(page, {
        clusterName: 'Kestrel Reach Prime',
        systemName: 'Vesper Prime',
      })
      await releaseFirstChartWriteNotification(page)

      const dialog = page.getByRole('dialog', { name: 'Edit chart names' })
      const expectedClusterName = decision === 'apply' ? 'Kestrel Reach Prime' : 'Kestrel Reach'
      const expectedSystemName = decision === 'apply' ? 'Vesper Prime' : 'Vesper'
      await expect(dialog.getByRole('button', { name: 'Apply and continue' })).toHaveCount(0)
      const context = page.getByRole('navigation', { name: 'Map context and commands' })
      await expect(context.getByRole('heading', { name: 'Vesper', exact: true })).toBeVisible()
      await context.getByRole('button', { name: 'Back to Jump Cluster', exact: true }).click()
      await expect(dialog.getByRole('button', { name: 'Apply and continue' })).toBeVisible()
      await resolveSelectionGuard(page, decision)
      await expect(dialog).toBeHidden()
      const importedClusterMap = page.getByRole('group', { name: `${expectedClusterName} Jump Cluster map` })
      await expect(importedClusterMap).toBeVisible()
      await setWorkspaceMapMode(page, 'Navigate')
      await expect(importedClusterMap.getByRole('button', { name: 'Open Incoming Vesper system map' })).toBeVisible()
      await expect(page.getByRole('navigation', { name: 'Map context and commands' })
        .getByRole('heading', { name: expectedClusterName })).toBeVisible()

      await releaseChartWriteGate(page)
      await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toHaveText('Saved on this device')
      await expectImportedWorkspace(page, expectedClusterName, expectedSystemName)
      await page.reload()
      await returnToClusterMap(page)
      await expect(page.getByRole('navigation', { name: 'Map context and commands' })
        .getByRole('heading', { name: expectedClusterName, level: 2 })).toBeVisible()
      await expectImportedWorkspace(page, expectedClusterName, expectedSystemName)
    } finally {
      await releaseChartWriteGate(page)
    }
  })
}
