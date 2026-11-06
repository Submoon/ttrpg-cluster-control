import { expect, test } from './fixtures'
import {
  captureMapExportBlobs,
  downloadJson,
  quitSystemAdd,
  selectCatalogueObjectButton,
  setWorkspaceMapMode,
  workspaceNavigation,
} from './helpers'



test('Add can create a free object from the visible map center with the keyboard', async ({ page }) => {
  await captureMapExportBlobs(page)
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const map = page.getByRole('group', { name: 'Vesper star system map', exact: true })
  const initial = await downloadJson(page, 'Export star system JSON')
  const existingObjectCount = initial.system?.objects.length ?? 0
  const addPlanet = await selectCatalogueObjectButton(page, 'planet')
  await addPlanet.press('Enter')
  await expect(page.getByRole('group', { name: 'Planet creation controls', exact: true })).toBeVisible()
  await map.focus()
  const mapContent = map.locator('.system-map-content')
  const transformBeforePan = await mapContent.getAttribute('transform')
  for (let step = 0; step < 12; step += 1) await map.press('ArrowRight')
  await expect(mapContent).not.toHaveAttribute('transform', transformBeforePan ?? '')
  const expectedPosition = await map.evaluate(element => {
    const content = element.querySelector<SVGGElement>('.system-map-content')
    const inverse = content?.getScreenCTM()?.inverse()
    if (!inverse) throw new Error('The system-map scene is not ready for keyboard creation.')
    const bounds = element.getBoundingClientRect()
    const center = new DOMPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2)
      .matrixTransform(inverse)
    return { x: (center.x - 64) / 832, y: (center.y - 72) / 416 }
  })

  await map.press('Enter')
  await expect(map.locator('.system-object')).toHaveCount(existingObjectCount + 1)
  const created = await downloadJson(page, 'Export star system JSON')
  const addedObjects = created.system?.objects.filter(object =>
    !initial.system?.objects.some(existing => existing.id === object.id),
  ) ?? []
  expect(addedObjects).toHaveLength(1)
  const addedObject = addedObjects[0]
  if (!addedObject || addedObject.placement.kind !== 'system') {
    throw new Error('Keyboard creation did not place the new object freely on the map.')
  }
  expect(addedObject.placement.x).toBeCloseTo(expectedPosition.x)
  expect(addedObject.placement.y).toBeCloseTo(expectedPosition.y)
  await quitSystemAdd(page)
  await setWorkspaceMapMode(page, 'Move')

  const objectSelector = map.getByRole('button', {
    name: new RegExp(`^Select ${addedObject.locationKey}, ${addedObject.name}`),
  })
  await objectSelector.press('Enter')
  const placement = workspaceNavigation(page).getByRole('button', { name: 'Placement', exact: true })
  await placement.press('Enter')
  const placementForm = page.getByRole('form', { name: 'Object placement', exact: true })
  await placementForm.getByRole('button', { name: 'Move on map', exact: true }).press('Enter')
  await expect(map).toHaveAttribute('data-system-object-move-targeting', 'true')
  await map.press('ArrowRight')
  await placement.press('Enter')
  const confirm = placementForm.getByRole('button', { name: 'Confirm position', exact: true })
  await expect(confirm).toBeVisible()
  await confirm.press('Enter')
  const keyboardMoved = await downloadJson(page, 'Export star system JSON')
  const moved = keyboardMoved.system?.objects.find(object => object.id === addedObject.id)
  if (!moved || moved.placement.kind !== 'system') throw new Error('Keyboard movement lost the new free object.')
  expect(moved.placement.x).not.toBe(addedObject.placement.x)
  expect(moved.placement.y).toBe(addedObject.placement.y)
})
