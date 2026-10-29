import { createWriteStream } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import net from 'node:net'
import process from 'node:process'
import { Readable } from 'node:stream'
import { StringDecoder } from 'node:string_decoder'
import { createInterface } from 'node:readline/promises'
import { resolve, dirname, relative } from 'node:path'
import { pathToFileURL } from 'node:url'

const defaultPort = 3100
const serverReadinessTimeoutMs = 300_000
const defaultHost = '127.0.0.1'

/** @typedef {import('node:stream').Readable | import('node:stream').Writable | null} ProcessOutputStream */
/** @typedef {Pick<import('node:child_process').ChildProcess, 'pid' | 'exitCode' | 'signalCode'> & Pick<import('node:events').EventEmitter, 'once' | 'removeListener'> & { stdout?: ProcessOutputStream, stderr?: ProcessOutputStream, kill?: (signal?: NodeJS.Signals) => boolean }} LocalChildProcess */
/** @typedef {(command: string, args: readonly string[], options: import('node:child_process').SpawnOptions) => LocalChildProcess} ProcessSpawner */
/** @typedef {{ code?: number | null, signal?: NodeJS.Signals | null, error?: Error }} ServerExit */
/** @typedef {{ code?: number | null, signal?: NodeJS.Signals | null, error?: Error, timedOut?: boolean }} ChildCloseResult */
/** @typedef {{ write: (value: string) => void, close: () => Promise<void> }} LogWriter */
/** @typedef {{
 * url: string,
 * fetchImpl?: typeof globalThis.fetch,
 * timeoutMs?: number,
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
 * checkPortAvailable?: (port: number) => Promise<void>,
 * stopProcessTree?: (child: LocalChildProcess, options: { platform: NodeJS.Platform, spawnProcess: ProcessSpawner }) => Promise<void>,
 * readinessTimeoutMs?: number,
 * readinessIntervalMs?: number,
 * now?: () => number,
 * pid?: number,
 * platform?: NodeJS.Platform,
 * }} LocalTestSessionOptions */
/** @typedef {{ input?: import('node:stream').Readable, output?: import('node:stream').Writable, onInterface?: (readline: import('node:readline/promises').Interface | undefined) => void, onInterrupt?: () => void, interruptSignal?: Promise<number>, shouldStop?: () => number | undefined }} InteractiveSessionOptions */

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
    const requestTimeout = AbortSignal.timeout(Math.max(1, deadline - now()))
    const requestSignal = signal ? AbortSignal.any([signal, requestTimeout]) : requestTimeout
    try {
      const response = await fetchImpl(url, { signal: requestSignal })
      if (now() >= deadline) break
      if (response.ok) return response
      lastError = new Error(`HTTP ${response.status}`)
    } catch (error) {
      if (signal?.aborted) throw signal.reason ?? error
      if (requestTimeout.aborted) break
      lastError = error
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
  const artifactName = `local-test-${new Date(now()).toISOString().replaceAll(/[:.]/g, '-')}-${pid}`
  const artifactDirectory = resolve(root, 'test-results', artifactName)
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
  /** @type {ServerExit | undefined} */
  let serverFailure
  let runNumber = 0
  /** @type {(detail: ServerExit) => void} */
  let resolveServerExit
  /** @type {() => void} */
  let resolveServerAnnouncement
  /** @type {Promise<ServerExit>} */
  const serverExit = new Promise(resolveExit => { resolveServerExit = resolveExit })
  /** @type {Promise<void>} */
  const serverAnnouncement = new Promise(resolveAnnouncement => { resolveServerAnnouncement = resolveAnnouncement })

  const noteServerExit = detail => {
    if (serverFailure) return
    serverFailure = detail
    resolveServerExit(detail)
  }

  return {
    baseURL,
    logPath,
    logRelativePath,
    artifactDirectory,
    serverExit,

    async start() {
      if (started) throw new Error('Local test server has already been started.')
      if (closed) throw new Error('Local test session is already closed.')
      await checkPortAvailable(port)
      if (closed) throw new Error('Local test session was closed before the server could start.')
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

      const abortReadiness = new AbortController()
      try {
        const deadline = now() + readinessTimeoutMs
        await Promise.race([
          (async () => {
            await waitForAnnouncement(
              serverAnnouncement,
              Math.max(0, deadline - now()),
              abortReadiness.signal,
            )
            await waitForHttpReady({
              url: baseURL,
              fetchImpl,
              timeoutMs: Math.max(0, deadline - now()),
              intervalMs: readinessIntervalMs,
              now,
              signal: abortReadiness.signal,
              isAlive: () => !serverFailure && !hasExited(serverProcess),
            })
          })(),
          serverExit.then(detail => {
            abortReadiness.abort(new Error('The development server exited before becoming ready.'))
            throw serverExitError(detail, logRelativePath)
          }),
        ])
      } catch (error) {
        throw new Error(`Could not start the local development server. ${error.message} Server log: ${logRelativePath}`, { cause: error })
      } finally {
        abortReadiness.abort()
      }
      writeStdout(`Local development server ready at ${baseURL}\nServer log: ${logRelativePath}\n`)
    },

    async runTest(args) {
      if (!started || closed) throw new Error('Local test session is not running.')
      if (!serverProcess) throw new Error('Local development server has not started.')
      if (serverFailure || hasExited(serverProcess)) {
        throw serverExitError(serverFailure ?? { code: serverProcess.exitCode, signal: serverProcess.signalCode }, logRelativePath)
      }
      runNumber += 1
      const childEnvironment = { ...env }
      delete childEnvironment.PLAYWRIGHT_PRODUCTION_URL
      childEnvironment.PLAYWRIGHT_BASE_URL = baseURL
      childEnvironment.PLAYWRIGHT_OUTPUT_DIR = resolve(artifactDirectory, `playwright-run-${runNumber}`)
      const child = spawnProcess(process.execPath, [playwrightCli, 'test', ...args], {
        cwd: root,
        env: childEnvironment,
        stdio: 'inherit',
        detached: platform !== 'win32',
        windowsHide: true,
      })
      testProcess = child
      const testExit = waitForChildClose(child)
      const outcome = await Promise.race([
        testExit.then(result => ({ kind: 'test', result })),
        serverExit.then(detail => ({ kind: 'server', detail })),
      ])
      if (outcome.kind === 'server') {
        if (!hasExited(child)) await stopProcessTree(child, { platform, spawnProcess })
        testProcess = undefined
        throw serverExitError(outcome.detail, logRelativePath)
      }
      testProcess = undefined
      if (outcome.result.error) {
        writeStderr(`Could not launch Playwright: ${outcome.result.error.message}\n`)
        return 1
      }
      return outcome.result.code ?? (outcome.result.signal ? 1 : 0)
    },

    async close() {
      if (closed) return
      closed = true
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
      if (logWriter) await logWriter.close()
      if (cleanupErrors.length) throw new AggregateError(cleanupErrors, 'Could not clean up all local test processes.')
    },
  }
}

/** @param {{ runTest: (args: string[]) => Promise<number>, serverExit: Promise<ServerExit>, logRelativePath: string }} session @param {string[]} args @param {InteractiveSessionOptions} [options] */
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
    try {
      outcome = await Promise.race([
        readline.question('\nPress Enter to rerun the same Playwright command, or q then Enter to quit: ')
          .then(answer => ({ kind: 'input', answer })),
        session.serverExit.then(detail => ({ kind: 'server', detail })),
        promptInterrupted,
        ...(signalInterruption ? [signalInterruption] : []),
      ])
    } finally {
      readline.close()
      onInterface(undefined)
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
    await session.start()
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
Each run has its own Playwright output directory; Nuxt output is saved under
test-results/local-test-<timestamp>-<pid>/server.log.

Examples:
  npm run test:local -- --project=browser tests/workspace-ui-smoke.spec.ts
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
