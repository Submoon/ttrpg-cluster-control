/**
 * IndexedDB adapter for one normalized workspace; compatibility and migration rules stay in the domain schema.
 */
import { restoreLocalWorkspace, type LocalWorkspace } from '../domain/workspace'

const databaseName = 'mothership-campaign'
const storeName = 'workspace'
const workspaceKey = 'current'

/**
 * Opens the versioned workspace database in browsers that provide IndexedDB.
 * @returns The open database handle.
 * @throws If IndexedDB is unavailable or the browser cannot open the database.
 */
function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available in this browser.'))
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(storeName)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open local storage.'))
  })
}

/**
 * Converts one IndexedDB request's success/error events into a promise.
 * @param request Pending IndexedDB request.
 * @returns The request result after its success event.
 * @throws With the request error when the request fails.
 */
function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'))
  })
}

/**
 * Resolves only after a transaction commits, rather than when an individual request succeeds.
 * @param transaction Transaction whose terminal events to observe.
 * @returns A promise that resolves on completion.
 * @throws If the transaction aborts or errors.
 */
function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    const fail = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'))
    transaction.addEventListener('complete', () => resolve(), { once: true })
    transaction.addEventListener('abort', fail, { once: true })
    transaction.addEventListener('error', fail, { once: true })
  })
}

/**
 * Reads the saved record and restores it through the domain's current schema rules.
 * @returns The restored workspace, or null when no record has been saved.
 * @throws If IndexedDB fails or the stored record has an unsupported or damaged format.
 */
export async function loadWorkspace(): Promise<LocalWorkspace | null> {
  const database = await openDatabase()

  try {
    const transaction = database.transaction(storeName, 'readonly')
    const complete = transactionComplete(transaction)
    const request = transaction.objectStore(storeName).get(workspaceKey) as IDBRequest<unknown>
    const [stored] = await Promise.all([requestResult(request), complete])

    if (stored === undefined) {
      return null
    }
    const workspace = restoreLocalWorkspace(stored)
    if (!workspace) {
      throw new Error('The saved workspace has an unsupported or damaged format.')
    }

    return workspace
  } finally {
    database.close()
  }
}

/**
 * Persists a detached snapshot and waits for the read-write transaction to commit.
 * @param workspace Workspace state to snapshot before any asynchronous database operation.
 * @returns A promise that resolves after durable transaction completion.
 * @throws If snapshot serialization, IndexedDB requests, or the transaction fail.
 */
export async function saveWorkspace(workspace: LocalWorkspace): Promise<void> {
  const snapshot = JSON.parse(JSON.stringify(workspace)) as LocalWorkspace
  const database = await openDatabase()

  try {
    const transaction = database.transaction(storeName, 'readwrite')
    const complete = transactionComplete(transaction)
    const request = transaction.objectStore(storeName).put(snapshot, workspaceKey)

    await Promise.all([requestResult(request), complete])
  } finally {
    database.close()
  }
}
