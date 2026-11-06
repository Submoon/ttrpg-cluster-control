import { createWriteStream } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import net from 'node:net'
import process from 'node:process'
import { Readable } from 'node:stream'
import { StringDecoder } from 'node:string_decoder'
import { createInterface } from 'node:readline/promises'
import { resolve, dirname, relative } from 'node:path'
import { pathToFileURL } from 'node:url'
import { openBrowserReadiness as openBrowserReadinessDefault } from './local-browser-readiness.mjs'
import { createLocalSourceMonitor as createLocalSourceMonitorDefault } from './local-source-monitor.mjs'
import {
  assertFreshPlaywrightOutputs,
  createPlaywrightRunPaths,
  PLAYWRIGHT_OUTPUT_OWNERSHIP_ENV,
  PLAYWRIGHT_OUTPUT_RUN_ROOT_ENV,
} from './playwright-output.mjs'
import { isPureOnlySelection } from './playwright-selection.mjs'

const defaultPort = 3100
const serverReadinessTimeoutMs = 300_000
const defaultHost = '127.0.0.1'
const sourceExtensions = /\.(?:vue|[cm]?[jt]sx?)$/i
const testFixtureExtensions = /\.(?:vue|[cm]?[jt]sx?|json|csv|txt|html|svg|xml)$/i

/** @typedef {import('node:stream').Readable | import('node:stream').Writable | null} ProcessOutputStream */
/** @typedef {Pick<import('node:child_process').ChildProcess, 'pid' | 'exitCode' | 'signalCode'> & Pick<import('node:events').EventEmitter, 'once' | 'removeListener'> & { stdout?: ProcessOutputStream, stderr?: ProcessOutputStream, kill?: (signal?: NodeJS.Signals) => boolean }} LocalChildProcess */
/** @typedef {(command: string, args: readonly string[], options: import('node:child_process').SpawnOptions) => LocalChildProcess} ProcessSpawner */
/** @typedef {{ code?: number | null, signal?: NodeJS.Signals | null, error?: Error }} ServerExit */
/** @typedef {{ code?: number | null, signal?: NodeJS.Signals | null, error?: Error, timedOut?: boolean }} ChildCloseResult */
/** @typedef {{ write: (value: string) => void, close: () => Promise<void> }} LogWriter */
/** @typedef {{ invalidated: Promise<string>, close: () => Promise<void> | void }} BrowserReadinessResource */
/** @typedef {{ invalidated: Promise<string>, check: () => Promise<string | undefined>, close: () => Promise<void> }} LocalSourceMonitor */
/** @typedef {{
 * controller: AbortController,
 * firstInvalidation: string | undefined,
 * sourceMonitor: LocalSourceMonitor | undefined,
 * browserReadiness: BrowserReadinessResource | undefined,
 * child: LocalChildProcess | undefined,
 * cleanupPromise: Promise<void> | undefined,
 * invalidated: Promise<string>,
 * resolveInvalidation: (reason: string) => void,
 * readinessTask: Promise<void> | undefined,
 * readinessCleanupFailure: Error | undefined,
 * monitorTask: Promise<void> | undefined,
 * monitorCleanupFailure: Error | undefined,
 * monitorCloseTask: Promise<void> | undefined,
 * preparationDeadline: number | undefined,
 * }} VerificationEpoch */
/** @typedef {{
 * url: string,
 * fetchImpl?: typeof globalThis.fetch,
 * timeoutMs?: number,
 * requestTimeoutMs?: number,
 * intervalMs?: number,
 * wait?: (milliseconds: number, signal?: AbortSignal) => Promise<void>,
 * now?: () => number,
 * signal?: AbortSignal,
 * isAlive?: () => boolean,
 * }} HttpReadinessOptions */
/** @typedef {{
 * rootDirectory?: string,
 * env?: NodeJS.ProcessEnv,
 * port?: number,
 * spawnProcess?: ProcessSpawner,
 * fetchImpl?: typeof globalThis.fetch,
 * writeStdout?: (value: string) => void,
 * writeStderr?: (value: string) => void,
 * createLogWriter?: (path: string) => Promise<LogWriter>,
 * openBrowserReadiness?: (options: { url: string, timeoutMs: number, signal: AbortSignal, channel?: string }) => Promise<BrowserReadinessResource>,
 * createSourceMonitor?: (options: { rootDirectory: string, ignoreFile?: (relativePath: string) => boolean, onIgnoredFileChange?: (relativePath: string) => void }) => Promise<LocalSourceMonitor>,
 * prepareOutputDirectory?: (path: string) => Promise<void>,
 * checkPortAvailable?: (port: number) => Promise<void>,
 * stopProcessTree?: (child: LocalChildProcess, options: { platform: NodeJS.Platform, spawnProcess: ProcessSpawner }) => Promise<void>,
 * readinessTimeoutMs?: number,
 * readinessIntervalMs?: number,
 * now?: () => number,
 * pid?: number,
 * platform?: NodeJS.Platform,
 * }} LocalTestSessionOptions */
/** @typedef {{ input?: import('node:stream').Readable, output?: import('node:stream').Writable, onInterface?: (readline: import('node:readline/promises').Interface | undefined) => void, onInterrupt?: () => void, interruptSignal?: Promise<number>, shouldStop?: () => number | undefined }} InteractiveSessionOptions */

/**
 * Files the live development server and independent test runner can reload between local runs.
 * Keep this policy narrow: all other source, configuration, dependency and directory changes
 * require a fresh session.
 * @param {string} relativePath
 */
export function isCompatibleIdleInput(relativePath) {
  const path = relativePath.replaceAll('\\', '/')
  if (path === 'app.vue') return true
  if (/^assets\/.*\.css$/i.test(path)) return true
  if (/^(?:components|composables|domain|pages|stores|utils)\/.+$/i.test(path)) return sourceExtensions.test(path)
  if (/^tests\/fixtures\/.+$/i.test(path)) return testFixtureExtensions.test(path)
  if (/^tests\/.+$/i.test(path)) return sourceExtensions.test(path)
  return false
}

/** @param {number} port @param {string} [host] */
export async function assertPortAvailable(port, host = defaultHost) {
  const server = net.createServer()
  try {
    await new Promise((resolveListen, rejectListen) => {
      server.once('error', rejectListen)
      server.listen(port, host, resolveListen)
    })
  } catch (error) {
    if (error?.code === 'EADDRINUSE') {
      throw new Error(`Port ${port} on ${host} is occupied. test:local requires its own server and will not reuse it.`, { cause: error })
    }
    throw new Error(`Could not bind port ${port} on ${host}: ${error.message}`, { cause: error })
  }
  await new Promise((resolveClose, rejectClose) => {
    server.close(error => error ? rejectClose(error) : resolveClose())
  })
}

/** @param {HttpReadinessOptions} options */
export async function waitForHttpReady({
  url,
  fetchImpl = globalThis.fetch,
  timeoutMs = serverReadinessTimeoutMs,
  requestTimeoutMs = 5_000,
  intervalMs = 500,
  wait = delay,
  now = Date.now,
  signal,
  isAlive = () => true,
}) {
  const deadline = now() + timeoutMs
  let lastError
  while (now() < deadline) {
    if (signal?.aborted) throw signal.reason ?? new Error('Server readiness wait was cancelled.')
    if (!isAlive()) throw new Error('The development server exited before becoming ready.')
    const requestTimeout = AbortSignal.timeout(Math.max(1, Math.min(requestTimeoutMs, deadline - now())))
    const requestSignal = signal ? AbortSignal.any([signal, requestTimeout]) : requestTimeout
    try {
      const response = await fetchImpl(url, { signal: requestSignal })
      if (now() >= deadline) break
      if (response.ok) return response
      lastError = new Error(`HTTP ${response.status}`)
    } catch (error) {
      if (signal?.aborted) throw signal.reason ?? error
      lastError = requestTimeout.aborted ? new Error('HTTP request timed out') : error
    }
    const remaining = deadline - now()
    if (remaining > 0) await wait(Math.min(intervalMs, remaining), signal)
  }
  const detail = lastError?.message ? ` Last response: ${lastError.message}.` : ''
  throw new Error(`Timed out after ${timeoutMs} ms waiting for ${url}.${detail}`)
}

/** @param {LocalChildProcess} child @param {{ platform?: NodeJS.Platform, spawnProcess?: ProcessSpawner, sendSignal?: typeof process.kill, waitForClose?: (child: LocalChildProcess, timeoutMs?: number) => Promise<ChildCloseResult> }} [options] */
export async function stopOwnedProcessTree(child, {
  platform = process.platform,
  spawnProcess = spawn,
  sendSignal = process.kill,
  waitForClose = waitForChildClose,
} = {}) {
  if (!child?.pid || hasExited(child)) return
  if (platform === 'win32') {
    const killer = spawnProcess('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    })
    const result = await waitForClose(killer, 5_000)
    if (result.timedOut) throw new Error(`Timed out while stopping process tree ${child.pid} with taskkill.`)
    if (result.error) throw result.error
    if (!hasExited(child)) {
      const childResult = await waitForClose(child, 5_000)
      if (childResult.timedOut && !hasExited(child)) {
        try {
          child.kill?.('SIGKILL')
        } catch (error) {
          if (error?.code !== 'ESRCH') throw error
        }
        const forcedResult = await waitForClose(child, 2_000)
        if (forcedResult.timedOut && !hasExited(child)) {
          throw new Error(`Could not stop owned process ${child.pid} after taskkill.`)
        }
      }
    }
    return
  }

  try {
    sendSignal(-child.pid, 'SIGTERM')
  } catch (error) {
    if (error?.code !== 'ESRCH') throw error
    return
  }
  const result = await waitForClose(child, 2_000)
  if (result.timedOut && !hasExited(child)) {
    try {
      sendSignal(-child.pid, 'SIGKILL')
    } catch (error) {
      if (error?.code !== 'ESRCH') throw error
    }
    const forcedResult = await waitForClose(child, 2_000)
    if (forcedResult.timedOut && !hasExited(child)) {
      throw new Error(`Could not stop owned process group ${child.pid} after SIGKILL.`)
    }
  }
}

/** @param {LocalTestSessionOptions} [options] */
export function createLocalTestSession({
  rootDirectory = process.cwd(),
  env = process.env,
  port = parsePort(env.LOCAL_TEST_PORT),
  spawnProcess = spawn,
  fetchImpl = globalThis.fetch,
  writeStdout = value => process.stdout.write(value),
  writeStderr = value => process.stderr.write(value),
  createLogWriter = createFileLogWriter,
  openBrowserReadiness = openBrowserReadinessDefault,
  createSourceMonitor = createLocalSourceMonitorDefault,
  prepareOutputDirectory = path => mkdir(path, { recursive: true }),
  checkPortAvailable = assertPortAvailable,
  stopProcessTree = stopOwnedProcessTree,
  readinessTimeoutMs = serverReadinessTimeoutMs,
  readinessIntervalMs = 500,
  now = Date.now,
  pid = process.pid,
  platform = process.platform,
} = {}) {
  const root = resolve(rootDirectory)
  const baseURL = `http://${defaultHost}:${port}`
  const nuxtCli = resolve(root, 'node_modules', 'nuxt', 'bin', 'nuxt.mjs')
  const playwrightCli = resolve(root, 'node_modules', '@playwright', 'test', 'cli.js')
  const artifactDirectory = createPlaywrightRunPaths({
    cwd: root,
    runPrefix: 'local-test',
    timestamp: now(),
    pid,
  }).runRoot
  const logPath = resolve(artifactDirectory, 'server.log')
  const logRelativePath = relative(root, logPath)
  /** @type {LogWriter | undefined} */
  let logWriter
  /** @type {LocalChildProcess | undefined} */
  let serverProcess
  /** @type {LocalChildProcess | undefined} */
  let testProcess
  let started = false
  let closed = false
  let pureOnly = false
  /** @type {VerificationEpoch | undefined} */
  let currentEpoch
  /** @type {VerificationEpoch | undefined} */
  let preparingEpoch
  /** @type {LocalSourceMonitor | undefined} */
  let compatibilityFence
  /** @type {Promise<void> | undefined} */
  let compatibilityFenceTask
  /** @type {string | undefined} */
  let compatibilityFailure
  /** @type {string | undefined} */
  let sessionCleanupFailure
  /** @type {string | undefined} */
  let activeOperation
  /** @type {Promise<void> | undefined} */
  let activeOperationFinished
  /** @type {() => void} */
  let resolveActiveOperation
  /** @type {Promise<void> | undefined} */
  let closing
  const closedMonitors = new WeakSet()
  const sessionAbort = new AbortController()
  const serverExitAbort = new AbortController()
  /** @type {ServerExit | undefined} */
  let serverFailure
  let runNumber = 0
  /** @type {(detail: ServerExit) => void} */
  let resolveServerExit
  /** @type {() => void} */
  let resolveServerAnnouncement
  const serverExitListeners = new Set()
  /** @type {Promise<ServerExit>} */
  const serverExit = new Promise(resolveExit => { resolveServerExit = resolveExit })
  /** @type {Promise<void>} */
  const serverAnnouncement = new Promise(resolveAnnouncement => { resolveServerAnnouncement = resolveAnnouncement })
  const noteServerExit = detail => {
    if (serverFailure) return
    serverFailure = detail
    resolveServerExit(detail)
    serverExitAbort.abort(serverExitError(detail, logRelativePath))
    for (const listener of serverExitListeners) listener(detail)
    serverExitListeners.clear()
  }

  const beginOperation = name => {
    if (activeOperation) throw new Error(`Cannot start ${name} while local ${activeOperation} is in progress.`)
    activeOperation = name
    activeOperationFinished = new Promise(resolveFinished => { resolveActiveOperation = resolveFinished })
    return () => {
      activeOperation = undefined
      resolveActiveOperation()
      activeOperationFinished = undefined
    }
  }

  /** @param {VerificationEpoch} epoch @param {string} reason */
  const invalidateEpoch = (epoch, reason) => {
    if (epoch.firstInvalidation) return
    epoch.firstInvalidation = reason
    epoch.resolveInvalidation(reason)
    if (!epoch.controller.signal.aborted) epoch.controller.abort(new Error(reason))
  }

  const waitWithinDeadline = async (action, deadline, label, signals = []) => {
    if (deadline === undefined) return raceWithAbort(action, signals)
    const timeoutMs = Math.max(0, deadline - now())
    let timer
    const timeout = new Promise((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`Timed out after ${readinessTimeoutMs} ms ${label}.`)), timeoutMs)
    })
    try {
      return await raceWithAbort(Promise.race([action, timeout]), signals)
    } finally {
      clearTimeout(timer)
    }
  }

  /** @param {VerificationEpoch} epoch */
  const attachEpochMonitor = async epoch => {
    const monitorCreation = Promise.resolve().then(() => createSourceMonitor({ rootDirectory: root }))
      .then(async monitor => {
        if (closed || epoch.firstInvalidation || epoch.controller.signal.aborted) {
          await closeSourceMonitor(monitor)
          throw new Error(epoch.firstInvalidation ?? 'Local test session was closed while verification was being prepared.')
        }
        epoch.sourceMonitor = monitor
        void monitor.invalidated.then(reason => invalidateEpoch(epoch, reason))
        if (compatibilityFailure) invalidateEpoch(epoch, compatibilityFailure)
        return monitor
      })
    epoch.monitorTask = monitorCreation.then(() => {}, error => {
      if (epoch.controller.signal.aborted && error instanceof AggregateError) epoch.monitorCleanupFailure = error
    })
    await waitWithinDeadline(
      monitorCreation,
      epoch.preparationDeadline,
      'preparing the local source monitor',
      [epoch.controller.signal, sessionAbort.signal, serverExitAbort.signal],
    )
  }

  /** @param {number | undefined} preparationDeadline */
  const createEpoch = (preparationDeadline) => {
    /** @type {(reason: string) => void} */
    let resolveInvalidation
    const invalidated = new Promise(resolve => { resolveInvalidation = resolve })
    /** @type {VerificationEpoch} */
    const epoch = {
      controller: new AbortController(),
      firstInvalidation: undefined,
      sourceMonitor: undefined,
      browserReadiness: undefined,
      child: undefined,
      cleanupPromise: undefined,
      invalidated,
      resolveInvalidation: reason => resolveInvalidation(reason),
      readinessTask: undefined,
      readinessCleanupFailure: undefined,
      monitorTask: undefined,
      monitorCleanupFailure: undefined,
      monitorCloseTask: undefined,
      preparationDeadline,
    }
    currentEpoch = epoch
    return epoch
  }

  /** @param {VerificationEpoch} epoch */
  const checkEpoch = async epoch => {
    if (closed) throw new Error('Local test session was closed while verification was being prepared.')
    const sourceFailure = await waitWithinDeadline(
      epoch.sourceMonitor?.check() ?? Promise.resolve(undefined),
      epoch.preparationDeadline,
      'checking local verification inputs',
      [sessionAbort.signal],
    )
    if (sourceFailure) invalidateEpoch(epoch, sourceFailure)
    if (compatibilityFence) {
      const fenceFailure = await waitWithinDeadline(
        compatibilityFence.check(),
        epoch.preparationDeadline,
        'checking local verification inputs',
        [sessionAbort.signal],
      )
      if (fenceFailure) {
        compatibilityFailure ??= fenceFailure
        invalidateEpoch(epoch, fenceFailure)
      }
    }
    return epoch.firstInvalidation
  }

  /** @param {VerificationEpoch} epoch @param {Promise<unknown>} action */
  const waitForEpochPreparation = async (epoch, action) => waitWithinDeadline(
    action,
    epoch.preparationDeadline,
    'qualifying the local verification epoch',
    [epoch.controller.signal, sessionAbort.signal, serverExitAbort.signal],
  )

  /** @param {VerificationEpoch} epoch */
  const openEpochBrowserReadiness = async (epoch, timeoutMs) => {
    const pendingReadiness = Promise.resolve().then(() => {
      if (closed || epoch.firstInvalidation) throw new Error(epoch.firstInvalidation ?? 'Local test session was closed.')
      return openBrowserReadiness({
        url: baseURL,
        timeoutMs,
        signal: AbortSignal.any([epoch.controller.signal, sessionAbort.signal, serverExitAbort.signal]),
        channel: env.PLAYWRIGHT_CHANNEL || undefined,
      })
    }).then(async resource => {
      if (closed || epoch.firstInvalidation || epoch.controller.signal.aborted || sessionAbort.signal.aborted || serverExitAbort.signal.aborted) {
        try {
          await resource.close()
        } catch (error) {
          const cleanupFailure = new AggregateError([error], 'Could not close late browser readiness after its epoch was invalidated.', { cause: error })
          epoch.readinessCleanupFailure = cleanupFailure
          throw cleanupFailure
        }
        throw new Error(epoch.firstInvalidation ?? 'Local test session was closed while browser readiness was starting.')
      }
      epoch.browserReadiness = resource
      void resource.invalidated.then(reason => invalidateEpoch(epoch, reason))
      return resource
    })
    epoch.readinessTask = pendingReadiness.then(() => {}, error => {
      if (error instanceof AggregateError) epoch.readinessCleanupFailure = error
    })
    await waitForEpochPreparation(epoch, pendingReadiness)
  }

  /** @param {VerificationEpoch} epoch @param {number} deadline */
  const prepareRerunEpoch = async (epoch, deadline) => {
    const initialFailure = await checkEpoch(epoch)
    if (initialFailure) throw new Error(initialFailure)
    if (!pureOnly) {
      const httpTimeout = Math.max(0, deadline - now())
      await waitForEpochPreparation(epoch, waitForHttpReady({
        url: baseURL,
        fetchImpl,
        timeoutMs: httpTimeout,
        intervalMs: readinessIntervalMs,
        now,
        signal: AbortSignal.any([epoch.controller.signal, sessionAbort.signal, serverExitAbort.signal]),
        isAlive: () => !serverFailure && !hasExited(serverProcess),
      }))
      if (closed) throw new Error('Local test session was closed while verification was being prepared.')
      const browserTimeout = Math.max(0, deadline - now())
      if (!browserTimeout) throw new Error(`Timed out after ${readinessTimeoutMs} ms preparing local browser readiness.`)
      await openEpochBrowserReadiness(epoch, browserTimeout)
    }
    const finalFailure = await checkEpoch(epoch)
    if (finalFailure) throw new Error(finalFailure)
    if (now() > deadline) throw new Error(`Timed out after ${readinessTimeoutMs} ms preparing the local verification epoch.`)
  }

  /** @param {VerificationEpoch} epoch */
  const cleanupEpoch = async (epoch, { retainOwnership = false } = {}) => {
    if (epoch.cleanupPromise) return epoch.cleanupPromise
    epoch.cleanupPromise = (async () => {
      if (!epoch.controller.signal.aborted) epoch.controller.abort(new Error('Local verification epoch finished.'))
      const cleanupErrors = []
      for (const task of [epoch.monitorTask, epoch.readinessTask]) {
        if (!task) continue
        try {
          await waitWithinDeadline(task, epoch.preparationDeadline ?? now() + readinessTimeoutMs, 'settling owned verification resources')
        } catch (error) {
          cleanupErrors.push(error)
        }
      }
      if (epoch.readinessCleanupFailure) cleanupErrors.push(epoch.readinessCleanupFailure)
      if (epoch.monitorCleanupFailure) cleanupErrors.push(epoch.monitorCleanupFailure)
      if (epoch.browserReadiness) {
        try {
          await epoch.browserReadiness.close()
        } catch (error) {
          cleanupErrors.push(error)
        }
        epoch.browserReadiness = undefined
      }
      if (epoch.sourceMonitor) {
        try {
          epoch.monitorCloseTask ??= closeSourceMonitor(epoch.sourceMonitor)
          await waitWithinDeadline(
            epoch.monitorCloseTask,
            epoch.preparationDeadline ?? now() + readinessTimeoutMs,
            'closing the local source monitor',
          )
          epoch.sourceMonitor = undefined
        } catch (error) {
          cleanupErrors.push(error)
        }
      }
      if (cleanupErrors.length) {
        sessionCleanupFailure ??= cleanupErrors.map(error => error.message).join('; ')
      }
      if (currentEpoch === epoch && !retainOwnership && !cleanupErrors.length) currentEpoch = undefined
      if (preparingEpoch === epoch) preparingEpoch = undefined
      if (cleanupErrors.length) throw new AggregateError(cleanupErrors, 'Could not clean up the local verification epoch.')
    })()
    return epoch.cleanupPromise
  }

  /** @param {LocalSourceMonitor} monitor */
  const closeSourceMonitor = async monitor => {
    if (closedMonitors.has(monitor)) return
    closedMonitors.add(monitor)
    await monitor.close()
  }

  const reportInvalidResult = async (reason, jsonReportPath, cleanupError, requireFreshSession = false) => {
    let reportDetail = ' No Playwright report was produced because the test child had not started.'
    if (jsonReportPath) {
      const invalidationPath = resolve(dirname(jsonReportPath), 'local-result-invalidated.json')
      try {
        await writeFile(invalidationPath, `${JSON.stringify({
          kind: 'invalidated',
          reason,
          playwrightJsonReport: relative(root, jsonReportPath),
          recordedAt: new Date(now()).toISOString(),
          cleanupError: cleanupError?.message,
        }, null, 2)}\n`, { flag: 'wx' })
        reportDetail = ` Playwright JSON report: ${relative(root, jsonReportPath)}. Invalidation record: ${relative(root, invalidationPath)}.`
      } catch (error) {
        reportDetail = ` Playwright JSON report: ${relative(root, jsonReportPath)}. Could not write the invalidation record: ${error.message}.`
      }
    }
    const cleanupDetail = cleanupError ? ` Could not stop the Playwright child cleanly: ${cleanupError.message}.` : ''
    const nextStep = requireFreshSession
      ? ' Start a fresh local test session before rerunning.'
      : ' Rerun after the inputs are stable.'
    writeStderr(`Local Playwright result is invalid because ${reason}${nextStep}${cleanupDetail}${reportDetail}\n`)
    return 1
  }

  return {
    baseURL,
    logPath,
    logRelativePath,
    artifactDirectory,
    serverExit,
    onServerExit(listener) {
      if (serverFailure) {
        listener(serverFailure)
        return () => {}
      }
      serverExitListeners.add(listener)
      return () => serverExitListeners.delete(listener)
    },

    async start(args = []) {
      const finishOperation = beginOperation('session startup')
      try {
        if (started) throw new Error('Local test server has already been started.')
        if (closed) throw new Error('Local test session is already closed.')
        assertLauncherOwnsPlaywrightOutputs(args)
        assertFreshPlaywrightOutputs({ outputDirectory: artifactDirectory }, { cwd: root })
        pureOnly = isPureOnlySelection(args)
        const fenceCreation = Promise.resolve().then(() => createSourceMonitor({
          rootDirectory: root,
          ignoreFile: isCompatibleIdleInput,
          onIgnoredFileChange: relativePath => {
            if (preparingEpoch) {
              invalidateEpoch(preparingEpoch, `Compatible verification input changed during requalification: ${relativePath}.`)
            }
          },
        })).then(async monitor => {
          if (closed || sessionAbort.signal.aborted) {
            await closeSourceMonitor(monitor)
            return
          }
          compatibilityFence = monitor
          void monitor.invalidated.then(reason => {
            compatibilityFailure ??= reason
            if (currentEpoch) invalidateEpoch(currentEpoch, reason)
          })
        })
        compatibilityFenceTask = fenceCreation
        void fenceCreation.catch(() => {})
        await raceWithAbort(fenceCreation, [sessionAbort.signal])
        const initialEpoch = createEpoch(undefined)
        preparingEpoch = initialEpoch
        await attachEpochMonitor(initialEpoch)
        const initialFailure = await checkEpoch(initialEpoch)
        if (closed) throw new Error('Local test session was closed before verification could start.')
        if (initialFailure) throw invalidRunError(initialFailure, logRelativePath)
        if (pureOnly) {
          started = true
          writeStdout('Pure Playwright project selected; no local server or browser readiness probe is needed.\n')
          return
        }
        try {
          await raceWithAbort(checkPortAvailable(port), [sessionAbort.signal])
        } catch (error) {
          if (closed) throw new Error('Local test session was closed before the server could start.', { cause: error })
          throw error
        }
        if (closed) throw new Error('Local test session was closed before the server could start.')
        const beforeSpawnFailure = await checkEpoch(initialEpoch)
        if (beforeSpawnFailure) throw invalidRunError(beforeSpawnFailure, logRelativePath)
        await mkdir(artifactDirectory, { recursive: true })
        if (closed) throw new Error('Local test session was closed before the server could start.')
        logWriter = await createLogWriter(logPath)
        if (closed) {
          await logWriter.close()
          logWriter = undefined
          throw new Error('Local test session was closed before the server could start.')
        }
        const serverEnvironment = { ...env, _PORT: String(port) }
        serverProcess = spawnProcess(process.execPath, [
          nuxtCli,
          'dev',
          '--host', defaultHost,
          '--port', String(port),
          '--strictPort',
          '--no-takeover',
          '--no-tui',
        ], {
          cwd: root,
          env: serverEnvironment,
          stdio: ['ignore', 'pipe', 'pipe'],
          detached: platform !== 'win32',
          windowsHide: true,
        })
        started = true
        serverProcess.once('error', error => noteServerExit({ error }))
        serverProcess.once('exit', (code, signal) => noteServerExit({ code, signal }))
        const secrets = sensitiveEnvironmentValues(env)
        let startupOutput = ''
        const observeStartupOutput = text => {
          startupOutput = `${startupOutput}${text}`.slice(-4_096)
          const expectedURL = escapeRegExp(baseURL)
          if (new RegExp(`Local:\\s*${expectedURL}/?`).test(stripAnsi(startupOutput))) resolveServerAnnouncement()
        }
        teeServerStream(serverProcess.stdout, writeStdout, logWriter, secrets, observeStartupOutput)
        teeServerStream(serverProcess.stderr, writeStderr, logWriter, secrets, observeStartupOutput)

        const startupDeadline = now() + readinessTimeoutMs
        const startupSignal = AbortSignal.any([initialEpoch.controller.signal, sessionAbort.signal, serverExitAbort.signal])
        const serverReady = (async () => {
          await waitForAnnouncement(serverAnnouncement, Math.max(0, startupDeadline - now()), startupSignal)
          await waitForHttpReady({
            url: baseURL,
            fetchImpl,
            timeoutMs: Math.max(0, startupDeadline - now()),
            intervalMs: readinessIntervalMs,
            now,
            signal: startupSignal,
            isAlive: () => !serverFailure && !hasExited(serverProcess),
          })
        })()
        await waitForEpochPreparation(initialEpoch, serverReady).catch(error => {
          throw new Error(`Could not start the local development server. ${error.message} Server log: ${logRelativePath}`, { cause: error })
        })
        initialEpoch.preparationDeadline = now() + readinessTimeoutMs
        const readiness = openEpochBrowserReadiness(initialEpoch, readinessTimeoutMs)
        try {
          await readiness
          const finalFailure = await checkEpoch(initialEpoch)
          if (closed) throw new Error('Local test session was closed before browser readiness could finish.')
          if (finalFailure) throw invalidRunError(finalFailure, logRelativePath)
          initialEpoch.preparationDeadline = undefined
        } catch (error) {
          await cleanupEpoch(initialEpoch)
          if (initialEpoch.firstInvalidation) throw invalidRunError(initialEpoch.firstInvalidation, logRelativePath)
          throw new Error(`Could not verify the local application before Playwright started. ${error.message} Server log: ${logRelativePath}`, { cause: error })
        }
        writeStdout(`Local development server ready at ${baseURL}\nServer log: ${logRelativePath}\n`)
      } finally {
        finishOperation()
      }
    },

    async runTest(args) {
      const finishOperation = beginOperation('Playwright run')
      /** @type {VerificationEpoch | undefined} */
      let spawnedEpoch
      /** @type {string | undefined} */
      let spawnedReportPath
      try {
        assertLauncherOwnsPlaywrightOutputs(args)
        if (!started || closed) throw new Error('Local test session is not running.')
        if (!pureOnly && (!serverProcess || serverFailure || hasExited(serverProcess))) {
          throw serverExitError(serverFailure ?? { code: serverProcess?.exitCode, signal: serverProcess?.signalCode }, logRelativePath)
        }
        if (testProcess && !hasExited(testProcess)) throw new Error('A prior Playwright child is still owned by this session; close the session before retrying.')
        if (sessionCleanupFailure) {
          throw new Error(`Verification resource cleanup failed (${sessionCleanupFailure}); start a fresh local test session.`)
        }
        let epoch = currentEpoch
        if (compatibilityFailure) return reportInvalidResult(compatibilityFailure, undefined, undefined, true)
        const needsRequalification = !epoch
        const deadline = needsRequalification ? now() + readinessTimeoutMs : undefined
        if (!epoch) {
          epoch = createEpoch(deadline)
          // Arm the session-fence handoff before the first asynchronous operation. Compatible
          // watcher events from this point through spawn belong to this preparation epoch.
          preparingEpoch = epoch
        }
        try {
          if (compatibilityFence) {
            compatibilityFailure = await waitWithinDeadline(
              compatibilityFence.check(),
              epoch.preparationDeadline,
              'checking local verification inputs',
              [sessionAbort.signal],
            )
          }
          if (compatibilityFailure) invalidateEpoch(epoch, compatibilityFailure)
          if (epoch.firstInvalidation) throw new Error(epoch.firstInvalidation)
          if (!epoch.sourceMonitor) await attachEpochMonitor(epoch)
          if (needsRequalification) await prepareRerunEpoch(epoch, deadline)
        } catch (error) {
          if (!epoch.firstInvalidation && !closed && !serverFailure) invalidateEpoch(epoch, error.message)
          const invalidation = epoch.firstInvalidation ?? compatibilityFailure
          await cleanupEpoch(epoch)
          if (closed) throw new Error('Local test session was closed while preparing the Playwright run.', { cause: error })
          if (serverFailure) throw serverExitError(serverFailure, logRelativePath)
          if (sessionCleanupFailure) {
            throw new Error(`Verification resource cleanup failed (${sessionCleanupFailure}); start a fresh local test session.`, { cause: error })
          }
          if (invalidation) return reportInvalidResult(invalidation, undefined, undefined, Boolean(compatibilityFailure))
          writeStderr(`Could not requalify the local application before Playwright started. ${error.message} Server log: ${logRelativePath}\n`)
          return 1
        }
        if (!epoch.sourceMonitor) throw new Error('Local source monitor has not started for this verification epoch.')
        let invalidation = await checkEpoch(epoch)
        if (closed) throw new Error('Local test session was closed while preparing the Playwright run.')
        if (invalidation) {
          await cleanupEpoch(epoch)
          return reportInvalidResult(invalidation, undefined)
        }
        runNumber += 1
        const childEnvironment = { ...env }
        delete childEnvironment.PLAYWRIGHT_PRODUCTION_URL
        if (!pureOnly) childEnvironment.PLAYWRIGHT_BASE_URL = baseURL
        const runPaths = createPlaywrightRunPaths({
          runRoot: resolve(artifactDirectory, `playwright-run-${runNumber}`),
        })
        const jsonReportPath = runPaths.resultsFile
        assertFreshPlaywrightOutputs({
          outputDirectory: runPaths.artifactsDirectory,
          jsonReportFile: jsonReportPath,
          htmlReportDirectory: runPaths.htmlDirectory,
        }, { cwd: root })
        try {
          await waitForEpochPreparation(epoch, prepareOutputDirectory(runPaths.artifactsDirectory))
        } catch (error) {
          if (closed) throw new Error('Local test session was closed while preparing the Playwright run.', { cause: error })
          if (serverFailure) {
            await cleanupEpoch(epoch)
            throw serverExitError(serverFailure, logRelativePath)
          }
          if (epoch.firstInvalidation) {
            const reason = epoch.firstInvalidation
            await cleanupEpoch(epoch)
            return reportInvalidResult(reason, undefined)
          }
          throw error
        }
        if (closed) throw new Error('Local test session was closed while preparing the Playwright run.')
        invalidation = await checkEpoch(epoch)
        if (closed) throw new Error('Local test session was closed while preparing the Playwright run.')
        if (invalidation) {
          await cleanupEpoch(epoch)
          return reportInvalidResult(invalidation, undefined)
        }
        if (epoch.preparationDeadline !== undefined && now() >= epoch.preparationDeadline) {
          invalidateEpoch(epoch, `Timed out after ${readinessTimeoutMs} ms preparing the local verification epoch.`)
          const reason = epoch.firstInvalidation
          await cleanupEpoch(epoch)
          return reportInvalidResult(reason, undefined)
        }
        childEnvironment.PLAYWRIGHT_OUTPUT_DIR = runPaths.artifactsDirectory
        childEnvironment.PLAYWRIGHT_JSON_OUTPUT_FILE = jsonReportPath
        childEnvironment.PLAYWRIGHT_JSON_OUTPUT_DIR = runPaths.runRoot
        childEnvironment.PLAYWRIGHT_JSON_OUTPUT_NAME = 'results.json'
        childEnvironment.PLAYWRIGHT_HTML_OUTPUT_DIR = runPaths.htmlDirectory
        childEnvironment.PLAYWRIGHT_HTML_REPORT = runPaths.htmlDirectory
        childEnvironment[PLAYWRIGHT_OUTPUT_RUN_ROOT_ENV] = runPaths.runRoot
        delete childEnvironment[PLAYWRIGHT_OUTPUT_OWNERSHIP_ENV]
        delete childEnvironment.PLAYWRIGHT_LAST_RUN_OUTPUT_FILE
        if (!pureOnly && (!serverProcess || serverFailure || hasExited(serverProcess))) {
          await cleanupEpoch(epoch)
          throw serverExitError(serverFailure ?? { code: serverProcess?.exitCode, signal: serverProcess?.signalCode }, logRelativePath)
        }
        if (epoch.firstInvalidation) {
          const reason = epoch.firstInvalidation
          await cleanupEpoch(epoch)
          return reportInvalidResult(reason, undefined)
        }
        epoch.preparationDeadline = undefined
        const child = spawnProcess(process.execPath, [playwrightCli, 'test', ...args], {
          cwd: root,
          env: childEnvironment,
          stdio: 'inherit',
          detached: platform !== 'win32',
          windowsHide: true,
        })
        testProcess = child
        epoch.child = child
        spawnedEpoch = epoch
        spawnedReportPath = jsonReportPath
        const testExit = waitForChildClose(child)
        const stopped = raceWithAbort(new Promise(() => {}), [sessionAbort.signal, serverExitAbort.signal])
          .then(() => ({ kind: 'closed' }))
          .catch(error => serverFailure
            ? ({ kind: 'server', detail: serverFailure })
            : ({ kind: 'closed', error }))
        const outcome = await Promise.race([
          testExit.then(result => ({ kind: 'test', result })),
          epoch.invalidated.then(reason => ({ kind: 'invalid', reason })),
          stopped,
        ])
        if (outcome.kind === 'closed' || closed) {
          throw new Error('Local test session was closed while the Playwright run was active.')
        }
        if (outcome.kind === 'server') {
          if (!hasExited(child)) await stopProcessTree(child, { platform, spawnProcess })
          if (hasExited(child)) await testExit
          if (hasExited(child)) {
            testProcess = undefined
            epoch.child = undefined
            await checkEpoch(epoch)
            await cleanupEpoch(epoch)
          } else {
            throw new AggregateError([
              serverExitError(outcome.detail, logRelativePath),
              new Error(`Playwright child ${child.pid ?? 'unknown'} did not close after the stop request.`),
            ], 'The development server and Playwright child did not close cleanly.')
          }
          throw serverExitError(outcome.detail, logRelativePath)
        }
        if (outcome.kind === 'invalid') invalidateEpoch(epoch, outcome.reason)
        let cleanupError
        if (outcome.kind === 'invalid' && !hasExited(child)) {
          try {
            await stopProcessTree(child, { platform, spawnProcess })
          } catch (error) {
            cleanupError = error
          }
        }
        if (hasExited(child)) {
          await testExit
          testProcess = undefined
          epoch.child = undefined
        }
        if (outcome.kind === 'test' && !outcome.result.error) {
          await checkEpoch(epoch)
          await Promise.resolve()
        }
        const childResult = outcome.kind === 'test' ? outcome.result : undefined
        const invalidReason = epoch.firstInvalidation ?? compatibilityFailure
        const childStillOwned = !hasExited(child)
        if (childStillOwned) {
          cleanupError ??= new Error(`Playwright child ${child.pid ?? 'unknown'} did not close after the stop request.`)
        } else {
          try {
            await cleanupEpoch(epoch)
          } catch (error) {
            cleanupError ??= error
          }
        }
        await Promise.resolve()
        const finalInvalidReason = epoch.firstInvalidation ?? compatibilityFailure
        if (finalInvalidReason) return reportInvalidResult(finalInvalidReason, jsonReportPath, cleanupError, Boolean(compatibilityFailure))
        if (outcome.kind === 'invalid') return reportInvalidResult(invalidReason ?? outcome.reason, jsonReportPath, cleanupError)
        if (childResult?.error || childStillOwned) {
          writeStderr(`Could not launch or stop Playwright cleanly: ${childResult?.error?.message ?? cleanupError?.message ?? 'the child process is still running.'}\n`)
          return 1
        }
        if (cleanupError) throw cleanupError
        return childResult?.code ?? (childResult?.signal ? 1 : 0)
      } catch (error) {
        if (spawnedEpoch?.firstInvalidation && spawnedReportPath) {
          await reportInvalidResult(spawnedEpoch.firstInvalidation, spawnedReportPath)
        }
        throw error
      } finally {
        finishOperation()
      }
    },

    async close() {
      if (closing) return closing
      if (closed) return
      closed = true
      const closeMessage = activeOperation === 'session startup'
        ? 'Local test session was closed before verification could start.'
        : activeOperation === 'Playwright run'
          ? 'Local test session was closed while preparing the Playwright run.'
          : 'Local test session was closed.'
      sessionAbort.abort(new Error(closeMessage))
      currentEpoch?.controller.abort(new Error('Local test session was closed.'))
      closing = (async () => {
        const cleanupErrors = []
        for (const child of [testProcess, serverProcess]) {
          if (child && !hasExited(child)) {
            try {
              await stopProcessTree(child, { platform, spawnProcess })
            } catch (error) {
              cleanupErrors.push(error)
            }
          }
        }
        if (activeOperationFinished) await activeOperationFinished
        if (compatibilityFenceTask) {
          try {
            await waitWithinDeadline(compatibilityFenceTask, now() + readinessTimeoutMs, 'settling the local compatibility fence')
          } catch (error) {
            cleanupErrors.push(error)
            sessionCleanupFailure ??= error.message
          }
        }
        const closingEpoch = currentEpoch
        if (closingEpoch) {
          try {
            await cleanupEpoch(closingEpoch, {
              retainOwnership: Boolean(
                (closingEpoch.child && !hasExited(closingEpoch.child))
                || (serverProcess && !hasExited(serverProcess)),
              ),
            })
          } catch (error) {
            cleanupErrors.push(error)
          }
          if (closingEpoch.monitorCloseTask) {
            try {
              await closingEpoch.monitorCloseTask
            } catch (error) {
              cleanupErrors.push(error)
            }
          }
        }
        if (compatibilityFence) {
          try {
            await closeSourceMonitor(compatibilityFence)
          } catch (error) {
            cleanupErrors.push(error)
          }
          compatibilityFence = undefined
        }
        if (hasExited(testProcess)) testProcess = undefined
        if (hasExited(serverProcess)) serverProcess = undefined
        if (logWriter) await logWriter.close()
        if (cleanupErrors.length) throw new AggregateError(cleanupErrors, 'Could not clean up all local test processes and verification resources.')
      })()
      return closing
    },
  }
}

/** @param {{ runTest: (args: string[]) => Promise<number>, serverExit: Promise<ServerExit>, onServerExit?: (listener: (detail: ServerExit) => void) => () => void, logRelativePath: string }} session @param {string[]} args @param {InteractiveSessionOptions} [options] */
export async function runInteractiveSession(session, args, {
  input = process.stdin,
  output = process.stdout,
  onInterface = () => {},
  onInterrupt = () => {},
  interruptSignal,
  shouldStop = () => undefined,
} = {}) {
  let exitCode = await session.runTest(args)
  while (true) {
    const stoppedCode = shouldStop()
    if (stoppedCode !== undefined) return stoppedCode
    const readline = createInterface({ input, output })
    onInterface(readline)
    /** @type {(outcome: { kind: 'interrupt', code?: number }) => void} */
    let resolvePromptInterrupt
    const promptInterrupted = new Promise(resolve => { resolvePromptInterrupt = resolve })
    readline.once('SIGINT', () => {
      onInterrupt()
      readline.close()
      resolvePromptInterrupt({ kind: 'interrupt' })
    })
    const signalInterruption = interruptSignal?.then(code => ({ kind: 'interrupt', code }))
    /** @type {{ kind: 'input', answer: string } | { kind: 'server', detail: ServerExit } | { kind: 'interrupt', code?: number }} */
    let outcome
    /** @type {(outcome: { kind: 'server', detail: ServerExit }) => void} */
    let resolvePromptServer
    const promptServerExit = new Promise(resolve => { resolvePromptServer = resolve })
    const unsubscribeServerExit = session.onServerExit?.(detail => resolvePromptServer({ kind: 'server', detail }))
    if (!unsubscribeServerExit) void session.serverExit.then(detail => resolvePromptServer({ kind: 'server', detail }))
    try {
      outcome = await Promise.race([
        readline.question('\nPress Enter to rerun the same Playwright command, or q then Enter to quit: ')
          .then(answer => ({ kind: 'input', answer })),
        promptServerExit,
        promptInterrupted,
        ...(signalInterruption ? [signalInterruption] : []),
      ])
    } finally {
      readline.close()
      onInterface(undefined)
      unsubscribeServerExit?.()
    }
    if (outcome.kind === 'interrupt') return outcome.code ?? shouldStop() ?? 130
    if (outcome.kind === 'server') throw serverExitError(outcome.detail, session.logRelativePath)
    if (outcome.answer.trim().toLowerCase() === 'q') return exitCode
    exitCode = await session.runTest(args)
  }
}

/** @param {import('node:events').EventEmitter} [signalSource] @param {(signal: NodeJS.Signals) => void} [onSignal] @returns {{ interrupted: Promise<number>, interrupt: (signal: NodeJS.Signals) => void, dispose: () => void }} */
export function createSignalController(signalSource = process, onSignal = () => {}) {
  /** @type {(code: number) => void} */
  let resolveInterrupted
  /** @type {Promise<number>} */
  const interrupted = new Promise(resolve => { resolveInterrupted = resolve })
  /** @param {NodeJS.Signals} signal */
  const handleSignal = signal => {
    const code = signal === 'SIGINT' ? 130 : 143
    onSignal(signal)
    resolveInterrupted(code)
  }
  const onSigint = () => handleSignal('SIGINT')
  const onSigterm = () => handleSignal('SIGTERM')
  signalSource.once('SIGINT', onSigint)
  signalSource.once('SIGTERM', onSigterm)
  return {
    interrupted,
    interrupt: handleSignal,
    dispose() {
      signalSource.removeListener('SIGINT', onSigint)
      signalSource.removeListener('SIGTERM', onSigterm)
    },
  }
}

export async function main(args = process.argv.slice(2)) {
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(helpText)
    return 0
  }

  let port
  try {
    port = parsePort(process.env.LOCAL_TEST_PORT)
  } catch (error) {
    process.stderr.write(`${error.message}\n`)
    return 1
  }

  const session = createLocalTestSession({ port })
  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY)
  /** @type {import('node:readline/promises').Interface | undefined} */
  let readline
  /** @type {number | undefined} */
  let interruptCode
  const signals = createSignalController(process, signal => {
    interruptCode = signal === 'SIGINT' ? 130 : 143
    readline?.close()
  })

  const execute = (async () => {
    await session.start(args)
    if (!interactive) return session.runTest(args)
    return runInteractiveSession(session, args, {
      onInterface: active => { readline = active },
      onInterrupt: () => signals.interrupt('SIGINT'),
      interruptSignal: signals.interrupted,
      shouldStop: () => interruptCode,
    })
  })()

  let exitCode
  try {
    exitCode = await Promise.race([
      execute.catch(error => {
        if (interruptCode === undefined) process.stderr.write(`${error.message}\n`)
        return interruptCode ?? 1
      }),
      signals.interrupted,
    ])
  } finally {
    signals.dispose()
    readline?.close()
    try {
      await session.close()
    } catch (error) {
      process.stderr.write(`${error.message}\n`)
      exitCode = 1
    }
  }
  return exitCode ?? 1
}

const helpText = `Usage: npm run test:local -- [Playwright arguments]

Starts an owned Nuxt development server on 127.0.0.1:3100 (or LOCAL_TEST_PORT),
waits for HTTP readiness, and runs Playwright against that server. The server
stays alive for Enter-to-rerun in a terminal. Use q then Enter or Ctrl+C to exit.
Non-interactive runs execute once and clean up. An occupied port is an error.
Each run has its own Playwright run root with artifacts/, results.json, and html/
destinations. Nuxt output is saved under
test-results/local-test-<timestamp>-<pid>-<random>/server.log. test:local owns those
Playwright paths, so --output, --last-failed-file, and --config overrides are not accepted.

Examples:
  npm run test:local -- tests/workspace-ui-smoke.spec.ts --project=browser
  npm run test:local -- tests/local-test-launcher.spec.ts --project=pure
  npm run test:local -- --grep "route placement"
`

function parsePort(value) {
  if (value === undefined || value === '') return defaultPort
  const port = Number(value)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('LOCAL_TEST_PORT must be an integer between 1 and 65535.')
  }
  return port
}

/** @param {string} path @returns {Promise<LogWriter>} */
async function createFileLogWriter(path) {
  await mkdir(dirname(path), { recursive: true })
  const stream = createWriteStream(path, { flags: 'wx' })
  let streamError
  stream.on('error', error => { streamError = error })
  await new Promise((resolveOpen, rejectOpen) => {
    stream.once('open', resolveOpen)
    stream.once('error', rejectOpen)
  })
  return {
    write(value) {
      if (!streamError) stream.write(value)
    },
    close() {
      if (streamError) return Promise.reject(streamError)
      return new Promise((resolveClose, rejectClose) => {
        stream.end(error => error ? rejectClose(error) : resolveClose())
      })
    },
  }
}

/** @param {string[]} args */
function assertLauncherOwnsPlaywrightOutputs(args) {
  for (const argument of args) {
    const option = argument.split('=', 1)[0]
    const normalizedOption = option.startsWith('--') ? option : option.slice(0, 2)
    const packedConfigShortFlag = /^-[^-]*c/.test(option)
    if (['--output', '--config', '-c', '--last-failed-file'].includes(normalizedOption) || packedConfigShortFlag) {
      throw new Error(`test:local owns Playwright output paths; remove the ${option} override.`)
    }
  }
}

/** @param {NodeJS.ProcessEnv} env @returns {string[]} */
function sensitiveEnvironmentValues(env) {
  return Object.entries(env)
    .filter(([name, value]) => /(?:^|[_-])(?:secret|token|password|passwd|credentials?|private[_-]?key|api[_-]?key|access[_-]?key|auth|authorization|dsn|connection[_-]?string|database[_-]?url|bearer)$/i.test(name) && typeof value === 'string' && value.length > 0)
    .map(([, value]) => value)
    .sort((left, right) => right.length - left.length)
}

/** @param {ProcessOutputStream | undefined} stream @param {(value: string) => void} writeTerminal @param {LogWriter} logWriter @param {string[]} secrets @param {(text: string) => void} [observeOutput] */
function teeServerStream(stream, writeTerminal, logWriter, secrets, observeOutput = () => {}) {
  if (!(stream instanceof Readable)) return
  const decoder = new StringDecoder('utf8')
  let pending = ''
  const write = text => {
    if (!text) return
    const safe = redactCredentialAssignments(redact(text, secrets))
    writeTerminal(safe)
    logWriter.write(safe)
  }
  stream.on('data', chunk => {
    const decoded = decoder.write(chunk)
    observeOutput(decoded)
    pending += decoded
    let newline = pending.indexOf('\n')
    while (newline !== -1) {
      write(pending.slice(0, newline + 1))
      pending = pending.slice(newline + 1)
      newline = pending.indexOf('\n')
    }
  })
  stream.on('end', () => {
    const decoded = decoder.end()
    observeOutput(decoded)
    pending += decoded
    write(pending)
  })
}

/** @param {string} value @param {string[]} secrets */
function redact(value, secrets) {
  return secrets.reduce((result, secret) => result.replaceAll(secret, '[REDACTED]'), value)
}

/** @param {string} value */
function redactCredentialAssignments(value) {
  return value
    .replaceAll(/\b(authorization\s*:\s*)bearer\s+[^\s,;]+/gi, '$1Bearer [REDACTED]')
    .replaceAll(/\b([\w.-]*(?:secret|token|password|passwd|credential|private[_-]?key|api[_-]?key|access[_-]?key|auth|dsn|connection[_-]?string|database_url)[\w.-]*\s*[=:]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, '$1[REDACTED]')
}

/** @param {string} value */
function stripAnsi(value) {
  const ansiSequence = new RegExp(`${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`, 'g')
  return value.replaceAll(ansiSequence, '')
}

/** @param {string} value */
function escapeRegExp(value) {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** @param {Promise<void>} announcement @param {number} timeoutMs @param {AbortSignal} [signal] */
async function waitForAnnouncement(announcement, timeoutMs, signal) {
  let timer
  let abort
  const timeout = new Promise((resolveTimeout, rejectTimeout) => {
    timer = setTimeout(() => rejectTimeout(new Error(`Timed out after ${timeoutMs} ms waiting for Nuxt to announce its local URL.`)), timeoutMs)
  })
  const aborted = signal && new Promise((resolveAbort, rejectAbort) => {
    abort = () => rejectAbort(signal.reason ?? new Error('Server readiness wait was cancelled.'))
    signal.addEventListener('abort', abort, { once: true })
  })
  try {
    await Promise.race(aborted ? [announcement, timeout, aborted] : [announcement, timeout])
    if (signal?.aborted) throw signal.reason ?? new Error('Server readiness wait was cancelled.')
  } finally {
    clearTimeout(timer)
    if (abort) signal.removeEventListener('abort', abort)
  }
}

/** @param {ServerExit} detail @param {string} logPath */
function serverExitError(detail, logPath) {
  const status = detail.error
    ? detail.error.message
    : `code ${detail.code ?? 'unknown'}${detail.signal ? `, signal ${detail.signal}` : ''}`
  return new Error(`The owned development server exited (${status}). See ${logPath}.`)
}

/** @param {string} reason @param {string} logPath */
function invalidRunError(reason, logPath) {
  return new Error(`Local verification was invalidated because ${reason} Rerun after the inputs are stable. Server log: ${logPath}.`)
}

/** @template T @param {Promise<T>} action @param {AbortSignal[]} signals @returns {Promise<T>} */
function raceWithAbort(action, signals) {
  action.catch(() => {})
  return new Promise((resolveAction, rejectAction) => {
    const listeners = []
    let settled = false
    const cleanup = () => {
      for (const [signal, listener] of listeners) signal.removeEventListener('abort', listener)
    }
    const settle = callback => value => {
      if (settled) return
      settled = true
      cleanup()
      callback(value)
    }
    const resolve = settle(resolveAction)
    const reject = settle(rejectAction)
    for (const signal of signals) {
      if (signal.aborted) {
        reject(signal.reason ?? new Error('Local verification was cancelled.'))
        return
      }
      const listener = () => reject(signal.reason ?? new Error('Local verification was cancelled.'))
      signal.addEventListener('abort', listener, { once: true })
      listeners.push([signal, listener])
    }
    action.then(resolve, reject)
  })
}

/** @param {LocalChildProcess | undefined} child */
function hasExited(child) {
  return child?.exitCode !== null && child?.exitCode !== undefined || child?.signalCode !== null && child?.signalCode !== undefined
}

/** @param {LocalChildProcess} child @param {number} [timeoutMs] @returns {Promise<ChildCloseResult>} */
function waitForChildClose(child, timeoutMs) {
  return new Promise(resolveClose => {
    let settled = false
    let timer
    const finish = result => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      child.removeListener('close', onClose)
      child.removeListener('error', onError)
      resolveClose(result)
    }
    const onClose = (code, signal) => finish({ code, signal })
    const onError = error => finish({ error })
    child.once('close', onClose)
    child.once('error', onError)
    if (timeoutMs !== undefined) timer = setTimeout(() => finish({ timedOut: true }), timeoutMs)
    if (hasExited(child)) finish({ code: child.exitCode, signal: child.signalCode })
  })
}

/** @param {number} milliseconds @param {AbortSignal} [signal] */
function delay(milliseconds, signal) {
  if (signal?.aborted) return Promise.reject(signal.reason ?? new Error('Wait was cancelled.'))
  return new Promise((resolveWait, rejectWait) => {
    const timer = setTimeout(done, milliseconds)
    function done() {
      signal?.removeEventListener('abort', abort)
      resolveWait()
    }
    function abort() {
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
      rejectWait(signal.reason ?? new Error('Wait was cancelled.'))
    }
    signal?.addEventListener('abort', abort, { once: true })
  })
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.exitCode = await main()
}
