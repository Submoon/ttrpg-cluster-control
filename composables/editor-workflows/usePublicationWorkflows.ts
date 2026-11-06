import { ref, type Ref } from 'vue'
import {
  isPublicationMode,
  replaceWorkspaceSystem,
  updateChartDetails,
  updateJumpRoute,
  updateSystemObject,
  type LocalWorkspace,
  type PublicationMode,
} from '../../domain/workspace'
import type { useEditorUiStore } from '../../stores/editor-ui'
import type { PublicationRequest, PublicationTarget } from './publication-types'
import type { useEditorTransitions } from './useEditorTransitions'
import type { RouteInspectorSession } from './useRouteInspectorSession'
import type { WorkspaceMutationExecutor, WorkspaceMutationResult } from './workspace-mutations'

type PublicationUiStore = ReturnType<typeof useEditorUiStore>

export interface PublicationWorkflowOptions {
  workspace: Ref<LocalWorkspace | null>
  store: PublicationUiStore
  mutations: WorkspaceMutationExecutor
  transitions: ReturnType<typeof useEditorTransitions>
  routeSharing?: {
    session: Readonly<Ref<RouteInspectorSession | null>>
    sessionGeneration: Readonly<Ref<number>>
    beforeWorkspaceOperation(): Promise<boolean>
  }
  setError(message: string): void
}

function rejection(
  reason: Extract<WorkspaceMutationResult, { status: 'rejected' }>['reason'],
  message: string,
): Extract<WorkspaceMutationResult, { status: 'rejected' }> {
  return { status: 'rejected', reason, message }
}

function publicationTargetExists(workspace: LocalWorkspace, target: PublicationTarget): boolean {
  if (target.kind === 'system') return target.systemId === target.id
    && workspace.cluster.systems.some(system => system.id === target.id)
  return workspace.cluster.systems.some(system => system.id === target.systemId
    && system.objects.some(object => object.id === target.id))
}

function routeTargetExists(workspace: LocalWorkspace, routeId: string): boolean {
  return workspace.cluster.routes.some(route => route.id === routeId)
}

/** Publishes guarded visibility changes through the existing transition, history and writer owners. */
export function usePublicationWorkflows(options: PublicationWorkflowOptions) {
  const {
    workspace, store, mutations, transitions, routeSharing, setError,
  } = options
  let requestSequence = 0
  const busy = ref(false)

  function contextSignature(): string {
    return JSON.stringify([
      store.workspaceId,
      store.activeView,
      store.selectedSystemId,
      store.clusterSelectedSystemId,
      store.inspectedClusterSystemId,
      store.mapMode,
    ])
  }

  async function set(request: PublicationRequest): Promise<WorkspaceMutationResult> {
    if (busy.value) return rejection('busy', 'Finish the current visibility change before starting another one.')
    if (!request || !Array.isArray(request.targets) || request.targets.length !== 1
      || !isPublicationMode(request.mode)) {
      const invalid = rejection('invalid', 'Choose one supported map item and a valid visibility setting.')
      setError(invalid.message)
      return invalid
    }

    const target = request.targets[0]
    if (!target || (target.kind !== 'system' && target.kind !== 'object')
      || typeof target.id !== 'string' || typeof target.systemId !== 'string') {
      const invalid = rejection('invalid', 'Choose one supported map item and a valid visibility setting.')
      setError(invalid.message)
      return invalid
    }
    const capturedTarget: PublicationTarget = { kind: target.kind, id: target.id, systemId: target.systemId }
    const requestedMode: PublicationMode = request.mode
    const current = workspace.value
    if (!current || !publicationTargetExists(current, capturedTarget)) {
      return rejection('stale', 'That map item is no longer available.')
    }

    const capturedWorkspaceId = current.id
    const capturedClusterId = current.cluster.id
    const capturedContext = contextSignature()
    const sequence = ++requestSequence
    busy.value = true
    const isCurrent = (): boolean => {
      const latest = workspace.value
      return sequence === requestSequence
        && latest?.id === capturedWorkspaceId
        && latest.cluster.id === capturedClusterId
        && contextSignature() === capturedContext
        && !!latest && publicationTargetExists(latest, capturedTarget)
    }

    try {
      if (!await transitions.resolveTransition() || !isCurrent()) {
        return rejection('cancelled', 'Visibility was not changed because the pending editor decision was cancelled or became outdated.')
      }

      const latest = workspace.value
      if (!latest || !publicationTargetExists(latest, capturedTarget)) {
        return rejection('stale', 'That map item is no longer available.')
      }
      const label = requestedMode === 'known-type' ? 'Known type' : requestedMode === 'unknown' ? 'Unknown presence'
        : requestedMode === 'hidden' ? 'Hidden' : 'Revealed'
      const mutationTarget = capturedTarget.kind === 'system'
        ? { kind: 'system' as const, id: capturedTarget.id }
        : { kind: 'object' as const, id: capturedTarget.id, systemId: capturedTarget.systemId }

      const result = await mutations.execute({
        action: {
          kind: 'update',
          label: `Set player visibility to ${label}`,
          target: mutationTarget,
          parent: capturedTarget.kind === 'system'
            ? { kind: 'cluster', id: latest.cluster.id }
            : { kind: 'system', id: capturedTarget.systemId },
        },
        prepare: currentWorkspace => {
          if (capturedTarget.kind === 'system') {
            const system = currentWorkspace.cluster.systems.find(candidate => candidate.id === capturedTarget.id)
            if (!system) throw new Error('The selected star system no longer exists.')
            return updateChartDetails(currentWorkspace, capturedTarget.id, {
              clusterName: currentWorkspace.cluster.name,
              systemName: system.name,
              playerTitle: currentWorkspace.cluster.playerTitle,
              publication: requestedMode,
            })
          }

          const system = currentWorkspace.cluster.systems.find(candidate => candidate.id === capturedTarget.systemId)
          if (!system || !system.objects.some(object => object.id === capturedTarget.id)) {
            throw new Error('The selected map object no longer exists.')
          }
          const updated = updateSystemObject(system, capturedTarget.id, { publication: requestedMode }, currentWorkspace.objectFieldSettings)
          return replaceWorkspaceSystem(currentWorkspace, updated)
        },
        isCurrent,
      })

      if (result.status === 'rejected') {
        if (isCurrent()) setError(result.message)
        return result
      }
      if (result.status === 'applied') void result.durable.catch(() => undefined)
      if (isCurrent()) setError('')
      return result
    } finally {
      if (sequence === requestSequence) busy.value = false
    }
  }

  /** Changes only the committed sharing flag, preserving the latest route details and layout. */
  async function setRouteSharing(routeId: string, playerShared: boolean): Promise<WorkspaceMutationResult> {
    if (busy.value) return rejection('busy', 'Finish the current visibility change before starting another one.')
    if (!routeSharing) {
      return rejection('unavailable', 'Jump Route sharing is unavailable in this editor context.')
    }
    if (typeof routeId !== 'string' || !routeId || typeof playerShared !== 'boolean') {
      const invalid = rejection('invalid', 'Choose an existing Jump Route and a valid sharing setting.')
      setError(invalid.message)
      return invalid
    }

    const current = workspace.value
    if (!current || store.activeView !== 'cluster' || store.selectedRouteId !== routeId
      || routeSharing.session.value !== null) {
      return rejection('stale', 'That Jump Route is no longer available in its Inspect context.')
    }
    const route = current.cluster.routes.find(candidate => candidate.id === routeId)
    if (!route) return rejection('stale', 'That Jump Route is no longer available.')
    if (route.playerShared === playerShared) return { status: 'unchanged' }

    const capturedWorkspaceId = current.id
    const capturedClusterId = current.cluster.id
    const capturedContext = contextSignature()
    const capturedRouteSessionGeneration = routeSharing.sessionGeneration.value
    const sequence = ++requestSequence
    busy.value = true
    const isCurrent = (): boolean => {
      const latest = workspace.value
      return sequence === requestSequence
        && latest?.id === capturedWorkspaceId
        && latest.cluster.id === capturedClusterId
        && store.activeView === 'cluster'
        && store.selectedRouteId === routeId
        && routeSharing.session.value === null
        && routeSharing.sessionGeneration.value === capturedRouteSessionGeneration
        && contextSignature() === capturedContext
        && !!latest && routeTargetExists(latest, routeId)
    }

    try {
      if (!await routeSharing.beforeWorkspaceOperation() || !isCurrent()) {
        return rejection('cancelled', 'Jump Route sharing was not changed because the workspace action was cancelled or became outdated.')
      }
      if (!await transitions.resolveTransition() || !isCurrent()) {
        return rejection('cancelled', 'Jump Route sharing was not changed because the pending editor decision was cancelled or became outdated.')
      }

      const latest = workspace.value
      const latestRoute = latest?.cluster.routes.find(candidate => candidate.id === routeId)
      if (!latest || latest.id !== capturedWorkspaceId || latest.cluster.id !== capturedClusterId || !latestRoute) {
        return rejection('stale', 'That Jump Route is no longer available.')
      }
      if (latestRoute.playerShared === playerShared) {
        if (isCurrent()) setError('')
        return { status: 'unchanged' }
      }

      const label = playerShared ? 'Shared with players' : 'Private'
      const result = await mutations.execute({
        action: {
          kind: 'update',
          label: `Set Jump Route visibility to ${label}`,
          target: { kind: 'route', id: routeId },
          parent: { kind: 'cluster', id: capturedClusterId },
        },
        prepare: currentWorkspace => {
          const committedRoute = currentWorkspace.cluster.routes.find(candidate => candidate.id === routeId)
          if (!committedRoute) throw new Error('The selected Jump Route no longer exists.')
          if (committedRoute.playerShared === playerShared) return currentWorkspace

          const updatedRoute = updateJumpRoute(
            currentWorkspace.cluster,
            committedRoute.id,
            committedRoute.jumpLevel,
            committedRoute.fromPointId,
            committedRoute.toPointId,
            committedRoute.unresolvedExit,
            playerShared,
          )
          return {
            ...currentWorkspace,
            cluster: {
              ...currentWorkspace.cluster,
              routes: currentWorkspace.cluster.routes.map(candidate =>
                candidate.id === routeId ? updatedRoute : candidate),
            },
          }
        },
        isCurrent,
      })

      if (result.status === 'rejected') {
        if (isCurrent()) setError(result.message)
        return result
      }
      if (result.status === 'applied') void result.durable.catch(() => undefined)
      if (isCurrent()) setError('')
      return result
    } finally {
      if (sequence === requestSequence) busy.value = false
    }
  }

  return { set, setRouteSharing, busy }
}
