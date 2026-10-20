import { chromium, expect } from '@playwright/test'
import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..')
const out = process.env.QA_HOST_OUTPUT_ROOT?.replaceAll('\\', '/')
if (!out?.startsWith('C:/Users/fbal-fontaine/AppData/Local/Temp/ticket23-direct-') || out.includes('/../')) throw new Error('Fresh literal host TEMP required')
if (process.env.QA_RUNTIME_RELEASE !== 'compiled' || !process.env.QA_CANDIDATE || !process.env.QA_SOURCE_IDENTITY) throw new Error('Explicit compiled release required')
const identity = JSON.parse(await readFile(process.env.QA_SOURCE_IDENTITY, 'utf8'))
if (identity.candidate !== process.env.QA_CANDIDATE) throw new Error('Candidate mismatch')
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
async function hashes() { return Promise.all(identity.files.map(async file => ({ path: file.path, expected: file.sha256.toLowerCase(), actual: sha(await readFile(resolve(repo, file.path))) }))) }
if ((await hashes()).some(file => file.expected !== file.actual)) throw new Error('Source changed before capture')
await mkdir(out, { recursive: true })
const result = { candidate: identity.candidate, baseline: identity.baseline, base: 'http://127.0.0.1:3180', checks: [], cases: [], pageerrors: [], limitations: ['Two relevant root views only; accepted B/Dock composition is unchanged.', 'Browser emulation does not certify physical Android Chrome, OS keyboard, safe areas or physical gestures.'] }
const persist = () => writeFile(join(out, 'capture-results.json'), JSON.stringify(result, null, 2) + '\n')
function check(name, passed, detail = null) { result.checks.push({ name, passed, detail }); expect(passed, name).toBe(true) }
async function hit(locator) {
  await expect(locator).toBeVisible()
  return locator.evaluate(el => { const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, top = document.elementFromPoint(x, y); return { bounds: r.toJSON(), ordinaryHit: x >= 0 && y >= 0 && x < innerWidth && y < innerHeight && !!top && (top === el || el.contains(top)) } })
}
async function click(locator) { check('ordinary control hit', (await hit(locator)).ordinaryHit); await locator.click() }
async function tabTo(page, locator) {
  for (let index = 0; index < 60; index++) {
    if (await locator.evaluate(el => el === document.activeElement && el.matches(':focus-visible'))) { check('natural visible keyboard focus', (await hit(locator)).ordinaryHit); return }
    await page.keyboard.press('Tab')
  }
  throw new Error('Natural Tab did not reach requested control')
}
async function exportSystem(page) {
  await page.getByRole('button', { name: 'Map files', exact: true }).click()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export star system JSON', exact: true }).click()])
  const stream = await download.createReadStream(), chunks = []; for await (const chunk of stream) chunks.push(chunk)
  const bytes = Buffer.concat(chunks), data = JSON.parse(bytes)
  const files = page.getByRole('button', { name: 'Map files', exact: true }); if (await files.getAttribute('aria-expanded') === 'true') await files.click()
  return { data, sha256: sha(bytes) }
}
async function mapClick(page, map, point) {
  for (let index = 0; index < 64; index++) {
    const target = await map.evaluate((el, point) => { const m = el.querySelector('.system-map-content').getScreenCTM(), p = new DOMPoint(64 + point.x * 832, 72 + point.y * 416).matrixTransform(m), x = Math.floor(p.x), y = Math.floor(p.y), top = document.elementFromPoint(x, y); return { x, y, hit: x >= 0 && y >= 0 && x < innerWidth && y < innerHeight && !!top && el.contains(top) } }, point)
    if (target.hit) { await page.mouse.click(target.x, target.y); return target }
    const out = page.getByRole('toolbar', { name: 'Map zoom controls', exact: true }).getByRole('button', { name: 'Zoom out', exact: true })
    if (await out.isDisabled()) break
    await out.click()
  }
  throw new Error('Public Zoom out could not expose target')
}
const browser = await chromium.launch({ channel: 'chrome', headless: true }); result.browser = browser.version()
try {
  for (const info of [{ id: 'direct-desktop-light', width: 1440, height: 900, dark: false }, { id: 'numeric-mobile-dark', width: 390, height: 844, dark: true }]) {
    const context = await browser.newContext({ viewport: { width: info.width, height: info.height }, hasTouch: info.width < 1024, reducedMotion: 'reduce', deviceScaleFactor: 1, serviceWorkers: 'block' })
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true })
    const page = await context.newPage(); page.on('pageerror', error => result.pageerrors.push({ id: info.id, message: error.message }))
    let failed = false
    try {
      await page.goto(result.base)
      await page.getByLabel('Jump Cluster', { exact: true }).fill('Direct Add presentation')
      await page.getByLabel('First star system', { exact: true }).fill('QA star')
      await page.getByRole('button', { name: 'Create local workspace', exact: true }).click()
      const map = page.locator('svg.system-map-svg'); await expect(map).toBeVisible()
      const isDark = await page.locator('html').evaluate(el => el.classList.contains('dark'))
      if (isDark !== info.dark) await page.getByRole('button', { name: /^Switch to (light|dark) mode$/ }).click()
      const inspector = page.locator('#workspace-inspector-panel'); if (await inspector.isVisible()) await click(inspector.getByRole('button', { name: 'Close inspector panel', exact: true }))
      await click(page.getByRole('button', { name: 'Add to map', exact: true }))
      await click(page.getByRole('region', { name: 'Object palette', exact: true }).getByRole('button', { name: 'Add Planet', exact: true }))
      const controls = page.getByRole('group', { name: 'Planet creation controls', exact: true })
      let surface = controls
      if (info.dark) {
        await click(controls.getByRole('button', { name: 'Placement', exact: true }))
        surface = page.getByRole('form', { name: 'Placement', exact: true })
        await surface.getByLabel('Placement X', { exact: true }).fill('0.3')
        await surface.getByLabel('Placement Y', { exact: true }).fill('0.7')
        const add = surface.getByRole('button', { name: 'Add', exact: true })
        await expect(surface.getByLabel('Placement X', { exact: true })).toHaveValue('0.3')
        await expect(surface.getByLabel('Placement Y', { exact: true })).toHaveValue('0.7')
        await expect(page.getByRole('button', { name: /^(Preview placement|Confirm placement)$/ })).toHaveCount(0)
        await tabTo(page, add); check('numeric Add ordinary hit', (await hit(add)).ordinaryHit)
        const geometry = await surface.evaluate(el => ({ bounds: el.getBoundingClientRect().toJSON(), pageWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth }))
        check('numeric form within compact viewport', geometry.bounds.left >= 0 && geometry.bounds.top >= 0 && geometry.bounds.right <= info.width && geometry.bounds.bottom <= info.height && geometry.pageWidth <= info.width, geometry)
        await page.screenshot({ path: join(out, `${info.id}.png`) })
        await add.click()
      } else {
        await mapClick(page, map, { x: 0.25, y: 0.2 })
        await mapClick(page, map, { x: 0.65, y: 0.7 })
        await expect(page.getByRole('button', { name: 'Confirm placement', exact: true })).toHaveCount(0)
        const placement = controls.getByRole('button', { name: 'Placement', exact: true })
        await tabTo(page, placement)
        check('desktop has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        await page.screenshot({ path: join(out, `${info.id}.png`) })
      }
      const exported = await exportSystem(page)
      const planets = exported.data.system.objects.filter(object => object.subtype === 'planet')
      check('direct publication exact count', planets.length === (info.dark ? 1 : 2), { count: planets.length })
      check('type remains armed', await controls.isVisible())
      result.cases.push({ ...info, screenshot: `${info.id}.png`, exportSha256: exported.sha256, systemId: exported.data.system.id, planets })
    } catch (error) { failed = true; result.checks.push({ name: `${info.id}: execution`, passed: false, detail: error.message }); await page.screenshot({ path: join(out, `${info.id}-failure.png`) }).catch(() => {}); throw error }
    finally { await context.tracing.stop(failed ? { path: join(out, `${info.id}-failure.zip`) } : undefined).catch(() => {}); await context.close(); await persist() }
  }
} finally {
  await browser.close(); result.finalSourceHashes = await hashes(); check('released source unchanged', result.finalSourceHashes.every(file => file.expected === file.actual))
  result.status = result.checks.some(row => !row.passed) || result.pageerrors.length ? 'failed' : 'passed'; await persist()
}
if (result.status === 'failed') process.exitCode = 1
