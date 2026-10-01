import { restoreLocalWorkspace, type LocalWorkspace } from '../domain/workspace'

const databaseName = 'mothership-campaign'
const storeName = 'workspace'
const workspaceKey = 'current'

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

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'))
  })
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    const fail = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'))
    transaction.addEventListener('complete', () => resolve(), { once: true })
    transaction.addEventListener('abort', fail, { once: true })
    transaction.addEventListener('error', fail, { once: true })
  })
}

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
