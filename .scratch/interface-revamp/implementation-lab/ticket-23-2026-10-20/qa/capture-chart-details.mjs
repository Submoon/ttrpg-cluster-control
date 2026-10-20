// Bounded actual-product capture. Requires a separate coordinator runtime release.
import { chromium, expect } from '@playwright/test'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..')
const out = process.env.QA_HOST_OUTPUT_ROOT?.replaceAll('\\', '/')
if (!out?.startsWith('C:/Users/fbal-fontaine/AppData/Local/Temp/ticket23-') || out.includes('/../')) throw new Error('Fresh literal ticket23 host output required')
if (!['development', 'compiled'].includes(process.env.QA_RUNTIME_RELEASE) || !process.env.QA_CANDIDATE || !process.env.QA_SOURCE_IDENTITY) throw new Error('Explicit candidate, identity and runtime release required')
const identity = JSON.parse(await readFile(process.env.QA_SOURCE_IDENTITY, 'utf8'))
if (identity.candidate !== process.env.QA_CANDIDATE || !identity.files?.length) throw new Error('Candidate identity mismatch')
const sha = value => createHash('sha256').update(value).digest('hex')
async function hashes() {
  return Promise.all(identity.files.map(async file => ({ path: file.path, expected: file.sha256, actual: sha(await readFile(resolve(repo, file.path))) })))
}
if ((await hashes()).some(file => file.expected.toLowerCase() !== file.actual)) throw new Error('Released source mismatch')
await mkdir(out, { recursive: true })
const base = process.env.QA_BASE_URL || (process.env.QA_RUNTIME_RELEASE === 'compiled' ? 'http://127.0.0.1:3180' : 'http://127.0.0.1:3100')
const cases = [
  { id: 'chart-portrait-dark', width: 390, height: 844, theme: 'dark' },
  { id: 'chart-desktop-light', width: 1440, height: 900, theme: 'light' },
]
const requested = process.env.QA_CHART_CASES?.split(',').filter(Boolean) || cases.map(row => row.id)
if (requested.some(id => !cases.some(row => row.id === id))) throw new Error('Unknown bounded Chart details case')
const result = { candidate: identity.candidate, baseline: identity.baseline, runtime: process.env.QA_RUNTIME_RELEASE, base, started: new Date().toISOString(), scriptSha256: sha(await readFile(fileURLToPath(import.meta.url))), cases: [], checks: [], screenshots: [], fixtures: [], pageerrors: [], limitations: ['Two actual-product Chart details views only; no B visual vote or shell matrix.', 'Fresh isolated browser storage; public workspace creation and actual JSON download.', 'Padding/stat alignment and ordinary hit/focus observations do not certify visual fidelity.', 'Physical Android Chrome, OS keyboard, safe areas and physical gestures unavailable.'] }
const check = (name, passed, detail = null) => { result.checks.push({ name, passed, detail }); expect(passed, name).toBe(true) }
const persist = () => writeFile(join(out, 'chart-details-results.json'), JSON.stringify(result, null, 2) + '\n')
async function hit(locator) {
  await expect(locator).toBeVisible()
  return locator.evaluate(el => {
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, top = document.elementFromPoint(x, y)
    return { bounds: r.toJSON(), ordinaryHit: x >= 0 && y >= 0 && x < innerWidth && y < innerHeight && !!top && (top === el || el.contains(top)) }
  })
}
async function click(locator, name) {
  const evidence = await hit(locator)
  check(name, evidence.ordinaryHit, evidence)
  await locator.click()
}
async function exportSystem(page, info) {
  await page.getByRole('button', { name: 'Map files', exact: true }).click()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export star system JSON', exact: true }).click()])
  const stream = await download.createReadStream(), chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  const bytes = Buffer.concat(chunks), document = JSON.parse(bytes.toString('utf8'))
  result.fixtures.push({ caseId: info.id, source: 'Actual public workspace creation and downloaded standalone system JSON', sha256: sha(bytes), suggestedFilename: download.suggestedFilename(), systemId: document.system?.id, systemName: document.system?.name, objects: document.system?.objects?.map(({ id, name, subtype }) => ({ id, name, subtype })), orbitCount: document.system?.orbits?.length })
}
const browser = await chromium.launch({ channel: 'chrome', headless: true })
result.browser = browser.version()
try {
  for (const info of cases.filter(row => requested.includes(row.id))) {
    const context = await browser.newContext({ viewport: { width: info.width, height: info.height }, colorScheme: info.theme, hasTouch: info.width < 1024, deviceScaleFactor: 1, reducedMotion: 'reduce', serviceWorkers: 'block' })
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true })
    const page = await context.newPage()
    page.on('pageerror', error => result.pageerrors.push({ caseId: info.id, message: error.message }))
    let failed = false
    try {
      await page.goto(base)
      await page.getByLabel('Jump Cluster', { exact: true }).fill('Chart details QA Reach')
      const dark = await page.locator('html').evaluate(el => el.classList.contains('dark'))
      if (dark !== (info.theme === 'dark')) await page.getByRole('button', { name: /^Switch to (light|dark) mode$/ }).click()
      await expect.poll(() => page.locator('html').evaluate(el => el.classList.contains('dark'))).toBe(info.theme === 'dark')
      await page.getByLabel('First star system', { exact: true }).fill('Vesper Meridian Survey')
      await page.getByRole('button', { name: 'Create local workspace', exact: true }).click()
      await expect(page.locator('svg.system-map-svg')).toBeVisible()
      const panel = page.locator('#workspace-inspector-panel')
      if (await panel.isVisible()) await panel.getByRole('button', { name: 'Close inspector panel', exact: true }).click()
      const inspect = page.getByRole('button', { name: 'Inspect', exact: true })
      await inspect.click()
      await expect(panel).toBeVisible()
      const chart = panel.getByRole('button', { name: 'Chart details', exact: true }).and(panel.locator('button.chart-details-control'))
      await expect(chart).toHaveAccessibleName('Chart details')
      await expect(chart).toHaveText('Chart details')
      check(`${info.id}: visible Chart details header ordinary hit`, (await hit(chart)).ordinaryHit)
      if (await chart.getAttribute('aria-pressed') !== 'true') await click(chart, `${info.id}: Chart details activation`)
      await expect(chart).toHaveAttribute('aria-pressed', 'true')
      const card = panel.getByRole('region', { name: 'Star System details', exact: true })
      await expect(card.getByRole('heading', { name: 'Vesper Meridian Survey', exact: true })).toBeVisible()
      const stats = card.getByRole('region', { name: 'Star System statistics', exact: true })
      await expect(stats.locator('strong')).toHaveText(['1', '1', '0'])
      const geometry = await card.evaluate(el => {
        const rect = node => node.getBoundingClientRect().toJSON()
        const heading = el.querySelector('h2'), intro = el.querySelector('.inspector-intro'), stats = el.querySelector('.orbit-facts')
        const body = stats.parentElement, header = heading.closest('.chart-details-card-heading').parentElement
        const labels = [...stats.querySelectorAll(':scope > span')].map(node => ({ text: node.textContent, bounds: rect(node) }))
        const values = [...stats.querySelectorAll(':scope > strong')].map(node => ({ text: node.textContent, bounds: rect(node), textAlign: getComputedStyle(node).textAlign }))
        const padding = node => ({ left: parseFloat(getComputedStyle(node).paddingLeft), right: parseFloat(getComputedStyle(node).paddingRight), top: parseFloat(getComputedStyle(node).paddingTop), bottom: parseFloat(getComputedStyle(node).paddingBottom) })
        return { card: rect(el), heading: rect(heading), intro: rect(intro), stats: rect(stats), headerPadding: padding(header), bodyPadding: padding(body), labels, values, pageScrollWidth: document.documentElement.scrollWidth, viewport: { width: innerWidth, height: innerHeight } }
      })
      check(`${info.id}: card header/body padding`, geometry.headerPadding.left >= 16 && geometry.headerPadding.right >= 16 && geometry.bodyPadding.left >= 16 && geometry.bodyPadding.right >= 16, geometry)
      check(`${info.id}: statistic columns aligned and contained`, geometry.labels.every(row => Math.abs(row.bounds.left - geometry.labels[0].bounds.left) <= 1) && geometry.values.every(row => Math.abs(row.bounds.right - geometry.values[0].bounds.right) <= 1 && row.bounds.right <= geometry.stats.right + 1), { labels: geometry.labels, values: geometry.values })
      check(`${info.id}: no horizontal document overflow`, geometry.pageScrollWidth <= info.width, { pageScrollWidth: geometry.pageScrollWidth, viewportWidth: info.width })
      const edit = card.getByRole('button', { name: 'Edit chart names', exact: true })
      let focused = false
      for (let index = 0; index < 30; index++) {
        await page.keyboard.press('Tab')
        if (await edit.evaluate(el => el === document.activeElement && el.matches(':focus-visible'))) { focused = true; break }
      }
      const focus = await edit.evaluate(el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return { bounds: r.toJSON(), outline: s.outline, shadow: s.boxShadow, viewport: { width: innerWidth, height: innerHeight }, contained: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight } })
      check(`${info.id}: natural visible keyboard focus`, focused && focus.contained, focus)
      check(`${info.id}: Edit chart names ordinary hit`, (await hit(edit)).ordinaryHit)
      const close = panel.getByRole('button', { name: 'Close inspector panel', exact: true })
      check(`${info.id}: top close ordinary hit`, (await hit(close)).ordinaryHit)
      await page.mouse.move(0, 0)
      const file = `${info.id}.png`
      await page.screenshot({ path: join(out, file) })
      result.screenshots.push({ ...info, file, geometry, focus })
      await click(close, `${info.id}: ordinary close activation`)
      await expect(panel).toBeHidden()
      if (info.width < 1024) {
        await expect(inspect).toBeFocused()
        check(`${info.id}: compact close returns focus to Inspect`, true, await inspect.evaluate(el => ({ name: el.getAttribute('aria-label') || el.textContent, focused: el === document.activeElement })))
      } else {
        const afterClose = await page.evaluate(() => ({ tag: document.activeElement?.tagName, name: document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent?.slice(0, 80) }))
        let reachable = false
        for (let index = 0; index < 30; index++) {
          await page.keyboard.press('Tab')
          if (await inspect.evaluate(el => el === document.activeElement && el.matches(':focus-visible'))) { reachable = true; break }
        }
        check(`${info.id}: desktop Inspect remains keyboard reachable`, reachable, { afterClose, hit: await hit(inspect) })
        await inspect.press('Enter')
        await expect(panel).toBeVisible()
        await expect(card).toBeVisible()
        check(`${info.id}: desktop Inspect reopens after ordinary close`, true)
      }
      await exportSystem(page, info)
      result.cases.push({ ...info, completed: true })
    } catch (error) {
      failed = true
      result.checks.push({ name: `${info.id}: execution`, passed: false, detail: { message: error.message, stack: error.stack } })
      result.cases.push({ ...info, completed: false })
      await page.screenshot({ path: join(out, `${info.id}-failure.png`) }).catch(() => {})
      throw error
    } finally {
      await context.tracing.stop(failed ? { path: join(out, `${info.id}-failure-trace.zip`) } : undefined).catch(() => {})
      await context.close()
      await persist()
    }
  }
} finally {
  await browser.close()
  result.finished = new Date().toISOString()
  result.finalSourceHashes = await hashes()
  const unchanged = result.finalSourceHashes.every(file => file.expected.toLowerCase() === file.actual)
  result.checks.push({ name: 'Released source unchanged', passed: unchanged })
  result.status = !unchanged || result.checks.some(row => !row.passed) || result.pageerrors.length ? 'failed' : 'scripted-checks-complete-coordinator-visual-inspection-pending'
  await persist()
}
if (result.status === 'failed') process.exitCode = 1
