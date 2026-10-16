import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const repoRoot = process.cwd()
const playwrightPath = pathToFileURL(path.join(repoRoot, 'node_modules', '@playwright', 'test', 'index.mjs')).href
const { chromium } = await import(playwrightPath)
const baseUrl = process.env.PREVIEW_ROOT_URL ?? 'http://127.0.0.1:3133/'
const chromePath = process.env.CHROME_EXECUTABLE ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const buildRoot = path.resolve(process.env.PREVIEW_BUILD_ROOT ?? '.scratch/interface-revamp/preview-build')
const outputDir = path.resolve(process.env.QA_OUTPUT_DIR ?? '.scratch/interface-revamp/device-preservation-lab/artifacts/dock-feedback-2026-10-15/after')
const redOnly = process.env.QA_RED_ONLY === '1'
const viewportSpecs = (process.env.QA_VIEWPORTS ?? (redOnly ? '1440x900' : '1440x900,390x844,844x390'))
  .split(',')
  .map(value => value.trim().split('x').map(Number))
  .map(([width, height]) => ({ width, height }))

const sourcePaths = [
  'components/ClusterMap.vue',
  'components/PrototypeCataloguePicker.vue',
  'components/PrototypeCreationPopover.vue',
  'components/PrototypeMapCanvas.vue',
  'components/PrototypeWorkbench.vue',
  'components/SystemMap.vue',
  'components/maps/system-map-renderer.ts',
]

async function sha256(filePath) {
  return createHash('sha256').update(await readFile(filePath)).digest('hex').toUpperCase()
}

async function sourceSnapshot() {
  const snapshot = []
  for (const relativePath of sourcePaths) {
    snapshot.push({
      path: relativePath,
      checkoutSha256: await sha256(path.join(repoRoot, relativePath)),
      buildWorkspaceSha256: await sha256(path.join(buildRoot, relativePath)),
    })
  }

  const expectedManifestPath = process.env.QA_EXPECT_SOURCE_MANIFEST
  if (expectedManifestPath) {
    const expected = JSON.parse(await readFile(path.resolve(expectedManifestPath), 'utf8'))
    for (const file of snapshot) {
      const entry = expected.find(candidate => candidate.path === file.path)
      if (file.path === 'components/PrototypeCreationPopover.vue' && !entry) continue
      assert.ok(entry, `Source manifest has ${file.path}`)
      assert.equal(file.checkoutSha256, entry.sha256, `Checkout source matches baseline manifest for ${file.path}`)
      assert.equal(file.buildWorkspaceSha256, entry.buildSourceSha256, `Build workspace source matches baseline manifest for ${file.path}`)
    }
  }

  return { files: snapshot, expectedManifest: expectedManifestPath ?? null }
}

function rect(value) {
  return { x: value.x, y: value.y, right: value.right, bottom: value.bottom, width: value.width, height: value.height }
}

function distance(left, right) {
  return Math.hypot(left.x - right.x, left.y - right.y)
}

function parseTranslate(transform) {
  const match = transform?.match(/translate\(\s*(-?[\d.eE+]+)[ ,]+(-?[\d.eE+]+)\s*\)/)
  assert.ok(match, `Object has a scene translate transform: ${transform}`)
  return { x: Number(match[1]), y: Number(match[2]) }
}

async function openPicker(page) {
  const trigger = page.getByRole('button', { name: 'Choose an item to add to the map' })
  await trigger.click()
  const action = page.locator('.b-create-content button, .b-create-menu button').filter({ hasText: 'Add map mark' })
  await action.waitFor({ state: 'visible' })
  const actionMenuRect = await action.boundingBox()
  await action.click()
  await page.locator('.b-catalogue-panel').waitFor({ state: 'visible' })
  return { trigger, actionMenuRect }
}

async function pickMoon(page) {
  await page.getByRole('button', { name: 'Moon', exact: true }).click()
  await page.locator('.b-catalogue-panel').waitFor({ state: 'hidden' })
}

async function pickerGeometry(page) {
  return page.evaluate(() => {
    const trigger = document.querySelector('.proto-b [aria-label="Choose an item to add to the map"]')
    const picker = document.querySelector('.b-catalogue-panel')
    if (!trigger || !picker) return null
    const read = element => {
      const box = element.getBoundingClientRect()
      return { x: box.x, y: box.y, right: box.right, bottom: box.bottom, width: box.width, height: box.height }
    }
    const triggerRect = read(trigger)
    const pickerRect = read(picker)
    const horizontalOverlap = pickerRect.x < triggerRect.right && pickerRect.right > triggerRect.x
    const verticalGap = Math.min(Math.abs(pickerRect.y - triggerRect.bottom), Math.abs(triggerRect.y - pickerRect.bottom))
    return { trigger: triggerRect, picker: pickerRect, horizontalOverlap, verticalGap, anchored: horizontalOverlap && verticalGap <= 16 }
  })
}

async function commandRowGeometry(page) {
  return page.evaluate(() => {
    const row = document.querySelector('.b-map-hud')
    const controls = [...(row?.querySelectorAll('button, summary') ?? [])]
    const find = (label, fallback) => controls.find(element => element.getAttribute('aria-label') === label || element.textContent?.trim() === fallback) ?? null
    const targets = [
      ['hierarchy', find('Show map hierarchy', 'Hierarchy')],
      ['inspect', controls.find(element => element.getAttribute('aria-label')?.includes('Inspect panel')) ?? find('', 'Inspect')],
      ['mapFiles', find('Open map file commands', 'Map files') ?? find('', 'Import map…')],
    ]
    const read = element => {
      if (!element) return null
      const box = element.getBoundingClientRect()
      const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
      return { x: box.x, y: box.y, right: box.right, bottom: box.bottom, width: box.width, height: box.height, visible: box.width > 0 && box.height > 0, insideViewport: box.x >= 0 && box.y >= 0 && box.right <= innerWidth && box.bottom <= innerHeight, hitTestable: Boolean(hit && (hit === element || element.contains(hit))) }
    }
    return { rowPresent: Boolean(row), rowText: row?.innerText ?? '', targets: Object.fromEntries(targets.map(([name, element]) => [name, read(element)])) }
  })
}

async function orbitTargetPair(page, orbitId) {
  return page.evaluate(orbitId => {
    const svg = document.querySelector('svg.system-map-svg')
    const content = svg?.querySelector('.system-map-content')
    const target = svg?.querySelector(`.orbit-hit-target[data-orbit-id="${CSS.escape(orbitId)}"]`)
    if (!svg || !content || !target) throw new Error(`Missing visible Orbit target ${orbitId}`)

    const cx = Number(target.getAttribute('cx'))
    const cy = Number(target.getAttribute('cy'))
    const rx = Number(target.getAttribute('rx'))
    const ry = Number(target.getAttribute('ry'))
    const transform = target.getAttribute('transform') ?? ''
    const rotationMatch = transform.match(/rotate\(\s*(-?[\d.eE+]+)/)
    const rotationDegrees = Number(rotationMatch?.[1] ?? 0)
    const rotation = rotationDegrees * Math.PI / 180
    const matrix = content.getScreenCTM()
    if (!matrix) throw new Error('The map content has no screen transform')
    const candidates = []

    for (let index = 0; index < 48; index += 1) {
      const angle = -Math.PI + index * (Math.PI * 2 / 48)
      const localX = Math.cos(angle) * rx
      const localY = Math.sin(angle) * ry
      const scene = {
        x: cx + localX * Math.cos(rotation) - localY * Math.sin(rotation),
        y: cy + localX * Math.sin(rotation) + localY * Math.cos(rotation),
      }
      const point = svg.createSVGPoint()
      point.x = scene.x
      point.y = scene.y
      const screen = point.matrixTransform(matrix)
      // Playwright's browser mouse dispatches integer client coordinates. Resolve
      // the expected scene position from that exact point, then verify the Orbit
      // still owns the hit target there before treating it as a placement target.
      const client = { x: Math.floor(screen.x), y: Math.floor(screen.y) }
      const hit = document.elementFromPoint(client.x, client.y)
      if (hit !== target || client.x < 0 || client.x > innerWidth || client.y < 0 || client.y > innerHeight) continue
      const dispatchedPoint = svg.createSVGPoint()
      dispatchedPoint.x = client.x
      dispatchedPoint.y = client.y
      const dispatchedScene = dispatchedPoint.matrixTransform(matrix.inverse())
      candidates.push({
        angle,
        scene: { x: dispatchedScene.x, y: dispatchedScene.y },
        ellipseScene: scene,
        client,
      })
    }

    let best = null
    for (const first of candidates) {
      for (const second of candidates) {
        const angularDistance = Math.abs(Math.atan2(Math.sin(first.angle - second.angle), Math.cos(first.angle - second.angle)))
        const pixelDistance = Math.hypot(first.client.x - second.client.x, first.client.y - second.client.y)
        if (angularDistance < 1.35 || pixelDistance < Math.min(innerWidth, innerHeight) * 0.16) continue
        if (!best || pixelDistance > best.pixelDistance) best = { first, second, angularDistance, pixelDistance }
      }
    }
    if (!best) throw new Error(`Could not find two separated, hit-testable points on ${orbitId}; visible candidates=${candidates.length}`)
    return {
      orbitId,
      ellipse: { center: { x: cx, y: cy }, radii: { horizontal: rx, vertical: ry }, rotationDegrees, transform },
      first: best.first,
      second: best.second,
      angularDistance: best.angularDistance,
      pixelDistance: best.pixelDistance,
      candidateCount: candidates.length,
      contentTransform: content.getAttribute('transform'),
    }
  }, orbitId)
}

async function clickOrbitTarget(page, target) {
  await page.mouse.click(target.client.x, target.client.y)
}

async function tapOrbitTarget(page, target) {
  await page.touchscreen.tap(target.client.x, target.client.y)
}

async function addedObjectPosition(page, oldIds, beforeCount) {
  await page.waitForFunction(count => document.querySelectorAll('.system-map-svg .system-object').length === count + 1, beforeCount)
  const object = await page.locator('.system-map-svg .system-object').evaluateAll(elements => elements.map(element => ({
    id: element.getAttribute('data-object-id'),
    transform: element.getAttribute('transform'),
    label: element.getAttribute('aria-label'),
  }))).then(objects => objects.find(candidate => !oldIds.has(candidate.id)))
  assert.ok(object, 'Exactly one newly added object is visible')
  return { ...object, point: parseTranslate(object.transform) }
}

async function captureCommandRow(page) {
  const row = await commandRowGeometry(page)
  for (const name of ['hierarchy', 'inspect', 'mapFiles']) {
    assert.ok(row.targets[name]?.visible, `Hierarchy, Inspect, and Map files are visible in the map command row (${name})`)
  }
  const rects = Object.values(row.targets)
  const sameRow = Math.max(...rects.map(box => box.y)) - Math.min(...rects.map(box => box.y)) < 36
  assert.ok(sameRow, `Hierarchy, Inspect, and Map files share the HUD row: ${JSON.stringify(row)}`)
  for (const [name, box] of Object.entries(row.targets)) {
    assert.ok(box?.insideViewport && box.hitTestable, `${name} is visible and hit-testable in the viewport: ${JSON.stringify(box)}`)
  }
  return row
}

async function addStatusGeometry(page) {
  return page.evaluate(() => {
    const status = document.querySelector('.b-add-status')
    if (!status) return null
    const read = element => {
      const box = element.getBoundingClientRect()
      const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
      const hit = document.elementFromPoint(center.x, center.y)
      return { x: box.x, y: box.y, right: box.right, bottom: box.bottom, width: box.width, height: box.height, insideViewport: box.x >= 0 && box.y >= 0 && box.right <= innerWidth && box.bottom <= innerHeight, hitTestable: Boolean(hit && (hit === element || element.contains(hit))) }
    }
    const buttons = [...status.querySelectorAll('button')]
    return {
      status: read(status),
      buttons: Object.fromEntries(buttons.map(button => [button.getAttribute('aria-label') ?? button.textContent?.trim() ?? 'button', read(button)])),
    }
  })
}

await mkdir(outputDir, { recursive: true })
const sources = await sourceSnapshot()
const browser = await chromium.launch({ headless: true, executablePath: chromePath })
const results = []

try {
  for (const viewport of viewportSpecs) {
    const isMobile = viewport.width <= 760 || viewport.height <= 600
    const context = await browser.newContext({ viewport, isMobile, hasTouch: isMobile, deviceScaleFactor: 1 })
    const page = await context.newPage()
    page.setDefaultTimeout(10000)
    const pageErrors = []
    page.on('pageerror', error => pageErrors.push(error.message))
    await page.goto(`${baseUrl}?variant=B${redOnly ? '&controls=dock' : ''}`, { waitUntil: 'domcontentloaded' })
    await page.locator('.proto-b .cluster-map-svg').waitFor({ state: 'visible' })

    const defaultLayout = await page.locator('.proto-b').getAttribute('data-controls')
    if (!redOnly) {
      const trigger = page.getByRole('button', { name: 'Choose an item to add to the map' })
      await trigger.click()
      await page.locator('.b-create-content button, .b-create-menu button').filter({ hasText: 'Add star system' }).click()
      assert.match(await page.locator('.b-add-status').innerText(), /Add Star system/i, 'The chooser action arms Add star system')
      await trigger.click()
      await page.locator('.b-create-content').waitFor({ state: 'visible' })
      await trigger.click()
      await page.locator('.b-create-content').waitFor({ state: 'hidden' })
      assert.ok(await page.locator('.proto-b').evaluate(element => element.classList.contains('has-active-add')), 'Trigger dismissal leaves Add armed')
      assert.match(await page.locator('.b-add-status').innerText(), /Add Star system/i, 'Trigger dismissal preserves the selected action')
      await trigger.click()
      await page.locator('.b-create-content button, .b-create-menu button').filter({ hasText: 'Add Jump Route' }).click()
      assert.match(await page.locator('.b-add-status').innerText(), /Add Jump Route/i, 'The chooser action arms Add Jump Route')
      await page.keyboard.press('Escape')
    }
    const systemNode = page.locator('.cluster-map-svg .cluster-system-node').first()
    await systemNode.click()
    await page.locator('.system-map-svg').waitFor({ state: 'visible' })
    await page.getByRole('button', { name: 'Fit map' }).click()
    await page.waitForTimeout(90)
    const commandRow = redOnly ? null : await captureCommandRow(page)

    if (!redOnly) {
      await page.getByRole('button', { name: 'Choose an item to add to the map' }).click()
      await page.locator('.b-create-content button').filter({ hasText: 'Add Orbit' }).click()
      assert.match(await page.locator('.b-add-status').innerText(), /Add Orbit/i, 'The chooser action arms Add Orbit')
      await page.keyboard.press('Escape')
    }

    const { trigger, actionMenuRect } = await openPicker(page)
    const picker = await page.locator('.b-catalogue-panel').boundingBox()
    const beforeSelectGeometry = { trigger: rect(await trigger.boundingBox()), actionMenu: actionMenuRect ? rect(actionMenuRect) : null, picker: picker ? rect(picker) : null }
    const pickerAnchor = await pickerGeometry(page)
    await page.screenshot({ path: path.join(outputDir, `dock-picker-${viewport.width}x${viewport.height}.png`) })
    await pickMoon(page)

    if (!redOnly) {
      await page.getByRole('button', { name: 'Change the selected map mark type' }).click()
      await page.locator('.b-catalogue-panel').waitFor({ state: 'visible' })
      await page.keyboard.press('Escape')
      await page.locator('.b-catalogue-panel').waitFor({ state: 'hidden' })
      assert.ok(await page.locator('.proto-b').evaluate(element => element.classList.contains('has-active-add')), 'Escape dismisses the chooser and leaves Add armed')
      assert.match(await page.locator('.b-add-status').innerText(), /Add Moon/i, 'Escape dismissal preserves the selected object type')
      await page.keyboard.press('Escape')
      await page.waitForFunction(() => !document.querySelector('.proto-b')?.classList.contains('has-active-add'))
      await openPicker(page)
      await pickMoon(page)
      assert.ok(await page.locator('.proto-b').evaluate(element => element.classList.contains('has-active-add')), 'Add can be armed again after Escape exits it')
    }

    // Fit then zoom the real SVG view. The seed Orbit is rotated and has a normalized free center.
    await page.getByRole('button', { name: 'Fit map' }).click()
    await page.getByRole('button', { name: 'Zoom in' }).click()
    await page.getByRole('button', { name: 'Zoom in' }).click()
    const objectCountBefore = await page.locator('.system-map-svg .system-object').count()
    const orbitId = 'orbit-vela-three'
    const targets = await orbitTargetPair(page, orbitId)
    const existingIds = new Set(await page.locator('.system-map-svg .system-object').evaluateAll(elements => elements.map(element => element.getAttribute('data-object-id'))))
    const placementResults = []

    if (redOnly) {
      await clickOrbitTarget(page, targets.first)
      const first = await addedObjectPosition(page, existingIds, objectCountBefore)
      const afterFirstIds = new Set([...existingIds, first.id])
      await clickOrbitTarget(page, targets.second)
      const second = await addedObjectPosition(page, afterFirstIds, objectCountBefore + 1)
      placementResults.push({ target: targets.first, object: first, error: distance(first.point, targets.first.scene) })
      placementResults.push({ target: targets.second, object: second, error: distance(second.point, targets.second.scene) })
    } else {
      await page.getByRole('button', { name: 'Change the selected map mark type' }).click()
      await page.locator('.b-catalogue-panel').waitFor({ state: 'visible' })
      // The anchored chooser can cover part of the Orbit after opening. Pick a
      // hit-tested dismissal point from the live overlay state, not stale map
      // geometry captured before the chooser was visible.
      const dismissalTargets = await orbitTargetPair(page, orbitId)
      if (isMobile) await tapOrbitTarget(page, dismissalTargets.first)
      else await clickOrbitTarget(page, dismissalTargets.first)
      await page.locator('.b-catalogue-panel').waitFor({ state: 'hidden' })
      assert.equal(await page.locator('.system-map-svg .system-object').count(), objectCountBefore, 'The outside map click dismisses the chooser without placing an object')
      assert.ok(await page.locator('.proto-b').evaluate(element => element.classList.contains('has-active-add')), 'Outside dismissal keeps Add armed')
      assert.match(await page.locator('.b-add-status').innerText(), /Add Moon/i, 'Outside dismissal keeps the chosen type')

      const placementTargets = await orbitTargetPair(page, orbitId)
      await clickOrbitTarget(page, placementTargets.second)
      const first = await addedObjectPosition(page, existingIds, objectCountBefore)
      placementResults.push({ target: placementTargets.second, object: first, error: distance(first.point, placementTargets.second.scene) })
      const idsAfterFirst = new Set([...existingIds, first.id])
      const currentTargets = await orbitTargetPair(page, orbitId)
      await clickOrbitTarget(page, currentTargets.first)
      const second = await addedObjectPosition(page, idsAfterFirst, objectCountBefore + 1)
      placementResults.push({ target: currentTargets.first, object: second, error: distance(second.point, currentTargets.first.scene) })

      // A hosted Orbit verifies the center is resolved from its host object under the same zoomed view.
      const hostedId = 'orbit-vela-one'
      const hostedTargets = await orbitTargetPair(page, hostedId)
      const hostedBefore = await page.locator('.system-map-svg .system-object').count()
      const beforeHostedIds = new Set(await page.locator('.system-map-svg .system-object').evaluateAll(elements => elements.map(element => element.getAttribute('data-object-id'))))
      await clickOrbitTarget(page, hostedTargets.first)
      const hostedFirst = await addedObjectPosition(page, beforeHostedIds, hostedBefore)
      const afterHostedFirst = new Set([...beforeHostedIds, hostedFirst.id])
      const currentHostedTargets = await orbitTargetPair(page, hostedId)
      await clickOrbitTarget(page, currentHostedTargets.second)
      const hostedSecond = await addedObjectPosition(page, afterHostedFirst, hostedBefore + 1)
      placementResults.push({ target: hostedTargets.first, object: hostedFirst, error: distance(hostedFirst.point, hostedTargets.first.scene) })
      placementResults.push({ target: currentHostedTargets.second, object: hostedSecond, error: distance(hostedSecond.point, currentHostedTargets.second.scene) })
    }

    const firstTwoPositions = placementResults.slice(0, 2).map(result => result.object.point)
    const commandRowWithAdd = redOnly ? null : await captureCommandRow(page)
    const report = {
      viewport: { ...viewport, isMobile, hasTouch: isMobile, deviceScaleFactor: 1 },
      defaultLayout,
      commandRow,
      commandRowWithAdd,
      picker: { geometry: beforeSelectGeometry, anchor: pickerAnchor },
      orbit: targets,
      objectCountBefore,
      placements: placementResults,
      distinctPositions: distance(firstTwoPositions[0], firstTwoPositions[1]) > 20,
      positionsMatchTargets: placementResults.every(result => result.error < 1.5),
      addRemainsActive: await page.locator('.proto-b').evaluate(element => element.classList.contains('has-active-add')),
      addStatus: await addStatusGeometry(page),
      inspectorOpened: await page.locator('.b-inspector-float').isVisible(),
      pageErrors,
    }
    await page.screenshot({ path: path.join(outputDir, `dock-feedback-${viewport.width}x${viewport.height}.png`) })
    results.push(report)
    await writeFile(path.join(outputDir, `run-${viewport.width}x${viewport.height}.json`), JSON.stringify(report, null, 2))

    if (!redOnly) {
      assert.equal(defaultLayout, 'dock', 'The preferred Dock layout is the default for variant B')
      assert.ok(pickerAnchor?.anchored, `Catalogue picker is anchored beside the Add trigger: ${JSON.stringify(pickerAnchor)}`)
      assert.ok(report.distinctPositions, `Two placements on ${orbitId} use distinct points: ${JSON.stringify(firstTwoPositions)}`)
      assert.ok(report.positionsMatchTargets, `Every Orbit placement matches its click target within 1.5 scene units: ${JSON.stringify(placementResults)}`)
      assert.ok(report.addRemainsActive, 'Successful Add placements leave the chosen type active')
      assert.ok(report.addStatus?.status?.insideViewport, `The Add status is inside the viewport: ${JSON.stringify(report.addStatus)}`)
      for (const label of ['Change the selected map mark type', 'Quit Add and return to Navigate']) {
        assert.ok(report.addStatus?.buttons[label]?.hitTestable, `${label} remains hit-testable: ${JSON.stringify(report.addStatus)}`)
        assert.ok(report.addStatus?.buttons[label]?.insideViewport, `${label} remains inside the viewport: ${JSON.stringify(report.addStatus)}`)
      }
      assert.ok(commandRowWithAdd, `Hierarchy, Inspect, and Map files remain visible and hit-testable with Add armed: ${JSON.stringify(commandRowWithAdd)}`)
      assert.equal(report.inspectorOpened, false, 'Add placement does not open Inspect')
      assert.deepEqual(pageErrors, [], 'No uncaught browser errors')
    }

    await context.close()
  }

  let groupsReference = null
  if (!redOnly) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
    const page = await context.newPage()
    page.setDefaultTimeout(10000)
    const pageErrors = []
    page.on('pageerror', error => pageErrors.push(error.message))
    await page.goto(`${baseUrl}?variant=B&controls=groups`, { waitUntil: 'domcontentloaded' })
    await page.locator('.proto-b .cluster-map-svg').waitFor({ state: 'visible' })
    const layout = await page.locator('.proto-b').getAttribute('data-controls')
    await page.locator('.cluster-map-svg .cluster-system-node').first().click()
    await page.locator('.system-map-svg').waitFor({ state: 'visible' })
    const commandRow = await captureCommandRow(page)
    const { trigger } = await openPicker(page)
    const pickerAnchor = await pickerGeometry(page)
    await page.screenshot({ path: path.join(outputDir, 'dock-groups-reference-1440x900.png') })
    await page.keyboard.press('Escape')
    assert.equal(layout, 'groups', 'The query-selectable Groups reference remains available')
    assert.ok(pickerAnchor?.anchored, `The Groups Add trigger also anchors its chooser: ${JSON.stringify(pickerAnchor)}`)
    assert.deepEqual(pageErrors, [], 'The Groups reference has no uncaught browser errors')
    groupsReference = { layout, commandRow, trigger: rect(await trigger.boundingBox()), pickerAnchor, pageErrors }
    await context.close()
  }

  const finalReport = {
    baseUrl,
    buildRoot,
    buildLabel: process.env.PREVIEW_BUILD_LABEL ?? 'Unspecified local production build',
    browser: `Chrome ${browser.version()} via Playwright`,
    node: process.version,
    input: 'Fresh browser contexts; DOM-derived visible SVG Orbit targets; page.mouse clicks on desktop and Playwright touchscreen taps for outside dismissal on compact viewports; no injected app mutations.',
    note: 'Viewport emulation only; mobile hasTouch/isMobile flags are enabled at the two compact viewports. No physical device claim.',
    sources,
    results,
    groupsReference,
  }
  await writeFile(path.join(outputDir, 'qa-report.json'), JSON.stringify(finalReport, null, 2))
  console.log(JSON.stringify({ outputDir, mode: redOnly ? 'baseline-red-repro' : 'acceptance', browser: finalReport.browser, results: results.map(result => ({ viewport: result.viewport, defaultLayout: result.defaultLayout, distinctPositions: result.distinctPositions, positionsMatchTargets: result.positionsMatchTargets, pickerAnchored: result.picker.anchor?.anchored ?? null, placements: result.placements.map(placement => ({ id: placement.object.id, point: placement.object.point, target: placement.target.scene, error: placement.error })), pageErrors: result.pageErrors })), groupsReference }, null, 2))

  if (redOnly) {
    assert.ok(results.length > 0, 'Captured at least one baseline viewport')
    const baseline = results[0]
    assert.ok(baseline.distinctPositions && baseline.positionsMatchTargets, `Baseline placement behavior should fail: distinct=${baseline.distinctPositions}; targetMatches=${baseline.positionsMatchTargets}`)
  }
} finally {
  await browser.close()
}
