import { computed, readonly } from 'vue'
import {
  type LocalWorkspace,
} from '../domain/workspace'
import { loadWorkspace, saveWorkspace } from '../utils/workspace-storage'

type HydrationState = 'loading' | 'ready' | 'error'
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function useLocalWorkspace() {
  const workspace = useState<LocalWorkspace | null>('local-workspace', () => null)
  const hydrationState = useState<HydrationState>('local-workspace-hydration', () => 'loading')
  const loadError = useState<string | null>('local-workspace-load-error', () => null)
  const saveState = useState<SaveState>('local-workspace-save-state', () => 'idle')
  const saveError = useState<string | null>('local-workspace-save-error', () => null)
  let saveQueue: Promise<void> = Promise.resolve()
  let revision = 0

  async function hydrate(): Promise<void> {
    hydrationState.value = 'loading'
    loadError.value = null

    try {
      workspace.value = await loadWorkspace()
      saveState.value = workspace.value ? 'saved' : 'idle'
      saveError.value = null
      hydrationState.value = 'ready'
    } catch (error) {
      workspace.value = null
      hydrationState.value = 'error'
      loadError.value = errorText(error)
    }
  }

  async function commit(nextWorkspace: LocalWorkspace): Promise<void> {
    if (hydrationState.value !== 'ready') {
      throw new Error('The local workspace must finish loading before it can be saved.')
    }

    const currentRevision = ++revision
    workspace.value = nextWorkspace
    saveState.value = 'saving'
    saveError.value = null

    const write = saveQueue.then(() => saveWorkspace(nextWorkspace))
    saveQueue = write.catch(() => undefined)

    try {
      await write
      if (currentRevision === revision) {
        saveState.value = 'saved'
      }
    } catch (error) {
      if (currentRevision === revision) {
        saveState.value = 'error'
        saveError.value = errorText(error)
      }
      throw error
    }
  }

  return {
    workspace: computed(() => workspace.value),
    hydrationState: readonly(hydrationState),
    loadError: readonly(loadError),
    saveState: readonly(saveState),
    saveError: readonly(saveError),
    hydrate,
    commit,
  }
}
