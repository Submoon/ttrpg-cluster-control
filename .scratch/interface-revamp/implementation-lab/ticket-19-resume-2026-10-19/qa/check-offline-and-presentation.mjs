// Test-owned compiled-product evidence. Execute only after coordinator runtime handoff.
import { createHash } from 'node:crypto'
import { readFile, writeFile, readdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, expect } from '@playwright/test'

const out = dirname(fileURLToPath(import.meta.url))
const root = resolve(out, '../../../../..')
const base = process.env.QA_BASE_URL ?? 'http://127.0.0.1:3180'
const continuation = process.env.QA_WARM_CONTINUATION === '1'
const remainingOnly = process.env.QA_REMAINING_ONLY === '1'
const serverNetworkLog = process.env.QA_SERVER_NETWORK_LOG ?? join(out, 'server-network.jsonl')
const hash = data => createHash('sha256').update(data).digest('hex')
const evidence = {
  timestamp: new Date().toISOString(), baseline: 'f64d00dbaf9cee569a8a62db0005b4ffe7f00ca7', candidate: 'aeeae7a6e0ec9e9f7df3161f4b5a7a00833edf1b',
  route: '/', base, runtime: continuation ? 'warm guarded compiled server; bounded harness continuation, no new cold-resource claim' : 'fresh guarded compiled .output/server/index.mjs',
  browser: null, identity: {}, checks: [], contrast: [], glyphs: [], network: [],
  coldChecks: !continuation, coldProvenance: continuation ? 'offline-and-presentation-results.json + server-network.jsonl from the original cold attempt' : null,
  completedProvenance: remainingOnly ? 'presentation-continuation-results.json owns completed desktop-light, fresh-session preference and Fields OS-change/Stay observations' : null,
  serverNetwork: [], console: [], pageerrors: [], fixtures: [], screenshots: [], transitions: [],
  limits: [
    'Four representative cases, not the historical 98/405 matrix or a complete accessibility audit.',
    'Physical Android Chrome, OS keyboard, safe area and physical gestures unavailable; touch is emulated.',
    'Loaded-map B/Dock structural correction belongs to ticket 21; palette results do not certify its fidelity.',
    'Server denial covers Node socket/TLS/DNS paths, not native add-ons, subprocesses or an OS firewall.',
    'Fresh-session persistence uses a new isolated context carrying saved storage, never a personal profile.',
    'Installed Nuxt UI literal glyph names are an inventory superset, not a count of actual application consumption.',
  ],
}
const check = (name, passed, detail) => {
  evidence.checks.push({ name, passed, detail })
  if (!passed) console.error(`FAIL ${name}: ${JSON.stringify(detail)}`)
}
const requireCheck = (name, passed, detail) => {
  check(name, passed, detail)
  if (!passed) throw new Error(name)
}
const theme = page => page.getByRole('group', { name: 'Theme', exact: true }).getByRole('button', { name: /Switch to (light|dark) mode/i })
const welcome = page => page.getByRole('heading', { name: 'Give the unknown a name.' })
const fields = page => page.getByRole('dialog', { name: 'Field definitions', exact: true })
let browser

const local = url => {
  try { const u = new URL(url); return !['http:', 'https:', 'ws:', 'wss:'].includes(u.protocol) || ['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname) }
  catch { return false }
}
async function fresh(label, viewport, colorScheme, storageState) {
  const context = await browser.newContext({ viewport, colorScheme, storageState, deviceScaleFactor: 1, hasTouch: viewport.width !== 1440, serviceWorkers: 'block', reducedMotion: 'reduce' })
  context.setDefaultTimeout(12000)
  await context.route('**/*', route => {
    if (local(route.request().url())) return route.continue()
    evidence.network.push({ label, event: 'denied', api: 'request', url: route.request().url(), type: route.request().resourceType() })
    return route.abort('blockedbyclient')
  })
  await context.routeWebSocket('**/*', socket => {
    if (local(socket.url())) return socket.connectToServer()
    evidence.network.push({ label, event: 'denied', api: 'websocket', url: socket.url() })
    socket.close({ code: 1008, reason: 'QA external network denied' })
  })
  const page = await context.newPage()
  page.on('console', message => { if (['warning', 'error'].includes(message.type())) evidence.console.push({ label, type: message.type(), text: message.text() }) })
  page.on('pageerror', error => evidence.pageerrors.push({ label, text: error.message }))
  return { context, page }
}
async function settle(locator, label) {
  const animations = await locator.evaluate(el => el.getAnimations({ subtree: true }).map(a => ({ state: a.playState, timing: a.effect?.getComputedTiming() })))
  evidence.transitions.push({ label, observedBeforeSettlement: animations })
  // Observe real transitions before waiting; do not disable animation or rewrite palette styles.
  await locator.evaluate(async el => {
    const pending = el.getAnimations({ subtree: true }).filter(a => a.effect?.getTiming().iterations !== Infinity)
    await Promise.race([Promise.all(pending.map(a => a.finished.catch(() => {}))), new Promise(resolve => setTimeout(resolve, 2000))])
  })
  await locator.page().waitForTimeout(200)
}
async function scheme(page, expected, label) {
  await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${expected}\\b`))
  const actual = await page.evaluate(() => ({ classes: document.documentElement.className, native: getComputedStyle(document.documentElement).colorScheme, preference: localStorage.getItem('nuxt-color-mode') }))
  check(label, actual.classes.split(/\s+/).includes(expected) && actual.native.includes(expected), actual)
}
async function setScheme(page, expected, label) {
  if (!await page.locator('html').evaluate((el, value) => el.classList.contains(value), expected)) await theme(page).click()
  await scheme(page, expected, label)
}
async function keyboardFocus(page, locator, label) {
  await locator.scrollIntoViewIfNeeded()
  // Locator focus is setup; Tab/Shift+Tab then establishes actual keyboard focus-visible state.
  await locator.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab')
  await settle(locator, label)
  const row = await locator.evaluate(el => {
    const r = el.getBoundingClientRect(), s = getComputedStyle(el)
    const extent = Math.max(0, parseFloat(s.outlineWidth) || 0) + Math.max(0, parseFloat(s.outlineOffset) || 0)
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2), clippedBy = []
    for (let ancestor = el.parentElement; ancestor; ancestor = ancestor.parentElement) {
      const a = getComputedStyle(ancestor), b = ancestor.getBoundingClientRect()
      if ((/(hidden|clip|auto|scroll)/.test(a.overflowX) && (r.left - extent < b.left - .1 || r.right + extent > b.right + .1)) || (/(hidden|clip|auto|scroll)/.test(a.overflowY) && (r.top - extent < b.top - .1 || r.bottom + extent > b.bottom + .1))) clippedBy.push({ tag: ancestor.tagName, class: ancestor.className, overflow: `${a.overflowX}/${a.overflowY}` })
    }
    return { focused: document.activeElement === el, hit: hit === el || el.contains(hit), extent, bounds: r.toJSON(), outline: s.outlineStyle, outlineWidth: s.outlineWidth, outlineColor: s.outlineColor, clippedBy, fits: r.left >= extent - .1 && r.top >= extent - .1 && r.right <= innerWidth - extent + .1 && r.bottom <= innerHeight - extent + .1 }
  })
  check(`${label}: complete unobscured keyboard focus`, row.focused && row.hit && row.fits && row.clippedBy.length === 0 && row.outline !== 'none' && parseFloat(row.outlineWidth) >= 2, row)
}
async function overflow(page, label) {
  const row = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }))
  check(`${label}: no horizontal overflow`, row.scrollWidth <= row.width + 1, row)
}

async function contrastSample(page, locator, label, { control = false, focus = false, text = true, boundaryRequired = true } = {}) {
  await locator.scrollIntoViewIfNeeded()
  if (await locator.evaluate(el => el.tagName === 'INPUT' && document.activeElement === el)) await page.keyboard.press('ArrowRight')
  // Color transitions can remain active despite reduced-motion preference; sample the settled painted state.
  await settle(locator, label)
  const row = await locator.evaluate(el => {
    const paintedText = el.querySelector('[data-slot="description"]') ?? el
    const s = getComputedStyle(paintedText), r = paintedText.getBoundingClientRect()
    return { color: s.color, border: s.borderTopColor, borderWidth: s.borderTopWidth, outline: s.outlineColor, outlineWidth: s.outlineWidth, outlineOffset: s.outlineOffset, tag: el.tagName, text: (el.textContent || el.getAttribute('name') || '').trim().slice(0, 120), x: r.x, y: r.y, width: r.width, height: r.height }
  })
  // Preserve computed colors/borders; only suppress glyph painting in this disposable measurement frame.
  const hiddenGlyphs = await page.addStyleTag({ content: '* { -webkit-text-fill-color: transparent !important; text-shadow: none !important; }' })
  let pixels
  try { pixels = (await page.screenshot()).toString('base64') } finally { await hiddenGlyphs.evaluate(el => el.remove()) }
  const measured = await page.evaluate(async ({ row, pixels, control, focus }) => {
    const img = new Image(); img.src = `data:image/png;base64,${pixels}`; await img.decode()
    const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height
    const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0)
    const at = (x, y) => Array.from(ctx.getImageData(Math.max(0, Math.min(img.width - 1, Math.round(x))), Math.max(0, Math.min(img.height - 1, Math.round(y))), 1, 1).data).slice(0, 3)
    const backgrounds = [.25, .5, .75].map(f => at(row.x + row.width * f, row.y + row.height * .5))
    const edgeDistance = Math.max(4, (parseFloat(row.outlineWidth) || 0) + Math.max(0, parseFloat(row.outlineOffset) || 0) + 2)
    const adjacent = at(row.x - edgeDistance, row.y + row.height * .5)
    const colorCanvas = document.createElement('canvas'); colorCanvas.width = colorCanvas.height = 1
    const colorContext = colorCanvas.getContext('2d', { willReadFrequently: true })
    const rgba = css => { colorContext.clearRect(0, 0, 1, 1); colorContext.fillStyle = css; colorContext.fillRect(0, 0, 1, 1); return Array.from(colorContext.getImageData(0, 0, 1, 1).data) }
    const lum = c => c.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((n, v, i) => n + v * [.2126, .7152, .0722][i], 0)
    const ratio = (f, bg) => { const composed = f.slice(0, 3).map((v, i) => v * f[3] / 255 + bg[i] * (1 - f[3] / 255)); const a = lum(composed), b = lum(bg); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05) }
    const textRatio = Math.min(...backgrounds.map(bg => ratio(rgba(row.color), bg)))
    const borderRatio = control && parseFloat(row.borderWidth) > 0 ? ratio(rgba(row.border), adjacent) : null
    const fillRatio = control ? Math.min(...backgrounds.map(bg => ratio([...bg, 255], adjacent))) : null
    const controlRatio = control ? Math.max(borderRatio ?? 0, fillRatio ?? 0) : null
    const focusRatio = focus ? ratio(rgba(row.outline), adjacent) : null
    return { computed: row, backgrounds, adjacent, textRatio, borderRatio, fillRatio, controlRatio, focusRatio }
  }, { row, pixels, control, focus })
  evidence.contrast.push({ label, boundaryRequired, method: 'computed foreground composited against three glyph-suppressed rendered pixels; border or fill against adjacent rendered pixel; focus outline against outside rendered pixel', ...measured })
  if (text) check(`${label}: text >=4.5`, measured.textRatio >= 4.5, measured.textRatio)
  if (control && boundaryRequired) check(`${label}: control >=3`, measured.controlRatio >= 3, measured.controlRatio)
  if (focus) check(`${label}: focus >=3`, measured.focusRatio >= 3, measured.focusRatio)
}

async function measure(page, locator, label, kind = 'text', property) {
  if (!await locator.count() || !await locator.first().isVisible()) { check(`${label}: measurable target`, false, 'missing or hidden'); return }
  const target = locator.first()
  await target.scrollIntoViewIfNeeded()
  // A focused control's outer ring is a different cue from its resting border.
  if (kind === 'control') await target.evaluate(el => el.blur())
  await settle(target, label)
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
  await settle(control, label)
  const selector = 'svg, span'
  const rows = await control.locator(selector).evaluateAll(nodes => nodes.map(el => {
    const s = getComputedStyle(el), r = el.getBoundingClientRect()
    return { tag: el.tagName, class: el.getAttribute('class'), width: r.width, height: r.height, visible: s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0, paths: el instanceof SVGElement ? el.innerHTML : null, mask: s.maskImage, background: s.backgroundImage }
  }).filter(r => r.paths || r.mask !== 'none' || r.background !== 'none'))
  const originalPixels = await control.screenshot()
  const prior = await control.locator(selector).evaluateAll(nodes => nodes.map(el => {
    const prior = el.getAttribute('style'), s = getComputedStyle(el)
    if (el instanceof SVGElement || s.maskImage !== 'none' || s.backgroundImage !== 'none') el.style.setProperty('opacity', '0', 'important')
    return prior
  }))
  let hiddenPixels
  try { hiddenPixels = await control.screenshot() }
  finally { await control.locator(selector).evaluateAll((nodes, values) => nodes.forEach((el, i) => values[i] === null ? el.removeAttribute('style') : el.setAttribute('style', values[i])), prior) }
  const changed = await page.evaluate(async ([a, b]) => {
    const decode = async source => { const img = new Image(); img.src = `data:image/png;base64,${source}`; await img.decode(); const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height; const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0); return ctx.getImageData(0, 0, img.width, img.height).data }
    const first = await decode(a), second = await decode(b); let count = 0
    for (let i = 0; i < first.length; i += 4) if (Math.abs(first[i] - second[i]) + Math.abs(first[i + 1] - second[i + 1]) + Math.abs(first[i + 2] - second[i + 2]) > 12) count++
    return count
  }, [originalPixels.toString('base64'), hiddenPixels.toString('base64')])
  evidence.glyphs.push({ label, rows, changedPixels: changed, pngSha256: hash(originalPixels) })
  const visible = rows.filter(r => r.visible)
  check(`${label}: actual mounted local glyph geometry and pixels`, changed > 8 && visible.length > 0 && visible.every(r => r.width >= 12 && r.height >= 12 && (/<(path|circle|rect|line|polyline|polygon|ellipse)/.test(r.paths ?? '') || /svg|data:image/.test(r.mask) || /svg|data:image/.test(r.background))), { rows, changedPixels: changed })
}
async function records(page) {
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => { const req = indexedDB.open('ttrpg-cluster-control', 1); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error) })
    try { const tx = db.transaction('workspace'), store = tx.objectStore('workspace'); const get = key => new Promise((resolve, reject) => { const req = store.get(key); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error) }); const [current, lastValid] = await Promise.all([get('current'), get('last-valid')]); return { current, lastValid } }
    finally { db.close() }
  })
}
async function screenshot(page, name) {
  const bytes = await page.screenshot({ path: join(out, name) })
  evidence.screenshots.push({ file: name, sha256: hash(bytes), viewport: page.viewportSize() })
}
async function mapFiles(page, label, measurePalette = false) {
  const trigger = page.getByRole('button', { name: /^Open map file actions for / })
  await keyboardFocus(page, trigger, `${label} Map files trigger`)
  await page.keyboard.press('Enter')
  const portal = page.locator('#workspace-header-map-files-panel')
  await expect(portal).toBeVisible()
  check(`${label}: Map files teleported outside header`, await portal.evaluate(el => !el.closest('header.workspace-header')), await portal.evaluate(el => ({ parent: el.parentElement?.tagName, colorScheme: getComputedStyle(el).colorScheme, background: getComputedStyle(el).backgroundColor })))
  const importAction = portal.getByRole('button', { name: 'Import JSON copy', exact: true })
  await keyboardFocus(page, importAction, `${label} Map files action`)
  if (measurePalette) await contrastSample(page, importAction, `${label} portal action`, { control: true, focus: true, boundaryRequired: false })
  await page.keyboard.press('Escape'); await expect(portal).toBeHidden()
  check(`${label}: Map files Escape returns focus`, await trigger.evaluate(el => document.activeElement === el), await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 300)))
}
async function openFields(page, label) {
  const trigger = page.getByRole('button', { name: 'Open field definitions', exact: true })
  await keyboardFocus(page, trigger, `${label} Fields trigger`)
  if (page.viewportSize().width === 1440) await page.keyboard.press('Enter'); else await trigger.tap()
  const dialog = fields(page); await expect(dialog).toBeVisible()
  check(`${label}: Fields body portal and modal entry focus`, await dialog.evaluate(el => el.parentElement === document.body && el.contains(document.activeElement)), await dialog.evaluate(el => ({ parent: el.parentElement?.tagName, native: el instanceof HTMLDialogElement, scheme: getComputedStyle(el).colorScheme, active: document.activeElement?.outerHTML.slice(0, 250) })))
  await page.keyboard.press('Shift+Tab')
  await page.waitForTimeout(60)
  const reverse = await dialog.evaluate(el => ({ contained: el.contains(document.activeElement), body: document.activeElement === document.body, active: document.activeElement?.outerHTML.slice(0, 400), interactiveBackground: document.activeElement !== document.body && !el.contains(document.activeElement) }))
  // Native Chrome can park document.activeElement at BODY when focus moves to browser chrome.
  // Record that observable boundary; do not turn the original strict containment failure into a pass.
  evidence.nativeModalFocus ??= []
  evidence.nativeModalFocus.push({ label, reverse })
  check(`${label}: reverse Tab does not focus an interactive background app control`, !reverse.interactiveBackground, reverse)
  if (reverse.body) {
    evidence.limits.push(`${label}: reverse Tab observed BODY; strict DOM containment was not established at that native/browser boundary.`)
    await page.evaluate(() => { window.__qaBackgroundModalClicks = []; document.addEventListener('click', event => { if (document.querySelector('#field-definitions-dialog[open]') && !event.target.closest('#field-definitions-dialog')) window.__qaBackgroundModalClicks.push(event.target.outerHTML.slice(0, 200)) }, { capture: true }) })
    await page.keyboard.press('Space')
    check(`${label}: native modal prevents background activation at BODY boundary`, await page.evaluate(() => window.__qaBackgroundModalClicks.length === 0), await page.evaluate(() => window.__qaBackgroundModalClicks))
  }
  await page.keyboard.press('Tab'); await page.waitForTimeout(60)
  check(`${label}: ordinary Tab re-enters Fields`, await dialog.evaluate(el => el.contains(document.activeElement)), await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 300)))
  return { dialog, trigger }
}
async function closeFields(page, trigger, label, dirty = false) {
  if (dirty) page.once('dialog', d => d.accept())
  await fields(page).getByRole('button', { name: 'Close field definitions', exact: true }).click()
  await expect(fields(page)).toHaveCount(0)
  check(`${label}: Fields returns focus`, await trigger.evaluate(el => document.activeElement === el), null)
}
async function nativePortal(page, label) {
  const { dialog, trigger } = await openFields(page, label)
  await dialog.getByRole('button', { name: 'New custom field', exact: true }).click()
  const input = dialog.getByLabel('Custom field label', { exact: true }), select = dialog.locator('#new-custom-field-type')
  await input.fill('Transient palette sample'); await select.selectOption('single-select')
  await keyboardFocus(page, input, `${label} native input`)
  await contrastSample(page, input, `${label} native input`, { control: true, focus: true })
  await keyboardFocus(page, select, `${label} native select`)
  await contrastSample(page, select, `${label} native select`, { control: true, focus: true })
  await contrastSample(page, dialog.getByRole('heading', { name: 'Field definitions', exact: true }), `${label} portal heading`)
  await overflow(page, `${label} portal`)
  return { dialog, trigger }
}
async function initializeRich(page) {
  await page.getByLabel('Jump Cluster', { exact: true }).fill('QA Theme Host')
  await page.getByLabel('First star system').fill('QA Host')
  await page.getByRole('button', { name: 'Create local workspace', exact: true }).click()
  await expect(page.locator('.system-map-svg')).toBeVisible()
  await expect(page.locator('.save-feedback').filter({ visible: true })).toContainText('Saved on this device')
  const toggle = page.getByRole('button', { name: /^Open map file actions for / })
  await toggle.click()
  const bytes = await readFile(join(out, 'rich-fixture.json'))
  evidence.identity['qa/rich-fixture.json'] = hash(bytes)
  page.once('dialog', async dialog => { evidence.importPreview = dialog.message(); await dialog.accept() })
  await page.getByLabel('Import map JSON', { exact: true }).setInputFiles({ name: 'rich-fixture.json', mimeType: 'application/json', buffer: bytes })
  await page.getByRole('button', { name: /^Close map file actions for / }).click()
  const hierarchyToggle = page.getByRole('button', { name: 'Hierarchy', exact: true })
  if (await hierarchyToggle.getAttribute('aria-expanded') !== 'true') await hierarchyToggle.click()
  await page.getByRole('navigation', { name: 'Star systems', exact: true }).getByRole('button', { name: 'Open QA Alpha system map', exact: true }).click()
  await expect(page.locator('.system-map-svg .orbit-ring')).toHaveCount(1)
  const snapshot = await records(page)
  const allNames = snapshot.current.cluster.systems.map(s => s.name)
  requireCheck('validated independent imported rich workspace renders', allNames.includes('QA Alpha') && allNames.includes('QA Beta') && await page.locator('.system-map-svg .system-object').count() === 3, { fixtureHash: hash(JSON.stringify(snapshot)), allNames, preview: evidence.importPreview })
  evidence.fixtures.push({ label: 'imported rich workspace', sha256: hash(JSON.stringify(snapshot)), systems: allNames })
}

async function paletteSamples(page, label, screenshotName) {
  await keyboardFocus(page, theme(page), `${label} theme action`)
  await contrastSample(page, theme(page), `${label} theme button`, { control: true, focus: true, text: false, boundaryRequired: false })
  await contrastSample(page, page.locator('.workspace-header-theme-status'), `${label} theme state text`)
  const icon = theme(page).locator('span').filter({ visible: true }).first()
  if (await icon.count()) await measure(page, icon, `${label} meaningful theme icon`, 'graphic', 'color')
  await mapFiles(page, label, true)
  const { trigger } = await nativePortal(page, label)
  if (screenshotName) await screenshot(page, screenshotName)
  await closeFields(page, trigger, label)
}
async function mapSamples(page, label) {
  await expect(page.locator('.system-map-svg')).toBeVisible()
  await measure(page, page.locator('.system-map-svg .object-name').first(), `${label} system map label`)
  await measure(page, page.locator('.system-map-svg .system-object-glyph').first(), `${label} system meaningful mark`, 'graphic', 'fill')
  await page.getByRole('button', { name: 'Back to Jump Cluster', exact: true }).click()
  await expect(page.locator('.cluster-map-svg')).toBeVisible()
  // Existing panels can obstruct route samples; use their actual public toggles before measurement.
  for (const name of ['Inspect', 'Hierarchy']) {
    const toggle = page.getByRole('button', { name, exact: true })
    if (await toggle.getAttribute('aria-expanded') === 'true') await toggle.click()
  }
  await measure(page, page.locator('.cluster-system-name').first(), `${label} cluster map label`)
  const route = page.locator('.cluster-route').first()
  await page.getByRole('toolbar', { name: 'Workspace navigation' }).getByRole('button', { name: 'Select', exact: true }).click()
  const normalWidth = await route.locator('.cluster-route-line').evaluate(el => getComputedStyle(el).strokeWidth)
  await route.focus(); await page.keyboard.press('Enter')
  await expect(route).toHaveClass(/is-selected/)
  const selectedWidth = await route.locator('.cluster-route-line').evaluate(el => getComputedStyle(el).strokeWidth)
  const unresolved = page.locator('.cluster-route.is-unresolved').first()
  const dash = await unresolved.locator('.cluster-route-line').evaluate(el => getComputedStyle(el).strokeDasharray)
  check(`${label}: selected/unknown route has non-color cues and a name`, parseFloat(selectedWidth) > parseFloat(normalWidth) && dash !== 'none' && !!await route.getAttribute('aria-label'), { normalWidth, selectedWidth, dash, name: await route.getAttribute('aria-label') })
  await measure(page, route.locator('.cluster-route-line'), `${label} selected route`, 'graphic', 'stroke')
  await measure(page, unresolved.locator('.cluster-route-line'), `${label} unresolved route`, 'graphic', 'stroke')
  await measure(page, page.locator('.cluster-exit-mark').first(), `${label} unknown exit mark`, 'graphic', 'stroke')
  await measure(page, route.locator('.cluster-route-label'), `${label} route label`)
  await page.getByRole('toolbar', { name: 'Workspace navigation' }).getByRole('button', { name: 'Navigate', exact: true }).click()
  await page.getByRole('button', { name: 'Hierarchy', exact: true }).click()
  await page.getByRole('navigation', { name: 'Star systems', exact: true }).getByRole('button', { name: 'Open QA Alpha system map', exact: true }).click()
  await expect(page.locator('.system-map-svg')).toBeVisible()
}
async function fieldsErrorAndOrbit(page, label) {
  if (!remainingOnly) {
  const { dialog, trigger } = await openFields(page, label)
  await dialog.getByRole('button', { name: 'Edit field definition', exact: true }).click()
  const choices = dialog.getByLabel('Atmosphere choices', { exact: true })
  const draft = 'Vacuum\nvacuum'
  await choices.fill(draft)
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  const before = await dialog.getByRole('alert').allTextContents()
  await contrastSample(page, dialog.getByRole('alert').first(), `${label} error text dark`)
  await page.emulateMedia({ colorScheme: 'light' }); await scheme(page, 'light', `${label}: open Fields follows OS before explicit choice`)
  check(`${label}: Fields draft/errors survive real OS theme event`, await choices.inputValue() === draft && JSON.stringify(await dialog.getByRole('alert').allTextContents()) === JSON.stringify(before), { draft: await choices.inputValue(), before, after: await dialog.getByRole('alert').allTextContents() })
  await contrastSample(page, dialog.getByRole('alert').first(), `${label} error text light`)
  page.once('dialog', d => d.dismiss())
  await dialog.getByRole('button', { name: 'Close field definitions', exact: true }).click()
  check(`${label}: cancelling Close retains invalid Fields draft/error`, await dialog.isVisible() && await choices.inputValue() === draft && JSON.stringify(await dialog.getByRole('alert').allTextContents()) === JSON.stringify(before), { lifecycle: 'stay in open dialog; confirmed Close discards, hidden/reopen retention not asserted' })
  await page.emulateMedia({ colorScheme: 'dark' }); await scheme(page, 'dark', `${label}: Fields returns to OS dark`)
  await closeFields(page, trigger, label, true)
  }
  const hierarchyToggle = page.getByRole('button', { name: 'Hierarchy', exact: true })
  if (await hierarchyToggle.getAttribute('aria-expanded') !== 'true') await hierarchyToggle.click()
  await page.getByRole('complementary', { name: 'System hierarchy' }).getByRole('button', { name: /Orbit 1 around QA Primary/ }).click()
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  const capture = async () => ({
    camera: await page.locator('.system-map-content').getAttribute('transform'),
    selected: await page.locator('.orbit-mark.is-selected').getAttribute('data-orbit-id'),
    tool: await page.getByRole('toolbar', { name: 'Workspace navigation' }).locator('[aria-pressed="true"]').allTextContents(),
    save: await page.locator('.save-feedback').filter({ visible: true }).allTextContents(),
  })
  const stateBefore = await capture(), dataBefore = await records(page)
  await theme(page).click(); await scheme(page, 'light', `${label}: Orbit/camera toggle light`)
  check(`${label}: Orbit selection/camera/tool/save survive theme`, !!stateBefore.selected && JSON.stringify(await capture()) === JSON.stringify(stateBefore) && JSON.stringify(await records(page)) === JSON.stringify(dataBefore), { before: stateBefore, after: await capture(), recordsSha256: hash(JSON.stringify(dataBefore)) })
  await theme(page).click(); await scheme(page, 'dark', `${label}: Orbit/camera toggle dark`)
  await measure(page, page.locator('.orbit-mark.is-selected .orbit-ring'), `${label} selected Orbit`, 'graphic', 'stroke')
}
async function runCases() {
  // Case 1: the first product request is genuinely cold; no fetch/health/inventory precedes it.
  let retained
  if (!remainingOnly) {
  const first = await fresh('desktop-light', { width: 1440, height: 900 }, 'light')
  try {
    const response = await first.page.goto(base)
    const html = await response.text(); await writeFile(join(out, continuation ? 'ssr-root-continuation.html' : 'ssr-root.html'), html)
    requireCheck(`${continuation ? 'warm continuation' : 'cold actual product'} SSR reachable through loopback`, response.ok() && html.includes('Opening this browser') && !html.includes('data-prototype-theme'), { status: response.status(), loadingShell: html.includes('Opening this browser'), htmlSha256: hash(html) })
    await expect(welcome(first.page)).toBeVisible({ timeout: 30000 })
    await scheme(first.page, 'light', 'desktop-light: initial OS and native scheme')
    if (!continuation) await glyph(first.page, 'cold OS-light dynamic glyph')
    await first.page.emulateMedia({ colorScheme: 'dark' }); await scheme(first.page, 'dark', 'desktop-light: follows changed OS')
    if (!continuation) await glyph(first.page, 'OS-dark alternate dynamic glyph')
    // One inventory pass follows actual cold product glyphs and precedes unrelated map journeys.
    if (!continuation) await inventory()
    await keyboardFocus(first.page, theme(first.page), 'desktop-light: named theme keyboard action')
    await first.page.keyboard.press('Enter'); await scheme(first.page, 'light', 'desktop-light: explicit keyboard choice')
    await first.page.emulateMedia({ colorScheme: 'dark' }); await scheme(first.page, 'light', 'desktop-light: explicit choice overrides later OS')
    await first.page.reload(); await expect(welcome(first.page)).toBeVisible(); await scheme(first.page, 'light', 'desktop-light: reload preserves explicit choice')
    await keyboardFocus(first.page, theme(first.page), 'desktop-light: changed Theme surface')
    if (!continuation) await screenshot(first.page, 'compiled-theme-light-1440x900.png')
    await initializeRich(first.page)
    await scheme(first.page, 'light', 'desktop-light: explicit choice survives creation and independent JSON import')
    await paletteSamples(first.page, 'desktop-light')
    await mapSamples(first.page, 'desktop-light')
    await overflow(first.page, 'desktop-light product')
    retained = await first.context.storageState({ indexedDB: true })
    // This context represents a new session of the same saved browser profile, with the opposite OS.
    const reopened = await fresh('fresh-storage-session', { width: 1440, height: 900 }, 'dark', retained)
    try {
      await reopened.page.goto(base); await expect(reopened.page.locator('.system-map-svg')).toBeVisible()
      await scheme(reopened.page, 'light', 'fresh saved-storage session keeps explicit preference despite OS dark')
      check('fresh saved-storage session loads real imported workspace', (await records(reopened.page)).current.cluster.systems.some(s => s.name === 'QA Alpha'), null)
    } finally { await reopened.context.close() }
  } finally { await first.context.close() }
  } else {
    // Required fixture setup only; completed light/cold observations are not repeated.
    const setup = await fresh('remaining-fixture-setup', { width: 1440, height: 900 }, 'light')
    try { await setup.page.goto(base); await expect(welcome(setup.page)).toBeVisible(); await initializeRich(setup.page); retained = await setup.context.storageState({ indexedDB: true }) }
    finally { await setup.context.close() }
  }
  // Case 2: retain validated workspace storage, remove only the browser preference in the test fixture.
  // This models a browser with no explicit choice so real OS events can exercise the open Fields draft.
  const osOnly = structuredClone(retained)
  for (const origin of osOnly.origins) origin.localStorage = origin.localStorage.filter(item => item.name !== 'nuxt-color-mode')
  const dark = await fresh('desktop-dark', { width: 1440, height: 900 }, 'dark', osOnly)
  try {
    await dark.page.goto(base); await expect(dark.page.locator('.system-map-svg')).toBeVisible()
    await scheme(dark.page, 'dark', 'desktop-dark: seeded workspace with no explicit preference')
    await dark.page.getByRole('button', { name: 'Back to Jump Cluster', exact: true }).click()
    await expect(dark.page.locator('.cluster-map-svg')).toBeVisible()
    const hierarchyToggle = dark.page.getByRole('button', { name: 'Hierarchy', exact: true })
    if (await hierarchyToggle.getAttribute('aria-expanded') !== 'true') await hierarchyToggle.click()
    await dark.page.getByRole('navigation', { name: 'Star systems', exact: true }).getByRole('button', { name: 'Open QA Alpha system map', exact: true }).click()
    await expect(dark.page.locator('.system-map-svg .orbit-ring')).toHaveCount(1)
    await fieldsErrorAndOrbit(dark.page, 'desktop-dark')
    await paletteSamples(dark.page, 'desktop-dark', 'compiled-fields-dark-1440x900.png')
    await mapSamples(dark.page, 'desktop-dark')
    await overflow(dark.page, 'desktop-dark product')
  } finally { await dark.context.close() }
  // Cases 3 and 4: pairwise compact representatives, not every form at every size.
  for (const scenario of [
    { label: 'compact-landscape-light', viewport: { width: 844, height: 390 }, expected: 'light' },
    { label: 'compact-portrait-dark', viewport: { width: 390, height: 844 }, expected: 'dark' },
  ]) {
    const { context, page } = await fresh(scenario.label, scenario.viewport, 'light', retained)
    try {
      await page.goto(base); await expect(page.locator('.system-map-svg')).toBeVisible()
      await setScheme(page, scenario.expected, `${scenario.label}: intended palette`)
      await theme(page).tap(); await scheme(page, scenario.expected === 'light' ? 'dark' : 'light', `${scenario.label}: actual touch theme activation`)
      await theme(page).tap(); await scheme(page, scenario.expected, `${scenario.label}: touch restores palette`)
      await keyboardFocus(page, theme(page), `${scenario.label} theme focus`)
      await contrastSample(page, theme(page), `${scenario.label} theme`, { control: true, focus: true, text: false, boundaryRequired: false })
      await mapFiles(page, scenario.label)
      const { dialog, trigger } = await openFields(page, scenario.label)
      await keyboardFocus(page, dialog.getByRole('button', { name: 'Close field definitions', exact: true }), `${scenario.label} Fields close`)
      await overflow(page, `${scenario.label} Fields`)
      await screenshot(page, `compiled-${scenario.label}-${scenario.viewport.width}x${scenario.viewport.height}.png`)
      await closeFields(page, trigger, scenario.label)
      if (scenario.viewport.width === 390) {
        await page.setViewportSize({ width: 390, height: 500 })
        await keyboardFocus(page, theme(page), 'compact reduced-height theme')
        const short = await openFields(page, 'compact reduced-height')
        await closeFields(page, short.trigger, 'compact reduced-height')
        await overflow(page, 'compact reduced-height')
      }
      await overflow(page, `${scenario.label} product`)
    } finally { await context.close() }
  }
}
async function inventory() {
  const names = new Map()
  const walk = async directory => {
    for (const item of await readdir(directory, { withFileTypes: true })) {
      const file = join(directory, item.name)
      if (item.isDirectory()) await walk(file)
      else if (/\.(vue|m?js|ts)$/.test(item.name)) {
        const source = await readFile(file, 'utf8')
        for (const match of source.matchAll(/i-lucide-([a-z0-9-]+)/g)) names.set(match[1], [...(names.get(match[1]) ?? []), file.slice(root.length + 1).replaceAll('\\', '/')])
      }
    }
  }
  await walk(join(root, 'components')); await walk(join(root, 'node_modules/@nuxt/ui/dist'))
  const config = await readFile(join(root, 'app.config.ts'), 'utf8')
  for (const match of config.matchAll(/i-lucide-([a-z0-9-]+)/g)) names.set(match[1], [...(names.get(match[1]) ?? []), 'app.config.ts'])
  const sorted = [...names.keys()].sort(), responses = []
  for (let i = 0; i < sorted.length; i += 30) {
    const requested = sorted.slice(i, i + 30)
    const response = await fetch(`${base}/api/_nuxt_icon/lucide.json?icons=${requested.join(',')}`, { cache: 'no-store' })
    let body; try { body = await response.json() } catch { body = {} }
    responses.push({ status: response.status, requested, resolved: requested.filter(name => typeof body.icons?.[name]?.body === 'string' && /<(path|circle|rect|line|polyline|polygon|ellipse)/.test(body.icons[name].body)), bodySha256: hash(JSON.stringify(body)) })
  }
  evidence.iconInventory = { method: 'one pass of application/config and installed Nuxt UI literal glyph names; package superset, not actual consumption count', names: Object.fromEntries([...names].sort()), count: sorted.length, buildClientCount: 'Coordinator observed 43 in development; independent build identity, no equality assertion against superset count.', responses }
  check('local collection returns actual SVG shapes for current literal/configured glyph superset', sorted.length > 0 && sorted.includes('sun') && sorted.includes('moon') && responses.every(row => row.status === 200 && row.resolved.length === row.requested.length), { count: sorted.length, failures: responses.filter(row => row.resolved.length !== row.requested.length) })
}

try {
  evidence.qaHelperSha256 = hash(await readFile(fileURLToPath(import.meta.url)))
  evidence.guardSha256 = hash(await readFile(join(out, 'network-guard.cjs')))
  for (const file of ['components/WorkspaceHeader.vue', 'components/WorkspaceWelcome.vue', 'components/FieldDefinitionsDialog.vue', 'components/ClusterMap.vue', 'components/SystemMap.vue', 'assets/css/main.css', 'assets/css/map-workspace.css', 'nuxt.config.ts', 'app.config.ts', 'package.json', 'package-lock.json', 'tests/workspace-theme.spec.ts', '.output/server/index.mjs', '.output/nitro.json', '.nuxt/icon-client-bundle.mjs']) {
    try { evidence.identity[file] = hash(await readFile(join(root, file))) }
    catch (error) { evidence.identity[file] = { unavailable: error.code } }
  }
  const guard = (await readFile(serverNetworkLog, 'utf8')).trim().split('\n').map(JSON.parse)
  requireCheck('actual compiled server preload and separate negative canary', guard.some(r => r.event === 'guard-installed') && guard.some(r => r.event === 'canary-passed' && r.label === 'server-guard-canary') && guard.some(r => r.event === 'denied' && r.label === 'server-guard-canary') && new Set(guard.map(r => r.pid)).size === 1, guard)
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'] })
  evidence.browser = { channel: 'chrome', version: browser.version(), headless: true, profile: 'fresh isolated contexts', deviceScaleFactor: 1 }
  const canary = await fresh('browser-guard-canary', { width: 1440, height: 900 }, 'light')
  let canaryFailed = false
  try { await canary.page.goto('https://example.com/qa-ticket19-negative-canary') } catch { canaryFailed = true }
  requireCheck('separate browser negative canary aborts external navigation', canaryFailed && evidence.network.some(r => r.label === 'browser-guard-canary' && r.event === 'denied'), evidence.network)
  await canary.context.close()
  await runCases()
  evidence.serverNetwork = (await readFile(serverNetworkLog, 'utf8')).trim().split('\n').map(JSON.parse)
  check('no normal product server egress attempts', !evidence.serverNetwork.some(r => r.event === 'denied' && r.label === 'compiled-server-egress'), evidence.serverNetwork.filter(r => r.label === 'compiled-server-egress'))
  check('no normal product browser egress attempts', !evidence.network.some(r => r.label !== 'browser-guard-canary'), evidence.network.filter(r => r.label !== 'browser-guard-canary'))
  check('no product console/hydration warnings or errors', evidence.console.filter(r => r.label !== 'browser-guard-canary').length === 0, evidence.console)
  check('no product page errors', evidence.pageerrors.filter(r => r.label !== 'browser-guard-canary').length === 0, evidence.pageerrors)
} catch (error) {
  evidence.failure = { message: error.message, stack: error.stack }
  check('bounded execution completes', false, evidence.failure)
} finally {
  if (browser) await browser.close()
  try { evidence.serverNetwork = (await readFile(serverNetworkLog, 'utf8')).trim().split('\n').map(JSON.parse) }
  catch (error) { evidence.serverNetworkReadFailure = error.message }
  await writeFile(join(out, process.env.QA_RESULTS_FILE ?? (remainingOnly ? 'presentation-remaining-results.json' : continuation ? 'presentation-continuation-results.json' : 'offline-and-presentation-results.json')), JSON.stringify(evidence, null, 2))
  console.log(JSON.stringify({ checks: evidence.checks.length, failures: evidence.checks.filter(c => !c.passed), contrastSamples: evidence.contrast.length, glyphSamples: evidence.glyphs.length, screenshots: evidence.screenshots, failure: evidence.failure?.message }, null, 2))
  if (evidence.checks.some(c => !c.passed)) process.exitCode = 1
}
