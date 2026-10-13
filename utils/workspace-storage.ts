/**
 * IndexedDB adapter for one normalized workspace; compatibility and migration rules stay in the domain schema.
 */
import { restoreLocalWorkspace, type LocalWorkspace } from '../domain/workspace'

const databaseName = 'ttrpg-cluster-control'
const storeName = 'workspace'
const workspaceKey = 'current'
const backupKey = 'last-valid'

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
 * Creates a detached workspace snapshot and validates it against the current domain schema.
 * @param workspace Workspace state to snapshot.
 * @returns A detached, normalized workspace snapshot.
 * @throws If serialization fails or the workspace is invalid.
 */
export function createWorkspaceSnapshot(workspace: LocalWorkspace): LocalWorkspace {
  const detached = JSON.parse(JSON.stringify(workspace)) as unknown
  const snapshot = restoreLocalWorkspace(detached)
  if (!snapshot) {
    throw new Error('The workspace is invalid and cannot be saved.')
  }

  return snapshot
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
  const snapshot = createWorkspaceSnapshot(workspace)
  const database = await openDatabase()

  try {
    const transaction = database.transaction(storeName, 'readwrite')
    const complete = transactionComplete(transaction)
    const store = transaction.objectStore(storeName)
    const currentRequest = store.get(workspaceKey) as IDBRequest<unknown>
    const backupRequest = store.get(backupKey) as IDBRequest<unknown>
    const writes = Promise.all([requestResult(currentRequest), requestResult(backupRequest)]).then(
      ([current, backup]) => {
        const currentIsValid = current !== undefined && restoreLocalWorkspace(current) !== null
        const backupIsValid = backup !== undefined && restoreLocalWorkspace(backup) !== null
        const nextBackup = currentIsValid
          ? current
          : backupIsValid
            ? backup
            : snapshot
        const backupWrite = store.put(nextBackup, backupKey)
        const currentWrite = store.put(snapshot, workspaceKey)
        return Promise.all([requestResult(backupWrite), requestResult(currentWrite)])
      },
    )

    await Promise.all([writes, complete])
  } finally {
    database.close()
  }
}

/**
 * Replaces the current record with the last valid snapshot and leaves that backup intact.
 * @returns The restored workspace, or null when this browser has no backup.
 * @throws If IndexedDB fails or the saved backup has an unsupported or damaged format.
 */
export async function restoreWorkspaceBackup(): Promise<LocalWorkspace | null> {
  const database = await openDatabase()

  try {
    const transaction = database.transaction(storeName, 'readwrite')
    const complete = transactionComplete(transaction)
    const store = transaction.objectStore(storeName)
    const request = store.get(backupKey) as IDBRequest<unknown>

    try {
      const stored = await requestResult(request)
      if (stored === undefined) {
        await complete
        return null
      }

      const workspace = restoreLocalWorkspace(stored)
      if (!workspace) {
        await complete
        throw new Error('The local backup has an unsupported or damaged format.')
      }

      const write = store.put(workspace, workspaceKey)
      await Promise.all([requestResult(write), complete])
      return workspace
    } catch (error) {
      await complete.catch(() => undefined)
      throw error
    }
  } finally {
    database.close()
  }
}
