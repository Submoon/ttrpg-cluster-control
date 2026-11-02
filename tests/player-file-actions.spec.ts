import { expect, test } from '@playwright/test'
import { effectScope } from 'vue'
import type { PlayerClusterDocument, PlayerSystemMarker } from '../domain/player-projection'
import type { CurrentPlayerMapScene } from '../domain/player-scene'
import { usePlayerFileExports } from '../composables/usePlayerFileExports'

const genericExportError = 'The player export could not be completed.'
const emptyImageError = 'This player map has no public features to export as an image.'
const hiddenSystemError = 'The current system is not revealed for player image export.'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((complete, fail) => {
    resolve = complete
    reject = fail
  })
  return { promise, resolve, reject }
}

function playerDocument(marker: PlayerSystemMarker | null = revealedSystem()): PlayerClusterDocument {
  return {
    format: 'ttrpg-cluster-control-player',
    version: 1,
    title: 'Pilgrim Reach',
    systems: marker ? [marker] : [],
    routes: [],
  }
}

function revealedSystem(objects: NonNullable<Extract<PlayerSystemMarker, { disclosure: 'revealed' }>['map']>['objects'] = []): PlayerSystemMarker {
  return {
    id: 'system-1',
    position: { x: 0, y: 0 },
    disclosure: 'revealed',
    type: 'star-system',
    label: 'Vesper',
    map: { objects, orbits: [] },
  }
}

interface PreparedPlayerExport {
  document: PlayerClusterDocument
  scene: CurrentPlayerMapScene | null
  isCurrent: () => boolean
}

async function withDownloadBoundary(run: (downloads: Array<{ filename: string; blob: Blob }>, revoked: string[]) => Promise<void>): Promise<void> {
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document')
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const createUrlDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
  const revokeUrlDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL')
  const downloads: Array<{ filename: string; blob: Blob }> = []
  const revoked: string[] = []
  let nextUrl = 0

  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: (blob: Blob) => {
      nextUrl += 1
      const url = `blob:player-test-${nextUrl}`
      downloads.push({ filename: '', blob })
      return url
    },
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: (url: string) => revoked.push(url),
  })
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      createElement: () => {
        const link = {
          href: '',
          download: '',
          click: () => undefined,
          remove: () => undefined,
        }
        link.click = () => { downloads[downloads.length - 1]!.filename = link.download }
        return link as unknown as HTMLAnchorElement
      },
      body: { append: () => undefined },
    } as unknown as Document,
  })
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      setTimeout: (callback: TimerHandler) => {
        if (typeof callback === 'function') callback()
        return 0
      },
    } as unknown as Window,
  })

  try {
    await run(downloads, revoked)
  } finally {
    if (documentDescriptor) Object.defineProperty(globalThis, 'document', documentDescriptor)
    else Reflect.deleteProperty(globalThis, 'document')
    if (windowDescriptor) Object.defineProperty(globalThis, 'window', windowDescriptor)
    else Reflect.deleteProperty(globalThis, 'window')
    if (createUrlDescriptor) Object.defineProperty(URL, 'createObjectURL', createUrlDescriptor)
    else Reflect.deleteProperty(URL, 'createObjectURL')
    if (revokeUrlDescriptor) Object.defineProperty(URL, 'revokeObjectURL', revokeUrlDescriptor)
    else Reflect.deleteProperty(URL, 'revokeObjectURL')
  }
}

test('declined preparation and superseded or disposed pending work have no export effects @pure', async () => {
  const declined = usePlayerFileExports({ prepare: async () => null })
  await declined.downloadPlayerJson()
  await declined.downloadPlayerImage('svg', 'active')
  expect(declined.playerExportError.value).toBe('')

  const stalePreparation = deferred<PreparedPlayerExport | null>()
  let prepareCount = 0
  const superseded = usePlayerFileExports({
    prepare: () => {
      prepareCount += 1
      return prepareCount === 1 ? stalePreparation.promise : Promise.resolve(null)
    },
  })
  const supersededAction = superseded.downloadPlayerJson()
  await superseded.downloadPlayerJson()
  stalePreparation.reject(new Error('PRIVATE_stale_export_failure'))
  await supersededAction
  expect(superseded.playerExportError.value).toBe('')

  const disposedPreparation = deferred<PreparedPlayerExport | null>()
  const owner = effectScope()
  const disposed = owner.run(() => usePlayerFileExports({ prepare: () => disposedPreparation.promise }))
  if (!disposed) throw new Error('The player export scope did not initialize.')
  const disposedAction = disposed.downloadPlayerJson()
  owner.stop()
  disposedPreparation.reject(new Error('PRIVATE_disposed_export_failure'))
  await disposedAction
  expect(disposed.playerExportError.value).toBe('')
})

test('a stale prepared context prevents download and unexpected failures stay generic @pure', async () => {
  const document = playerDocument()
  await withDownloadBoundary(async (downloads) => {
    const stale = usePlayerFileExports({
      prepare: async () => ({
        document,
        scene: { kind: 'jump-cluster', document },
        isCurrent: () => false,
      }),
    })
    await stale.downloadPlayerJson()
    expect(downloads).toHaveLength(0)
    expect(stale.playerExportError.value).toBe('')
  })

  const failed = usePlayerFileExports({
    prepare: async () => { throw new Error('PRIVATE_path_and_parser_details') },
  })
  await failed.downloadPlayerJson()
  expect(failed.playerExportError.value).toBe(genericExportError)
  expect(failed.playerExportError.value).not.toContain('PRIVATE')
})

test('empty and ineligible image scenes are refused while an empty Revealed system remains valid JSON @pure', async () => {
  const emptyCluster = playerDocument(null)
  const emptyClusterExport = usePlayerFileExports({
    prepare: async () => ({
      document: emptyCluster,
      scene: { kind: 'jump-cluster', document: emptyCluster },
      isCurrent: () => true,
    }),
  })
  await emptyClusterExport.downloadPlayerImage('svg', 'active')
  expect(emptyClusterExport.playerExportError.value).toBe(emptyImageError)

  const partialDocument = playerDocument({
    id: 'system-1',
    position: { x: 0, y: 0 },
    disclosure: 'known-type',
    type: 'star-system',
    label: 'Star system',
  })
  const partialSystemExport = usePlayerFileExports({
    prepare: async () => ({ document: partialDocument, scene: null, isCurrent: () => true }),
  })
  await partialSystemExport.downloadPlayerImage('png', 'print-light')
  expect(partialSystemExport.playerExportError.value).toBe(hiddenSystemError)

  const emptyRevealedSystem = revealedSystem()
  if (emptyRevealedSystem.disclosure !== 'revealed') throw new Error('Expected a Revealed fixture system.')
  const emptyRevealedDocument = playerDocument(emptyRevealedSystem)
  const emptyRevealedExport = usePlayerFileExports({
    prepare: async () => ({
      document: emptyRevealedDocument,
      scene: {
        kind: 'star-system',
        document: emptyRevealedSystem.map,
        label: 'Vesper',
      },
      isCurrent: () => true,
    }),
  })
  await emptyRevealedExport.downloadPlayerImage('svg', 'active')
  expect(emptyRevealedExport.playerExportError.value).toBe(emptyImageError)

  await withDownloadBoundary(async (downloads, revoked) => {
    const validJsonExport = usePlayerFileExports({
      prepare: async () => ({
        document: emptyRevealedDocument,
        scene: null,
        isCurrent: () => true,
      }),
    })
    await validJsonExport.downloadPlayerJson()
    expect(validJsonExport.playerExportError.value).toBe('')
    expect(downloads).toHaveLength(1)
    expect(downloads[0]!.filename).toBe('Pilgrim Reach-player-jump-cluster.json')
    await expect(downloads[0]!.blob.text()).resolves.toContain('"objects":[]')
    expect(revoked).toEqual(['blob:player-test-1'])
  })
})
