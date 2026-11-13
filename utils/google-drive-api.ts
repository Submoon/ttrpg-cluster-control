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
  readonly httpStatus?: number

  constructor(code: GoogleDriveApiErrorCode, message: string, outcomeUncertain = false, httpStatus?: number) {
    super(message)
    this.name = 'GoogleDriveApiError'
    this.code = code
    this.outcomeUncertain = outcomeUncertain
    this.httpStatus = httpStatus
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

interface ProviderResponse {
  ok: boolean
  status: number
  headers: Headers
  bytes: Uint8Array
}

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

/** Returns the opaque Drive identity used to bind a backup attempt to one Google account. */
export async function getGoogleDrivePermissionId(
  accessToken: string,
  fetcher: DriveFetcher = fetch,
  signal?: AbortSignal,
): Promise<string> {
  const query = new URLSearchParams({ fields: 'user(permissionId)' })
  const body = await requestJson(accessToken, `${DRIVE_API}/about?${query}`, fetcher, signal)
  if (!isRecord(body)
    || !isRecord(body.user)
    || typeof body.user.permissionId !== 'string'
    || body.user.permissionId.length === 0) {
    throw new GoogleDriveApiError('request-failed', 'Google Drive did not provide a verifiable account identity.')
  }
  return body.user.permissionId
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

  let response: ProviderResponse
  try {
    response = await providerFetch(fetcher, `${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      ...(signal ? { signal } : {}),
    })
  } catch {
    throw new GoogleDriveApiError('request-failed', 'Google Drive could not be reached to read this backup.')
  }
  if (!response.ok) throw new GoogleDriveApiError('request-failed', 'Google Drive could not read this backup.', false, response.status)
  try {
    return readResponseText(response.bytes)
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

  let response: ProviderResponse
  try {
    response = contentBytes.byteLength <= MULTIPART_UPLOAD_LIMIT
      ? await uploadMultipart(options, metadata, fetcher)
      : await uploadResumable(options, metadata, contentBytes, fetcher)
  } catch (error) {
    if (options.signal?.aborted) {
      throw new GoogleDriveApiError('request-failed', 'Google Drive backup was canceled.')
    }
    if (error instanceof GoogleDriveApiError && !error.outcomeUncertain) throw error
    return reconcileUpload(options, fetcher)
  }

  if (response.ok) {
    const receipt = parseResponseJson(response.bytes)
    if (isConfirmedFile(receipt, options, contentBytes)) return toBackupFile(receipt)
    return reconcileUpload(options, fetcher)
  }

  if (options.signal?.aborted) {
    throw new GoogleDriveApiError('request-failed', 'Google Drive backup was canceled.')
  }
  if (response.status === 401) {
    throw new GoogleDriveApiError('request-failed', 'Google Drive authorization expired. Sign in again to continue.', false, 401)
  }
  const reconciliation = await tryReconcileUpload(options, fetcher, options.signal)
  if (reconciliation.kind === 'confirmed') return reconciliation.file
  if (reconciliation.kind === 'unauthorized') throw uncertainOutcome(401)
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
): Promise<ProviderResponse> {
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
): Promise<ProviderResponse> {
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
  | { kind: 'unauthorized' }
  | { kind: 'not-found' }
  | { kind: 'inconclusive' }
  | { kind: 'mismatch' }

async function reconcileUpload(
  options: Parameters<typeof uploadGoogleDriveBackup>[0],
  fetcher: DriveFetcher,
): Promise<GoogleDriveBackupFile> {
  if (options.signal?.aborted) {
    throw new GoogleDriveApiError('request-failed', 'Google Drive backup was canceled.')
  }
  const reconciliation = await tryReconcileUpload(options, fetcher, options.signal)
  if (reconciliation.kind === 'confirmed') return reconciliation.file
  if (reconciliation.kind === 'unauthorized') throw uncertainOutcome(401)
  throw uncertainOutcome()
}

async function tryReconcileUpload(
  options: Parameters<typeof uploadGoogleDriveBackup>[0],
  fetcher: DriveFetcher,
  signal?: AbortSignal,
): Promise<UploadReconciliation> {
  const { accessToken, fileId, filename, contents } = options
  if (signal?.aborted) return { kind: 'inconclusive' }
  try {
    const response = await providerFetch(fetcher,
      `${DRIVE_API}/files/${encodeURIComponent(fileId)}?${new URLSearchParams({
        fields: 'id,name,mimeType,parents,spaces,size,createdTime,trashed,md5Checksum,sha256Checksum',
      })}`,
      { headers: { Authorization: `Bearer ${accessToken}` }, ...(signal ? { signal } : {}) },
    )
    if (signal?.aborted) return { kind: 'inconclusive' }
    if (response.status === 404) return { kind: 'not-found' }
    if (response.status === 401) return { kind: 'unauthorized' }
    if (!response.ok) return { kind: 'inconclusive' }

    const metadata = parseResponseJson(response.bytes)
    if (!isConfirmedMetadata(metadata, fileId, filename, contents)) return { kind: 'mismatch' }

    const mediaResponse = await providerFetch(fetcher, `${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      ...(signal ? { signal } : {}),
    })
    if (signal?.aborted) return { kind: 'inconclusive' }
    if (mediaResponse.status === 401) return { kind: 'unauthorized' }
    if (!mediaResponse.ok) return { kind: 'inconclusive' }
    const savedBytes = mediaResponse.bytes
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
  let response: ProviderResponse
  try {
    response = await providerFetch(fetcher, url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      ...(signal ? { signal } : {}),
    })
  } catch {
    throw new GoogleDriveApiError('request-failed', 'Google Drive could not be reached. Check your connection and try again.')
  }
  if (!response.ok) throw new GoogleDriveApiError('request-failed', 'Google Drive could not complete this request.', false, response.status)

  const body = parseResponseJson(response.bytes)
  if (body === undefined) throw new GoogleDriveApiError('request-failed', 'Google Drive returned an invalid response.')
  return body
}

function parseResponseJson(bytes: Uint8Array): unknown {
  if (bytes.byteLength === 0) return undefined
  try {
    return JSON.parse(readResponseText(bytes)) as unknown
  } catch {
    return undefined
  }
}

function readResponseText(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes)
}

async function providerFetch(
  fetcher: DriveFetcher,
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<ProviderResponse> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const controller = new AbortController()
  const callerSignal = init?.signal
  let timedOut = false
  let rejectCallerAbort: ((reason: Error) => void) | undefined
  const callerAbort = new Promise<never>((_resolve, reject) => {
    rejectCallerAbort = reject
  })
  const onCallerAbort = () => {
    controller.abort()
    rejectCallerAbort?.(createAbortError())
  }
  if (callerSignal?.aborted) throw createAbortError()
  callerSignal?.addEventListener('abort', onCallerAbort, { once: true })

  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      timedOut = true
      controller.abort()
      reject(new Error('Google Drive request timed out.'))
    }, DRIVE_REQUEST_TIMEOUT_MS)
  })

  const operation = async (): Promise<ProviderResponse> => {
    const response = await fetcher(input, { ...init, signal: controller.signal })
    if (controller.signal.aborted) {
      void response.body?.cancel().catch(() => undefined)
      throw createAbortError()
    }
    if (response.status === 401) {
      // Authentication is decided from headers; don't let an irrelevant error body hide expiry.
      void response.body?.cancel().catch(() => undefined)
      return { ok: false, status: response.status, headers: response.headers, bytes: new Uint8Array() }
    }
    const bytes = await readResponseBytes(response, controller.signal)
    return { ok: response.ok, status: response.status, headers: response.headers, bytes }
  }

  try {
    return await Promise.race([operation(), deadline, callerAbort])
  } catch (error) {
    if (timedOut) throw new Error('Google Drive request timed out.', { cause: error })
    if (callerSignal?.aborted) throw createAbortError()
    throw error
  } finally {
    if (timer !== undefined) clearTimeout(timer)
    callerSignal?.removeEventListener('abort', onCallerAbort)
  }
}

async function readResponseBytes(response: Response, signal: AbortSignal): Promise<Uint8Array> {
  if (!response.body) return new Uint8Array()
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let totalLength = 0
  let rejectAbort: ((reason: Error) => void) | undefined
  const abort = new Promise<never>((_resolve, reject) => {
    rejectAbort = reject
  })
  const onAbort = () => {
    rejectAbort?.(createAbortError())
    void reader.cancel().catch(() => undefined)
  }
  if (signal.aborted) onAbort()
  else signal.addEventListener('abort', onAbort, { once: true })

  const readStream = async (): Promise<Uint8Array> => {
    while (true) {
      const result = await reader.read()
      if (result.done) break
      chunks.push(result.value)
      totalLength += result.value.byteLength
    }

    const bytes = new Uint8Array(totalLength)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    }
    return bytes
  }

  try {
    return await Promise.race([readStream(), abort])
  } finally {
    signal.removeEventListener('abort', onAbort)
    try {
      reader.releaseLock()
    } catch {
      // A pending read may still be unwinding after its cancellation race settles.
    }
  }
}

function createAbortError(): Error {
  const error = new Error('The Google Drive request was canceled.')
  error.name = 'AbortError'
  return error
}

function uncertainOutcome(httpStatus?: number): GoogleDriveApiError {
  return new GoogleDriveApiError(
    'outcome-uncertain',
    'Google Drive did not confirm whether the backup finished. Retry this same backup to check its saved file.',
    true,
    httpStatus,
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
