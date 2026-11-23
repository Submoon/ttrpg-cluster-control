import { expect, test, type Page } from './fixtures'
import {
  createSingleSystemWorkspace,
  selectCatalogueObjectButton,
  waitForWorkspaceSaved,
  wardenMap,
} from './helpers'

async function readSavedWorkspace(page: Page): Promise<unknown> {
  return page.evaluate(async () => {
    const open = indexedDB.open('ttrpg-cluster-control')
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      open.onsuccess = () => resolve(open.result)
      open.onerror = () => reject(open.error ?? new Error('Could not open the saved workspace.'))
    })
    try {
      return await new Promise<unknown>((resolve, reject) => {
        const record = database.transaction('workspace', 'readonly').objectStore('workspace').get('current')
        record.onsuccess = () => resolve(record.result)
        record.onerror = () => reject(record.error ?? new Error('Could not read the saved workspace.'))
      })
    } finally {
      database.close()
    }
  })
}

test('map tool shortcuts follow the produced letter instead of physical key code', async ({ page }) => {
  await createSingleSystemWorkspace(page)

  const map = wardenMap(page)
  const modes = page.getByRole('group', { name: 'Map interaction mode', exact: true })
  const move = modes.getByRole('button', { name: 'Move', exact: true })
  const select = modes.getByRole('button', { name: 'Select', exact: true })
  const moveKey = page.locator('kbd').filter({ hasText: /^m$/i })
  await expect(move).toHaveText('')
  await move.hover()
  await expect(moveKey).toBeVisible()
  await page.mouse.move(0, 0)
  await expect(moveKey).toBeHidden()
  await select.focus()
  await page.keyboard.press('Tab')
  await expect(move).toBeFocused()
  await expect(moveKey).toBeVisible()

  await map.focus()
  await page.keyboard.press('m')
  await expect(move).toHaveAttribute('aria-pressed', 'true')

  await map.evaluate((element) => element.dispatchEvent(new KeyboardEvent('keydown', {
    key: 's', code: 'KeyQ', bubbles: true, cancelable: true,
  })))
  await expect(modes.getByRole('button', { name: 'Select', exact: true })).toHaveAttribute('aria-pressed', 'true')

  await map.evaluate((element) => element.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'q', code: 'KeyM', bubbles: true, cancelable: true,
  })))
  await expect(modes.getByRole('button', { name: 'Select', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(modes.getByRole('button', { name: 'Move', exact: true })).toHaveAttribute('aria-pressed', 'false')

  await map.evaluate((element) => element.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'm', code: 'KeyS', bubbles: true, cancelable: true,
  })))
  await expect(modes.getByRole('button', { name: 'Move', exact: true })).toHaveAttribute('aria-pressed', 'true')

  await map.evaluate((element) => element.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'S', code: 'KeyS', bubbles: true, cancelable: true,
  })))
  await expect(select).toHaveAttribute('aria-pressed', 'true')
})


test('Escape closes the Add chooser and map Help while preserving the armed type @ui-smoke', async ({ page }) => {
  await createSingleSystemWorkspace(page, { viewport: { width: 1280, height: 800 } })
  await waitForWorkspaceSaved(page)
  const initial = await readSavedWorkspace(page)
  expect(initial).toBeDefined()

  const map = wardenMap(page)
  const toolbar = page.getByRole('navigation', { name: 'Map context and commands' })
  const header = page.locator('header').filter({ has: page.getByRole('region', { name: 'Current Jump Cluster' }) })
  const fields = header.getByRole('button', { name: 'Open field definitions', exact: true })
  const help = header.getByRole('button', { name: 'Help', exact: true })
  const guide = page.getByRole('dialog', { name: 'Map editor help' })
  const closeGuide = guide.getByRole('button', { name: 'Close', exact: true })
  const shortcuts = guide.getByRole('heading', { name: /shortcuts/i })
  const add = page.getByRole('button', { name: 'Add to map', exact: true, includeHidden: true })
  const quitAdd = toolbar.getByRole('button', { name: 'Quit Add and return to Select' })
  const objects = map.locator('.continuous-warden-object')

  await fields.focus()
  await page.keyboard.press('Tab')
  await expect(help).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(guide).toBeInViewport({ ratio: 1 })
  await expect(guide.getByRole('heading', { name: 'Right-click and right-drag' })).toBeVisible()
  await expect(guide.getByRole('heading', { name: 'Add an object' })).toBeVisible()
  await closeGuide.press('Enter')
  await expect(guide).toBeHidden()
  await expect(help).toBeFocused()

  await (await selectCatalogueObjectButton(page, 'star')).click()
  await expect(add).toHaveAttribute('aria-pressed', 'true')
  await expect(add).toHaveAttribute('aria-expanded', 'false')

  await map.focus()
  await page.keyboard.press('a')
  await expect(add).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('button', { name: 'Add Star', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')

  await expect(add).toHaveAttribute('aria-expanded', 'false')
  await expect(add).toHaveAttribute('aria-pressed', 'true')
  await expect(quitAdd).toBeVisible()
  await expect.poll(() => map.evaluate(element => element.contains(document.activeElement))).toBe(true)
  await expect(objects).toHaveCount(1)

  await page.setViewportSize({ width: 375, height: 600 })
  const menuToggle = page.getByRole('button', { name: 'Open workspace menu', exact: true })
  await menuToggle.press('Enter')
  const menu = page.getByRole('dialog', { name: 'Workspace menu', exact: true })
  await expect(menu.getByRole('button', { name: 'Open field definitions', exact: true })).toBeInViewport({ ratio: 1 })
  await menu.getByRole('button', { name: 'Help', exact: true }).press('Space')
  await expect(guide).toBeInViewport({ ratio: 1 })
  await guide.getByRole('region', { name: 'Map editor help guide' }).press('End')
  await expect(shortcuts).toBeInViewport({ ratio: 1 })

  await page.keyboard.press('ControlOrMeta+k')
  await expect(page.getByRole('dialog', { name: 'Search workspace' })).toBeHidden()
  await page.keyboard.press('Escape')
  await expect(guide).toBeHidden()
  await expect(menuToggle).toBeFocused()
  await expect(quitAdd).toBeVisible()

  await map.focus()
  await page.keyboard.press('Escape')
  await expect(add).toHaveAttribute('aria-pressed', 'false')
  await expect(quitAdd).toHaveCount(0)
  await waitForWorkspaceSaved(page)
  expect(await readSavedWorkspace(page)).toEqual(initial)

  await page.setViewportSize({ width: 1280, height: 800 })
  await toolbar.getByRole('button', { name: 'Hierarchy', exact: true }).click()
  await expect(page.getByRole('complementary', { name: 'Jump Cluster contents' })).toBeVisible()
  await help.press('Enter')
  await expect(closeGuide).toBeFocused()

  await page.setViewportSize({ width: 375, height: 600 })
  await expect(page.locator('.map-editor-layout')).toHaveClass(/\bcompact-viewport\b/)
  await expect(closeGuide).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(guide).toBeHidden()
  const compactHierarchy = page.getByRole('dialog', { name: 'Jump Cluster contents' })
  const closeHierarchy = compactHierarchy.getByRole('button', { name: 'Close hierarchy panel' })
  await expect(closeHierarchy).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(compactHierarchy).toBeHidden()
  await expect(toolbar.getByRole('button', { name: 'Hierarchy', exact: true })).toBeFocused()
})
