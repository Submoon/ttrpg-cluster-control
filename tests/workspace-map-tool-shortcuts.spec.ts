import { expect, test } from './fixtures'
import {
  createSingleSystemWorkspace,
  selectCatalogueObjectButton,
} from './helpers'

test('map tool shortcuts follow the produced letter instead of physical key code', async ({ page }) => {
  await createSingleSystemWorkspace(page)

  const map = page.getByRole('group', { name: 'Vesper star system map', exact: true })
  const modes = page.getByRole('group', { name: 'Map interaction mode', exact: true })
  await map.focus()
  await page.keyboard.press('n')
  await expect(modes.getByRole('button', { name: 'Navigate', exact: true })).toHaveAttribute('aria-pressed', 'true')

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
    key: 'N', code: 'KeyN', bubbles: true, cancelable: true,
  })))
  await expect(modes.getByRole('button', { name: 'Navigate', exact: true })).toHaveAttribute('aria-pressed', 'true')
})


test('Escape closes a keyboard-opened Add chooser and preserves the armed type', async ({ page }) => {
  await createSingleSystemWorkspace(page)

  const map = page.getByRole('group', { name: 'Vesper star system map', exact: true })
  const add = page.getByRole('button', { name: 'Add to map', exact: true, includeHidden: true })
  const objects = map.locator('.system-object')
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
  await expect(page.getByRole('button', { name: 'Quit Add and return to Select', exact: true })).toBeVisible()
  await expect.poll(() => map.evaluate(element => element.contains(document.activeElement))).toBe(true)
  await expect(objects).toHaveCount(1)

  await page.keyboard.press('Escape')
  await expect(add).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByRole('button', { name: 'Quit Add and return to Select', exact: true })).toHaveCount(0)
  await expect(objects).toHaveCount(1)
})
