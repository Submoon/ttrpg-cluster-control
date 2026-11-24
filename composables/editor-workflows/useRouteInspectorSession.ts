/** Parent-owned Jump Route drafts and route-specific command guards. */
import { computed, ref, type Ref } from 'vue'
import {
  createJumpRoute,
  jumpPointsInCluster,
  updateJumpRoute,
  type JumpRouteInput,
  type LocalWorkspace,
} from '../../domain/workspace'
import { isJumpLevel, maxNameLength, validText } from '../../domain/workspace-validation'
import type { EntityCommand } from './types'
import type { WorkspaceMutationExecutor } from './workspace-mutations'

export type RouteDraftField = 'jumpLevel' | 'fromSystemId' | 'fromPointId' | 'destination' | 'toSystemId' | 'toPointId' | 'unresolvedExit' | 'playerShared'
export type RouteDraftValues = {
  jumpLevel: string
  fromSystemId: string
  fromPointId: string
  destination: 'system' | 'external'
  toSystemId: string
  toPointId: string
  unresolvedExit: string
  playerShared: boolean
}

export interface RouteInspectorSession {
  id: number
  clusterId: string
  routeId: string | null
  initial: RouteDraftValues
  draft: RouteDraftValues
  sourceSystemIds: string[] | null
  destinationSystemIds: string[] | null
  endpointToChoose: 'from' | 'to'
  errors: Partial<Record<RouteDraftField | 'form', string>>
  error: string
}

interface RouteInspectorSessionOptions {
  workspace: Readonly<Ref<LocalWorkspace | null>>
  mutations: WorkspaceMutationExecutor
}

const blankDraft = (): RouteDraftValues => ({
  jumpLevel: '1',
  fromSystemId: '',
  fromPointId: '',
  destination: 'system',
  toSystemId: '',
  toPointId: '',
  unresolvedExit: '',
  playerShared: false,
})

function cloneDraft(draft: RouteDraftValues): RouteDraftValues {
  return { ...draft }
}

function createSession(id: number, clusterId: string, routeId: string | null, draft: RouteDraftValues): RouteInspectorSession {
  return {
    id,
    clusterId,
    routeId,
    initial: cloneDraft(draft),
    draft: cloneDraft(draft),
    sourceSystemIds: null,
    destinationSystemIds: null,
    endpointToChoose: draft.fromSystemId ? 'to' : 'from',
    errors: {},
    error: '',
  }
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function routeDraft(route: NonNullable<LocalWorkspace['cluster']['routes'][number]>): RouteDraftValues {
  return {
    jumpLevel: String(route.jumpLevel),
    fromSystemId: route.fromSystemId,
    fromPointId: route.fromPointId ?? '',
    destination: route.toSystemId === null ? 'external' : 'system',
    toSystemId: route.toSystemId ?? '',
    toPointId: route.toPointId ?? '',
    unresolvedExit: route.toSystemId === null ? route.unresolvedExit : '',
    playerShared: route.playerShared,
  }
}

function replaceRouteInWorkspace(
  workspace: LocalWorkspace,
  route: LocalWorkspace['cluster']['routes'][number],
): LocalWorkspace {
  const routes = workspace.cluster.routes.some(candidate => candidate.id === route.id)
    ? workspace.cluster.routes.map(candidate => candidate.id === route.id ? route : candidate)
    : [...workspace.cluster.routes, route]
  const unresolvedExitPositions = { ...(workspace.layout.unresolvedExitPositions ?? {}) }
  if (route.toSystemId !== null) delete unresolvedExitPositions[route.id]
  return {
    ...workspace,
    cluster: { ...workspace.cluster, routes },
    layout: { ...workspace.layout, unresolvedExitPositions },
  }
}

function validUnresolvedExit(value: string): string | null {
  try {
    return validText(value, 'Unresolved exit', maxNameLength)
  } catch {
    return null
  }
}

/** Keeps route form values alive above the Inspector and validates before applying or finishing once. */
export function useRouteInspectorSession({ workspace, mutations }: RouteInspectorSessionOptions) {
  const session = ref<RouteInspectorSession | null>(null)
  const sessionGeneration = ref(0)
  let sequence = 0
  const hasModifiedRouteSession = computed(() => {
    const active = session.value
    return !!active && !sameValue(active.draft, active.initial)
  })
  const hasPendingHistoryChoice = computed(() => {
    const active = session.value
    return !!active && (active.sourceSystemIds !== null || active.destinationSystemIds !== null)
  })

  /** Ends a clean route form after history traversal; endpoint targeting remains a blocker. */
  function endCleanHistorySession(): void {
    const active = session.value
    if (active && !hasModifiedRouteSession.value && !hasPendingHistoryChoice.value) {
      discardRouteSession(active.id)
    }
  }

  function beginRouteSession(routeId: string | null = null): number | null {
    const current = workspace.value
    if (!current) return null
    const route = routeId ? current.cluster.routes.find(item => item.id === routeId) : undefined
    if (routeId && !route) return null
    const draft = route ? routeDraft(route) : blankDraft()
    const id = ++sequence
    sessionGeneration.value += 1
    session.value = createSession(id, current.cluster.id, routeId, draft)
    return id
  }

  function updateRouteInput(id: number, field: RouteDraftField, value: string | boolean): void {
    const active = session.value
    if (!active || active.id !== id) return
    if (field === 'playerShared') {
      if (typeof value !== 'boolean') return
      active.draft.playerShared = value
      delete active.errors.playerShared
    } else if (typeof value !== 'string') {
      return
    } else if (field === 'destination') {
      active.draft.destination = value === 'external' ? 'external' : 'system'
      if (active.draft.destination === 'external') {
        active.draft.toSystemId = ''
        active.draft.toPointId = ''
        active.destinationSystemIds = null
      } else {
        active.draft.unresolvedExit = ''
      }
      delete active.errors.destination
      delete active.errors.toSystemId
      delete active.errors.toPointId
      delete active.errors.unresolvedExit
    } else {
      const previousValue = active.draft[field]
      active.draft[field] = value
      delete active.errors[field]
      if (field === 'fromSystemId') {
        active.sourceSystemIds = null
        if (active.draft.fromPointId && previousValue !== value) {
          active.draft.fromPointId = ''
          delete active.errors.fromPointId
        }
        active.endpointToChoose = value ? 'to' : 'from'
      } else if (field === 'toSystemId') {
        active.destinationSystemIds = null
        if (value) {
          active.draft.destination = 'system'
          active.draft.unresolvedExit = ''
        }
        if (active.draft.toPointId && previousValue !== value) {
          active.draft.toPointId = ''
          delete active.errors.toPointId
        }
        active.endpointToChoose = active.draft.fromSystemId ? 'to' : 'from'
      } else if (field === 'fromPointId') {
        active.endpointToChoose = active.draft.fromSystemId ? 'to' : 'from'
      } else if (field === 'toPointId') {
        if (value) {
          active.draft.destination = 'system'
          active.draft.unresolvedExit = ''
        }
        active.endpointToChoose = active.draft.fromSystemId ? 'to' : 'from'
      }
    }
    delete active.errors.form
    active.error = ''
  }

  function offerRouteSystems(id: number, systemIds: string[]): void {
    const active = session.value
    const current = workspace.value
    if (!active || active.id !== id || !current || current.cluster.id !== active.clusterId) return
    const choosing = active.endpointToChoose
    const otherSystemId = choosing === 'from' ? active.draft.toSystemId : active.draft.fromSystemId
    const eligibleSystemIds = [...new Set(systemIds)].filter(candidateId =>
      candidateId !== otherSystemId && current.cluster.systems.some(system => system.id === candidateId),
    )
    if (!eligibleSystemIds.length) {
      active.error = 'Choose a different known system for this route endpoint.'
      return
    }

    active.error = ''
    delete active.errors.form
    if (choosing === 'from') {
      active.sourceSystemIds = eligibleSystemIds
      if (eligibleSystemIds.length === 1) chooseRouteSystem(id, eligibleSystemIds[0]!)
      return
    }

    active.draft.destination = 'system'
    active.draft.unresolvedExit = ''
    delete active.errors.destination
    delete active.errors.unresolvedExit
    active.destinationSystemIds = eligibleSystemIds
    if (eligibleSystemIds.length === 1) chooseRouteSystem(id, eligibleSystemIds[0]!)
  }

  function chooseRouteSystem(id: number, systemId: string): void {
    const active = session.value
    if (!active || active.id !== id) return
    const choosing = active.endpointToChoose
    const offered = choosing === 'from' ? active.sourceSystemIds : active.destinationSystemIds
    if (!offered?.includes(systemId)) {
      active.error = 'Choose one of the known systems offered for this endpoint.'
      return
    }
    if (choosing === 'from') active.sourceSystemIds = null
    else active.destinationSystemIds = null
    updateRouteInput(id, choosing === 'from' ? 'fromSystemId' : 'toSystemId', systemId)
  }

  function chooseRoutePoint(id: number, pointId: string): void {
    const active = session.value
    const current = workspace.value
    if (!active || active.id !== id || !current || current.cluster.id !== active.clusterId) return
    const isFrom = active.endpointToChoose === 'from'
    const systemId = isFrom ? active.draft.fromSystemId : active.draft.toSystemId
    const point = jumpPointsInCluster(current.cluster).find(reference => reference.point.id === pointId)
    if (!point || !systemId || point.system.id !== systemId
      || (!isFrom && point.point.id === active.draft.fromPointId)) {
      active.error = 'Choose a Jump Point from the selected endpoint system.'
      return
    }
    updateRouteInput(id, isFrom ? 'fromPointId' : 'toPointId', pointId)
  }

  function discardRouteSession(id?: number): void {
    if (session.value && (id === undefined || session.value.id === id)) session.value = null
  }

  /** Projects valid values for an existing route; route creation remains an explicit Add workflow. */
  function projectDraft(currentWorkspace: LocalWorkspace): LocalWorkspace | null {
    const active = session.value
    if (!active || active.routeId === null || currentWorkspace.cluster.id !== active.clusterId) return null
    const currentRoute = currentWorkspace.cluster.routes.find(route => route.id === active.routeId)
    if (!currentRoute) return null

    const draft = active.draft
    function hasEndpoint(systemId: string, pointId: string): boolean {
      const system = currentWorkspace.cluster.systems.find(candidate => candidate.id === systemId)
      return !!system && (!pointId || system.objects.some(point => point.id === pointId && point.family === 'JumpPoint'))
    }
    const origin = hasEndpoint(draft.fromSystemId, draft.fromPointId) ? {
      fromSystemId: draft.fromSystemId,
      fromPointId: draft.fromPointId || null,
    } : {
      fromSystemId: currentRoute.fromSystemId,
      fromPointId: currentRoute.fromPointId,
    }
    const appliedDestination = currentRoute.toSystemId === null
      ? { toSystemId: null, toPointId: null, unresolvedExit: currentRoute.unresolvedExit }
      : { toSystemId: currentRoute.toSystemId, toPointId: currentRoute.toPointId }
    const unresolvedExit = draft.destination === 'external' ? validUnresolvedExit(draft.unresolvedExit) : null
    const destination = unresolvedExit !== null
      ? { toSystemId: null, toPointId: null, unresolvedExit }
      : draft.destination === 'system' && hasEndpoint(draft.toSystemId, draft.toPointId)
        ? { toSystemId: draft.toSystemId, toPointId: draft.toPointId || null }
        : appliedDestination

    const parsedLevel = Number(draft.jumpLevel)
    const jumpLevel = isJumpLevel(parsedLevel) ? parsedLevel : currentRoute.jumpLevel
    const playerShared = typeof draft.playerShared === 'boolean'
      ? draft.playerShared
      : currentRoute.playerShared
    const input: JumpRouteInput = destination.toSystemId === origin.fromSystemId
      ? { ...currentRoute, jumpLevel, playerShared }
      : { ...origin, ...destination, jumpLevel, playerShared }
    try {
      const updatedRoute = updateJumpRoute(currentWorkspace.cluster, currentRoute.id, input)
      const hasRouteChange = updatedRoute.jumpLevel !== currentRoute.jumpLevel
        || updatedRoute.fromSystemId !== currentRoute.fromSystemId
        || updatedRoute.fromPointId !== currentRoute.fromPointId
        || updatedRoute.toSystemId !== currentRoute.toSystemId
        || updatedRoute.toPointId !== currentRoute.toPointId
        || updatedRoute.unresolvedExit !== currentRoute.unresolvedExit
        || updatedRoute.playerShared !== currentRoute.playerShared
        || updatedRoute.name !== currentRoute.name
      const hasStaleExitPosition = updatedRoute.toSystemId !== null
        && Object.prototype.hasOwnProperty.call(currentWorkspace.layout.unresolvedExitPositions ?? {}, currentRoute.id)
      return hasRouteChange || hasStaleExitPosition
        ? replaceRouteInWorkspace(currentWorkspace, updatedRoute)
        : null
    } catch {
      return null
    }
  }

  function cancelRouteCreation(): void {
    if (session.value?.routeId === null) session.value = null
  }

  async function applyRouteSession(id: number): Promise<boolean> {
    const active = session.value
    const current = workspace.value
    if (!active || active.id !== id) return false
    if (!current || current.cluster.id !== active.clusterId) {
      active.error = 'The Jump Cluster for this draft no longer exists.'
      return false
    }
    if (active.routeId && !current.cluster.routes.some(route => route.id === active.routeId)) {
      active.error = 'The Jump Route for this draft no longer exists.'
      return false
    }

    const jumpLevel = Number(active.draft.jumpLevel)
    const fromSystem = current.cluster.systems.find(system => system.id === active.draft.fromSystemId)
    const toSystem = active.draft.destination === 'external'
      ? undefined
      : current.cluster.systems.find(system => system.id === active.draft.toSystemId)
    const fromPointId = active.draft.fromPointId || null
    const toPointId = active.draft.destination === 'external' ? null : active.draft.toPointId || null
    const points = jumpPointsInCluster(current.cluster)
    const errors: RouteInspectorSession['errors'] = {}
    if (!isJumpLevel(jumpLevel)) errors.jumpLevel = 'Jump level must be a positive integer.'
    if (!fromSystem) {
      errors.fromSystemId = 'Choose an existing system as the route origin.'
    }
    if (fromPointId && !points.some(reference =>
      reference.point.id === fromPointId && reference.system.id === active.draft.fromSystemId)) {
      errors.fromPointId = 'Choose a Jump Point in the selected origin system.'
    }
    if (active.draft.destination === 'system') {
      if (!toSystem) errors.toSystemId = 'Choose an existing system as the route destination.'
      else if (toSystem.id === active.draft.fromSystemId) {
        errors.toSystemId = 'Choose a different system as the route destination.'
      }
      if (active.draft.toPointId && !points.some(reference =>
        reference.point.id === active.draft.toPointId && reference.system.id === active.draft.toSystemId)) {
        errors.toPointId = 'Choose a Jump Point in the selected destination system.'
      }
    }
    if (active.draft.destination === 'external') {
      try {
        validText(active.draft.unresolvedExit, 'Unresolved exit', maxNameLength)
      } catch (error) {
        errors.unresolvedExit = error instanceof Error ? error.message : String(error)
      }
    }
    if (Object.keys(errors).length) {
      active.errors = errors
      active.error = ''
      return false
    }
    if (active.routeId !== null && !hasModifiedRouteSession.value) {
      if (session.value?.id === active.id) session.value = null
      return true
    }
    const submittedSignature = JSON.stringify({
      id: active.id,
      clusterId: active.clusterId,
      routeId: active.routeId,
      draft: active.draft,
    })
    const isSubmittedSessionCurrent = (): boolean => {
      const current = session.value
      return current?.id === active.id && JSON.stringify({
        id: current.id,
        clusterId: current.clusterId,
        routeId: current.routeId,
        draft: current.draft,
      }) === submittedSignature
    }
    try {
      const routeInput = active.draft.destination === 'external'
        ? {
            jumpLevel,
            fromSystemId: active.draft.fromSystemId,
            fromPointId,
            toSystemId: null,
            toPointId: null,
            unresolvedExit: active.draft.unresolvedExit,
            playerShared: active.draft.playerShared,
          }
        : {
            jumpLevel,
            fromSystemId: active.draft.fromSystemId,
            fromPointId,
            toSystemId: active.draft.toSystemId,
            toPointId,
            playerShared: active.draft.playerShared,
          }
      const route = active.routeId
        ? updateJumpRoute(current.cluster, active.routeId, routeInput)
        : createJumpRoute(current.cluster, routeInput)
      const nextWorkspace = replaceRouteInWorkspace(current, route)
      const result = await mutations.execute({
        action: {
          kind: active.routeId === null ? 'create' : 'update',
          label: active.routeId === null ? 'Create Jump Route' : 'Edit Jump Route',
          target: { kind: 'route', id: route.id },
          parent: { kind: 'cluster', id: active.clusterId },
        },
        prepare: () => nextWorkspace,
        isCurrent: isSubmittedSessionCurrent,
      })
      if (result.status === 'rejected') {
        if (isSubmittedSessionCurrent()) active.error = result.message
        return false
      }
      if (result.status === 'applied') void result.durable.catch(() => undefined)
      if (!isSubmittedSessionCurrent()) return false
      session.value = active.routeId === null
        ? createSession(++sequence, current.cluster.id, null, blankDraft())
        : null
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      active.errors = {}
      if (/jump level/i.test(message)) active.errors.jumpLevel = message
      else if (/route origin/i.test(message)) active.errors.fromSystemId = message
      else if (/route destination/i.test(message)) active.errors.toSystemId = message
      else if (/origin system/i.test(message)) active.errors.fromSystemId = message
      else if (/origin Jump Point/i.test(message)) active.errors.fromPointId = message
      else if (/destination Jump Point/i.test(message)) active.errors.toPointId = message
      else if (/unresolved exit/i.test(message)) active.errors.unresolvedExit = message
      else active.errors.form = message
      active.error = ''
      return false
    }
  }

  function isRouteCommandBlocked(command: EntityCommand): boolean {
    const active = session.value
    const current = workspace.value
    if (!active || !current || current.cluster.id !== active.clusterId) return false
    if (command.kind !== 'deletion') return false
    const target = command.target
    const removedRouteIds = new Set(command.affectedRouteIds ?? [])
    if (active.routeId && ((target.kind === 'route' && active.routeId === target.routeId)
      || removedRouteIds.has(active.routeId))) return true

    const removedSystemIds = new Set(command.affectedSystemIds ?? [])
    const removedObjectIds = new Set(command.affectedObjectIds ?? [])
    if (target.kind === 'system') removedSystemIds.add(target.systemId)
    if (target.kind === 'object') removedObjectIds.add(target.objectId)
    const referencedSystems = [
      active.initial.fromSystemId,
      active.initial.destination === 'system' ? active.initial.toSystemId : '',
      active.draft.fromSystemId,
      active.draft.destination === 'system' ? active.draft.toSystemId : '',
    ].filter(Boolean)
    if (referencedSystems.some(systemId => removedSystemIds.has(systemId))) return true

    const referencedPoints = [active.initial.fromPointId, active.initial.toPointId, active.draft.fromPointId, active.draft.toPointId]
      .filter((id): id is string => Boolean(id))
    return referencedPoints.some(pointId => removedObjectIds.has(pointId))
  }

  return {
    routeSession: session,
    sessionGeneration,
    hasModifiedRouteSession,
    hasPendingHistoryChoice,
    beginRouteSession,
    offerRouteSystems,
    chooseRouteSystem,
    chooseRoutePoint,
    updateRouteInput,
    projectDraft,
    applyRouteSession,
    discardRouteSession,
    endCleanHistorySession,
    cancelRouteCreation,
    isRouteCommandBlocked,
  }
}
