<template>
  <UButton
    v-if="!props.hideTrigger"
    class="field-definitions-trigger workspace-control"
    color="neutral"
    variant="outline"
    size="sm"
    type="button"
    aria-haspopup="dialog"
    aria-controls="field-definitions-dialog"
    :aria-expanded="props.session.open"
    aria-label="Open field definitions"
    :aria-description="props.hasModifiedDraft ? 'An unsaved field draft is retained.' : undefined"
    :title="props.hasModifiedDraft ? 'An unsaved field draft is retained.' : 'Manage native and custom field definitions'"
    @click="open"
  >
    <UIcon name="i-lucide-list" aria-hidden="true" />
    Fields
    <UBadge v-if="props.hasModifiedDraft" color="warning" variant="subtle">Draft</UBadge>
  </UButton>

  <UModal
    id="field-definitions-dialog"
    :open="props.session.open"
    :fullscreen="isCompact"
    :dismissible="true"
    :unmount-on-hide="false"
    title="Field definitions"
    description="Inspect, edit, and create reusable field definitions for this map."
    :content="modalContentProps"
    :ui="{ content: `field-definitions-modal ${isCompact ? 'field-definitions-modal--compact' : ''}` }"
    @update:open="onOpenChange"
    @after:enter="focusActivePane"
    @after:leave="restoreOpenerFocus"
  >
    <template #content>
      <div ref="contentRoot" class="field-definitions-content" :data-screen="props.session.screen">
        <header class="field-definitions-header">
          <div class="field-definitions-title">
            <UButton
              v-if="props.session.screen !== 'list'"
              class="field-definitions-back"
              color="neutral"
              variant="ghost"
              size="xs"
              aria-label="Back to definitions"
              @click="goBack"
            >
              ← Back
            </UButton>
            <span class="section-kicker">MAP DATA / REUSABLE DEFINITIONS</span>
            <h2 id="field-definitions-title">Field definitions</h2>
            <p>Inspect saved values and manage definitions shared across this map.</p>
          </div>
          <UButton
            class="field-definitions-close"
            color="neutral"
            variant="ghost"
            size="sm"
            aria-label="Close field definitions"
            @click="close"
          >
            Close
          </UButton>
        </header>

        <UAlert
          v-if="visibleError"
          color="error"
          variant="subtle"
          role="alert"
          :description="visibleError"
        />

        <div class="field-definitions-workspace">
          <FieldDefinitionList
            ref="fieldList"
            v-show="showListPane && !props.session.review && !props.session.pendingGuard"
            :native-fields="nativeFields"
            :custom-fields="customFields"
            :selected-field-id="props.session.selectedId ?? ''"
            @select="selectField"
            @position-change="rememberListPosition"
          />

          <FieldDefinitionEditor
            v-if="selectedDefinition"
            v-show="showDetailPane && !props.session.review && !props.session.pendingGuard"
            :definition="selectedDefinition"
            :assignments="selectedAssignments"
            :draft="props.session.draft"
            :saving="props.saving"
            :change-pending="props.session.review !== null"
            :editing="props.session.screen === 'edit'"
            @request-delete="deleteField"
            @patch-definition="patchDefinition"
          />

          <section
            v-else-if="showDetailPane"
            class="field-definition-empty-detail"
            role="region"
            aria-label="Field definition editor"
            tabindex="-1"
          >
            <p>Choose a field to inspect its saved values.</p>
          </section>

          <form
            v-if="props.session.screen === 'new' && !props.session.review && !props.session.pendingGuard"
            class="field-definition-create-form"
            tabindex="-1"
            @submit.prevent="submitField"
          >
            <span class="section-kicker">NEW REUSABLE FIELD</span>
            <h3>Add custom field</h3>
            <UFormField label="Custom field label">
              <UInput
                id="new-custom-field-name"
                :model-value="props.session.createDraft?.name ?? ''"
                maxlength="80"
                autocomplete="off"
                required
                @update:model-value="patchCreate({ name: String($event) })"
              />
            </UFormField>
            <UFormField label="Value type">
              <USelect
                id="new-custom-field-type"
                aria-label="Value type"
                :model-value="props.session.createDraft?.type ?? 'text'"
                :items="customFieldTypeItems"
                @update:model-value="patchCreate({ type: $event as CustomFieldType })"
              />
            </UFormField>
            <UFormField v-if="props.session.createDraft?.type === 'single-select'" label="New field choices">
              <UTextarea
                id="new-custom-field-options"
                aria-label="New field choices"
                :model-value="props.session.createDraft.options"
                :rows="4"
                @update:model-value="patchCreate({ options: String($event) })"
              />
            </UFormField>
          </form>

          <section
            v-if="props.session.review"
            class="field-definition-review"
            role="region"
            aria-label="Field change review"
            tabindex="-1"
          >
            <span class="section-kicker">REVIEW FIELD CHANGE</span>
            <h3>{{ props.session.review.operation === 'remove' ? 'Delete' : 'Update' }} {{ props.session.review.fieldName }}?</h3>
            <p>Review the saved values affected by this change before applying it.</p>
            <p v-if="props.session.review.fromType && props.session.review.toType && props.session.review.fromType !== props.session.review.toType">
              Type: {{ props.session.review.fromType }} → {{ props.session.review.toType }}
            </p>
            <div v-if="props.session.review.removedOptions?.length" class="field-definition-removed-choices">
              <p>Removed choices</p>
              <ul aria-label="Removed field choices">
                <li v-for="option in props.session.review.removedOptions" :key="option">{{ option }}</li>
              </ul>
            </div>
            <ul v-if="props.session.review.impacts.length">
              <li v-for="impact in props.session.review.impacts" :key="`${impact.systemId}:${impact.objectId}`">
                <span>{{ impact.objectName }} / {{ impact.systemName }}</span>
                <strong>{{ impact.value }}</strong>
                <span v-if="impact.resolution === 'preserve'">Retain as {{ impact.nextValue }}</span>
                <span v-else-if="impact.resolution === 'remove'">Remove with definition</span>
                <span v-else>Clear this value</span>
              </li>
            </ul>
            <p v-else>No saved values are affected.</p>
          </section>

          <section
            v-if="props.session.pendingGuard"
            class="field-definition-pending-guard"
            role="status"
            aria-label="Unsaved field draft"
            tabindex="-1"
          >
            <span class="section-kicker">UNSAVED FIELD DRAFT</span>
            <h3>Apply this draft before switching?</h3>
            <p>Your current field work stays here until you choose an action.</p>
          </section>
        </div>

        <footer class="field-definitions-actions" aria-label="Field actions">
          <template v-if="props.session.pendingGuard">
            <UButton color="neutral" variant="ghost" @click="emitIntent({ kind: 'resolve-transition', decision: 'stay' })">
              Stay here
            </UButton>
            <UButton color="error" variant="outline" @click="emitIntent({ kind: 'resolve-transition', decision: 'discard' })">
              Discard and continue
            </UButton>
            <UButton color="primary" @click="emitIntent({ kind: 'resolve-transition', decision: 'apply' })">
              Apply and continue
            </UButton>
          </template>
          <template v-else-if="props.session.review">
            <UButton color="neutral" variant="ghost" @click="emitIntent({ kind: 'cancel-review' })">
              Cancel field changes
            </UButton>
            <UButton color="error" @click="emitIntent({ kind: 'confirm-review' })">
              {{ props.session.review.operation === 'remove' ? 'Delete field and clear values' : 'Apply field changes' }}
            </UButton>
          </template>
          <template v-else-if="props.session.screen === 'edit'">
            <UButton color="neutral" variant="ghost" @click="emitIntent({ kind: 'cancel-edit' })">
              Discard field edits
            </UButton>
            <UButton color="primary" :disabled="props.saving || !props.session.draft || props.hasModifiedDraft === false" @click="emitIntent({ kind: 'save-field' })">
              Apply field changes
            </UButton>
          </template>
          <template v-else-if="props.session.screen === 'new'">
            <UButton color="neutral" variant="ghost" @click="emitIntent({ kind: 'cancel-create' })">
              Cancel creation
            </UButton>
            <UButton color="primary" :disabled="props.saving" @click="submitField">
              Add custom field
            </UButton>
          </template>
          <template v-else>
            <UButton
              block
              class="w-full flex-none justify-center"
              v-if="props.session.screen === 'detail' && selectedDefinition"
              color="primary"
              variant="outline"
              :disabled="props.saving || props.session.review !== null"
              aria-label="Edit field definition"
              @click="editField"
            >
              Edit definition
            </UButton>
            <UButton
              color="primary"
              :disabled="props.saving"
              @click="emitIntent({ kind: 'new-field' })"
            >
              New custom field
            </UButton>
          </template>
        </footer>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch, type ComponentPublicInstance } from 'vue'
import type { CustomFieldType, LocalWorkspace } from '../domain/workspace'
import type {
  FieldDefinitionDraft,
  FieldDefinitionsIntent,
  FieldDefinitionsSessionState,
} from '../composables/editor-workflows/types'
import {
  fieldDefinitionSummaries,
  fieldValueAssignments,
  type FieldDefinitionSummary,
} from './field-definitions/model'
import FieldDefinitionEditor from './field-definitions/FieldDefinitionEditor.vue'
import FieldDefinitionList from './field-definitions/FieldDefinitionList.vue'

const props = defineProps<{
  session: FieldDefinitionsSessionState
  workspace: LocalWorkspace
  saving: boolean
  saveError?: string
  inspectorConflict?: boolean
  inspectorConflictError?: string
  hideTrigger?: boolean
  hasModifiedDraft?: boolean
}>()

const emit = defineEmits<{
  intent: [intent: FieldDefinitionsIntent]
}>()

const contentRoot = ref<HTMLElement | null>(null)
const fieldList = ref<ComponentPublicInstance | null>(null)
const isCompact = ref(false)
const visualViewportMetrics = ref({ height: 0, offsetTop: 0 })
const nativeFields = computed(() => fieldDefinitionSummaries(props.workspace).filter(field => field.kind === 'native'))
const customFields = computed(() => fieldDefinitionSummaries(props.workspace).filter(field => field.kind === 'custom'))
const allFields = computed(() => [...nativeFields.value, ...customFields.value])
const selectedDefinition = computed<FieldDefinitionSummary | null>(() =>
  allFields.value.find(field => field.id === props.session.selectedId) ?? null,
)
const selectedAssignments = computed(() => selectedDefinition.value
  ? fieldValueAssignments(props.workspace, selectedDefinition.value)
  : [])
const showListPane = computed(() => !isCompact.value || props.session.screen === 'list')
const showDetailPane = computed(() => isCompact.value
  ? props.session.screen === 'detail' || props.session.screen === 'edit'
  : props.session.screen !== 'new')
const visibleError = computed(() => props.session.error || props.saveError || '')
const customFieldTypeItems = [
  { label: 'Text', value: 'text' },
  { label: 'Number', value: 'number' },
  { label: 'Boolean', value: 'boolean' },
  { label: 'Single-select', value: 'single-select' },
]

let compactQuery: MediaQueryList | null = null
let visualViewport: VisualViewport | null = null
let viewportFrame = 0
let actualOpener: HTMLElement | null = null

const modalContentProps = computed(() => ({
  'aria-labelledby': 'field-definitions-title',
  style: isCompact.value
    ? {
        '--field-viewport-height': `${visualViewportMetrics.value.height || window.innerHeight}px`,
        '--field-viewport-top': `${visualViewportMetrics.value.offsetTop}px`,
      }
    : undefined,
  onOpenAutoFocus: onOpenAutoFocus,
  onCloseAutoFocus: onCloseAutoFocus,
}))

function emitIntent(intent: FieldDefinitionsIntent): void {
  emit('intent', intent)
}

function open(): void {
  emitIntent({ kind: 'open' })
}

function close(): void {
  rememberListPosition()
  emitIntent({ kind: 'close' })
}

function onOpenChange(openState: boolean): void {
  if (openState !== props.session.open) emitIntent({ kind: openState ? 'open' : 'close' })
}

function goBack(): void {
  rememberListPosition()
  emitIntent({ kind: 'back' })
}

function selectField(fieldId: string): void {
  rememberListPosition(fieldId)
  emitIntent({ kind: 'select-field', fieldId })
}

function editField(): void {
  if (!props.session.selectedId) return
  emitIntent({ kind: 'edit-field', fieldId: props.session.selectedId })
}

function deleteField(): void {
  const fieldId = props.session.selectedId
  if (!fieldId || selectedDefinition.value?.kind !== 'custom') return
  emitIntent({ kind: 'delete-field', fieldId })
}

function patchCreate(patch: Partial<FieldDefinitionsSessionState['createDraft']>): void {
  if (!patch) return
  emitIntent({ kind: 'patch-create', patch })
}

function submitField(): void {
  emitIntent({ kind: 'save-field' })
}

function patchDefinition(patch: Partial<FieldDefinitionDraft>): void {
  emitIntent({ kind: 'patch-definition', patch })
}

function listElement(): HTMLElement | null {
  const element = fieldList.value?.$el
  return typeof HTMLElement !== 'undefined' && element instanceof HTMLElement ? element : null
}

function rememberListPosition(focusedFieldId?: string): void {
  const list = listElement()
  const activeElement = typeof document === 'undefined' ? null : document.activeElement
  const activeRow = activeElement instanceof HTMLElement ? activeElement.closest<HTMLElement>('[data-field-id]') : null
  const activeFieldId = activeRow && list?.contains(activeRow) ? activeRow.dataset.fieldId ?? null : null
  emitIntent({
    kind: 'remember-list',
    position: {
      scrollTop: list?.scrollTop ?? props.session.listPosition.scrollTop,
      focusedFieldId: focusedFieldId ?? activeFieldId ?? props.session.listPosition.focusedFieldId,
    },
  })
}

async function restoreListPosition(): Promise<void> {
  await nextTick()
  const list = listElement()
  if (!list) return
  list.scrollTop = props.session.listPosition.scrollTop
  const focusedId = props.session.listPosition.focusedFieldId ?? props.session.selectedId
  const row = focusedId
    ? [...list.querySelectorAll<HTMLElement>('[data-field-id]')].find(element => element.dataset.fieldId === focusedId)
    : null
  ;(row ?? list).focus({ preventScroll: true })
}

function focusableElement(active: Element | null): HTMLElement | null {
  if (active instanceof HTMLElement) return active
  if (typeof SVGElement !== 'undefined' && active instanceof SVGElement) {
    return active.closest<HTMLElement>('button, a[href], [tabindex]')
  }
  return null
}

function isVisibleFocusTarget(element: HTMLElement): boolean {
  return element.isConnected
    && !element.matches(':disabled')
    && !element.closest('[inert]')
    && element.getClientRects().length > 0
    && getComputedStyle(element).visibility !== 'hidden'
}

function onOpenAutoFocus(event: Event): void {
  event.preventDefault()
}

function onCloseAutoFocus(event: Event): void {
  event.preventDefault()
}

function restoreOpenerFocus(): void {
  if (props.session.open) return
  if (actualOpener && isVisibleFocusTarget(actualOpener)) actualOpener.focus({ preventScroll: true })
  actualOpener = null
}

async function focusActivePane(): Promise<void> {
  await nextTick()
  if (props.session.screen === 'list') {
    await restoreListPosition()
    return
  }
  const target = props.session.screen === 'new'
    ? contentRoot.value?.querySelector<HTMLElement>('.field-definition-create-form')
    : contentRoot.value?.querySelector<HTMLElement>('.field-definition-editor, .field-definition-empty-detail')
  target?.focus({ preventScroll: true })
}

function updateViewportMetrics(): void {
  if (viewportFrame) cancelAnimationFrame(viewportFrame)
  viewportFrame = requestAnimationFrame(() => {
    visualViewportMetrics.value = {
      height: visualViewport?.height ?? window.innerHeight,
      offsetTop: visualViewport?.offsetTop ?? 0,
    }
    viewportFrame = 0
  })
}

function onCompactChange(event: MediaQueryListEvent): void {
  isCompact.value = event.matches
  if (event.matches) updateViewportMetrics()
}

watch(
  () => props.session.open,
  (openState, wasOpen) => {
    if (openState && !wasOpen) actualOpener = focusableElement(document.activeElement)
  },
  { flush: 'sync' },
)

watch(
  () => props.session.screen,
  async (screen, previousScreen) => {
    if (!props.session.open || screen === previousScreen) return
    await nextTick()
    if (screen === 'list') await restoreListPosition()
    else await focusActivePane()
  },
  { flush: 'post' },
)

watch(
  () => [props.session.review, props.session.pendingGuard] as const,
  async ([review, pendingGuard]) => {
    if (!props.session.open || (!review && !pendingGuard)) return
    await nextTick()
    contentRoot.value
      ?.querySelector<HTMLElement>('.field-definition-review, .field-definition-pending-guard')
      ?.focus({ preventScroll: true })
  },
  { flush: 'post' },
)

onMounted(() => {
  compactQuery = window.matchMedia('(max-width: 760px), (max-width: 1024px) and (max-height: 600px)')
  isCompact.value = compactQuery.matches
  compactQuery.addEventListener('change', onCompactChange)
  visualViewport = window.visualViewport
  updateViewportMetrics()
  visualViewport?.addEventListener('resize', updateViewportMetrics)
  visualViewport?.addEventListener('scroll', updateViewportMetrics)
  window.addEventListener('resize', updateViewportMetrics)
})

onUnmounted(() => {
  compactQuery?.removeEventListener('change', onCompactChange)
  visualViewport?.removeEventListener('resize', updateViewportMetrics)
  visualViewport?.removeEventListener('scroll', updateViewportMetrics)
  window.removeEventListener('resize', updateViewportMetrics)
  if (viewportFrame) cancelAnimationFrame(viewportFrame)
})

defineExpose({ open })
</script>

<style>
.field-definitions-modal {
  display: flex;
  width: min(68rem, calc(100vw - 2rem));
  max-width: none;
  height: min(44rem, calc(100dvh - 2rem));
  max-height: calc(100dvh - 2rem);
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 0.45rem;
  padding: 0;
  background: var(--panel-bg);
  color: var(--text-primary);
  box-shadow: 0 1.8rem 5rem rgb(0 0 0 / 0.55);
}

/* Nuxt UI owns desktop centering; this adapter only follows compact visual-viewport keyboard changes. */
.field-definitions-modal--compact {
  top: var(--field-viewport-top, 0px) !important;
  right: 0 !important;
  bottom: auto !important;
  left: 0 !important;
  width: 100vw !important;
  height: var(--field-viewport-height, 100dvh) !important;
  max-height: var(--field-viewport-height, 100dvh) !important;
  border: 0;
  border-radius: 0;
}

.field-definitions-content {
  display: flex;
  flex: 1 1 auto;
  width: 100%;
  height: 100%;
  min-height: 0;
  max-height: inherit;
  flex-direction: column;
  gap: 0.75rem;
  padding: clamp(0.85rem, 2vw, 1.25rem);
}

.field-definitions-header {
  display: flex;
  flex: 0 0 auto;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid var(--line-soft);
  padding-bottom: 0.75rem;
}

.field-definitions-title {
  min-width: 0;
}

.field-definitions-title h2 {
  margin: 0.35rem 0;
  font-family: Georgia, serif;
  font-size: clamp(1.25rem, 2.7vw, 1.75rem);
  font-weight: 500;
  line-height: 1.15;
}

.field-definitions-title p {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.75rem;
}

.field-definitions-workspace {
  display: grid;
  min-height: 0;
  flex: 1 1 auto;
  grid-template-columns: minmax(13rem, 0.72fr) minmax(0, 1.5fr);
  overflow: hidden;
  border: 1px solid var(--line-soft);
  background: var(--panel-raised);
}

.field-definition-list,
.field-definition-editor,
.field-definition-empty-detail,
.field-definition-create-form {
  min-width: 0;
  min-height: 0;
  max-height: 100%;
  overflow: auto;
  overscroll-behavior: contain;
}

.field-definition-empty-detail,
.field-definition-create-form {
  padding: 0.9rem;
}

.field-definition-empty-detail {
  color: var(--text-muted);
}

.field-definition-create-form {
  display: grid;
  align-content: start;
  gap: 0.85rem;
}

.field-definition-create-form h3 {
  margin: 0;
  font-family: Georgia, serif;
  font-size: 1.3rem;
  font-weight: 500;
}

.field-definition-review {
  grid-column: 1 / -1;
  grid-row: 1;
  min-height: 0;
  overflow: auto;
  border: 1px solid var(--error-border);
  padding: 0.75rem;
}

.field-definition-review h3,
.field-definition-review p {
  margin: 0.35rem 0;
}

.field-definition-pending-guard {
  grid-column: 1 / -1;
  grid-row: 1;
  min-height: 0;
  overflow: auto;
  border: 1px solid var(--line);
  padding: 0.75rem;
  background: var(--panel-bg);
}

.field-definition-pending-guard h3,
.field-definition-pending-guard p {
  margin: 0.35rem 0;
}

.field-definition-pending-guard p {
  color: var(--text-muted);
  font-size: 0.72rem;
}

.field-definition-review ul {
  display: grid;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.field-definition-review li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(3rem, auto) minmax(0, 1fr);
  gap: 0.5rem;
  border-top: 1px solid var(--line-soft);
  padding-top: 0.35rem;
  font-size: 0.7rem;
}

.field-definition-review li strong {
  overflow-wrap: anywhere;
  text-align: right;
}

.field-definitions-actions {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  border-top: 1px solid var(--line-soft);
  padding-top: 0.65rem;
  padding-bottom: max(0.1rem, env(safe-area-inset-bottom));
}

@media (max-width: 760px), (max-width: 1024px) and (max-height: 600px) {
  .field-definitions-content {
    gap: 0.55rem;
    padding: 0.75rem;
  }

  .field-definitions-header {
    gap: 0.5rem;
    padding-bottom: 0.55rem;
  }

  .field-definitions-title p {
    font-size: 0.7rem;
  }

  .field-definitions-title h2 {
    margin: 0.2rem 0;
    font-size: 1.25rem;
  }

  .field-definitions-title p {
    display: none;
  }

  .field-definitions-workspace {
    grid-template-columns: minmax(0, 1fr);
  }

  .field-definitions-actions {
    justify-content: stretch;
  }

  .field-definitions-actions > button {
    flex: 1 1 auto;
  }
}
</style>
