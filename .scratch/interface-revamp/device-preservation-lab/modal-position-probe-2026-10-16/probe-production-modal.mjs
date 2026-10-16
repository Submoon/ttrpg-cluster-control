import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const origin = process.env.PROBE_ORIGIN ?? 'http://127.0.0.1:3142'
const chromePath = process.env.CHROME_EXECUTABLE ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const runtimeDir = process.env.PROBE_RUNTIME ?? path.resolve(scriptDir, '../../preview-build')
const requireFromRuntime = createRequire(path.join(runtimeDir, 'package.json'))
const { chromium } = requireFromRuntime('@playwright/test')
const artifactDir = path.join(scriptDir, 'artifacts')
await mkdir(artifactDir, { recursive: true })

const browser = await chromium.launch({ headless: true, executablePath: chromePath })
const results = {
  browser: 'Google Chrome (Playwright controlled)',
  candidate: {
    dialogSourceSha256: '17F34EA3F2B9D4020A8C0BAE5690B7564F9091D3C69F510A17C8B45E41900F4A',
    workbenchSourceSha256: '0DC9F3C4D887384EEF0ECA39BB5FD2CC8954641895947454EBB794402BB03FA9',
  },
  cases: [],
  failures: [],
}

async function openFields(page, route) {
  page.setDefaultTimeout(15000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`${origin}${route}`, { waitUntil: 'domcontentloaded' })
  await page.locator('.cluster-map-svg').waitFor({ state: 'visible' })
  const openers = page.getByRole('button', { name: 'Open field definitions' })
  const openerCount = await openers.count()
  await openers.click()
  const dialog = page.locator('.prototype-fields-dialog')
  await dialog.waitFor({ state: 'visible' })
  await page.waitForTimeout(100)
  return { dialog, openerCount, errors }
}

async function measureDialog(dialog, width, height) {
  const measured = await dialog.evaluate(element => {
    const rect = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    return {
      role: element.getAttribute('role'),
      title: element.getAttribute('aria-labelledby'),
      fullscreen: element.getAttribute('data-fullscreen') === 'true',
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom },
      computed: { position: style.position, top: style.top, left: style.left, translate: style.translate, transform: style.transform },
      layout: { offsetWidth: element.offsetWidth, offsetHeight: element.offsetHeight },
    }
  })
  measured.centerDelta = {
    x: measured.rect.x + measured.rect.width / 2 - width / 2,
    y: measured.rect.y + measured.rect.height / 2 - height / 2,
  }
  measured.withinViewport = measured.rect.x >= 0 && measured.rect.y >= 0 && measured.rect.right <= width && measured.rect.bottom <= height
  measured.centeredWithinTwoPixels = Math.abs(measured.centerDelta.x) <= 2 && Math.abs(measured.centerDelta.y) <= 2
  if (measured.fullscreen) {
    measured.fullscreenGeometry = measured.rect.x === 0 && measured.rect.y === 0 && measured.rect.width === width && measured.rect.height === height
  }
  return measured
}

async function measureButton(page, locator) {
  const box = await locator.boundingBox()
  return {
    visible: await locator.isVisible(),
    count: await locator.count(),
    rect: box ? { x: box.x, y: box.y, width: box.width, height: box.height, right: box.x + box.width, bottom: box.y + box.height } : null,
  }
}

function buttonWithinViewport(button, width, height) {
  return button.visible && button.rect !== null && button.rect.x >= 0 && button.rect.y >= 0 && button.rect.right <= width && button.rect.bottom <= height
}

async function checkGeometry(page, route, width, height, screenshotName) {
  const { dialog, openerCount, errors } = await openFields(page, route)
  const geometry = await measureDialog(dialog, width, height)
  const screenshot = path.join(artifactDir, screenshotName)
  await page.screenshot({ path: screenshot })
  const item = { route, viewport: { width, height }, openerCount, geometry, screenshot, pageErrors: errors }
  results.cases.push(item)
  try {
    assert.equal(openerCount, 1, 'Exactly one visible Fields opener is available.')
    assert.ok(geometry.withinViewport, `Dialog is outside the viewport: ${JSON.stringify(geometry.rect)}`)
    if (geometry.fullscreen) {
      assert.ok(geometry.fullscreenGeometry, `Fullscreen dialog does not cover the viewport: ${JSON.stringify(geometry.rect)}`)
    } else {
      assert.ok(geometry.centeredWithinTwoPixels, `Dialog is not centered within 2px: ${JSON.stringify(geometry.centerDelta)}`)
    }
    assert.deepEqual(errors, [], `Browser page errors: ${errors.join('; ')}`)
    item.assertion = 'PASS'
  } catch (error) {
    item.assertion = 'FAIL'
    item.assertionError = error.message
    results.failures.push(`${width}x${height} ${route}: ${error.message}`)
  }
  return item
}

try {
  const desktopPage = await browser.newPage({ viewport: { width: 1137, height: 1244 }, deviceScaleFactor: 1 })
  await checkGeometry(
    desktopPage,
    '/?variant=B&controls=dock&fieldsActions=footer',
    1137,
    1244,
    'production-repro-1137x1244.png',
  )
  await desktopPage.close()

  const defaultPage = await browser.newPage({ viewport: { width: 1137, height: 1244 }, deviceScaleFactor: 1 })
  const defaultCase = await openFields(defaultPage, '/?variant=B&controls=dock')
  const footerCount = await defaultPage.locator('.fields-actions-footer:visible').count()
  const headerCount = await defaultPage.locator('.fields-actions-header:visible').count()
  const addButton = defaultPage.getByRole('button', { name: 'Add custom field', exact: true })
  const listAddCount = await addButton.count()
  const listAddBounds = await measureButton(defaultPage, addButton)
  const defaultScreenshot = path.join(artifactDir, 'production-default-footer-1137x1244.png')
  await defaultPage.screenshot({ path: defaultScreenshot })
  const layoutCase = {
    route: '/?variant=B&controls=dock',
    viewport: { width: 1137, height: 1244 },
    footerCount,
    headerCount,
    listAddCount,
    listAddBounds,
    screenshot: defaultScreenshot,
    action: 'Open Fields, add a new field draft, close/reopen it, verify draft retention, then check the detail-page creation command and Back navigation.',
    checks: {},
    pageErrors: defaultCase.errors,
  }
  results.cases.push(layoutCase)
  try {
    assert.equal(defaultCase.openerCount, 1, 'Exactly one Fields opener is available.')
    assert.equal(footerCount, 1, 'The default action layout renders one footer action region.')
    assert.equal(headerCount, 0, 'The default action layout does not render a header action region.')
    assert.equal(listAddCount, 1, 'The list screen exposes Add custom field once.')
    assert.ok(buttonWithinViewport(listAddBounds, 1137, 1244), 'Add custom field is visible inside the desktop viewport.')

    await addButton.click()
    const nameInput = defaultPage.getByRole('textbox', { name: 'Custom field label' })
    await nameInput.fill('Modal position QA draft')
    layoutCase.checks.draftMarkedModified = await defaultPage.locator('.prototype-fields-dialog').getAttribute('data-draft-state') === 'modified'
    await defaultPage.getByRole('button', { name: 'Close Fields' }).click()
    await defaultPage.locator('.prototype-fields-dialog').waitFor({ state: 'hidden' })
    await defaultPage.getByRole('button', { name: 'Open field definitions' }).click()
    await defaultPage.locator('.prototype-fields-dialog').waitFor({ state: 'visible' })
    layoutCase.checks.draftRetainedAfterClose = await defaultPage.getByRole('textbox', { name: 'Custom field label' }).inputValue() === 'Modal position QA draft'

    await defaultPage.getByRole('button', { name: 'Back to definitions' }).click()
    await defaultPage.locator('.prototype-fields-workspace.is-list-screen').waitFor({ state: 'visible' })
    await defaultPage.getByRole('button', { name: 'Add custom field', exact: true }).click()
    await defaultPage.getByRole('button', { name: 'Cancel creation' }).click()
    const firstDefinition = defaultPage.locator('[data-fields-list] .fields-choice').first()
    await firstDefinition.click()
    await defaultPage.locator('[data-fields-detail]').waitFor({ state: 'visible' })
    const detailEditButton = defaultPage.getByRole('button', { name: 'Edit field definition' })
    layoutCase.checks.detailEditBounds = await measureButton(defaultPage, detailEditButton)
    const detailCreateButton = defaultPage.getByRole('button', { name: 'New custom field', exact: true })
    layoutCase.checks.detailNewFieldCount = await detailCreateButton.count()
    layoutCase.checks.detailNewFieldBounds = await measureButton(defaultPage, detailCreateButton)
    assert.ok(buttonWithinViewport(layoutCase.checks.detailEditBounds, 1137, 1244), 'Edit definition is visible inside the desktop viewport.')
    assert.ok(buttonWithinViewport(layoutCase.checks.detailNewFieldBounds, 1137, 1244), 'New custom field is visible inside the desktop viewport.')
    await detailCreateButton.click()
    await defaultPage.locator('[data-fields-create]').waitFor({ state: 'visible' })
    await defaultPage.getByRole('button', { name: 'Back to definitions' }).click()
    await defaultPage.locator('[data-fields-list]').waitFor({ state: 'visible' })
    layoutCase.checks.backReturnsToList = await defaultPage.locator('[data-fields-list]').isVisible()
    layoutCase.checks.pageErrors = defaultCase.errors

    assert.equal(layoutCase.checks.draftMarkedModified, true, 'Typing marks the creation draft as modified.')
    assert.equal(layoutCase.checks.draftRetainedAfterClose, true, 'Closing and reopening Fields preserves the unsaved creation draft.')
    assert.equal(layoutCase.checks.detailNewFieldCount, 1, 'The detail screen exposes New custom field once.')
    assert.equal(layoutCase.checks.backReturnsToList, true, 'Back to definitions returns to the list.')
    assert.deepEqual(defaultCase.errors, [], `Browser page errors: ${defaultCase.errors.join('; ')}`)
    layoutCase.assertion = 'PASS'
  } catch (error) {
    layoutCase.assertion = 'FAIL'
    layoutCase.assertionError = error.message
    results.failures.push(`default footer and creation actions: ${error.message}`)
  }
  await defaultPage.close()

  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1, isMobile: true, hasTouch: true })
    const screenshot = `production-${viewport.width}x${viewport.height}.png`
    const compactCase = await checkGeometry(page, '/?variant=B&controls=dock&fieldsActions=footer', viewport.width, viewport.height, screenshot)
    const addButton = page.getByRole('button', { name: 'Add custom field', exact: true })
    const addBounds = await measureButton(page, addButton)
    compactCase.addCustomFieldBounds = addBounds
    try {
      assert.equal(addBounds.count, 1, `${viewport.width}x${viewport.height}: Add custom field is present once.`)
      assert.ok(buttonWithinViewport(addBounds, viewport.width, viewport.height), `${viewport.width}x${viewport.height}: Add custom field is within the viewport.`)
      await page.locator('[data-fields-list] .fields-choice').first().click()
      const editButton = page.getByRole('button', { name: 'Edit field definition' })
      compactCase.detailEditBounds = await measureButton(page, editButton)
      assert.ok(buttonWithinViewport(compactCase.detailEditBounds, viewport.width, viewport.height), `${viewport.width}x${viewport.height}: Edit definition is within the viewport.`)
      compactCase.actionsAssertion = 'PASS'
    } catch (error) {
      compactCase.actionsAssertion = 'FAIL'
      compactCase.actionsAssertionError = error.message
      results.failures.push(`${viewport.width}x${viewport.height} action bounds: ${error.message}`)
    }
    await page.close()
  }
} finally {
  await browser.close()
}

const outputPath = path.join(artifactDir, 'production-modal-qa.json')
await writeFile(outputPath, JSON.stringify(results, null, 2) + '\n')
console.log(JSON.stringify(results, null, 2))
if (results.failures.length) process.exitCode = 1
