import { computed, ref, shallowRef, watch, type ComputedRef } from 'vue'
import { createLocalWorkspace, renameLocalWorkspace, type LocalWorkspace, type StarSystem } from '../../domain/workspace'
import type { EditorWorkflowOptions } from './types'

export interface ChartNamesSession {
  id: number
  clusterId: string
  systemId: string
  initialClusterName: string
  initialSystemName: string
}

/** Owns the resumable chart-name draft; Apply validates before publishing changes or finishing a clean edit. */
export function useChartNamesSession(options: Pick<EditorWorkflowOptions, 'workspace' | 'saveState' | 'saveError' | 'commit' | 'applyWorkspace'> & {
  selectedSystem: ComputedRef<StarSystem | undefined>
}) {
  const { workspace, saveState, saveError, commit, applyWorkspace, selectedSystem } = options
  const clusterName = ref('New Jump Cluster')
  const systemName = ref('First System')
  const editing = ref(false)
  const formError = ref('')
  const session = shallowRef<ChartNamesSession | null>(null)
  let sessionSequence = 0

  const hasDraft = computed(() => session.value !== null)
  const hasUncommittedNames = computed(() => {
    const active = session.value
    const current = workspace.value
    const targetStillExists = !!active && current?.cluster.id === active.clusterId
      && current.cluster.systems.some(system => system.id === active.systemId)
    return !!active && (!targetStillExists || clusterName.value.trim() !== active.initialClusterName
      || systemName.value.trim() !== active.initialSystemName)
  })
  const draftSystemId = computed(() => session.value?.systemId ?? null)
  const draftSystemName = computed(() => {
    const targetId = session.value?.systemId
    return workspace.value?.cluster.systems.find(system => system.id === targetId)?.name ?? ''
  })
  const saveMessage = computed(() => {
    if (saveState.value === 'saving') {
      return saveError.value
        ? `Saving to this browser. A previous write failed: ${saveError.value}`
        : 'Saving to this browser...'
    }
    if (saveState.value === 'error') return `Not saved. ${saveError.value ?? ''}`
    if (saveState.value === 'saved') return 'Saved on this device'
    return 'No workspace is stored yet'
  })

  watch(() => workspace.value?.cluster.name, (value) => {
    if (session.value === null && value !== undefined) clusterName.value = value
  }, { immediate: true })
  watch(() => selectedSystem.value?.name, (value) => {
    if (session.value === null && value !== undefined) systemName.value = value
  }, { immediate: true })

  function errorText(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
  }

  function beginAccepted(currentWorkspace: LocalWorkspace, target: StarSystem): void {
    if (session.value?.clusterId === currentWorkspace.cluster.id && session.value.systemId === target.id) {
      editing.value = true
      return
    }
    session.value = {
      id: ++sessionSequence,
      clusterId: currentWorkspace.cluster.id,
      systemId: target.id,
      initialClusterName: currentWorkspace.cluster.name,
      initialSystemName: target.name,
    }
    clusterName.value = currentWorkspace.cluster.name
    systemName.value = target.name
    editing.value = true
    formError.value = ''
  }

  /** Publishes a validated rename to memory synchronously; its durable write continues on the workspace owner. */
  function apply(): boolean {
    const currentWorkspace = workspace.value
    const active = session.value
    if (!currentWorkspace || !active) {
      formError.value = 'Start a chart-name edit before applying these names.'
      return false
    }

    try {
      if (currentWorkspace.cluster.id !== active.clusterId) {
        throw new Error('The Jump Cluster for this draft no longer exists.')
      }
      if (!currentWorkspace.cluster.systems.some(system => system.id === active.systemId)) {
        throw new Error('The star system for this draft no longer exists.')
      }
      const nextWorkspace = renameLocalWorkspace(currentWorkspace, clusterName.value, systemName.value, active.systemId)
      if (!hasUncommittedNames.value) {
        if (session.value?.id === active.id) {
          session.value = null
          editing.value = false
          formError.value = ''
          syncNames(active.systemId)
        }
        return true
      }
      const { durable } = applyWorkspace(nextWorkspace)
      if (session.value?.id === active.id) {
        session.value = null
        editing.value = false
        formError.value = ''
        syncNames(active.systemId)
      }
      void durable.catch(() => undefined)
      return true
    } catch (error) {
      formError.value = errorText(error)
      editing.value = true
      return false
    }
  }

  async function submit(): Promise<void> {
    formError.value = ''
    if (workspace.value) {
      apply()
      return
    }
    try {
      await commit(createLocalWorkspace(clusterName.value, systemName.value))
    } catch (error) {
      formError.value = errorText(error)
    }
  }

  function syncNames(targetSystemId?: string): void {
    const current = workspace.value
    const target = current?.cluster.systems.find(system => system.id === targetSystemId) ?? selectedSystem.value
    if (current) clusterName.value = current.cluster.name
    if (target) systemName.value = target.name
  }

  /** Restores committed names for the captured target and discards the chart-name draft. */
  function discard(): void {
    const current = workspace.value
    const targetId = session.value?.systemId
    const target = current?.cluster.systems.find(system => system.id === targetId) ?? selectedSystem.value
    if (current && target) {
      clusterName.value = current.cluster.name
      systemName.value = target.name
    }
    editing.value = false
    formError.value = ''
    session.value = null
  }

  return {
    clusterName,
    systemName,
    editing,
    formError,
    session,
    hasDraft,
    hasUncommittedNames,
    draftSystemId,
    draftSystemName,
    saveMessage,
    beginAccepted,
    apply,
    submit,
    discard,
  }
}
