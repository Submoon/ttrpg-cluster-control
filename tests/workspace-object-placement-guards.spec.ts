import { expect, test } from './fixtures'
import {
  captureMapExportBlobs,
  createSingleSystemWorkspace,
  downloadJson,
  quitSystemAdd,
  selectCatalogueObjectButton,
  setWorkspaceMapMode,
  wardenLocalCoordinates,
  wardenMap,
  wardenObjectMark,
  workspaceNavigation,
} from './helpers'



test('Add can create a free object from the visible map center with the keyboard', async ({ page }) => {
  await captureMapExportBlobs(page)
  const { systemId } = await createSingleSystemWorkspace(page, { viewport: { width: 1440, height: 960 } })
  const map = wardenMap(page)
  const initial = await downloadJson(page, 'Export Jump Cluster JSON')
  const initialOwner = initial.cluster?.systems.find(system => system.id === systemId)
  if (!initialOwner) throw new Error('The new workspace is missing its initial owner.')
  const addPlanet = await selectCatalogueObjectButton(page, 'planet')
  await addPlanet.press('Enter')
  const addStatus = page.getByRole('navigation', { name: 'Map context and commands', exact: true })
    .locator('.workspace-add-status')
  await expect(addStatus).toContainText(/planet/i)
  const mapContent = map.locator('.cluster-map-content')
  const transformBeforePan = await mapContent.getAttribute('transform')
  await map.press('ArrowRight')
  await expect(mapContent).not.toHaveAttribute('transform', transformBeforePan ?? '')
  const rect = await map.boundingBox()
  if (!rect) throw new Error('The Warden map has no visible canvas center.')
  const coordinates = await wardenLocalCoordinates(page, systemId)
  const local = coordinates.fromClient({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 })
  const expectedPosition = { x: (local.x - 64) / 832, y: (local.y - 72) / 416 }

  await map.press('Enter')
  const marks = map.locator(`.continuous-warden-object[data-system-id="${systemId}"]`)
  await expect(marks).toHaveCount(initialOwner.objects.length + 1)
  const created = await downloadJson(page, 'Export Jump Cluster JSON')
  const addedObjects = created.cluster?.systems.find(system => system.id === systemId)?.objects
    .filter(object => !initialOwner.objects.some(existing => existing.id === object.id)) ?? []
  expect(addedObjects).toHaveLength(1)
  const addedObject = addedObjects[0]
  if (!addedObject || addedObject.placement.kind !== 'system') {
    throw new Error('Keyboard creation did not place the new object freely on the map.')
  }
  expect(addedObject.placement.x).toBeCloseTo(expectedPosition.x, 4)
  expect(addedObject.placement.y).toBeCloseTo(expectedPosition.y, 4)
  await quitSystemAdd(page)
  await setWorkspaceMapMode(page, 'Move')

  await wardenObjectMark(page, systemId, addedObject.id).press('Enter')
  const placement = workspaceNavigation(page).getByRole('button', { name: 'Placement', exact: true })
  await placement.press('Enter')
  const placementForm = page.getByRole('form', { name: 'Object placement', exact: true })
  await placementForm.getByRole('button', { name: 'Move on map', exact: true }).press('Enter')
  await map.press('ArrowRight')
  await placement.press('Enter')
  const confirm = placementForm.getByRole('button', { name: 'Confirm position', exact: true })
  await expect(confirm).toBeVisible()
  await confirm.press('Enter')
  const keyboardMoved = await downloadJson(page, 'Export Jump Cluster JSON')
  const moved = keyboardMoved.cluster?.systems.find(system => system.id === systemId)?.objects
    .find(object => object.id === addedObject.id)
  if (!moved || moved.placement.kind !== 'system') throw new Error('Keyboard movement lost the new free object.')
  expect(moved.placement.x).not.toBe(addedObject.placement.x)
  expect(moved.placement.y).toBe(addedObject.placement.y)
})
