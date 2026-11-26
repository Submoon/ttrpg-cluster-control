import { expect, test, type Locator, type Page } from './fixtures'
import {
  captureMapExportBlobs,
  centerWorkspaceSelection,
  createSingleSystemWorkspace,
  dockAction,
  downloadJson,
  exposedContinuousObjectHitPoint,
  setWorkspaceMapMode,
  waitForWorkspaceSaved,
  wardenMap,
  wardenObjectMark,
  wardenObjectLocalPosition,
  wardenOrbitLocalGeometry,
  workspaceZoomOutput,
  type DownloadWindow,
  type ExportedMap,
} from './helpers'

type TouchPoint = { id: number; x: number; y: number }
type StoredWorkspaceRecords = { current: unknown; lastValid: unknown }
type OrbitOwnerGeometry = Awaited<ReturnType<typeof wardenOrbitLocalGeometry>>
type OrbitPreviewScreenGeometry = {
  cx: string | null
  cy: string | null
  rx: string | null
  ry: string | null
  center: { x: number; y: number }
  radius: number
  ownerLocal: OrbitOwnerGeometry
}

async function enableTouch(page: Page) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 })
  return cdp
}

async function dispatchTouch(
  cdp: Awaited<ReturnType<typeof enableTouch>>,
  type: 'touchStart' | 'touchMove' | 'touchEnd',
  points: TouchPoint[],
): Promise<void> {
  await cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: points.map(point => ({
      ...point,
      radiusX: 2,
      radiusY: 2,
      force: 1,
    })),
  })
}

async function pointAtCenter(locator: import('@playwright/test').Locator): Promise<TouchPoint> {
  const bounds = await locator.boundingBox()
  if (!bounds) throw new Error('The touch target has no visible bounds.')
  return { id: 1, x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
}

async function readOrbitPreviewScreenGeometry(preview: Locator): Promise<OrbitPreviewScreenGeometry> {
  const screenGeometry = await preview.evaluate((element) => {
    if (!(element instanceof SVGEllipseElement)) throw new Error('Expected a circular Orbit preview.')
    const matrix = element.getScreenCTM()
    if (!matrix) throw new Error('Expected a rendered Orbit preview transform.')
    const center = new DOMPoint(element.cx.baseVal.value, element.cy.baseVal.value).matrixTransform(matrix)
    return {
      cx: element.getAttribute('cx'),
      cy: element.getAttribute('cy'),
      rx: element.getAttribute('rx'),
      ry: element.getAttribute('ry'),
      center: { x: center.x, y: center.y },
      radius: element.rx.baseVal.value * Math.hypot(matrix.a, matrix.b),
    }
  })
  return { ...screenGeometry, ownerLocal: await wardenOrbitLocalGeometry(preview) }
}

async function expectOrbitOwnerGeometryToMatch(mark: Locator, expected: OrbitOwnerGeometry): Promise<void> {
  // CTM inversion can vary by less than 0.01 owner-local units across camera matrices.
  await expect.poll(async () => (await wardenOrbitLocalGeometry(mark)).center.x).toBeCloseTo(expected.center.x, 2)
  await expect.poll(async () => (await wardenOrbitLocalGeometry(mark)).center.y).toBeCloseTo(expected.center.y, 2)
  await expect.poll(async () => (await wardenOrbitLocalGeometry(mark)).radii.horizontal)
    .toBeCloseTo(expected.radii.horizontal, 2)
  await expect.poll(async () => (await wardenOrbitLocalGeometry(mark)).radii.vertical)
    .toBeCloseTo(expected.radii.vertical, 2)
}

async function expectOrbitPreviewRadiusToFollowFinger(
  preview: Locator,
  finger: TouchPoint,
): Promise<OrbitPreviewScreenGeometry> {
  let matchingGeometry: OrbitPreviewScreenGeometry | undefined
  // CDP dispatch can finish before the corresponding SVG geometry is rendered.
  await expect.poll(async () => {
    const geometry = await readOrbitPreviewScreenGeometry(preview)
    const pointerDistance = Math.hypot(
      finger.x - geometry.center.x,
      finger.y - geometry.center.y,
    )
    const difference = Math.abs(geometry.radius - pointerDistance)
    if (difference <= 2) matchingGeometry = geometry
    return difference
  }, { timeout: 2_000 }).toBeLessThanOrEqual(2)

  if (!matchingGeometry) throw new Error('Expected the Orbit preview to follow the active finger.')
  return matchingGeometry
}

async function readWorkspaceRecords(page: Page): Promise<StoredWorkspaceRecords> {
  return page.evaluate(async () => {
    const request = indexedDB.open('ttrpg-cluster-control')
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Could not open the workspace database.'))
    })

    try {
      const transaction = database.transaction('workspace', 'readonly')
      const transactionComplete = new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error ?? new Error('Could not read workspace records.'))
        transaction.onabort = () => reject(transaction.error ?? new Error('Workspace record read was aborted.'))
      })
      const store = transaction.objectStore('workspace')
      const read = (key: string) => new Promise<unknown>((resolve, reject) => {
        const item = store.get(key)
        item.onsuccess = () => resolve(item.result)
        item.onerror = () => reject(item.error ?? new Error(`Could not read the ${key} workspace record.`))
      })
      const [current, lastValid] = await Promise.all([
        read('current'),
        read('last-valid'),
        transactionComplete,
      ])
      return { current, lastValid }
    } finally {
      database.close()
    }
  })
}

test('touch takeover cancels Move previews, resumes Add Orbit after pinch, and pans only the view', async ({ page }) => {
  await captureMapExportBlobs(page)
  const { systemId, primaryObjectId } = await createSingleSystemWorkspace(page, {
    viewport: { width: 390, height: 844 },
  })
  await waitForWorkspaceSaved(page)
  const cdp = await enableTouch(page)

  // Keep the real leave animation mounted until the first map gesture has started.
  const exitStyle = await page.addStyleTag({ content: `
    .workspace-map-files-content[data-state="closed"] {
      animation-play-state: paused !important;
    }
  ` })
  const recordsBefore = await readWorkspaceRecords(page)
  const tap = async (target: Locator) => {
    await expect(target).toBeInViewport({ ratio: 1 })
    await dispatchTouch(cdp, 'touchStart', [await pointAtCenter(target)])
    await dispatchTouch(cdp, 'touchEnd', [])
  }
  await tap(page.getByRole('button', { name: 'Map files', exact: true }))
  await tap(page.getByRole('menuitem', { name: 'Download or back up', exact: true }))
  const downloads = page.getByRole('menu', { name: 'Download or back up', exact: true })
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    tap(downloads.getByRole('menuitem', { name: 'Download private Star System JSON', exact: true })),
  ])
  expect(download.suggestedFilename()).toMatch(/\.json$/i)
  const jsonBefore = await page.evaluate(async () => {
    const blob = (window as DownloadWindow).__mapExportBlobs?.shift()
    if (!blob) throw new Error('Could not read the downloaded JSON file.')
    return JSON.parse(await blob.text()) as ExportedMap
  })
  const closingFiles = page.locator('.workspace-map-files-content[data-state="closed"]')
  await expect(closingFiles.first()).toBeAttached()
  await expect(page.getByRole('toolbar', { name: 'Workspace navigation' })).toBeVisible()
  await setWorkspaceMapMode(page, 'Move')

  const map = wardenMap(page)
  const star = wardenObjectMark(page, systemId, primaryObjectId)
  const starPoint = async (id: number) => {
    // Add controls can still cover the map briefly while their closing animation settles.
    await expect.poll(() => exposedContinuousObjectHitPoint(star)).not.toBeNull()
    const point = await exposedContinuousObjectHitPoint(star)
    if (!point) throw new Error('The primary Star must expose a touch target on the live Warden map.')
    return { id, ...point }
  }
  const origin = await starPoint(1)
  const bounds = await map.boundingBox()
  if (!bounds) throw new Error('The system map has no visible bounds for touch input.')
  const scene = map.locator('.cluster-map-content')
  const objectTransformBefore = await star.getAttribute('transform')
  const objectPositionBefore = await wardenObjectLocalPosition(star)
  const viewportBefore = await scene.getAttribute('transform')
  const zoomOutput = workspaceZoomOutput(page)
  const zoomBefore = await zoomOutput.textContent()

  try {
    const firstMove = { ...origin, x: origin.x + 24, y: origin.y + 18 }
    await expect.poll(() => star.evaluate((mark, { x, y }) =>
      document.elementFromPoint(x, y)?.closest('.continuous-warden-object') === mark, origin)).toBe(true)
    await dispatchTouch(cdp, 'touchStart', [origin])
    await dispatchTouch(cdp, 'touchMove', [firstMove])
    const landingGhost = map.locator('.continuous-warden-branch-landing')
    await expect(landingGhost).toBeVisible()
    await expect.poll(() => star.getAttribute('transform')).not.toBe(objectTransformBefore)
    await exitStyle.evaluate(element => { element.parentNode?.removeChild(element) })

    const mapCenterX = bounds.x + bounds.width / 2
    const secondStart = {
      id: 2,
      x: firstMove.x < mapCenterX ? bounds.x + bounds.width - 24 : bounds.x + 24,
      y: Math.min(bounds.y + bounds.height - 24, firstMove.y + 36),
    }
    await dispatchTouch(cdp, 'touchStart', [firstMove, secondStart])
    await expect(landingGhost).toBeHidden()
    await expect.poll(async () => (await wardenObjectLocalPosition(star)).x).toBeCloseTo(objectPositionBefore.x, 2)
    await expect.poll(async () => (await wardenObjectLocalPosition(star)).y).toBeCloseTo(objectPositionBefore.y, 2)

    const direction = firstMove.x < mapCenterX ? 1 : -1
    const availableSpread = direction > 0
      ? bounds.x + bounds.width - 8 - secondStart.x
      : secondStart.x - bounds.x - 8
    const spread = Math.min(42, availableSpread)
    const firstPinchMove = {
      ...firstMove,
      x: firstMove.x - 12 * direction,
      y: firstMove.y + 18,
    }
    const secondPinchMove = {
      ...secondStart,
      x: secondStart.x + spread * direction,
      y: secondStart.y + 18,
    }
    await dispatchTouch(cdp, 'touchMove', [firstPinchMove, secondPinchMove])
    await expect.poll(() => scene.getAttribute('transform')).not.toBe(viewportBefore)
    await expect.poll(() => zoomOutput.textContent()).not.toBe(zoomBefore)
    const viewportAfterPinch = await scene.getAttribute('transform')
    if (!viewportAfterPinch) throw new Error('The map viewport is missing after pinch.')

    await dispatchTouch(cdp, 'touchEnd', [])
    const panStart = await map.evaluate(svg => {
      const { left, top, width, height } = svg.getBoundingClientRect()
      for (let y = top + 24; y < top + height - 24; y += 24) {
        for (let x = left + 24; x < left + width - 24; x += 24) {
          const hit = document.elementFromPoint(x, y)
          if (hit === svg || (hit && svg.contains(hit) && hit.matches('.map-background, .map-grid'))) {
            return { id: 1, x, y }
          }
        }
      }
      throw new Error('The system map has no unobstructed background point.')
    })
    const panDirection = panStart.x < mapCenterX ? 1 : -1
    const finalPan = { ...panStart, x: panStart.x + 24 * panDirection, y: panStart.y + 12 }
    await dispatchTouch(cdp, 'touchStart', [panStart])
    // A held background contact must remain available for camera panning beyond the long-press interval.
    await page.waitForTimeout(650)
    await expect(scene).toHaveAttribute('transform', viewportAfterPinch)
    await dispatchTouch(cdp, 'touchMove', [finalPan])
    await expect.poll(() => scene.getAttribute('transform')).not.toBe(viewportAfterPinch)
    await dispatchTouch(cdp, 'touchEnd', [])

    const zoomBeforeDoubleTap = await zoomOutput.textContent()
    if (!zoomBeforeDoubleTap) throw new Error('The map zoom readout is missing before the double tap.')
    for (let tap = 0; tap < 2; tap += 1) {
      await dispatchTouch(cdp, 'touchStart', [panStart])
      await dispatchTouch(cdp, 'touchEnd', [])
    }
    await expect(zoomOutput).not.toHaveText(zoomBeforeDoubleTap)
    await page.waitForTimeout(80)
    await expect.poll(async () => (await wardenObjectLocalPosition(star)).x).toBeCloseTo(objectPositionBefore.x, 2)
    await expect.poll(async () => (await wardenObjectLocalPosition(star)).y).toBeCloseTo(objectPositionBefore.y, 2)
    await expect(page.getByRole('toolbar', { name: 'Workspace navigation' })
      .getByRole('button', { name: 'Move', exact: true })).toHaveAttribute('aria-pressed', 'true')
  } finally {
    await exitStyle.evaluate(element => { element.parentNode?.removeChild(element) })
    await cdp.detach()
  }

  await waitForWorkspaceSaved(page)
  expect(await readWorkspaceRecords(page)).toEqual(recordsBefore)
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(jsonBefore)

  const orbitCdp = await enableTouch(page)
  try {
    await test.step('Add Orbit resumes around the same host after pinch only after fresh movement', async () => {
      await centerWorkspaceSelection(page)
      const quitAdd = page.getByRole('button', { name: 'Quit Add and return to Select' })
      const rings = map.locator(`.continuous-warden-orbit-target[data-system-id="${systemId}"]`)
      const preview = map.locator('.orbit-creation-preview-ring')
      const zoomOutput = workspaceZoomOutput(page)
      await expect(rings).toHaveCount(0)
      await (await dockAction(page, 'Add orbit')).click()
      await expect(quitAdd).toBeVisible()

      const pinchAndResume = async (firstId: number, secondId: number) => {
        const origin = await starPoint(firstId)
        const bounds = await map.boundingBox()
        if (!bounds) throw new Error('The system map has no visible bounds for Add Orbit touch input.')
        const mapCenterX = bounds.x + bounds.width / 2
        const firstDragged = { ...origin, x: origin.x + 48, y: origin.y + 8 }
        await dispatchTouch(orbitCdp, 'touchStart', [origin])
        await dispatchTouch(orbitCdp, 'touchMove', [firstDragged])
        await expect(preview).toBeVisible()
        await expect(rings).toHaveCount(0)
        const beforePinch = await readOrbitPreviewScreenGeometry(preview)

        const direction = firstDragged.x < mapCenterX ? 1 : -1
        const secondStart = {
          id: secondId,
          x: direction > 0 ? bounds.x + bounds.width - 24 : bounds.x + 24,
          y: Math.min(bounds.y + bounds.height - 24, firstDragged.y + 36),
        }
        const spread = Math.min(36, direction > 0
          ? bounds.x + bounds.width - 8 - secondStart.x
          : secondStart.x - bounds.x - 8)
        const firstPinchMove = { ...firstDragged, x: firstDragged.x - 12 * direction, y: firstDragged.y + 12 }
        const secondPinchMove = { ...secondStart, x: secondStart.x + spread * direction, y: secondStart.y + 12 }
        const transformBeforePinch = await scene.getAttribute('transform')
        const zoomBeforePinch = await zoomOutput.textContent()
        if (!transformBeforePinch || !zoomBeforePinch) throw new Error('Expected the map view before pinch.')

        await dispatchTouch(orbitCdp, 'touchStart', [firstDragged, secondStart])
        await dispatchTouch(orbitCdp, 'touchMove', [firstPinchMove, secondPinchMove])
        await expect.poll(() => scene.getAttribute('transform')).not.toBe(transformBeforePinch)
        await expect.poll(() => zoomOutput.textContent()).not.toBe(zoomBeforePinch)
        await expect(rings).toHaveCount(0)
        await expectOrbitOwnerGeometryToMatch(preview, beforePinch.ownerLocal)

        // Chromium dispatches touchEnd for the departing identifier while preserving the remaining contact.
        await dispatchTouch(orbitCdp, 'touchEnd', [secondPinchMove])
        await expect(preview).toBeVisible()
        const resumed = await expectOrbitPreviewRadiusToFollowFinger(preview, firstPinchMove)
        expect(resumed.ownerLocal.center.x).toBeCloseTo(beforePinch.ownerLocal.center.x, 2)
        expect(resumed.ownerLocal.center.y).toBeCloseTo(beforePinch.ownerLocal.center.y, 2)
        await expect(rings).toHaveCount(0)

        return { firstPinchMove, resumed }
      }

      const canceledGesture = await pinchAndResume(1, 2)
      await dispatchTouch(orbitCdp, 'touchEnd', [])
      await expect(rings).toHaveCount(0)
      await expect(preview).toHaveCount(0)
      await expect(quitAdd).toBeVisible()

      const completedGesture = await pinchAndResume(3, 4)
      const renewedMove = {
        ...completedGesture.firstPinchMove,
        x: completedGesture.firstPinchMove.x + 14,
        y: completedGesture.firstPinchMove.y + 4,
      }
      await dispatchTouch(orbitCdp, 'touchMove', [renewedMove])
      await expect(preview).toBeVisible()
      const finalPreview = await expectOrbitPreviewRadiusToFollowFinger(preview, renewedMove)
      if (finalPreview.cx === null || finalPreview.cy === null || finalPreview.rx === null || finalPreview.ry === null) {
        throw new Error('Expected complete Orbit preview geometry after renewed movement.')
      }
      expect(Math.abs(finalPreview.radius - completedGesture.resumed.radius), 'renewed movement changes the rendered preview radius')
        .toBeGreaterThan(2)
      const quitAddCenter = await quitAdd.evaluate((element, pointerId) => {
        const bounds = element.getBoundingClientRect()
        const point = { id: pointerId, x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }
        if (!element.contains(document.elementFromPoint(point.x, point.y))) {
          throw new Error('Expected the touch release point to hit Quit Add.')
        }
        return point
      }, completedGesture.firstPinchMove.id)
      await dispatchTouch(orbitCdp, 'touchMove', [quitAddCenter])
      await expect(preview).toBeVisible()
      await expect(preview).toHaveAttribute('cx', finalPreview.cx)
      await expect(preview).toHaveAttribute('cy', finalPreview.cy)
      await expect(preview).toHaveAttribute('rx', finalPreview.rx)
      await expect(preview).toHaveAttribute('ry', finalPreview.ry)
      await dispatchTouch(orbitCdp, 'touchEnd', [])

      await expect(preview).toHaveCount(0)
      await expect(quitAdd).toBeVisible()
      await expect(rings).toHaveCount(1)
      const created = rings.and(map.getByRole('button', { name: 'Select Orbit 1', exact: true }))
      await expect(created).toHaveAttribute('cx', finalPreview.cx)
      await expect(created).toHaveAttribute('cy', finalPreview.cy)
      await expect(created).toHaveAttribute('rx', finalPreview.rx)
      await expect(created).toHaveAttribute('ry', finalPreview.ry)
      expect(canceledGesture.resumed.ownerLocal.center.x).toBeCloseTo(finalPreview.ownerLocal.center.x, 2)
      expect(canceledGesture.resumed.ownerLocal.center.y).toBeCloseTo(finalPreview.ownerLocal.center.y, 2)

      const freshTap = await starPoint(5)
      await dispatchTouch(orbitCdp, 'touchStart', [freshTap])
      await dispatchTouch(orbitCdp, 'touchEnd', [])
      await expect(rings).toHaveCount(2)
      await expect(preview).toHaveCount(0)
    })
  } finally {
    await orbitCdp.detach()
  }

  await waitForWorkspaceSaved(page)
  const savedAfterTouch = await downloadJson(page, 'Export star system JSON')
  expect(savedAfterTouch.system?.id).toBe(systemId)
  expect(savedAfterTouch.system?.orbits.map(orbit => ({ hostId: orbit.hostId, order: orbit.order }))).toEqual([
    { hostId: primaryObjectId, order: 1 },
    { hostId: primaryObjectId, order: 2 },
  ])
})
