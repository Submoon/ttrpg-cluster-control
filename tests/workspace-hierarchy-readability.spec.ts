import { expect, test, type Locator, type Page } from './fixtures'
import deepHierarchyFixture from './fixtures/workspace-hierarchy-deep.json' with { type: 'json' }
import {
  createSingleSystemWorkspace,
  openWorkspaceHierarchy,
  resolveImportReview,
  hideWorkspaceInspector,
  reviewStarSystemImport,
  wardenMap,
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

async function expectUnclippedObjectName(item: Locator): Promise<void> {
  const name = item.locator('.tree-object-name')
  await expect(name).toBeVisible()
  await expectNoHorizontalOverflow(name)
}

test('deep object and Orbit rows stay readable at the minimum Hierarchy width @preview-smoke', async ({ page }, testInfo) => {
  await createSingleSystemWorkspace(page, { viewport: { width: 1440, height: 960 } })

  const review = await reviewStarSystemImport(
    page,
    'deep-hierarchy-readability.json',
    JSON.stringify(addTwentyAlternatingLevels(deepHierarchyFixture)),
  )
  await resolveImportReview(review, 'confirm')
  await expect(review).toHaveCount(0)

  const hierarchy = await openWorkspaceHierarchy(page)
  const systemName = deepHierarchyFixture.system.name
  await hierarchy.getByRole('button', { name: `Inspect ${systemName}`, exact: true }).click()
  await hideWorkspaceInspector(page)
  await expect(wardenMap(page)).toHaveAccessibleName('Kestrel Reach continuous map')

  const treeName = 'Kestrel Reach object and Orbit hierarchy'
  const tree = hierarchy.getByRole('tree', { name: treeName, exact: true })
  const owner = tree.getByRole('treeitem', { name: systemName, exact: true })
  await expect(owner).toHaveAttribute('aria-expanded', 'true')
  const ownerChildren = owner.locator('..').locator(':scope > [role="group"]')
  const items = ownerChildren.getByRole('treeitem')
  await expect(items).toHaveCount(34)

  const deepestObject = ownerChildren.getByRole('treeitem', { name: /^Select PL-06-ICE-BELT-09,/ })
  await expect(deepestObject).toHaveAttribute('aria-level', '12')
  await expect(deepestObject.locator('.tree-expand-control')).toBeVisible()
  const nearBottomExpandedObject = ownerChildren.getByRole('treeitem', { name: /^Select DEEP-09-ARCHIVE-KEY,/ })
  await expect(nearBottomExpandedObject).toHaveAttribute('aria-level', '30')
  await expect(nearBottomExpandedObject.locator('.tree-expand-control')).toBeVisible()
  const deepestLeaf = ownerChildren.getByRole('treeitem', { name: /^Select DEEP-10-ARCHIVE-KEY,/ })
  await expect(deepestLeaf).toHaveAttribute('aria-level', '32')
  await expect(deepestLeaf.locator('.tree-expand-control')).toHaveCount(0)
  const emptyOrbit = ownerChildren.getByRole('treeitem', { name: /^Orbit 2 around New moon 1 — Pale Harbor, 0 objects$/ })
  await expect(emptyOrbit).toHaveAttribute('aria-level', '7')
  const levels = await items.evaluateAll(elements => elements.map(element => Number(element.getAttribute('aria-level'))))
  expect(Math.max(...levels)).toBe(32)

  await deepestLeaf.scrollIntoViewIfNeeded()
  const normalScreenshot = testInfo.outputPath('hierarchy-deep-branch-normal-width.png')
  await page.screenshot({ path: normalScreenshot, animations: 'disabled' })
  await testInfo.attach('hierarchy-deep-branch-normal-width', {
    path: normalScreenshot,
    contentType: 'image/png',
  })

  const resizeHandle = hierarchy.getByRole('separator', { name: 'Resize jump cluster contents panel', exact: true })
  const minimumWidth = await resizeHandle.getAttribute('aria-valuemin')
  await resizeHandle.focus()
  await page.keyboard.press('Home')
  await expect(resizeHandle).toHaveAttribute('aria-valuenow', minimumWidth ?? '220')

  await deepestLeaf.scrollIntoViewIfNeeded()
  const minimumScreenshot = testInfo.outputPath('hierarchy-deep-branch-minimum-width.png')
  await page.screenshot({ path: minimumScreenshot, animations: 'disabled' })
  await testInfo.attach('hierarchy-deep-branch-minimum-width', {
    path: minimumScreenshot,
    contentType: 'image/png',
  })

  await expectUnclippedObjectName(deepestObject)
  await expectUnclippedObjectName(nearBottomExpandedObject)
  await expectUnclippedObjectName(deepestLeaf)
  await expect(deepestObject.locator('.tree-object-name'))
    .toHaveText('New planet 6 — Icebound Outer Observatory')
  await expect(deepestObject.locator('.key-tag')).toHaveText('PL-06-ICE-BELT-09')
  await expect(deepestObject.getByText('Celestial body / Planet', { exact: true })).toBeVisible()
  await expect(deepestObject.getByText('Orbit 1 around New moon 3 — Survey Station', { exact: true })).toBeVisible()
  await expect(deepestObject).toHaveAttribute('aria-description', /Celestial body \/ Planet\. Orbit 1 around New moon 3/)
  await expect(deepestLeaf.locator('.tree-object-name'))
    .toHaveText('Deep moon 10 — Cryogenic Archive Node')
  await expect(deepestLeaf.locator('.key-tag')).toHaveText('DEEP-10-ARCHIVE-KEY')
  await expect(deepestLeaf.getByText('Celestial body / Moon', { exact: true })).toBeVisible()
  await expect(deepestLeaf.getByText('Orbit 1 around Deep planet 9 — Cryogenic Archive Node', { exact: true })).toBeVisible()
  await expect(deepestLeaf)
    .toHaveAttribute('aria-description', /Celestial body \/ Moon\. Orbit 1 around Deep planet 9/)
  for (const row of [deepestObject, deepestLeaf]) {
    await expect(row.getByText(systemName, { exact: true })).toBeVisible()
    await expectNoHorizontalOverflow(row.locator('.key-tag'))
    await expectNoHorizontalOverflow(row.getByText(/^Celestial body \/ (?:Planet|Moon)$/))
    await expectNoHorizontalOverflow(row.getByText(/^Orbit 1 around /))
  }

  await hierarchy.getByRole('button', { name: 'Close hierarchy panel', exact: true }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  const compactHierarchy = await openWorkspaceHierarchy(page)
  const compactTree = compactHierarchy.getByRole('tree', { name: treeName, exact: true })
  const compactDeepestObject = compactTree.getByRole('treeitem', { name: /^Select DEEP-10-ARCHIVE-KEY,/ })
  await expect(compactHierarchy).toHaveAttribute('role', 'dialog')
  await compactDeepestObject.scrollIntoViewIfNeeded()
  await expect(compactDeepestObject).toHaveAttribute('aria-level', '32')
  await expect(compactDeepestObject.locator('.tree-object-name'))
    .toHaveText('Deep moon 10 — Cryogenic Archive Node')
  await expect(compactDeepestObject.locator('.key-tag')).toHaveText('DEEP-10-ARCHIVE-KEY')
  await expect(compactDeepestObject.getByText('Celestial body / Moon', { exact: true })).toBeVisible()
  await expect(compactDeepestObject.getByText('Orbit 1 around Deep planet 9 — Cryogenic Archive Node', { exact: true })).toBeVisible()
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

  const selectedHierarchy = await openWorkspaceHierarchy(page)
  const selectedTree = selectedHierarchy.getByRole('tree', { name: treeName, exact: true })
  const selectedDeepestObject = selectedTree.getByRole('treeitem', { name: /^Select DEEP-10-ARCHIVE-KEY,/ })
  await selectedDeepestObject.scrollIntoViewIfNeeded()
  await expect(selectedDeepestObject).toHaveAttribute('aria-selected', 'true')

  const compactScreenshot = testInfo.outputPath('hierarchy-deep-branch-compact-touch-selected.png')
  await page.screenshot({ path: compactScreenshot, animations: 'disabled' })
  await testInfo.attach('hierarchy-deep-branch-compact-touch-selected', {
    path: compactScreenshot,
    contentType: 'image/png',
  })
})
