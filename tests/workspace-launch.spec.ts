import { expect, test, type Locator } from './fixtures'
import { returnToClusterMap, waitForWorkspaceSaved, waitForWorkspaceStartup } from './helpers'

const STARTUP_SCRIPT_DELAY_MS = 6_000

function applicationURL(testInfo: import('@playwright/test').TestInfo): string {
  const baseURL = testInfo.project.use.baseURL
  if (typeof baseURL !== 'string') throw new Error('Startup coverage requires a configured Playwright baseURL.')
  return new URL('/', baseURL).toString()
}

async function gateStartupScripts(page: import('@playwright/test').Page): Promise<{
  startDelay: () => Promise<void>
  cleanup: () => Promise<void>
}> {
  let releaseScripts!: () => void
  const scriptsReleased = new Promise<void>(resolve => { releaseScripts = resolve })
  let releaseDelay: (() => void) | undefined
  let delayFinished: Promise<void> | undefined
  let timer: ReturnType<typeof setTimeout> | undefined

  await page.route('**/*', async route => {
    if (route.request().resourceType() === 'script') await scriptsReleased
    await route.continue()
  })

  return {
    startDelay() {
      delayFinished ??= new Promise<void>(resolve => {
        releaseDelay = resolve
        timer = setTimeout(() => {
          releaseScripts()
          resolve()
        }, STARTUP_SCRIPT_DELAY_MS)
      })
      return delayFinished
    },
    async cleanup() {
      if (timer) clearTimeout(timer)
      releaseScripts()
      releaseDelay?.()
      await page.unrouteAll({ behavior: 'wait' })
    },
  }
}

async function createPublicWorkspaceSnapshot(
  browser: import('@playwright/test').Browser,
  baseURL: string,
  cookies: import('@playwright/test').Cookie[],
): Promise<Awaited<ReturnType<import('@playwright/test').BrowserContext['storageState']>>> {
  const preparer = await browser.newContext()
  try {
    if (cookies.length) await preparer.addCookies(cookies)
    const page = await preparer.newPage()
    await page.goto(baseURL)
    await waitForWorkspaceStartup(page)
    await expect(page.getByRole('heading', { name: 'Give the unknown a name.' })).toBeVisible()
    await page.getByLabel('Jump Cluster').fill('Startup Test Cluster')
    await page.getByLabel('First star system').fill('Startup Test System')
    await page.getByRole('button', { name: 'Create local workspace' }).click()
    await expect(page.getByRole('navigation', { name: 'Map context and commands' })
      .getByRole('heading', { name: 'Startup Test System' })).toBeVisible()
    await waitForWorkspaceSaved(page)
    return await preparer.storageState({ indexedDB: true })
  } finally {
    await preparer.close()
  }
}

test('slow startup keeps the empty browser loading screen until the launch form is ready', async ({ browser, context }, testInfo) => {
  test.setTimeout(60_000)
  const emptyState = await context.storageState()
  const startupContext = await browser.newContext({ storageState: emptyState })
  const page = await startupContext.newPage()
  const scriptGate = await gateStartupScripts(page)
  try {
    await page.goto(applicationURL(testInfo), { waitUntil: 'commit' })
    await expect(page.getByRole('heading', { name: "Opening this browser's workspace..." })).toBeVisible()

    const scriptsReleased = scriptGate.startDelay()
    const startupWait = waitForWorkspaceStartup(page)
    const raceOutcome = await Promise.race([
      startupWait.then(() => 'startup-ready'),
      scriptsReleased.then(() => 'scripts-released'),
    ])
    expect(raceOutcome).toBe('scripts-released')
    await startupWait
    await expect(page.getByRole('heading', { name: 'Give the unknown a name.' })).toBeVisible()
  } finally {
    await scriptGate.cleanup()
    await startupContext.close()
  }
})

test('slow startup reopens a saved IndexedDB workspace after loading completes', async ({ browser, context }, testInfo) => {
  test.setTimeout(90_000)
  const baseURL = applicationURL(testInfo)
  const cookies = await context.cookies([baseURL])
  const snapshot = await createPublicWorkspaceSnapshot(browser, baseURL, cookies)
  const startupContext = await browser.newContext({ storageState: snapshot })
  const page = await startupContext.newPage()
  const scriptGate = await gateStartupScripts(page)
  try {
    await page.goto(baseURL, { waitUntil: 'commit' })
    await expect(page.getByRole('heading', { name: "Opening this browser's workspace..." })).toBeVisible()

    const scriptsReleased = scriptGate.startDelay()
    const startupWait = waitForWorkspaceStartup(page)
    const raceOutcome = await Promise.race([
      startupWait.then(() => 'startup-ready'),
      scriptsReleased.then(() => 'scripts-released'),
    ])
    expect(raceOutcome).toBe('scripts-released')
    await startupWait
    await returnToClusterMap(page)
    await expect(page.getByRole('group', { name: 'Startup Test Cluster Jump Cluster map', exact: true })
      .getByRole('button', { name: 'Select Startup Test System system', exact: true })).toBeVisible()
  } finally {
    await scriptGate.cleanup()
    await startupContext.close()
  }
})

async function expectFocusRingWithinViewport(locator: Locator): Promise<void> {
  const page = locator.page()
  await locator.focus()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Shift+Tab')
  await expect(locator).toBeFocused()

  const focusRingVisible = await locator.evaluate(element => {
    const bounds = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    const extent = Number.parseFloat(style.outlineWidth) + Math.max(0, Number.parseFloat(style.outlineOffset))
    const center = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
    return document.activeElement === element
      && style.outlineStyle !== 'none'
      && Number.parseFloat(style.outlineWidth) >= 2
      && bounds.top >= extent - 0.1
      && bounds.bottom <= window.innerHeight - extent + 0.1
      && bounds.left >= extent - 0.1
      && bounds.right <= window.innerWidth - extent + 0.1
      && (center === element || element.contains(center))
  })
  expect(focusRingVisible).toBe(true)
}

test('the product root creates and resumes a saved local workspace', async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto('/')

  await waitForWorkspaceStartup(page)
  await expect(page.getByRole('heading', { name: 'Give the unknown a name.' })).toBeVisible()
  await page.getByLabel('Jump Cluster').fill('Halcyon Spur')
  await page.getByLabel('First star system').fill('Lark')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  await expect(page.getByRole('navigation', { name: 'Map context and commands' })
    .getByRole('heading', { name: 'Lark' })).toBeVisible()
  await waitForWorkspaceSaved(page)

  await page.reload()

  await waitForWorkspaceStartup(page)
  await expect(page.getByRole('navigation', { name: 'Map context and commands' })
    .getByRole('heading', { name: 'Lark' })).toBeVisible()
  await waitForWorkspaceSaved(page)
  await returnToClusterMap(page)
  await expect(page.getByRole('group', { name: 'Halcyon Spur Jump Cluster map' })).toBeVisible()
})

test('keyboard focus remains visible on launch and recovery actions in a short landscape viewport', async ({ page }) => {
  test.setTimeout(60_000)
  await page.setViewportSize({ width: 844, height: 390 })
  await page.goto('/')
  await waitForWorkspaceStartup(page)
  await expect(page.getByRole('heading', { name: 'Give the unknown a name.' })).toBeVisible()
  const createButton = page.getByRole('button', { name: 'Create local workspace' })
  await expect(createButton).toBeInViewport({ ratio: 1 })
  await expectFocusRingWithinViewport(createButton)
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await waitForWorkspaceSaved(page)

  await page.evaluate(async () => {
    const request = indexedDB.open('ttrpg-cluster-control', 1)
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Could not open the workspace database.'))
    })

    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction('workspace', 'readwrite')
        transaction.objectStore('workspace').put({ damaged: true }, 'current')
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error ?? new Error('Could not damage the current snapshot.'))
        transaction.onabort = () => reject(transaction.error ?? new Error('Could not damage the current snapshot.'))
      })
    } finally {
      database.close()
    }
  })
  await page.reload()

  await waitForWorkspaceStartup(page)
  await expect(page.getByRole('heading', { name: 'Your workspace could not be opened.' })).toBeVisible()
  await expectFocusRingWithinViewport(page.getByRole('button', { name: 'Restore last valid backup' }))
})
