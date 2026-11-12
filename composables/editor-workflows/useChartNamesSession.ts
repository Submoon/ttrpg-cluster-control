import { computed, ref, shallowRef, watch, type ComputedRef } from 'vue'
import {
  createLocalWorkspace,
  updateChartDetails,
  type LocalWorkspace,
  type PublicationMode,
  type StarSystem,
} from '../../domain/workspace'
import type { EditorWorkflowOptions } from './types'

export interface ChartNamesSession {
  id: number
  clusterId: string
  systemId: string
  initialClusterName: string
  initialSystemName: string
  initialPlayerTitle: string
  initialPublication: PublicationMode
}

/** Owns the resumable chart-details draft; Apply validates before publishing changes or finishing a clean edit. */
export function useChartNamesSession(options: Pick<EditorWorkflowOptions, 'workspace' | 'saveState' | 'saveError' | 'mutations' | 'initializeWorkspace'> & {
  selectedSystem: ComputedRef<StarSystem | undefined>
  beforeWorkspaceOperation?: () => Promise<boolean>
}) {
  const {
    workspace,
    saveState,
    saveError,
    mutations,
    initializeWorkspace,
    selectedSystem,
    beforeWorkspaceOperation = async () => true,
  } = options
  const clusterName = ref('New Jump Cluster')
  const systemName = ref('First System')
  const playerTitle = ref('Player Jump Cluster')
  const publication = ref<PublicationMode>('known-type')
  const editing = ref(false)
  const formError = ref('')
  const session = shallowRef<ChartNamesSession | null>(null)
  let sessionSequence = 0

  const hasDraft = computed(() => session.value !== null)
  const hasChangedNames = computed(() => {
    const active = session.value
    return !!active && (
      clusterName.value.trim() !== active.initialClusterName
      || systemName.value.trim() !== active.initialSystemName
      || playerTitle.value.trim() !== active.initialPlayerTitle
      || publication.value !== active.initialPublication
    )
  })
  const hasUncommittedNames = computed(() => {
    const active = session.value
    const current = workspace.value
    const targetStillExists = !!active && current?.cluster.id === active.clusterId
      && current.cluster.systems.some(system => system.id === active.systemId)
    return !!active && (!targetStillExists || hasChangedNames.value)
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
  watch(() => workspace.value?.cluster.playerTitle, (value) => {
    if (session.value === null && value !== undefined) playerTitle.value = value
  }, { immediate: true })
  watch(() => selectedSystem.value?.publication, (value) => {
    if (session.value === null && value !== undefined) publication.value = value
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
      initialPlayerTitle: currentWorkspace.cluster.playerTitle,
      initialPublication: target.publication,
    }
    clusterName.value = currentWorkspace.cluster.name
    systemName.value = target.name
    playerTitle.value = currentWorkspace.cluster.playerTitle
    publication.value = target.publication
    editing.value = true
    formError.value = ''
  }

  /** Applies a valid rename to memory and only then completes the owning chart-name session. */
  async function apply(): Promise<boolean> {
    const submittedSession = session.value
    if (!submittedSession) {
      formError.value = 'Start a chart-details edit before applying these values.'
      return false
    }

    const expectedSessionId = submittedSession.id
    const submittedClusterName = clusterName.value
    const submittedSystemName = systemName.value
    const submittedPlayerTitle = playerTitle.value
    const submittedPublication = publication.value
    const submittedSignature = JSON.stringify([
      submittedClusterName,
      submittedSystemName,
      submittedPlayerTitle,
      submittedPublication,
    ])
    if (!await beforeWorkspaceOperation()) return false
    if (session.value?.id !== expectedSessionId) return false

    const active = session.value
    const currentWorkspace = workspace.value
    if (!currentWorkspace || !active) return false
    const isSubmittedSessionCurrent = (): boolean => session.value?.id === active.id
      && JSON.stringify([clusterName.value, systemName.value, playerTitle.value, publication.value]) === submittedSignature

    try {
      if (currentWorkspace.cluster.id !== active.clusterId) {
        throw new Error('The Jump Cluster for this draft no longer exists.')
      }
      if (!currentWorkspace.cluster.systems.some(system => system.id === active.systemId)) {
        throw new Error('The star system for this draft no longer exists.')
      }
      updateChartDetails(currentWorkspace, active.systemId, {
        clusterName: submittedClusterName,
        systemName: submittedSystemName,
        playerTitle: submittedPlayerTitle,
        publication: submittedPublication,
      })
      const submittedValuesChanged = submittedClusterName.trim() !== active.initialClusterName
        || submittedSystemName.trim() !== active.initialSystemName
        || submittedPlayerTitle.trim() !== active.initialPlayerTitle
        || submittedPublication !== active.initialPublication
      if (!submittedValuesChanged) {
        if (!isSubmittedSessionCurrent()) return false
        session.value = null
        editing.value = false
        formError.value = ''
        syncValues(active.systemId)
        return true
      }

      const publicationDetailsChanged = submittedPlayerTitle.trim() !== active.initialPlayerTitle
        || submittedPublication !== active.initialPublication

      const result = await mutations.execute({
        action: {
          kind: publicationDetailsChanged ? 'update' : 'rename',
          label: publicationDetailsChanged
            ? 'Update player-facing chart details'
            : 'Rename Jump Cluster and star system',
          target: { kind: 'cluster', id: active.clusterId },
          parent: { kind: 'system', id: active.systemId },
        },
        prepare: current => updateChartDetails(current, active.systemId, {
          clusterName: submittedClusterName,
          systemName: submittedSystemName,
          playerTitle: submittedPlayerTitle,
          publication: submittedPublication,
        }),
        isCurrent: isSubmittedSessionCurrent,
      })
      if (result.status === 'rejected') {
        if (isSubmittedSessionCurrent()) {
          formError.value = result.message
          editing.value = true
        }
        return false
      }

      if (result.status === 'applied') void result.durable.catch(() => undefined)
      if (!isSubmittedSessionCurrent()) return false
      session.value = null
      editing.value = false
      formError.value = ''
      syncValues(active.systemId)
      return true
    } catch (error) {
      if (isSubmittedSessionCurrent()) {
        formError.value = errorText(error)
        editing.value = true
      }
      return false
    }
  }

  async function submit(): Promise<void> {
    formError.value = ''
    if (workspace.value) {
      await apply()
      return
    }
    try {
      await initializeWorkspace(createLocalWorkspace(clusterName.value, systemName.value))
    } catch (error) {
      formError.value = errorText(error)
    }
  }

  function syncValues(targetSystemId?: string): void {
    const current = workspace.value
    const target = current?.cluster.systems.find(system => system.id === targetSystemId) ?? selectedSystem.value
    if (current) {
      clusterName.value = current.cluster.name
      playerTitle.value = current.cluster.playerTitle
    }
    if (target) {
      systemName.value = target.name
      publication.value = target.publication
    }
  }

  /** Restores committed chart details for the captured system and discards the session. */
  function discard(expectedId?: number): void {
    const active = session.value
    if (!active || (expectedId !== undefined && active.id !== expectedId)) return
    const current = workspace.value
    const targetId = active.systemId
    const target = current?.cluster.systems.find(system => system.id === targetId) ?? selectedSystem.value
    if (current && target) {
      clusterName.value = current.cluster.name
      systemName.value = target.name
      playerTitle.value = current.cluster.playerTitle
      publication.value = target.publication
    }
    editing.value = false
    formError.value = ''
    session.value = null
  }

  /** Hides the Inspector presentation while retaining the captured chart draft. */
  function hideEditing(): void {
    editing.value = false
  }

  /** Reopens the same retained chart draft in the Inspector. */
  function showEditing(): void {
    if (session.value) editing.value = true
  }

  /** Ends an obsolete clean session after workspace-history traversal; changed names remain caller-owned. */
  function endCleanHistorySession(): void {
    if (session.value && !hasChangedNames.value) discard(session.value.id)
  }

  return {
    clusterName,
    systemName,
    playerTitle,
    publication,
    editing,
    formError,
    session,
    hasDraft,
    hasChangedNames,
    hasUncommittedNames,
    draftSystemId,
    draftSystemName,
    saveMessage,
    beginAccepted,
    apply,
    submit,
    discard,
    hideEditing,
    showEditing,
    endCleanHistorySession,
  }
}
