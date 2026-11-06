import { expect, preparedCampaignTest as test } from './fixtures'
import {
  openWorkspaceHierarchy,
  openWorkspaceZoomNavigation,
  setWorkspaceMapMode,
  workspaceNavigation,
  workspaceZoomControls,
} from './helpers'

test('multi-select objects and preserve Hierarchy keyboard behavior through reflow', async ({
  campaignWorkspacePage: page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const clusterHierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  await clusterHierarchy.getByRole('button', { name: 'Open Vesper Prime system map', exact: true }).click()

  let hierarchy = await openWorkspaceHierarchy(page, 'System hierarchy')
  const primaryStar = hierarchy.getByRole('treeitem', { name: 'Select A, Primary Star', exact: true })
  const primaryOrbit = hierarchy.getByRole('treeitem', {
    name: 'Orbit 1 around Primary Star, 1 object',
    exact: true,
  })
  const iria = hierarchy.getByRole('treeitem', { name: 'Select PL-01, Iria', exact: true })
  const departureRow = hierarchy.getByRole('treeitem', { name: 'Select JP-01, Vesper Departure', exact: true })
  const map = page.getByRole('group', { name: 'Vesper Prime star system map', exact: true })
  const selectedMapObjects = map.locator('.system-object.is-selected')
  const inspector = page.getByRole('complementary', { name: 'Object inspector', exact: true })
  const starObject = map.getByRole('button', { name: 'Select A, Primary Star (Star)', exact: true })
  const planetObject = map.getByRole('button', { name: 'Select PL-01, Iria (Planet)', exact: true })
  const departureObject = map.getByRole('button', {
    name: 'Select JP-01, Vesper Departure (Jump Point)',
    exact: true,
  })
  const starId = await starObject.evaluate(mark => mark.closest('.system-object')?.getAttribute('data-object-id'))
  if (!starId) throw new Error('Primary Star has no stable map identity.')

  await setWorkspaceMapMode(page, 'Select')
  await starObject.click()
  await expect(selectedMapObjects).toHaveCount(1)
  await expect(primaryStar).toHaveAttribute('aria-selected', 'true')
  await expect(inspector).toContainText('Primary Star')

  await planetObject.click({ modifiers: ['Shift'] })
  await expect(selectedMapObjects).toHaveCount(2)
  await expect(iria).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('2 objects selected', { exact: true })).toBeVisible()

  await departureRow.click({ modifiers: ['Shift'] })
  await expect(selectedMapObjects).toHaveCount(3)
  await expect(departureRow).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('3 objects selected', { exact: true })).toBeVisible()

  await departureRow.click({ modifiers: ['Shift'] })
  await expect(selectedMapObjects).toHaveCount(2)
  await expect(departureRow).toHaveAttribute('aria-selected', 'false')

  await departureObject.locator('.object-hit-target').click({ button: 'right' })
  const visibilityMenu = page.getByRole('menu', { name: 'Player visibility', exact: true })
  await visibilityMenu.getByRole('menuitemcheckbox', { name: 'Revealed', exact: true }).click()

  await expect(departureRow).toHaveAttribute('aria-description', /Configured visibility: Revealed/)
  await expect(primaryStar).toHaveAttribute('aria-description', /Configured visibility: Hidden/)
  await expect(iria).toHaveAttribute('aria-description', /Configured visibility: Hidden/)
  await expect(selectedMapObjects).toHaveCount(2)
  await expect(page.getByText('2 objects selected', { exact: true })).toBeVisible()

  const transformBeforeNavigation = await map.locator('.system-map-content').evaluate((scene) => {
    const matrix = (scene as SVGGraphicsElement).getScreenCTM()
    if (!matrix) throw new Error('The system map scene has no screen transform.')
    return Math.hypot(matrix.a, matrix.b)
  })
  const mapNavigation = await openWorkspaceZoomNavigation(page)
  await mapNavigation.getByRole('button', { name: 'Pan map right', exact: true }).click()

  const zoomControls = workspaceZoomControls(page)
  const zoomNavigationToggle = zoomControls.getByRole('button', {
    name: 'Open map navigation controls',
    exact: true,
  })
  await zoomNavigationToggle.click()
  const zoomIn = zoomControls.getByRole('button', { name: 'Zoom in', exact: true })
  await expect(zoomIn).toBeVisible()
  await expect(zoomIn).toBeEnabled()
  await zoomIn.click()
  const transformAfterNavigation = await map.locator('.system-map-content').evaluate((scene) => {
    const matrix = (scene as SVGGraphicsElement).getScreenCTM()
    if (!matrix) throw new Error('The system map scene has no screen transform.')
    return Math.hypot(matrix.a, matrix.b)
  })
  expect(transformAfterNavigation).toBeGreaterThan(transformBeforeNavigation)

  const anchors = await map.locator('.system-object').evaluateAll(marks => marks.map((mark) => {
    const id = mark.getAttribute('data-object-id')
    const matrix = (mark as SVGGraphicsElement).getScreenCTM()
    if (!id || !matrix) throw new Error('A system object has no ID or screen transform.')
    const point = new DOMPoint(0, 0).matrixTransform(matrix)
    return { id, x: point.x, y: point.y }
  }))
  const departureId = await departureObject.evaluate(mark => mark.closest('.system-object')?.getAttribute('data-object-id'))
  if (!departureId) throw new Error('Vesper Departure has no stable map identity.')
  const departureAnchor = anchors.find(anchor => anchor.id === departureId)
  if (!departureAnchor) throw new Error('Vesper Departure has no resolved map anchor.')

  const svgBounds = await map.evaluate(element => {
    const bounds = element.getBoundingClientRect()
    return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom }
  })
  let rectangle: { start: { x: number; y: number }; end: { x: number; y: number } } | undefined
  for (const radius of [48, 64, 80, 96]) {
    const start = { x: departureAnchor.x - radius, y: departureAnchor.y - radius }
    const end = { x: departureAnchor.x + radius, y: departureAnchor.y + radius }
    if (start.x < svgBounds.left + 12 || end.x > svgBounds.right - 12
      || start.y < svgBounds.top + 12 || end.y > svgBounds.bottom - 12) continue

    const enclosed = anchors.filter(anchor => anchor.x >= start.x && anchor.x <= end.x
      && anchor.y >= start.y && anchor.y <= end.y)
    if (enclosed.length !== 1 || enclosed[0]?.id !== departureId) continue

    const startsOnBackground = await map.evaluate((element, point) => {
      const hit = document.elementFromPoint(point.x, point.y)
      return hit === element || (hit instanceof Element && hit.matches('.map-background, .map-grid'))
    }, start)
    if (startsOnBackground) {
      rectangle = { start, end }
      break
    }
  }
  if (!rectangle) throw new Error('Could not find a clear rectangle around Vesper Departure at the transformed zoom.')

  await expect(zoomIn).toBeFocused()
  await page.mouse.move(rectangle.start.x, rectangle.start.y)
  await page.mouse.down()
  await page.mouse.move(rectangle.end.x, rectangle.end.y, { steps: 6 })
  const preview = page.locator('.workspace-selection-rectangle')
  await expect(preview).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(preview).toBeHidden()
  await page.mouse.up()
  await expect(selectedMapObjects).toHaveCount(2)

  await page.mouse.move(rectangle.start.x, rectangle.start.y)
  await page.mouse.down()
  await page.mouse.move(rectangle.end.x, rectangle.end.y, { steps: 6 })
  await page.mouse.up()
  await expect(selectedMapObjects).toHaveCount(1)
  await expect(selectedMapObjects).toHaveAttribute('data-object-id', departureId)
  await expect(departureRow).toHaveAttribute('aria-selected', 'true')
  await expect(inspector).toContainText('Vesper Departure')

  await page.mouse.click(rectangle.start.x, rectangle.start.y)
  await expect(selectedMapObjects).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Star System details', exact: true })).toBeVisible()

  await starObject.click()
  await expect(selectedMapObjects).toHaveCount(1)
  await expect(selectedMapObjects).toHaveAttribute('data-object-id', starId)
  await expect(primaryStar).toHaveAttribute('aria-selected', 'true')

  await testInfo.attach('hierarchy-tree-expanded', {
    body: await page.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  })
  await primaryStar.click()
  await expect(primaryStar).toHaveAttribute('aria-selected', 'true')
  await expect(primaryOrbit).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.type('Iria')
  await expect(iria).toBeFocused()

  await primaryOrbit.focus()
  await page.keyboard.press('ArrowLeft')
  await expect(primaryOrbit).toHaveAttribute('aria-expanded', 'false')
  await testInfo.attach('hierarchy-tree-collapsed', {
    body: await page.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  })
  await expect(iria).toBeHidden()
  await expect(primaryStar).toHaveAttribute('aria-selected', 'true')

  await page.keyboard.press('ArrowRight')
  await expect(primaryOrbit).toHaveAttribute('aria-expanded', 'true')
  await expect(iria).toBeVisible()
  await page.keyboard.press('Home')
  await expect(primaryStar).toBeFocused()
  await page.keyboard.press('End')
  await expect(departureRow).toBeFocused()

  await setWorkspaceMapMode(page, 'Navigate')
  await iria.focus()
  const navigation = workspaceNavigation(page)
  const navigateButton = navigation.getByRole('button', { name: 'Navigate', exact: true })
  const selectButton = navigation.getByRole('button', { name: 'Select', exact: true })
  const moveButton = navigation.getByRole('button', { name: 'Move', exact: true })
  const addButton = navigation.getByRole('button', { name: 'Add to map', exact: true })
  await expect(selectedMapObjects).toHaveAttribute('data-object-id', /.+/)
  const selectedObjectId = await selectedMapObjects.getAttribute('data-object-id')
  if (!selectedObjectId) throw new Error('The selected map object has no stable identity.')

  for (const key of ['n', 's', 'm', 'a']) {
    await page.keyboard.press(key)
    await expect(navigateButton).toHaveAttribute('aria-pressed', 'true')
    await expect(selectButton).toHaveAttribute('aria-pressed', 'false')
    await expect(moveButton).toHaveAttribute('aria-pressed', 'false')
    await expect(addButton).toHaveAttribute('aria-expanded', 'false')
    await expect(primaryStar).toHaveAttribute('aria-selected', 'true')
    await expect(selectedMapObjects).toHaveAttribute('data-object-id', selectedObjectId)
  }

  await primaryOrbit.focus()
  await page.keyboard.press('ArrowLeft')
  await expect(primaryOrbit).toHaveAttribute('aria-expanded', 'false')
  await page.getByRole('button', { name: 'Hierarchy', exact: true }).click()
  await expect(hierarchy).toBeHidden()

  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Hide inspector', exact: true }).click()
  hierarchy = await openWorkspaceHierarchy(page, 'System hierarchy')
  const compactPrimaryOrbit = hierarchy.getByRole('treeitem', {
    name: 'Orbit 1 around Primary Star, 1 object',
    exact: true,
  })
  await expect(compactPrimaryOrbit).toHaveAttribute('aria-expanded', 'false')
  await expect(hierarchy.getByRole('treeitem', { name: 'Select PL-01, Iria', exact: true })).toBeHidden()
  await expect(hierarchy.getByRole('treeitem', { name: 'Select A, Primary Star', exact: true }))
    .toHaveAttribute('aria-selected', 'true')
})
