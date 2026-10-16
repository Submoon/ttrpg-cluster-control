import assert from 'node:assert/strict'
import path from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const playwrightPath = pathToFileURL(path.join(process.cwd(), 'node_modules', '@playwright', 'test', 'index.mjs')).href
const { chromium } = await import(playwrightPath)
const baseUrl = process.env.PREVIEW_ROOT_URL ?? 'http://127.0.0.1:3131/'
const chromePath = process.env.CHROME_EXECUTABLE ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const outputDir = path.resolve(process.cwd(), '..', 'device-preservation-lab', 'artifacts', 'resolved-tools-2026-10-15')
await mkdir(outputDir, { recursive: true })

const browser = await chromium.launch({ headless: true, executablePath: chromePath })
const results = []

async function openPage(controls, width, height) {
  const context = await browser.newContext({ viewport: { width, height }, isMobile: width <= 760 || height <= 600, hasTouch: width <= 760 || height <= 600, deviceScaleFactor: 1 })
  const page = await context.newPage()
  page.setDefaultTimeout(9000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`${baseUrl}?variant=B&controls=${controls}`, { waitUntil: 'domcontentloaded' })
  await page.locator('.proto-b .cluster-map-svg').waitFor({ state: 'visible' })
  await page.locator('.b-inspector-float').waitFor({ state: 'hidden' })
  await page.waitForTimeout(240)
  return { context, page, errors, controls, width, height }
}

function contains(rect, width, height) {
  return rect && rect.width > 0 && rect.height > 0 && rect.x >= 0 && rect.y >= 0 && rect.right <= width && rect.bottom <= height
}

function overlaps(left, right) {
  return left && right && left.x < right.right && left.right > right.x && left.y < right.bottom && left.bottom > right.y
}

async function buttonGeometry(page, selector) {
  return page.evaluate(selector => [...document.querySelectorAll(selector)].map(button => {
    const rect = button.getBoundingClientRect()
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
    return {
      label: button.getAttribute('aria-label') || button.getAttribute('title') || button.innerText.trim(),
      rect: { x: rect.left, y: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
      visible: getComputedStyle(button).display !== 'none' && getComputedStyle(button).visibility !== 'hidden' && (!button.closest('.b-files-menu-items') || button.closest('.b-files-menu')?.open) && rect.width > 0 && rect.height > 0,
      hit: Boolean(hit && (hit === button || button.contains(hit))),
      hitLabel: hit?.closest('button')?.getAttribute('aria-label') || hit?.closest('button')?.innerText.trim() || hit?.tagName || null,
      hitPath: document.elementsFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2).slice(0, 5).map(element => `${element.tagName}${element.className?.baseVal || element.className ? `.${element.className.baseVal || element.className}` : ''}`),
    }
  }), selector)
}

async function checkControls(run, expectedCount) {
  const { page, width, height, controls } = run
  const selector = controls === 'groups'
    ? '.b-tool-rail button, .b-command-actions > button, .b-file-actions button, .b-zoom-controls button'
    : '.b-panel-actions button, .b-control-dock button, .b-command-actions > button, .b-files-menu summary, .b-zoom-controls button'
  const buttons = await buttonGeometry(page, selector)
  assert.equal(buttons.length, expectedCount, `${controls} ${width}x${height}: expected control count`)
  const hitIssues = buttons.filter(button => !button.hit)
  for (const button of buttons) {
    assert.ok(button.visible, `${controls} ${width}x${height}: visible ${button.label}`)
    assert.ok(contains(button.rect, width, height), `${controls} ${width}x${height}: in bounds ${button.label}: ${JSON.stringify(button.rect)}`)
    if (process.env.QA_SWEEP !== '1') assert.ok(button.hit, `${controls} ${width}x${height}: center hit-test ${button.label}: ${JSON.stringify(button)}`)
  }
  const groups = await page.evaluate(() => {
    const read = selector => {
      const rect = document.querySelector(selector)?.getBoundingClientRect()
      return rect ? { x: rect.left, y: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height } : null
    }
    return {
      header: read('.b-commandbar'), hud: read('.b-map-hud'), rail: read('.b-tool-rail'), dock: read('.b-control-dock'), zoom: read('.b-zoom-controls'),
      panels: [...document.querySelectorAll('.b-commandbar [aria-expanded]')].map(button => button.getAttribute('aria-label') || button.innerText.trim()),
      modeCount: document.querySelectorAll('.b-tool-rail [aria-pressed], .b-control-dock [aria-pressed]').length,
      duplicateZoom: document.querySelectorAll('.map-navigation').length,
    }
  })
  assert.equal(groups.modeCount, 3, `${controls} ${width}x${height}: three explicit modes`)
  assert.equal(groups.duplicateZoom, 0, `${controls} ${width}x${height}: no second zoom group`)
  groups.headerHudOverlap = overlaps(groups.header, groups.hud)
  groups.zoomControlOverlap = overlaps(groups.zoom, groups.rail ?? groups.dock)
  groups.hitIssues = hitIssues
  if (process.env.QA_SWEEP !== '1') {
    assert.ok(!groups.headerHudOverlap, `${controls} ${width}x${height}: header and map file commands do not overlap`)
    assert.ok(!groups.zoomControlOverlap, `${controls} ${width}x${height}: zoom and mode controls do not overlap`)
  }
  return { buttons, groups }
}

async function checkToastClearance(page) {
  const layout = await page.evaluate(() => {
    const rect = selector => {
      const element = document.querySelector(selector)
      if (!element || getComputedStyle(element).display === 'none') return null
      const box = element.getBoundingClientRect()
      return { x: box.left, y: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height }
    }
    return {
      toast: rect('.prototype-toast'),
      header: rect('.b-commandbar'),
      hud: rect('.b-map-hud'),
      addStatus: rect('.b-add-status'),
      rail: rect('.b-tool-rail'),
      dock: rect('.b-control-dock'),
      zoom: rect('.b-zoom-controls'),
    }
  })
  for (const target of ['header', 'hud', 'addStatus', 'rail', 'dock', 'zoom']) {
    assert.ok(!overlaps(layout.toast, layout[target]), `toast does not overlap ${target}: ${JSON.stringify(layout)}`)
  }
  const buttons = await buttonGeometry(page, '.b-command-actions > button, .b-tool-rail button, .b-control-dock button, .b-map-hud button, .b-zoom-controls button')
  const visibleButtons = buttons.filter(button => button.visible)
  for (const button of visibleButtons) assert.ok(button.hit, `toast does not block ${button.label}: ${JSON.stringify(button)}`)
  return { layout, hitTestedButtons: visibleButtons.length }
}

async function emptyMapPoint(page, svgSelector, blockedSelector) {
  return page.evaluate(({ svgSelector, blockedSelector }) => {
    const svg = document.querySelector(svgSelector)
    if (!svg) throw new Error(`Missing ${svgSelector}`)
    const rect = svg.getBoundingClientRect()
    for (const yPart of [.16, .23, .32, .41, .5, .59, .68, .77, .84]) {
      for (const xPart of [.1, .17, .25, .34, .43, .52, .61, .7, .79, .88, .94]) {
        const x = rect.left + rect.width * xPart
        const y = rect.top + rect.height * yPart
        const hit = document.elementFromPoint(x, y)
        if (!hit || !svg.contains(hit) || hit.closest(blockedSelector)) continue
        return { x, y, xPart, yPart, hit: hit.tagName + (hit.getAttribute('class') ? `.${hit.getAttribute('class')}` : '') }
      }
    }
    throw new Error(`No empty visible point in ${svgSelector}`)
  }, { svgSelector, blockedSelector })
}

function controlsRoot(controls) {
  return controls === 'groups' ? '.b-tool-rail' : '.b-control-dock'
}

async function clickMode(page, controls, name) {
  const button = page.locator(`${controlsRoot(controls)} button[aria-pressed]`).filter({ hasText: name }).first()
  await button.click()
  assert.equal(await button.getAttribute('aria-pressed'), 'true', `${controls}: ${name} mode is active`)
}

async function clickAddChoice(page, controls, name) {
  await page.getByRole('button', { name: 'Choose an item to add to the map' }).click()
  await page.getByRole('button', { name, exact: true }).click()
}

async function closeInspector(page) {
  if (await page.locator('.b-inspector-float').isVisible()) {
    await page.getByRole('button', { name: 'Hide inspector' }).click()
    await page.locator('.b-inspector-float').waitFor({ state: 'hidden' })
  }
}

async function finish(run, evidence) {
  assert.deepEqual(run.errors, [], `${run.controls} ${run.width}x${run.height} browser errors`)
  results.push({ controls: run.controls, viewport: `${run.width}x${run.height}`, evidence, errors: run.errors })
  await run.context.close()
}

try {
  for (const controls of ['groups', 'dock']) {
    for (const [width, height] of [[390, 844], [844, 390]]) {
      const run = await openPage(controls, width, height)
      const geometry = await checkControls(run, controls === 'groups' ? 15 : 12)
      await run.page.screenshot({ path: path.join(outputDir, `${controls}-${width}x${height}.png`) })
      await clickAddChoice(run.page, controls, 'Add Jump Route')
      await run.page.keyboard.press('Escape')
      await run.page.locator('.prototype-toast').waitFor({ state: 'visible' })
      const toastClearance = await checkToastClearance(run.page)
      await finish(run, { geometry, toastClearance })
    }

    const run = await openPage(controls, 390, 844)
    const { page } = run
    await closeInspector(page)
    const firstSystem = page.locator('.cluster-map-svg .cluster-system-node').first()
    await clickMode(page, controls, 'Select')
    assert.match(await firstSystem.getAttribute('aria-label'), /^Inspect .+ system details$/, `${controls}: Select announces Inspect action for a system`)
    await firstSystem.click()
    await page.locator('.inspector-card').waitFor({ state: 'visible' })
    await page.waitForFunction(() => (document.querySelector('.b-inspector-float')?.getBoundingClientRect().top ?? 999) < 1)
    assert.equal(await page.locator('.cluster-map-svg').isVisible(), true, `${controls}: Select opens Inspect while staying on the cluster`)
    assert.equal(await page.locator('.system-map-svg').count(), 0, `${controls}: Select does not navigate into the system`)
    assert.equal(await page.locator('.b-tool-rail, .b-control-dock').isVisible(), false, `${controls}: mobile controls hide under full-screen Inspect`)
    assert.equal(await page.locator('.b-zoom-controls').isVisible(), false, `${controls}: zoom hides under full-screen Inspect`)
    const inspectBounds = await page.locator('.b-inspector-float').boundingBox()
    assert.ok(inspectBounds && inspectBounds.x === 0 && inspectBounds.y === 0 && inspectBounds.width === 390 && inspectBounds.height >= 844, `${controls}: Inspect is full-screen: ${JSON.stringify({ inspectBounds, width: await page.evaluate(() => innerWidth), height: await page.evaluate(() => innerHeight) })}`)
    await closeInspector(page)

    await page.getByRole('button', { name: controls === 'groups' ? 'Show map hierarchy' : 'Hierarchy' }).click()
    await page.locator('.b-hierarchy-panel').waitFor({ state: 'visible' })
    await page.waitForFunction(() => (document.querySelector('.b-hierarchy-panel')?.getBoundingClientRect().top ?? 999) < 1)
    assert.equal(await page.locator('.inspector-card').isVisible(), false, `${controls}: Inspector and Hierarchy are exclusive on mobile`)
    assert.equal(await page.locator('.b-tool-rail, .b-control-dock').isVisible(), false, `${controls}: mobile controls hide under full-screen Hierarchy`)
    assert.equal(await page.locator('.b-zoom-controls').isVisible(), false, `${controls}: zoom hides under full-screen Hierarchy`)
    await page.getByRole('button', { name: 'Close map hierarchy' }).click()
    await page.locator('.b-hierarchy-panel').waitFor({ state: 'hidden' })

    await clickMode(page, controls, 'Select')
    const panNode = page.locator('.cluster-map-svg .cluster-system-node').first()
    const nodeBox = await panNode.boundingBox()
    const content = page.locator('.cluster-map-svg .cluster-map-content')
    const beforePan = await content.getAttribute('transform')
    assert.ok(nodeBox)
    await page.mouse.move(nodeBox.x + nodeBox.width / 2, nodeBox.y + nodeBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(nodeBox.x + nodeBox.width / 2 + 64, nodeBox.y + nodeBox.height / 2 + 38, { steps: 5 })
    await page.mouse.up()
    await page.waitForTimeout(120)
    const afterPan = await content.getAttribute('transform')
    assert.notEqual(afterPan, beforePan, `${controls}: Select drag on a system pans the map`)
    assert.equal(await page.locator('.cluster-map-svg').isVisible(), true, `${controls}: Select drag stays on the cluster`)
    assert.equal(await page.locator('.inspector-card').isVisible(), false, `${controls}: Select drag does not open Inspect`)
    await page.locator('.cluster-map-svg .cluster-system-node').nth(1).click()
    await page.locator('.inspector-card').waitFor({ state: 'visible' })
    assert.equal(await page.locator('.cluster-map-svg').isVisible(), true, `${controls}: a deliberate tap after drag still opens Inspect`)
    await finish(run, { selectDragPan: { beforePan, afterPan, label: await panNode.getAttribute('aria-label') }, deliberateTapAfterDragOpensInspect: true })
  }

  // Repeated Add System placements stay in the cluster, keep Add active, and do not open Inspect.
  {
    const run = await openPage('groups', 390, 844)
    const { page } = run
    await clickAddChoice(page, 'groups', 'Add star system')
    const initialCount = await page.locator('.cluster-map-svg .cluster-system-node').count()
    await page.locator('.cluster-map-svg .cluster-system-node').first().click()
    assert.ok(await page.locator('.proto-b').evaluate(element => element.classList.contains('has-active-add')), 'Invalid Add System target leaves Add active')
    assert.equal(await page.locator('.b-add-status').evaluate(element => element.classList.contains('has-feedback')), true, 'Invalid Add System target displays persistent feedback')
    assert.match(await page.locator('.b-add-status').innerText(), /needs open space in the Jump Cluster/i, 'Add System explains why the target is invalid')
    assert.equal(await page.locator('.b-add-status').isVisible(), true, 'Add System feedback remains visible')
    assert.equal(await page.locator('.prototype-toast').evaluate(element => getComputedStyle(element).display), 'none', 'Feedback stays in Add status instead of a toast over controls')
    const firstEmpty = await emptyMapPoint(page, '.cluster-map-svg', '.cluster-system-node, .cluster-route')
    await page.mouse.click(firstEmpty.x, firstEmpty.y)
    await page.waitForFunction(initial => document.querySelectorAll('.cluster-map-svg .cluster-system-node').length === initial + 1, initialCount)
    assert.equal(await page.locator('.cluster-map-svg').isVisible(), true)
    assert.equal(await page.locator('.system-map-svg').count(), 0)
    assert.equal(await page.locator('.inspector-card').isVisible(), false)
    assert.match(await page.locator('.b-add-status').innerText(), /Add System/i)
    const secondEmpty = await emptyMapPoint(page, '.cluster-map-svg', '.cluster-system-node, .cluster-route')
    await page.mouse.click(secondEmpty.x, secondEmpty.y)
    await page.waitForFunction(initial => document.querySelectorAll('.cluster-map-svg .cluster-system-node').length === initial + 2, initialCount)
    assert.equal(await page.locator('.b-tool-rail button[aria-pressed="true"]').count(), 0, 'Add is a persistent creation action, not a mode toggle')
    assert.match(await page.locator('.b-add-status').innerText(), /Add System (?:remains active|ready)/i)
    const layout = await checkControls(run, 15)
    layout.groups.addStatusHudOverlap = overlaps(layout.groups.hud, await page.locator('.b-add-status').boundingBox())
    if (process.env.QA_SWEEP !== '1') assert.ok(!layout.groups.addStatusHudOverlap, 'Grouped Add status does not overlap map file commands')
    await run.page.screenshot({ path: path.join(outputDir, 'groups-add-system-390x844.png') })
    await finish(run, { invalidTargetFeedback: await page.locator('.b-add-status').innerText(), systemCountBefore: initialCount, systemCountAfter: await page.locator('.cluster-map-svg .cluster-system-node').count(), firstEmpty, secondEmpty, addStatus: await page.locator('.b-add-status').innerText() })
  }

  // Add mark repeats one chosen catalogue type without selecting or opening Inspect after placement.
  {
    const run = await openPage('dock', 390, 844)
    const { page } = run
    await page.locator('.cluster-map-svg .cluster-system-node').first().click()
    await page.locator('.system-map-svg').waitFor({ state: 'visible' })
    await page.getByRole('button', { name: 'Choose an item to add to the map' }).click()
    await page.getByRole('button', { name: 'Add map mark…' }).click()
    await page.locator('#b-catalogue-panel').waitFor({ state: 'visible' })
    await page.locator('.b-catalogue-types button').first().click()
    const addStatus = await page.locator('.b-add-status').boundingBox()
    const addStatusHudOverlap = overlaps(await page.locator('.b-map-hud').boundingBox(), addStatus)
    if (process.env.QA_SWEEP !== '1') assert.ok(addStatus && !addStatusHudOverlap, 'Dock Add status does not overlap map file commands')
    const initialCount = await page.locator('.system-map-svg .system-object').count()
    const blocked = '.system-object, .orbit-hit-target, .orbit-ring, .orbit-edit-control'
    const firstEmpty = await emptyMapPoint(page, '.system-map-svg', blocked)
    await page.mouse.click(firstEmpty.x, firstEmpty.y)
    await page.waitForFunction(initial => document.querySelectorAll('.system-map-svg .system-object').length === initial + 1, initialCount)
    assert.equal(await page.locator('.inspector-card').isVisible(), false, 'Add mark placement does not open Inspect')
    assert.match(await page.locator('.b-add-status').innerText(), /keeps this type ready|remains active/i)
    const secondEmpty = await emptyMapPoint(page, '.system-map-svg', blocked)
    await page.mouse.click(secondEmpty.x, secondEmpty.y)
    await page.waitForFunction(initial => document.querySelectorAll('.system-map-svg .system-object').length === initial + 2, initialCount)
    assert.equal(await page.locator('.system-map-svg').isVisible(), true, 'Repeated Add mark stays in the current system map')
    await finish(run, { objectCountBefore: initialCount, objectCountAfter: await page.locator('.system-map-svg .system-object').count(), firstEmpty, secondEmpty, addStatus: await page.locator('.b-add-status').innerText(), addStatusHudOverlap })
  }

  // Route-origin preservation across both pan gestures, then Escape's native-dialog priority.
  {
    const run = await openPage('groups', 390, 844)
    const { page, context } = run
    await clickAddChoice(page, 'groups', 'Add Jump Route')
    await page.locator('.cluster-map-svg .cluster-system-node').first().click()
    const routeStage = page.locator('.b-add-status')
    await page.waitForFunction(() => document.querySelector('.b-add-status')?.innerText.includes('Origin:'))
    const originBefore = await routeStage.innerText()
    const routeCount = await page.locator('.cluster-map-svg .cluster-route').count()
    const blank = await emptyMapPoint(page, '.cluster-map-svg', '.cluster-system-node, .cluster-route')
    const content = page.locator('.cluster-map-svg .cluster-map-content')
    const beforeRightPan = await content.getAttribute('transform')
    await page.mouse.move(blank.x, blank.y)
    await page.mouse.down({ button: 'right' })
    await page.mouse.move(blank.x + 76, blank.y + 42, { steps: 5 })
    await page.mouse.up({ button: 'right' })
    await page.waitForTimeout(120)
    const afterRightPan = await content.getAttribute('transform')
    assert.notEqual(afterRightPan, beforeRightPan, 'Right-button drag pans the cluster')
    assert.match(await routeStage.innerText(), /Origin:/, 'Right-button pan preserves the chosen route origin')
    assert.equal(await page.locator('.cluster-map-svg .cluster-route').count(), routeCount, 'Right-button pan release did not place a route')
    const svgBox = await page.locator('.cluster-map-svg').boundingBox()
    assert.ok(svgBox)
    const cdp = await context.newCDPSession(page)
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 })
    const point = (x, y, id) => ({ x: Math.round(x), y: Math.round(y), id, radiusX: 5, radiusY: 5, force: 1 })
    const beforeTouchPan = await content.getAttribute('transform')
    const x = Math.min(svgBox.x + svgBox.width - 40, blank.x + 5)
    const y = Math.min(svgBox.y + svgBox.height - 40, blank.y + 4)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(x, y, 1), point(x + 44, y + 2, 2)] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(x - 24, y + 8, 1), point(x + 72, y + 7, 2)] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await page.waitForTimeout(140)
    const afterTouchPan = await content.getAttribute('transform')
    assert.notEqual(afterTouchPan, beforeTouchPan, 'Two-contact gesture pans the cluster')
    assert.match(await routeStage.innerText(), /Origin:/, 'Two-contact pan preserves the chosen route origin')
    assert.equal(await page.locator('.cluster-map-svg .cluster-route').count(), routeCount, 'Two-contact pan release did not place a route')
    await cdp.detach()

    await page.getByRole('button', { name: 'Open field definitions' }).click()
    await page.locator('dialog#field-definitions-dialog[open]').waitFor({ state: 'visible' })
    await page.keyboard.press('Escape')
    await page.locator('dialog#field-definitions-dialog[open]').waitFor({ state: 'hidden' })
    assert.match(await routeStage.innerText(), /Origin:/, 'Escape closes Fields without canceling Add Route or its origin')
    assert.equal(await page.locator('.cluster-map-svg .cluster-route').count(), routeCount)
    await page.keyboard.press('Escape')
    assert.equal(await page.locator('.b-add-status').count(), 0, 'Escape after dialog close exits the unfinished Add action')
    assert.equal(await page.locator('.b-tool-rail button[aria-pressed="true"]').count(), 1, 'Escape returns to the Navigate mode')
    assert.equal(await page.locator('.cluster-map-svg .cluster-route').count(), routeCount, 'Canceling the route preview does not create a route')
    await finish(run, { originBefore, rightPan: { before: beforeRightPan, after: afterRightPan }, twoContactPan: { before: beforeTouchPan, after: afterTouchPan }, routeCount, escapeClosedFieldsBeforeCancelingAdd: true })
  }

  await writeFile(path.join(outputDir, 'qa-report.json'), JSON.stringify({ baseUrl, buildLabel: process.env.PREVIEW_BUILD_LABEL ?? 'Unspecified local production build', buildRoot: process.cwd(), browser: 'Chrome via Playwright/CDP', note: 'Viewport-emulated browser evidence; synthetic two-contact CDP gestures are not a physical-device check.', results }, null, 2))
  console.log(JSON.stringify({ outputDir, resultCount: results.length, results }, null, 2))
} finally {
  await browser.close()
}
