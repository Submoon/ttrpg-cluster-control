import { expect, test } from '@playwright/test'
import { dragToWorldPoint, beginDragToWorldPoint, dragHtmlElementToWorldPoint, dragOrbitToWorldPoint, panMap, setHeaderMapActionsOpen, downloadJson, editMapObject, saveMapObject, downloadImage, setJsonFile, selectCatalogueObjectButton, addCatalogueObject } from './helpers'
import type { WorldPoint, DownloadWindow } from './helpers'

type DragPreviewWindow = Window & {
  __dragPreview?: {
    height: number
    offsetX: number
    offsetY: number
    tagName: string
    text: string
    width: number
  }
}

async function moveToWorldPoint(
  page: import('@playwright/test').Page,
  map: import('@playwright/test').Locator,
  point: WorldPoint,
): Promise<void> {
  const screenPoint = await map.evaluate((element, target) => {
    const content = element.querySelector<SVGGElement>('.system-map-content')
    const transform = content?.getScreenCTM()
    if (!transform) throw new Error('The system map content is not attached to the document.')
    const screen = new DOMPoint(target.x, target.y).matrixTransform(transform)
    return { x: screen.x, y: screen.y }
  }, point)
  await page.mouse.move(screenPoint.x, screenPoint.y)
}

async function ellipticalOrbitAngle(
  map: import('@playwright/test').Locator,
  orbitLabel: string,
  objectName: string,
): Promise<number> {
  return map.evaluate((element, target) => {
    const orbit = [...element.querySelectorAll<SVGGElement>('.orbit-mark')]
      .find(candidate => candidate.getAttribute('aria-label') === target.orbitLabel)
    const ellipse = orbit?.querySelector<SVGEllipseElement>('.orbit-ring')
    const object = [...element.querySelectorAll<SVGGElement>('.system-object')]
      .find(candidate => candidate.getAttribute('aria-label')?.includes(target.objectName))
    const transform = object?.getAttribute('transform')?.match(/^translate\(([^ ]+) ([^)]+)\)$/)
    if (!ellipse || !transform) throw new Error('Could not locate the Orbit or its child object.')

    const rotation = Number(
      ellipse.getAttribute('transform')?.match(/^rotate\(([-+.\deE]+) /)?.[1] ?? 0,
    ) * Math.PI / 180
    const x = Number(transform[1]) - Number(ellipse.getAttribute('cx'))
    const y = Number(transform[2]) - Number(ellipse.getAttribute('cy'))
    const localX = x * Math.cos(rotation) + y * Math.sin(rotation)
    const localY = -x * Math.sin(rotation) + y * Math.cos(rotation)
    return Math.atan2(
      localY / Number(ellipse.getAttribute('ry')),
      localX / Number(ellipse.getAttribute('rx')),
    )
  }, { orbitLabel, objectName })
}

async function orbitRotationDegrees(
  orbitRing: import('@playwright/test').Locator,
): Promise<number> {
  return orbitRing.evaluate(element => Number(
    element.getAttribute('transform')?.match(/^rotate\(([-+.\deE]+) /)?.[1] ?? 0,
  ))
}

async function ellipticalOrbitPoint(
  map: import('@playwright/test').Locator,
  orbitLabel: string,
  angle: number,
): Promise<WorldPoint> {
  return map.evaluate((element, target) => {
    const orbit = [...element.querySelectorAll<SVGGElement>('.orbit-mark')]
      .find(candidate => candidate.getAttribute('aria-label') === target.orbitLabel)
    const ellipse = orbit?.querySelector<SVGEllipseElement>('.orbit-ring')
    if (!ellipse) throw new Error('Could not locate the Orbit.')
    const rotation = Number(
      ellipse.getAttribute('transform')?.match(/^rotate\(([-+.\deE]+) /)?.[1] ?? 0,
    ) * Math.PI / 180
    const localX = Number(ellipse.getAttribute('rx')) * Math.cos(target.angle)
    const localY = Number(ellipse.getAttribute('ry')) * Math.sin(target.angle)
    return {
      x: Number(ellipse.getAttribute('cx')) + localX * Math.cos(rotation) - localY * Math.sin(rotation),
      y: Number(ellipse.getAttribute('cy')) + localX * Math.sin(rotation) + localY * Math.cos(rotation),
    }
  }, { orbitLabel, angle })
}

test('dragging an Orbit ring scales both axes and the system caption stays concise', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const hierarchy = page.getByRole('complementary', { name: 'System hierarchy' })
  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  const map = page.getByRole('group', { name: 'Vesper star system map' })
  await dragHtmlElementToWorldPoint(
    page,
    page.getByRole('button', { name: 'Add orbit' }),
    map,
    { x: 480, y: 280 },
  )
  await expect(map.getByRole('group', { name: 'Orbit 1 around Primary Star' })).toBeVisible()
  await addCatalogueObject(page, 'planet')

  await expect(map.locator('.map-caption')).toHaveCount(0)
  const resizeKnobs = map.locator('.orbit-resize-handle')
  await expect(resizeKnobs).toHaveCount(0)

  const orbit = map.getByRole('group', { name: 'Orbit 1 around Primary Star' })
  const orbitRing = orbit.locator('.orbit-ring')
  const orbitTarget = orbit.locator('.orbit-hit-target')
  await orbitTarget.scrollIntoViewIfNeeded()
  await expect(orbitTarget).toHaveAttribute('role', 'slider')
  const radiusXBefore = Number(await orbitRing.getAttribute('rx'))
  const radiusYBefore = Number(await orbitRing.getAttribute('ry'))
  const planet = map.getByRole('button', { name: /New planet 1/ })
  const planetBefore = await planet.getAttribute('transform')
  const globalScale = 1.25
  const globalStartAngle = 0.5
  await dragOrbitToWorldPoint(page, orbitTarget, {
    x: 480 + radiusXBefore * globalScale * Math.cos(globalStartAngle),
    y: 280 + radiusYBefore * globalScale * Math.sin(globalStartAngle),
  }, globalStartAngle)
  await expect.poll(async () => Number(await orbitRing.getAttribute('rx')))
    .toBeGreaterThan(radiusXBefore)
  await expect.poll(async () => Number(await orbitRing.getAttribute('ry')))
    .toBeGreaterThan(radiusYBefore)
  await expect.poll(async () => planet.getAttribute('transform'))
    .not.toBe(planetBefore)
})

test('the Warden can edit, save, export, and import an elliptical Orbit around an unoccupied center', async ({ page }) => {
  await page.addInitScript(() => {
    const downloadWindow = window as DownloadWindow
    downloadWindow.__mapExportBlobs = []
    const createObjectURL = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (object) => {
      if (object instanceof Blob) downloadWindow.__mapExportBlobs?.push(object)
      return createObjectURL(object)
    }
  })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const hierarchy = page.getByRole('complementary', { name: 'System hierarchy' })
  const map = page.getByRole('group', { name: 'Vesper star system map' })
  const dropPoint = { x: 360, y: 320 }
  await dragHtmlElementToWorldPoint(
    page,
    page.getByRole('button', { name: 'Add orbit' }),
    map,
    dropPoint,
  )
  const orbitLabel = 'Orbit 1 around unoccupied center'
  const orbit = map.getByRole('group', { name: orbitLabel })
  const ring = orbit.locator('.orbit-ring')
  await expect(map.locator('.orbit-label')).toHaveCount(0)
  await expect.poll(async () =>
    Math.abs(Number(await ring.getAttribute('cx')) - dropPoint.x),
  ).toBeLessThan(1)
  await expect.poll(async () =>
    Math.abs(Number(await ring.getAttribute('cy')) - dropPoint.y),
  ).toBeLessThan(1)
  await expect(hierarchy.getByRole('button', { name: /Orbit 1 around unoccupied center, 0 objects/ }))
    .toBeVisible()

  const centerHandle = orbit.locator('.orbit-center-handle')
  await expect(centerHandle).toBeVisible()
  const movedCenter = { x: dropPoint.x + 32, y: dropPoint.y + 24 }
  await dragToWorldPoint(page, map, centerHandle, movedCenter)
  await expect.poll(async () =>
    Math.abs(Number(await ring.getAttribute('cx')) - movedCenter.x),
  ).toBeLessThan(2)
  await expect.poll(async () =>
    Math.abs(Number(await ring.getAttribute('cy')) - movedCenter.y),
  ).toBeLessThan(2)
  await expect(page.getByText('Saved on this device')).toBeVisible()

  await page.getByRole('button', { name: 'Edit Orbit' }).click()
  await page.getByLabel('Horizontal radius').fill('300')
  await page.getByLabel('Vertical radius').fill('50')
  await page.getByLabel('Center X').fill('0.2')
  await page.getByLabel('Center Y').fill('0.5')
  await page.getByRole('button', { name: 'Save Orbit' }).click()
  await expect(ring).toHaveAttribute('rx', '300')
  await expect(ring).toHaveAttribute('ry', '50')

  await addCatalogueObject(page, 'star')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Binary A')
  await saveMapObject(page)
  await hierarchy.getByRole('button', { name: /Orbit 1 around unoccupied center/ }).click()
  await addCatalogueObject(page, 'star')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Binary B')
  await saveMapObject(page)
  await expect(hierarchy.getByRole('button', { name: /Orbit 1 around unoccupied center, 2 objects/ }))
    .toBeVisible()

  const geometry = await ring.evaluate(element => ({
    cx: Number(element.getAttribute('cx')),
    cy: Number(element.getAttribute('cy')),
    rx: Number(element.getAttribute('rx')),
    ry: Number(element.getAttribute('ry')),
  }))
  const firstAngle = Math.PI / 4
  const secondAngle = 2.4
  const normalX = Math.cos(firstAngle) / geometry.rx
  const normalY = Math.sin(firstAngle) / geometry.ry
  const normalLength = Math.hypot(normalX, normalY)
  const firstDropPoint = {
    x: geometry.cx + geometry.rx * Math.cos(firstAngle) + 10 * normalX / normalLength,
    y: geometry.cy + geometry.ry * Math.sin(firstAngle) + 10 * normalY / normalLength,
  }
  await dragToWorldPoint(
    page,
    map,
    map.getByRole('button', { name: /Binary A/ }).locator('.object-hit-target'),
    firstDropPoint,
  )
  await dragToWorldPoint(
    page,
    map,
    map.getByRole('button', { name: /Binary B/ }).locator('.object-hit-target'),
    {
      x: geometry.cx + geometry.rx * Math.cos(secondAngle),
      y: geometry.cy + geometry.ry * Math.sin(secondAngle),
    },
  )
  await expect.poll(() => ellipticalOrbitAngle(map, orbitLabel, 'Binary A'))
    .toBeCloseTo(firstAngle, 2)
  const angleBeforeResize = await ellipticalOrbitAngle(map, orbitLabel, 'Binary A')
  const secondAngleBeforeResize = await ellipticalOrbitAngle(map, orbitLabel, 'Binary B')
  await hierarchy.getByRole('button', { name: /Orbit 1 around unoccupied center/ }).click()
  const horizontalHandle = orbit.locator('.orbit-axis-handle--horizontal')
  const verticalHandle = orbit.locator('.orbit-axis-handle--vertical')
  await expect(horizontalHandle).toBeVisible()
  await expect(verticalHandle).toBeVisible()
  await dragToWorldPoint(page, map, horizontalHandle, { x: geometry.cx + 320, y: geometry.cy })
  await expect(ring).toHaveAttribute('rx', '320')
  await expect(ring).toHaveAttribute('ry', '50')
  await dragToWorldPoint(page, map, verticalHandle, { x: geometry.cx, y: geometry.cy - 60 })
  await expect(ring).toHaveAttribute('rx', '320')
  await expect(ring).toHaveAttribute('ry', '60')

  const globalScale = 1.25
  const globalStartAngle = 1.4
  await dragOrbitToWorldPoint(
    page,
    orbit.locator('.orbit-hit-target'),
    {
      x: geometry.cx + 320 * globalScale * Math.cos(globalStartAngle),
      y: geometry.cy + 60 * globalScale * Math.sin(globalStartAngle),
    },
    globalStartAngle,
  )
  const globallyResizedHorizontalRadius = Number(await ring.getAttribute('rx'))
  const globallyResizedVerticalRadius = Number(await ring.getAttribute('ry'))
  expect(Math.abs(globallyResizedHorizontalRadius - 400)).toBeLessThanOrEqual(3)
  expect(Math.abs(globallyResizedVerticalRadius - 75)).toBeLessThanOrEqual(3)
  expect(Math.abs(globallyResizedHorizontalRadius / 320 - globallyResizedVerticalRadius / 60))
    .toBeLessThan(0.02)
  await expect.poll(() => ellipticalOrbitAngle(map, orbitLabel, 'Binary A'))
    .toBeCloseTo(angleBeforeResize, 2)
  await expect.poll(() => ellipticalOrbitAngle(map, orbitLabel, 'Binary B'))
    .toBeCloseTo(secondAngleBeforeResize, 2)

  const rotationHandle = orbit.locator('.orbit-rotation-handle')
  await expect(rotationHandle).toBeVisible()
  const handlePosition = await rotationHandle.evaluate(element => ({
    x: Number(element.getAttribute('cx')),
    y: Number(element.getAttribute('cy')),
  }))
  const handleTurn = Math.PI / 4
  await dragToWorldPoint(page, map, rotationHandle, {
    x: geometry.cx
      + (handlePosition.x - geometry.cx) * Math.cos(handleTurn)
      - (handlePosition.y - geometry.cy) * Math.sin(handleTurn),
    y: geometry.cy
      + (handlePosition.x - geometry.cx) * Math.sin(handleTurn)
      + (handlePosition.y - geometry.cy) * Math.cos(handleTurn),
  })
  await expect.poll(() => orbitRotationDegrees(ring)).toBeCloseTo(45, 0)
  const handleRotationRadians = await orbitRotationDegrees(ring) * Math.PI / 180
  await dragToWorldPoint(page, map, verticalHandle, {
    x: geometry.cx + 90 * Math.sin(handleRotationRadians),
    y: geometry.cy - 90 * Math.cos(handleRotationRadians),
  })
  await expect(ring).toHaveAttribute('rx', String(globallyResizedHorizontalRadius))
  await expect(ring).toHaveAttribute('ry', '90')
  const resizedHorizontalRadius = Number(await ring.getAttribute('rx'))
  const resizedVerticalRadius = Number(await ring.getAttribute('ry'))
  await expect.poll(() => ellipticalOrbitAngle(map, orbitLabel, 'Binary A'))
    .toBeCloseTo(angleBeforeResize, 2)

  const navigation = page.getByRole('toolbar', { name: 'Map navigation' })
  const zoomLevel = navigation.getByLabel('Zoom level')
  const zoomBeforeBackgroundWheel = await zoomLevel.textContent()
  await moveToWorldPoint(page, map, { x: 900, y: 100 })
  await page.keyboard.down('Control')
  await page.mouse.wheel(0, -100)
  await page.keyboard.up('Control')
  await expect.poll(() => zoomLevel.textContent()).not.toBe(zoomBeforeBackgroundWheel)
  await navigation.getByRole('button', { name: 'Fit map' }).click()

  const rotationBeforeWheel = await orbitRotationDegrees(ring)
  const zoomBeforeOrbitWheel = await zoomLevel.textContent()
  await moveToWorldPoint(page, map, await ellipticalOrbitPoint(map, orbitLabel, 5.3))
  await page.keyboard.down('Control')
  await page.mouse.wheel(0, -100)
  await page.keyboard.up('Control')
  await expect.poll(() => orbitRotationDegrees(ring))
    .toBeCloseTo(rotationBeforeWheel - 5, 1)
  await expect.poll(() => zoomLevel.textContent()).toBe(zoomBeforeOrbitWheel)
  await expect.poll(() => ellipticalOrbitAngle(map, orbitLabel, 'Binary A'))
    .toBeCloseTo(angleBeforeResize, 2)

  const newPlanetAngle = 3.1
  const planetButton = await selectCatalogueObjectButton(page, 'planet')
  await dragHtmlElementToWorldPoint(
    page,
    planetButton,
    map,
    await ellipticalOrbitPoint(map, orbitLabel, newPlanetAngle),
  )
  const newPlanet = map.getByRole('button', { name: /New planet 1/ })
  await expect.poll(() => ellipticalOrbitAngle(map, orbitLabel, 'New planet 1'))
    .toBeCloseTo(newPlanetAngle, 2)
  const movedPlanetAngle = 1.5
  await dragToWorldPoint(
    page,
    map,
    newPlanet.locator('.object-hit-target'),
    await ellipticalOrbitPoint(map, orbitLabel, movedPlanetAngle),
  )
  await expect.poll(() => ellipticalOrbitAngle(map, orbitLabel, 'New planet 1'))
    .toBeCloseTo(movedPlanetAngle, 2)

  const finalRotation = await orbitRotationDegrees(ring)

  const centerIsOccupied = await map.evaluate((element, label) => {
    const orbitMark = [...element.querySelectorAll<SVGGElement>('.orbit-mark')]
      .find(candidate => candidate.getAttribute('aria-label') === label)
    const ellipse = orbitMark?.querySelector<SVGEllipseElement>('.orbit-ring')
    if (!ellipse) throw new Error('The unhosted Orbit did not render as an ellipse.')
    return [...element.querySelectorAll<SVGGElement>('.system-object')].some((object) => {
      const transform = object.getAttribute('transform')?.match(/^translate\(([^ ]+) ([^)]+)\)$/)
      return !!transform
        && Number(transform[1]) === Number(ellipse.getAttribute('cx'))
        && Number(transform[2]) === Number(ellipse.getAttribute('cy'))
    })
  }, orbitLabel)
  expect(centerIsOccupied).toBe(false)

  await navigation.getByRole('button', { name: 'Zoom in' }).click()
  await panMap(page, map, { x: 24, y: 18 })
  await navigation.getByRole('button', { name: 'Fit map' }).click()
  await expect(ring).toBeVisible()

  const systemExport = await downloadJson(page, 'Export star system JSON')
  const system = systemExport.system!
  const exportedOrbit = system.orbits.find(candidate => candidate.hostId === null)!
  expect(exportedOrbit.center).toEqual({ x: 0.2, y: 0.5 })
  expect(systemExport.layout).not.toHaveProperty('orbitEllipseRadii')
  expect(systemExport.layout.orbitRadii[exportedOrbit.id])
    .toEqual({ horizontal: resizedHorizontalRadius, vertical: resizedVerticalRadius })
  expect(systemExport.layout.orbitRotations?.[exportedOrbit.id]).toBeCloseTo(finalRotation, 4)
  const exportedStars = system.objects.filter(object => object.name.startsWith('Binary '))
  expect(exportedStars).toHaveLength(2)
  expect(exportedStars.map(object => object.placement))
    .toEqual([{ kind: 'orbit', orbitId: exportedOrbit.id }, { kind: 'orbit', orbitId: exportedOrbit.id }])
  expect(exportedStars.every(object => Number.isFinite(systemExport.layout.objectAngles[object.id])))
    .toBe(true)

  const svg = await downloadImage(page, 'Export star system SVG', 'image/svg+xml')
  const scene = await page.evaluate((content) => {
    const document = new DOMParser().parseFromString(content, 'image/svg+xml')
    const orbitRing = document.querySelector<SVGEllipseElement>('.orbit-ring')
    return {
      tagName: orbitRing?.tagName,
      rx: Number(orbitRing?.getAttribute('rx')),
      ry: Number(orbitRing?.getAttribute('ry')),
      orbitLabelCount: document.querySelectorAll('.orbit-label').length,
      resizeHandleCount: document.querySelectorAll('.orbit-axis-handle').length,
      editControlCount: document.querySelectorAll('.orbit-edit-control').length,
      rotation: Number(orbitRing?.getAttribute('transform')?.match(/^rotate\(([-+.\deE]+) /)?.[1] ?? 0),
      text: document.documentElement.textContent ?? '',
    }
  }, svg.text!)
  expect(scene).toMatchObject({
    tagName: 'ellipse',
    rx: resizedHorizontalRadius,
    ry: resizedVerticalRadius,
    orbitLabelCount: 0,
    resizeHandleCount: 0,
    editControlCount: 0,
    rotation: finalRotation,
  })
  expect(scene.text).toContain('Binary A')
  expect(scene.text).toContain('Binary B')
  expect(scene.text).not.toContain('Orbit 1')
  const png = await downloadImage(page, 'Export star system PNG', 'image/png')
  expect(png.signature).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  expect(png.sourceSvgText).toContain('<ellipse')
  expect(png.sourceSvgText).toContain('Binary A')
  expect(png.sourceSvgText).toContain('Binary B')
  expect(png.sourceSvgText).not.toContain('orbit-axis-handle')
  expect(png.sourceSvgText).not.toContain('orbit-rotation-handle')
  expect(png.sourceSvgText).not.toContain('orbit-edit-control')
  expect(png.sourceSvgText).not.toContain('class="orbit-label"')

  await expect(page.getByText('Saved on this device')).toBeVisible()
  await page.reload()
  const restoredMap = page.getByRole('group', { name: 'Vesper star system map' })
  const restoredOrbit = restoredMap.getByRole('group', { name: orbitLabel })
  const restoredRing = restoredOrbit.locator('.orbit-ring')
  await expect(restoredRing).toHaveAttribute('rx', String(resizedHorizontalRadius))
  await expect(restoredRing).toHaveAttribute('ry', String(resizedVerticalRadius))
  await expect.poll(() => orbitRotationDegrees(restoredRing)).toBeCloseTo(finalRotation, 4)
  await expect(hierarchy.getByRole('button', { name: /Orbit 1 around unoccupied center, 3 objects/ }))
    .toBeVisible()
  await expect.poll(() => ellipticalOrbitAngle(restoredMap, orbitLabel, 'Binary A'))
    .toBeCloseTo(angleBeforeResize, 2)

  const input = page.getByLabel('JSON map file')
  const importPreview = page.waitForEvent('dialog')
  await setJsonFile(input, 'elliptical-system.json', JSON.stringify(systemExport))
  await (await importPreview).accept()
  const clusterExport = await downloadJson(page, 'Export Jump Cluster JSON')
  const importedSystem = clusterExport.cluster!.systems.find(candidate =>
    candidate.id !== system.id && candidate.name === system.name,
  )!
  const importedOrbit = importedSystem.orbits.find(candidate => candidate.hostId === null)!
  expect(importedOrbit.center).toEqual({ x: 0.2, y: 0.5 })
  expect(clusterExport.layout.orbitRadii[importedOrbit.id])
    .toEqual({ horizontal: resizedHorizontalRadius, vertical: resizedVerticalRadius })
  expect(clusterExport.layout.orbitRotations?.[importedOrbit.id]).toBeCloseTo(finalRotation, 4)
  const importedStars = importedSystem.objects.filter(object => object.name.startsWith('Binary '))
  expect(importedStars).toHaveLength(2)
  expect(importedStars.every(object => object.placement.kind === 'orbit'
    && object.placement.orbitId === importedOrbit.id)).toBe(true)
  expect(importedStars.every(object => Number.isFinite(clusterExport.layout.objectAngles[object.id])))
    .toBe(true)

  const sourceSystemIds = new Set(clusterExport.cluster!.systems.map(candidate => candidate.id))
  const clusterPreview = page.waitForEvent('dialog')
  await setJsonFile(input, 'elliptical-cluster.json', JSON.stringify(clusterExport))
  await (await clusterPreview).accept()
  const clusterRoundTrip = await downloadJson(page, 'Export Jump Cluster JSON')
  const roundTripSystem = clusterRoundTrip.cluster!.systems
    .filter(candidate => !sourceSystemIds.has(candidate.id))
    .find(candidate => candidate.orbits.some(orbit => orbit.hostId === null))!
  const roundTripOrbit = roundTripSystem.orbits.find(orbit => orbit.hostId === null)!
  expect(roundTripOrbit.center).toEqual({ x: 0.2, y: 0.5 })
  expect(clusterRoundTrip.layout.orbitRadii[roundTripOrbit.id])
    .toEqual({ horizontal: resizedHorizontalRadius, vertical: resizedVerticalRadius })
  expect(clusterRoundTrip.layout.orbitRotations?.[roundTripOrbit.id])
    .toBeCloseTo(finalRotation, 4)
  const roundTripStars = roundTripSystem.objects.filter(object => object.name.startsWith('Binary '))
  expect(roundTripStars).toHaveLength(2)
  expect(roundTripStars.every(object => object.placement.kind === 'orbit'
    && object.placement.orbitId === roundTripOrbit.id)).toBe(true)
})

test('the Warden can detach a hosted Orbit and move its unoccupied center', async ({ page }) => {
  await page.addInitScript(() => {
    const downloadWindow = window as DownloadWindow
    downloadWindow.__mapExportBlobs = []
    const createObjectURL = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (object) => {
      if (object instanceof Blob) downloadWindow.__mapExportBlobs?.push(object)
      return createObjectURL(object)
    }
  })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const hierarchy = page.getByRole('complementary', { name: 'System hierarchy' })
  const map = page.getByRole('group', { name: 'Vesper star system map' })
  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  await addCatalogueObject(page, 'planet')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Iria')
  await saveMapObject(page)

  await hierarchy.getByRole('button', { name: /Select PL-01, Iria/ }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  await addCatalogueObject(page, 'moon')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Nix')
  await saveMapObject(page)

  await hierarchy.getByRole('button', { name: /Select PL-01, Iria/ }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  await expect(hierarchy.getByRole('button', { name: /Orbit 2 around Iria, 0 objects/ }))
    .toBeVisible()

  const hostedOrbitLabel = 'Orbit 1 around Iria'
  const hostedOrbit = map.getByRole('group', { name: hostedOrbitLabel })
  const hostedRing = hostedOrbit.locator('.orbit-ring')
  const originalCenter = {
    x: Number(await hostedRing.getAttribute('cx')),
    y: Number(await hostedRing.getAttribute('cy')),
  }
  const originalRadii = {
    horizontal: Number(await hostedRing.getAttribute('rx')),
    vertical: Number(await hostedRing.getAttribute('ry')),
  }
  const angleBeforeDetach = await ellipticalOrbitAngle(map, hostedOrbitLabel, 'Nix')
  await hierarchy.getByRole('button', { name: /Orbit 1 around Iria, 1 object/ }).click()
  await page.getByRole('button', { name: 'Detach Orbit' }).click()

  const detachedOrbitLabel = 'Orbit 1 around unoccupied center'
  const detachedOrbit = map.getByRole('group', { name: detachedOrbitLabel })
  const detachedRing = detachedOrbit.locator('.orbit-ring')
  await expect(hierarchy.getByRole('button', { name: /Orbit 1 around unoccupied center, 1 object/ }))
    .toBeVisible()
  await expect(hierarchy.getByRole('button', { name: /Orbit 1 around Iria, 0 objects/ }))
    .toBeVisible()
  await expect(page.getByRole('button', { name: 'Detach Orbit' })).toHaveCount(0)
  await expect(detachedRing).toHaveAttribute('rx', String(originalRadii.horizontal))
  await expect(detachedRing).toHaveAttribute('ry', String(originalRadii.vertical))

  const detachedCenter = {
    x: Number(await detachedRing.getAttribute('cx')),
    y: Number(await detachedRing.getAttribute('cy')),
  }
  expect(Math.hypot(
    detachedCenter.x - originalCenter.x,
    detachedCenter.y - originalCenter.y,
  )).toBeGreaterThanOrEqual(40)
  await expect.poll(() => ellipticalOrbitAngle(map, detachedOrbitLabel, 'Nix'))
    .toBeCloseTo(angleBeforeDetach, 2)

  const centerHandle = detachedOrbit.locator('.orbit-center-handle')
  await expect(centerHandle).toBeVisible()
  const objectBeforeMove = await map.getByRole('button', { name: /Nix/ }).getAttribute('transform')
  const movedCenter = { x: detachedCenter.x + 64, y: detachedCenter.y + 32 }
  await dragToWorldPoint(page, map, centerHandle, movedCenter)
  await expect.poll(async () =>
    Math.abs(Number(await detachedRing.getAttribute('cx')) - movedCenter.x),
  ).toBeLessThan(2)
  await expect.poll(async () =>
    Math.abs(Number(await detachedRing.getAttribute('cy')) - movedCenter.y),
  ).toBeLessThan(2)
  await expect.poll(async () => map.getByRole('button', { name: /Nix/ }).getAttribute('transform'))
    .not.toBe(objectBeforeMove)
  await expect.poll(() => ellipticalOrbitAngle(map, detachedOrbitLabel, 'Nix'))
    .toBeCloseTo(angleBeforeDetach, 2)
  await expect(page.getByText('Saved on this device')).toBeVisible()

  const exported = await downloadJson(page, 'Export star system JSON')
  const exportedSystem = exported.system
  if (!exportedSystem) throw new Error('The exported file does not contain a star system.')
  const exportedDetachedOrbit = exportedSystem.orbits.find(orbit => orbit.hostId === null)
  const persistedCenter = {
    x: Number(await detachedRing.getAttribute('cx')),
    y: Number(await detachedRing.getAttribute('cy')),
  }
  expect(exportedDetachedOrbit?.order).toBe(1)
  expect(exportedDetachedOrbit?.center?.x).toBeCloseTo((persistedCenter.x - 64) / 832, 5)
  expect(exportedDetachedOrbit?.center?.y).toBeCloseTo((persistedCenter.y - 72) / 416, 5)
  const iria = exportedSystem.objects.find(object => object.name === 'Iria')
  if (!iria) throw new Error('The exported Orbit host was not found.')
  expect(exportedSystem.orbits.filter(orbit => orbit.hostId === iria.id).map(orbit => orbit.order))
    .toEqual([1])

  await page.reload()
  const restoredMap = page.getByRole('group', { name: 'Vesper star system map' })
  const restoredRing = restoredMap.getByRole('group', { name: detachedOrbitLabel }).locator('.orbit-ring')
  await expect.poll(async () =>
    Math.abs(Number(await restoredRing.getAttribute('cx')) - persistedCenter.x),
  ).toBeLessThan(0.01)
  await expect.poll(async () =>
    Math.abs(Number(await restoredRing.getAttribute('cy')) - persistedCenter.y),
  ).toBeLessThan(0.01)
  await expect(hierarchy.getByRole('button', { name: /Orbit 1 around Iria, 0 objects/ }))
    .toBeVisible()
  await expect.poll(() => ellipticalOrbitAngle(restoredMap, detachedOrbitLabel, 'Nix'))
    .toBeCloseTo(angleBeforeDetach, 2)
})

test('an object drag keeps its hosted Orbit with it before release', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const hierarchy = page.getByRole('complementary', { name: 'System hierarchy' })
  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  await addCatalogueObject(page, 'planet')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Iria')
  await saveMapObject(page)
  await hierarchy.getByRole('button', { name: /Select PL-01, Iria/ }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  await addCatalogueObject(page, 'moon')

  const map = page.getByRole('group', { name: 'Vesper star system map' })
  const planet = map.getByRole('button', { name: /Select PL-01, Iria/ })
  const innerOrbit = map.getByRole('group', { name: 'Orbit 1 around Iria' }).locator('.orbit-ring')
  const orbitCenterBefore = await innerOrbit.getAttribute('cx')
  const planetBefore = await planet.getAttribute('transform')
  await beginDragToWorldPoint(page, map, planet.locator('.object-hit-target'), { x: 545, y: 185 })
  await expect(planet).toHaveClass(/is-dragging/)
  await expect.poll(async () => planet.getAttribute('transform'))
    .not.toBe(planetBefore)
  await expect.poll(async () => innerOrbit.getAttribute('cx'))
    .not.toBe(orbitCenterBefore)
  await page.mouse.up()
})

test('dragging Add Orbit onto a map object hosts it there', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const hierarchy = page.getByRole('complementary', { name: 'System hierarchy' })
  const map = page.getByRole('group', { name: 'Vesper star system map' })
  const host = map.getByRole('button', { name: /Primary Star/ })
  const hostPoint = await host.evaluate(element => {
    const transform = element.getAttribute('transform')?.match(/^translate\(([^ ]+) ([^)]+)\)$/)
    if (!transform) throw new Error('Could not locate the host object on the map.')
    return { x: Number(transform[1]), y: Number(transform[2]) }
  })

  await dragHtmlElementToWorldPoint(
    page,
    page.getByRole('button', { name: 'Add orbit' }),
    map,
    hostPoint,
  )

  await expect(hierarchy.getByRole('button', { name: /Orbit 1 around Primary Star, 0 objects/ }))
    .toBeVisible()
  const ring = map.getByRole('group', { name: 'Orbit 1 around Primary Star' }).locator('.orbit-ring')
  await expect.poll(async () =>
    Math.abs(Number(await ring.getAttribute('cx')) - hostPoint.x),
  ).toBeLessThan(1)
  await expect.poll(async () =>
    Math.abs(Number(await ring.getAttribute('cy')) - hostPoint.y),
  ).toBeLessThan(1)
})

test('dropping an existing unoccupied Orbit center onto an object hosts it there', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const hierarchy = page.getByRole('complementary', { name: 'System hierarchy' })
  const map = page.getByRole('group', { name: 'Vesper star system map' })
  await dragHtmlElementToWorldPoint(
    page,
    page.getByRole('button', { name: 'Add orbit' }),
    map,
    { x: 360, y: 320 },
  )

  const unoccupiedOrbit = map.getByRole('group', { name: 'Orbit 1 around unoccupied center' })
  const centerHandle = unoccupiedOrbit.locator('.orbit-center-handle')
  await expect(centerHandle).toBeVisible()
  const host = map.getByRole('button', { name: /Primary Star/ })
  const hostPoint = await host.evaluate(element => {
    const transform = element.getAttribute('transform')?.match(/^translate\(([^ ]+) ([^)]+)\)$/)
    if (!transform) throw new Error('Could not locate the host object on the map.')
    return { x: Number(transform[1]), y: Number(transform[2]) }
  })

  await dragToWorldPoint(page, map, centerHandle, hostPoint)

  const hostedOrbit = map.getByRole('group', { name: 'Orbit 1 around Primary Star' })
  await expect(hostedOrbit).toBeVisible()
  const ring = hostedOrbit.locator('.orbit-ring')
  await expect.poll(async () =>
    Math.abs(Number(await ring.getAttribute('cx')) - hostPoint.x),
  ).toBeLessThan(1)
  await expect.poll(async () =>
    Math.abs(Number(await ring.getAttribute('cy')) - hostPoint.y),
  ).toBeLessThan(1)
  await expect(hierarchy.getByRole('button', { name: /Orbit 1 around Primary Star, 0 objects/ }))
    .toBeVisible()

  await page.reload()
  const restoredMap = page.getByRole('group', { name: 'Vesper star system map' })
  await expect(restoredMap.getByRole('group', { name: 'Orbit 1 around Primary Star' }))
    .toBeVisible()
})

test('object palette drag previews match placed marks and preserve map, Orbit, and keyboard adds', async ({ page }) => {
  await page.addInitScript(() => {
    const downloadWindow = window as DownloadWindow
    downloadWindow.__mapExportBlobs = []
    const createObjectURL = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (object) => {
      if (object instanceof Blob) downloadWindow.__mapExportBlobs?.push(object)
      return createObjectURL(object)
    }
    const originalSetDragImage = DataTransfer.prototype.setDragImage
    DataTransfer.prototype.setDragImage = function (image, offsetX, offsetY) {
      const bounds = image.getBoundingClientRect()
      const dragPreviewWindow = window as DragPreviewWindow
      dragPreviewWindow.__dragPreview = {
        height: bounds.height,
        offsetX,
        offsetY,
        tagName: image.tagName,
        text: image.textContent?.trim() ?? '',
        width: bounds.width,
      }
      originalSetDragImage.call(this, image, offsetX, offsetY)
    }
  })
  const assertDragPreview = async (expectedText: string): Promise<string> => {
    const preview = await page.evaluate(() => (window as DragPreviewWindow).__dragPreview)
    if (!preview) throw new Error('The drag did not set a custom preview.')
    expect(preview).toMatchObject({ tagName: 'SPAN', text: expectedText })
    expect(preview.width).toBeGreaterThan(0)
    expect(preview.offsetX).toBeGreaterThan(preview.width)
    expect(preview.offsetX - preview.width).toBeLessThanOrEqual(12)
    expect(preview.offsetY).toBeCloseTo(preview.height / 2, 1)
    return preview.text
  }
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const hierarchy = page.getByRole('complementary', { name: 'System hierarchy' })
  const palette = page.getByRole('region', { name: 'Object palette' })
  await expect(palette).toBeVisible()
  expect(await palette.evaluate(element => element.closest('.system-map-tools') !== null)).toBe(true)
  await setHeaderMapActionsOpen(page, true)
  const fileActions = page.getByRole('group', { name: 'Map file actions for star system Vesper' })
  const fileActionsBefore = await fileActions.evaluate(element => {
    const exportButton = element.querySelector('[aria-label="Export star system JSON"]')
    const buttonsFit = Array.from(element.querySelectorAll('button')).every(button => {
      const bounds = button.getBoundingClientRect()
      return bounds.left >= 0 && bounds.right <= window.innerWidth
    })
    return {
      top: element.getBoundingClientRect().top,
      exportTop: exportButton?.getBoundingClientRect().top ?? null,
      buttonsFit,
    }
  })
  expect(fileActionsBefore.exportTop).not.toBeNull()
  expect(fileActionsBefore.buttonsFit).toBe(true)
  await setHeaderMapActionsOpen(page, false)

  const map = page.getByRole('group', { name: 'Vesper star system map' })
  const mapObjects = map.locator('.system-object')
  const addStar = await selectCatalogueObjectButton(page, 'star')
  const starMark = (await addStar.locator('.object-mark').textContent())?.trim() ?? ''
  const objectsBeforeStarDrop = await mapObjects.count()
  let starPreviewText = ''
  await page.evaluate(() => {
    (window as DragPreviewWindow).__dragPreview = undefined
  })
  await dragHtmlElementToWorldPoint(page, addStar, map, { x: 320, y: 400 }, async () => {
    starPreviewText = await assertDragPreview(starMark)
  })
  await expect(mapObjects).toHaveCount(objectsBeforeStarDrop + 1)
  await expect(mapObjects.nth(objectsBeforeStarDrop).locator('.system-object-glyph'))
    .toHaveText(starPreviewText)

  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  const addPlanet = await selectCatalogueObjectButton(page, 'planet')
  const planetMark = (await addPlanet.locator('.object-mark').textContent())?.trim() ?? ''
  const objectsBeforePlanetDrop = await mapObjects.count()
  let planetPreviewText = ''
  await page.evaluate(() => {
    (window as DragPreviewWindow).__dragPreview = undefined
  })
  await dragHtmlElementToWorldPoint(page, addPlanet, map, { x: 592, y: 280 }, async () => {
    planetPreviewText = await assertDragPreview(planetMark)
  })
  await expect(mapObjects).toHaveCount(objectsBeforePlanetDrop + 1)
  await expect(mapObjects.nth(objectsBeforePlanetDrop).locator('.system-object-glyph'))
    .toHaveText(planetPreviewText)
  await expect(hierarchy.getByRole('button', { name: /Orbit 1 around Primary Star, 1 object/ }))
    .toBeVisible()

  await page.getByRole('complementary', { name: 'Object inspector' })
    .getByRole('button', { name: 'Chart details' }).click()
  await addPlanet.press('Enter')
  const systemPlanet = hierarchy.getByRole('button', { name: /Select PL-02, New planet 2/ })
  await expect(systemPlanet).toBeVisible()
  await expect(systemPlanet.locator('.object-mark')).toHaveText('◉')
  await dragToWorldPoint(page, map, map.getByRole('button', { name: /New planet 2/ })
    .locator('.object-hit-target'), { x: 592, y: 280 })
  await expect(hierarchy.getByRole('button', { name: /Orbit 1 around Primary Star, 2 objects/ }))
    .toBeVisible()

  const addHazard = await selectCatalogueObjectButton(page, 'hazard')
  const transformsBeforeCancel = await mapObjects.evaluateAll(objects =>
    objects.map(object => object.getAttribute('transform')),
  )
  const hazardBounds = await addHazard.boundingBox()
  if (!hazardBounds) throw new Error('Could not find the Hazard palette button.')
  await page.mouse.move(hazardBounds.x + hazardBounds.width / 2, hazardBounds.y + hazardBounds.height / 2)
  await page.mouse.down()
  await page.mouse.move(1, 1, { steps: 12 })
  await page.mouse.up()
  await expect(mapObjects).toHaveCount(transformsBeforeCancel.length)
  expect(await mapObjects.evaluateAll(objects =>
    objects.map(object => object.getAttribute('transform')),
  )).toEqual(transformsBeforeCancel)

  await setHeaderMapActionsOpen(page, true)
  const fileActionsAfter = await fileActions.evaluate(element => {
    const exportButton = element.querySelector('[aria-label="Export star system JSON"]')
    const buttonsFit = Array.from(element.querySelectorAll('button')).every(button => {
      const bounds = button.getBoundingClientRect()
      return bounds.left >= 0 && bounds.right <= window.innerWidth
    })
    return {
      top: element.getBoundingClientRect().top,
      exportTop: exportButton?.getBoundingClientRect().top ?? null,
      buttonsFit,
    }
  })
  expect(fileActionsAfter.top).toBe(fileActionsBefore.top)
  expect(fileActionsAfter.exportTop).toBe(fileActionsBefore.exportTop)
  expect(fileActionsAfter.buttonsFit).toBe(true)
  await setHeaderMapActionsOpen(page, false)

  const exported = await downloadJson(page, 'Export star system JSON')
  const system = exported.system
  if (!system) throw new Error('The exported file does not contain a star system.')
  const orbit = system.orbits[0]
  if (!orbit) throw new Error('The exported star system does not contain an Orbit.')
  const orbitId = orbit.id
  const stars = system.objects.filter(object => object.subtype === 'star')
  expect(stars).toHaveLength(2)
  expect(stars[1]?.placement.kind).toBe('system')
  const planets = system.objects.filter(object => object.subtype === 'planet')
  expect(planets).toHaveLength(2)
  expect(planets.map(object => object.placement)).toEqual([
    { kind: 'orbit', orbitId },
    { kind: 'orbit', orbitId },
  ])
})
