<template>
  <UModal
    :open="visible"
    :fullscreen="isCompact"
    :dismissible="true"
    :unmount-on-hide="false"
    title="Field definitions"
    description="Inspect, edit, and create fields shared across this in-memory map."
    :content="modalContentProps"
    :ui="{ content: `prototype-fields-dialog fields-theme-${props.theme}` }"
    @update:open="onModalOpenChange"
    @after:enter="focusActivePane"
    @after:leave="restoreOpenerFocus"
  >
    <template #content>
      <div class="prototype-fields-content">
        <header class="prototype-fields-header">
          <div class="prototype-fields-title">
            <button v-if="screen !== 'list'" type="button" class="fields-back" aria-label="Back to definitions" :disabled="!!pendingReview || !!pendingCommand" @click="requestTransition({ kind: 'list' })">← Back</button>
            <p class="proto-eyebrow">B / REUSABLE MAP DATA</p>
            <h1 id="prototype-fields-title">Field definitions</h1>
            <p class="fields-summary">Inspect, edit, and create fields shared across this in-memory map.</p>
          </div>
          <div class="fields-header-actions">
            <button v-if="isDev" class="fields-layout-toggle" type="button" :aria-label="`Field action placement: ${props.actionLayout}; switch to ${props.actionLayout === 'header' ? 'footer' : 'header'}`" @click.stop="emit('toggle-action-layout')">Actions: {{ props.actionLayout }}</button>
            <button type="button" class="fields-close" aria-label="Close Fields" @click="close">Close</button>
          </div>
        </header>

        <div class="fields-feedback-stack">
          <p v-if="statusMessage" class="fields-status" data-fields-status role="status" aria-live="polite">{{ statusMessage }}</p>
          <p v-if="props.saveError" class="fields-error" role="alert">{{ props.saveError }}</p>
          <p v-if="localError" class="fields-error" role="alert">{{ localError }}</p>
        </div>

        <div v-if="props.actionLayout === 'header'" class="fields-actions fields-actions-header" aria-label="Field actions">
          <template v-if="screen === 'list'"><button type="button" class="fields-primary" @click="requestTransition({ kind: 'create' })">Add custom field</button></template>
          <template v-else-if="screen === 'detail' && selectedDefinition">
            <button v-if="!editing" type="button" class="fields-primary" aria-label="Edit field definition" @click="beginEdit">Edit definition</button>
            <button v-else type="button" class="fields-primary" aria-label="Apply field changes" :disabled="props.saving || !!pendingCommand || !!pendingReview" @click="applyEdit">Apply field changes</button>
            <button v-if="editing" type="button" class="fields-secondary" aria-label="Cancel field edits" :disabled="!!pendingReview" @click="cancelEdit">Cancel edits</button>
            <button v-if="selectedDefinition.kind === 'custom' && editing" type="button" class="fields-danger" :disabled="props.saving || !!pendingCommand || !!pendingReview" @click="requestDelete">Delete field…</button>
          </template>
          <template v-else-if="screen === 'create'">
            <button type="button" class="fields-primary" :disabled="props.saving || !!pendingCommand" @click="createField">Create field</button>
            <button type="button" class="fields-secondary" @click="cancelCreation">Cancel creation</button>
          </template>
        </div>

        <div class="prototype-fields-workspace" :class="{ 'is-list-screen': screen === 'list', 'is-detail-screen': screen === 'detail', 'is-create-screen': screen === 'create' }">
          <nav v-show="screen === 'list' || !isCompact" class="prototype-fields-list" data-fields-list aria-label="Field definitions list" tabindex="-1" @scroll="rememberListScroll">
            <section class="fields-list-group">
              <h2>Native fields</h2>
              <button v-for="field in nativeFields" :key="field.id" type="button" class="fields-choice" :data-field-id="field.id" :aria-pressed="selectedId === field.id" :disabled="!!pendingReview || !!pendingCommand" @click="requestTransition({ kind: 'select', id: field.id })">
                <span>{{ field.name }}</span><small>Native · {{ field.type }}</small>
              </button>
            </section>
            <section class="fields-list-group">
              <div class="fields-list-heading"><h2>Custom fields</h2><span>{{ customFields.length }}</span></div>
              <button type="button" class="fields-new" :disabled="!!pendingReview || !!pendingCommand" @click="requestTransition({ kind: 'create' })">＋ New custom field</button>
              <button v-for="field in customFields" :key="field.id" type="button" class="fields-choice" :data-field-id="field.id" :aria-pressed="selectedId === field.id" :disabled="!!pendingReview || !!pendingCommand" @click="requestTransition({ kind: 'select', id: field.id })">
                <span>{{ field.name }}</span><small>Custom · {{ field.type }}</small><small>{{ fieldApplicabilitySummary(field) }}</small>
              </button>
              <p v-if="!customFields.length" class="fields-empty">No custom fields yet.</p>
            </section>
          </nav>

          <main v-show="screen === 'detail' || (!isCompact && screen === 'list')" class="prototype-fields-detail" data-fields-detail tabindex="-1">
            <template v-if="selectedDefinition">
              <div class="fields-detail-heading">
                <div><p class="proto-eyebrow">{{ selectedDefinition.kind }} FIELD · {{ selectedDefinition.type }}</p><h2>{{ selectedDefinition.name }}</h2></div>
                <span>{{ selectedAssignments.length }} saved values</span>
              </div>

              <fieldset v-if="editing" class="fields-edit-form" :disabled="props.saving || !!pendingCommand || !!pendingReview">
                <label v-if="selectedDefinition.kind === 'custom'" class="fields-label">Custom field name<input v-model="editName" aria-label="Custom field name" maxlength="80" /></label>
                <label v-if="selectedDefinition.type === 'single-select'" class="fields-label">{{ selectedDefinition.name }} choices<textarea v-model="editOptionsText" :aria-label="`${selectedDefinition.name} choices`" rows="4" /></label>
                <fieldset v-if="selectedDefinition.kind === 'custom'" class="fields-applicability"><legend>Field applicability</legend>
                  <label><input v-model="editAppliesToAll" type="radio" :name="`applicability-${selectedDefinition.id}`" :value="true" /> All catalogue objects</label>
                  <label><input v-model="editAppliesToAll" type="radio" :name="`applicability-${selectedDefinition.id}`" :value="false" /> Selected catalogue targets</label>
                  <div v-if="!editAppliesToAll" class="fields-target-groups">
                    <section><h3>Categories</h3><label v-for="group in applicabilityGroups" :key="group.family"><input type="checkbox" :checked="hasTarget({ kind: 'category', family: group.family })" @change="toggleTarget({ kind: 'category', family: group.family })" /> Category {{ group.label }}</label></section>
                    <section><h3>Subtypes</h3><label v-for="type in catalogueTypes" :key="`${type.family}:${type.value}`"><input type="checkbox" :checked="hasTarget({ kind: 'subtype', family: type.family, subtype: type.value })" @change="toggleTarget({ kind: 'subtype', family: type.family, subtype: type.value })" /> Subtype {{ type.label }}</label></section>
                  </div>
                </fieldset>
              </fieldset>
              <template v-else>
                <p class="fields-readonly">Read-only definition. Choose Edit definition to make a change.</p>
                <section class="fields-committed-definition" aria-label="Saved definition details">
                  <div v-if="selectedDefinition.type === 'single-select'">
                    <h3>Saved choices</h3>
                    <ul v-if="selectedDefinition.options.length"><li v-for="option in selectedDefinition.options" :key="option">{{ option }}</li></ul>
                    <p v-else>No saved choices.</p>
                  </div>
                  <div v-if="selectedDefinition.kind === 'custom'">
                    <h3>Applies to</h3>
                    <p>{{ fieldApplicabilitySummary(selectedDefinition) }}</p>
                    <ul v-if="selectedDefinition.applicability?.length"><li v-for="target in selectedDefinition.applicability" :key="targetSignature(target)">{{ applicabilityTargetLabel(target) }}</li></ul>
                  </div>
                </section>
              </template>

              <FieldDefinitionValues :assignments="selectedAssignments" heading="Existing field values" region-label="Existing field values" empty-message="No values are assigned to this field." />
              <FieldDefinitionValues v-if="affectedAssignments.length" :assignments="affectedAssignments" heading="Values that will be cleared" region-label="Affected values preview" affected />
              <FieldDefinitionChangeConfirmation v-if="pendingReview" :change="pendingReview.change" @cancel="cancelReview" @confirm="confirmReview" />
            </template>
            <section v-else-if="editDraft?.editing && hasModifiedDraft" class="fields-orphaned-draft" role="alert">
              <h2>Field target is no longer available</h2><p>Your detached draft is preserved. It cannot be applied until its target is restored.</p>
              <p><strong>Draft name:</strong> {{ editDraft.name || editDraft.baselineName }}</p>
              <p v-if="editDraft.type === 'single-select'"><strong>Draft choices:</strong> {{ editDraft.optionsText }}</p>
              <button type="button" class="fields-secondary" @click="discardOrphanedDraft">Discard this stale draft</button>
            </section>
            <p v-else class="fields-empty-detail">Choose a field to inspect its saved values.</p>
          </main>

          <form v-if="screen === 'create'" class="prototype-fields-create" data-fields-create tabindex="-1" @submit.prevent="createField">
            <p class="proto-eyebrow">NEW REUSABLE FIELD</p><h2>Add custom field</h2>
            <label class="fields-label">Custom field label<input v-model="createName" aria-label="Custom field label" maxlength="80" required /></label>
            <label class="fields-label">Value type<select v-model="createType" aria-label="Value type"><option value="text">Text</option><option value="number">Number</option><option value="boolean">Boolean</option><option value="single-select">Single-select</option></select></label>
            <label v-if="createType === 'single-select'" class="fields-label">New field choices<textarea v-model="createOptionsText" aria-label="New field choices" rows="4" /></label>
            <p class="fields-hint">The new definition is added to this prototype’s in-memory chart.</p>
          </form>
        </div>

        <section v-if="guardTransition" class="fields-guard" role="alertdialog" aria-labelledby="fields-guard-title">
          <div><p class="proto-eyebrow">UNSAVED FIELD DRAFT</p><h2 id="fields-guard-title">Apply this draft before switching?</h2><p>Your current field work stays here until you choose an action.</p></div>
          <div class="fields-guard-actions"><button type="button" class="fields-primary" @click="applyGuardedTransition">Apply and continue</button><button type="button" class="fields-secondary" @click="discardAndContinue">Discard and continue</button><button type="button" class="fields-secondary" @click="stayOnDraft">Stay here</button></div>
        </section>

        <section v-if="props.inspectorConflict" class="fields-conflict" role="alertdialog" aria-labelledby="fields-conflict-title">
          <div class="fields-conflict-card"><p class="proto-eyebrow">OBJECT FIELD CONFLICT</p><h2 id="fields-conflict-title">Resolve this object’s draft first?</h2><p>This field change affects values on the selected object. Apply the object draft and review the field change again, discard the object draft and continue, or keep both drafts open.</p><p v-if="props.inspectorConflictError" class="fields-error" role="alert">{{ props.inspectorConflictError }}</p><div class="fields-guard-actions"><button type="button" class="fields-primary" @click="emit('resolve-inspector-conflict', 'apply')">Apply object draft · review again</button><button type="button" class="fields-secondary" @click="emit('resolve-inspector-conflict', 'discard')">Discard object draft · continue</button><button type="button" class="fields-secondary" @click="emit('resolve-inspector-conflict', 'stay')">Keep both drafts open</button></div></div>
        </section>

        <div v-if="props.actionLayout === 'footer'" class="fields-actions fields-actions-footer" aria-label="Field actions">
          <template v-if="screen === 'list'"><button type="button" class="fields-primary" @click="requestTransition({ kind: 'create' })">Add custom field</button></template>
          <template v-else-if="screen === 'detail' && selectedDefinition">
            <button v-if="!editing" type="button" class="fields-primary" aria-label="Edit field definition" @click="beginEdit">Edit definition</button>
            <button v-else type="button" class="fields-primary" aria-label="Apply field changes" :disabled="props.saving || !!pendingCommand || !!pendingReview" @click="applyEdit">Apply field changes</button>
            <button v-if="editing" type="button" class="fields-secondary" aria-label="Cancel field edits" :disabled="!!pendingReview" @click="cancelEdit">Cancel edits</button>
            <button v-if="selectedDefinition.kind === 'custom' && editing" type="button" class="fields-danger" :disabled="props.saving || !!pendingCommand || !!pendingReview" @click="requestDelete">Delete field…</button>
          </template>
          <template v-else-if="screen === 'create'"><button type="button" class="fields-primary" :disabled="props.saving || !!pendingCommand" @click="createField">Create field</button><button type="button" class="fields-secondary" @click="cancelCreation">Cancel creation</button></template>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { catalogueTypes, customFieldApplicabilityTargetKey, type CustomFieldApplicabilityTarget, type CustomFieldType, type LocalWorkspace } from '../domain/workspace'
import FieldDefinitionChangeConfirmation from './field-definitions/FieldDefinitionChangeConfirmation.vue'
import FieldDefinitionValues from './field-definitions/FieldDefinitionValues.vue'
import { applicabilityGroups, fieldApplicabilitySummary, fieldDefinitionSummaries, fieldOptionsFromText, fieldValueAssignments, sameCustomFieldApplicability, type CustomFieldCreate, type FieldDefinitionSummary, type FieldDefinitionUpdate, type FieldValueAssignment, type PendingFieldDefinitionChange } from './field-definitions/model'

type Screen = 'list' | 'detail' | 'create'
type Target = { kind: 'list' } | { kind: 'select'; id: string } | { kind: 'create' }
type EditDraft = { ownerId: string; kind: 'native' | 'custom'; type: CustomFieldType; editing: boolean; name: string; optionsText: string; appliesToAll: boolean; targets: CustomFieldApplicabilityTarget[]; baselineName: string; baselineOptions: string[]; baselineApplicability?: CustomFieldApplicabilityTarget[] }
type ActiveDraft = { kind: 'definition'; ownerId: string } | { kind: 'create' }
type PendingReview = { change: PendingFieldDefinitionChange; signature: string }
type PendingCommand = { kind: 'create' | 'save' | 'remove'; knownIds: string[]; selectedId: string | null; selectedIndex: number }

const props = defineProps<{ workspace: LocalWorkspace; saving: boolean; saveError: string; saveRevision: number; rejectionRevision: number; enabled: boolean; actionLayout: 'header' | 'footer'; theme: 'dark' | 'light'; inspectorConflict?: boolean; inspectorConflictError?: string; isDev?: boolean }>()
const emit = defineEmits<{
  'open-change': [open: boolean]
  'clear-error': []
  'resolve-inspector-conflict': [choice: 'apply' | 'discard' | 'stay']
  'create-custom-field': [request: CustomFieldCreate]
  'save-field-definition': [request: FieldDefinitionUpdate]
  'remove-field-definition': [fieldId: string]
  'toggle-action-layout': []
  'state-change': [state: { open: boolean; screen: Screen; selectedId: string | null; hasModifiedDraft: boolean; reviewOpen: boolean }]
}>()

const isDev = computed(() => props.isDev ?? import.meta.dev)
const visible = ref(false)
const screen = ref<Screen>('list')
const selectedId = ref<string | null>(null)
const editDraft = ref<EditDraft | null>(null)
const activeDraft = ref<ActiveDraft | null>(null)
const createName = ref('')
const createType = ref<CustomFieldType>('text')
const createOptionsText = ref('')
const pendingTransition = ref<Target | null>(null)
const pendingReview = ref<PendingReview | null>(null)
const pendingCommand = ref<PendingCommand | null>(null)
const guardTransition = ref(false)
const localError = ref('')
const statusMessage = ref('')
const opener = ref<HTMLElement | null>(null)
const lastListScroll = ref(0)
const isCompact = ref(false)
let compactQuery: MediaQueryList | null = null
let savedRevision = props.saveRevision
let rejectedRevision = props.rejectionRevision

const definitions = computed(() => fieldDefinitionSummaries(props.workspace))
const nativeFields = computed(() => definitions.value.filter(field => field.kind === 'native'))
const customFields = computed(() => definitions.value.filter(field => field.kind === 'custom'))
const selectedDefinition = computed(() => definitions.value.find(field => field.id === selectedId.value) ?? null)
const selectedAssignments = computed(() => selectedDefinition.value ? fieldValueAssignments(props.workspace, selectedDefinition.value) : [])
const editName = computed({ get: () => editDraft.value?.name ?? '', set: value => { if (editDraft.value) editDraft.value.name = value } })
const editOptionsText = computed({ get: () => editDraft.value?.optionsText ?? '', set: value => { if (editDraft.value) editDraft.value.optionsText = value } })
const editAppliesToAll = computed({ get: () => editDraft.value?.appliesToAll ?? true, set: value => { if (editDraft.value) editDraft.value.appliesToAll = value } })
const editing = computed(() => activeDraft.value?.kind === 'definition' && !!editDraft.value?.editing && editDraft.value.ownerId === activeDraft.value.ownerId && editDraft.value.ownerId === selectedId.value)
const editTargets = computed(() => editDraft.value?.targets ?? [])
const affectedAssignments = computed(() => {
  const field = selectedDefinition.value
  if (!field || field.type !== 'single-select' || !editing.value) return []
  const allowed = fieldOptionsFromText(editOptionsText.value)
  return selectedAssignments.value.filter(item => typeof item.value === 'string' && !allowed.includes(item.value))
})
const hasModifiedDraft = computed(() => {
  if (activeDraft.value?.kind === 'definition' && editDraft.value?.editing && editDraft.value.ownerId === activeDraft.value.ownerId) {
    const draft = editDraft.value
    const options = draft.type === 'single-select' ? fieldOptionsFromText(draft.optionsText) : draft.baselineOptions
    const applicability = draft.kind === 'custom' && !draft.appliesToAll ? draft.targets : undefined
    const name = draft.kind === 'custom' ? draft.name.trim() : draft.baselineName
    return name !== draft.baselineName
      || !sameOrdered(options, draft.baselineOptions)
      || !sameCustomFieldApplicability(applicability, draft.baselineApplicability)
  }
  return activeDraft.value?.kind === 'create' && (createName.value.trim() !== '' || createType.value !== 'text' || fieldOptionsFromText(createOptionsText.value).length > 0)
})
const modalContentProps = computed(() => ({
  'data-prototype-fields': '',
  'data-screen': screen.value,
  'data-actions': props.actionLayout,
  'data-draft-state': hasModifiedDraft.value ? 'modified' : 'clean',
  'data-review-open': pendingReview.value ? 'true' : 'false',
  'data-fullscreen': isCompact.value ? 'true' : 'false',
  'aria-labelledby': 'prototype-fields-title',
  'aria-modal': true,
  onEscapeKeyDown: handleEscape,
  onPointerDownOutside: handleOutside,
}))

function sameOrdered(first: string[], second: string[]): boolean { return first.length === second.length && first.every((value, index) => value === second[index]) }
function rememberListScroll(event: Event): void { lastListScroll.value = (event.currentTarget as HTMLElement).scrollTop }
function focusListSelection(): void {
  const list = document.querySelector<HTMLElement>('[data-prototype-fields] [data-fields-list]')
  if (!list) return
  list.scrollTop = lastListScroll.value
  const row = [...list.querySelectorAll<HTMLButtonElement>('[data-field-id]')].find(button => button.dataset.fieldId === selectedId.value)
  ;(row ?? list).focus({ preventScroll: true })
}
function focusActivePane(): void {
  if (screen.value === 'list') focusListSelection()
  else if (screen.value === 'detail') document.querySelector<HTMLElement>('[data-prototype-fields] [data-fields-detail]')?.focus({ preventScroll: true })
  else document.querySelector<HTMLElement>('[data-prototype-fields] [data-fields-create]')?.focus({ preventScroll: true })
}
function emitState(): void { emit('state-change', { open: visible.value, screen: screen.value, selectedId: selectedId.value, hasModifiedDraft: hasModifiedDraft.value, reviewOpen: !!pendingReview.value }) }
function assignmentsFor(field: FieldDefinitionSummary): FieldValueAssignment[] { return fieldValueAssignments(props.workspace, field) }
function targetSignature(target: CustomFieldApplicabilityTarget): string { return customFieldApplicabilityTargetKey(target) }
function applicabilityTargetLabel(target: CustomFieldApplicabilityTarget): string {
  if (target.kind === 'category') return `Category ${applicabilityGroups.find(group => group.family === target.family)?.label ?? target.family}`
  return `Subtype ${catalogueTypes.find(type => type.family === target.family && type.value === target.subtype)?.label ?? target.subtype}`
}
function hasTarget(target: CustomFieldApplicabilityTarget): boolean { return editTargets.value.some(item => targetSignature(item) === targetSignature(target)) }
function toggleTarget(target: CustomFieldApplicabilityTarget): void {
  const draft = editDraft.value
  if (!draft) return
  const key = targetSignature(target)
  const index = draft.targets.findIndex(item => targetSignature(item) === key)
  if (index >= 0) draft.targets.splice(index, 1)
  else draft.targets.push(target)
}

function copyDefinitionToDraft(field: FieldDefinitionSummary): void {
  activeDraft.value = { kind: 'definition', ownerId: field.id }
  editDraft.value = {
    ownerId: field.id,
    kind: field.kind,
    type: field.type,
    editing: false,
    name: field.kind === 'custom' ? field.name : '',
    optionsText: field.type === 'single-select' ? field.options.join('\n') : '',
    appliesToAll: field.kind === 'native' || field.applicability === undefined,
    targets: field.kind === 'custom' ? [...(field.applicability ?? [])] : [],
    baselineName: field.name,
    baselineOptions: [...field.options],
    baselineApplicability: field.kind === 'custom' && field.applicability !== undefined ? [...field.applicability] : undefined,
  }
}

function show(openerElement?: HTMLElement): void {
  if (!props.enabled) return
  opener.value = openerElement ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)
  visible.value = true
  void nextTick(() => {
    emit('open-change', true)
    focusActivePane()
    emitState()
  })
}

function hideModal(): void {
  visible.value = false
  emit('open-change', false)
  emitState()
}

function restoreOpenerFocus(): void {
  if (visible.value) return
  const target = opener.value
  opener.value = null
  if (target?.isConnected && target.getClientRects().length) target.focus({ preventScroll: true })
}

function close(): void {
  if (props.inspectorConflict) return
  hideModal()
}

function handleEscape(event: KeyboardEvent): void {
  if (props.inspectorConflict) { event.preventDefault(); return }
  if (pendingReview.value) { event.preventDefault(); cancelReview(); return }
  if (guardTransition.value) { event.preventDefault(); stayOnDraft() }
}

function handleOutside(event: { preventDefault(): void }): void {
  if (props.inspectorConflict || guardTransition.value) event.preventDefault()
}

function onModalOpenChange(open: boolean): void {
  if (open) {
    visible.value = true
    return
  }
  if (props.inspectorConflict || guardTransition.value) {
    visible.value = true
    return
  }
  hideModal()
}

function cancelImpactReview(clearTransition = false): void {
  pendingReview.value = null
  pendingCommand.value = null
  if (clearTransition) {
    pendingTransition.value = null
    guardTransition.value = false
  }
  localError.value = ''
  statusMessage.value = 'Field review canceled. Your field draft is still open; review it again before applying.'
  emitState()
}

function isOpen(): boolean { return visible.value }
function getSelectedIndex(): number { return definitions.value.findIndex(field => field.id === selectedId.value) }

function requestTransition(target: Target): void {
  if (pendingReview.value || pendingCommand.value || props.inspectorConflict) return
  if (target.kind === 'select' && !definitions.value.some(field => field.id === target.id)) return
  if (target.kind === 'select' && target.id === selectedId.value && screen.value === 'detail') return
  if (target.kind === 'list' && screen.value === 'list') return
  if (target.kind === 'create' && screen.value === 'create') return
  const resumesActiveDraft = (target.kind === 'create' && activeDraft.value?.kind === 'create')
    || (target.kind === 'select' && activeDraft.value?.kind === 'definition' && activeDraft.value.ownerId === target.id)
  if (target.kind === 'list') {
    if (hasModifiedDraft.value) {
      statusMessage.value = activeDraft.value?.kind === 'create'
        ? 'Your creation draft is still available. Choose Add custom field to resume it.'
        : 'Your field draft is still available. Select the same field to resume it.'
    }
    continueTransition(target)
    return
  }
  if (hasModifiedDraft.value && !resumesActiveDraft) {
    pendingTransition.value = target
    guardTransition.value = true
    return
  }
  continueTransition(target)
}

function continueTransition(target: Target): void {
  pendingTransition.value = null
  guardTransition.value = false
  localError.value = ''
  if (target.kind === 'list') {
    screen.value = 'list'
  } else if (target.kind === 'create') {
    if (activeDraft.value?.kind !== 'create') resetCreateDraft()
    activeDraft.value = { kind: 'create' }
    screen.value = 'create'
  } else {
    selectedId.value = target.id
    screen.value = 'detail'
    const field = definitions.value.find(item => item.id === target.id)
    if (field && (activeDraft.value?.kind !== 'definition' || activeDraft.value.ownerId !== target.id || editDraft.value?.ownerId !== target.id)) copyDefinitionToDraft(field)
  }
  emit('clear-error')
  emitState()
  void nextTick(() => {
    if (target.kind === 'list') focusListSelection()
    if (target.kind === 'select') document.querySelector<HTMLElement>('[data-prototype-fields] [data-fields-detail]')?.focus({ preventScroll: true })
  })
}

function stayOnDraft(): void { pendingTransition.value = null; guardTransition.value = false; emitState() }
function discardAndContinue(): void {
  const target = pendingTransition.value
  if (!target) return
  const active = activeDraft.value
  if (active?.kind === 'create') resetCreateDraft()
  if (active?.kind === 'definition') {
    const field = definitions.value.find(item => item.id === active.ownerId)
    if (field) copyDefinitionToDraft(field)
    else editDraft.value = null
  }
  activeDraft.value = null
  pendingReview.value = null
  continueTransition(target)
}
function applyGuardedTransition(): void {
  guardTransition.value = false
  if (activeDraft.value?.kind === 'create') screen.value = 'create'
  else if (activeDraft.value?.kind === 'definition') {
    selectedId.value = activeDraft.value.ownerId
    screen.value = 'detail'
  }
  emitState()
  void nextTick(focusActivePane)
  if (activeDraft.value?.kind === 'create') { createField(); return }
  applyEdit()
}

function beginEdit(): void {
  const field = selectedDefinition.value
  if (!field) return
  if (hasModifiedDraft.value && !(activeDraft.value?.kind === 'definition' && activeDraft.value.ownerId === field.id)) {
    requestTransition({ kind: 'select', id: field.id })
    return
  }
  if (!editDraft.value || editDraft.value.ownerId !== field.id) copyDefinitionToDraft(field)
  if (editDraft.value) editDraft.value.editing = true
  statusMessage.value = 'Editing a copy. Saved values remain unchanged until the field command is accepted.'
  emitState()
}
function cancelEdit(): void {
  const field = selectedDefinition.value
  if (field) copyDefinitionToDraft(field)
  pendingReview.value = null
  pendingCommand.value = null
  pendingTransition.value = null
  guardTransition.value = false
  localError.value = ''
  emit('clear-error')
  emitState()
}
function discardOrphanedDraft(): void {
  editDraft.value = null
  activeDraft.value = null
  localError.value = ''
  statusMessage.value = 'The detached field draft was discarded explicitly.'
  emitState()
}

function normalizedUpdate(): FieldDefinitionUpdate | null {
  const field = selectedDefinition.value
  const draft = editDraft.value
  if (!field || !draft || draft.ownerId !== field.id || !draft.editing) return null
  return { fieldId: field.id, name: field.kind === 'custom' ? draft.name.trim() : field.name, options: field.type === 'single-select' ? fieldOptionsFromText(draft.optionsText) : [...field.options], applicability: field.kind === 'custom' && !draft.appliesToAll ? [...draft.targets] : undefined }
}

function saveChange(update: FieldDefinitionUpdate): PendingFieldDefinitionChange {
  const field = definitions.value.find(item => item.id === update.fieldId)
  if (!field) throw new Error('This custom field no longer exists. Your draft is preserved; return to the list to choose another field.')
  const affected = field.type === 'single-select' ? assignmentsFor(field).filter(item => typeof item.value === 'string' && !update.options.includes(item.value)) : []
  return { kind: 'save', update, fieldName: field.name, affectedAssignments: affected }
}

function reviewSignature(change: PendingFieldDefinitionChange): string {
  const fieldId = change.kind === 'remove' ? change.fieldId : change.update.fieldId
  const current = definitions.value.find(item => item.id === fieldId)
  const assignments = change.affectedAssignments.map(item => ({ ...item, value: String(item.value) })).sort((a, b) => a.objectId.localeCompare(b.objectId))
  const request = change.kind === 'remove' ? { kind: 'remove', fieldId } : { kind: 'save', update: { ...change.update, applicability: change.update.applicability?.map(targetSignature).sort() } }
  return JSON.stringify({ operation: request, current, assignments })
}

function applyEdit(): void {
  if (!hasModifiedDraft.value) {
    if (pendingTransition.value) continueTransition(pendingTransition.value)
    else {
      if (selectedDefinition.value) copyDefinitionToDraft(selectedDefinition.value)
      statusMessage.value = 'No field values changed.'
      emitState()
    }
    return
  }
  const update = normalizedUpdate()
  if (!update) { localError.value = 'The edited definition is no longer available. Your draft is preserved.'; return }
  if (!update.name) { localError.value = 'Enter a field name before applying.'; return }
  try {
    const change = saveChange(update)
    if (change.affectedAssignments.length) { stageReview(change); return }
    emit('clear-error')
    sendCommand('save', update)
  } catch (error) { localError.value = error instanceof Error ? error.message : 'The field change could not be reviewed.' }
}

function requestDelete(): void {
  const field = selectedDefinition.value
  if (!field || field.kind !== 'custom') return
  if (hasModifiedDraft.value && !(activeDraft.value?.kind === 'definition' && activeDraft.value.ownerId === field.id)) {
    requestTransition({ kind: 'select', id: field.id })
    return
  }
  stageReview({ kind: 'remove', fieldId: field.id, fieldName: field.name, affectedAssignments: assignmentsFor(field) })
}

function stageReview(change: PendingFieldDefinitionChange): void {
  pendingReview.value = { change, signature: reviewSignature(change) }
  localError.value = ''
  emit('clear-error')
  emitState()
}

function cancelReview(): void {
  pendingReview.value = null
  pendingCommand.value = null
  pendingTransition.value = null
  guardTransition.value = false
  statusMessage.value = 'Review canceled. Your field draft remains available.'
  emit('clear-error')
  emitState()
}

function confirmReview(): void {
  const review = pendingReview.value
  if (!review) return
  let currentChange: PendingFieldDefinitionChange
  try {
    const stagedChange = review.change
    if (stagedChange.kind === 'remove') {
      const field = definitions.value.find(item => item.id === stagedChange.fieldId)
      if (!field || field.kind !== 'custom') throw new Error('This custom field no longer exists. Its draft is preserved; cancel and return to the list.')
      currentChange = { kind: 'remove', fieldId: field.id, fieldName: field.name, affectedAssignments: assignmentsFor(field) }
    } else currentChange = saveChange(stagedChange.update)
  } catch (error) { localError.value = error instanceof Error ? error.message : 'The field impact could not be refreshed.'; return }
  const signature = reviewSignature(currentChange)
  if (signature !== review.signature) {
    pendingReview.value = { change: currentChange, signature }
    statusMessage.value = 'The saved values or definition changed. Review the refreshed impact and confirm again.'
    emitState()
    return
  }
  pendingReview.value = null
  emit('clear-error')
  if (currentChange.kind === 'remove') sendCommand('remove', currentChange.fieldId)
  else sendCommand('save', currentChange.update)
}

function sendCommand(kind: PendingCommand['kind'], payload: CustomFieldCreate | FieldDefinitionUpdate | string): void {
  if (pendingCommand.value || props.saving) return
  pendingCommand.value = { kind, knownIds: customFields.value.map(field => field.id), selectedId: selectedId.value, selectedIndex: getSelectedIndex() }
  savedRevision = props.saveRevision
  localError.value = ''
  statusMessage.value = kind === 'remove' ? 'Waiting for the in-memory field removal to be acknowledged.' : 'Waiting for the in-memory field change to be acknowledged.'
  emitState()
  if (kind === 'create') emit('create-custom-field', payload as CustomFieldCreate)
  else if (kind === 'save') emit('save-field-definition', payload as FieldDefinitionUpdate)
  else emit('remove-field-definition', payload as string)
}

function createField(): void {
  if (!createName.value.trim()) { localError.value = 'Enter a field name before creating it.'; return }
  emit('clear-error')
  sendCommand('create', { name: createName.value.trim(), type: createType.value, options: createType.value === 'single-select' ? fieldOptionsFromText(createOptionsText.value) : [] })
}
function resetCreateDraft(): void { createName.value = ''; createType.value = 'text'; createOptionsText.value = '' }
function cancelCreation(): void {
  resetCreateDraft()
  activeDraft.value = null
  screen.value = 'list'
  localError.value = ''
  statusMessage.value = 'Creation canceled. No field was added.'
  emitState()
  void nextTick(focusListSelection)
}

function acknowledgeCommand(): void {
  const command = pendingCommand.value
  if (!command) return
  const nextTransition = pendingTransition.value
  if (command.kind === 'create') {
    const created = customFields.value.find(field => !command.knownIds.includes(field.id))
    pendingCommand.value = null
    resetCreateDraft()
    if (created) { selectedId.value = created.id; copyDefinitionToDraft(created); screen.value = 'detail'; statusMessage.value = `Created ${created.name}. The saved definition is open read-only.` }
    else { screen.value = 'create'; localError.value = 'The memory acknowledgement did not include the new field. Your creation draft is preserved.' }
  } else if (command.kind === 'remove') {
    pendingCommand.value = null
    editDraft.value = null
    activeDraft.value = null
    const fallbackIndex = Math.min(Math.max(0, command.selectedIndex - 1), definitions.value.length - 1)
    const fallback = definitions.value[fallbackIndex]
    selectedId.value = fallback?.id ?? null
    screen.value = 'list'
    statusMessage.value = 'The field was removed from the in-memory chart.'
  } else {
    pendingCommand.value = null
    const field = definitions.value.find(item => item.id === command.selectedId)
    if (field) copyDefinitionToDraft(field)
    statusMessage.value = 'The field change is applied to the in-memory chart.'
  }
  pendingReview.value = null
  localError.value = ''
  emit('clear-error')
  if (nextTransition && command.kind !== 'remove') continueTransition(nextTransition)
  else { pendingTransition.value = null; guardTransition.value = false }
  emitState()
  void nextTick(focusActivePane)
}

watch(() => props.saveRevision, value => {
  if (value === savedRevision || !pendingCommand.value) return
  savedRevision = value
  acknowledgeCommand()
})
watch(() => props.rejectionRevision, value => {
  if (value === rejectedRevision) return
  rejectedRevision = value
  if (!pendingCommand.value) return
  pendingCommand.value = null
  localError.value = ''
  statusMessage.value = 'The field command was refused. Your draft and requested target remain available.'
  emitState()
})
watch(() => props.enabled, enabled => {
  if (!enabled && visible.value) hideModal()
})
watch([screen, selectedId, hasModifiedDraft, pendingReview, visible], emitState)
watch(() => props.workspace, () => {
  if (editDraft.value && !definitions.value.some(field => field.id === editDraft.value?.ownerId) && hasModifiedDraft.value) {
    localError.value = 'The edited field is missing from the current chart. Its detached draft is preserved; resolve it explicitly before continuing.'
    statusMessage.value = 'A workspace replacement removed the field targeted by this draft.'
  }
}, { deep: false })

function onCompactChange(event: MediaQueryListEvent): void { isCompact.value = event.matches }
onMounted(() => {
  compactQuery = window.matchMedia('(max-width: 760px), (max-width: 1024px) and (max-height: 600px)')
  isCompact.value = compactQuery.matches
  compactQuery.addEventListener('change', onCompactChange)
})
onUnmounted(() => compactQuery?.removeEventListener('change', onCompactChange))

defineExpose({ open: show, isOpen, cancelImpactReview, hasModifiedDraft: () => hasModifiedDraft.value })
</script>

<style>
.prototype-fields-dialog { position: fixed; top: 50%; left: 50%; translate: none; transform: translate(-50%,-50%); display: flex; width: min(68rem,calc(100vw - 2rem)); max-width: none; max-height: calc(100dvh - 2rem); overflow: hidden; border: 1px solid var(--proto-line); border-radius: .45rem; padding: 0; background: var(--proto-panel); color: var(--proto-ink); box-shadow: 0 1.8rem 5rem rgba(0,0,0,.55); font-family: "Aptos","Segoe UI",sans-serif; }
.prototype-fields-dialog.fields-theme-dark { --proto-ink: #e8ede4; --proto-muted: #a2b0a5; --proto-line: rgba(188,202,188,.17); --proto-accent: #e8b879; --proto-panel: #14211e; --proto-panel-raised: #1c2c27; --proto-control: #1a2823; --proto-display-font: "Palatino Linotype","Book Antiqua",Georgia,serif; --error-border: #a96b5e; --line: rgba(188,202,188,.23); --line-soft: rgba(188,202,188,.17); --panel-bg: #14211e; --text-primary: #e8ede4; --text-muted: #a2b0a5; --accent: #e8b879; --accent-hover: var(--proto-ink); --error-bg: #33201e; }
.prototype-fields-dialog.fields-theme-light { --proto-ink: #28382f; --proto-muted: #69786b; --proto-line: rgba(47,67,53,.17); --proto-accent: #a26c35; --proto-panel: #f6f3e9; --proto-panel-raised: #fffdf7; --proto-control: #fbf8ef; --proto-display-font: "Palatino Linotype","Book Antiqua",Georgia,serif; --error-border: #b96d5c; --line: rgba(47,67,53,.25); --line-soft: rgba(47,67,53,.17); --panel-bg: #f6f3e9; --text-primary: #28382f; --text-muted: #69786b; --accent: #a26c35; --accent-hover: var(--proto-ink); --error-bg: #f4e7e2; }
.prototype-fields-dialog[data-fullscreen="true"] { inset: 0 !important; top: 0 !important; left: 0 !important; translate: none !important; transform: none !important; width: 100vw !important; height: 100dvh !important; max-height: 100dvh !important; border: 0 !important; border-radius: 0 !important; }
.prototype-fields-content { position: relative; display: flex; flex-direction: column; gap: .75rem; width: 100%; min-height: 0; max-height: inherit; padding: clamp(.85rem,2vw,1.25rem); }
.fields-feedback-stack { display: grid; gap: .35rem; flex: 0 0 auto; }
.prototype-fields-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; border-bottom: 1px solid var(--proto-line, var(--line)); padding-bottom: .75rem; }
.prototype-fields-title h1,.prototype-fields-detail h2,.prototype-fields-create h2,.fields-guard h2,.fields-conflict h2 { margin: .2rem 0 .35rem; font: 500 clamp(1.25rem,2.7vw,1.75rem)/1.12 var(--proto-display-font, Georgia,serif); }
.prototype-fields-title .fields-summary { margin: 0; color: var(--proto-muted, var(--text-muted)); font-size: .74rem; }
.prototype-fields-title .proto-eyebrow,.prototype-fields-create .proto-eyebrow,.fields-guard .proto-eyebrow,.fields-conflict .proto-eyebrow { margin: 0; }
.fields-header-actions,.fields-actions,.fields-guard-actions { display: flex; flex-wrap: wrap; align-items: center; gap: .45rem; }
.fields-header-actions { flex-shrink: 0; }
.fields-back,.fields-layout-toggle,.fields-close,.fields-primary,.fields-secondary,.fields-danger,.fields-new { min-height: 2.25rem; border: 1px solid var(--proto-line, var(--line)); border-radius: .25rem; padding: .42rem .65rem; background: var(--proto-panel, var(--control-bg)); color: var(--proto-ink, var(--text-primary)); font: inherit; font-size: .72rem; cursor: pointer; }
.fields-back { margin: 0 0 .4rem; border: 0; padding: 0; background: transparent; color: var(--proto-muted, var(--text-muted)); }
.fields-primary { border-color: var(--proto-accent, var(--accent)); background: var(--proto-accent, var(--accent)); color: #101719; font-weight: 650; }
.fields-danger { border-color: var(--error-border); color: var(--proto-ink, var(--text-primary)); }
.fields-primary:disabled,.fields-secondary:disabled,.fields-danger:disabled { opacity: .5; cursor: not-allowed; }
.fields-actions-header { min-height: 2.25rem; }
.prototype-fields-workspace { display: grid; flex: 1 1 auto; grid-template-columns: minmax(13rem,.72fr) minmax(0,1.5fr); min-height: 0; border: 1px solid var(--proto-line, var(--line)); background: var(--proto-panel-raised, var(--panel-raised)); }
.prototype-fields-list,.prototype-fields-detail,.prototype-fields-create { min-width: 0; max-height: min(62vh,52rem); overflow: auto; overscroll-behavior: contain; padding: .8rem; }
.prototype-fields-list { display: grid; align-content: start; gap: 1rem; border-right: 1px solid var(--proto-line, var(--line)); }
.fields-list-group { display: grid; align-content: start; gap: .38rem; }
.fields-list-group h2,.fields-target-groups h3 { margin: 0; color: var(--proto-muted, var(--text-muted)); font-size: .62rem; letter-spacing: .1em; text-transform: uppercase; }
.fields-list-heading { display: flex; align-items: center; justify-content: space-between; gap: .5rem; }
.fields-list-heading span,.fields-detail-heading > span { color: var(--proto-muted, var(--text-muted)); font: .62rem Consolas,monospace; }
.fields-choice { display: grid; gap: .18rem; width: 100%; border: 1px solid transparent; border-radius: .2rem; padding: .48rem; background: transparent; color: var(--proto-ink, var(--text-primary)); text-align: left; cursor: pointer; }
.fields-choice:hover,.fields-choice[aria-pressed="true"] { border-color: var(--proto-accent, var(--accent)); background: color-mix(in srgb,var(--proto-accent, var(--accent)) 12%,transparent); }
.fields-choice small { color: var(--proto-muted, var(--text-muted)); font-size: .59rem; overflow-wrap: anywhere; }
.fields-new { min-height: 1.9rem; text-align: left; }
.fields-empty,.fields-empty-detail,.fields-readonly,.fields-hint { margin: .25rem 0; color: var(--proto-muted, var(--text-muted)); font-size: .75rem; }
.prototype-fields-detail { display: grid; align-content: start; gap: .75rem; }
.fields-detail-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: .7rem; border-bottom: 1px solid var(--proto-line, var(--line)); padding-bottom: .55rem; }
.fields-detail-heading h2 { overflow-wrap: anywhere; }
.fields-edit-form { display: grid; gap: .75rem; min-width: 0; margin: 0; border: 0; padding: 0; }
.fields-label { display: grid; gap: .3rem; color: var(--proto-muted, var(--text-muted)); font-size: .7rem; }
.fields-label input,.fields-label select,.fields-label textarea { width: 100%; min-height: 2.3rem; border: 1px solid var(--proto-line, var(--line)); border-radius: .2rem; padding: .5rem .6rem; background: var(--proto-control, var(--control-bg)); color: var(--proto-ink, var(--text-primary)); font: inherit; }
.fields-applicability { display: grid; gap: .5rem; margin: 0; border: 1px solid var(--proto-line, var(--line)); padding: .65rem; }
.fields-applicability legend { color: var(--proto-muted, var(--text-muted)); font-size: .65rem; }
.fields-applicability > label,.fields-target-groups label { display: flex; align-items: flex-start; gap: .4rem; color: var(--proto-ink, var(--text-primary)); font-size: .69rem; }
.prototype-fields-dialog input[type="radio"],.prototype-fields-dialog input[type="checkbox"] { appearance: auto; flex: 0 0 1rem; width: 1rem; min-width: 1rem; height: 1rem; min-height: 1rem; margin: .15rem .1rem 0 0; padding: 0; accent-color: var(--proto-accent, var(--accent)); }
.fields-committed-definition { display: grid; gap: .55rem; border: 1px solid var(--proto-line, var(--line)); padding: .65rem; }
.fields-committed-definition h3 { margin: 0 0 .3rem; color: var(--proto-muted, var(--text-muted)); font-size: .64rem; letter-spacing: .08em; text-transform: uppercase; }
.fields-committed-definition p,.fields-committed-definition ul { margin: 0; color: var(--proto-ink, var(--text-primary)); font-size: .72rem; line-height: 1.5; }
.fields-committed-definition ul { display: grid; gap: .2rem; padding-left: 1.1rem; }
.fields-target-groups { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: .8rem; border-top: 1px solid var(--proto-line, var(--line)); padding-top: .65rem; }
.fields-target-groups > section { display: grid; align-content: start; gap: .35rem; }
.fields-status,.fields-error { margin: 0; font-size: .73rem; line-height: 1.45; }
.fields-status { color: var(--proto-muted, var(--text-muted)); }
.fields-error { border-left: 2px solid var(--error-border); padding: .35rem .55rem; color: var(--proto-ink, var(--text-primary)); }
.fields-orphaned-draft { border: 1px solid var(--error-border); padding: .8rem; background: color-mix(in srgb,var(--proto-accent) 8%,var(--proto-panel)); }
.fields-orphaned-draft h2 { margin: 0; font-size: 1rem; }
.fields-orphaned-draft p { overflow-wrap: anywhere; color: var(--proto-muted); font-size: .75rem; }
.prototype-fields-create { display: grid; align-content: start; gap: .75rem; }
.prototype-fields-create h2 { margin: 0; }
.fields-guard,.fields-conflict { position: absolute; z-index: 5; inset: 0; display: grid; place-content: center; gap: 1rem; overflow: auto; padding: 1rem; background: rgba(5,10,12,.78); }
.fields-guard > div,.fields-conflict-card { width: min(34rem,100%); border: 1px solid var(--proto-line, var(--line)); padding: 1rem; background: var(--proto-panel, var(--panel-bg)); box-shadow: 0 1rem 3rem rgba(0,0,0,.4); }
.fields-guard p,.fields-conflict p { color: var(--proto-muted, var(--text-muted)); font-size: .76rem; line-height: 1.5; }
.fields-actions-footer { border-top: 1px solid var(--proto-line, var(--line)); padding-top: .65rem; }
@media (max-width: 760px),(max-width: 1024px) and (max-height: 600px) {
  .prototype-fields-content { max-height: 100%; gap: .55rem; padding: calc(.6rem + env(safe-area-inset-top)) .6rem calc(.6rem + env(safe-area-inset-bottom)); }
  .prototype-fields-header { gap: .5rem; }
  .prototype-fields-title .fields-summary { max-width: 19rem; }
  .prototype-fields-workspace { grid-template-columns: minmax(0,1fr); }
  .prototype-fields-workspace.is-list-screen { grid-template-rows: minmax(0,1fr); }
  .prototype-fields-workspace.is-detail-screen,.prototype-fields-workspace.is-create-screen { grid-template-rows: minmax(0,1fr); }
  .prototype-fields-list,.prototype-fields-detail,.prototype-fields-create { max-height: 58vh; padding: .6rem; }
  .prototype-fields-workspace.is-list-screen .prototype-fields-list { border-right: 0; }
  .prototype-fields-workspace.is-list-screen .prototype-fields-detail { display: none; }
  .prototype-fields-list { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: .6rem; border-bottom: 0; }
  .fields-list-group:nth-child(2) { grid-column: 1/-1; }
  .fields-target-groups { grid-template-columns: 1fr; }
  .fields-actions-footer { padding-bottom: env(safe-area-inset-bottom,0px); }
}
</style>
