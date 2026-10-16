import { expect, test } from '@playwright/test'
import { activeWorkspaceFeedback } from './helpers'
import { returnToClusterMap, clickDockAction } from './helpers'
import { addCatalogueObject } from './helpers'

type ThemeWriteGate = {
  originalAddEventListener: typeof IDBTransaction.prototype.addEventListener
  originalPut: typeof IDBObjectStore.prototype.put
  pending: Array<() => void>
  released: boolean
  writeCount: number
}

type ThemeWriteGateWindow = Window & { __workspaceThemeWriteGate?: ThemeWriteGate }

async function readWorkspaceRecords(page: import('@playwright/test').Page): Promise<{
  current: unknown
  lastValid: unknown
}> {
  return page.evaluate(async () => {
    const request = indexedDB.open('ttrpg-cluster-control', 1)
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Could not open the workspace database.'))
    })

    try {
      const transaction = database.transaction('workspace', 'readonly')
      const store = transaction.objectStore('workspace')
      const read = (key: string) => new Promise<unknown>((resolve, reject) => {
        const record = store.get(key)
        record.onsuccess = () => resolve(record.result)
        record.onerror = () => reject(record.error ?? new Error(`Could not read ${key}.`))
      })
      const [current, lastValid] = await Promise.all([read('current'), read('last-valid')])
      return { current, lastValid }
    } finally {
      database.close()
    }
  })
}

async function installWorkspaceWriteGate(
  page: import('@playwright/test').Page,
  abortOnCurrentWrite = false,
): Promise<void> {
  await page.evaluate((shouldAbort) => {
    const trackedWindow = window as ThemeWriteGateWindow
    const transactionPrototype = IDBTransaction.prototype
    const storePrototype = IDBObjectStore.prototype
    const originalAddEventListener = transactionPrototype.addEventListener
    const originalPut = storePrototype.put
    const gate: ThemeWriteGate = {
      originalAddEventListener,
      originalPut,
      pending: [],
      released: false,
      writeCount: 0,
    }
    trackedWindow.__workspaceThemeWriteGate = gate

    Object.defineProperty(transactionPrototype, 'addEventListener', {
      configurable: true,
      writable: true,
      value: function (
        this: IDBTransaction,
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions,
      ): void {
        const isWorkspaceWrite = this.db.name === 'ttrpg-cluster-control'
          && this.mode === 'readwrite'
          && this.objectStoreNames.contains('workspace')
        if (!isWorkspaceWrite || !['complete', 'abort', 'error'].includes(type)) {
          return originalAddEventListener.call(this, type, listener, options)
        }

        const transaction = this
        const deferredListener: EventListener = (event) => {
          const deliver = () => {
            if (typeof listener === 'function') listener.call(transaction, event)
            else listener.handleEvent(event)
          }
          if (gate.released) deliver()
          else gate.pending.push(deliver)
        }
        return originalAddEventListener.call(this, type, deferredListener, options)
      },
    })
    Object.defineProperty(storePrototype, 'put', {
      configurable: true,
      writable: true,
      value: function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
        const request = originalPut.call(this, value, key)
        if (this.transaction.db.name === 'ttrpg-cluster-control' && this.name === 'workspace') {
          gate.writeCount += 1
          if (shouldAbort && key === 'current' && this.transaction.mode === 'readwrite') {
            this.transaction.abort()
          }
        }
        return request
      },
    })
  }, abortOnCurrentWrite)
}

async function readWorkspaceWriteGate(page: import('@playwright/test').Page): Promise<{
  pendingCount: number
  writeCount: number
}> {
  return page.evaluate(() => {
    const gate = (window as ThemeWriteGateWindow).__workspaceThemeWriteGate
    if (!gate) throw new Error('The workspace write gate is not installed.')
    return { pendingCount: gate.pending.length, writeCount: gate.writeCount }
  })
}

async function releaseWorkspaceWriteGate(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    const gate = (window as ThemeWriteGateWindow).__workspaceThemeWriteGate
    if (!gate) return
    gate.released = true
    for (const release of gate.pending.splice(0)) release()
  })
}

async function restoreWorkspaceWriteGate(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    const trackedWindow = window as ThemeWriteGateWindow
    const gate = trackedWindow.__workspaceThemeWriteGate
    if (!gate) return
    gate.released = true
    for (const release of gate.pending.splice(0)) release()
    IDBTransaction.prototype.addEventListener = gate.originalAddEventListener
    IDBObjectStore.prototype.put = gate.originalPut
    delete trackedWindow.__workspaceThemeWriteGate
  })
}

async function switchTheme(
  page: import('@playwright/test').Page,
  currentTheme: 'light' | 'dark',
): Promise<void> {
  const targetTheme = currentTheme === 'light' ? 'dark' : 'light'
  await page.getByRole('group', { name: 'Theme' })
    .getByRole('button', { name: new RegExp(`switch to ${targetTheme} mode`, 'i') })
    .click()
  await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${targetTheme}\\b`))
}

async function controlBorderContrastRatio(
  control: import('@playwright/test').Locator,
): Promise<number> {
  return control.evaluate((element) => {
    const style = getComputedStyle(element)
    const parse = (color: string) => {
      const channels = color.match(/[\d.]+/g)?.slice(0, 3).map(Number)
      if (!channels || channels.length !== 3) throw new Error(`Unsupported computed color: ${color}`)
      return channels.map((channel) => {
        const value = channel / 255
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
      })
    }
    const luminance = (channels: number[]) =>
      0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!
    const border = luminance(parse(style.borderTopColor))
    const background = luminance(parse(style.backgroundColor))
    return (Math.max(border, background) + 0.05) / (Math.min(border, background) + 0.05)
  })
}

test('the shell follows the OS until an explicit theme choice persists across reloads', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Give the unknown a name.' })).toBeVisible({ timeout: 30_000 })

  const themeControl = page.getByRole('group', { name: 'Theme' })
  await expect(themeControl).toBeVisible()
  await expect(themeControl.getByText('Light', { exact: true })).toBeVisible()
  await expect(page.locator('html')).toHaveClass(/\blight\b/)
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).colorScheme))
    .toBe('light')

  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('html')).toHaveClass(/\bdark\b/)
  await expect(themeControl.getByText('Dark', { exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).colorScheme))
    .toBe('dark')

  await themeControl.getByRole('button', { name: /switch to light mode/i }).click()
  await expect(page.locator('html')).toHaveClass(/\blight\b/)
  await expect(themeControl.getByText('Light', { exact: true })).toBeVisible()

  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('html')).toHaveClass(/\blight\b/)

  await page.reload()
  await expect(page.locator('html')).toHaveClass(/\blight\b/)
  await expect(themeControl.getByRole('button', { name: /switch to dark mode/i })).toBeVisible()
})

test('theme changes recolor both maps without changing workspace drafts or writing IndexedDB', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')

  const themeControl = page.getByRole('group', { name: 'Theme' })
  await expect(themeControl).toBeVisible()
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()

  const systemMap = page.locator('.system-map-svg')
  await expect(systemMap).toBeVisible()
  const systemLight = await systemMap.evaluate(element => getComputedStyle(element).backgroundColor)
  await switchTheme(page, 'light')
  const systemDark = await systemMap.evaluate(element => getComputedStyle(element).backgroundColor)
  expect(systemDark).not.toBe(systemLight)
  await switchTheme(page, 'dark')
  await expect(systemMap).toBeVisible()

  await returnToClusterMap(page)
  const clusterMap = page.locator('.cluster-map-svg')
  await expect(clusterMap).toBeVisible()
  const clusterLight = await clusterMap.evaluate(element => getComputedStyle(element).backgroundColor)
  await switchTheme(page, 'light')
  const clusterDark = await clusterMap.evaluate(element => getComputedStyle(element).backgroundColor)
  expect(clusterDark).not.toBe(clusterLight)
  await switchTheme(page, 'dark')

  await page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
    .getByRole('button', { name: 'Open Vesper system map' })
    .click()
  await expect(systemMap).toBeVisible()
  await page.getByRole('button', { name: 'Chart details' }).click()
  const inspector = page.getByRole('complementary', { name: 'Object inspector' })
  await inspector.getByRole('button', { name: 'Edit chart names' }).click()
  const chartNamesDialog = page.getByRole('dialog', { name: 'Edit chart names' })
  const draftName = 'Unapplied Reach'
  const draftInput = chartNamesDialog.getByLabel('Jump Cluster')
  await draftInput.fill(draftName)
  expect(await controlBorderContrastRatio(draftInput)).toBeGreaterThanOrEqual(3)

  const recordsBefore = await readWorkspaceRecords(page)
  await page.evaluate(() => {
    const trackedWindow = window as Window & { __themeWorkspaceWriteCount?: number }
    trackedWindow.__themeWorkspaceWriteCount = 0
    const prototype = IDBObjectStore.prototype
    for (const method of ['add', 'put', 'delete', 'clear'] as const) {
      const original = prototype[method] as (...args: unknown[]) => IDBRequest
      Object.defineProperty(prototype, method, {
        configurable: true,
        writable: true,
        value: function (this: IDBObjectStore, ...args: unknown[]): IDBRequest {
          if (this.transaction.db.name === 'ttrpg-cluster-control' && this.name === 'workspace') {
            trackedWindow.__themeWorkspaceWriteCount = (trackedWindow.__themeWorkspaceWriteCount ?? 0) + 1
          }
          return Reflect.apply(original, this, args)
        },
      })
    }
  })

  await page.keyboard.press('Escape')
  await expect(chartNamesDialog).toBeHidden()
  await switchTheme(page, 'light')
  await expect(page.locator('.workspace-feedback').getByRole('button', { name: 'Resume chart name draft' }))
    .toBeVisible()
  await page.locator('.workspace-feedback').getByRole('button', { name: 'Resume chart name draft' }).click()
  expect(await controlBorderContrastRatio(draftInput)).toBeGreaterThanOrEqual(3)
  await expect(chartNamesDialog.getByLabel('Jump Cluster')).toHaveValue(draftName)
  await page.keyboard.press('Escape')
  await switchTheme(page, 'dark')
  await expect(page.locator('.workspace-feedback').getByRole('button', { name: 'Resume chart name draft' }))
    .toBeVisible()
  await page.locator('.workspace-feedback').getByRole('button', { name: 'Resume chart name draft' }).click()
  await expect(chartNamesDialog.getByLabel('Jump Cluster')).toHaveValue(draftName)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('group', { name: 'Vesper star system map' })).toBeVisible()
  await expect(page.locator('.workspace-feedback').getByText('Unapplied chart-name changes')).toBeVisible()
  const writes = await page.evaluate(() =>
    (window as Window & { __themeWorkspaceWriteCount?: number }).__themeWorkspaceWriteCount ?? -1,
  )
  expect(writes).toBe(0)
  expect(await readWorkspaceRecords(page)).toEqual(recordsBefore)
})

test('theme changes preserve object and route drafts plus pending and failed save status', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()

  await addCatalogueObject(page, 'jump-point')
  await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()
  await addCatalogueObject(page, 'jump-point')
  await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()

  await returnToClusterMap(page)
  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await clickDockAction(page, 'Add Jump Route')
  const routeInspector = page.getByRole('complementary', { name: 'Jump Route inspector' })
  const routeLevel = routeInspector.getByLabel('Jump level')
  const routeFrom = routeInspector.getByLabel('From Jump Point')
  const routeTo = routeInspector.getByLabel('To Jump Point')
  const fromPointIds = await routeFrom.locator('option').evaluateAll(options =>
    options.map(option => (option as HTMLOptionElement).value),
  )
  if (fromPointIds.length < 2) {
    throw new Error('The route draft requires two actual Jump Points.')
  }
  await routeLevel.fill('7')
  await routeFrom.selectOption(fromPointIds[1]!)
  const destinationPointIds = await routeTo.locator('option:not([disabled])').evaluateAll(options =>
    options.map(option => (option as HTMLOptionElement).value),
  )
  if (destinationPointIds.length === 0) throw new Error('The route draft has no destination Jump Point.')
  await routeTo.selectOption(destinationPointIds[0]!)
  const routeDraftBefore = {
    level: await routeLevel.inputValue(),
    from: await routeFrom.inputValue(),
    to: await routeTo.inputValue(),
  }
  await switchTheme(page, 'light')
  await expect(routeLevel).toHaveValue(routeDraftBefore.level)
  await expect(routeFrom).toHaveValue(routeDraftBefore.from)
  await expect(routeTo).toHaveValue(routeDraftBefore.to)
  await switchTheme(page, 'dark')
  await routeInspector.getByRole('button', { name: 'Cancel' }).click()

  await clusterMap.getByRole('button', { name: 'Open Vesper system map' }).click()
  const hierarchy = page.getByRole('complementary', { name: 'System hierarchy' })
  await hierarchy.getByRole('button', { name: /Select .*New jump point/ }).first().click()
  const inspector = page.getByRole('complementary', { name: 'Object inspector' })
  await inspector.getByRole('button', { name: 'Edit map object' }).click()
  const objectName = inspector.getByLabel('Name', { exact: true })
  const objectDescription = inspector.getByLabel('Description')
  await objectName.fill('Tentative gate')
  await objectDescription.fill('A draft survives the palette change.')
  await switchTheme(page, 'light')
  await expect(objectName).toHaveValue('Tentative gate')
  await expect(objectDescription).toHaveValue('A draft survives the palette change.')

  const saveStatus = page.locator('.save-feedback')
  await installWorkspaceWriteGate(page)
  try {
    await inspector.getByRole('button', { name: 'Save map object' }).click()
    await expect(saveStatus).toHaveText(/Saving to this browser\.\.\./)
    await expect.poll(async () => (await readWorkspaceWriteGate(page)).pendingCount).toBeGreaterThan(0)
    const writesWhileSaving = await readWorkspaceWriteGate(page)
    await switchTheme(page, 'dark')
    await expect(saveStatus).toHaveText(/Saving to this browser\.\.\./)
    expect(await readWorkspaceWriteGate(page)).toEqual(writesWhileSaving)
    await releaseWorkspaceWriteGate(page)
    await expect(saveStatus).toHaveText('Saved on this device')
  } finally {
    await restoreWorkspaceWriteGate(page)
  }

  await inspector.getByRole('button', { name: 'Edit map object' }).click()
  await inspector.getByLabel('Name', { exact: true }).fill('Rejected gate')
  const recordsBeforeFailedSave = await readWorkspaceRecords(page)
  await installWorkspaceWriteGate(page, true)
  try {
    await inspector.getByRole('button', { name: 'Save map object' }).click()
    await expect(saveStatus).toContainText('Not saved.')
    const writesAfterFailure = await readWorkspaceWriteGate(page)
    expect(writesAfterFailure.writeCount).toBeGreaterThan(0)
    await expect(inspector.getByLabel('Name', { exact: true })).toHaveValue('Rejected gate')
    await switchTheme(page, 'light')
    await expect(saveStatus).toContainText('Not saved.')
    expect(await readWorkspaceWriteGate(page)).toEqual(writesAfterFailure)
    expect(await readWorkspaceRecords(page)).toEqual(recordsBeforeFailedSave)
  } finally {
    await restoreWorkspaceWriteGate(page)
  }
})

test('keyboard focus stays fully visible on the Fields command in short landscape view', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()

  const fieldsTrigger = page.getByRole('button', { name: 'Open field definitions' })
  await fieldsTrigger.focus()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Shift+Tab')
  await expect(fieldsTrigger).toBeFocused()

  const focusRingVisible = await fieldsTrigger.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    const extent = Number.parseFloat(style.outlineWidth)
      + Math.max(0, Number.parseFloat(style.outlineOffset))
    const center = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
    return document.activeElement === element
      && style.outlineStyle !== 'none'
      && Number.parseFloat(style.outlineWidth) >= 2
      && bounds.top >= extent - 0.1
      && bounds.bottom <= window.innerHeight - extent + 0.1
      && bounds.left >= extent - 0.1
      && bounds.right <= window.innerWidth - extent + 0.1
      && (center === element || element.contains(center))
  })
  expect(focusRingVisible).toBe(true)
})
