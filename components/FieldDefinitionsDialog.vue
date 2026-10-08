<script setup lang="ts">
/**
 * The dialog owns selection and confirmation; submitted drafts reset only after the parent's save revision advances.
 */
import { computed, nextTick, ref, shallowRef, watch } from 'vue'
import type { CustomFieldType, LocalWorkspace } from '../domain/workspace'
import FieldDefinitionChangeConfirmation from './field-definitions/FieldDefinitionChangeConfirmation.vue'
import FieldDefinitionEditor from './field-definitions/FieldDefinitionEditor.vue'
import FieldDefinitionList from './field-definitions/FieldDefinitionList.vue'
import {
  fieldDefinitionSummaries,
  fieldOptionsFromText,
  fieldValueAssignments,
  type CustomFieldCreate,
  type FieldDefinitionUpdate,
  type PendingFieldDefinitionChange,
} from './field-definitions/model'

const props = defineProps<{
  workspace: LocalWorkspace
  saving: boolean
  saveError: string
  saveRevision: number
}>()

const emit = defineEmits<{
  'request-open': []
  'open-change': [open: boolean]
  'clear-error': []
  'create-custom-field': [request: CustomFieldCreate]
  'save-field-definition': [request: FieldDefinitionUpdate]
  'remove-field-definition': [fieldId: string]
}>()

const trigger = ref<HTMLButtonElement | null>(null)
const dialog = ref<HTMLDialogElement | null>(null)
const dialogOpen = ref(false)
const selectedFieldDefinitionId = ref<string>('native:atmosphere')
const pendingFieldDefinitionChange = ref<PendingFieldDefinitionChange | null>(null)
const fieldDefinitionEditor = shallowRef<{ isEditing(): boolean; reset(): void } | null>(null)
const newCustomFieldName = ref('')
const newCustomFieldType = ref<CustomFieldType>('text')
const newCustomFieldOptions = ref('')
const newCustomFieldFormOpen = ref(false)
const pendingAction = ref<'create' | 'save' | 'remove' | null>(null)

const fieldDefinitions = computed(() => fieldDefinitionSummaries(props.workspace))
const nativeFieldDefinitions = computed(() =>
  fieldDefinitions.value.filter(field => field.kind === 'native'),
)
const customFieldDefinitions = computed(() =>
  fieldDefinitions.value.filter(field => field.kind === 'custom'),
)
const selectedFieldDefinition = computed(() =>
  fieldDefinitions.value.find(field => field.id === selectedFieldDefinitionId.value),
)
const selectedFieldAssignments = computed(() => {
  const definition = selectedFieldDefinition.value
  return definition ? fieldValueAssignments(props.workspace, definition) : []
})

/**
 * Selects an existing definition, confirming before discarding another definition's active draft.
 * @param fieldId Native or custom definition ID to display.
 */
function selectFieldDefinition(fieldId: string): void {
  if (!fieldDefinitions.value.some(field => field.id === fieldId)) return
  const editor = fieldDefinitionEditor.value
  if (editor?.isEditing()) {
    if (fieldId === selectedFieldDefinitionId.value) return
    if (!window.confirm('Discard unsaved field definition edits?')) return
    editor.reset()
  }

  selectedFieldDefinitionId.value = fieldId
  emit('clear-error')
  pendingFieldDefinitionChange.value = null
}

/** Resets dialog-local creation state and opens on the Atmosphere definition after the next render tick. */
function show(): void {
  if (dialogOpen.value) return
  newCustomFieldFormOpen.value = false
  newCustomFieldName.value = ''
  newCustomFieldType.value = 'text'
  newCustomFieldOptions.value = ''
  selectFieldDefinition('native:atmosphere')
  dialogOpen.value = true
  void nextTick(() => {
    dialog.value?.showModal()
    emit('open-change', true)
  })
}

/**
 * Closes after any active definition draft is accepted for discard, clears pending actions, and restores focus.
 */
function close(): void {
  if (
    fieldDefinitionEditor.value?.isEditing()
    && !window.confirm('Discard unsaved field definition edits?')
  ) return
  if (dialog.value?.open) dialog.value.close()
  dialogOpen.value = false
  pendingFieldDefinitionChange.value = null
  newCustomFieldFormOpen.value = false
  pendingAction.value = null
  emit('open-change', false)
  void nextTick(() => trigger.value?.focus())
}

/** Prevents the native dialog cancel path from bypassing the draft-discard confirmation. */
function cancelDialog(event: Event): void {
  event.preventDefault()
  close()
}

/** Opens a fresh create draft after confirming and discarding an active definition edit, if present. */
function openNewCustomFieldForm(): void {
  if (fieldDefinitionEditor.value?.isEditing()) {
    if (!window.confirm('Discard unsaved field definition edits?')) return
    fieldDefinitionEditor.value.reset()
    pendingFieldDefinitionChange.value = null
  }
  newCustomFieldName.value = ''
  newCustomFieldType.value = 'text'
  newCustomFieldOptions.value = ''
  newCustomFieldFormOpen.value = true
  emit('clear-error')
}

/**
 * Dispatches safe edits immediately but retains destructive requests for explicit assignment review.
 * @param change Proposed definition save/removal and the assignments it could clear.
 */
function requestFieldDefinitionChange(change: PendingFieldDefinitionChange): void {
  if (change.kind === 'save' && !change.affectedAssignments.length) {
    pendingAction.value = 'save'
    emit('clear-error')
    emit('save-field-definition', change.update)
    return
  }
  pendingFieldDefinitionChange.value = change
  emit('clear-error')
}

/** Drops the pending destructive request without changing the selected definition. */
function cancelFieldDefinitionChange(): void {
  pendingFieldDefinitionChange.value = null
  emit('clear-error')
}

/** Dispatches the reviewed save/removal; drafts remain until the parent reports commit success. */
function confirmFieldDefinitionChange(): void {
  const change = pendingFieldDefinitionChange.value
  if (!change) return
  pendingAction.value = change.kind
  emit('clear-error')
  if (change.kind === 'remove') emit('remove-field-definition', change.fieldId)
  else emit('save-field-definition', change.update)
}

/**
 * Emits a new custom-field request with blank option lines removed by the shared parser.
 * The form resets only when the parent's save revision advances.
 */
function createCustomField(): void {
  pendingAction.value = 'create'
  emit('clear-error')
  emit('create-custom-field', {
    name: newCustomFieldName.value,
    type: newCustomFieldType.value,
    options: fieldOptionsFromText(newCustomFieldOptions.value),
  })
}

watch(() => props.saveRevision, () => {
  const action = pendingAction.value
  if (!action) return
  if (action === 'create') {
    const lastField = props.workspace.objectFieldSettings.customFields.at(-1)
    if (lastField) selectFieldDefinition(lastField.id)
    newCustomFieldFormOpen.value = false
    newCustomFieldName.value = ''
    newCustomFieldType.value = 'text'
    newCustomFieldOptions.value = ''
  } else if (action === 'remove') {
    fieldDefinitionEditor.value?.reset()
    selectFieldDefinition('native:atmosphere')
  } else {
    fieldDefinitionEditor.value?.reset()
  }
  pendingFieldDefinitionChange.value = null
  pendingAction.value = null
  emit('clear-error')
})
watch(() => props.saveError, (error) => {
  if (error) pendingAction.value = null
})

defineExpose({
  open: show,
  isOpen: () => dialogOpen.value,
})
</script>

<template>
  <button
    ref="trigger"
    class="field-definitions-trigger"
    type="button"
    aria-haspopup="dialog"
    aria-controls="field-definitions-dialog"
    :aria-expanded="dialogOpen"
    aria-label="Open field definitions"
    title="Manage native and custom field definitions"
    @click="emit('request-open')"
  >
    <span>FIELD DEFINITIONS</span>
    <small>MAP DATA</small>
  </button>

  <Teleport to="body">
    <dialog
      v-if="dialogOpen"
      id="field-definitions-dialog"
      ref="dialog"
      class="field-definitions-dialog"
      aria-labelledby="field-definitions-title"
      aria-modal="true"
      @cancel="cancelDialog"
      @click.self="close"
    >
      <div class="field-definitions-content">
        <header class="field-definitions-header">
          <div>
            <span class="section-kicker">MAP DATA / REUSABLE DEFINITIONS</span>
            <h2 id="field-definitions-title">Field definitions</h2>
            <p>Manage values available across this map without changing the active system or selection.</p>
          </div>
          <button
            class="quiet-button field-definitions-close"
            type="button"
            aria-label="Close field definitions"
            autofocus
            @click="close"
          >
            Close
          </button>
        </header>

        <div class="field-definitions-layout">
          <FieldDefinitionList
            :native-fields="nativeFieldDefinitions"
            :custom-fields="customFieldDefinitions"
            :selected-field-id="selectedFieldDefinitionId"
            @select="selectFieldDefinition"
            @create-custom-field="openNewCustomFieldForm"
          />
          <FieldDefinitionEditor
            v-if="selectedFieldDefinition"
            ref="fieldDefinitionEditor"
            :definition="selectedFieldDefinition"
            :assignments="selectedFieldAssignments"
            :saving="props.saving"
            :change-pending="pendingFieldDefinitionChange !== null"
            @clear-error="emit('clear-error')"
            @request-change="requestFieldDefinitionChange"
          />
        </div>

        <p v-if="props.saveError" class="feedback field-definition-error" role="alert">
          {{ props.saveError }}
        </p>

        <form
          v-if="newCustomFieldFormOpen"
          class="field-definition-create-form"
          @submit.prevent="createCustomField"
        >
          <div class="field-definition-section-heading">
            <div>
              <span class="section-kicker">NEW REUSABLE FIELD</span>
              <h3>Add custom field</h3>
            </div>
            <button
              class="quiet-button"
              type="button"
              @click="newCustomFieldFormOpen = false"
            >
              Cancel
            </button>
          </div>
          <label for="new-custom-field-name">
            Custom field label
            <input
              id="new-custom-field-name"
              v-model="newCustomFieldName"
              maxlength="80"
              required
              autofocus
            >
          </label>
          <label for="new-custom-field-type">
            Value type
            <select id="new-custom-field-type" v-model="newCustomFieldType">
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="boolean">Boolean</option>
              <option value="single-select">Single-select</option>
            </select>
          </label>
          <label v-if="newCustomFieldType === 'single-select'" for="new-custom-field-options">
            New field choices
            <textarea id="new-custom-field-options" v-model="newCustomFieldOptions" rows="3" />
          </label>
          <div class="field-definition-actions">
            <button class="primary-button" type="submit" :disabled="props.saving">
              Add custom field
            </button>
          </div>
        </form>

        <FieldDefinitionChangeConfirmation
          v-if="pendingFieldDefinitionChange"
          :change="pendingFieldDefinitionChange"
          @cancel="cancelFieldDefinitionChange"
          @confirm="confirmFieldDefinitionChange"
        />
      </div>
    </dialog>
  </Teleport>
</template>

<style>
.field-definitions-trigger {
  display: grid;
  min-height: 2.45rem;
  gap: 0.12rem;
  border: 1px solid var(--line);
  border-radius: 2px;
  padding: 0.34rem 0.55rem;
  background: var(--control-bg);
  color: var(--text-secondary);
  cursor: pointer;
  text-align: left;
}

.field-definitions-trigger:hover {
  border-color: var(--accent);
  background: var(--control-hover);
  color: var(--accent-hover);
}

.field-definitions-trigger span {
  font-size: 0.62rem;
  letter-spacing: 0.08em;
}

.field-definitions-trigger small {
  color: var(--accent);
  font-size: 0.5rem;
  letter-spacing: 0.12em;
}

.field-definitions-dialog {
  width: min(60rem, calc(100vw - 2rem));
  max-width: none;
  max-height: calc(100dvh - 2rem);
  margin: auto;
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: 4px;
  padding: 0;
  background: var(--panel-bg);
  color: var(--text-primary);
  box-shadow: 0 1.8rem 5rem rgba(0, 0, 0, 0.55);
}

.field-definitions-dialog::backdrop {
  background: rgba(4, 9, 11, 0.76);
  backdrop-filter: blur(4px);
}

.field-definitions-content {
  display: grid;
  gap: 1rem;
  padding: clamp(1rem, 3vw, 1.5rem);
}

.field-definitions-header,
.field-definition-section-heading,
.field-definition-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.field-definitions-header {
  align-items: flex-start;
  border-bottom: 1px solid var(--line-soft);
  padding-bottom: 1rem;
}

.field-definitions-header h2,
.field-definition-section-heading h4,
.field-definition-create-form h3 {
  margin: 0.4rem 0 0;
  font-family: Georgia, serif;
  font-weight: 500;
}

.field-definitions-header h2 {
  font-size: clamp(1.4rem, 3vw, 1.9rem);
}

.field-definitions-header p {
  margin: 0.45rem 0 0;
  color: var(--text-muted);
  font-size: 0.75rem;
  line-height: 1.5;
}

.field-definitions-close {
  flex: 0 0 auto;
}

.field-definitions-layout {
  display: grid;
  grid-template-columns: minmax(13rem, 0.75fr) minmax(0, 1.5fr);
  min-height: 19rem;
  border: 1px solid var(--line-soft);
  background: var(--panel-raised);
}

.field-definition-create-form > label {
  display: grid;
  gap: 0.35rem;
  color: var(--text-secondary);
  font-size: 0.68rem;
}

.field-definition-create-form input,
.field-definition-create-form select,
.field-definition-create-form textarea {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 2px;
  padding: 0.55rem 0.65rem;
  background: var(--control-bg);
  color: var(--text-primary);
  font: inherit;
}

.field-definition-create-form input:focus,
.field-definition-create-form select:focus,
.field-definition-create-form textarea:focus {
  border-color: var(--accent);
  outline: 2px solid var(--accent-soft);
  outline-offset: 1px;
}

.field-definition-create-form {
  border: 1px solid var(--line-soft);
  padding: 0.8rem;
  background: var(--panel-bg);
}

.field-definition-section-heading h4 {
  margin: 0;
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 0.66rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.field-definition-section-heading > span {
  color: var(--text-muted);
  font: 0.58rem Consolas, monospace;
}

.field-definition-actions {
  flex-wrap: wrap;
  justify-content: flex-start;
}

.field-definition-error {
  margin: 0;
}

.field-definition-create-form {
  display: grid;
  gap: 0.8rem;
}

.field-definition-create-form .section-kicker {
  display: block;
}

@media (max-width: 760px) {
  .field-definitions-dialog {
    width: calc(100vw - 1rem);
    max-height: calc(100dvh - 1rem);
  }

  .field-definitions-content {
    gap: 0.75rem;
    padding: 0.75rem;
  }

  .field-definitions-layout {
    grid-template-columns: 1fr;
  }

}
</style>
