import { expect, test, type Page } from './fixtures'
import { activeWorkspaceFeedback, downloadJson, setWorkspaceMapMode, workspaceZoomOutput } from './helpers'

type TouchPoint = { id: number; x: number; y: number }
type StoredWorkspaceRecords = { current: unknown; lastValid: unknown }
type DownloadWindow = Window & { __mapExportBlobs?: Blob[] }

async function createWorkspace(
  page: Page,
  viewport = { width: 1440, height: 960 },
): Promise<void> {
  await page.setViewportSize(viewport)
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()
}

async function installDownloadRecorder(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const downloadWindow = window as DownloadWindow
    downloadWindow.__mapExportBlobs = []
    const createObjectUrl = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (object) => {
      if (object instanceof Blob) downloadWindow.__mapExportBlobs?.push(object)
      return createObjectUrl(object)
    }
  })
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

async function readWorkspaceRecords(page: Page): Promise<StoredWorkspaceRecords> {
  return page.evaluate(async () => {
    const request = indexedDB.open('ttrpg-cluster-control', 1)
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

test('a second touch cancels a Move preview before pinch and pan change only the view', async ({ page }) => {
  await installDownloadRecorder(page)
  const cdp = await enableTouch(page)
  await createWorkspace(page, { width: 390, height: 844 })

  const recordsBefore = await readWorkspaceRecords(page)
  const jsonBefore = await downloadJson(page, 'Export star system JSON')
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

    await dispatchTouch(cdp, 'touchEnd', [])
    const panStart = { ...secondPinchMove, id: 1 }
    const panDirection = panStart.x < mapCenterX ? 1 : -1
    const finalPan = { ...panStart, x: panStart.x + 24 * panDirection, y: panStart.y + 12 }
    await dispatchTouch(cdp, 'touchStart', [panStart])
    await dispatchTouch(cdp, 'touchMove', [finalPan])
    await expect.poll(() => scene.getAttribute('transform')).not.toBe(viewportAfterPinch)
    await dispatchTouch(cdp, 'touchEnd', [])
    await page.waitForTimeout(80)
    await expect(star).toHaveAttribute('transform', objectTransformBefore!)
    await expect(page.getByRole('toolbar', { name: 'Workspace navigation' })
      .getByRole('button', { name: 'Move', exact: true })).toHaveAttribute('aria-pressed', 'true')
  } finally {
    await cdp.detach()
  }

  await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()
  expect(await readWorkspaceRecords(page)).toEqual(recordsBefore)
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(jsonBefore)
})

test('Navigate and Move long presses inspect the same system, consume release, and leave a fresh tap usable', async ({ page }) => {
  const cdp = await enableTouch(page)
  await createWorkspace(page, { width: 390, height: 844 })
  await page.getByRole('button', { name: 'Back to Jump Cluster' }).click()
  await expect(page.getByRole('toolbar', { name: 'Workspace navigation' })).toBeVisible()
  const inspector = page.locator('#workspace-inspector-panel')
  const systemMap = page.getByRole('group', { name: 'Vesper star system map' })

  try {
    await setWorkspaceMapMode(page, 'Navigate')
    const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
    const navigateTarget = clusterMap.getByRole('button', { name: 'Open Vesper system map' })
    const navigatePoint = await pointAtCenter(navigateTarget)
    await dispatchTouch(cdp, 'touchStart', [navigatePoint])
    await page.waitForTimeout(650)
    await expect(inspector).toBeVisible()
    await expect(inspector.getByRole('heading', { name: 'Vesper', exact: true })).toBeVisible()
    await expect(page.locator('.cluster-map-svg')).toHaveCount(1)
    await expect(systemMap).toHaveCount(0)
    await dispatchTouch(cdp, 'touchEnd', [])
    await expect(systemMap).toHaveCount(0)

    await page.getByRole('button', { name: 'Close inspector panel' }).click()
    await expect(inspector).toBeHidden()
    const freshNavigatePoint = await pointAtCenter(navigateTarget)
    await dispatchTouch(cdp, 'touchStart', [freshNavigatePoint])
    await dispatchTouch(cdp, 'touchEnd', [])
    await expect(systemMap).toBeVisible()

    await page.getByRole('button', { name: 'Back to Jump Cluster' }).click()
    await setWorkspaceMapMode(page, 'Move')
    const moveClusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
    const moveTarget = moveClusterMap.getByRole('button', { name: 'Select Vesper system' })
    const movePoint = await pointAtCenter(moveTarget)
    await dispatchTouch(cdp, 'touchStart', [movePoint])
    await page.waitForTimeout(650)
    await expect(inspector).toBeVisible()
    await expect(inspector.getByRole('heading', { name: 'Vesper', exact: true })).toBeVisible()
    await expect(page.locator('.cluster-map-svg')).toHaveCount(1)
    await expect(systemMap).toHaveCount(0)
    await dispatchTouch(cdp, 'touchEnd', [])
    await expect(systemMap).toHaveCount(0)

    await page.getByRole('button', { name: 'Close inspector panel' }).click()
    await expect(inspector).toBeHidden()
    const freshMovePoint = await pointAtCenter(moveTarget)
    await dispatchTouch(cdp, 'touchStart', [freshMovePoint])
    await dispatchTouch(cdp, 'touchEnd', [])
    await expect(moveClusterMap.locator('.cluster-system-node.is-selected')).toHaveCount(1)
    await expect(moveClusterMap).toBeVisible()
    await expect(systemMap).toHaveCount(0)
    await expect(inspector).toBeHidden()
    await expect(page.getByRole('toolbar', { name: 'Workspace navigation' })
      .getByRole('button', { name: 'Move', exact: true })).toHaveAttribute('aria-pressed', 'true')
  } finally {
    await cdp.detach()
  }
})
