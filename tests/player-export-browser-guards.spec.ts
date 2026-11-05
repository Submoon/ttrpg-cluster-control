import { readFile } from 'node:fs/promises'
import { expect, test } from './fixtures'
import { createPlayerInterfaceFixture } from './fixtures/player-interface-fixture'
import type { PlayerClusterDocument } from '../domain/player-projection'
import { parsePlayerJson } from '../domain/player-codec'
import {
  activeWorkspaceFeedback,
  addCatalogueObject,
  captureMapExportBlobs,
  createSingleSystemWorkspace,
  editMapObject,
  installWorkspaceWriteFailureGate,
  openChartDetails,
  readWorkspaceWriteFailureCount,
  restoreWorkspaceWriteFailureGate,
  returnToClusterMap,
  saveMapObject,
  selectInspectorOption,
  setHeaderMapActionsOpen,
  setWorkspaceMapMode,
  waitForWorkspaceSaved,
  workspaceMapContextType,
  type DownloadWindow,
} from './helpers'

type NativePngGate = {
  originalToBlob: typeof HTMLCanvasElement.prototype.toBlob
  canvas: HTMLCanvasElement | null
  callback: BlobCallback | null
  type: string | undefined
  quality: number | undefined
  started: boolean
  completed: boolean
}

type NativePngGateWindow = Window & { __playerExportPngGate?: NativePngGate }

async function createReadyPlayerSystem(
  page: import('@playwright/test').Page,
  names: { cluster: string; system: string; title: string },
): Promise<void> {
  await createSingleSystemWorkspace(page, { clusterName: names.cluster, systemName: names.system })
  await addCatalogueObject(page, 'planet')
  await editMapObject(page)
  const objectInspector = page.getByRole('complementary', { name: 'Object inspector', exact: true })
  await objectInspector.getByLabel('Name', { exact: true }).fill(`${names.system} Public World`)
  await selectInspectorOption(objectInspector.getByLabel('How players see this object'), 'Revealed')
  await saveMapObject(page)
  await waitForWorkspaceSaved(page)

  const chartDetails = await openChartDetails(page)
  await chartDetails.getByRole('button', { name: 'Edit chart details', exact: true }).click()
  const chartEdit = page.getByRole('dialog', { name: 'Edit chart details', exact: true })
  await chartEdit.getByLabel('Player-facing title', { exact: true }).fill(names.title)
  await selectInspectorOption(chartEdit.getByLabel('How players see this system'), 'Revealed')
  await chartEdit.getByRole('button', { name: 'Apply details', exact: true }).click()
  await expect(chartEdit).toBeHidden()
  await waitForWorkspaceSaved(page)
}

async function downloadPlayerJson(
  page: import('@playwright/test').Page,
): Promise<{ fileName: string; text: string; document: PlayerClusterDocument }> {
  await setHeaderMapActionsOpen(page, true)
  try {
    const pendingDownload = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export player JSON', exact: true }).click()
    const download = await pendingDownload
    const path = await download.path()
    if (!path) throw new Error('The player JSON download has no readable file path.')
    const text = await readFile(path, 'utf8')
    return {
      fileName: download.suggestedFilename(),
      text,
      document: parsePlayerJson(text),
    }
  } finally {
    await setHeaderMapActionsOpen(page, false)
  }
}

async function downloadPlayerJsonWhilePointerHeld(
  page: import('@playwright/test').Page,
): Promise<{ fileName: string; text: string; document: PlayerClusterDocument }> {
  const mapFiles = page.getByRole('button', { name: 'Map files', exact: true })
  await expect(mapFiles).toBeVisible()
  if (await mapFiles.getAttribute('aria-expanded') !== 'true') {
    await mapFiles.press('Enter')
    await expect(mapFiles).toHaveAttribute('aria-expanded', 'true')
  }

  const pendingDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export player JSON', exact: true }).press('Enter')
  const download = await pendingDownload
  const path = await download.path()
  if (!path) throw new Error('The player JSON download has no readable file path.')
  const text = await readFile(path, 'utf8')
  if (await mapFiles.getAttribute('aria-expanded') === 'true') await mapFiles.press('Enter')
  return {
    fileName: download.suggestedFilename(),
    text,
    document: parsePlayerJson(text),
  }
}

async function installNativePngCallbackGate(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    const trackedWindow = window as NativePngGateWindow
    const originalToBlob = HTMLCanvasElement.prototype.toBlob
    const gate: NativePngGate = {
      originalToBlob,
      canvas: null,
      callback: null,
      type: undefined,
      quality: undefined,
      started: false,
      completed: false,
    }
    trackedWindow.__playerExportPngGate = gate
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      if (type === 'image/png' && !gate.started) {
        gate.started = true
        gate.canvas = this
        gate.callback = callback
        gate.type = type
        gate.quality = quality
        return
      }
      return originalToBlob.call(this, callback, type, quality)
    }
  })
}

async function waitForNativePngCallbackGate(page: import('@playwright/test').Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => Boolean(
    (window as NativePngGateWindow).__playerExportPngGate?.started,
  ))).toBe(true)
}

async function releaseNativePngCallback(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    const gate = (window as NativePngGateWindow).__playerExportPngGate
    if (!gate?.canvas || !gate.callback || !gate.started) {
      throw new Error('The native player PNG callback is not waiting at the gate.')
    }
    HTMLCanvasElement.prototype.toBlob = gate.originalToBlob
    const callback = gate.callback
    gate.originalToBlob.call(gate.canvas, (blob) => {
      callback(blob)
      gate.completed = true
    }, gate.type, gate.quality)
  })
  await expect.poll(() => page.evaluate(() => Boolean(
    (window as NativePngGateWindow).__playerExportPngGate?.completed,
  ))).toBe(true)
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  }))
}

async function restoreNativePngCallbackGate(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    const trackedWindow = window as NativePngGateWindow
    const gate = trackedWindow.__playerExportPngGate
    if (!gate) return
    HTMLCanvasElement.prototype.toBlob = gate.originalToBlob
    delete trackedWindow.__playerExportPngGate
  })
}

test('reader Map files discards an old PNG when returning to the same public system', async ({ page }) => {
  const { json } = createPlayerInterfaceFixture()
  await captureMapExportBlobs(page)
  await page.goto('/player')
  const fileInput = page.getByLabel('Open player JSON', { exact: true })
  await expect(fileInput).toBeEnabled()
  await fileInput.setInputFiles({ name: 'interface.json', mimeType: 'application/json', buffer: Buffer.from(json) })
  const openSystem = page.getByRole('button', { name: 'Open Public System system preview', exact: true })
  const back = page.getByRole('button', { name: 'Back to Jump Cluster', exact: true })
  const mapFiles = page.getByRole('button', { name: 'Map files', exact: true })
  const exportPng = page.getByRole('button', { name: 'Export star system Public System PNG', exact: true })
  await openSystem.click()
  await installNativePngCallbackGate(page)

  try {
    await mapFiles.click()
    await exportPng.click()
    await waitForNativePngCallbackGate(page)
    await mapFiles.click()
    await expect(mapFiles).toHaveAttribute('aria-expanded', 'false')
    await back.click()
    await openSystem.click()
    await releaseNativePngCallback(page)
    expect(await page.evaluate(() => (window as DownloadWindow).__mapExportBlobs
      ?.some(blob => blob.type === 'image/png'))).toBe(false)

    await mapFiles.click()
    await page.getByRole('checkbox', { name: /^Light for printing$/i }).check()
    const pendingDownload = page.waitForEvent('download')
    await exportPng.click()
    const download = await pendingDownload
    expect(download.suggestedFilename()).toBe('Public System-player-star-system.png')
    const path = await download.path()
    if (!path) throw new Error('The player PNG download has no file.')
    const png = await readFile(path)
    expect(Array.from(png.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
    const sourceSvg = await page.evaluate(async () => {
      const blobs = (window as DownloadWindow).__mapExportBlobs ?? []
      return blobs.filter(blob => blob.type.startsWith('image/svg+xml')).at(-1)?.text()
    })
    expect(sourceSvg).toContain('Public System')
    expect(sourceSvg).toContain('Harbor World')
    expect(sourceSvg).toContain('#f5f4ee')
    expect(sourceSvg).not.toContain('PRIVATE_SOURCE_')
  } finally {
    if (!page.isClosed()) await restoreNativePngCallbackGate(page)
  }
})

test('player JSON stays on applied data during a resumable chart draft and held system drag', async ({ page }) => {
  test.setTimeout(60_000)
  await createReadyPlayerSystem(page, {
    cluster: 'PRIVATE_CHART_HELD_DRAFT',
    system: 'PUBLIC_KESTREL',
    title: 'PUBLIC_APPLIED_PLAYER_TITLE',
  })
  await returnToClusterMap(page)
  const baseline = await downloadPlayerJson(page)
  expect(baseline.document.title).toBe('PUBLIC_APPLIED_PLAYER_TITLE')
  expect(baseline.fileName).toBe('PUBLIC_APPLIED_PLAYER_TITLE-player-jump-cluster.json')

  const chartDetails = await openChartDetails(page)
  await chartDetails.getByRole('button', { name: 'Edit chart details', exact: true }).click()
  const chartEdit = page.getByRole('dialog', { name: 'Edit chart details', exact: true })
  await chartEdit.getByLabel('Player-facing title', { exact: true }).fill('PRIVATE_UNAPPLIED_PLAYER_TITLE_DRAFT')
  await page.keyboard.press('Escape')
  await expect(chartEdit).toBeHidden()
  const resumeDraft = activeWorkspaceFeedback(page).getByRole('button', {
    name: 'Resume chart details draft', exact: true,
  })
  await expect(resumeDraft).toBeVisible()

  const clusterMap = page.getByRole('group', { name: 'PRIVATE_CHART_HELD_DRAFT Jump Cluster map', exact: true })
  const system = clusterMap.locator('.cluster-system-node').first()
  const bounds = await system.boundingBox()
  if (!bounds) throw new Error('The public system marker has no visible bounds for the drag.')
  const history = page.getByRole('group', { name: 'Edit history', exact: true })
  const historyBefore = await history.innerText()
  await setWorkspaceMapMode(page, 'Move')
  const start = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + 54, start.y + 36, { steps: 5 })
  await expect(system).toHaveClass(/is-dragging/)
  const dragProjection = await downloadPlayerJsonWhilePointerHeld(page)
  expect(dragProjection.document).toEqual(baseline.document)
  expect(dragProjection.text).not.toContain('PRIVATE_CHART_HELD_DRAFT')
  expect(dragProjection.text).not.toContain('PRIVATE_UNAPPLIED_PLAYER_TITLE_DRAFT')
  await expect(system).toHaveClass(/is-dragging/)
  expect(await history.innerText()).toBe(historyBefore)

  await page.mouse.up()
  await waitForWorkspaceSaved(page)
  await expect(resumeDraft).toBeVisible()
})

test('player JSON exports an applied public title after its durable save fails', async ({ page }) => {
  test.setTimeout(60_000)
  await createReadyPlayerSystem(page, {
    cluster: 'PRIVATE_CHART_SAVE_FAILURE',
    system: 'PUBLIC_CASSIOPEIA',
    title: 'PUBLIC_TITLE_BEFORE_FAILURE',
  })
  const chartDetails = await openChartDetails(page)
  await chartDetails.getByRole('button', { name: 'Edit chart details', exact: true }).click()
  const chartEdit = page.getByRole('dialog', { name: 'Edit chart details', exact: true })
  const appliedTitle = 'PUBLIC_TITLE_APPLIED_WITH_FAILED_SAVE'
  await chartEdit.getByLabel('Player-facing title', { exact: true }).fill(appliedTitle)
  await installWorkspaceWriteFailureGate(page, 1)
  try {
    await chartEdit.getByRole('button', { name: 'Apply details', exact: true }).click()
    await expect(chartEdit).toBeHidden()
    const feedback = activeWorkspaceFeedback(page)
    await expect(feedback.locator('.save-feedback')).toContainText('Not saved.')
    expect(await readWorkspaceWriteFailureCount(page)).toBe(1)
  } finally {
    await restoreWorkspaceWriteFailureGate(page)
  }

  const history = page.getByRole('group', { name: 'Edit history', exact: true })
  const historyAfterApply = await history.innerText()
  const playerFile = await downloadPlayerJson(page)
  expect(playerFile.document.title).toBe(appliedTitle)
  expect(playerFile.document.systems).toHaveLength(1)
  expect(playerFile.document.systems[0]).toMatchObject({
    disclosure: 'revealed',
    label: 'PUBLIC_CASSIOPEIA',
  })
  expect(playerFile.text).not.toContain('PRIVATE_CHART_SAVE_FAILURE')
  expect(await history.innerText()).toBe(historyAfterApply)
  await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toContainText('Not saved.')
})

for (const staleChange of ['map context', 'applied revision'] as const) {
  test(`a delayed native player PNG callback drops its result after the ${staleChange} changes`, async ({ page }) => {
    test.setTimeout(60_000)
    await captureMapExportBlobs(page)
    await createReadyPlayerSystem(page, {
      cluster: `PRIVATE_CHART_PNG_${staleChange === 'map context' ? 'MAP' : 'REVISION'}`,
      system: staleChange === 'map context' ? 'PUBLIC_PNG_MAP' : 'PUBLIC_PNG_REVISION',
      title: 'PUBLIC_PNG_INITIAL_TITLE',
    })
    const history = page.getByRole('group', { name: 'Edit history', exact: true })
    const historyBefore = await history.innerText()
    let downloads = 0
    const observeDownload = () => { downloads += 1 }
    page.on('download', observeDownload)
    await installNativePngCallbackGate(page)

    try {
      await setHeaderMapActionsOpen(page, true)
      await page.getByRole('button', { name: 'Export player PNG', exact: true }).click()
      await waitForNativePngCallbackGate(page)

      let expectedHistoryAfterChange = historyBefore
      if (staleChange === 'applied revision') {
        await setHeaderMapActionsOpen(page, false)
        const chartDetails = await openChartDetails(page)
        await chartDetails.getByRole('button', { name: 'Edit chart details', exact: true }).click()
        const chartEdit = page.getByRole('dialog', { name: 'Edit chart details', exact: true })
        await chartEdit.getByLabel('Player-facing title', { exact: true }).fill('PUBLIC_TITLE_CHANGED_DURING_PNG')
        await chartEdit.getByRole('button', { name: 'Apply details', exact: true }).click()
        await expect(chartEdit).toBeHidden()
        await waitForWorkspaceSaved(page)
        await expect(workspaceMapContextType(page)).toHaveText('Star System')
        expectedHistoryAfterChange = await history.innerText()
        expect(expectedHistoryAfterChange).not.toBe(historyBefore)
      } else {
        await setHeaderMapActionsOpen(page, false)
        await page.getByRole('button', { name: 'Back to Jump Cluster', exact: true }).click()
        await expect(workspaceMapContextType(page)).toHaveText('Jump Cluster')
      }

      await releaseNativePngCallback(page)
      expect(downloads).toBe(0)
      expect(await history.innerText()).toBe(expectedHistoryAfterChange)
      const capturedImageTypes = await page.evaluate(() =>
        ((window as DownloadWindow).__mapExportBlobs ?? []).map(blob => blob.type),
      )
      expect(capturedImageTypes.some(type => type.startsWith('image/png'))).toBe(false)

      await setHeaderMapActionsOpen(page, true)
      await expect(page.locator('.workspace-player-exports [role="alert"]')).toHaveCount(0)
      await setHeaderMapActionsOpen(page, false)
    } finally {
      await restoreNativePngCallbackGate(page)
      page.off('download', observeDownload)
    }
  })
}
