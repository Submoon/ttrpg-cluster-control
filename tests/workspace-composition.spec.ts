import { expect, test, type Page } from './fixtures'

async function createWorkspace(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await expect(page.getByRole('region', { name: 'System map workspace' })).toBeVisible()
}

test('a first workspace visit keeps the full map board open with a bottom mode Dock', async ({ page }) => {
  const viewport = { width: 1440, height: 900 }
  await createWorkspace(page)

  const hierarchy = page.getByRole('complementary', { name: 'System hierarchy' })
  const map = page.getByRole('region', { name: 'System map workspace' })
  const dock = page.getByRole('toolbar', { name: 'Workspace navigation' })
  const mapScene = page.locator('.system-map-content')

  await expect(hierarchy).toBeHidden()
  await expect(map).toBeVisible()
  await expect(dock).toBeVisible()

  const mapBounds = await map.boundingBox()
  const dockBounds = await dock.boundingBox()
  if (!mapBounds || !dockBounds) throw new Error('The first-visit map board or mode Dock has no bounds.')

  expect(mapBounds.width).toBeGreaterThan(viewport.width * 0.8)
  expect(dockBounds.y + dockBounds.height / 2).toBeGreaterThan(mapBounds.y + mapBounds.height / 2)

  await expect.poll(() => mapScene.getAttribute('transform')).not.toBeNull()
  await page.evaluate(() => new Promise<void>(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  }))
  const firstFitIsClear = async () => page.evaluate(() => {
    const targets = [...document.querySelectorAll<SVGElement>(
      '.system-map-items .system-object, .system-orbits .orbit-mark',
    )].map(element => element.getBoundingClientRect())
    const obstructions = [...document.querySelectorAll<HTMLElement>('[data-map-obstruction]')]
      .filter(element => {
        const rect = element.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0
      })
      .map(element => element.getBoundingClientRect())
    return targets.length > 0 && obstructions.length > 0 && targets.every(target => obstructions.every(obstruction =>
      target.right <= obstruction.left || target.left >= obstruction.right
      || target.bottom <= obstruction.top || target.top >= obstruction.bottom))
  })
  await expect.poll(firstFitIsClear, { timeout: 5000 }).toBe(true)

  const sceneTargets = await page.locator('.system-map-items .system-object, .system-orbits .orbit-mark').evaluateAll(elements => elements
    .map(element => {
      const rect = element.getBoundingClientRect()
      return { name: element.getAttribute('aria-label'), left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }
    })
    .filter(rect => rect.right > rect.left && rect.bottom > rect.top))
  const obstructionBounds = await page.locator('[data-map-obstruction]').evaluateAll(elements => elements
    .map(element => {
      const rect = element.getBoundingClientRect()
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }
    })
    .filter(rect => rect.right > rect.left && rect.bottom > rect.top))
  expect(obstructionBounds.length).toBeGreaterThan(0)
  expect(sceneTargets.length).toBeGreaterThan(0)
  for (const target of sceneTargets) {
    for (const obstruction of obstructionBounds) {
      const overlaps = target.left < obstruction.right
        && target.right > obstruction.left
        && target.top < obstruction.bottom
        && target.bottom > obstruction.top
      expect(overlaps, `A first-fit map target overlaps obstruction ${JSON.stringify({ target, obstruction })}`).toBe(false)
    }
  }
})

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
  await expect(hierarchy).toBeHidden()
  await hierarchyToggle.click()
  await expect(hierarchy).toBeVisible()

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

test('a second touch cannot take over an active panel-resize pointer', async ({ page }) => {
  await createWorkspace(page)
  await page.getByRole('button', { name: 'Hierarchy', exact: true }).click()

  const handle = page.getByRole('separator', { name: 'Resize system hierarchy panel' })
  await expect(handle).toBeVisible()
  const initialWidth = Number(await handle.getAttribute('aria-valuenow'))
  const initialHandleBounds = await handle.boundingBox()
  if (!initialHandleBounds) throw new Error('The hierarchy resize handle has no bounds.')
  const start = {
    id: 1,
    x: initialHandleBounds.x + initialHandleBounds.width / 2,
    y: initialHandleBounds.y + initialHandleBounds.height / 2,
  }

  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 })
  await page.evaluate(() => {
    const target = window as unknown as { __workspaceResizePointerIds: number[] }
    target.__workspaceResizePointerIds = []
    document.addEventListener('pointerdown', event => {
      if (event.target instanceof Element && event.target.closest('.workspace-panel-resize-handle')) {
        target.__workspaceResizePointerIds.push(event.pointerId)
      }
    }, true)
  })

  try {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] })
    const firstPointerId = await page.evaluate(() =>
      (window as unknown as { __workspaceResizePointerIds: number[] }).__workspaceResizePointerIds[0],
    )
    if (firstPointerId === undefined) throw new Error('The first real touch did not produce a resize-handle pointerdown.')
    await expect.poll(() => handle.getAttribute('aria-valuenow')).toBe(String(initialWidth))

    const firstMove = { ...start, x: start.x + 24 }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [firstMove] })
    await expect(handle).toHaveAttribute('aria-valuenow', String(initialWidth + 24))
    expect(await handle.evaluate((element, pointerId) => element.hasPointerCapture(pointerId), firstPointerId)).toBe(true)

    const currentHandleBounds = await handle.boundingBox()
    if (!currentHandleBounds) throw new Error('The hierarchy resize handle disappeared after the first touch moved it.')
    const secondTouch = {
      id: 2,
      x: currentHandleBounds.x + currentHandleBounds.width / 2 + 3,
      y: currentHandleBounds.y + currentHandleBounds.height / 2,
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [firstMove, secondTouch] })
    await expect.poll(() => page.evaluate(() =>
      (window as unknown as { __workspaceResizePointerIds: number[] }).__workspaceResizePointerIds.length,
    )).toBe(2)
    expect(await handle.evaluate((element, pointerId) => element.hasPointerCapture(pointerId), firstPointerId)).toBe(true)

    const firstMoveContinued = { ...firstMove, x: start.x + 40 }
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [firstMoveContinued, secondTouch],
    })
    await expect(handle).toHaveAttribute('aria-valuenow', String(initialWidth + 40))
  } finally {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false })
    await cdp.detach()
  }
})
