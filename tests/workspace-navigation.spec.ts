import { expect, test, type Page } from './fixtures'
import {
  addClusterSystem,
  dragHtmlElementToWorldPoint,
  ensureMapDragPointsReachable,
  openWorkspaceHierarchy,
  openWorkspaceZoomNavigation,
  parseMapCameraTransform,
  quitSystemAdd,
  selectCatalogueObjectButton,
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



test('Navigate opens a system while Select keeps the cluster map active and inspects system data', async ({ page }) => {
  await createWorkspace(page)
  await page.getByRole('button', { name: 'Back to Jump Cluster' }).click()

  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await expect(page.getByRole('group', { name: 'Map interaction mode' }).getByRole('button', { name: 'Select' }))
    .toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('group', { name: 'Map interaction mode' }).getByRole('button', { name: 'Navigate' }).click()
  await clusterMap.getByRole('button', { name: 'Open Vesper system map' }).click()
  await expect(page.getByRole('group', { name: 'Vesper star system map' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Map interaction mode' }).getByRole('button', { name: 'Select' }))
    .toHaveAttribute('aria-pressed', 'true')
  await expect(clusterMap).toHaveCount(0)

  await page.getByRole('button', { name: 'Back to Jump Cluster' }).click()
  await expect(page.getByRole('group', { name: 'Map interaction mode' }).getByRole('button', { name: 'Select' }))
    .toHaveAttribute('aria-pressed', 'true')
  const selectMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await page.getByRole('group', { name: 'Map interaction mode' }).getByRole('button', { name: 'Select' }).click()
  const systemMark = selectMap.getByRole('button', { name: 'Select Vesper system' })
  const scene = selectMap.locator('.cluster-map-content')
  const viewportBeforeDrag = await scene.getAttribute('transform')
  const bounds = await systemMark.boundingBox()
  if (!bounds || !viewportBeforeDrag) throw new Error('The cluster map is not ready for right-drag.')
  const start = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down({ button: 'right' })
  await page.mouse.move(start.x + 75, start.y + 32, { steps: 5 })
  await page.mouse.up({ button: 'right' })
  await expect(scene).not.toHaveAttribute('transform', viewportBeforeDrag)
  await expect(page.getByRole('menu', { name: 'Player visibility', exact: true })).toHaveCount(0)
  await expect(selectMap.locator('.cluster-system-node.is-selected')).toHaveCount(0)

  // Recalculate the target after the camera moves and verify that a new click is not suppressed.
  await systemMark.click()

  await expect(selectMap).toBeVisible()
  await expect(page.locator('#workspace-inspector-panel').getByRole('heading', { name: 'Vesper', exact: true })).toBeVisible()
})



test('A to B to A restores each system camera and the selected map object', async ({ page }) => {
  await createWorkspace(page)
  const starLabel = 'Select A, Primary Star (Star)'
  const hierarchyStarLabel = 'Select A, Primary Star'
  await page.getByRole('group', { name: 'Map interaction mode' }).getByRole('button', { name: 'Select' }).click()
  await page.getByRole('group', { name: 'Vesper star system map' }).getByRole('button', { name: starLabel }).click()
  const firstHierarchy = await openWorkspaceHierarchy(page)
  const firstStar = firstHierarchy.getByRole('treeitem', { name: hierarchyStarLabel })
  await expect(firstStar).toHaveAttribute('aria-current', 'true')
  await page.getByRole('button', { name: 'Hierarchy', exact: true }).click()

  const scene = page.locator('.system-map-svg .system-map-content')
  const cameraBeforeFirstPan = parseMapCameraTransform(await scene.getAttribute('transform'))
  await (await openWorkspaceZoomNavigation(page)).getByRole('button', { name: 'Pan map right' }).click()
  await expect.poll(async () => parseMapCameraTransform(await scene.getAttribute('transform'))).toEqual({
    ...cameraBeforeFirstPan,
    x: cameraBeforeFirstPan.x + 80,
  })
  const firstSystemViewport = await scene.getAttribute('transform')

  await page.getByRole('button', { name: 'Back to Jump Cluster' }).click()
  await addClusterSystem(page, { open: true })
  await page.getByRole('group', { name: 'Map interaction mode' }).getByRole('button', { name: 'Select' }).click()
  await page.getByRole('group', { name: 'New System 2 star system map' }).getByRole('button', { name: starLabel }).click()

  const secondSystemScene = page.locator('.system-map-svg .system-map-content')
  const cameraBeforeSecondPan = parseMapCameraTransform(await secondSystemScene.getAttribute('transform'))
  await (await openWorkspaceZoomNavigation(page)).getByRole('button', { name: 'Pan map left' }).click()
  await expect.poll(async () => parseMapCameraTransform(await secondSystemScene.getAttribute('transform'))).toEqual({
    ...cameraBeforeSecondPan,
    x: cameraBeforeSecondPan.x - 80,
  })
  const secondSystemViewport = await secondSystemScene.getAttribute('transform')

  await page.getByRole('button', { name: 'Back to Jump Cluster' }).click()
  await page.getByRole('group', { name: 'Map interaction mode' }).getByRole('button', { name: 'Navigate' }).click()
  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await clusterMap.getByRole('button', { name: 'Open Vesper system map' }).click()
  await expect(page.getByRole('group', { name: 'Vesper star system map' })).toBeVisible()
  const restoredFirstHierarchy = await openWorkspaceHierarchy(page)
  await expect(restoredFirstHierarchy.getByRole('treeitem', { name: hierarchyStarLabel })).toHaveAttribute('aria-current', 'true')
  await page.getByRole('button', { name: 'Hierarchy', exact: true }).click()
  await expect(page.locator('.system-map-svg .system-map-content')).toHaveAttribute('transform', firstSystemViewport!)

  await page.getByRole('button', { name: 'Back to Jump Cluster' }).click()
  const clusterMapAfterReturn = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await page.getByRole('button', { name: 'Fit map' }).click()
  await page.getByRole('group', { name: 'Map interaction mode' }).getByRole('button', { name: 'Navigate' }).click()
  await clusterMapAfterReturn.getByRole('button', { name: 'Open New System 2 system map' }).click()
  await expect(page.getByRole('group', { name: 'New System 2 star system map' })).toBeVisible()
  const restoredSecondHierarchy = await openWorkspaceHierarchy(page)
  await expect(restoredSecondHierarchy.getByRole('treeitem', { name: hierarchyStarLabel })).toHaveAttribute('aria-current', 'true')
  await expect(page.locator('.system-map-svg .system-map-content')).toHaveAttribute('transform', secondSystemViewport!)
})





test('a held mouse press inspects an entity without navigating or publishing a click', async ({ page }) => {
  await createWorkspace(page)
  await page.getByRole('button', { name: 'Back to Jump Cluster' }).click()
  await page.getByRole('group', { name: 'Map interaction mode' }).getByRole('button', { name: 'Navigate' }).click()
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



const legacyPaletteModes = ['Move'] as const
const legacyPaletteObjectPoint = { x: 220, y: 180 }
const legacyPaletteOrbitPoint = { x: 730, y: 150 }

for (const mode of legacyPaletteModes) {
  test(`legacy Object and Orbit palette drags work in ${mode} mode`, async ({ page }) => {
    await createWorkspace(page)
    const map = page.getByRole('group', { name: 'Vesper star system map' })
    const modeButton = page.getByRole('group', { name: 'Map interaction mode' }).getByRole('button', { name: mode })
    await modeButton.click()
    await expect(modeButton).toHaveAttribute('aria-pressed', 'true')

    const objectCount = await map.locator('.system-object').count()
    const addPlanet = await selectCatalogueObjectButton(page, 'planet')
    await ensureMapDragPointsReachable(page, map, addPlanet, legacyPaletteObjectPoint)
    await dragHtmlElementToWorldPoint(page, addPlanet, map, legacyPaletteObjectPoint)
    await expect(map.locator('.system-object')).toHaveCount(objectCount + 1)
    await quitSystemAdd(page)
    await expect(page.getByRole('group', { name: 'Map interaction mode' }).getByRole('button', { name: 'Select' }))
      .toHaveAttribute('aria-pressed', 'true')

    await modeButton.click()
    await expect(modeButton).toHaveAttribute('aria-pressed', 'true')
    const inspectToggle = page.getByRole('button', { name: 'Inspect', exact: true })
    if (await inspectToggle.getAttribute('aria-expanded') === 'true') await inspectToggle.click()

    const addToggle = page.getByRole('button', { name: 'Add to map', exact: true, includeHidden: true })
    if (await addToggle.getAttribute('aria-expanded') !== 'true') await addToggle.click()
    await expect(addToggle).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByRole('region', { name: 'Object palette', exact: true })).toBeVisible()

    const orbitCount = await map.locator('.orbit-mark').count()
    const addOrbit = page.getByRole('button', { name: 'Add orbit', exact: true })
    await ensureMapDragPointsReachable(page, map, addOrbit, legacyPaletteOrbitPoint)
    await dragHtmlElementToWorldPoint(page, addOrbit, map, legacyPaletteOrbitPoint)
    await expect(map.locator('.orbit-mark')).toHaveCount(orbitCount + 1)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Quit Add and return to Select', exact: true })).toHaveCount(0)
    await expect(page.getByRole('group', { name: 'Map interaction mode' }).getByRole('button', { name: 'Select' }))
      .toHaveAttribute('aria-pressed', 'true')
  })
}
