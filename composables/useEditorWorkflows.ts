import { computed, watch } from 'vue'

/**
 * Composes editor state and focused commands around the page's commit boundary; it does not own persistence.
 */
import { useClusterWorkflows } from './editor-workflows/useClusterWorkflows'
import { useClusterSystemPlacement } from './editor-workflows/useClusterSystemPlacement'
import { useEditorState } from './editor-workflows/useEditorState'
import { useFieldDefinitionWorkflows } from './editor-workflows/useFieldDefinitionWorkflows'
import { useMapWorkflows } from './editor-workflows/useMapWorkflows'
import { useSystemCreationWorkflows } from './editor-workflows/useSystemCreationWorkflows'
import { useSystemObjectPlacement } from './editor-workflows/useSystemObjectPlacement'
import type { EditorWorkflowOptions } from './editor-workflows/types'

/**
 * Builds the state and action surface consumed by the workspace page.
 * @param options Shared refs and the single persistence callback provided by the page owner.
 * @returns Combined editor state, field-definition, cluster, and system-map workflows.
 */
export function useEditorWorkflows(options: EditorWorkflowOptions) {
  const editorState = useEditorState(options)
  const fieldDefinitions = useFieldDefinitionWorkflows({
    workspace: options.workspace,
    applyWorkspace: options.applyWorkspace,
    resolveTransition: editorState.resolveTransition,
    isEntityCommandBlocked: editorState.isEntityCommandBlocked,
  })
  const systemCreation = useSystemCreationWorkflows({
    workspace: options.workspace,
    selectedSystem: editorState.selectedSystem,
    systemMapRef: editorState.systemMapRef,
    applyWorkspace: options.applyWorkspace,
    isEntityCommandBlocked: editorState.isEntityCommandBlocked,
  })
  const systemObjectPlacement = useSystemObjectPlacement({
    workspace: options.workspace,
    activeView: editorState.activeView,
    mapMode: editorState.mapMode,
    creationActive: computed(() => systemCreation.creationSession.value !== null),
    selectedSystemId: editorState.selectedSystemId,
    selectedObjectId: editorState.selectedObjectId,
    selectedSystem: editorState.selectedSystem,
    selectedObject: editorState.selectedObject,
    systemMapRef: editorState.systemMapRef,
    applyWorkspace: options.applyWorkspace,
    isEntityCommandBlocked: editorState.isEntityCommandBlocked,
  })
  const clusterSystemPlacement = useClusterSystemPlacement({
    workspace: options.workspace,
    activeView: editorState.activeView,
    mapMode: editorState.mapMode,
    selectedSystemId: editorState.clusterSelectedSystemId,
    clusterMapRef: editorState.clusterMapRef,
    applyWorkspace: options.applyWorkspace,
  })
  watch(editorState.routeSession, session => {
    if (!session && clusterSystemPlacement.clusterAddType.value === 'route') {
      clusterSystemPlacement.quitClusterAdd()
    }
  }, { flush: 'sync' })
  const clusterWorkflows = useClusterWorkflows({
    workspace: options.workspace,
    commit: options.commit,
    applyWorkspace: options.applyWorkspace,
    onDeletionApplied: plan => {
      editorState.cleanupAfterDeletion(plan)
      systemCreation.pruneTargetsAfterDeletion(plan)
    },
    saveState: options.saveState,
    activeView: editorState.activeView,
    selectedSystemId: editorState.selectedSystemId,
    selectedObjectId: editorState.selectedObjectId,
    selectedOrbitId: editorState.selectedOrbitId,
    selectedRouteId: editorState.selectedRouteId,
    chartNamesDialogOpen: editorState.chartNamesDialogOpen,
    fieldDefinitionDialogOpen: fieldDefinitions.fieldDefinitionDialogOpen,
    selectedSystem: editorState.selectedSystem,
    selectedObject: editorState.selectedObject,
    selectedOrbit: editorState.selectedOrbit,
    selectedRoute: editorState.selectedRoute,
    mapInspectorRef: editorState.mapInspectorRef,
    beginRouteSession: editorState.beginRouteSession,
    routeSession: editorState.routeSession,
    armRouteAdd: clusterSystemPlacement.armRouteAdd,
    resolveTransition: editorState.resolveTransition,
    isEntityCommandBlocked: editorState.isEntityCommandBlocked,
    isEntityDraftCommandBlocked: editorState.isEntityDraftCommandBlocked,
    isRouteCommandBlocked: editorState.isRouteCommandBlocked,
    isChartDraftTarget: editorState.isChartDraftTarget,
    contextStamp: editorState.contextStamp,
    selectCreatedSystem: editorState.selectCreatedSystem,
    editorError: editorState.editorError,
  })
  const mapWorkflows = useMapWorkflows({
    workspace: options.workspace,
    commit: options.commit,
    applyWorkspace: options.applyWorkspace,
    selectedSystem: editorState.selectedSystem,
    selectedObject: editorState.selectedObject,
    selectedOrbit: editorState.selectedOrbit,
    mapInspectorRef: editorState.mapInspectorRef,
    systemMapRef: editorState.systemMapRef,
    resolveTransition: editorState.resolveTransition,
    beginObjectSession: editorState.beginObjectSession,
    beginOrbitSession: editorState.beginOrbitSession,
    isEntityCommandBlocked: editorState.isEntityCommandBlocked,
    editorError: editorState.editorError,
  })

  function quitAdd(): void {
    editorState.cancelRouteCreation()
    clusterSystemPlacement.quitClusterAdd()
    systemCreation.quitAdd()
    editorState.setMapMode('select')
  }

  return {
    ...editorState,
    ...fieldDefinitions,
    ...clusterWorkflows,
    ...mapWorkflows,
    ...systemCreation,
    ...systemObjectPlacement,
    ...clusterSystemPlacement,
    quitAdd,
  }
}
