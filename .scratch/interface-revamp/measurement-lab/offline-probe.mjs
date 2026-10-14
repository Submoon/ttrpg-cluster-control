import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const lab = dirname(fileURLToPath(import.meta.url))
const artifacts = join(lab, 'artifacts')
const denyHook = join(lab, 'deny-egress.mjs')
const fixture = JSON.parse(readFileSync(join(lab, 'fixture.json'), 'utf8'))
const originalFixturePath = join(lab, 'fixture-original.json')
const originalFixture = existsSync(originalFixturePath) ? JSON.parse(readFileSync(originalFixturePath, 'utf8')) : fixture
const baselineFixturePath = join(lab, 'fixture-baseline.json')
const baselineFixture = existsSync(baselineFixturePath) ? JSON.parse(readFileSync(baselineFixturePath, 'utf8')) : fixture
const baselineCommit = '629d2a98715c3a16b954e0f77c639b1f0c31212c'
const candidateCommit = '7ea41e0a9b0e585e23812eb9165e95420d72dc89'
const args = new Map(process.argv.slice(2).map((arg, index, all) => arg.startsWith('--') ? [arg.slice(2), all[index + 1] && !all[index + 1].startsWith('--') ? all[index + 1] : 'true'] : null).filter(Boolean))
const modeArg = args.get('mode') ?? 'cold'
const targetArg = args.get('target') ?? 'both'
const targets = targetArg === 'both' ? ['baseline', 'b'] : [targetArg]
if (!['cold', 'warm'].includes(modeArg)) throw new Error('Use --mode cold or --mode warm.')
if (targets.some(target => !['baseline', 'b'].includes(target))) throw new Error('Use --target baseline, b, or both.')
if (modeArg === 'warm' && targets.includes('baseline')) throw new Error('Warm icon-cache mode applies to candidate B; use --target b.')

const projectDirs = {
  baseline: join(lab, 'source-baseline'),
  b: join(lab, 'source-b'),
}

mkdirSync(artifacts, { recursive: true })

const playwrightEntry = join(projectDirs.b, 'node_modules', '@playwright', 'test', 'index.mjs')
const playwright = await import(pathToFileURL(playwrightEntry).href)
const { chromium } = playwright
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const runMetadata = {
  startedAt: new Date().toISOString(),
  node: process.version,
  browser: browser.version(),
  playwright: JSON.parse(readFileSync(join(projectDirs.b, 'node_modules', '@playwright', 'test', 'package.json'), 'utf8')).version,
  baselineCommit,
  candidateCommit,
  fixtures: {
    candidateOriginal: { path: existsSync(originalFixturePath) ? 'fixture-original.json' : 'fixture.json', sha256: createHash('sha256').update(readFileSync(existsSync(originalFixturePath) ? originalFixturePath : join(lab, 'fixture.json'))).digest('hex'), systems: originalFixture.cluster.systems.length, routes: originalFixture.cluster.routes.length, objects: originalFixture.cluster.systems.reduce((sum, system) => sum + system.objects.length, 0), orbits: originalFixture.cluster.systems.reduce((sum, system) => sum + system.orbits.length, 0) },
    baselineSeed: { path: existsSync(baselineFixturePath) ? 'fixture-baseline.json' : 'fixture.json', sha256: createHash('sha256').update(readFileSync(existsSync(baselineFixturePath) ? baselineFixturePath : join(lab, 'fixture.json'))).digest('hex'), systems: baselineFixture.cluster.systems.length, routes: baselineFixture.cluster.routes.length, objects: baselineFixture.cluster.systems.reduce((sum, system) => sum + system.objects.length, 0), orbits: baselineFixture.cluster.systems.reduce((sum, system) => sum + system.orbits.length, 0) },
  },
  host: `${process.platform} ${process.arch}`,
  screen: '1280x900 initial browser viewport; browser was headless and context deviceScaleFactor=1',
}

function isLoopbackUrl(raw) {
  try { return ['localhost', '127.0.0.1', '::1'].includes(new URL(raw).hostname.toLowerCase()) } catch { return false }
}

function isHttpUrl(raw) {
  try { return ['http:', 'https:'].includes(new URL(raw).protocol) } catch { return false }
}

async function waitForReady(url, server, logFile) {
  const started = Date.now()
  let lastError
  while (Date.now() - started < 45000) {
    if (server.exitCode !== null) throw new Error(`Server exited with code ${server.exitCode}; see ${logFile}`)
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1500) })
      if (response.ok) return
      lastError = new Error(`Readiness request returned ${response.status}`)
    } catch (error) { lastError = error }
    await new Promise(resolve => setTimeout(resolve, 300))
  }
  throw new Error(`Server did not become ready at ${url}: ${lastError}`)
}

async function openWorkspace(page, url, target, storageFixture) {
  if (target === 'b') {
    // Candidate B owns a memory-only seedWorkspace() copied from the same fixture.
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => document.body.innerText.includes('The Outer Reach') || document.body.innerText.includes('Outer Reach'), null, { timeout: 15000 })
    await page.waitForTimeout(900)
    return
  }

  // The baseline's local-first workspace is seeded at its real IndexedDB boundary.
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.evaluate(async workspace => {
    const open = indexedDB.open('ttrpg-cluster-control', 1)
    open.onupgradeneeded = () => open.result.createObjectStore('workspace')
    const database = await new Promise((resolve, reject) => {
      open.onsuccess = () => resolve(open.result)
      open.onerror = () => reject(open.error)
    })
    await new Promise((resolve, reject) => {
      const transaction = database.transaction('workspace', 'readwrite')
      transaction.objectStore('workspace').put(workspace, 'current')
      transaction.objectStore('workspace').put(workspace, 'last-valid')
      transaction.oncomplete = resolve
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
    database.close()
  }, storageFixture)
  const dest = new URL(url)
  await page.goto(dest.toString(), { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => document.body.innerText.includes('The Outer Reach') || document.body.innerText.includes('Outer Reach'), null, { timeout: 15000 })
  await page.waitForTimeout(900)
}

async function renderedState(page) {
  return await page.evaluate(() => {
    const iconNodes = [...document.querySelectorAll('[class*="i-lucide"], [data-icon], .iconify')]
    const icons = iconNodes.map(element => {
      const style = getComputedStyle(element)
      return { tag: element.tagName.toLowerCase(), className: typeof element.className === 'string' ? element.className : element.getAttribute('class'), text: (element.textContent || '').trim().slice(0, 40), maskImage: style.maskImage || style.webkitMaskImage, backgroundImage: style.backgroundImage, width: style.width, height: style.height }
    })
    const sample = selector => {
      const element = document.querySelector(selector)
      if (!element) return null
      const style = getComputedStyle(element)
      return { selector, fontFamily: style.fontFamily, color: style.color, backgroundColor: style.backgroundColor }
    }
    return {
      title: document.title,
      readyState: document.readyState,
      bodyText: document.body.innerText.slice(0, 8000),
      mapSvgs: document.querySelectorAll('.map-frame svg, .b-map-frame svg').length,
      iconNodes: icons,
      documentFonts: document.fonts.status,
      bodyStyle: sample('body'),
      headingStyle: sample('h1, h2'),
    }
  })
}

async function exerciseB(page, result, phase) {
  result.scenarios ??= []
  const recordScenario = async (name, action) => {
    result.currentPhase = phase
    const scenario = { name, phase, startedAt: new Date().toISOString() }
    try { scenario.result = await action(); scenario.ok = true }
    catch (error) { scenario.ok = false; scenario.error = String(error?.stack ?? error) }
    scenario.endedAt = new Date().toISOString()
    scenario.ui = await renderedState(page)
    result.scenarios.push(scenario)
  }

  await recordScenario('open seeded system and object inspector', async () => {
    await page.getByRole('button', { name: 'Hierarchy' }).click()
    const hierarchy = page.locator('.b-hierarchy-panel')
    await hierarchy.locator('.hierarchy-system-row').filter({ hasText: 'Vela Reach' }).click()
    await page.waitForFunction(() => document.querySelector('.b-map-hud')?.innerText.includes('Vela Reach'))
    // Navigating into a system intentionally closes the hierarchy. Reopen it,
    // then select the seeded planet so Atmosphere and custom-field USelects exist.
    await page.getByRole('button', { name: 'Hierarchy' }).click()
    await hierarchy.waitFor({ state: 'visible' })
    await hierarchy.locator('.hierarchy-entity-row[aria-label="Select PL-1, Aster"]').click()
    await page.locator('.b-inspector-float .inspector-card').waitFor({ state: 'visible' })
    return { selectedSystem: await page.locator('.b-map-hud').innerText(), inspector: await page.locator('.b-inspector-float .inspector-card h2').innerText() }
  })

  await recordScenario('open fresh catalogue panel and local glyphs', async () => {
    await page.getByRole('button', { name: 'Add mark' }).click()
    const panel = page.locator('.b-catalogue-panel')
    await panel.waitFor({ state: 'visible' })
    const categories = await panel.locator('.b-catalogue-family-list button').allTextContents()
    const types = await panel.locator('.b-catalogue-types button').evaluateAll(buttons => buttons.map(button => ({ label: button.innerText.trim(), glyph: button.querySelector('.b-catalogue-glyph')?.textContent?.trim() ?? '' })))
    const state = await renderedState(page)
    await page.screenshot({ path: join(artifacts, `offline-${result.target}-${result.mode}-${phase}-catalogue-menu.png`), fullPage: false })
    await panel.getByRole('button', { name: 'Close object catalogue' }).click()
    return { categories: categories.map(text => text.trim()), visibleTypes: types, localGlyphCount: types.filter(item => item.glyph).length, iconNodes: state.iconNodes }
  })

  await recordScenario('open inspector Atmosphere USelect', async () => {
    const control = page.getByRole('combobox', { name: 'Atmosphere' })
    await control.click()
    await page.waitForTimeout(350)
    const options = await page.getByRole('option').allTextContents()
    const state = await renderedState(page)
    await page.screenshot({ path: join(artifacts, `offline-${result.target}-${result.mode}-${phase}-atmosphere-menu.png`), fullPage: false })
    await page.keyboard.press('Escape')
    return { role: await control.getAttribute('role'), options, iconNodes: state.iconNodes }
  })

  await recordScenario('open inspector Signal strength USelect', async () => {
    const control = page.getByRole('combobox', { name: 'Signal strength' })
    await control.click()
    await page.waitForTimeout(350)
    const options = await page.getByRole('option').allTextContents()
    const selectedOption = await page.getByRole('option', { selected: true }).allTextContents().catch(() => [])
    const state = await renderedState(page)
    await page.screenshot({ path: join(artifacts, `offline-${result.target}-${result.mode}-${phase}-signal-menu.png`), fullPage: false })
    await page.keyboard.press('Escape')
    return { role: await control.getAttribute('role'), options, selectedOption, iconNodes: state.iconNodes }
  })

  await recordScenario('open fresh map deletion UModal', async () => {
    await page.getByRole('button', { name: /Delete mark/ }).click()
    const dialog = page.getByRole('dialog', { name: 'Confirm map deletion' })
    await dialog.waitFor({ state: 'visible' })
    await page.waitForTimeout(400)
    const close = dialog.getByRole('button', { name: /close/i })
    const closeCount = await close.count()
    const state = await renderedState(page)
    await page.screenshot({ path: join(artifacts, `offline-${result.target}-${result.mode}-${phase}-modal.png`), fullPage: false })
    return { dialogHeadings: await dialog.getByRole('heading', { level: 2 }).allTextContents(), closeButtonCount: closeCount, closeButtonHtml: closeCount ? await close.first().evaluate(element => element.outerHTML) : null, iconNodes: state.iconNodes }
  })
}

async function exerciseBaseline(page, result) {
  result.scenarios = []
  await page.waitForFunction(() => document.querySelector('.baseline-page, .map-workspace-shell, main') !== null)
  result.initialUi = await renderedState(page)
  const available = await page.locator('button').allTextContents()
  result.scenarios.push({ name: 'baseline seeded surface', ok: true, buttons: available.map(text => text.trim()).filter(Boolean).slice(0, 50), ui: result.initialUi })
  await page.screenshot({ path: join(artifacts, `offline-${result.target}-${result.mode}-seeded.png`), fullPage: false })
}

async function runTarget(target) {
  const port = target === 'b' ? 3124 : 3123
  const baseUrl = `http://127.0.0.1:${port}`
  const targetDir = projectDirs[target]
  const targetFixture = target === 'baseline' ? baselineFixture : originalFixture
  const buildDir = target === 'b' && args.has('b-build-dir') ? resolve(args.get('b-build-dir')) : join(targetDir, '.output')
  const serverEntry = join(buildDir, 'server', 'index.mjs')
  const serverBootstrap = `await import(${JSON.stringify(pathToFileURL(denyHook).href)}); await import(${JSON.stringify(pathToFileURL(serverEntry).href)});`
  const commit = target === 'b' ? candidateCommit : baselineCommit
  const egressLog = join(artifacts, `offline-${target}-${modeArg}-egress.jsonl`)
  const controlFile = join(artifacts, `offline-${target}-${modeArg}-egress.control`)
  const serverLogPath = join(artifacts, `offline-${target}-${modeArg}-server.log`)
  const outputPath = join(artifacts, `offline-${target}-${modeArg}.json`)
  writeFileSync(serverLogPath, '')
  writeFileSync(egressLog, '')
  writeFileSync(controlFile, modeArg === 'warm' ? 'allow' : 'deny')
  const output = {
    ...runMetadata,
    target,
    mode: modeArg,
    sourceCommit: commit,
    invocation: process.argv.map(value => value.includes(' ') ? `"${value}"` : value).join(' '),
    seed: target === 'b'
      ? { method: 'the unchanged candidate B seedWorkspace() runtime function in preserved original production output', path: 'source-b/components/PrototypeWorkbench.vue at accepted B commit', fixtureReference: existsSync(originalFixturePath) ? 'fixture-original.json' : 'fixture.json' }
      : { method: 'origin-scoped IndexedDB version 1; workspace store; current and last-valid keys', path: existsSync(baselineFixturePath) ? 'fixture-baseline.json' : 'fixture.json' },
    baselineCompatibilityNormalization: target === 'baseline' && existsSync(baselineFixturePath)
      ? 'fixture-baseline.json normalizes three per-host Orbit order values to 1 so the baseline schema restores the shared sample; objects, names, coordinates, and relationships are retained.'
      : null,
    fixtureCounts: { systems: targetFixture.cluster.systems.length, routes: targetFixture.cluster.routes.length, objects: targetFixture.cluster.systems.reduce((sum, system) => sum + system.objects.length, 0), orbits: targetFixture.cluster.systems.reduce((sum, system) => sum + system.orbits.length, 0) },
    port,
    url: `${baseUrl}${target === 'b' ? '/?variant=B' : '/'}`,
    buildOutputDir: buildDir,
    serverCommand: `node --input-type=module -e '${serverBootstrap}' (cwd ${targetDir}, HOST=127.0.0.1, PORT=${port})`,
    serverEgressLog: egressLog,
    serverLog: serverLogPath,
    warmCacheScope: modeArg === 'warm' ? 'The browser route interceptor keeps loopback available and blocks external requests but disables Chromium HTTP cache; this proves app/server runtime-cache behavior only, not a browser disk-cache offline pass.' : null,
    requests: [],
    browserDenied: [],
    failures: [],
  }
  const server = spawn(process.execPath, ['--input-type=module', '-e', serverBootstrap], {
    cwd: targetDir,
    env: { ...process.env, NODE_ENV: 'production', HOST: '127.0.0.1', HOSTNAME: '127.0.0.1', PORT: String(port), NITRO_HOST: '127.0.0.1', NITRO_PORT: String(port), EGRESS_CONTROL_FILE: controlFile, EGRESS_DENY_LOG: egressLog },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  server.stdout.on('data', chunk => appendFileSync(serverLogPath, `[stdout] ${chunk}`))
  server.stderr.on('data', chunk => appendFileSync(serverLogPath, `[stderr] ${chunk}`))

  let context
  try {
    if (!existsSync(serverEntry)) throw new Error(`Missing production server entry ${serverEntry}`)
    await waitForReady(baseUrl, server, serverLogPath)
    context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 })
    let blockExternal = modeArg === 'cold'
    await context.route('**/*', async route => {
      const requestUrl = route.request().url()
      if (!isHttpUrl(requestUrl) || isLoopbackUrl(requestUrl) || !blockExternal) return route.continue()
      output.browserDenied.push({ phase: output.currentPhase ?? 'setup', url: requestUrl, method: route.request().method(), resourceType: route.request().resourceType(), result: 'blocked-by-page-route' })
      return route.abort('internetdisconnected')
    })
    const page = await context.newPage()
    page.setDefaultTimeout(6000)
    const requestRecords = new Map()
    const bodyJobs = []
    page.on('request', request => {
      const record = { phase: output.currentPhase ?? 'setup', url: request.url(), method: request.method(), resourceType: request.resourceType(), postData: request.postData() ?? null }
      requestRecords.set(request, record)
      output.requests.push(record)
    })
    page.on('requestfailed', request => {
      const record = requestRecords.get(request)
      if (!record) return
      record.failure = request.failure()?.errorText ?? 'request failed'
      output.failures.push({ phase: record.phase, url: record.url, failure: record.failure, resourceType: record.resourceType })
    })
    page.on('response', response => {
      const request = response.request()
      const record = requestRecords.get(request)
      if (!record) return
      const headers = response.headers()
      record.status = response.status()
      record.contentType = headers['content-type'] ?? null
      if (/\/_nuxt_icon\/|api\.iconify\.design|(?:^|\/)api\//i.test(record.url) || request.resourceType() === 'stylesheet') {
        const job = response.text().then(body => { record.body = body.slice(0, 20000) }).catch(error => { record.bodyReadError = String(error) })
        bodyJobs.push(job)
      }
    })

    output.currentPhase = modeArg === 'warm' ? 'warm-online-load' : 'cold-first-load'
    await openWorkspace(page, output.url, target, targetFixture)
    output.initialUi = await renderedState(page)
    if (target === 'b') {
    if (modeArg === 'cold') {
        await exerciseB(page, output, 'cold-offline')
        await page.getByRole('button', { name: /Keep it/ }).click().catch(() => undefined)
        output.currentPhase = 'cold-offline-reload'
        await page.reload({ waitUntil: 'domcontentloaded' })
        await page.waitForTimeout(900)
        await exerciseB(page, output, 'cold-offline-reload')
      } else {
        // Prime the actual dynamic menus and modal while outbound fetch is permitted.
        await exerciseB(page, output, 'warm-online')
        await page.keyboard.press('Escape').catch(() => undefined)
        await page.getByRole('button', { name: /Keep it/ }).click().catch(() => undefined)
        writeFileSync(controlFile, 'deny')
        blockExternal = true
        await exerciseB(page, output, 'warm-offline-loaded-page')
        await page.getByRole('button', { name: /Keep it/ }).click().catch(() => undefined)
        output.currentPhase = 'warm-offline-reload'
        await page.reload({ waitUntil: 'domcontentloaded' })
        await page.waitForTimeout(900)
        await exerciseB(page, output, 'warm-offline-reload')
      }
    } else {
      await exerciseBaseline(page, output)
    }
    // Native browser offline is a separate negative control: it also cuts loopback,
    // unlike the internet-only denial used for the meaningful offline UI scenarios.
    const offlineContext = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const offlinePage = await offlineContext.newPage()
    offlinePage.setDefaultNavigationTimeout(4000)
    await offlineContext.setOffline(true)
    const blockedNavigations = []
    for (const url of [baseUrl, 'https://api.iconify.design/lucide.json?icons=check']) {
      try {
        const response = await offlinePage.goto(url, { waitUntil: 'domcontentloaded' })
        blockedNavigations.push({ url, blocked: false, status: response?.status() ?? null })
      } catch (error) {
        blockedNavigations.push({ url, blocked: true, error: String(error?.message ?? error) })
      }
    }
    output.setOfflineControl = {
      setOffline: true,
      blockedNavigations,
      note: 'Playwright BrowserContext.setOffline blocks loopback and Internet alike; this is a transport control only and does not imply an installed PWA or product requirement.',
    }
    await offlineContext.close()
    await Promise.all(bodyJobs)
    output.serverEgress = readFileSync(egressLog, 'utf8').split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line))
    output.finishedAt = new Date().toISOString()
    delete output.currentPhase
    writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`)
    return { outputPath, requests: output.requests.length, failures: output.failures.length, denied: output.serverEgress.filter(item => item.result === 'blocked').length, browserDenied: output.browserDenied.length, scenarios: (output.scenarios ?? []).map(item => ({ name: item.name, ok: item.ok })) }
  } finally {
    await context?.close().catch(() => undefined)
    if (server.exitCode === null) server.kill()
    await new Promise(resolve => {
      if (server.exitCode !== null) return resolve()
      const timer = setTimeout(resolve, 2000)
      server.once('exit', () => { clearTimeout(timer); resolve() })
    })
  }
}

const summaries = []
try {
  for (const target of targets) summaries.push({ target, ...await runTarget(target) })
} finally {
  await browser.close()
}
console.log(JSON.stringify({ metadata: { browser: runMetadata.browser, node: runMetadata.node, mode: modeArg }, summaries }, null, 2))
