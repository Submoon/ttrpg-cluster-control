import { expect, test } from '@playwright/test'
import { createLocalWorkspace, projectPlayerCluster, updateChartDetails } from '../domain/workspace'
import type { PlayerClusterDocument } from '../domain/player-projection'
import type { CurrentPlayerMapScene } from '../domain/player-scene'
import { usePlayerFileExports } from '../composables/usePlayerFileExports'

interface PreparedPlayerExport {
  document: PlayerClusterDocument
  scene: CurrentPlayerMapScene | null
  isCurrent: () => boolean
}

function publicPlayerDocument(): PlayerClusterDocument {
  const workspace = createLocalWorkspace('Private Lantern Reach', 'Public Vesper')
  const system = workspace.cluster.systems[0]!
  const publishedWorkspace = updateChartDetails(workspace, system.id, {
    clusterName: workspace.cluster.name,
    systemName: system.name,
    playerTitle: 'Pilgrim Reach',
    publication: 'revealed',
  })
  return projectPlayerCluster(publishedWorkspace)
}

function preparedExport(
  document: PlayerClusterDocument,
  isCurrent: () => boolean = () => true,
): PreparedPlayerExport {
  return {
    document,
    scene: { kind: 'jump-cluster', document },
    isCurrent,
  }
}

async function withDownloadBoundary(
  run: (downloads: Array<{ filename: string; blob: Blob }>) => Promise<void>,
): Promise<void> {
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document')
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const createUrlDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
  const revokeUrlDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL')
  const downloads: Array<{ filename: string; blob: Blob }> = []

  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: (blob: Blob) => {
      downloads.push({ filename: '', blob })
      return 'blob:player-share-action-test'
    },
  })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: () => undefined })
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      createElement: () => {
        const link = {
          href: '',
          download: '',
          click() { downloads[downloads.length - 1]!.filename = this.download },
          remove: () => undefined,
        }
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
    await run(downloads)
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

async function withGatedNativeCompression(
  run: (gate: { started: Promise<void>; release: () => void }) => Promise<void>,
): Promise<void> {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'CompressionStream')
  const NativeCompressionStream = globalThis.CompressionStream
  if (typeof NativeCompressionStream !== 'function') {
    throw new Error('The native CompressionStream API is required for this test.')
  }

  let releaseOutput!: () => void
  const outputGate = new Promise<void>(resolve => { releaseOutput = resolve })
  let signalStarted!: () => void
  const started = new Promise<void>(resolve => { signalStarted = resolve })
  let didSignalStart = false

  function GatedCompressionStream(format: CompressionFormat) {
    const native = new NativeCompressionStream(format)
    const readable = native.readable.pipeThrough(new TransformStream({
      async transform(chunk, controller) {
        if (!didSignalStart) {
          didSignalStart = true
          signalStarted()
        }
        await outputGate
        controller.enqueue(chunk)
      },
    }))
    return { readable, writable: native.writable }
  }

  Object.defineProperty(globalThis, 'CompressionStream', {
    configurable: true,
    writable: true,
    value: GatedCompressionStream,
  })

  try {
    await run({ started, release: releaseOutput })
  } finally {
    releaseOutput()
    if (descriptor) Object.defineProperty(globalThis, 'CompressionStream', descriptor)
    else Reflect.deleteProperty(globalThis, 'CompressionStream')
  }
}

test('a declined preflight leaves player link state empty @pure', async () => {
  const owner = usePlayerFileExports({ prepare: async () => null })
  try {
    await owner.generatePlayerLink('https://reader.example.test/player')
    expect(owner.generatedPlayerUrl.value).toBe('')
    expect(owner.playerLinkBusy.value).toBe(false)
    expect(owner.playerLinkStatus.value).toBe('')
    expect(owner.playerExportError.value).toBe('')
  } finally {
    owner.dispose()
  }
})

test('a newer JSON export aborts pending native link compression and clears busy state @pure', async () => {
  const document = publicPlayerDocument()
  await withDownloadBoundary(async (downloads) => {
    await withGatedNativeCompression(async (gate) => {
      let prepareCount = 0
      const owner = usePlayerFileExports({
        prepare: async () => {
          prepareCount += 1
          return preparedExport(document)
        },
      })
      try {
        const linkAction = owner.generatePlayerLink('https://reader.example.test/player')
        await gate.started
        expect(owner.playerLinkBusy.value).toBe(true)
        expect(owner.generatedPlayerUrl.value).toBe('')

        await owner.downloadPlayerJson()
        expect(owner.playerLinkBusy.value).toBe(false)
        expect(downloads).toHaveLength(1)
        expect(prepareCount).toBe(2)

        await linkAction
        expect(owner.generatedPlayerUrl.value).toBe('')
        expect(owner.playerLinkStatus.value).toBe('')
        expect(owner.playerExportError.value).toBe('')
      } finally {
        owner.dispose()
      }
    })
  })
})

test('a stale applied context cannot publish a URL after native compression completes @pure', async () => {
  const document = publicPlayerDocument()
  await withGatedNativeCompression(async (gate) => {
    let current = true
    const owner = usePlayerFileExports({
      prepare: async () => preparedExport(document, () => current),
    })
    try {
      const linkAction = owner.generatePlayerLink('https://reader.example.test/player')
      await gate.started
      expect(owner.playerLinkBusy.value).toBe(true)

      current = false
      gate.release()
      await linkAction
      expect(owner.generatedPlayerUrl.value).toBe('')
      expect(owner.playerLinkBusy.value).toBe(false)
      expect(owner.playerLinkStatus.value).toBe('')
      expect(owner.playerExportError.value).toBe('')
    } finally {
      owner.dispose()
    }
  })
})
