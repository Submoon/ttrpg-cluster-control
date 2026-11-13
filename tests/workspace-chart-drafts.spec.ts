import { expect, test } from './fixtures'
import { waitForWorkspaceSaved, activeWorkspaceFeedback, hideWorkspaceInspector, openWorkspaceHierarchy, openChartDetailsEditor } from './helpers'


import {
  addCatalogueObject,
  captureMapExportBlobs,
  downloadJson,
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

      // eslint-disable-next-line @typescript-eslint/no-this-alias -- Deferred IDB listeners must retain the transaction receiver.
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
          // eslint-disable-next-line @typescript-eslint/no-this-alias -- Deferred IDB listeners must retain the request receiver.
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
    const request = indexedDB.open('ttrpg-cluster-control')
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

















test('dismissing Chromium beforeunload keeps a modified hidden chart draft', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await waitForWorkspaceSaved(page)

  const editor = await openChartDetailsEditor(page)
  await editor.getByLabel('Jump Cluster').fill('Unapplied Reach')
  await hideWorkspaceInspector(page)

  const prompt = page.waitForEvent('dialog', { timeout: 5_000 })
  await page.close({ runBeforeUnload: true })
  const beforeUnload = await prompt
  expect(beforeUnload.type()).toBe('beforeunload')
  await beforeUnload.dismiss()
  expect(page.isClosed()).toBe(false)
  await expect(activeWorkspaceFeedback(page).getByRole('button', { name: 'Resume Jump Cluster details draft' }))
    .toBeVisible()
  await activeWorkspaceFeedback(page).getByRole('button', { name: 'Resume Jump Cluster details draft' }).click()
  await expect(editor.getByLabel('Jump Cluster')).toHaveValue('Unapplied Reach')
})



test('a hidden invalid chart draft survives an unrelated object placement and stays out of export', async ({ page }) => {
  await captureMapExportBlobs(page)
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await waitForWorkspaceSaved(page)

  const editor = await openChartDetailsEditor(page)
  await editor.getByLabel('Jump Cluster').fill('')
  await editor.getByLabel('Star system').fill('Unapplied Vesper')
  await editor.getByRole('button', { name: 'Apply details' }).click()
  const validation = editor.getByRole('alert')
  await expect(validation).toHaveText('Jump Cluster name is required.')
  await expect(editor.getByLabel('Jump Cluster')).toBeFocused()
  await hideWorkspaceInspector(page)
  await expect(editor).toBeHidden()

  await addCatalogueObject(page, 'jump-point', { preserveDraft: true, noSelection: true })
  await waitForWorkspaceSaved(page)
  await activeWorkspaceFeedback(page).getByRole('button', { name: 'Resume Jump Cluster details draft' }).click()
  await expect(editor.getByLabel('Jump Cluster')).toHaveValue('')
  await expect(editor.getByRole('alert')).toHaveText('Jump Cluster name is required.')
  await hideWorkspaceInspector(page)
  await expect(editor).toBeHidden()

  await (await openWorkspaceHierarchy(page))
    .getByRole('button', { name: 'Cluster map' }).click()
  const guard = page.getByRole('dialog', { name: 'Edit Jump Cluster details', exact: true })
  await expect(guard.getByRole('button', { name: 'Apply and continue' })).toBeVisible()
  await guard.getByRole('button', { name: 'Apply and continue' }).click()
  await expect(guard).toBeHidden()
  await expect(editor.getByRole('alert')).toHaveText('Jump Cluster name is required.')
  await expect(editor.getByLabel('Jump Cluster')).toBeFocused()
  await hideWorkspaceInspector(page)
  await expect(editor).toBeHidden()
  await expect(page.getByRole('group', { name: 'Vesper star system map' })).toBeVisible()

  const exported = await downloadJson(page, 'Export star system JSON')
  expect(exported.type).toBe('system')
  expect(exported.system?.name).toBe('Vesper')
  expect(exported.system?.objects.some(object => object.name === 'Unapplied Vesper')).toBe(false)
})






test('failed chart writes keep applied memory and Retry saves the latest workspace without replaying placement', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await waitForWorkspaceSaved(page)
  await installChartWriteGate(page)

  try {
    await setChartWriteGate(page, { abortCurrentWrites: 1 })
    const editor = await openChartDetailsEditor(page)
    await editor.getByLabel('Jump Cluster').fill('Current Reach')
    await editor.getByLabel('Star system').fill('Vesper Prime')
    expect(await beforeUnloadIsPrevented(page)).toBe(true)
    await editor.getByRole('button', { name: 'Apply details' }).click()
    await expect(editor).toBeHidden()
    const inspector = page.getByRole('dialog', { name: 'Object inspector', exact: true })
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
    await waitForWorkspaceSaved(page)
    expect(await beforeUnloadIsPrevented(page)).toBe(false)

    await page.getByRole('button', { name: 'Close inspector panel' }).click()
    await expect(page.getByRole('navigation', { name: 'Map context and commands' }).getByRole('heading', { name: 'Vesper Prime' })).toBeVisible()
    await page.setViewportSize({ width: 1440, height: 960 })
    const desktopHierarchy = page.getByRole('complementary', { name: 'System hierarchy', exact: true })
    await expect(desktopHierarchy).toBeVisible()
    await desktopHierarchy.getByRole('button', { name: 'Close hierarchy panel', exact: true }).click()
    await expect(desktopHierarchy).toBeHidden()

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
    await waitForWorkspaceSaved(page)
    expect(await beforeUnloadIsPrevented(page)).toBe(false)

    const saved = await readCurrentWorkspace(page)
    expect(saved.cluster.name).toBe('Current Reach')
    expect(saved.cluster.systems.map(system => system.name)).toEqual(['Vesper Prime'])
    expect(saved.cluster.systems[0]?.objects.filter(object => object.name.startsWith('New jump point'))).toHaveLength(1)
    await page.reload()
    await openWorkspaceHierarchy(page)
    await expect(page.getByRole('complementary', { name: 'System hierarchy' })
      .getByRole('treeitem', { name: /New jump point/ })).toBeVisible()
  } finally {
    await releaseChartWriteGate(page)
  }
})

test('an older failed write cannot replace newer saving feedback or clear a draft', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await waitForWorkspaceSaved(page)
  await installChartWriteGate(page)

  try {
    await setChartWriteGate(page, { abortCurrentWrites: 1, holdFailures: true, holdCompletions: true })
    let editor = await openChartDetailsEditor(page)
    await editor.getByLabel('Jump Cluster').fill('Older Failed Reach')
    await editor.getByRole('button', { name: 'Apply details' }).click()
    await expect(editor).toBeHidden()
    await expect.poll(async () => (await readChartWriteGate(page)).pendingTransactions).toBe(1)

    editor = await openChartDetailsEditor(page)
    await editor.getByLabel('Jump Cluster').fill('Latest Applied Reach')
    await editor.getByRole('button', { name: 'Apply details' }).click()
    await expect(page.locator('.workspace-feedback-content').first()).toHaveAttribute('data-save-state', 'saving')

    editor = await openChartDetailsEditor(page)
    await editor.getByLabel('Jump Cluster').fill('Newer Unapplied Draft')
    await hideWorkspaceInspector(page)
    await releaseFirstChartWriteFailure(page)

    await expect.poll(async () => (await readChartWriteGate(page)).pendingTransactions).toBe(1)
    await expect(page.locator('.workspace-feedback-content').first()).toHaveAttribute('data-save-state', 'saving')
    await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toHaveCount(0)
    await activeWorkspaceFeedback(page).getByRole('button', { name: 'Resume Jump Cluster details draft' }).click()
    await expect(editor.getByLabel('Jump Cluster')).toHaveValue('Newer Unapplied Draft')
    await hideWorkspaceInspector(page)

    await releaseChartWriteGate(page)
    await waitForWorkspaceSaved(page)
    expect((await readCurrentWorkspace(page)).cluster.name).toBe('Latest Applied Reach')
  } finally {
    await releaseChartWriteGate(page)
  }
})
