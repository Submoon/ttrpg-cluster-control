import { expect, test } from './fixtures'
import {
  createSingleSystemWorkspace,
  clickNormalizedSystemPoint,
  openWorkspaceHierarchy,
  selectCatalogueObjectButton,
  selectInspectorOption,
} from './helpers'

type Point = { x: number; y: number }

type WorkspaceWriteGate = {
  originalAddEventListener: typeof IDBTransaction.prototype.addEventListener
  pending: Array<() => void>
}

type WorkspaceWriteGateWindow = Window & { __workspaceWriteGate?: WorkspaceWriteGate }

async function installWorkspaceWriteGate(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    const transactionPrototype = IDBTransaction.prototype
    const gate: WorkspaceWriteGate = {
      originalAddEventListener: transactionPrototype.addEventListener,
      pending: [],
    }
    ;(window as WorkspaceWriteGateWindow).__workspaceWriteGate = gate

    transactionPrototype.addEventListener = function (
      this: IDBTransaction,
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ): void {
      const isWorkspaceWrite = type === 'complete'
        && this.db.name === 'ttrpg-cluster-control'
        && this.mode === 'readwrite'
        && this.objectStoreNames.contains('workspace')
      if (!isWorkspaceWrite) return gate.originalAddEventListener.call(this, type, listener, options)

      // eslint-disable-next-line @typescript-eslint/no-this-alias -- The delayed listener must retain its transaction receiver.
      const transaction = this
      const deferredListener: EventListener = event => {
        gate.pending.push(() => {
          if (typeof listener === 'function') listener.call(transaction, event)
          else listener.handleEvent(event)
        })
      }
      return gate.originalAddEventListener.call(this, type, deferredListener, options)
    }
  })
}

async function pendingWorkspaceWrites(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() => (window as WorkspaceWriteGateWindow).__workspaceWriteGate?.pending.length ?? 0)
}

async function releaseWorkspaceWriteGate(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    const gateWindow = window as WorkspaceWriteGateWindow
    const gate = gateWindow.__workspaceWriteGate
    if (!gate) return
    IDBTransaction.prototype.addEventListener = gate.originalAddEventListener
    delete gateWindow.__workspaceWriteGate
    for (const release of gate.pending.splice(0)) release()
  })
}

async function addObjectAt(page: import('@playwright/test').Page, subtype: 'planet' | 'moon', point: Point): Promise<void> {
  const label = subtype === 'planet' ? 'Planet' : 'Moon'
  const controls = page.getByRole('group', { name: `${label} creation controls`, exact: true })
  const placementToggle = controls.getByRole('button', { name: 'Placement', exact: true })
  if (await placementToggle.getAttribute('aria-expanded') !== 'true') await placementToggle.click()
  await selectInspectorOption(page.getByLabel('Orbit placement', { exact: true }), 'Free map position')
  await placementToggle.click()
  await clickNormalizedSystemPoint(page, page.getByRole('group', { name: /star system map$/ }), point)
}

async function beginObjectAdd(page: import('@playwright/test').Page, subtype: 'planet' | 'moon'): Promise<void> {
  await (await selectCatalogueObjectButton(page, subtype)).click()
  await expect(page.getByRole('group', {
    name: `${subtype === 'planet' ? 'Planet' : 'Moon'} creation controls`,
    exact: true,
  })).toBeVisible()
}

test('desktop object Add opens the Inspector, edits and focuses each created object', async ({ page }) => {
  await createSingleSystemWorkspace(page)
  const map = page.getByRole('group', { name: 'Vesper star system map', exact: true })
  const inspectorPanel = page.locator('#workspace-inspector-panel')
  await expect(inspectorPanel).toBeHidden()

  await beginObjectAdd(page, 'planet')

  const inspector = page.getByRole('complementary', { name: 'Object inspector', exact: true })
  const locationKey = inspector.getByLabel('Location key', { exact: true })
  await installWorkspaceWriteGate(page)
  try {
    await addObjectAt(page, 'planet', { x: 0.25, y: 0.25 })
    await expect.poll(() => pendingWorkspaceWrites(page)).toBeGreaterThan(0)
    await expect(inspectorPanel).toBeVisible()
    await expect(inspector.getByRole('button', { name: 'Apply changes Save map object', exact: true })).toBeVisible()
    await expect(inspector.getByLabel('Name', { exact: true })).toHaveValue('New planet 1')
    await expect(locationKey).toBeDisabled()
    await expect(locationKey).not.toBeFocused()

    await releaseWorkspaceWriteGate(page)
    await expect(locationKey).toBeEnabled()
    await expect(locationKey).toBeFocused()
  } finally {
    await releaseWorkspaceWriteGate(page)
  }
  await expect(map.locator('.system-object')).toHaveCount(2)
  await expect(page.getByRole('button', { name: 'Quit Add and return to Select', exact: true })).toBeVisible()

  await addObjectAt(page, 'planet', { x: 0.75, y: 0.75 })
  await expect(inspector.getByLabel('Name', { exact: true })).toHaveValue('New planet 2')
  await expect(locationKey).toBeFocused()
  await expect(map.locator('.system-object')).toHaveCount(3)
})

test('compact object Add keeps closed Inspect closed and reopens selected editable object without focus', async ({ page }) => {
  await createSingleSystemWorkspace(page, { viewport: { width: 390, height: 844 } })
  const inspectorPanel = page.locator('#workspace-inspector-panel')
  await expect(inspectorPanel).toBeHidden()

  await beginObjectAdd(page, 'planet')
  await addObjectAt(page, 'planet', { x: 0.25, y: 0.25 })
  await expect(inspectorPanel).toBeHidden()

  await page.getByRole('button', { name: 'Inspect', exact: true }).click()
  await expect(inspectorPanel).toBeVisible()
  await expect(inspectorPanel.getByLabel('Name', { exact: true })).toHaveValue('New planet 1')
  await expect(inspectorPanel.getByRole('button', { name: 'Apply changes Save map object', exact: true })).toBeVisible()
  await expect(inspectorPanel.getByLabel('Location key', { exact: true })).not.toBeFocused()
})

test('Stay keeps a dirty object draft and does not publish or select a new object Add', async ({ page }) => {
  await createSingleSystemWorkspace(page)
  const hierarchy = await openWorkspaceHierarchy(page)
  await hierarchy.getByRole('treeitem', { name: 'Select A, Primary Star', exact: true }).click()

  const inspector = page.getByRole('complementary', { name: 'Object inspector', exact: true })
  await inspector.getByRole('button', { name: 'Edit map object', exact: true }).click()
  await inspector.getByLabel('Name', { exact: true }).fill('Unapplied Primary Star')
  await beginObjectAdd(page, 'planet')
  await addObjectAt(page, 'planet', { x: 0.25, y: 0.25 })

  const guard = page.getByRole('dialog', { name: 'Edit chart names', exact: true })
  await expect(guard.getByRole('button', { name: 'Stay here', exact: true })).toBeVisible()
  await guard.getByRole('button', { name: 'Stay here', exact: true }).click()
  await expect(guard).toBeHidden()
  await expect(hierarchy.getByRole('treeitem', { name: 'Select A, Primary Star', exact: true })).toHaveAttribute('aria-current', 'true')
  await expect(inspector.getByLabel('Name', { exact: true })).toHaveValue('Unapplied Primary Star')
  await expect(page.getByRole('group', { name: 'Vesper star system map', exact: true }).locator('.system-object')).toHaveCount(1)
  await expect(page.getByRole('group', { name: 'Planet creation controls', exact: true })).toBeVisible()
})
