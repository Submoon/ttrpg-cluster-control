import { expect, test } from './fixtures'
import {
  captureMapExportBlobs,
  createSingleSystemWorkspace,
  downloadJson,
  editMapObject,
  openChartDetails,
  openWorkspaceHierarchy,
  waitForWorkspaceSaved,
} from './helpers'

const modes = ['Hidden', 'Unknown presence', 'Known type', 'Revealed'] as const

async function setVisibility(control: import('@playwright/test').Locator, mode: typeof modes[number]): Promise<void> {
  const button = control.getByRole('button', { name: `Set visibility to ${mode}`, exact: true })
  await button.click()
  await expect(button).toHaveAttribute('aria-pressed', 'true')
  await expect(control.locator('button[aria-pressed="true"]')).toHaveCount(1)
}

test('Inspector visibility buttons update committed system and object settings without entering edit mode', async ({ page }, testInfo) => {
  await createSingleSystemWorkspace(page)
  const chartDetails = await openChartDetails(page)
  const systemControls = chartDetails.getByRole('region', { name: 'Configured visibility', exact: true })
  await expect(systemControls).toBeVisible()

  for (const mode of ['Hidden', 'Unknown presence', 'Revealed', 'Known type'] as const) {
    await setVisibility(systemControls, mode)
  }
  await expect(systemControls).toContainText('Configured visibility: Known type')

  const hierarchy = await openWorkspaceHierarchy(page)
  const primaryStar = hierarchy.getByRole('treeitem', { name: 'Select A, Primary Star' })
  await expect(primaryStar).toBeVisible()
  await primaryStar.click()
  const inspectToggle = page.getByRole('button', { name: 'Inspect', exact: true })
  if (await inspectToggle.getAttribute('aria-expanded') !== 'true') await inspectToggle.click()

  const objectControls = page.getByRole('region', { name: 'Configured visibility', exact: true })
  await expect(objectControls).toBeVisible()
  await setVisibility(objectControls, 'Revealed')
  await expect(objectControls).toContainText('Configured visibility: Revealed')
  await expect(objectControls).toContainText('System map unavailable to players until this system is Revealed.')
  await expect(primaryStar).toHaveAttribute('aria-description', /Configured visibility: Revealed/)
  await expect(primaryStar).toHaveAttribute('aria-description', /System map unavailable to players/)
  await page.mouse.move(600, 100)
  const screenshot = testInfo.outputPath('quick-publication-desktop.png')
  await page.screenshot({ path: screenshot, fullPage: true })
  await testInfo.attach('quick-publication-desktop', { path: screenshot, contentType: 'image/png' })
})

for (const width of [1280, 390]) {
  test(`Hierarchy supports keyboard and touch context actions without changing selection at ${width}px`, async ({ page }, testInfo) => {
    await createSingleSystemWorkspace(page, { viewport: { width, height: 844 } })
    const hierarchy = await openWorkspaceHierarchy(page)
    const primaryStar = hierarchy.getByRole('treeitem', { name: 'Select A, Primary Star' })
    await expect(primaryStar).toBeVisible()

    await primaryStar.focus()
    await page.keyboard.press('Shift+F10')
    let menu = page.getByRole('menu', { name: 'Player visibility', exact: true })
    await expect(menu).toBeVisible()
    const settings = menu.getByRole('menuitemcheckbox')
    await expect(settings).toHaveCount(4)
    await expect(menu.locator('[role="menuitemcheckbox"][aria-checked="true"]')).toHaveCount(1)
    const screenshot = testInfo.outputPath('quick-publication-menu.png')
    await menu.screenshot({ path: screenshot })
    await testInfo.attach('quick-publication-menu', { path: screenshot, contentType: 'image/png' })
    await page.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)
    await expect(primaryStar).toBeFocused()

    const touchAction = hierarchy.getByRole('button', { name: 'Change visibility for Primary Star', exact: true })
    const hitArea = await touchAction.boundingBox()
    expect(hitArea).not.toBeNull()
    expect(hitArea!.width).toBeGreaterThanOrEqual(28)
    await touchAction.click()
    menu = page.getByRole('menu', { name: 'Player visibility', exact: true })
    await expect(menu).toBeVisible()
    await menu.getByRole('menuitemcheckbox', { name: 'Revealed', exact: true }).click()
    await expect(menu).toHaveCount(0)
    await expect(primaryStar).toHaveAttribute('aria-description', /Configured visibility: Revealed/)
    await expect(page.getByRole('region', { name: 'Object inspector', exact: true })).toHaveCount(0)
  })
}

test('compact Inspector keeps all four visibility controls comfortably tappable', async ({ page }, testInfo) => {
  await createSingleSystemWorkspace(page, { viewport: { width: 390, height: 844 } })
  const details = await openChartDetails(page)
  const controls = details.getByRole('group', { name: 'Configured visibility', exact: true })
  await expect(controls).toBeVisible()

  for (const mode of modes) {
    const button = controls.getByRole('button', { name: `Set visibility to ${mode}`, exact: true })
    const bounds = await button.boundingBox()
    expect(bounds, `${mode} control should be visible at 390px`).not.toBeNull()
    expect(bounds!.width, `${mode} touch target width`).toBeGreaterThanOrEqual(36)
    expect(bounds!.height, `${mode} touch target height`).toBeGreaterThanOrEqual(36)
  }

  await setVisibility(controls, 'Revealed')
  await page.mouse.move(100, 30)
  const screenshot = testInfo.outputPath('quick-publication-compact.png')
  await page.screenshot({ path: screenshot, fullPage: true })
  await testInfo.attach('quick-publication-compact', { path: screenshot, contentType: 'image/png' })
})

test('quick visibility resolves real object drafts and survives a reload without revealing its parent', async ({ page }) => {
  await captureMapExportBlobs(page)
  await createSingleSystemWorkspace(page)
  const hierarchy = await openWorkspaceHierarchy(page)
  await hierarchy.getByRole('treeitem', { name: 'Select A, Primary Star', exact: true }).click()
  const controls = page.getByRole('region', { name: 'Configured visibility', exact: true })
  const name = page.getByLabel('Name', { exact: true })
  const guard = page.getByRole('dialog', { name: 'Edit chart details', exact: true })

  await editMapObject(page)
  await name.fill('Unapplied star name')
  await controls.getByRole('button', { name: 'Set visibility to Revealed', exact: true }).click()
  await guard.getByRole('button', { name: 'Stay here', exact: true }).click()
  await expect(guard).toBeHidden()
  await expect(name).toHaveValue('Unapplied star name')
  await expect(controls.getByRole('button', { name: 'Set visibility to Known type', exact: true }))
    .toHaveAttribute('aria-pressed', 'true')

  await controls.getByRole('button', { name: 'Set visibility to Revealed', exact: true }).click()
  await guard.getByRole('button', { name: 'Discard edits and continue', exact: true }).click()
  await expect(guard).toBeHidden()
  await expect(name).toHaveValue('Primary Star')
  await expect(controls.getByRole('button', { name: 'Set visibility to Revealed', exact: true }))
    .toHaveAttribute('aria-pressed', 'true')

  await editMapObject(page)
  await name.fill('Published setting, private star name')
  await controls.getByRole('button', { name: 'Set visibility to Hidden', exact: true }).click()
  await guard.getByRole('button', { name: 'Apply and continue', exact: true }).click()
  await expect(guard).toBeHidden()
  await expect(name).toHaveValue('Published setting, private star name')
  await expect(controls.getByRole('button', { name: 'Set visibility to Hidden', exact: true }))
    .toHaveAttribute('aria-pressed', 'true')
  await waitForWorkspaceSaved(page)

  const before = await downloadJson(page, 'Export star system JSON')
  expect(before.system?.publication).toBe('known-type')
  expect(before.system?.objects[0]).toMatchObject({
    name: 'Published setting, private star name', publication: 'hidden',
  })
  await page.reload()
  const reopenedHierarchy = await openWorkspaceHierarchy(page)
  await reopenedHierarchy.getByRole('treeitem', {
    name: 'Select A, Published setting, private star name', exact: true,
  }).click()
  await expect(page.getByRole('region', { name: 'Configured visibility', exact: true })
    .getByRole('button', { name: 'Set visibility to Hidden', exact: true }))
    .toHaveAttribute('aria-pressed', 'true')
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(before)
})

test('map keyboard publication restores focus to the surviving marker without selecting it', async ({ page }) => {
  await createSingleSystemWorkspace(page)
  const mark = page.locator('.system-object[data-object-id]').first()
  await mark.focus()
  await page.keyboard.press('Shift+F10')
  const menu = page.getByRole('menu', { name: 'Player visibility', exact: true })
  await expect(menu).toBeVisible()
  await menu.getByRole('menuitemcheckbox', { name: 'Revealed', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(menu).toHaveCount(0)
  await expect(mark.locator('desc.gm-publication-description')).toContainText('Configured visibility: Revealed')
  await expect(mark).toBeFocused()
  await expect(page.locator('.system-object.is-selected')).toHaveCount(0)
})

test('visibility buttons fit the minimum Inspector width for systems and objects', async ({ page }, testInfo) => {
  await createSingleSystemWorkspace(page)
  await openChartDetails(page)
  const panel = page.getByRole('complementary', { name: 'Object inspector', exact: true })
  const resize = panel.getByRole('separator', { name: 'Resize object inspector panel', exact: true })
  await resize.focus()
  await page.keyboard.press('Home')
  await expect(resize).toHaveAttribute('aria-valuenow', '220')

  async function expectButtonsContained(): Promise<void> {
    const controls = panel.getByRole('region', { name: 'Configured visibility', exact: true })
    const bounds = await controls.boundingBox()
    expect(bounds).not.toBeNull()
    for (const mode of modes) {
      const button = await controls.getByRole('button', { name: `Set visibility to ${mode}`, exact: true }).boundingBox()
      expect(button).not.toBeNull()
      expect(button!.width).toBeGreaterThanOrEqual(36)
      expect(button!.x).toBeGreaterThanOrEqual(bounds!.x - 1)
      expect(button!.x + button!.width).toBeLessThanOrEqual(bounds!.x + bounds!.width + 1)
    }
  }

  await expectButtonsContained()
  const hierarchy = await openWorkspaceHierarchy(page)
  await hierarchy.getByRole('treeitem', { name: 'Select A, Primary Star', exact: true }).click()
  await expectButtonsContained()
  const screenshot = testInfo.outputPath('quick-publication-minimum-inspector.png')
  await panel.screenshot({ path: screenshot })
  await testInfo.attach('quick-publication-minimum-inspector', { path: screenshot, contentType: 'image/png' })
})
