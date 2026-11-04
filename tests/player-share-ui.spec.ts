import { readFile } from 'node:fs/promises'
import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { parsePlayerJson } from '../domain/player-codec'
import { createPlayerShareUrl, decodePlayerShareFragment } from '../utils/player-share-link'
import {
  addCatalogueObject,
  createSingleSystemWorkspace,
  editMapObject,
  openChartDetails,
  openWorkspaceHierarchy,
  returnToClusterMap,
  saveMapObject,
  selectInspectorOption,
  setHeaderMapActionsOpen,
  waitForWorkspaceSaved,
  waitForWorkspaceStartup,
} from './helpers'

type ShareMapOptions = {
  cluster: string
  system: string
  title: string
  object: string
  playerText: string
  notes?: string
}

async function createShareMap(page: Page, options: ShareMapOptions): Promise<void> {
  await createSingleSystemWorkspace(page, { clusterName: options.cluster, systemName: options.system })
  await addCatalogueObject(page, 'planet')
  const objectInspector = page.getByRole('complementary', { name: 'Object inspector', exact: true })
  await editMapObject(page)
  await objectInspector.getByLabel('Name', { exact: true }).fill(options.object)
  await objectInspector.getByLabel('Player text', { exact: true }).fill(options.playerText)
  await objectInspector.getByLabel('GM notes', { exact: true }).fill(options.notes ?? 'PRIVATE GM NOTES')
  await selectInspectorOption(objectInspector.getByLabel('How players see this object'), 'Revealed')
  await saveMapObject(page)
  await waitForWorkspaceSaved(page)
  await setPlayerTitle(page, options.title)
  await returnToClusterMap(page)
}

async function setPlayerTitle(page: Page, title: string): Promise<void> {
  const chartDetails = await openChartDetails(page)
  const editButton = chartDetails.getByRole('button', { name: 'Edit chart details', exact: true })
  await editButton.click()
  const chartEdit = page.getByRole('dialog', { name: 'Edit chart details', exact: true })
  await chartEdit.getByLabel('Player-facing title', { exact: true }).fill(title)
  await selectInspectorOption(chartEdit.getByLabel('How players see this system'), 'Revealed')
  await chartEdit.getByRole('button', { name: 'Apply details', exact: true }).click()
  await expect(chartEdit).toBeHidden()
  await waitForWorkspaceSaved(page)
}

async function openPublishedSystem(page: Page, systemName: string): Promise<void> {
  const clusterHierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  const systemEntry = clusterHierarchy.getByRole('navigation', { name: 'Star systems', exact: true })
    .getByRole('button', { name: `Open ${systemName} system map`, exact: true })
  await systemEntry.click()
  await expect(page.getByRole('group', { name: `${systemName} star system map`, exact: true })).toBeVisible()
}

async function editPublishedObjectText(page: Page, objectName: string, playerText: string): Promise<void> {
  const hierarchy = await openWorkspaceHierarchy(page, 'System hierarchy')
  const objectEntry = hierarchy.getByRole('treeitem', { name: new RegExp(objectName) }).last()
  await expect(objectEntry).toBeVisible()
  await objectEntry.click()
  await editMapObject(page)
  const inspector = page.getByRole('complementary', { name: 'Object inspector', exact: true })
  await inspector.getByLabel('Player text', { exact: true }).fill(playerText)
  await saveMapObject(page)
  await waitForWorkspaceSaved(page)
}

async function generatePlayerLink(page: Page): Promise<string> {
  await setHeaderMapActionsOpen(page, true)
  try {
    await page.getByRole('button', { name: 'Generate player link', exact: true }).click()
    const playerLink = page.getByRole('textbox', { name: 'Player snapshot link', exact: true })
    await expect(playerLink).toHaveAttribute('readonly', '')
    await expect(playerLink).toHaveValue(/#player=1\.gzip\.[A-Za-z0-9_-]+$/)
    return await playerLink.inputValue()
  } finally {
    await setHeaderMapActionsOpen(page, false)
  }
}

async function downloadMapJson(page: Page, buttonName: string): Promise<string> {
  await setHeaderMapActionsOpen(page, true)
  try {
    const pendingDownload = page.waitForEvent('download')
    await page.getByRole('button', { name: buttonName, exact: true }).click()
    const download = await pendingDownload
    const path = await download.path()
    if (!path) throw new Error(`The ${buttonName} download has no readable file path.`)
    return await readFile(path, 'utf8')
  } finally {
    await setHeaderMapActionsOpen(page, false)
  }
}

async function inspectPlayerObject(page: Page, systemMap: Locator, objectName: string): Promise<Locator> {
  await systemMap.getByRole('button', { name: `Inspect ${objectName}`, exact: true }).click()
  const playerNavigation = page.getByRole('toolbar', { name: 'Player map navigation', exact: true })
  const inspectToggle = playerNavigation.getByRole('button', { name: 'Inspect', exact: true })
  if (await inspectToggle.getAttribute('aria-expanded') !== 'true') await inspectToggle.click()
  const details = page.getByRole('region', { name: 'Player object details', exact: true })
  await expect(details).toBeVisible()
  return details
}

async function closeCompactPlayerDetails(page: Page): Promise<void> {
  const detailsPanel = page.getByRole('dialog', { name: 'Player details', exact: true })
  if (!await detailsPanel.isVisible()) return
  await detailsPanel.getByRole('button', { name: 'Return to map', exact: true }).click()
  await expect(detailsPanel).toBeHidden()
}

async function expectPlayerObject(
  page: Page,
  title: string,
  systemName: string,
  objectName: string,
  playerText: string,
): Promise<void> {
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible({ timeout: 30_000 })
  const clusterMap = page.getByRole('region', { name: 'Player-visible Jump Cluster map' })
  await clusterMap.getByRole('button', { name: new RegExp(`Open ${systemName}`) }).click()
  const systemMap = page.getByRole('region', { name: 'Player-visible system map' })
  const details = await inspectPlayerObject(page, systemMap, objectName)
  await expect(details).toContainText(playerText)
  await closeCompactPlayerDetails(page)
}

function highEntropyPlayerText(length: number): string {
  let state = 0x7a31c9d5
  const characters: string[] = []
  for (let index = 0; index < length; index += 1) {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    characters.push(String.fromCharCode(33 + ((state >>> 24) % 94)))
  }
  return characters.join('')
}

test('long unbroken player prose stays inside the compact reader viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const playerText = 'PublicArchive'.repeat(1_000)
  const url = await createPlayerShareUrl({
    format: 'ttrpg-cluster-control-player',
    version: 1,
    title: 'Archive Reach',
    systems: [{
      id: 'system-1',
      position: { x: 480, y: 280 },
      disclosure: 'revealed',
      type: 'star-system',
      label: 'Archive System',
      map: {
        objects: [{
          id: 'object-1',
          position: { x: 80, y: 280 },
          placement: { kind: 'system' },
          disclosure: 'revealed',
          family: 'CelestialBody',
          subtype: 'planet',
          label: 'Archive World',
          playerText,
          fields: [],
        }],
        orbits: [],
      },
    }],
    routes: [],
  }, new URL('/player', test.info().project.use.baseURL).href)
  await page.goto(url)
  await expectPlayerObject(page, 'Archive Reach', 'Archive System', 'Archive World', playerText)
  const width = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }))
  expect(width.document).toBeLessThanOrEqual(width.viewport)
})

test('a generated player link opens the exported public snapshot in a fresh reader context', async ({ browser, page }, testInfo) => {
  test.setTimeout(90_000)

  const privateClusterName = 'PRIVATE LANTERN REACH'
  const privateNotes = 'GM ONLY: PRIVATE LANTERN CACHE BELOW THE HARBOR.'
  const playerTitle = 'Pilgrim Reach'
  const publicSystemName = 'Vesper'
  const publicObjectName = 'Pilgrim World'
  const publicPlayerText = 'A quiet sanctuary rests beneath a violet sky.'

  await createSingleSystemWorkspace(page, {
    clusterName: privateClusterName,
    systemName: publicSystemName,
  })
  await addCatalogueObject(page, 'planet')

  const objectInspector = page.getByRole('complementary', { name: 'Object inspector', exact: true })
  await editMapObject(page)
  await objectInspector.getByLabel('Name', { exact: true }).fill(publicObjectName)
  await objectInspector.getByLabel('Player text', { exact: true }).fill(publicPlayerText)
  await objectInspector.getByLabel('GM notes', { exact: true }).fill(privateNotes)
  await selectInspectorOption(objectInspector.getByLabel('How players see this object'), 'Revealed')
  await saveMapObject(page)
  await waitForWorkspaceSaved(page)

  const chartDetails = await openChartDetails(page)
  await chartDetails.getByRole('button', { name: 'Edit chart details', exact: true }).click()
  const chartEdit = page.getByRole('dialog', { name: 'Edit chart details', exact: true })
  await chartEdit.getByLabel('Player-facing title', { exact: true }).fill(playerTitle)
  await selectInspectorOption(chartEdit.getByLabel('How players see this system'), 'Revealed')
  await chartEdit.getByRole('button', { name: 'Apply details', exact: true }).click()
  await expect(chartEdit).toBeHidden()
  await waitForWorkspaceSaved(page)
  await returnToClusterMap(page)

  await setHeaderMapActionsOpen(page, true)
  let referenceJson: string
  try {
    const pendingDownload = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export player JSON', exact: true }).click()
    const download = await pendingDownload
    const path = await download.path()
    if (!path) throw new Error('The player JSON download has no readable file path.')
    referenceJson = await readFile(path, 'utf8')
  } finally {
    await setHeaderMapActionsOpen(page, false)
  }

  const referenceDocument = parsePlayerJson(referenceJson)
  expect(referenceDocument.title).toBe(playerTitle)
  expect(referenceJson).not.toContain(privateClusterName)
  expect(referenceJson).not.toContain(privateNotes)
  const referenceSystem = referenceDocument.systems[0]
  if (!referenceSystem || referenceSystem.disclosure !== 'revealed') {
    throw new Error('The player JSON reference does not contain the expected Revealed system.')
  }
  expect(referenceSystem.label).toBe(publicSystemName)
  const referenceObject = referenceSystem.map.objects.find(object => object.label === publicObjectName)
  if (!referenceObject || referenceObject.disclosure !== 'revealed') {
    throw new Error('The player JSON reference does not contain the expected Revealed object.')
  }
  expect(referenceObject.playerText).toBe(publicPlayerText)

  await setHeaderMapActionsOpen(page, true)
  const generateLink = page.getByRole('button', { name: 'Generate player link', exact: true })
  await expect(generateLink).toBeVisible({ timeout: 5_000 })
  await generateLink.click()

  const playerLink = page.getByRole('textbox', { name: 'Player snapshot link', exact: true })
  await expect(playerLink).toHaveAttribute('readonly', '')
  await expect(playerLink).toHaveValue(/\S/)
  const playerUrl = await playerLink.inputValue()
  await test.step('inspect generated link controls on desktop and compact viewports', async () => {
    const initialViewport = page.viewportSize()
    const controls = page.getByRole('region', { name: 'Player snapshot link', exact: true })
    const desktopScreenshot = testInfo.outputPath('player-link-controls-desktop.png')
    await controls.screenshot({ path: desktopScreenshot })
    await testInfo.attach('player-link-controls-desktop', { path: desktopScreenshot, contentType: 'image/png' })
    await setHeaderMapActionsOpen(page, false)
    for (const panel of ['inspector', 'hierarchy']) {
      const close = page.getByRole('button', { name: `Close ${panel} panel`, exact: true })
      if (await close.isVisible()) await close.click()
    }
    await page.setViewportSize({ width: 390, height: 844 })
    await setHeaderMapActionsOpen(page, true)
    await expect(playerLink).toHaveValue(playerUrl)
    const copy = controls.getByRole('button', { name: 'Copy player link', exact: true })
    await copy.scrollIntoViewIfNeeded()
    await expect(copy).toBeVisible()
    const width = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }))
    expect(width.document).toBeLessThanOrEqual(width.viewport)
    const compactScreenshot = testInfo.outputPath('player-link-controls-compact.png')
    await page.screenshot({ path: compactScreenshot, fullPage: true })
    await testInfo.attach('player-link-controls-compact', { path: compactScreenshot, contentType: 'image/png' })
    await setHeaderMapActionsOpen(page, false)
    if (initialViewport) await page.setViewportSize(initialViewport)
  })
  const parsedPlayerUrl = new URL(playerUrl)
  expect(parsedPlayerUrl.search).toBe('')
  expect(parsedPlayerUrl.hash).toMatch(/^#player=1\.gzip\.[A-Za-z0-9_-]+$/)
  const rawFragment = parsedPlayerUrl.hash
  const compressedPayload = rawFragment.slice('#player=1.gzip.'.length)
  const publicDocumentValues = [playerTitle, publicSystemName, publicObjectName, publicPlayerText]
  const privateCanaries = [privateClusterName, privateNotes]

  await test.step('independently decompress the URL with native browser gzip', async () => {
    const nativeJson = await page.evaluate(async (href) => {
      const fragment = new URL(href).hash
      const prefix = '#player=1.gzip.'
      if (!fragment.startsWith(prefix)) throw new Error('The generated link has no versioned gzip fragment.')
      const encoded = fragment.slice(prefix.length)
      const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
      const padded = base64 + '='.repeat((4 - base64.length % 4) % 4)
      const binary = atob(padded)
      const compressed = Uint8Array.from(binary, character => character.charCodeAt(0))
      const reader = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip')).getReader()
      const chunks: Uint8Array[] = []
      let totalBytes = 0
      try {
        while (true) {
          const result = await reader.read()
          if (result.done) break
          totalBytes += result.value.byteLength
          if (totalBytes > 4 * 1024 * 1024) throw new Error('The decompressed player document exceeded its test bound.')
          chunks.push(result.value)
        }
      } finally {
        reader.releaseLock()
      }
      const bytes = new Uint8Array(totalBytes)
      let offset = 0
      for (const chunk of chunks) {
        bytes.set(chunk, offset)
        offset += chunk.byteLength
      }
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    }, playerUrl)
    expect(nativeJson).toBe(referenceJson)
    expect(nativeJson).not.toContain(privateClusterName)
    expect(nativeJson).not.toContain(privateNotes)
  })

  await test.step('production transport decoding matches the JSON export', async () => {
    expect(await decodePlayerShareFragment(rawFragment)).toEqual(referenceDocument)
  })

  const recipientContext = await test.step('create an isolated recipient context', async () =>
    browser.newContext({ baseURL: new URL(page.url()).origin }))
  try {
    const recipientPage = await test.step('open a fresh recipient tab', async () => recipientContext.newPage())
    const receivedHttpUrls: string[] = []
    const consoleMessages: Array<{ type: string; text: string }> = []
    const pageErrors: string[] = []
    recipientPage.on('request', request => {
      if (/^https?:\/\//i.test(request.url())) receivedHttpUrls.push(request.url())
    })
    recipientPage.on('console', message => {
      consoleMessages.push({ type: message.type(), text: message.text() })
    })
    recipientPage.on('pageerror', error => pageErrors.push(error.message))

    const response = await test.step('navigate a fresh recipient to the fragment URL', async () => {
      const response = await recipientPage.goto(playerUrl)
      if (!response) throw new Error('The player link navigation did not receive an HTTP response.')
      return response
    })

    const serverRenderedHtml = await test.step('read the player route server response body', async () => response.text())
    await test.step('verify SSR HTML excludes fragment and player document data', async () => {
      expect(serverRenderedHtml).not.toContain(rawFragment)
      expect(serverRenderedHtml).not.toContain(compressedPayload)
      expect(serverRenderedHtml).not.toContain(referenceJson)
      expect(serverRenderedHtml).not.toContain(encodeURIComponent(referenceJson))
      for (const value of [...publicDocumentValues, ...privateCanaries]) {
        expect(serverRenderedHtml).not.toContain(value)
      }
    })

    await test.step('render and inspect public system, object, and prose', async () => {
      await expect(recipientPage.getByRole('heading', { name: playerTitle, exact: true }))
        .toBeVisible({ timeout: 30_000 })

      const clusterMap = recipientPage.getByRole('region', { name: 'Player-visible Jump Cluster map' })
      await clusterMap.getByRole('button', { name: new RegExp(`Open ${publicSystemName}`) }).click()
      const systemMap = recipientPage.getByRole('region', { name: 'Player-visible system map' })
      const publicDetails = await inspectPlayerObject(recipientPage, systemMap, publicObjectName)
      await expect(publicDetails).toContainText(publicPlayerText)
      await expect(recipientPage.locator('body')).not.toContainText(privateClusterName)
      await expect(recipientPage.locator('body')).not.toContainText(privateNotes)
      await closeCompactPlayerDetails(recipientPage)
    })

    await test.step('check requests and diagnostics contain no fragment payload or map data', async () => {
      expect(receivedHttpUrls.length).toBeGreaterThan(0)
      for (const requestUrl of receivedHttpUrls) {
        const parsedRequestUrl = new URL(requestUrl)
        expect(parsedRequestUrl.hash).toBe('')
        expect(requestUrl).not.toContain(referenceJson)
        expect(requestUrl).not.toContain(encodeURIComponent(referenceJson))
        for (const value of [compressedPayload, ...publicDocumentValues, ...privateCanaries]) {
          const encodedValue = encodeURIComponent(value)
          expect(requestUrl).not.toContain(value)
          expect(requestUrl).not.toContain(encodedValue)
          expect(requestUrl).not.toContain(encodedValue.replace(/%20/g, '+'))
        }
      }

      expect(pageErrors).toEqual([])
      expect(consoleMessages.filter(message => /selector/i.test(message.text)))
        .toEqual([])
      for (const message of consoleMessages) {
        expect(message.text).not.toContain(rawFragment)
        expect(message.text).not.toContain(referenceJson)
        expect(message.text).not.toContain(encodeURIComponent(referenceJson))
        for (const value of [compressedPayload, ...publicDocumentValues, ...privateCanaries]) {
          expect(message.text).not.toContain(value)
          expect(message.text).not.toContain(encodeURIComponent(value))
        }
      }
    })
  } finally {
    await recipientContext.close()
  }
})

test('player links stay immutable across revisions and isolated across tabs, hash changes, and GM reload', async ({ page }) => {
  test.setTimeout(90_000)
  const privateCluster = 'PRIVATE WARDEN REACH'
  const privateNotes = 'PRIVATE WARDEN NOTES: HIDDEN CACHE BELOW THE HARBOR.'
  const systemName = 'Public Vesper'
  const objectName = 'Pilgrim World'
  const titleA = 'Pilgrim Reach A'
  const titleB = 'Pilgrim Reach B'
  const textA = 'The first immutable public account of the harbor.'
  const textB = 'A later public account describes the repaired harbor.'

  await createShareMap(page, {
    cluster: privateCluster,
    system: systemName,
    title: titleA,
    object: objectName,
    playerText: textA,
    notes: privateNotes,
  })
  const linkA = await generatePlayerLink(page)

  await openPublishedSystem(page, systemName)
  await editPublishedObjectText(page, objectName, textB)
  await setPlayerTitle(page, titleB)
  await returnToClusterMap(page)
  const linkB = await generatePlayerLink(page)
  expect(linkB).not.toBe(linkA)
  const documentA = await decodePlayerShareFragment(new URL(linkA).hash)
  const documentB = await decodePlayerShareFragment(new URL(linkB).hash)
  expect(documentA.title).toBe(titleA)
  expect(documentB.title).toBe(titleB)

  const savedGmBackup = await downloadMapJson(page, 'Export Jump Cluster JSON')
  const firstReader = await page.context().newPage()
  const secondReader = await page.context().newPage()
  try {
    await Promise.all([firstReader.goto(linkA), secondReader.goto(linkB)])
    await Promise.all([
      expectPlayerObject(firstReader, titleA, systemName, objectName, textA),
      expectPlayerObject(secondReader, titleB, systemName, objectName, textB),
    ])
    await expect(firstReader.locator('body')).not.toContainText(textB)
    await expect(secondReader.locator('body')).not.toContainText(textA)
    await expect(firstReader.locator('body')).not.toContainText(privateCluster)
    await expect(secondReader.locator('body')).not.toContainText(privateNotes)

    await firstReader.reload()
    await expectPlayerObject(firstReader, titleA, systemName, objectName, textA)

    await firstReader.evaluate(hash => { window.location.hash = hash }, new URL(linkB).hash)
    await expectPlayerObject(firstReader, titleB, systemName, objectName, textB)
    await expect(firstReader.locator('body')).not.toContainText(textA)
    await expect(secondReader.getByRole('heading', { name: titleB, exact: true })).toBeVisible()

    await firstReader.evaluate(() => { window.location.hash = '#player=2.gzip.AA' })
    await expect(firstReader.getByRole('alert')).toHaveText('This player link version is not supported.')
    await expect(firstReader.getByLabel('Open player JSON', { exact: true })).toHaveCount(0)
    await expect(firstReader.getByRole('region', { name: 'Player document', exact: true })).toHaveCount(0)
    await expect(firstReader.locator('body')).not.toContainText(privateCluster)

    await firstReader.reload()
    await expect(firstReader.getByRole('alert')).toHaveText('This player link version is not supported.')
    await expect(firstReader.getByLabel('Open player JSON', { exact: true })).toHaveCount(0)
    await firstReader.evaluate(hash => { window.location.hash = hash }, new URL(linkB).hash)
    await expectPlayerObject(firstReader, titleB, systemName, objectName, textB)
    await firstReader.reload()
    await expect(firstReader.getByRole('heading', { name: titleB, exact: true })).toBeVisible()

    await firstReader.evaluate(() => { window.location.hash = '' })
    await expect(firstReader.getByLabel('Open player JSON', { exact: true })).toBeEnabled()
    await expect(firstReader.getByRole('region', { name: 'Player document', exact: true })).toHaveCount(0)
    await expect(firstReader.getByRole('heading', { name: 'Open a player map', exact: true })).toBeVisible()

    const fileFallback = secondReader.getByRole('link', { name: 'Open player JSON instead', exact: true })
    await expect(fileFallback).toBeVisible()
    expect(await fileFallback.getAttribute('target')).toBeNull()
    await fileFallback.click()
    await expect(secondReader.getByLabel('Open player JSON', { exact: true })).toBeEnabled()
    await expect(secondReader.getByRole('heading', { name: 'Open a player map', exact: true })).toBeVisible()
    await expect(secondReader.getByRole('region', { name: 'Player document', exact: true })).toHaveCount(0)
    expect(new URL(secondReader.url()).hash).toBe('')
  } finally {
    await firstReader.close()
    await secondReader.close()
  }

  await page.reload()
  await waitForWorkspaceStartup(page)
  await returnToClusterMap(page)
  const reloadedGmBackup = await downloadMapJson(page, 'Export Jump Cluster JSON')
  expect(JSON.parse(reloadedGmBackup)).toEqual(JSON.parse(savedGmBackup))
  expect(reloadedGmBackup).toContain(privateCluster)
  expect(reloadedGmBackup).toContain(privateNotes)
})

test('copy retries the retained snapshot after edits and oversized snapshots fall back to player JSON', async ({ page }) => {
  test.setTimeout(90_000)
  const privateCluster = 'PRIVATE SABLE REACH'
  const privateNotes = 'PRIVATE SABLE WARDEN NOTES.'
  const systemName = 'Sable Vesper'
  const objectName = 'Sable World'
  const titleA = 'Sable Passage'
  const titleB = 'Sable Passage Recharted'
  const textA = 'The first public note remains available from its existing link.'
  const textB = 'The newer public note belongs to a different snapshot.'

  await createShareMap(page, {
    cluster: privateCluster,
    system: systemName,
    title: titleA,
    object: objectName,
    playerText: textA,
    notes: privateNotes,
  })
  const retainedUrl = await generatePlayerLink(page)

  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(page.url()).origin })
  await page.evaluate(() => {
    type ClipboardGateWindow = Window & { __playerShareClipboardWrites?: string[] }
    const trackedWindow = window as ClipboardGateWindow
    trackedWindow.__playerShareClipboardWrites = []
    let rejectFirstWrite = true
    Object.defineProperty(navigator.clipboard, 'writeText', {
      configurable: true,
      value: async (value: string) => {
        trackedWindow.__playerShareClipboardWrites?.push(value)
        if (rejectFirstWrite) {
          rejectFirstWrite = false
          throw new DOMException('Clipboard permission denied.', 'NotAllowedError')
        }
      },
    })
  })

  await setHeaderMapActionsOpen(page, true)
  const shareControls = page.getByRole('region', { name: 'Player snapshot link', exact: true })
  const playerLink = page.getByRole('textbox', { name: 'Player snapshot link', exact: true })
  await expect(playerLink).toHaveValue(retainedUrl)
  await shareControls.getByRole('button', { name: 'Copy player link', exact: true }).click()
  await expect(shareControls.getByRole('status')).toContainText('Copy failed. The link is still available below')
  await expect(playerLink).toHaveValue(retainedUrl)
  await setHeaderMapActionsOpen(page, false)

  await openPublishedSystem(page, systemName)
  await editPublishedObjectText(page, objectName, textB)
  await setPlayerTitle(page, titleB)
  await returnToClusterMap(page)
  await setHeaderMapActionsOpen(page, true)
  await expect(playerLink).toHaveValue(retainedUrl)
  await shareControls.getByRole('button', { name: 'Copy player link', exact: true }).click()
  await expect(shareControls.getByRole('status')).toContainText('Player link copied.')
  await expect(playerLink).toHaveValue(retainedUrl)
  const copiedUrls = await page.evaluate(() =>
    (window as Window & { __playerShareClipboardWrites?: string[] }).__playerShareClipboardWrites ?? [],
  )
  expect(copiedUrls).toEqual([retainedUrl, retainedUrl])
  const retainedDocument = await decodePlayerShareFragment(new URL(retainedUrl).hash)
  expect(retainedDocument.title).toBe(titleA)
  const retainedSystem = retainedDocument.systems[0]
  if (!retainedSystem || retainedSystem.disclosure !== 'revealed') {
    throw new Error('The retained player link does not contain the expected Revealed system.')
  }
  expect(retainedSystem.map.objects.find(object => object.label === objectName)).toMatchObject({ playerText: textA })
  await setHeaderMapActionsOpen(page, false)

  const largeText = highEntropyPlayerText(14_000)
  await openPublishedSystem(page, systemName)
  const hierarchy = await openWorkspaceHierarchy(page, 'System hierarchy')
  await hierarchy.getByRole('treeitem', { name: new RegExp(objectName) }).last().click()
  await editMapObject(page)
  const objectInspector = page.getByRole('complementary', { name: 'Object inspector', exact: true })
  await objectInspector.getByLabel('Player text', { exact: true }).fill(largeText)
  await saveMapObject(page)
  await waitForWorkspaceSaved(page)
  await returnToClusterMap(page)

  await setHeaderMapActionsOpen(page, true)
  await page.getByRole('button', { name: 'Generate player link', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('This player link exceeds the supported size limit.')
  await expect(shareControls.getByRole('status')).toContainText('Use Export player JSON above')
  await expect(playerLink).toHaveCount(0)
  const jsonFallback = page.getByRole('button', { name: 'Export player JSON', exact: true })
  await expect(jsonFallback).toBeVisible()

  const fallbackJson = await downloadMapJson(page, 'Export player JSON')
  const fallbackDocument = parsePlayerJson(fallbackJson)
  const fallbackSystem = fallbackDocument.systems[0]
  if (!fallbackSystem || fallbackSystem.disclosure !== 'revealed') {
    throw new Error('The JSON fallback does not contain the expected Revealed system.')
  }
  const fallbackObject = fallbackSystem.map.objects.find(object => object.label === objectName)
  if (!fallbackObject || fallbackObject.disclosure !== 'revealed') {
    throw new Error('The JSON fallback does not contain the expected Revealed object.')
  }
  expect(fallbackObject.playerText).toBe(largeText)
  expect(fallbackJson).not.toContain(privateCluster)
  expect(fallbackJson).not.toContain(privateNotes)
})
