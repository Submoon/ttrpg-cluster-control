import path from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'

const { chromium } = await import(pathToFileURL(path.join(process.cwd(), 'node_modules', '@playwright', 'test', 'index.mjs')).href)
const outputDir = path.join(process.cwd(), '.scratch', 'interface-revamp', 'device-preservation-lab', 'artifacts', 'resolved-tools-2026-10-15')
await mkdir(outputDir, { recursive: true })
const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' })
const results = []

async function openPage(controls, width, height) {
  const context = await browser.newContext({ viewport: { width, height }, isMobile: width <= 760 || height <= 600, hasTouch: width <= 760 || height <= 600, deviceScaleFactor: 1 })
  const page = await context.newPage()
  await page.goto(`http://127.0.0.1:3131/?variant=B&controls=${controls}`, { waitUntil: 'domcontentloaded' })
  await page.locator('.proto-b .cluster-map-svg').waitFor({ state: 'visible' })
  await page.locator('.b-inspector-float').waitFor({ state: 'hidden' })
  await page.waitForTimeout(240)
  return { context, page, controls, width, height }
}

async function measure(page) {
  return page.evaluate(() => {
    const rect = selector => {
      const element = document.querySelector(selector)
      if (!element || getComputedStyle(element).display === 'none') return null
      const box = element.getBoundingClientRect()
      return { selector, x: box.x, y: box.y, right: box.right, bottom: box.bottom, width: box.width, height: box.height }
    }
    const header = rect('.b-commandbar')
    const hud = rect('.b-map-hud')
    const status = rect('.b-add-status')
    const rail = rect('.b-tool-rail')
    const dock = rect('.b-control-dock')
    const zoom = rect('.b-zoom-controls')
    const menu = rect('.b-create-menu')
    const files = rect('.b-files-menu-items')
    const overlaps = (left, right) => Boolean(left && right && left.x < right.right && left.right > right.x && left.y < right.bottom && left.bottom > right.y)
    return {
      viewport: { width: innerWidth, height: innerHeight },
      hasActiveAdd: document.querySelector('.proto-b')?.classList.contains('has-active-add'),
      header, hud, status, rail, dock, zoom, menu, files,
      overlaps: {
        headerHud: overlaps(header, hud),
        hudStatus: overlaps(hud, status),
        hudCreateMenu: overlaps(hud, menu),
        hudFilesMenu: overlaps(hud, files),
        zoomStatus: overlaps(zoom, status),
        zoomCreateMenu: overlaps(zoom, menu),
        zoomFilesMenu: overlaps(zoom, files),
        dockFilesMenu: overlaps(dock, files),
        railStatus: overlaps(rail, status),
        dockStatus: overlaps(dock, status),
        railCreateMenu: overlaps(rail, menu),
        dockCreateMenu: overlaps(dock, menu),
      },
    }
  })
}

async function actionHitStates(page, selector) {
  return page.evaluate(selector => [...document.querySelectorAll(selector)].map(element => {
    const box = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    const visible = style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0
    const x = box.left + box.width / 2
    const y = box.top + box.height / 2
    const hit = visible ? document.elementFromPoint(x, y) : null
    return {
      label: element.getAttribute('aria-label') || element.innerText.trim(),
      visible,
      inViewport: visible && box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight,
      hit: Boolean(hit && (hit === element || element.contains(hit))),
      rect: { x: box.left, y: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height },
    }
  }), selector)
}

function assertMenuActions(actions, label) {
  assert.ok(actions.length > 0, `${label}: menu has visible actions`)
  for (const action of actions) {
    assert.ok(action.visible, `${label}: visible ${action.label}`)
    assert.ok(action.inViewport, `${label}: in viewport ${action.label}: ${JSON.stringify(action.rect)}`)
    assert.ok(action.hit, `${label}: hit-testable ${action.label}: ${JSON.stringify(action)}`)
  }
}

async function assertRestoredControls(page, controls, label) {
  const selector = `${controls === 'groups' ? '.b-tool-rail button' : '.b-control-dock button'}, .b-zoom-controls button`
  const actions = await actionHitStates(page, selector)
  assertMenuActions(actions, `${label}: controls restored`)
  return actions.length
}

try {
  for (const controls of ['groups', 'dock']) {
    for (const [width, height] of [[390, 844], [844, 390]]) {
      const run = await openPage(controls, width, height)
      const closed = await measure(run.page)
      const menuValidation = {}
      await run.page.screenshot({ path: path.join(outputDir, `${controls}-${width}x${height}-layout.png`) })
      if (controls === 'dock') {
        const fileTrigger = run.page.locator('.b-files-menu summary')
        await fileTrigger.click()
        await run.page.waitForTimeout(50)
        closed.openFiles = await measure(run.page)
        const fileActions = await actionHitStates(run.page, '.b-files-menu-items button')
        assert.equal(fileActions.length, 4, `dock ${width}x${height}: four map file actions`)
        assertMenuActions(fileActions, `dock ${width}x${height}: Map files`)
        await fileTrigger.click()
        await run.page.waitForFunction(() => !document.querySelector('.b-files-menu')?.open)
        menuValidation.files = { actions: fileActions, closeBy: 'trigger', restoredControlCount: await assertRestoredControls(run.page, controls, `dock ${width}x${height}: after Map files`) }
      }
      const addTrigger = run.page.getByRole('button', { name: 'Choose an item to add to the map' })
      await addTrigger.click()
      closed.openAdd = await measure(run.page)
      const addActions = await actionHitStates(run.page, '.b-create-menu button')
      assert.equal(addActions.length, 2, `${controls} ${width}x${height}: two Add actions`)
      assertMenuActions(addActions, `${controls} ${width}x${height}: Add menu`)
      await addTrigger.click()
      await run.page.waitForFunction(() => getComputedStyle(document.querySelector('.b-create-menu')).display === 'none')
      menuValidation.add = { actions: addActions, closeBy: 'trigger', restoredControlCount: await assertRestoredControls(run.page, controls, `${controls} ${width}x${height}: after Add menu`) }
      await addTrigger.click()
      await run.page.getByRole('button', { name: 'Add Jump Route' }).click()
      closed.addStatus = await measure(run.page)
      closed.menuValidation = menuValidation
      results.push({ controls, viewport: `${width}x${height}`, closed })
      await run.context.close()
    }
  }
  await writeFile(path.join(outputDir, 'layout-overlap-survey.json'), JSON.stringify({ preview: 'http://127.0.0.1:3131/?variant=B', note: 'Exploratory DOM bounds and temporary-menu hit tests on the final successful production build; transition settling is awaited; not physical-device coverage.', results }, null, 2))
  console.log(JSON.stringify(results.map(result => ({ controls: result.controls, viewport: result.viewport, initial: result.closed.overlaps, openFiles: result.closed.openFiles?.overlaps, openAdd: result.closed.openAdd.overlaps, addStatus: result.closed.addStatus.overlaps, menus: result.closed.menuValidation })), null, 2))
} finally {
  await browser.close()
}
