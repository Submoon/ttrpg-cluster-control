// Test-owned process guard. Load only into the cold compiled server with --require.
const fs = require('node:fs')
const net = require('node:net')
const tls = require('node:tls')
const dns = require('node:dns')
const { syncBuiltinESMExports } = require('node:module')
const logPath = process.env.QA_NETWORK_GUARD_LOG
if (!logPath) throw new Error('QA_NETWORK_GUARD_LOG is required')
const log = row => fs.appendFileSync(logPath, JSON.stringify({ time: new Date().toISOString(), pid: process.pid, ...row }) + '\n')
const local = host => ['localhost', '::1', '[::1]'].includes(String(host).toLowerCase()) || /^127(?:\.\d{1,3}){3}$/.test(String(host)) || /^::ffff:127\./i.test(String(host))
let label = 'compiled-server-egress'
const deny = (api, host) => {
  log({ event: 'denied', label, api, host: String(host) })
  const error = new Error(`QA external network denied: ${host}`)
  error.code = 'QA_EXTERNAL_NETWORK_DENIED'
  throw error
}
const inspect = (args, api) => {
  let options = args[0]
  if (Array.isArray(options)) return inspect(options, api)
  // Unix/named-pipe sockets are not Internet egress.
  if (typeof options === 'string' && !/^\d+$/.test(options)) return
  const host = options && typeof options === 'object' ? options.host ?? options.hostname ?? (options.path ? null : 'localhost') : typeof args[1] === 'string' ? args[1] : 'localhost'
  if (host !== null && !local(host)) deny(api, host)
}
const connect = net.Socket.prototype.connect
net.Socket.prototype.connect = function (...args) { inspect(args, 'net.Socket.connect'); return connect.apply(this, args) }
const tlsConnect = tls.connect
tls.connect = function (...args) { inspect(args, 'tls.connect'); return tlsConnect.apply(this, args) }
for (const name of ['lookup', 'resolve', 'resolve4', 'resolve6', 'resolveAny', 'resolveCname', 'resolveMx', 'resolveNaptr', 'resolveNs', 'resolvePtr', 'resolveSoa', 'resolveSrv', 'resolveTxt', 'reverse']) {
  if (typeof dns[name] === 'function') {
    const original = dns[name]
    dns[name] = function (host, ...args) { if (!local(host)) deny(`dns.${name}`, host); return original.call(this, host, ...args) }
  }
  if (typeof dns.promises[name] === 'function') {
    const original = dns.promises[name]
    dns.promises[name] = async function (host, ...args) { if (!local(host)) deny(`dns.promises.${name}`, host); return original.call(this, host, ...args) }
  }
}
syncBuiltinESMExports()
log({ event: 'guard-installed', policy: 'deny external hostnames and addresses; permit loopback and local pipes' })
label = 'server-guard-canary'
try {
  const socket = new net.Socket()
  socket.connect({ host: 'example.com', port: 443 })
  socket.destroy()
  log({ event: 'canary-failed', label })
  throw new Error('Server egress guard canary was not blocked')
} catch (error) {
  if (error.code !== 'QA_EXTERNAL_NETWORK_DENIED') throw error
  log({ event: 'canary-passed', label, code: error.code })
} finally { label = 'compiled-server-egress' }
