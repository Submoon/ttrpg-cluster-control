import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, expect } from '@playwright/test'

const out = dirname(fileURLToPath(import.meta.url))
const root = resolve(out, '../../../../..')
const baseURL = 'http://127.0.0.1:3180'
const evidence = {
  timestamp: new Date().toISOString(), baseline: '28278d90c462fcc0542088513ebd8cf07c7eeaa4',
  route: '/', baseURL, runtime: 'compiled .output/server/index.mjs', browser: null,
  source: {}, checks: [], contrast: [], console: [], pageerrors: [], screenshots: [],
  limits: [
    'B has no matching welcome/loading/recovery fixture; only applicable brand, palette and density are compared.',
    'Loaded map/Dock fidelity, historic Orbit resize and unresolved-exit failures remain outside ticket 18.',
    'Touch and viewport emulation do not prove physical Android Chrome keyboard, safe-area or gesture behavior.',
    'Contrast is a bounded sample of changed launch input/button/error/focus, not an application-wide audit.',
  ],
}
const check = (name, passed, detail) => {
  evidence.checks.push({ name, passed, detail })
  if (!passed) throw new Error(`${name}: ${JSON.stringify(detail)}`)
}
for (const file of ['components/WorkspaceWelcome.vue', 'components/WorkspaceHeader.vue', 'components/BaselinePage.vue', 'pages/index.vue', 'assets/css/main.css', 'assets/css/map-workspace.css', 'composables/useLocalWorkspace.ts', 'utils/workspace-storage.ts', 'tests/workspace-launch.spec.ts', 'tests/workspace-recovery.spec.ts', '.output/server/index.mjs']) {
  evidence.source[file] = createHash('sha256').update(await readFile(resolve(root, file))).digest('hex')
}
const browser = await chromium.launch({ channel: 'chrome', headless: true })
evidence.browser = { version: browser.version(), channel: 'chrome', headless: true, deviceScaleFactor: 1, profile: 'fresh isolated contexts' }
const welcome = page => page.getByRole('heading', { name: 'Give the unknown a name.' })
const unavailable = page => page.getByRole('heading', { name: 'Your workspace could not be opened.' })

async function keyboardFocus(page, locator, label) {
  // Use ordinary sequential keyboard navigation; never force an action through an overlay.
  for (let step = 0; step < 16; step++) {
    await page.keyboard.press('Tab')
    if (await locator.evaluate(el => document.activeElement === el)) break
  }
  const detail = await locator.evaluate(el => {
    const r = el.getBoundingClientRect(), s = getComputedStyle(el)
    const extent = Math.max(0, parseFloat(s.outlineWidth) || 0) + Math.max(0, parseFloat(s.outlineOffset) || 0)
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
    return {
      focused: document.activeElement === el, bounds: r.toJSON(), viewport: { width: innerWidth, height: innerHeight },
      unobscured: hit === el || el.contains(hit), outline: s.outlineStyle, outlineWidth: s.outlineWidth,
      outlineColor: s.outlineColor, outlineOffset: s.outlineOffset, boxShadow: s.boxShadow,
      fullyVisible: r.top >= extent - .1 && r.bottom <= innerHeight - extent + .1 && r.left >= extent - .1 && r.right <= innerWidth - extent + .1,
    }
  })
  check(label, detail.focused && detail.unobscured && detail.fullyVisible && detail.outline !== 'none' && parseFloat(detail.outlineWidth) >= 2, detail)
  await locator.click({ trial: true })
}

async function noOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({ clientWidth: innerWidth, scrollWidth: document.documentElement.scrollWidth }))
  check(label, dimensions.scrollWidth <= dimensions.clientWidth + 1, dimensions)
}

async function contrastSample(page, locator, label, { control = false, focus = false } = {}) {
  await locator.scrollIntoViewIfNeeded()
  if (await locator.evaluate(el => el.tagName === 'INPUT' && document.activeElement === el)) await page.keyboard.press('ArrowRight')
  // Color transitions can remain active despite reduced-motion preference; sample the settled painted state.
  await page.waitForTimeout(200)
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
  evidence.contrast.push({ label, method: 'computed foreground composited against three glyph-suppressed rendered pixels; border or fill against adjacent rendered pixel; focus outline against outside rendered pixel', ...measured })
  check(`${label}: text >=4.5`, measured.textRatio >= 4.5, measured.textRatio)
  if (control) check(`${label}: control >=3`, measured.controlRatio >= 3, measured.controlRatio)
  if (focus) check(`${label}: focus >=3`, measured.focusRatio >= 3, measured.focusRatio)
}

try {
  const response = await fetch(baseURL)
  const html = await response.text()
  await writeFile(resolve(out, 'ssr-root.html'), html)
  check('SSR returns loading shell without editable creation/map data', response.ok && html.includes('Opening this browser') && !html.includes('name="clusterName"'), { status: response.status, loadingShell: html.includes('Opening this browser'), creationInput: html.includes('name="clusterName"') })
  for (const theme of ['light', 'dark']) {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 390, height: 500 }]) {
      const id = `${theme} ${viewport.width}x${viewport.height}`
      const context = await browser.newContext({ viewport, colorScheme: theme, deviceScaleFactor: 1, hasTouch: viewport.width !== 1440, reducedMotion: 'reduce' })
      const page = await context.newPage()
      page.on('pageerror', error => evidence.pageerrors.push({ id, text: error.message }))
      page.on('console', message => { if (['warning', 'error'].includes(message.type())) evidence.console.push({ id, type: message.type(), text: message.text() }) })
      try {
        await page.goto(baseURL)
        await expect(welcome(page)).toBeVisible({ timeout: 30000 })
        check(`${id}: client welcome and intended theme`, await page.evaluate(t => document.documentElement.classList.contains(t), theme), { fixture: 'empty isolated IndexedDB', viewport, theme, input: viewport.width === 1440 ? 'keyboard/mouse' : 'keyboard/touch emulation' })
        await noOverflow(page, `${id}: welcome no horizontal overflow`)
        const create = page.getByRole('button', { name: 'Create local workspace' })
        const cluster = page.getByLabel('Jump Cluster')
        await cluster.fill('')
        await page.getByLabel('First star system').fill('')
        await create.click()
        await expect(cluster).toBeFocused()
        check(`${id}: native validation focuses required name`, await cluster.evaluate(el => el.required && !el.validity.valid), null)
        await cluster.fill('Presentation Reach')
        await page.getByLabel('First star system').fill('Presentation Star')
        const themeToggle = page.getByRole('button', { name: /Switch to (light|dark) mode/i })
        await themeToggle.click()
        await expect(cluster).toHaveValue('Presentation Reach')
        await page.getByRole('button', { name: /Switch to (light|dark) mode/i }).click()
        await expect(page.getByLabel('First star system')).toHaveValue('Presentation Star')
        check(`${id}: theme action retains entered names`, await page.evaluate(t => document.documentElement.classList.contains(t), theme), { input: 'ordinary hit-tested theme clicks' })
        await keyboardFocus(page, create, `${id}: Create keyboard focus/hit test`)
        if (viewport.width === 1440) {
          await keyboardFocus(page, cluster, `${id}: input focus for contrast`)
          await contrastSample(page, cluster, `${id}: input`, { control: true, focus: true })
          await keyboardFocus(page, create, `${id}: Create focus for contrast`)
          await contrastSample(page, create, `${id}: Create button`, { control: true, focus: true })
        }
        if (theme === 'dark' && viewport.width === 1440) {
          await page.evaluate(() => scrollTo(0, 0))
          const name = 'compiled-welcome-dark-1440x900.png'; await page.screenshot({ path: resolve(out, name), fullPage: true }); evidence.screenshots.push(name)
        }
        // Isolated presentation fixture only. The focused repository tests own valid creation/restore journeys.
        await page.evaluate(async () => {
          const db = await new Promise((resolve, reject) => { const req = indexedDB.open('ttrpg-cluster-control', 1); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error) })
          try { await new Promise((resolve, reject) => { const tx = db.transaction('workspace', 'readwrite'); tx.objectStore('workspace').put({ damaged: 'ticket18-resume-presentation' }, 'current'); tx.objectStore('workspace').delete('last-valid'); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error) }) } finally { db.close() }
        })
        await page.reload()
        await expect(unavailable(page)).toBeVisible()
        await expect(page.getByLabel('Jump Cluster')).toHaveCount(0)
        await noOverflow(page, `${id}: recovery no horizontal overflow`)
        const retry = page.getByRole('button', { name: 'Try again' })
        await keyboardFocus(page, retry, `${id}: Try again keyboard focus/hit test`)
        await retry.click()
        await expect(unavailable(page)).toBeVisible()
        const restore = page.getByRole('button', { name: 'Restore last valid backup' })
        await keyboardFocus(page, restore, `${id}: Restore keyboard focus/hit test`)
        if (viewport.width === 1440) await contrastSample(page, restore, `${id}: recovery action`, { control: true, focus: true })
        if (viewport.width === 1440) await restore.click()
        else await restore.tap()
        const alert = page.getByRole('alert')
        await expect(alert).toContainText('No local backup is available to restore.')
        await noOverflow(page, `${id}: failed recovery no horizontal overflow`)
        if (viewport.width === 1440) await contrastSample(page, alert, `${id}: error text`)
        if (theme === 'light' && viewport.width === 844) {
          await keyboardFocus(page, restore, `${id}: failed restore retains reachable action`)
          const name = 'compiled-recovery-light-844x390.png'; await page.screenshot({ path: resolve(out, name), fullPage: true }); evidence.screenshots.push(name)
        }
      } finally { await context.close() }
    }
  }
  check('No application page errors', evidence.pageerrors.length === 0, evidence.pageerrors)
  check('No application console warnings/errors including hydration', evidence.console.length === 0, evidence.console)
} catch (error) {
  evidence.failure = { message: error.message, stack: error.stack }
  process.exitCode = 1
} finally {
  await browser.close()
  await writeFile(resolve(out, 'presentation-results.json'), JSON.stringify(evidence, null, 2))
  console.log(JSON.stringify({ checks: evidence.checks.length, failed: evidence.checks.filter(c => !c.passed), error: evidence.failure?.message, pageerrors: evidence.pageerrors.length, warnings: evidence.console.length, screenshots: evidence.screenshots }))
}
