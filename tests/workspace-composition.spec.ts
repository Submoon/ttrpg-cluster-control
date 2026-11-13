import { expect, test, type Page } from './fixtures'

async function createWorkspace(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await expect(page.getByRole('region', { name: 'System map workspace' })).toBeVisible()
}


test('overlay panels resize by pointer and keyboard without changing their mounted trees or the map camera', async ({ page }) => {
  await createWorkspace(page)

  await page.getByRole('toolbar', { name: 'Workspace navigation' })
    .getByRole('button', { name: 'Select', exact: true }).click()
  const primaryStar = page.locator('.system-map-items .system-object').first()
  await expect(primaryStar).toBeVisible()
  await primaryStar.click()
  await page.getByRole('button', { name: 'Edit map object' }).click()
  const objectNameField = page.getByLabel('Name', { exact: true })
  await objectNameField.fill('Draft retained through panel reset')
  await expect(objectNameField).toHaveValue('Draft retained through panel reset')
  const objectEditorForm = page.locator('#workspace-inspector-panel form')
  const retainedObjectEditor = await objectEditorForm.elementHandle()
  if (!retainedObjectEditor) throw new Error('The selected object editor did not mount.')

  const hierarchy = page.getByRole('complementary', { name: 'System hierarchy' })
  const hierarchyToggle = page.getByRole('button', { name: 'Hierarchy', exact: true })
  await expect(hierarchy).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'Object inspector' })).toBeVisible()

  const hierarchyHandle = page.getByRole('separator', { name: 'Resize system hierarchy panel' })
  const inspectorHandle = page.getByRole('separator', { name: 'Resize object inspector panel' })
  await expect(hierarchyHandle).toBeVisible()
  await expect(inspectorHandle).toBeVisible()
  await expect.poll(() => page.locator('.system-map-content').getAttribute('transform')).not.toBeNull()
  const initialCamera = await page.locator('.system-map-content').getAttribute('transform')

  const hierarchyBeforeKeyboard = Number(await hierarchyHandle.getAttribute('aria-valuenow'))
  await hierarchyHandle.focus()
  await page.keyboard.press('ArrowRight')
  await expect(hierarchyHandle).toHaveAttribute('aria-valuenow', String(hierarchyBeforeKeyboard + 16))

  const hierarchyBoundsBeforeDrag = await hierarchy.boundingBox()
  const hierarchyHandleBounds = await hierarchyHandle.boundingBox()
  if (!hierarchyBoundsBeforeDrag || !hierarchyHandleBounds) throw new Error('The hierarchy panel resize handle has no bounds.')
  await page.mouse.move(hierarchyHandleBounds.x + hierarchyHandleBounds.width / 2, hierarchyHandleBounds.y + hierarchyHandleBounds.height / 2)
  await page.mouse.down()
  await page.mouse.move(hierarchyHandleBounds.x + hierarchyHandleBounds.width / 2 + 28, hierarchyHandleBounds.y + hierarchyHandleBounds.height / 2)
  await page.mouse.up()
  const hierarchyAfterDrag = Number(await hierarchyHandle.getAttribute('aria-valuenow'))
  expect(hierarchyAfterDrag).toBeGreaterThan(hierarchyBeforeKeyboard + 16)
  expect((await hierarchy.boundingBox())?.width).toBeGreaterThan(hierarchyBoundsBeforeDrag.width)

  const retainedHierarchy = await hierarchy.elementHandle()
  await hierarchyToggle.click()
  await expect(hierarchy).toBeHidden()
  expect(await retainedHierarchy?.evaluate(element => element.isConnected)).toBe(true)
  await hierarchyToggle.click()
  await expect(hierarchyHandle).toHaveAttribute('aria-valuenow', String(hierarchyAfterDrag))

  const inspector = page.getByRole('complementary', { name: 'Object inspector' })
  const inspectorBoundsBefore = await inspector.boundingBox()
  const inspectorBeforeKeyboard = Number(await inspectorHandle.getAttribute('aria-valuenow'))
  await inspectorHandle.focus()
  await page.keyboard.press('ArrowLeft')
  await expect(inspectorHandle).toHaveAttribute('aria-valuenow', String(inspectorBeforeKeyboard + 16))

  const inspectorHandleBounds = await inspectorHandle.boundingBox()
  if (!inspectorBoundsBefore || !inspectorHandleBounds) throw new Error('The inspector panel resize handle has no bounds.')
  await page.mouse.move(inspectorHandleBounds.x + inspectorHandleBounds.width / 2, inspectorHandleBounds.y + inspectorHandleBounds.height / 2)
  await page.mouse.down()
  await page.mouse.move(inspectorHandleBounds.x + inspectorHandleBounds.width / 2 - 28, inspectorHandleBounds.y + inspectorHandleBounds.height / 2)
  await page.mouse.up()
  expect(Number(await inspectorHandle.getAttribute('aria-valuenow'))).toBeGreaterThan(inspectorBeforeKeyboard + 16)
  expect((await inspector.boundingBox())?.width).toBeGreaterThan(inspectorBoundsBefore.width)
  expect(await page.locator('.system-map-content').getAttribute('transform')).toBe(initialCamera)

  await inspectorHandle.dblclick()
  await expect(inspectorHandle).toHaveAttribute('aria-valuenow', '360')
  await expect(objectNameField).toHaveValue('Draft retained through panel reset')
  expect(await retainedObjectEditor.evaluate(element => element.isConnected
    && element === document.querySelector('#workspace-inspector-panel form'))).toBe(true)
  expect(await page.locator('.system-map-content').getAttribute('transform')).toBe(initialCamera)

  await page.setViewportSize({ width: 1320, height: 850 })
  await expect.poll(() => page.locator('.system-map-content').getAttribute('transform')).toBe(initialCamera)
  await expect(objectNameField).toHaveValue('Draft retained through panel reset')
})
