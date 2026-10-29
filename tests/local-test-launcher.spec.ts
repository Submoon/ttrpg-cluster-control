import { EventEmitter } from 'node:events'
import { createServer } from 'node:net'
import { PassThrough } from 'node:stream'
import { Writable } from 'node:stream'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
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
  let nextPid = 100
  const spawnProcess = (executable: string, args: readonly string[], options: FakeSpawnOptions) => {
    const child = new FakeChild(++nextPid)
    spawned.push({ executable, args, options, child })
    if (args[0]?.endsWith('nuxt.mjs')) {
      child.stdout.write('token=super-')
      child.stdout.write('secret-value\n')
      child.stdout.write('\u001B[32m➜\u001B[0m Local:    http://127.0.0.1:3100/\n')
    } else {
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
    },
    port: 3100,
    spawnProcess,
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
    expect(new Set(testRuns.map(run => run.options.env?.PLAYWRIGHT_OUTPUT_DIR)).size).toBe(2)
    expect(testRuns[0]?.options.env?.PLAYWRIGHT_OUTPUT_DIR).toContain('playwright-run-1')
    expect(testRuns[1]?.options.env?.PLAYWRIGHT_OUTPUT_DIR).toContain('playwright-run-2')
    expect(log.join('')).not.toContain('super-secret-value')
    expect(terminal.join('')).not.toContain('super-secret-value')
    expect(log.join('')).toContain('[REDACTED]')
    expect(log.join('')).toContain('http://127.0.0.1:3100/')
    expect(session.logRelativePath).toContain('test-results')

    await session.close()
    expect(killed).toEqual([spawned[0]!.child.pid])
  } finally {
    await session.close()
    await rm(root, { recursive: true, force: true })
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
  const preflight = new Promise<void>(resolve => { finishPreflight = resolve })
  let spawnCount = 0
  const session = createLocalTestSession({
    rootDirectory: root,
    env: {},
    port: 3100,
    checkPortAvailable: () => preflight,
    spawnProcess: () => {
      spawnCount += 1
      return new FakeChild(700)
    },
  })
  const starting = session.start()
  try {
    await new Promise<void>(resolve => setImmediate(resolve))
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
