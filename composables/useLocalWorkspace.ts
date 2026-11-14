/**
 * Shared browser workspace state with a single route-level owner for ordered IndexedDB writes.
 * Nuxt state is shared by key, but the write queue and stale-status revision belong to each invocation.
 */
import { computed, readonly, ref, shallowRef } from 'vue'
import type { LocalWorkspace } from '../domain/workspace'
import {
  createWorkspaceSnapshot,
  readWorkspaceState,
  replaceWorkspaceFromBackup,
  restoreWorkspaceBackupState,
  saveWorkspace,
  type WorkspaceStorageVersion,
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
  const replacementState = useState<'idle' | 'saving'>('local-workspace-replacement-state', () => 'idle')
  const durableVersion = shallowRef<WorkspaceStorageVersion | null>(null)
  // Queue and revision are per invocation, so the page must keep one composable owner.
  let saveQueue: Promise<void> = Promise.resolve()
  let saveRevision = 0
  const appliedRevision = ref(0)
  const savedAppliedRevision = ref<number | null>(null)

  /**
   * Loads and validates the durable workspace, publishing a ready or load-error state.
   * @returns A promise that settles after the IndexedDB read and schema restoration.
   */
  async function hydrate(): Promise<void> {
    hydrationState.value = 'loading'
    savedAppliedRevision.value = null
    loadError.value = null
    recoveryError.value = null
    durableVersion.value = null

    try {
      const stored = await readWorkspaceState()
      durableVersion.value = stored
      if (stored.recordStatus === 'damaged') {
        throw new Error('The saved workspace has an unsupported or damaged format.')
      }
      const restored = stored.workspace
      workspace.value = restored
      appliedRevision.value += 1
      savedAppliedRevision.value = restored ? appliedRevision.value : null
      saveState.value = workspace.value ? 'saved' : 'idle'
      saveError.value = null
      hydrationState.value = 'ready'
    } catch (error) {
      workspace.value = null
      savedAppliedRevision.value = null
      hydrationState.value = 'error'
      loadError.value = errorText(error)
    }
  }

  /** Enqueues a detached snapshot and lets only its newest revision update visible save feedback. */
  function enqueueSnapshot(snapshot: LocalWorkspace, targetAppliedRevision: number): Promise<void> {
    const currentRevision = ++saveRevision
    saveState.value = 'saving'

    const write = saveQueue.then(() => saveWorkspace(snapshot))
    saveQueue = write.then(() => undefined, () => undefined)

    return write.then(
      revision => {
        durableVersion.value = {
          workspace: snapshot,
          revision,
          recordStatus: 'valid',
          fingerprint: null,
          ownerId: snapshot.id,
        }
        if (currentRevision === saveRevision) {
          savedAppliedRevision.value = targetAppliedRevision
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
    if (hydrationState.value !== 'ready' || replacementState.value !== 'idle') {
      throw new Error('The local workspace must finish loading before it can be saved.')
    }

    const snapshot = createWorkspaceSnapshot(nextWorkspace)
    workspace.value = snapshot
    appliedRevision.value += 1
    return { durable: enqueueSnapshot(snapshot, appliedRevision.value) }
  }

  /** Legacy persistence adapter; callers keep observing the durable rejection through await/catch. */
  async function commit(nextWorkspace: LocalWorkspace): Promise<void> {
    const { durable } = applyWorkspace(nextWorkspace)
    await durable
  }

  /** Retries durability for a detached snapshot of current applied memory without publishing it again. */
  function retrySaveLatest(): Promise<void> {
    if (hydrationState.value !== 'ready' || !workspace.value || replacementState.value !== 'idle') {
      throw new Error('There is no applied workspace available to save.')
    }
    return enqueueSnapshot(createWorkspaceSnapshot(workspace.value), appliedRevision.value)
  }

  /** Commits a reviewed complete backup before publishing it; pending writes drain through the same owner queue. */
  async function replaceFromBackup(nextWorkspace: LocalWorkspace, expected: WorkspaceStorageVersion): Promise<void> {
    if (hydrationState.value === 'loading' || replacementState.value !== 'idle') {
      throw new Error('Wait for the current workspace operation to finish before restoring a backup.')
    }
    const snapshot = createWorkspaceSnapshot(nextWorkspace)
    const displacedWorkspace = workspace.value ? createWorkspaceSnapshot(workspace.value) : null
    replacementState.value = 'saving'

    const write = saveQueue.then(async () => {
      const revision = await replaceWorkspaceFromBackup(snapshot, expected, displacedWorkspace)
      return revision
    })
    saveQueue = write.then(() => undefined, () => undefined)

    try {
      const revision = await write
      ++saveRevision
      workspace.value = snapshot
      appliedRevision.value += 1
      savedAppliedRevision.value = appliedRevision.value
      durableVersion.value = {
        workspace: snapshot,
        revision,
        recordStatus: 'valid',
        fingerprint: null,
        ownerId: snapshot.id,
      }
      saveState.value = 'saved'
      saveError.value = null
      loadError.value = null
      recoveryError.value = null
      hydrationState.value = 'ready'
    } finally {
      replacementState.value = 'idle'
    }
  }

  /**
   * Restores the saved backup and publishes it only after IndexedDB commits the replacement.
   * A missing or invalid backup leaves the workspace unavailable and reports a recovery error.
   */
  async function restoreBackup(): Promise<void> {
    hydrationState.value = 'loading'
    savedAppliedRevision.value = null
    recoveryError.value = null

    try {
      const restored = await restoreWorkspaceBackupState(durableVersion.value)
      if (!restored) {
        throw new Error('No local backup is available to restore.')
      }

      workspace.value = restored.workspace
      durableVersion.value = restored
      appliedRevision.value += 1
      savedAppliedRevision.value = appliedRevision.value
      saveState.value = 'saved'
      saveError.value = null
      loadError.value = null
      hydrationState.value = 'ready'
    } catch (error) {
      workspace.value = null
      savedAppliedRevision.value = null
      recoveryError.value = errorText(error)
      hydrationState.value = 'error'
    }
  }

  return {
    workspace: computed(() => workspace.value),
    replacementState: computed(() => replacementState.value),
    durableVersion: computed(() => durableVersion.value),
    appliedRevision: readonly(appliedRevision),
    /** Applied-data revision whose successful durable acknowledgement is current. */
    savedAppliedRevision: readonly(savedAppliedRevision),
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
    replaceFromBackup,
  }
}
