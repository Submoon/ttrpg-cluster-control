<template>
  <section v-if="selectedOrbit" class="entity-inspector" aria-label="Orbit inspector">
    <header class="entity-inspector-header">
      <div class="min-w-0">
        <p class="section-kicker">SYSTEM STRUCTURE</p>
        <h2 class="orbit-title mt-2 mb-1">Orbit {{ selectedOrbit.order }}</h2>
        <p class="entity-inspector-subtitle m-0">
          <template v-if="isAttachmentDraft">Proposed host · {{ proposedHostLabel }}</template>
          <template v-else-if="selectedOrbit.hostId === null">Unoccupied center · unkeyed placement</template>
          <template v-else>
            Hosted by {{ selectedSystem?.objects.find(object => object.id === selectedOrbit?.hostId)?.name ?? 'unknown object' }}
          </template>
        </p>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <UBadge color="neutral" variant="subtle">Orbit</UBadge>
        <UButton
          class="workspace-control panel-close-button"
          color="neutral"
          variant="outline"
          size="sm"
          type="button"
          icon="i-lucide-x"
          aria-label="Hide inspector"
          @click="emit('hide')"
        />
      </div>
    </header>

    <form :id="formId" class="entity-inspector-body" novalidate @submit.prevent="applyOrbitSession">
      <div
        v-if="summaryMessage || errorEntries.length"
        id="orbit-inspector-validation-summary"
        class="entity-inspector-feedback entity-inspector-feedback--error"
        role="alert"
        aria-live="assertive"
        tabindex="-1"
      >
        <strong>{{ errorEntries.length ? `${errorEntries.length} form ${errorEntries.length === 1 ? 'issue' : 'issues'}` : 'Could not apply these changes' }}</strong>
        <p v-if="summaryMessage">{{ summaryMessage }}</p>
        <p v-else>Review the marked fields before applying.</p>
        <ul v-if="errorEntries.length">
          <li v-for="[key, message] in errorEntries" :key="key">
            <UButton
              class="entity-inspector-issue-action"
              color="error"
              variant="link"
              size="xs"
              type="button"
              @click="focusControl(key)"
            >{{ message }}</UButton>
          </li>
        </ul>
      </div>

      <section class="entity-inspector-section" aria-labelledby="orbit-geometry-heading">
        <div class="entity-inspector-section-heading">
          <div>
            <p class="section-kicker">ORBIT GEOMETRY</p>
            <h3 id="orbit-geometry-heading">Axes and rotation</h3>
          </div>
          <span class="entity-inspector-type-chip">Scene units</span>
        </div>
        <fieldset class="entity-inspector-fields entity-inspector-fields--paired" :disabled="!orbitSession || props.saving">
          <UFormField label="Horizontal radius" :error="fieldError('horizontalRadius')">
            <UInput
              :id="controlId('horizontalRadius')"
              :model-value="orbitDraft.horizontalRadius"
              @update:model-value="value => orbitDraft.horizontalRadius = String(value ?? '')"
              type="number"
              step="any"
              :min="selectedOrbitMinimumRadius"
              inputmode="decimal"
            />
          </UFormField>
          <UFormField label="Vertical radius" :error="fieldError('verticalRadius')">
            <UInput
              :id="controlId('verticalRadius')"
              :model-value="orbitDraft.verticalRadius"
              @update:model-value="value => orbitDraft.verticalRadius = String(value ?? '')"
              type="number"
              step="any"
              :min="selectedOrbitMinimumRadius"
              inputmode="decimal"
            />
          </UFormField>
          <UFormField label="Rotation" :error="fieldError('rotation')" class="entity-inspector-full-row">
            <UInput
              :id="controlId('rotation')"
              :model-value="orbitDraft.rotation"
              @update:model-value="value => orbitDraft.rotation = String(value ?? '')"
              type="number"
              step="any"
              inputmode="decimal"
            />
            <template #hint>Degrees; applied values are normalized to 0°–359°.</template>
          </UFormField>
        </fieldset>
      </section>

      <section class="entity-inspector-section" aria-labelledby="orbit-order-heading">
        <div class="entity-inspector-section-heading">
          <div>
            <p class="section-kicker">HOST RELATIONSHIP</p>
            <h3 id="orbit-order-heading">Host-relative order</h3>
          </div>
        </div>
        <fieldset class="entity-inspector-fields" :disabled="!orbitSession || props.saving">
          <UFormField label="Orbit order" :error="fieldError('targetOrder')">
            <UInput
              :id="controlId('targetOrder')"
              :model-value="orbitDraft.targetOrder"
              @update:model-value="value => orbitDraft.targetOrder = String(value ?? '')"
              type="number"
              step="1"
              min="1"
              :max="orderMaximum"
              :disabled="isAttachmentDraft"
              inputmode="numeric"
            />
          </UFormField>
        </fieldset>
        <p class="inspector-footnote m-0">
          Order is counted among {{ siblingCount === 1 ? 'the Orbit with this host' : `${siblingCount} Orbits with this host` }}.
        </p>
        <template v-if="selectedOrbit.hostId === null">
          <fieldset class="entity-inspector-fields" :disabled="!orbitSession || props.saving">
            <UFormField label="Host" :error="fieldError('hostId')">
              <USelect
                :id="controlId('hostId')"
                :model-value="hasPendingCenterMoveChoice ? undefined : (orbitDraft.hostId ?? unoccupiedCenterValue)"
                :placeholder="hasPendingCenterMoveChoice ? 'Choose a named host' : undefined"
                :items="hostItems"
                :disabled="!orbitSession || props.saving || (hasPendingCenterMoveChoice && pendingHostItems.length === 0)"
                @update:model-value="updateOrbitHostSelection($event)"
              />
            </UFormField>
          </fieldset>
          <UAlert
            v-if="hasPendingCenterMoveChoice"
            color="warning"
            variant="subtle"
            description="Several map targets overlap this Orbit center. Choose a named host to continue; the free center will not be selected implicitly."
          />
          <ul v-if="pendingInvalidHostReasons.length" class="inspector-footnote m-0 list-disc pl-5">
            <li v-for="candidate in pendingInvalidHostReasons" :key="candidate.key">
              {{ candidate.label }}: {{ candidate.error }}
            </li>
          </ul>
          <p v-if="isAttachmentDraft" class="inspector-footnote m-0">
            This appends as Orbit {{ orbitDraft.targetOrder }} under {{ proposedHostLabel }}. Preview clamps each axis to its own host minimum when needed.
          </p>
          <p v-if="isAttachmentDraft && props.hasOrbitPlacementPreview" class="entity-inspector-placement-preview m-0" role="status" aria-live="polite">
            Preview ready · Orbit {{ orbitDraft.targetOrder }} under {{ proposedHostLabel }} · axes {{ orbitDraft.horizontalRadius }} × {{ orbitDraft.verticalRadius }} scene units · rotation {{ normalizedDraftRotation }}°.
          </p>
          <UButton
            v-if="isAttachmentDraft || hasPendingCenterMoveChoice"
            class="workspace-control"
            color="primary"
            variant="soft"
            size="sm"
            type="button"
            :disabled="!orbitSession || hasPendingCenterMoveChoice || props.saving"
            @click="previewOrbitSession"
          >Preview placement</UButton>
        </template>
      </section>

      <section class="entity-inspector-section" aria-label="Orbit contents">
        <div class="entity-inspector-section-heading">
          <div>
            <p class="section-kicker">CURRENT MAP</p>
            <h3>Orbit contents</h3>
          </div>
          <UBadge color="neutral" variant="subtle">{{ placedObjectCount }} {{ placedObjectCount === 1 ? 'object' : 'objects' }}</UBadge>
        </div>
        <p class="inspector-footnote m-0">Orbit rings show structure, not measured distance. In Move mode, drag an unoccupied center or use its map placement controls.</p>
      </section>

      <section class="entity-inspector-delete entity-inspector-secondary-actions" aria-label="Orbit actions">
        <UButton
          v-if="!orbitSession && selectedOrbit.hostId !== null"
          class="workspace-control"
          color="neutral"
          variant="outline"
          size="sm"
          type="button"
          aria-label="Detach Orbit"
          :disabled="props.saving"
          @click="emit('detach-orbit')"
        >
          Detach
        </UButton>
        <UButton
          class="workspace-control entity-inspector-delete-button"
          color="error"
          variant="outline"
          size="sm"
          type="button"
          :aria-label="selectedOrbitDeleteLabel"
          :disabled="props.saving"
          @click="emit('delete-orbit')"
        >
          Delete Orbit and contents…
        </UButton>
      </section>
    </form>

    <footer class="entity-inspector-footer">
      <div class="entity-inspector-footer-status">
        <span class="entity-inspector-draft-status" role="status" aria-live="polite">
          {{ orbitSession ? (props.hasModifiedEntitySession ? 'Unapplied changes' : 'No unapplied changes') : 'Orbit details' }}
        </span>
        <UButton
          v-if="errorEntries.length || summaryMessage"
          class="workspace-control entity-inspector-error-link"
          color="error"
          variant="ghost"
          size="xs"
          type="button"
          @click="focusSummary"
        >
          Review {{ errorEntries.length || 1 }} {{ (errorEntries.length || 1) === 1 ? 'issue' : 'issues' }}
        </UButton>
        <WorkspaceFeedback
          class="entity-inspector-save-feedback"
          :active="true"
          :has-chart-name-draft="props.hasChartNameDraft"
          :has-uncommitted-names="props.hasUncommittedNames"
          :save-state="props.saveState"
          :save-message="props.saveMessage"
          :save-error="props.saveError"
          :export-error="props.exportError"
          @resume-chart-draft="emit('resume-chart-draft')"
          @retry-save="emit('retry-save')"
          @export-current-json="emit('export-current-json')"
        />
      </div>
      <div class="entity-inspector-footer-actions" :class="{ 'entity-inspector-footer-actions--editing': orbitSession }">
        <UButton
          v-if="!orbitSession"
          class="workspace-control"
          color="primary"
          size="sm"
          type="button"
          aria-label="Edit Orbit"
          :disabled="props.saving"
          @click="emit('request-orbit-edit')"
        >
          Edit
        </UButton>
        <UButton
          v-else
          class="workspace-control"
          color="primary"
          type="submit"
          :form="formId"
          :disabled="hasPendingCenterMoveChoice || props.saving"
        >
          <span>Apply changes</span><span class="sr-only">Save Orbit</span>
        </UButton>
        <UButton
          v-if="orbitSession"
          class="workspace-control"
          color="neutral"
          variant="outline"
          type="button"
          :disabled="props.saving"
          @click="discardOrbitSession"
        >
          <span>Discard changes</span><span class="sr-only">Cancel Orbit edits</span>
        </UButton>
      </div>
    </footer>
  </section>
</template>

<script setup lang="ts">
/** Presents the parent-owned Orbit session without creating a second draft lifetime. */
import { computed } from 'vue'
import {
  defaultOrbitRadius,
  minimumOrbitRadius,
  normalizeOrbitRotation,
  type LocalWorkspace,
  type Orbit,
  type StarSystem,
} from '../../domain/workspace'
import type { EntityInspectorSession, OrbitDraft, SaveState } from '../../composables/editor-workflows/types'
import { objectsMovedWithOrbit } from '../../utils/system-map-geometry'
import { catalogueObjectLabel } from '../../utils/catalogue-labels'
import WorkspaceFeedback from '../WorkspaceFeedback.vue'

const props = defineProps<{
  workspace: LocalWorkspace
  selectedSystem?: StarSystem
  selectedOrbit?: Orbit
  session: Extract<EntityInspectorSession, { kind: 'orbit' }> | null
  hasModifiedEntitySession: boolean
  hasOrbitPlacementPreview: boolean
  saving: boolean
  editorError: string
  hasChartNameDraft: boolean
  hasUncommittedNames: boolean
  saveState: SaveState
  saveMessage: string
  saveError: string | null
  exportError: string
}>()

const emit = defineEmits<{
  'request-orbit-edit': []
  'update-orbit-host': [sessionId: number, hostId: string | null]
  'preview-orbit-placement': [sessionId: number]
  'apply-entity-session': [sessionId: number]
  'discard-entity-session': [sessionId: number]
  'detach-orbit': []
  'delete-orbit': []
  'clear-error': []
  hide: []
  'resume-chart-draft': []
  'retry-save': []
  'export-current-json': []
}>()

const selectedSystem = computed(() => props.selectedSystem)
const selectedOrbit = computed(() => props.selectedOrbit)
const orbitSession = computed(() => {
  const session = props.session
  if (!session || session.kind !== 'orbit' || session.targetId !== selectedOrbit.value?.id) return null
  return session
})
const formId = computed(() => `orbit-inspector-form-${selectedOrbit.value?.id ?? 'current'}`)
const orbitDraft = computed<OrbitDraft>(() => orbitSession.value?.draft ?? readOrbitValues(selectedOrbit.value))
const unoccupiedCenterValue = '__unoccupied_orbit_center__'
const errorEntries = computed(() => Object.entries(orbitSession.value?.errors ?? {}))
const summaryMessage = computed(() => orbitSession.value?.error || props.editorError)
const pendingCenterMoveCandidates = computed(() => orbitSession.value?.centerMoveCandidates ?? null)
const hasPendingCenterMoveChoice = computed(() => pendingCenterMoveCandidates.value !== null)
const pendingHostItems = computed(() =>
  (pendingCenterMoveCandidates.value ?? [])
    .filter(candidate => candidate.target.kind === 'host' && !candidate.error)
    .map(candidate => ({ label: candidate.label, value: candidate.target.kind === 'host' ? candidate.target.objectId : '' })),
)
const pendingInvalidHostReasons = computed(() =>
  (pendingCenterMoveCandidates.value ?? []).filter(candidate => !!candidate.error),
)
const selectedOrbitMinimumRadius = computed(() => {
  const system = selectedSystem.value
  const orbit = selectedOrbit.value
  if (!system || !orbit) return 16
  const hostId = orbitDraft.value.hostId
  if (orbit.hostId === null && hostId !== null
    && system.objects.some(object => object.id === hostId)) {
    return minimumOrbitRadius(system, { id: orbit.id, order: orbit.order, hostId })
  }
  return minimumOrbitRadius(system, orbit)
})
const isAttachmentDraft = computed(() => selectedOrbit.value?.hostId === null && orbitDraft.value.hostId !== null)
const proposedHost = computed(() => selectedSystem.value?.objects.find(object => object.id === orbitDraft.value.hostId))
const proposedHostLabel = computed(() => proposedHost.value ? catalogueObjectLabel(proposedHost.value) : 'selected object')
const hostItems = computed(() => {
  const system = selectedSystem.value
  const orbit = selectedOrbit.value
  if (hasPendingCenterMoveChoice.value) return pendingHostItems.value
  const movedObjectIds = system && orbit ? objectsMovedWithOrbit(system, orbit.id) : new Set<string>()
  return [
    { label: 'Unoccupied center', value: unoccupiedCenterValue },
    ...(system?.objects ?? [])
      .filter(object => !movedObjectIds.has(object.id))
      .map(object => ({ label: catalogueObjectLabel(object), value: object.id })),
  ]
})
const siblingCount = computed(() => {
  const orbit = selectedOrbit.value
  const hostId = isAttachmentDraft.value ? orbitDraft.value.hostId : orbit?.hostId
  if (!orbit) return 1
  const count = selectedSystem.value?.orbits.filter(candidate => candidate.hostId === hostId).length ?? 0
  return isAttachmentDraft.value ? count + 1 : count
})
const orderMaximum = computed(() => {
  const orbit = selectedOrbit.value
  if (!orbit) return 1
  if (isAttachmentDraft.value) {
    const hostId = orbitDraft.value.hostId
    return (selectedSystem.value?.orbits
      .filter(candidate => candidate.hostId === hostId)
      .reduce((highest, candidate) => Math.max(highest, candidate.order), 0) ?? 0) + 1
  }
  return siblingCount.value
})
const placedObjectCount = computed(() => {
  const orbit = selectedOrbit.value
  return orbit
    ? selectedSystem.value?.objects.filter(object => object.placement.kind === 'orbit' && object.placement.orbitId === orbit.id).length ?? 0
    : 0
})
const selectedOrbitDeleteLabel = computed(() => {
  const orbit = selectedOrbit.value
  if (!orbit) return 'Delete Orbit'
  const hostName = orbit.hostId === null
    ? 'unoccupied center'
    : selectedSystem.value?.objects.find(object => object.id === orbit.hostId)?.name ?? 'unknown object'
  return `Delete Orbit ${orbit.order} around ${hostName}`
})

function readOrbitValues(orbit: Orbit | undefined): OrbitDraft {
  const system = selectedSystem.value
  const defaultRadius = system && orbit ? defaultOrbitRadius(system, orbit) : 0
  const savedRadii = orbit ? props.workspace.layout.orbitRadii[orbit.id] : undefined
  const radii = typeof savedRadii === 'number'
    ? { horizontal: savedRadii, vertical: savedRadii }
    : savedRadii ?? { horizontal: defaultRadius, vertical: defaultRadius }
  return {
    hostId: orbit?.hostId ?? null,
    targetOrder: String(orbit?.order ?? ''),
    horizontalRadius: String(radii.horizontal),
    verticalRadius: String(radii.vertical),
    rotation: String(orbit ? props.workspace.layout.orbitRotations[orbit.id] ?? 0 : 0),
  }
}

const normalizedDraftRotation = computed(() => {
  const rotation = Number(orbitDraft.value.rotation)
  return Number.isFinite(rotation) ? normalizeOrbitRotation(rotation) : orbitDraft.value.rotation
})

function updateOrbitHostSelection(value: unknown): void {
  const session = orbitSession.value
  if (!session) return
  const selected = String(value ?? (hasPendingCenterMoveChoice.value ? '' : unoccupiedCenterValue))
  emit('update-orbit-host', session.id, selected === unoccupiedCenterValue ? null : selected)
}

function previewOrbitSession(): void {
  const session = orbitSession.value
  if (session) emit('preview-orbit-placement', session.id)
}

function controlId(key: string): string {
  return `orbit-inspector-${encodeURIComponent(selectedOrbit.value?.id ?? 'current')}-${encodeURIComponent(key)}`
}

function fieldError(key: string): string | undefined {
  return orbitSession.value?.errors[key]
}

function focusControl(key: string): void {
  const control = document.getElementById(controlId(key))
  if (!(control instanceof HTMLElement)) return
  control.scrollIntoView({ block: 'center', behavior: 'smooth' })
  control.focus({ preventScroll: true })
}

function focusSummary(): void {
  const summary = document.getElementById('orbit-inspector-validation-summary')
  summary?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  summary?.focus({ preventScroll: true })
}

function applyOrbitSession(): void {
  const session = orbitSession.value
  if (session) emit('apply-entity-session', session.id)
}

function discardOrbitSession(): void {
  const session = orbitSession.value
  if (session) emit('discard-entity-session', session.id)
}

</script>

<style scoped>
.entity-inspector {
  display: grid;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  grid-template-rows: auto minmax(0, 1fr) auto;
  overflow: hidden;
  color: var(--text-primary);
}

.entity-inspector-header,
.entity-inspector-footer { background: var(--panel-bg); }
.entity-inspector-header { display: flex; align-items: flex-start; justify-content: space-between; gap: .55rem; border-bottom: 1px solid var(--line-soft); padding: .8rem .9rem .65rem; }
.entity-inspector-header .panel-close-button { position: relative; top: auto; float: none; flex: 0 0 2.2rem; align-self: flex-start; margin: 0; }
.entity-inspector-subtitle { color: var(--text-muted); font-size: .72rem; line-height: 1.45; }
.orbit-title { overflow-wrap: anywhere; font: 500 1.45rem/1.2 Georgia, serif; }
.entity-inspector-body { display: grid; min-height: 0; align-content: start; gap: .8rem; overflow-y: auto; overscroll-behavior: contain; padding: .8rem .9rem; }
.entity-inspector-section,
.entity-inspector-delete,
.entity-inspector-feedback { min-width: 0; }
.entity-inspector-section { display: grid; gap: .65rem; }
.entity-inspector-section + .entity-inspector-section,
.entity-inspector-delete { border-top: 1px solid var(--line-soft); padding-top: .8rem; }
.entity-inspector-section-heading { display: flex; align-items: center; justify-content: space-between; gap: .5rem; }
.entity-inspector-section-heading h3 { margin: .18rem 0 0; font: 500 1rem/1.15 Georgia, serif; }
.entity-inspector-type-chip { display: inline-block; border: 1px solid var(--line); border-radius: 999px; padding: .12rem .42rem; color: var(--text-muted); font-size: .65rem; }
.entity-inspector-fields { display: grid; min-width: 0; gap: .7rem; margin: 0; border: 0; padding: 0; }
.entity-inspector-fields--paired { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.entity-inspector-fields--paired :deep(.entity-inspector-full-row) { grid-column: 1 / -1; }
.entity-inspector-feedback { border: 1px solid var(--line); border-radius: .4rem; padding: .65rem .75rem; background: var(--panel-soft); font-size: .74rem; line-height: 1.45; }
.entity-inspector-feedback strong { display: block; margin-bottom: .2rem; }
.entity-inspector-feedback p { margin: 0; color: var(--text-secondary); }
.entity-inspector-feedback--error { border-color: color-mix(in srgb, var(--error) 60%, var(--line)); background: color-mix(in srgb, var(--error) 10%, var(--panel-bg)); }
.entity-inspector-feedback--error strong,
.entity-inspector-feedback--error li :deep(.entity-inspector-issue-action) { color: var(--error); }
.entity-inspector-placement-preview { border-left: 2px solid var(--line); padding-left: .55rem; color: var(--text-secondary); font-size: .72rem; line-height: 1.45; }
.entity-inspector-feedback ul { display: grid; gap: .16rem; margin: .35rem 0 0; padding-left: 1.1rem; }
.entity-inspector-feedback li :deep(.entity-inspector-issue-action) { text-decoration: underline; text-underline-offset: .12em; }
.entity-inspector-delete-button { justify-self: start; }
.entity-inspector-secondary-actions { display: flex; align-items: center; flex-wrap: wrap; gap: .45rem; }
.entity-inspector-footer { display: grid; gap: .55rem; border-top: 1px solid var(--line-soft); padding: .6rem .9rem calc(.65rem + env(safe-area-inset-bottom, 0px)); box-shadow: 0 -.2rem .8rem color-mix(in srgb, var(--map-bg) 35%, transparent); }
.entity-inspector-footer-status { display: grid; min-width: 0; grid-template-columns: 1fr; gap: .25rem; color: var(--text-muted); font-size: .68rem; }
.entity-inspector-draft-status { font-size: .68rem; }
.entity-inspector-save-feedback { min-width: 0; }
.entity-inspector-footer-actions { display: grid; grid-template-columns: minmax(0, 1fr); gap: .45rem; }
.entity-inspector-footer-actions--editing { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.entity-inspector-footer-actions :deep(button) { width: 100%; justify-content: center; }
.entity-inspector-error-link { justify-self: start; }

@media (max-width: 760px), (max-width: 1024px) and (max-height: 600px) {
  .entity-inspector-fields--paired { grid-template-columns: minmax(0, 1fr); }
  .entity-inspector-header { padding-top: .55rem; }
  .entity-inspector-body { padding-top: .65rem; }
  .entity-inspector-footer { gap: .45rem; padding-top: .45rem; }
  .entity-inspector-footer-actions { gap: .35rem; }
}
</style>
