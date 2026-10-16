import { chromium } from "file:///C:/Git/PERSO/ttrpg-cluster-control/node_modules/@playwright/test/index.mjs"
import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

const qaDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\//, "").replaceAll("%20", " "))
const runtime = "C:/Git/PERSO/ttrpg-cluster-control/.scratch/interface-revamp/preview-build"
const cases = [
  { name: "desktop", width: 1440, height: 900, mobile: false },
  { name: "portrait", width: 390, height: 844, mobile: true },
  { name: "landscape", width: 844, height: 390, mobile: true },
  { name: "keyboard-reduced", width: 390, height: 500, mobile: true },
]
const browser = await chromium.launch({ headless: true, executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
const page = await context.newPage()
const pageErrors = []
page.on("pageerror", error => pageErrors.push(error.message))
const deadline = Date.now() + 30_000
let navigationError = null
let panelOpened = false
try {
  await page.goto("http://127.0.0.1:3139/?variant=B&controls=dock", { waitUntil: "domcontentloaded", timeout: Math.max(1, deadline - Date.now()) })
  await page.locator(".proto-b").waitFor({ state: "visible", timeout: Math.max(1, deadline - Date.now()) })
  const inspector = page.locator(".inspector-card")
  if (!(await inspector.isVisible().catch(() => false))) {
    const inspectButton = page.locator('.b-tool-rail .rail-button[aria-label*="Inspector panel"]').first()
    if (await inspectButton.isVisible().catch(() => false)) {
      await inspectButton.click()
      panelOpened = true
    }
  }
  await page.locator(".inspector-card").waitFor({ state: "visible", timeout: Math.max(1, deadline - Date.now()) }).catch(() => {})
} catch (error) {
  navigationError = error.message
}
const results = []
for (const item of cases) {
  await page.setViewportSize({ width: item.width, height: item.height })
  await page.waitForTimeout(100)
  const state = await page.evaluate(() => {
    const panel = document.querySelector(".inspector-card")
    const rect = element => {
      if (!element) return null
      const box = element.getBoundingClientRect()
      return { x: box.x, y: box.y, width: box.width, height: box.height, right: box.right, bottom: box.bottom }
    }
    return {
      title: document.title,
      readyState: document.readyState,
      bodyTextStart: document.body.innerText.slice(0, 300),
      inspectorVisible: Boolean(panel && panel.getBoundingClientRect().width > 0),
      inspectorRect: rect(panel),
      inspectorTextStart: panel?.innerText.slice(0, 500) ?? null,
      viewport: { width: innerWidth, height: innerHeight, documentHeight: document.documentElement.scrollHeight },
    }
  }).catch(error => ({ evaluationError: error.message }))
  const screenshot = path.join(qaDir, `baseline-${item.name}.png`)
  if (state.title !== undefined) await page.screenshot({ path: screenshot, fullPage: false }).catch(() => {})
  results.push({ ...item, screenshot: state.title !== undefined ? screenshot : null, state })
}
const sourcePaths = ["components/PrototypeInspector.vue", "components/PrototypeWorkbench.vue", "components/prototype-fields-fixture.ts", "pages/index.vue"]
const sourceHashes = {}
for (const relative of sourcePaths) {
  const bytes = await readFile(path.join(runtime, relative))
  sourceHashes[relative] = createHash("sha256").update(bytes).digest("hex").toUpperCase()
}
await writeFile(path.join(qaDir, "baseline-capture.json"), JSON.stringify({
  capturedAt: new Date().toISOString(),
  sourceBaselineCommit: "8ff3d47a6e6bbfc957c7b3fec19ec856b49225ae",
  runtimeRoot: runtime,
  url: "http://127.0.0.1:3139/?variant=B&controls=dock",
  navigationError,
  panelOpenedThroughVisibleUI: panelOpened,
  pageErrors,
  sourceHashes,
  results,
}, null, 2))
await browser.close()
console.log(JSON.stringify({ navigationError, pageErrors, results: results.map(({ name, screenshot, state }) => ({ name, screenshot, inspectorVisible: state.inspectorVisible, title: state.title })) }, null, 2))
