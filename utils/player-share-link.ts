import {
  MAX_PLAYER_JSON_BYTES,
  parsePlayerJson,
  PlayerDocumentError,
  serializePlayerJson,
} from '../domain/player-codec'
import type { PlayerClusterDocument } from '../domain/player-projection'

export const MAX_PLAYER_SHARE_URL_BYTES = 8_192

export type PlayerShareLinkErrorCode =
  | 'invalid-link'
  | 'unsupported-version'
  | 'too-large'
  | 'unavailable'

const errorMessages: Record<PlayerShareLinkErrorCode, string> = {
  'invalid-link': 'This player link is invalid or damaged.',
  'unsupported-version': 'This player link version is not supported.',
  'too-large': 'This player link exceeds the supported size limit.',
  'unavailable': 'Player link compression is unavailable in this browser.',
}

const fragmentMarker = '#player='
const fragmentPrefix = '#player=1.gzip.'
const base64UrlAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
const maxCompressedBytes = Math.floor(MAX_PLAYER_SHARE_URL_BYTES * 3 / 4)
const maxEncodedPayloadCharacters = Math.ceil(maxCompressedBytes * 4 / 3)
const encoder = new TextEncoder()

export class PlayerShareLinkError extends Error {
  readonly code: PlayerShareLinkErrorCode

  constructor(code: PlayerShareLinkErrorCode) {
    super(errorMessages[code])
    this.name = 'PlayerShareLinkError'
    this.code = code
  }
}

function fail(code: PlayerShareLinkErrorCode): never {
  throw new PlayerShareLinkError(code)
}

function fixedAbortError(): DOMException {
  return new DOMException('The player link operation was cancelled.', 'AbortError')
}

function checkAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw fixedAbortError()
}

function byteLength(value: string): number {
  return encoder.encode(value).byteLength
}

function readReaderUrl(readerUrl: string): URL {
  if (typeof readerUrl !== 'string') return fail('invalid-link')
  if (readerUrl.length > MAX_PLAYER_SHARE_URL_BYTES) return fail('too-large')
  if (byteLength(readerUrl) > MAX_PLAYER_SHARE_URL_BYTES) return fail('too-large')
  if (
    readerUrl.trim() !== readerUrl
    || !/^https?:\/\//i.test(readerUrl)
    || readerUrl.includes('?')
    || readerUrl.includes('#')
  ) {
    return fail('invalid-link')
  }

  let parsed: URL
  try {
    parsed = new URL(readerUrl)
  } catch {
    return fail('invalid-link')
  }

  if (
    (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
    || parsed.username !== ''
    || parsed.password !== ''
    || parsed.origin === 'null'
    || parsed.search !== ''
    || parsed.hash !== ''
  ) {
    return fail('invalid-link')
  }
  return parsed
}

function base64UrlSextet(code: number): number {
  if (code >= 65 && code <= 90) return code - 65
  if (code >= 97 && code <= 122) return code - 97 + 26
  if (code >= 48 && code <= 57) return code - 48 + 52
  if (code === 45) return 62
  if (code === 95) return 63
  return -1
}

function decodeBase64Url(payload: string): Uint8Array<ArrayBuffer> {
  if (!payload) return fail('invalid-link')
  if (payload.length > maxEncodedPayloadCharacters) return fail('too-large')

  const remainder = payload.length % 4
  if (remainder === 1) return fail('invalid-link')
  for (let index = 0; index < payload.length; index += 1) {
    if (base64UrlSextet(payload.charCodeAt(index)) === -1) return fail('invalid-link')
  }

  if (remainder === 2 && (base64UrlSextet(payload.charCodeAt(payload.length - 1)!) & 0x0f) !== 0) {
    return fail('invalid-link')
  }
  if (remainder === 3 && (base64UrlSextet(payload.charCodeAt(payload.length - 1)!) & 0x03) !== 0) {
    return fail('invalid-link')
  }

  const decodedLength = Math.floor(payload.length * 3 / 4)
  if (decodedLength > maxCompressedBytes) return fail('too-large')
  const decoded = new Uint8Array(decodedLength)
  let outputIndex = 0
  let inputIndex = 0

  while (inputIndex + 4 <= payload.length) {
    const first = base64UrlSextet(payload.charCodeAt(inputIndex++))
    const second = base64UrlSextet(payload.charCodeAt(inputIndex++))
    const third = base64UrlSextet(payload.charCodeAt(inputIndex++))
    const fourth = base64UrlSextet(payload.charCodeAt(inputIndex++))
    decoded[outputIndex++] = (first << 2) | (second >> 4)
    decoded[outputIndex++] = ((second & 0x0f) << 4) | (third >> 2)
    decoded[outputIndex++] = ((third & 0x03) << 6) | fourth
  }

  if (remainder === 2) {
    const first = base64UrlSextet(payload.charCodeAt(inputIndex++))
    const second = base64UrlSextet(payload.charCodeAt(inputIndex))
    decoded[outputIndex] = (first << 2) | (second >> 4)
  } else if (remainder === 3) {
    const first = base64UrlSextet(payload.charCodeAt(inputIndex++))
    const second = base64UrlSextet(payload.charCodeAt(inputIndex++))
    const third = base64UrlSextet(payload.charCodeAt(inputIndex))
    decoded[outputIndex++] = (first << 2) | (second >> 4)
    decoded[outputIndex] = ((second & 0x0f) << 4) | (third >> 2)
  }

  return decoded
}

function encodeBase64Url(bytes: Uint8Array<ArrayBuffer>): string {
  const output: string[] = []
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index]!
    const second = bytes[index + 1]
    const third = bytes[index + 2]
    output.push(base64UrlAlphabet[first >> 2]!)
    output.push(base64UrlAlphabet[((first & 0x03) << 4) | ((second ?? 0) >> 4)]!)
    if (second !== undefined) {
      output.push(base64UrlAlphabet[((second & 0x0f) << 2) | ((third ?? 0) >> 6)]!)
    }
    if (third !== undefined) output.push(base64UrlAlphabet[third & 0x3f]!)
  }
  return output.join('')
}

function createCompressionStream(): CompressionStream {
  if (typeof CompressionStream !== 'function') return fail('unavailable')
  try {
    return new CompressionStream('gzip')
  } catch {
    return fail('unavailable')
  }
}

function createDecompressionStream(): DecompressionStream {
  if (typeof DecompressionStream !== 'function') return fail('unavailable')
  try {
    return new DecompressionStream('gzip')
  } catch {
    return fail('unavailable')
  }
}

async function transformBytes(
  input: Uint8Array<ArrayBuffer>,
  stream: CompressionStream | DecompressionStream,
  maxOutputBytes: number,
  signal: AbortSignal | undefined,
  nativeErrorCode: 'invalid-link' | 'unavailable',
): Promise<Uint8Array<ArrayBuffer>> {
  checkAborted(signal)
  const reader = stream.readable.getReader()
  const writer = stream.writable.getWriter()
  let rejectAbort: ((error: DOMException) => void) | undefined
  const abortPromise = signal
    ? new Promise<never>((_, reject) => { rejectAbort = reject })
    : undefined
  let onAbort: (() => void) | undefined
  let cleanupStarted = false

  const releaseLocks = () => {
    try {
      reader.releaseLock()
    } catch {
      // A native stream can retain a pending read while it is being cancelled.
    }
    try {
      writer.releaseLock()
    } catch {
      // A native stream can retain a pending write while it is being aborted.
    }
  }

  const cancelStreams = (reason: unknown) => {
    if (cleanupStarted) return
    cleanupStarted = true
    let readerCancellation: Promise<void>
    try {
      readerCancellation = reader.cancel(reason)
    } catch (error) {
      readerCancellation = Promise.reject(error)
    }
    let writerAbortion: Promise<void>
    try {
      writerAbortion = writer.abort(reason)
    } catch (error) {
      writerAbortion = Promise.reject(error)
    }
    void Promise.allSettled([readerCancellation, writerAbortion]).then(releaseLocks)
  }

  if (signal && abortPromise) {
    onAbort = () => {
      const error = fixedAbortError()
      cancelStreams(error)
      rejectAbort?.(error)
    }
    signal.addEventListener('abort', onAbort, { once: true })
    if (signal.aborted) onAbort()
    void abortPromise.catch(() => {})
  }

  const writePromise = (async () => {
    if (cleanupStarted) return
    await writer.write(input)
    if (!cleanupStarted) await writer.close()
  })()
  void writePromise.catch(() => {})

  try {
    const chunks: Uint8Array[] = []
    let totalBytes = 0

    while (true) {
      checkAborted(signal)
      const readPromise = reader.read()
      const result = abortPromise
        ? await Promise.race([readPromise, abortPromise])
        : await readPromise
      if (result.done) break

      const nextTotal = totalBytes + result.value.byteLength
      if (nextTotal > maxOutputBytes) fail('too-large')
      totalBytes = nextTotal
      chunks.push(result.value)
    }

    checkAborted(signal)
    if (abortPromise) await Promise.race([writePromise, abortPromise])
    else await writePromise
    checkAborted(signal)

    const output = new Uint8Array(totalBytes)
    let offset = 0
    for (const chunk of chunks) {
      output.set(chunk, offset)
      offset += chunk.byteLength
    }
    return output
  } catch (error) {
    cancelStreams(error)
    if (signal?.aborted) throw fixedAbortError()
    if (error instanceof PlayerShareLinkError || error instanceof PlayerDocumentError) throw error
    return fail(nativeErrorCode)
  } finally {
    if (signal && onAbort) signal.removeEventListener('abort', onAbort)
    if (!cleanupStarted) releaseLocks()
  }
}

function fragmentPayload(fragment: string): string {
  if (typeof fragment !== 'string') return fail('invalid-link')
  const maxFragmentCharacters = fragmentPrefix.length + maxEncodedPayloadCharacters
  if (fragment.length > maxFragmentCharacters) return fail('too-large')
  if (!fragment.startsWith(fragmentMarker)) return fail('invalid-link')

  const versionEnd = fragment.indexOf('.', fragmentMarker.length)
  if (versionEnd < 0) return fail('invalid-link')
  if (fragment.slice(fragmentMarker.length, versionEnd) !== '1') return fail('unsupported-version')
  if (!fragment.startsWith(fragmentPrefix)) return fail('invalid-link')

  return fragment.slice(fragmentPrefix.length)
}

export async function createPlayerShareUrl(
  document: PlayerClusterDocument,
  readerUrl: string,
  options?: { signal?: AbortSignal },
): Promise<string> {
  const signal = options?.signal
  checkAborted(signal)
  const baseUrl = readReaderUrl(readerUrl)
  const prefix = `${baseUrl.href}${fragmentPrefix}`
  const availableEncodedCharacters = MAX_PLAYER_SHARE_URL_BYTES - byteLength(prefix)
  if (availableEncodedCharacters < 2) return fail('too-large')
  const maxOutputBytes = Math.min(
    maxCompressedBytes,
    Math.floor(availableEncodedCharacters * 3 / 4),
  )
  if (maxOutputBytes < 1) return fail('too-large')

  const json = serializePlayerJson(document)
  checkAborted(signal)
  const input = encoder.encode(json)
  checkAborted(signal)

  const compressed = await transformBytes(
    input,
    createCompressionStream(),
    maxOutputBytes,
    signal,
    'unavailable',
  )
  checkAborted(signal)

  const url = `${prefix}${encodeBase64Url(compressed)}`
  if (byteLength(url) > MAX_PLAYER_SHARE_URL_BYTES) return fail('too-large')
  checkAborted(signal)
  return url
}

export async function decodePlayerShareFragment(
  fragment: string,
  options?: { signal?: AbortSignal },
): Promise<PlayerClusterDocument> {
  const signal = options?.signal
  checkAborted(signal)
  const compressed = decodeBase64Url(fragmentPayload(fragment))
  checkAborted(signal)

  const jsonBytes = await transformBytes(
    compressed,
    createDecompressionStream(),
    MAX_PLAYER_JSON_BYTES,
    signal,
    'invalid-link',
  )
  checkAborted(signal)

  let json: string
  try {
    json = new TextDecoder('utf-8', { fatal: true }).decode(jsonBytes)
  } catch {
    return fail('invalid-link')
  }
  checkAborted(signal)
  return parsePlayerJson(json)
}
