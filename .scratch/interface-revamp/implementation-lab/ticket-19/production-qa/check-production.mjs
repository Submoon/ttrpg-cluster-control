import { createHash } from 'node:crypto'
import { readFile, writeFile, readdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, expect } from '@playwright/test'

const out = dirname(fileURLToPath(import.meta.url)), root = resolve(out, '../../../../..')
const base = process.env.QA_BASE_URL ?? 'http://127.0.0.1:3119'
const diagnostic = process.env.QA_DIAGNOSTIC === '1', resultsFile = diagnostic ? 'diagnostic-results.json' : 'results.json'
const hash = data => createHash('sha256').update(data).digest('hex')
const evidence = { timestamp: new Date().toISOString(), baseline: '006a245134ad06baaf0f56333d2722428b0df367', base, route: '/', runtime: 'cold compiled .output/server/index.mjs with test-owned Node egress preload; fresh Chromium process', identity: {}, browser: '', checks: [], contrast: [], glyphs: [], network: [], console: [], pageerrors: [], fixtures: [], limitations: ['Physical Android Chrome, real OS keyboard, safe areas and physical gestures unavailable.', 'Fresh-session preference uses a new isolated context loaded with persisted storage state; no personal browser profile is used.', 'Contrast samples cover identified meaningful surfaces and do not certify every possible workspace object/state.'] }
if (diagnostic) evidence.runtime = 'warm compiled server diagnostic only; fresh isolated browser; no new cold-resource acceptance claim'
const check = (name, passed, detail) => { evidence.checks.push({ name, passed, detail }); if (!passed) console.error(`FAIL ${name}: ${JSON.stringify(detail)}`) }
for (const file of ['pages/index.vue', 'components/WorkspaceHeader.vue', 'components/WorkspaceWelcome.vue', 'components/BaselinePage.vue', 'components/FieldDefinitionsDialog.vue', 'components/ClusterMap.vue', 'components/SystemMap.vue', 'assets/css/main.css', 'assets/css/map-workspace.css', 'app.config.ts', 'nuxt.config.ts', 'package.json', 'package-lock.json', 'tests/workspace-theme.spec.ts', 'tests/workspace-launch.spec.ts', '.output/nitro.json', '.output/server/index.mjs']) {
  try { evidence.identity[file] = hash(await readFile(join(root, file))) } catch (error) { evidence.identity[file] = { unavailable: error.message } }
}
const browser = await chromium.launch({ headless: true, args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'] })
evidence.browser = `Playwright Chromium ${browser.version()}, headless, deviceScaleFactor 1`
const local = url => { try { const u = new URL(url); return !['http:', 'https:'].includes(u.protocol) || ['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname) } catch { return false } }
const fresh = async (viewport, colorScheme, storageState) => {
  const context = await browser.newContext({ viewport, colorScheme, deviceScaleFactor: 1, hasTouch: viewport.width !== 1440, serviceWorkers: 'block', storageState })
  context.setDefaultTimeout(10000)
  let label = 'product-browser-egress'
  await context.route('**/*', async route => {
    if (local(route.request().url())) return route.continue()
    evidence.network.push({ event: 'denied', label, url: route.request().url(), resourceType: route.request().resourceType() })
    return route.abort('blockedbyclient')
  })
  const page = await context.newPage()
  page.on('pageerror', error => evidence.pageerrors.push(error.message))
  page.on('console', message => { if (['warning', 'error'].includes(message.type())) evidence.console.push({ type: message.type(), text: message.text(), label }) })
  return { context, page, setLabel: next => { label = next } }
}
const theme = page => page.getByRole('button', { name: /Switch to (light|dark)/i })
const scheme = page => page.evaluate(() => ({ className: document.documentElement.className, native: getComputedStyle(document.documentElement).colorScheme, preference: localStorage.getItem('nuxt-color-mode') }))
const isScheme = (row, value) => row.className.split(/\s+/).includes(value) && row.native.includes(value)
const welcome = page => page.getByRole('heading', { name: 'Give the unknown a name.' })
const assertScheme = async (page, value, label) => { await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${value}\\b`)); const row = await scheme(page); check(label, isScheme(row, value), row) }
const overflow = async (page, label) => check(`${label}: no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth })))
const settle = locator => locator.evaluate(async el => { await Promise.all(el.getAnimations({ subtree: true }).filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {}))) })
async function focus(page, locator, label) {
  await locator.scrollIntoViewIfNeeded(); await locator.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab')
  await settle(locator)
  const row = await locator.evaluate(el => {
    const r = el.getBoundingClientRect(), s = getComputedStyle(el), extent = Math.max(0, parseFloat(s.outlineWidth) + parseFloat(s.outlineOffset))
    const center = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
    const clippedBy = []
    for (let parent = el.parentElement; parent; parent = parent.parentElement) {
      const ps = getComputedStyle(parent), p = parent.getBoundingClientRect()
      if ((/(hidden|clip|auto|scroll)/.test(ps.overflowX) && (r.left - extent < p.left - .1 || r.right + extent > p.right + .1)) || (/(hidden|clip|auto|scroll)/.test(ps.overflowY) && (r.top - extent < p.top - .1 || r.bottom + extent > p.bottom + .1))) clippedBy.push({ tag: parent.tagName, className: parent.className, bounds: p.toJSON(), overflow: `${ps.overflowX}/${ps.overflowY}` })
    }
    return { focused: document.activeElement === el, outlineWidth: s.outlineWidth, outlineOffset: s.outlineOffset, outlineStyle: s.outlineStyle, outlineColor: s.outlineColor, extent, bounds: r.toJSON(), viewport: { width: innerWidth, height: innerHeight }, clippedBy, hit: center === el || el.contains(center), ringFits: r.top >= extent - .1 && r.bottom <= innerHeight - extent + .1 && r.left >= extent - .1 && r.right <= innerWidth - extent + .1 }
  })
  check(`${label}: full focus ring visible`, row.focused && row.hit && row.ringFits && !row.clippedBy.length && row.outlineStyle !== 'none' && parseFloat(row.outlineWidth) >= 2, row)
  await measure(page, locator, `${label} focus`, 'focus')
  if (label.includes('844x390')) await page.screenshot({ path: join(out, `${label.replace(/[^a-z0-9]+/gi, '-')}-viewport.png`) })
}
// Color parsing uses the browser's CSS parser, including oklch()/color()/color-mix().
async function measure(page, locator, label, kind = 'text', property) {
  if (!await locator.count() || !await locator.first().isVisible()) { check(`${label}: measurable target`, false, 'missing or hidden'); return }
  const target = locator.first()
  await target.scrollIntoViewIfNeeded()
  // A focused control's outer ring is a different cue from its resting border.
  if (kind === 'control') await target.evaluate(el => el.blur())
  await settle(target)
  const row = await target.evaluate((el, { kind, property }) => {
    const s = getComputedStyle(el), r = el.getBoundingClientRect()
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1; const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const parse = css => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = css; ctx.fillRect(0, 0, 1, 1); return Array.from(ctx.getImageData(0, 0, 1, 1).data).map((v, i) => i === 3 ? v / 255 : v) }
    const prop = property ?? (kind === 'graphic' ? 'fill' : kind === 'focus' ? 'outlineColor' : kind === 'control' ? 'borderTopColor' : el instanceof SVGElement ? 'fill' : 'color')
    const rgba = parse(s[prop]), opacityChain = []
    let opacity = prop === 'stroke' ? parseFloat(s.strokeOpacity) : prop === 'fill' ? parseFloat(s.fillOpacity) : 1
    for (let node = el; node; node = node.parentElement) { const value = parseFloat(getComputedStyle(node).opacity); opacity *= value; if (value !== 1) opacityChain.push({ tag: node.tagName, className: node.getAttribute('class'), opacity: value }) }
    rgba[3] *= opacity
    const adjacentPoints = [], contourSamples = []
    if (kind === 'graphic' && prop === 'stroke' && el instanceof SVGGeometryElement) {
      const total = el.getTotalLength(), matrix = el.getScreenCTM()
      const isRoute = el.matches('.cluster-route-line')
      const blockers = isRoute ? [...el.ownerSVGElement.querySelectorAll('.cluster-route-label-bg,.cluster-system-card,.cluster-exit-mark,text')].filter(node => node !== el).map(node => node.getBoundingClientRect()) : []
      const clear = point => point.x >= 0 && point.x < innerWidth && point.y >= 0 && point.y < innerHeight && !blockers.some(b => point.x >= b.left - 6 && point.x <= b.right + 6 && point.y >= b.top - 6 && point.y <= b.bottom + 6)
      if (matrix) for (const fraction of [.03, .17, .31, .47, .63, .79, .93]) {
        const distance = total * fraction, p = el.getPointAtLength(distance).matrixTransform(matrix), before = el.getPointAtLength(Math.max(0, distance - .1)).matrixTransform(matrix), after = el.getPointAtLength(Math.min(total, distance + .1)).matrixTransform(matrix)
        const dx = after.x - before.x, dy = after.y - before.y, length = Math.hypot(dx, dy)
        // Ignore contour portions covered by labels/cards/panels, then sample off
        // the contour so antialias edge pixels do not become intrinsic colors.
        const hit = document.elementFromPoint(p.x, p.y), ownOrbitTarget = node => node?.classList.contains('orbit-hit-target') && node.parentElement === el.parentElement
        if (isRoute) {
          if (!length || !clear(p)) continue
          const points = [-1, 1].map(side => ({ x: p.x - side * dy / length * 4, y: p.y + side * dx / length * 4 }))
          if (!points.every(clear)) continue
          adjacentPoints.push(...points); contourSamples.push({ fraction, center: { x: p.x, y: p.y }, points, method: 'one actual exposed contour segment; map background on both sides; six-pixel clearance from label/card/mark/text bounds' }); break
        }
        if (length && (hit === el || ownOrbitTarget(hit))) for (const side of [-1, 1]) {
          const point = { x: p.x - side * dy / length * 4, y: p.y + side * dx / length * 4 }, adjacentHit = document.elementFromPoint(point.x, point.y)
          if (adjacentHit === el || adjacentHit === el.ownerSVGElement || ownOrbitTarget(adjacentHit)) adjacentPoints.push(point)
        }
      }
    }
    return { kind, prop, foreground: s[prop], rgba, effectiveOpacity: opacity, fillOpacity: s.fillOpacity, strokeOpacity: s.strokeOpacity, opacityChain, isRoute: el.matches('.cluster-route-line'), adjacentPoints, contourSamples, bounds: r.toJSON(), borderWidth: s.borderTopWidth, outlineWidth: s.outlineWidth, outlineOffset: s.outlineOffset, text: (el.textContent || el.getAttribute('aria-label') || el.getAttribute('name') || '').trim().slice(0, 100), disabled: el.matches(':disabled') }
  }, { kind, property })
  if (row.isRoute && !row.contourSamples.length) { evidence.contrast.push({ label, ...row, outcome: 'inconclusive: no clean exposed segment at sampled fractions' }); check(`${label}: unobscured contour`, false, 'inconclusive: no exposed segment; no contrast pass or source-defect claim'); return }
  const prior = await target.getAttribute('style')
  if (kind === 'graphic' && property !== 'stroke') await target.evaluate(el => el.style.opacity = '0')
  else if (kind === 'graphic' && property === 'stroke') await target.evaluate(el => el.style.setProperty('stroke', 'transparent', 'important'))
  else if (kind === 'text') await target.evaluate(el => { el.style.setProperty('color', 'transparent', 'important'); el.style.setProperty('-webkit-text-fill-color', 'transparent', 'important'); if (el instanceof SVGElement) el.style.setProperty('fill', 'transparent', 'important') })
  const pixels = (await page.screenshot()).toString('base64')
  if (prior === null) await target.evaluate(el => el.removeAttribute('style')); else await target.evaluate((el, value) => el.setAttribute('style', value), prior)
  const result = await page.evaluate(async ({ row, pixels }) => {
    const img = new Image(); img.src = `data:image/png;base64,${pixels}`; await img.decode()
    const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height
    const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0)
    const at = (x, y) => Array.from(ctx.getImageData(Math.max(0, Math.min(img.width - 1, Math.floor(x))), Math.max(0, Math.min(img.height - 1, Math.floor(y))), 1, 1).data).slice(0, 3)
    const lum = rgb => rgb.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((a, v, i) => a + v * [.2126, .7152, .0722][i], 0)
    const ratio = bg => { const f = row.rgba.slice(0, 3).map((v, i) => v * row.rgba[3] + bg[i] * (1 - row.rgba[3])); const a = lum(f), b = lum(bg); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05) }
    const r = row.bounds
    const offset = row.kind === 'focus' ? Math.max(0, parseFloat(row.outlineOffset) + parseFloat(row.outlineWidth)) + .75 : 2
    const adjacent = [at(r.x - offset, r.y + r.height / 2), at(r.x + r.width + offset, r.y + r.height / 2), at(r.x + r.width / 2, r.y - offset), at(r.x + r.width / 2, r.y + r.height + offset)]
    // Focus compares its visible outer edge to the immediately adjacent panel;
    // a subpixel inner gap can include the control border's antialias pixels.
    const backgrounds = row.adjacentPoints.length ? row.adjacentPoints.filter(p => p.x >= 0 && p.x < img.width && p.y >= 0 && p.y < img.height).map(p => at(p.x, p.y)) : ['control', 'focus'].includes(row.kind) ? adjacent : [.2, .5, .8].flatMap(x => [.25, .5, .75].map(y => at(r.x + r.width * x, r.y + r.height * y)))
    return { ...row, backgrounds, ratios: backgrounds.map(ratio), minimum: Math.min(...backgrounds.map(ratio)), threshold: row.kind === 'text' ? 4.5 : 3 }
  }, { row, pixels })
  evidence.contrast.push({ label, ...result })
  check(`${label}: contrast`, (Number.isFinite(result.minimum) && result.minimum >= result.threshold) || result.disabled, { minimum: result.minimum, threshold: result.threshold, disabled: result.disabled, foreground: result.foreground, backgrounds: result.backgrounds })
}
async function glyph(page, label) {
  const control = theme(page)
  await control.scrollIntoViewIfNeeded()
  const rows = await control.locator('svg, span').evaluateAll(nodes => nodes.map(el => {
    const s = getComputedStyle(el), r = el.getBoundingClientRect()
    return { tag: el.tagName, className: el.getAttribute('class'), visible: s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0, mask: s.maskImage, backgroundImage: s.backgroundImage, color: s.color, width: r.width, height: r.height, paths: el.tagName.toLowerCase() === 'svg' ? el.innerHTML : null }
  }).filter(row => row.paths || row.mask !== 'none' || row.backgroundImage !== 'none'))
  const visible = rows.filter(r => r.visible)
  const screenshot = await control.screenshot({ path: join(out, `${label}-theme-control.png`) })
  const originals = await control.locator('svg, span').evaluateAll(nodes => nodes.map(el => {
    const s = getComputedStyle(el), original = el.getAttribute('style')
    if (el.tagName.toLowerCase() === 'svg' || s.maskImage !== 'none' || s.backgroundImage !== 'none') el.style.setProperty('opacity', '0', 'important')
    return original
  }))
  const hidden = await control.screenshot()
  await control.locator('svg, span').evaluateAll((nodes, originals) => nodes.forEach((el, i) => originals[i] === null ? el.removeAttribute('style') : el.setAttribute('style', originals[i])), originals)
  const changedPixels = await page.evaluate(async ([a, b]) => {
    const decode = async src => { const img = new Image(); img.src = `data:image/png;base64,${src}`; await img.decode(); const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height; const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0); return ctx.getImageData(0, 0, img.width, img.height).data }
    const first = await decode(a), second = await decode(b); let count = 0
    for (let i = 0; i < first.length; i += 4) if (Math.abs(first[i] - second[i]) + Math.abs(first[i + 1] - second[i + 1]) + Math.abs(first[i + 2] - second[i + 2]) > 12) count++
    return count
  }, [screenshot.toString('base64'), hidden.toString('base64')])
  evidence.glyphs.push({ label, rows, changedPixels, screenshotHash: hash(screenshot) })
  check(`${label}: visible real theme glyph and pixels`, changedPixels > 8 && visible.length > 0 && visible.every(r => r.width >= 12 && r.height >= 12 && (r.paths?.includes('path') || /svg|data:image/.test(r.mask) || /svg|data:image/.test(r.backgroundImage))), { rows, changedPixels })
}
async function fixture(page, label) {
  const value = await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open('ttrpg-cluster-control', 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    try { return await new Promise((resolve, reject) => { const request = db.transaction('workspace').objectStore('workspace').get('current'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) }) } finally { db.close() }
  })
  evidence.fixtures.push({ label, hash: hash(JSON.stringify(value)), marker: value?.marker, version: value?.version, cluster: value?.cluster?.name, systems: value?.cluster?.systems?.map(s => ({ name: s.name, objects: s.objects.length, orbits: s.orbits.length })) })
  check(`${label}: real durable fixture`, !!value?.cluster?.systems?.length, evidence.fixtures.at(-1))
  return value
}
async function inventory() {
  const names = new Map()
  const walk = async path => { for (const item of await readdir(path, { withFileTypes: true })) { const file = join(path, item.name); if (item.isDirectory()) await walk(file); else if (/\.(vue|m?js|ts)$/.test(item.name)) { const text = await readFile(file, 'utf8'); for (const match of text.matchAll(/i-lucide-([a-z0-9-]+)/g)) { const refs = names.get(match[1]) ?? []; refs.push(file.slice(root.length + 1).replaceAll('\\', '/')); names.set(match[1], refs) } } } }
  await walk(join(root, 'components')); await walk(join(root, 'node_modules/@nuxt/ui/dist'))
  const appConfig = await readFile(join(root, 'app.config.ts'), 'utf8')
  for (const match of appConfig.matchAll(/i-lucide-([a-z0-9-]+)/g)) names.set(match[1], [...(names.get(match[1]) ?? []), 'app.config.ts'])
  const responses = []
  const sorted = [...names.keys()].sort()
  for (let i = 0; i < sorted.length; i += 30) {
    const requested = sorted.slice(i, i + 30), response = await fetch(`${base}/api/_nuxt_icon/lucide.json?icons=${requested.join(',')}`)
    let body; try { body = await response.json() } catch { body = {} }
    responses.push({ status: response.status, requested, resolved: requested.filter(name => typeof body.icons?.[name]?.body === 'string' && /<(path|circle|rect|line|polyline|polygon|ellipse)/.test(body.icons[name].body)), bodyHash: hash(JSON.stringify(body)) })
  }
  evidence.iconInventory = { method: 'application and installed Nuxt UI literal glyph inventory; includes dynamic default appConfig references. Local endpoint validates actual SVG bodies; only mounted product theme glyphs receive visible rendering claims.', names: Object.fromEntries([...names].sort()), responses }
  check('local collection resolves application/library glyph inventory with real SVG bodies', sorted.length >= 2 && responses.every(r => r.status === 200 && r.resolved.length === r.requested.length), { count: sorted.length, failures: responses.filter(r => r.resolved.length !== r.requested.length) })
}
try {
  const guard = (await readFile(join(out, 'server-network.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse)
  check(`${diagnostic ? 'existing' : 'cold'} compiled server guard and separate socket canary`, guard.some(r => r.event === 'guard-installed') && guard.some(r => r.event === 'canary-passed' && r.label === 'server-guard-canary') && guard.some(r => r.event === 'denied' && r.label === 'server-guard-canary'), guard)
  const canary = await fresh({ width: 1440, height: 900 }, 'light'); canary.setLabel('browser-guard-canary')
  try { await canary.page.goto('https://example.com/qa-browser-guard-canary') } catch {}
  check('fresh browser external canary denied', evidence.network.some(r => r.label === 'browser-guard-canary' && r.event === 'denied'), evidence.network)
  await canary.context.close()
  // The first product navigation/glyph inspection happens before the inventory requests.
  let firstProductNavigation = true
  for (const viewport of diagnostic ? [] : [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 390, height: 500 }]) {
    for (const initial of ['light', 'dark']) {
      const size = `${viewport.width}x${viewport.height}`, label = `${size}-${initial}`, opposite = initial === 'light' ? 'dark' : 'light'
      const { page, context } = await fresh(viewport, initial)
      console.log(`SCENARIO ${label}`)
      try {
        const response = await page.goto(base)
        if (firstProductNavigation) {
          firstProductNavigation = false
          const html = await response.text(); await writeFile(join(out, 'ssr-root.html'), html)
          check('actual cold product SSR shell over permitted loopback', response.ok() && html.includes('Opening this browser') && !html.includes('data-prototype-theme'), { status: response.status(), loadingShell: html.includes('Opening this browser'), hasColorModeInit: /color-mode|colorMode/.test(html) })
        }
        await welcome(page).waitFor()
        await assertScheme(page, initial, `${label}: initial OS scheme`); await glyph(page, `${label}-initial`); await overflow(page, `${label} welcome`)
        await page.screenshot({ path: join(out, `${label}-welcome-viewport.png`) })
        await page.emulateMedia({ colorScheme: opposite }); await assertScheme(page, opposite, `${label}: follows changed OS before explicit choice`)
        await focus(page, theme(page), `${label} theme`); await page.keyboard.press('Enter'); await assertScheme(page, initial, `${label}: keyboard explicit choice`)
        await glyph(page, `${label}-explicit`)
        await page.emulateMedia({ colorScheme: opposite }); await assertScheme(page, initial, `${label}: explicit choice overrides OS`)
        await page.reload(); await welcome(page).waitFor(); await assertScheme(page, initial, `${label}: explicit reload`)
        await page.getByLabel('Jump Cluster', { exact: true }).fill(`QA ${label} Reach`); await page.getByLabel('First star system').fill(`QA ${label} Star`)
        await focus(page, page.getByRole('button', { name: 'Create local workspace' }), `${label} creation`)
        if (viewport.width === 1440) { await measure(page, welcome(page), `${label} welcome title`); await measure(page, page.getByLabel('Jump Cluster', { exact: true }), `${label} native name`, 'control'); await page.keyboard.press('Enter') }
        else await page.getByRole('button', { name: 'Create local workspace' }).tap()
        await page.getByText('Saved on this device').waitFor(); await page.getByRole('group', { name: `QA ${label} Star star system map`, exact: true }).waitFor()
        await fixture(page, label); await assertScheme(page, initial, `${label}: theme survives real creation`)
        await page.screenshot({ path: join(out, `${label}-system-viewport.png`) })
        if (viewport.width === 1440) { await measure(page, page.locator('.system-map-svg .object-name').first(), `${label} system object name`); await measure(page, page.locator('.system-object-glyph').first(), `${label} system object meaningful mark`, 'graphic', 'fill') }
        await page.getByRole('button', { name: 'Cluster map', exact: true }).click(); await page.locator('.cluster-map-svg').waitFor()
        if (viewport.width === 1440) { await measure(page, page.locator('.cluster-system-name').first(), `${label} cluster system name`); await measure(page, page.locator('.cluster-system-card').first(), `${label} cluster card meaningful boundary`, 'graphic', 'stroke') }
        await page.screenshot({ path: join(out, `${label}-cluster-viewport.png`) })
        const trigger = page.getByRole('button', { name: 'Open field definitions', exact: true })
        await focus(page, trigger, `${label} Fields trigger`)
        if (viewport.width === 1440) await page.keyboard.press('Enter'); else await trigger.tap()
        const dialog = page.getByRole('dialog', { name: 'Field definitions', exact: true }); await dialog.waitFor()
        check(`${label}: actual Fields portal is body child`, await dialog.evaluate(el => el.parentElement === document.body), await dialog.evaluate(el => ({ parent: el.parentElement?.tagName, native: el instanceof HTMLDialogElement, open: el.open, colorScheme: getComputedStyle(el).colorScheme, background: getComputedStyle(el).backgroundColor })))
        check(`${label}: modal entry focus`, await dialog.evaluate(el => el.contains(document.activeElement)), await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 500)))
        await dialog.getByRole('button', { name: 'New custom field', exact: true }).click()
        const input = dialog.getByLabel('Custom field label', { exact: true }), select = dialog.locator('#new-custom-field-type')
        await input.fill('Transient QA draft'); await select.selectOption('single-select')
        await focus(page, select, `${label} native select`)
        if (viewport.width === 1440) { await measure(page, dialog.getByRole('heading', { name: 'Field definitions', exact: true }), `${label} portal heading`); await measure(page, input, `${label} portal native input`, 'control'); await measure(page, select, `${label} portal native select`, 'control'); await measure(page, dialog.getByRole('button', { name: /^Atmosphere/ }), `${label} active field text`) }
        await page.screenshot({ path: join(out, `${label}-Fields-viewport.png`) })
        await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0)
        check(`${label}: Fields returns focus`, await trigger.evaluate(el => document.activeElement === el), await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 500)))
        const persisted = await context.storageState({ indexedDB: true }); const reopened = await fresh(viewport, opposite, persisted)
        await reopened.page.goto(base); await reopened.page.getByText('Saved on this device').waitFor(); await assertScheme(reopened.page, initial, `${label}: explicit preference new isolated session`); await reopened.context.close()
        if (viewport.width !== 1440) { await theme(page).tap(); await assertScheme(page, opposite, `${label}: touch theme activation`); await glyph(page, `${label}-touch`) }
        await overflow(page, `${label} product`)
      } catch (error) { check(`${label}: execution`, false, { message: error.message, stack: error.stack }); await page.screenshot({ path: join(out, `${label}-failure.png`) }).catch(() => {}) }
      finally { await context.close() }
    }
  }
  const richFixture = await readFile(join(out, 'rich-fixture.json'))
  evidence.identity['production-qa/rich-fixture.json'] = hash(richFixture)
  for (const initial of ['light', 'dark']) {
    const label = `rich-${initial}`, { context, page } = await fresh({ width: 1440, height: 900 }, initial)
    console.log(`SCENARIO ${label}`)
    try {
      await page.goto(base); await welcome(page).waitFor(); await page.getByLabel('Jump Cluster', { exact: true }).fill('QA Rich Host'); await page.getByLabel('First star system').fill('QA Host'); await page.getByRole('button', { name: 'Create local workspace' }).click(); await page.getByText('Saved on this device').waitFor()
      page.once('dialog', dialog => dialog.accept())
      await page.getByLabel('JSON map file', { exact: true }).setInputFiles({ name: 'rich-fixture.json', mimeType: 'application/json', buffer: richFixture })
      const systems = page.getByRole('navigation', { name: 'Star systems', exact: true })
      await systems.getByRole('button', { name: 'Open QA Alpha system map', exact: true }).click(); await page.getByText('Saved on this device').waitFor()
      await page.locator('.system-map-svg .orbit-ring').waitFor(); await fixture(page, label)
      check(`${label}: authoritative imported fixture rendered`, await page.locator('.system-map-svg .system-object').count() === 3 && await page.locator('.system-map-svg .orbit-ring').count() === 1, { objects: await page.locator('.system-map-svg .system-object').count(), orbits: await page.locator('.system-map-svg .orbit-ring').count(), importFormat: JSON.parse(richFixture).format })
      await page.getByRole('button', { name: 'Open field definitions', exact: true }).click()
      const fields = page.getByRole('dialog', { name: 'Field definitions', exact: true })
      await fields.getByRole('button', { name: 'Edit field definition', exact: true }).click()
      const invalidChoices = 'Vacuum\nvacuum'
      const choices = fields.getByLabel('Atmosphere choices', { exact: true }); await choices.fill(invalidChoices)
      await fields.getByRole('button', { name: 'Save changes', exact: true }).click()
      await fields.getByRole('alert').waitFor()
      const feedbackBefore = await fields.locator('[role="alert"], .field-definition-error').allTextContents()
      await page.emulateMedia({ colorScheme: initial === 'light' ? 'dark' : 'light' }); await assertScheme(page, initial === 'light' ? 'dark' : 'light', `${label}: OS recolors open Fields modal`)
      const feedbackAfter = await fields.locator('[role="alert"], .field-definition-error').allTextContents()
      check(`${label}: open Fields draft and validation survive OS change`, await choices.inputValue() === invalidChoices && feedbackBefore.length > 0 && JSON.stringify(feedbackBefore) === JSON.stringify(feedbackAfter), { before: feedbackBefore, after: feedbackAfter, draft: await choices.inputValue() })
      await page.emulateMedia({ colorScheme: initial }); await assertScheme(page, initial, `${label}: OS restores initial palette`)
      page.once('dialog', dialog => dialog.accept()); await fields.getByRole('button', { name: 'Close field definitions', exact: true }).click(); await expect(fields).toHaveCount(0)
      await measure(page, page.locator('.system-map-svg .orbit-ring'), `${label} unselected meaningful orbit`, 'graphic', 'stroke')
      await page.getByRole('complementary', { name: 'System hierarchy' }).getByRole('button', { name: /Orbit 1 around QA Primary/ }).click()
      await measure(page, page.locator('.system-map-svg .orbit-ring'), `${label} selected meaningful orbit`, 'graphic', 'stroke')
      await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
      const viewBefore = await page.locator('.system-map-content').getAttribute('transform'), selectedBefore = await page.locator('.orbit-mark.is-selected').getAttribute('data-orbit-id')
      await theme(page).click(); await assertScheme(page, initial === 'light' ? 'dark' : 'light', `${label}: camera toggle opposite palette`)
      const viewAfter = await page.locator('.system-map-content').getAttribute('transform'), selectedAfter = await page.locator('.orbit-mark.is-selected').getAttribute('data-orbit-id')
      check(`${label}: actual selected Orbit and map camera survive theme`, viewBefore === viewAfter && selectedBefore === selectedAfter && !!selectedBefore, { viewBefore, viewAfter, selectedBefore, selectedAfter })
      await theme(page).click(); await assertScheme(page, initial, `${label}: camera toggle original palette`)
      await page.screenshot({ path: join(out, `${label}-system-selected-viewport.png`) })
      await page.getByRole('button', { name: 'Cluster map', exact: true }).click(); await page.locator('.cluster-route-line').first().waitFor()
      await page.getByRole('button', { name: 'Collapse inspector panel', exact: true }).click(); await expect(page.locator('#workspace-inspector-panel')).toBeHidden()
      await page.getByRole('button', { name: 'Collapse hierarchy panel', exact: true }).click(); await expect(page.locator('#workspace-hierarchy-panel')).toBeHidden()
      await page.screenshot({ path: join(out, `${label}-cluster-unselected-viewport.png`) })
      for (let i = 0; i < 2; i++) { await measure(page, page.locator('.cluster-route-line').nth(i), `${label} meaningful route ${i}`, 'graphic', 'stroke'); await measure(page, page.locator('.cluster-route-label').nth(i), `${label} route label ${i}`) }
      await measure(page, page.locator('.cluster-exit-mark'), `${label} unresolved exit mark`, 'graphic', 'stroke')
      await measure(page, page.locator('.cluster-exit-label'), `${label} unresolved exit text`)
      const route = page.locator('.cluster-route').first(), normalWidth = await route.locator('.cluster-route-line').evaluate(el => getComputedStyle(el).strokeWidth); await route.focus(); await page.keyboard.press('Enter')
      await measure(page, page.locator('.cluster-route.is-selected .cluster-route-line'), `${label} selected route`, 'graphic', 'stroke')
      const selectedWidth = await route.locator('.cluster-route-line').evaluate(el => getComputedStyle(el).strokeWidth), unresolvedDash = await page.locator('.cluster-route.is-unresolved .cluster-route-line').evaluate(el => getComputedStyle(el).strokeDasharray)
      check(`${label}: route non-color cue and accessible name`, parseFloat(selectedWidth) > parseFloat(normalWidth) && unresolvedDash !== 'none' && await route.evaluate(el => !!el.getAttribute('aria-label') && el.getAttribute('role') === 'button'), { name: await route.getAttribute('aria-label'), normalWidth, selectedWidth, unresolvedDash })
      await page.screenshot({ path: join(out, `${label}-cluster-selected-viewport.png`) })
    } catch (error) { check(`${label}: execution`, false, { message: error.message, stack: error.stack }); await page.screenshot({ path: join(out, `${label}-failure.png`) }).catch(() => {}) }
    finally { await context.close() }
  }
  // Ticket 18 changed launch/recovery focus must remain sound in both new palettes.
  for (const viewport of [{ width: 1440, height: 900 }, { width: 844, height: 390 }]) for (const initial of ['light', 'dark']) {
    const label = `${viewport.width}x${viewport.height}-${initial}-recovery`, { context, page } = await fresh(viewport, initial)
    console.log(`SCENARIO ${label}`)
    try {
      await page.goto(base); await welcome(page).waitFor(); await page.getByLabel('Jump Cluster', { exact: true }).fill(`QA ${label}`); await page.getByLabel('First star system').fill('Recovery Star'); await page.getByRole('button', { name: 'Create local workspace' }).click(); await page.getByText('Saved on this device').waitFor()
      const valid = await fixture(page, label)
      await page.evaluate(async valid => {
        const db = await new Promise((resolve, reject) => { const r = indexedDB.open('ttrpg-cluster-control', 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
        try { await new Promise((resolve, reject) => { const tx = db.transaction('workspace', 'readwrite'), store = tx.objectStore('workspace'); store.put(valid, 'last-valid'); store.put({ damaged: 'ticket-19-compiled-qa' }, 'current'); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error) }) } finally { db.close() }
      }, valid)
      await page.reload(); const heading = page.getByRole('heading', { name: 'Your workspace could not be opened.' }); await heading.waitFor(); await assertScheme(page, initial, `${label}: recovered shell scheme`)
      await focus(page, page.getByRole('button', { name: 'Try again', exact: true }), `${label} retry`); await page.keyboard.press('Enter'); await heading.waitFor()
      const restore = page.getByRole('button', { name: 'Restore last valid backup', exact: true }); await focus(page, restore, `${label} restore`)
      if (viewport.width === 1440) { await measure(page, heading, `${label} title`); await measure(page, restore, `${label} restore text`); await measure(page, restore, `${label} restore boundary`, 'control') }
      await page.screenshot({ path: join(out, `${label}-viewport.png`) }); await page.keyboard.press('Enter'); await page.getByText('Saved on this device').waitFor(); await page.reload(); await page.getByRole('heading', { name: 'Recovery Star', exact: true, level: 1 }).waitFor(); check(`${label}: actual backup restored and reloaded`, true, { fixture: hash(JSON.stringify(valid)) })
    } catch (error) { check(`${label}: execution`, false, { message: error.message }); await page.screenshot({ path: join(out, `${label}-failure.png`) }).catch(() => {}) }
    finally { await context.close() }
  }
  await inventory()
  const server = (await readFile(join(out, 'server-network.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse)
  evidence.serverNetwork = server
  check('no product server external requests', !server.some(r => r.event === 'denied' && r.label === 'compiled-server-egress'), server.filter(r => r.label === 'compiled-server-egress'))
  check('no product browser external requests', !evidence.network.some(r => r.label === 'product-browser-egress'), evidence.network.filter(r => r.label === 'product-browser-egress'))
  check('no product console or hydration warnings', evidence.console.filter(r => r.label !== 'browser-guard-canary').length === 0, evidence.console)
  check('no page errors', evidence.pageerrors.length === 0, evidence.pageerrors)
} catch (error) { check('suite execution', false, { message: error.message, stack: error.stack }) }
finally {
  await browser.close()
  await writeFile(join(out, resultsFile), JSON.stringify(evidence, null, 2))
  console.log(JSON.stringify({ checks: evidence.checks.length, failed: evidence.checks.filter(c => !c.passed), contrastSamples: evidence.contrast.length, output: join(out, resultsFile) }, null, 2))
}
if (evidence.checks.some(c => !c.passed)) process.exitCode = 1
