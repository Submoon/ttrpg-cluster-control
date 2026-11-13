/** Direct browser-to-Drive operations for the application's hidden app-data space. */

const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'
const APP_DATA_SPACE = 'appDataFolder'
const JSON_MIME_TYPE = 'application/json'
const MULTIPART_UPLOAD_LIMIT = 5 * 1024 * 1024
const DRIVE_REQUEST_TIMEOUT_MS = 60_000

export type GoogleDriveApiErrorCode = 'request-failed' | 'outcome-uncertain'

/** A provider failure with safe feedback; uncertain creates retain their generated ID for retry. */
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

export interface GoogleDriveBackupFile {
  id: string
  name: string
  createdTime: string
}

export interface GoogleDriveBackupList {
  files: GoogleDriveBackupFile[]
  nextPageToken?: string
}

export type DriveFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

/** Reserves a stable ID in the hidden app-data space for one logical backup. */
export async function generateGoogleDriveFileId(
  accessToken: string,
  fetcher: DriveFetcher = fetch,
  signal?: AbortSignal,
): Promise<string> {
  const query = new URLSearchParams({ count: '1', space: APP_DATA_SPACE, fields: 'ids,space' })
  const body = await requestJson(accessToken, `${DRIVE_API}/files/generateIds?${query}`, fetcher, signal)
  if (!isRecord(body)
    || body.space !== APP_DATA_SPACE
    || !Array.isArray(body.ids)
    || typeof body.ids[0] !== 'string'
    || body.ids[0].length === 0) {
    throw new GoogleDriveApiError('request-failed', 'Google Drive did not provide a usable app-data file ID.')
  }
  return body.ids[0]
}

/** Lists only JSON files whose provider metadata confirms appDataFolder membership. */
export async function listGoogleDriveBackups(
  accessToken: string,
  pageToken?: string,
  fetcher: DriveFetcher = fetch,
  signal?: AbortSignal,
): Promise<GoogleDriveBackupList> {
  const query = new URLSearchParams({
    spaces: APP_DATA_SPACE,
    q: 'trashed = false',
    pageSize: '100',
    orderBy: 'createdTime desc',
    fields: 'nextPageToken,files(id,name,createdTime,mimeType,spaces,trashed)',
  })
  if (pageToken) query.set('pageToken', pageToken)

  const body = await requestJson(accessToken, `${DRIVE_API}/files?${query}`, fetcher, signal)
  if (!isRecord(body) || (body.files !== undefined && !Array.isArray(body.files))) {
    throw new GoogleDriveApiError('request-failed', 'Google Drive returned an invalid backup list.')
  }

  const files = (body.files ?? []).flatMap((entry): GoogleDriveBackupFile[] => {
    if (!isAppDataJsonFile(entry)) return []
    return [{ id: entry.id, name: entry.name, createdTime: entry.createdTime }]
  })
  if (body.nextPageToken !== undefined
    && (typeof body.nextPageToken !== 'string' || body.nextPageToken.length === 0)) {
    throw new GoogleDriveApiError('request-failed', 'Google Drive returned an invalid backup list page.')
  }

  return {
    files,
    ...(typeof body.nextPageToken === 'string' ? { nextPageToken: body.nextPageToken } : {}),
  }
}

/** Reads a selected file only after its metadata confirms JSON content in appDataFolder. */
export async function readGoogleDriveFile(
  accessToken: string,
  fileId: string,
  fetcher: DriveFetcher = fetch,
  signal?: AbortSignal,
): Promise<string> {
  const metadata = await requestJson(accessToken, `${DRIVE_API}/files/${encodeURIComponent(fileId)}?${new URLSearchParams({
    fields: 'id,name,mimeType,spaces,trashed',
  })}`, fetcher, signal)
  if (!isRecord(metadata)
    || metadata.id !== fileId
    || metadata.mimeType !== JSON_MIME_TYPE
    || !isAppDataSpace(metadata.spaces)
    || !isNotTrashed(metadata.trashed)) {
    throw new GoogleDriveApiError('request-failed', 'The selected file is not an available JSON backup in Google Drive app data.')
  }

  let response: Response
  try {
    response = await providerFetch(fetcher, `${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      ...(signal ? { signal } : {}),
    })
  } catch {
    throw new GoogleDriveApiError('request-failed', 'Google Drive could not be reached to read this backup.')
  }
  if (!response.ok) throw new GoogleDriveApiError('request-failed', 'Google Drive could not read this backup.')
  try {
    return await readResponseText(response)
  } catch {
    throw new GoogleDriveApiError('request-failed', 'Google Drive took too long to read this backup.')
  }
}

/**
 * Creates one dated JSON file with a caller-retained ID. On an ambiguous write, reconciliation
 * checks that exact ID, validates its app-data space, and compares the saved bytes before success.
 */
export async function uploadGoogleDriveBackup(options: {
  accessToken: string
  fileId: string
  filename: string
  contents: string
  fetcher?: DriveFetcher
  signal?: AbortSignal
}): Promise<GoogleDriveBackupFile> {
  const fetcher = options.fetcher ?? fetch
  const metadata = JSON.stringify({
    id: options.fileId,
    name: options.filename,
    mimeType: JSON_MIME_TYPE,
    parents: [APP_DATA_SPACE],
  })
  const contentBytes = new TextEncoder().encode(options.contents)

  let response: Response
  try {
    response = contentBytes.byteLength <= MULTIPART_UPLOAD_LIMIT
      ? await uploadMultipart(options, metadata, fetcher)
      : await uploadResumable(options, metadata, contentBytes, fetcher)
  } catch (error) {
    if (error instanceof GoogleDriveApiError && !error.outcomeUncertain) throw error
    return reconcileUpload(options, fetcher)
  }

  if (response.ok) {
    const receipt = await readJson(response)
    if (isConfirmedFile(receipt, options, contentBytes)) return toBackupFile(receipt)
    return reconcileUpload(options, fetcher)
  }

  const reconciliation = await tryReconcileUpload(options, fetcher)
  if (reconciliation.kind === 'confirmed') return reconciliation.file
  if (response.status === 409
    || response.status >= 500
    || response.status === 408
    || response.status === 429
    || reconciliation.kind !== 'not-found') {
    throw uncertainOutcome()
  }

  throw new GoogleDriveApiError(
    'request-failed',
    'Google Drive rejected the backup. Your local map and earlier backups are unchanged.',
  )
}

async function uploadMultipart(
  options: Parameters<typeof uploadGoogleDriveBackup>[0],
  metadata: string,
  fetcher: DriveFetcher,
): Promise<Response> {
  const boundary = `cluster-control-${createBoundarySuffix()}`
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    metadata,
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    options.contents,
    `--${boundary}--`,
    '',
  ].join('\r\n')

  return providerFetch(fetcher, `${DRIVE_UPLOAD_API}/files?${createUploadQuery('multipart')}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
    ...(options.signal ? { signal: options.signal } : {}),
  })
}

async function uploadResumable(
  options: Parameters<typeof uploadGoogleDriveBackup>[0],
  metadata: string,
  contentBytes: Uint8Array,
  fetcher: DriveFetcher,
): Promise<Response> {
  const sessionResponse = await providerFetch(fetcher, `${DRIVE_UPLOAD_API}/files?${createUploadQuery('resumable')}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': JSON_MIME_TYPE,
      'X-Upload-Content-Length': String(contentBytes.byteLength),
    },
    body: metadata,
    ...(options.signal ? { signal: options.signal } : {}),
  })
  if (!sessionResponse.ok) return sessionResponse

  const location = sessionResponse.headers.get('Location')
  if (!location || !isTrustedDriveUploadLocation(location)) throw uncertainOutcome()

  return providerFetch(fetcher, location, {
    method: 'PUT',
    headers: { 'Content-Type': `${JSON_MIME_TYPE}; charset=UTF-8` },
    body: options.contents,
    ...(options.signal ? { signal: options.signal } : {}),
  })
}

function createUploadQuery(uploadType: 'multipart' | 'resumable'): string {
  return new URLSearchParams({
    uploadType,
    fields: 'id,name,mimeType,parents,spaces,size,createdTime,trashed,md5Checksum,sha256Checksum',
  }).toString()
}

function isTrustedDriveUploadLocation(location: string): boolean {
  try {
    const url = new URL(location)
    return url.protocol === 'https:'
      && url.origin === 'https://www.googleapis.com'
      && !url.username
      && !url.password
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

async function reconcileUpload(
  options: Parameters<typeof uploadGoogleDriveBackup>[0],
  fetcher: DriveFetcher,
): Promise<GoogleDriveBackupFile> {
  const reconciliation = await tryReconcileUpload(options, fetcher)
  if (reconciliation.kind === 'confirmed') return reconciliation.file
  throw uncertainOutcome()
}

async function tryReconcileUpload(
  options: Parameters<typeof uploadGoogleDriveBackup>[0],
  fetcher: DriveFetcher,
): Promise<UploadReconciliation> {
  const { accessToken, fileId, filename, contents } = options
  try {
    const response = await providerFetch(fetcher,
      `${DRIVE_API}/files/${encodeURIComponent(fileId)}?${new URLSearchParams({
        fields: 'id,name,mimeType,parents,spaces,size,createdTime,trashed,md5Checksum,sha256Checksum',
      })}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    if (response.status === 404) return { kind: 'not-found' }
    if (!response.ok) return { kind: 'inconclusive' }

    const metadata = await readJson(response)
    if (!isConfirmedMetadata(metadata, fileId, filename, contents)) return { kind: 'mismatch' }

    const mediaResponse = await providerFetch(fetcher, `${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!mediaResponse.ok) return { kind: 'inconclusive' }
    const savedBytes = new Uint8Array(await readResponseBytes(mediaResponse))
    const expectedBytes = new TextEncoder().encode(contents)
    if (!sameBytes(savedBytes, expectedBytes)) return { kind: 'mismatch' }
    return { kind: 'confirmed', file: toBackupFile(metadata as Record<string, unknown>) }
  } catch {
    return { kind: 'inconclusive' }
  }
}

function isConfirmedFile(
  value: unknown,
  options: Parameters<typeof uploadGoogleDriveBackup>[0],
  contentBytes: Uint8Array,
): value is Record<string, unknown> {
  return isConfirmedMetadata(value, options.fileId, options.filename, contentBytes)
}

function isConfirmedMetadata(
  value: unknown,
  fileId: string,
  filename: string,
  contents: string | Uint8Array,
): value is Record<string, unknown> {
  if (!isRecord(value)) return false
  const expectedSize = typeof contents === 'string' ? new TextEncoder().encode(contents).byteLength : contents.byteLength
  return value.id === fileId
    && value.name === filename
    && value.mimeType === JSON_MIME_TYPE
    && isAppDataSpace(value.spaces)
    && value.size === String(expectedSize)
    && isValidDate(value.createdTime)
    && isNotTrashed(value.trashed)
}

function toBackupFile(value: Record<string, unknown>): GoogleDriveBackupFile {
  return {
    id: value.id as string,
    name: value.name as string,
    createdTime: value.createdTime as string,
  }
}

function isAppDataJsonFile(value: unknown): value is Record<string, unknown> & GoogleDriveBackupFile {
  return isRecord(value)
    && typeof value.id === 'string'
    && value.id.length > 0
    && typeof value.name === 'string'
    && value.name.toLocaleLowerCase().endsWith('.json')
    && isValidDate(value.createdTime)
    && value.mimeType === JSON_MIME_TYPE
    && isAppDataSpace(value.spaces)
    && isNotTrashed(value.trashed)
}

function isAppDataSpace(value: unknown): boolean {
  return Array.isArray(value) && value.includes(APP_DATA_SPACE)
}

function isNotTrashed(value: unknown): boolean {
  // Google may omit protobuf default false values; true and malformed flags still fail closed.
  return value === undefined || value === false
}

function isValidDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

async function requestJson(
  accessToken: string,
  url: string,
  fetcher: DriveFetcher,
  signal?: AbortSignal,
): Promise<unknown> {
  let response: Response
  try {
    response = await providerFetch(fetcher, url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      ...(signal ? { signal } : {}),
    })
  } catch {
    throw new GoogleDriveApiError('request-failed', 'Google Drive could not be reached. Check your connection and try again.')
  }
  if (!response.ok) throw new GoogleDriveApiError('request-failed', 'Google Drive could not complete this request.')

  const body = await readJson(response)
  if (body === undefined) throw new GoogleDriveApiError('request-failed', 'Google Drive returned an invalid response.')
  return body
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await withResponseBodyDeadline(response, () => response.json() as Promise<unknown>)
  } catch {
    return undefined
  }
}

async function readResponseText(response: Response): Promise<string> {
  return withResponseBodyDeadline(response, () => response.text())
}

async function readResponseBytes(response: Response): Promise<ArrayBuffer> {
  return withResponseBodyDeadline(response, () => response.arrayBuffer())
}

async function withResponseBodyDeadline<T>(response: Response, read: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      void response.body?.cancel().catch(() => undefined)
      reject(new Error('Google Drive response timed out.'))
    }, DRIVE_REQUEST_TIMEOUT_MS)
  })
  try {
    return await Promise.race([read(), deadline])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

async function providerFetch(fetcher: DriveFetcher, input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  let timedOut = false
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      timedOut = true
      controller.abort()
      reject(new Error('Google Drive request timed out.'))
    }, DRIVE_REQUEST_TIMEOUT_MS)
  })
  const callerSignal = init?.signal
  const relayCallerAbort = () => controller.abort()
  if (callerSignal?.aborted) controller.abort()
  else callerSignal?.addEventListener('abort', relayCallerAbort, { once: true })

  try {
    return await Promise.race([fetcher(input, { ...init, signal: controller.signal }), deadline])
  } catch (error) {
    if (timedOut) throw new Error('Google Drive request timed out.', { cause: error })
    throw error
  } finally {
    if (timer !== undefined) clearTimeout(timer)
    callerSignal?.removeEventListener('abort', relayCallerAbort)
  }
}

function uncertainOutcome(): GoogleDriveApiError {
  return new GoogleDriveApiError(
    'outcome-uncertain',
    'Google Drive did not confirm whether the backup finished. Retry this same backup to check its saved file.',
    true,
  )
}

function createBoundarySuffix(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.byteLength === right.byteLength && left.every((value, index) => value === right[index])
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
