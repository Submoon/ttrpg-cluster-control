import { expect, test } from './fixtures'
import { createSingleSystemWorkspace } from './helpers'

test('Dock and Inspector text controls keep their own focus and input', async ({ page }) => {
  await createSingleSystemWorkspace(page)

  const modes = page.getByRole('group', { name: 'Map interaction mode', exact: true })
  const map = page.getByRole('group', { name: 'Vesper star system map', exact: true })
  const star = map.getByRole('button', { name: 'Select A, Primary Star (Star)', exact: true })
  await modes.getByRole('button', { name: 'Navigate', exact: true }).focus()
  await page.keyboard.press('n')
  await expect(modes.getByRole('button', { name: 'Select', exact: true })).toHaveAttribute('aria-pressed', 'true')

  await star.click()
  const inspector = page.getByRole('complementary', { name: 'Object inspector', exact: true })
  await inspector.getByRole('button', { name: 'Edit map object', exact: true }).click()
  const name = inspector.getByLabel('Name', { exact: true })
  await name.focus()
  await name.press('End')
  await page.keyboard.press('n')

  await expect(name).toHaveValue('Primary Starn')
  await expect(modes.getByRole('button', { name: 'Select', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await inspector.getByRole('button', { name: /Discard changes/ }).click()

  const editable = star.locator('[data-shortcut-test-editable]')
  const focusedEditable = await star.evaluate((mark) => {
    const host = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject')
    host.setAttribute('data-shortcut-test-host', '')
    host.setAttribute('x', '0')
    host.setAttribute('y', '0')
    host.setAttribute('width', '1')
    host.setAttribute('height', '1')
    const input = document.createElement('div')
    input.contentEditable = 'true'
    input.tabIndex = 0
    input.setAttribute('data-shortcut-test-editable', '')
    host.append(input)
    mark.append(host)
    input.focus()
    return document.activeElement === input
  })
  expect(focusedEditable).toBe(true)
  await expect(editable).toBeFocused()
  await page.keyboard.press('m')
  await expect(editable).toHaveText('m')
  await expect(modes.getByRole('button', { name: 'Select', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await star.evaluate(mark => mark.querySelector('[data-shortcut-test-host]')?.remove())

  await map.focus()
  await page.keyboard.press('n')
  await expect(modes.getByRole('button', { name: 'Navigate', exact: true })).toHaveAttribute('aria-pressed', 'true')
})
