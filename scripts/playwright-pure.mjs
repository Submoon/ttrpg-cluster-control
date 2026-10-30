import { spawn } from 'node:child_process'
import process from 'node:process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url))
const playwrightCli = resolve(repositoryRoot, 'node_modules', '@playwright', 'test', 'cli.js')
const environment = { ...process.env, PLAYWRIGHT_SUITE: 'pure' }

delete environment.PLAYWRIGHT_BASE_URL
delete environment.PLAYWRIGHT_PRODUCTION_URL
delete environment.VERCEL_AUTOMATION_BYPASS_SECRET

const child = spawn(process.execPath, [playwrightCli, 'test', ...process.argv.slice(2)], {
  cwd: repositoryRoot,
  env: environment,
  stdio: 'inherit',
  detached: process.platform !== 'win32',
  windowsHide: true,
})

let receivedSignal
let stopping = false
let resolveChildClosed
const childClosed = new Promise(resolveClosed => { resolveChildClosed = resolveClosed })

function childIsRunning() {
  return child.exitCode === null && child.signalCode === null
}

async function stopChild(signal) {
  if (stopping || !childIsRunning() || !child.pid) return
  stopping = true
  if (process.platform === 'win32') {
    const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    })
    await Promise.race([
      new Promise(resolveClose => {
        killer.once('close', resolveClose)
        killer.once('error', resolveClose)
      }),
      new Promise(resolveTimeout => setTimeout(resolveTimeout, 2_000)),
    ])
    if (childIsRunning()) child.kill('SIGKILL')
    return
  }

  try {
    process.kill(-child.pid, signal)
  } catch (error) {
    if (error.code !== 'ESRCH') process.stderr.write(`Could not stop the Playwright child process group: ${error.message}\n`)
  }
  await Promise.race([
    childClosed,
    new Promise(resolveTimeout => setTimeout(resolveTimeout, 2_000)),
  ])
  if (childIsRunning()) {
    try {
      process.kill(-child.pid, 'SIGKILL')
    } catch (error) {
      if (error.code !== 'ESRCH') process.stderr.write(`Could not force-stop the Playwright child process group: ${error.message}\n`)
    }
  }
}

function onSignal(signal) {
  receivedSignal = signal
  void stopChild(signal === 'SIGINT' ? 'SIGINT' : 'SIGTERM')
}

const onSigint = () => onSignal('SIGINT')
const onSigterm = () => onSignal('SIGTERM')
process.once('SIGINT', onSigint)
process.once('SIGTERM', onSigterm)

child.once('error', error => {
  process.stderr.write(`Could not start Playwright: ${error.message}\n`)
  process.exitCode = 1
})

child.once('close', (code, signal) => {
  resolveChildClosed()
  process.removeListener('SIGINT', onSigint)
  process.removeListener('SIGTERM', onSigterm)
  const signalExitCode = receivedSignal === 'SIGINT' || signal === 'SIGINT'
    ? 130
    : receivedSignal === 'SIGTERM' || signal === 'SIGTERM'
      ? 143
      : 1
  if (process.exitCode !== 1) process.exitCode = receivedSignal || signal ? signalExitCode : (code ?? 1)
})
