import { expect, test, type Locator, type Page } from './fixtures'
import deepHierarchyFixture from './fixtures/workspace-hierarchy-deep.json' with { type: 'json' }
import {
  createSingleSystemWorkspace,
  jsonMapImportInput,
  openWorkspaceHierarchy,
  resolveImportReview,
  returnToClusterMap,
  setHeaderMapActionsOpen,
  setJsonFile,
  setWorkspaceMapMode,
} from './helpers'

async function touchTarget(page: Page, target: Locator): Promise<void> {
  const bounds = await target.boundingBox()
  if (!bounds) throw new Error('The Hierarchy row has no visible touch bounds.')
  const session = await page.context().newCDPSession(page)
  const touchPoint = {
    x: Math.round(bounds.x + bounds.width / 2),
    y: Math.round(bounds.y + bounds.height / 2),
    id: 1,
    radiusX: 2,
    radiusY: 2,
    force: 1,
  }

  try {
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touchPoint] })
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  } finally {
    await session.detach()
  }
}

function addTwentyAlternatingLevels(base: typeof deepHierarchyFixture): typeof deepHierarchyFixture {
  const objects: Array<typeof deepHierarchyFixture.system.objects[number]> = []
  const orbits: Array<typeof deepHierarchyFixture.system.orbits[number]> = []
  let hostId = 'deep-hierarchy-planet-six'

  for (let index = 1; index <= 10; index += 1) {
    const orbitId = `deep-hierarchy-extra-orbit-${String(index).padStart(2, '0')}`
    const objectId = `deep-hierarchy-extra-object-${String(index).padStart(2, '0')}`
    const subtype = index % 2 === 0 ? 'moon' : 'planet'
    const name = `${subtype === 'moon' ? 'Deep moon' : 'Deep planet'} ${index} — Cryogenic Archive Node`

    orbits.push({ id: orbitId, hostId, order: 1 })
    objects.push({
      id: objectId,
      family: 'CelestialBody',
      subtype,
      locationKey: `DEEP-${String(index).padStart(2, '0')}-ARCHIVE-KEY`,
      name,
      description: '',
      placement: { kind: 'orbit', orbitId },
    })
    hostId = objectId
  }

  return {
    ...base,
    system: {
      ...base.system,
      objects: [...base.system.objects, ...objects],
      orbits: [...base.system.orbits, ...orbits],
    },
  }
}

async function expectNoHorizontalOverflow(target: Locator): Promise<void> {
  const dimensions = await target.evaluate(element => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1)
}

async function expectReadableObjectName(item: Locator): Promise<void> {
  const bounds = await item.locator('.tree-object-name').boundingBox()
  if (!bounds) throw new Error('The object name has no rendered bounds.')
  expect(bounds.width).toBeGreaterThanOrEqual(80)
  await expectNoHorizontalOverflow(item.locator('.tree-object-name'))
}

test('deep object and Orbit rows stay readable at the minimum Hierarchy width', async ({ page }, testInfo) => {
  await createSingleSystemWorkspace(page, { viewport: { width: 1440, height: 960 } })

  await setHeaderMapActionsOpen(page, true)
  await page.getByRole('button', { name: 'Import JSON copy', exact: true }).click()
  await setHeaderMapActionsOpen(page, false)
  await setJsonFile(
    jsonMapImportInput(page),
    'deep-hierarchy-readability.json',
    JSON.stringify(addTwentyAlternatingLevels(deepHierarchyFixture)),
  )
  const review = page.getByRole('dialog', { name: 'Review import', exact: true })
  await resolveImportReview(review, 'confirm')
  await expect(review).toHaveCount(0)

  await returnToClusterMap(page)
  await setWorkspaceMapMode(page, 'Navigate')
  const clusterHierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  await clusterHierarchy.getByRole('button', {
    name: `Open ${deepHierarchyFixture.system.name} system map`,
    exact: true,
  }).click()
  await expect(page.getByRole('group', {
    name: `${deepHierarchyFixture.system.name} star system map`,
    exact: true,
  })).toBeVisible()

  const hierarchy = await openWorkspaceHierarchy(page, 'System hierarchy')
  const tree = hierarchy.getByRole('tree', { name: 'Map object and Orbit hierarchy', exact: true })
  const items = tree.getByRole('treeitem')
  await expect(items).toHaveCount(34)

  const deepestObject = tree.getByRole('treeitem', { name: /^Select PL-06-ICE-BELT-09,/ })
  await expect(deepestObject).toHaveAttribute('aria-level', '11')
  await expect(deepestObject.locator('.tree-expand-control')).toBeVisible()
  const nearBottomExpandedObject = tree.getByRole('treeitem', { name: /^Select DEEP-09-ARCHIVE-KEY,/ })
  await expect(nearBottomExpandedObject).toHaveAttribute('aria-level', '29')
  await expect(nearBottomExpandedObject.locator('.tree-expand-control')).toBeVisible()
  const thirtyFirstLevelObject = tree.getByRole('treeitem', { name: /^Select DEEP-10-ARCHIVE-KEY,/ })
  await expect(thirtyFirstLevelObject).toHaveAttribute('aria-level', '31')
  await expect(thirtyFirstLevelObject.locator('.tree-expand-control')).toHaveCount(0)
  const emptyOrbit = tree.getByRole('treeitem', { name: /^Orbit 2 around New moon 1 — Pale Harbor, 0 objects$/ })
  await expect(emptyOrbit).toHaveAttribute('aria-level', '6')
  const levels = await items.evaluateAll(elements => elements.map(element => Number(element.getAttribute('aria-level'))))
  expect(Math.max(...levels)).toBe(31)

  await thirtyFirstLevelObject.scrollIntoViewIfNeeded()
  const normalScreenshot = testInfo.outputPath('hierarchy-deep-branch-normal-width.png')
  await page.screenshot({ path: normalScreenshot, animations: 'disabled' })
  await testInfo.attach('hierarchy-deep-branch-normal-width', {
    path: normalScreenshot,
    contentType: 'image/png',
  })

  const resizeHandle = hierarchy.getByRole('separator', { name: 'Resize system hierarchy panel', exact: true })
  const minimumWidth = await resizeHandle.getAttribute('aria-valuemin')
  await resizeHandle.focus()
  await page.keyboard.press('Home')
  await expect(resizeHandle).toHaveAttribute('aria-valuenow', minimumWidth ?? '220')

  await thirtyFirstLevelObject.scrollIntoViewIfNeeded()
  const minimumScreenshot = testInfo.outputPath('hierarchy-deep-branch-minimum-width.png')
  await page.screenshot({ path: minimumScreenshot, animations: 'disabled' })
  await testInfo.attach('hierarchy-deep-branch-minimum-width', {
    path: minimumScreenshot,
    contentType: 'image/png',
  })

  const rootObject = tree.getByRole('treeitem', { name: 'Select A, Primary Star', exact: true })
  const rootBounds = await rootObject.boundingBox()
  const nearBottomBounds = await nearBottomExpandedObject.boundingBox()
  const deepBounds = await thirtyFirstLevelObject.boundingBox()
  if (!rootBounds || !nearBottomBounds || !deepBounds) {
    throw new Error('The root or deep object row has no rendered bounds.')
  }
  expect(nearBottomBounds.x - rootBounds.x).toBeLessThanOrEqual(41)
  expect(deepBounds.x - rootBounds.x).toBeLessThanOrEqual(41)
  await expectReadableObjectName(deepestObject)
  await expectReadableObjectName(nearBottomExpandedObject)
  await expectReadableObjectName(thirtyFirstLevelObject)
  await expect(deepestObject.locator('.tree-object-name'))
    .toHaveText('New planet 6 — Icebound Outer Observatory')
  await expect(deepestObject.locator('.key-tag')).toHaveText('PL-06-ICE-BELT-09')
  await expect(deepestObject.locator('.tree-type-label')).toHaveText('Celestial body / Planet')
  await expect(deepestObject.locator('.tree-parent-context'))
    .toHaveText('Orbit 1 around New moon 3 — Survey Station')
  await expect(deepestObject).toHaveAttribute('aria-description', /Celestial body \/ Planet\. Orbit 1 around New moon 3/)
  await expect(thirtyFirstLevelObject.locator('.tree-object-name'))
    .toHaveText('Deep moon 10 — Cryogenic Archive Node')
  await expect(thirtyFirstLevelObject.locator('.key-tag')).toHaveText('DEEP-10-ARCHIVE-KEY')
  await expect(thirtyFirstLevelObject.locator('.tree-type-label')).toHaveText('Celestial body / Moon')
  await expect(thirtyFirstLevelObject.locator('.tree-parent-context'))
    .toHaveText('Orbit 1 around Deep planet 9 — Cryogenic Archive Node')
  await expect(thirtyFirstLevelObject)
    .toHaveAttribute('aria-description', /Celestial body \/ Moon\. Orbit 1 around Deep planet 9/)
  for (const selector of ['.key-tag', '.tree-type-label', '.tree-parent-context']) {
    await expectNoHorizontalOverflow(deepestObject.locator(selector))
    await expectNoHorizontalOverflow(thirtyFirstLevelObject.locator(selector))
  }

  await hierarchy.getByRole('button', { name: 'Close hierarchy panel', exact: true }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  const compactHierarchy = await openWorkspaceHierarchy(page, 'System hierarchy')
  const compactTree = compactHierarchy.getByRole('tree', { name: 'Map object and Orbit hierarchy', exact: true })
  const compactDeepestObject = compactTree.getByRole('treeitem', { name: /^Select DEEP-10-ARCHIVE-KEY,/ })
  await expect(compactHierarchy).toHaveAttribute('role', 'dialog')
  await compactDeepestObject.scrollIntoViewIfNeeded()
  await expect(compactDeepestObject).toHaveAttribute('aria-level', '31')
  await expect(compactDeepestObject.locator('.tree-object-name'))
    .toHaveText('Deep moon 10 — Cryogenic Archive Node')
  await expect(compactDeepestObject.locator('.key-tag')).toHaveText('DEEP-10-ARCHIVE-KEY')
  await expect(compactDeepestObject.locator('.tree-type-label')).toHaveText('Celestial body / Moon')
  await expect(compactDeepestObject.locator('.tree-parent-context'))
    .toHaveText('Orbit 1 around Deep planet 9 — Cryogenic Archive Node')
  await expect(compactDeepestObject)
    .toHaveAttribute('aria-description', /Celestial body \/ Moon\. Orbit 1 around Deep planet 9/)
  await expectNoHorizontalOverflow(compactDeepestObject.locator('.tree-object-name'))
  await compactDeepestObject.focus()
  await expect(compactDeepestObject).toBeFocused()
  await touchTarget(page, compactDeepestObject)
  const compactInspector = page.getByRole('dialog', { name: 'Object inspector', exact: true })
  await expect(compactInspector).toBeVisible()
  await expect(compactInspector.getByRole('heading', {
    name: 'Deep moon 10 — Cryogenic Archive Node',
    exact: true,
  })).toBeVisible()
  await expect(compactInspector.locator('.entity-inspector-subtitle'))
    .toContainText('DEEP-10-ARCHIVE-KEY')
  await compactInspector.getByRole('button', { name: 'Hide inspector', exact: true }).click()

  const selectedHierarchy = await openWorkspaceHierarchy(page, 'System hierarchy')
  const selectedTree = selectedHierarchy.getByRole('tree', { name: 'Map object and Orbit hierarchy', exact: true })
  const selectedDeepestObject = selectedTree.getByRole('treeitem', { name: /^Select DEEP-10-ARCHIVE-KEY,/ })
  await selectedDeepestObject.scrollIntoViewIfNeeded()
  await expect(selectedDeepestObject).toHaveAttribute('aria-current', 'true')

  const compactScreenshot = testInfo.outputPath('hierarchy-deep-branch-compact-touch-selected.png')
  await page.screenshot({ path: compactScreenshot, animations: 'disabled' })
  await testInfo.attach('hierarchy-deep-branch-compact-touch-selected', {
    path: compactScreenshot,
    contentType: 'image/png',
  })
})
