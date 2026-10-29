/** Parent-owned Jump Route drafts and route-specific command guards. */
import { computed, ref, type Ref } from 'vue'
import {
  createJumpRoute,
  jumpPointsInCluster,
  updateJumpRoute,
  type LocalWorkspace,
} from '../../domain/workspace'
import { isJumpLevel, maxNameLength, validText } from '../../domain/workspace-validation'
import type { EntityCommand } from './types'
import type { WorkspaceMutationExecutor } from './workspace-mutations'

export type RouteDraftField = 'jumpLevel' | 'fromPointId' | 'destination' | 'toPointId' | 'unresolvedExit'
export type RouteDraftValues = {
  jumpLevel: string
  fromPointId: string
  destination: 'point' | 'external'
  toPointId: string
  unresolvedExit: string
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
  fromPointId: '',
  destination: 'point',
  toPointId: '',
  unresolvedExit: '',
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
    endpointToChoose: draft.fromPointId ? 'to' : 'from',
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
    fromPointId: route.fromPointId,
    destination: route.toPointId === null ? 'external' : 'point',
    toPointId: route.toPointId ?? '',
    unresolvedExit: route.toPointId === null ? route.unresolvedExit : '',
  }
}

/** Keeps route form values alive above the Inspector and validates before applying or finishing once. */
export function useRouteInspectorSession({ workspace, mutations }: RouteInspectorSessionOptions) {
  const session = ref<RouteInspectorSession | null>(null)
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
    session.value = createSession(id, current.cluster.id, routeId, draft)
    return id
  }

  function updateRouteInput(id: number, field: RouteDraftField, value: string): void {
    const active = session.value
    if (!active || active.id !== id) return
    if (field === 'destination') {
      active.draft.destination = value === 'external' ? 'external' : 'point'
      if (active.draft.destination === 'external') {
        active.draft.toPointId = ''
      }
      else active.draft.unresolvedExit = ''
      delete active.errors.destination
      delete active.errors.toPointId
      delete active.errors.unresolvedExit
    } else {
      active.draft[field] = value
      delete active.errors[field]
      if (field === 'fromPointId') {
        if (!value) active.sourceSystemIds = null
        if (active.draft.toPointId === value) {
          active.draft.toPointId = ''
          delete active.errors.toPointId
        }
        active.endpointToChoose = value ? 'to' : 'from'
      } else if (field === 'toPointId') {
        if (!value) active.destinationSystemIds = null
        if (value) {
          active.draft.destination = 'point'
          active.draft.unresolvedExit = ''
        }
        active.endpointToChoose = active.draft.fromPointId ? 'to' : 'from'
      }
    }
    delete active.errors.form
    active.error = ''
  }

  function offerRouteSystems(id: number, systemIds: string[]): void {
    const active = session.value
    const current = workspace.value
    if (!active || active.id !== id || !current || current.cluster.id !== active.clusterId) return
    const hitIds = new Set(systemIds)
    const choosing = active.endpointToChoose
    const eligiblePoints = jumpPointsInCluster(current.cluster)
      .filter(reference => hitIds.has(reference.system.id)
        && (choosing === 'from' || reference.point.id !== active.draft.fromPointId))
    if (!eligiblePoints.length) {
      active.error = 'Choose a system that contains an available logical Jump Point.'
      return
    }

    active.error = ''
    delete active.errors.form
    const point = eligiblePoints.length === 1 ? eligiblePoints[0] : undefined
    const eligibleSystemIds = [...new Set(eligiblePoints.map(reference => reference.system.id))]
    if (choosing === 'from') {
      active.sourceSystemIds = eligibleSystemIds
      if (point) {
        active.draft.fromPointId = point.point.id
        active.endpointToChoose = 'to'
        delete active.errors.fromPointId
        if (active.draft.toPointId === point.point.id) {
          active.draft.toPointId = ''
          delete active.errors.toPointId
        }
      } else {
        if (!eligiblePoints.some(reference => reference.point.id === active.draft.fromPointId)) {
          active.draft.fromPointId = ''
          delete active.errors.fromPointId
        }
      }
      return
    }

    active.draft.destination = 'point'
    active.draft.unresolvedExit = ''
    delete active.errors.destination
    delete active.errors.unresolvedExit
    active.destinationSystemIds = eligibleSystemIds
    if (point) {
      active.draft.toPointId = point.point.id
      delete active.errors.toPointId
    } else {
      if (!eligiblePoints.some(reference => reference.point.id === active.draft.toPointId)) {
        active.draft.toPointId = ''
        delete active.errors.toPointId
      }
    }
  }

  function chooseRoutePoint(id: number, pointId: string): void {
    const active = session.value
    const current = workspace.value
    if (!active || active.id !== id || !current || current.cluster.id !== active.clusterId) return
    const point = jumpPointsInCluster(current.cluster).find(reference => reference.point.id === pointId)
    const isFrom = active.endpointToChoose === 'from'
    const scope = isFrom ? active.sourceSystemIds : active.destinationSystemIds
    if (!point || !scope?.includes(point.system.id)
      || (!isFrom && point.point.id === active.draft.fromPointId)) {
      active.error = 'Choose one of the logical Jump Points offered for that system.'
      return
    }
    updateRouteInput(id, isFrom ? 'fromPointId' : 'toPointId', pointId)
  }

  function discardRouteSession(id?: number): void {
    if (session.value && (id === undefined || session.value.id === id)) session.value = null
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
    const toPointId = active.draft.destination === 'external' ? null : active.draft.toPointId
    const points = jumpPointsInCluster(current.cluster)
    const errors: RouteInspectorSession['errors'] = {}
    if (!isJumpLevel(jumpLevel)) errors.jumpLevel = 'Jump level must be a positive integer.'
    if (!points.some(({ point }) => point.id === active.draft.fromPointId)) {
      errors.fromPointId = 'Choose an existing Jump Point as the route origin.'
    }
    if (toPointId !== null && (!toPointId || toPointId === active.draft.fromPointId
      || !points.some(({ point }) => point.id === toPointId))) {
      errors.toPointId = 'Choose a different existing Jump Point as the route destination.'
    }
    if (toPointId === null) {
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
      const route = active.routeId
        ? updateJumpRoute(current.cluster, active.routeId, jumpLevel, active.draft.fromPointId, toPointId, active.draft.unresolvedExit)
        : createJumpRoute(current.cluster, jumpLevel, active.draft.fromPointId, toPointId, active.draft.unresolvedExit)
      const routes = current.cluster.routes.some(candidate => candidate.id === route.id)
        ? current.cluster.routes.map(candidate => candidate.id === route.id ? route : candidate)
        : [...current.cluster.routes, route]
      const unresolvedExitPositions = { ...(current.layout.unresolvedExitPositions ?? {}) }
      if (toPointId !== null) delete unresolvedExitPositions[route.id]
      const nextWorkspace: LocalWorkspace = {
        ...current,
        cluster: { ...current.cluster, routes },
        layout: { ...current.layout, unresolvedExitPositions },
      }
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
      else if (/route origin/i.test(message)) active.errors.fromPointId = message
      else if (/route destination/i.test(message)) active.errors.toPointId = message
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
    const referenced = [active.initial.fromPointId, active.initial.toPointId, active.draft.fromPointId, active.draft.toPointId]
      .filter((id): id is string => Boolean(id))
    if (!referenced.length) return false
    return referenced.some(pointId => removedObjectIds.has(pointId)
      || jumpPointsInCluster(current.cluster).some(point => point.point.id === pointId
        && removedSystemIds.has(point.system.id)))
  }

  return {
    routeSession: session,
    hasModifiedRouteSession,
    hasPendingHistoryChoice,
    beginRouteSession,
    offerRouteSystems,
    chooseRoutePoint,
    updateRouteInput,
    applyRouteSession,
    discardRouteSession,
    endCleanHistorySession,
    cancelRouteCreation,
    isRouteCommandBlocked,
  }
}
