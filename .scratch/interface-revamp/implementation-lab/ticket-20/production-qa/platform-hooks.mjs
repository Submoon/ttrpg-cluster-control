// Test-owned browser-platform instrumentation only. No app state/API hooks.
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

export async function readWorkspaceRecords(page) {
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open('ttrpg-cluster-control', 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    try {
      const tx = db.transaction('workspace', 'readonly'), store = tx.objectStore('workspace')
      const read = key => new Promise((resolve, reject) => { const request = store.get(key); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
      const [current, lastValid] = await Promise.all([read('current'), read('last-valid')])
      return { current, lastValid }
    } finally { db.close() }
  })
}

export async function withAbortedNextWorkspaceWrite(page, operation) {
  await page.evaluate(() => {
    if (window.__ticket20QaAbort) throw new Error('Ticket 20 abort hook already installed')
    const original = Object.getOwnPropertyDescriptor(IDBObjectStore.prototype, 'put')
    const state = { original, aborted: 0 }
    window.__ticket20QaAbort = state
    Object.defineProperty(IDBObjectStore.prototype, 'put', { ...original, value: function (...args) {
      const request = original.value.apply(this, args)
      if (!state.aborted && this.transaction.db.name === 'ttrpg-cluster-control' && this.name === 'workspace' && this.transaction.mode === 'readwrite' && args[1] === 'current') { state.aborted++; this.transaction.abort() }
      return request
    } })
  })
  try {
    const result = await operation()
    const aborted = await page.evaluate(() => window.__ticket20QaAbort.aborted)
    if (aborted !== 1) throw new Error(`Expected one actual workspace transaction abort; observed ${aborted}`)
    return result
  } finally {
    await page.evaluate(() => { const hook = window.__ticket20QaAbort; if (hook) Object.defineProperty(IDBObjectStore.prototype, 'put', hook.original); delete window.__ticket20QaAbort })
  }
}

export async function withDownloadClickFailure(page, operation) {
  await page.evaluate(() => {
    if (window.__ticket20QaDownload) throw new Error('Ticket 20 download hook already installed')
    const ownDescriptor = Object.getOwnPropertyDescriptor(HTMLAnchorElement.prototype, 'click'), original = HTMLAnchorElement.prototype.click, state = { original, ownDescriptor, failures: 0 }
    window.__ticket20QaDownload = state
    Object.defineProperty(HTMLAnchorElement.prototype, 'click', { configurable: true, writable: true, value: function (...args) {
      if (this.download) { state.failures++; throw new Error('Ticket 20 QA download dispatch failed') }
      return original.apply(this, args)
    } })
  })
  try {
    const result = await operation()
    const failures = await page.evaluate(() => window.__ticket20QaDownload.failures)
    if (!failures) throw new Error('Expected an actual attempted download dispatch')
    return result
  } finally {
    await page.evaluate(() => { const hook = window.__ticket20QaDownload; if (hook?.ownDescriptor) Object.defineProperty(HTMLAnchorElement.prototype, 'click', hook.ownDescriptor); else delete HTMLAnchorElement.prototype.click; delete window.__ticket20QaDownload })
  }
}

export async function actualJsonDownload(page, activate) {
  const pending = page.waitForEvent('download')
  await activate()
  const download = await pending, path = await download.path()
  if (!path) throw new Error('The browser did not provide a completed download file')
  const bytes = await readFile(path), value = JSON.parse(bytes.toString('utf8'))
  if (value.format !== 'ttrpg-cluster-control-map' || value.version !== 1) throw new Error('Unexpected downloaded product format/version')
  return { value, filename: download.suggestedFilename(), sha256: createHash('sha256').update(bytes).digest('hex') }
}
