import { computed, onBeforeUnmount, ref, type Ref } from 'vue'
import type { EntityInspectorSession, TransitionDecision, TransitionGuard, TransitionOptions } from './types'
import type { ChartNamesSession } from './useChartNamesSession'
import type { RouteInspectorSession } from './useRouteInspectorSession'

/** Owns pending Apply/Discard/Stay sequencing across independent parent-owned draft sessions. */
export function useEditorTransitions(options: {
  chart: {
    session: Ref<ChartNamesSession | null>
    editing: Ref<boolean>
    hasUncommittedNames: Readonly<Ref<boolean>>
    apply(): Promise<boolean>
    discard(sessionId?: number): void
  }
  entity: {
    session: Readonly<Ref<EntityInspectorSession | null>>
    hasModified: Readonly<Ref<boolean>>
    apply(sessionId?: number): Promise<boolean>
    discard(sessionId?: number): void
  }
  route: {
    session: Readonly<Ref<RouteInspectorSession | null>>
    hasModified: Readonly<Ref<boolean>>
    apply(sessionId: number): Promise<boolean>
    discard(sessionId?: number): void
  }
  clearEditorError(): void
}) {
  const { chart, entity, route, clearEditorError } = options
  const transitionGuard = ref<TransitionGuard>(null)
  const chartNamesDialogOpen = computed(() => chart.editing.value || transitionGuard.value !== null)
  let pendingTransition: {
    leaveChart: boolean
    leaveEntitySession: boolean
    leaveRouteSession: boolean
    chartSessionId: number | null
    entitySessionId: number | null
    routeSessionId: number | null
    resolve: (accepted: boolean) => void
    choiceInFlight: boolean
  } | null = null

  /**
   * Resolves only the drafts named by this transition; a second pending request is rejected.
   * Apply means the controller published memory; the workspace owner reports durable save completion separately.
   */
  function resolveTransition(transition: TransitionOptions = {}): Promise<boolean> {
    if (pendingTransition) return Promise.resolve(false)

    const leaveChart = transition.leaveChart !== false
    const leaveEntitySession = transition.leaveEntitySession !== false
    const leaveRouteSession = transition.leaveRouteSession !== false
    const hasChartDraft = leaveChart && chart.session.value !== null
    const chartNeedsResolution = hasChartDraft && chart.hasUncommittedNames.value
    const entityNeedsResolution = leaveEntitySession && entity.hasModified.value
    const routeNeedsResolution = leaveRouteSession && route.hasModified.value
    if (!chartNeedsResolution && !entityNeedsResolution && !routeNeedsResolution) {
      if (hasChartDraft) chart.discard()
      if (leaveEntitySession && entity.session.value) entity.discard(entity.session.value.id)
      if (leaveRouteSession && route.session.value) route.discard(route.session.value.id)
      return Promise.resolve(true)
    }

    return new Promise(resolve => {
      pendingTransition = {
        leaveChart,
        leaveEntitySession,
        leaveRouteSession,
        chartSessionId: chart.session.value?.id ?? null,
        entitySessionId: entity.session.value?.id ?? null,
        routeSessionId: route.session.value?.id ?? null,
        resolve,
        choiceInFlight: false,
      }
      transitionGuard.value = chartNeedsResolution ? 'chart' : 'inspector'
    })
  }

  function finishPendingTransition(accepted: boolean): void {
    const pending = pendingTransition
    if (!pending) return
    pendingTransition = null
    transitionGuard.value = null
    pending.resolve(accepted)
  }

  function advancePendingTransition(): void {
    const pending = pendingTransition
    if (!pending) return
    const chartDraft = pending.leaveChart ? chart.session.value : null
    if (chartDraft && chartDraft.id !== pending.chartSessionId) {
      finishPendingTransition(false)
      return
    }
    if (!chartDraft) pending.chartSessionId = null
    if (chartDraft && chart.hasUncommittedNames.value) {
      transitionGuard.value = 'chart'
      return
    }
    const entityDraft = pending.leaveEntitySession ? entity.session.value : null
    if (entityDraft && entityDraft.id !== pending.entitySessionId) {
      finishPendingTransition(false)
      return
    }
    if (!entityDraft) pending.entitySessionId = null
    if (entityDraft && entity.hasModified.value) {
      transitionGuard.value = 'inspector'
      return
    }
    const routeDraft = pending.leaveRouteSession ? route.session.value : null
    if (routeDraft && routeDraft.id !== pending.routeSessionId) {
      finishPendingTransition(false)
      return
    }
    if (!routeDraft) pending.routeSessionId = null
    if (routeDraft && route.hasModified.value) {
      transitionGuard.value = 'inspector'
      return
    }
    if (chartDraft && pending.leaveChart) chart.discard(chartDraft.id)
    if (entityDraft && pending.leaveEntitySession) entity.discard(entityDraft.id)
    if (routeDraft && pending.leaveRouteSession) route.discard(routeDraft.id)
    finishPendingTransition(true)
  }

  async function resolveTransitionChoice(decision: TransitionDecision): Promise<void> {
    const pending = pendingTransition
    const guard = transitionGuard.value
    if (!pending || !guard || pending.choiceInFlight) return
    pending.choiceInFlight = true
    try {
      if (decision === 'stay') {
        if (guard === 'chart' && chart.session.value?.id === pending.chartSessionId) chart.editing.value = true
        finishPendingTransition(false)
        return
      }
      if (guard === 'chart') {
        const chartDraft = chart.session.value
        if (!chartDraft) {
          pending.chartSessionId = null
          advancePendingTransition()
          return
        }
        if (chartDraft.id !== pending.chartSessionId) {
          finishPendingTransition(false)
          return
        }
        if (decision === 'apply') {
          if (!await chart.apply()) {
            if (pendingTransition !== pending) return
            finishPendingTransition(false)
            return
          }
          if (pendingTransition !== pending) return
          if (chart.session.value) {
            finishPendingTransition(false)
            return
          }
          pending.chartSessionId = null
        } else {
          chart.discard(chartDraft.id)
          pending.chartSessionId = null
        }
        if (pendingTransition !== pending) return
        advancePendingTransition()
        return
      }

      const routeDraft = route.session.value
      if (pending.leaveRouteSession && routeDraft && routeDraft.id !== pending.routeSessionId) {
        finishPendingTransition(false)
        return
      }
      if (pending.leaveRouteSession && routeDraft && route.hasModified.value) {
        if (decision === 'apply') {
          if (!await route.apply(routeDraft.id)) {
            if (pendingTransition !== pending) return
            finishPendingTransition(false)
            return
          }
          if (pendingTransition !== pending) return
          const nextRouteSession = route.session.value
          if (nextRouteSession?.id === routeDraft.id) {
            finishPendingTransition(false)
            return
          }
          if (nextRouteSession && !(routeDraft.routeId === null
            && nextRouteSession.routeId === null && !route.hasModified.value)) {
            finishPendingTransition(false)
            return
          }
          pending.routeSessionId = nextRouteSession?.id ?? null
        } else {
          route.discard(routeDraft.id)
          pending.routeSessionId = null
        }
      } else if (pending.leaveRouteSession && !routeDraft) {
        pending.routeSessionId = null
      }
      const entityDraft = entity.session.value
      if (pending.leaveEntitySession && entityDraft && entityDraft.id !== pending.entitySessionId) {
        finishPendingTransition(false)
        return
      }
      if (pending.leaveEntitySession && entityDraft && entity.hasModified.value) {
        if (decision === 'apply') {
          if (!await entity.apply(entityDraft.id)) {
            if (pendingTransition !== pending) return
            finishPendingTransition(false)
            return
          }
          if (pendingTransition !== pending) return
          if (entity.session.value) {
            finishPendingTransition(false)
            return
          }
          pending.entitySessionId = null
        } else {
          entity.discard(entityDraft.id)
          pending.entitySessionId = null
        }
      } else if (pending.leaveEntitySession && !entityDraft) {
        pending.entitySessionId = null
      }
      if (pendingTransition !== pending) return
      clearEditorError()
      advancePendingTransition()
    } finally {
      if (pendingTransition === pending) pending.choiceInFlight = false
    }
  }

  function setChartNamesDialogOpen(open: boolean): void {
    if (open) {
      chart.editing.value = true
    } else if (transitionGuard.value) {
      resolveTransitionChoice('stay')
    } else {
      chart.editing.value = false
    }
  }

  onBeforeUnmount(() => finishPendingTransition(false))

  return { transitionGuard, chartNamesDialogOpen, resolveTransition, resolveTransitionChoice, setChartNamesDialogOpen }
}
