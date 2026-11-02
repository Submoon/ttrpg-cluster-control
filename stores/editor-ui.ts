import { defineStore } from 'pinia'
import type { MapVisitMemory, MapVisitSelection, MapInteractionMode, WorkspacePanel } from '../composables/editor-workflows/types'

export interface EditorUiSelection {
  activeView: 'cluster' | 'system'
  selectedSystemId: string | null
  clusterSelectedSystemId: string | null
  inspectedClusterSystemId: string | null
  selectedObjectId: string | null
  selectedOrbitId: string | null
  selectedRouteId: string | null
}

const emptySelection = (): EditorUiSelection => ({
  activeView: 'system',
  selectedSystemId: null,
  clusterSelectedSystemId: null,
  inspectedClusterSystemId: null,
  selectedObjectId: null,
  selectedOrbitId: null,
  selectedRouteId: null,
})

/** Shared, serializable editor UI state. Workspace data, drafts, browser resources, and persistence stay with their owners. */
export const useEditorUiStore = defineStore('editor-ui', {
  state: () => ({
    workspaceId: null as string | null,
    ...emptySelection(),
    mapMode: 'select' as MapInteractionMode,
    searchOpen: false,
    searchQuery: '',
    hierarchyPanelOpen: false,
    inspectorPanelOpen: true,
    compactPanel: null as WorkspacePanel | null,
    lastRequestedPanel: 'inspector' as WorkspacePanel,
    visits: {} as Record<string, MapVisitMemory>,
  }),
  actions: {
    /** Applies a selection snapshot only after its owning navigation or gesture guard accepts. */
    setSelection(selection: Partial<EditorUiSelection>): void {
      Object.assign(this, selection)
    },
    /** Applies the accepted interaction tool after any pending workflow has been resolved. */
    setMode(mode: MapInteractionMode): void {
      this.mapMode = mode
    },
    setSearchOpen(open: boolean): void {
      this.searchOpen = open
    },
    setSearchQuery(query: string): void {
      this.searchQuery = query
    },
    requestPanel(panel: WorkspacePanel): void {
      this.lastRequestedPanel = panel
      if (panel === 'hierarchy') this.hierarchyPanelOpen = true
      else this.inspectorPanelOpen = true
    },
    closePanel(panel: WorkspacePanel): void {
      if (panel === 'hierarchy') this.hierarchyPanelOpen = false
      else this.inspectorPanelOpen = false
      if (this.compactPanel === panel) this.compactPanel = null
    },
    setCompactPanel(panel: WorkspacePanel | null): void {
      this.compactPanel = panel
    },
    rememberVisit(key: string, visit: MapVisitMemory, protectedKey?: string): void {
      const next = { ...this.visits }
      delete next[key]
      next[key] = visit
      while (Object.keys(next).length > 24) {
        const oldest = Object.keys(next).find(candidate => candidate !== protectedKey)
        if (!oldest) break
        delete next[oldest]
      }
      this.visits = next
    },
    /** Keeps only surviving map contexts and normalizes their remembered selections. */
    pruneVisits(
      validKeys: readonly string[],
      normalizeSelection: (key: string, selection: MapVisitSelection) => MapVisitSelection,
    ): void {
      const valid = new Set(validKeys)
      const next: Record<string, MapVisitMemory> = {}
      for (const [key, visit] of Object.entries(this.visits)) {
        if (!valid.has(key)) continue
        next[key] = { ...visit, selection: normalizeSelection(key, visit.selection) }
      }
      this.visits = next
    },
    /** Starts a fresh transient UI lifetime for an editor/workspace context. */
    reset(workspaceId: string | null): void {
      Object.assign(this, {
        workspaceId,
        ...emptySelection(),
        mapMode: 'select' as const,
        searchOpen: false,
        searchQuery: '',
        hierarchyPanelOpen: false,
        inspectorPanelOpen: true,
        compactPanel: null,
        lastRequestedPanel: 'inspector' as const,
        visits: {},
      })
    },
  },
})
