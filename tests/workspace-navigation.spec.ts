import { expect, test, type Page } from '@playwright/test'
import {
  captureMapExportBlobs,
  clickDockAction,
  dragHtmlElementToWorldPoint,
  downloadJson,
  ensureMapDragPointsReachable,
  openWorkspaceHierarchy,
  openWorkspaceZoomNavigation,
  quitSystemAdd,
  workspaceNavigation,
  workspaceZoomControls,
} from './helpers'

async function createWorkspace(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('textbox', { name: 'Jump Cluster' }).fill('Kestrel Reach')
  await page.getByRole('textbox', { name: 'First star system' }).fill('Vesper')
  await expect(page.getByRole('button', { name: 'Back to Jump Cluster' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Hierarchy' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Inspect' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await expect(page.getByRole('toolbar', { name: 'Workspace navigation' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Vesper star system map' })).toBeVisible()
}

test('a fresh compact workspace starts on the map without opening a panel', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 })
  await page.goto('/')
  await page.getByRole('textbox', { name: 'Jump Cluster' }).fill('Kestrel Reach')
  await page.getByRole('textbox', { name: 'First star system' }).fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  await expect(page.getByRole('group', { name: 'Vesper star system map' })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Hierarchy', exact: true })).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByRole('button', { name: 'Inspect', exact: true })).toHaveAttribute('aria-expanded', 'false')
})

test('the Dock and zoom controls expose separate map toolbars', async ({ page }) => {
  await createWorkspace(page)

  const dock = workspaceNavigation(page)
  const zoom = workspaceZoomControls(page)
  await expect(dock).toBeVisible()
  await expect(zoom).toBeVisible()
  await expect(page.getByRole('group', { name: 'Map interaction mode' }).getByRole('button', { name: 'Navigate' })).toHaveAttribute('aria-pressed', 'true')
  await expect(dock.getByRole('button', { name: 'Fit map' })).toHaveCount(0)
  const zoomNavigation = await openWorkspaceZoomNavigation(page)
  await expect(zoomNavigation.getByRole('slider', { name: 'Map zoom level' })).toBeVisible()
  await expect(zoomNavigation.getByRole('button', { name: 'Pan map left' })).toBeVisible()
  await expect(zoomNavigation.getByRole('button', { name: 'Pan map right' })).toBeVisible()
})

test('reselecting the current object or Orbit reopens Inspect without changing the selection', async ({ page }) => {
  await createWorkspace(page)
  const inspectToggle = page.getByRole('button', { name: 'Inspect', exact: true })
  if (await inspectToggle.getAttribute('aria-expanded') === 'true') await inspectToggle.click()
  await page.getByRole('group', { name: 'Map interaction mode' }).getByRole('button', { name: 'Select' }).click()

  const map = page.getByRole('group', { name: 'Vesper star system map' })
  const star = map.getByRole('button', { name: 'Select A, Primary Star (Star)' })
  await star.click()
  await expect(inspectToggle).toHaveAttribute('aria-expanded', 'true')
  await expect(map.locator('.system-object.is-selected')).toHaveCount(1)

  await inspectToggle.click()
  await expect(inspectToggle).toHaveAttribute('aria-expanded', 'false')
  await star.click()
  await expect(inspectToggle).toHaveAttribute('aria-expanded', 'true')
  await expect(map.locator('.system-object.is-selected')).toHaveCount(1)

  await inspectToggle.click()
  await clickDockAction(page, 'Add orbit', {
    target: { kind: 'host', name: 'Primary Star' },
    noSelection: true,
  })
  const hierarchyToggle = page.getByRole('button', { name: 'Hierarchy', exact: true })
  if (await hierarchyToggle.getAttribute('aria-expanded') !== 'true') await hierarchyToggle.click()
  const hierarchy = await openWorkspaceHierarchy(page)
  const orbit = hierarchy.getByRole('button', { name: /Orbit 1 around Primary Star/ })
  await orbit.click()
  await expect(inspectToggle).toHaveAttribute('aria-expanded', 'true')
  await expect(hierarchy.getByRole('button', { name: /Orbit 1 around Primary Star/ })).toHaveAttribute('aria-current', 'true')

  await inspectToggle.click()
  await expect(inspectToggle).toHaveAttribute('aria-expanded', 'false')
  await orbit.click()
  await expect(inspectToggle).toHaveAttribute('aria-expanded', 'true')
  await expect(hierarchy.getByRole('button', { name: /Orbit 1 around Primary Star/ })).toHaveAttribute('aria-current', 'true')
})

test('Navigate opens a system while Select keeps the cluster map active and inspects system data', async ({ page }) => {
  await createWorkspace(page)
  await page.getByRole('button', { name: 'Back to Jump Cluster' }).click()

  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await clusterMap.getByRole('button', { name: 'Open Vesper system map' }).click()
  await expect(page.getByRole('group', { name: 'Vesper star system map' })).toBeVisible()
  await expect(clusterMap).toHaveCount(0)

  await page.getByRole('button', { name: 'Back to Jump Cluster' }).click()
  const selectMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await page.getByRole('group', { name: 'Map interaction mode' }).getByRole('button', { name: 'Select' }).click()
  await selectMap.getByRole('button', { name: 'Select Vesper system' }).click()

  await expect(selectMap).toBeVisible()
  await expect(page.locator('#workspace-inspector-panel').getByRole('heading', { name: 'Vesper', exact: true })).toBeVisible()
})

test('Navigate and Select drags pan a system node without opening or selecting it', async ({ page }) => {
  await createWorkspace(page)
  await page.getByRole('button', { name: 'Back to Jump Cluster' }).click()

  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  const scene = page.locator('.cluster-map-svg .cluster-map-content')
  const inspectorToggle = page.getByRole('button', { name: 'Inspect', exact: true })
  if (await inspectorToggle.getAttribute('aria-expanded') === 'true') await inspectorToggle.click()
  for (const mode of ['Navigate', 'Select'] as const) {
    await page.getByRole('group', { name: 'Map interaction mode' }).getByRole('button', { name: mode }).click()
    const entity = clusterMap.getByRole('button', {
      name: mode === 'Navigate' ? 'Open Vesper system map' : 'Select Vesper system',
    })
    const bounds = await entity.boundingBox()
    expect(bounds).not.toBeNull()
    const originalViewport = await scene.getAttribute('transform')
    const startX = bounds!.x + bounds!.width / 2
    const startY = bounds!.y + bounds!.height / 2
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(startX + 70, startY + 35, { steps: 5 })
    await page.mouse.up()

    await expect.poll(() => scene.getAttribute('transform')).not.toBe(originalViewport)
    await expect(clusterMap).toBeVisible()
    await expect(page.getByRole('group', { name: 'Vesper star system map' })).toHaveCount(0)
    await expect(inspectorToggle).toHaveAttribute('aria-expanded', 'false')
    if (mode === 'Select') await expect(clusterMap.locator('.cluster-system-node.is-selected')).toHaveCount(0)
  }
})

test('right-click keeps the native context menu while right-drag pans in every mode', async ({ page }) => {
  await createWorkspace(page)
  await page.getByRole('button', { name: 'Back to Jump Cluster' }).click()
  const inspectorToggle = page.getByRole('button', { name: 'Inspect', exact: true })
  if (await inspectorToggle.getAttribute('aria-expanded') === 'true') await inspectorToggle.click()

  await page.evaluate(() => {
    const testWindow = window as typeof window & {
      __contextMenuProbe?: { count: number; prevented: boolean | null }
    }
    testWindow.__contextMenuProbe = { count: 0, prevented: null }
    window.addEventListener('contextmenu', (event) => {
      const probe = testWindow.__contextMenuProbe!
      probe.count += 1
      setTimeout(() => { probe.prevented = event.defaultPrevented }, 0)
    }, true)
  })

  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  const scene = page.locator('.cluster-map-svg .cluster-map-content')
  for (const mode of ['Navigate', 'Select', 'Move'] as const) {
    await page.getByRole('group', { name: 'Map interaction mode' }).getByRole('button', { name: mode }).click()
    await page.getByRole('button', { name: 'Fit map' }).click()
    const entity = clusterMap.getByRole('button', {
      name: mode === 'Navigate' ? 'Open Vesper system map' : 'Select Vesper system',
    })
    const bounds = await entity.boundingBox()
    expect(bounds).not.toBeNull()
    const startX = bounds!.x + bounds!.width / 2
    const startY = bounds!.y + bounds!.height / 2
    const contextCount = await page.evaluate(() => {
      const testWindow = window as typeof window & { __contextMenuProbe?: { count: number } }
      return testWindow.__contextMenuProbe!.count
    })
    await page.mouse.click(startX, startY, { button: 'right' })
    await expect.poll(() => page.evaluate(() => {
      const testWindow = window as typeof window & { __contextMenuProbe?: { count: number } }
      return testWindow.__contextMenuProbe!.count
    })).toBe(contextCount + 1)
    await expect.poll(() => page.evaluate(() => {
      const testWindow = window as typeof window & { __contextMenuProbe?: { prevented: boolean | null } }
      return testWindow.__contextMenuProbe!.prevented
    })).toBe(false)

    const originalViewport = await scene.getAttribute('transform')
    await page.mouse.move(startX, startY)
    await page.mouse.down({ button: 'right' })
    await page.mouse.move(startX + 75, startY + 32, { steps: 5 })
    await page.mouse.up({ button: 'right' })
    await expect.poll(() => scene.getAttribute('transform')).not.toBe(originalViewport)
    await expect(clusterMap).toBeVisible()
    await expect(page.getByRole('group', { name: 'Vesper star system map' })).toHaveCount(0)
    await expect(inspectorToggle).toHaveAttribute('aria-expanded', 'false')
    if (mode !== 'Navigate') await expect(clusterMap.locator('.cluster-system-node.is-selected')).toHaveCount(0)
  }

  // A fresh left-pointer sequence must not be consumed by suppression from the prior right-drag.
  await clusterMap.getByRole('button', { name: 'Select Vesper system' }).click()
  await expect(clusterMap.locator('.cluster-system-node.is-selected')).toHaveCount(1)
  await expect(page.getByRole('group', { name: 'Vesper star system map' })).toHaveCount(0)
  await expect(inspectorToggle).toHaveAttribute('aria-expanded', 'false')
})

test('A to B to A restores each system camera and the selected map object', async ({ page }) => {
  await createWorkspace(page)
  const starLabel = 'Select A, Primary Star (Star)'
  const hierarchyStarLabel = 'Select A, Primary Star'
  await page.getByRole('group', { name: 'Map interaction mode' }).getByRole('button', { name: 'Select' }).click()
  await page.getByRole('group', { name: 'Vesper star system map' }).getByRole('button', { name: starLabel }).click()
  const firstHierarchy = await openWorkspaceHierarchy(page)
  const firstStar = firstHierarchy.getByRole('button', { name: hierarchyStarLabel })
  await expect(firstStar).toHaveAttribute('aria-current', 'true')
  await page.getByRole('button', { name: 'Hierarchy', exact: true }).click()

  const scene = page.locator('.system-map-svg .system-map-content')
  await (await openWorkspaceZoomNavigation(page)).getByRole('button', { name: 'Pan map right' }).click()
  await expect.poll(() => scene.getAttribute('transform')).not.toBe('translate(0,0) scale(1)')
  const firstSystemViewport = await scene.getAttribute('transform')

  await page.getByRole('button', { name: 'Back to Jump Cluster' }).click()
  await page.getByRole('button', { name: 'Add to map' }).click()
  await page.getByRole('button', { name: 'Add star system' }).click()
  await expect(page.getByRole('group', { name: 'New System 2 star system map' })).toBeVisible()
  await page.getByRole('group', { name: 'Map interaction mode' }).getByRole('button', { name: 'Select' }).click()
  await page.getByRole('group', { name: 'New System 2 star system map' }).getByRole('button', { name: starLabel }).click()

  const secondSystemScene = page.locator('.system-map-svg .system-map-content')
  await (await openWorkspaceZoomNavigation(page)).getByRole('button', { name: 'Pan map left' }).click()
  const secondSystemViewport = await secondSystemScene.getAttribute('transform')
  expect(secondSystemViewport).not.toBe(firstSystemViewport)

  await page.getByRole('button', { name: 'Back to Jump Cluster' }).click()
  await page.getByRole('group', { name: 'Map interaction mode' }).getByRole('button', { name: 'Navigate' }).click()
  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await clusterMap.getByRole('button', { name: 'Open Vesper system map' }).click()
  await expect(page.getByRole('group', { name: 'Vesper star system map' })).toBeVisible()
  const restoredFirstHierarchy = await openWorkspaceHierarchy(page)
  await expect(restoredFirstHierarchy.getByRole('button', { name: hierarchyStarLabel })).toHaveAttribute('aria-current', 'true')
  await page.getByRole('button', { name: 'Hierarchy', exact: true }).click()
  await expect(page.locator('.system-map-svg .system-map-content')).toHaveAttribute('transform', firstSystemViewport!)

  await page.getByRole('button', { name: 'Back to Jump Cluster' }).click()
  const clusterMapAfterReturn = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await page.getByRole('button', { name: 'Fit map' }).click()
  await clusterMapAfterReturn.getByRole('button', { name: 'Open New System 2 system map' }).click()
  await expect(page.getByRole('group', { name: 'New System 2 star system map' })).toBeVisible()
  const restoredSecondHierarchy = await openWorkspaceHierarchy(page)
  await expect(restoredSecondHierarchy.getByRole('button', { name: hierarchyStarLabel })).toHaveAttribute('aria-current', 'true')
  await expect(page.locator('.system-map-svg .system-map-content')).toHaveAttribute('transform', secondSystemViewport!)
})

test('deleting the inspected cluster system clears its current selection', async ({ page }) => {
  await createWorkspace(page)
  await page.getByRole('button', { name: 'Back to Jump Cluster' }).click()
  await page.getByRole('button', { name: 'Add to map' }).click()
  await page.getByRole('button', { name: 'Add star system' }).click()
  await expect(page.getByRole('group', { name: 'New System 2 star system map' })).toBeVisible()
  await page.getByRole('button', { name: 'Back to Jump Cluster' }).click()
  await page.getByRole('group', { name: 'Map interaction mode' }).getByRole('button', { name: 'Select' }).click()
  await page.getByRole('button', { name: 'Fit map' }).click()

  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await clusterMap.getByRole('button', { name: 'Select New System 2 system' }).click()
  const inspector = page.getByRole('complementary', { name: 'Jump Route inspector' })
  await expect(inspector.getByRole('heading', { name: 'New System 2' })).toBeVisible()

  const hierarchyToggle = page.getByRole('button', { name: 'Hierarchy', exact: true })
  if (await hierarchyToggle.getAttribute('aria-expanded') !== 'true') await hierarchyToggle.click()
  const hierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  const deleteSystem = hierarchy.getByRole('button', { name: 'Delete New System 2 system' })
  page.once('dialog', async dialog => { await dialog.accept() })
  await deleteSystem.click()

  await expect(deleteSystem).toHaveCount(0)
  await expect(clusterMap.locator('.cluster-system-node.is-selected')).toHaveCount(0)
  await expect(inspector).not.toContainText('New System 2')
  await expect(page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })).toBeVisible()
})

test('Select can rename system B from its inspector while keeping system A active', async ({ page }) => {
  await captureMapExportBlobs(page)
  await createWorkspace(page)
  await page.getByRole('button', { name: 'Back to Jump Cluster' }).click()
  await page.getByRole('button', { name: 'Add to map' }).click()
  await page.getByRole('button', { name: 'Add star system' }).click()
  await expect(page.getByRole('group', { name: 'New System 2 star system map' })).toBeVisible()
  await page.getByRole('button', { name: 'Back to Jump Cluster' }).click()

  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await clusterMap.getByRole('button', { name: 'Open Vesper system map' }).click()
  await expect(page.getByRole('group', { name: 'Vesper star system map' })).toBeVisible()
  await page.getByRole('button', { name: 'Back to Jump Cluster' }).click()

  await page.getByRole('group', { name: 'Map interaction mode' }).getByRole('button', { name: 'Select' }).click()
  await page.getByRole('button', { name: 'Fit map' }).click()
  await clusterMap.getByRole('button', { name: 'Select New System 2 system' }).click()
  const inspector = page.getByRole('complementary', { name: 'Jump Route inspector' })
  await expect(inspector.getByRole('heading', { name: 'New System 2' })).toBeVisible()
  await inspector.getByRole('button', { name: 'Edit chart names' }).click()

  const dialog = page.getByRole('dialog', { name: 'Edit chart names' })
  await expect(dialog).toContainText('Rename the current Jump Cluster and New System 2.')
  await expect(dialog.getByLabel('Star system')).toHaveValue('New System 2')
  await dialog.getByLabel('Star system').fill('Renamed B')
  await dialog.getByRole('button', { name: 'Apply names' }).click()

  await expect(clusterMap).toBeVisible()
  await expect(page.getByRole('group', { name: 'Vesper star system map' })).toHaveCount(0)
  await expect(page.getByRole('group', { name: 'Map interaction mode' }).getByRole('button', { name: 'Select' })).toHaveAttribute('aria-pressed', 'true')
  await expect(inspector.getByRole('heading', { name: 'Renamed B' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Map context and commands' })
    .getByRole('heading', { name: 'Kestrel Reach' })).toBeVisible()
  const clusterContents = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  await expect(clusterContents.getByRole('button', { name: 'Open Vesper system map' })).toBeVisible()
  await page.getByRole('button', { name: 'Hierarchy', exact: true }).click()

  const exported = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(exported.cluster?.systems.map(system => system.name)).toEqual(['Vesper', 'Renamed B'])
  await page.getByRole('group', { name: 'Map interaction mode' }).getByRole('button', { name: 'Navigate' }).click()
  await expect(clusterMap.getByRole('button', { name: 'Open Vesper system map' })).toBeVisible()
  await clusterMap.getByRole('button', { name: 'Open Vesper system map' }).click()
  await expect(page.getByRole('group', { name: 'Vesper star system map' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Map context and commands' })
    .getByRole('heading', { name: 'Vesper' })).toBeVisible()
})

test('a held mouse press inspects an entity without navigating or publishing a click', async ({ page }) => {
  await createWorkspace(page)
  await page.getByRole('button', { name: 'Back to Jump Cluster' }).click()
  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  const system = clusterMap.getByRole('button', { name: 'Open Vesper system map' })
  const bounds = await system.boundingBox()
  expect(bounds).not.toBeNull()

  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(620)
  await page.mouse.up()

  await expect(clusterMap).toBeVisible()
  await expect(page.getByRole('group', { name: 'Vesper star system map' })).toHaveCount(0)
  await expect(page.locator('#workspace-inspector-panel').getByRole('heading', { name: 'Vesper', exact: true })).toBeVisible()

  // Long-press consumes its own follow-up click; the next click is a separate action.
  await system.click()
  await expect(page.getByRole('group', { name: 'Vesper star system map' })).toBeVisible()
})

test('Move selects map entities without opening Inspect or entering a system', async ({ page }) => {
  await createWorkspace(page)
  const systemMap = page.getByRole('group', { name: 'Vesper star system map' })
  await clickDockAction(page, 'Add orbit', {
    target: { kind: 'center', x: 0.25, y: 0.25 },
    noSelection: true,
  })
  await expect(systemMap.locator('.orbit-mark')).toHaveCount(1)
  await page.getByRole('group', { name: 'Map interaction mode' }).getByRole('button', { name: 'Move' }).click()
  const hierarchyToggle = page.getByRole('button', { name: 'Hierarchy', exact: true })
  const inspectorToggle = page.getByRole('button', { name: 'Inspect', exact: true })
  if (await hierarchyToggle.getAttribute('aria-expanded') === 'true') await hierarchyToggle.click()
  if (await inspectorToggle.getAttribute('aria-expanded') === 'true') await inspectorToggle.click()
  await expect(page.getByRole('button', { name: 'Hierarchy', exact: true })).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByRole('button', { name: 'Inspect', exact: true })).toHaveAttribute('aria-expanded', 'false')
  await page.setViewportSize({ width: 844, height: 390 })

  const starLabel = 'Select A, Primary Star (Star)'
  await systemMap.getByRole('button', { name: starLabel }).click()
  await expect(systemMap.locator('.system-object.is-selected')).toHaveCount(1)
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await page.setViewportSize({ width: 1280, height: 720 })
  await page.getByRole('button', { name: 'Fit map' }).click()
  const orbitTarget = systemMap.locator('.orbit-hit-target').first()
  const orbitBounds = await orbitTarget.boundingBox()
  expect(orbitBounds).not.toBeNull()
  // The target is an ellipse with a transparent fill and an interactive stroke;
  // click its outer edge instead of the empty center so this exercises pointer hit-testing.
  await orbitTarget.click({ position: { x: orbitBounds!.width * 0.85, y: orbitBounds!.height * 0.15 } })
  await expect(systemMap.locator('.orbit-axis-handle[aria-hidden="false"]')).toHaveCount(2)
  await expect(page.getByRole('button', { name: 'Inspect', exact: true })).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await page.setViewportSize({ width: 844, height: 390 })
  await page.getByRole('button', { name: 'Back to Jump Cluster' }).click()
  await page.getByRole('group', { name: 'Map interaction mode' }).getByRole('button', { name: 'Move' }).click()
  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await clusterMap.getByRole('button', { name: 'Select Vesper system' }).click()
  await expect(clusterMap.locator('.cluster-system-node.is-selected')).toHaveCount(1)
  await expect(clusterMap).toBeVisible()
  await expect(page.getByRole('group', { name: 'Vesper star system map' })).toHaveCount(0)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('map focus pans with arrow keys while focused Orbit controls keep their geometry keys', async ({ page }) => {
  await createWorkspace(page)
  const map = page.getByRole('group', { name: 'Vesper star system map' })
  await clickDockAction(page, 'Add orbit', {
    target: { kind: 'center', x: 0.25, y: 0.25 },
    noSelection: true,
  })
  await page.getByRole('group', { name: 'Map interaction mode' }).getByRole('button', { name: 'Move' }).click()

  const scene = page.locator('.system-map-svg .system-map-content')
  const originalViewport = await scene.getAttribute('transform')
  await map.focus()
  await expect(map).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect.poll(() => scene.getAttribute('transform')).not.toBe(originalViewport)
  const pannedViewport = await scene.getAttribute('transform')

  const orbit = map.getByRole('slider', { name: 'Resize Orbit 1 around unoccupied center' })
  await orbit.focus()
  const radiusBefore = Number(await orbit.getAttribute('aria-valuenow'))
  await page.keyboard.press('ArrowRight')
  await expect(orbit).toHaveAttribute('aria-valuenow', String(radiusBefore + 1))
  await expect(scene).toHaveAttribute('transform', pannedViewport!)
})

test('legacy Object and Orbit palette drags still add to the active map in every mode', async ({ page }) => {
  await createWorkspace(page)
  const map = page.getByRole('group', { name: 'Vesper star system map' })
  const journeys = [
    { mode: 'Navigate', object: { x: 220, y: 180 }, orbit: { x: 730, y: 150 } },
    { mode: 'Select', object: { x: 260, y: 220 }, orbit: { x: 730, y: 490 } },
    { mode: 'Move', object: { x: 320, y: 260 }, orbit: { x: 200, y: 490 } },
  ] as const

  for (const journey of journeys) {
    const { mode, object: objectPoint, orbit: orbitPoint } = journey
    await page.getByRole('group', { name: 'Map interaction mode' }).getByRole('button', { name: mode }).click()

    const objectCount = await map.locator('.system-object').count()
    const addPlanet = page.getByRole('button', { name: 'Add Planet', exact: true })
    await ensureMapDragPointsReachable(page, map, addPlanet, objectPoint)
    await dragHtmlElementToWorldPoint(page, addPlanet, map, objectPoint)
    await expect(map.locator('.system-object')).toHaveCount(objectCount + 1)
    await quitSystemAdd(page)

    const orbitCount = await map.locator('.orbit-mark').count()
    const addOrbit = page.getByRole('button', { name: 'Add orbit', exact: true })
    await ensureMapDragPointsReachable(page, map, addOrbit, orbitPoint)
    await dragHtmlElementToWorldPoint(page, addOrbit, map, orbitPoint)
    await expect(map.locator('.orbit-mark')).toHaveCount(orbitCount + 1)
    await quitSystemAdd(page)
  }
})
