import { getCurrentScope, onScopeDispose, ref } from 'vue'
import type { PlayerClusterDocument } from '../domain/player-projection'
import { PlayerDocumentError, serializePlayerJson } from '../domain/player-codec'
import type { CurrentPlayerMapScene } from '../domain/player-scene'
import type { MapImageFormat, MapImagePalette } from '../utils/map-image-export'
import { downloadBlob, exportFileName } from '../utils/browser-download'
import { exportPlayerMapImage } from '../utils/player-map-image-export'
import { createPlayerShareUrl, PlayerShareLinkError } from '../utils/player-share-link'

interface PreparedPlayerExport {
  document: PlayerClusterDocument
  scene: CurrentPlayerMapScene | null
  /** Rechecks the applied editor context captured after preflight. */
  isCurrent: () => boolean
}

interface PlayerFileExportsOptions {
  /** Resolves preflight and one applied public projection for the requested operation. */
  prepare: () => Promise<PreparedPlayerExport | null>
}

const GENERIC_EXPORT_ERROR = 'The player export could not be completed.'
const COPY_PLAYER_LINK_ERROR = 'Copy failed. The link is still available below; select and copy it manually, or retry.'
const PLAYER_LINK_JSON_FALLBACK = 'Use Export player JSON above to share this snapshot.'
const SYSTEM_NOT_REVEALED_ERROR = 'The current system is not revealed for player image export.'
const EMPTY_IMAGE_ERROR = 'This player map has no public features to export as an image.'

/**
 * Owns player-file action status and cancels stale async work when a newer action or scope wins.
 * Browser APIs are used only from invoked download, share, and clipboard actions, never during setup or SSR.
 */
export function usePlayerFileExports({ prepare }: PlayerFileExportsOptions) {
  const playerExportError = ref('')
  const generatedPlayerUrl = ref('')
  const playerLinkBusy = ref(false)
  const playerLinkStatus = ref('')
  let operation = 0
  let playerLinkAbort: AbortController | null = null
  let copyAttempt = 0
  let artifactIdentity = 0
  let disposed = false

  function isCurrent(activeOperation: number, prepared?: PreparedPlayerExport | null): boolean {
    return !disposed
      && operation === activeOperation
      && (prepared === undefined || prepared === null || prepared.isCurrent())
  }

  function isOperationActive(activeOperation: number): boolean {
    return !disposed && operation === activeOperation
  }

  function publishError(activeOperation: number, error: unknown, prepared?: PreparedPlayerExport | null): void {
    if (!isCurrent(activeOperation, prepared)) return
    playerExportError.value = error instanceof PlayerDocumentError ? error.message : GENERIC_EXPORT_ERROR
  }

  function publishFixedError(
    activeOperation: number,
    message: string,
    prepared: PreparedPlayerExport,
  ): void {
    if (!isCurrent(activeOperation, prepared)) return
    playerExportError.value = message
  }

  function sceneHasPublicFeatures(scene: CurrentPlayerMapScene): boolean {
    return scene.kind === 'jump-cluster'
      ? scene.document.systems.length > 0 || scene.document.routes.length > 0
      : scene.document.objects.length > 0
  }

  function startExport(): number {
    playerLinkAbort?.abort()
    playerLinkAbort = null
    playerLinkBusy.value = false
    playerLinkStatus.value = ''
    playerExportError.value = ''
    return ++operation
  }

  function sceneFileName(
    document: PlayerClusterDocument,
    scene: CurrentPlayerMapScene,
    format: MapImageFormat,
  ): string {
    const isSystem = scene.kind === 'star-system'
    const publicName = isSystem ? scene.label : document.title
    const kind = isSystem ? 'star-system' : 'jump-cluster'
    return exportFileName(`${publicName}-player`, kind, format)
  }

  async function downloadPlayerJson(): Promise<void> {
    if (disposed) return
    const activeOperation = startExport()
    let prepared: PreparedPlayerExport | null = null
    try {
      prepared = await prepare()
      if (!isCurrent(activeOperation, prepared) || !prepared) return

      const json = serializePlayerJson(prepared.document)
      if (!isCurrent(activeOperation, prepared)) return
      const blob = new Blob([json], { type: 'application/json' })
      if (!isCurrent(activeOperation, prepared)) return
      downloadBlob(exportFileName(`${prepared.document.title}-player`, 'jump-cluster'), blob)
    } catch (error) {
      publishError(activeOperation, error, prepared)
    }
  }

  async function downloadPlayerImage(format: MapImageFormat, palette: MapImagePalette): Promise<void> {
    if (disposed) return
    const activeOperation = startExport()
    let prepared: PreparedPlayerExport | null = null
    try {
      prepared = await prepare()
      if (!isCurrent(activeOperation, prepared) || !prepared) return
      if (!prepared.scene) {
        publishFixedError(activeOperation, SYSTEM_NOT_REVEALED_ERROR, prepared)
        return
      }
      if (!sceneHasPublicFeatures(prepared.scene)) {
        publishFixedError(activeOperation, EMPTY_IMAGE_ERROR, prepared)
        return
      }

      const blob = await exportPlayerMapImage({
        scene: prepared.scene,
        format,
        palette,
        isCurrent: () => isCurrent(activeOperation, prepared),
      })
      if (!isCurrent(activeOperation, prepared) || !blob) return
      const filename = sceneFileName(prepared.document, prepared.scene, format)
      if (!isCurrent(activeOperation, prepared)) return
      downloadBlob(filename, blob)
    } catch (error) {
      publishError(activeOperation, error, prepared)
    }
  }

  async function generatePlayerLink(readerUrl: string): Promise<void> {
    if (disposed) return
    const activeOperation = startExport()
    const abortController = new AbortController()
    playerLinkAbort = abortController
    generatedPlayerUrl.value = ''
    artifactIdentity += 1
    copyAttempt += 1
    playerLinkBusy.value = true
    let prepared: PreparedPlayerExport | null = null

    try {
      prepared = await prepare()
      if (!isCurrent(activeOperation, prepared) || !prepared) return

      const url = await createPlayerShareUrl(prepared.document, readerUrl, { signal: abortController.signal })
      if (!isCurrent(activeOperation, prepared) || abortController.signal.aborted) return

      generatedPlayerUrl.value = url
      artifactIdentity += 1
      playerLinkStatus.value = 'Player link ready. This is an immutable snapshot anyone with the link can read and copy.'
    } catch (error) {
      if (!isCurrent(activeOperation, prepared)) return
      if (error instanceof PlayerShareLinkError) {
        playerExportError.value = error.message
        if (error.code === 'too-large' || error.code === 'unavailable') {
          playerLinkStatus.value = PLAYER_LINK_JSON_FALLBACK
        }
      } else {
        publishError(activeOperation, error, prepared)
      }
    } finally {
      if (isOperationActive(activeOperation)) {
        playerLinkBusy.value = false
        if (playerLinkAbort === abortController) playerLinkAbort = null
      }
    }
  }

  async function copyPlayerLink(): Promise<void> {
    if (disposed || playerLinkBusy.value || !generatedPlayerUrl.value) return
    const activeAttempt = ++copyAttempt
    const activeArtifact = artifactIdentity
    const url = generatedPlayerUrl.value
    const isCurrentCopy = (): boolean => !disposed
      && copyAttempt === activeAttempt
      && artifactIdentity === activeArtifact
      && generatedPlayerUrl.value === url

    playerExportError.value = ''
    playerLinkStatus.value = ''
    try {
      if (typeof navigator === 'undefined' || typeof navigator.clipboard?.writeText !== 'function') {
        throw new Error('Clipboard unavailable.')
      }
      await navigator.clipboard.writeText(url)
      if (isCurrentCopy()) {
        playerLinkStatus.value = 'Player link copied. Anyone with the link can read and copy this snapshot.'
      }
    } catch {
      if (isCurrentCopy()) {
        playerLinkStatus.value = COPY_PLAYER_LINK_ERROR
      }
    }
  }

  function dispose(): void {
    disposed = true
    operation += 1
    playerLinkAbort?.abort()
    playerLinkAbort = null
    playerLinkBusy.value = false
    copyAttempt += 1
  }

  if (getCurrentScope()) onScopeDispose(dispose)

  return {
    playerExportError,
    generatedPlayerUrl,
    playerLinkBusy,
    playerLinkStatus,
    downloadPlayerJson,
    downloadPlayerImage,
    generatePlayerLink,
    copyPlayerLink,
    dispose,
  }
}
