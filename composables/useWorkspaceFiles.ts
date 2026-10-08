import { ref, type Ref } from 'vue'
import {
  exportJumpCluster,
  exportStarSystem,
  prepareJsonImport,
  type JsonImportSummary,
  type LocalWorkspace,
  type StarSystem,
} from '../domain/workspace'
import type { MapImageExporter, MapImageFormat } from '../utils/map-image-export'

type MapKind = 'jump-cluster' | 'star-system'

interface WorkspaceFileActionsOptions {
  workspace: Readonly<Ref<LocalWorkspace | null>>
  selectedSystem: Readonly<Ref<StarSystem | undefined>>
  commit: (nextWorkspace: LocalWorkspace) => Promise<void>
  confirmDiscardInspectorEdits: () => boolean
  onImported: (firstAddedSystemId: string | undefined) => void
}

export function useWorkspaceFiles({
  workspace,
  selectedSystem,
  commit,
  confirmDiscardInspectorEdits,
  onImported,
}: WorkspaceFileActionsOptions) {
  const exportError = ref('')
  const importError = ref('')

  function errorText(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
  }

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

  function downloadJsonFile(filename: string, value: unknown): void {
    const json = JSON.stringify(value, null, 2)
    if (json === undefined) {
      throw new Error('Could not serialize the map as JSON.')
    }
    downloadFile(filename, new Blob([json], { type: 'application/json' }))
  }

  function exportFileName(
    name: string,
    kind: MapKind,
    extension = 'json',
  ): string {
    const safeName = name.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-').trim()
    return `${safeName || 'map'}-${kind}.${extension}`
  }

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

  async function downloadMapImage(
    map: MapImageExporter | null,
    name: string | undefined,
    kind: MapKind,
    format: MapImageFormat,
  ): Promise<void> {
    if (!map || !name) return

    try {
      downloadFile(exportFileName(name, kind, format), await map.exportImage(format))
      exportError.value = ''
    } catch (error) {
      exportError.value = errorText(error)
    }
  }

  function importPreview(summary: JsonImportSummary): string {
    const collisionLines = summary.idCollisions.length
      ? summary.idCollisions.map(collision =>
          `- ${collision.entity} "${collision.name}" [${collision.id}]`,
        )
      : ['- None']
    const matchLines = summary.possibleMatches.length
      ? summary.possibleMatches.map(match =>
          `- ${match.entity} "${match.name}" in "${match.existingSystem}" (${match.reason})`,
        )
      : ['- None']
    return [
      `Import this ${summary.type === 'cluster' ? 'Jump Cluster' : 'star system'} as an independent copy?`,
      '',
      `Star systems: ${summary.systems}`,
      `Map objects: ${summary.objects}`,
      `Orbits: ${summary.orbits}`,
      `Jump Routes: ${summary.routes}`,
      `Custom fields: ${summary.customFields}`,
      '',
      `Original-ID collisions (${summary.idCollisions.length}):`,
      ...collisionLines,
      '',
      `Possible existing matches by name or location key (${summary.possibleMatches.length}):`,
      ...matchLines,
      '',
      'Map entities remain separate copies and receive new IDs. Compatible custom field definitions are reused and their applicability targets are combined.',
    ].join('\n')
  }

  async function importJsonFile(event: Event): Promise<void> {
    const input = event.target
    if (!(input instanceof HTMLInputElement)) return
    const file = input.files?.[0]
    input.value = ''
    if (!file || !workspace.value || !confirmDiscardInspectorEdits()) return

    importError.value = ''
    try {
      let content: unknown
      try {
        content = JSON.parse(await file.text())
      } catch (error) {
        throw new Error(`The selected file is not valid JSON: ${errorText(error)}`)
      }
      const prepared = prepareJsonImport(workspace.value, content)
      if (!window.confirm(importPreview(prepared.summary))) return

      await commit(prepared.workspace)
      onImported(prepared.addedSystemIds[0])
    } catch (error) {
      importError.value = errorText(error)
    }
  }

  return {
    exportError,
    importError,
    downloadClusterJson,
    downloadSystemJson,
    downloadMapImage,
    importJsonFile,
  }
}
