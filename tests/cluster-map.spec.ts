import { expect, test } from './fixtures'
import { waitForWorkspaceSaved, readInspectorSelection, selectInspectorOption } from './helpers'
import { addClusterSystem, ensureMapDragPointsReachable, returnToClusterMap, openWorkspaceHierarchy, workspaceZoomControls, workspaceZoomOutput, clickDockAction, setWorkspaceMapMode } from './helpers'
import { dragToWorldPoint, dragOrbitToWorldPoint, panMap, dragBy, editMapObject, saveMapObject, addCatalogueObject } from './helpers'

async function orbitalAngle(map: import('@playwright/test').Locator): Promise<number> {
  return map.evaluate((element) => {
    const objects = [...element.querySelectorAll<SVGGElement>('.system-object')]
    const host = objects.find(object => object.getAttribute('aria-label')?.includes('Primary Star'))
    const planet = objects.find(object => object.getAttribute('aria-label')?.includes('Iria'))
    if (!host || !planet) throw new Error('Could not locate the star and orbiting object.')

    const center = (object: SVGGElement) => {
      const transform = object.getScreenCTM()
      if (!transform) throw new Error('An orbital object is not attached to the map.')
      return new DOMPoint(0, 0).matrixTransform(transform)
    }
    const hostCenter = center(host)
    const planetCenter = center(planet)
    return Math.atan2(
      planetCenter.y - hostCenter.y,
      planetCenter.x - hostCenter.x,
    )
  })
}

async function historyUndoDepth(page: import('@playwright/test').Page): Promise<number> {
  const undo = page.getByRole('group', { name: 'Edit history' })
    .getByRole('button', { name: /^Undo(?:$|:)/ })
  const description = await undo.getAttribute('aria-description')
  const match = description?.match(/^(\d+)/)
  if (!match) throw new Error(`Could not read the Undo depth from "${description}".`)
  return Number(match[1])
}

test('the Warden can navigate and arrange both maps', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  await returnToClusterMap(page)
  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  const clusterZoomControls = workspaceZoomControls(page)
  const clusterZoom = workspaceZoomControls(page).locator('output').first()
  await expect(clusterZoom).toHaveText(/^\d+%$/)
  const initialClusterZoom = Number((await clusterZoom.textContent())?.replace('%', ''))
  await clusterZoomControls.getByRole('button', { name: 'Zoom in' }).click()
  await expect.poll(async () => Number((await clusterZoom.textContent())?.replace('%', '')))
    .toBeGreaterThan(initialClusterZoom)

  const clusterBounds = await clusterMap.boundingBox()
  if (!clusterBounds) throw new Error('The Jump Cluster map is not visible.')
  await page.mouse.move(
    clusterBounds.x + clusterBounds.width / 2,
    clusterBounds.y + clusterBounds.height / 2,
  )
  await page.mouse.wheel(0, -150)
  await expect.poll(async () => Number((await clusterZoom.textContent())?.replace('%', '')))
    .toBeGreaterThan(initialClusterZoom)
  await page.mouse.wheel(0, -5000)
  await expect(clusterZoom).toHaveText('1600%')
  await page.mouse.wheel(0, 5000)
  await expect(clusterZoom).toHaveText('25%')
  await clusterZoomControls.getByRole('button', { name: 'Fit map' }).click()
  await expect.poll(async () => Number((await clusterZoom.textContent())?.replace('%', '')))
    .toBeGreaterThan(25)

  const clusterContent = clusterMap.locator('.cluster-map-content')
  const beforePan = await clusterContent.getAttribute('transform')
  await panMap(page, clusterMap, { x: 36, y: 24 })
  await expect(clusterContent).not.toHaveAttribute('transform', beforePan!)

  await setWorkspaceMapMode(page, 'Navigate')
  const systemNode = clusterMap.getByRole('button', { name: 'Open Vesper system map' })
  const nodeBeforeDrag = await systemNode.getAttribute('transform')
  await dragBy(page, systemNode.locator('.cluster-system-card'), { x: 48, y: 24 })
  const movedSystemNode = clusterMap.getByRole('button', { name: 'Select Vesper system' })
  await expect(movedSystemNode).not.toHaveAttribute('transform', nodeBeforeDrag!)
  const nodeAfterDrag = await movedSystemNode.getAttribute('transform')
  await waitForWorkspaceSaved(page)

  await page.reload()
  await returnToClusterMap(page)
  await setWorkspaceMapMode(page, 'Navigate')
  const restoredClusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  const restoredNode = restoredClusterMap.getByRole('button', { name: 'Open Vesper system map' })
  await expect(restoredNode).toHaveAttribute('transform', nodeAfterDrag!)
  await expect(workspaceZoomOutput(page)).toHaveText(/^\d+%$/)
  await restoredNode.click()

  const map = page.getByRole('group', { name: 'Vesper star system map' })
  const hierarchy = await openWorkspaceHierarchy(page)
  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  await clickDockAction(page, 'Add orbit', { target: { kind: 'host', name: 'Primary Star' } })
  await addCatalogueObject(page, 'planet', {
    target: { kind: 'orbit', label: 'Orbit 1 around Primary Star' },
  })
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Iria')
  await saveMapObject(page)

  const planet = map.getByRole('button', { name: /Select PL-01, Iria/ })
  const resizeDestination = {
    x: 480 + 112 * Math.SQRT1_2,
    y: 280 - 112 * Math.SQRT1_2,
  }
  await ensureMapDragPointsReachable(page, map, planet.locator('.object-hit-target'), resizeDestination)
  const history = page.getByRole('group', { name: 'Edit history' })
  const undo = history.getByRole('button', { name: /^Undo(?:$|:)/ })
  const historyDepthBeforePlacement = await historyUndoDepth(page)
  await dragToWorldPoint(page, map, planet.locator('.object-hit-target'), resizeDestination)
  await expect.poll(() => historyUndoDepth(page)).toBeGreaterThan(historyDepthBeforePlacement)
  await expect(undo).toHaveAccessibleName('Undo: Place Iria in Orbit · Iria · Vesper')
  await waitForWorkspaceSaved(page)
  const angleBeforeResize = await orbitalAngle(map)
  const orbitRadius = map.getByRole('slider', { name: 'Resize Orbit 1 around Primary Star' })
  const radiusBeforeResize = Number(await orbitRadius.getAttribute('rx'))
  const uniformResizeStartAngle = 0.5
  await workspaceZoomControls(page).getByRole('button', { name: 'Fit map' }).click()
  await dragOrbitToWorldPoint(page, orbitRadius, {
    x: 480 + 153 * Math.cos(uniformResizeStartAngle),
    y: 280 + 153 * Math.sin(uniformResizeStartAngle),
  }, uniformResizeStartAngle)
  await expect.poll(async () => {
    const horizontalRadius = Number(await orbitRadius.getAttribute('rx'))
    const verticalRadius = Number(await orbitRadius.getAttribute('ry'))
    return horizontalRadius > radiusBeforeResize && horizontalRadius === verticalRadius
  }).toBe(true)
  const resizedOrbitRadius = Number(await orbitRadius.getAttribute('aria-valuenow'))
  expect(Math.abs(await orbitalAngle(map) - angleBeforeResize)).toBeLessThan(0.02)

  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  await clickDockAction(page, 'Add orbit', { target: { kind: 'host', name: 'Primary Star' } })
  await setWorkspaceMapMode(page, 'Move')
  const largeOrbitRadius = map.getByRole('slider', { name: 'Resize Orbit 2 around Primary Star' })
  await largeOrbitRadius.press('End')
  await expect(largeOrbitRadius).toHaveAttribute('aria-valuenow', '570')
  await page.keyboard.press('ArrowRight')
  await expect(largeOrbitRadius).toHaveAttribute('aria-valuenow', '571')

  await addCatalogueObject(page, 'hazard', {
    target: { kind: 'orbit', label: 'Orbit 2 around Primary Star' },
  })
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Glass Wake')
  await saveMapObject(page)
  const hazard = map.getByRole('button', { name: /Glass Wake/ })
  await dragToWorldPoint(page, map, hazard.locator('.object-hit-target'), { x: 230, y: 180 })
  const hazardTransform = await hazard.getAttribute('transform')
  await waitForWorkspaceSaved(page)

  const systemNavigation = workspaceZoomControls(page)
  const systemZoom = systemNavigation.locator('output').first()
  await expect(systemZoom).toHaveText(/^\d+%$/)
  const initialSystemZoom = Number((await systemZoom.textContent())?.replace('%', ''))
  await systemNavigation.getByRole('button', { name: 'Zoom in' }).click()
  await expect.poll(async () => Number((await systemZoom.textContent())?.replace('%', '')))
    .toBeGreaterThan(initialSystemZoom)
  const systemBounds = await map.boundingBox()
  if (!systemBounds) throw new Error('The star system map is not visible.')
  await page.mouse.move(
    systemBounds.x + systemBounds.width / 2,
    systemBounds.y + systemBounds.height / 2,
  )
  await page.mouse.wheel(0, -150)
  await expect.poll(async () => Number((await systemZoom.textContent())?.replace('%', '')))
    .toBeGreaterThan(initialSystemZoom)
  await page.mouse.wheel(0, -5000)
  await expect(systemZoom).toHaveText('1600%')
  await page.mouse.wheel(0, 5000)
  await expect(systemZoom).toHaveText('25%')
  await systemNavigation.getByRole('button', { name: 'Fit map' }).click()
  await expect.poll(async () => Number((await systemZoom.textContent())?.replace('%', '')))
    .toBeGreaterThan(25)
  await expect(systemZoom).toHaveText(/^\d+%$/)
  const fittedMapBounds = await map.boundingBox()
  const fittedOrbitBounds = await map.getByRole('group', { name: 'Orbit 2 around Primary Star' })
    .locator('.orbit-ring').boundingBox()
  if (!fittedMapBounds || !fittedOrbitBounds) throw new Error('The fitted Orbit is not visible.')
  expect(fittedOrbitBounds.x).toBeGreaterThanOrEqual(fittedMapBounds.x)
  expect(fittedOrbitBounds.x + fittedOrbitBounds.width)
    .toBeLessThanOrEqual(fittedMapBounds.x + fittedMapBounds.width)
  expect(fittedOrbitBounds.y).toBeGreaterThanOrEqual(fittedMapBounds.y)
  expect(fittedOrbitBounds.y + fittedOrbitBounds.height)
    .toBeLessThanOrEqual(fittedMapBounds.y + fittedMapBounds.height)
  const systemContent = map.locator('.system-map-content')
  const systemBeforePan = await systemContent.getAttribute('transform')
  await panMap(page, map, { x: 24, y: 18 })
  await expect(systemContent).not.toHaveAttribute('transform', systemBeforePan!)

  await page.reload()
  await setWorkspaceMapMode(page, 'Move')
  const restoredMap = page.getByRole('group', { name: 'Vesper star system map' })
  await expect(restoredMap.getByRole('slider', { name: 'Resize Orbit 1 around Primary Star' }))
    .toHaveAttribute('aria-valuenow', String(resizedOrbitRadius))
  await expect(restoredMap.getByRole('slider', { name: 'Resize Orbit 2 around Primary Star' }))
    .toHaveAttribute('aria-valuenow', '571')
  await expect(workspaceZoomOutput(page)).toHaveText(/^\d+%$/)
  await expect(restoredMap.getByRole('button', { name: /Glass Wake/ }))
    .toHaveAttribute('transform', hazardTransform!)
  expect(Math.abs(await orbitalAngle(restoredMap) - angleBeforeResize)).toBeLessThan(0.02)
})

test('the Jump Route line follows a system while it is being dragged', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  await addCatalogueObject(page, 'jump-point')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Departure')
  await saveMapObject(page)

  await returnToClusterMap(page)
  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await addClusterSystem(page, { open: true })
  const newSystemMap = page.getByRole('group', { name: 'New System 2 star system map' })
  await expect(newSystemMap).toBeVisible()
  await addCatalogueObject(page, 'jump-point')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Arrival')
  await saveMapObject(page)

  await returnToClusterMap(page)
  await clickDockAction(page, 'Add Jump Route')
  await selectInspectorOption(page.getByLabel('From Jump Point'), 'Departure (Vesper)')
  await selectInspectorOption(page.getByLabel('Route destination'), 'Known Jump Point')
  await selectInspectorOption(page.getByLabel('To Jump Point'), 'Arrival (New System 2)')
  await page.getByRole('button', { name: 'Create Jump Route' }).click()

  const routeMark = clusterMap.getByRole('button', { name: /Jump Level 1.*Departure.*Arrival/ })
  const routeLine = routeMark.locator('.cluster-route-line')
  const routeBefore = await routeLine.getAttribute('d')
  await setWorkspaceMapMode(page, 'Navigate')
  const sourceNode = clusterMap.getByRole('button', { name: 'Open Vesper system map' })
  const nodeBefore = await sourceNode.getAttribute('transform')
  const source = clusterMap.getByRole('button', { name: 'Open Vesper system map' })
    .locator('.cluster-system-card')
  const sourceBox = await source.boundingBox()
  if (!routeBefore || !nodeBefore || !sourceBox) throw new Error('Could not locate the route or its source system.')

  await setWorkspaceMapMode(page, 'Move')
  const movedSourceNode = clusterMap.getByRole('button', { name: 'Select Vesper system' })
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 100, sourceBox.y + sourceBox.height / 2 + 30, { steps: 4 })
  await expect.poll(async () => movedSourceNode.getAttribute('transform'))
    .not.toBe(nodeBefore)
  await expect.poll(async () => routeLine.getAttribute('d'))
    .not.toBe(routeBefore)
  await page.mouse.up()
})

test('keyboard system selection keeps focus on its logical cluster mark after redraw', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await returnToClusterMap(page)
  await setWorkspaceMapMode(page, 'Select')

  const map = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  const system = map.getByRole('button', { name: 'Select Vesper system' })
  await system.focus()
  await page.keyboard.press('Enter')

  await expect(map.getByRole('button', { name: 'Select Vesper system' })).toBeFocused()
})

test('cluster blur cancels a replacement mouse drag and a later drag still works', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await returnToClusterMap(page)
  await setWorkspaceMapMode(page, 'Move')

  const map = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  const system = map.getByRole('button', { name: 'Select Vesper system' })
  const bounds = await system.boundingBox()
  if (!bounds) throw new Error('Could not find the system card for the cancellation test.')
  const originalTransform = await system.getAttribute('transform')
  const selectionStateBefore = await page.evaluate(() => ({
    mozUserSelect: document.documentElement.style.getPropertyValue('-moz-user-select'),
    hasSavedMozUserSelect: Object.hasOwn(document.documentElement, '__noselect'),
  }))
  const start = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + 72, start.y + 36, { steps: 4 })
  await expect.poll(() => system.getAttribute('transform')).not.toBe(originalTransform)

  // A second mousedown replaces D3's window transport before its start callback runs.
  // The first drag's cancellation must leave the replacement transport owned by the second drag.
  await system.evaluate((element, point) => {
    element.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      button: 0,
      buttons: 1,
      clientX: point.x,
      clientY: point.y,
      view: window,
    }))
  }, start)

  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await expect(system).toHaveAttribute('transform', originalTransform!)
  const remainingD3DragResources = await page.evaluate(() => {
    const d3Window = window as Window & { __on?: Array<{ type: string; name: string }> }
    const listeners = (d3Window.__on ?? [])
      .filter(listener => listener.name === 'drag'
        && ['mousemove', 'mouseup', 'dragstart', 'selectstart'].includes(listener.type))
      .map(listener => listener.type)
    return {
      listeners,
      mozUserSelect: document.documentElement.style.getPropertyValue('-moz-user-select'),
      hasSavedMozUserSelect: Object.hasOwn(document.documentElement, '__noselect'),
    }
  })
  expect(remainingD3DragResources.listeners).toEqual([])
  expect(remainingD3DragResources.mozUserSelect).toBe(selectionStateBefore.mozUserSelect)
  expect(remainingD3DragResources.hasSavedMozUserSelect).toBe(selectionStateBefore.hasSavedMozUserSelect)

  await page.mouse.up()
  await dragBy(page, system.locator('.cluster-system-card'), { x: 36, y: 20 })
  await expect(system).not.toHaveAttribute('transform', originalTransform!)
})

test('the Warden can connect Jump Points across a cluster and record an unresolved exit', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const hierarchy = await openWorkspaceHierarchy(page)

  await addCatalogueObject(page, 'jump-point')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Vesper Exit')
  await saveMapObject(page)

  await addCatalogueObject(page, 'station')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Vesper Gate')
  await saveMapObject(page)

  await hierarchy.getByRole('button', { name: /Vesper Exit/ }).click()
  await editMapObject(page)
  const station = page.getByLabel('Physical Station association')
  await selectInspectorOption(station, { label: /Vesper Gate/ })
  await saveMapObject(page)
  expect(await readInspectorSelection(station)).toMatch(/Vesper Gate/)
  await waitForWorkspaceSaved(page)

  await returnToClusterMap(page)
  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await addClusterSystem(page, { open: true })
  const newSystemMap = page.getByRole('group', { name: 'New System 2 star system map' })
  await expect(newSystemMap).toBeVisible()
  await addCatalogueObject(page, 'jump-point')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Harrow Entry')
  await saveMapObject(page)
  await returnToClusterMap(page)

  await clickDockAction(page, 'Add Jump Route')
  await page.getByRole('spinbutton', { name: 'Jump level' }).fill('3')
  await selectInspectorOption(page.getByLabel('From Jump Point'), 'Vesper Exit (Vesper)')
  await selectInspectorOption(page.getByLabel('Route destination'), 'Known Jump Point')
  await selectInspectorOption(page.getByLabel('To Jump Point'), 'Harrow Entry (New System 2)')
  await page.getByRole('button', { name: 'Create Jump Route' }).click()
  const routeInspector = page.getByRole('complementary', { name: 'Jump Route inspector' })
  const knownRoute = clusterMap.getByRole('button', {
    name: /Jump Level 3.*Vesper Exit.*Harrow Entry.*New System 2/,
  })
  await expect(knownRoute).toBeVisible()
  await setWorkspaceMapMode(page, 'Navigate')
  await setWorkspaceMapMode(page, 'Select')
  await workspaceZoomControls(page).getByRole('button', { name: 'Fit map' }).click()
  await knownRoute.locator('.cluster-route-label').click()
  await expect(routeInspector.getByRole('heading', { name: 'Jump Level 3', level: 2 })).toBeVisible()
  await expect(routeInspector.locator('.orbit-facts')).toContainText('New System 2')
  await routeInspector.getByRole('button', { name: 'Edit Jump Route' }).click()
  await expect(routeInspector.getByText('Destination system: New System 2')).toBeVisible()
  await page.getByRole('spinbutton', { name: 'Jump level' }).fill('12')
  await routeInspector.getByRole('button', { name: 'Apply Jump Route' }).click()
  const customLevelRoute = clusterMap.getByRole('button', {
    name: /Jump Level 12.*Vesper Exit.*Harrow Entry.*New System 2/,
  })
  await expect(customLevelRoute).toBeVisible()

  await setWorkspaceMapMode(page, 'Navigate')
  const vesperSystem = clusterMap.getByRole('button', { name: 'Open Vesper system map' })
  await workspaceZoomControls(page).getByRole('button', { name: 'Fit map' }).click()
  await vesperSystem.click()
  await hierarchy.getByRole('button', { name: /Vesper Exit/ }).click()
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Vesper Arrival')
  await saveMapObject(page)
  await returnToClusterMap(page)
  await expect(clusterMap.getByRole('button', {
    name: /Jump Level 12.*Vesper Arrival.*Harrow Entry.*New System 2/,
  })).toBeVisible()

  await clickDockAction(page, 'Add Jump Route')
  await page.getByRole('spinbutton', { name: 'Jump level' }).fill('15')
  await selectInspectorOption(page.getByLabel('From Jump Point'), 'Vesper Arrival (Vesper)')
  await selectInspectorOption(page.getByLabel('Route destination'), 'Unresolved external exit')
  await page.getByLabel('Unknown destination label').fill('Unknown Rim')
  await page.getByRole('button', { name: 'Create Jump Route' }).click()
  const unknownRoute = clusterMap.getByRole('button', {
    name: /Jump Level 15.*Vesper Arrival.*unknown destination.*Unknown Rim/i,
  })
  await expect(unknownRoute).toBeVisible()
  await setWorkspaceMapMode(page, 'Navigate')
  await setWorkspaceMapMode(page, 'Select')
  await workspaceZoomControls(page).getByRole('button', { name: 'Fit map' }).click()
  await unknownRoute.locator('.cluster-route-label').click()
  await expect(routeInspector.getByRole('heading', { name: 'Jump Level 15', level: 2 })).toBeVisible()
  await expect(routeInspector.getByText('Unknown destination: Unknown Rim', { exact: true })).toBeVisible()
  await setWorkspaceMapMode(page, 'Navigate')
  await expect(clusterMap.getByRole('button', { name: /Open .* system map/ })).toHaveCount(2)
  await waitForWorkspaceSaved(page)

  await page.reload()
  await returnToClusterMap(page)
  const restoredMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await expect(restoredMap.getByRole('button', {
    name: /Jump Level 12.*Vesper Arrival.*Harrow Entry.*New System 2/,
  })).toBeVisible()
  await expect(restoredMap.getByRole('button', {
    name: /Jump Level 15.*Vesper Arrival.*unknown destination.*Unknown Rim/i,
  })).toBeVisible()
  await setWorkspaceMapMode(page, 'Navigate')
  await restoredMap.getByRole('button', { name: 'Open Vesper system map' }).click()
  const restoredHierarchy = await openWorkspaceHierarchy(page)
  await restoredHierarchy.getByRole('button', { name: /Vesper Arrival/ }).click()
  expect(await readInspectorSelection(page.getByLabel('Physical Station association'))).toMatch(/Vesper Gate/)
})
