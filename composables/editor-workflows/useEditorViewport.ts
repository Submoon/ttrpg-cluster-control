import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { WorkspacePanel } from './types'
import type { useEditorUiStore } from '../../stores/editor-ui'

type EditorUiStore = ReturnType<typeof useEditorUiStore>

/** Owns the browser media-query subscription; the Pinia store only retains serializable panel choices. */
export function useEditorViewport(store: EditorUiStore) {
  const isCompactViewport = ref(false)
  const hierarchyPanelVisible = computed(() => store.hierarchyPanelOpen
    && (!isCompactViewport.value || store.compactPanel === 'hierarchy'))
  const inspectorPanelVisible = computed(() => store.inspectorPanelOpen
    && (!isCompactViewport.value || store.compactPanel === 'inspector'))
  const compactPanelOpen = computed(() => isCompactViewport.value
    && (hierarchyPanelVisible.value || inspectorPanelVisible.value))

  function updateCompactViewport(isCompact: boolean): void {
    const wasCompact = isCompactViewport.value
    isCompactViewport.value = isCompact
    if (isCompact && !wasCompact) {
      if (store.hierarchyPanelOpen && store.inspectorPanelOpen) {
        store.setCompactPanel(store.lastRequestedPanel)
      } else if (store.hierarchyPanelOpen) {
        store.setCompactPanel('hierarchy')
      } else if (store.inspectorPanelOpen) {
        store.setCompactPanel('inspector')
      } else {
        store.setCompactPanel(null)
      }
    } else if (!isCompact) {
      store.setCompactPanel(null)
    }
  }

  function requestPanel(panel: WorkspacePanel): void {
    store.requestPanel(panel)
    if (isCompactViewport.value) store.setCompactPanel(panel)
  }

  function closePanel(panel: WorkspacePanel): void {
    store.closePanel(panel)
  }

  function togglePanel(panel: WorkspacePanel): void {
    const visible = panel === 'hierarchy' ? hierarchyPanelVisible.value : inspectorPanelVisible.value
    if (visible) closePanel(panel)
    else requestPanel(panel)
  }

  let compactMedia: MediaQueryList | undefined
  const updateCompactFromMedia = (event?: MediaQueryListEvent): void => {
    updateCompactViewport(event?.matches ?? compactMedia?.matches ?? false)
  }

  onMounted(() => {
    compactMedia = window.matchMedia('(max-width: 760px), (max-height: 600px)')
    if (compactMedia.matches) {
      // A compact first visit has no prior request; desktop defaults do not imply intent.
      isCompactViewport.value = true
      store.setCompactPanel(null)
    } else {
      updateCompactFromMedia()
    }
    compactMedia.addEventListener('change', updateCompactFromMedia)
  })
  onUnmounted(() => compactMedia?.removeEventListener('change', updateCompactFromMedia))

  return {
    isCompactViewport,
    hierarchyPanelVisible,
    inspectorPanelVisible,
    compactPanelOpen,
    requestPanel,
    closePanel,
    togglePanel,
  }
}
