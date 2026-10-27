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
    apply(): boolean
    discard(): void
  }
  entity: {
    session: Readonly<Ref<EntityInspectorSession | null>>
    hasModified: Readonly<Ref<boolean>>
    apply(sessionId?: number): boolean
    discard(sessionId?: number): void
  }
  route: {
    session: Readonly<Ref<RouteInspectorSession | null>>
    hasModified: Readonly<Ref<boolean>>
    apply(sessionId: number): boolean
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
    resolve: (accepted: boolean) => void
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
      pendingTransition = { leaveChart, leaveEntitySession, leaveRouteSession, resolve }
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
    if (pending.leaveChart && chart.session.value && chart.hasUncommittedNames.value) {
      transitionGuard.value = 'chart'
      return
    }
    if (pending.leaveEntitySession && entity.hasModified.value) {
      transitionGuard.value = 'inspector'
      return
    }
    if (pending.leaveRouteSession && route.hasModified.value) {
      transitionGuard.value = 'inspector'
      return
    }
    if (pending.leaveChart && chart.session.value) chart.discard()
    if (pending.leaveEntitySession && entity.session.value) entity.discard(entity.session.value.id)
    if (pending.leaveRouteSession && route.session.value) route.discard(route.session.value.id)
    finishPendingTransition(true)
  }

  function resolveTransitionChoice(decision: TransitionDecision): void {
    const guard = transitionGuard.value
    if (!pendingTransition || !guard) return
    if (decision === 'stay') {
      if (guard === 'chart') chart.editing.value = true
      finishPendingTransition(false)
      return
    }
    if (guard === 'chart') {
      if (decision === 'apply') {
        if (!chart.apply()) {
          finishPendingTransition(false)
          return
        }
      } else {
        chart.discard()
      }
      advancePendingTransition()
      return
    }

    const routeDraft = route.session.value
    if (pendingTransition.leaveRouteSession && routeDraft && route.hasModified.value) {
      if (decision === 'apply') {
        if (!route.apply(routeDraft.id)) {
          finishPendingTransition(false)
          return
        }
      } else {
        route.discard(routeDraft.id)
      }
    }
    const entityDraft = entity.session.value
    if (pendingTransition.leaveEntitySession && entityDraft && entity.hasModified.value) {
      if (decision === 'apply') {
        if (!entity.apply(entityDraft.id)) {
          finishPendingTransition(false)
          return
        }
      } else {
        entity.discard(entityDraft.id)
      }
    }
    clearEditorError()
    advancePendingTransition()
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
