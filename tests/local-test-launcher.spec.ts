import { EventEmitter } from 'node:events'
import { createServer } from 'node:net'
import { readFileSync, statSync, unlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { PassThrough } from 'node:stream'
import { Writable } from 'node:stream'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { expect, test } from '@playwright/test'
import { createInvalidationLatch, openBrowserReadiness, viteHmrInvalidationReason } from '../scripts/local-browser-readiness.mjs'
import { createLocalSourceMonitor } from '../scripts/local-source-monitor.mjs'
import { isPureOnlySelection } from '../scripts/playwright-selection.mjs'
import {
  assertPortAvailable,
  createSignalController,
  createLocalTestSession,
  isCompatibleIdleInput,
  runInteractiveSession,
  stopOwnedProcessTree,
  waitForHttpReady,
} from '../scripts/local-test.mjs'

class FakeChild extends EventEmitter {
  pid: number
  exitCode: number | null = null
  signalCode: NodeJS.Signals | null = null
  stdout = new PassThrough()
  stderr = new PassThrough()

  constructor(pid: number) {
    super()
    this.pid = pid
  }

  finish(code: number | null, signal: NodeJS.Signals | null = null) {
    this.exitCode = code
    this.signalCode = signal
    this.emit('exit', code, signal)
    this.stdout.end()
    this.stderr.end()
    this.emit('close', code, signal)
  }
}

type FakeSpawnOptions = import('node:child_process').SpawnOptions

function createFakeSourceMonitor() {
  let reason: string | undefined
  let resolveInvalidated: (value: string) => void = () => {}
  const invalidated = new Promise<string>(resolve => { resolveInvalidated = resolve })
  return {
    invalidated,
    check: async () => reason,
    invalidate(value: string) {
      reason = value
      resolveInvalidated(value)
    },
    close: async () => {},
  }
}

function createFakeBrowserReadiness(onClose: () => void = () => {}) {
  let resolveInvalidated: (value: string) => void = () => {}
  const invalidated = new Promise<string>(resolve => { resolveInvalidated = resolve })
  return {
    invalidated,
    invalidate: resolveInvalidated,
    close: async () => { onClose() },
  }
}

function createLauncherSession(
  root: string,
  overrides: NonNullable<Parameters<typeof createLocalTestSession>[0]> = {},
) {
  let nextPid = 800
  return createLocalTestSession({
    rootDirectory: root,
    env: {},
    port: 3100,
    spawnProcess: (_executable, args) => {
      const child = new FakeChild(++nextPid)
      if (args[0]?.endsWith('nuxt.mjs')) {
        child.stdout.write('Local: http://127.0.0.1:3100/\n')
      } else {
        queueMicrotask(() => child.finish(0))
      }
      return child
    },
    checkPortAvailable: async () => {},
    fetchImpl: async () => new Response('ready', { status: 200 }),
    createLogWriter: async () => ({ write: () => {}, close: async () => {} }),
    stopProcessTree: async child => {
      if (!(child instanceof FakeChild)) throw new Error('Expected the fake child process.')
      child.finish(null, 'SIGTERM')
    },
    openBrowserReadiness: async () => createFakeBrowserReadiness(),
    createSourceMonitor: async () => createFakeSourceMonitor(),
    readinessTimeoutMs: 1_000,
    readinessIntervalMs: 1,
    writeStdout: () => {},
    writeStderr: () => {},
    platform: 'linux',
    ...overrides,
  })
}

test('local launcher rejects caller-owned Playwright output and config paths before starting the server @pure', { tag: '@pure' }, async () => {
  const overrides = [
    ['--output', 'retained-evidence'],
    ['--output=retained-evidence'],
    ['--config', 'other.config.ts'],
    ['--config=other.config.ts'],
    ['-c', 'other.config.ts'],
    ['-c=other.config.ts'],
    ['-xcother.config.ts'],
    ['-xc', 'other.config.ts'],
    ['--last-failed-file', 'retained-last-run.json'],
    ['--last-failed-file=retained-last-run.json'],
    ['--', '--output=retained-after-separator'],
    ['--grep-invert', '--', '--last-failed-file=retained-after-filter'],
  ]

  for (const override of overrides) {
    const root = await mkdtemp(join(tmpdir(), 'local-test-output-override-'))
    let spawnCount = 0
    const session = createLauncherSession(root, {
      createSourceMonitor: async () => createFakeSourceMonitor(),
      createLogWriter: async () => ({ write: () => {}, close: async () => {} }),
      spawnProcess: (_executable, args) => {
        spawnCount += 1
        const child = new FakeChild(799)
        if (args[0]?.endsWith('nuxt.mjs')) child.stdout.write('Local: http://127.0.0.1:3100/\n')
        return child
      },
      writeStdout: () => {},
      writeStderr: () => {},
    })

    try {
      await expect(session.start(['--project=browser', ...override]))
        .rejects.toThrow('test:local owns Playwright output paths')
      expect(spawnCount).toBe(0)
    } finally {
      await session.close()
      await rm(root, { recursive: true, force: true })
    }
  }
})

test('local test launcher refuses a port owned by another process @pure', { tag: '@pure' }, async () => {
  const server = createServer()
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Expected a TCP port.')
  try {
    await expect(assertPortAvailable(address.port)).rejects.toThrow('will not reuse it')
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()))
  }
})

test('local test readiness aborts an HTTP request that never responds @pure', { tag: '@pure' }, async () => {
  const startedAt = Date.now()
  await expect(waitForHttpReady({
    url: 'http://127.0.0.1:45678',
    timeoutMs: 30,
    fetchImpl: async (_url, init: RequestInit = {}) => new Promise((_resolve, reject) => {
      const signal = init.signal
      signal?.addEventListener('abort', () => reject(signal.reason), { once: true })
    }),
  })).rejects.toThrow('Timed out after 30 ms')
  expect(Date.now() - startedAt).toBeLessThan(1_000)
})

test('local test readiness retries stalled HTTP attempts within its overall deadline @pure', { tag: '@pure' }, async () => {
  const attempts: AbortSignal[] = []
  const response = await waitForHttpReady({
    url: 'http://127.0.0.1:45678',
    timeoutMs: 1_000,
    requestTimeoutMs: 20,
    intervalMs: 1,
    fetchImpl: async (_url, init: RequestInit = {}) => {
      if (!init.signal) throw new Error('Expected an owned request signal.')
      attempts.push(init.signal)
      if (attempts.length === 2) return new Response('ready')
      return new Promise((_resolve, reject) => {
        init.signal!.addEventListener('abort', () => reject(init.signal!.reason), { once: true })
      })
    },
  })
  expect(response.ok).toBe(true)
  expect(attempts).toHaveLength(2)
  expect(attempts[0]?.aborted).toBe(true)
})

test('local test readiness reports the latest stalled attempt and preserves owner cancellation @pure', { tag: '@pure' }, async () => {
  let attempts = 0
  const startedAt = Date.now()
  const result = waitForHttpReady({
    url: 'http://127.0.0.1:45678',
    timeoutMs: 100,
    requestTimeoutMs: 15,
    intervalMs: 1,
    fetchImpl: async (_url, init: RequestInit = {}) => {
      attempts += 1
      if (attempts === 1) return new Response(null, { status: 503 })
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
      })
    },
  })
  await expect(result).rejects.toThrow('HTTP request timed out')
  await expect(result).rejects.not.toThrow('503')
  expect(attempts).toBeGreaterThan(2)
  expect(Date.now() - startedAt).toBeLessThan(1_000)

  const controller = new AbortController()
  const reason = new Error('Owner stopped readiness.')
  let cancelledAttempts = 0
  const cancelled = waitForHttpReady({
    url: 'http://127.0.0.1:45678',
    timeoutMs: 1_000,
    requestTimeoutMs: 100,
    signal: controller.signal,
    fetchImpl: async (_url, init: RequestInit = {}) => new Promise((_resolve, reject) => {
      cancelledAttempts += 1
      init.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
      queueMicrotask(() => controller.abort(reason))
    }),
  })
  await expect(cancelled).rejects.toBe(reason)
  expect(cancelledAttempts).toBe(1)
})

test('interactive local runs repeat the same Playwright command on Enter and keep the latest status on q @pure', { tag: '@pure' }, async () => {
  const input = new PassThrough()
  let outputText = ''
  const output = new Writable({
    write(chunk, _encoding, callback) {
      outputText += chunk.toString()
      callback()
    },
  })
  const calls: string[][] = []
  const session = {
    serverExit: new Promise<never>(() => {}),
    logRelativePath: 'test-results/local-test/server.log',
    runTest: async (args: string[]) => {
      calls.push([...args])
      return calls.length === 1 ? 1 : 0
    },
  }
  const args = ['--project=browser', '--grep', 'workspace smoke']
  const running = runInteractiveSession(session, args, { input, output })

  await new Promise<void>(resolve => setImmediate(resolve))
  input.write('\n')
  await new Promise<void>(resolve => setImmediate(resolve))
  input.write('q\n')

  expect(await running).toBe(0)
  expect(calls).toEqual([args, args])
  expect(outputText).toContain('Press Enter to rerun')
})

test('Ctrl+C while a test is running reaches the launcher without readline taking over the TTY @pure', { tag: '@pure' }, async () => {
  const input = new PassThrough()
  let rawModeChanges = 0
  Object.assign(input, { isTTY: true, setRawMode: () => { rawModeChanges += 1 } })
  const output = new Writable({ write: (_chunk, _encoding, callback) => callback() })
  const signalSource = new EventEmitter()
  let finishTest: ((exitCode: number) => void) | undefined
  let activeReadline: import('node:readline/promises').Interface | undefined
  let interruptCode: number | undefined
  let cleanupCount = 0
  const session = {
    serverExit: new Promise<never>(() => {}),
    logRelativePath: 'test-results/local-test/server.log',
    runTest: async () => new Promise<number>(resolve => { finishTest = resolve }),
  }
  const signals = createSignalController(signalSource, signal => {
    interruptCode = signal === 'SIGINT' ? 130 : 143
    cleanupCount += 1
    finishTest?.(0)
  })
  const execution = runInteractiveSession(session, [], {
    input,
    output,
    onInterface: active => { activeReadline = active },
    onInterrupt: () => signals.interrupt('SIGINT'),
    shouldStop: () => interruptCode,
  })

  await new Promise<void>(resolve => setImmediate(resolve))
  expect(activeReadline).toBeUndefined()
  expect(rawModeChanges).toBe(0)
  const interrupted = Promise.race([execution, signals.interrupted])
  input.write('\x03')
  signalSource.emit('SIGINT')

  expect(await interrupted).toBe(130)
  expect(await execution).toBe(130)
  expect(cleanupCount).toBe(1)
  expect(activeReadline).toBeUndefined()
  expect(rawModeChanges).toBe(0)
  signals.dispose()
})

test('Windows cleanup targets the owned process and its descendants @pure', { tag: '@pure' }, async () => {
  const owned = new FakeChild(555)
  const killer = new FakeChild(556)
  let killCommand: { executable: string, args: string[], options: FakeSpawnOptions } | undefined
  await stopOwnedProcessTree(owned, {
    platform: 'win32',
    spawnProcess: (executable, args, options) => {
      killCommand = { executable, args: [...args], options }
      return killer
    },
    waitForClose: async child => {
      if (!(child instanceof FakeChild)) throw new Error('Expected the fake child process.')
      child.finish(0)
      return { code: 0 }
    },
  })
  expect(killCommand?.executable).toBe('taskkill.exe')
  expect(killCommand?.args).toEqual(['/PID', '555', '/T', '/F'])
  expect(killCommand?.options.windowsHide).toBe(true)
  expect(owned.exitCode).toBe(0)
})

test('local launcher reuses its server, isolates Playwright output, redacts logs, and cleans owned processes @pure', { tag: '@pure' }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'local-test-launcher-'))
  const spawned: Array<{ executable: string, args: readonly string[], options: FakeSpawnOptions, child: FakeChild }> = []
  const killed: number[] = []
  const log: string[] = []
  const terminal: string[] = []
  const testCodes = [1, 0]
  const order: string[] = []
  const sourceMonitors = [] as ReturnType<typeof createFakeSourceMonitor>[]
  const browserReadinesses = [] as ReturnType<typeof createFakeBrowserReadiness>[]
  let browserCloseCount = 0
  let nextPid = 100
  const spawnProcess = (executable: string, args: readonly string[], options: FakeSpawnOptions) => {
    const child = new FakeChild(++nextPid)
    spawned.push({ executable, args, options, child })
    if (args[0]?.endsWith('nuxt.mjs')) {
      order.push('server')
      child.stdout.write('token=super-')
      child.stdout.write('secret-value\n')
      child.stdout.write('\u001B[32m➜\u001B[0m Local:    http://127.0.0.1:3100/\n')
    } else {
      order.push('test')
      queueMicrotask(() => child.finish(testCodes.shift() ?? 0))
    }
    return child
  }

  const session = createLocalTestSession({
    rootDirectory: root,
    env: {
      TOKEN_SECRET: 'super-secret-value',
      COPILOT_ENTRA_DISABLE_ONEAUTH: '1',
      PLAYWRIGHT_PRODUCTION_URL: 'https://preview.example.invalid',
      PLAYWRIGHT_LAST_RUN_OUTPUT_FILE: 'caller-shared-last-run.json',
      PLAYWRIGHT_JSON_OUTPUT_FILE: 'caller-shared-report.json',
      PLAYWRIGHT_JSON_OUTPUT_DIR: 'caller-shared-json',
      PLAYWRIGHT_JSON_OUTPUT_NAME: 'caller-shared-report.json',
      PLAYWRIGHT_HTML_OUTPUT_DIR: 'caller-shared-html',
      PLAYWRIGHT_HTML_REPORT: 'caller-shared-html-report',
      PLAYWRIGHT_OUTPUT_RUN_ROOT: 'caller-shared-run-root',
      TTRPG_PLAYWRIGHT_OUTPUT_OWNERSHIP: '{"stale":true}',
      PLAYWRIGHT_CHANNEL: 'chrome',
    },
    port: 3100,
    spawnProcess,
    createSourceMonitor: async ({ ignoreFile }) => {
      order.push(ignoreFile ? 'fence' : 'monitor')
      const monitor = createFakeSourceMonitor()
      sourceMonitors.push(monitor)
      return monitor
    },
    openBrowserReadiness: async ({ url, timeoutMs, signal, channel }) => {
      order.push('browser')
      expect(url).toBe('http://127.0.0.1:3100')
      expect(timeoutMs).toBe(1_000)
      expect(channel).toBe('chrome')
      expect(signal.aborted).toBe(false)
      const readiness = createFakeBrowserReadiness(() => { browserCloseCount += 1 })
      browserReadinesses.push(readiness)
      return readiness
    },
    checkPortAvailable: async () => {},
    fetchImpl: async () => new Response('ready', { status: 200 }),
    createLogWriter: async path => {
      expect(path).toContain('server.log')
      return { write: (value: string) => log.push(value), close: async () => {} }
    },
    stopProcessTree: async child => {
      if (!(child instanceof FakeChild)) throw new Error('Expected the fake child process.')
      killed.push(child.pid)
      child.finish(null, 'SIGTERM')
    },
    readinessTimeoutMs: 1_000,
    readinessIntervalMs: 1,
    writeStdout: value => terminal.push(value),
    writeStderr: value => terminal.push(value),
    now: () => Date.parse('2026-10-29T12:00:00Z'),
    pid: 77,
    platform: 'linux',
  })

  try {
    await session.start()
    expect(spawned).toHaveLength(1)
    expect(spawned[0]?.args).toContain('--strictPort')
    expect(spawned[0]?.args).toContain('--no-takeover')
    expect(spawned[0]?.options.detached).toBe(true)

    expect(await session.runTest(['--project=browser'])).toBe(1)
    expect(await session.runTest(['--project=browser'])).toBe(0)
    expect(spawned).toHaveLength(3)
    const testRuns = spawned.slice(1)
    expect(testRuns.every(run => run.args.includes('--project=browser'))).toBe(true)
    expect(testRuns.every(run => run.options.env?.PLAYWRIGHT_BASE_URL === 'http://127.0.0.1:3100')).toBe(true)
    expect(testRuns.every(run => run.options.env?.PLAYWRIGHT_PRODUCTION_URL === undefined)).toBe(true)
    expect(testRuns.every(run => run.options.env?.PLAYWRIGHT_CHANNEL === 'chrome')).toBe(true)
    expect(testRuns.every(run => run.options.env?.PLAYWRIGHT_LAST_RUN_OUTPUT_FILE === undefined)).toBe(true)
    expect(testRuns.every(run => run.options.env?.TTRPG_PLAYWRIGHT_OUTPUT_OWNERSHIP === undefined)).toBe(true)
    expect(new Set(testRuns.map(run => run.options.env?.PLAYWRIGHT_OUTPUT_DIR)).size).toBe(2)
    expect(new Set(testRuns.map(run => run.options.env?.PLAYWRIGHT_JSON_OUTPUT_FILE)).size).toBe(2)
    expect(new Set(testRuns.map(run => run.options.env?.PLAYWRIGHT_JSON_OUTPUT_DIR)).size).toBe(2)
    expect(testRuns.every(run => run.options.env?.PLAYWRIGHT_JSON_OUTPUT_NAME === 'results.json')).toBe(true)
    expect(testRuns.every(run => run.options.env?.PLAYWRIGHT_JSON_OUTPUT_FILE?.endsWith('results.json'))).toBe(true)
    expect(testRuns.every(run => run.options.env?.PLAYWRIGHT_OUTPUT_RUN_ROOT === run.options.env?.PLAYWRIGHT_JSON_OUTPUT_DIR)).toBe(true)
    expect(testRuns.every(run => join(
      run.options.env?.PLAYWRIGHT_JSON_OUTPUT_DIR ?? '',
      run.options.env?.PLAYWRIGHT_JSON_OUTPUT_NAME ?? '',
    ) === run.options.env?.PLAYWRIGHT_JSON_OUTPUT_FILE)).toBe(true)
    expect(testRuns.every(run => run.options.env?.PLAYWRIGHT_HTML_OUTPUT_DIR === run.options.env?.PLAYWRIGHT_HTML_REPORT)).toBe(true)
    expect(new Set(testRuns.map(run => run.options.env?.PLAYWRIGHT_HTML_OUTPUT_DIR)).size).toBe(2)
    expect(testRuns[0]?.options.env?.PLAYWRIGHT_OUTPUT_DIR).toContain('playwright-run-1')
    expect(testRuns[1]?.options.env?.PLAYWRIGHT_OUTPUT_DIR).toContain('playwright-run-2')
    expect(log.join('')).not.toContain('super-secret-value')
    expect(terminal.join('')).not.toContain('super-secret-value')
    expect(log.join('')).toContain('[REDACTED]')
    expect(log.join('')).toContain('http://127.0.0.1:3100/')
    expect(session.logRelativePath).toContain('test-results')
    expect(order).toEqual(['fence', 'monitor', 'server', 'browser', 'test', 'monitor', 'browser', 'test'])
    expect(sourceMonitors).toHaveLength(3)
    expect(browserReadinesses).toHaveLength(2)

    await session.close()
    expect(killed).toEqual([spawned[0]!.child.pid])
    expect(browserCloseCount).toBe(2)
  } finally {
    await session.close()
    await rm(root, { recursive: true, force: true })
  }
})

test('pure-only project selection is exact and skips the server and browser probe @pure', { tag: '@pure' }, async () => {
  expect(isPureOnlySelection(['tests/local-test-launcher.spec.ts', '--project=pure'])).toBe(true)
  expect(isPureOnlySelection(['--project', 'pure', '--project=pure'])).toBe(true)
  expect(isPureOnlySelection(['--project', 'pure', 'browser'])).toBe(false)
  expect(isPureOnlySelection(['--project=pure', 'browser'])).toBe(false)
  expect(isPureOnlySelection(['tests/local-test-launcher.spec.ts', '--project', 'pure', 'browser'])).toBe(false)
  expect(isPureOnlySelection(['--project=pure,browser'])).toBe(false)
  expect(isPureOnlySelection(['--project=pure', '--project=browser'])).toBe(false)
  expect(isPureOnlySelection(['--project=*'])).toBe(false)
  expect(isPureOnlySelection(['--grep', '@pure'])).toBe(false)
  expect(isPureOnlySelection(['--project'])).toBe(false)

  const root = await mkdtemp(join(tmpdir(), 'local-test-pure-'))
  const sourceMonitor = createFakeSourceMonitor()
  let readinessCalls = 0
  const spawned: Array<{ args: readonly string[], options: FakeSpawnOptions }> = []
  let nextPid = 850
  const session = createLauncherSession(root, {
    env: { PLAYWRIGHT_JSON_OUTPUT_NAME: 'shared-report.json' },
    createSourceMonitor: async () => sourceMonitor,
    openBrowserReadiness: async () => {
      readinessCalls += 1
      throw new Error('Pure checks must not open a browser.')
    },
    spawnProcess: (_executable, args, options) => {
      spawned.push({ args, options })
      const child = new FakeChild(++nextPid)
      queueMicrotask(() => child.finish(0))
      return child
    },
  })

  try {
    const args = ['tests/local-test-launcher.spec.ts', '--project=pure']
    await session.start(args)
    expect(await session.runTest(args)).toBe(0)
    expect(readinessCalls).toBe(0)
    expect(spawned).toHaveLength(1)
    expect(spawned[0]?.args).toContain('--project=pure')
    expect(spawned[0]?.options.env?.PLAYWRIGHT_BASE_URL).toBeUndefined()
    expect(spawned[0]?.options.env?.PLAYWRIGHT_JSON_OUTPUT_NAME).not.toBe('shared-report.json')
  } finally {
    await session.close()
    await rm(root, { recursive: true, force: true })
  }
})

test('browser readiness timeout is reported before the Playwright child starts @pure', { tag: '@pure' }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'local-test-readiness-timeout-'))
  const sourceMonitor = createFakeSourceMonitor()
  let testChildren = 0
  const session = createLauncherSession(root, {
    createSourceMonitor: async () => sourceMonitor,
    openBrowserReadiness: async ({ timeoutMs }) => {
      throw new Error(`Timed out after ${timeoutMs} ms waiting for the hydrated welcome form.`)
    },
    spawnProcess: (_executable, args) => {
      const child = new FakeChild(860)
      if (args[0]?.endsWith('nuxt.mjs')) child.stdout.write('Local: http://127.0.0.1:3100/\n')
      else testChildren += 1
      return child
    },
  })

  try {
    await expect(session.start(['--project=browser'])).rejects.toThrow('Timed out after 1000 ms')
    expect(testChildren).toBe(0)
  } finally {
    await session.close()
    await rm(root, { recursive: true, force: true })
  }
})

test('readiness owns a pending Chromium launch and forwards the configured channel @pure', { tag: '@pure' }, async () => {
  const controller = new AbortController()
  let launchOptions: { timeout: number, channel?: string } | undefined
  let finishLaunch: (() => void) | undefined
  let resolveLaunchStarted: () => void = () => {}
  let resolveBrowserClosed: () => void = () => {}
  const launchStarted = new Promise<void>(resolve => { resolveLaunchStarted = resolve })
  const browserClosed = new Promise<void>(resolve => { resolveBrowserClosed = resolve })
  let closeCount = 0
  let openingSettled = false
  const browser = {
    close: async () => {
      closeCount += 1
      resolveBrowserClosed()
    },
    newContext: async () => { throw new Error('Cancelled launch must not create a context.') },
  }
  const opening = openBrowserReadiness({
    url: 'http://127.0.0.1:3100',
    timeoutMs: 5_000,
    signal: controller.signal,
    channel: 'chrome',
    launchBrowser: async options => {
      launchOptions = options
      resolveLaunchStarted()
      return new Promise(resolve => { finishLaunch = () => resolve(browser) })
    },
  })
  void opening.then(() => { openingSettled = true }, () => { openingSettled = true })

  await launchStarted
  expect(launchOptions?.channel).toBe('chrome')
  expect(launchOptions?.timeout).toBeGreaterThan(0)
  expect(launchOptions?.timeout).toBeLessThanOrEqual(5_000)
  controller.abort(new Error('Readiness cancelled by test.'))
  await Promise.resolve()
  expect(openingSettled).toBe(false)
  finishLaunch?.()
  await expect(opening).rejects.toThrow('Readiness cancelled by test')
  await browserClosed
  expect(closeCount).toBe(1)
})

test('closing during compatibility fence creation closes a late monitor @pure', { tag: '@pure' }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'local-test-late-fence-'))
  let resolveFence: ((monitor: ReturnType<typeof createFakeSourceMonitor>) => void) | undefined
  let resolveFenceStarted: () => void = () => {}
  const fenceStarted = new Promise<void>(resolve => { resolveFenceStarted = resolve })
  let closeCount = 0
  let spawnCount = 0
  const session = createLauncherSession(root, {
    createSourceMonitor: async () => {
      resolveFenceStarted()
      return new Promise(resolve => { resolveFence = resolve })
    },
    spawnProcess: () => {
      spawnCount += 1
      return new FakeChild(845)
    },
  })

  try {
    const starting = session.start(['--project=browser'])
    await fenceStarted
    const closing = session.close()
    await expect(starting).rejects.toThrow('Local test session was closed before verification could start')
    resolveFence?.({
      ...createFakeSourceMonitor(),
      close: async () => { closeCount += 1 },
    })
    await closing
    expect(closeCount).toBe(1)
    expect(spawnCount).toBe(0)
  } finally {
    await session.close()
    await rm(root, { recursive: true, force: true })
  }
})

test('closing during browser readiness aborts the pending probe and owns no test child @pure', { tag: '@pure' }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'local-test-readiness-cancel-'))
  const sourceMonitor = createFakeSourceMonitor()
  let signal: AbortSignal | undefined
  let resolveProbeStarted: () => void = () => {}
  const probeStarted = new Promise<void>(resolve => { resolveProbeStarted = resolve })
  let testChildren = 0
  const session = createLauncherSession(root, {
    createSourceMonitor: async () => sourceMonitor,
    openBrowserReadiness: async options => {
      signal = options.signal
      resolveProbeStarted()
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })
      })
    },
    spawnProcess: (_executable, args) => {
      const child = new FakeChild(870)
      if (args[0]?.endsWith('nuxt.mjs')) child.stdout.write('Local: http://127.0.0.1:3100/\n')
      else testChildren += 1
      return child
    },
  })
  const starting = session.start(['--project=browser'])

  try {
    await probeStarted
    await session.close()
    await expect(starting).rejects.toThrow('closed')
    expect(signal?.aborted).toBe(true)
    expect(testChildren).toBe(0)
  } finally {
    await session.close()
    await rm(root, { recursive: true, force: true })
  }
})

test('server exit during browser readiness aborts the probe before the test child starts @pure', { tag: '@pure' }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'local-test-readiness-server-exit-'))
  const sourceMonitor = createFakeSourceMonitor()
  let server: FakeChild | undefined
  let signal: AbortSignal | undefined
  let resolveProbeStarted: () => void = () => {}
  const probeStarted = new Promise<void>(resolve => { resolveProbeStarted = resolve })
  let testChildren = 0
  const session = createLauncherSession(root, {
    createSourceMonitor: async () => sourceMonitor,
    openBrowserReadiness: async options => {
      signal = options.signal
      resolveProbeStarted()
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })
      })
    },
    spawnProcess: (_executable, args) => {
      const child = new FakeChild(875)
      if (args[0]?.endsWith('nuxt.mjs')) {
        server = child
        child.stdout.write('Local: http://127.0.0.1:3100/\n')
      } else {
        testChildren += 1
      }
      return child
    },
  })
  const starting = session.start(['--project=browser'])

  try {
    await probeStarted
    server?.finish(2)
    await expect(starting).rejects.toThrow('development server exited (code 2)')
    expect(signal?.aborted).toBe(true)
    expect(testChildren).toBe(0)
  } finally {
    await session.close()
    await rm(root, { recursive: true, force: true })
  }
})

test('source changes during browser warmup abort readiness before Playwright starts @pure', { tag: '@pure' }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'local-test-warmup-change-'))
  const sourceMonitor = createFakeSourceMonitor()
  let signal: AbortSignal | undefined
  let resolveProbeStarted: () => void = () => {}
  const probeStarted = new Promise<void>(resolve => { resolveProbeStarted = resolve })
  let testChildren = 0
  const session = createLauncherSession(root, {
    createSourceMonitor: async () => sourceMonitor,
    openBrowserReadiness: async options => {
      signal = options.signal
      resolveProbeStarted()
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })
      })
    },
    spawnProcess: (_executable, args) => {
      const child = new FakeChild(880)
      if (args[0]?.endsWith('nuxt.mjs')) child.stdout.write('Local: http://127.0.0.1:3100/\n')
      else testChildren += 1
      return child
    },
  })
  const starting = session.start(['--project=browser'])

  try {
    await probeStarted
    sourceMonitor.invalidate('app.vue changed during warmup.')
    await expect(starting).rejects.toThrow('app.vue changed during warmup')
    expect(signal?.aborted).toBe(true)
    expect(testChildren).toBe(0)
  } finally {
    await session.close()
    await rm(root, { recursive: true, force: true })
  }
})

test('HMR during a Playwright run stops the child and retains its isolated report path @pure', { tag: '@pure' }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'local-test-hmr-change-'))
  const sourceMonitor = createFakeSourceMonitor()
  let browserClosed = false
  const browserReadiness = createFakeBrowserReadiness(() => { browserClosed = true })
  let testChild: FakeChild | undefined
  let resolveTestStarted: () => void = () => {}
  const testStarted = new Promise<void>(resolve => { resolveTestStarted = resolve })
  const errors: string[] = []
  let nextPid = 890
  const session = createLauncherSession(root, {
    env: { PLAYWRIGHT_JSON_OUTPUT_NAME: 'caller-shared-report.json' },
    createSourceMonitor: async () => sourceMonitor,
    openBrowserReadiness: async () => browserReadiness,
    spawnProcess: (_executable, args) => {
      const child = new FakeChild(++nextPid)
      if (args[0]?.endsWith('nuxt.mjs')) child.stdout.write('Local: http://127.0.0.1:3100/\n')
      else {
        testChild = child
        resolveTestStarted()
      }
      return child
    },
    stopProcessTree: async child => {
      if (!(child instanceof FakeChild)) throw new Error('Expected the fake child process.')
      child.finish(null, 'SIGTERM')
    },
    writeStderr: value => errors.push(value),
  })

  try {
    await session.start(['--project=browser'])
    const running = session.runTest(['--project=browser'])
    await testStarted
    browserReadiness.invalidate('Vite reported update while local verification was running.')
    expect(await running).toBe(1)
    expect(testChild?.signalCode).toBe('SIGTERM')
    expect(errors.join('')).toContain('local verification was running')
    expect(errors.join('')).toContain('results.json')
    expect(errors.join('')).toContain('local-result-invalidated.json')
    await session.close()
    expect(browserClosed).toBe(true)
  } finally {
    await session.close()
    await rm(root, { recursive: true, force: true })
  }
})

test('a child that resists invalidation remains owned and blocks another epoch until close succeeds @pure', { tag: '@pure' }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'local-test-child-stop-failure-'))
  const monitors: ReturnType<typeof createFakeSourceMonitor>[] = []
  let testChild: FakeChild | undefined
  let resolveTestStarted: () => void = () => {}
  const testStarted = new Promise<void>(resolve => { resolveTestStarted = resolve })
  let stopAttempts = 0
  let nextPid = 892
  let testChildren = 0
  const session = createLauncherSession(root, {
    createSourceMonitor: async () => {
      const monitor = createFakeSourceMonitor()
      monitors.push(monitor)
      return monitor
    },
    spawnProcess: (_executable, args) => {
      const child = new FakeChild(++nextPid)
      if (args[0]?.endsWith('nuxt.mjs')) child.stdout.write('Local: http://127.0.0.1:3100/\n')
      else {
        testChild = child
        testChildren += 1
        resolveTestStarted()
      }
      return child
    },
    stopProcessTree: async child => {
      if (!(child instanceof FakeChild)) throw new Error('Expected the fake child process.')
      if (child === testChild && stopAttempts++ === 0) throw new Error('Synthetic stop failure.')
      child.finish(null, 'SIGTERM')
    },
  })

  try {
    await session.start(['--project=browser'])
    const running = session.runTest(['--project=browser'])
    await testStarted
    monitors[1]?.invalidate('app.vue changed during active verification.')
    expect(await running).toBe(1)
    expect(testChild?.signalCode).toBeNull()
    await expect(session.runTest(['--project=browser'])).rejects.toThrow('prior Playwright child is still owned')
    expect(testChildren).toBe(1)

    await session.close()
    expect(testChild?.signalCode).toBe('SIGTERM')
  } finally {
    await session.close()
    await rm(root, { recursive: true, force: true })
  }
})

test('a failed idle preparation needs another explicit Enter and stale readiness cannot invalidate its successor @pure', { tag: '@pure' }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'local-test-preparation-epochs-'))
  const monitors: ReturnType<typeof createFakeSourceMonitor>[] = []
  const readinessResources: ReturnType<typeof createFakeBrowserReadiness>[] = []
  let readinessCalls = 0
  let testChildren = 0
  let nextPid = 895
  const session = createLauncherSession(root, {
    createSourceMonitor: async () => {
      const monitor = createFakeSourceMonitor()
      monitors.push(monitor)
      return monitor
    },
    openBrowserReadiness: async ({ signal }) => {
      readinessCalls += 1
      if (readinessCalls === 2) {
        const strictMonitor = monitors.at(-1)
        queueMicrotask(() => strictMonitor?.invalidate('app.vue changed during idle qualification.'))
        return new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason), { once: true })
        })
      }
      const resource = createFakeBrowserReadiness()
      readinessResources.push(resource)
      return resource
    },
    spawnProcess: (_executable, args) => {
      const child = new FakeChild(++nextPid)
      if (args[0]?.endsWith('nuxt.mjs')) child.stdout.write('Local: http://127.0.0.1:3100/\n')
      else {
        testChildren += 1
        queueMicrotask(() => child.finish(0))
      }
      return child
    },
  })

  try {
    await session.start(['--project=browser'])
    expect(await session.runTest(['--project=browser'])).toBe(0)
    readinessResources[0]?.invalidate('late HMR callback from a closed epoch')

    expect(await session.runTest(['--project=browser'])).toBe(1)
    expect(testChildren).toBe(1)
    expect(await session.runTest(['--project=browser'])).toBe(0)
    expect(testChildren).toBe(2)
    expect(readinessCalls).toBe(3)
    expect(monitors).toHaveLength(4)
  } finally {
    await session.close()
    await rm(root, { recursive: true, force: true })
  }
})

test('the continuous fence rejects a compatible edit made while the new strict monitor is being created @pure', { tag: '@pure' }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'local-test-fence-handoff-'))
  const pages = join(root, 'pages')
  await mkdir(pages)
  await writeFile(join(root, 'app.vue'), '<template>before</template>')
  const page = join(pages, 'index.vue')
  await writeFile(page, '<template>before</template>')
  let monitorCreationGate: (() => void) | undefined
  let resolveStrictMonitorStarted: () => void = () => {}
  let resolveCompatibleChange: () => void = () => {}
  let strictMonitorStarted: Promise<void>
  let compatibleChange: Promise<void>
  let holdNextStrictMonitor = false
  let testChildren = 0
  let nextPid = 1_300
  const session = createLauncherSession(root, {
    createSourceMonitor: async options => {
      if (options.ignoreFile) {
        const onChange = options.onIgnoredFileChange
        return createLocalSourceMonitor({
          intervalMs: 10_000,
          ...options,
          onIgnoredFileChange: relativePath => {
            onChange?.(relativePath)
            resolveCompatibleChange()
          },
        })
      }
      if (holdNextStrictMonitor) {
        holdNextStrictMonitor = false
        resolveStrictMonitorStarted()
        await new Promise<void>(resolve => { monitorCreationGate = resolve })
      }
      return createLocalSourceMonitor({ intervalMs: 10_000, ...options })
    },
    openBrowserReadiness: async () => createFakeBrowserReadiness(),
    spawnProcess: (_executable, args) => {
      const child = new FakeChild(++nextPid)
      if (args[0]?.endsWith('nuxt.mjs')) child.stdout.write('Local: http://127.0.0.1:3100/\n')
      else {
        testChildren += 1
        queueMicrotask(() => child.finish(0))
      }
      return child
    },
  })

  try {
    await session.start(['--project=browser'])
    expect(await session.runTest(['--project=browser'])).toBe(0)
    holdNextStrictMonitor = true
    strictMonitorStarted = new Promise<void>(resolve => { resolveStrictMonitorStarted = resolve })
    compatibleChange = new Promise<void>(resolve => { resolveCompatibleChange = resolve })
    const rerun = session.runTest(['--project=browser'])
    await strictMonitorStarted
    await writeFile(page, '<template>edit during handoff</template>')
    await compatibleChange
    monitorCreationGate?.()
    expect(await rerun).toBe(1)
    expect(testChildren).toBe(1)

    expect(await session.runTest(['--project=browser'])).toBe(0)
    expect(testChildren).toBe(2)
  } finally {
    monitorCreationGate?.()
    await session.close()
    await rm(root, { recursive: true, force: true })
  }
})

test('a pending readiness cleanup finishes before another local run can start @pure', { tag: '@pure' }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'local-test-readiness-cleanup-'))
  const monitors: ReturnType<typeof createFakeSourceMonitor>[] = []
  let readinessCalls = 0
  let resolveCleanupStarted: () => void = () => {}
  const cleanupStarted = new Promise<void>(resolve => { resolveCleanupStarted = resolve })
  let finishAbortCleanup: (() => void) | undefined
  let nextPid = 1_400
  let testChildren = 0
  const session = createLauncherSession(root, {
    createSourceMonitor: async () => {
      const monitor = createFakeSourceMonitor()
      monitors.push(monitor)
      return monitor
    },
    openBrowserReadiness: async ({ signal }) => {
      readinessCalls += 1
      if (readinessCalls === 2) {
        return new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            resolveCleanupStarted()
            void new Promise<void>(resolve => { finishAbortCleanup = resolve }).then(() => reject(signal.reason))
          }, { once: true })
        })
      }
      return createFakeBrowserReadiness()
    },
    spawnProcess: (_executable, args) => {
      const child = new FakeChild(++nextPid)
      if (args[0]?.endsWith('nuxt.mjs')) child.stdout.write('Local: http://127.0.0.1:3100/\n')
      else {
        testChildren += 1
        queueMicrotask(() => child.finish(0))
      }
      return child
    },
  })

  try {
    await session.start(['--project=browser'])
    expect(await session.runTest(['--project=browser'])).toBe(0)
    const rerun = session.runTest(['--project=browser'])
    await expect.poll(() => readinessCalls).toBe(2)
    monitors.at(-1)?.invalidate('source changed during pending readiness cleanup')
    await cleanupStarted
    await expect(session.runTest(['--project=browser'])).rejects.toThrow('Playwright run is in progress')
    finishAbortCleanup?.()
    expect(await rerun).toBe(1)
    expect(await session.runTest(['--project=browser'])).toBe(0)
    expect(testChildren).toBe(2)
    expect(readinessCalls).toBe(3)
  } finally {
    finishAbortCleanup?.()
    await session.close()
    await rm(root, { recursive: true, force: true })
  }
})

test('server exit during output preparation prevents a late Playwright child spawn @pure', { tag: '@pure' }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'local-test-server-exit-output-'))
  let server: FakeChild | undefined
  let resolvePreparationStarted: () => void = () => {}
  const preparationStarted = new Promise<void>(resolve => { resolvePreparationStarted = resolve })
  let finishPreparation: (() => void) | undefined
  const preparation = new Promise<void>(resolve => { finishPreparation = resolve })
  let testChildren = 0
  let nextPid = 1_425
  const session = createLauncherSession(root, {
    prepareOutputDirectory: async () => {
      resolvePreparationStarted()
      await preparation
    },
    spawnProcess: (_executable, args) => {
      const child = new FakeChild(++nextPid)
      if (args[0]?.endsWith('nuxt.mjs')) {
        server = child
        child.stdout.write('Local: http://127.0.0.1:3100/\n')
      } else {
        testChildren += 1
        queueMicrotask(() => child.finish(0))
      }
      return child
    },
  })

  try {
    await session.start(['--project=browser'])
    const running = session.runTest(['--project=browser'])
    await preparationStarted
    server?.finish(2)
    finishPreparation?.()
    await expect(running).rejects.toThrow('development server exited (code 2)')
    expect(testChildren).toBe(0)
  } finally {
    finishPreparation?.()
    await session.close()
    await rm(root, { recursive: true, force: true })
  }
})

test('server failure retains an invalidation marker when source change was already observed @pure', { tag: '@pure' }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'local-test-server-exit-invalidated-'))
  let sourceChanged = false
  let server: FakeChild | undefined
  let testChild: FakeChild | undefined
  let resolveTestStarted: () => void = () => {}
  const testStarted = new Promise<void>(resolve => { resolveTestStarted = resolve })
  let nextPid = 1_435
  let reportPath: string | undefined
  const session = createLauncherSession(root, {
    createSourceMonitor: async () => ({
      invalidated: new Promise<string>(() => {}),
      check: async () => sourceChanged ? 'tests/workspace.spec.ts changed before server failure.' : undefined,
      close: async () => {},
    }),
    spawnProcess: (_executable, args, options) => {
      const child = new FakeChild(++nextPid)
      if (args[0]?.endsWith('nuxt.mjs')) {
        server = child
        child.stdout.write('Local: http://127.0.0.1:3100/\n')
      }
      else {
        testChild = child
        reportPath = options.env?.PLAYWRIGHT_JSON_OUTPUT_FILE
        resolveTestStarted()
      }
      return child
    },
    stopProcessTree: async child => {
      if (!(child instanceof FakeChild)) throw new Error('Expected the fake child process.')
      child.finish(null, 'SIGTERM')
    },
  })

  try {
    await session.start(['--project=browser'])
    const running = session.runTest(['--project=browser'])
    await testStarted
    sourceChanged = true
    server?.finish(2)
    await expect(running).rejects.toThrow('development server exited (code 2)')
    expect(testChild?.signalCode).toBe('SIGTERM')
    if (!reportPath) throw new Error('Expected a per-run Playwright report path.')
    const invalidationPath = join(dirname(reportPath), 'local-result-invalidated.json')
    const invalidation = JSON.parse(await readFile(invalidationPath, 'utf8')) as { reason: string, playwrightJsonReport: string }
    expect(invalidation.reason).toContain('tests/workspace.spec.ts')
    expect(invalidation.playwrightJsonReport).toContain('results.json')
  } finally {
    await session.close()
    await rm(root, { recursive: true, force: true })
  }
})

test('readiness cleanup failure is surfaced and requires a fresh local session @pure', { tag: '@pure' }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'local-test-readiness-cleanup-error-'))
  let readinessCalls = 0
  let nextPid = 1_450
  const session = createLauncherSession(root, {
    openBrowserReadiness: async () => {
      readinessCalls += 1
      if (readinessCalls === 2) {
        throw new AggregateError([new Error('hydration failed'), new Error('browser close failed')], 'Synthetic readiness cleanup failure.')
      }
      return createFakeBrowserReadiness()
    },
    spawnProcess: (_executable, args) => {
      const child = new FakeChild(++nextPid)
      if (args[0]?.endsWith('nuxt.mjs')) child.stdout.write('Local: http://127.0.0.1:3100/\n')
      else queueMicrotask(() => child.finish(0))
      return child
    },
  })
  let closeRejected = false

  try {
    await session.start(['--project=browser'])
    expect(await session.runTest(['--project=browser'])).toBe(0)
    await expect(session.runTest(['--project=browser'])).rejects.toThrow('Could not clean up the local verification epoch')
    await expect(session.runTest(['--project=browser'])).rejects.toThrow('Verification resource cleanup failed')
    expect(readinessCalls).toBe(2)
    await expect(session.close()).rejects.toThrow('Could not clean up all local test processes')
    closeRejected = true
  } finally {
    if (!closeRejected) {
      await session.close().catch(() => undefined)
    }
    await rm(root, { recursive: true, force: true })
  }
})

test('source monitor cleanup is bounded and a timed out monitor remains owned until close @pure', { tag: '@pure' }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'local-test-monitor-cleanup-'))
  let resolveMonitorClose: (() => void) | undefined
  let closeStarted: () => void = () => {}
  const monitorCloseStarted = new Promise<void>(resolve => { closeStarted = resolve })
  let monitorCalls = 0
  let monitorCloseCount = 0
  let nextPid = 1_475
  const session = createLauncherSession(root, {
    readinessTimeoutMs: 500,
    createSourceMonitor: async () => {
      monitorCalls += 1
      const monitor = createFakeSourceMonitor()
      return monitorCalls === 2
        ? { ...monitor, close: async () => {
          monitorCloseCount += 1
          closeStarted()
          await new Promise<void>(resolve => { resolveMonitorClose = resolve })
        } }
        : monitor
    },
    spawnProcess: (_executable, args) => {
      const child = new FakeChild(++nextPid)
      if (args[0]?.endsWith('nuxt.mjs')) child.stdout.write('Local: http://127.0.0.1:3100/\n')
      else queueMicrotask(() => child.finish(0))
      return child
    },
  })

  try {
    await session.start(['--project=browser'])
    await expect(session.runTest(['--project=browser'])).rejects.toThrow('Could not clean up the local verification epoch')
    await monitorCloseStarted
    await expect(session.runTest(['--project=browser'])).rejects.toThrow('Verification resource cleanup failed')
    resolveMonitorClose?.()
    await expect(session.close()).rejects.toThrow('Could not clean up all local test processes')
    expect(monitorCloseCount).toBe(1)
  } finally {
    resolveMonitorClose?.()
    await session.close().catch(() => undefined)
    await rm(root, { recursive: true, force: true })
  }
})

test('a source edit at successful child completion invalidates the result @pure', { tag: '@pure' }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'local-test-finish-change-'))
  let changed = false
  const sourceMonitor = {
    ...createFakeSourceMonitor(),
    check: async () => changed ? 'tests/example.spec.ts changed before completion.' : undefined,
  }
  let testChild: FakeChild | undefined
  let resolveTestStarted: () => void = () => {}
  const testStarted = new Promise<void>(resolve => { resolveTestStarted = resolve })
  const errors: string[] = []
  let nextPid = 900
  const session = createLauncherSession(root, {
    createSourceMonitor: async () => sourceMonitor,
    spawnProcess: (_executable, args) => {
      const child = new FakeChild(++nextPid)
      if (args[0]?.endsWith('nuxt.mjs')) child.stdout.write('Local: http://127.0.0.1:3100/\n')
      else {
        testChild = child
        resolveTestStarted()
      }
      return child
    },
    writeStderr: value => errors.push(value),
  })

  try {
    await session.start(['--project=browser'])
    const running = session.runTest(['--project=browser'])
    await testStarted
    changed = true
    testChild?.finish(0)
    expect(await running).toBe(1)
    expect(errors.join('')).toContain('tests/example.spec.ts changed')
    expect(errors.join('')).toContain('results.json')
  } finally {
    await session.close()
    await rm(root, { recursive: true, force: true })
  }
})

test('source monitor ignores shared-policy documents and detects CSS changes @pure', { tag: '@pure' }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'local-source-monitor-'))
  await mkdir(join(root, 'assets'))
  await writeFile(join(root, 'README.md'), 'before')
  await writeFile(join(root, 'assets', 'theme.css'), 'before')
  const monitor = await createLocalSourceMonitor({ rootDirectory: root, intervalMs: 10_000 })

  try {
    await writeFile(join(root, 'README.md'), 'documentation changed')
    expect(await monitor.check()).toBeUndefined()
    await writeFile(join(root, 'assets', 'theme.css'), 'style changed')
    expect(await monitor.check()).toContain('assets/theme.css')
  } finally {
    await monitor.close()
    await rm(root, { recursive: true, force: true })
  }
})

test('the idle compatibility fence skips known hot files but keeps configs and directory structure strict @pure', { tag: '@pure' }, async () => {
  expect(isCompatibleIdleInput('app.vue')).toBe(true)
  expect(isCompatibleIdleInput('pages/workspace.vue')).toBe(true)
  expect(isCompatibleIdleInput('domain/session.ts')).toBe(true)
  expect(isCompatibleIdleInput('assets/theme.css')).toBe(true)
  expect(isCompatibleIdleInput('tests/workspace.spec.ts')).toBe(true)
  expect(isCompatibleIdleInput('tests/fixtures/campaign.json')).toBe(true)
  for (const incompatible of [
    '.env.local', 'nuxt.config.ts', 'scripts/local-test.mjs', 'package.json', 'package-lock.json',
    'pages/not-a-source.txt', 'assets/theme.scss', 'tests/fixtures/untyped.bin',
  ]) expect(isCompatibleIdleInput(incompatible)).toBe(false)

  const root = await mkdtemp(join(tmpdir(), 'local-source-monitor-fence-'))
  await mkdir(join(root, 'pages'), { recursive: true })
  await mkdir(join(root, 'tests', 'fixtures'), { recursive: true })
  await mkdir(join(root, 'assets'), { recursive: true })
  const page = join(root, 'pages', 'workspace.vue')
  const spec = join(root, 'tests', 'workspace.spec.ts')
  const fixture = join(root, 'tests', 'fixtures', 'campaign.json')
  const css = join(root, 'assets', 'theme.css')
  const config = join(root, 'nuxt.config.ts')
  await Promise.all([
    writeFile(page, '<template>before</template>'),
    writeFile(spec, 'test.before = true'),
    writeFile(fixture, '{"value":"before"}'),
    writeFile(css, '.before {}'),
    writeFile(config, 'export default {}'),
  ])
  const monitor = await createLocalSourceMonitor({ rootDirectory: root, intervalMs: 10_000, ignoreFile: isCompatibleIdleInput })

  try {
    await Promise.all([
      writeFile(page, '<template>idle page edit</template>'),
      writeFile(spec, 'test.after = true'),
      writeFile(fixture, '{"value":"after"}'),
      writeFile(css, '.after {}'),
    ])
    expect(await monitor.check()).toBeUndefined()

    await writeFile(config, 'export default { devtools: true }')
    await writeFile(config, 'export default {}')
    await expect(monitor.invalidated).resolves.toContain('nuxt.config.ts')
  } finally {
    await monitor.close()
    await rm(root, { recursive: true, force: true })
  }

  const structureRoot = await mkdtemp(join(tmpdir(), 'local-source-monitor-fence-directory-'))
  await mkdir(join(structureRoot, 'pages'))
  const structureMonitor = await createLocalSourceMonitor({ rootDirectory: structureRoot, intervalMs: 10_000, ignoreFile: isCompatibleIdleInput })
  try {
    await mkdir(join(structureRoot, 'pages', 'new-route'))
    await writeFile(join(structureRoot, 'pages', 'new-route', 'index.vue'), '<template />')
    await expect(structureMonitor.invalidated).resolves.toBeTruthy()
  } finally {
    await structureMonitor.close()
    await rm(structureRoot, { recursive: true, force: true })
  }
})

test('local rerun requalifies a compatible idle edit and requires a fresh session after a transient config change @pure', { tag: '@pure' }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'local-test-idle-epoch-'))
  const pageDirectory = join(root, 'pages')
  await mkdir(pageDirectory)
  await writeFile(join(root, 'app.vue'), '<template>before</template>')
  await writeFile(join(root, 'nuxt.config.ts'), 'export default {}')
  const page = join(pageDirectory, 'index.vue')
  await writeFile(page, '<template>before</template>')
  let resolveIdleEditObserved: () => void = () => {}
  let idleEditObserved: Promise<void>
  let compatibilityFence: Awaited<ReturnType<typeof createLocalSourceMonitor>> | undefined
  let testChildren = 0
  let readinessCalls = 0
  let nextPid = 1_200
  const errors: string[] = []
  const session = createLauncherSession(root, {
    createSourceMonitor: async options => {
      const monitor = await createLocalSourceMonitor({
        intervalMs: 10_000,
        ...options,
        onIgnoredFileChange: relativePath => {
          options.onIgnoredFileChange?.(relativePath)
          if (relativePath === 'pages/index.vue') resolveIdleEditObserved()
        },
      })
      if (options.ignoreFile) compatibilityFence = monitor
      return monitor
    },
    openBrowserReadiness: async () => {
      readinessCalls += 1
      return createFakeBrowserReadiness()
    },
    spawnProcess: (_executable, args) => {
      const child = new FakeChild(++nextPid)
      if (args[0]?.endsWith('nuxt.mjs')) child.stdout.write('Local: http://127.0.0.1:3100/\n')
      else {
        testChildren += 1
        queueMicrotask(() => child.finish(0))
      }
      return child
    },
    writeStderr: value => errors.push(value),
  })

  try {
    await session.start(['--project=browser'])
    expect(await session.runTest(['--project=browser'])).toBe(0)
    expect(testChildren).toBe(1)

    idleEditObserved = new Promise<void>(resolve => { resolveIdleEditObserved = resolve })
    await writeFile(page, '<template>compatible idle UI edit</template>')
    await idleEditObserved
    expect(await compatibilityFence?.check()).toBeUndefined()
    expect(await session.runTest(['--project=browser'])).toBe(0)
    expect(testChildren).toBe(2)
    expect(readinessCalls).toBe(2)

    const config = join(root, 'nuxt.config.ts')
    await writeFile(config, 'export default { devtools: true }')
    await writeFile(config, 'export default {}')
    expect(await session.runTest(['--project=browser'])).toBe(1)
    expect(testChildren).toBe(2)
    expect(errors.join('')).toContain('fresh local test session')
  } finally {
    await session.close()
    await rm(root, { recursive: true, force: true })
  }
})

test('source monitor ignores metadata below the root .codex/environments boundary @pure', { tag: '@pure' }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'local-source-monitor-environments-'))
  const environments = join(root, '.codex', 'environments')
  await mkdir(environments, { recursive: true })
  const existingMetadata = join(environments, 'environment.toml')
  await writeFile(existingMetadata, 'before')
  const monitor = await createLocalSourceMonitor({ rootDirectory: root, intervalMs: 10_000 })
  const createdMetadata = join(environments, 'new-environment.toml')

  try {
    await writeFile(existingMetadata, 'edited')
    expect(await monitor.check()).toBeUndefined()

    await writeFile(createdMetadata, 'created')
    expect(await monitor.check()).toBeUndefined()

    await rm(createdMetadata)
    expect(await monitor.check()).toBeUndefined()

    const generatedDirectory = join(environments, 'generated')
    await mkdir(generatedDirectory)
    await writeFile(join(generatedDirectory, 'child.toml'), 'created below metadata root')
    expect(await monitor.check()).toBeUndefined()

    await rm(generatedDirectory, { recursive: true })
    expect(await monitor.check()).toBeUndefined()

    await rm(environments, { recursive: true })
    expect(await monitor.check()).toBeUndefined()
    await mkdir(environments, { recursive: true })
    expect(await monitor.check()).toBeUndefined()
  } finally {
    await monitor.close()
    await rm(root, { recursive: true, force: true })
  }
})

test('source monitor still detects adjacent configuration and runtime inputs @pure', { tag: '@pure' }, async () => {
  for (const relativePath of [
    '.codex/config.toml',
    '.codex/environments-other/runtime.toml',
    'other/environments/runtime.toml',
    'assets/theme.css',
  ]) {
    const root = await mkdtemp(join(tmpdir(), 'local-source-monitor-adjacent-'))
    const sourcePath = join(root, ...relativePath.split('/'))
    await mkdir(join(root, ...relativePath.split('/').slice(0, -1)), { recursive: true })
    await writeFile(sourcePath, 'before')
    const monitor = await createLocalSourceMonitor({ rootDirectory: root, intervalMs: 10_000 })

    try {
      await writeFile(sourcePath, 'after')
      expect(await monitor.check()).toContain(relativePath)
    } finally {
      await monitor.close()
      await rm(root, { recursive: true, force: true })
    }
  }
})

test('compatibility monitoring distinguishes stable file reads from real hot-file edits @pure', { tag: '@pure' }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'local-source-monitor-read-'))
  await mkdir(join(root, 'assets'))
  const sourcePath = join(root, 'assets', 'theme.css')
  writeFileSync(sourcePath, 'before')
  const original = statSync(sourcePath)
  const oldAtime = new Date(Date.now() - 3 * 24 * 60 * 60 * 1_000)
  utimesSync(sourcePath, oldAtime, original.mtime)
  const compatibleChanges: string[] = []
  const monitor = await createLocalSourceMonitor({
    rootDirectory: root,
    intervalMs: 10_000,
    ignoreFile: isCompatibleIdleInput,
    onIgnoredFileChange: relativePath => compatibleChanges.push(relativePath),
  })
  let invalidation: string | undefined
  void monitor.invalidated.then(reason => { invalidation = reason })

  try {
    const baselineAtime = statSync(sourcePath).atimeMs
    readFileSync(sourcePath)
    await expect.poll(() => statSync(sourcePath).atimeMs, { timeout: 1_000 }).toBeGreaterThan(baselineAtime)
    await new Promise<void>(resolve => setTimeout(resolve, 50))
    expect(invalidation).toBeUndefined()
    expect(compatibleChanges).toEqual([])

    writeFileSync(sourcePath, 'after')
    await expect.poll(() => compatibleChanges, { timeout: 1_000 }).toContain('assets/theme.css')
    expect(await monitor.check()).toBeUndefined()
  } finally {
    await monitor.close()
    await rm(root, { recursive: true, force: true })
  }
})

test('source monitor invalidates a filesystem edit even when the file is restored @pure', { tag: '@pure' }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'local-source-monitor-restore-'))
  await writeFile(join(root, 'nuxt.config.ts'), 'export default {}')
  const monitor = await createLocalSourceMonitor({ rootDirectory: root, intervalMs: 10_000 })

  try {
    const changed = monitor.invalidated
    await writeFile(join(root, 'nuxt.config.ts'), 'export default { devtools: true }')
    await writeFile(join(root, 'nuxt.config.ts'), 'export default {}')
    await expect(changed).resolves.toContain('nuxt.config.ts')
  } finally {
    await monitor.close()
    await rm(root, { recursive: true, force: true })
  }
})

test('source monitor invalidates a relevant file created and removed before watcher inspection @pure', { tag: '@pure' }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'local-source-monitor-transient-'))
  const monitor = await createLocalSourceMonitor({ rootDirectory: root, intervalMs: 10_000 })
  let invalidation: string | undefined
  void monitor.invalidated.then(reason => { invalidation = reason })
  const transientPath = join(root, 'transient.ts')

  try {
    writeFileSync(transientPath, 'export const transient = true')
    unlinkSync(transientPath)
    await expect.poll(() => invalidation, { timeout: 1_000 }).toContain('transient.ts')
  } finally {
    await monitor.close()
    await rm(root, { recursive: true, force: true })
  }
})

test('source monitor invalidates a newly added relevant root @pure', { tag: '@pure' }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'local-source-monitor-root-'))
  const monitor = await createLocalSourceMonitor({ rootDirectory: root, intervalMs: 10_000 })

  try {
    const added = monitor.invalidated
    await mkdir(join(root, 'assets'))
    await writeFile(join(root, 'assets', 'theme.css'), 'style')
    await expect(added).resolves.toContain('assets')
  } finally {
    await monitor.close()
    await rm(root, { recursive: true, force: true })
  }
})

test('source monitor close waits for an active input scan @pure', { tag: '@pure' }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'local-source-monitor-close-'))
  let scanCount = 0
  let finishScan: (() => void) | undefined
  const monitor = await createLocalSourceMonitor({
    rootDirectory: root,
    intervalMs: 10_000,
    scan: async directory => {
      scanCount += 1
      if (scanCount === 1) return { files: new Map(), directories: [directory] }
      return new Promise(resolve => {
        finishScan = () => resolve({ files: new Map(), directories: [directory] })
      })
    },
  })
  const activeScan = monitor.check()
  let closeFinished = false
  const closing = monitor.close().then(() => { closeFinished = true })

  try {
    await new Promise<void>(resolve => setImmediate(resolve))
    expect(closeFinished).toBe(false)
    finishScan?.()
    await closing
    await activeScan
    expect(closeFinished).toBe(true)
  } finally {
    finishScan?.()
    await closing
    await rm(root, { recursive: true, force: true })
  }
})

test('Vite HMR invalidation recognizes updates, reloads, prune, and errors @pure', { tag: '@pure' }, async () => {
  expect(viteHmrInvalidationReason('{"type":"connected"}')).toBeUndefined()
  const invalidation = createInvalidationLatch()
  invalidation.invalidate(viteHmrInvalidationReason('{"type":"update"}') ?? 'update')
  invalidation.invalidate('Vite reported connected after source restoration.')
  await expect(invalidation.invalidated).resolves.toContain('update')
  for (const frame of [
    { type: 'update' },
    { type: 'full-reload' },
    { type: 'prune' },
    { type: 'error' },
    { type: 'custom', event: 'vite:beforeFullReload' },
  ]) {
    expect(viteHmrInvalidationReason(JSON.stringify(frame))).toContain('Vite reported')
  }
})

test('local launcher fails when its owned server exits during startup @pure', { tag: '@pure' }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'local-test-launcher-exit-'))
  let server: FakeChild | undefined
  const session = createLocalTestSession({
    rootDirectory: root,
    env: {},
    port: 3100,
    checkPortAvailable: async () => {},
    spawnProcess: (_executable, args) => {
      server = new FakeChild(200)
      server.stdout.write('starting server\n')
      queueMicrotask(() => server?.finish(2))
      expect(args[0]?.endsWith('nuxt.mjs')).toBe(true)
      return server
    },
    createLogWriter: async () => ({ write: () => {}, close: async () => {} }),
    fetchImpl: async () => new Response(null, { status: 503 }),
    stopProcessTree: async () => { throw new Error('Exited process should not be stopped.') },
    readinessTimeoutMs: 1_000,
    readinessIntervalMs: 1,
    writeStdout: () => {},
    writeStderr: () => {},
  })

  try {
    await expect(session.start()).rejects.toThrow('development server exited (code 2)')
    expect(server?.exitCode).toBe(2)
  } finally {
    await session.close()
    await rm(root, { recursive: true, force: true })
  }
})

test('local launcher cannot spawn its server after cleanup wins during port preflight @pure', { tag: '@pure' }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'local-test-launcher-cancel-'))
  let finishPreflight: (() => void) | undefined
  let resolvePreflightStarted: () => void = () => {}
  const preflightStarted = new Promise<void>(resolve => { resolvePreflightStarted = resolve })
  const preflight = new Promise<void>(resolve => { finishPreflight = resolve })
  let spawnCount = 0
  const session = createLocalTestSession({
    rootDirectory: root,
    env: {},
    port: 3100,
    checkPortAvailable: () => {
      resolvePreflightStarted()
      return preflight
    },
    spawnProcess: () => {
      spawnCount += 1
      return new FakeChild(700)
    },
  })
  const starting = session.start()
  try {
    await preflightStarted
    const closing = session.close()
    finishPreflight?.()
    await closing
    await expect(starting).rejects.toThrow('closed before the server could start')
    expect(spawnCount).toBe(0)
  } finally {
    finishPreflight?.()
    await session.close()
    await rm(root, { recursive: true, force: true })
  }
})
