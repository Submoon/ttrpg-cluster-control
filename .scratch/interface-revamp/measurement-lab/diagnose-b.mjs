import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
const lab = path.dirname(fileURLToPath(import.meta.url))
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' })
const page = await context.newPage()
const consoleRows = []
const requests = []
page.on('console', message => consoleRows.push({ type: message.type(), text: message.text() }))
page.on('pageerror', error => consoleRows.push({ type: 'pageerror', text: error.stack || error.message }))
page.on('requestfailed', request => requests.push({ url: request.url(), failure: request.failure()?.errorText }))
page.on('response', response => requests.push({ url: response.url(), status: response.status() }))
const response = await page.goto('http://127.0.0.1:3122/?variant=B', { waitUntil: 'domcontentloaded' })
const html = await response.text()
await page.waitForTimeout(5000)
const snapshot = await page.evaluate(() => ({
  title: document.title,
  body: document.body.innerText.slice(0, 5000),
  variants: [...document.querySelectorAll('.proto-shell')].map(node => ({ className: node.className, theme: node.getAttribute('data-theme') })),
  svgs: [...document.querySelectorAll('svg')].map(svg => ({ cls: svg.getAttribute('class'), box: svg.getBoundingClientRect().toJSON() })),
  mapCanvases: [...document.querySelectorAll('.prototype-map-canvas')].map(node => ({ box: node.getBoundingClientRect().toJSON(), text: node.innerText })),
  scriptSources: [...document.scripts].map(script => script.src).filter(Boolean),
}))
await page.screenshot({ path: path.join(lab, 'artifacts', 'B-desktop-diagnostic.png'), fullPage: true })
await fs.writeFile(path.join(lab, 'artifacts', 'B-desktop-diagnostic.json'), JSON.stringify({ status: response.status(), htmlBytes: Buffer.byteLength(html), html: html.slice(0, 5000), snapshot, consoleRows, requests }, null, 2))
await fs.writeFile(path.join(lab, 'artifacts', 'B-desktop-diagnostic.html'), html)
console.log(JSON.stringify({ status: response.status(), body: snapshot.body, svgCount: snapshot.svgs.length, consoleRows, failures: requests.filter(item => item.failure || item.status >= 400) }, null, 2))
await browser.close()
