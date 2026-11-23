import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from './fixtures'
import { activeWorkspaceFeedback, centerWorkspaceSelection, createSingleSystemWorkspace, exposedContinuousObjectHitPoint, type ExportedMap, waitForWorkspaceSaved, openMapFilesSection, openPlayerPreview, openWorkspaceZoomNavigation, setWorkspaceMapMode, wardenMap, wardenObjectMark, workspaceNavigation } from './helpers'

async function createWorkspace(page: Page, viewport = { width: 1440, height: 960 }): Promise<void> {
  await page.setViewportSize(viewport)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Give the unknown a name.' })).toBeVisible({ timeout: 30_000 })
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await waitForWorkspaceSaved(page)
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

test('desktop panels start open and Map files exports the inspected system and whole Jump Cluster @ui-smoke', async ({ page }) => {
  await createWorkspace(page)

  const hierarchy = page.locator('#workspace-hierarchy-panel')
  const inspector = page.locator('#workspace-inspector-panel')
  await expect(hierarchy).toBeVisible()
  await expect(inspector).toBeVisible()
  await hierarchy.getByRole('treeitem', { name: 'Vesper', exact: true }).click()
  await expect(inspector).toHaveAccessibleName('Star System details')
  await expect(wardenMap(page)).toHaveAccessibleName('Kestrel Reach continuous map')
  await expect(page.getByRole('region', { name: 'Current Jump Cluster', exact: true })
    .getByRole('heading', { name: 'Kestrel Reach', exact: true })).toHaveCount(1)
  const toolbar = page.getByRole('navigation', { name: 'Map context and commands', exact: true })
  await expect(toolbar).not.toContainText('Kestrel Reach')
  const toolbarWidth = await toolbar.evaluate((element) => {
    const actions = element.querySelector('.workspace-map-actions')
    return actions ? element.getBoundingClientRect().width - actions.getBoundingClientRect().width : Infinity
  })
  expect(toolbarWidth).toBeLessThan(32)

  const filesToggle = page.getByRole('button', { name: 'Map files', exact: true })
  const filesHint = page.getByRole('tooltip', { name: 'Map files', exact: true })
  await expect(filesToggle).toHaveText('')
  await filesToggle.hover()
  await expect(filesHint).toBeVisible()
  await page.mouse.move(0, 0)
  await expect(filesHint).toBeHidden()
  await page.getByRole('button', { name: 'Inspect', exact: true }).focus()
  await page.keyboard.press('Tab')
  await expect(filesToggle).toBeFocused()
  await expect(filesHint).toBeVisible()

  const toolbarButtons = toolbar.getByRole('button')
  const toolbarPositions = () => toolbarButtons.evaluateAll(buttons => buttons.map((button) => {
    const { x, y, width, height } = button.getBoundingClientRect()
    return { x, y, width, height }
  }))
  const closedPositions = await toolbarPositions()
  await filesToggle.click()
  await expect(filesToggle).toHaveAttribute('aria-expanded', 'true')
  await expect.poll(toolbarPositions).toEqual(closedPositions)
  await page.keyboard.press('Escape')
  await expect(filesToggle).toHaveAttribute('aria-expanded', 'false')
  await expect.poll(toolbarPositions).toEqual(closedPositions)

  const files = await openMapFilesSection(page, 'Download or back up')
  const exportButton = files.getByRole('menuitem', { name: 'Download private Star System JSON', exact: true })
  const clusterExportButton = files.getByRole('menuitem', { name: 'Download private Jump Cluster JSON', exact: true })
  await expect(exportButton).toBeVisible()
  await expect(clusterExportButton).toBeVisible()
  expect(await files.evaluate(element => element.closest('.workspace-header') === null)).toBe(true)
  expect(await exportButton.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    const hit = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2)
    return hit === element || element.contains(hit)
  })).toBe(true)

  const downloadPromise = page.waitForEvent('download')
  await exportButton.click()
  const systemDownload = await downloadPromise
  const systemExport = JSON.parse(await readFile(await systemDownload.path(), 'utf8')) as ExportedMap
  expect(systemExport.type).toBe('system')
  expect(systemExport.system?.name).toBe('Vesper')

  const clusterFiles = await openMapFilesSection(page, 'Download or back up')
  const clusterBackupButton = clusterFiles.getByRole('menuitem', { name: 'Download private Jump Cluster JSON', exact: true })
  const clusterDownloadPromise = page.waitForEvent('download')
  await clusterBackupButton.click()
  const clusterDownload = await clusterDownloadPromise
  const clusterExport = JSON.parse(await readFile(await clusterDownload.path(), 'utf8')) as ExportedMap
  expect(clusterExport.type).toBe('cluster')
  expect(clusterExport.cluster?.name).toBe('Kestrel Reach')
  expect(clusterExport.cluster?.systems.map(system => system.name)).toEqual(['Vesper'])
  expect(clusterExport.cluster?.systems[0]?.id).toBe(systemExport.system?.id)

  const restore = await openMapFilesSection(page, 'Import or restore')
  const restoreJson = restore.getByRole('menuitem', { name: 'Restore Jump Cluster from JSON', exact: true })
  await restoreJson.hover()
  await expect(restoreJson).toBeFocused()
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), restoreJson.click()])
  await chooser.setFiles([])
  await expect(filesToggle).toHaveAttribute('aria-expanded', 'false')
})

test('short landscape Header, Select, and Hierarchy entries open one exclusive fullscreen panel and return focus @ui-smoke', async ({ page }) => {
  const clusterName = 'Vesper Observatory and the Outer Beacon of the Meridian Expanse'
  const { systemId, primaryObjectId, systemName } = await createSingleSystemWorkspace(page, {
    clusterName,
    viewport: { width: 390, height: 844 },
  })

  const toolbar = page.getByRole('navigation', { name: 'Map context and commands', exact: true })
  await expect(toolbar).not.toContainText(clusterName)
  const header = page.locator('header.workspace-header')
  const menuButton = header.getByRole('button', { name: 'Open workspace menu', exact: true })
  const menu = page.getByRole('dialog', { name: 'Workspace menu', exact: true })
  await expect(header.getByText('TTRPG Cluster Control', { exact: true })).toBeVisible()
  await expect(header.getByText(clusterName, { exact: true })).toBeHidden()
  await expect(header.getByRole('button', { name: 'Help', exact: true })).toHaveCount(0)
  await expect(toolbar.getByRole('heading', { name: clusterName, exact: true })).toHaveCount(0)
  await menuButton.press('Enter')
  await expect(menu.getByText(clusterName, { exact: true })).toBeInViewport({ ratio: 1 })
  await expect(menu.getByRole('link', { name: /Privacy policy/i })).toHaveAttribute('href', '/privacy')
  const theme = menu.getByRole('button', { name: /Switch to (light|dark) mode/ })
  const themeBefore = await theme.getAttribute('aria-label')
  await theme.click()
  await expect(theme).not.toHaveAttribute('aria-label', themeBefore!)
  const fieldsAction = menu.getByRole('button', { name: 'Open field definitions', exact: true })
  await fieldsAction.click()
  const fields = page.getByRole('dialog', { name: 'Field definitions', exact: true })
  await expect(fields).toBeVisible()
  await fields.getByRole('button', { name: 'Close field definitions', exact: true }).click()
  await expect(fields).toBeHidden()
  await expect(menu).toBeHidden()
  await expect(menuButton).toBeFocused()
  await menuButton.press('Enter')
  const help = menu.getByRole('button', { name: 'Help', exact: true })
  await help.click()
  const guide = page.getByRole('dialog', { name: 'Map editor help', exact: true })
  await expect(guide).toBeVisible()
  await guide.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(guide).toBeHidden()
  await expect(menu).toBeHidden()
  await expect(menuButton).toBeFocused()
  await menuButton.press('Enter')
  await expect(menu).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
  await expect(menuButton).toBeFocused()
  await expect(toolbar).toBeInViewport({ ratio: 1 })
  await expect(toolbar.getByRole('button', { name: 'Map files', exact: true })).toBeInViewport({ ratio: 1 })

  await page.setViewportSize({ width: 844, height: 390 })

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
  await centerWorkspaceSelection(page)
  const primaryStar = wardenObjectMark(page, systemId, primaryObjectId)
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
  await hierarchy.getByRole('treeitem', { name: `Select A, Primary Star in ${systemName}`, exact: true }).click()
  await expectCompactPanel(page, 'inspector')
  const manageFields = inspector.getByRole('button', { name: 'Manage field definitions', exact: true })
  await manageFields.click()
  await expect(fields).toBeVisible()
  await fields.getByRole('button', { name: 'Close field definitions', exact: true }).click()
  await expect(fields).toBeHidden()
  await expect(manageFields).toBeFocused()
})

test('the default compact Warden map consumes a held selection and keeps inspector focus on a fresh tap', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  const { systemId, primaryObjectId } = await createSingleSystemWorkspace(page, {
    viewport: { width: 390, height: 844 },
  })
  const map = wardenMap(page)
  const object = wardenObjectMark(page, systemId, primaryObjectId)
  const inspector = page.locator('#workspace-inspector-panel')
  const closeInspector = inspector.getByRole('button', { name: 'Hide inspector', exact: true })
  const files = page.getByRole('button', { name: 'Map files', exact: true })
  await files.click()
  await page.keyboard.press('Escape')
  await expect(files).toBeFocused()

  const cdp = await page.context().newCDPSession(page)
  try {
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 })
    const mapPoint = await map.evaluate(element => {
      const bounds = element.getBoundingClientRect()
      for (const x of [.2, .5, .8]) {
        for (const y of [.3, .5, .7]) {
          const point = { x: bounds.left + bounds.width * x, y: bounds.top + bounds.height * y }
          if (document.elementFromPoint(point.x, point.y) === element) return point
        }
      }
      return null
    })
    if (!mapPoint) throw new Error('The compact map has no reachable canvas background for touch pan.')
    const scene = map.locator('.cluster-map-content')
    const viewportBeforePan = await scene.getAttribute('transform')
    if (!viewportBeforePan) throw new Error('The compact map camera must be initialized.')
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart', touchPoints: [{ id: 1, ...mapPoint }],
    })
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove', touchPoints: [{ id: 1, x: mapPoint.x + 24, y: mapPoint.y + 18 }],
    })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect(scene).not.toHaveAttribute('transform', viewportBeforePan)
    await expect(inspector).toBeHidden()

    const pressObject = async () => {
      const point = await exposedContinuousObjectHitPoint(object)
      if (!point) throw new Error('The owner-qualified object must be hittable on the compact map.')
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart', touchPoints: [{ id: 1, ...point, radiusX: 2, radiusY: 2, force: 1 }],
      })
    }
    const releaseObject = () => cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await pressObject()
    await expect(object).toHaveAttribute('aria-pressed', 'true')
    // Keep the activated selection held beyond both compatibility-click suppression timers.
    await page.waitForTimeout(1_200)
    await expect(inspector).toBeHidden()
    await releaseObject()
    await expect(object).toHaveAttribute('aria-pressed', 'true')
    await expect(inspector).toBeHidden()

    await pressObject()
    await expect(object).toHaveAttribute('aria-pressed', 'false')
    await releaseObject()
    await expect(inspector).toBeHidden()

    await pressObject()
    const move = workspaceNavigation(page).getByRole('button', { name: 'Move', exact: true })
    // Activate the real mode control while the original touch is still down.
    await move.evaluate(button => (button as HTMLButtonElement).click())
    await expect(move).toHaveAttribute('aria-pressed', 'true')
    await page.waitForTimeout(1_200)
    await expect(object).toHaveAttribute('aria-pressed', 'false')
    await releaseObject()
    await expect(object).toHaveAttribute('aria-pressed', 'false')
    await expect(inspector).toBeHidden()

    await setWorkspaceMapMode(page, 'Select')
    await pressObject()
    await releaseObject()
    await expect(inspector).toHaveAttribute('aria-modal', 'true')
    await expect(closeInspector).toBeFocused()
    await closeInspector.click()
    const preview = await openPlayerPreview(page)
    await preview.getByRole('button', { name: 'Close player preview', exact: true }).click()
    await expect(files).toBeFocused()
  } finally {
    await cdp.detach()
  }
})

test('inline chart editing stays inside the compact Inspector focus trap @ui-smoke', async ({ page }) => {
  await createWorkspace(page, { width: 844, height: 390 })

  const hierarchyToggle = page.getByRole('button', { name: 'Hierarchy', exact: true })
  await hierarchyToggle.click()
  await expectCompactPanel(page, 'hierarchy')
  const hierarchy = page.locator('#workspace-hierarchy-panel')
  await hierarchy.getByRole('button', { name: 'Open Jump Cluster details', exact: true }).click()
  const inspector = page.locator('#workspace-inspector-panel')
  await expectCompactPanel(page, 'inspector')
  const details = inspector.getByRole('region', { name: 'Jump Cluster details', exact: true })
  await details.getByRole('button', { name: 'Edit Jump Cluster details', exact: true }).click()

  const editor = page.getByRole('form', { name: 'Edit Jump Cluster details', exact: true })
  await expect(editor).toBeVisible()
  await expect(editor.getByLabel('Jump Cluster')).toBeFocused()
  for (let index = 0; index < 7; index += 1) {
    await page.keyboard.press('Tab')
    expect(await inspector.evaluate(element => element.contains(document.activeElement))).toBe(true)
  }
  await editor.getByLabel('Jump Cluster').fill('Compact draft reach')

  await page.getByRole('button', { name: 'Close inspector panel', exact: true }).click()
  await expect(inspector).toBeHidden()
  await expect(hierarchyToggle).toBeFocused()
  await expect(editor).toBeHidden()
  const resumeDraft = activeWorkspaceFeedback(page).getByRole('button', { name: 'Resume Jump Cluster details draft', exact: true })
  await resumeDraft.click()
  await expectCompactPanel(page, 'inspector')
  await expect(editor.getByLabel('Jump Cluster')).toHaveValue('Compact draft reach')
  await expect(editor.getByLabel('Jump Cluster')).toBeFocused()
  await editor.getByRole('button', { name: 'Discard draft', exact: true }).click()
  await expect(editor).toBeHidden()

  await page.getByRole('button', { name: 'Close inspector panel' }).click()
  await expect(inspector).toBeHidden()
  await expect(page.getByRole('button', { name: 'Inspect', exact: true })).toBeFocused()
  await expect(workspaceNavigation(page)).toBeVisible()
})
