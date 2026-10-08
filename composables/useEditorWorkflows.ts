/**
 * Composes editor state and focused commands around the page's commit boundary; it does not own persistence.
 */
import { useClusterWorkflows } from './editor-workflows/useClusterWorkflows'
import { useEditorState } from './editor-workflows/useEditorState'
import { useFieldDefinitionWorkflows } from './editor-workflows/useFieldDefinitionWorkflows'
import { useMapWorkflows } from './editor-workflows/useMapWorkflows'
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
    commit: options.commit,
    confirmDiscardInspectorEdits: editorState.confirmDiscardInspectorEdits,
  })
  const clusterWorkflows = useClusterWorkflows({
    workspace: options.workspace,
    commit: options.commit,
    saveState: options.saveState,
    activeView: editorState.activeView,
    selectedSystemId: editorState.selectedSystemId,
    selectedObjectId: editorState.selectedObjectId,
    selectedOrbitId: editorState.selectedOrbitId,
    selectedRouteId: editorState.selectedRouteId,
    chartNamesEditing: editorState.chartNamesEditing,
    fieldDefinitionDialogOpen: fieldDefinitions.fieldDefinitionDialogOpen,
    selectedSystem: editorState.selectedSystem,
    selectedObject: editorState.selectedObject,
    selectedOrbit: editorState.selectedOrbit,
    selectedRoute: editorState.selectedRoute,
    mapInspectorRef: editorState.mapInspectorRef,
    confirmDiscardInspectorEdits: editorState.confirmDiscardInspectorEdits,
    editorError: editorState.editorError,
  })
  const mapWorkflows = useMapWorkflows({
    workspace: options.workspace,
    commit: options.commit,
    selectedSystem: editorState.selectedSystem,
    selectedObject: editorState.selectedObject,
    selectedOrbit: editorState.selectedOrbit,
    selectedObjectId: editorState.selectedObjectId,
    selectedOrbitId: editorState.selectedOrbitId,
    mapInspectorRef: editorState.mapInspectorRef,
    systemMapRef: editorState.systemMapRef,
    confirmDiscardInspectorEdits: editorState.confirmDiscardInspectorEdits,
    editorError: editorState.editorError,
  })

  return {
    ...editorState,
    ...fieldDefinitions,
    ...clusterWorkflows,
    ...mapWorkflows,
  }
}
