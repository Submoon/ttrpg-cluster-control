import { expect, test } from '@playwright/test'
import { computed, ref } from 'vue'
import { createLocalWorkspace, type LocalWorkspace } from '../domain/workspace'
import { useWorkspaceFiles } from '../composables/useWorkspaceFiles'
import { createWorkspaceMutationExecutor } from '../composables/editor-workflows/workspace-mutations'
import type { MapImageExporter } from '../utils/map-image-export'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(complete => { resolve = complete })
  return { promise, resolve }
}

test('image export aborts if the renderer changes while operation preflight is waiting @pure', async () => {
  const workspace = ref<LocalWorkspace | null>(createLocalWorkspace('Kestrel Reach', 'Vesper'))
  const preflight = deferred<boolean>()
  let currentMap: MapImageExporter | null = null
  let exports = 0
  const requestedMap: MapImageExporter = {
    exportImage: async () => {
      exports += 1
      return new Blob(['requested map'], { type: 'image/svg+xml' })
    },
  }
  const replacementMap: MapImageExporter = {
    exportImage: async () => {
      exports += 1
      return new Blob(['replacement map'], { type: 'image/svg+xml' })
    },
  }
  const mutations = createWorkspaceMutationExecutor({
    getWorkspace: () => workspace.value,
    getRevision: () => 0,
    publishWorkspace: next => {
      workspace.value = next
      return { durable: Promise.resolve() }
    },
  })
  const files = useWorkspaceFiles({
    workspace,
    selectedSystem: computed(() => workspace.value?.cluster.systems[0]),
    mutations,
    getCurrentMapImage: kind => kind === 'star-system'
      ? { map: currentMap, name: workspace.value?.cluster.systems[0]?.name }
      : null,
    getFieldDefinitionImportConflict: () => null,
    resolveImportDefinitionChanges: async () => true,
    beforeWorkspaceOperation: () => preflight.promise,
  })
  currentMap = requestedMap

  const pendingExport = files.downloadMapImage(requestedMap, 'Vesper', 'star-system', 'svg')
  currentMap = replacementMap
  preflight.resolve(true)
  await pendingExport

  expect(exports).toBe(0)
  mutations.dispose()
})
