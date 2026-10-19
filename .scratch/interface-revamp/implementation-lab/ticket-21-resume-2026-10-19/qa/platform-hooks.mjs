// Test-owned browser platform operations, confined to fresh isolated contexts.
// No production component, private Vue state or application command API.
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

export async function readWorkspaceRecords(page) {
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('ttrpg-cluster-control', 1)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      const tx = db.transaction('workspace', 'readonly'), store = tx.objectStore('workspace')
      const get = key => new Promise((resolve, reject) => {
        const request = store.get(key)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      const [current, lastValid] = await Promise.all([get('current'), get('last-valid')])
      return { current, lastValid }
    } finally { db.close() }
  })
}

export async function seedValidatedRecord(page, record) {
  // The caller first validates this actual root-created/imported record through
  // restoreLocalWorkspace. Only test-owned isolated storage is touched.
  await page.evaluate(async value => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('ttrpg-cluster-control', 1)
      request.onupgradeneeded = () => request.result.createObjectStore('workspace')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction('workspace', 'readwrite'), store = tx.objectStore('workspace')
        tx.oncomplete = resolve
        tx.onabort = () => reject(tx.error || new Error('QA fixture transaction aborted'))
        tx.onerror = () => reject(tx.error || new Error('QA fixture transaction failed'))
        store.put(value, 'current'); store.put(value, 'last-valid')
      })
    } finally { db.close() }
  }, record)
}

export async function actualJsonDownload(page, activate) {
  const pending = page.waitForEvent('download')
  await activate()
  const download = await pending, path = await download.path()
  if (!path) throw new Error('No completed browser download path')
  const bytes = await readFile(path), value = JSON.parse(bytes.toString('utf8'))
  if (value.format !== 'ttrpg-cluster-control-map' || value.version !== 1) throw new Error('Unexpected downloaded marker/version')
  return { value, filename: download.suggestedFilename(), sha256: createHash('sha256').update(bytes).digest('hex') }
}

export async function withAbortedNextWorkspaceWrite(page, action) {
  await page.evaluate(() => {
    if (window.__ticket21QaAbort) throw new Error('QA abort hook already installed')
    const descriptor = Object.getOwnPropertyDescriptor(IDBObjectStore.prototype, 'put')
    window.__ticket21QaAbort = { descriptor, aborted: 0 }
    Object.defineProperty(IDBObjectStore.prototype, 'put', { ...descriptor, value: function (...args) {
      const request = descriptor.value.apply(this, args), hook = window.__ticket21QaAbort
      if (!hook.aborted && this.transaction.db.name === 'ttrpg-cluster-control' && this.name === 'workspace' && this.transaction.mode === 'readwrite' && args[1] === 'current') {
        hook.aborted++; this.transaction.abort()
      }
      return request
    } })
  })
  try {
    const value = await action()
    if (await page.evaluate(() => window.__ticket21QaAbort.aborted) !== 1) throw new Error('Expected exactly one actual IndexedDB transaction abort')
    return value
  } finally {
    await page.evaluate(() => {
      const hook = window.__ticket21QaAbort
      if (hook) Object.defineProperty(IDBObjectStore.prototype, 'put', hook.descriptor)
      delete window.__ticket21QaAbort
    })
  }
}
