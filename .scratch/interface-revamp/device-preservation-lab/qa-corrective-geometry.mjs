import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '@playwright/test'

const baseUrl = process.env.PREVIEW_ROOT_URL ?? 'http://127.0.0.1:3127/'
const chromePath = process.env.CHROME_EXECUTABLE ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const outputDir = path.resolve(process.cwd(), '..', 'device-preservation-lab', 'artifacts', 'corrective-2026-10-15')
await mkdir(outputDir, { recursive: true })

const browser = await chromium.launch({ headless: true, executablePath: chromePath })
const results = []

function withinViewport(rect, width, height) {
  return rect.x >= 0 && rect.y >= 0 && rect.right <= width && rect.bottom <= height
}

async function buttonGeometry(page, selector) {
  return page.evaluate(selector => {
    const elements = [...document.querySelectorAll(selector)]
    return elements.map(button => {
      const rect = button.getBoundingClientRect()
      const x = rect.left + rect.width / 2
      const y = rect.top + rect.height / 2
      const hit = document.elementFromPoint(x, y)
      const owner = hit?.closest('button')
      return {
        label: button.getAttribute('aria-label') || button.getAttribute('title') || button.innerText.trim(),
        rect: { x: rect.left, y: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
        visible: getComputedStyle(button).display !== 'none' && getComputedStyle(button).visibility !== 'hidden' && rect.width > 0 && rect.height > 0,
        hit: Boolean(hit && (hit === button || button.contains(hit))),
        hitButtonLabel: owner?.getAttribute('aria-label') || owner?.getAttribute('title') || owner?.innerText.trim() || null,
      }
    })
  }, selector)
}

function assertButtonsOnScreen(buttons, width, height, context) {
  assert.ok(buttons.length > 0, `${context}: controls are present`)
  for (const button of buttons) {
    assert.ok(button.visible, `${context}: ${button.label} is visible`)
    assert.ok(withinViewport(button.rect, width, height), `${context}: ${button.label} is within viewport: ${JSON.stringify(button.rect)}`)
    assert.ok(button.hit, `${context}: center of ${button.label} is hit-testable (actual target ${button.hitButtonLabel})`)
  }
}

try {
  for (const [name, width, height] of [['portrait-390x844', 390, 844], ['landscape-844x390', 844, 390]]) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, reducedMotion: 'reduce' })
    const page = await context.newPage()
    page.setDefaultTimeout(9000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
    await page.locator('.proto-b .cluster-map-svg').waitFor({ state: 'visible' })
    const mapPath = path.join(outputDir, `corrected-${name}-map.png`)
    await page.screenshot({ path: mapPath })

    const rail = await buttonGeometry(page, '.b-tool-rail .rail-button')
    assertButtonsOnScreen(rail, width, height, `${name} tool rail`)
    const zoom = await buttonGeometry(page, '.b-zoom-controls button')
    assert.equal(zoom.length, 3, `${name}: one complete zoom set`)
    assertButtonsOnScreen(zoom, width, height, `${name} zoom controls`)
    const inspectIndex = rail.findIndex(button => button.label.includes('Inspector panel'))
    assert.ok(inspectIndex >= 0, `${name}: one visible Inspect control exists`)

    const firstSystem = page.locator('.cluster-map-svg .cluster-system-node').first()
    const initialLabel = await firstSystem.getAttribute('aria-label')
    assert.match(initialLabel, /^Open .+ system map$/, `${name}: default cluster action announces Open`)
    const move = page.locator('.b-tool-rail .rail-button[title="Move / Modify"]')
    const moveBox = await move.boundingBox()
    assert.ok(moveBox && withinViewport({ x: moveBox.x, y: moveBox.y, right: moveBox.x + moveBox.width, bottom: moveBox.y + moveBox.height }, width, height), `${name}: Move button is on-screen`)
    await page.mouse.click(moveBox.x + moveBox.width / 2, moveBox.y + moveBox.height / 2)
    assert.match(await firstSystem.getAttribute('aria-label'), /^Select .+ system$/, `${name}: Move action announces Select`)
    const navigation = page.locator('.b-tool-rail .rail-button[title="Navigation"]')
    const navBox = await navigation.boundingBox()
    assert.ok(navBox)
    await page.mouse.click(navBox.x + navBox.width / 2, navBox.y + navBox.height / 2)
    assert.match(await firstSystem.getAttribute('aria-label'), /^Open .+ system map$/, `${name}: Navigation restores Open announcement`)
    const systemBox = await firstSystem.boundingBox()
    assert.ok(systemBox)
    await page.mouse.click(systemBox.x + systemBox.width / 2, systemBox.y + systemBox.height / 2)
    await page.locator('.system-map-svg').waitFor({ state: 'visible' })
    assert.equal(await page.locator('.inspector-card').isVisible(), false, `${name}: Navigate opens the system map without opening Inspector`)
    const back = page.getByRole('button', { name: 'Back to Jump Cluster' })
    const backBox = await back.boundingBox()
    assert.ok(backBox && withinViewport({ x: backBox.x, y: backBox.y, right: backBox.x + backBox.width, bottom: backBox.y + backBox.height }, width, height), `${name}: Back control bounds are within viewport`)
    const backHit = await page.evaluate(({ x, y }) => {
      const hit = document.elementFromPoint(x, y)
      const button = hit?.closest('button')
      return Boolean(button?.getAttribute('aria-label')?.includes('Back to Jump Cluster') || button?.innerText.includes('Back to Jump Cluster'))
    }, { x: backBox.x + backBox.width / 2, y: backBox.y + backBox.height / 2 })
    assert.ok(backHit, `${name}: Back center is hit-testable`)
    const systemPath = path.join(outputDir, `corrected-${name}-system.png`)
    await page.screenshot({ path: systemPath })
    await back.click()
    await page.locator('.cluster-map-svg').waitFor({ state: 'visible' })

    const inspectButton = page.locator('.b-tool-rail .rail-button[aria-label*="Inspector panel"]').first()
    const inspectBox = await inspectButton.boundingBox()
    assert.ok(inspectBox && withinViewport({ x: inspectBox.x, y: inspectBox.y, right: inspectBox.x + inspectBox.width, bottom: inspectBox.y + inspectBox.height }, width, height), `${name}: Inspect bounds are within viewport`)
    const inspectHit = await page.evaluate(({ x, y }) => {
      const hit = document.elementFromPoint(x, y)
      const button = hit?.closest('button')
      return Boolean(button?.getAttribute('aria-label')?.includes('Inspector panel'))
    }, { x: inspectBox.x + inspectBox.width / 2, y: inspectBox.y + inspectBox.height / 2 })
    assert.ok(inspectHit, `${name}: Inspect center is hit-testable`)
    await page.mouse.click(inspectBox.x + inspectBox.width / 2, inspectBox.y + inspectBox.height / 2)
    await page.locator('.inspector-card').waitFor({ state: 'visible' })
    await page.locator('.inspector-form input').first().fill(`discard toast ${name}`)
    await page.getByRole('button', { name: 'Discard' }).click()
    const toast = page.locator('.prototype-toast')
    await toast.waitFor({ state: 'visible' })
    const hide = page.getByRole('button', { name: 'Hide inspector' })
    if (await hide.isVisible()) await hide.click()
    await page.locator('.b-zoom-controls').waitFor({ state: 'visible' })
    await page.waitForTimeout(150)
    const overlay = await page.evaluate(() => {
      const toast = document.querySelector('.prototype-toast')
      const tr = toast?.getBoundingClientRect()
      const zoom = [...document.querySelectorAll('.b-zoom-controls button')].map(button => {
        const rect = button.getBoundingClientRect()
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
        return {
          label: button.getAttribute('aria-label'),
          rect: { x: rect.left, y: rect.top, right: rect.right, bottom: rect.bottom },
          hit: Boolean(hit && (hit === button || button.contains(hit))),
          overlapsToast: Boolean(tr && rect.left < tr.right && rect.right > tr.left && rect.top < tr.bottom && rect.bottom > tr.top),
        }
      })
      return { toastText: toast?.textContent?.trim() ?? null, toastRect: tr ? { x: tr.left, y: tr.top, right: tr.right, bottom: tr.bottom } : null, zoom }
    })
    assert.ok(overlay.toastText?.includes('draft discarded'), `${name}: discard toast is visible`)
    for (const button of overlay.zoom) {
      assert.ok(!button.overlapsToast, `${name}: toast does not overlap ${button.label}; ${JSON.stringify({ toast: overlay.toastRect, button })}`)
      assert.ok(button.hit, `${name}: ${button.label} remains hit-testable while toast is visible`)
      assert.ok(withinViewport(button.rect, width, height), `${name}: ${button.label} stays within viewport`)
    }
    const toastPath = path.join(outputDir, `corrected-${name}-discard-toast.png`)
    await page.screenshot({ path: toastPath })
    assert.deepEqual(errors, [], `${name}: no page errors`)
    results.push({ name, viewport: { width, height }, rail, zoom, backBox, overlay, screenshots: { mapPath, systemPath, toastPath }, aria: { initialLabel, move: 'Select … system', navigation: 'Open … system map' }, errors })
    await context.close()
  }
} finally {
  await browser.close()
}

const report = { build: 'isolated production output from current shared source; no QA hook', browser: 'headless Chrome with Playwright mobile/touch emulation', physicalDevice: false, results }
const serialized = JSON.stringify(report, null, 2)
await writeFile(path.join(outputDir, 'corrected-geometry-results.json'), `${serialized}\n`, 'utf8')
console.log(serialized)
