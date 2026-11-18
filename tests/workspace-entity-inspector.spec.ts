import { expect, test } from './fixtures'
import {
  addCatalogueObject,
  captureMapExportBlobs,
  downloadImage,
  editMapObject,
  openWorkspaceHierarchy,
  returnToClusterMap,
  saveMapObject,
  waitForWorkspaceSaved,
  waitForWorkspaceStartup,
} from './helpers'

test('object Inspectors follow selection and apply, discard, and reset marker colors', async ({ page }, testInfo) => {
  test.setTimeout(90_000)
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const hierarchy = await openWorkspaceHierarchy(page)
  await addCatalogueObject(page, 'planet')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Iria')
  await saveMapObject(page)

  const starRow = hierarchy.getByRole('treeitem', { name: 'Select A, Primary Star', exact: true })
  const planetRow = hierarchy.getByRole('treeitem', { name: /Select .*Iria/ })
  await starRow.click()
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Primary Star')
  const map = page.getByRole('group', { name: 'Vesper star system map', exact: true })
  const star = map.getByRole('button', { name: /Select A, Primary Star/ })
  const starGlyph = star.locator('.system-object-glyph')
  const planet = map.getByRole('button', { name: /Select .*Iria/ })
  const planetGlyph = planet.locator('.system-object-glyph')
  const colorButton = page.getByRole('button', { name: /^Marker color:/ })
  const rgb = 'rgb(161, 81, 191)'
  const appliedStarFill = await starGlyph.evaluate(glyph => getComputedStyle(glyph).fill)

  await editMapObject(page)
  await expect(colorButton).toHaveAccessibleName('Marker color: Default')
  await colorButton.click()
  const chooser = page.getByRole('group', { name: 'Choose marker color', exact: true })
  const hexColor = chooser.getByLabel('Hex color', { exact: true })
  await expect(hexColor).toHaveValue('#26302c')
  await expect(page.getByText('No unapplied changes', { exact: true })).toBeVisible()
  const chooserScreenshot = testInfo.outputPath('marker-color-chooser-desktop.png')
  await page.screenshot({ path: chooserScreenshot, animations: 'disabled' })
  await testInfo.attach('marker-color-chooser-desktop', {
    path: chooserScreenshot,
    contentType: 'image/png',
  })
  await hexColor.fill('#a151bf')
  await expect(colorButton).toHaveAccessibleName('Marker color: #a151bf')
  await expect(starGlyph).toHaveCSS('fill', rgb)
  await hexColor.fill('#a1')
  await expect(starGlyph).toHaveCSS('fill', appliedStarFill)
  await hexColor.fill('#a151bf')
  // The installed ColorPicker throttles thumb synchronization to 50 ms; verify it does not echo over exact hex entry.
  await page.waitForTimeout(80)
  await expect(hexColor).toHaveValue('#a151bf')
  await page.keyboard.press('Escape')
  await expect(colorButton).toBeFocused()
  await captureMapExportBlobs(page)
  const image = await downloadImage(page, 'image/svg+xml')
  const starId = await star.getAttribute('data-object-id')
  if (!image.text || !starId) throw new Error('The Warden SVG or its marker identity is missing.')
  const exportedStarFill = await page.evaluate(({ text, objectId }) => {
    const svg = new DOMParser().parseFromString(text, 'image/svg+xml')
    return svg.querySelector<SVGTextElement>(
      `.system-object[data-object-id="${objectId}"] .system-object-glyph`,
    )?.style.fill
  }, { text: image.text, objectId: starId })
  expect(exportedStarFill).toMatch(/^rgb\(/)
  expect(exportedStarFill).not.toBe(rgb)
  await expect(starGlyph).toHaveCSS('fill', rgb)
  await saveMapObject(page)
  await expect(starGlyph).toHaveCSS('fill', rgb)

  await planetRow.click()
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Iria')
  const defaultFill = await planetGlyph.evaluate(glyph => getComputedStyle(glyph).fill)
  await editMapObject(page)
  await colorButton.click()
  const chooserTrack = chooser.locator('[data-color-picker-track]')
  await chooserTrack.click({ position: { x: 4, y: 120 } })
  const chooserSelector = chooser.locator('[data-color-picker-background]')
  const selectorBounds = await chooserSelector.boundingBox()
  if (!selectorBounds) throw new Error('The marker color selector is not visible.')
  await chooserSelector.click({ position: { x: selectorBounds.width - 8, y: 8 } })
  await expect(colorButton).toHaveAccessibleName(/^Marker color: #[0-9a-f]{6}$/i)
  await expect(planetGlyph).not.toHaveCSS('fill', defaultFill)
  await page.keyboard.press('Escape')
  await expect(colorButton).toBeFocused()
  await page.getByRole('button', { name: /^Discard changes/ }).click()
  await expect(colorButton).toHaveAccessibleName('Marker color: Default')
  await expect(planetGlyph).toHaveCSS('fill', defaultFill)

  await editMapObject(page)
  await colorButton.click()
  await hexColor.fill('#a151bf')
  await expect(colorButton).toHaveAccessibleName('Marker color: #a151bf')
  await page.waitForTimeout(80)
  await expect(hexColor).toHaveValue('#a151bf')
  await page.keyboard.press('Escape')
  await expect(colorButton).toBeFocused()
  await saveMapObject(page)

  const planetId = await planet.getAttribute('data-object-id')
  if (!planetId) throw new Error('Iria has no map identity.')
  const ring = map.locator(`[data-selection-object-id="${planetId}"] .system-object-selection-outline`)
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme })
    await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${theme}\\b`))
    await expect(planetGlyph).toHaveCSS('fill', rgb)
    await expect(starGlyph).toHaveCSS('fill', rgb)
    await expect(ring).toBeVisible()
    await expect(map.locator('.system-object-selection-outline')).toHaveCount(1)
  }

  await planet.focus()
  await page.keyboard.press('Shift+Tab')
  await expect(star).toBeFocused()
  await expect(star).toHaveAttribute('aria-pressed', 'false')
  await expect(star.locator('.object-hit-target')).not.toHaveCSS('stroke', 'none')
  await expect(starGlyph).toHaveCSS('fill', rgb)
  await expect(ring).toBeVisible()

  await page.emulateMedia({ colorScheme: 'light' })
  await expect(page.locator('html')).toHaveClass(/\blight\b/)
  await page.getByRole('button', { name: /^Undo(?:\b|:)/ }).click()
  await expect(planetGlyph).toHaveCSS('fill', defaultFill)
  await expect(starGlyph).toHaveCSS('fill', rgb)
  await page.getByRole('button', { name: /^Redo(?:\b|:)/ }).click()
  await expect(planetGlyph).toHaveCSS('fill', rgb)
  await waitForWorkspaceSaved(page)
  await page.reload()
  await waitForWorkspaceStartup(page)
  await returnToClusterMap(page)
  const clusterHierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  await clusterHierarchy.getByRole('button', { name: 'Open Vesper system map', exact: true }).click()
  await expect(planetGlyph).toHaveCSS('fill', rgb)

  await openWorkspaceHierarchy(page, 'System hierarchy')
  await planetRow.click()
  await editMapObject(page)
  await page.emulateMedia({ colorScheme: 'dark' })
  await colorButton.click()
  await page.getByRole('button', { name: 'Use default color', exact: true }).click()
  await expect(colorButton).toHaveAccessibleName('Marker color: Default')
  await expect(planetGlyph).not.toHaveCSS('fill', rgb)
  await colorButton.click()
  await expect(hexColor).toHaveValue('#e8eee7')
  await page.keyboard.press('Escape')
  await expect(colorButton).toBeFocused()
  await page.getByRole('button', { name: /^Discard changes/ }).click()
  await expect(planetGlyph).toHaveCSS('fill', rgb)
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(page.locator('html')).toHaveClass(/\blight\b/)
  await editMapObject(page)
  await colorButton.click()
  await page.getByRole('button', { name: 'Use default color', exact: true }).click()
  await saveMapObject(page)
  await expect(planetGlyph).toHaveCSS('fill', defaultFill)
  await expect(starGlyph).toHaveCSS('fill', rgb)
})
