/** Direct browser-to-Dropbox operations for the application's App Folder. */

const API = 'https://api.dropboxapi.com/2'
const CONTENT_API = 'https://content.dropboxapi.com/2'
const REQUEST_TIMEOUT_MS = 60_000

export type DropboxApiErrorCode = 'request-failed' | 'outcome-uncertain' | 'path-conflict'

/** A Dropbox failure with safe feedback and an explicit indication of whether a create may have landed. */
export class DropboxApiError extends Error {
  readonly code: DropboxApiErrorCode
  readonly outcomeUncertain: boolean
  readonly httpStatus?: number

  constructor(code: DropboxApiErrorCode, message: string, outcomeUncertain = false, httpStatus?: number) {
    super(message)
    this.name = 'DropboxApiError'
    this.code = code
    this.outcomeUncertain = outcomeUncertain
    this.httpStatus = httpStatus
  }
}

export interface DropboxBackupReceipt {
  id: string
  name: string
  path: string
}

export type DropboxBackupReconciliation =
  | { kind: 'confirmed', receipt: DropboxBackupReceipt }
  | { kind: 'not-found' }
  | { kind: 'mismatch' }
  | { kind: 'unauthorized' }
  | { kind: 'unresolved' }

export type DropboxFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

interface ProviderResponse {
  status: number
  ok: boolean
  headers: Headers
  bytes: Uint8Array
}

/** Creates one JSON file in the registered App Folder, refusing all rename and overwrite behavior. */
export async function createDropboxBackup(options: {
  accessToken: string
  path: string
  contents: string
  fetcher?: DropboxFetcher
  signal?: AbortSignal
}): Promise<DropboxBackupReceipt> {
  validateAppFolderPath(options.path)
  if (options.signal?.aborted) throw canceledBeforeDispatch()

  let response: ProviderResponse
  try {
    response = await providerFetch(options.fetcher ?? fetch, `${CONTENT_API}/files/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.accessToken}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': createDropboxApiArg({
          path: options.path,
          mode: 'add',
          autorename: false,
          strict_conflict: true,
        }),
      },
      body: new TextEncoder().encode(options.contents),
    }, options.signal)
  } catch (error) {
    if (error instanceof DropboxApiError) throw error
    throw uncertainOutcome('Dropbox could not confirm whether the backup finished. Retry this same backup to check its saved file.')
  }

  if (response.status === 401) throw expiredAuthorizationError()
  if (response.status === 409 && isPathConflict(parseJson(response.bytes))) {
    throw new DropboxApiError(
      'path-conflict',
      'Dropbox already has a different file at this backup path. Your existing backup was left unchanged; start a new backup to choose a fresh path.',
      false,
      response.status,
    )
  }
  if (!response.ok) {
    if (isAmbiguousStatus(response.status)) {
      throw uncertainOutcome(
        'Dropbox could not confirm whether the backup finished. Retry this same backup to check its saved file.',
        response.status,
      )
    }
    throw new DropboxApiError(
      'request-failed',
      'Dropbox rejected the backup. Your local Jump Cluster and earlier backups are unchanged.',
      false,
      response.status,
    )
  }

  const metadata = parseJson(response.bytes)
  const receipt = toReceipt(metadata, options.path)
  if (!receipt) {
    throw uncertainOutcome('Dropbox received the backup but returned an incomplete receipt. Retry this same backup to verify its file.')
  }
  return receipt
}

/**
 * Checks one frozen App Folder path and compares the downloaded bytes. Only Dropbox's typed
 * `path/not_found` response authorizes the caller to retry an add create at that path.
 */
export async function reconcileDropboxBackup(options: {
  accessToken: string
  path: string
  contents: string
  fetcher?: DropboxFetcher
  signal?: AbortSignal
}): Promise<DropboxBackupReconciliation> {
  validateAppFolderPath(options.path)
  if (options.signal?.aborted) return { kind: 'unresolved' }
  const fetcher = options.fetcher ?? fetch
  let metadataResponse: ProviderResponse
  try {
    metadataResponse = await providerFetch(fetcher, `${API}/files/get_metadata`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path: options.path, include_deleted: false }),
    }, options.signal)
  } catch {
    return { kind: 'unresolved' }
  }
  if (options.signal?.aborted) return { kind: 'unresolved' }
  if (metadataResponse.status === 401) return { kind: 'unauthorized' }
  if (metadataResponse.status === 409 && isPathNotFound(parseJson(metadataResponse.bytes))) return { kind: 'not-found' }
  if (!metadataResponse.ok) return { kind: 'unresolved' }

  const metadata = parseJson(metadataResponse.bytes)
  const receipt = toReceipt(metadata, options.path, true)
  const expectedSize = new TextEncoder().encode(options.contents).byteLength
  if (!receipt || !isRecord(metadata) || metadata.size !== expectedSize) return { kind: 'mismatch' }

  let downloadResponse: ProviderResponse
  try {
    downloadResponse = await providerFetch(fetcher, `${CONTENT_API}/files/download`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.accessToken}`,
        'Dropbox-API-Arg': createDropboxApiArg({ path: options.path }),
      },
    }, options.signal)
  } catch {
    return { kind: 'unresolved' }
  }
  if (options.signal?.aborted) return { kind: 'unresolved' }
  if (downloadResponse.status === 401) return { kind: 'unauthorized' }
  if (!downloadResponse.ok) return { kind: 'unresolved' }

  const downloadedMetadata = parseJsonHeader(downloadResponse.headers.get('Dropbox-API-Result'))
  if (!isFileMetadata(downloadedMetadata, options.path)
    || downloadedMetadata.id !== receipt.id
    || downloadedMetadata.size !== expectedSize) {
    return { kind: 'mismatch' }
  }
  return sameBytes(downloadResponse.bytes, new TextEncoder().encode(options.contents))
    ? { kind: 'confirmed', receipt }
    : { kind: 'mismatch' }
}

/** Encodes Dropbox-API-Arg as ASCII so Unicode filenames are valid Fetch header values. */
export function createDropboxApiArg(value: unknown): string {
  return JSON.stringify(value).replace(/[\u007f-\uffff]/g, character =>
    `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`)
}

function validateAppFolderPath(path: string): void {
  if (!/^\/[^/]+$/.test(path) || path === '/' || path.includes('\\')) {
    throw new DropboxApiError('request-failed', 'This is not a valid file path inside the Dropbox App Folder.')
  }
}

function toReceipt(value: unknown, requestedPath: string, requireFileTag = false): DropboxBackupReceipt | undefined {
  if (!isFileMetadata(value, requestedPath, requireFileTag)) return undefined
  return { id: value.id, name: value.name, path: requestedPath }
}

function isFileMetadata(value: unknown, requestedPath: string, requireFileTag = false): value is Record<string, unknown> & {
  id: string
  name: string
  path_display: string
  size: number
} {
  if (!isRecord(value)) return false
  const filename = requestedPath.slice(1)
  return (value['.tag'] === undefined || value['.tag'] === 'file')
    && (!requireFileTag || value['.tag'] === 'file')
    && typeof value.id === 'string'
    && value.id.length > 0
    && value.name === filename
    && value.path_display === requestedPath
    && typeof value.size === 'number'
    && Number.isSafeInteger(value.size)
    && value.size >= 0
}

function isPathConflict(value: unknown): boolean {
  if (!isRecord(value) || !isRecord(value.error)) return false
  const error = value.error
  return error['.tag'] === 'path' && isRecord(error.path) && error.path['.tag'] === 'conflict'
}

function isPathNotFound(value: unknown): boolean {
  if (!isRecord(value) || !isRecord(value.error)) return false
  const error = value.error
  return error['.tag'] === 'path' && isRecord(error.path) && error.path['.tag'] === 'not_found'
}

function parseJson(bytes: Uint8Array): unknown {
  if (bytes.byteLength === 0) return undefined
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown
  } catch {
    return undefined
  }
}

function parseJsonHeader(value: string | null): unknown {
  if (!value) return undefined
  try {
    return JSON.parse(value) as unknown
  } catch {
    return undefined
  }
}

async function providerFetch(
  fetcher: DropboxFetcher,
  input: RequestInfo | URL,
  init: RequestInit,
  callerSignal?: AbortSignal,
): Promise<ProviderResponse> {
  if (callerSignal?.aborted) throw createAbortError()
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  let timedOut = false
  let rejectAbort: ((reason: Error) => void) | undefined
  const aborted = new Promise<never>((_resolve, reject) => { rejectAbort = reject })
  const onCallerAbort = () => {
    controller.abort()
    rejectAbort?.(createAbortError())
  }
  callerSignal?.addEventListener('abort', onCallerAbort, { once: true })
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      timedOut = true
      controller.abort()
      reject(new Error('Dropbox request timed out.'))
    }, REQUEST_TIMEOUT_MS)
  })

  try {
    const operation = async (): Promise<ProviderResponse> => {
      const response = await fetcher(input, { ...init, signal: controller.signal })
      if (controller.signal.aborted) {
        void response.body?.cancel().catch(() => undefined)
        throw createAbortError()
      }
      const bytes = await readResponseBytes(response, controller.signal)
      return { status: response.status, ok: response.ok, headers: response.headers, bytes }
    }
    return await Promise.race([operation(), deadline, aborted])
  } catch (error) {
    if (timedOut) throw new Error('Dropbox request timed out.', { cause: error })
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
  const aborted = new Promise<never>((_resolve, reject) => { rejectAbort = reject })
  const onAbort = () => {
    rejectAbort?.(createAbortError())
    void reader.cancel().catch(() => undefined)
  }
  if (signal.aborted) onAbort()
  else signal.addEventListener('abort', onAbort, { once: true })

  const read = async (): Promise<Uint8Array> => {
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
    return await Promise.race([read(), aborted])
  } finally {
    signal.removeEventListener('abort', onAbort)
    try {
      reader.releaseLock()
    } catch {
      // A pending read can still unwind after cancellation wins the race.
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.byteLength === right.byteLength && left.every((value, index) => value === right[index])
}

function isAmbiguousStatus(status: number): boolean {
  return status >= 500 || status === 408 || status === 429
}

function expiredAuthorizationError(): DropboxApiError {
  return new DropboxApiError('request-failed', 'Dropbox authorization expired. Authorize again to continue.', false, 401)
}

function uncertainOutcome(message: string, httpStatus?: number): DropboxApiError {
  return new DropboxApiError('outcome-uncertain', message, true, httpStatus)
}

function canceledBeforeDispatch(): DropboxApiError {
  return new DropboxApiError('request-failed', 'Dropbox backup was canceled before the upload started.')
}

function createAbortError(): Error {
  const error = new Error('The Dropbox request was canceled.')
  error.name = 'AbortError'
  return error
}
