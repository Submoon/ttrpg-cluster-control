import { appendFileSync, readFileSync } from 'node:fs'

// Disposable production-server hook for the offline probe. Point the control file at
// `allow` during the warm-up pass, then write `deny` before the warm-offline reload.
const controlPath = process.env.EGRESS_CONTROL_FILE
const logPath = process.env.EGRESS_DENY_LOG
const nativeFetch = globalThis.fetch

function isLoopback(input) {
  try {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
    return ['localhost', '127.0.0.1', '::1'].includes(url.hostname.toLowerCase())
  } catch {
    return false
  }
}

globalThis.fetch = async function guardedFetch(input, init) {
  const local = isLoopback(input)
  let mode = 'deny'
  if (controlPath) {
    try {
      mode = readFileSync(controlPath, 'utf8').trim().toLowerCase()
    } catch {
      mode = 'deny'
    }
  }

  if (!local && mode !== 'allow') {
    let url = '<unparseable>'
    try {
      url = typeof input === 'string' || input instanceof URL ? String(input) : input.url
    } catch {}
    if (logPath) {
      try {
        appendFileSync(logPath, `${JSON.stringify({ time: new Date().toISOString(), url, mode, result: 'blocked' })}\n`)
      } catch {}
    }
    throw new TypeError(`Offline probe denied outbound fetch: ${url}`)
  }

  if (!local && logPath) {
    try {
      appendFileSync(logPath, `${JSON.stringify({ time: new Date().toISOString(), url: String(input), mode, result: 'allowed' })}\n`)
    } catch {}
  }
  return nativeFetch.call(this, input, init)
}
