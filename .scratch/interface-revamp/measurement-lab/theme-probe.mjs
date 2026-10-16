import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const lab = path.dirname(fileURLToPath(import.meta.url))
const artifacts = path.join(lab, 'artifacts')
await fs.mkdir(artifacts, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const results = []

async function activeLabel(page) {
  return await page.evaluate(() => {
    const active = document.activeElement
    if (!(active instanceof HTMLElement)) return null
    return { tag: active.tagName.toLowerCase(), id: active.id || null, ariaLabel: active.getAttribute('aria-label'), text: active.innerText?.trim().slice(0, 80) || null, role: active.getAttribute('role'), className: typeof active.className === 'string' ? active.className : '' }
  })
}

async function stateSnapshot(page) {
  return await page.evaluate(() => {
    const shell = document.querySelector('.proto-shell')
    const canvas = document.querySelector('.prototype-map-canvas')
    let workspace = null
    try {
      const data = canvas?.__vueParentComponent?.props?.workspace
      workspace = data ? JSON.stringify(data) : null
    } catch {}
    const content = document.querySelector('.system-map-content, .cluster-map-content')
    return {
      osPrefersDark: matchMedia('(prefers-color-scheme: dark)').matches,
      htmlColorScheme: getComputedStyle(document.documentElement).colorScheme,
      htmlTheme: document.documentElement.dataset.theme || null,
      prototypeHtmlTheme: document.documentElement.dataset.prototypeTheme || null,
      shellTheme: shell?.getAttribute('data-theme') || null,
      context: document.querySelector('.b-map-hud strong')?.textContent?.trim() || null,
      selection: document.querySelector('.b-map-footer span')?.textContent?.trim() || null,
      inspectorTitle: document.querySelector('.inspector-card h2')?.textContent?.trim() || null,
      sessionNotesDraft: document.querySelector('.inspector-form textarea')?.value ?? null,
      mapTransform: content?.getAttribute('transform') ?? null,
      workspace,
      shellInk: shell ? getComputedStyle(shell).getPropertyValue('--proto-ink').trim() : null,
      shellSurface: shell ? getComputedStyle(shell).getPropertyValue('--proto-surface').trim() : null,
      shellBackground: shell ? getComputedStyle(shell).backgroundColor : null,
      shellColor: shell ? getComputedStyle(shell).color : null,
    }
  })
}

async function portalSnapshot(page, selector, type) {
  return await page.evaluate(({ selector, type }) => {
    const element = document.querySelector(selector)
    if (!element) return { found: false, type }
    const style = getComputedStyle(element)
    const dialog = type === 'native-field-dialog' ? element : element.closest('[role="dialog"]')
    return {
      found: true,
      type,
      tag: element.tagName.toLowerCase(),
      role: element.getAttribute('role'),
      parentChain: (() => { const items = []; let node = element; for (let i = 0; node && i < 6; i++, node = node.parentElement) items.push(`${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ''}${typeof node.className === 'string' && node.className ? `.${node.className.trim().replace(/\s+/g, '.')}` : ''}`); return items })(),
      dialogRole: dialog?.getAttribute('role') ?? null,
      activeElementInside: !!document.activeElement && !!dialog?.contains(document.activeElement),
      backgroundColor: style.backgroundColor,
      color: style.color,
      inkTokenOnElement: style.getPropertyValue('--proto-ink').trim(),
      surfaceTokenOnElement: style.getPropertyValue('--proto-surface').trim(),
      shellInk: getComputedStyle(document.querySelector('.proto-shell')).getPropertyValue('--proto-ink').trim(),
      shellSurface: getComputedStyle(document.querySelector('.proto-shell')).getPropertyValue('--proto-surface').trim(),
      bodyInk: getComputedStyle(document.body).getPropertyValue('--proto-ink').trim(),
      bodyColor: getComputedStyle(document.body).color,
    }
  }, { selector, type })
}

async function ensureVela(page) {
  if (await page.locator('svg.system-map-svg').count() === 0) {
    await page.locator('svg.cluster-map-svg [data-system-id="sys-vela"]').first().click()
    await page.locator('svg.system-map-svg').waitFor({ state: 'visible', timeout: 20_000 })
  }
  await page.locator('svg.system-map-svg [data-object-id="obj-vela-planet"]').first().click({ force: true })
  await page.locator('.inspector-form textarea').waitFor({ state: 'visible', timeout: 10_000 })
}

async function oneContext(osScheme) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: osScheme, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const failures = []
  page.on('console', message => { if (message.type() === 'error' || /hydration/i.test(message.text())) failures.push({ kind: 'console', text: message.text() }) })
  page.on('pageerror', error => failures.push({ kind: 'pageerror', text: error.stack || error.message }))
  page.on('requestfailed', request => failures.push({ kind: 'requestfailed', url: request.url(), error: request.failure()?.errorText }))
  await page.goto('http://127.0.0.1:3122/?variant=B', { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.locator('svg.cluster-map-svg').waitFor({ state: 'visible', timeout: 30_000 })
  await ensureVela(page)
  const contextRecord = { osScheme, nativeInitialState: await stateSnapshot(page), checks: [], failures }

  for (const theme of ['dark', 'light']) {
    let state = await stateSnapshot(page)
    if (state.shellTheme !== theme) {
      await page.locator('.b-command-actions button').filter({ hasText: 'Theme' }).click()
      await page.waitForFunction(theme => document.querySelector('.proto-shell')?.getAttribute('data-theme') === theme, theme)
    }
    const check = { theme, osScheme, stateBefore: await stateSnapshot(page), portals: {} }

    const select = page.locator('.custom-field-stack [role="combobox"]').first()
    if (await select.count()) {
      await select.click()
      await page.locator('[role="listbox"]').waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {})
      check.portals.uSelect = await portalSnapshot(page, '[role="listbox"]', 'u-select-listbox')
      check.portals.uSelect.activeInsideAtOpen = !!(await page.evaluate(() => {
        const list = document.querySelector('[role="listbox"]')
        return !!list?.contains(document.activeElement)
      }))
      check.portals.uSelect.activeAtOpen = await activeLabel(page)
      await page.keyboard.press('Escape').catch(() => {})
      await page.waitForFunction(() => !document.querySelector('[role="listbox"]'), null, { timeout: 3_000 }).catch(() => {})
      check.portals.uSelect.activeAfterEscape = await activeLabel(page)
      check.portals.uSelect.focusReturnedToTrigger = await select.evaluate(element => element === document.activeElement).catch(() => false)
    } else {
      check.portals.uSelect = { found: false, reason: 'No USelect combobox found in object inspector' }
    }

    const marker = `theme-probe-${osScheme}-${theme}`
    const notes = page.locator('.inspector-form textarea')
    await notes.fill(marker)
    const draftBeforeGuard = await stateSnapshot(page)
    await page.locator('.b-breadcrumb button').filter({ hasText: 'JUMP CLUSTER' }).click()
    const modal = page.locator('.proto-modal-body').first()
    await modal.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {})
    check.portals.uModal = await portalSnapshot(page, '.proto-modal-body', 'u-modal-body')
    check.portals.uModal.activeAtOpen = await activeLabel(page)
    check.portals.uModal.focusInsideAtOpen = await page.evaluate(() => {
      const body = document.querySelector('.proto-modal-body')
      const dialog = body?.closest('[role="dialog"]')
      return !!dialog?.contains(document.activeElement)
    })
    await page.keyboard.press('Escape').catch(() => {})
    await page.waitForFunction(() => !document.querySelector('.proto-modal-body'), null, { timeout: 5_000 }).catch(async () => {
      const stay = page.getByRole('button', { name: 'Stay here' })
      if (await stay.count()) await stay.click()
    })
    check.portals.uModal.activeAfterEscape = await activeLabel(page)
    check.portals.uModal.stateBeforeThemeToggle = await stateSnapshot(page)
    check.portals.uModal.draftBeforeGuard = draftBeforeGuard.sessionNotesDraft
    check.portals.uModal.draftPreservedAfterEscape = check.portals.uModal.stateBeforeThemeToggle.sessionNotesDraft === marker
    check.portals.uModal.contextPreservedAfterEscape = check.portals.uModal.stateBeforeThemeToggle.context === draftBeforeGuard.context
    check.portals.uModal.focusReturnedOutsideModal = !(await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]')
      return !!dialog?.contains(document.activeElement)
    }))

    if (await page.locator('.inspector-actions button').filter({ hasText: 'Discard' }).isEnabled().catch(() => false)) {
      await page.locator('.inspector-actions button').filter({ hasText: 'Discard' }).click()
    }
    const fieldButton = page.locator('.b-command-actions button').filter({ hasText: 'Fields' }).first()
    await fieldButton.click()
    const nativeDialog = page.locator('#field-definitions-dialog[open]')
    await nativeDialog.waitFor({ state: 'visible', timeout: 10_000 })
    check.portals.nativeFieldDialog = await portalSnapshot(page, '#field-definitions-dialog', 'native-field-dialog')
    check.portals.nativeFieldDialog.activeAtOpen = await activeLabel(page)
    check.portals.nativeFieldDialog.focusInsideAtOpen = await page.locator('#field-definitions-dialog').evaluate(element => element.contains(document.activeElement))
    await page.keyboard.press('Escape').catch(() => {})
    await page.waitForFunction(() => !document.querySelector('#field-definitions-dialog[open]'), null, { timeout: 5_000 }).catch(async () => {
      const close = page.locator('#field-definitions-dialog button[aria-label="Close field definitions"]')
      if (await close.count()) await close.click()
    })
    check.portals.nativeFieldDialog.activeAfterClose = await activeLabel(page)
    check.portals.nativeFieldDialog.focusReturnedToLauncher = await fieldButton.evaluate(element => element === document.activeElement).catch(() => false)
    check.portals.nativeFieldDialog.launcherConnected = await fieldButton.count().then(count => count > 0)
    if (theme === 'dark') {
      await page.locator('.inspector-form textarea').fill(`toggle-stability-${osScheme}`)
      const before = await stateSnapshot(page)
      await page.locator('.b-command-actions button').filter({ hasText: 'Theme' }).click()
      await page.waitForFunction(() => document.querySelector('.proto-shell')?.getAttribute('data-theme') === 'light')
      const after = await stateSnapshot(page)
      check.toggle = {
        from: before.shellTheme,
        to: after.shellTheme,
        before,
        after,
        draftStable: before.sessionNotesDraft === after.sessionNotesDraft,
        contextStable: before.context === after.context,
        selectionStable: before.selection === after.selection,
        transformStable: before.mapTransform === after.mapTransform,
        fullWorkspaceJsonStable: before.workspace !== null && before.workspace === after.workspace,
      }
    }
    check.stateAfter = await stateSnapshot(page)
    contextRecord.checks.push(check)
    await page.screenshot({ path: path.join(artifacts, `theme-${osScheme}-${check.stateAfter.shellTheme}.png`), fullPage: true }).catch(() => {})
  }

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.locator('svg.cluster-map-svg').waitFor({ state: 'visible', timeout: 30_000 })
  contextRecord.reloadState = await stateSnapshot(page)
  await fs.writeFile(path.join(artifacts, `theme-${osScheme}.json`), JSON.stringify(contextRecord, null, 2))
  await context.close()
  return contextRecord
}

try {
  for (const osScheme of ['light', 'dark']) results.push(await oneContext(osScheme))
  await fs.writeFile(path.join(artifacts, 'theme-probe.json'), JSON.stringify({ generatedAt: new Date().toISOString(), sourceCommit: '7ea41e0a9b0e585e23812eb9165e95420d72dc89', variant: 'B with lab-only fixture normalization', results }, null, 2))
  console.log('WROTE', path.join(artifacts, 'theme-probe.json'))
} finally {
  await browser.close()
}
