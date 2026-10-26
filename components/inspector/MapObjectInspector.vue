<template>
  <section v-if="selectedObject" class="entity-inspector" aria-label="Object inspector">
    <header class="entity-inspector-header">
      <div class="min-w-0">
        <p class="section-kicker">{{ catalogueFamilyLabel(selectedObject.family) }}</p>
        <h2 class="object-title mt-2 mb-1 [overflow-wrap:anywhere] text-[1.45rem]">
          <span class="object-mark object-mark-large" aria-hidden="true">{{ objectMark(selectedObject) }}</span>
          <span>{{ selectedObject.name }}</span>
        </h2>
        <p class="entity-inspector-subtitle m-0">
          {{ selectedObject.locationKey }} · {{ catalogueSubtypeLabel(selectedObject) }}
        </p>
      </div>
      <UButton
        class="workspace-control panel-close-button shrink-0"
        color="neutral"
        variant="outline"
        size="sm"
        type="button"
        icon="i-lucide-x"
        aria-label="Hide inspector"
        @click="emit('hide')"
      />
    </header>

    <form :id="formId" class="entity-inspector-body" novalidate @submit.prevent="applyObjectSession">
      <div
        v-if="summaryMessage || errorEntries.length"
        id="object-inspector-validation-summary"
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

      <section class="entity-inspector-section" aria-labelledby="object-details-heading">
        <div class="entity-inspector-section-heading">
          <div>
            <p class="section-kicker">MAP OBJECT</p>
            <h3 id="object-details-heading">Object details</h3>
            <span class="entity-inspector-type-chip">{{ catalogueSubtypeLabel(selectedObject) }}</span>
          </div>
          <UBadge color="neutral" variant="subtle">Built-in</UBadge>
        </div>
        <fieldset class="entity-inspector-fields" :disabled="!objectSession || props.saving">
          <UFormField v-if="selectedObject.family === 'Other'" label="Type label" :error="fieldError('subtype')">
            <UInput
              :id="controlId('subtype')"
              v-model="objectDraft.subtype"
              class="entity-inspector-full"
              autocomplete="off"
              maxlength="80"
            />
          </UFormField>
          <UFormField label="Location key" :error="fieldError('locationKey')">
            <UInput
              :id="controlId('locationKey')"
              v-model="objectDraft.locationKey"
              autocomplete="off"
              maxlength="24"
            />
          </UFormField>
          <UFormField label="Name" :error="fieldError('name')">
            <UInput
              :id="controlId('name')"
              v-model="objectDraft.name"
              class="entity-inspector-full"
              autocomplete="off"
              maxlength="80"
            />
          </UFormField>
          <UFormField label="Description" class="entity-inspector-full-row" :error="fieldError('description')">
            <UTextarea
              :id="controlId('description')"
              v-model="objectDraft.description"
              class="entity-inspector-full"
              :rows="5"
              autoresize
            />
          </UFormField>
        </fieldset>
      </section>

      <section class="entity-inspector-section" aria-labelledby="object-placement-heading">
        <div class="entity-inspector-section-heading">
          <div>
            <p class="section-kicker">SYSTEM STRUCTURE</p>
            <h3 id="object-placement-heading">Placement and relationships</h3>
          </div>
        </div>
        <fieldset class="entity-inspector-fields entity-inspector-fields--paired" :disabled="!objectSession || props.saving">
          <UFormField label="Placement" class="entity-inspector-full-row" :error="fieldError('placement')">
            <USelect
              :id="controlId('placement')"
              :model-value="objectDraft.placement"
              :items="placementItems"
              @update:model-value="updatePlacement"
            />
          </UFormField>
          <UFormField v-if="objectDraft.placement === 'system'" label="Schematic X" :error="fieldError('x')">
            <UInput
              :id="controlId('x')"
              :model-value="objectDraft.x"
              @update:model-value="value => objectDraft.x = String(value ?? '')"
              type="number"
              step="any"
              inputmode="decimal"
            />
          </UFormField>
          <UFormField v-if="objectDraft.placement === 'system'" label="Schematic Y" :error="fieldError('y')">
            <UInput
              :id="controlId('y')"
              :model-value="objectDraft.y"
              @update:model-value="value => objectDraft.y = String(value ?? '')"
              type="number"
              step="any"
              inputmode="decimal"
            />
          </UFormField>
          <UFormField v-if="selectedObject.family === 'JumpPoint'" label="Physical Station association" class="entity-inspector-full-row" :error="fieldError('jumpStationId')">
            <USelect
              :id="controlId('jumpStationId')"
              :model-value="stationSelectValue"
              :items="stationItems"
              @update:model-value="value => objectDraft.jumpStationId = decodeSelectValue('station', stationChoices, String(value))"
            />
          </UFormField>
          <p v-if="selectedObject.family === 'JumpPoint' && physicalStations.length === 0" class="empty-copy entity-inspector-full-row m-0">
            Add a separate Station object from the catalogue to record its physical location.
          </p>
        </fieldset>
      </section>

      <section v-if="hasNativeFields" class="entity-inspector-section" aria-labelledby="object-native-fields-heading">
        <div class="entity-inspector-section-heading">
          <div>
            <p class="section-kicker">NATIVE VALUES</p>
            <h3 id="object-native-fields-heading">Catalogue fields</h3>
          </div>
          <UBadge color="neutral" variant="subtle">Built-in</UBadge>
        </div>
        <fieldset class="entity-inspector-fields entity-inspector-fields--paired" :disabled="!objectSession || props.saving">
          <UFormField v-if="hasAtmosphere" label="Atmosphere" :error="fieldError('native:atmosphere')">
            <USelect
              :id="controlId('native:atmosphere')"
              :model-value="atmosphereSelectValue"
              :items="atmosphereItems"
              @update:model-value="value => objectDraft.atmosphere = decodeSelectValue('native:atmosphere', atmosphereChoices, String(value))"
            />
          </UFormField>
          <UFormField v-if="selectedObject.family === 'Installation'" label="Port class" :error="fieldError('native:portClass')">
            <USelect
              :id="controlId('native:portClass')"
              :model-value="portClassSelectValue"
              :items="portClassItems"
              @update:model-value="value => objectDraft.portClass = decodeSelectValue('native:portClass', portClassChoices, String(value))"
            />
          </UFormField>
        </fieldset>
      </section>

      <section class="entity-inspector-section" aria-labelledby="object-custom-fields-heading">
        <div class="entity-inspector-section-heading">
          <div>
            <p class="section-kicker">CUSTOM VALUES</p>
            <h3 id="object-custom-fields-heading">Custom fields</h3>
          </div>
          <UBadge color="neutral" variant="subtle">Reusable</UBadge>
          <UButton
            class="workspace-control"
            color="neutral"
            variant="outline"
            size="xs"
            type="button"
            aria-label="Manage field definitions"
            @click="emit('open-field-definitions')"
          >
            Manage
          </UButton>
        </div>
        <fieldset class="entity-inspector-fields" :disabled="!objectSession || props.saving">
          <UFormField
            v-for="field in applicableCustomFields"
            :key="field.id"
            :label="field.name"
            :error="fieldError(`custom:${field.id}`)"
          >
            <USelect
              v-if="field.type === 'single-select' || field.type === 'boolean'"
              :id="controlId(`custom:${field.id}`)"
              :model-value="customSelectValue(field)"
              :items="customSelectItems(field)"
              @update:model-value="value => setCustomSelectValue(field, String(value))"
            />
            <UTextarea
              v-else-if="field.type === 'text'"
              :id="controlId(`custom:${field.id}`)"
              :model-value="objectDraft.customFieldValues[field.id]"
              @update:model-value="value => objectDraft.customFieldValues[field.id] = String(value ?? '')"
              class="entity-inspector-full"
              :rows="3"
              autoresize
            />
            <UInput
              v-else
              :id="controlId(`custom:${field.id}`)"
              :model-value="objectDraft.customFieldValues[field.id]"
              @update:model-value="value => objectDraft.customFieldValues[field.id] = String(value ?? '')"
              type="number"
              step="any"
              inputmode="decimal"
            />
          </UFormField>
          <p v-if="applicableCustomFields.length === 0" class="empty-copy m-0">No custom fields apply to this object.</p>
        </fieldset>
      </section>

      <section v-if="!objectSession" class="entity-inspector-section" aria-label="Object editing">
        <p class="inspector-intro m-0">Edit the full object record, including its keyed description and typed catalogue values.</p>
        <UButton
          class="workspace-control"
          color="primary"
          size="sm"
          type="button"
          aria-label="Edit map object"
          :disabled="props.saving"
          @click="emit('request-object-edit')"
        >
          Edit
        </UButton>
      </section>

      <section class="entity-inspector-delete">
        <UButton
          class="workspace-control entity-inspector-delete-button"
          color="error"
          variant="outline"
          size="sm"
          type="button"
          :aria-label="`Delete ${selectedObject.name}`"
          :disabled="props.saving"
          @click="emit('delete-object')"
        >
          Delete object…
        </UButton>
      </section>
    </form>

    <footer class="entity-inspector-footer">
      <div class="entity-inspector-footer-status">
        <span class="entity-inspector-draft-status" role="status" aria-live="polite">
          {{ objectSession ? (props.hasModifiedEntitySession ? 'Unapplied changes' : 'No unapplied changes') : 'Object details' }}
        </span>
        <UButton
          v-if="errorEntries.length || summaryMessage"
          class="workspace-control entity-inspector-error-link"
          color="error"
          variant="ghost"
          size="xs"
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
      <div class="entity-inspector-footer-actions">
        <UButton
          class="workspace-control"
          color="primary"
          type="submit"
          :form="formId"
          :disabled="!objectSession || (!props.hasModifiedEntitySession && !hasSessionErrors) || props.saving"
          @click="applyObjectSession"
        >
          <span>Apply changes</span><span class="sr-only">Save map object</span>
        </UButton>
        <UButton
          class="workspace-control"
          color="neutral"
          variant="outline"
          type="button"
          :disabled="!objectSession || !props.hasModifiedEntitySession"
          @click="discardObjectSession"
        >
          <span>Discard changes</span><span class="sr-only">Cancel map object edits</span>
        </UButton>
      </div>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  canPlaceObjectInOrbit,
  initialSystemPlacement,
  isCustomFieldApplicableToObject,
  type CustomFieldDefinition,
  type LocalWorkspace,
  type StarSystem,
  type SystemObject,
} from '../../domain/workspace'
import type { EntityInspectorSession, ObjectDraft } from '../../composables/editor-workflows/types'
import { catalogueFamilyLabel, catalogueSubtypeLabel } from '../../utils/catalogue-labels'
import { objectMark } from '../../utils/catalogue-marks'
import WorkspaceFeedback from '../WorkspaceFeedback.vue'

const props = defineProps<{
  workspace: LocalWorkspace
  selectedSystem?: StarSystem
  selectedObject?: SystemObject
  session: Extract<EntityInspectorSession, { kind: 'object' }> | null
  hasModifiedEntitySession: boolean
  saving: boolean
  editorError: string
  hasChartNameDraft: boolean
  hasUncommittedNames: boolean
  saveState: 'idle' | 'saving' | 'saved' | 'error'
  saveMessage: string
  saveError: string | null
  exportError: string
}>()

const emit = defineEmits<{
  'request-object-edit': []
  'open-field-definitions': []
  'apply-entity-session': [sessionId: number]
  'discard-entity-session': [sessionId: number]
  'delete-object': []
  'clear-error': []
  hide: []
  'resume-chart-draft': []
  'retry-save': []
  'export-current-json': []
}>()

const selectedObject = computed(() => props.selectedObject)
const selectedSystem = computed(() => props.selectedSystem)
const objectSession = computed(() => {
  const session = props.session
  if (!session || session.kind !== 'object' || session.targetId !== selectedObject.value?.id) return null
  return session
})
const objectDraft = computed<ObjectDraft>(() => objectSession.value?.draft ?? readObjectValues(selectedObject.value))
const unsetSelectValue = '__entity_inspector_unset__'
const selectValuePrefix = '__entity_inspector_option__:'
const formId = computed(() => `object-inspector-form-${selectedObject.value?.id ?? 'current'}`)
const errorEntries = computed(() => Object.entries(objectSession.value?.errors ?? {}))
const summaryMessage = computed(() => objectSession.value?.error || props.editorError)
const hasSessionErrors = computed(() => errorEntries.value.length > 0 || !!objectSession.value?.error)
const customFields = computed(() => props.workspace.objectFieldSettings.customFields)
const applicableCustomFields = computed(() => selectedObject.value
  ? customFields.value.filter(field => isCustomFieldApplicableToObject(field, selectedObject.value!))
  : [])
const physicalStations = computed(() => selectedSystem.value?.objects.filter(object =>
  object.family === 'Installation' && object.subtype === 'station',
) ?? [])
const placeableOrbits = computed(() => {
  const system = selectedSystem.value
  const object = selectedObject.value
  if (!system || !object) return []
  return system.orbits
    .filter(orbit => canPlaceObjectInOrbit(system, object.id, orbit.id))
    .sort((left, right) => left.order - right.order)
})
const hasAtmosphere = computed(() => selectedObject.value?.family === 'CelestialBody'
  && (selectedObject.value.subtype === 'planet' || selectedObject.value.subtype === 'moon'))
const hasNativeFields = computed(() => hasAtmosphere.value || selectedObject.value?.family === 'Installation')
type StoredSelectOption = { label: string; storedValue: string }
const placementItems = computed(() => [
  { label: 'System-level position', value: 'system' },
  ...placeableOrbits.value.map(orbit => ({
    label: `Orbit ${orbit.order} around ${orbit.hostId === null
      ? 'unoccupied center'
      : selectedSystem.value?.objects.find(object => object.id === orbit.hostId)?.name ?? 'unknown object'}`,
    value: `orbit:${orbit.id}`,
  })),
])
const stationChoices = computed<StoredSelectOption[]>(() => physicalStations.value.map(station => ({
  label: `${station.name} (${station.locationKey})`,
  storedValue: station.id,
})))
const stationItems = computed(() => encodeSelectItems('station', stationChoices.value, 'No physical Station'))
const stationSelectValue = computed(() => encodeSelectedValue('station', stationChoices.value, objectDraft.value.jumpStationId))
const atmosphereChoices = computed<StoredSelectOption[]>(() => props.workspace.objectFieldSettings.atmosphereOptions.map(option => ({
  label: option,
  storedValue: option,
})))
const atmosphereItems = computed(() => encodeSelectItems('native:atmosphere', atmosphereChoices.value))
const atmosphereSelectValue = computed(() => encodeSelectedValue('native:atmosphere', atmosphereChoices.value, objectDraft.value.atmosphere))
const portClassChoices = computed<StoredSelectOption[]>(() => props.workspace.objectFieldSettings.portClassOptions.map(option => ({
  label: option,
  storedValue: option,
})))
const portClassItems = computed(() => encodeSelectItems('native:portClass', portClassChoices.value))
const portClassSelectValue = computed(() => encodeSelectedValue('native:portClass', portClassChoices.value, objectDraft.value.portClass))

function readObjectValues(object: SystemObject | undefined): ObjectDraft {
  const customFieldValues = Object.fromEntries(
    Object.entries(object?.customFieldValues ?? {}).map(([fieldId, value]) => [fieldId, String(value)]),
  )
  for (const field of customFields.value) customFieldValues[field.id] ??= ''
  return {
    locationKey: object?.locationKey ?? '',
    name: object?.name ?? '',
    description: object?.description ?? '',
    subtype: object?.subtype ?? '',
    placement: object?.placement.kind === 'orbit' ? `orbit:${object.placement.orbitId}` : 'system',
    x: object?.placement.kind === 'system' ? String(object.placement.x) : '',
    y: object?.placement.kind === 'system' ? String(object.placement.y) : '',
    atmosphere: object?.atmosphere ?? '',
    portClass: object?.portClass ?? '',
    jumpStationId: object?.jumpStationId ?? '',
    customFieldValues,
  }
}

function controlId(key: string): string {
  return `object-inspector-${encodeURIComponent(selectedObject.value?.id ?? 'current')}-${encodeURIComponent(key)}`
}

function fieldError(key: string): string | undefined {
  return objectSession.value?.errors[key]
}

function focusControl(key: string): void {
  const control = document.getElementById(controlId(key))
  if (!(control instanceof HTMLElement)) return
  control.scrollIntoView({ block: 'center', behavior: 'smooth' })
  control.focus({ preventScroll: true })
}

function focusSummary(): void {
  const summary = document.getElementById('object-inspector-validation-summary')
  summary?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  summary?.focus({ preventScroll: true })
}

function updatePlacement(value: string | number): void {
  const session = objectSession.value
  const object = selectedObject.value
  if (!session || !object) return
  const nextPlacement = String(value)
  const wasOrbitPlaced = session.draft.placement.startsWith('orbit:')
  session.draft.placement = nextPlacement
  if (wasOrbitPlaced && nextPlacement === 'system' && selectedSystem.value) {
    const position = initialSystemPlacement(selectedSystem.value)
    session.draft.x = String(position.x)
    session.draft.y = String(position.y)
  }
}

function customSelectChoices(field: CustomFieldDefinition): StoredSelectOption[] {
  if (field.type === 'single-select') {
    return field.options.map(option => ({ label: option, storedValue: option }))
  }
  return [
    { label: 'Yes', storedValue: 'true' },
    { label: 'No', storedValue: 'false' },
  ]
}

function customSelectItems(field: CustomFieldDefinition): Array<{ label: string; value: string }> {
  const key = `custom:${field.id}`
  return encodeSelectItems(key, customSelectChoices(field))
}

function customSelectValue(field: CustomFieldDefinition): string {
  const value = objectDraft.value.customFieldValues[field.id] ?? ''
  return encodeSelectedValue(`custom:${field.id}`, customSelectChoices(field), value)
}

function setCustomSelectValue(field: CustomFieldDefinition, value: string): void {
  objectDraft.value.customFieldValues[field.id] = decodeSelectValue(
    `custom:${field.id}`,
    customSelectChoices(field),
    value,
  )
}

function encodeSelectItems(
  key: string,
  options: StoredSelectOption[],
  emptyLabel = 'Not recorded',
): Array<{ label: string; value: string }> {
  return [
    { label: emptyLabel, value: unsetSelectValue },
    ...options.map((option, index) => ({
      label: option.label,
      value: `${selectValuePrefix}${encodeURIComponent(key)}:${index}`,
    })),
  ]
}

function encodeSelectedValue(key: string, options: StoredSelectOption[], storedValue: string): string {
  if (storedValue === '') return unsetSelectValue
  const index = options.findIndex(option => option.storedValue === storedValue)
  return index < 0
    ? `${selectValuePrefix}${encodeURIComponent(key)}:unavailable`
    : `${selectValuePrefix}${encodeURIComponent(key)}:${index}`
}

function decodeSelectValue(key: string, options: StoredSelectOption[], encodedValue: string): string {
  if (encodedValue === unsetSelectValue) return ''
  const expectedPrefix = `${selectValuePrefix}${encodeURIComponent(key)}:`
  if (!encodedValue.startsWith(expectedPrefix)) return ''
  const index = Number(encodedValue.slice(expectedPrefix.length))
  if (!Number.isInteger(index) || index < 0) return ''
  return options[index]?.storedValue ?? ''
}

function applyObjectSession(): void {
  const session = objectSession.value
  if (session) emit('apply-entity-session', session.id)
}

function discardObjectSession(): void {
  const session = objectSession.value
  if (session) emit('discard-entity-session', session.id)
}

defineExpose({
  hasUnsavedEdits: () => false,
  isEditingObject: (objectId: string) => objectSession.value?.targetId === objectId,
})
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
.entity-inspector-footer {
  background: var(--panel-bg);
}

.entity-inspector-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: .55rem;
  border-bottom: 1px solid var(--line-soft);
  padding: .8rem .9rem .65rem;
}

.entity-inspector-header .panel-close-button {
  position: relative;
  top: auto;
  float: none;
  flex: 0 0 2.2rem;
  align-self: flex-start;
  margin: 0;
}

.entity-inspector-subtitle {
  color: var(--text-muted);
  font-size: .72rem;
  line-height: 1.45;
}

.entity-inspector-body {
  display: grid;
  min-height: 0;
  align-content: start;
  gap: .8rem;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: .8rem .9rem;
}

.entity-inspector-section,
.entity-inspector-delete,
.entity-inspector-feedback { min-width: 0; }
.entity-inspector-section { display: grid; gap: .65rem; }
.entity-inspector-section + .entity-inspector-section,
.entity-inspector-delete { border-top: 1px solid var(--line-soft); padding-top: .8rem; }
.entity-inspector-section-heading { display: flex; align-items: center; justify-content: space-between; gap: .5rem; }
.entity-inspector-section-heading h3 { margin: .18rem 0 0; font: 500 1rem/1.15 Georgia, serif; }
.entity-inspector-type-chip { display: inline-block; margin-top: .2rem; border: 1px solid var(--line); border-radius: 999px; padding: .12rem .42rem; color: var(--text-muted); font-size: .65rem; }
.entity-inspector-fields { display: grid; min-width: 0; gap: .7rem; margin: 0; border: 0; padding: 0; }
.entity-inspector-fields--paired { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.entity-inspector-full,
.entity-inspector-full-row { width: 100%; }
.entity-inspector-fields--paired :deep(.entity-inspector-full-row) { grid-column: 1 / -1; }
.entity-inspector-feedback { border: 1px solid var(--line); border-radius: .4rem; padding: .65rem .75rem; background: var(--panel-soft); font-size: .74rem; line-height: 1.45; }
.entity-inspector-feedback strong { display: block; margin-bottom: .2rem; }
.entity-inspector-feedback p { margin: 0; color: var(--text-secondary); }
.entity-inspector-feedback--error { border-color: color-mix(in srgb, var(--error) 60%, var(--line)); background: color-mix(in srgb, var(--error) 10%, var(--panel-bg)); }
.entity-inspector-feedback--error strong,
.entity-inspector-feedback--error li :deep(.entity-inspector-issue-action) { color: var(--error); }
.entity-inspector-feedback ul { display: grid; gap: .16rem; margin: .35rem 0 0; padding-left: 1.1rem; }
.entity-inspector-feedback li :deep(.entity-inspector-issue-action) { text-decoration: underline; text-underline-offset: .12em; }
.entity-inspector-delete-button { justify-self: start; }
.entity-inspector-footer { display: grid; gap: .55rem; border-top: 1px solid var(--line-soft); padding: .6rem .9rem calc(.65rem + env(safe-area-inset-bottom, 0px)); box-shadow: 0 -.2rem .8rem color-mix(in srgb, var(--map-bg) 35%, transparent); }
.entity-inspector-footer-status { display: grid; min-width: 0; grid-template-columns: 1fr; gap: .25rem; color: var(--text-muted); font-size: .68rem; }
.entity-inspector-draft-status { font-size: .68rem; }
.entity-inspector-save-feedback { min-width: 0; }
.entity-inspector-footer-actions { display: grid; grid-template-columns: 1fr 1fr; gap: .45rem; }
.entity-inspector-footer-actions :deep(button) { justify-content: center; }
.entity-inspector-error-link { justify-self: start; }

@media (max-width: 760px), (max-width: 1024px) and (max-height: 600px) {
  .entity-inspector-fields--paired { grid-template-columns: minmax(0, 1fr); }
  .entity-inspector-header { padding-top: .55rem; }
  .entity-inspector-body { padding-top: .65rem; }
  .entity-inspector-footer { gap: .45rem; padding-top: .45rem; }
  .entity-inspector-footer-actions { gap: .35rem; }
}
</style>
