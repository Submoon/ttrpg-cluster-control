import { exportJumpCluster } from '../domain/workspace'
import type { LocalWorkspace } from '../domain/workspace'
import { exportFileName } from './browser-download'

const DROPBOX_FILENAME_MAX_BYTES = 255

export const DROPBOX_BACKUP_LIMIT = 10

export interface DropboxBackupSnapshot {
  filename: string
  path: string
  contents: string
}

/** Captures the complete applied workspace synchronously for one immutable Dropbox backup attempt. */
export function createDropboxBackupSnapshot(
  workspace: LocalWorkspace,
  capturedAt = new Date(),
  backupId = createDropboxBackupId(),
): DropboxBackupSnapshot {
  if (!/^[a-f\d]{32}$/i.test(backupId)) {
    throw new Error('Dropbox backup identity must be 32 hexadecimal characters.')
  }

  const date = capturedAt.toISOString().replace('T', '-').replaceAll(':', '-').replace('.', '-')
  const baseName = exportFileName(workspace.cluster.name, 'jump-cluster').replace(/\.json$/, '')
  const suffix = `-${date}-${backupId}.json`
  const prefixBudget = DROPBOX_FILENAME_MAX_BYTES - utf8Length(suffix)
  if (prefixBudget < 1) throw new Error('Dropbox backup identity leaves no room for a filename.')
  const prefix = truncateUtf8(baseName, prefixBudget).replace(/\s+$/u, '') || 'map'
  const contents = JSON.stringify(exportJumpCluster(workspace))
  if (!contents) throw new Error('The Jump Cluster could not be serialized for backup.')

  const filename = `${prefix}${suffix}`
  return { filename, path: `/${filename}`, contents }
}

/** Generates a cryptographically random suffix so same-millisecond backup actions remain distinct. */
export function createDropboxBackupId(): string {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('A secure browser context is required to create a Dropbox backup.')
  }
  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

/** True only for names produced by the dated backup format, including a real UTC capture date. */
export function isDropboxDatedBackupName(name: string): boolean {
  return getDropboxBackupCapturedAt(name) !== undefined
}

/** Returns the UTC capture time embedded in a generated backup name. */
export function getDropboxBackupCapturedAt(name: string): number | undefined {
  const match = /^[^/\\]+-(\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}-\d{3}Z)-([a-f\d]{32})\.json$/i.exec(name)
  if (!match?.[1]) return undefined
  const timestamp = match[1]
  const isoTimestamp = `${timestamp.slice(0, 10)}T${timestamp.slice(11, 19).replaceAll('-', ':')}.${timestamp.slice(20, 23)}Z`
  const parsedTimestamp = new Date(isoTimestamp)
  return Number.isFinite(parsedTimestamp.getTime()) && parsedTimestamp.toISOString() === isoTimestamp
    ? parsedTimestamp.getTime()
    : undefined
}

function truncateUtf8(value: string, maxBytes: number): string {
  let result = ''
  let usedBytes = 0
  for (const character of value) {
    const length = utf8Length(character)
    if (usedBytes + length > maxBytes) break
    result += character
    usedBytes += length
  }
  return result
}

function utf8Length(value: string): number {
  return new TextEncoder().encode(value).byteLength
}
