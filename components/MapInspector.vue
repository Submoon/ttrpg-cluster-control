<template>
  <div class="map-inspector-layout">
    <div v-if="hasResumableEntitySession" class="map-inspector-resume-draft" role="status">
      <div>
        <p class="section-kicker">UNAPPLIED INSPECTOR DRAFT</p>
        <p class="m-0">Your {{ props.entitySession?.kind === 'orbit' ? 'Orbit' : 'object' }} changes are still available.</p>
      </div>
      <UButton color="primary" variant="soft" @click="resumeEntitySession">Resume Inspector draft</UButton>
    </div>
    <div v-if="props.mode === 'cluster'" class="map-inspector-route-content">
      <JumpRouteInspector
        ref="routeInspectorRef"
        :workspace="props.workspace"
        :selected-system="props.selectedSystem"
        :selected-object="props.selectedObject"
        :selected-orbit="props.selectedOrbit"
        :selected-route="props.selectedRoute"
        :inspected-system="props.inspectedClusterSystem"
        :selected-route-summary="props.selectedRouteSummary"
        :has-chart-name-draft="props.hasChartNameDraft"
        :saving="props.saving"
        :editor-error="props.editorError"
        @edit-chart-names="emit('edit-chart-names', $event)"
        @show-chart-details="emit('show-chart-details')"
        @request-route-edit="emit('request-route-edit', $event)"
        @save-route="emit('save-route', $event)"
        @cancel-route="emit('cancel-route', $event)"
        @delete-route="emit('delete-route')"
        @clear-route-selection="emit('clear-route-selection')"
        @clear-error="emit('clear-error')"
      />
    </div>
    <div v-else-if="props.selectedSystem" class="map-inspector-system-content">
      <div v-if="props.selectedObject" class="map-inspector-entity-content">
        <MapObjectInspector
          :key="props.selectedObject?.id ?? 'current'"
          :workspace="props.workspace"
          :selected-system="props.selectedSystem"
          :selected-object="props.selectedObject"
          :session="objectSession"
          :has-modified-entity-session="props.hasModifiedEntitySession"
          :saving="props.saving"
          :editor-error="props.editorError"
          :has-chart-name-draft="props.hasChartNameDraft"
          :has-uncommitted-names="props.hasUncommittedNames"
          :save-state="props.saveState"
          :save-message="props.saveMessage"
          :save-error="props.saveError"
          :export-error="props.exportError"
          @request-object-edit="emit('request-object-edit')"
          @apply-entity-session="emit('apply-entity-session', $event)"
          @discard-entity-session="emit('discard-entity-session', $event)"
          @delete-object="emit('delete-object')"
          @clear-error="emit('clear-error')"
          @hide="emit('hide')"
          @resume-chart-draft="emit('resume-chart-draft')"
          @retry-save="emit('retry-save')"
          @export-current-json="emit('export-current-json')"
        />
      </div>
      <div v-else-if="props.selectedOrbit" class="map-inspector-entity-content">
        <OrbitInspector
          :key="props.selectedOrbit?.id ?? 'current'"
          ref="orbitInspectorRef"
          :workspace="props.workspace"
          :selected-system="props.selectedSystem"
          :selected-orbit="props.selectedOrbit"
          :session="orbitSession"
          :has-modified-entity-session="props.hasModifiedEntitySession"
          :saving="props.saving"
          :editor-error="props.editorError"
          :has-chart-name-draft="props.hasChartNameDraft"
          :has-uncommitted-names="props.hasUncommittedNames"
          :save-state="props.saveState"
          :save-message="props.saveMessage"
          :save-error="props.saveError"
          :export-error="props.exportError"
          @request-orbit-edit="emit('request-orbit-edit')"
          @apply-entity-session="emit('apply-entity-session', $event)"
          @discard-entity-session="emit('discard-entity-session', $event)"
          @detach-orbit="emit('detach-orbit')"
          @delete-orbit="emit('delete-orbit')"
          @clear-error="emit('clear-error')"
          @hide="emit('hide')"
          @resume-chart-draft="emit('resume-chart-draft')"
          @retry-save="emit('retry-save')"
          @export-current-json="emit('export-current-json')"
        />
      </div>
      <div v-else class="map-inspector-details-content">
        <ChartDetailsPanel
          mode="system"
          :workspace="props.workspace"
          :selected-system="props.selectedSystem"
          :has-chart-name-draft="props.hasChartNameDraft"
          @edit-chart-names="emit('edit-chart-names', props.selectedSystem.id)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Entity drafts are owned by the editor session; this boundary exposes route-local save acknowledgements and edit guards to the page.
 */
import { computed, shallowRef } from 'vue'
import type { EntityInspectorSession } from '../composables/editor-workflows/types'
import type { SaveState } from '../composables/editor-workflows/types'
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
  inspectedClusterSystem?: StarSystem
  selectedObject?: SystemObject
  selectedOrbit?: Orbit
  selectedRoute?: JumpRoute
  selectedRouteSummary: string
  hasChartNameDraft: boolean
  hasUncommittedNames: boolean
  entitySession: EntityInspectorSession | null
  hasModifiedEntitySession: boolean
  isEntityDraftTarget: (kind: 'object' | 'orbit', id: string) => boolean
  saving: boolean
  editorError: string
  saveState: SaveState
  saveMessage: string
  saveError: string | null
  exportError: string
}>()

const emit = defineEmits<{
  'edit-chart-names': [targetSystemId?: string]
  'show-chart-details': []
  hide: []
  'request-object-edit': []
  'resume-entity-session': [sessionId: number]
  'apply-entity-session': [sessionId: number]
  'discard-entity-session': [sessionId: number]
  'delete-object': []
  'request-orbit-edit': []
  'detach-orbit': []
  'delete-orbit': []
  'request-route-edit': [routeId: string]
  'save-route': [request: JumpRouteSaveRequest]
  'cancel-route': [routeId: string | null]
  'delete-route': []
  'clear-route-selection': []
  'clear-error': []
  'resume-chart-draft': []
  'retry-save': []
  'export-current-json': []
}>()

const orbitInspectorRef = shallowRef<OrbitInspectorHandle | null>(null)
const routeInspectorRef = shallowRef<JumpRouteInspectorHandle | null>(null)
const objectSession = computed(() => props.entitySession?.kind === 'object' ? props.entitySession : null)
const orbitSession = computed(() => props.entitySession?.kind === 'orbit' ? props.entitySession : null)
const hasResumableEntitySession = computed(() => {
  const session = props.entitySession
  if (!session || !props.hasModifiedEntitySession) return false
  // Resume uses the current system's captured target selector. Cross-system navigation
  // remains behind the normal transition guard and must not offer this shortcut.
  if (props.mode !== 'system' || props.selectedSystem?.id !== session.systemId) return false
  if (session.kind === 'object') {
    return props.selectedObject?.id !== session.targetId
  }
  return props.selectedOrbit?.id !== session.targetId
})
/** Discards every child inspector draft and clears the parent-visible editor error. */
function cancelEdits(): void {
  orbitInspectorRef.value?.cancelEdits(false)
  routeInspectorRef.value?.cancelEdits(false)
  emit('clear-error')
}

function resumeEntitySession(): void {
  const session = props.entitySession
  if (session) emit('resume-entity-session', session.id)
}

defineExpose({
  hasUnsavedEdits: () =>
    routeInspectorRef.value?.hasUnsavedEdits() ?? false,
  isEditingObject: (objectId: string) =>
    props.isEntityDraftTarget('object', objectId),
  cancelEdits,
  beginRoute: () => routeInspectorRef.value?.beginRoute(),
  startObjectEdit: () => emit('request-object-edit'),
  startOrbitEdit: () => emit('request-orbit-edit'),
  startRouteEdit: () => routeInspectorRef.value?.startRouteEdit(),
  objectSaveSucceeded: () => undefined,
  orbitSaveSucceeded: () => undefined,
  routeSaveSucceeded: () => routeInspectorRef.value?.routeSaveSucceeded(),
})
</script>

<style scoped>
.map-inspector-layout,
.map-inspector-system-content,
.map-inspector-resume-draft,
.map-inspector-route-content,
.map-inspector-entity-content,
.map-inspector-details-content {
  min-width: 0;
  min-height: 0;
}

.map-inspector-layout { display: flex; width: 100%; height: 100%; flex: 1 1 auto; flex-direction: column; overflow: hidden; }
.map-inspector-resume-draft { display: flex; flex: 0 0 auto; align-items: center; justify-content: space-between; gap: .6rem; border-bottom: 1px solid var(--line-soft); padding: .55rem .7rem; font-size: .72rem; }
.map-inspector-resume-draft .section-kicker { margin-bottom: .15rem; }
.map-inspector-route-content { flex: 1 1 auto; overflow-y: auto; overscroll-behavior: contain; }
.map-inspector-system-content { display: grid; flex: 1 1 auto; grid-template-rows: minmax(0, 1fr); overflow: hidden; }
.map-inspector-entity-content,
.map-inspector-details-content { min-height: 0; overflow: hidden; }
.map-inspector-entity-content > :deep(*) { width: 100%; height: 100%; min-height: 0; }
.map-inspector-details-content { overflow-y: auto; overscroll-behavior: contain; }
</style>

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
