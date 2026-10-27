import { expect, test } from './fixtures'
import {
  activeWorkspaceFeedback,
  createSingleSystemWorkspace,
  clickNormalizedSystemPoint,
  selectCatalogueObjectButton,
  selectInspectorOption,
} from './helpers'

type WorkspaceWriteObserver = {
  originalPut: IDBObjectStore['put']
  count: number
}

type WorkspaceWriteObserverWindow = Window & { __workspaceWriteObserver?: WorkspaceWriteObserver }

async function installWorkspaceWriteObserver(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    const originalPut = IDBObjectStore.prototype.put
    const observer: WorkspaceWriteObserver = { originalPut, count: 0 }
    ;(window as WorkspaceWriteObserverWindow).__workspaceWriteObserver = observer
    IDBObjectStore.prototype.put = function (
      this: IDBObjectStore,
      ...args: Parameters<typeof originalPut>
    ) {
      if (this.transaction.mode === 'readwrite'
        && this.transaction.db.name === 'ttrpg-cluster-control'
        && this.name === 'workspace') {
        observer.count += 1
      }
      return originalPut.apply(this, args)
    }
  })
}

async function workspaceWriteCount(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() => (window as WorkspaceWriteObserverWindow).__workspaceWriteObserver?.count ?? 0)
}

async function restoreWorkspaceWriteObserver(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    const observerWindow = window as WorkspaceWriteObserverWindow
    const observer = observerWindow.__workspaceWriteObserver
    if (!observer) return
    IDBObjectStore.prototype.put = observer.originalPut
    delete observerWindow.__workspaceWriteObserver
  })
}

test('Save finishes a clean new object edit without another workspace write or leaving Add mode', async ({ page }) => {
  await createSingleSystemWorkspace(page)
  const map = page.getByRole('group', { name: 'Vesper star system map', exact: true })
  const addObject = await selectCatalogueObjectButton(page, 'planet')
  await addObject.click()

  const placement = page.getByRole('group', { name: 'Planet creation controls', exact: true })
  const placementToggle = placement.getByRole('button', { name: 'Placement', exact: true })
  if (await placementToggle.getAttribute('aria-expanded') !== 'true') await placementToggle.click()
  await selectInspectorOption(page.getByLabel('Orbit placement', { exact: true }), 'Free map position')
  await placementToggle.click()
  await clickNormalizedSystemPoint(page, map, { x: 0.25, y: 0.25 })

  const inspector = page.getByRole('complementary', { name: 'Object inspector', exact: true })
  const save = inspector.getByRole('button', { name: 'Apply changes Save map object', exact: true })
  await expect(save).toBeEnabled()
  await expect(inspector.getByLabel('Name', { exact: true })).toHaveValue('New planet 1')
  await expect(map.locator('.system-object')).toHaveCount(2)
  await expect(page.getByRole('button', { name: 'Quit Add and return to Select', exact: true })).toBeVisible()
  await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()

  await installWorkspaceWriteObserver(page)
  const writesBeforeSave = await workspaceWriteCount(page)
  try {
    await save.click()
    await expect(inspector.getByRole('button', { name: 'Edit map object', exact: true })).toBeVisible()
    await expect(inspector.getByLabel('Name', { exact: true })).toBeDisabled()
    await expect(inspector.getByRole('heading', { name: 'New planet 1', exact: true })).toBeVisible()
    await expect(map.locator('.system-object')).toHaveCount(2)
    await expect(page.getByRole('button', { name: 'Quit Add and return to Select', exact: true })).toBeVisible()
    await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()
    expect(await workspaceWriteCount(page)).toBe(writesBeforeSave)
  } finally {
    await restoreWorkspaceWriteObserver(page)
  }
})
