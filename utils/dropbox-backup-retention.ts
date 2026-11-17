import { deleteDropboxBackup, listDropboxBackups } from './dropbox-api'
import type { DropboxBackupFile, DropboxFetcher, DropboxBackupReceipt } from './dropbox-api'
import { DROPBOX_BACKUP_LIMIT, getDropboxBackupCapturedAt, isDropboxDatedBackupName } from './dropbox-backup-snapshot'

const MAX_RETENTION_DELETIONS = 1_000

export type DropboxBackupRetentionResult = 'retained' | 'removed' | 'absent'

/**
 * Removes only recognized dated root backups beyond the newest ten. Complete listings and a
 * fresh listing before each guarded deletion keep partial provider responses from authorizing
 * pruning. Every client uses the same order, including when a newly saved receipt sorts oldest.
 */
export async function pruneDropboxBackups(options: {
  accessToken: string
  receipt: DropboxBackupReceipt
  fetcher?: DropboxFetcher
  signal?: AbortSignal
  requireReceipt?: boolean
}): Promise<DropboxBackupRetentionResult> {
  const fetcher = options.fetcher ?? fetch
  const requireReceipt = options.requireReceipt ?? true
  let backups = await listDropboxBackups(options.accessToken, fetcher, options.signal)

  if (requireReceipt && !containsReceipt(backups, options.receipt)) {
    // A confirmed upload can briefly be absent from Dropbox's list. Retry a complete scan before
    // treating it as missing or authorizing any delete.
    backups = await listDropboxBackups(options.accessToken, fetcher, options.signal)
  }
  if (requireReceipt && !containsReceipt(backups, options.receipt)) {
    throw new Error('Dropbox has not listed the saved backup yet. Retry cleanup in a moment.')
  }

  let ordered = collectDatedBackups(backups)
  if (ordered.length <= DROPBOX_BACKUP_LIMIT) {
    return containsReceipt(ordered, options.receipt) ? 'retained' : 'absent'
  }

  // The list used to decide that pruning is needed may already be stale by the time a delete
  // starts. Recheck once, then re-list after every deletion before selecting another file.
  backups = await listDropboxBackups(options.accessToken, fetcher, options.signal)
  if (requireReceipt && !containsReceipt(backups, options.receipt)) {
    throw new Error('Dropbox no longer lists the saved backup. Retry cleanup to check the current files.')
  }
  ordered = collectDatedBackups(backups)
  const deletedIds = new Set<string>()
  let deletionCount = 0

  while (ordered.length > DROPBOX_BACKUP_LIMIT) {
    if (deletionCount >= MAX_RETENTION_DELETIONS) {
      throw new Error('Dropbox backup cleanup is still in progress. Retry cleanup to finish the remaining removals.')
    }
    const candidate = ordered.at(-1)
    if (!candidate) break
    if (deletedIds.has(candidate.id)) {
      throw new Error('Dropbox has not refreshed its backup list after deletion. Retry cleanup in a moment.')
    }

    await deleteDropboxBackup(options.accessToken, candidate, fetcher, options.signal)
    deletedIds.add(candidate.id)
    deletionCount += 1

    backups = await listDropboxBackups(options.accessToken, fetcher, options.signal)
    ordered = collectDatedBackups(backups)
  }

  if (containsReceipt(ordered, options.receipt)) return 'retained'
  return deletedIds.has(options.receipt.id) ? 'removed' : 'absent'
}

function collectDatedBackups(files: DropboxBackupFile[]): DropboxBackupFile[] {
  const byId = new Map<string, DropboxBackupFile>()
  const byRootPath = new Map<string, string>()
  for (const file of files) {
    if (!isDropboxDatedBackupName(file.name)) continue

    const lowerName = file.name.toLowerCase()
    const existingPathId = byRootPath.get(lowerName)
    if (existingPathId && existingPathId !== file.id) {
      throw new Error('Dropbox returned conflicting backups at the same root path. Retry cleanup after refreshing.')
    }
    byRootPath.set(lowerName, file.id)

    const existing = byId.get(file.id)
    if (existing) {
      if (!sameDropboxBackup(existing, file)) {
        throw new Error('Dropbox returned conflicting backup metadata. Retry cleanup after refreshing.')
      }
      continue
    }
    byId.set(file.id, file)
  }

  return [...byId.values()].sort(compareBackups)
}

function containsReceipt(files: DropboxBackupFile[], receipt: DropboxBackupReceipt): boolean {
  return files.some(file => file.id === receipt.id
    && file.name === receipt.name
    && `/${file.name}` === receipt.path
    && isDropboxDatedBackupName(file.name))
}

function sameDropboxBackup(left: DropboxBackupFile, right: DropboxBackupFile): boolean {
  return left.id === right.id
    && left.name === right.name
    && left.rev === right.rev
    && left.serverModified === right.serverModified
    && left.size === right.size
}

/** Newest first: provider time, embedded capture time for second-resolution ties, then ID. */
function compareBackups(left: DropboxBackupFile, right: DropboxBackupFile): number {
  const modifiedDifference = Date.parse(right.serverModified) - Date.parse(left.serverModified)
  if (modifiedDifference) return modifiedDifference
  const captureDifference = (getDropboxBackupCapturedAt(right.name) ?? 0) - (getDropboxBackupCapturedAt(left.name) ?? 0)
  if (captureDifference) return captureDifference
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0
}
