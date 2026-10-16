import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, expect } from '@playwright/test'

const out = dirname(fileURLToPath(import.meta.url))
await mkdir(out, { recursive: true })
const root = resolve(out, '../../../../..')
const base = process.env.QA_BASE_URL ?? 'http://127.0.0.1:3118'
const evidence = {
  timestamp: new Date().toISOString(), baseline: '3c660a6a2df6c37f392c998c36d72cec1ddbf938',
  runtime: 'Nuxt compiled .output/server/index.mjs; no development server', base,
  identity: {}, browser: '', checks: [], contrast: [], warnings: [], pageerrors: [],
  limitations: ['Current dark theme only; light belongs to ticket 19.', 'Physical Android Chrome, OS keyboard, safe areas and physical gestures unavailable.', 'Route-only timings on one candidate are not source-before/after or library cost measurements.'],
}
for (const file of ['pages/index.vue', 'components/WorkspaceWelcome.vue', 'components/BaselinePage.vue', 'assets/css/main.css', 'assets/css/map-workspace.css', 'composables/useLocalWorkspace.ts', 'utils/workspace-storage.ts', 'tests/workspace-launch.spec.ts', 'nuxt.config.ts', 'package-lock.json', '.output/server/index.mjs', '.output/nitro.json']) {
  evidence.identity[file] = createHash('sha256').update(await readFile(join(root, file))).digest('hex')
}
const check = (name, passed, detail) => {
  evidence.checks.push({ name, passed, detail })
  if (!passed) console.error(`FAIL ${name}: ${JSON.stringify(detail)}`)
}
const browser = await chromium.launch({ headless: true })
evidence.browser = `Playwright Chromium ${browser.version()}, headless, deviceScaleFactor=1`
const viewports = [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 390, height: 500 }]
const fresh = async (viewport) => {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: viewport.width !== 1440, colorScheme: 'dark' })
  const page = await context.newPage()
  page.on('pageerror', error => evidence.pageerrors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'warning' || message.type() === 'error') evidence.warnings.push({ type: message.type(), text: message.text() })
  })
  return { context, page }
}
const welcome = page => page.getByRole('heading', { name: 'Give the unknown a name.' })
const overflow = async (page, label) => check(`${label}: no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), await page.evaluate(() => ({ viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth })))
const focusCheck = async (page, locator, label) => {
  await locator.focus()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Shift+Tab')
  const visible = await locator.evaluate(el => {
    const r = el.getBoundingClientRect()
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
    const s = getComputedStyle(el)
    const extent = parseFloat(s.outlineWidth) + Math.max(0, parseFloat(s.outlineOffset))
    return document.activeElement === el && r.top >= extent - .1 && r.bottom <= innerHeight - extent + .1 && r.left >= extent - .1 && r.right <= innerWidth - extent + .1 && (hit === el || el.contains(hit)) && s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2
  })
  check(`${label}: focused and unobscured`, visible, await locator.evaluate(el => { const s = getComputedStyle(el); return { outline: `${s.outlineWidth} ${s.outlineStyle} ${s.outlineColor}`, outlineOffset: s.outlineOffset, scrollY, viewportHeight: innerHeight, bounds: el.getBoundingClientRect().toJSON() } }))
  if (!visible || label.startsWith('844x390')) await page.screenshot({ path: join(out, `${label.replaceAll(/[^a-z0-9]+/gi, '-')}-viewport.png`) })
}
const record = async (page, operation, value) => page.evaluate(async ({ operation, value }) => {
  const db = await new Promise((resolve, reject) => {
    const req = indexedDB.open('ttrpg-cluster-control', 1)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('workspace', operation === 'read' ? 'readonly' : 'readwrite')
      const store = tx.objectStore('workspace')
      let result
      if (operation === 'read') { const req = store.get('current'); req.onsuccess = () => { result = req.result } }
      else { store.put(value, 'last-valid'); store.put({ damaged: 'ticket-18-compiled-qa' }, 'current') }
      tx.oncomplete = () => resolve(result)
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally { db.close() }
}, { operation, value })

async function contrast(page, label) {
  // Sample rendered backgrounds, including gradients and transparent controls.
  const rows = await page.locator('main section').first().locator('h1, p, label, input, button, .section-kicker, .step-marker').evaluateAll(nodes => nodes.map((el, i) => {
    const s = getComputedStyle(el), r = el.getBoundingClientRect()
    return { i, tag: el.tagName, text: (el.textContent || el.getAttribute('aria-label') || el.getAttribute('name') || '').trim().slice(0, 100), color: s.color, border: s.borderTopColor, borderWidth: s.borderTopWidth, outline: s.outlineColor, outlineWidth: s.outlineWidth, x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height }
  }))
  const hide = await page.addStyleTag({ content: '* { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; }' })
  const pixels = (await page.screenshot({ fullPage: true })).toString('base64')
  await hide.evaluate(el => el.remove())
  const measured = await page.evaluate(async ({ rows, pixels }) => {
    const img = new Image(); img.src = `data:image/png;base64,${pixels}`; await img.decode()
    const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height
    const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0)
    const rgb = s => { const v = s.match(/[\d.]+/g).map(Number); return [v[0], v[1], v[2], v[3] ?? 1] }
    const at = (x, y) => Array.from(ctx.getImageData(Math.min(img.width - 1, Math.max(0, Math.round(x))), Math.min(img.height - 1, Math.max(0, Math.round(y))), 1, 1).data).slice(0, 3)
    const luminance = c => c.slice(0, 3).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((n, v, i) => n + v * [.2126, .7152, .0722][i], 0)
    const ratio = (foreground, bg) => { const f = rgb(foreground); const composed = f.slice(0, 3).map((v, i) => v * f[3] + bg[i] * (1 - f[3])); const a = luminance(composed), b = luminance(bg); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05) }
    return rows.filter(r => r.w && r.h).map(r => {
      const backgrounds = [.2, .5, .8].flatMap(x => [.25, .5, .75].map(y => at(r.x + r.w * x, r.y + r.h * y)))
      const textRatio = Math.min(...backgrounds.map(bg => ratio(r.color, bg)))
      const outside = at(r.x - 3, r.y + r.h / 2)
      const control = ['BUTTON', 'INPUT'].includes(r.tag)
      const controlRatio = control ? Math.max(ratio(r.border, outside), ratio(`rgb(${backgrounds[4].join(',')})`, outside)) : null
      const focusRatio = parseFloat(r.outlineWidth) >= 2 ? ratio(r.outline, outside) : null
      return { ...r, backgrounds, textRatio, textPass: textRatio >= 4.5, controlRatio, controlPass: controlRatio === null ? null : controlRatio >= 3, focusRatio, focusPass: focusRatio === null ? null : focusRatio >= 3 }
    })
  }, { rows, pixels })
  evidence.contrast.push({ label, method: 'computed foreground with nine actual rendered background samples; control border or fill against actual adjacent pixel; text 4.5, control/focus 3', measurements: measured })
  console.log(JSON.stringify({ contrast: label, failures: measured.filter(r => !r.textPass || r.controlPass === false || r.focusPass === false).map(r => ({ tag: r.tag, text: r.text, textRatio: r.textRatio, controlRatio: r.controlRatio, focusRatio: r.focusRatio, color: r.color, border: r.border, backgrounds: r.backgrounds })) }))
}

try {
  const response = await fetch(`${base}/`)
  const html = await response.text()
  await writeFile(join(out, 'ssr-root.html'), html)
  check('SSR HTTP response has loading shell', response.ok && html.includes('Opening this browser') && !html.includes('Give the unknown a name.'), { status: response.status, loadingShell: html.includes('Opening this browser'), creationForm: html.includes('id="cluster-name"') })
  for (const route of ['/?variant=baseline', '/']) {
    const { context, page } = await fresh(viewports[0])
    const started = performance.now()
    await page.goto(`${base}${route}`, { waitUntil: 'domcontentloaded' })
    const dom = performance.now() - started
    await welcome(page).waitFor()
    const ready = performance.now() - started
    await page.getByLabel('Jump Cluster').fill('Compiled Route Reach')
    await page.getByLabel('First star system').fill('Compiled Route Star')
    await page.getByRole('button', { name: 'Create local workspace' }).click()
    await page.getByText('Saved on this device').waitFor()
    await page.getByRole('group', { name: 'Compiled Route Star star system map' }).waitFor()
    check(`same-candidate route sample ${route}`, true, { context: 'fresh isolated/no stored workspace', viewport: viewports[0], input: 'mouse', domContentLoadedMs: dom, welcomeReadyMs: ready, savedMapReadyMs: performance.now() - started, navigation: await page.evaluate(() => performance.getEntriesByType('navigation')[0].toJSON()) })
    await context.close()
  }
  for (const viewport of viewports) {
    const name = `${viewport.width}x${viewport.height}`
    const { context, page } = await fresh(viewport)
    const cluster = `QA ${name} Reach`, star = `QA ${name} Star`
    await page.goto(base)
    await welcome(page).waitFor()
    await overflow(page, `${name} welcome`)
    await page.getByLabel('Jump Cluster').fill(cluster)
    await page.getByLabel('First star system').fill(star)
    await page.setViewportSize({ width: viewport.width === 390 ? 844 : 390, height: viewport.height === 390 ? 844 : 390 })
    await expect(page.getByLabel('Jump Cluster')).toHaveValue(cluster)
    await expect(page.getByLabel('First star system')).toHaveValue(star)
    await page.setViewportSize(viewport)
    check(`${name}: typed creation survives resize`, true, { cluster, star })
    await focusCheck(page, page.getByRole('button', { name: 'Create local workspace' }), `${name} creation button`)
    await page.screenshot({ path: join(out, `welcome-${name}.png`), fullPage: true })
    if (viewport.width === 1440) await contrast(page, 'welcome dark desktop')
    if (viewport.width === 1440) await page.keyboard.press('Enter')
    else await page.getByRole('button', { name: 'Create local workspace' }).tap()
    await page.getByText('Saved on this device').waitFor()
    await page.getByRole('heading', { name: star, level: 1 }).waitFor()
    const fixture = await record(page, 'read')
    check(`${name}: real saved fixture`, fixture?.cluster?.name === cluster && fixture?.cluster?.systems?.[0]?.name === star, { cluster: fixture?.cluster?.name, star: fixture?.cluster?.systems?.[0]?.name, recordHash: createHash('sha256').update(JSON.stringify(fixture)).digest('hex') })
    await page.reload()
    await page.getByRole('heading', { name: star, level: 1 }).waitFor()
    check(`${name}: create/save/reload`, true, { input: viewport.width === 1440 ? 'keyboard Enter' : 'touch tap after keyboard focus/scroll', context: 'isolated' })
    await record(page, 'damage', fixture)
    await page.reload()
    await page.getByRole('heading', { name: 'Your workspace could not be opened.' }).waitFor()
    await overflow(page, `${name} recovery`)
    await expect(page.getByLabel('Jump Cluster')).toHaveCount(0)
    await expect(page.getByRole('group', { name: `${star} star system map` })).toHaveCount(0)
    await focusCheck(page, page.getByRole('button', { name: 'Try again' }), `${name} retry button`)
    await page.keyboard.press('Enter')
    await page.getByRole('heading', { name: 'Your workspace could not be opened.' }).waitFor()
    await focusCheck(page, page.getByRole('button', { name: 'Restore last valid backup' }), `${name} restore button`)
    await page.screenshot({ path: join(out, `recovery-${name}.png`), fullPage: true })
    if (viewport.width === 1440) await contrast(page, 'recovery dark desktop')
    if (viewport.width === 1440) await page.keyboard.press('Enter')
    else await page.getByRole('button', { name: 'Restore last valid backup' }).tap()
    await page.getByRole('heading', { name: star, level: 1 }).waitFor()
    await page.reload()
    await page.getByRole('heading', { name: star, level: 1 }).waitFor()
    check(`${name}: recovery retry/restore/reload`, true, { fixture: 'real created valid workspace copied to last-valid; damaged current', input: 'keyboard Tab/ShiftTab and Enter' })
    await context.close()
  }
  check('No page errors', evidence.pageerrors.length === 0, evidence.pageerrors)
  check('No hydration warnings', !evidence.warnings.some(w => /hydrat/i.test(w.text)), evidence.warnings)
} catch (error) {
  check('QA execution completed', false, { message: error.message, stack: error.stack })
} finally {
  await browser.close()
  await writeFile(join(out, 'results.json'), JSON.stringify(evidence, null, 2))
  console.log(JSON.stringify({ checks: evidence.checks.length, failures: evidence.checks.filter(c => !c.passed), warnings: evidence.warnings, pageerrors: evidence.pageerrors, output: join(out, 'results.json') }, null, 2))
}
if (evidence.checks.some(c => !c.passed)) process.exitCode = 1
