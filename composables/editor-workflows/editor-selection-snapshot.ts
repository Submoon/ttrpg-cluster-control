import type { EditorUiSelection } from '../../stores/editor-ui'

/** Copies the canonical transient selection fields for an async ownership check. */
export function snapshotEditorSelection(selection: EditorUiSelection): EditorUiSelection {
  return {
    activeView: selection.activeView,
    selectedSystemId: selection.selectedSystemId,
    clusterSelectedSystemId: selection.clusterSelectedSystemId,
    inspectedClusterSystemId: selection.inspectedClusterSystemId,
    selectedObjectId: selection.selectedObjectId,
    selectedObjectIds: [...selection.selectedObjectIds],
    selectedOrbitId: selection.selectedOrbitId,
    selectedRouteId: selection.selectedRouteId,
  }
}
