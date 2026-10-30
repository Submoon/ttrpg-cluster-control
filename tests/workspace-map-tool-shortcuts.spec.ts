import { expect, test } from './fixtures'
import {
  addCatalogueObject,
  createSingleSystemWorkspace,
  openWorkspaceHierarchy,
  returnToClusterMap,
  selectCatalogueObjectButton,
  workspaceZoomControls,
} from './helpers'

test('N changes the active map mode while the map holds focus', async ({ page }) => {
  await createSingleSystemWorkspace(page)

  const map = page.getByRole('group', { name: 'Vesper star system map', exact: true })
  const modes = page.getByRole('group', { name: 'Map interaction mode', exact: true })
  await map.focus()
  await page.keyboard.press('n')

  await expect(modes.getByRole('button', { name: 'Navigate', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(map).toBeFocused()
})

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

test('an ordinary cartographic mark can own map tool shortcuts', async ({ page }) => {
  await createSingleSystemWorkspace(page)

  const map = page.getByRole('group', { name: 'Vesper star system map', exact: true })
  const star = map.getByRole('button', { name: 'Select A, Primary Star (Star)', exact: true })
  const navigate = page.getByRole('group', { name: 'Map interaction mode', exact: true })
    .getByRole('button', { name: 'Navigate', exact: true })
  await star.focus()
  await page.keyboard.press('n')

  await expect(navigate).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => map.evaluate(element => element.contains(document.activeElement))).toBe(true)
})

test('A opens the contextual Add chooser and focuses its first enabled choice', async ({ page }) => {
  await createSingleSystemWorkspace(page)

  const map = page.getByRole('group', { name: 'Vesper star system map', exact: true })
  const add = page.getByRole('button', { name: 'Add to map', exact: true })
  const star = map.locator('.system-object')
  await map.focus()
  await page.keyboard.press('a')

  await expect(add).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('button', { name: 'Add Star', exact: true })).toBeFocused()
  await expect(star).toHaveCount(1)
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

test('toolbox shows labeled shortcuts and map-focus help on desktop and compact layouts', async ({ page }, testInfo) => {
  await createSingleSystemWorkspace(page)

  const map = page.getByRole('group', { name: 'Vesper star system map', exact: true })
  const dock = page.getByRole('toolbar', { name: 'Workspace navigation', exact: true })
  const help = page.locator('#workspace-map-tool-shortcut-help')
  const helpId = await help.getAttribute('id')
  expect(helpId).toBeTruthy()
  await expect(help).toHaveClass(/sr-only/)
  await expect(help).toContainText(/Focus the map or a map item to use these shortcuts/)

  const assertToolHints = async () => {
    const tools = [
      { name: 'Select', key: 'S' },
      { name: 'Navigate', key: 'N' },
      { name: 'Move', key: 'M' },
      { name: 'Add to map', key: 'A' },
    ] as const
    for (const tool of tools) {
      const button = dock.getByRole('button', { name: tool.name, exact: true })
      await expect(button).toHaveAttribute('aria-keyshortcuts', tool.key)
      await expect(button).toHaveAttribute('aria-describedby', new RegExp(`\\b${helpId}\\b`))
      await expect(button.locator('kbd')).toHaveText(tool.key)
    }
    await expect(map).toHaveAttribute('aria-describedby', new RegExp(`\\b${helpId}\\b`))
  }

  await assertToolHints()
  const add = dock.getByRole('button', { name: 'Add to map', exact: true })
  await expect(add).toHaveAttribute('aria-expanded', 'false')
  await expect(add).toHaveAttribute('aria-controls', 'workspace-add-menu')
  const select = dock.getByRole('button', { name: 'Select', exact: true })
  const desktopDockBounds = await dock.boundingBox()
  expect(desktopDockBounds).not.toBeNull()
  await page.getByRole('button', { name: 'Map files', exact: true }).focus()
  await page.keyboard.press('Tab')
  const selectTooltipText = page.locator('[data-slot="content"] > [data-slot="text"]')
    .filter({ hasText: 'Shortcut S: Select map mode.' })
  await expect(select).toBeFocused()
  await expect(selectTooltipText).toContainText('Shortcut S: Select map mode.')
  await expect(selectTooltipText).toBeVisible()
  const selectTooltipContent = selectTooltipText.locator('..')
  await expect(selectTooltipContent).toHaveAttribute('data-state', /(instant|delayed)-open/)
  await expect(selectTooltipContent).toBeInViewport({ ratio: 1 })
  await expect(selectTooltipText).toBeInViewport({ ratio: 1 })
  await expect(select).toHaveAttribute('aria-keyshortcuts', 'S')
  await expect(select).toHaveAttribute('aria-describedby', new RegExp(`\\b${helpId}\\b`))
  expect(await dock.boundingBox()).toEqual(desktopDockBounds)
  const desktopScreenshot = testInfo.outputPath('map-tool-shortcuts-desktop.png')
  await page.screenshot({ path: desktopScreenshot, animations: 'disabled' })
  await testInfo.attach('map-tool-shortcuts-desktop', {
    path: desktopScreenshot,
    contentType: 'image/png',
  })

  await select.blur()
  await page.mouse.move(0, 0)
  await expect(selectTooltipText).toHaveCount(0)
  await select.hover()
  await expect(selectTooltipText).toContainText('Shortcut S: Select map mode.')
  await expect(selectTooltipText).toBeVisible()
  await expect(selectTooltipText.locator('..')).toHaveAttribute('data-state', /(instant|delayed)-open/)
  await expect(selectTooltipText.locator('..')).toBeInViewport({ ratio: 1 })
  await expect(selectTooltipText).toBeInViewport({ ratio: 1 })
  await expect(select).toHaveAttribute('aria-describedby', new RegExp(`\\b${helpId}\\b`))
  expect(await dock.boundingBox()).toEqual(desktopDockBounds)
  await select.blur()
  await page.mouse.move(0, 0)
  await expect(selectTooltipText).toHaveCount(0)

  await dock.getByRole('group', { name: 'Map interaction mode' })
    .getByRole('button', { name: 'Move', exact: true }).focus()
  await page.keyboard.press('Tab')
  const addTooltipText = page.locator('[data-slot="content"] > [data-slot="text"]')
    .filter({ hasText: 'Shortcut A: open the contextual Add chooser.' })
  await expect(add).toBeFocused()
  await expect(addTooltipText).toContainText('Shortcut A: open the contextual Add chooser.')
  await expect(addTooltipText).toBeVisible()
  const addTooltipContent = addTooltipText.locator('..')
  await expect(addTooltipContent).toHaveAttribute('data-state', /(instant|delayed)-open/)
  await expect(addTooltipContent).toBeInViewport({ ratio: 1 })
  await expect(addTooltipText).toBeInViewport({ ratio: 1 })
  await expect(add).toHaveAttribute('aria-describedby', new RegExp(`\\b${helpId}\\b`))
  await expect(add).toHaveAttribute('aria-controls', 'workspace-add-menu')
  await expect(add).toHaveAttribute('aria-expanded', 'false')
  expect(await dock.boundingBox()).toEqual(desktopDockBounds)
  await add.blur()
  await page.mouse.move(0, 0)
  await expect(addTooltipText).toHaveCount(0)
  await add.hover()
  await expect(addTooltipText).toContainText('Shortcut A: open the contextual Add chooser.')
  await expect(addTooltipText).toBeVisible()
  await expect(addTooltipText.locator('..')).toHaveAttribute('data-state', /(instant|delayed)-open/)
  await expect(addTooltipText.locator('..')).toBeInViewport({ ratio: 1 })
  await expect(addTooltipText).toBeInViewport({ ratio: 1 })
  await expect(add).toHaveAttribute('aria-describedby', new RegExp(`\\b${helpId}\\b`))
  expect(await dock.boundingBox()).toEqual(desktopDockBounds)
  await add.blur()
  await page.mouse.move(0, 0)
  await expect(addTooltipText).toHaveCount(0)

  await map.focus()
  await page.keyboard.press('a')
  await expect(add).toHaveAttribute('aria-expanded', 'true')
  await expect(add).toHaveAttribute('aria-controls', 'workspace-add-menu')
  await expect(page.locator('#workspace-add-menu')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(add).toHaveAttribute('aria-expanded', 'false')
  await expect(page.locator('#workspace-add-menu')).toHaveCount(0)
  await expect(addTooltipText).toHaveCount(0)

  await page.setViewportSize({ width: 390, height: 844 })
  await assertToolHints()
  await dock.getByRole('group', { name: 'Map interaction mode' })
    .getByRole('button', { name: 'Move', exact: true }).focus()
  await page.keyboard.press('Tab')
  await expect(add).toBeFocused()
  await expect(addTooltipText).toContainText('Shortcut A: open the contextual Add chooser.')
  await expect(addTooltipText).toBeVisible()
  await expect(addTooltipContent).toHaveAttribute('data-state', /(instant|delayed)-open/)
  await expect(addTooltipContent).toBeInViewport({ ratio: 1 })
  await expect(addTooltipText).toBeInViewport({ ratio: 1 })
  const compactScreenshot = testInfo.outputPath('map-tool-shortcuts-compact.png')
  await page.screenshot({ path: compactScreenshot, animations: 'disabled' })
  await testInfo.attach('map-tool-shortcuts-compact', {
    path: compactScreenshot,
    contentType: 'image/png',
  })
  await add.blur()
})

test('compact Jump Cluster shortcuts use the contextual Add choice', async ({ page }) => {
  await createSingleSystemWorkspace(page, { viewport: { width: 390, height: 844 } })
  await returnToClusterMap(page)

  const map = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map', exact: true })
  const modes = page.getByRole('group', { name: 'Map interaction mode', exact: true })
  await map.focus()
  for (const mode of [
    { key: 'n', name: 'Navigate' },
    { key: 's', name: 'Select' },
    { key: 'm', name: 'Move' },
  ]) {
    await page.keyboard.press(mode.key)
    await expect(modes.getByRole('button', { name: mode.name, exact: true })).toHaveAttribute('aria-pressed', 'true')
  }

  await page.keyboard.press('a')
  await expect(page.getByRole('button', { name: 'Add to map', exact: true })).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('button', { name: 'Add star system', exact: true })).toBeFocused()
  await expect(map.locator('.cluster-system-node')).toHaveCount(1)
})

for (const viewport of [{ width: 1280, height: 720 }, { width: 900, height: 720 }, { width: 800, height: 720 }]) {
  test(`System Hierarchy keeps map placement and zoom controls reachable (${viewport.width}px)`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Give the unknown a name.' })).toBeVisible()
    await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
    await page.getByLabel('First star system').fill('Vesper')
    await page.getByRole('button', { name: 'Create local workspace' }).click()
    await openWorkspaceHierarchy(page)

    const map = page.getByRole('group', { name: 'Vesper star system map', exact: true })
    const zoomControls = workspaceZoomControls(page)
    await expect(zoomControls).toBeInViewport({ ratio: 1 })
    for (const name of ['Zoom out', 'Zoom in', 'Fit map', 'Open map navigation controls']) {
      const control = zoomControls.getByRole('button', { name, exact: true })
      await expect(control).toBeInViewport({ ratio: 1 })
      if (!(await control.isDisabled())) await control.click({ trial: true })
    }
    if (viewport.width < 1280) {
      // Refit after opening Hierarchy so the helper's default left-side placement point is visible.
      await zoomControls.getByRole('button', { name: 'Fit map', exact: true }).click()
    }
    await addCatalogueObject(page, 'jump-point')

    await expect(map.locator('.system-object')).toHaveCount(2)
  })
}
