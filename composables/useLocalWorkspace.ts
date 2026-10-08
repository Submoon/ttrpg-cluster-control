/**
 * Shared browser workspace state with a single route-level owner for ordered IndexedDB writes.
 * Nuxt state is shared by key, but the write queue and stale-status revision belong to each invocation.
 */
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

/**
 * Exposes the hydrated workspace and the only load/save boundary used by the editor page.
 * Call once for the page owner: separate invocations share Nuxt state but not write ordering.
 * @returns Read-only workspace and status views plus hydration and commit operations.
 */
export function useLocalWorkspace() {
  const workspace = useState<LocalWorkspace | null>('local-workspace', () => null)
  const hydrationState = useState<HydrationState>('local-workspace-hydration', () => 'loading')
  const loadError = useState<string | null>('local-workspace-load-error', () => null)
  const saveState = useState<SaveState>('local-workspace-save-state', () => 'idle')
  const saveError = useState<string | null>('local-workspace-save-error', () => null)
  // Queue and revision are per invocation, so the page must keep one composable owner.
  let saveQueue: Promise<void> = Promise.resolve()
  let revision = 0

  /**
   * Loads and validates the durable workspace, publishing a ready or load-error state.
   * @returns A promise that settles after the IndexedDB read and schema restoration.
   */
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

  /**
   * Publishes a workspace in memory immediately, then serializes its durable write.
   * A failed write leaves the in-memory workspace intact; only the newest revision controls visible save status.
   * @param nextWorkspace Complete next workspace snapshot to publish and persist.
   * @returns A promise that settles when this revision's IndexedDB write completes.
   * @throws If hydration is incomplete or this revision's durable write fails.
   */
  async function commit(nextWorkspace: LocalWorkspace): Promise<void> {
    if (hydrationState.value !== 'ready') {
      throw new Error('The local workspace must finish loading before it can be saved.')
    }

    const currentRevision = ++revision
    // Publish immediately; saveState separately reports whether this revision reached IndexedDB.
    workspace.value = nextWorkspace
    saveState.value = 'saving'
    saveError.value = null

    // Chain durable writes in commit order.
    const write = saveQueue.then(() => saveWorkspace(nextWorkspace))
    // Keep the queue alive; this commit still awaits its write and rethrows its own failure.
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
