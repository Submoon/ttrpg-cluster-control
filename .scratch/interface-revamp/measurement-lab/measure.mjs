import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const lab = path.dirname(fileURLToPath(import.meta.url))
const artifacts = path.join(lab, 'artifacts')
const fixture = JSON.parse(await fs.readFile(path.join(lab, 'fixture.json'), 'utf8'))
await fs.mkdir(artifacts, { recursive: true })

const conditions = [
  { id: 'desktop', viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, cpu: 1, latency: 20, down: 10_000_000, up: 5_000_000 },
  { id: 'mobile-emulation', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, cpu: 4, latency: 150, down: 1_600_000, up: 750_000 },
]
const arms = [
  { id: 'baseline', origin: 'http://127.0.0.1:3121', path: '/' },
  { id: 'B', origin: 'http://127.0.0.1:3122', path: '/?variant=B' },
]
const sampleCount = Number(process.env.SAMPLES ?? 5)
const runConditions = process.env.CONDITIONS ? conditions.filter(condition => process.env.CONDITIONS.split(',').includes(condition.id)) : conditions

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const records = []
const activeContexts = new Set()
const focusTheme = []
const consoleEvents = []

function totals(rows, predicate = () => true) {
  const selected = rows.filter(row => row.encodedDataLength !== undefined && predicate(row))
  const groups = { document: 0, js: 0, css: 0, font: 0, image: 0, other: 0 }
  for (const row of selected) groups[row.kind] = (groups[row.kind] ?? 0) + row.encodedDataLength
  return { receivedBytes: selected.reduce((sum, row) => sum + row.encodedDataLength, 0), requestCount: selected.length, byKind: groups }
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))]
}

function summarize(values) {
  const sorted = [...values].sort((a, b) => a - b)
  return { n: sorted.length, min: sorted[0], median: percentile(sorted, 0.5), max: sorted.at(-1) }
}

async function seedBaseline(context, origin) {
  const setup = await context.newPage()
  await setup.goto(origin, { waitUntil: 'domcontentloaded' })
  await setup.waitForLoadState('load')
  await setup.evaluate(async workspace => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('ttrpg-cluster-control', 1)
      request.onupgradeneeded = () => request.result.createObjectStore('workspace')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    await new Promise((resolve, reject) => {
      const tx = db.transaction('workspace', 'readwrite')
      const store = tx.objectStore('workspace')
      store.put(workspace, 'current')
      store.put(workspace, 'last-valid')
      tx.oncomplete = resolve
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
    db.close()
  }, fixture)
  const cdp = await context.newCDPSession(setup)
  await cdp.send('Network.clearBrowserCache')
  await cdp.detach()
  await setup.close()
}

async function instrumentPage(page) {
  await page.addInitScript(() => {
    const probe = { maps: {}, clicks: [], transforms: [], frameTimes: [], observing: true }
    Object.defineProperty(window, '__measureProbe', { value: probe, configurable: false })
    const recordMap = () => {
      for (const [kind, selector] of [['cluster', 'svg.cluster-map-svg'], ['system', 'svg.system-map-svg']]) {
        if (probe.maps[kind]) continue
        const map = document.querySelector(selector)
        if (map?.getClientRects().length) probe.maps[kind] = { at: performance.now(), wall: Date.now() }
      }
      for (const node of document.querySelectorAll('.cluster-map-content, .system-map-content')) {
        if (node.dataset.measureObserved) continue
        node.dataset.measureObserved = 'true'
        const observer = new MutationObserver(() => probe.transforms.push({ at: performance.now(), transform: node.getAttribute('transform'), kind: node.classList.contains('cluster-map-content') ? 'cluster' : 'system' }))
        observer.observe(node, { attributes: true, attributeFilter: ['transform'] })
      }
    }
    new MutationObserver(recordMap).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] })
    document.addEventListener('DOMContentLoaded', recordMap, { once: true })
    document.addEventListener('click', event => {
      const target = event.target instanceof Element ? event.target.closest('button,[role="button"],a') : null
      if (!target) return
      probe.clicks.push({ at: performance.now(), wall: Date.now(), label: target.getAttribute('aria-label') || target.innerText?.trim().replace(/\s+/g, ' ').slice(0, 100) || target.title || '' })
    }, true)
    const raf = () => {
      if (!probe.observing) return
      probe.frameTimes.push(performance.now())
      requestAnimationFrame(raf)
    }
    requestAnimationFrame(raf)
  })
}

function classify(row) {
  const type = row.type || ''
  const mime = row.mimeType || ''
  const url = row.url || ''
  if (type === 'Document') return 'document'
  if (type === 'Script' || /javascript|ecmascript/.test(mime) || /\.m?js(?:\?|$)/i.test(url)) return 'js'
  if (type === 'Stylesheet' || mime === 'text/css' || /\.css(?:\?|$)/i.test(url)) return 'css'
  if (type === 'Font' || /font|woff|ttf|otf/.test(mime) || /\.(?:woff2?|ttf|otf)(?:\?|$)/i.test(url)) return 'font'
  if (type === 'Image' || mime.startsWith('image/') || /\.(?:png|jpe?g|gif|svg|webp|avif)(?:\?|$)/i.test(url)) return 'image'
  return 'other'
}

async function hideMobileInspectorIfOpen(page) {
  const toggle = page.locator('.b-tool-rail button[title="Toggle inspector"]')
  if (!(await toggle.count())) return
  if (await toggle.getAttribute('aria-expanded') === 'true') {
    await toggle.click()
    await page.waitForFunction(() => document.querySelector('.b-tool-rail button[title="Toggle inspector"]')?.getAttribute('aria-expanded') === 'false')
  }
}

async function clickToMap(page, clickTarget, mapSelector) {
  const clickIndex = await page.evaluate(() => window.__measureProbe.clicks.length)
  await clickTarget.click({ timeout: 10_000 })
  await page.locator(mapSelector).waitFor({ state: 'visible', timeout: 30_000 })
  return await page.evaluate(async clickIndex => {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const click = window.__measureProbe.clicks[clickIndex] ?? null
    return {
      clickLabel: click?.label ?? null,
      clickAt: click?.at ?? null,
      clickWall: click?.wall ?? null,
      mapVisiblePlusTwoRafAt: performance.now(),
      clickToMapVisiblePlusTwoRafMs: click ? performance.now() - click.at : null,
    }
  }, clickIndex)
}

async function returnToCluster(page, arm) {
  if (arm.id === 'baseline') {
    let back = page.locator('button[aria-label="Cluster map"]')
    if (!(await back.isVisible().catch(() => false))) {
      const showHierarchy = page.locator('button[aria-label="Show hierarchy panel"]')
      if (await showHierarchy.isVisible().catch(() => false)) await showHierarchy.click()
    }
    back = page.locator('button[aria-label="Cluster map"]')
    return back
  }
  return page.locator('.b-breadcrumb button').filter({ hasText: 'JUMP CLUSTER' }).first()
}

async function collapseBaselineHierarchyForMobile(page, condition, arm) {
  if (arm.id !== 'baseline' || !condition.isMobile) return { attempted: false }
  const collapse = page.locator('button[aria-label="Collapse hierarchy panel"]')
  if (!(await collapse.isVisible().catch(() => false))) return { attempted: false, reason: 'collapse control not visible' }
  const box = await collapse.boundingBox()
  const hitTest = box ? await page.evaluate(({ x, y }) => {
    const element = document.elementFromPoint(x, y)
    const rect = element?.getBoundingClientRect()
    return element ? { tag: element.tagName.toLowerCase(), ariaLabel: element.getAttribute('aria-label'), className: typeof element.className === 'string' ? element.className : '', text: element.textContent?.trim().slice(0, 100) ?? '', box: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null } : null
  }, { x: box.x + box.width / 2, y: box.y + box.height / 2 }) : null
  try {
    await collapse.click({ timeout: 2_000 })
    return { attempted: true, activation: 'pointer', controlBox: box, hitTest }
  } catch (error) {
    return { attempted: true, activation: 'pointer-blocked', controlBox: box, hitTest, pointerError: error.message.split('\n')[0] }
  }
}

async function runGesture(page, cdp, kind, condition) {
  const selector = `svg.${kind}-map-svg`
  const map = page.locator(selector).first()
  const box = await map.boundingBox()
  if (!box) return { kind, skipped: 'visible map has no box' }
  const x = box.x + box.width * 0.12
  const y = box.y + box.height * 0.82
  const targetCheck = await page.evaluate(({ x, y, selector }) => {
    const target = document.elementFromPoint(x, y)
    return { target: target ? `${target.tagName.toLowerCase()}.${String(target.getAttribute('class') || '').replace(/\s+/g, '.')}` : null, insideMap: !!target?.closest(selector) }
  }, { x, y, selector })
  if (!targetCheck.insideMap) return { kind, skipped: 'gesture point is occluded or outside SVG', targetCheck }
  const before = await page.locator(`.${kind}-map-content`).getAttribute('transform')
  const beforeChange = await page.evaluate(() => window.__measureProbe.transforms.length)
  const frameStartIndex = await page.evaluate(() => window.__measureProbe.frameTimes.length)
  const start = await page.evaluate(() => performance.now())
  if (condition.hasTouch) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] })
    for (let i = 1; i <= 6; i++) {
      await new Promise(resolve => setTimeout(resolve, 18))
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 24 * i, y: y - 9 * i, id: 1 }] })
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  } else {
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
    for (let i = 1; i <= 6; i++) {
      await new Promise(resolve => setTimeout(resolve, 18))
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x + 24 * i, y: y - 9 * i, button: 'left', buttons: 1 })
    }
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x + 144, y: y - 54, button: 'left', clickCount: 1 })
  }
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  const moved = await page.locator(`.${kind}-map-content`).getAttribute('transform')
  const afterMove = await page.evaluate(frameStartIndex => ({ now: performance.now(), changes: window.__measureProbe.transforms.slice(frameStartIndex), frames: window.__measureProbe.frameTimes.slice(frameStartIndex) }), frameStartIndex)
  const panChanges = afterMove.changes.filter(change => change.at >= start)
  const panFirstChange = panChanges.find(change => change.transform !== before)
  const panFrames = afterMove.frames.filter(timestamp => timestamp >= start && timestamp <= afterMove.now)
  const panIntervals = panFrames.slice(1).map((v, i) => v - panFrames[i]).filter(v => v > 0)
  const pan = { kind, transformBefore: before, transformAfter: moved, transformChanged: before !== moved, observedTransformMutations: panChanges.length, firstInputToTransformChangeMs: panFirstChange ? panFirstChange.at - start : null, scriptedGestureDurationToTwoRafMs: afterMove.now - start }
  const zoomBefore = moved
  const zoomChangeIndex = await page.evaluate(() => window.__measureProbe.transforms.length)
  const zoomStart = await page.evaluate(() => performance.now())
  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.45)
  await page.mouse.wheel(0, -220)
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  const zoomAfter = await page.locator(`.${kind}-map-content`).getAttribute('transform')
  const zoomData = await page.evaluate(zoomChangeIndex => ({ now: performance.now(), changes: window.__measureProbe.transforms.slice(zoomChangeIndex) }), zoomChangeIndex)
  const zoomElapsed = zoomData.now - zoomStart
  const zoomFirstChange = zoomData.changes.find(change => change.transform !== zoomBefore)
  return {
    ...pan,
    wheelZoomBefore: zoomBefore,
    wheelZoomAfter: zoomAfter,
    wheelZoomChanged: zoomBefore !== zoomAfter,
    wheelInputToTransformChangeMs: zoomFirstChange ? zoomFirstChange.at - zoomStart : null,
    wheelInputToTwoRafMs: zoomElapsed,
    rafFrameCountDuringPanWindow: panIntervals.length,
    rafIntervalMedianMs: panIntervals.length ? summarize(panIntervals).median : null,
    rafIntervalsOver32ms: panIntervals.filter(v => v > 32).length,
    targetCheck,
  }
}

async function runOne(arm, condition, sample) {
  const context = await browser.newContext({
    viewport: condition.viewport,
    deviceScaleFactor: 1,
    isMobile: condition.isMobile,
    hasTouch: condition.hasTouch,
    colorScheme: 'light',
    reducedMotion: 'reduce',
  })
  activeContexts.add(context)
  if (arm.id === 'baseline') await seedBaseline(context, arm.origin)
  const page = await context.newPage()
  await instrumentPage(page)
  const cdp = await context.newCDPSession(page)
  const rows = []
  const requests = new Map()
  const errors = []
  const icons = []
  await cdp.send('Network.enable')
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: condition.cpu })
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: condition.latency,
    downloadThroughput: condition.down / 8,
    uploadThroughput: condition.up / 8,
    connectionType: condition.id === 'desktop' ? 'wifi' : 'cellular4g',
  })
  cdp.on('Network.requestWillBeSent', event => {
    const row = { requestId: event.requestId, url: event.request.url, method: event.request.method, type: event.type, startWall: event.wallTime ? event.wallTime * 1000 : Date.now(), startTimestamp: event.timestamp, timeOriginWallMs: event.wallTime ? event.wallTime * 1000 - event.timestamp * 1000 : null, initiator: event.initiator?.type }
    requests.set(event.requestId, row)
    if (/icon|iconify/i.test(row.url)) icons.push({ at: 'request', url: row.url })
  })
  cdp.on('Network.responseReceived', event => {
    const row = requests.get(event.requestId)
    if (!row) return
    row.status = event.response.status
    row.mimeType = event.response.mimeType
    row.fromDiskCache = event.response.fromDiskCache
    row.fromServiceWorker = event.response.fromServiceWorker
    row.responseWall = row.timeOriginWallMs === null ? Date.now() : row.timeOriginWallMs + event.timestamp * 1000
    if (/icon|iconify/i.test(row.url)) icons.push({ at: 'response', url: row.url, status: row.status, mimeType: row.mimeType })
  })
  cdp.on('Network.loadingFinished', event => {
    const row = requests.get(event.requestId)
    if (!row) return
    row.encodedDataLength = event.encodedDataLength
    row.finishWall = row.timeOriginWallMs === null ? Date.now() : row.timeOriginWallMs + event.timestamp * 1000
    row.kind = classify(row)
    rows.push(row)
  })
  cdp.on('Network.loadingFailed', event => {
    const row = requests.get(event.requestId)
    if (!row) return
    row.failed = event.errorText
    row.canceled = event.canceled
    row.finishWall = row.timeOriginWallMs === null ? Date.now() : row.timeOriginWallMs + event.timestamp * 1000
    row.kind = classify(row)
    rows.push(row)
    errors.push({ kind: 'network', url: row.url, error: event.errorText })
  })
  page.on('console', message => { if (message.type() === 'error' || /hydration/i.test(message.text())) errors.push({ kind: 'console', type: message.type(), text: message.text() }) })
  page.on('pageerror', error => errors.push({ kind: 'pageerror', text: error.stack || error.message }))
  page.on('requestfailed', request => errors.push({ kind: 'requestfailed', url: request.url(), failure: request.failure()?.errorText }))

  const partial = { arm: arm.id, condition: condition.id, sample, url: `${arm.origin}${arm.path}`, timestamp: new Date().toISOString(), stages: {} }
  const writeCheckpoint = async () => fs.writeFile(path.join(artifacts, `${arm.id}-${condition.id}-run-${sample}.partial.json`), JSON.stringify({
    ...partial,
    currentResources: rows,
    errors,
  }, null, 2))

  const url = `${arm.origin}${arm.path}`
  const navResponse = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  const ssrHtml = await navResponse.text()
  partial.ssr = { status: navResponse.status(), htmlBytes: Buffer.byteLength(ssrHtml), htmlPath: `${arm.id}-${condition.id}-ssr.html` }
  partial.stages.navigation = { responseStatus: navResponse.status(), htmlBytes: Buffer.byteLength(ssrHtml) }
  if (sample === 1) await fs.writeFile(path.join(artifacts, `${arm.id}-${condition.id}-ssr.html`), ssrHtml)
  try {
    await page.waitForFunction(() => {
      const probe = window.__measureProbe
      const cluster = document.querySelector('svg.cluster-map-svg')
      const system = document.querySelector('svg.system-map-svg')
      return (!!cluster?.getClientRects().length && !!probe?.maps?.cluster)
        || (!!system?.getClientRects().length && !!probe?.maps?.system)
    }, null, { timeout: 30_000 })
  } catch (error) {
    const startupFailure = {
      ...partial,
      failure: { stage: 'native-map-startup', message: error.message },
      startupDiagnostics: await page.evaluate(() => ({ body: document.body.innerText.slice(0, 6000), svgCount: document.querySelectorAll('svg').length, htmlTheme: document.documentElement.dataset.theme ?? null })),
      resources: rows,
      consoleAndRequestErrors: errors,
    }
    if (sample === 1) await page.screenshot({ path: path.join(artifacts, `${arm.id}-${condition.id}-startup-failure.png`), fullPage: true }).catch(() => {})
    records.push(startupFailure)
    await fs.writeFile(path.join(artifacts, `${arm.id}-${condition.id}-run-${sample}.json`), JSON.stringify(startupFailure, null, 2))
    await cdp.detach()
    await context.close()
    activeContexts.delete(context)
    return startupFailure
  }
  const startup = await page.evaluate(async () => {
    const nav = performance.getEntriesByType('navigation')[0]
    const mapKind = document.querySelector('svg.cluster-map-svg')?.getClientRects().length ? 'cluster' : 'system'
    const map = window.__measureProbe.maps[mapKind]
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    return {
      initialMapKind: mapKind,
      navigationStart: nav?.startTime ?? 0,
      responseEnd: nav?.responseEnd ?? null,
      domContentLoaded: nav?.domContentLoadedEventEnd ?? null,
      loadEventEnd: nav?.loadEventEnd ?? null,
      firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
      nativeMapMutationAt: map.at,
      nativeMapMutationWall: map.wall,
      nativeMapMountedPlusTwoRaf: performance.now(),
      elapsedToMapMountMutationMs: map.at - (nav?.startTime ?? 0),
      elapsedToMapMountPlusTwoRafMs: performance.now() - (nav?.startTime ?? 0),
      hydratedControls: document.querySelectorAll('button').length,
      clusterNodeCount: document.querySelectorAll('svg.cluster-map-svg .cluster-system-node').length,
      clusterRouteCount: document.querySelectorAll('svg.cluster-map-svg .cluster-route').length,
      systemObjectCount: document.querySelectorAll('svg.system-map-svg .system-object').length,
      systemOrbitCount: document.querySelectorAll('svg.system-map-svg .orbit-mark').length,
      firstClusterSvgServerRendered: !!document.querySelector('svg.cluster-map-svg'),
      firstSystemSvgServerRendered: !!document.querySelector('svg.system-map-svg'),
      htmlColorScheme: getComputedStyle(document.documentElement).colorScheme,
      osPrefersDark: matchMedia('(prefers-color-scheme: dark)').matches,
      htmlTheme: document.documentElement.dataset.theme || null,
      prototypeHtmlTheme: document.documentElement.dataset.prototypeTheme || null,
      shellTheme: document.querySelector('.proto-shell')?.getAttribute('data-theme') || null,
      ssrShell: !!document.querySelector('.proto-shell'),
    }
  })
  const initialTotals = totals(rows, row => row.finishWall <= startup.nativeMapMutationWall)
  const requestedBeforeMapMount = rows.filter(row => row.startWall <= startup.nativeMapMutationWall).length
  if (sample === 1) {
    await page.screenshot({ path: path.join(artifacts, `${arm.id}-${condition.id}-startup.png`), fullPage: true })
  }
  partial.stages.nativeStartup = { startup, initialResourcesByMapMutation: initialTotals, requestsStarted: requestedBeforeMapMount }
  await writeCheckpoint()

  let startupToCluster = null
  const mobileHierarchy = []
  if (startup.initialMapKind !== 'cluster') {
    const back = await returnToCluster(page, arm)
    startupToCluster = await clickToMap(page, back, 'svg.cluster-map-svg')
    const hierarchy = await collapseBaselineHierarchyForMobile(page, condition, arm)
    mobileHierarchy.push({ stage: 'native-startup-return', ...hierarchy })
    startupToCluster.mobileHierarchy = hierarchy
  }
  const gestures = []
  if (arm.id === 'B' && condition.isMobile) {
    await hideMobileInspectorIfOpen(page)
  }
  gestures.push(await runGesture(page, cdp, 'cluster', condition))
  const node = arm.id === 'baseline'
    ? page.locator('svg.cluster-map-svg .cluster-system-node[aria-label="Open Vela Reach system map"]').first()
    : page.locator('svg.cluster-map-svg [data-system-id="sys-vela"]').first()
  const clusterToSystem = await clickToMap(page, node, 'svg.system-map-svg')
  const systemMapMount = await page.evaluate(() => ({
    systemObjectCount: document.querySelectorAll('svg.system-map-svg .system-object').length,
    systemOrbitCount: document.querySelectorAll('svg.system-map-svg .orbit-mark').length,
    mutationAt: window.__measureProbe.maps.system.at,
    wall: window.__measureProbe.maps.system.wall,
  }))
  Object.assign(systemMapMount, clusterToSystem)
  const systemBytes = totals(rows, row => row.finishWall <= systemMapMount.wall)
  partial.stages.clusterToVela = { systemMapMount, clusterToSystem, resourcesBySystemMapMount: systemBytes }
  await writeCheckpoint()
  if (arm.id === 'B' && condition.isMobile) await hideMobileInspectorIfOpen(page)
  gestures.push(await runGesture(page, cdp, 'system', condition))

  let preInspectorMapFit = null
  if (condition.isMobile) {
    const systemContent = page.locator('.system-map-content').first()
    const transformBefore = await systemContent.getAttribute('transform').catch(() => null)
    const fit = page.locator('button[aria-label="Fit map"]').first()
    if (await fit.count()) {
      await fit.click({ timeout: 5_000 })
      await page.waitForFunction(before => document.querySelector('.system-map-content')?.getAttribute('transform') !== before, transformBefore, { timeout: 5_000 }).catch(() => {})
      const objectBox = await page.locator('svg.system-map-svg [data-object-id="obj-vela-planet"]').first().boundingBox().catch(() => null)
      const transformAfter = await systemContent.getAttribute('transform').catch(() => null)
      preInspectorMapFit = { attempted: true, transformBefore, transformAfter, transformChanged: transformBefore !== transformAfter, targetObjectBox: objectBox, targetObjectWithinViewport: objectBox ? objectBox.x >= 0 && objectBox.y >= 0 && objectBox.x + objectBox.width <= condition.viewport.width && objectBox.y + objectBox.height <= condition.viewport.height : false }
    } else {
      preInspectorMapFit = { attempted: false, reason: 'Fit map control not found' }
    }
  }

  const planet = page.locator('svg.system-map-svg [data-object-id="obj-vela-planet"]').first()
  if (await planet.count()) await planet.click({ timeout: 10_000 })
  if (arm.id === 'B' && condition.isMobile) {
    const inspectorToggle = page.locator('.b-tool-rail button[title="Toggle inspector"]')
    if (await inspectorToggle.count() && await inspectorToggle.getAttribute('aria-expanded') === 'false') await inspectorToggle.click()
  }
  if (arm.id === 'B') {
    const signalControl = page.locator('.inspector-form button').filter({ hasText: 'Quiet' }).first()
    if (await signalControl.count()) {
      await signalControl.click()
      await page.waitForTimeout(100)
      const selectSnapshot = await page.evaluate(() => ({
        openListbox: !!document.querySelector('[role="listbox"]'),
        optionCount: document.querySelectorAll('[role="option"]').length,
        selectText: [...document.querySelectorAll('.inspector-form button')].map(button => button.innerText.trim()).filter(Boolean),
      }))
      if (sample === 1) await fs.writeFile(path.join(artifacts, `B-${condition.id}-select-open.json`), JSON.stringify(selectSnapshot, null, 2))
      await page.keyboard.press('Escape').catch(() => {})
    }
  }

  let fieldLauncherPath = 'header-field-definitions'
  let fieldButton = arm.id === 'baseline'
    ? page.locator('button[aria-label="Open field definitions"]')
    : page.locator('.b-command-actions button').filter({ hasText: 'Fields' }).first()
  if (arm.id === 'B' && condition.isMobile) {
    const manageFields = page.locator('.inspector-card .section-row button').filter({ hasText: 'Manage' }).first()
    if (await manageFields.isVisible().catch(() => false)) {
      fieldButton = manageFields
      fieldLauncherPath = 'mobile-inspector-manage'
    }
  }
  await fieldButton.click({ timeout: 10_000 })
  await page.locator('#field-definitions-dialog[open]').waitFor({ state: 'visible', timeout: 15_000 })
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  const overlay = await page.evaluate(() => {
    const dialog = document.querySelector('#field-definitions-dialog')
    const active = document.activeElement
    const style = dialog ? getComputedStyle(dialog) : null
    const close = dialog?.querySelector('button[aria-label="Close field definitions"]')
    const closeStyle = close ? getComputedStyle(close) : null
    const lastClick = [...window.__measureProbe.clicks].reverse().find(click => /field|Fields/i.test(click.label))
    return {
      clickAt: lastClick?.at ?? null,
      clickLabel: lastClick?.label ?? null,
      twoRafAt: performance.now(),
      dialogVisible: !!dialog?.open,
      activeElement: active instanceof HTMLElement ? `${active.tagName.toLowerCase()}#${active.id}.${active.className}` : null,
      focusInsideDialog: !!active && !!dialog?.contains(active),
      dialogBackground: style?.backgroundColor,
      dialogColor: style?.color,
      dialogWidth: style?.width,
      closeOutlineStyle: closeStyle?.outlineStyle,
      closeOutlineWidth: closeStyle?.outlineWidth,
      closeBoxShadow: closeStyle?.boxShadow,
      bodyProtoInk: getComputedStyle(document.querySelector('.proto-modal-body') || document.body).color,
      shellTheme: document.querySelector('.proto-shell')?.getAttribute('data-theme') ?? null,
    }
  })
  overlay.clickToOverlayTwoRafMs = overlay.clickAt == null ? null : overlay.twoRafAt - overlay.clickAt
  overlay.fieldLauncherPath = fieldLauncherPath
  partial.stages.fieldsDialog = overlay
  await writeCheckpoint()
  if (sample === 1) await page.screenshot({ path: path.join(artifacts, `${arm.id}-${condition.id}-fields.png`), fullPage: true })
  await page.waitForTimeout(500)
  const fieldClose = page.locator('#field-definitions-dialog button[aria-label="Close field definitions"]')
  await page.keyboard.press('Escape').catch(() => {})
  await page.locator('#field-definitions-dialog').waitFor({ state: 'detached', timeout: 5_000 }).catch(async () => { if (await fieldClose.count()) await fieldClose.click() })
  const focusAfterFieldDialog = await page.evaluate(() => ({ activeElement: document.activeElement instanceof HTMLElement ? `${document.activeElement.tagName.toLowerCase()}#${document.activeElement.id}.${document.activeElement.className}` : null, activeLabel: document.activeElement instanceof HTMLElement ? document.activeElement.getAttribute('aria-label') : null }))
  let catalogue = null
  if (arm.id === 'B' && condition.id !== 'mobile-emulation') {
    const addMark = page.locator('.b-tool-rail button[title="Choose a catalogue mark to add"]')
    if (await addMark.count()) {
      await addMark.click()
      const panel = page.locator('.b-catalogue-panel')
      await panel.waitFor({ state: 'visible', timeout: 5_000 })
      catalogue = await page.evaluate(() => ({ visible: !!document.querySelector('.b-catalogue-panel'), familyButtons: document.querySelectorAll('.b-catalogue-family-list button').length, typeButtons: document.querySelectorAll('.b-catalogue-types button').length, color: getComputedStyle(document.querySelector('.b-catalogue-panel')).color }))
      await page.locator('button[aria-label="Close object catalogue"]').click()
    }
  }

  const allTotals = totals(rows)
  const systemToCluster = await clickToMap(page, await returnToCluster(page, arm), 'svg.cluster-map-svg')
  mobileHierarchy.push({ stage: 'first-vela-return', ...(await collapseBaselineHierarchyForMobile(page, condition, arm)) })
  partial.stages.firstVelaReturnToCluster = systemToCluster
  await writeCheckpoint()
  const warmClusterToVela = await clickToMap(page, arm.id === 'baseline'
    ? page.locator('svg.cluster-map-svg .cluster-system-node[aria-label="Open Vela Reach system map"]').first()
    : page.locator('svg.cluster-map-svg [data-system-id="sys-vela"]').first(), 'svg.system-map-svg')
  partial.stages.warmClusterToVela = warmClusterToVela
  await writeCheckpoint()
  const warmVelaToCluster = await clickToMap(page, await returnToCluster(page, arm), 'svg.cluster-map-svg')
  mobileHierarchy.push({ stage: 'warm-vela-return', ...(await collapseBaselineHierarchyForMobile(page, condition, arm)) })
  partial.stages.warmVelaToCluster = warmVelaToCluster
  await writeCheckpoint()
  const iconRequests = icons
  const coldRows = rows.map(row => ({ ...row }))
  const coldRequests = [...requests.values()].map(row => ({ ...row }))
  const coldErrors = errors.slice()
  const coldIcons = icons.slice()
  const initialCompletedResources = totals(coldRows, row => row.finishWall <= startup.nativeMapMutationWall)
  const initialRequestsStarted = coldRequests.filter(row => row.startWall <= startup.nativeMapMutationWall).length
  const postMapRequests = coldRequests.filter(row => row.startWall > startup.nativeMapMutationWall)
  const postMapReceivedResources = totals(coldRows, row => row.startWall > startup.nativeMapMutationWall)
  const pendingRequests = coldRequests.filter(row => row.encodedDataLength === undefined && !row.failed)
  const warmEvents = { rows: [], elapsedToMapMountMs: null, mountedAt: null }
  if (sample === 1) await page.screenshot({ path: path.join(artifacts, `${arm.id}-${condition.id}-system.png`), fullPage: true }).catch(() => {})
  rows.length = 0
  requests.clear()
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.waitForFunction(() => {
    const probe = window.__measureProbe
    const cluster = document.querySelector('svg.cluster-map-svg')
    const system = document.querySelector('svg.system-map-svg')
    return (!!cluster?.getClientRects().length && !!probe?.maps?.cluster)
      || (!!system?.getClientRects().length && !!probe?.maps?.system)
  }, null, { timeout: 60_000 })
  const warmInfo = await page.evaluate(async () => {
    const nav = performance.getEntriesByType('navigation')[0]
    const mapKind = document.querySelector('svg.cluster-map-svg')?.getClientRects().length ? 'cluster' : 'system'
    const map = window.__measureProbe.maps[mapKind]
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    return { initialMapKind: mapKind, elapsedToMapMountMutationMs: map.at - (nav?.startTime ?? 0), elapsedToMapMountPlusTwoRafMs: performance.now() - (nav?.startTime ?? 0), mapWall: map.wall, firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null }
  })
  await page.waitForTimeout(300)
  warmEvents.rows = rows.map(row => ({ ...row }))
  warmEvents.elapsedToMapMountMs = warmInfo.elapsedToMapMountPlusTwoRafMs
  warmEvents.mountedAt = warmInfo
  warmEvents.resources = totals(warmEvents.rows)
  warmEvents.cacheResponses = warmEvents.rows.filter(row => row.fromDiskCache || row.fromServiceWorker).length

  const output = {
    arm: arm.id,
    condition: condition.id,
    sample,
    url,
    timestamp: new Date().toISOString(),
    environment: { chrome: await browser.version(), node: process.version, os: `${os.type()} ${os.release()} ${os.arch()}`, cpuModel: os.cpus()[0]?.model, logicalCpuCount: os.cpus().length },
    settings: { viewport: condition.viewport, deviceScaleFactor: 1, physicalDevice: false, cpuThrottlingRate: condition.cpu, network: { latencyMs: condition.latency, downBitsPerSecond: condition.down, upBitsPerSecond: condition.up }, colorScheme: 'light', reducedMotion: 'reduce', seededWorkspace: { systems: fixture.cluster.systems.length, routes: fixture.cluster.routes.length, objects: fixture.cluster.systems.reduce((n, s) => n + s.objects.length, 0), orbits: fixture.cluster.systems.reduce((n, s) => n + s.orbits.length, 0) } },
    ssr: { htmlBytes: Buffer.byteLength(ssrHtml), containsProtoShell: /class="[^"]*proto-shell/.test(ssrHtml), containsClusterSvg: /cluster-map-svg/.test(ssrHtml), containsFieldButton: /Open field definitions|>Fields</.test(ssrHtml) },
    startup,
    startupToCluster,
    mobileHierarchy,
    initialResourcesByMapMutation: initialCompletedResources,
    initialRequestsStartedByMapMutation: initialRequestsStarted,
    requestsStartedAfterNativeMapMutation: postMapRequests.length,
    resourcesReceivedAfterNativeMapMutation: postMapReceivedResources,
    pendingRequestsAtPreReloadCutoff: pendingRequests,
    systemMapMount,
    clusterToSystem,
    systemToCluster,
    warmClusterToVela,
    warmVelaToCluster,
    resourcesBySystemMapMount: systemBytes,
    overlay,
    focusAfterFieldDialog,
    catalogue,
    resourcesAfterOverlay: allTotals,
    gestures,
    preInspectorMapFit,
    resources: coldRows,
    requestTrace: coldRequests,
    icons: coldIcons,
    consoleAndRequestErrors: [...coldErrors, ...errors.slice(coldErrors.length)],
    warmReload: warmEvents,
  }
  records.push(output)
  await fs.writeFile(path.join(artifacts, `${arm.id}-${condition.id}-run-${sample}.json`), JSON.stringify(output, null, 2))
  await cdp.detach()
  await context.close()
  activeContexts.delete(context)
  return output
}

for (const condition of runConditions) {
  for (let sample = 1; sample <= sampleCount; sample++) {
    const order = sample % 2 ? arms : [...arms].reverse()
    for (const arm of order) {
      console.log(`RUN ${arm.id} ${condition.id} ${sample}/${sampleCount}`)
      try {
        const record = await runOne(arm, condition, sample)
        if (record.failure) {
          console.log(`FAILED ${arm.id} ${condition.id} ${sample}: stage=${record.failure.stage} message=${record.failure.message}`)
        } else {
          console.log(`DONE ${arm.id} ${condition.id} ${sample}: nativeMap=${record.startup.initialMapKind}/${record.startup.elapsedToMapMountMutationMs.toFixed(1)}ms clusterToVela=${record.clusterToSystem.clickToMapVisiblePlusTwoRafMs?.toFixed(1) ?? 'n/a'}ms systemToCluster=${record.systemToCluster.clickToMapVisiblePlusTwoRafMs?.toFixed(1) ?? 'n/a'}ms overlay=${record.overlay.clickToOverlayTwoRafMs?.toFixed(1) ?? 'n/a'}ms js=${record.resourcesAfterOverlay.byKind.js} css=${record.resourcesAfterOverlay.byKind.css}`)
        }
      } catch (error) {
        for (const context of activeContexts) await context.close().catch(() => {})
        activeContexts.clear()
        const failure = { arm: arm.id, condition: condition.id, sample, failure: { stage: 'runOne', message: error.message }, checkpointPath: `${arm.id}-${condition.id}-run-${sample}.partial.json` }
        records.push(failure)
        await fs.writeFile(path.join(artifacts, `${arm.id}-${condition.id}-run-${sample}.failure.json`), JSON.stringify(failure, null, 2))
        console.log(`FAILED ${arm.id} ${condition.id} ${sample}: ${error.message}`)
      }
    }
  }
}

const metrics = ['elapsedToMapMountMutationMs', 'elapsedToMapMountPlusTwoRafMs']
const summary = {
  generatedAt: new Date().toISOString(),
  environment: records[0]?.environment,
  source: { baseline: '629d2a98715c3a16b954e0f77c639b1f0c31212c', B: '7ea41e0a9b0e585e23812eb9165e95420d72dc89' },
  sampleCount,
  dataset: { systems: fixture.cluster.systems.length, routes: fixture.cluster.routes.length, objects: fixture.cluster.systems.reduce((n, s) => n + s.objects.length, 0), orbits: fixture.cluster.systems.reduce((n, s) => n + s.orbits.length, 0) },
  results: {},
}
for (const condition of runConditions) {
  summary.results[condition.id] = {}
  for (const arm of arms) {
    const group = records.filter(row => row.condition === condition.id && row.arm === arm.id && !row.failure && row.startup)
    const startup = Object.fromEntries(metrics.map(metric => [metric, summarize(group.map(row => row.startup[metric]))]))
    const overlay = summarize(group.map(row => row.overlay.clickToOverlayTwoRafMs).filter(Number.isFinite))
    const js = summarize(group.map(row => row.resourcesAfterOverlay.byKind.js))
    const css = summarize(group.map(row => row.resourcesAfterOverlay.byKind.css))
    const systemMount = summarize(group.map(row => row.clusterToSystem.clickToMapVisiblePlusTwoRafMs).filter(Number.isFinite))
    const systemReturn = summarize(group.map(row => row.systemToCluster.clickToMapVisiblePlusTwoRafMs).filter(Number.isFinite))
    const warmSystemMount = summarize(group.map(row => row.warmClusterToVela.clickToMapVisiblePlusTwoRafMs).filter(Number.isFinite))
    const warmSystemReturn = summarize(group.map(row => row.warmVelaToCluster.clickToMapVisiblePlusTwoRafMs).filter(Number.isFinite))
    summary.results[condition.id][arm.id] = { startup, nativeInitialMapKind: group.map(row => row.startup.initialMapKind), clusterToVelaClickToMapPlusTwoRafMs: systemMount, velaToClusterClickToMapPlusTwoRafMs: systemReturn, warmClusterToVelaClickToMapPlusTwoRafMs: warmSystemMount, warmVelaToClusterClickToMapPlusTwoRafMs: warmSystemReturn, overlayClickToTwoRafMs: overlay, receivedJsBytesAfterOverlay: js, receivedCssBytesAfterOverlay: css }
  }
}
await fs.writeFile(path.join(artifacts, 'summary.json'), JSON.stringify(summary, null, 2))
await browser.close()
console.log('WROTE', path.join(artifacts, 'summary.json'))
