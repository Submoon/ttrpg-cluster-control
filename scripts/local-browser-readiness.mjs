const welcomeHeading = 'Give the unknown a name.'

/** @typedef {{ invalidated: Promise<string>, close: () => Promise<void> }} BrowserReadinessResource */
/** @typedef {{ timeout: number, channel?: string }} BrowserReadinessLaunchOptions */
/** @typedef {Pick<import('@playwright/test').Browser, 'close' | 'newContext'>} ReadinessBrowser */

/**
 * Opens an isolated browser context, confirms the public welcome form is hydrated, and keeps
 * observing Vite's public WebSocket frames until the session closes.
 * @param {{ url: string, timeoutMs: number, signal?: AbortSignal, channel?: string, launchBrowser?: (options: BrowserReadinessLaunchOptions) => Promise<ReadinessBrowser> }} options
 * @returns {Promise<BrowserReadinessResource>}
 */
export async function openBrowserReadiness({ url, timeoutMs, signal, channel, launchBrowser }) {
  if (signal?.aborted) throw signal.reason ?? new Error('Browser readiness was cancelled.')
  const deadline = Date.now() + timeoutMs
  const cancellation = abortSignal(signal)
  const timeout = createReadinessTimeout(deadline, timeoutMs)
  /** @type {ReadinessBrowser | undefined} */
  let browser
  /** @type {import('@playwright/test').BrowserContext | undefined} */
  let context
  let closed = false
  let hmrArmed = false
  const invalidation = createInvalidationLatch()
  const { invalidated, invalidate } = invalidation
  const stopPromises = [cancellation.promise, timeout.promise]

  try {
    const { chromium, expect } = await Promise.race([import('@playwright/test'), ...stopPromises])
    const launchOptions = {
      timeout: remainingTimeout(deadline, timeoutMs),
      ...(channel ? { channel } : {}),
    }
    const pendingBrowser = (launchBrowser
      ? launchBrowser(launchOptions)
      : chromium.launch(launchOptions))
      .then(async launchedBrowser => {
        if (signal?.aborted || Date.now() >= deadline) {
          const stopError = readinessStopError(signal, timeoutMs)
          await launchedBrowser.close()
          throw stopError
        }
        browser = launchedBrowser
        return launchedBrowser
      })
    browser = await Promise.race([pendingBrowser, ...stopPromises])
    if (!browser) throw new Error('Chromium did not launch for browser readiness.')
    const readinessBrowser = browser

    const pendingContext = readinessBrowser.newContext().then(async createdContext => {
      if (signal?.aborted || Date.now() >= deadline) {
        const stopError = readinessStopError(signal, timeoutMs)
        await createdContext.close()
        throw stopError
      }
      context = createdContext
      return createdContext
    })
    context = await Promise.race([pendingContext, ...stopPromises])
    if (!context) throw new Error('Chromium did not create a readiness context.')
    const readinessContext = context
    const page = await Promise.race([readinessContext.newPage(), ...stopPromises])
    if (signal?.aborted) throw signal.reason ?? new Error('Browser readiness was cancelled.')
    remainingTimeout(deadline, timeoutMs)
    page.setDefaultTimeout(remainingTimeout(deadline, timeoutMs))
    page.on('websocket', socket => {
      socket.on('framereceived', frame => {
        if (hmrArmed) invalidateForFrame(frame.payload, invalidate)
      })
      socket.on('framesent', frame => {
        if (hmrArmed) invalidateForFrame(frame.payload, invalidate)
      })
    })
    page.on('pageerror', error => invalidate(`The readiness page reported a browser error: ${error.message}`))

    const ready = await Promise.race([
      assertWelcomeForm(page, expect, url, deadline, timeoutMs).then(() => { hmrArmed = true; return true }),
      ...stopPromises,
      invalidated.then(reason => { throw new Error(reason) }),
    ])
    if (!ready) throw new Error('The local application did not reach its welcome form.')
    return {
      invalidated,
      async close() {
        if (closed) return
        closed = true
        await readinessBrowser.close()
      },
    }
  } catch (error) {
    if (browser) {
      try {
        await browser.close()
      } catch (cleanupError) {
        throw new AggregateError([error, cleanupError], 'Browser readiness failed and its Chromium process could not be closed.', { cause: cleanupError })
      }
    }
    throw error
  } finally {
    cancellation.dispose()
    timeout.dispose()
  }
}

/** A readiness invalidation is permanent for the lifetime of its probe. */
export function createInvalidationLatch() {
  let reason
  /** @type {(value: string) => void} */
  let resolveInvalidated
  /** @type {Promise<string>} */
  const invalidated = new Promise(resolveReason => { resolveInvalidated = resolveReason })
  return {
    invalidated,
    /** @param {string} value */
    invalidate(value) {
      if (reason !== undefined) return
      reason = value
      resolveInvalidated(value)
    },
  }
}

async function assertWelcomeForm(page, expect, url, deadline, timeoutMs) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: remainingTimeout(deadline, timeoutMs) })
  await expect(page.getByRole('heading', { name: "Opening this browser's workspace...", exact: true }))
    .toBeHidden({ timeout: remainingTimeout(deadline, timeoutMs) })
  await expect(page.getByRole('heading', { name: welcomeHeading, exact: true }))
    .toBeVisible({ timeout: remainingTimeout(deadline, timeoutMs) })
  const clusterName = page.getByLabel('Jump Cluster', { exact: true })
  await expect(clusterName).toBeVisible({ timeout: remainingTimeout(deadline, timeoutMs) })
  await expect(clusterName).toBeEnabled({ timeout: remainingTimeout(deadline, timeoutMs) })
  await clusterName.fill('Local readiness check', { timeout: remainingTimeout(deadline, timeoutMs) })
  await expect(clusterName).toHaveValue('Local readiness check', { timeout: remainingTimeout(deadline, timeoutMs) })
  await clusterName.fill('', { timeout: remainingTimeout(deadline, timeoutMs) })
  return true
}

function remainingTimeout(deadline, timeoutMs) {
  const remaining = deadline - Date.now()
  if (remaining <= 0) throw new Error(`Timed out after ${timeoutMs} ms waiting for the hydrated welcome form.`)
  return remaining
}

/** @param {AbortSignal | undefined} signal @returns {{ promise: Promise<never>, dispose: () => void }} */
function abortSignal(signal) {
  if (!signal) {
    /** @type {Promise<never>} */
    const promise = new Promise(() => {})
    return { promise, dispose: () => {} }
  }
  if (signal.aborted) {
    return {
      promise: Promise.reject(signal.reason ?? new Error('Browser readiness was cancelled.')),
      dispose: () => {},
    }
  }
  let abort
  const promise = new Promise((resolve, reject) => {
    abort = () => reject(signal.reason ?? new Error('Browser readiness was cancelled.'))
    signal.addEventListener('abort', abort, { once: true })
  })
  return { promise, dispose: () => signal.removeEventListener('abort', abort) }
}

/** @param {number} deadline @param {number} timeoutMs @returns {{ promise: Promise<never>, dispose: () => void }} */
function createReadinessTimeout(deadline, timeoutMs) {
  let timer
  /** @type {Promise<never>} */
  const promise = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${timeoutMs} ms waiting for the hydrated welcome form.`)), Math.max(0, deadline - Date.now()))
  })
  return { promise, dispose: () => clearTimeout(timer) }
}

function readinessStopError(signal, timeoutMs) {
  return signal?.aborted
    ? signal.reason ?? new Error('Browser readiness was cancelled.')
    : new Error(`Timed out after ${timeoutMs} ms waiting for the hydrated welcome form.`)
}

/** @param {unknown} payload @returns {string | undefined} */
export function viteHmrInvalidationReason(payload) {
  let text
  if (typeof payload === 'string') text = payload
  else if (payload instanceof ArrayBuffer) text = new TextDecoder().decode(payload)
  else if (ArrayBuffer.isView(payload)) text = new TextDecoder().decode(payload)
  else return undefined

  let frame
  try {
    frame = JSON.parse(text)
  } catch {
    return undefined
  }
  const event = typeof frame?.event === 'string' ? frame.event : ''
  const type = typeof frame?.type === 'string' ? frame.type : ''
  const hotUpdate = /^(?:update|full-reload|prune|error)$/.test(type)
    || /^vite:(?:beforeUpdate|afterUpdate|beforeFullReload|prune|error)$/.test(event)
  if (!hotUpdate) return undefined
  const detail = event || type
  return `Vite reported ${detail} while local verification was running.`
}

function invalidateForFrame(payload, invalidate) {
  const reason = viteHmrInvalidationReason(payload)
  if (reason) invalidate(reason)
}
