import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const repoRoot = process.cwd()
const runtimeRoot = path.resolve('.scratch/interface-revamp/preview-build')
const outputDir = path.resolve('.scratch/interface-revamp/device-preservation-lab/artifacts/dock-feedback-2026-10-15/after/final-dev')
const baseUrl = process.env.PREVIEW_ROOT_URL ?? 'http://127.0.0.1:3139/?variant=B'
const sourcePaths = [
  'components/ClusterMap.vue',
  'components/PrototypeCataloguePicker.vue',
  'components/PrototypeCreationPopover.vue',
  'components/PrototypeMapCanvas.vue',
  'components/PrototypeWorkbench.vue',
  'components/SystemMap.vue',
  'components/maps/system-map-renderer.ts',
]
const viewportSpecs = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]
const playwrightPath = pathToFileURL(path.join(repoRoot, 'node_modules', '@playwright', 'test', 'index.mjs')).href
const { chromium } = await import(playwrightPath)

async function sha256(filePath) {
  return createHash('sha256').update(await readFile(filePath)).digest('hex').toUpperCase()
}

async function sourceSnapshot() {
  const files = []
  for (const relativePath of sourcePaths) {
    files.push({
      path: relativePath,
      checkoutSha256: await sha256(path.join(repoRoot, relativePath)),
      runtimeSha256: await sha256(path.join(runtimeRoot, relativePath)),
    })
  }
  for (const file of files) assert.equal(file.checkoutSha256, file.runtimeSha256, `Runtime source matches checkout for ${file.path}`)
  return files
}

async function layerSnapshot(page) {
  return page.evaluate(() => {
    const content = document.querySelector('[data-slot="content"]')
    const hud = document.querySelector('.b-map-hud')
    const toast = document.querySelector('.prototype-toast')
    const read = element => {
      if (!element) return null
      const box = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      const visible = style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0
      const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
      const hit = visible ? document.elementFromPoint(center.x, center.y) : null
      return {
        text: element.textContent?.trim().replace(/\s+/g, ' ').slice(0, 90) ?? '',
        rect: { x: box.x, y: box.y, right: box.right, bottom: box.bottom, width: box.width, height: box.height },
        position: style.position,
        zIndex: style.zIndex,
        display: style.display,
        visible,
        insideViewport: visible && box.x >= 0 && box.y >= 0 && box.right <= innerWidth && box.bottom <= innerHeight,
        hitTarget: hit ? { tag: hit.tagName, className: String(hit.getAttribute('class') ?? ''), label: hit.getAttribute('aria-label') ?? hit.textContent?.trim().slice(0, 60) ?? '' } : null,
        hitTestable: Boolean(hit && (hit === element || element.contains(hit))),
      }
    }
    const panel = document.querySelector('.b-catalogue-panel')
    const families = [...(panel?.querySelectorAll('.b-catalogue-family-list button') ?? [])]
    const types = [...(panel?.querySelectorAll('.b-catalogue-types button') ?? [])]
    return {
      shellClass: document.querySelector('.proto-b')?.className ?? '',
      content: read(content),
      hud: read(hud),
      toast: read(toast),
      header: read(panel?.querySelector('.b-catalogue-heading')),
      closeButton: read(panel?.querySelector('[aria-label="Close object catalogue"]')),
      families: families.map((element, index) => ({ index, label: element.textContent?.trim(), ...read(element) })),
      types: types.map((element, index) => ({ index, label: element.textContent?.trim(), ...read(element) })),
      actionButtons: [...document.querySelectorAll('.b-create-content > button')].map((element, index) => ({ index, label: element.textContent?.trim(), ...read(element) })),
    }
  })
}

await mkdir(outputDir, { recursive: true })
const sources = await sourceSnapshot()
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' })
const results = []

try {
  for (const viewport of viewportSpecs) {
    const isMobile = viewport.width <= 760 || viewport.height <= 600
    const context = await browser.newContext({ viewport, isMobile, hasTouch: isMobile, deviceScaleFactor: 1 })
    const page = await context.newPage()
    page.setDefaultTimeout(20000)
    page.setDefaultNavigationTimeout(90000)
    const pageErrors = []
    page.on('pageerror', error => pageErrors.push(error.message))
    await page.goto(baseUrl, { waitUntil: 'commit' })
    await page.locator('.proto-b').waitFor({ state: 'visible' })

    const initialInspector = page.locator('.b-inspector-float.inspector-open')
    const initialInspectorDismissed = await initialInspector.isVisible()
    if (initialInspectorDismissed) await initialInspector.getByRole('button', { name: 'Hide inspector', exact: true }).click()
    await page.locator('.proto-b .cluster-map-svg').waitFor({ state: 'visible', timeout: 45000 })
    const defaultLayout = await page.locator('.proto-b').getAttribute('data-controls')
    assert.equal(defaultLayout, 'dock', 'Dock is the default control layout')

    // Arm and cancel Add Orbit through the UI to create the transient toast before opening the chooser.
    const trigger = page.getByRole('button', { name: 'Choose an item to add to the map' })
    await trigger.click()
    await page.locator('.b-create-content button').filter({ hasText: 'Add Jump Route' }).waitFor({ state: 'visible' })
    const clusterActions = await page.locator('.b-create-content > button').count()
    assert.equal(clusterActions, 2, 'The cluster action chooser exposes both Add actions')
    await page.locator('.b-create-content button').filter({ hasText: 'Add Jump Route' }).click()
    await page.keyboard.press('Escape')
    await page.locator('.prototype-toast.is-add-feedback').waitFor({ state: 'visible' })
    const toastBeforeOpen = await page.locator('.prototype-toast').evaluate(element => ({
      className: element.className,
      display: getComputedStyle(element).display,
      text: element.textContent?.trim() ?? '',
    }))
    assert.equal(toastBeforeOpen.display, 'block', 'The cancellation feedback toast is present before opening the chooser')

    await page.locator('.cluster-map-svg .cluster-system-node').first().click()
    await page.locator('.system-map-svg').waitFor({ state: 'visible' })
    await trigger.click()
    await page.locator('.b-create-content').waitFor({ state: 'visible' })
    const actionLayer = await layerSnapshot(page)
    assert.equal(actionLayer.actionButtons.length, 2, 'Both system Add actions are present')
    assert.ok(actionLayer.content?.visible && actionLayer.content.insideViewport, 'Action chooser content is visible in the viewport')
    assert.equal(actionLayer.content?.zIndex, '15', 'The UPopover content layer uses the approved z-index 15')
    assert.ok(actionLayer.actionButtons.every(button => button.visible && button.insideViewport && button.hitTestable), 'Both system Add actions are visible and hit-testable')
    assert.equal(actionLayer.toast?.display, 'none', 'The stale Add feedback toast is hidden while the chooser is open')

    await page.getByRole('button', { name: /Add map mark/ }).click()
    await page.locator('.b-catalogue-panel').waitFor({ state: 'visible' })
    const screenshot = path.join(outputDir, `dock-chooser-${viewport.width}x${viewport.height}.png`)
    await page.screenshot({ path: screenshot })
    const catalogueLayer = await layerSnapshot(page)
    assert.ok(catalogueLayer.content?.visible && catalogueLayer.content.insideViewport, 'Catalogue content is visible and inside the viewport')
    assert.equal(catalogueLayer.content?.zIndex, '15', 'Catalogue uses the same UPopover content layer')
    assert.ok(catalogueLayer.header?.visible && catalogueLayer.header.insideViewport && catalogueLayer.header.hitTestable, 'Catalogue header is visible and unobstructed')
    assert.ok(catalogueLayer.closeButton?.visible && catalogueLayer.closeButton.insideViewport && catalogueLayer.closeButton.hitTestable, 'Catalogue close button is visible and hit-testable')
    assert.equal(catalogueLayer.families.length, 7, 'All seven catalogue families are rendered')
    assert.ok(catalogueLayer.families.every(item => item.visible && item.insideViewport && item.hitTestable), 'Every catalogue family button is visible and hit-testable')
    assert.ok(catalogueLayer.types.length > 0 && catalogueLayer.types.every(item => item.visible && item.insideViewport && item.hitTestable), 'Every active-family type button is visible and hit-testable')
    assert.equal(catalogueLayer.toast?.display, 'none', 'The stale Add feedback toast remains hidden over catalogue content')

    const familyProbes = []
    const familyButtons = page.locator('.b-catalogue-family-list button')
    for (let index = 0; index < await familyButtons.count(); index += 1) {
      const label = (await familyButtons.nth(index).innerText()).trim()
      await familyButtons.nth(index).click()
      const types = await page.locator('.b-catalogue-types button').evaluateAll(elements => elements.map(element => {
        const box = element.getBoundingClientRect()
        const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
        return {
          label: element.innerText.trim(),
          visible: box.width > 0 && box.height > 0 && getComputedStyle(element).display !== 'none',
          insideViewport: box.x >= 0 && box.y >= 0 && box.right <= innerWidth && box.bottom <= innerHeight,
          hitTestable: Boolean(hit && (hit === element || element.contains(hit))),
        }
      }))
      assert.ok(types.length > 0, `${label} has visible type choices`)
      assert.ok(types.every(item => item.visible && item.insideViewport && item.hitTestable), `Every ${label} type is visible and hit-testable`)
      familyProbes.push({ family: label, types })
    }

    await page.getByRole('button', { name: 'Close object catalogue' }).click()
    await page.locator('.b-catalogue-panel').waitFor({ state: 'hidden' })
    assert.ok(await page.locator('.proto-b').evaluate(element => element.classList.contains('has-active-add')), 'Closing the chooser preserves armed Add')
    assert.deepEqual(pageErrors, [], 'The dev page has no uncaught browser errors')

    const report = {
      runtime: 'Nuxt dev via npm run dev in the isolated preview-build runtime on localhost:3139',
      viewport: { ...viewport, isMobile, hasTouch: isMobile, deviceScaleFactor: 1 },
      defaultLayout,
      initialInspectorDismissed,
      toastBeforeOpen,
      actionLayer,
      catalogueLayer,
      familyProbes,
      addPreservedAfterClose: true,
      pageErrors,
      screenshot,
    }
    const runPath = path.join(outputDir, `run-${viewport.width}x${viewport.height}.json`)
    await writeFile(runPath, JSON.stringify(report, null, 2))
    results.push(report)
    console.log(JSON.stringify({ viewport: report.viewport, defaultLayout, initialInspectorDismissed, actionZIndex: actionLayer.content?.zIndex, catalogueZIndex: catalogueLayer.content?.zIndex, toastBeforeOpen, toastWhileOpen: catalogueLayer.toast?.display, headerHitTestable: catalogueLayer.header?.hitTestable, closeHitTestable: catalogueLayer.closeButton?.hitTestable, familyCount: catalogueLayer.families.length, familyTypeCounts: familyProbes.map(item => [item.family, item.types.length]), addPreservedAfterClose: true, pageErrors }, null, 2))
    await context.close()
  }

  const finalReport = {
    baseUrl,
    runtimeRoot,
    runtimeLabel: 'Local Nuxt dev after reviewed popover layer and Add-feedback toast fix',
    browser: `Chrome ${browser.version()} via Playwright`,
    node: process.version,
    input: 'Fresh browser contexts; Playwright locator actions and DOM geometry/hit-test reads; no injected product mutations.',
    note: 'Mobile flags and touchscreen capability are viewport emulation at 390×844 and 844×390. The dev-only prototype switcher is present in these captures; positions are local development geometry, not production chrome geometry or physical-device results.',
    sources,
    results,
  }
  await writeFile(path.join(outputDir, 'qa-report.json'), JSON.stringify(finalReport, null, 2))
  console.log(JSON.stringify({ outputDir, browser: finalReport.browser, sourceFilesMatch: sources.every(file => file.checkoutSha256 === file.runtimeSha256), results: results.map(result => ({ viewport: result.viewport, actionZIndex: result.actionLayer.content.zIndex, catalogueZIndex: result.catalogueLayer.content.zIndex, toastBeforeOpen: result.toastBeforeOpen.display, toastWhileOpen: result.catalogueLayer.toast.display, allFamiliesHitTestable: result.catalogueLayer.families.every(item => item.hitTestable), familyTypeCounts: result.familyProbes.map(item => [item.family, item.types.length]), addPreservedAfterClose: result.addPreservedAfterClose, pageErrors: result.pageErrors })) }, null, 2))
} finally {
  await browser.close()
}
