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

/** Composes editor features around the page's single workspace writer and shared transient UI store. */
export function useEditorWorkflows(options: EditorWorkflowOptions) {
  const { workspace, saveState, saveError, mutations, initializeWorkspace } = options
  const store = useEditorUiStore()
  const editorError = ref('')
  const workspaceContextId = computed(() => {
    const current = workspace.value
    return current ? `${current.id}:${current.cluster.id}` : null
  })

  watch(workspaceContextId, contextId => {
    if (store.workspaceId !== contextId) store.reset(contextId)
  }, { immediate: true, flush: 'sync' })
  onBeforeUnmount(() => store.reset(null))

  const entity = useEntityInspectorSession({ workspace, mutations })
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
  const mapControls = useEditorMapControls(workspace, store, {
    orbitPlacementPreview: entity.orbitPlacementPreview,
    entitySession: entity.entitySession,
  })
  const viewport = useEditorViewport(store)
  const navigation = useEditorNavigation({
    workspace,
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
    systemMapRef: mapControls.systemMapRef,
    resolveTransition: transitions.resolveTransition,
    beginObjectSession: entity.beginObjectSession,
    beginOrbitSession: entity.beginOrbitSession,
    isEntityCommandBlocked: navigation.isEntityCommandBlocked,
    acceptCommittedPosition: entity.acceptCommittedPosition,
    acceptCommittedOrbitCenter: entity.acceptCommittedOrbitCenter,
    editorError,
    orbitAdjustments,
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
    systemMapRef: mapControls.systemMapRef,
    mutations,
    isEntityCommandBlocked: navigation.isEntityCommandBlocked,
    beforeWorkspaceOperation,
    acceptCommittedPosition: entity.acceptCommittedPosition,
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
    systemMapRef: mapControls.systemMapRef,
    isEntityCommandBlocked: navigation.isEntityCommandBlocked,
    moveOrbitCenter: map.moveMapOrbitCenter,
  })
  const clusterSystemPlacement = useClusterSystemPlacement({
    workspace,
    clusterMapRef: mapControls.clusterMapRef,
    mutations,
    beforeWorkspaceOperation,
  })
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
  })

  const historyGuards = computed(() => {
    if (entity.hasModifiedEntitySession.value) return 'Apply or discard the modified Inspector draft first.'
    if (route.hasModifiedRouteSession.value) return 'Apply or discard the modified Jump Route draft first.'
    if (charts.hasChangedNames.value) return 'Apply or discard the modified chart-name draft first.'
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

  async function quitAdd(): Promise<void> {
    if (!await beforeWorkspaceOperation()) return
    route.cancelRouteCreation()
    clusterSystemPlacement.quitClusterAdd()
    systemCreation.quitAdd()
    store.setMode('select')
  }

  function acknowledgeObjectInspectorFocusRequest(requestId: number): void {
    if (objectInspectorFocusRequest.value?.id === requestId) objectInspectorFocusRequest.value = null
  }

  return {
    historyGuards: {
      blockReason: historyGuards,
      endCleanSessions: endCleanHistorySessions,
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
      chooseRoutePoint: route.chooseRoutePoint,
      updateRouteInput: route.updateRouteInput,
      applyRouteSession,
      discardRouteSession,
      cancelRouteCreation: route.cancelRouteCreation,
    },
    charts: {
      clusterName: charts.clusterName,
      systemName: charts.systemName,
      draftSystemName: charts.draftSystemName,
      dialogOpen: transitions.chartNamesDialogOpen,
      transitionGuard: transitions.transitionGuard,
      formError: charts.formError,
      hasUncommittedNames: charts.hasUncommittedNames,
      hasChartNameDraft: charts.hasDraft,
      saveMessage: charts.saveMessage,
      submitNames: charts.submit,
      cancelNamesEdit: charts.discard,
      beginNamesEdit: navigation.beginChartNamesEdit,
      setDialogOpen: transitions.setChartNamesDialogOpen,
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
      recordViewport: mapControls.recordViewport,
      setViewportPercentage: mapControls.setViewportPercentage,
      fitActiveMap: mapControls.fitActiveMap,
      zoomActiveMap: mapControls.zoomActiveMap,
      panActiveMap: mapControls.panActiveMap,
      setMapMode: navigation.setMapMode,
    },
    adjustments: {
      orbitAdjustmentPreview: orbitAdjustments.preview,
      updateOrbitAdjustment: map.updateOrbitAdjustment,
      beforeWorkspaceOperation,
      resetOrbitAdjustments: orbitAdjustments.reset,
    },
    feedback: {
      editorError,
      orbitAdjustmentNotice: map.orbitAdjustmentNotice,
    },
    navigation: {
      activeView: navigation.activeView,
      mapMode: navigation.mapMode,
      selectedSystemId: navigation.selectedSystemId,
      clusterSelectedSystemId: navigation.clusterSelectedSystemId,
      selectedObjectId: navigation.selectedObjectId,
      selectedOrbitId: navigation.selectedOrbitId,
      selectedRouteId: navigation.selectedRouteId,
      selectedSystem: navigation.selectedSystem,
      clusterSelectedSystem: navigation.clusterSelectedSystem,
      inspectedClusterSystem: navigation.inspectedClusterSystem,
      selectedObject: navigation.selectedObject,
      selectedOrbit: navigation.selectedOrbit,
      selectedRoute: navigation.selectedRoute,
      routeEndpointSummary: navigation.routeEndpointSummary,
      showClusterMap: navigation.showClusterMap,
      selectSystem: navigation.selectSystem,
      selectClusterSystem: navigation.selectClusterSystem,
      selectObject: navigation.selectObject,
      selectOrbit: navigation.selectOrbit,
      selectRoute: navigation.selectRoute,
      showChartDetails: navigation.showChartDetails,
      revealHistoryContext: navigation.revealHistoryContext,
    },
  }
}
