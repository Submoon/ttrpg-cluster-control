import {
  deleteGoogleDriveBackup,
  isGoogleDriveBackupName,
  listGoogleDriveBackups,
} from './google-drive-api'
import type { DriveFetcher, GoogleDriveBackupFile } from './google-drive-api'
import { GOOGLE_DRIVE_BACKUP_LIMIT } from './google-drive-backup-snapshot'

const MAX_RETENTION_PAGES = 1000
const MAX_RETENTION_DELETIONS = 1000

export type GoogleDriveBackupRetentionResult = 'retained' | 'removed' | 'absent'

/**
 * Deletes only backups that are older than at least ten distinct, fully listed backups.
 * A new upload must be visible in the first complete listing before its initial pruning pass;
 * retries use the latest complete listing as authority if the saved file was removed meanwhile.
 */
export async function pruneGoogleDriveBackups(options: {
  accessToken: string
  receipt: GoogleDriveBackupFile
  fetcher?: DriveFetcher
  signal?: AbortSignal
  requireReceipt?: boolean
}): Promise<GoogleDriveBackupRetentionResult> {
  const fetcher = options.fetcher ?? fetch
  const requireReceipt = options.requireReceipt ?? true
  const firstSnapshot = await listAllBackups(options.accessToken, fetcher, options.signal)
  let backups = firstSnapshot

  if (requireReceipt && !containsReceipt(firstSnapshot, options.receipt)) {
    // Drive listings can briefly lag a confirmed upload. A single fresh full scan avoids deleting
    // from a view that cannot yet account for the file this cleanup is intended to retain.
    backups = await listAllBackups(options.accessToken, fetcher, options.signal)
  }

  if (requireReceipt && !containsReceipt(backups, options.receipt)) {
    throw new Error('Google Drive has not listed the saved backup yet. Retry cleanup in a moment.')
  }

  let ordered = collectDatedBackups(backups)
  if (ordered.length <= GOOGLE_DRIVE_BACKUP_LIMIT) {
    return ordered.some(file => file.id === options.receipt.id) ? 'retained' : 'absent'
  }

  // Refresh before the first deletion, then re-rank after every deletion. This keeps a stale
  // initial listing from causing a cascade if the user or another tab removes a retained file.
  backups = await listAllBackups(options.accessToken, fetcher, options.signal)
  if (requireReceipt && !containsReceipt(backups, options.receipt)) {
    throw new Error('Google Drive no longer lists the saved backup. Retry cleanup to check the current backups.')
  }
  ordered = collectDatedBackups(backups)
  const deletedIds = new Set<string>()
  let deletionCount = 0

  while (ordered.length > GOOGLE_DRIVE_BACKUP_LIMIT) {
    if (deletionCount >= MAX_RETENTION_DELETIONS) {
      throw new Error('Google Drive backup cleanup is still in progress. Retry cleanup to finish the remaining removals.')
    }
    const overflow = ordered.slice(GOOGLE_DRIVE_BACKUP_LIMIT)
    if (overflow.some(file => file.canDelete === false)) {
      throw new Error('Google Drive does not allow deleting every older backup needed to enforce the ten-backup limit.')
    }
    const candidate = ordered.at(-1)
    if (!candidate) break
    if (deletedIds.has(candidate.id)) {
      throw new Error('Google Drive has not refreshed its backup list after deletion. Retry cleanup in a moment.')
    }
    await deleteGoogleDriveBackup(options.accessToken, candidate, fetcher, options.signal)
    deletedIds.add(candidate.id)
    deletionCount += 1

    backups = await listAllBackups(options.accessToken, fetcher, options.signal)
    ordered = collectDatedBackups(backups)
  }

  if (ordered.some(file => file.id === options.receipt.id)) return 'retained'
  return deletedIds.has(options.receipt.id) ? 'removed' : 'absent'
}

async function listAllBackups(
  accessToken: string,
  fetcher: DriveFetcher,
  signal?: AbortSignal,
): Promise<GoogleDriveBackupFile[]> {
  const files: GoogleDriveBackupFile[] = []
  const seenPageTokens = new Set<string>()
  let pageToken: string | undefined

  for (let pageNumber = 0; pageNumber < MAX_RETENTION_PAGES; pageNumber += 1) {
    const page = await listGoogleDriveBackups(accessToken, pageToken, fetcher, signal, true)
    files.push(...page.files)

    const nextPageToken = page.nextPageToken
    if (nextPageToken === undefined) return files
    if (seenPageTokens.has(nextPageToken)) {
      throw new Error('Google Drive repeated a backup list page. Retry cleanup after refreshing.')
    }
    seenPageTokens.add(nextPageToken)
    pageToken = nextPageToken
  }

  throw new Error('Google Drive returned too many backup list pages. Retry cleanup after refreshing.')
}

function collectDatedBackups(files: GoogleDriveBackupFile[]): GoogleDriveBackupFile[] {
  const byId = new Map<string, GoogleDriveBackupFile>()
  for (const file of files) {
    if (!isValidListedFile(file)) {
      throw new Error('Google Drive returned incomplete backup metadata. Retry cleanup after refreshing.')
    }
    if (!isGoogleDriveBackupName(file.name)) continue

    const existing = byId.get(file.id)
    if (existing) {
      if (existing.name !== file.name || existing.createdTime !== file.createdTime) {
        throw new Error('Google Drive returned conflicting backup metadata. Retry cleanup after refreshing.')
      }
      continue
    }
    byId.set(file.id, file)
  }

  return [...byId.values()].sort(compareBackups)
}

function isValidListedFile(value: unknown): value is GoogleDriveBackupFile {
  if (!value || typeof value !== 'object') return false
  const file = value as Partial<GoogleDriveBackupFile>
  return typeof file.id === 'string'
    && file.id.length > 0
    && typeof file.name === 'string'
    && file.name.length > 0
    && typeof file.createdTime === 'string'
    && Number.isFinite(Date.parse(file.createdTime))
    && (file.canDelete === undefined || typeof file.canDelete === 'boolean')
}

function containsReceipt(files: GoogleDriveBackupFile[], receipt: GoogleDriveBackupFile): boolean {
  const listed = files.find(file => file.id === receipt.id)
  return listed !== undefined
    && listed.name === receipt.name
    && listed.createdTime === receipt.createdTime
    && isGoogleDriveBackupName(listed.name)
}

/** Newest first, with a stable ID tie break independent of provider page ordering. */
function compareBackups(left: GoogleDriveBackupFile, right: GoogleDriveBackupFile): number {
  const dateDifference = Date.parse(right.createdTime) - Date.parse(left.createdTime)
  if (dateDifference) return dateDifference
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0
}
