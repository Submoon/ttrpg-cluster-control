<script setup lang="ts">
/**
 * Keeps panel state shared while switching maps and delays reopen controls until leave transitions finish.
 */
import { onMounted, onUnmounted, ref } from 'vue'

const props = defineProps<{
  mode: 'cluster' | 'system'
  hierarchyLabel: string
  inspectorLabel: string
}>()

const hierarchyPanelOpen = ref(true)
const inspectorPanelOpen = ref(true)
const hierarchyPanelCollapsed = ref(false)
const inspectorPanelCollapsed = ref(false)
const isCompactViewport = ref(false)

/**
 * Refreshes compact-layout state and prevents both side panels from remaining open on narrow screens.
 */
function updateViewportMode(): void {
  isCompactViewport.value = window.matchMedia('(max-width: 760px)').matches
  if (isCompactViewport.value && hierarchyPanelOpen.value && inspectorPanelOpen.value) {
    inspectorPanelOpen.value = false
  }
}

/** Toggles hierarchy visibility and enforces one-open-panel behavior on compact viewports. */
function toggleHierarchyPanel(): void {
  if (!hierarchyPanelOpen.value && isCompactViewport.value) inspectorPanelOpen.value = false
  hierarchyPanelOpen.value = !hierarchyPanelOpen.value
  hierarchyPanelCollapsed.value = false
}

/** Toggles inspector visibility and enforces one-open-panel behavior on compact viewports. */
function toggleInspectorPanel(): void {
  if (!inspectorPanelOpen.value && isCompactViewport.value) hierarchyPanelOpen.value = false
  inspectorPanelOpen.value = !inspectorPanelOpen.value
  inspectorPanelCollapsed.value = false
}

/** Shows the hierarchy reopen tab only after its leave transition finishes. */
function revealHierarchyPanelControl(): void {
  if (!hierarchyPanelOpen.value) hierarchyPanelCollapsed.value = true
}

/** Shows the inspector reopen tab only after its leave transition finishes. */
function revealInspectorPanelControl(): void {
  if (!inspectorPanelOpen.value) inspectorPanelCollapsed.value = true
}

onMounted(() => {
  updateViewportMode()
  window.addEventListener('resize', updateViewportMode, { passive: true })
})
onUnmounted(() => window.removeEventListener('resize', updateViewportMode))
</script>

<template>
  <div class="editor-grid grid min-h-[min(78vh,56rem)] grid-cols-[minmax(13rem,0.72fr)_minmax(0,3fr)_minmax(15rem,0.85fr)] items-stretch gap-[0.7rem] max-[1200px]:grid-cols-[minmax(12rem,0.72fr)_minmax(0,3fr)] max-[760px]:flex max-[760px]:flex-col" :class="{ 'system-map-editor-grid': props.mode === 'system' }">
    <button
      v-if="hierarchyPanelCollapsed"
      class="panel-reopen panel-reopen-left"
      type="button"
      aria-label="Show hierarchy panel"
      aria-controls="workspace-hierarchy-panel"
      aria-expanded="false"
      @click="toggleHierarchyPanel"
    >
      <span class="panel-reopen-icon" aria-hidden="true">›</span>
      <span class="panel-reopen-label">Hierarchy</span>
    </button>
    <Transition name="hierarchy-panel" @after-leave="revealHierarchyPanelControl">
      <aside
        v-show="hierarchyPanelOpen"
        id="workspace-hierarchy-panel"
        class="panel workspace-side-panel hierarchy-panel min-w-0 overflow-auto p-4"
        :aria-label="props.hierarchyLabel"
      >
        <button
          class="quiet-button panel-toggle-button"
          type="button"
          aria-label="Collapse hierarchy panel"
          aria-controls="workspace-hierarchy-panel"
          aria-expanded="true"
          @click="toggleHierarchyPanel"
        >
          <span aria-hidden="true">‹</span>
        </button>
        <slot name="hierarchy" />
      </aside>
    </Transition>

    <slot name="map" />

    <button
      v-if="inspectorPanelCollapsed"
      class="panel-reopen panel-reopen-right"
      type="button"
      aria-label="Show inspector panel"
      aria-controls="workspace-inspector-panel"
      aria-expanded="false"
      @click="toggleInspectorPanel"
    >
      <span class="panel-reopen-icon" aria-hidden="true">‹</span>
      <span class="panel-reopen-label">Inspector</span>
    </button>
    <Transition name="inspector-panel" @after-leave="revealInspectorPanelControl">
      <aside
        v-show="inspectorPanelOpen"
        id="workspace-inspector-panel"
        class="panel workspace-side-panel inspector-panel min-w-0 overflow-auto p-4"
        :aria-label="props.inspectorLabel"
      >
        <button
          class="quiet-button panel-close-button"
          type="button"
          aria-label="Collapse inspector panel"
          aria-controls="workspace-inspector-panel"
          aria-expanded="true"
          @click="toggleInspectorPanel"
        >
          <span aria-hidden="true">›</span>
        </button>
        <slot name="inspector" />
      </aside>
    </Transition>
  </div>
</template>

<style>
.map-workspace-shell .workspace-side-panel {
  position: absolute;
  z-index: 5;
  top: 10rem;
  bottom: 0.75rem;
  width: clamp(15rem, 22vw, 21rem);
  border: 1px solid rgba(86, 105, 107, 0.82);
  border-radius: 3px;
  background: rgba(18, 28, 30, 0.96);
  box-shadow: 0 1rem 3rem rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(14px);
}

.map-workspace-shell .system-map-editor-grid .workspace-side-panel {
  top: 18.25rem;
}

.map-workspace-shell .workspace-side-panel.hierarchy-panel-enter-active,
.map-workspace-shell .workspace-side-panel.inspector-panel-enter-active {
  overflow: hidden;
  pointer-events: none;
  transition:
    top 180ms ease,
    right 180ms ease,
    bottom 180ms ease,
    left 180ms ease,
    width 180ms ease,
    padding 180ms ease,
    border-radius 180ms ease;
}

.map-workspace-shell .workspace-side-panel.hierarchy-panel-enter-active > *,
.map-workspace-shell .workspace-side-panel.inspector-panel-enter-active > * {
  transition: opacity 70ms ease 180ms;
}

.map-workspace-shell .workspace-side-panel.hierarchy-panel-enter-from > *,
.map-workspace-shell .workspace-side-panel.inspector-panel-enter-from > * {
  opacity: 0;
}

.map-workspace-shell .workspace-side-panel.hierarchy-panel-leave-active,
.map-workspace-shell .workspace-side-panel.inspector-panel-leave-active {
  overflow: hidden;
  pointer-events: none;
  transition:
    top 180ms ease 70ms,
    right 180ms ease 70ms,
    bottom 180ms ease 70ms,
    left 180ms ease 70ms,
    width 180ms ease 70ms,
    padding 180ms ease 70ms,
    border-radius 180ms ease 70ms;
}

.map-workspace-shell .workspace-side-panel.hierarchy-panel-leave-active > *,
.map-workspace-shell .workspace-side-panel.inspector-panel-leave-active > * {
  transition: opacity 70ms ease;
}

.map-workspace-shell .workspace-side-panel.hierarchy-panel-leave-to > *,
.map-workspace-shell .workspace-side-panel.inspector-panel-leave-to > * {
  opacity: 0;
}

.map-workspace-shell .panel-toggle-button {
  position: absolute;
  z-index: 1;
  top: 0.55rem;
  right: 0.55rem;
  display: grid;
  min-width: 2rem;
  min-height: 2rem;
  place-items: center;
  padding: 0;
  font-size: 1rem;
  line-height: 1;
}

.map-workspace-shell .panel-close-button {
  position: absolute;
  z-index: 1;
  top: 0.55rem;
  right: 0.55rem;
  display: grid;
  min-width: 2rem;
  min-height: 2rem;
  place-items: center;
  padding: 0;
  font-size: 1rem;
  line-height: 1;
}

.map-workspace-shell .panel-reopen {
  position: absolute;
  z-index: 6;
  top: 50%;
  display: flex;
  width: 2.35rem;
  min-height: 7rem;
  transform: translateY(-50%);
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.08rem;
  border: 1px solid var(--line-strong);
  background: rgba(18, 28, 30, 0.96);
  color: var(--text-secondary);
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  box-shadow: 0 0.7rem 1.8rem rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(12px);
}

.map-workspace-shell .panel-reopen-icon {
  font-size: 0.8rem;
  line-height: 1;
}

.map-workspace-shell .panel-reopen-label {
  writing-mode: vertical-rl;
  text-orientation: upright;
  font-size: 0.58rem;
  letter-spacing: -0.05em;
  line-height: 1;
  animation: panel-label-reveal 80ms ease-out both;
}

@keyframes panel-label-reveal {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.map-workspace-shell .panel-reopen:hover {
  border-color: var(--accent);
  background: var(--panel-raised);
  color: var(--accent-hover);
}

.map-workspace-shell .panel-reopen-left {
  left: 0;
  border-left: 0;
  border-radius: 0 3px 3px 0;
}

.map-workspace-shell .panel-reopen-right {
  right: 0;
  border-right: 0;
  border-radius: 3px 0 0 3px;
}

.map-workspace-shell .map-note {
  display: none;
}

.map-workspace-shell .workspace-side-panel.hierarchy-panel-leave-to,
.map-workspace-shell .workspace-side-panel.inspector-panel-leave-to,
.map-workspace-shell .workspace-side-panel.hierarchy-panel-enter-from,
.map-workspace-shell .workspace-side-panel.inspector-panel-enter-from {
  top: calc(50% - 3.5rem);
  bottom: calc(50% - 3.5rem);
  width: 2.35rem;
  padding: 0;
}

.map-workspace-shell .workspace-side-panel.hierarchy-panel-leave-to {
  right: auto;
  left: 0;
  border-radius: 0 3px 3px 0;
}

.map-workspace-shell .workspace-side-panel.hierarchy-panel-enter-from {
  right: auto;
  left: 0;
  border-radius: 0 3px 3px 0;
}

.map-workspace-shell .workspace-side-panel.inspector-panel-leave-to {
  right: 0;
  left: auto;
  border-radius: 3px 0 0 3px;
}

.map-workspace-shell .workspace-side-panel.inspector-panel-enter-from {
  right: 0;
  left: auto;
  border-radius: 3px 0 0 3px;
}

@media (prefers-reduced-motion: reduce) {
.map-workspace-shell .workspace-side-panel.hierarchy-panel-enter-active,
  .map-workspace-shell .workspace-side-panel.inspector-panel-enter-active,
  .map-workspace-shell .workspace-side-panel.hierarchy-panel-leave-active,
  .map-workspace-shell .workspace-side-panel.inspector-panel-leave-active,
  .map-workspace-shell .workspace-side-panel.hierarchy-panel-enter-active > *,
  .map-workspace-shell .workspace-side-panel.inspector-panel-enter-active > *,
  .map-workspace-shell .workspace-side-panel.hierarchy-panel-leave-active > *,
  .map-workspace-shell .workspace-side-panel.inspector-panel-leave-active > * {
    transition-duration: 0.01ms;
    transition-delay: 0ms;
  }

.map-workspace-shell .panel-reopen-label {
    animation: none;
  }
}

@media (max-width: 760px) {
.map-workspace-shell .workspace-side-panel {
    top: 14rem;
    bottom: 0.5rem;
    width: calc(100% - 1rem);
  }

.map-workspace-shell .workspace-side-panel.hierarchy-panel {
    left: 0.5rem;
    right: auto;
  }

.map-workspace-shell .workspace-side-panel.inspector-panel {
    right: 0.5rem;
    left: auto;
  }

.map-workspace-shell .system-map-editor-grid .workspace-side-panel {
    top: 25rem;
  }

.map-workspace-shell .system-map-editor-grid .panel-reopen {
    top: auto;
    bottom: 2rem;
    transform: none;
  }

.map-workspace-shell .system-map-editor-grid .workspace-side-panel.hierarchy-panel-leave-to,
  .map-workspace-shell .system-map-editor-grid .workspace-side-panel.inspector-panel-leave-to,
  .map-workspace-shell .system-map-editor-grid .workspace-side-panel.hierarchy-panel-enter-from,
  .map-workspace-shell .system-map-editor-grid .workspace-side-panel.inspector-panel-enter-from {
    top: calc(100% - 9rem);
    bottom: 2rem;
  }
}

@media (max-width: 760px) and (max-height: 320px) {
.map-workspace-shell .system-map-editor-grid .panel-reopen {
    position: fixed;
    top: 0.5rem;
    bottom: auto;
    width: auto;
    min-height: 1.6rem;
    transform: none;
    flex-direction: row;
    gap: 0.25rem;
    padding: 0.2rem 0.35rem;
  }

.map-workspace-shell .system-map-editor-grid .panel-reopen-icon {
    font-size: 0.8rem;
  }

.map-workspace-shell .system-map-editor-grid .panel-reopen-label {
    writing-mode: horizontal-tb;
    font-size: 0.5rem;
    letter-spacing: 0;
  }

.map-workspace-shell .system-map-editor-grid .panel-reopen-left {
    right: 5.5rem;
    left: auto;
    border: 1px solid var(--line-strong);
    border-radius: 3px;
  }

.map-workspace-shell .system-map-editor-grid .panel-reopen-right {
    right: 0.5rem;
    border: 1px solid var(--line-strong);
    border-radius: 3px;
  }
}
</style>
