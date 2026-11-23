import { expect, test } from './fixtures'
import {
  captureMapExportBlobs,
  centerWorkspaceSelection,
  clickWardenSystemPoint,
  createSingleSystemWorkspace,
  downloadImage,
  downloadJson,
  editMapObject,
  openWorkspaceHierarchy,
  quitSystemAdd,
  saveMapObject,
  selectCatalogueObjectButton,
  waitForWorkspaceSaved,
  waitForWorkspaceStartup,
  wardenMap,
  wardenObjectMark,
} from './helpers'

test('object Inspectors follow selection and apply, discard, and reset marker colors', async ({ page }, testInfo) => {
  test.setTimeout(90_000)
  await page.emulateMedia({ colorScheme: 'light' })
  await captureMapExportBlobs(page)
  const { systemId, primaryObjectId } = await createSingleSystemWorkspace(page, { viewport: { width: 1440, height: 960 } })
  const map = wardenMap(page)
  const system = map.locator(`.continuous-warden-system[data-system-id="${systemId}"]`)
  const star = wardenObjectMark(page, systemId, primaryObjectId)
  const starGlyph = star.locator('.continuous-warden-object-glyph')
  await (await selectCatalogueObjectButton(page, 'planet')).click()
  await clickWardenSystemPoint(page, systemId, { x: 0.33, y: 0.64 })
  const createdPlanet = system.getByRole('button', { name: 'Select PL-01, New planet 1', exact: true })
  await expect(createdPlanet).toBeVisible()
  const planetId = await createdPlanet.getAttribute('data-object-id')
  if (!planetId) throw new Error('The created Planet must have its own identity.')
  await quitSystemAdd(page)
  const planet = wardenObjectMark(page, systemId, planetId)
  const planetGlyph = planet.locator('.continuous-warden-object-glyph')
  await planet.press('Enter')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Iria')
  await saveMapObject(page)

  const hierarchy = await openWorkspaceHierarchy(page)
  const starRow = hierarchy.getByRole('treeitem', { name: 'Select A, Primary Star in Vesper', exact: true })
  const planetRow = hierarchy.getByRole('treeitem', { name: 'Select PL-01, Iria in Vesper', exact: true })
  await starRow.click()
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Primary Star')
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
  const image = await downloadImage(page, 'image/svg+xml', 'Selected system')
  if (!image.text) throw new Error('The Warden SVG is missing.')
  const exportedStarFill = await page.evaluate(({ text, ownerId, objectId }) => {
    const svg = new DOMParser().parseFromString(text, 'image/svg+xml')
    const glyph = svg.querySelector<SVGTextElement>(
      `.continuous-warden-object[data-system-id="${ownerId}"][data-object-id="${objectId}"] .continuous-warden-object-glyph`,
    )
    if (!glyph) throw new Error('The applied SVG must include the original Star.')
    return glyph.style.fill
  }, { text: image.text, ownerId: systemId, objectId: primaryObjectId })
  expect(exportedStarFill).toBe(appliedStarFill)
  const beforeApply = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(beforeApply.cluster?.systems.find(system => system.id === systemId)
    ?.objects.find(object => object.id === primaryObjectId)?.markerColor).toBeUndefined()
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

  const ring = planet.locator('.system-object-selection-outline')
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
  await expect(star.locator('.continuous-warden-object-marker-outline')).not.toHaveCSS('stroke', 'none')
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
  const clusterHierarchy = await openWorkspaceHierarchy(page)
  await clusterHierarchy.getByRole('treeitem', { name: 'Vesper', exact: true }).click()
  await centerWorkspaceSelection(page)
  await expect(planetGlyph).toHaveCSS('fill', rgb)
  const durable = await downloadJson(page, 'Export Jump Cluster JSON')
  const durableOwner = durable.cluster?.systems.find(system => system.id === systemId)
  expect(durableOwner?.objects.find(object => object.id === planetId)?.markerColor).toMatch(/^#a151bf$/i)
  expect(durableOwner?.objects.find(object => object.id === primaryObjectId)?.markerColor).toMatch(/^#a151bf$/i)

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
  await waitForWorkspaceSaved(page)
  const afterReset = await downloadJson(page, 'Export Jump Cluster JSON')
  const resetOwner = afterReset.cluster?.systems.find(system => system.id === systemId)
  expect(resetOwner?.objects.find(object => object.id === planetId)?.markerColor).toBeUndefined()
  expect(resetOwner?.objects.find(object => object.id === primaryObjectId)?.markerColor).toMatch(/^#a151bf$/i)
})
