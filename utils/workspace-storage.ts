/**
 * IndexedDB adapter for one normalized workspace; compatibility and migration rules stay in the domain schema.
 */
import { restoreLocalWorkspace, type LocalWorkspace } from '../domain/workspace'

const databaseName = 'ttrpg-cluster-control'
const storeName = 'workspace'
const workspaceKey = 'current'
const backupKey = 'last-valid'
const revisionKey = 'current-revision'
const ownerKey = 'workspace-owner'

export type WorkspaceRecordStatus = 'empty' | 'valid' | 'damaged'

/** Point-in-time durable version used to protect restore review against same-ID edits and other tabs. */
export interface WorkspaceStorageVersion {
  workspace: LocalWorkspace | null
  revision: number
  recordStatus: WorkspaceRecordStatus
  /** Exact stored-record fingerprint used when recovering a damaged current record. */
  fingerprint: string | null
  ownerId: string | null
}

export class WorkspaceStorageConflictError extends Error {
  constructor(message = 'This workspace changed in another tab. Reload it before continuing.') {
    super(message)
    this.name = 'WorkspaceStorageConflictError'
  }
}

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

function storedRevision(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0
}

function storedFingerprint(value: unknown): string | null {
  try {
    return JSON.stringify(value) ?? null
  } catch {
    return null
  }
}

/** Reads the current record and its revision atomically, retaining a CAS token for empty or damaged states. */
export async function readWorkspaceState(): Promise<WorkspaceStorageVersion> {
  const database = await openDatabase()

  try {
    const transaction = database.transaction(storeName, 'readonly')
    const complete = transactionComplete(transaction)
    const store = transaction.objectStore(storeName)
    const recordRequest = store.get(workspaceKey) as IDBRequest<unknown>
    const revisionRequest = store.get(revisionKey) as IDBRequest<unknown>
    const ownerRequest = store.get(ownerKey) as IDBRequest<unknown>
    const [stored, revisionValue, ownerValue] = await Promise.all([
      requestResult(recordRequest),
      requestResult(revisionRequest),
      requestResult(ownerRequest),
      complete,
    ]).then(([record, revision, owner]) => [record, revision, owner] as const)
    const ownerId = typeof ownerValue === 'string' ? ownerValue : null

    if (stored === undefined) {
      return { workspace: null, revision: storedRevision(revisionValue), recordStatus: 'empty', fingerprint: null, ownerId }
    }

    const workspace = restoreLocalWorkspace(stored)
    return workspace
      ? { workspace, revision: storedRevision(revisionValue), recordStatus: 'valid', fingerprint: null, ownerId }
      : {
          workspace: null,
          revision: storedRevision(revisionValue),
          recordStatus: 'damaged',
          fingerprint: storedFingerprint(stored),
          ownerId,
        }
  } finally {
    database.close()
  }
}

/**
 * Reads the saved record and restores it through the domain's current schema rules.
 * @returns The restored workspace, or null when no record has been saved.
 * @throws If IndexedDB fails or the stored record has an unsupported or damaged format.
 */
export async function loadWorkspace(): Promise<LocalWorkspace | null> {
  const state = await readWorkspaceState()
  if (state.recordStatus === 'damaged') throw new Error('The saved workspace has an unsupported or damaged format.')
  return state.workspace
}

/**
 * Persists a detached snapshot and waits for the read-write transaction to commit.
 * @param workspace Workspace state to snapshot before any asynchronous database operation.
 * @returns A promise that resolves after durable transaction completion.
 * @throws If snapshot serialization, IndexedDB requests, or the transaction fail.
 */
export async function saveWorkspace(workspace: LocalWorkspace): Promise<number> {
  const snapshot = createWorkspaceSnapshot(workspace)
  const database = await openDatabase()

  try {
    const transaction = database.transaction(storeName, 'readwrite')
    const complete = transactionComplete(transaction)
    const store = transaction.objectStore(storeName)
    const currentRequest = store.get(workspaceKey) as IDBRequest<unknown>
    const backupRequest = store.get(backupKey) as IDBRequest<unknown>
    const revisionRequest = store.get(revisionKey) as IDBRequest<unknown>
    const ownerRequest = store.get(ownerKey) as IDBRequest<unknown>
    const writes = Promise.all([
      requestResult(currentRequest),
      requestResult(backupRequest),
      requestResult(revisionRequest),
      requestResult(ownerRequest),
    ]).then(([current, backup, revisionValue, ownerValue]) => {
        const currentWorkspace = current === undefined ? null : restoreLocalWorkspace(current)
        if (current !== undefined && !currentWorkspace) {
          throw new Error('The saved workspace is damaged. Restore a backup before saving over it.')
        }
        const ownerId = typeof ownerValue === 'string' ? ownerValue : null
        if ((currentWorkspace && currentWorkspace.id !== snapshot.id)
          || (!currentWorkspace && ownerId && ownerId !== snapshot.id)) {
          throw new WorkspaceStorageConflictError()
        }
        const currentIsValid = currentWorkspace !== null
        const backupIsValid = backup !== undefined && restoreLocalWorkspace(backup) !== null
        const nextBackup = currentIsValid
          ? current
          : backupIsValid
            ? backup
            : snapshot
        const backupWrite = store.put(nextBackup, backupKey)
        const currentWrite = store.put(snapshot, workspaceKey)
        const nextRevision = storedRevision(revisionValue) + 1
        const revisionWrite = store.put(nextRevision, revisionKey)
        const ownerWrite = store.put(snapshot.id, ownerKey)
        return Promise.all([
          requestResult(backupWrite),
          requestResult(currentWrite),
          requestResult(revisionWrite),
          requestResult(ownerWrite),
        ]).then(() => nextRevision)
      })

    const [revision] = await Promise.all([writes, complete])
    return revision
  } finally {
    database.close()
  }
}

function sameStoredVersion(actual: unknown, actualOwner: unknown, expected: WorkspaceStorageVersion): boolean {
  const ownerId = typeof actualOwner === 'string' ? actualOwner : null
  if (ownerId !== expected.ownerId) return false
  if (expected.recordStatus === 'empty') return actual === undefined
  if (expected.recordStatus === 'damaged') {
    return actual !== undefined && storedFingerprint(actual) === expected.fingerprint
      && restoreLocalWorkspace(actual) === null
  }
  if (actual === undefined || !expected.workspace) return false
  const restored = restoreLocalWorkspace(actual)
  return restored !== null && JSON.stringify(restored) === JSON.stringify(expected.workspace)
}

/** Commits a complete restore atomically after exact same-transaction comparison of the reviewed current record. */
export async function replaceWorkspaceFromBackup(
  workspace: LocalWorkspace,
  expected: WorkspaceStorageVersion,
  displacedWorkspace: LocalWorkspace | null,
): Promise<number> {
  const snapshot = createWorkspaceSnapshot(workspace)
  const displaced = displacedWorkspace ? createWorkspaceSnapshot(displacedWorkspace) : null
  const database = await openDatabase()
  let complete: Promise<void> | null = null

  try {
    const transaction = database.transaction(storeName, 'readwrite')
    complete = transactionComplete(transaction)
    const store = transaction.objectStore(storeName)
    const currentRequest = store.get(workspaceKey) as IDBRequest<unknown>
    const backupRequest = store.get(backupKey) as IDBRequest<unknown>
    const revisionRequest = store.get(revisionKey) as IDBRequest<unknown>
    const ownerRequest = store.get(ownerKey) as IDBRequest<unknown>
    const writes = Promise.all([
      requestResult(currentRequest),
      requestResult(backupRequest),
      requestResult(revisionRequest),
      requestResult(ownerRequest),
    ]).then(([current, backup, revisionValue, ownerValue]) => {
      const revision = storedRevision(revisionValue)
      if (revision !== expected.revision || !sameStoredVersion(current, ownerValue, expected)) {
        throw new WorkspaceStorageConflictError('The active workspace changed after this restore was reviewed. Review it again before replacing it.')
      }

      const currentWorkspace = current === undefined ? null : restoreLocalWorkspace(current)
      const backupWorkspace = backup === undefined ? null : restoreLocalWorkspace(backup)
      const nextBackup = displaced
        ?? currentWorkspace
        ?? backupWorkspace
        ?? snapshot
      const backupWrite = store.put(nextBackup, backupKey)
      const currentWrite = store.put(snapshot, workspaceKey)
      const nextRevision = revision + 1
      const revisionWrite = store.put(nextRevision, revisionKey)
      const ownerWrite = store.put(snapshot.id, ownerKey)
      return Promise.all([
        requestResult(backupWrite),
        requestResult(currentWrite),
        requestResult(revisionWrite),
        requestResult(ownerWrite),
      ]).then(() => nextRevision)
    })

    const [revision] = await Promise.all([writes, complete])
    return revision
  } catch (error) {
    await complete?.catch(() => undefined)
    throw error
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
  const restored = await restoreWorkspaceBackupState()
  return restored?.workspace ?? null
}

/** Restores last-valid using an optional observed-version CAS and returns the exact written revision. */
export async function restoreWorkspaceBackupState(
  expected?: WorkspaceStorageVersion | null,
): Promise<WorkspaceStorageVersion | null> {
  const database = await openDatabase()

  try {
    const transaction = database.transaction(storeName, 'readwrite')
    const complete = transactionComplete(transaction)
    const store = transaction.objectStore(storeName)
    const currentRequest = store.get(workspaceKey) as IDBRequest<unknown>
    const request = store.get(backupKey) as IDBRequest<unknown>
    const revisionRequest = store.get(revisionKey) as IDBRequest<unknown>
    const ownerRequest = store.get(ownerKey) as IDBRequest<unknown>

    try {
      const [current, stored, revisionValue, ownerValue] = await Promise.all([
        requestResult(currentRequest),
        requestResult(request),
        requestResult(revisionRequest),
        requestResult(ownerRequest),
      ])
      const revision = storedRevision(revisionValue)
      if (expected && (revision !== expected.revision || !sameStoredVersion(current, ownerValue, expected))) {
        throw new WorkspaceStorageConflictError('The local workspace changed before its backup could be restored. Reload and review the latest local state.')
      }
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
      const nextRevision = revision + 1
      const revisionWrite = store.put(nextRevision, revisionKey)
      const ownerWrite = store.put(workspace.id, ownerKey)
      await Promise.all([requestResult(write), requestResult(revisionWrite), requestResult(ownerWrite), complete])
      return {
        workspace,
        revision: nextRevision,
        recordStatus: 'valid',
        fingerprint: null,
        ownerId: workspace.id,
      }
    } catch (error) {
      await complete.catch(() => undefined)
      throw error
    }
  } finally {
    database.close()
  }
}
