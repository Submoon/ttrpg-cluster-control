import { expect, test, type Page } from './fixtures'
import { activeWorkspaceFeedback, openWorkspaceZoomNavigation, setWorkspaceMapMode, workspaceNavigation } from './helpers'

async function createWorkspace(page: Page, viewport = { width: 1440, height: 960 }): Promise<void> {
  await page.setViewportSize(viewport)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Give the unknown a name.' })).toBeVisible({ timeout: 30_000 })
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()
}

async function expectCompactPanel(
  page: Page,
  activePanel: 'hierarchy' | 'inspector',
): Promise<void> {
  const active = page.locator(`#workspace-${activePanel}-panel`)
  const inactivePanel = activePanel === 'hierarchy' ? 'inspector' : 'hierarchy'
  const inactive = page.locator(`#workspace-${inactivePanel}-panel`)

  await expect(active).toBeVisible()
  await expect(active).toHaveAttribute('role', 'dialog')
  await expect(active).toHaveAttribute('aria-modal', 'true')
  await expect(inactive).toBeHidden()
  await expect(page.getByRole('dialog')).toHaveCount(1)
  await expect(workspaceNavigation(page)).toBeHidden()
  await expect(page.getByRole('slider', { name: 'Map zoom level' })).toBeHidden()
  await expect(page.getByRole('toolbar', { name: 'Map navigation' })).toHaveCount(0)

  const bounds = await active.boundingBox()
  if (!bounds) throw new Error(`The compact ${activePanel} panel has no visible bounds.`)
  expect(bounds.x).toBeLessThanOrEqual(12)
  expect(bounds.y).toBeLessThan(120)
  expect(bounds.x + bounds.width).toBeGreaterThanOrEqual(832)
  expect(bounds.y + bounds.height).toBeGreaterThanOrEqual(374)
  expect(bounds.height).toBeGreaterThan(200)
}

test('desktop panels remain independent and the portaled Map files menu stays hit-testable @ui-smoke', async ({ page }) => {
  await createWorkspace(page)

  const hierarchy = page.locator('#workspace-hierarchy-panel')
  const inspector = page.locator('#workspace-inspector-panel')
  const hierarchyToggle = page.getByRole('button', { name: 'Hierarchy', exact: true })
  const inspectorToggle = page.getByRole('button', { name: 'Inspect', exact: true })
  await expect(hierarchy).toBeHidden()
  await expect(inspector).toBeVisible()

  await hierarchyToggle.click()
  await expect(hierarchy).toBeVisible()
  await expect(inspector).toBeVisible()
  await hierarchyToggle.click()
  await expect(hierarchy).toBeHidden()
  await expect(inspector).toBeVisible()
  await expect(hierarchyToggle).toHaveAttribute('aria-expanded', 'false')
  await hierarchyToggle.click()
  await expect(hierarchy).toBeVisible()
  await expect(inspector).toBeVisible()

  await inspectorToggle.click()
  await expect(inspector).toBeHidden()
  await expect(hierarchy).toBeVisible()
  await expect(inspectorToggle).toHaveAttribute('aria-expanded', 'false')
  await inspectorToggle.click()
  await expect(hierarchy).toBeVisible()
  await expect(inspector).toBeVisible()

  const filesToggle = page.getByRole('button', { name: 'Map files', exact: true })
  await filesToggle.click()
  const files = page.getByRole('group', { name: 'Map file actions for star system Vesper' })
  const exportButton = files.getByRole('button', { name: 'Export star system JSON' })
  await expect(files).toBeVisible()
  await expect(exportButton).toBeVisible()
  expect(await files.evaluate(element => element.closest('.workspace-header') === null)).toBe(true)
  expect(await exportButton.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    const hit = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2)
    return hit === element || element.contains(hit)
  })).toBe(true)

  const downloadPromise = page.waitForEvent('download')
  await exportButton.click()
  await downloadPromise
})

test('short landscape Header, Select, and Hierarchy entries open one exclusive fullscreen panel and return focus @ui-smoke', async ({ page }) => {
  await createWorkspace(page, { width: 844, height: 390 })

  const dock = workspaceNavigation(page)
  const hierarchyToggle = page.getByRole('button', { name: 'Hierarchy', exact: true })
  const inspectorToggle = page.getByRole('button', { name: 'Inspect', exact: true })
  const inspector = page.locator('#workspace-inspector-panel')
  const hierarchy = page.locator('#workspace-hierarchy-panel')
  await expect(dock).toBeVisible()
  await expect((await openWorkspaceZoomNavigation(page)).getByRole('slider', { name: 'Map zoom level' })).toBeVisible()

  await expect(inspector).toBeHidden()
  await expect(hierarchy).toBeHidden()
  await expect(inspectorToggle).toHaveAttribute('aria-expanded', 'false')
  await expect(hierarchyToggle).toHaveAttribute('aria-expanded', 'false')

  await inspectorToggle.click()
  await expectCompactPanel(page, 'inspector')
  await page.getByRole('button', { name: 'Close inspector panel' }).click()
  await expect(inspector).toBeHidden()
  await expect(inspectorToggle).toBeFocused()
  await expect(dock).toBeVisible()

  const selectMode = dock.getByRole('button', { name: 'Select', exact: true })
  await selectMode.click()
  await expect(selectMode).toHaveAttribute('aria-pressed', 'true')
  const map = page.getByRole('group', { name: 'Vesper star system map' })
  const primaryStar = map.getByRole('button', { name: /Select A, Primary Star/ })
  await primaryStar.focus()
  await page.keyboard.press('Enter')
  await expectCompactPanel(page, 'inspector')
  await page.getByRole('button', { name: 'Hide inspector', exact: true }).click()
  await expect(primaryStar).toBeFocused()
  await expect(selectMode).toHaveAttribute('aria-pressed', 'true')

  await hierarchyToggle.click()
  await expectCompactPanel(page, 'hierarchy')
  await page.getByRole('button', { name: 'Close hierarchy panel' }).click()
  await expect(hierarchy).toBeHidden()
  await expect(hierarchyToggle).toBeFocused()
  await expect(dock).toBeVisible()

  await hierarchyToggle.click()
  await expectCompactPanel(page, 'hierarchy')
  await hierarchy.getByRole('treeitem', { name: 'Select A, Primary Star' }).click()
  await expectCompactPanel(page, 'inspector')
})

test('touch long press keeps focus inside the compact inspector after the touch is released', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await createWorkspace(page, { width: 390, height: 844 })
  await page.getByRole('button', { name: 'Back to Jump Cluster', exact: true }).click()

  const filesToggle = page.getByRole('button', { name: 'Map files', exact: true })
  await filesToggle.click()
  await page.keyboard.press('Escape')
  await expect(filesToggle).toBeFocused()

  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await setWorkspaceMapMode(page, 'Navigate')
  const system = clusterMap.getByRole('button', { name: 'Open Vesper system map' })
  const bounds = await system.boundingBox()
  if (!bounds) throw new Error('The system long-press target has no visible bounds.')
  const touchPoint = { id: 1, x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
  const cdp = await page.context().newCDPSession(page)

  try {
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 })
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ ...touchPoint, radiusX: 2, radiusY: 2, force: 1 }],
    })

    const inspector = page.locator('#workspace-inspector-panel')
    const closeInspector = page.getByRole('button', { name: 'Close inspector panel' })
    await expect(inspector).toBeVisible()
    await expect(inspector).toHaveAttribute('role', 'dialog')
    await expect(inspector).toHaveAttribute('aria-modal', 'true')
    await expect(page.getByRole('dialog')).toHaveCount(1)
    await expect(page.locator('#workspace-hierarchy-panel')).toBeHidden()
    await expect(workspaceNavigation(page)).toBeHidden()
    await expect(inspector.getByRole('heading', { name: 'Vesper', exact: true })).toBeVisible()
    await expect(closeInspector).toBeFocused()

    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect.poll(async () => page.evaluate(() => {
      const active = document.activeElement
      const layout = document.querySelector('.map-editor-layout')
      const panel = document.querySelector('#workspace-inspector-panel')
      return {
        tag: active?.tagName,
        id: active?.id,
        className: active instanceof HTMLElement ? active.className : '',
        isLayoutRoot: active === layout,
        insideLayout: !!active && !!layout?.contains(active),
        insidePanel: !!active && !!panel?.contains(active),
      }
    }), { message: 'Touch release must leave focus inside the active inspector panel.' })
      .toMatchObject({ insidePanel: true })
    await expect(closeInspector).toBeFocused()
  } finally {
    await cdp.detach()
  }
})

test('desktop-to-compact reflow retains an invalid chart-name draft and the active map mode', async ({ page }) => {
  await createWorkspace(page)

  const dock = workspaceNavigation(page)
  const moveMode = dock.getByRole('button', { name: 'Move', exact: true })
  await moveMode.click()
  await expect(moveMode).toHaveAttribute('aria-pressed', 'true')

  const hierarchy = page.locator('#workspace-hierarchy-panel')
  await page.getByRole('button', { name: 'Hierarchy', exact: true }).click()
  await hierarchy.getByRole('button', { name: 'Edit chart names' }).click()
  const chartDialog = page.getByRole('dialog', { name: 'Edit chart names' })
  await chartDialog.getByLabel('Jump Cluster').fill('')
  await chartDialog.getByLabel('Star system').fill('Draft Vesper')
  await chartDialog.getByRole('button', { name: 'Apply names' }).click()
  await expect(chartDialog.getByRole('alert')).toHaveText('Jump Cluster name is required.')
  await page.keyboard.press('Escape')
  await expect(chartDialog).toBeHidden()

  const hierarchyToggle = page.getByRole('button', { name: 'Hierarchy', exact: true })
  const inspectorToggle = page.getByRole('button', { name: 'Inspect', exact: true })
  await hierarchyToggle.click()
  await inspectorToggle.click()
  await expect(page.locator('#workspace-hierarchy-panel')).toBeHidden()
  await expect(page.locator('#workspace-inspector-panel')).toBeHidden()
  await expect(moveMode).toHaveAttribute('aria-pressed', 'true')

  await page.setViewportSize({ width: 844, height: 390 })
  await hierarchyToggle.click()
  await expectCompactPanel(page, 'hierarchy')
  await hierarchy.locator('.workspace-side-panel-content')
    .getByRole('button', { name: 'Resume chart name draft' }).click()
  await expect(chartDialog.getByLabel('Jump Cluster')).toHaveValue('')
  await expect(chartDialog.getByLabel('Star system')).toHaveValue('Draft Vesper')
  await expect(chartDialog.getByRole('alert')).toHaveText('Jump Cluster name is required.')
  await page.keyboard.press('Escape')
  await expect(chartDialog).toBeHidden()

  await page.getByRole('button', { name: 'Close hierarchy panel' }).click()
  await expect(hierarchyToggle).toBeFocused()
  await page.setViewportSize({ width: 1440, height: 960 })
  await expect(workspaceNavigation(page)).toBeVisible()
  await expect(moveMode).toHaveAttribute('aria-pressed', 'true')
  await hierarchyToggle.click()
  await expect(hierarchy).toBeVisible()
  await hierarchy.locator('.workspace-side-panel-content')
    .getByRole('button', { name: 'Resume chart name draft' }).click()
  await expect(chartDialog.getByLabel('Jump Cluster')).toHaveValue('')
  await expect(chartDialog.getByLabel('Star system')).toHaveValue('Draft Vesper')
  await expect(chartDialog.getByRole('alert')).toHaveText('Jump Cluster name is required.')
})

test('a nested chart dialog pauses the compact panel focus trap and returns focus to its opener @ui-smoke', async ({ page }) => {
  await createWorkspace(page, { width: 844, height: 390 })

  const hierarchyToggle = page.getByRole('button', { name: 'Hierarchy', exact: true })
  await hierarchyToggle.click()
  await expectCompactPanel(page, 'hierarchy')
  const hierarchy = page.locator('#workspace-hierarchy-panel')
  const chartNamesControl = hierarchy.locator('.workspace-side-panel-content')
    .getByRole('button', { name: /Edit chart names|Resume chart name draft/ })
  const editNames = hierarchy.getByRole('button', { name: 'Edit chart names' })
  await editNames.click()

  const chartDialog = page.getByRole('dialog', { name: 'Edit chart names' })
  await expect(chartDialog).toBeVisible()
  await expect(chartDialog.getByLabel('Jump Cluster')).toBeFocused()
  for (let index = 0; index < 7; index += 1) {
    await page.keyboard.press('Tab')
    expect(await chartDialog.evaluate(element => element.contains(document.activeElement))).toBe(true)
  }

  await page.keyboard.press('Escape')
  await expect(chartDialog).toBeHidden()
  await expect(hierarchy).toBeVisible()
  await expect(chartNamesControl).toBeFocused()

  await page.getByRole('button', { name: 'Close hierarchy panel' }).click()
  await expect(hierarchyToggle).toBeFocused()
  await expect(workspaceNavigation(page)).toBeVisible()
})
