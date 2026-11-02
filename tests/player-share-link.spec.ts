import { gzipSync } from 'node:zlib'
import { expect, test } from './fixtures'
import { MAX_PLAYER_JSON_BYTES, serializePlayerJson } from '../domain/player-codec'
import type { PlayerClusterDocument } from '../domain/player-projection'
import {
  MAX_PLAYER_SHARE_URL_BYTES,
  createPlayerShareUrl,
  decodePlayerShareFragment,
} from '../utils/player-share-link'

const publicDocument: PlayerClusterDocument = {
  format: 'ttrpg-cluster-control-player',
  version: 1,
  title: 'Pilgrim Reach',
  systems: [
    {
      id: 'system-1',
      position: { x: 120, y: 100 },
      disclosure: 'unknown',
      label: 'Unknown presence',
    },
  ],
  routes: [],
}

async function rejectedError(operation: () => Promise<unknown>): Promise<unknown> {
  try {
    await operation()
  } catch (error) {
    return error
  }
  throw new Error('Expected the player link operation to reject.')
}

async function expectErrorCode(
  operation: () => Promise<unknown>,
  name: string,
  code: string,
): Promise<unknown> {
  const error = await rejectedError(operation)
  expect(error).toMatchObject({ name, code })
  return error
}

function gzipFragment(text: string): string {
  return `#player=1.gzip.${gzipSync(Buffer.from(text, 'utf8')).toString('base64url')}`
}

test('compressed player links round-trip canonical public data without extensions @pure', async () => {
  const privateCanary = 'PRIVATE transport extension'
  const extendedDocument = {
    ...publicDocument,
    privateExtension: privateCanary,
    systems: publicDocument.systems.map(system => ({
      ...system,
      privateExtension: privateCanary,
    })),
  }

  const url = await createPlayerShareUrl(extendedDocument, 'https://reader.example.test/player')
  const fragment = new URL(url).hash
  const encodedPayload = fragment.slice('#player=1.gzip.'.length)
  const compressedBytes = Buffer.from(encodedPayload, 'base64url')
  const rawJson = await new Response(
    new Blob([compressedBytes]).stream().pipeThrough(new DecompressionStream('gzip')),
  ).text()
  const decoded = await decodePlayerShareFragment(fragment)

  expect(url).toMatch(/^https:\/\/reader\.example\.test\/player#player=1\.gzip\.[A-Za-z0-9_-]+$/)
  expect(rawJson).toBe(serializePlayerJson(publicDocument))
  expect(rawJson).not.toContain(privateCanary)
  expect(decoded).toEqual(publicDocument)
  expect(decoded).not.toHaveProperty('privateExtension')
  expect(decoded.systems[0]!).not.toHaveProperty('privateExtension')
  expect(JSON.stringify(decoded)).not.toContain(privateCanary)
})

test('player link operations identify already-aborted signals as AbortError @pure', async () => {
  const controller = new AbortController()
  controller.abort()

  const createError = await rejectedError(() => createPlayerShareUrl(
    publicDocument,
    'https://reader.example.test/player',
    { signal: controller.signal },
  ))
  const decodeError = await rejectedError(() => decodePlayerShareFragment(
    '#player=1.gzip.AA',
    { signal: controller.signal },
  ))

  expect(createError).toMatchObject({ name: 'AbortError' })
  expect(decodeError).toMatchObject({ name: 'AbortError' })
})

test('player share fragments reject malformed and noncanonical encodings @pure', async () => {
  const invalidFragments = [
    '',
    'player=1.gzip.AA',
    '#player=1.gzip.',
    '#player=1.gzip.AA=',
    '#player=1.gzip.AB',
    '#player=1.gzip.AA%2F',
    '#player=1.gzip.AA/+',
    '#player=1.gzip.AA ',
    '#player=1.gzip.AA&mode=1',
    '#player=1.br.AA',
  ]
  for (const fragment of invalidFragments) {
    await expectErrorCode(
      () => decodePlayerShareFragment(fragment),
      'PlayerShareLinkError',
      'invalid-link',
    )
  }

  await expectErrorCode(
    () => decodePlayerShareFragment('#player=2.gzip.AA'),
    'PlayerShareLinkError',
    'unsupported-version',
  )
  await expectErrorCode(
    () => decodePlayerShareFragment(`#player=1.gzip.${'A'.repeat(8_193)}`),
    'PlayerShareLinkError',
    'too-large',
  )
})

test('player share decoding rejects corrupt gzip and fatal UTF-8 safely @pure', async () => {
  const corruptGzip = gzipSync(Buffer.from('some payload', 'utf8'))
  corruptGzip[0] = corruptGzip[0]! ^ 0xff
  const truncatedGzip = gzipSync(Buffer.from(serializePlayerJson(publicDocument), 'utf8')).subarray(0, -1)

  await expectErrorCode(
    () => decodePlayerShareFragment(`#player=1.gzip.${corruptGzip.toString('base64url')}`),
    'PlayerShareLinkError',
    'invalid-link',
  )
  await expectErrorCode(
    () => decodePlayerShareFragment(`#player=1.gzip.${truncatedGzip.toString('base64url')}`),
    'PlayerShareLinkError',
    'invalid-link',
  )
  await expectErrorCode(
    () => decodePlayerShareFragment(`#player=1.gzip.${gzipSync(Buffer.from([0xff, 0xfe])).toString('base64url')}`),
    'PlayerShareLinkError',
    'invalid-link',
  )
  await expectErrorCode(
    () => decodePlayerShareFragment(gzipFragment('{"truncated":')),
    'PlayerDocumentError',
    'invalid-json',
  )
})

test('player share decoding preserves real codec empty, schema, and graph errors @pure', async () => {
  const emptyDocument = JSON.stringify({
    format: 'ttrpg-cluster-control-player',
    version: 1,
    title: 'Pilgrim Reach',
    systems: [],
    routes: [],
  })
  const invalidSchema = JSON.stringify({
    format: 'ttrpg-cluster-control-player',
    version: 1,
    title: 'Pilgrim Reach',
    systems: [{
      id: 'system-1',
      position: { x: Number.NaN, y: 100 },
      disclosure: 'unknown',
      label: 'Unknown presence',
    }],
    routes: [],
  })
  const invalidGraph = JSON.stringify({
    ...publicDocument,
    routes: [{
      id: 'route-1',
      jumpLevel: 2,
      fromSystemId: 'system-1',
      destination: { kind: 'system', systemId: 'system-2' },
    }],
  })

  await expectErrorCode(
    () => decodePlayerShareFragment(gzipFragment('')),
    'PlayerDocumentError',
    'empty-document',
  )
  await expectErrorCode(
    () => decodePlayerShareFragment(gzipFragment(emptyDocument)),
    'PlayerDocumentError',
    'empty-document',
  )
  await expectErrorCode(
    () => decodePlayerShareFragment(gzipFragment(invalidSchema)),
    'PlayerDocumentError',
    'invalid-document',
  )
  await expectErrorCode(
    () => decodePlayerShareFragment(gzipFragment(invalidGraph)),
    'PlayerDocumentError',
    'invalid-document',
  )
})

test('player share URL budget includes the complete canonical reader URL @pure', async () => {
  const rootReaderUrl = 'https://reader.example.test:8443/'
  const baselineUrl = await createPlayerShareUrl(publicDocument, rootReaderUrl)
  const fragment = baselineUrl.slice(baselineUrl.indexOf('#'))
  const targetBaseBytes = MAX_PLAYER_SHARE_URL_BYTES - Buffer.byteLength(fragment, 'utf8')
  const rootReaderBytes = Buffer.byteLength(rootReaderUrl, 'utf8')
  const pathLength = targetBaseBytes - rootReaderBytes
  expect(pathLength).toBeGreaterThan(0)

  const boundaryReaderUrl = `${rootReaderUrl}${'a'.repeat(pathLength)}`
  const boundaryUrl = await createPlayerShareUrl(publicDocument, boundaryReaderUrl)
  expect(Buffer.byteLength(boundaryUrl, 'utf8')).toBe(MAX_PLAYER_SHARE_URL_BYTES)

  await expectErrorCode(
    () => createPlayerShareUrl(publicDocument, `${boundaryReaderUrl}a`),
    'PlayerShareLinkError',
    'too-large',
  )

  const invalidReaderUrls = [
    '/player',
    'ftp://reader.example.test/player',
    'https://user:password@reader.example.test/player',
    'https://reader.example.test/player?mode=1',
    'https://reader.example.test/player#existing',
    ' https://reader.example.test/player',
    'x'.repeat(MAX_PLAYER_SHARE_URL_BYTES + 1),
  ]
  for (const readerUrl of invalidReaderUrls.slice(0, -1)) {
    await expectErrorCode(
      () => createPlayerShareUrl(publicDocument, readerUrl),
      'PlayerShareLinkError',
      'invalid-link',
    )
  }
  await expectErrorCode(
    () => createPlayerShareUrl(publicDocument, invalidReaderUrls.at(-1)!),
    'PlayerShareLinkError',
    'too-large',
  )
})

test('native gzip availability is checked only when transport runs @pure', async () => {
  const compressionDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'CompressionStream')
  const decompressionDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'DecompressionStream')
  const validFragment = gzipFragment(serializePlayerJson(publicDocument))

  try {
    Object.defineProperty(globalThis, 'CompressionStream', {
      configurable: true,
      writable: true,
      value: undefined,
    })
    await expectErrorCode(
      () => createPlayerShareUrl(publicDocument, 'https://reader.example.test/player'),
      'PlayerShareLinkError',
      'unavailable',
    )

    if (compressionDescriptor) {
      Object.defineProperty(globalThis, 'CompressionStream', compressionDescriptor)
    }
    Object.defineProperty(globalThis, 'DecompressionStream', {
      configurable: true,
      writable: true,
      value: undefined,
    })
    await expectErrorCode(
      () => decodePlayerShareFragment(validFragment),
      'PlayerShareLinkError',
      'unavailable',
    )
  } finally {
    if (compressionDescriptor) {
      Object.defineProperty(globalThis, 'CompressionStream', compressionDescriptor)
    } else {
      Reflect.deleteProperty(globalThis, 'CompressionStream')
    }
    if (decompressionDescriptor) {
      Object.defineProperty(globalThis, 'DecompressionStream', decompressionDescriptor)
    } else {
      Reflect.deleteProperty(globalThis, 'DecompressionStream')
    }
  }
})

test('abort returns promptly from pending native read and fences its late rejection @pure', async () => {
  const readerPrototype = ReadableStreamDefaultReader.prototype
  const originalRead = readerPrototype.read
  const controller = new AbortController()
  const lateNativeError = new Error('Late native reader failure.')
  let notifyReadStarted!: () => void
  const readStarted = new Promise<void>(resolve => { notifyReadStarted = resolve })
  let rejectGatedRead: ((reason?: unknown) => void) | undefined
  let gatedRead: Promise<ReadableStreamReadResult<Uint8Array>> | undefined
  let operation: Promise<PlayerClusterDocument> | undefined
  let gateReleased = false
  let interceptedRead = false

  readerPrototype.read = function (
    this: ReadableStreamDefaultReader<Uint8Array>,
  ): Promise<ReadableStreamReadResult<Uint8Array>> {
    const nativeRead = originalRead.call(this)
    if (interceptedRead) return nativeRead

    interceptedRead = true
    void nativeRead.catch(() => {})
    gatedRead = new Promise((_, reject) => { rejectGatedRead = reject })
    notifyReadStarted()
    return gatedRead
  }

  try {
    operation = decodePlayerShareFragment(
      gzipFragment(serializePlayerJson(publicDocument)),
      { signal: controller.signal },
    )
    await readStarted
    controller.abort()

    const error = await rejectedError(() => operation!)
    expect(error).toMatchObject({ name: 'AbortError' })

    gateReleased = true
    rejectGatedRead?.(lateNativeError)
    const lateSettlement = await Promise.allSettled([gatedRead!])
    expect(lateSettlement[0]!.status).toBe('rejected')
    if (lateSettlement[0]!.status === 'rejected') {
      expect(lateSettlement[0]!.reason).toBe(lateNativeError)
    }
    expect(error).not.toHaveProperty('message', lateNativeError.message)
  } finally {
    controller.abort()
    if (!gateReleased) rejectGatedRead?.(lateNativeError)
    if (operation) await Promise.allSettled([operation])
    if (gatedRead) await Promise.allSettled([gatedRead])
    readerPrototype.read = originalRead
  }
})

test('oversized native gzip output settles native stream cancellation safely @pure', async (
  // eslint-disable-next-line no-empty-pattern
  {}, testInfo,
) => {
  const gzipPayload = gzipSync(Buffer.alloc(MAX_PLAYER_JSON_BYTES + 64, 0))
  const fragment = `#player=1.gzip.${gzipPayload.toString('base64url')}`
  const readerPrototype = ReadableStreamDefaultReader.prototype
  const writerPrototype = WritableStreamDefaultWriter.prototype
  const originalCancel = readerPrototype.cancel
  const originalAbort = writerPrototype.abort
  const cleanups: Array<{
    kind: 'reader.cancel' | 'writer.abort'
    suppliedReason: unknown
    promise: Promise<unknown>
  }> = []

  readerPrototype.cancel = function (
    this: ReadableStreamDefaultReader<Uint8Array>,
    reason?: unknown,
  ): Promise<void> {
    const promise = originalCancel.call(this, reason)
    cleanups.push({ kind: 'reader.cancel', suppliedReason: reason, promise })
    void promise.catch(() => {})
    return promise
  }
  writerPrototype.abort = function (
    this: WritableStreamDefaultWriter<BufferSource>,
    reason?: unknown,
  ): Promise<void> {
    const promise = originalAbort.call(this, reason)
    cleanups.push({ kind: 'writer.abort', suppliedReason: reason, promise })
    void promise.catch(() => {})
    return promise
  }

  try {
    const error = await rejectedError(() => decodePlayerShareFragment(fragment))
    expect(error).toMatchObject({ name: 'PlayerShareLinkError', code: 'too-large' })

    const settlements = await Promise.allSettled(cleanups.map(cleanup => cleanup.promise))
    const report = cleanups.map((cleanup, index) => {
      const settlement = settlements[index]!
      const supplied = cleanupErrorDetails(cleanup.suppliedReason)
      if (settlement.status === 'fulfilled') {
        return {
          kind: cleanup.kind,
          status: settlement.status,
          suppliedReasonName: supplied.name,
          suppliedReasonCode: supplied.code,
          suppliedReasonMessage: supplied.message,
        }
      }

      const rejection = cleanupErrorDetails(settlement.reason)
      return {
        kind: cleanup.kind,
        status: settlement.status,
        suppliedReasonName: supplied.name,
        suppliedReasonCode: supplied.code,
        suppliedReasonMessage: supplied.message,
        rejectionName: rejection.name,
        rejectionCode: rejection.code,
        rejectionMessage: rejection.message,
      }
    })
    await testInfo.attach('native-stream-cleanup-settlements', {
      body: JSON.stringify(report, null, 2),
      contentType: 'application/json',
    })

    const cleanupKinds = new Set(cleanups.map(cleanup => cleanup.kind))
    expect(cleanupKinds.has('reader.cancel')).toBe(true)
    expect(cleanupKinds.has('writer.abort')).toBe(true)
    for (let index = 0; index < settlements.length; index += 1) {
      const settlement = settlements[index]!
      if (settlement.status === 'rejected') {
        expect(settlement.reason).toBe(error)
        expect(cleanups[index]!.suppliedReason).toBe(error)
      }
    }
  } finally {
    await Promise.allSettled(cleanups.map(cleanup => cleanup.promise))
    readerPrototype.cancel = originalCancel
    writerPrototype.abort = originalAbort
  }
})

function cleanupErrorDetails(value: unknown): {
  name: unknown
  code: unknown
  message: unknown
} {
  if (typeof value !== 'object' || value === null) {
    return { name: typeof value, code: undefined, message: String(value) }
  }
  const record = value as Record<string, unknown>
  return { name: record.name, code: record.code, message: record.message }
}
