<script setup lang="ts">
/**
 * Inspector panels own local drafts; this boundary exposes save acknowledgements and edit guards to the page.
 */
import { computed, shallowRef } from 'vue'
import type {
  JumpRoute,
  LocalWorkspace,
  Orbit,
  StarSystem,
  SystemObject,
} from '../domain/workspace'
import type {
  JumpRouteInspectorHandle,
  JumpRouteSaveRequest,
  MapObjectInspectorHandle,
  MapObjectSaveRequest,
  OrbitEditRequest,
  OrbitInspectorHandle,
} from './inspector/contracts'
import ChartDetailsPanel from './inspector/ChartDetailsPanel.vue'
import JumpRouteInspector from './inspector/JumpRouteInspector.vue'
import MapObjectInspector from './inspector/MapObjectInspector.vue'
import OrbitInspector from './inspector/OrbitInspector.vue'

const props = defineProps<{
  mode: 'cluster' | 'system'
  workspace: LocalWorkspace
  selectedSystem?: StarSystem
  selectedObject?: SystemObject
  selectedOrbit?: Orbit
  selectedRoute?: JumpRoute
  selectedRouteSummary: string
  chartNamesEditing: boolean
  saving: boolean
  formError: string
  editorError: string
}>()

const emit = defineEmits<{
  'submit-names': []
  'edit-chart-names': []
  'cancel-chart-names': []
  'show-chart-details': []
  'request-object-edit': []
  'save-object': [request: MapObjectSaveRequest]
  'delete-object': []
  'request-orbit-edit': []
  'save-orbit': [request: OrbitEditRequest]
  'detach-orbit': []
  'delete-orbit': []
  'request-route-edit': [routeId: string]
  'save-route': [request: JumpRouteSaveRequest]
  'cancel-route': [routeId: string | null]
  'delete-route': []
  'clear-route-selection': []
  'clear-error': []
}>()

const clusterName = defineModel<string>('clusterName', { required: true })
const systemName = defineModel<string>('systemName', { required: true })
const objectInspectorRef = shallowRef<MapObjectInspectorHandle | null>(null)
const orbitInspectorRef = shallowRef<OrbitInspectorHandle | null>(null)
const routeInspectorRef = shallowRef<JumpRouteInspectorHandle | null>(null)
const chartDetailsActive = computed(() =>
  !props.selectedObject
  && !props.selectedOrbit
  && !props.selectedRoute
  && !(routeInspectorRef.value?.hasUnsavedEdits() ?? false),
)

/** Discards every child inspector draft and clears the parent-visible editor error. */
function cancelEdits(): void {
  objectInspectorRef.value?.cancelEdits(false)
  orbitInspectorRef.value?.cancelEdits(false)
  routeInspectorRef.value?.cancelEdits(false)
  emit('clear-error')
}

defineExpose({
  hasUnsavedEdits: () =>
    (objectInspectorRef.value?.hasUnsavedEdits() ?? false)
    || (orbitInspectorRef.value?.hasUnsavedEdits() ?? false)
    || (routeInspectorRef.value?.hasUnsavedEdits() ?? false),
  isEditingObject: (objectId: string) =>
    objectInspectorRef.value?.isEditingObject(objectId) ?? false,
  cancelEdits,
  beginRoute: () => routeInspectorRef.value?.beginRoute(),
  startObjectEdit: () => objectInspectorRef.value?.startObjectEdit(),
  startOrbitEdit: () => orbitInspectorRef.value?.startOrbitEdit(),
  startRouteEdit: () => routeInspectorRef.value?.startRouteEdit(),
  objectSaveSucceeded: () => objectInspectorRef.value?.objectSaveSucceeded(),
  orbitSaveSucceeded: () => orbitInspectorRef.value?.orbitSaveSucceeded(),
  routeSaveSucceeded: () => routeInspectorRef.value?.routeSaveSucceeded(),
})
</script>

<template>
  <JumpRouteInspector
    v-if="props.mode === 'cluster'"
    ref="routeInspectorRef"
    v-model:cluster-name="clusterName"
    v-model:system-name="systemName"
    :workspace="props.workspace"
    :selected-system="props.selectedSystem"
    :selected-object="props.selectedObject"
    :selected-orbit="props.selectedOrbit"
    :selected-route="props.selectedRoute"
    :selected-route-summary="props.selectedRouteSummary"
    :chart-names-editing="props.chartNamesEditing"
    :saving="props.saving"
    :form-error="props.formError"
    :editor-error="props.editorError"
    @submit-names="emit('submit-names')"
    @edit-chart-names="emit('edit-chart-names')"
    @cancel-chart-names="emit('cancel-chart-names')"
    @show-chart-details="emit('show-chart-details')"
    @request-route-edit="emit('request-route-edit', $event)"
    @save-route="emit('save-route', $event)"
    @cancel-route="emit('cancel-route', $event)"
    @delete-route="emit('delete-route')"
    @clear-route-selection="emit('clear-route-selection')"
    @clear-error="emit('clear-error')"
  />
  <template v-else-if="props.selectedSystem">
    <button
      class="quiet-button chart-details-control mb-4"
      type="button"
      :aria-pressed="chartDetailsActive"
      @click="emit('show-chart-details')"
    >
      Chart details
    </button>
    <MapObjectInspector
      v-if="props.selectedObject"
      ref="objectInspectorRef"
      :workspace="props.workspace"
      :selected-system="props.selectedSystem"
      :selected-object="props.selectedObject"
      :saving="props.saving"
      :editor-error="props.editorError"
      @request-object-edit="emit('request-object-edit')"
      @save-object="emit('save-object', $event)"
      @delete-object="emit('delete-object')"
      @clear-error="emit('clear-error')"
    />
    <OrbitInspector
      v-else-if="props.selectedOrbit"
      ref="orbitInspectorRef"
      :workspace="props.workspace"
      :selected-system="props.selectedSystem"
      :selected-orbit="props.selectedOrbit"
      :saving="props.saving"
      :editor-error="props.editorError"
      @request-orbit-edit="emit('request-orbit-edit')"
      @save-orbit="emit('save-orbit', $event)"
      @detach-orbit="emit('detach-orbit')"
      @delete-orbit="emit('delete-orbit')"
      @clear-error="emit('clear-error')"
    />
    <ChartDetailsPanel
      v-else
      v-model:cluster-name="clusterName"
      v-model:system-name="systemName"
      mode="system"
      :workspace="props.workspace"
      :selected-system="props.selectedSystem"
      :chart-names-editing="props.chartNamesEditing"
      :saving="props.saving"
      :form-error="props.formError"
      @submit-names="emit('submit-names')"
      @edit-chart-names="emit('edit-chart-names')"
      @cancel-chart-names="emit('cancel-chart-names')"
    />
  </template>
</template>

<style>
.chart-details-control[aria-pressed="true"] {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent-hover);
}

.type-chip {
  color: var(--status-good);
  font: 0.55rem Consolas, monospace;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.inspector-intro {
  color: var(--text-secondary);
  font-size: 0.7rem;
  line-height: 1.55;
}

.orbit-facts {
  font-size: 0.7rem;
}

.orbit-facts span {
  color: var(--text-muted);
}

.orbit-facts strong {
  font-family: Georgia, serif;
  font-size: 1rem;
  font-weight: 400;
}

.inspector-footnote {
  color: var(--text-muted);
  font-size: 0.66rem;
  line-height: 1.55;
}

.object-mark-large {
  width: 1.5rem;
  height: 1.5rem;
  font-size: 1.2rem;
}

.object-title {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.object-title > span:last-child {
  min-width: 0;
}
</style>
