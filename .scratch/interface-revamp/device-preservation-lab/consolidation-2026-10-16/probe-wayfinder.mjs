import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '../../../..')
const outputPath = path.join(scriptDir, 'probe-results.json')
const screenshotPath = path.join(scriptDir, 'baseline-cluster-pan-wheel.png')
const fixturePath = path.join(scriptDir, '../inspector-form-2026-10-16/applied-dense.json')
const baseUrl = 'http://127.0.0.1:3144/?variant=baseline'
const hashFile = async file => createHash('sha256').update(await fs.readFile(file)).digest('hex').toUpperCase()

const result = {
  probe: 'task-10 retained-baseline unobstructed SVG pan and wheel',
  startedAt: new Date().toISOString(),
  route: baseUrl,
  provenance: {
    applicationCommit: 'be8bef3e9efaea76b986480a40de6bd260e59d18',
    routeMeaning: 'Retained baseline application route inside the current PR production build; not a pristine origin/main build or a performance-comparison arm.',
    localServer: { port: 3144, listenerPid: 2888, commandLine: '"C:\\nodejs\\node.exe" .output/server/index.mjs' },
    fixture: { path: path.relative(repoRoot, fixturePath).replaceAll('\\', '/'), sha256: null, note: 'Validated applied-dense JSON export seeded only into this fresh ephemeral browser context. It changes the scene and is not a baseline-equivalent dataset.' },
    sourceSha256: {},
  },
  browser: null,
  case: { status: 'running', maps: {} },
  limits: [
    'No timing or performance claim; this only verifies that a visible unobstructed SVG target accepts pan and wheel zoom and changes its scene transform.',
    'The dense fixture is changed data seeded in an isolated Playwright context; it does not establish baseline visual or performance equivalence.',
    'The retained baseline route shares the current PR production build and does not fill the historical pristine-main baseline gesture gap.',
    'No physical touch, keyboard, or device acceptance is claimed.',
  ],
}

const browser = await chromium.launch({ channel: 'chrome', headless: true })
let page
try {
  const sourceFiles = [
    'pages/index.vue',
    'components/BaselinePage.vue',
    'components/ClusterMap.vue',
    'components/SystemMap.vue',
    'components/maps/system-map-renderer.ts',
  ]
  for (const relativePath of sourceFiles) {
    result.provenance.sourceSha256[relativePath] = await hashFile(path.join(repoRoot, relativePath))
  }

  const fixtureText = await fs.readFile(fixturePath, 'utf8')
  const exported = JSON.parse(fixtureText)
  result.provenance.fixture.sha256 = createHash('sha256').update(fixtureText).digest('hex').toUpperCase()

  await import(pathToFileURL(path.join(scriptDir, '../../measurement-lab/resolve-ts-imports.mjs')).href)
  const { restoreLocalWorkspace } = await import(pathToFileURL(path.join(repoRoot, 'domain/workspace.ts')).href)
  const validated = restoreLocalWorkspace({
    id: 'task-10-wayfinder-ephemeral',
    cluster: exported.cluster,
    objectFieldSettings: exported.objectFieldSettings,
    layout: {
      systemPositions: exported.layout.systemPositions,
      orbitRadii: exported.layout.orbitRadii,
      orbitRotations: exported.layout.orbitRotations ?? {},
      objectAngles: exported.layout.objectAngles ?? {},
    },
  })
  if (!validated) throw new Error('The selected dense JSON could not be restored as a valid LocalWorkspace.')

  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } })
  page = await context.newPage()
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('load')
  await page.evaluate(async workspace => {
    const request = indexedDB.open('ttrpg-cluster-control', 1)
    const db = await new Promise((resolve, reject) => {
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('workspace')) request.result.createObjectStore('workspace')
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    await new Promise((resolve, reject) => {
      const tx = db.transaction('workspace', 'readwrite')
      tx.objectStore('workspace').put(workspace, 'current')
      tx.objectStore('workspace').put(workspace, 'last-valid')
      tx.oncomplete = resolve
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
    db.close()
  }, validated)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.locator('svg.cluster-map-svg:visible, svg.system-map-svg:visible').first().waitFor({ state: 'visible', timeout: 30_000 })
  result.browser = { name: 'Chrome', version: browser.version(), viewport: { width: 1440, height: 960 }, context: 'fresh ephemeral, non-persistent Playwright context' }

  async function chooseBlankHit(selector) {
    const svg = page.locator(selector)
    const box = await svg.boundingBox()
    if (!box) throw new Error(`SVG has no visible bounding box: ${selector}`)
    return await page.evaluate(({ selector, box }) => {
      const svg = document.querySelector(selector)
      if (!(svg instanceof SVGElement)) return null
      const interactive = '.cluster-system-node,.cluster-route,.system-object,.orbit-mark,.orbit-hit-target,.orbit-axis-handle,.orbit-center-handle,.orbit-rotation-handle,button,[role="button"],a'
      const fractions = [0.18, 0.28, 0.4, 0.52, 0.64, 0.76, 0.86]
      for (const fy of fractions) for (const fx of fractions) {
        const x = box.x + box.width * fx
        const y = box.y + box.height * fy
        const target = document.elementFromPoint(x, y)
        if (!target || !svg.contains(target) || target.closest(interactive)) continue
        return {
          x, y,
          hitTag: target.tagName.toLowerCase(),
          hitClass: typeof target.className === 'string' ? target.className : target.getAttribute('class'),
          svgLabel: svg.getAttribute('aria-label'),
          svgRect: { x: box.x, y: box.y, width: box.width, height: box.height },
        }
      }
      return null
    }, { selector, box })
  }

  async function verifyMap(kind, svgSelector, sceneSelector) {
    const hit = await chooseBlankHit(svgSelector)
    if (!hit) throw new Error(`${kind}: no unobstructed SVG hit target found.`)
    const scene = page.locator(sceneSelector)
    const transformBefore = await scene.getAttribute('transform')
    if (!transformBefore) throw new Error(`${kind}: scene transform was missing before pan.`)
    await page.mouse.move(hit.x, hit.y)
    await page.mouse.down()
    await page.mouse.move(hit.x + 56, hit.y + 37, { steps: 5 })
    await page.mouse.up()
    await page.waitForFunction(({ selector, oldValue }) => document.querySelector(selector)?.getAttribute('transform') !== oldValue, { selector: sceneSelector, oldValue: transformBefore }, { timeout: 5_000 })
    const afterPan = await scene.getAttribute('transform')
    if (!afterPan || afterPan === transformBefore) throw new Error(`${kind}: visible drag did not change the scene transform.`)

    await page.mouse.move(hit.x, hit.y)
    await page.mouse.wheel(0, -140)
    await page.waitForFunction(({ selector, oldValue }) => document.querySelector(selector)?.getAttribute('transform') !== oldValue, { selector: sceneSelector, oldValue: afterPan }, { timeout: 5_000 })
    const afterWheel = await scene.getAttribute('transform')
    if (!afterWheel || afterWheel === afterPan) throw new Error(`${kind}: wheel input did not change the scene transform.`)
    return { hit, transformBefore, transformAfterPan: afterPan, transformAfterWheel: afterWheel }
  }

  const startsInSystem = await page.locator('svg.system-map-svg').isVisible()
  result.case.entryMap = startsInSystem ? 'system' : 'cluster'
  if (startsInSystem) {
    await page.getByText('Aster Applied QA Name', { exact: true }).waitFor({ state: 'visible', timeout: 10_000 })
    result.case.maps.system = await verifyMap('system', 'svg.system-map-svg', '.system-map-content')
    await page.getByRole('button', { name: 'Cluster map' }).click({ timeout: 10_000 })
    await page.locator('svg.cluster-map-svg').waitFor({ state: 'visible', timeout: 10_000 })
    result.case.mapNavigation = 'Vela system map → visible Cluster map button in the hierarchy'
    result.case.maps.cluster = await verifyMap('cluster', 'svg.cluster-map-svg', '.cluster-map-content')
  } else {
    await page.locator('svg.cluster-map-svg').waitFor({ state: 'visible', timeout: 10_000 })
    result.case.maps.cluster = await verifyMap('cluster', 'svg.cluster-map-svg', '.cluster-map-content')
    await page.screenshot({ path: screenshotPath, fullPage: true })
    await page.locator('.cluster-system-node[data-system-id="sys-vela"]').click({ timeout: 10_000 })
    await page.locator('svg.system-map-svg').waitFor({ state: 'visible', timeout: 10_000 })
    await page.getByText('Aster Applied QA Name', { exact: true }).waitFor({ state: 'visible', timeout: 10_000 })
    result.case.mapNavigation = 'Cluster map → visible Vela Reach system node'
    result.case.maps.system = await verifyMap('system', 'svg.system-map-svg', '.system-map-content')
  }
  await page.screenshot({ path: screenshotPath, fullPage: true })
  result.case.status = 'passed'
  result.case.note = 'Cluster and Vela system both exposed an unobstructed, hit-tested SVG point; visible mouse drag and wheel inputs changed each scene transform.'
  await context.close()
} catch (error) {
  result.case.status = 'failed'
  result.case.error = String(error?.stack || error)
  if (page) {
    try { await page.screenshot({ path: screenshotPath, fullPage: true }) } catch { /* retain original failure */ }
  }
} finally {
  result.finishedAt = new Date().toISOString()
  await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`)
  await browser.close()
}

console.log(JSON.stringify({ status: result.case.status, results: outputPath, screenshot: screenshotPath, maps: Object.keys(result.case.maps) }, null, 2))
if (result.case.status !== 'passed') process.exitCode = 1
