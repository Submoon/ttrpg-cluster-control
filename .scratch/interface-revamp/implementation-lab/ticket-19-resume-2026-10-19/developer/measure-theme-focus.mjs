import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, expect } from '@playwright/test'

const evidenceDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(evidenceDirectory, '../../../../..')
const baseURL = 'http://127.0.0.1:3100'
const sourceFiles = [
  'components/WorkspaceHeader.vue',
  'assets/css/main.css',
  'tests/workspace-theme.spec.ts',
  'nuxt.config.ts',
]
const evidence = {
  baseline: 'f64d00dbaf9cee569a8a62db0005b4ffe7f00ca7',
  route: '/',
  baseURL,
  fixture: 'Fresh isolated browser storage; a local workspace is created only to reveal the existing Fields header command.',
  viewport: { width: 1440, height: 900 },
  source: {},
  browser: null,
  samples: [],
  pageErrors: [],
  consoleWarningsOrErrors: [],
}

for (const file of sourceFiles) {
  evidence.source[file] = createHash('sha256').update(await readFile(resolve(repositoryRoot, file))).digest('hex')
}

function luminance(rgb) {
  const linear = rgb.map(value => {
    const channel = value / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
}

function contrastRatio(first, second) {
  const firstLuminance = luminance(first)
  const secondLuminance = luminance(second)
  return (Math.max(firstLuminance, secondLuminance) + 0.05)
    / (Math.min(firstLuminance, secondLuminance) + 0.05)
}

async function sampleKeyboardFocus(page, control, label) {
  await control.scrollIntoViewIfNeeded()
  await control.focus()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Shift+Tab')
  await page.waitForTimeout(250)

  const row = await control.evaluate(element => {
    const style = getComputedStyle(element)
    const bounds = element.getBoundingClientRect()
    const colorCanvas = document.createElement('canvas')
    colorCanvas.width = colorCanvas.height = 1
    const context = colorCanvas.getContext('2d', { willReadFrequently: true })
    context.fillStyle = style.outlineColor
    context.fillRect(0, 0, 1, 1)
    return {
      active: document.activeElement === element,
      bounds: bounds.toJSON(),
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      outlineOffset: style.outlineOffset,
      outlineColor: style.outlineColor,
      outlineRgba: Array.from(context.getImageData(0, 0, 1, 1).data).map((value, index) =>
        index === 3 ? value / 255 : value,
      ),
      outsideOffset: Math.max(0, Number.parseFloat(style.outlineWidth) || 0)
        + Math.max(0, Number.parseFloat(style.outlineOffset) || 0)
        + 0.75,
    }
  })

  const screenshot = (await page.screenshot()).toString('base64')
  const backgrounds = await page.evaluate(async ({ bounds, outsideOffset, screenshotBase64 }) => {
    const image = new Image()
    image.src = `data:image/png;base64,${screenshotBase64}`
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    context.drawImage(image, 0, 0)
    const pixel = (x, y) => Array.from(context.getImageData(
      Math.max(0, Math.min(image.width - 1, Math.floor(x))),
      Math.max(0, Math.min(image.height - 1, Math.floor(y))),
      1,
      1,
    ).data).slice(0, 3)
    const centerX = bounds.x + bounds.width / 2
    const centerY = bounds.y + bounds.height / 2
    return [
      pixel(bounds.x - outsideOffset, centerY),
      pixel(bounds.x + bounds.width + outsideOffset, centerY),
      pixel(centerX, bounds.y - outsideOffset),
      pixel(centerX, bounds.y + bounds.height + outsideOffset),
    ]
  }, { bounds: row.bounds, outsideOffset: row.outsideOffset, screenshotBase64: screenshot })

  const ratios = backgrounds.map(background => {
    const foreground = row.outlineRgba.slice(0, 3).map((channel, index) =>
      channel * row.outlineRgba[3] + background[index] * (1 - row.outlineRgba[3]),
    )
    return contrastRatio(foreground, background)
  })
  const minimum = Math.min(...ratios)
  const result = {
    label,
    method: 'Computed keyboard-focus outline, alpha-composited against four adjacent pixels from the rendered screenshot; minimum WCAG non-text contrast ratio.',
    ...row,
    backgrounds,
    ratios,
    minimum,
    threshold: 3,
    passes: row.active && row.outlineStyle !== 'none' && Number.parseFloat(row.outlineWidth) >= 2 && minimum >= 3,
  }
  return result
}

const browser = await chromium.launch({ channel: 'chrome', headless: true })
evidence.browser = { name: 'Google Chrome channel', version: browser.version(), headless: true, deviceScaleFactor: 1 }

try {
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({
      viewport: evidence.viewport,
      colorScheme: theme,
      deviceScaleFactor: 1,
      serviceWorkers: 'block',
    })
    const page = await context.newPage()
    page.on('pageerror', error => evidence.pageErrors.push({ theme, message: error.message }))
    page.on('console', message => {
      if (['warning', 'error'].includes(message.type())) {
        evidence.consoleWarningsOrErrors.push({ theme, type: message.type(), text: message.text() })
      }
    })

    try {
      await page.goto(baseURL)
      await expect(page.getByRole('heading', { name: 'Give the unknown a name.' })).toBeVisible({ timeout: 30_000 })
      await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(theme)
      const themeButton = page.getByRole('group', { name: 'Theme', exact: true })
        .getByRole('button', { name: /switch to (light|dark) mode/i })
      evidence.samples.push(await sampleKeyboardFocus(page, themeButton, `${theme} Theme button`))

      await page.getByLabel('Jump Cluster', { exact: true }).fill('Focus sample workspace')
      await page.getByLabel('First star system', { exact: true }).fill('Focus sample star')
      await page.getByRole('button', { name: 'Create local workspace', exact: true }).click()
      await expect(page.locator('.workspace-feedback').getByText('Saved on this device')).toBeVisible()
      const fieldsButton = page.getByRole('button', { name: 'Open field definitions', exact: true })
      await expect(fieldsButton).toBeVisible()
      evidence.samples.push(await sampleKeyboardFocus(page, fieldsButton, `${theme} Fields header button`))
    } finally {
      await context.close()
    }
  }
} finally {
  await browser.close()
  await writeFile(resolve(evidenceDirectory, 'theme-focus-results.json'), JSON.stringify(evidence, null, 2))
  console.log(JSON.stringify({ samples: evidence.samples.map(({ label, outlineColor, outlineWidth, outlineOffset, backgrounds, ratios, minimum, passes }) => ({ label, outlineColor, outlineWidth, outlineOffset, backgrounds, ratios, minimum, passes })), pageErrors: evidence.pageErrors, consoleWarningsOrErrors: evidence.consoleWarningsOrErrors }, null, 2))
}

if (evidence.samples.some(sample => !sample.passes) || evidence.pageErrors.length || evidence.consoleWarningsOrErrors.length) {
  process.exitCode = 1
}
