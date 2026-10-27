import { expect, test, type Page } from './fixtures'
import { addCatalogueObject, captureMapExportBlobs, downloadJson, openWorkspaceZoomNavigation } from './helpers'

async function createWorkspace(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('textbox', { name: 'Jump Cluster' }).fill('Kestrel Reach')
  await page.getByRole('textbox', { name: 'First star system' }).fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await expect(page.getByRole('toolbar', { name: 'Workspace navigation' })).toBeVisible()
}

async function dragMapBackground(page: Page): Promise<void> {
  const map = page.getByRole('group', { name: 'Vesper star system map' })
  const bounds = await map.boundingBox()
  expect(bounds).not.toBeNull()
  const startX = bounds!.x + 24
  const startY = bounds!.y + 24
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + 48, startY + 28, { steps: 4 })
  await page.mouse.up()
}

test('Move refuses an object with an unresolved inspector draft before preview and opens Resolve access', async ({ page }) => {
  await captureMapExportBlobs(page)
  await createWorkspace(page)
  const map = page.getByRole('group', { name: 'Vesper star system map' })
  const inspectorToggle = page.getByRole('button', { name: 'Inspect', exact: true })
  const object = map.locator('.system-object').filter({ hasText: 'Primary Star' })

  await page.getByRole('group', { name: 'Map interaction mode' }).getByRole('button', { name: 'Select' }).click()
  await addCatalogueObject(page, 'planet', { noSelection: true })
  await expect(map.locator('.system-object')).toHaveCount(2)
  await page.getByRole('group', { name: 'Map interaction mode' }).getByRole('button', { name: 'Select' }).click()
  await object.click()
  const objectId = await object.getAttribute('data-object-id')
  const committedBefore = await downloadJson(page, 'Export star system JSON')
  const committedObject = committedBefore.system!.objects.find(candidate => candidate.id === objectId)!
  await page.getByRole('button', { name: 'Edit map object' }).click()
  await page.getByLabel('Description').fill('Unresolved map-object draft')
  await inspectorToggle.click()
  await expect(inspectorToggle).toHaveAttribute('aria-expanded', 'false')
  await page.getByRole('group', { name: 'Map interaction mode' }).getByRole('button', { name: 'Move' }).click()

  const originalObjectTransform = await object.getAttribute('transform')
  const originalSceneTransform = await page.locator('.system-map-content').getAttribute('transform')
  const bounds = await object.boundingBox()
  expect(bounds).not.toBeNull()
  const startX = bounds!.x + bounds!.width / 2
  const startY = bounds!.y + bounds!.height / 2
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + 52, startY + 34, { steps: 5 })
  await expect(object).toHaveAttribute('transform', originalObjectTransform!)
  await page.mouse.up()

  await expect(object).toHaveAttribute('transform', originalObjectTransform!)
  await expect(inspectorToggle).toHaveAttribute('aria-expanded', 'true')
  const inspector = page.locator('#workspace-inspector-panel')
  await expect(inspector.getByRole('alert')).toContainText(/draft/i)
  await expect(inspector.getByLabel('Description')).toHaveValue('Unresolved map-object draft')
  await expect(inspector.getByRole('button', { name: 'Save map object' })).toBeVisible()
  await expect(inspector.getByRole('button', { name: 'Cancel map object edits' })).toBeVisible()
  const committedAfterBlockedMove = await downloadJson(page, 'Export star system JSON')
  expect(committedAfterBlockedMove.system!.objects.find(candidate => candidate.id === objectId)).toEqual(committedObject)

  await inspectorToggle.click()
  await expect(inspectorToggle).toHaveAttribute('aria-expanded', 'false')
  const shortTapBounds = await object.boundingBox()
  expect(shortTapBounds).not.toBeNull()
  await page.mouse.click(shortTapBounds!.x + shortTapBounds!.width / 2, shortTapBounds!.y + shortTapBounds!.height / 2)
  await expect(inspectorToggle).toHaveAttribute('aria-expanded', 'false')

  await page.getByRole('button', { name: 'Fit map' }).click()
  const independentObject = map.locator('.system-object').filter({ hasText: 'New planet 1' })
  const independentTransform = await independentObject.getAttribute('transform')
  const independentHitTarget = independentObject.locator('.object-hit-target')
  const independentBounds = await independentHitTarget.boundingBox()
  expect(independentBounds).not.toBeNull()
  await page.mouse.move(independentBounds!.x + independentBounds!.width / 2, independentBounds!.y + independentBounds!.height / 2)
  await page.mouse.down()
  await page.mouse.move(independentBounds!.x + independentBounds!.width / 2 + 44, independentBounds!.y + independentBounds!.height / 2 + 26, { steps: 4 })
  await expect(independentObject).not.toHaveAttribute('transform', independentTransform!)
  await page.mouse.up()
  await expect(independentObject).not.toHaveAttribute('transform', independentTransform!)

  const zoomNavigation = await openWorkspaceZoomNavigation(page)
  await zoomNavigation.getByRole('button', { name: 'Pan map right' }).click()
  await expect(page.locator('.system-map-content')).not.toHaveAttribute('transform', originalSceneTransform!)
  const zoomSlider = zoomNavigation.getByRole('slider', { name: 'Map zoom level' })
  const originalZoomLabel = await zoomSlider.getAttribute('aria-valuetext')
  await page.getByRole('button', { name: 'Zoom in' }).click()
  await expect.poll(() => zoomSlider.getAttribute('aria-valuetext')).not.toBe(originalZoomLabel)
})

test('keyboard Enter and Space still activate a map object immediately after pointer pan', async ({ page }) => {
  await createWorkspace(page)
  const map = page.getByRole('group', { name: 'Vesper star system map' })
  const object = map.getByRole('button', { name: 'Select A, Primary Star (Star)' })
  const inspectorToggle = page.getByRole('button', { name: 'Inspect', exact: true })
  await page.getByRole('group', { name: 'Map interaction mode' }).getByRole('button', { name: 'Select' }).click()
  if (await inspectorToggle.getAttribute('aria-expanded') === 'true') await inspectorToggle.click()

  for (const key of ['Enter', 'Space'] as const) {
    await dragMapBackground(page)
    await object.focus()
    await page.keyboard.press(key)
    await expect(inspectorToggle).toHaveAttribute('aria-expanded', 'true')
    await inspectorToggle.click()
    await expect(inspectorToggle).toHaveAttribute('aria-expanded', 'false')
  }
})

test('browser blur cancels a Move object preview before its later pointer release', async ({ page }) => {
  await createWorkspace(page)
  const map = page.getByRole('group', { name: 'Vesper star system map' })
  const object = map.locator('.system-object').filter({ hasText: 'Primary Star' })
  await page.getByRole('group', { name: 'Map interaction mode' }).getByRole('button', { name: 'Move' }).click()

  const originalObjectTransform = await object.getAttribute('transform')
  const bounds = await object.boundingBox()
  expect(bounds).not.toBeNull()
  const startX = bounds!.x + bounds!.width / 2
  const startY = bounds!.y + bounds!.height / 2
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + 46, startY + 30, { steps: 4 })
  await expect(object).not.toHaveAttribute('transform', originalObjectTransform!)

  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await page.mouse.up()

  await expect(object).toHaveAttribute('transform', originalObjectTransform!)
})

test('changing interaction mode cancels a pending pointer long press', async ({ page }) => {
  await createWorkspace(page)
  const map = page.getByRole('group', { name: 'Vesper star system map' })
  const object = map.locator('.system-object').filter({ hasText: 'Primary Star' })
  const inspectorToggle = page.getByRole('button', { name: 'Inspect', exact: true })
  if (await inspectorToggle.getAttribute('aria-expanded') === 'true') await inspectorToggle.click()
  const bounds = await object.boundingBox()
  expect(bounds).not.toBeNull()
  const modeGroup = page.getByRole('group', { name: 'Map interaction mode' })
  const selectMode = modeGroup.getByRole('button', { name: 'Select' })
  const startX = bounds!.x + bounds!.width / 2
  const startY = bounds!.y + bounds!.height / 2

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await selectMode.focus()
  await page.keyboard.press('Enter')
  await expect(selectMode).toHaveAttribute('aria-pressed', 'true')
  await page.waitForTimeout(650)

  await expect(inspectorToggle).toHaveAttribute('aria-expanded', 'false')
  await expect(map.locator('.system-object.is-selected')).toHaveCount(0)
  await page.mouse.up()
})
