import { computed, onBeforeUnmount, shallowRef, watch, type Ref } from 'vue'
import type { LocalWorkspace } from '../domain/workspace'
import type { SaveState } from './editor-workflows/types'
import type { WorkspaceHistoryTraversalContext } from './editor-workflows/workspace-mutations'
import { createWorkspaceHistoryCoordinator } from './editor-workflows/workspace-mutations'

type HistoryCoordinator = ReturnType<typeof createWorkspaceHistoryCoordinator>
type HistoryOptions = Parameters<typeof createWorkspaceHistoryCoordinator>[0]
export type HistoryCapacityRequest = Parameters<NonNullable<HistoryOptions['confirmCapacity']>>[0]
export type WorkspaceHistoryStatus = ReturnType<HistoryCoordinator['getStatus']>

interface WorkspaceHistoryOptions {
  workspace: Readonly<Ref<LocalWorkspace | null>>
  appliedRevision: Readonly<Ref<number>>
  savedAppliedRevision: Readonly<Ref<number | null>>
  saveState: Readonly<Ref<SaveState>>
  hydrationState: Readonly<Ref<'loading' | 'ready' | 'error'>>
  publishWorkspace: HistoryOptions['publishWorkspace']
  getEditorBlockReason(): string | null
  endCleanSessions(): void
  revealHistoryContext?(context: WorkspaceHistoryTraversalContext): void
}

/** Owns the session coordinator and its capacity prompt without owning another workspace/save path. */
export function useWorkspaceHistory(options: WorkspaceHistoryOptions) {
  const version = shallowRef(0)
  const capacityRequest = shallowRef<HistoryCapacityRequest | null>(null)
  const traversalError = shallowRef('')
  let settleCapacity: ((accepted: boolean) => void) | null = null

  const mutations = createWorkspaceHistoryCoordinator({
    getWorkspace: () => options.workspace.value,
    getRevision: () => options.appliedRevision.value,
    publishWorkspace: options.publishWorkspace,
    getTraversalBlockReason: () => {
      if (options.hydrationState.value !== 'ready') return 'Wait for the workspace to finish loading.'
      if (options.saveState.value === 'error') return 'Save failed. Retry saving or export the current workspace.'
      if (options.saveState.value !== 'saved'
        || options.savedAppliedRevision.value !== options.appliedRevision.value) {
        return 'Wait until the latest changes are saved.'
      }
      return options.getEditorBlockReason()
    },
    confirmCapacity: (details, signal) => new Promise<boolean>((resolve) => {
      if (signal.aborted) {
        resolve(false)
        return
      }
      const finish = (accepted: boolean): void => {
        signal.removeEventListener('abort', cancel)
        if (settleCapacity === finish) {
          settleCapacity = null
          capacityRequest.value = null
        }
        resolve(accepted)
      }
      const cancel = (): void => finish(false)
      settleCapacity = finish
      capacityRequest.value = details
      signal.addEventListener('abort', cancel, { once: true })
    }),
    onTraversalApplied: context => {
      options.endCleanSessions()
      options.revealHistoryContext?.(context)
    },
  })
  const unsubscribe = mutations.subscribe(() => { version.value += 1 })
  const status = computed(() => {
    // Internal history changes and external reactive blockers have separate owners.
    void version.value
    return mutations.getStatus()
  })
  const entries = computed(() => {
    void version.value
    return mutations.getEntries()
  })

  watch(() => {
    const current = options.workspace.value
    return current ? `${current.id}:${current.cluster.id}` : null
  }, () => {
    traversalError.value = ''
    mutations.reset()
  }, { flush: 'sync' })
  watch(options.hydrationState, (state, previous) => {
    if (state === 'loading' || previous === 'loading') {
      traversalError.value = ''
      mutations.reset()
    }
  }, { flush: 'sync' })

  async function traverse(direction: 'undo' | 'redo'): Promise<void> {
    traversalError.value = ''
    try {
      const result = await mutations[direction]()
      if (result.status === 'rejected') traversalError.value = result.message
      if (result.status === 'applied') {
        // Save feedback belongs to the existing workspace owner, including a later rejection.
        void result.durable.catch(() => undefined)
      }
    } catch (error) {
      traversalError.value = error instanceof Error ? error.message : String(error)
    }
  }

  onBeforeUnmount(() => {
    mutations.dispose()
    settleCapacity?.(false)
    unsubscribe()
  })

  return {
    mutations,
    status,
    entries,
    capacityRequest,
    traversalError,
    resolveCapacity: (accepted: boolean): void => { settleCapacity?.(accepted) },
    undo: (): Promise<void> => traverse('undo'),
    redo: (): Promise<void> => traverse('redo'),
  }
}
