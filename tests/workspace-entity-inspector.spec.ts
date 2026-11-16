import { expect, test } from './fixtures'
import {
  addCatalogueObject,
  editMapObject,
  openWorkspaceHierarchy,
  returnToClusterMap,
  saveMapObject,
  waitForWorkspaceSaved,
  waitForWorkspaceStartup,
} from './helpers'

test('object Inspectors follow selection and apply, discard, and reset marker colors', async ({ page }) => {
  test.setTimeout(60_000)
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
  const color = page.getByLabel('Marker color', { exact: true })
  const reset = page.getByRole('button', { name: 'Use default color', exact: true })
  const rgb = 'rgb(161, 81, 191)'

  await editMapObject(page)
  await color.fill('#a151bf')
  await saveMapObject(page)
  await expect(starGlyph).toHaveCSS('fill', rgb)

  await planetRow.click()
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Iria')
  const defaultFill = await planetGlyph.evaluate(glyph => getComputedStyle(glyph).fill)
  await editMapObject(page)
  await color.fill('#a151bf')
  await expect(planetGlyph).toHaveCSS('fill', defaultFill)
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
  await reset.click()
  await expect(color).toHaveValue('#e8eee7')
  await page.getByRole('button', { name: /^Discard changes/ }).click()
  await expect(planetGlyph).toHaveCSS('fill', rgb)
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(page.locator('html')).toHaveClass(/\blight\b/)
  await editMapObject(page)
  await reset.click()
  await saveMapObject(page)
  await expect(planetGlyph).toHaveCSS('fill', defaultFill)
  await expect(starGlyph).toHaveCSS('fill', rgb)
})
