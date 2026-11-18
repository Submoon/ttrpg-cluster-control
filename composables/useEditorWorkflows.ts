import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { EditorWorkflowOptions, ObjectInspectorFocusRequest } from './editor-workflows/types'
import { useEditorUiStore } from '../stores/editor-ui'
import { useClusterSystemPlacement } from './editor-workflows/useClusterSystemPlacement'
import { useClusterWorkflows } from './editor-workflows/useClusterWorkflows'
import { useChartNamesSession } from './editor-workflows/useChartNamesSession'
import { useContinuousOrbitAdjustments } from './editor-workflows/continuous-orbit-adjustments'
import { useEditorMapControls } from './editor-workflows/useEditorMapControls'
import { useEditorNavigation } from './editor-workflows/useEditorNavigation'
import { useEditorTransitions } from './editor-workflows/useEditorTransitions'
import { useEditorViewport } from './editor-workflows/useEditorViewport'
import { useEntityInspectorSession } from './editor-workflows/useEntityInspectorSession'
import { useFieldDefinitionWorkflows } from './editor-workflows/useFieldDefinitionWorkflows'
import { useMapInteractionCoordinator } from './editor-workflows/useMapInteractionCoordinator'
import { useMapWorkflows } from './editor-workflows/useMapWorkflows'
import { useRouteInspectorSession } from './editor-workflows/useRouteInspectorSession'
import { useSystemCreationWorkflows } from './editor-workflows/useSystemCreationWorkflows'
import { useSystemObjectPlacement } from './editor-workflows/useSystemObjectPlacement'
import { useUnresolvedExitPlacement } from './editor-workflows/useUnresolvedExitPlacement'
import { useOrbitCenterPlacement } from './editor-workflows/useOrbitCenterPlacement'
import { usePublicationWorkflows } from './editor-workflows/usePublicationWorkflows'
import { useSelectedObjectDrag } from './editor-workflows/selected-object-drag'
import { searchWorkspace } from '../utils/workspace-search'
import { usePublicationMenu } from './usePublicationMenu'
import type { PublicationMenuRequest } from './editor-workflows/publication-types'
import type { SearchResult } from '../utils/workspace-search'
import { useWardenFilterCriteria } from './useWardenFilterCriteria'
import { useSystemObjectTransferWorkflow } from './editor-workflows/useSystemObjectTransferWorkflow'
import { resolveSystemObjectHistoryTarget } from '../domain/workspace'
import type { SystemObjectTransferIntent } from './editor-workflows/system-object-transfer-types'

type EditorWorkflowsOptions = EditorWorkflowOptions & {
  /** Rechecks page-owned modal and keyboard focus owners before restoring a menu opener. */
  canRestorePublicationFocus?: (request: PublicationMenuRequest) => boolean
  /** Announces that Search removed criteria invalidated by a Field or choice change. */
  onSearchFiltersInvalidated?: () => void
  /** Announces that the map removed criteria invalidated by a Field or choice change. */
  onMapFiltersInvalidated?: () => void
  /** Announces the applied Orbit radii adjustment caused by a new host minimum. */
  onOrbitRadiiIncreased?: (minimum: number) => void
}

/** Composes editor features around the page's single workspace writer and shared transient UI store. */
export function useEditorWorkflows(options: EditorWorkflowsOptions) {
  const { workspace, saveState, saveError, mutations, initializeWorkspace } = options
  const store = useEditorUiStore()
  const editorError = ref('')
  const workspaceContextId = computed(() => {
    const current = workspace.value
    return current ? `${current.id}:${current.cluster.id}` : null
  })

  watch(workspaceContextId, contextId => {
    if (store.workspaceId !== contextId) {
      store.reset(contextId)
    }
  }, { immediate: true, flush: 'sync' })
  const filterCriteria = useWardenFilterCriteria({
    workspace,
    store,
    onMapFiltersInvalidated: options.onMapFiltersInvalidated,
    onSearchFiltersInvalidated: options.onSearchFiltersInvalidated,
  })
  onBeforeUnmount(() => store.reset(null))

  const entity = useEntityInspectorSession({ workspace, mutations })
  const collectiveMoveError = ref('')
  const route = useRouteInspectorSession({ workspace, mutations })
  const selectedSystemForChart = computed(() => workspace.value?.cluster.systems.find(system => system.id === store.selectedSystemId))
  const orbitAdjustments = useContinuousOrbitAdjustments({
    history: mutations,
    onAutomaticCompletion: (result) => {
      if (result.status === 'rejected') editorError.value = result.message
    },
  })
  watch(workspaceContextId, () => orbitAdjustments.reset(), { flush: 'sync' })

  async function beforeWorkspaceOperation(): Promise<boolean> {
    if (mutations.getStatus().isBusy && !mutations.getStatus().hasPendingGroup) {
      editorError.value = 'Finish the current workspace operation before starting another action.'
      return false
    }
    const result = await orbitAdjustments.beforeOperation()
    if (result.status === 'rejected') {
      editorError.value = result.message
      return false
    }
    if (result.status === 'applied') void result.durable.catch(() => undefined)
    return true
  }

  const charts = useChartNamesSession({
    workspace,
    saveState,
    saveError,
    initializeWorkspace,
    mutations,
    selectedSystem: selectedSystemForChart,
    beforeWorkspaceOperation,
  })

  async function applyEntitySession(sessionId?: number): Promise<boolean> {
    const submittedSession = entity.entitySession.value
    const expectedId = sessionId ?? submittedSession?.id
    if (!submittedSession || expectedId !== submittedSession.id) return false
    const startingError = editorError.value
    if (!await beforeWorkspaceOperation()) return false
    if (entity.entitySession.value?.id !== expectedId) return false
    const applied = await entity.applyEntitySession(expectedId)
    if (applied && editorError.value === startingError) editorError.value = ''
    return applied
  }

  function discardEntitySession(sessionId?: number): void {
    const active = entity.entitySession.value
    if (!active || (sessionId !== undefined && active.id !== sessionId)) return
    entity.discardEntitySession(active.id)
    if (entity.entitySession.value === null) editorError.value = ''
  }

  async function applyRouteSession(sessionId: number): Promise<boolean> {
    if (route.routeSession.value?.id !== sessionId) return false
    const startingError = editorError.value
    if (!await beforeWorkspaceOperation()) return false
    if (route.routeSession.value?.id !== sessionId) return false
    const applied = await route.applyRouteSession(sessionId)
    if (applied && editorError.value === startingError) editorError.value = ''
    return applied
  }

  function discardRouteSession(sessionId?: number): void {
    const active = route.routeSession.value
    if (!active || (sessionId !== undefined && active.id !== sessionId)) return
    route.discardRouteSession(active.id)
    if (route.routeSession.value === null) editorError.value = ''
  }

  const transitions = useEditorTransitions({
    chart: charts,
    entity: {
      session: entity.entitySession,
      hasModified: entity.hasModifiedEntitySession,
      apply: applyEntitySession,
      discard: discardEntitySession,
    },
    route: {
      session: route.routeSession,
      hasModified: route.hasModifiedRouteSession,
      apply: applyRouteSession,
      discard: discardRouteSession,
    },
    clearEditorError: () => { editorError.value = '' },
    beforeWorkspaceOperation,
  })
  const publicationCommands = usePublicationWorkflows({
    workspace,
    store,
    mutations,
    transitions,
    routeSharing: {
      session: route.routeSession,
      sessionGeneration: route.sessionGeneration,
      beforeWorkspaceOperation,
    },
    setError: message => { editorError.value = message },
  })
  const mapControls = useEditorMapControls(workspace, store, {
    orbitPlacementPreview: entity.orbitPlacementPreview,
    entitySession: entity.entitySession,
  }, options.continuousMap)
  const viewport = useEditorViewport(store)
  const navigation = useEditorNavigation({
    workspace,
    continuousMap: options.continuousMap,
    waitForSearchPresentation: options.waitForSearchPresentation,
    captureAddCleanup: () => {
      const clearSystemCreation = systemCreation.captureSearchContextCleanup()
      const clearClusterAdd = clusterSystemPlacement.captureSearchContextCleanup()
      return () => {
        clearSystemCreation?.()
        clearClusterAdd?.()
      }
    },
    store,
    mapControls,
    chart: charts,
    transitions,
    viewport,
    entity,
    route,
    editorError,
    beforeWorkspaceOperation,
  })
  const appliedRevision = computed(() => options.appliedRevision?.value ?? 0)

  function revealTransferredObject(objectId: string): void {
    const currentWorkspace = workspace.value
    if (!currentWorkspace) return
    const target = resolveSystemObjectHistoryTarget(currentWorkspace, objectId)
    if (!target) return
    const revealCamera = async (): Promise<void> => {
      await nextTick()
      if (workspace.value !== currentWorkspace) return
      mapControls.revealHistoryTarget(target)
    }
    if (options.continuousMap?.value) {
      void navigation.inspectContinuousTarget({
        kind: 'object',
        systemId: target.systemId,
        objectId: target.id,
      }).then(accepted => accepted ? revealCamera() : undefined)
      return
    }
    void navigation.selectSystem(target.systemId).then(async () => {
      if (workspace.value !== currentWorkspace || store.activeView !== 'system'
        || store.selectedSystemId !== target.systemId) return
      await navigation.selectObject(target.id, true, { leaveChart: false })
      await revealCamera()
    })
  }

  const systemTransfer = useSystemObjectTransferWorkflow({
    workspace,
    appliedRevision,
    history: mutations,
    resolveBeforeTransfer: () => transitions.resolveTransition(),
    beforeWorkspaceOperation,
    prepareDestinationMap: async (systemId, isCurrent) => {
      if (!isCurrent()) return false
      if (options.continuousMap?.value) {
        if (!await navigation.inspectContinuousTarget({ kind: 'system', systemId }, false, isCurrent)) return false
      } else {
        await navigation.selectSystem(systemId)
        if (!isCurrent() || store.activeView !== 'system' || store.selectedSystemId !== systemId) return false
      }
      if (!isCurrent()) return false
      if (viewport.isCompactViewport.value) store.setCompactPanel(null)
      await nextTick()
      const map = mapControls.placementMapRef.value
      if (!map || !map.whenReady || !await map.whenReady() || !isCurrent()
        || !map.isSystemTransferDestination?.(systemId)) return false
      return map.frameSystemTransferDestination?.(systemId) ?? false
    },
    captureDestinationMapOwner: systemId => {
      const map = mapControls.placementMapRef.value
      return map?.isSystemTransferDestination?.(systemId)
        ? map.captureSystemTransferMapOwner?.(systemId) ?? null
        : null
    },
    isDestinationMapOwnerCurrent: (systemId, owner) => {
      const map = mapControls.placementMapRef.value
      return map?.isSystemTransferDestination?.(systemId) === true
        && map.isSystemTransferMapOwnerCurrent?.(systemId, owner) === true
    },
    onApplied: target => revealTransferredObject(target.rootObjectId),
  })
  watch(workspaceContextId, () => systemTransfer.dispose(), { flush: 'sync' })
  onBeforeUnmount(() => systemTransfer.dispose())
  const publicationMenu = usePublicationMenu({
    workspace,
    store,
    canRestoreFocus: options.canRestorePublicationFocus,
    prepareContextObjectSelection: navigation.selectContextObject,
  })
  const searchOpen = computed({
    get: () => store.searchOpen,
    set: (open: boolean) => store.setSearchOpen(open),
  })
  const searchQuery = computed({
    get: () => store.searchQuery,
    set: (query: string) => store.setSearchQuery(query),
  })
  const searchResults = computed<SearchResult[]>(() => workspace.value
    ? searchWorkspace(workspace.value, searchQuery.value, filterCriteria.search.criteria.value)
    : [])

  function resetSearch(): void {
    store.resetSearch()
    filterCriteria.clearSearchNotice()
  }

  const fields = useFieldDefinitionWorkflows({
    workspace,
    mutations,
    resolveTransition: transitions.resolveTransition,
    isEntityCommandBlocked: navigation.isEntityCommandBlocked,
    beforeWorkspaceOperation,
  })
  const map = useMapWorkflows({
    workspace,
    mutations,
    systemMapRef: mapControls.placementMapRef,
    continuousMap: options.continuousMap,
    resolveTransition: transitions.resolveTransition,
    beginObjectSession: entity.beginObjectSession,
    beginOrbitSession: entity.beginOrbitSession,
    isEntityCommandBlocked: navigation.isEntityCommandBlocked,
    createCommittedPositionAppliedHandler: entity.createCommittedPositionAppliedHandler,
    createCommittedOrbitCenterAppliedHandler: entity.createCommittedOrbitCenterAppliedHandler,
    onOrbitRadiiIncreased: options.onOrbitRadiiIncreased,
    editorError,
    orbitAdjustments,
    beforeWorkspaceOperation,
  })
  const move = useSelectedObjectDrag({
    workspace,
    appliedRevision: options.appliedRevision,
    mutations,
    isEntityCommandBlocked: navigation.isEntityCommandBlocked,
    createCommittedPositionAppliedHandler: entity.createCommittedPositionAppliedHandler,
    error: collectiveMoveError,
    beforeWorkspaceOperation,
  })
  const objectInspectorFocusRequest = ref<ObjectInspectorFocusRequest | null>(null)
  let objectInspectorFocusSequence = 0
  const systemCreation = useSystemCreationWorkflows({
    workspace,
    systemMapRef: mapControls.systemMapRef,
    mutations,
    isEntityCommandBlocked: navigation.isEntityCommandBlocked,
    resolveObjectCreationTransition: () => transitions.resolveTransition({ leaveChart: false }),
    beforeWorkspaceOperation,
    isSearchContextChangeHeld: navigation.isSearchContextChangeHeld,
    onObjectCreated: async (objectId) => {
      await navigation.selectObject(objectId, !viewport.isCompactViewport.value, { leaveChart: false })
      if (store.activeView !== 'system' || store.selectedObjectId !== objectId) return
      await map.beginObjectEdit()
      const session = entity.entitySession.value
      if (session?.kind !== 'object' || session.targetId !== objectId
        || store.selectedObjectId !== objectId || !viewport.inspectorPanelVisible.value) return
      objectInspectorFocusSequence += 1
      objectInspectorFocusRequest.value = { id: objectInspectorFocusSequence, objectId }
    },
  })
  const systemObjectPlacement = useSystemObjectPlacement({
    workspace,
    creationActive: computed(() => systemCreation.creationSession.value !== null),
    systemMapRef: mapControls.placementMapRef,
    continuousMap: options.continuousMap,
    mutations,
    isEntityCommandBlocked: navigation.isEntityCommandBlocked,
    beforeWorkspaceOperation,
    createCommittedPositionAppliedHandler: entity.createCommittedPositionAppliedHandler,
  })
  const unresolvedExitPlacement = useUnresolvedExitPlacement({
    workspace,
    selectedRouteId: computed(() => store.selectedRouteId),
    clusterMapRef: mapControls.clusterMapRef,
    mutations,
    beforeWorkspaceOperation,
  })
  const orbitCenterPlacement = useOrbitCenterPlacement({
    workspace,
    creationActive: computed(() => systemCreation.creationSession.value !== null),
    systemMapRef: mapControls.placementMapRef,
    continuousMap: options.continuousMap,
    isEntityCommandBlocked: navigation.isEntityCommandBlocked,
    moveOrbitCenter: map.moveMapOrbitCenter,
  })
  const clusterSystemPlacement = useClusterSystemPlacement({
    workspace,
    clusterMapRef: mapControls.clusterMapRef,
    mutations,
    beforeWorkspaceOperation,
  })
  watch([() => store.activeView, () => store.selectedSystemId], () => {
    if (navigation.isSearchContextChangeHeld()) return
    if (systemCreation.creationSession.value) systemCreation.quitAdd()
    if (clusterSystemPlacement.clusterAddType.value) clusterSystemPlacement.quitClusterAdd()
  }, { flush: 'sync' })
  watch(route.routeSession, session => {
    if (!session && clusterSystemPlacement.clusterAddType.value === 'route') {
      clusterSystemPlacement.quitClusterAdd()
    }
  }, { flush: 'sync' })

  const cluster = useClusterWorkflows({
    workspace,
    mutations,
    onDeletionApplied: plan => {
      navigation.cleanupAfterDeletion(plan)
      systemCreation.pruneTargetsAfterDeletion(plan)
    },
    saveState,
    chartNamesDialogOpen: transitions.chartNamesDialogOpen,
    fieldDefinitionDialogOpen: fields.fieldDefinitionDialogOpen,
    beginRouteSession: route.beginRouteSession,
    routeSession: route.routeSession,
    armRouteAdd: clusterSystemPlacement.armRouteAdd,
    resolveTransition: transitions.resolveTransition,
    isEntityDraftCommandBlocked: entity.isEntityCommandBlocked,
    isRouteCommandBlocked: route.isRouteCommandBlocked,
    isChartDraftTarget: navigation.isChartDraftTarget,
    editorError,
    beforeWorkspaceOperation,
  })
  const interactions = useMapInteractionCoordinator({
    workspace,
    store,
    selectedSystem: navigation.selectedSystem,
    entity,
    navigation,
    placement: systemObjectPlacement,
    creation: systemCreation,
    viewport,
    beginOrbitEdit: map.beginOrbitEdit,
    continuousMap: options.continuousMap,
  })

  const historyGuards = computed(() => {
    if (systemTransfer.session.value) return systemTransfer.session.value.placingOnMap
      ? 'Finish or cancel the transfer map placement first.'
      : 'Apply or cancel the open transfer review first.'
    if (entity.hasModifiedEntitySession.value) return 'Apply or discard the modified Inspector draft first.'
    if (route.hasModifiedRouteSession.value) return 'Apply or discard the modified Jump Route draft first.'
    if (charts.hasChangedNames.value) return 'Apply or discard the modified Jump Cluster details draft first.'
    if (fields.hasModifiedFieldDefinitionsSession.value) return 'Apply or discard the modified Fields draft first.'
    if (transitions.transitionGuard.value) return 'Finish the pending draft decision first.'
    if (fields.hasPendingHistoryDecision.value) return 'Finish the pending Fields review or decision first.'
    if (route.hasPendingHistoryChoice.value) return 'Finish choosing the Jump Route endpoints first.'
    if (entity.hasPendingHistoryChoice.value) return 'Finish choosing the Orbit placement first.'
    if (systemCreation.hasPendingHistoryInput.value) return 'Finish or cancel the object or Orbit placement first.'
    if (clusterSystemPlacement.clusterAddType.value === 'route' || route.routeSession.value?.routeId === null) {
      return 'Finish or cancel the current Cluster route action first.'
    }
    if (clusterSystemPlacement.hasPendingHistoryInput.value) return 'Finish or restore the pending Cluster placement inputs first.'
    if (clusterSystemPlacement.clusterSystemMovePreview.value) return 'Confirm or cancel the pending system-move preview first.'
    if (clusterSystemPlacement.clusterSystemMapMoveTargeting.value) return 'Finish or cancel the current system move first.'
    if (systemObjectPlacement.systemObjectMoveCandidateRequest.value !== 0
      && systemObjectPlacement.systemObjectMoveCandidates.value.length) {
      return 'Choose or cancel the pending object-placement target first.'
    }
    if (systemObjectPlacement.hasPendingHistoryInput.value) return 'Finish or restore the pending object-placement inputs first.'
    if (systemObjectPlacement.systemObjectMovePreview.value) return 'Confirm or cancel the pending object-move preview first.'
    if (systemObjectPlacement.systemObjectMapMoveTargeting.value) return 'Finish or cancel the current object move first.'
    if (unresolvedExitPlacement.preview.value) return 'Confirm or cancel the unresolved-exit preview first.'
    if (orbitCenterPlacement.orbitCenterMovePreview.value || orbitCenterPlacement.orbitCenterMapMoveTargeting.value) {
      return 'Confirm or cancel the Orbit-center move first.'
    }
    if (entity.orbitPlacementPreview.value) return 'Finish or cancel the pending Orbit-placement preview first.'
    if (cluster.deletionReview.value) return 'Finish or cancel the open map-deletion review first.'
    if (mapControls.editingGestureActive.value) return 'Finish the active map gesture first.'
    return null
  })

  function endCleanHistorySessions(): void {
    charts.endCleanHistorySession()
    entity.endCleanHistorySession()
    route.endCleanHistorySession()
    fields.endCleanHistorySession()
  }

  /** Ends editor-owned drafts, reviews and targeting only after a complete replacement is durable. */
  function resetForWorkspaceReplacement(): void {
    systemTransfer.dispose()
    transitions.cancelPendingTransition()
    const chartSession = charts.session.value
    if (chartSession) charts.discard(chartSession.id)
    const entitySession = entity.entitySession.value
    if (entitySession) entity.discardEntitySession(entitySession.id)
    const routeSession = route.routeSession.value
    if (routeSession) route.discardRouteSession(routeSession.id)
    fields.resetForWorkspaceReplacement()
    cluster.cancelDeletionReview()
    systemCreation.cancelCreationPreview()
    systemCreation.cancelOrbitDrag()
    systemCreation.quitAdd()
    systemObjectPlacement.cancelSystemObjectMovePreview()
    clusterSystemPlacement.cancelSystemMovePreview()
    clusterSystemPlacement.quitClusterAdd()
    unresolvedExitPlacement.cancel()
    orbitCenterPlacement.cancelOrbitCenterMove(false)
    orbitAdjustments.reset()
    store.reset(workspaceContextId.value)
  }

  async function quitAdd(isCurrent: () => boolean = () => true): Promise<boolean> {
    if (!isCurrent() || !await beforeWorkspaceOperation() || !isCurrent()) return false
    route.cancelRouteCreation()
    clusterSystemPlacement.quitClusterAdd()
    systemCreation.quitAdd()
    store.setMode('select')
    return true
  }

  function acknowledgeObjectInspectorFocusRequest(requestId: number): void {
    if (objectInspectorFocusRequest.value?.id === requestId) objectInspectorFocusRequest.value = null
  }

  return {
    move: {
      ...move,
      error: computed(() => collectiveMoveError.value),
    },
    publication: {
      set: publicationCommands.set,
      setRouteSharing: publicationCommands.setRouteSharing,
      busy: publicationCommands.busy,
      menuRequest: publicationMenu.request,
      openMenu: publicationMenu.openMenu,
      closeMenu: publicationMenu.close,
    },
    search: {
      open: searchOpen,
      query: searchQuery,
      results: searchResults,
      reset: resetSearch,
      reveal: navigation.revealSearchTarget,
    },
    filterCriteria,
    historyGuards: {
      blockReason: historyGuards,
      endCleanSessions: endCleanHistorySessions,
      resetForWorkspaceReplacement,
    },
    inspector: {
      objectInspectorFocusRequest,
      acknowledgeObjectInspectorFocusRequest,
      entitySession: entity.entitySession,
      hasModifiedEntitySession: entity.hasModifiedEntitySession,
      orbitPlacementPreview: entity.orbitPlacementPreview,
      isEntityCommandBlocked: entity.isEntityCommandBlocked,
      resumeEntitySession: navigation.resumeEntitySession,
      beginObjectEdit: map.beginObjectEdit,
      beginOrbitEdit: map.beginOrbitEdit,
      updateObjectPlacement: entity.updateObjectPlacement,
      updateOrbitHost: entity.updateOrbitHost,
      previewOrbitPlacement: entity.previewOrbitPlacement,
      cancelOrbitPlacementPreview: entity.cancelOrbitPlacementPreview,
      applyEntitySession,
      discardEntitySession,
      routeSession: route.routeSession,
      hasModifiedRouteSession: route.hasModifiedRouteSession,
      offerRouteSystems: route.offerRouteSystems,
      chooseRouteSystem: route.chooseRouteSystem,
      chooseRoutePoint: route.chooseRoutePoint,
      updateRouteInput: route.updateRouteInput,
      applyRouteSession,
      discardRouteSession,
      cancelRouteCreation: route.cancelRouteCreation,
      systemTransferSession: systemTransfer.session,
      handleSystemTransferIntent: (intent: SystemObjectTransferIntent) => systemTransfer.handleIntent(intent),
    },
    charts: {
      session: charts.session,
      clusterName: charts.clusterName,
      systemName: charts.systemName,
      playerTitle: charts.playerTitle,
      publication: charts.publication,
      draftSystemName: charts.draftSystemName,
      dialogOpen: transitions.chartNamesDialogOpen,
      editing: charts.editing,
      transitionGuard: transitions.transitionGuard,
      formError: charts.formError,
      hasUncommittedNames: charts.hasUncommittedNames,
      hasChartNameDraft: charts.hasDraft,
      saveMessage: charts.saveMessage,
      submitNames: charts.submit,
      cancelNamesEdit: charts.discard,
      hideEditing: charts.hideEditing,
      showEditing: charts.showEditing,
      beginNamesEdit: navigation.beginChartNamesEdit,
      resolveTransition: transitions.resolveTransition,
      resolveTransitionChoice: transitions.resolveTransitionChoice,
    },
    fields: {
      fieldDefinitionsSession: fields.fieldDefinitionsSession,
      getFieldDefinitionImportConflict: fields.getFieldDefinitionImportConflict,
      fieldDefinitionDialogOpen: fields.fieldDefinitionDialogOpen,
      fieldDefinitionError: fields.fieldDefinitionError,
      hasModifiedFieldDefinitionsSession: fields.hasModifiedFieldDefinitionsSession,
      fieldDefinitionsDialog: fields.fieldDefinitionsDialog,
      openFieldDefinitions: fields.openFieldDefinitions,
      handleFieldDefinitionsIntent: fields.handleFieldDefinitionsIntent,
    },
    cluster: {
      beginRoute: cluster.beginRoute,
      beginRouteEdit: cluster.beginRouteEdit,
      deleteSystem: cluster.deleteSystem,
      deleteSelectedObject: cluster.deleteSelectedObject,
      deleteSelectedOrbit: cluster.deleteSelectedOrbit,
      deleteSelectedRoute: cluster.deleteSelectedRoute,
      deletionReview: cluster.deletionReview,
      cancelDeletionReview: cluster.cancelDeletionReview,
      confirmDeletionReview: cluster.confirmDeletionReview,
    },
    placement: {
      unresolvedExit: unresolvedExitPlacement,
      orbitCenter: orbitCenterPlacement,
      map: {
        moveSystem: map.moveSystem,
        moveMapObject: map.moveMapObject,
        moveMapObjectInSystem: map.moveMapObjectInSystem,
        addMapObjectInSystem: map.addMapObjectInSystem,
        placeMapObjectInOrbit: map.placeMapObjectInOrbit,
        rotateMapObject: map.rotateMapObject,
        resizeMapOrbit: map.resizeMapOrbit,
        rotateMapOrbit: map.rotateMapOrbit,
        moveMapOrbitCenter: map.moveMapOrbitCenter,
        detachSelectedOrbit: map.detachSelectedOrbit,
      },
      creation: {
        creationSession: systemCreation.creationSession,
        chooseCreationType: systemCreation.chooseCreationType,
        chooseCreationCandidate: systemCreation.chooseCreationCandidate,
        updateCreationInput: systemCreation.updateCreationInput,
        offerCreationCandidates: systemCreation.offerCreationCandidates,
        addCreationFromInputs: systemCreation.addCreationFromInputs,
        handleCreationDrop: systemCreation.handleCreationDrop,
        cancelCreationPreview: systemCreation.cancelCreationPreview,
        beginOrbitDrag: systemCreation.beginOrbitDrag,
        updateOrbitDrag: systemCreation.updateOrbitDrag,
        completeOrbitDrag: systemCreation.completeOrbitDrag,
        cancelOrbitDrag: systemCreation.cancelOrbitDrag,
      },
      systemObject: {
        systemObjectMapMoveTargeting: systemObjectPlacement.systemObjectMapMoveTargeting,
        beginSystemObjectMapMove: systemObjectPlacement.beginSystemObjectMapMove,
        previewSystemObjectMoveAt: systemObjectPlacement.previewSystemObjectMoveAt,
        nudgeSystemObjectMove: systemObjectPlacement.nudgeSystemObjectMove,
        systemObjectMoveAvailable: systemObjectPlacement.systemObjectMoveAvailable,
        systemObjectMoveDestination: systemObjectPlacement.systemObjectMoveDestination,
        systemObjectMoveDestinationOptions: systemObjectPlacement.systemObjectMoveDestinationOptions,
        systemObjectMoveCandidates: systemObjectPlacement.systemObjectMoveCandidates,
        systemObjectMoveCandidateRequest: systemObjectPlacement.systemObjectMoveCandidateRequest,
        systemObjectMovePreview: systemObjectPlacement.systemObjectMovePreview,
        systemObjectMoveError: systemObjectPlacement.systemObjectMoveError,
        updateSystemObjectMoveDestination: systemObjectPlacement.updateSystemObjectMoveDestination,
        chooseObjectMoveCandidate: systemObjectPlacement.chooseObjectMoveCandidate,
        confirmSystemObjectMove: systemObjectPlacement.confirmSystemObjectMove,
        cancelSystemObjectMovePreview: systemObjectPlacement.cancelSystemObjectMovePreview,
      },
      clusterSystem: {
        clusterAddType: clusterSystemPlacement.clusterAddType,
        clusterAddError: clusterSystemPlacement.clusterAddError,
        clusterMoveTargeting: clusterSystemPlacement.clusterMoveTargeting,
        clusterSystemMapMoveTargeting: clusterSystemPlacement.clusterSystemMapMoveTargeting,
        clusterSystemMovePreview: clusterSystemPlacement.clusterSystemMovePreview,
        clusterSystemMoveError: clusterSystemPlacement.clusterSystemMoveError,
        armSystemAdd: clusterSystemPlacement.armSystemAdd,
        addSystemAt: clusterSystemPlacement.addSystemAt,
        beginClusterSystemMapMove: clusterSystemPlacement.beginClusterSystemMapMove,
        previewSystemMoveAt: clusterSystemPlacement.previewSystemMoveAt,
        nudgeClusterSystemMove: clusterSystemPlacement.nudgeClusterSystemMove,
        cancelSystemMovePreview: clusterSystemPlacement.cancelSystemMovePreview,
        confirmSystemMove: clusterSystemPlacement.confirmSystemMove,
      },
      interactions: {
        handleObjectMoveCandidates: interactions.handleObjectMoveCandidates,
        handleOrbitCenterCandidates: interactions.handleOrbitCenterCandidates,
      },
      quitAdd,
    },
    mapControls: {
      clusterMapRef: mapControls.clusterMapRef,
      systemMapRef: mapControls.systemMapRef,
      activeMapKey: mapControls.activeMapKey,
      editingGestureActive: mapControls.editingGestureActive,
      setEditingGestureActive: mapControls.setEditingGestureActive,
      initialViewport: mapControls.initialViewport,
      zoomLevel: mapControls.zoomLevel,
      minimumZoomLevel: mapControls.minimumZoomLevel,
      isCompactViewport: viewport.isCompactViewport,
      hierarchyPanelVisible: viewport.hierarchyPanelVisible,
      inspectorPanelVisible: viewport.inspectorPanelVisible,
      compactPanelOpen: viewport.compactPanelOpen,
      compactPanel: computed(() => store.compactPanel),
      requestPanel: viewport.requestPanel,
      closePanel: viewport.closePanel,
      togglePanel: viewport.togglePanel,
      focusActiveMap: mapControls.focusActiveMap,
      recordViewport: mapControls.recordViewport,
      setViewportPercentage: mapControls.setViewportPercentage,
      fitActiveMap: mapControls.fitActiveMap,
      centerInspectedTarget: mapControls.centerInspectedTarget,
      zoomActiveMap: mapControls.zoomActiveMap,
      panActiveMap: mapControls.panActiveMap,
      setMapMode: navigation.setMapMode,
    },
    transfer: {
      mapPreview: systemTransfer.mapPreview,
      pendingMapPlacement: systemTransfer.pendingMapPlacement,
      ownsMapPlacement: systemTransfer.ownsMapPlacement,
      previewMapPlacement: systemTransfer.previewMapPlacement,
      completeMapPlacement: systemTransfer.completeMapPlacement,
      handleIntent: (intent: SystemObjectTransferIntent) => systemTransfer.handleIntent(intent),
    },
    adjustments: {
      orbitAdjustmentPreview: orbitAdjustments.preview,
      updateOrbitAdjustment: map.updateOrbitAdjustment,
      beforeWorkspaceOperation,
      resetOrbitAdjustments: orbitAdjustments.reset,
    },
    feedback: {
      editorError,
    },
    navigation: {
      continuousMapEnabled: navigation.continuousMapEnabled,
      activeView: navigation.activeView,
      mapMode: navigation.mapMode,
      selectedSystemId: navigation.selectedSystemId,
      clusterSelectedSystemId: navigation.clusterSelectedSystemId,
      selectedObjectId: navigation.selectedObjectId,
      selectedObjectIds: navigation.selectedObjectIds,
      selectedOrbitId: navigation.selectedOrbitId,
      selectedRouteId: navigation.selectedRouteId,
      selectedSystem: navigation.selectedSystem,
      clusterSelectedSystem: navigation.clusterSelectedSystem,
      inspectedClusterSystem: navigation.inspectedClusterSystem,
      inspectedTarget: navigation.inspectedTarget,
      selectedObject: navigation.selectedObject,
      selectedOrbit: navigation.selectedOrbit,
      selectedRoute: navigation.selectedRoute,
      routeEndpointSummary: navigation.routeEndpointSummary,
      showClusterMap: navigation.showClusterMap,
      selectSystem: navigation.selectSystem,
      selectClusterSystem: navigation.selectClusterSystem,
      inspectContinuousTarget: navigation.inspectContinuousTarget,
      selectObject: navigation.selectObject,
      replaceObjectSelection: navigation.replaceObjectSelection,
      toggleObjectSelection: navigation.toggleObjectSelection,
      clearObjectSelectionForMove: navigation.clearObjectSelectionForMove,
      selectOrbit: navigation.selectOrbit,
      selectRoute: navigation.selectRoute,
      showChartDetails: navigation.showChartDetails,
      revealHistoryContext: navigation.revealHistoryContext,
    },
  }
}
