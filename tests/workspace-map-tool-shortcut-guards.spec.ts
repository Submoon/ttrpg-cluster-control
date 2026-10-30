import { expect, test } from './fixtures'
import {
  activeWorkspaceFeedback, clickDockAction, createSingleSystemWorkspace, openChartDetails, setWorkspaceMapMode,
} from './helpers'

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

test('modified, repeated, composing, or already-handled map keys do not change tools', async ({ page }) => {
  await createSingleSystemWorkspace(page)

  const map = page.getByRole('group', { name: 'Vesper star system map', exact: true })
  const modes = page.getByRole('group', { name: 'Map interaction mode', exact: true })
  await map.focus()
  const defaultPrevented = await map.evaluate((element) => {
    const attempts: Array<{
      init?: KeyboardEventInit
      altGraph?: boolean
      composing?: boolean
      legacyComposition?: boolean
      handled?: boolean
    }> = [
      { init: { ctrlKey: true } },
      { init: { metaKey: true } },
      { init: { altKey: true } },
      { init: { shiftKey: true } },
      { altGraph: true },
      { init: { repeat: true } },
      { composing: true },
      { legacyComposition: true },
      { handled: true },
    ]

    return attempts.map(({ init, altGraph, composing, legacyComposition, handled }) => {
      const event = new KeyboardEvent('keydown', {
        key: 'm', code: 'KeyM', bubbles: true, cancelable: true, ...init,
      })
      if (altGraph) {
        Object.defineProperty(event, 'getModifierState', {
          value: (modifier: string) => modifier === 'AltGraph',
        })
      }
      if (composing) Object.defineProperty(event, 'isComposing', { value: true })
      if (legacyComposition) Object.defineProperty(event, 'keyCode', { value: 229 })
      if (handled) event.preventDefault()
      element.dispatchEvent(event)
      return event.defaultPrevented
    })
  })

  expect(defaultPrevented).toEqual([false, false, false, false, false, false, false, false, true])
  await expect(modes.getByRole('button', { name: 'Select', exact: true })).toHaveAttribute('aria-pressed', 'true')

  await page.keyboard.press('m')
  await expect(modes.getByRole('button', { name: 'Move', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

test('map Orbit sliders keep letter shortcuts while their arrow keys adjust geometry', async ({ page }) => {
  await createSingleSystemWorkspace(page)
  await clickDockAction(page, 'Add orbit', { target: { kind: 'host', name: 'Primary Star' } })
  await setWorkspaceMapMode(page, 'Move')

  const map = page.getByRole('group', { name: 'Vesper star system map', exact: true })
  const resize = map.getByRole('slider', { name: 'Resize Orbit 1 around Primary Star', exact: true })
  const modes = page.getByRole('group', { name: 'Map interaction mode', exact: true })
  await resize.focus()
  const radiusBefore = Number(await resize.getAttribute('aria-valuenow'))
  await page.keyboard.press('n')

  await expect(modes.getByRole('button', { name: 'Move', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('ArrowRight')
  await expect(resize).toHaveAttribute('aria-valuenow', String(radiusBefore + 1))

  await map.focus()
  await page.keyboard.press('n')
  await expect(modes.getByRole('button', { name: 'Navigate', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

test('an open Add chooser keeps ownership for a map-targeted keydown', async ({ page }) => {
  await createSingleSystemWorkspace(page)

  const map = page.getByRole('group', { name: 'Vesper star system map', exact: true })
  const modes = page.getByRole('group', { name: 'Map interaction mode', exact: true })
  const add = page.getByRole('button', { name: 'Add to map', exact: true, includeHidden: true })
  const addMenu = page.getByRole('group', { name: 'Add to map', exact: true, includeHidden: true })
  await map.focus()
  await page.keyboard.press('a')
  await expect(add).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('button', { name: 'Add Star', exact: true })).toBeFocused()

  expect(await dispatchMapKeydown(map, 'm')).toBe(false)
  await expect(add).toHaveAttribute('aria-expanded', 'true')
  await expect(modes.getByRole('button', { name: 'Select', exact: true })).toHaveAttribute('aria-pressed', 'true')

  const historyButton = page.getByRole('button', { name: 'History', exact: true })
  await page.keyboard.down('Escape')
  await expect(add).toHaveAttribute('aria-expanded', 'false')
  await historyButton.focus()
  await page.keyboard.up('Escape')
  await expect(addMenu).toHaveCount(0)
  await expect(historyButton).toBeFocused()
  await expect(modes.getByRole('button', { name: 'Select', exact: true })).toHaveAttribute('aria-pressed', 'true')

  await map.focus()
  await page.keyboard.press('n')
  await expect(modes.getByRole('button', { name: 'Navigate', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

test('the History dialog owns letters even when a keydown is dispatched at the map', async ({ page }) => {
  await createSingleSystemWorkspace(page)

  const map = page.getByRole('group', { name: 'Vesper star system map', exact: true, includeHidden: true })
  const modes = page.getByRole('group', { name: 'Map interaction mode', exact: true, includeHidden: true })
  const history = page.getByRole('dialog', { name: 'History', exact: true })
  await page.getByRole('button', { name: 'History', exact: true }).click()
  await expect(history).toBeVisible()

  const defaultPrevented = await dispatchMapKeydown(map, 'm')
  expect(defaultPrevented).toBe(false)
  await expect(modes.getByRole('button', { name: 'Select', exact: true, includeHidden: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(history).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(history).toBeHidden()
  await expect(modes.getByRole('button', { name: 'Select', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await map.focus()
  await page.keyboard.press('n')
  await expect(modes.getByRole('button', { name: 'Navigate', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

test('an open Inspector listbox keeps ownership for a map-targeted keydown', async ({ page }) => {
  await createSingleSystemWorkspace(page)

  const map = page.getByRole('group', { name: 'Vesper star system map', exact: true, includeHidden: true })
  await map.getByRole('button', { name: 'Select A, Primary Star (Star)', exact: true }).click()
  const inspector = page.getByRole('complementary', { name: 'Object inspector', exact: true })
  await inspector.getByRole('button', { name: 'Edit map object', exact: true }).click()
  const placement = inspector.getByLabel('Placement', { exact: true })
  await placement.click()
  const listbox = page.getByRole('listbox')
  await expect(listbox).toBeVisible()

  const modes = page.getByRole('group', { name: 'Map interaction mode', exact: true, includeHidden: true })
  expect(await dispatchMapKeydown(map, 'm')).toBe(false)
  await expect(listbox).toBeVisible()
  await expect(modes.getByRole('button', { name: 'Select', exact: true, includeHidden: true })).toHaveAttribute('aria-pressed', 'true')

  await listbox.getByRole('option').first().click()
  await expect(listbox).toBeHidden()
  await inspector.getByRole('button', { name: /Discard changes/ }).click()
  await expect(modes.getByRole('button', { name: 'Select', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await map.focus()
  await page.keyboard.press('n')
  await expect(modes.getByRole('button', { name: 'Navigate', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

test('a held map pan ignores letters and still completes without a deferred tool change', async ({ page }) => {
  await createSingleSystemWorkspace(page)

  const map = page.getByRole('group', { name: 'Vesper star system map', exact: true })
  const scene = map.locator('.system-map-content')
  const modes = page.getByRole('group', { name: 'Map interaction mode', exact: true })
  const originalTransform = await scene.getAttribute('transform')
  const bounds = await map.boundingBox()
  expect(bounds).not.toBeNull()
  if (!bounds) throw new Error('The system map has no visible bounds for its pan gesture.')

  await map.focus()
  await page.mouse.move(bounds.x + 24, bounds.y + 24)
  await page.mouse.down({ button: 'right' })
  try {
    await page.keyboard.press('m')
    await expect(modes.getByRole('button', { name: 'Select', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await page.mouse.move(bounds.x + 64, bounds.y + 48, { steps: 3 })
  } finally {
    await page.mouse.up({ button: 'right' })
  }

  await expect.poll(() => scene.getAttribute('transform')).not.toBe(originalTransform)
  await expect(modes.getByRole('button', { name: 'Select', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await map.focus()
  await page.keyboard.press('n')
  await expect(modes.getByRole('button', { name: 'Navigate', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

test('Ctrl+Z keeps history ownership and does not select a map tool', async ({ page }) => {
  await createSingleSystemWorkspace(page)

  const details = await openChartDetails(page)
  await details.getByRole('button', { name: 'Edit chart names', exact: true }).click()
  const names = page.getByRole('dialog', { name: 'Edit chart names', exact: true })
  await names.getByLabel('Star system', { exact: true }).fill('Vesper Prime')
  await names.getByRole('button', { name: 'Apply names', exact: true }).click()
  await expect(names).toBeHidden()
  await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()
  const renamedMap = page.getByRole('group', { name: 'Vesper Prime star system map', exact: true })
  await expect(renamedMap).toBeVisible()

  const modes = page.getByRole('group', { name: 'Map interaction mode', exact: true })
  await expect(page.getByRole('button', { name: /^Undo(?:\b|:)/ })).toBeEnabled()
  await renamedMap.focus()
  await page.keyboard.press('Control+z')

  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map', exact: true })
  await expect(clusterMap).toBeVisible()
  await expect(clusterMap.getByRole('button', { name: /^(Open|Select) Vesper system(?: map)?$/ })).toBeVisible()
  await expect(clusterMap.getByRole('button', { name: /^(Open|Select) Vesper Prime system(?: map)?$/ })).toHaveCount(0)
  await expect(modes.getByRole('button', { name: 'Select', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

async function dispatchMapKeydown(map: import('@playwright/test').Locator, key: string): Promise<boolean> {
  return map.evaluate((element, producedKey) => {
    const event = new KeyboardEvent('keydown', {
      key: producedKey,
      code: `Key${producedKey.toUpperCase()}`,
      bubbles: true,
      cancelable: true,
    })
    element.dispatchEvent(event)
    return event.defaultPrevented
  }, key)
}
