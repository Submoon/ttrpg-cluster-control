import { expect, test, type Locator } from './fixtures'
import { activeWorkspaceFeedback } from './helpers'
import { returnToClusterMap } from './helpers'

async function expectFocusRingWithinViewport(locator: Locator): Promise<void> {
  const page = locator.page()
  await locator.focus()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Shift+Tab')
  await expect(locator).toBeFocused()

  const focusRingVisible = await locator.evaluate(element => {
    const bounds = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    const extent = Number.parseFloat(style.outlineWidth) + Math.max(0, Number.parseFloat(style.outlineOffset))
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
}

test('the product root creates and resumes a saved local workspace', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Give the unknown a name.' })).toBeVisible({ timeout: 30_000 })
  await page.getByLabel('Jump Cluster').fill('Halcyon Spur')
  await page.getByLabel('First star system').fill('Lark')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  await expect(page.getByRole('navigation', { name: 'Map context and commands' })
    .getByRole('heading', { name: 'Lark' })).toBeVisible()
  await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()

  await page.reload()

  await expect(page.getByRole('navigation', { name: 'Map context and commands' })
    .getByRole('heading', { name: 'Lark' })).toBeVisible()
  await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()
  await returnToClusterMap(page)
  await expect(page.getByRole('group', { name: 'Halcyon Spur Jump Cluster map' })).toBeVisible()
})

test('keyboard focus remains visible on launch and recovery actions in a short landscape viewport', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Give the unknown a name.' })).toBeVisible({ timeout: 30_000 })
  const createButton = page.getByRole('button', { name: 'Create local workspace' })
  await expect(createButton).toBeInViewport({ ratio: 1 })
  await expectFocusRingWithinViewport(createButton)
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()

  await page.evaluate(async () => {
    const request = indexedDB.open('ttrpg-cluster-control', 1)
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Could not open the workspace database.'))
    })

    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction('workspace', 'readwrite')
        transaction.objectStore('workspace').put({ damaged: true }, 'current')
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error ?? new Error('Could not damage the current snapshot.'))
        transaction.onabort = () => reject(transaction.error ?? new Error('Could not damage the current snapshot.'))
      })
    } finally {
      database.close()
    }
  })
  await page.reload()

  await expect(page.getByRole('heading', { name: 'Your workspace could not be opened.' })).toBeVisible({ timeout: 30_000 })
  await expectFocusRingWithinViewport(page.getByRole('button', { name: 'Restore last valid backup' }))
})
