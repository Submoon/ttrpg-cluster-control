import { getCurrentScope, nextTick, onScopeDispose, watch, type Ref } from 'vue'
import type { LocalWorkspace } from '../../domain/workspace'
import type { EditorUiSelection, useEditorUiStore } from '../../stores/editor-ui'
import type {
  MapInteractionMode,
  MapNavigationHandle,
  SearchContextChangeLease,
  SearchContextChangeOutcome,
  SearchPresentationSettlement,
} from './types'
import type { useEditorMapControls } from './useEditorMapControls'
import type { useChartNamesSession } from './useChartNamesSession'
import type { useEditorTransitions } from './useEditorTransitions'
import type { useEntityInspectorSession } from './useEntityInspectorSession'
import type { SearchTarget } from '../../utils/workspace-search'
import { snapshotEditorSelection } from './editor-selection-snapshot'

type EditorUiStore = ReturnType<typeof useEditorUiStore>
type MapControls = Pick<ReturnType<typeof useEditorMapControls>,
  'captureActiveMap' | 'beginSearchContextChange' | 'clusterMapRef' | 'systemMapRef'>
type ChartSession = ReturnType<typeof useChartNamesSession>['session']['value']
type EntitySession = ReturnType<typeof useEntityInspectorSession>['entitySession']['value']
type ResolveTransition = ReturnType<typeof useEditorTransitions>['resolveTransition']
type SearchAddCleanup = (() => void) | null

type SearchContextLeaseState = {
  lease: SearchContextChangeLease | null
  outcome: SearchContextChangeOutcome
  finished: boolean
  source: {
    workspaceId: string
    clusterId: string
    activeView: EditorUiStore['activeView']
    selectedSystemId: string | null
  } | null
  addCleanup: SearchAddCleanup
}

interface SearchDestinationSignature {
  selection: EditorUiSelection
  mapMode: MapInteractionMode
  compactPanel: EditorUiStore['compactPanel']
}

interface SearchAcceptedState {
  initialSelection: EditorUiSelection
  initialMode: MapInteractionMode
  initialCompactPanel: EditorUiStore['compactPanel']
  initialSearchOpen: boolean
  acceptedGeneration: number
  acceptedDestination: SearchDestinationSignature
}

interface SearchRevealOptions {
  workspace: Readonly<Ref<LocalWorkspace | null>>
  store: EditorUiStore
  mapControls: MapControls
  resolveTransition: ResolveTransition
  getChartSession(): ChartSession
  getEntitySession(): EntitySession
  compactViewport: Readonly<Ref<boolean>>
  editorError: Ref<string>
  setSelection(patch: Partial<EditorUiSelection>): void
  restoreActiveSelection(): void
  waitForSearchPresentation?: (signal: AbortSignal) => Promise<SearchPresentationSettlement>
  captureAddCleanup(): SearchAddCleanup
}

/** Owns guarded Warden Search navigation, provisional selection, presentation cancellation and map visit lifetime. */
export function useWardenSearchReveal(options: SearchRevealOptions) {
  const {
    workspace,
    store,
    mapControls,
    resolveTransition,
    getChartSession,
    getEntitySession,
    compactViewport,
    editorError,
    setSelection,
    restoreActiveSelection,
  } = options
  let searchContextGeneration = 0
  let searchRequestSequence = 0
  let activeSearchContextLease: SearchContextLeaseState | null = null
  let activeSearchPresentationController: AbortController | null = null
  let publishingSearchContext = false

  function abortSearchPresentation(): void {
    activeSearchPresentationController?.abort()
    activeSearchPresentationController = null
  }

  function sameSearchSourceContext(state: SearchContextLeaseState): boolean {
    const currentWorkspace = workspace.value
    const source = state.source
    return !!source
      && currentWorkspace?.id === source.workspaceId
      && currentWorkspace.cluster.id === source.clusterId
      && store.activeView === source.activeView
      && (source.activeView !== 'system' || store.selectedSystemId === source.selectedSystemId)
  }

  function finishSearchContextLease(state: SearchContextLeaseState, outcome: SearchContextChangeOutcome): void {
    if (state.finished) return
    state.finished = true
    if (activeSearchContextLease === state) activeSearchContextLease = null
    state.lease?.finish(outcome)
    if (outcome === 'accepted' || !sameSearchSourceContext(state)) state.addCleanup?.()
  }

  function abandonSearchContextLease(): void {
    if (activeSearchContextLease) finishSearchContextLease(activeSearchContextLease, 'abandoned')
  }

  function invalidatePendingSearchReveal(): void {
    searchRequestSequence += 1
    abortSearchPresentation()
    abandonSearchContextLease()
  }

  function isContextChangeHeld(): boolean {
    const state = activeSearchContextLease
    const currentWorkspace = workspace.value
    return !!state?.source
      && currentWorkspace?.id === state.source.workspaceId
      && currentWorkspace.cluster.id === state.source.clusterId
  }

  watch([
    () => store.workspaceId,
    () => workspace.value?.id,
    () => workspace.value?.cluster.id,
    () => store.activeView,
    () => store.mapMode,
    () => store.selectedSystemId,
    () => store.clusterSelectedSystemId,
    () => store.inspectedClusterSystemId,
    () => store.selectedObjectId,
    () => store.selectedObjectIds,
    () => store.selectedOrbitId,
    () => store.selectedRouteId,
    () => store.searchOpen,
    () => store.compactPanel,
  ], () => {
    if (!publishingSearchContext) {
      searchContextGeneration += 1
      abortSearchPresentation()
    }
  }, { flush: 'sync' })

  watch(() => store.searchOpen, (isOpen, wasOpen) => {
    if (isOpen !== wasOpen && !publishingSearchContext) invalidatePendingSearchReveal()
  }, { flush: 'sync' })

  if (getCurrentScope()) onScopeDispose(() => {
    searchRequestSequence += 1
    abortSearchPresentation()
    abandonSearchContextLease()
  })

  function sameSearchWorkspace(currentWorkspace: LocalWorkspace | null, target: SearchTarget): boolean {
    return currentWorkspace?.id === target.workspaceId
      && currentWorkspace.cluster.id === target.clusterId
  }

  function searchTargetExists(currentWorkspace: LocalWorkspace | null, target: SearchTarget): boolean {
    if (!currentWorkspace || !sameSearchWorkspace(currentWorkspace, target)) return false
    if (target.kind === 'cluster') return true
    const system = currentWorkspace.cluster.systems.find(candidate => candidate.id === target.systemId)
    return target.kind === 'system'
      ? system !== undefined
      : system?.objects.some(object => object.id === target.objectId) ?? false
  }

  function searchDestinationSignature(): SearchDestinationSignature {
    return {
      selection: snapshotEditorSelection(store),
      mapMode: store.mapMode,
      compactPanel: store.compactPanel,
    }
  }

  function ownsSearchDestination(signature: SearchDestinationSignature): boolean {
    return JSON.stringify(searchDestinationSignature()) === JSON.stringify(signature)
  }

  function searchTargetIsSelected(target: SearchTarget, signature: SearchDestinationSignature): boolean {
    const selection = signature.selection
    if (target.kind === 'cluster') return selection.activeView === 'cluster'
    if (target.kind === 'system') {
      return selection.activeView === 'cluster'
        && selection.clusterSelectedSystemId === target.systemId
        && selection.selectedObjectId === null
        && selection.selectedObjectIds.length === 0
        && selection.selectedOrbitId === null
        && selection.selectedRouteId === null
    }
    return selection.activeView === 'system'
      && selection.selectedSystemId === target.systemId
      && selection.selectedObjectId === target.objectId
      && selection.selectedObjectIds.length === 0
      && selection.selectedOrbitId === null
      && selection.selectedRouteId === null
      && selection.clusterSelectedSystemId === null
      && selection.inspectedClusterSystemId === null
  }

  function searchDestinationMap(target: SearchTarget): MapNavigationHandle | null {
    return target.kind === 'object' ? mapControls.systemMapRef.value : mapControls.clusterMapRef.value
  }

  function ownsSearchDestinationMap(target: SearchTarget, destinationMap: MapNavigationHandle): boolean {
    return target.kind === 'object'
      ? store.activeView === 'system' && mapControls.systemMapRef.value === destinationMap
      : store.activeView === 'cluster' && mapControls.clusterMapRef.value === destinationMap
  }

  function ownsAcceptedSearchState(
    requestId: number,
    acceptedGeneration: number,
    target: SearchTarget,
    acceptedDestination: SearchDestinationSignature,
  ): boolean {
    const currentWorkspace = workspace.value
    return searchRequestSequence === requestId
      && searchContextGeneration === acceptedGeneration
      && currentWorkspace !== null
      && currentWorkspace.id === target.workspaceId
      && currentWorkspace.cluster.id === target.clusterId
      && ownsSearchDestination(acceptedDestination)
      && searchTargetIsSelected(target, acceptedDestination)
      && !store.searchOpen
  }

  /** Allows only the synchronous selection cleanup caused by deletion of this request's target. */
  function searchDestinationAfterTargetRemoval(
    target: SearchTarget,
    acceptedDestination: SearchDestinationSignature,
    currentWorkspace: LocalWorkspace,
  ): SearchDestinationSignature {
    const next: SearchDestinationSignature = {
      ...acceptedDestination,
      selection: snapshotEditorSelection(acceptedDestination.selection),
    }
    if (target.kind === 'object') {
      next.selection.selectedObjectId = null
      next.selection.selectedObjectIds = next.selection.selectedObjectIds.filter(id => id !== target.objectId)
      if (!currentWorkspace.cluster.systems.some(system => system.id === target.systemId)) {
        next.selection.selectedSystemId = currentWorkspace.cluster.systems[0]?.id ?? null
        next.selection.selectedOrbitId = null
      }
    } else if (target.kind === 'system') {
      if (next.selection.clusterSelectedSystemId === target.systemId) next.selection.clusterSelectedSystemId = null
      if (next.selection.inspectedClusterSystemId === target.systemId) next.selection.inspectedClusterSystemId = null
      if (!currentWorkspace.cluster.systems.some(system => system.id === target.systemId)
        && next.selection.selectedSystemId === target.systemId) {
        next.selection.selectedSystemId = currentWorkspace.cluster.systems[0]?.id ?? null
        next.selection.selectedObjectId = null
        next.selection.selectedOrbitId = null
      }
    }
    return next
  }

  /** Allows rollback only after target removal normalized its destination and no newer command took ownership. */
  function ownsSearchStateAfterTargetRemoval(
    requestId: number,
    target: SearchTarget,
    acceptedDestination: SearchDestinationSignature,
  ): boolean {
    const currentWorkspace = workspace.value
    if (!currentWorkspace || searchRequestSequence !== requestId
      || !sameSearchWorkspace(currentWorkspace, target)
      || searchTargetExists(currentWorkspace, target)
      || store.searchOpen) return false
    return ownsSearchDestination(searchDestinationAfterTargetRemoval(target, acceptedDestination, currentWorkspace))
  }

  function survivingSearchSelection(
    selection: EditorUiSelection,
    currentWorkspace: LocalWorkspace | null,
  ): EditorUiSelection {
    if (!currentWorkspace) return selection
    const next = { ...selection }
    const selectedSystem = currentWorkspace.cluster.systems.find(system => system.id === next.selectedSystemId)
    if (!selectedSystem) {
      next.selectedSystemId = currentWorkspace.cluster.systems[0]?.id ?? null
      next.activeView = 'cluster'
      next.selectedObjectId = null
      next.selectedObjectIds = []
      next.selectedOrbitId = null
    } else {
      if (!selectedSystem.objects.some(object => object.id === next.selectedObjectId)) next.selectedObjectId = null
      next.selectedObjectIds = next.selectedObjectIds.filter(id => selectedSystem.objects.some(object => object.id === id))
      if (next.selectedObjectIds.length === 1) {
        next.selectedObjectId = next.selectedObjectIds[0]!
        next.selectedObjectIds = []
      } else if (next.selectedObjectIds.length === 0 && selection.selectedObjectIds.length) {
        next.selectedObjectId = null
      }
      if (!selectedSystem.orbits.some(orbit => orbit.id === next.selectedOrbitId)) next.selectedOrbitId = null
    }
    if (!currentWorkspace.cluster.systems.some(system => system.id === next.clusterSelectedSystemId)) {
      next.clusterSelectedSystemId = null
    }
    if (!currentWorkspace.cluster.systems.some(system => system.id === next.inspectedClusterSystemId)) {
      next.inspectedClusterSystemId = null
    }
    if (!currentWorkspace.cluster.routes.some(routeValue => routeValue.id === next.selectedRouteId)) {
      next.selectedRouteId = null
    }
    return next
  }

  function rejectSearchAfterAcceptedState(
    requestId: number,
    target: SearchTarget,
    reason: 'stale' | 'unavailable',
    acceptedState: SearchAcceptedState,
    onRestored: () => void,
  ): { status: 'rejected'; reason: 'stale' | 'unavailable' } {
    const currentWorkspace = workspace.value
    const canRestore = ownsAcceptedSearchState(
      requestId, acceptedState.acceptedGeneration, target, acceptedState.acceptedDestination,
    ) || ownsSearchStateAfterTargetRemoval(requestId, target, acceptedState.acceptedDestination)
    if (canRestore) {
      publishingSearchContext = true
      setSelection(survivingSearchSelection(acceptedState.initialSelection, currentWorkspace))
      store.setMode(acceptedState.initialMode)
      store.setCompactPanel(acceptedState.initialCompactPanel)
      store.setSearchOpen(acceptedState.initialSearchOpen)
      publishingSearchContext = false
      onRestored()
    }
    return { status: 'rejected', reason }
  }

  /** Performs the one guarded transition for a search result and frames it only after canvas restoration. */
  async function revealSearchTarget(target: SearchTarget): Promise<
    { status: 'revealed' } | { status: 'rejected'; reason: 'guard' | 'stale' | 'unavailable' }
  > {
    const requestId = ++searchRequestSequence
    abortSearchPresentation()
    abandonSearchContextLease()
    const presentationController = new AbortController()
    activeSearchPresentationController = presentationController
    const leaseState: SearchContextLeaseState = {
      lease: null,
      outcome: 'abandoned',
      finished: false,
      source: null,
      addCleanup: null,
    }

    try {
      const startingGeneration = searchContextGeneration
      const currentWorkspace = workspace.value
      if (!searchTargetExists(currentWorkspace, target)) return { status: 'rejected', reason: 'unavailable' }

      const activeMap = store.activeView === 'cluster' ? mapControls.clusterMapRef.value : mapControls.systemMapRef.value
      activeMap?.cancelActiveGesture()
      const chartSessionMatches = target.kind === 'system' && getChartSession()?.systemId === target.systemId
      const entityDraft = getEntitySession()
      const sameObjectDraft = target.kind === 'object'
        && entityDraft?.kind === 'object'
        && entityDraft.clusterId === target.clusterId
        && entityDraft.systemId === target.systemId
        && entityDraft.targetId === target.objectId
      const accepted = await resolveTransition({
        leaveChart: !chartSessionMatches,
        leaveEntitySession: !sameObjectDraft,
      })
      if (searchRequestSequence !== requestId) return { status: 'rejected', reason: 'stale' }
      if (!accepted) return { status: 'rejected', reason: 'guard' }
      if (searchContextGeneration !== startingGeneration) return { status: 'rejected', reason: 'stale' }

      const latestWorkspace = workspace.value
      if (!searchTargetExists(latestWorkspace, target)) return { status: 'rejected', reason: 'unavailable' }
      if (!latestWorkspace) return { status: 'rejected', reason: 'unavailable' }

      const initialState = {
        initialSelection: snapshotEditorSelection(store),
        initialMode: store.mapMode,
        initialCompactPanel: store.compactPanel,
        initialSearchOpen: store.searchOpen,
      }
      mapControls.captureActiveMap()
      leaseState.lease = mapControls.beginSearchContextChange(requestId)
      leaseState.source = {
        workspaceId: latestWorkspace.id,
        clusterId: latestWorkspace.cluster.id,
        activeView: store.activeView,
        selectedSystemId: store.selectedSystemId,
      }
      leaseState.addCleanup = options.captureAddCleanup()
      activeSearchContextLease = leaseState

      publishingSearchContext = true
      if (target.kind === 'cluster') {
        setSelection({ activeView: 'cluster' })
        restoreActiveSelection()
      } else if (target.kind === 'system') {
        setSelection({
          activeView: 'cluster',
          clusterSelectedSystemId: target.systemId,
          inspectedClusterSystemId: null,
          selectedObjectId: null,
          selectedOrbitId: null,
          selectedRouteId: null,
        })
      } else {
        setSelection({
          activeView: 'system',
          selectedSystemId: target.systemId,
          clusterSelectedSystemId: null,
          inspectedClusterSystemId: null,
          selectedObjectId: target.objectId,
          selectedOrbitId: null,
          selectedRouteId: null,
        })
      }
      store.setMode('select')
      if (compactViewport.value) store.setCompactPanel(null)
      store.setSearchOpen(false)
      publishingSearchContext = false
    const acceptedState: SearchAcceptedState = {
      ...initialState,
      acceptedGeneration: searchContextGeneration,
      acceptedDestination: searchDestinationSignature(),
    }
    const markRestored = (): void => { leaseState.outcome = 'restored' }

    await nextTick()
    const workspaceAfterMount = workspace.value
    if (searchRequestSequence !== requestId) return { status: 'rejected', reason: 'stale' }
    if (!sameSearchWorkspace(workspaceAfterMount, target)) return { status: 'rejected', reason: 'stale' }
    if (!searchTargetExists(workspaceAfterMount, target)) {
      return rejectSearchAfterAcceptedState(requestId, target, 'unavailable', acceptedState, markRestored)
    }
    if (!ownsAcceptedSearchState(requestId, acceptedState.acceptedGeneration, target, acceptedState.acceptedDestination)) {
      return { status: 'rejected', reason: 'stale' }
    }

    const destinationMap = searchDestinationMap(target)
    if (!destinationMap?.whenReady) {
      return rejectSearchAfterAcceptedState(requestId, target, 'unavailable', acceptedState, markRestored)
    }
    const destinationReady = await destinationMap.whenReady()
    const workspaceAfterReady = workspace.value
    if (searchRequestSequence !== requestId) return { status: 'rejected', reason: 'stale' }
    if (!sameSearchWorkspace(workspaceAfterReady, target)) return { status: 'rejected', reason: 'stale' }
    if (!searchTargetExists(workspaceAfterReady, target)) {
      return rejectSearchAfterAcceptedState(requestId, target, 'unavailable', acceptedState, markRestored)
    }
    if (!ownsAcceptedSearchState(requestId, acceptedState.acceptedGeneration, target, acceptedState.acceptedDestination)) {
      return { status: 'rejected', reason: 'stale' }
    }
    // A map replaced before presentation can still roll back the provisional destination.
    if (!ownsSearchDestinationMap(target, destinationMap)) {
      return rejectSearchAfterAcceptedState(requestId, target, 'stale', acceptedState, markRestored)
    }
    if (!destinationReady) {
      return rejectSearchAfterAcceptedState(requestId, target, 'unavailable', acceptedState, markRestored)
    }

    const publishSearchLocator = target.kind === 'object'
      ? destinationMap.prepareSearchLocator?.(target.objectId)
      : undefined
    const presentationSettlement = options.waitForSearchPresentation
      ? await options.waitForSearchPresentation(presentationController.signal)
      : 'settled'
    if (searchRequestSequence !== requestId) return { status: 'rejected', reason: 'stale' }
    const workspaceAfterPresentation = workspace.value
    if (!sameSearchWorkspace(workspaceAfterPresentation, target)) return { status: 'rejected', reason: 'stale' }
    if (!searchTargetExists(workspaceAfterPresentation, target)) {
      return rejectSearchAfterAcceptedState(requestId, target, 'unavailable', acceptedState, markRestored)
    }
    if (presentationSettlement === 'cancelled') return { status: 'rejected', reason: 'stale' }
    if (presentationSettlement === 'unavailable') {
      return rejectSearchAfterAcceptedState(requestId, target, 'unavailable', acceptedState, markRestored)
    }
    // Presentation settled; later ownership loss abandons instead of restoring over newer UI.
    if (!ownsAcceptedSearchState(requestId, acceptedState.acceptedGeneration, target, acceptedState.acceptedDestination)
      || !ownsSearchDestinationMap(target, destinationMap)) return { status: 'rejected', reason: 'stale' }

    await nextTick()
    if (searchRequestSequence !== requestId) return { status: 'rejected', reason: 'stale' }
    const workspaceAfterPresentationTick = workspace.value
    if (!sameSearchWorkspace(workspaceAfterPresentationTick, target)) return { status: 'rejected', reason: 'stale' }
    if (!searchTargetExists(workspaceAfterPresentationTick, target)) {
      return rejectSearchAfterAcceptedState(requestId, target, 'unavailable', acceptedState, markRestored)
    }
    if (!ownsAcceptedSearchState(requestId, acceptedState.acceptedGeneration, target, acceptedState.acceptedDestination)
      || !ownsSearchDestinationMap(target, destinationMap)) return { status: 'rejected', reason: 'stale' }

    const latestSearchWorkspace = workspace.value
    if (searchRequestSequence !== requestId) return { status: 'rejected', reason: 'stale' }
    if (!sameSearchWorkspace(latestSearchWorkspace, target)) return { status: 'rejected', reason: 'stale' }
    if (!searchTargetExists(latestSearchWorkspace, target)) {
      return rejectSearchAfterAcceptedState(requestId, target, 'unavailable', acceptedState, markRestored)
    }
    if (!ownsAcceptedSearchState(requestId, acceptedState.acceptedGeneration, target, acceptedState.acceptedDestination)) {
      return { status: 'rejected', reason: 'stale' }
    }
    // The map is checked immediately before framing; this stale result remains restorable.
    if (!ownsSearchDestinationMap(target, destinationMap)) {
      return rejectSearchAfterAcceptedState(requestId, target, 'stale', acceptedState, markRestored)
    }

    const framed = destinationMap.frameSearchTarget?.(target) ?? false
    const workspaceAfterFrame = workspace.value
    if (searchRequestSequence !== requestId) return { status: 'rejected', reason: 'stale' }
    if (!sameSearchWorkspace(workspaceAfterFrame, target)) return { status: 'rejected', reason: 'stale' }
    if (!searchTargetExists(workspaceAfterFrame, target)) {
      return rejectSearchAfterAcceptedState(requestId, target, 'unavailable', acceptedState, markRestored)
    }
    if (!ownsAcceptedSearchState(requestId, acceptedState.acceptedGeneration, target, acceptedState.acceptedDestination)) {
      return { status: 'rejected', reason: 'stale' }
    }
    // Framing completed on the captured map, so a post-frame replacement can still restore.
    if (!ownsSearchDestinationMap(target, destinationMap)) {
      return rejectSearchAfterAcceptedState(requestId, target, 'stale', acceptedState, markRestored)
    }
    if (!framed) {
      return rejectSearchAfterAcceptedState(requestId, target, 'unavailable', acceptedState, markRestored)
    }
    destinationMap.focusMap?.()
    // Focus can synchronously transfer ownership; do not roll back after it does.
    if (!ownsAcceptedSearchState(requestId, acceptedState.acceptedGeneration, target, acceptedState.acceptedDestination)
      || !ownsSearchDestinationMap(target, destinationMap)) return { status: 'rejected', reason: 'stale' }
    publishSearchLocator?.()
    editorError.value = ''
    leaseState.outcome = 'accepted'
    return { status: 'revealed' }
    } finally {
      if (leaseState.outcome === 'restored') await nextTick()
      finishSearchContextLease(leaseState, leaseState.outcome)
      if (activeSearchPresentationController === presentationController) activeSearchPresentationController = null
    }
  }

  return {
    revealSearchTarget,
    invalidatePendingSearchReveal,
    isContextChangeHeld,
  }
}
