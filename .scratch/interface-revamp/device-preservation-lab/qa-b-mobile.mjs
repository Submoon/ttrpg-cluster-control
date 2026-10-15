import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import path from 'node:path'

const baseUrl = process.env.PREVIEW_ROOT_URL ?? 'http://127.0.0.1:3127/'
const chromePath = process.env.CHROME_EXECUTABLE ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const browser = await chromium.launch({ headless: true, executablePath: chromePath })
const summary = []

async function openPage(label, width, height, mobile = true) {
  const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile })
  const page = await context.newPage()
  page.setDefaultTimeout(9000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
  await page.locator('.proto-b .cluster-map-svg').waitFor({ state: 'visible' })
  await page.waitForTimeout(260)
  if (mobile) await page.locator('.b-inspector-float').waitFor({ state: 'hidden' })
  return { label, context, page, errors }
}

function nearlyEqual(actual, expected, tolerance = 1.5) {
  return Math.abs(actual - expected) <= tolerance
}

async function finishPage(run) {
  summary.push({ label: run.label, errors: run.errors })
  assert.deepEqual(run.errors, [], `${run.label} page errors`)
  await run.context.close()
}

try {
  for (const [label, width, height] of [['portrait-390x844', 390, 844], ['landscape-844x390', 844, 390]]) {
    const run = await openPage(label, width, height)
    const { page } = run
    const inspector = page.locator('.b-inspector-float')
    if (await inspector.isVisible()) {
      await inspector.getByRole('button', { name: 'Hide inspector' }).click()
      await inspector.waitFor({ state: 'hidden' })
    }

    const metrics = await page.evaluate(() => {
      const rail = document.querySelector('.b-tool-rail')
      const bounds = rail?.getBoundingClientRect()
      return {
        viewport: { width: innerWidth, height: innerHeight },
        rail: bounds ? { top: bounds.top, bottom: bounds.bottom, height: bounds.height } : null,
        railPosition: rail ? getComputedStyle(rail).position : null,
        railBottom: rail ? getComputedStyle(rail).bottom : null,
        hasDevSwitcherClass: document.querySelector('.proto-b')?.classList.contains('has-prototype-switcher') ?? null,
        switcherCount: document.querySelectorAll('.prototype-switcher').length,
        childZoomCount: document.querySelectorAll('.map-navigation').length,
        shellZoomButtons: document.querySelectorAll('.b-zoom-controls button').length,
        inspectControls: [...document.querySelectorAll('.b-tool-rail button')].filter(button => button.getAttribute('aria-label')?.includes('Inspector panel')).length,
      }
    })
    assert.ok(metrics.rail && nearlyEqual(metrics.rail.bottom, height), `${label}: bottom rail reaches viewport bottom`)
    assert.equal(metrics.railPosition, 'fixed')
    assert.equal(metrics.railBottom, '0px', `${label}: production rail does not reserve development switcher space`)
    assert.equal(metrics.switcherCount, 0, `${label}: production has no prototype switcher`)
    assert.equal(metrics.childZoomCount, 0, `${label}: child map has no duplicate zoom bar`)
    assert.equal(metrics.shellZoomButtons, 3, `${label}: shell has one complete zoom control set`)
    assert.equal(metrics.inspectControls, 1, `${label}: exactly one rail Inspector control`)
    await page.screenshot({ path: path.join(process.cwd(), `qa-${label}-map.png`) })

    if (!await page.locator('.inspector-card').isVisible()) await page.getByRole('button', { name: 'Open Inspector panel' }).click()
    await page.locator('.inspector-card').waitFor({ state: 'visible' })
    await page.waitForTimeout(240)
    assert.equal(await page.locator('.b-tool-rail').isVisible(), false, `${label}: rail is occluded by Inspector`)
    assert.equal(await page.locator('.b-zoom-controls').isVisible(), false, `${label}: zoom is hidden with Inspector`)
    await page.locator('.inspector-form input').first().fill('draft retained on phone')
    await page.getByRole('button', { name: 'Hide inspector' }).click()
    await inspector.waitFor({ state: 'hidden' })
    await page.getByRole('button', { name: 'Open Inspector panel' }).click()
    await page.waitForTimeout(240)
    assert.equal(await page.locator('.inspector-form input').first().inputValue(), 'draft retained on phone', `${label}: draft survives hide and reopen`)
    await page.getByRole('button', { name: 'Discard' }).click()
    await page.getByRole('button', { name: 'Hide inspector' }).click()
    await inspector.waitFor({ state: 'hidden' })

    await page.getByRole('button', { name: 'Hierarchy' }).click()
    await page.locator('.b-hierarchy-panel').waitFor({ state: 'visible' })
    await page.waitForTimeout(240)
    assert.equal(await page.locator('.inspector-card').isVisible(), false, `${label}: Hierarchy and Inspector are exclusive`)
    assert.equal(await page.locator('.b-tool-rail').isVisible(), false, `${label}: rail is occluded by Hierarchy`)
    assert.equal(await page.locator('.b-zoom-controls').isVisible(), false, `${label}: zoom is hidden with Hierarchy`)
    await page.getByRole('button', { name: 'Close map hierarchy' }).click()
    await page.locator('.b-hierarchy-panel').waitFor({ state: 'hidden' })
    assert.equal(await page.locator('.b-tool-rail').isVisible(), true, `${label}: closing Hierarchy returns to the map`)

    const system = page.locator('.cluster-map-svg .cluster-system-node').first()
    await system.click()
    await page.locator('.system-map-svg').waitFor({ state: 'visible' })
    assert.equal(await inspector.isVisible(), false, `${label}: Navigate tap opens the system map without Inspector`)
    const back = page.getByRole('button', { name: 'Back to Jump Cluster' })
    await back.waitFor({ state: 'visible' })
    const backBox = await back.boundingBox()
    assert.ok(backBox && backBox.x >= 0 && backBox.y >= 0 && backBox.x + backBox.width <= width && backBox.y + backBox.height <= height, `${label}: visible Back control is within the viewport`)
    assert.equal(await page.locator('.map-navigation').count(), 0)
    assert.equal(await page.locator('.b-zoom-controls button').count(), 3)
    await page.screenshot({ path: path.join(process.cwd(), `qa-${label}-system.png`) })
    await back.click()
    await page.locator('.cluster-map-svg').waitFor({ state: 'visible' })
    await finishPage(run)
    summary.at(-1).metrics = { ...metrics, backBox }
  }

  // A desktop context keeps Inspector and Hierarchy independently visible.
  {
    const run = await openPage('desktop-1440x900', 1440, 900, false)
    const { page } = run
    if (!await page.locator('.inspector-card').isVisible()) await page.getByRole('button', { name: 'Open Inspector panel' }).click()
    await page.locator('.inspector-card').waitFor({ state: 'visible' })
    await page.getByRole('button', { name: 'Hierarchy' }).click()
    await page.locator('.b-hierarchy-panel').waitFor({ state: 'visible' })
    assert.equal(await page.locator('.inspector-card').isVisible(), true, 'desktop keeps Inspector independently usable')
    assert.equal(await page.locator('.b-hierarchy-panel').isVisible(), true, 'desktop keeps Hierarchy independently usable')
    await finishPage(run)
  }

  // Cluster long-press inspects directly, suppresses the release click, and respects dirty-draft guards.
  {
    const run = await openPage('interaction-checks', 390, 844)
    const { page } = run
    const inspector = page.locator('.b-inspector-float')
    if (await inspector.isVisible()) {
      await page.getByRole('button', { name: 'Hide inspector' }).click()
      await inspector.waitFor({ state: 'hidden' })
    }

    const firstSystem = page.locator('.cluster-map-svg .cluster-system-node').first()
    const systemBox = await firstSystem.boundingBox()
    assert.ok(systemBox)
    await page.mouse.move(systemBox.x + systemBox.width / 2, systemBox.y + systemBox.height / 2)
    await page.mouse.down()
    await page.waitForTimeout(620)
    await page.locator('.inspector-card').waitFor({ state: 'visible' })
    await page.mouse.up()
    await page.waitForTimeout(120)
    assert.equal(await page.locator('.cluster-map-svg').isVisible(), true, 'long-press did not navigate/open a system')
    const draftInput = page.locator('.inspector-form input').first()
    await draftInput.fill('guarded draft proof')
    await page.getByRole('button', { name: 'Hide inspector' }).click()
    await inspector.waitFor({ state: 'hidden' })
    await firstSystem.click()
    await page.getByText('CONTEXT CHANGE PAUSED').waitFor({ state: 'visible' })
    assert.equal(await page.locator('.cluster-map-svg').isVisible(), true, 'dirty draft guard keeps the current cluster view')
    await page.getByRole('button', { name: 'Stay here' }).click()
    await page.getByRole('button', { name: 'Open Inspector panel' }).click()
    assert.equal(await page.locator('.inspector-form input').first().inputValue(), 'guarded draft proof', 'Stay preserves the draft')
    await page.getByRole('button', { name: 'Discard' }).click()
    await page.getByRole('button', { name: 'Hide inspector' }).click()
    await inspector.waitFor({ state: 'hidden' })
    await firstSystem.click()
    await page.locator('.system-map-svg').waitFor({ state: 'visible' })
    assert.equal(await inspector.isVisible(), false, 'direct map navigation leaves Inspector closed')

    await page.getByRole('button', { name: 'Back to Jump Cluster' }).click()
    await page.locator('.b-tool-rail .rail-button[title="Move / Modify"]').click()
    const secondSystem = page.locator('.cluster-map-svg .cluster-system-node').nth(1)
    await secondSystem.click()
    await page.waitForTimeout(100)
    assert.equal(await page.locator('.cluster-map-svg').isVisible(), true, 'Move tap selects the system instead of opening it')
    assert.equal(await inspector.isVisible(), false, 'Move tap does not open Inspector')
    await page.locator('.b-tool-rail .rail-button[title="Navigation"]').click()
    await secondSystem.click()
    await page.locator('.system-map-svg').waitFor({ state: 'visible' })

    await page.locator('.b-tool-rail .rail-button[title="Move / Modify"]').click()
    const firstObject = page.locator('.system-map-svg .system-object').first()
    const initial = await firstObject.getAttribute('transform')
    const objectBox = await firstObject.boundingBox()
    assert.ok(objectBox)
    await page.mouse.move(objectBox.x + objectBox.width / 2, objectBox.y + objectBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(objectBox.x + objectBox.width / 2 + 6, objectBox.y + objectBox.height / 2 + 2)
    await page.waitForTimeout(620)
    await page.locator('.inspector-card').waitFor({ state: 'visible' })
    await page.mouse.up()
    await page.waitForTimeout(100)
    const afterHold = await page.locator('.system-map-svg .system-object').first().getAttribute('transform')
    assert.equal(afterHold, initial, 'long-press cancels a Move preview and leaves applied object geometry unchanged')
    assert.equal(await page.locator('.system-map-svg').isVisible(), true)
    await page.getByRole('button', { name: 'Hide inspector' }).click()
    await inspector.waitFor({ state: 'hidden' })

    const svgBox = await page.locator('.system-map-svg').boundingBox()
    assert.ok(svgBox)
    const gestureObjectBox = await firstObject.boundingBox()
    assert.ok(gestureObjectBox)
    const cx = gestureObjectBox.x + gestureObjectBox.width / 2
    const cy = gestureObjectBox.y + gestureObjectBox.height / 2
    const x2 = Math.min(svgBox.x + svgBox.width - 24, cx + 72)
    const point1 = (x, y, id) => ({ x: Math.round(x), y: Math.round(y), id, radiusX: 5, radiusY: 5, force: 1 })
    const cdp = await run.context.newCDPSession(page)
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 })
    const beforeGestureTransform = await page.locator('.system-map-svg .system-object').first().getAttribute('transform')
    const beforeViewTransform = await page.locator('.system-map-svg .system-map-content').getAttribute('transform')
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point1(cx, cy, 1)] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point1(cx + 16, cy + 2, 1)] })
    await page.waitForTimeout(90)
    const uncommittedPreview = await page.locator('.system-map-svg .system-object').first().getAttribute('transform')
    assert.notEqual(uncommittedPreview, beforeGestureTransform, 'one-finger Move touch starts a real map-edit preview before the second contact')
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point1(cx + 16, cy + 2, 1), point1(x2, cy, 2)] })
    await page.waitForTimeout(70)
    const rolledBackAtSecondContact = await page.locator('.system-map-svg .system-object').first().getAttribute('transform')
    assert.equal(rolledBackAtSecondContact, beforeGestureTransform, 'second contact rolls back the active uncommitted object preview')
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point1(cx + 16, cy + 2, 1), point1(Math.min(svgBox.x + svgBox.width - 20, x2 + 60), cy, 2)] })
    await page.waitForTimeout(90)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await page.waitForTimeout(650)
    const afterGestureTransform = await page.locator('.system-map-svg .system-object').first().getAttribute('transform')
    const afterViewTransform = await page.locator('.system-map-svg .system-map-content').getAttribute('transform')
    assert.equal(afterGestureTransform, beforeGestureTransform, 'completed two-contact sequence did not commit object geometry')
    assert.notEqual(afterViewTransform, beforeViewTransform, 'completed two-contact sequence changed the map view transform')
    assert.equal(await page.locator('.b-tool-rail .rail-button[title="Move / Modify"][aria-pressed="true"]').count(), 1, 'pinch keeps the chosen Move tool active')

    const oneFingerObject = page.locator('.system-map-svg .system-object').first()
    const currentObjectBox = await oneFingerObject.boundingBox()
    assert.ok(currentObjectBox)
    const singleX = currentObjectBox.x + currentObjectBox.width / 2
    const singleY = currentObjectBox.y + currentObjectBox.height / 2
    const beforeSingleTouch = await oneFingerObject.getAttribute('transform')
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point1(singleX, singleY, 3)] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point1(singleX + 22, singleY + 5, 3)] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await page.waitForTimeout(160)
    const afterSingleTouch = await oneFingerObject.getAttribute('transform')
    assert.notEqual(afterSingleTouch, beforeSingleTouch, 'one-finger Move touch still commits an object edit after pinch release')
    assert.equal(await page.locator('.b-tool-rail .rail-button[title="Move / Modify"][aria-pressed="true"]').count(), 1)
    summary.push({ label: run.label, touchTrace: 'CDP-dispatched touch events; non-physical', evidence: { beforeGestureTransform, uncommittedPreview, rolledBackAtSecondContact, afterGestureTransform, beforeViewTransform, afterViewTransform, beforeSingleTouch, afterSingleTouch }, errors: run.errors })
    assert.deepEqual(run.errors, [], `${run.label} page errors`)
    await cdp.detach()
    await run.context.close()
  }

  // The existing baseline route must not receive B-only controls or gesture ownership.
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
    const page = await context.newPage()
    await page.goto(new URL('?variant=baseline', baseUrl).toString(), { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Create local workspace' }).waitFor({ state: 'visible' })
    assert.equal(await page.locator('.proto-b').count(), 0, 'baseline remains outside B prototype shell')
    await context.close()
    summary.push({ label: 'baseline-390x844', outcome: 'baseline route loaded without B shell' })
  }
} finally {
  await browser.close()
}

console.log(JSON.stringify(summary, null, 2))