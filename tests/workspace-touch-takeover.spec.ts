import { expect, test, type Locator, type Page } from './fixtures'
import {
  captureMapExportBlobs,
  dockAction,
  downloadJson,
  setWorkspaceMapMode,
  waitForWorkspaceSaved,
  workspaceZoomOutput,
  zoomOutMapToMinimum,
} from './helpers'

type TouchPoint = { id: number; x: number; y: number }
type StoredWorkspaceRecords = { current: unknown; lastValid: unknown }
type OrbitPreviewScreenGeometry = {
  cx: string | null
  cy: string | null
  rx: string | null
  ry: string | null
  center: { x: number; y: number }
  radius: number
}

async function createWorkspace(
  page: Page,
  viewport = { width: 1440, height: 960 },
): Promise<void> {
  await page.setViewportSize(viewport)
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await waitForWorkspaceSaved(page)
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
  return preview.evaluate((element) => {
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
  const cdp = await enableTouch(page)
  await createWorkspace(page, { width: 390, height: 844 })

  // Keep the real leave animation mounted until the first map gesture has started.
  const exitStyle = await page.addStyleTag({ content: `
    [data-slot="content"][data-state="closed"]:has(> #workspace-header-map-files-panel) {
      animation-play-state: paused !important;
    }
  ` })
  const recordsBefore = await readWorkspaceRecords(page)
  const jsonBefore = await downloadJson(page, 'Export star system JSON')
  const closingFiles = page.locator('[data-slot="content"]:has(> #workspace-header-map-files-panel)')
  await expect(closingFiles).toHaveAttribute('data-state', 'closed')
  await expect(page.getByRole('toolbar', { name: 'Workspace navigation' })).toBeVisible()
  await setWorkspaceMapMode(page, 'Move')

  const map = page.getByRole('group', { name: 'Vesper star system map' })
  const star = map.locator('.system-object').first()
  const hitTarget = star.locator('.object-hit-target')
  const origin = await pointAtCenter(hitTarget)
  const bounds = await map.boundingBox()
  if (!bounds) throw new Error('The system map has no visible bounds for touch input.')
  const scene = map.locator('.system-map-content')
  const objectTransformBefore = await star.getAttribute('transform')
  const viewportBefore = await scene.getAttribute('transform')
  const zoomOutput = workspaceZoomOutput(page)
  const zoomBefore = await zoomOutput.textContent()

  try {
    const firstMove = { ...origin, x: origin.x + 24, y: origin.y + 18 }
    await dispatchTouch(cdp, 'touchStart', [origin])
    await dispatchTouch(cdp, 'touchMove', [firstMove])
    await expect.poll(() => star.getAttribute('transform')).not.toBe(objectTransformBefore)
    await exitStyle.evaluate(element => { element.parentNode?.removeChild(element) })

    const mapCenterX = bounds.x + bounds.width / 2
    const secondStart = {
      id: 2,
      x: firstMove.x < mapCenterX ? bounds.x + bounds.width - 24 : bounds.x + 24,
      y: Math.min(bounds.y + bounds.height - 24, firstMove.y + 36),
    }
    await dispatchTouch(cdp, 'touchStart', [firstMove, secondStart])
    await expect(star).toHaveAttribute('transform', objectTransformBefore!)

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
    await expect(star).toHaveAttribute('transform', objectTransformBefore!)
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
      await page.getByRole('button', { name: 'Fit map', exact: true }).click()
      await zoomOutMapToMinimum(page)
      const quitAdd = page.getByRole('button', { name: 'Quit Add and return to Select' })
      const map = page.getByRole('group', { name: 'Vesper star system map' })
      const host = map.getByRole('button', { name: 'Select A, Primary Star (Star)', exact: true })
        .locator('.object-hit-target')
      const rings = map.locator('.orbit-ring')
      const preview = map.locator('.system-creation-preview-orbit')
      const scene = map.locator('.system-map-content')
      const zoomOutput = workspaceZoomOutput(page)
      await expect(rings).toHaveCount(0)
      await (await dockAction(page, 'Add orbit')).click()
      await expect(quitAdd).toBeVisible()

      const pinchAndResume = async (firstId: number, secondId: number) => {
        const origin = { ...(await pointAtCenter(host)), id: firstId }
        const bounds = await map.boundingBox()
        if (!bounds) throw new Error('The system map has no visible bounds for Add Orbit touch input.')
        const mapCenterX = bounds.x + bounds.width / 2
        const firstDragged = { ...origin, x: origin.x + 48, y: origin.y + 8 }
        await dispatchTouch(orbitCdp, 'touchStart', [origin])
        await dispatchTouch(orbitCdp, 'touchMove', [firstDragged])
        await expect(preview).toBeVisible()
        await expect(rings).toHaveCount(0)
        const beforePinch = await readOrbitPreviewScreenGeometry(preview)
        if (beforePinch.cx === null || beforePinch.cy === null || beforePinch.rx === null || beforePinch.ry === null) {
          throw new Error('Expected complete Orbit preview geometry before pinch.')
        }

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
        await expect(preview).toHaveAttribute('cx', beforePinch.cx)
        await expect(preview).toHaveAttribute('cy', beforePinch.cy)
        await expect(preview).toHaveAttribute('rx', beforePinch.rx)
        await expect(preview).toHaveAttribute('ry', beforePinch.ry)

        // Chromium dispatches touchEnd for the departing identifier while preserving the remaining contact.
        await dispatchTouch(orbitCdp, 'touchEnd', [secondPinchMove])
        await expect(preview).toBeVisible()
        const resumed = await expectOrbitPreviewRadiusToFollowFinger(preview, firstPinchMove)
        expect(resumed.cx).toBe(beforePinch.cx)
        expect(resumed.cy).toBe(beforePinch.cy)
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
      const created = map.getByRole('group', { name: 'Orbit 1 around Primary Star', exact: true }).locator('.orbit-ring')
      await expect(created).toHaveAttribute('cx', finalPreview.cx)
      await expect(created).toHaveAttribute('cy', finalPreview.cy)
      await expect(created).toHaveAttribute('rx', finalPreview.rx)
      await expect(created).toHaveAttribute('ry', finalPreview.ry)
      expect(canceledGesture.resumed.cx).toBe(finalPreview.cx)
      expect(canceledGesture.resumed.cy).toBe(finalPreview.cy)

      const freshTap = { ...(await pointAtCenter(host)), id: 5 }
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
  expect(savedAfterTouch.system?.orbits).toHaveLength(2)
})
