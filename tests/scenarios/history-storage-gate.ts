import type { Page } from '@playwright/test'

type HistoryStorageGate = {
  originalListen: IDBTransaction['addEventListener']
  originalPut: IDBObjectStore['put']
  hold: boolean
  abortNext: boolean
  pending: Array<() => void>
}
type HistoryStorageWindow = Window & { __historyStorageGate?: HistoryStorageGate }

/** Controls real transaction acknowledgements and aborts without replacing the storage implementation. */
export async function installHistoryStorageGate(page: Page): Promise<void> {
  await page.evaluate(() => {
    const gate: HistoryStorageGate = {
      originalListen: IDBTransaction.prototype.addEventListener,
      originalPut: IDBObjectStore.prototype.put,
      hold: false,
      abortNext: false,
      pending: [],
    }
    ;(window as HistoryStorageWindow).__historyStorageGate = gate
    IDBTransaction.prototype.addEventListener = function (
      this: IDBTransaction,
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ): void {
      if (type !== 'complete' || !gate.hold || this.mode !== 'readwrite'
        || this.db.name !== 'ttrpg-cluster-control' || !this.objectStoreNames.contains('workspace')) {
        return gate.originalListen.call(this, type, listener, options)
      }
      const invoke = typeof listener === 'function' ? listener.bind(this) : (event: Event) => listener.handleEvent(event)
      const deliver = (event: Event): void => {
        gate.pending.push(() => {
          invoke(event)
        })
      }
      gate.originalListen.call(this, type, deliver, options)
    }
    IDBObjectStore.prototype.put = function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
      const request = gate.originalPut.call(this, value, key)
      if (gate.abortNext && key === 'current' && this.name === 'workspace'
        && this.transaction.db.name === 'ttrpg-cluster-control') {
        gate.abortNext = false
        this.transaction.abort()
      }
      return request
    }
  })
}

export async function setHistoryStorageGate(page: Page, change: { hold?: boolean; abortNext?: boolean }): Promise<void> {
  await page.evaluate((next) => {
    const gate = (window as HistoryStorageWindow).__historyStorageGate
    if (!gate) throw new Error('The history storage gate is not installed.')
    Object.assign(gate, next)
  }, change)
}

export async function pendingHistoryAcknowledgements(page: Page): Promise<number> {
  return page.evaluate(() => (window as HistoryStorageWindow).__historyStorageGate?.pending.length ?? 0)
}

/** Releases one old acknowledgement while leaving subsequent real writes held. */
export async function releaseNextHistoryAcknowledgement(page: Page): Promise<void> {
  await page.evaluate(() => {
    const release = (window as HistoryStorageWindow).__historyStorageGate?.pending.shift()
    if (!release) throw new Error('No workspace acknowledgement is waiting.')
    release()
  })
}

export async function releaseHistoryAcknowledgements(page: Page, restore = false): Promise<void> {
  await page.evaluate((restoreOriginals) => {
    const tracked = window as HistoryStorageWindow
    const gate = tracked.__historyStorageGate
    if (!gate) return
    gate.hold = false
    for (const release of gate.pending.splice(0)) release()
    if (restoreOriginals) {
      IDBTransaction.prototype.addEventListener = gate.originalListen
      IDBObjectStore.prototype.put = gate.originalPut
      delete tracked.__historyStorageGate
    }
  }, restore)
}
