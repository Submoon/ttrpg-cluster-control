import { defineStore } from 'pinia'
import type { MapVisitMemory, MapVisitSelection, MapInteractionMode, WorkspacePanel } from '../composables/editor-workflows/types'
import type { PublicationMode } from '../domain/workspace'
import type { FieldCondition } from '../utils/field-filter-matching'

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
    selectedSearchObjectTypes: [] as string[],
    searchTypeFilterOptionLabels: {} as Record<string, string>,
    selectedSearchPublicationModes: [] as PublicationMode[],
    selectedSearchFieldConditions: [] as FieldCondition[],
    mapTypeFiltersOpen: false,
    selectedMapObjectTypes: [] as string[],
    mapTypeFilterOptionLabels: {} as Record<string, string>,
    selectedMapPublicationModes: [] as PublicationMode[],
    selectedMapFieldConditions: [] as FieldCondition[],
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
    setSelectedSearchObjectTypes(types: readonly string[], options: readonly { value: string, label: string }[]): void {
      const labels = { ...this.searchTypeFilterOptionLabels }
      for (const option of options) labels[option.value] = option.label
      this.searchTypeFilterOptionLabels = labels
      this.selectedSearchObjectTypes = [...new Set(types)]
    },
    setSearchPublicationModes(modes: readonly PublicationMode[]): void {
      this.selectedSearchPublicationModes = [...new Set(modes)]
    },
    setSearchFieldConditions(conditions: readonly FieldCondition[]): void {
      const seen = new Set<string>()
      this.selectedSearchFieldConditions = conditions.filter((condition) => {
        if (seen.has(condition.fieldId)) return false
        seen.add(condition.fieldId)
        return true
      })
    },
    /** Clears Search input and criteria at hydration or recovery boundaries without disturbing map filters. */
    resetSearch(): void {
      this.searchOpen = false
      this.searchQuery = ''
      this.selectedSearchObjectTypes = []
      this.searchTypeFilterOptionLabels = {}
      this.selectedSearchPublicationModes = []
      this.selectedSearchFieldConditions = []
    },
    setMapTypeFiltersOpen(open: boolean): void {
      this.mapTypeFiltersOpen = open
    },
    setSelectedMapObjectTypes(types: readonly string[], options: readonly { value: string, label: string }[]): void {
      const labels = { ...this.mapTypeFilterOptionLabels }
      for (const option of options) labels[option.value] = option.label
      this.mapTypeFilterOptionLabels = labels
      this.selectedMapObjectTypes = [...new Set(types)]
    },
    setSelectedMapPublicationModes(modes: readonly PublicationMode[]): void {
      this.selectedMapPublicationModes = [...new Set(modes)]
    },
    setSelectedMapFieldConditions(conditions: readonly FieldCondition[]): void {
      const seen = new Set<string>()
      this.selectedMapFieldConditions = conditions.filter(condition => {
        if (seen.has(condition.fieldId)) return false
        seen.add(condition.fieldId)
        return true
      })
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
        selectedSearchObjectTypes: [],
        searchTypeFilterOptionLabels: {},
        selectedSearchPublicationModes: [],
        selectedSearchFieldConditions: [],
        mapTypeFiltersOpen: false,
        selectedMapObjectTypes: [],
        mapTypeFilterOptionLabels: {},
        selectedMapPublicationModes: [],
        selectedMapFieldConditions: [],
        hierarchyPanelOpen: false,
        inspectorPanelOpen: true,
        compactPanel: null,
        lastRequestedPanel: 'inspector' as const,
        visits: {},
      })
    },
  },
})
