<template>
  <div class="map-inspector-layout">
    <div v-if="hasResumableEntitySession" class="map-inspector-resume-draft" role="status">
      <div>
        <p class="section-kicker">UNAPPLIED INSPECTOR DRAFT</p>
        <p class="m-0">Your {{ props.entitySession?.kind === 'orbit' ? 'Orbit' : 'object' }} changes are still available.</p>
      </div>
      <UButton color="primary" variant="soft" @click="resumeEntitySession">Resume Inspector draft</UButton>
    </div>
    <div
      v-if="props.mode === 'cluster'"
      class="map-inspector-route-content"
      :class="{
        'map-inspector-route-content--session': props.routeSession !== null,
        'map-inspector-route-content--consultation': props.routeSession === null,
      }"
    >
      <JumpRouteInspector
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
        :session="props.routeSession"
        @edit-chart-names="emit('edit-chart-names', $event)"
        @open-system="emit('open-system', $event)"
        @delete-system="emit('delete-system', $event)"
        @show-chart-details="emit('show-chart-details')"
        @request-route-edit="emit('request-route-edit', $event)"
        @update-route-input="(sessionId, field, value) => emit('update-route-input', sessionId, field, value)"
        @choose-route-point="(sessionId, pointId) => emit('choose-route-point', sessionId, pointId)"
        @apply-route-session="emit('apply-route-session', $event)"
        @discard-route-session="emit('discard-route-session', $event)"
        @delete-route="emit('delete-route')"
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
          :focus-request="props.objectFocusRequest"
          :focus-enabled="props.inspectorVisible"
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
          @object-focus-request-consumed="emit('object-focus-request-consumed', $event)"
          @open-field-definitions="emit('open-field-definitions')"
          @apply-entity-session="emit('apply-entity-session', $event)"
          @discard-entity-session="emit('discard-entity-session', $event)"
          @update-object-placement="(sessionId, placement) => emit('update-object-placement', sessionId, placement)"
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
          :workspace="props.workspace"
          :selected-system="props.selectedSystem"
          :selected-orbit="props.selectedOrbit"
          :session="orbitSession"
          :has-modified-entity-session="props.hasModifiedEntitySession"
          :has-orbit-placement-preview="props.hasOrbitPlacementPreview"
          :saving="props.saving"
          :editor-error="props.editorError"
          :has-chart-name-draft="props.hasChartNameDraft"
          :has-uncommitted-names="props.hasUncommittedNames"
          :save-state="props.saveState"
          :save-message="props.saveMessage"
          :save-error="props.saveError"
          :export-error="props.exportError"
          @request-orbit-edit="emit('request-orbit-edit')"
          @update-orbit-host="(sessionId, hostId) => emit('update-orbit-host', sessionId, hostId)"
          @preview-orbit-placement="emit('preview-orbit-placement', $event)"
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
          :saving="props.saving"
          @edit-chart-names="emit('edit-chart-names', $event)"
          @delete-system="emit('delete-system', $event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Displays parent-owned entity and route sessions and forwards typed commands to their controllers.
 * Applying a session publishes accepted workspace memory; IndexedDB completion remains separate UI state.
 */
import { computed, watch } from 'vue'
import type { EntityInspectorSession, ObjectInspectorFocusRequest } from '../composables/editor-workflows/types'
import type { SaveState } from '../composables/editor-workflows/types'
import type { RouteDraftField, RouteInspectorSession } from '../composables/editor-workflows/useRouteInspectorSession'
import type {
  JumpRoute,
  LocalWorkspace,
  Orbit,
  StarSystem,
  SystemObject,
} from '../domain/workspace'
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
  objectFocusRequest: ObjectInspectorFocusRequest | null
  inspectorVisible: boolean
  selectedOrbit?: Orbit
  selectedRoute?: JumpRoute
  routeSession: RouteInspectorSession | null
  selectedRouteSummary: string
  hasChartNameDraft: boolean
  hasUncommittedNames: boolean
  entitySession: EntityInspectorSession | null
  hasModifiedEntitySession: boolean
  hasOrbitPlacementPreview: boolean
  saving: boolean
  editorError: string
  saveState: SaveState
  saveMessage: string
  saveError: string | null
  exportError: string
}>()

const emit = defineEmits<{
  'edit-chart-names': [targetSystemId?: string]
  'open-system': [systemId: string]
  'delete-system': [systemId: string]
  'show-chart-details': []
  hide: []
  'request-object-edit': []
  'object-focus-request-consumed': [requestId: number]
  'open-field-definitions': []
  'resume-entity-session': [sessionId: number]
  'apply-entity-session': [sessionId: number]
  'discard-entity-session': [sessionId: number]
  'update-object-placement': [sessionId: number, placement: string]
  'delete-object': []
  'request-orbit-edit': []
  'update-orbit-host': [sessionId: number, hostId: string | null]
  'preview-orbit-placement': [sessionId: number]
  'detach-orbit': []
  'delete-orbit': []
  'request-route-edit': [routeId: string]
  'update-route-input': [sessionId: number, field: RouteDraftField, value: string]
  'choose-route-point': [sessionId: number, pointId: string]
  'apply-route-session': [sessionId: number]
  'discard-route-session': [sessionId: number]
  'delete-route': []
  'clear-error': []
  'resume-chart-draft': []
  'retry-save': []
  'export-current-json': []
}>()

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
function resumeEntitySession(): void {
  const session = props.entitySession
  if (session) emit('resume-entity-session', session.id)
}

watch(() => [
  props.objectFocusRequest?.id,
  props.mode,
  props.inspectorVisible,
  props.selectedObject?.id,
] as const, ([requestId]) => {
  if (requestId === undefined) return
  const request = props.objectFocusRequest
  if (!request || request.id !== requestId) return
  if (!props.inspectorVisible || props.mode !== 'system' || request.objectId !== props.selectedObject?.id) {
    emit('object-focus-request-consumed', requestId)
  }
}, { flush: 'post' })

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
.map-inspector-route-content--session { overflow: hidden; }
.map-inspector-route-content--consultation { display: flex; flex-direction: column; overflow: hidden; }
.map-inspector-route-content--consultation > :deep(.chart-details-control) { flex: 0 0 auto; }
.map-inspector-route-content--consultation > :deep(.chart-details-summary) { flex: 1 1 0; min-height: 0; }
.map-inspector-system-content { display: grid; flex: 1 1 auto; grid-template-rows: minmax(0, 1fr); overflow: hidden; }
.map-inspector-entity-content,
.map-inspector-details-content { min-height: 0; overflow: hidden; }
.map-inspector-entity-content > :deep(*) { width: 100%; height: 100%; min-height: 0; }
.map-inspector-details-content { display: flex; flex-direction: column; }
.map-inspector-details-content > :deep(.chart-details-summary) { flex: 1 1 0; min-height: 0; }
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
