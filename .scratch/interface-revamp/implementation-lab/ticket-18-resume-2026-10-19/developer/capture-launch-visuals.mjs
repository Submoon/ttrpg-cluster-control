import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { relative, resolve } from 'node:path'
import { chromium } from '@playwright/test'

const mode = process.argv[2]
if (mode !== 'before' && mode !== 'after') {
  throw new Error('Pass either "before" or "after".')
}

const root = resolve(process.cwd())
const evidenceRoot = resolve(root, '.scratch/interface-revamp/implementation-lab/ticket-18-resume-2026-10-19/developer/evidence')
const outputDirectory = resolve(evidenceRoot, mode)
const baseUrl = 'http://127.0.0.1:3100'
const rootRoute = mode === 'before' ? '/?variant=baseline' : '/'
const componentPath = resolve(root, 'components/WorkspaceWelcome.vue')
const componentHash = createHash('sha256').update(await readFile(componentPath)).digest('hex')

const profiles = [
  { name: 'desktop-light', width: 1440, height: 900, theme: 'light', recovery: false },
  { name: 'portrait-dark', width: 390, height: 844, theme: 'dark', recovery: false },
  { name: 'short-landscape-light', width: 844, height: 390, theme: 'light', recovery: false },
  { name: 'reduced-height-dark-recovery', width: 390, height: 500, theme: 'dark', recovery: true },
]

await mkdir(outputDirectory, { recursive: true })
const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const report = {
  mode,
  source: 'components/WorkspaceWelcome.vue',
  sourceSha256: componentHash,
  route: rootRoute,
  baseUrl,
  browser: browser.version(),
  screenshots: [],
  errors: [],
}

async function createLocalWorkspace(page) {
  await page.getByLabel('Jump Cluster').fill('Visual Evidence Reach')
  await page.getByLabel('First star system').fill('Sable')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await page.getByRole('region', { name: 'Active Star System summary' }).getByText('Sable').waitFor({ state: 'visible', timeout: 30_000 })
  await page.getByRole('contentinfo').getByText('Saved on this device').waitFor({ state: 'visible', timeout: 30_000 })
}

async function damageCurrentWorkspace(page) {
  await page.evaluate(async () => {
    const request = indexedDB.open('ttrpg-cluster-control', 1)
    const database = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Could not open the isolated workspace database.'))
    })

    try {
      await new Promise((resolve, reject) => {
        const transaction = database.transaction('workspace', 'readwrite')
        transaction.objectStore('workspace').put({ damaged: true }, 'current')
        transaction.oncomplete = resolve
        transaction.onerror = () => reject(transaction.error ?? new Error('Could not damage the isolated current snapshot.'))
        transaction.onabort = () => reject(transaction.error ?? new Error('The isolated damage transaction was aborted.'))
      })
    } finally {
      database.close()
    }
  })
}

async function captureProfile(profile) {
  const context = await browser.newContext({
    viewport: { width: profile.width, height: profile.height },
    colorScheme: profile.theme,
  })
  await context.addInitScript(theme => localStorage.setItem('nuxt-color-mode', theme), profile.theme)
  const page = await context.newPage()
  page.on('pageerror', error => report.errors.push(`${profile.name}: ${error.message}`))
  const response = await page.goto(`${baseUrl}${rootRoute}`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await page.getByRole('heading', { name: 'Give the unknown a name.' }).waitFor({ state: 'visible', timeout: 120_000 })

  if (profile.recovery) {
    await createLocalWorkspace(page)
    await damageCurrentWorkspace(page)
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.getByRole('heading', { name: 'Your workspace could not be opened.' }).waitFor({ state: 'visible', timeout: 30_000 })
  }

  const screenshot = resolve(outputDirectory, `${profile.name}-${mode}.png`)
  await page.screenshot({ path: screenshot, animations: 'disabled' })
  const layout = await page.evaluate(() => {
    const form = document.querySelector('form')
    const heading = [...document.querySelectorAll('h1')].map(element => element.textContent?.trim())
    const buttons = [...document.querySelectorAll('button')].map(element => {
      const bounds = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return {
        name: element.innerText.trim(),
        disabled: element.disabled,
        inViewport: bounds.top >= 0 && bounds.bottom <= window.innerHeight,
        height: bounds.height,
        background: style.backgroundColor,
        foreground: style.color,
      }
    })
    return {
      className: document.documentElement.className,
      theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
      headings: heading,
      formName: form?.getAttribute('aria-label') ?? form?.getAttribute('aria-labelledby') ?? null,
      formRect: form ? (() => {
        const bounds = form.getBoundingClientRect()
        return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
      })() : null,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
      controls: buttons,
      inputs: [...document.querySelectorAll('input')].map(input => ({
        name: input.name,
        required: input.required,
        maxLength: input.maxLength,
        label: input.labels?.[0]?.textContent?.trim() ?? null,
      })),
    }
  })

  report.screenshots.push({
    profile,
    responseStatus: response?.status() ?? null,
    screenshot: relative(root, screenshot),
    layout,
  })
  await context.close()
}

try {
  for (const profile of profiles) await captureProfile(profile)

  if (mode === 'before') {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' })
    await context.addInitScript(() => localStorage.setItem('nuxt-color-mode', 'light'))
    const page = await context.newPage()
    page.on('pageerror', error => report.errors.push(`prototype-B-reference: ${error.message}`))
    const response = await page.goto(`${baseUrl}/?variant=B&controls=dock`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('.proto-shell.proto-b').waitFor({ state: 'visible', timeout: 120_000 })
    const screenshot = resolve(evidenceRoot, 'prototype-B-desktop-light-reference.png')
    await page.screenshot({ path: screenshot, animations: 'disabled' })
    report.prototypeReference = {
      route: '/?variant=B&controls=dock',
      responseStatus: response?.status() ?? null,
      screenshot: relative(root, screenshot),
      note: 'Seeded prototype map used for visual-language context; it has no equivalent empty-workspace or recovery form.',
    }
    await context.close()
  }
} finally {
  await browser.close()
}

const reportPath = resolve(outputDirectory, 'capture-report.json')
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
console.log(`Saved ${report.screenshots.length} screenshots and ${reportPath}`)
if (report.errors.length) {
  console.error(report.errors.join('\n'))
  process.exitCode = 1
}
