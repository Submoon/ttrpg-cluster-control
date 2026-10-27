/**
 * Shared browser workspace state with a single route-level owner for ordered IndexedDB writes.
 * Nuxt state is shared by key, but the write queue and stale-status revision belong to each invocation.
 */
import { computed, readonly, ref } from 'vue'
import type { LocalWorkspace } from '../domain/workspace'
import {
  createWorkspaceSnapshot,
  loadWorkspace,
  restoreWorkspaceBackup,
  saveWorkspace,
} from '../utils/workspace-storage'

type HydrationState = 'loading' | 'ready' | 'error'
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Exposes the hydrated workspace and the only load/save boundary used by the editor page.
 * Call once for the page owner: separate invocations share Nuxt state but not write ordering.
 * @returns Read-only workspace and status views plus hydration, memory-apply, and save-recovery operations.
 */
export function useLocalWorkspace() {
  const workspace = useState<LocalWorkspace | null>('local-workspace', () => null)
  const hydrationState = useState<HydrationState>('local-workspace-hydration', () => 'loading')
  const loadError = useState<string | null>('local-workspace-load-error', () => null)
  const recoveryError = useState<string | null>('local-workspace-recovery-error', () => null)
  const saveState = useState<SaveState>('local-workspace-save-state', () => 'idle')
  const saveError = useState<string | null>('local-workspace-save-error', () => null)
  // Queue and revision are per invocation, so the page must keep one composable owner.
  let saveQueue: Promise<void> = Promise.resolve()
  let saveRevision = 0
  const appliedRevision = ref(0)

  /**
   * Loads and validates the durable workspace, publishing a ready or load-error state.
   * @returns A promise that settles after the IndexedDB read and schema restoration.
   */
  async function hydrate(): Promise<void> {
    hydrationState.value = 'loading'
    loadError.value = null
    recoveryError.value = null

    try {
      workspace.value = await loadWorkspace()
      appliedRevision.value += 1
      saveState.value = workspace.value ? 'saved' : 'idle'
      saveError.value = null
      hydrationState.value = 'ready'
    } catch (error) {
      workspace.value = null
      hydrationState.value = 'error'
      loadError.value = errorText(error)
    }
  }

  /** Enqueues a detached snapshot and lets only its newest revision update visible save feedback. */
  function enqueueSnapshot(snapshot: LocalWorkspace): Promise<void> {
    const currentRevision = ++saveRevision
    saveState.value = 'saving'

    const write = saveQueue.then(() => saveWorkspace(snapshot))
    saveQueue = write.catch(() => undefined)

    return write.then(
      () => {
        if (currentRevision === saveRevision) {
          saveState.value = 'saved'
          saveError.value = null
        }
      },
      error => {
        if (currentRevision === saveRevision) {
          saveState.value = 'error'
          saveError.value = errorText(error)
        }
        throw error
      },
    )
  }

  /**
   * Validates and publishes a workspace in memory once, then enqueues its durable snapshot.
   * @param nextWorkspace Complete next workspace value to validate, detach, publish, and persist.
   * @returns The independent durable acknowledgement for this applied snapshot.
   * @throws Before publication if hydration is incomplete or validation/detachment fails.
   */
  function applyWorkspace(nextWorkspace: LocalWorkspace): { durable: Promise<void> } {
    if (hydrationState.value !== 'ready') {
      throw new Error('The local workspace must finish loading before it can be saved.')
    }

    const snapshot = createWorkspaceSnapshot(nextWorkspace)
    workspace.value = snapshot
    appliedRevision.value += 1
    return { durable: enqueueSnapshot(snapshot) }
  }

  /** Legacy persistence adapter; callers keep observing the durable rejection through await/catch. */
  async function commit(nextWorkspace: LocalWorkspace): Promise<void> {
    const { durable } = applyWorkspace(nextWorkspace)
    await durable
  }

  /** Retries durability for a detached snapshot of current applied memory without publishing it again. */
  function retrySaveLatest(): Promise<void> {
    if (hydrationState.value !== 'ready' || !workspace.value) {
      throw new Error('There is no applied workspace available to save.')
    }
    return enqueueSnapshot(createWorkspaceSnapshot(workspace.value))
  }

  /**
   * Restores the saved backup and publishes it only after IndexedDB commits the replacement.
   * A missing or invalid backup leaves the workspace unavailable and reports a recovery error.
   */
  async function restoreBackup(): Promise<void> {
    hydrationState.value = 'loading'
    recoveryError.value = null

    try {
      const restored = await restoreWorkspaceBackup()
      if (!restored) {
        throw new Error('No local backup is available to restore.')
      }

      workspace.value = restored
      appliedRevision.value += 1
      saveState.value = 'saved'
      saveError.value = null
      loadError.value = null
      hydrationState.value = 'ready'
    } catch (error) {
      workspace.value = null
      recoveryError.value = errorText(error)
      hydrationState.value = 'error'
    }
  }

  return {
    workspace: computed(() => workspace.value),
    appliedRevision: readonly(appliedRevision),
    hydrationState: readonly(hydrationState),
    loadError: readonly(loadError),
    recoveryError: readonly(recoveryError),
    saveState: readonly(saveState),
    saveError: readonly(saveError),
    hydrate,
    applyWorkspace,
    commit,
    retrySaveLatest,
    restoreBackup,
  }
}
