import { EventEmitter } from 'node:events'
import { createServer } from 'node:net'
import { readFileSync, statSync, unlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { PassThrough } from 'node:stream'
import { Writable } from 'node:stream'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { createInvalidationLatch, openBrowserReadiness, viteHmrInvalidationReason } from '../scripts/local-browser-readiness.mjs'
import { createLocalSourceMonitor } from '../scripts/local-source-monitor.mjs'
import { isPureOnlySelection } from '../scripts/playwright-selection.mjs'
import {
  assertPortAvailable,
  createSignalController,
  createLocalTestSession,
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

test('local test readiness reports an actionable timeout @pure', { tag: '@pure' }, async () => {
  let elapsed = 0
  let requests = 0
  await expect(waitForHttpReady({
    url: 'http://127.0.0.1:45678',
    fetchImpl: async () => {
      requests += 1
      return new Response(null, { status: 503 })
    },
    timeoutMs: 1_000,
    intervalMs: 400,
    now: () => elapsed,
    wait: async milliseconds => { elapsed += milliseconds },
  })).rejects.toThrow('Timed out after 1000 ms')
  expect(requests).toBe(3)
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

test('Ctrl+C at the rerun prompt is forwarded as an interrupt @pure', { tag: '@pure' }, async () => {
  const input = new PassThrough()
  const output = new Writable({ write: (_chunk, _encoding, callback) => callback() })
  const signalSource = new EventEmitter()
  const session = {
    serverExit: new Promise<never>(() => {}),
    logRelativePath: 'test-results/local-test/server.log',
    runTest: async () => 0,
  }
  let activeReadline: import('node:readline/promises').Interface | undefined
  const signals = createSignalController(signalSource, () => activeReadline?.close())
  const execution = runInteractiveSession(session, [], {
    input,
    output,
    onInterface: active => { activeReadline = active },
    onInterrupt: () => signals.interrupt('SIGINT'),
  })

  await new Promise<void>(resolve => setImmediate(resolve))
  const interrupted = Promise.race([execution.catch(() => -1), signals.interrupted])
  activeReadline?.emit('SIGINT')

  expect(await interrupted).toBe(130)
  expect(await execution).toBe(130)
  expect(activeReadline).toBeUndefined()
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
  const sourceMonitor = createFakeSourceMonitor()
  const browserReadiness = createFakeBrowserReadiness()
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
      PLAYWRIGHT_JSON_OUTPUT_NAME: 'caller-shared-report.json',
      PLAYWRIGHT_CHANNEL: 'chrome',
    },
    port: 3100,
    spawnProcess,
    createSourceMonitor: async () => {
      order.push('monitor')
      return sourceMonitor
    },
    openBrowserReadiness: async ({ url, timeoutMs, signal, channel }) => {
      order.push('browser')
      expect(url).toBe('http://127.0.0.1:3100')
      expect(timeoutMs).toBe(1_000)
      expect(channel).toBe('chrome')
      expect(signal.aborted).toBe(false)
      return browserReadiness
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
    expect(new Set(testRuns.map(run => run.options.env?.PLAYWRIGHT_OUTPUT_DIR)).size).toBe(2)
    expect(new Set(testRuns.map(run => run.options.env?.PLAYWRIGHT_JSON_OUTPUT_NAME)).size).toBe(2)
    expect(testRuns.every(run => run.options.env?.PLAYWRIGHT_JSON_OUTPUT_NAME?.endsWith('results.json'))).toBe(true)
    expect(testRuns[0]?.options.env?.PLAYWRIGHT_OUTPUT_DIR).toContain('playwright-run-1')
    expect(testRuns[1]?.options.env?.PLAYWRIGHT_OUTPUT_DIR).toContain('playwright-run-2')
    expect(log.join('')).not.toContain('super-secret-value')
    expect(terminal.join('')).not.toContain('super-secret-value')
    expect(log.join('')).toContain('[REDACTED]')
    expect(log.join('')).toContain('http://127.0.0.1:3100/')
    expect(session.logRelativePath).toContain('test-results')
    expect(order).toEqual(['monitor', 'server', 'browser', 'test', 'test'])

    await session.close()
    expect(killed).toEqual([spawned[0]!.child.pid])
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

test('closing during output preparation prevents a late Playwright child spawn @pure', { tag: '@pure' }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'local-test-output-cancel-'))
  const sourceMonitor = createFakeSourceMonitor()
  let resolvePreparationStarted: () => void = () => {}
  let finishPreparation: (() => void) | undefined
  const preparationStarted = new Promise<void>(resolve => { resolvePreparationStarted = resolve })
  const preparation = new Promise<void>(resolve => { finishPreparation = resolve })
  let testChildren = 0
  let nextPid = 855
  const session = createLauncherSession(root, {
    createSourceMonitor: async () => sourceMonitor,
    prepareOutputDirectory: async () => {
      resolvePreparationStarted()
      await preparation
    },
    spawnProcess: (_executable, args) => {
      const child = new FakeChild(++nextPid)
      if (args[0]?.endsWith('nuxt.mjs')) child.stdout.write('Local: http://127.0.0.1:3100/\n')
      else testChildren += 1
      return child
    },
  })

  try {
    await session.start(['--project=browser'])
    const running = session.runTest(['--project=browser'])
    await preparationStarted
    await session.close()
    finishPreparation?.()
    await expect(running).rejects.toThrow('closed while preparing the Playwright run')
    expect(testChildren).toBe(0)
  } finally {
    finishPreparation?.()
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

  await launchStarted
  expect(launchOptions?.channel).toBe('chrome')
  expect(launchOptions?.timeout).toBeGreaterThan(0)
  expect(launchOptions?.timeout).toBeLessThanOrEqual(5_000)
  controller.abort(new Error('Readiness cancelled by test.'))
  await expect(opening).rejects.toThrow('Readiness cancelled by test')
  finishLaunch?.()
  await browserClosed
  expect(closeCount).toBe(1)
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

test('source monitor ignores stable file-read notifications but catches later writes @pure', { tag: '@pure' }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'local-source-monitor-read-'))
  await mkdir(join(root, 'assets'))
  const sourcePath = join(root, 'assets', 'theme.css')
  writeFileSync(sourcePath, 'before')
  const original = statSync(sourcePath)
  const oldAtime = new Date(Date.now() - 3 * 24 * 60 * 60 * 1_000)
  utimesSync(sourcePath, oldAtime, original.mtime)
  const monitor = await createLocalSourceMonitor({ rootDirectory: root, intervalMs: 10_000 })
  let invalidation: string | undefined
  void monitor.invalidated.then(reason => { invalidation = reason })

  try {
    const baselineAtime = statSync(sourcePath).atimeMs
    readFileSync(sourcePath)
    await expect.poll(() => statSync(sourcePath).atimeMs, { timeout: 1_000 }).toBeGreaterThan(baselineAtime)
    await new Promise<void>(resolve => setTimeout(resolve, 50))
    expect(invalidation).toBeUndefined()

    writeFileSync(sourcePath, 'after')
    await expect.poll(() => invalidation, { timeout: 1_000 }).toContain('assets/theme.css')
  } finally {
    await monitor.close()
    await rm(root, { recursive: true, force: true })
  }
})

test('source monitor canonicalizes its root before registering watchers @pure', { tag: '@pure' }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'local-source-monitor-canonical-'))
  let scanRoot: string | undefined
  const monitor = await createLocalSourceMonitor({
    rootDirectory: root,
    scan: async directory => {
      scanRoot = directory
      return { files: new Map(), directories: [directory] }
    },
  })

  try {
    expect(scanRoot).toBe(await realpath(root))
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

test('local launcher does not start readiness when cleanup wins during the initial source scan @pure', { tag: '@pure' }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'local-test-startup-scan-cancel-'))
  let finishScan: (() => void) | undefined
  let resolveScanStarted: () => void = () => {}
  const scanStarted = new Promise<void>(resolve => { resolveScanStarted = resolve })
  let closeCount = 0
  let readinessCalls = 0
  let spawnCount = 0
  const sourceMonitor = {
    invalidated: new Promise<string>(() => {}),
    check: () => {
      resolveScanStarted()
      return new Promise<string | undefined>(resolve => { finishScan = () => resolve(undefined) })
    },
    close: async () => { closeCount += 1 },
  }
  let nextPid = 705
  const session = createLauncherSession(root, {
    createSourceMonitor: async () => sourceMonitor,
    openBrowserReadiness: async () => {
      readinessCalls += 1
      return createFakeBrowserReadiness()
    },
    spawnProcess: () => {
      spawnCount += 1
      return new FakeChild(++nextPid)
    },
  })
  const starting = session.start(['--project=browser'])

  try {
    await scanStarted
    await session.close()
    finishScan?.()
    await expect(starting).rejects.toThrow('closed before verification could start')
    expect(closeCount).toBe(1)
    expect(readinessCalls).toBe(0)
    expect(spawnCount).toBe(0)
  } finally {
    finishScan?.()
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
    await session.close()
    finishPreflight?.()
    await expect(starting).rejects.toThrow('closed before the server could start')
    expect(spawnCount).toBe(0)
  } finally {
    finishPreflight?.()
    await session.close()
    await rm(root, { recursive: true, force: true })
  }
})
