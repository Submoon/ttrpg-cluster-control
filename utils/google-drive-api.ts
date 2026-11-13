/** Direct browser-to-Drive API operations used by cloud backup and restore. */

const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'
const JSON_MIME_TYPE = 'application/json'
const GOOGLE_FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder'
const MULTIPART_UPLOAD_LIMIT = 5 * 1024 * 1024

export type GoogleDriveApiErrorCode =
  | 'private-folder-required'
  | 'folder-not-writable'
  | 'request-failed'
  | 'outcome-uncertain'

/** A provider failure safe to show to a user; `outcomeUncertain` preserves an upload identity for retry. */
export class GoogleDriveApiError extends Error {
  readonly code: GoogleDriveApiErrorCode
  readonly outcomeUncertain: boolean

  constructor(code: GoogleDriveApiErrorCode, message: string, outcomeUncertain = false) {
    super(message)
    this.name = 'GoogleDriveApiError'
    this.code = code
    this.outcomeUncertain = outcomeUncertain
  }
}

export interface GoogleDriveFolder {
  id: string
  name: string
}

export interface GoogleDriveBackupFile {
  id: string
  name: string
  folderId: string
  folderName: string
  webViewLink?: string
}

export type DriveFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

/**
 * Confirms a selected folder is writable, in My Drive, and has a complete owner-only ACL.
 * Missing provider fields, pagination gaps, inherited permissions, and every extra principal fail closed.
 */
export async function verifyPrivateGoogleDriveFolder(
  accessToken: string,
  folderId: string,
  fetcher: DriveFetcher = fetch,
): Promise<GoogleDriveFolder> {
  const file = await requestJson(
    accessToken,
    `${DRIVE_API}/files/${encodeURIComponent(folderId)}?${new URLSearchParams({
      fields: 'id,name,mimeType,ownedByMe,shared,driveId,trashed,capabilities(canAddChildren)',
      supportsAllDrives: 'true',
    })}`,
    fetcher,
  )

  if (!isRecord(file)
    || file.id !== folderId
    || typeof file.name !== 'string'
    || file.mimeType !== GOOGLE_FOLDER_MIME_TYPE
    || file.ownedByMe !== true
    || file.shared !== false
    || file.driveId !== undefined
    || file.trashed !== false) {
    throw new GoogleDriveApiError(
      'private-folder-required',
      'Choose an unshared folder in My Drive. Google Drive could not verify that this folder is private.',
    )
  }

  if (!isRecord(file.capabilities) || file.capabilities.canAddChildren !== true) {
    throw new GoogleDriveApiError(
      'folder-not-writable',
      'Choose a folder where your Google account can add files.',
    )
  }

  const permissions = await listCompleteFolderPermissions(accessToken, folderId, fetcher)
  if (permissions.length !== 1
    || !isRecord(permissions[0])
    || permissions[0].type !== 'user'
    || permissions[0].role !== 'owner'
    || typeof permissions[0].id !== 'string'
    || permissions[0].id.length === 0
    || permissions[0].deleted === true
    || hasInheritedPermissionDetails(permissions[0])) {
    throw new GoogleDriveApiError(
      'private-folder-required',
      'Choose an unshared folder in My Drive. Google Drive could not verify that this folder is private.',
    )
  }

  return { id: file.id, name: file.name }
}

/** Requests a stable Drive ID once for one logical backup operation. */
export async function generateGoogleDriveFileId(
  accessToken: string,
  fetcher: DriveFetcher = fetch,
): Promise<string> {
  const body = await requestJson(
    accessToken,
    `${DRIVE_API}/files/generateIds?${new URLSearchParams({ count: '1', space: 'drive', fields: 'ids' })}`,
    fetcher,
  )

  if (!isRecord(body) || !Array.isArray(body.ids) || typeof body.ids[0] !== 'string' || body.ids[0].length === 0) {
    throw new GoogleDriveApiError('request-failed', 'Google Drive did not provide an ID for this backup.')
  }

  return body.ids[0]
}

/**
 * Creates a new JSON file with a caller-retained ID. A lost acknowledgement is reconciled by that
 * ID; callers must reuse the same ID when retrying an uncertain operation.
 */
export async function uploadGoogleDriveBackup(options: {
  accessToken: string
  folderId: string
  folderName: string
  fileId: string
  filename: string
  contents: string
  fetcher?: DriveFetcher
}): Promise<GoogleDriveBackupFile> {
  const { folderId, folderName, fileId, filename, contents } = options
  const fetcher = options.fetcher ?? fetch
  const metadata = JSON.stringify({
    id: fileId,
    name: filename,
    mimeType: JSON_MIME_TYPE,
    parents: [folderId],
  })
  const contentBytes = new TextEncoder().encode(contents)

  let response: Response
  try {
    response = contentBytes.byteLength <= MULTIPART_UPLOAD_LIMIT
      ? await uploadMultipart({ ...options, metadata }, fetcher)
      : await uploadResumable({ ...options, metadata, contentBytes }, fetcher)
  } catch {
    return reconcileUpload(options, fetcher)
  }

  if (response.ok) {
    const receipt = await readJson(response)
    if (isConfirmedFile(receipt, fileId, folderId, filename, contentBytes)) {
      return makeBackupFile(receipt, folderId, folderName)
    }

    return reconcileUpload(options, fetcher)
  }

  const reconciliation = await tryReconcileUpload(options, fetcher)
  if (reconciliation.kind === 'confirmed') return reconciliation.file

  if (response.status === 409
    || response.status >= 500
    || response.status === 408
    || response.status === 429
    || reconciliation.kind !== 'not-found') {
    throw new GoogleDriveApiError(
      'outcome-uncertain',
      'Google Drive did not confirm whether the backup finished. Retry this same backup to check its saved file.',
      true,
    )
  }

  throw new GoogleDriveApiError(
    'request-failed',
    await getResponseError(response, 'Google Drive rejected the backup. Your local map and earlier backups are unchanged.'),
  )
}

/** Reads selected Drive file bytes directly; format admission remains the restore workflow's responsibility. */
export async function readGoogleDriveFile(
  accessToken: string,
  fileId: string,
  fetcher: DriveFetcher = fetch,
): Promise<string> {
  let response: Response
  try {
    response = await fetcher(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  } catch {
    throw new GoogleDriveApiError('request-failed', 'Google Drive could not be reached to read this file.')
  }

  if (!response.ok) {
    throw new GoogleDriveApiError(
      'request-failed',
      await getResponseError(response, 'Google Drive could not read the selected file.'),
    )
  }

  return response.text()
}

async function listCompleteFolderPermissions(
  accessToken: string,
  folderId: string,
  fetcher: DriveFetcher,
): Promise<unknown[]> {
  const permissions: unknown[] = []
  let pageToken: string | undefined
  const seenPageTokens = new Set<string>()

  do {
    const query = new URLSearchParams({
      fields: 'permissions(id,type,role,emailAddress,deleted,permissionDetails(inherited,inheritedFrom,role)),nextPageToken',
      pageSize: '100',
      supportsAllDrives: 'true',
    })
    if (pageToken) query.set('pageToken', pageToken)

    const body = await requestJson(
      accessToken,
      `${DRIVE_API}/files/${encodeURIComponent(folderId)}/permissions?${query}`,
      fetcher,
    )
    if (!isRecord(body) || !Array.isArray(body.permissions)) {
      throw new GoogleDriveApiError(
        'private-folder-required',
        'Google Drive could not verify the folder permissions. Choose a different private folder.',
      )
    }
    permissions.push(...body.permissions)

    if (body.nextPageToken !== undefined) {
      if (typeof body.nextPageToken !== 'string'
        || body.nextPageToken.length === 0
        || seenPageTokens.has(body.nextPageToken)) {
        throw new GoogleDriveApiError(
          'private-folder-required',
          'Google Drive returned an incomplete folder permission list. Choose a different private folder.',
        )
      }
      seenPageTokens.add(body.nextPageToken)
      pageToken = body.nextPageToken
    } else {
      pageToken = undefined
    }
  } while (pageToken)

  return permissions
}

async function uploadMultipart(
  options: Parameters<typeof uploadGoogleDriveBackup>[0] & { metadata: string },
  fetcher: DriveFetcher,
): Promise<Response> {
  const boundary = `cluster-control-${createBoundarySuffix()}`
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    options.metadata,
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    options.contents,
    `--${boundary}--`,
    '',
  ].join('\r\n')

  return fetcher(`${DRIVE_UPLOAD_API}/files?${createUploadQuery('multipart')}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  })
}

async function uploadResumable(
  options: Parameters<typeof uploadGoogleDriveBackup>[0] & { metadata: string, contentBytes: Uint8Array },
  fetcher: DriveFetcher,
): Promise<Response> {
  const sessionResponse = await fetcher(`${DRIVE_UPLOAD_API}/files?${createUploadQuery('resumable')}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': JSON_MIME_TYPE,
      'X-Upload-Content-Length': String(options.contentBytes.byteLength),
    },
    body: options.metadata,
  })

  if (!sessionResponse.ok) return sessionResponse

  const location = sessionResponse.headers.get('Location')
  if (!location || !isTrustedDriveUploadLocation(location)) {
    throw new GoogleDriveApiError(
      'outcome-uncertain',
      'Google Drive did not provide a trusted upload address. Retry this same backup to check its saved file.',
      true,
    )
  }

  return fetcher(location, {
    method: 'PUT',
    headers: {
      'Content-Type': `${JSON_MIME_TYPE}; charset=UTF-8`,
    },
    body: options.contents,
  })
}

async function reconcileUpload(
  options: Parameters<typeof uploadGoogleDriveBackup>[0],
  fetcher: DriveFetcher,
): Promise<GoogleDriveBackupFile> {
  const reconciliation = await tryReconcileUpload(options, fetcher)
  if (reconciliation.kind === 'confirmed') return reconciliation.file
  throw new GoogleDriveApiError(
    'outcome-uncertain',
    'Google Drive did not confirm whether the backup finished. Retry this same backup to check its saved file.',
    true,
  )
}

function createUploadQuery(uploadType: 'multipart' | 'resumable'): string {
  return new URLSearchParams({
    uploadType,
    ignoreDefaultVisibility: 'true',
    supportsAllDrives: 'true',
    fields: 'id,name,mimeType,parents,size,webViewLink,trashed,md5Checksum,sha256Checksum',
  }).toString()
}

function isTrustedDriveUploadLocation(location: string): boolean {
  try {
    const url = new URL(location)
    return url.protocol === 'https:'
      && url.origin === 'https://www.googleapis.com'
      && url.pathname === '/upload/drive/v3/files'
  } catch {
    return false
  }
}

type UploadReconciliation =
  | { kind: 'confirmed', file: GoogleDriveBackupFile }
  | { kind: 'not-found' }
  | { kind: 'inconclusive' }
  | { kind: 'mismatch' }

async function tryReconcileUpload(
  options: Parameters<typeof uploadGoogleDriveBackup>[0],
  fetcher: DriveFetcher,
): Promise<UploadReconciliation> {
  const { accessToken, fileId, folderId, folderName, filename } = options
  try {
    const response = await fetcher(
      `${DRIVE_API}/files/${encodeURIComponent(fileId)}?${new URLSearchParams({
        fields: 'id,name,mimeType,parents,size,webViewLink,trashed,md5Checksum,sha256Checksum',
        supportsAllDrives: 'true',
      })}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    if (response.status === 404) return { kind: 'not-found' }
    if (!response.ok) return { kind: 'inconclusive' }

    const receipt = await readJson(response)
    if (!isConfirmedMetadata(receipt, fileId, folderId, filename, options.contents)) return { kind: 'mismatch' }

    const mediaResponse = await fetcher(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!mediaResponse.ok) return { kind: 'inconclusive' }

    const savedBytes = new Uint8Array(await mediaResponse.arrayBuffer())
    const expectedBytes = new TextEncoder().encode(options.contents)
    if (!sameBytes(savedBytes, expectedBytes)) return { kind: 'mismatch' }
    return { kind: 'confirmed', file: makeBackupFile(receipt as Record<string, unknown>, folderId, folderName) }
  } catch {
    return { kind: 'inconclusive' }
  }
}

function isConfirmedFile(
  value: unknown,
  fileId: string,
  folderId: string,
  filename: string,
  contentBytes: Uint8Array,
): value is Record<string, unknown> {
  if (!isConfirmedMetadata(value, fileId, folderId, filename, contentBytes)) return false
  // A success receipt for the exact upload request is authoritative; retries additionally read back the bytes.
  return true
}

function isConfirmedMetadata(
  value: unknown,
  fileId: string,
  folderId: string,
  filename: string,
  contents: string | Uint8Array,
): value is Record<string, unknown> {
  if (!isRecord(value)) return false
  const expectedSize = typeof contents === 'string' ? new TextEncoder().encode(contents).byteLength : contents.byteLength
  return value.id === fileId
    && value.name === filename
    && value.mimeType === JSON_MIME_TYPE
    && Array.isArray(value.parents)
    && value.parents.includes(folderId)
    && value.size === String(expectedSize)
    && value.trashed === false
}

function makeBackupFile(value: Record<string, unknown>, folderId: string, folderName: string): GoogleDriveBackupFile {
  return {
    id: value.id as string,
    name: value.name as string,
    folderId,
    folderName,
    ...(typeof value.webViewLink === 'string' ? { webViewLink: value.webViewLink } : {}),
  }
}

async function requestJson(accessToken: string, url: string, fetcher: DriveFetcher): Promise<unknown> {
  let response: Response
  try {
    response = await fetcher(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  } catch {
    throw new GoogleDriveApiError('request-failed', 'Google Drive could not be reached. Check your connection and try again.')
  }

  if (!response.ok) {
    throw new GoogleDriveApiError(
      'request-failed',
      await getResponseError(response, 'Google Drive could not verify this operation.'),
    )
  }

  return readJson(response)
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json() as unknown
  } catch {
    return undefined
  }
}

async function getResponseError(response: Response, fallback: string): Promise<string> {
  const body = await readJson(response)
  if (isRecord(body) && isRecord(body.error) && typeof body.error.message === 'string') {
    return `${fallback} ${body.error.message}`
  }
  return fallback
}

function hasInheritedPermissionDetails(permission: Record<string, unknown>): boolean {
  if (permission.permissionDetails === undefined) return false
  if (!Array.isArray(permission.permissionDetails)) return true
  return permission.permissionDetails.some(detail => !isRecord(detail)
    || detail.inherited !== false
    || detail.inheritedFrom !== undefined)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function createBoundarySuffix(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.byteLength === right.byteLength
    && left.every((value, index) => value === right[index])
}
