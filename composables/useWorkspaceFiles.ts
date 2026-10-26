/**
 * Browser file actions use domain codecs and import preparation; persistence and selection remain page-owned.
 */
import { readonly, ref, type Ref } from 'vue'
import {
  exportJumpCluster,
  exportStarSystem,
  prepareJsonImport,
  type JsonImportSummary,
  type LocalWorkspace,
  type StarSystem,
} from '../domain/workspace'
import { jsonImportReviewEffects } from '../domain/workspace-json-import'
import type { MapImageExporter, MapImageFormat, MapImagePalette } from '../utils/map-image-export'

type MapKind = 'jump-cluster' | 'star-system'

interface WorkspaceFileActionsOptions {
  workspace: Readonly<Ref<LocalWorkspace | null>>
  selectedSystem: Readonly<Ref<StarSystem | undefined>>
  applyWorkspace: (nextWorkspace: LocalWorkspace) => { durable: Promise<void> }
  getFieldDefinitionImportConflict: (candidate: LocalWorkspace) => { message: string } | null
  resolveImportDefinitionChanges: (existingFieldIds: string[]) => Promise<boolean>
}

interface ImportReviewState {
  open: boolean
  suspended: boolean
  summary: JsonImportSummary | null
  confirming: boolean
  error: string
  fieldConflict: { message: string } | null
}

interface ImportEpoch {
  workspaceId: string
  clusterId: string
  operation: number
}

/**
 * Composes local JSON/image export and copy-import actions around the page's commit and selection callbacks.
 * @param options Current workspace/selection refs and page-owned persistence, transition, and import callbacks.
 * @returns Export/import status refs and event handlers; failures are exposed through those status refs.
 */
export function useWorkspaceFiles({
  workspace,
  selectedSystem,
  applyWorkspace,
  getFieldDefinitionImportConflict,
  resolveImportDefinitionChanges,
}: WorkspaceFileActionsOptions) {
  const exportError = ref('')
  const importError = ref('')
  const mutableImportReview = ref<ImportReviewState>({
    open: false,
    suspended: false,
    summary: null,
    confirming: false,
    error: '',
    fieldConflict: null,
  })
  let operationCounter = 0
  let currentImportEpoch: ImportEpoch | null = null
  let importContent: unknown
  let importReviewSignature = ''

  const importReview = readonly(mutableImportReview)

  function errorText(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
  }

  /**
   * Freezes parsed JSON recursively so the reviewed source cannot drift while a modal is open.
   * @param value Parsed source JSON.
   * @returns The same JSON value with all objects and arrays frozen.
   */
  function freezeJson<T>(value: T): T {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      for (const child of Object.values(value)) freezeJson(child)
      Object.freeze(value)
    }
    return value
  }

  function epochIsCurrent(epoch: ImportEpoch): boolean {
    const currentWorkspace = workspace.value
    return importOperationIsCurrent(epoch)
      && currentWorkspace !== null
      && currentWorkspace.id === epoch.workspaceId
      && currentWorkspace.cluster.id === epoch.clusterId
  }

  function importOperationIsCurrent(epoch: ImportEpoch): boolean {
    return currentImportEpoch?.operation === epoch.operation
      && currentImportEpoch.workspaceId === epoch.workspaceId
      && currentImportEpoch.clusterId === epoch.clusterId
  }

  function abandonStaleImport(epoch: ImportEpoch): void {
    if (importOperationIsCurrent(epoch) && !epochIsCurrent(epoch)) clearImportReview()
  }

  function clearImportReview(): void {
    operationCounter += 1
    currentImportEpoch = null
    importContent = undefined
    importReviewSignature = ''
    mutableImportReview.value = {
      open: false,
      suspended: false,
      summary: null,
      confirming: false,
      error: '',
      fieldConflict: null,
    }
  }

  function refreshImportReview(
    summary: JsonImportSummary,
    signature: string,
    error: string,
    fieldConflict: { message: string } | null = null,
  ): void {
    importReviewSignature = signature
    mutableImportReview.value.summary = summary
    mutableImportReview.value.error = error
    mutableImportReview.value.fieldConflict = fieldConflict
  }

  /**
   * Triggers a browser download and revokes its object URL after the click has been dispatched.
   * @param filename Suggested download name.
   * @param blob File contents and media type.
   */
  function downloadFile(filename: string, blob: Blob): void {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    try {
      link.href = url
      link.download = filename
      document.body.append(link)
      link.click()
    } finally {
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
    }
  }

  /**
   * Serializes a value as indented JSON and starts its browser download.
   * @param filename Suggested download name.
   * @param value JSON-serializable payload.
   * @throws If JSON.stringify cannot produce a string.
   */
  function downloadJsonFile(filename: string, value: unknown): void {
    const json = JSON.stringify(value, null, 2)
    if (json === undefined) {
      throw new Error('Could not serialize the map as JSON.')
    }
    downloadFile(filename, new Blob([json], { type: 'application/json' }))
  }

  /**
   * Builds a download name with filesystem-reserved characters replaced.
   * @param name Map name supplied by workspace data.
   * @param kind Map format suffix distinguishing cluster from system files.
   * @param extension File extension without a leading dot.
   * @returns Sanitized filename ending in the map kind and extension.
   */
  function exportFileName(
    name: string,
    kind: MapKind,
    extension = 'json',
  ): string {
    const safeName = name.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-').trim() // eslint-disable-line no-control-regex -- Replace C0 controls because they cannot appear in downloaded filenames.
    return `${safeName || 'map'}-${kind}.${extension}`
  }

  /**
   * Exports the current complete Cluster JSON; serialization/download failures populate exportError.
   */
  function downloadClusterJson(): void {
    const currentWorkspace = workspace.value
    if (!currentWorkspace) return

    try {
      downloadJsonFile(
        exportFileName(currentWorkspace.cluster.name, 'jump-cluster'),
        exportJumpCluster(currentWorkspace),
      )
      exportError.value = ''
    } catch (error) {
      exportError.value = errorText(error)
    }
  }

  /**
   * Exports the selected system with shared field settings and only its durable Orbit/object layout.
   * Serialization/download failures populate exportError.
   */
  function downloadSystemJson(): void {
    const currentWorkspace = workspace.value
    const system = selectedSystem.value
    if (!currentWorkspace || !system) return

    try {
      downloadJsonFile(
        exportFileName(system.name, 'star-system'),
        exportStarSystem(currentWorkspace, system.id),
      )
      exportError.value = ''
    } catch (error) {
      exportError.value = errorText(error)
    }
  }

  /**
   * Exports an image through the renderer handle and reports failures in exportError.
   * @param map Mounted renderer, or null before its component handle is available.
   * @param name Map name used in the download filename.
   * @param kind Map type used in the filename.
   * @param format Requested image encoding.
   * @returns A promise that resolves after download dispatch; export errors are caught and exposed.
   */
  async function downloadMapImage(
    map: MapImageExporter | null,
    name: string | undefined,
    kind: MapKind,
    format: MapImageFormat,
    palette: MapImagePalette = 'active',
  ): Promise<void> {
    if (!map || !name) return

    try {
      downloadFile(exportFileName(name, kind, format), await map.exportImage(format, palette))
      exportError.value = ''
    } catch (error) {
      exportError.value = errorText(error)
    }
  }

  /**
   * Parses and validates a selected JSON file before opening the independent-copy review.
   * The input is cleared immediately so selecting the same file again still emits a change event.
   * @param event File-input change event.
   * @returns A promise that resolves after validation; invalid files populate importError.
   */
  async function importJsonFile(event: Event): Promise<void> {
    const input = event.target
    if (!(input instanceof HTMLInputElement)) return
    const file = input.files?.[0]
    input.value = ''
    const initialWorkspace = workspace.value
    if (!file || !initialWorkspace) return

    importError.value = ''
    clearImportReview()
    const epoch: ImportEpoch = {
      workspaceId: initialWorkspace.id,
      clusterId: initialWorkspace.cluster.id,
      operation: ++operationCounter,
    }
    currentImportEpoch = epoch
    try {
      let content: unknown
      try {
        content = freezeJson(JSON.parse(await file.text()))
      } catch (error) {
        throw new Error(`The selected file is not valid JSON: ${errorText(error)}`, { cause: error })
      }
      if (!epochIsCurrent(epoch)) {
        abandonStaleImport(epoch)
        return
      }
      const currentWorkspace = workspace.value
      if (!currentWorkspace) return
      const prepared = prepareJsonImport(currentWorkspace, content)
      const effects = jsonImportReviewEffects(currentWorkspace, content, prepared)
      if (!epochIsCurrent(epoch)) return

      importContent = content
      importReviewSignature = effects.signature
      mutableImportReview.value = {
        open: true,
        suspended: false,
        summary: prepared.summary,
        confirming: false,
        error: '',
        fieldConflict: null,
      }
    } catch (error) {
      if (epochIsCurrent(epoch)) importError.value = errorText(error)
      else abandonStaleImport(epoch)
    }
  }

  /**
   * Confirms the current import review against latest applied memory and publishes one independent copy.
   * Changed review effects are refreshed and require a second explicit confirmation.
   */
  async function confirmJsonImport(): Promise<void> {
    const epoch = currentImportEpoch
    const content = importContent
    if (!epoch || content === undefined || !mutableImportReview.value.open
      || mutableImportReview.value.confirming) return
    if (!epochIsCurrent(epoch)) {
      clearImportReview()
      return
    }

    mutableImportReview.value.confirming = true
    mutableImportReview.value.error = ''
    mutableImportReview.value.fieldConflict = null

    try {
      const firstWorkspace = workspace.value
      if (!firstWorkspace) return
      const firstPrepared = prepareJsonImport(firstWorkspace, content)
      const firstEffects = jsonImportReviewEffects(firstWorkspace, content, firstPrepared)
      const initialConflict = getFieldDefinitionImportConflict(firstPrepared.workspace)
      if (firstEffects.signature !== importReviewSignature) {
        refreshImportReview(
          firstPrepared.summary,
          firstEffects.signature,
          'The workspace changed while you reviewed this import. Review the updated effects before importing.',
          initialConflict,
        )
        return
      }

      if (initialConflict) {
        mutableImportReview.value.fieldConflict = initialConflict
        return
      }

      if (firstEffects.existingFieldIds.length) {
        const resolved = await resolveImportDefinitionChanges(firstEffects.existingFieldIds)
        if (!epochIsCurrent(epoch)) {
          abandonStaleImport(epoch)
          return
        }
        if (!resolved) return

        const latestWorkspace = workspace.value
        if (!latestWorkspace) {
          abandonStaleImport(epoch)
          return
        }
        const latestPrepared = prepareJsonImport(latestWorkspace, content)
        const latestEffects = jsonImportReviewEffects(latestWorkspace, content, latestPrepared)
        const latestConflict = getFieldDefinitionImportConflict(latestPrepared.workspace)
        if (latestEffects.signature !== importReviewSignature) {
          refreshImportReview(
            latestPrepared.summary,
            latestEffects.signature,
            'The workspace changed while resolving a draft. Review the updated effects before importing.',
            latestConflict,
          )
          return
        }
        if (latestConflict) {
          mutableImportReview.value.fieldConflict = latestConflict
          return
        }
      }

      if (!epochIsCurrent(epoch)) return
      const finalWorkspace = workspace.value
      if (!finalWorkspace) return
      const finalPrepared = prepareJsonImport(finalWorkspace, content)
      const finalEffects = jsonImportReviewEffects(finalWorkspace, content, finalPrepared)
      const finalConflict = getFieldDefinitionImportConflict(finalPrepared.workspace)
      if (finalEffects.signature !== importReviewSignature) {
        refreshImportReview(
          finalPrepared.summary,
          finalEffects.signature,
          'The workspace changed before this import could be applied. Review the updated effects before importing.',
          finalConflict,
        )
        return
      }
      if (finalConflict) {
        mutableImportReview.value.fieldConflict = finalConflict
        return
      }
      if (!epochIsCurrent(epoch)) return

      const { durable } = applyWorkspace(finalPrepared.workspace)
      clearImportReview()
      void durable.catch(() => {})
    } catch (error) {
      if (epochIsCurrent(epoch)) mutableImportReview.value.error = errorText(error)
      else abandonStaleImport(epoch)
    } finally {
      if (epochIsCurrent(epoch) && mutableImportReview.value.open) {
        mutableImportReview.value.confirming = false
      }
    }
  }

  /** Closes and invalidates the current review without applying its candidate. */
  function cancelJsonImport(): void {
    clearImportReview()
    importError.value = ''
  }

  /** Temporarily hides the review while an authoritative draft or guard is open. */
  function suspendImportReview(): void {
    if (mutableImportReview.value.open) mutableImportReview.value.suspended = true
  }

  /** Hides the review before the parent opens its authoritative Fields editor. */
  function reviewImportFields(): void {
    suspendImportReview()
  }

  /** Resumes a suspended review; confirmation rechecks any Fields conflict before publishing. */
  function resumeImportReview(): void {
    if (!mutableImportReview.value.open) return
    mutableImportReview.value.suspended = false
  }

  return {
    exportError,
    importError,
    downloadClusterJson,
    downloadSystemJson,
    downloadMapImage,
    importJsonFile,
    importReview,
    confirmJsonImport,
    cancelJsonImport,
    reviewImportFields,
    suspendImportReview,
    resumeImportReview,
  }
}
