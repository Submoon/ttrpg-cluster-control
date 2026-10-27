import { expect, test } from './fixtures'
import {
  captureMapExportBlobs,
  createSingleSystemWorkspace,
  deletionReviewDialog,
  downloadJson,
  openWorkspaceHierarchy,
  resolveDeletionReview,
  selectCatalogueObjectButton,
  selectInspectorOption,
  setWorkspaceMapMode,
} from './helpers'
import {
  createLocalWorkspace,
  createSystemObject,
  planMapEntityDeletion,
  replaceWorkspaceSystem,
} from '../domain/workspace'

type Point = { x: number; y: number }

test('default object names skip occupied names after a deletion @pure', () => {
  const workspace = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const initialSystem = workspace.cluster.systems[0]
  if (!initialSystem) throw new Error('Expected the starter workspace to contain a system.')

  const first = {
    ...createSystemObject(initialSystem, 'planet'),
    name: 'Foo',
    description: 'Old object draft',
    placement: { kind: 'system' as const, x: 0.82, y: 0.74 },
  }
  const withFirst = replaceWorkspaceSystem(workspace, {
    ...initialSystem,
    objects: [...initialSystem.objects, first],
  })
  const afterFirst = withFirst.cluster.systems[0]
  if (!afterFirst) throw new Error('Expected the first object to remain in its system.')

  const second = createSystemObject(afterFirst, 'planet')
  const withSecond = replaceWorkspaceSystem(withFirst, {
    ...afterFirst,
    objects: [...afterFirst.objects, second],
  })
  const afterSecond = withSecond.cluster.systems[0]
  if (!afterSecond) throw new Error('Expected the second object to remain in its system.')

  const differentlyTyped = {
    ...createSystemObject(afterSecond, 'other'),
    name: 'New planet 3',
  }
  const withDifferentType = replaceWorkspaceSystem(withSecond, {
    ...afterSecond,
    objects: [...afterSecond.objects, differentlyTyped],
  })
  const deletion = planMapEntityDeletion(withDifferentType, {
    kind: 'object',
    systemId: afterSecond.id,
    objectId: first.id,
  })
  const afterDeletion = deletion.workspace.cluster.systems[0]
  if (!afterDeletion) throw new Error('Expected the system to survive object deletion.')

  const recreated = createSystemObject(afterDeletion, 'planet')
  const survivingNames = afterDeletion.objects.map(object => object.name)
  expect(recreated.name).toBe('New planet 4')
  expect(survivingNames).not.toContain(recreated.name)
  expect(afterDeletion.objects.map(object => object.id)).not.toContain(recreated.id)
  expect(recreated.description).toBe('')
  expect(recreated.placement.kind).toBe('system')
  if (recreated.placement.kind !== 'system') throw new Error('Expected fresh system-level placement.')
  expect(recreated.placement.x).toBeCloseTo(0.7)
  expect(recreated.placement.y).toBeCloseTo(0.1)
  expect(recreated.placement).not.toEqual(first.placement)
})

async function beginPlanetAdd(page: import('@playwright/test').Page): Promise<void> {
  await (await selectCatalogueObjectButton(page, 'planet')).click()
  await expect(page.getByRole('group', { name: 'Planet creation controls', exact: true })).toBeVisible()
}

async function addPlanetAt(page: import('@playwright/test').Page, point: Point): Promise<void> {
  const controls = page.getByRole('group', { name: 'Planet creation controls', exact: true })
  const placement = controls.getByRole('button', { name: 'Placement', exact: true })
  if (await placement.getAttribute('aria-expanded') !== 'true') await placement.click()
  await selectInspectorOption(page.getByLabel('Orbit placement', { exact: true }), 'Free map position')
  await page.getByLabel('Placement X', { exact: true }).fill(String(point.x))
  await page.getByLabel('Placement Y', { exact: true }).fill(String(point.y))
  await page.getByRole('form', { name: 'Placement', exact: true })
    .getByRole('button', { name: 'Add', exact: true }).click()
}

test('deleting and quickly recreating an object starts with fresh selection, session, name, and position', async ({ page }) => {
  test.slow()
  await captureMapExportBlobs(page)
  await createSingleSystemWorkspace(page, { viewport: { width: 1440, height: 960 } })

  const map = page.getByRole('group', { name: 'Vesper star system map', exact: true })
  const inspector = page.getByRole('complementary', { name: 'Object inspector', exact: true })
  const originalPoint = { x: 0.82, y: 0.74 }

  await beginPlanetAdd(page)
  await addPlanetAt(page, originalPoint)
  await expect(inspector.getByLabel('Name', { exact: true })).toHaveValue('New planet 1')
  await inspector.getByLabel('Name', { exact: true }).fill('Foo')
  await inspector.getByLabel('Description', { exact: true }).fill('Old object draft')
  await inspector.getByRole('button', { name: 'Apply changes Save map object', exact: true }).click()

  await beginPlanetAdd(page)
  await addPlanetAt(page, { x: 0.21, y: 0.31 })
  await expect(inspector.getByLabel('Name', { exact: true })).toHaveValue('New planet 2')
  const survivingObject = (await downloadJson(page, 'Export star system JSON')).system?.objects
    .find(object => object.subtype === 'planet' && object.name === 'New planet 2')
  expect(survivingObject).toBeDefined()

  const originalExport = await downloadJson(page, 'Export star system JSON')
  const originalObject = originalExport.system?.objects.find(object => object.name === 'Foo')
  expect(originalObject).toBeDefined()
  expect(originalObject?.placement).toEqual({ kind: 'system', ...originalPoint })
  expect(originalObject?.description).toBe('Old object draft')

  await setWorkspaceMapMode(page, 'Select')
  const hierarchy = await openWorkspaceHierarchy(page)
  await hierarchy.getByRole('button', { name: /^Select PL-\d+, Foo$/ }).click()
  await inspector.getByRole('button', { name: 'Delete Foo', exact: true }).click()
  const review = deletionReviewDialog(page)
  await expect(review).toContainText('Foo')
  await resolveDeletionReview(review, 'confirm')
  await expect(map.locator('.system-object')).toHaveCount(2)
  await expect(page.locator('.entity-inspector')).toHaveCount(0)

  // Recreate immediately at a new user-specified point. The generated name must also avoid the
  // surviving New planet 2, whose numeric suffix used to collide after deleting Foo.
  await beginPlanetAdd(page)
  const newPoint = { x: 0.63, y: 0.67 }
  await addPlanetAt(page, newPoint)

  await expect(inspector.getByLabel('Name', { exact: true })).not.toHaveValue('Foo')
  await expect(inspector.getByLabel('Description', { exact: true })).toHaveValue('')
  const recreatedExport = await downloadJson(page, 'Export star system JSON')
  const recreatedObject = recreatedExport.system?.objects.find(object => object.subtype === 'planet'
    && object.id !== survivingObject?.id)
  expect(recreatedObject).toBeDefined()
  expect(recreatedObject?.id).not.toBe(originalObject?.id)
  expect(recreatedObject?.name).not.toBe('Foo')
  expect(recreatedObject?.name).not.toBe(survivingObject?.name)
  expect(recreatedObject?.description).toBe('')
  expect(recreatedObject?.placement).toEqual({ kind: 'system', ...newPoint })
  expect(recreatedObject?.placement).not.toEqual({ kind: 'system', ...originalPoint })
  expect(recreatedExport.system?.objects.filter(object => object.subtype === 'planet'
    && object.name === recreatedObject?.name)).toHaveLength(1)
  await expect(map.locator('.system-object')).toHaveCount(3)
})
