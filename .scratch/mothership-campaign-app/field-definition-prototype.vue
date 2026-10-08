<template>
  <div class="prototype-root" :class="`variant-${currentVariant.toLowerCase()}`">
    <header class="app-bar">
      <NuxtLink to="/" class="brand" aria-label="Return to the map editor">
        <span class="brand-mark" aria-hidden="true"><span /></span>
        <span class="brand-wordmark">
          <strong>MOTHERSHIP</strong>
          <small>CAMPAIGN CARTOGRAPHY</small>
        </span>
      </NuxtLink>

      <div class="workspace-context">
        <span class="workspace-kicker">JUMP CLUSTER / 03</span>
        <strong>Kestrel Reach</strong>
        <span class="context-divider" />
        <span class="active-system"><i /> Vesper system</span>
      </div>

      <span class="prototype-stamp"><i /> Reference prototype · sample data · no saves</span>
    </header>

    <main class="work-area">
      <section v-if="currentVariant !== 'A'" class="map-context" aria-label="Map editor preview">
        <div class="map-context-heading">
          <span class="workspace-kicker">STAR SYSTEM / ACTIVE CHART</span>
          <h2>Vesper</h2>
          <p>Four mapped objects <span /> Last charted 06.14.2187</p>
        </div>
        <div class="map-plot" aria-hidden="true">
          <div class="orbit orbit--outer" />
          <div class="orbit orbit--middle" />
          <div class="orbit orbit--inner" />
          <div class="plot-star"><span>✦</span></div>
          <div class="plot-object plot-object--one"><i /> <span>IRIA <small>PLANET</small></span></div>
          <div class="plot-object plot-object--two"><i /> <span>NIX <small>MOON</small></span></div>
          <div class="plot-object plot-object--three"><i /> <span>ASTERION RELAY <small>STATION</small></span></div>
        </div>
        <div class="map-context-footer">
          <span>LOCAL CHART / VE-01</span>
          <span><i /> FIELD DEFINITIONS OPEN</span>
        </div>
      </section>

      <div v-else class="page-context">
        <div class="breadcrumb">
          <NuxtLink to="/">Map editor</NuxtLink>
          <span>/</span>
          <span>Kestrel Reach</span>
          <span>/</span>
          <strong>Field definitions</strong>
        </div>
        <div class="page-context-note">
          <span>CAMPAIGN CONFIGURATION / SCHEMA REGISTER</span>
          <p>Reusable definitions for the objects charted across this Jump Cluster.</p>
        </div>
      </div>

      <button
        v-if="currentVariant === 'C'"
        class="modal-backdrop"
        type="button"
        tabindex="-1"
        aria-label="Close field definitions and return to the map editor"
        @click="backToMap"
      />

      <component
        :is="managerTag"
        ref="managerSurface"
        class="manager-shell"
        :class="`manager-shell--${currentVariant.toLowerCase()}`"
        :open="currentVariant === 'C' ? true : undefined"
        :role="currentVariant === 'C' ? 'dialog' : undefined"
        :aria-modal="currentVariant === 'C' ? 'true' : undefined"
        :aria-labelledby="currentVariant === 'C' ? 'manager-title' : undefined"
        :tabindex="currentVariant === 'C' ? -1 : undefined"
        @cancel.prevent="backToMap"
      >
        <header class="manager-header">
          <div class="manager-title-block">
            <span class="field-mark" aria-hidden="true">F<span>·</span></span>
            <div>
              <p class="eyebrow">REUSABLE OBJECT SCHEMA</p>
              <h1 id="manager-title">Field definitions</h1>
              <p class="manager-intro">Manage shared labels and choices here; individual values stay on their map objects.</p>
            </div>
          </div>
          <NuxtLink to="/" class="back-link">
            <span aria-hidden="true">←</span>
            <span>Back to map editor</span>
          </NuxtLink>
        </header>

        <div class="scope-strip">
          <span><i class="scope-dot" /> Workspace-wide</span>
          <span>Available across Jump Clusters</span>
          <span>Map objects only · Orbits excluded</span>
        </div>

        <div
          v-if="notice"
          class="manager-notice"
          :class="{ 'manager-notice--error': noticeIsError }"
          :role="noticeIsError ? 'alert' : 'status'"
          aria-live="polite"
        >
          <span aria-hidden="true">{{ noticeIsError ? '!' : '✓' }}</span>
          {{ notice }}
        </div>

        <div class="manager-toolbar">
          <div>
            <p class="eyebrow">DEFINITION REGISTER</p>
            <span>{{ fields.length }} definitions <i>·</i> {{ nativeFields.length }} native <i>·</i> {{ customFields.length }} custom</span>
          </div>
          <button class="add-button" type="button" @click="toggleCreateForm">
            <span aria-hidden="true">{{ showCreateForm ? '−' : '+' }}</span>
            {{ showCreateForm ? 'Cancel' : 'New definition' }}
          </button>
        </div>

        <form v-if="showCreateForm" class="create-form" @submit.prevent="addFieldDefinition">
          <div class="create-form-heading">
            <div>
              <p class="eyebrow">NEW CUSTOM FIELD</p>
              <h2>Add a reusable definition</h2>
            </div>
            <span>Starts with no object values</span>
          </div>
          <div class="create-form-grid">
            <label>
              Field name
              <input v-model="newFieldName" maxlength="48" placeholder="e.g. Signal source" required>
            </label>
            <label>
              Value type
              <select v-model="newFieldType">
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="boolean">Boolean</option>
                <option value="single-select">Single-select</option>
              </select>
            </label>
            <label v-if="newFieldType === 'single-select'" class="create-options">
              Allowed options <span>(one per line)</span>
              <textarea v-model="newFieldOptions" rows="3" placeholder="Unknown&#10;Confirmed" />
            </label>
          </div>
          <p v-if="creationError" class="form-error" role="alert">{{ creationError }}</p>
          <div class="create-form-actions">
            <p>Custom fields are reusable on planets, moons, and installations.</p>
            <button class="add-button" type="submit">Add definition <span aria-hidden="true">→</span></button>
          </div>
        </form>

        <div class="manager-body">
          <nav class="definition-directory" aria-label="Field definitions">
            <div class="field-group">
              <h2>Native <span>{{ nativeFields.length }}</span></h2>
              <button
                v-for="field in nativeFields"
                :key="field.id"
                type="button"
                class="definition-choice"
                :class="{ 'definition-choice--active': selectedFieldId === field.id }"
                :aria-pressed="selectedFieldId === field.id"
                @click="selectedFieldId = field.id; pendingRemovalId = null"
              >
                <span class="choice-mark choice-mark--native">N</span>
                <span class="choice-copy">
                  <strong>{{ field.name }}</strong>
                  <small>{{ fieldTypeLabel(field.type) }} <i>·</i> {{ field.assignments.length }} values</small>
                </span>
                <span class="choice-chevron" aria-hidden="true">›</span>
              </button>
            </div>
            <div class="field-group">
              <h2>Custom <span>{{ customFields.length }}</span></h2>
              <button
                v-for="field in customFields"
                :key="field.id"
                type="button"
                class="definition-choice"
                :class="{ 'definition-choice--active': selectedFieldId === field.id }"
                :aria-pressed="selectedFieldId === field.id"
                @click="selectedFieldId = field.id; pendingRemovalId = null"
              >
                <span class="choice-mark">C</span>
                <span class="choice-copy">
                  <strong>{{ field.name }}</strong>
                  <small>{{ fieldTypeLabel(field.type) }} <i>·</i> {{ field.assignments.length }} values</small>
                </span>
                <span class="choice-chevron" aria-hidden="true">›</span>
              </button>
              <p v-if="customFields.length === 0" class="empty-directory">No custom definitions yet.</p>
            </div>
          </nav>

          <section v-if="selectedField" class="definition-editor" aria-labelledby="definition-name-heading">
            <header class="selected-field-heading">
              <div class="selected-field-identity">
                <p class="eyebrow">{{ selectedField.kind === 'native' ? 'BUILT-IN FIELD' : 'CUSTOM DEFINITION' }}</p>
                <h2 id="definition-name-heading">{{ selectedField.name }}</h2>
                <div class="field-metadata">
                  <span class="type-badge" :class="`type-badge--${selectedField.type}`">{{ fieldTypeLabel(selectedField.type) }}</span>
                  <span>{{ selectedField.appliesTo }}</span>
                  <span>{{ selectedField.assignments.length }} current values</span>
                </div>
              </div>
              <button
                v-if="selectedField.kind === 'custom'"
                class="remove-button"
                type="button"
                @click="requestRemoval(selectedField.id)"
              >
                Remove definition
              </button>
              <span v-else class="native-lock"><i /> Native</span>
            </header>

            <form v-if="selectedField.kind === 'custom'" class="name-editor" @submit.prevent="saveDefinitionName">
              <label for="definition-name">Field name</label>
              <div class="name-editor-row">
                <input id="definition-name" v-model="nameDraft" maxlength="48">
                <button class="secondary-action" type="submit">Save name</button>
              </div>
              <p>Renaming preserves every value already stored on map objects.</p>
            </form>
            <p v-else class="native-explanation">
              This built-in definition cannot be removed. Edit its allowed values below; values in use are protected.
            </p>

            <section v-if="selectedField.type === 'single-select'" class="options-editor" aria-labelledby="allowed-options-heading">
              <div class="section-heading">
                <div>
                  <p class="eyebrow">CONSTRAINTS</p>
                  <h3 id="allowed-options-heading">Allowed options</h3>
                </div>
                <span class="count-chip">{{ selectedField.options.length }} options</span>
              </div>
              <ul class="option-usage" aria-label="Current option usage">
                <li v-for="option in selectedField.options" :key="option">
                  <span class="option-swatch" />
                  <strong>{{ option }}</strong>
                  <span>{{ optionUsageCount(selectedField, option) }} assigned</span>
                </li>
                <li v-if="selectedField.options.length === 0" class="option-list-empty">No options yet.</li>
              </ul>
              <label class="field-label" for="option-draft">Edit list <span>one option per line</span></label>
              <textarea id="option-draft" v-model="optionDraft" rows="4" spellcheck="false" />
              <div class="editor-actions">
                <p>Options assigned to objects cannot be removed until those values are changed.</p>
                <button class="secondary-action" type="button" @click="saveOptions">Save options</button>
              </div>
            </section>

            <section v-else class="type-explanation">
              <span class="type-mark" aria-hidden="true">{{ selectedField.type === 'boolean' ? '01' : selectedField.type === 'number' ? '#' : 'T' }}</span>
              <div>
                <p class="eyebrow">{{ fieldTypeLabel(selectedField.type) }} VALUE</p>
                <p>{{ fieldTypeDescription(selectedField.type) }}</p>
              </div>
            </section>

            <section class="value-preview" aria-labelledby="values-heading">
              <div class="section-heading">
                <div>
                  <p class="eyebrow">IMPACT PREVIEW / READ ONLY</p>
                  <h3 id="values-heading">Existing object values</h3>
                </div>
                <span class="count-chip">{{ selectedField.assignments.length }} stored</span>
              </div>
              <p class="value-preview-help">Definition changes do not edit object cards. These values are shown so their impact stays visible.</p>
              <div v-if="selectedField.assignments.length > 0" class="value-table-wrap">
                <table class="value-table">
                  <thead>
                    <tr><th>Map object</th><th>System</th><th>Stored value</th></tr>
                  </thead>
                  <tbody>
                    <tr v-for="assignment in selectedField.assignments" :key="`${assignment.objectName}-${assignment.systemName}`">
                      <td><strong>{{ assignment.objectName }}</strong><small>{{ assignment.objectType }}</small></td>
                      <td>{{ assignment.systemName }}</td>
                      <td><span class="stored-value">{{ formatValue(selectedField, assignment.value) }}</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-else class="no-values">
                <span aria-hidden="true">—</span>
                <p>No objects currently have a value for this definition.</p>
              </div>
            </section>

            <section
              v-if="pendingRemoval"
              class="removal-impact"
              role="group"
              aria-labelledby="removal-title"
            >
              <p class="eyebrow">CONFIRM DEFINITION REMOVAL</p>
              <h3 id="removal-title">Remove “{{ pendingRemoval.name }}”?</h3>
              <p v-if="pendingRemoval.assignments.length">
                This removes the reusable definition and clears {{ pendingRemoval.assignments.length }} stored value{{ pendingRemoval.assignments.length === 1 ? '' : 's' }} from these objects:
              </p>
              <p v-else>This definition has no stored object values to clear.</p>
              <ul v-if="pendingRemoval.assignments.length">
                <li v-for="assignment in pendingRemoval.assignments" :key="`${assignment.objectName}-${assignment.systemName}`">
                  <strong>{{ assignment.objectName }}</strong>
                  <span>{{ assignment.systemName }} · {{ formatValue(pendingRemoval, assignment.value) }}</span>
                </li>
              </ul>
              <p class="removal-prototype-note">This demo changes sample data in memory only. In a real workspace, these values would be deleted with the definition.</p>
              <div class="removal-actions">
                <button class="secondary-action" type="button" @click="cancelRemoval">Keep definition</button>
                <button class="remove-button remove-button--confirm" type="button" @click="confirmRemoval">
                  Remove and clear {{ pendingRemoval.assignments.length }} value{{ pendingRemoval.assignments.length === 1 ? '' : 's' }}
                </button>
              </div>
            </section>
          </section>
          <div v-else class="no-selection">
            <span class="field-mark" aria-hidden="true">F<span>·</span></span>
            <h2>Select a field definition</h2>
            <p>Choose a definition from the register to inspect its type, options, and current object values.</p>
          </div>
        </div>

        <aside class="recommendation">
          <div class="recommendation-heading">
            <p class="eyebrow">USER PREFERENCE</p>
            <strong>C <span>·</span> Quick dialog</strong>
          </div>
          <p>Keep shared-field management close to the map in a focused dialog. Show existing-value impacts and require explicit confirmation for destructive changes.</p>
        </aside>
      </component>
    </main>

    <nav class="variant-switcher" aria-label="Prototype layout variants">
      <button class="switch-arrow" type="button" aria-label="Previous layout variant" @click="stepVariant(-1)">←</button>
      <div class="switch-current">
        <span class="switch-index">{{ currentVariant }}</span>
        <span><small>LAYOUT STUDY</small><strong>{{ currentVariantLabel }}</strong></span>
      </div>
      <div class="switch-options" aria-label="Choose a layout">
        <button
          v-for="choice in variantChoices"
          :key="choice.key"
          type="button"
          :class="{ 'switch-option--active': currentVariant === choice.key }"
          :aria-pressed="currentVariant === choice.key"
          :aria-label="`Variant ${choice.key}: ${choice.label}`"
          @click="setVariant(choice.key)"
        >
          {{ choice.key }}
        </button>
      </div>
      <button class="switch-arrow" type="button" aria-label="Next layout variant" @click="stepVariant(1)">→</button>
      <span class="switch-hint">Use ← →</span>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

if (!import.meta.dev) {
  throw createError({ statusCode: 404, statusMessage: 'Not found' })
}

const variantChoices = [
  { key: 'A', label: 'Dedicated page' },
  { key: 'B', label: 'Side panel' },
  { key: 'C', label: 'Quick dialog' },
] as const

type VariantKey = (typeof variantChoices)[number]['key']
type FieldType = 'text' | 'number' | 'boolean' | 'single-select'
type FieldKind = 'native' | 'custom'

interface FieldAssignment {
  objectName: string
  objectType: string
  systemName: string
  value: string
}

interface FieldDefinition {
  id: string
  name: string
  kind: FieldKind
  type: FieldType
  appliesTo: string
  options: string[]
  assignments: FieldAssignment[]
}

const route = useRoute()
const router = useRouter()
const queryVariant = computed(() => {
  const value = route.query.variant
  return Array.isArray(value) ? value[0] : value
})
const currentVariant = computed<VariantKey>(
  () => variantChoices.find(choice => choice.key === queryVariant.value)?.key ?? 'C',
)
const currentVariantLabel = computed(
  () => variantChoices.find(choice => choice.key === currentVariant.value)?.label ?? 'Quick dialog',
)
const managerTag = computed(() => {
  if (currentVariant.value === 'B') return 'aside'
  if (currentVariant.value === 'C') return 'dialog'
  return 'section'
})

const fields = ref<FieldDefinition[]>([
  {
    id: 'native-atmosphere',
    name: 'Atmosphere',
    kind: 'native',
    type: 'single-select',
    appliesTo: 'Planets and moons',
    options: ['Breathable', 'Unbreathable', 'Vacuum'],
    assignments: [
      { objectName: 'Iria', objectType: 'Planet', systemName: 'Vesper', value: 'Unbreathable' },
      { objectName: 'Nix', objectType: 'Moon', systemName: 'Vesper', value: 'Vacuum' },
      { objectName: 'Dross', objectType: 'Planet', systemName: 'Vesper', value: 'Breathable' },
      { objectName: 'Bellwether', objectType: 'Moon', systemName: 'Harrow', value: 'Breathable' },
    ],
  },
  {
    id: 'native-port-class',
    name: 'Port class',
    kind: 'native',
    type: 'single-select',
    appliesTo: 'Installations',
    options: ['Class I', 'Class II', 'Class III'],
    assignments: [
      { objectName: 'Asterion Relay', objectType: 'Station', systemName: 'Vesper', value: 'Class II' },
      { objectName: 'Bellwether Colony', objectType: 'Colony', systemName: 'Harrow', value: 'Class III' },
    ],
  },
  {
    id: 'custom-survey-status',
    name: 'Survey status',
    kind: 'custom',
    type: 'single-select',
    appliesTo: 'All map objects',
    options: ['Unvisited', 'Surveyed', 'Restricted', 'Unknown'],
    assignments: [
      { objectName: 'Iria', objectType: 'Planet', systemName: 'Vesper', value: 'Unknown' },
      { objectName: 'Nix', objectType: 'Moon', systemName: 'Vesper', value: 'Unvisited' },
      { objectName: 'Asterion Relay', objectType: 'Station', systemName: 'Vesper', value: 'Surveyed' },
      { objectName: 'Bellwether Colony', objectType: 'Colony', systemName: 'Harrow', value: 'Unvisited' },
    ],
  },
  {
    id: 'custom-population',
    name: 'Local population',
    kind: 'custom',
    type: 'number',
    appliesTo: 'All map objects',
    options: [],
    assignments: [
      { objectName: 'Iria', objectType: 'Planet', systemName: 'Vesper', value: '1200000' },
      { objectName: 'Bellwether Colony', objectType: 'Colony', systemName: 'Harrow', value: '850000' },
    ],
  },
  {
    id: 'custom-contact-established',
    name: 'Contact established',
    kind: 'custom',
    type: 'boolean',
    appliesTo: 'All map objects',
    options: [],
    assignments: [
      { objectName: 'Asterion Relay', objectType: 'Station', systemName: 'Vesper', value: 'Yes' },
      { objectName: 'Bellwether Colony', objectType: 'Colony', systemName: 'Harrow', value: 'Yes' },
      { objectName: 'Glass Wake', objectType: 'Derelict', systemName: 'Harrow', value: 'No' },
    ],
  },
  {
    id: 'custom-field-notes',
    name: "Warden's field notes",
    kind: 'custom',
    type: 'text',
    appliesTo: 'All map objects',
    options: [],
    assignments: [
      { objectName: 'Iria', objectType: 'Planet', systemName: 'Vesper', value: 'Blue lightning above the north basin.' },
      { objectName: 'Glass Wake', objectType: 'Derelict', systemName: 'Harrow', value: 'Transponder repeats a crew manifest from 40 years ago.' },
      { objectName: 'Asterion Relay', objectType: 'Station', systemName: 'Vesper', value: 'Docking arms move when the station is unpowered.' },
    ],
  },
])

const selectedFieldId = ref('native-atmosphere')
const selectedField = computed(
  () => fields.value.find(field => field.id === selectedFieldId.value) ?? null,
)
const nativeFields = computed(() => fields.value.filter(field => field.kind === 'native'))
const customFields = computed(() => fields.value.filter(field => field.kind === 'custom'))

const managerSurface = ref<HTMLElement | null>(null)
const nameDraft = ref('')
const optionDraft = ref('')
const showCreateForm = ref(false)
const newFieldName = ref('')
const newFieldType = ref<FieldType>('text')
const newFieldOptions = ref('')
const creationError = ref('')
const pendingRemovalId = ref<string | null>(null)
const pendingRemoval = computed(
  () => fields.value.find(field => field.id === pendingRemovalId.value) ?? null,
)
const notice = ref('')
const noticeIsError = ref(false)

watch(selectedField, field => {
  nameDraft.value = field?.name ?? ''
  optionDraft.value = field?.options.join('\n') ?? ''
}, { immediate: true })

watch(currentVariant, () => {
  void focusDialog()
}, { flush: 'post' })

async function focusDialog(): Promise<void> {
  await nextTick()
  if (currentVariant.value === 'C') {
    managerSurface.value?.focus()
  }
}

function setVariant(key: VariantKey): void {
  void router.replace({ query: { ...route.query, variant: key } })
}

function stepVariant(direction: -1 | 1): void {
  const index = variantChoices.findIndex(choice => choice.key === currentVariant.value)
  const nextIndex = (index + direction + variantChoices.length) % variantChoices.length
  const next = variantChoices[nextIndex]
  if (next) setVariant(next.key)
}

function isEditingControl(target: EventTarget | null): boolean {
  return target instanceof HTMLElement
    && (target.isContentEditable || target.closest('input, textarea, select, [contenteditable="true"]') !== null)
}

function trapDialogTab(event: KeyboardEvent): void {
  const dialog = managerSurface.value
  if (!dialog) return

  const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  ))
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (!first || !last) {
    event.preventDefault()
    dialog.focus()
    return
  }

  if (document.activeElement === dialog) {
    event.preventDefault()
    ;(event.shiftKey ? last : first).focus()
  } else if (!dialog.contains(document.activeElement)) {
    event.preventDefault()
    ;(event.shiftKey ? last : first).focus()
  } else if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && currentVariant.value === 'C') {
    event.preventDefault()
    backToMap()
    return
  }

  if (event.key === 'Tab' && currentVariant.value === 'C') {
    trapDialogTab(event)
    return
  }

  if (isEditingControl(event.target)) return
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    stepVariant(-1)
  } else if (event.key === 'ArrowRight') {
    event.preventDefault()
    stepVariant(1)
  }
}

function backToMap(): void {
  void router.push('/')
}

function fieldTypeLabel(type: FieldType): string {
  if (type === 'single-select') return 'Single-select'
  if (type === 'boolean') return 'Boolean'
  return type === 'number' ? 'Number' : 'Text'
}

function fieldTypeDescription(type: FieldType): string {
  if (type === 'number') return 'A numeric value is stored on each object. Formatting here does not change the saved value.'
  if (type === 'boolean') return 'Each object stores a yes or no value. There is no separate option list to manage.'
  if (type === 'text') return 'Free-form text is stored on each object. Existing notes remain attached to their object.'
  return 'Each object stores one of the allowed options listed below.'
}

function optionUsageCount(field: FieldDefinition, option: string): number {
  return field.assignments.filter(assignment => assignment.value === option).length
}

function formatValue(field: FieldDefinition, value: string): string {
  if (field.type !== 'number') return value
  const number = Number(value)
  return Number.isFinite(number)
    ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(number)
    : value
}

function parseOptions(value: string): string[] {
  return value.split(/\r?\n/u).map(option => option.trim()).filter(Boolean)
}

function hasDuplicateOptions(options: string[]): boolean {
  const seen = new Set<string>()
  for (const option of options) {
    const normalized = option.toLowerCase()
    if (seen.has(normalized)) return true
    seen.add(normalized)
  }
  return false
}

function showNotice(message: string, isError = false): void {
  notice.value = message
  noticeIsError.value = isError
}

function saveDefinitionName(): void {
  const field = selectedField.value
  if (!field || field.kind !== 'custom') return

  const name = nameDraft.value.trim()
  if (!name) {
    showNotice('Enter a field name before saving.', true)
    return
  }
  if (fields.value.some(candidate => candidate.id !== field.id && candidate.name.toLowerCase() === name.toLowerCase())) {
    showNotice(`"${name}" is already in use. Choose a distinct field name.`, true)
    return
  }

  field.name = name
  nameDraft.value = name
  showNotice(`Renamed to "${name}". Its ${field.assignments.length} existing values stay with their objects.`)
}

function saveOptions(): void {
  const field = selectedField.value
  if (!field || field.type !== 'single-select') return

  const options = parseOptions(optionDraft.value)
  if (hasDuplicateOptions(options)) {
    showNotice('Each option must be unique, ignoring capitalization. No changes were saved.', true)
    return
  }

  const removedInUse = [...new Set(field.assignments
    .map(assignment => assignment.value)
    .filter(value => !options.includes(value)))]
  if (removedInUse.length > 0) {
    const affectedObjects = field.assignments
      .filter(assignment => removedInUse.includes(assignment.value))
      .map(assignment => `${assignment.objectName} (${assignment.systemName})`)
    showNotice(
      `Cannot remove ${removedInUse.map(value => `"${value}"`).join(', ')} while assigned to ${affectedObjects.join(', ')}. Update those object values first; no changes were saved.`,
      true,
    )
    return
  }

  field.options = options
  optionDraft.value = options.join('\n')
  showNotice(`Options saved. All ${field.assignments.length} existing object values remain intact.`)
}

function toggleCreateForm(): void {
  showCreateForm.value = !showCreateForm.value
  creationError.value = ''
}

function addFieldDefinition(): void {
  const name = newFieldName.value.trim()
  const options = newFieldType.value === 'single-select' ? parseOptions(newFieldOptions.value) : []
  if (!name) {
    creationError.value = 'Enter a field name.'
    return
  }
  if (fields.value.some(field => field.name.toLowerCase() === name.toLowerCase())) {
    creationError.value = `"${name}" is already in use.`
    return
  }
  if (newFieldType.value === 'single-select' && options.length === 0) {
    creationError.value = 'Add at least one option for a single-select field.'
    return
  }
  if (hasDuplicateOptions(options)) {
    creationError.value = 'Each option must be unique, ignoring capitalization.'
    return
  }

  const field: FieldDefinition = {
    id: `custom-${crypto.randomUUID()}`,
    name,
    kind: 'custom',
    type: newFieldType.value,
    appliesTo: 'All map objects',
    options,
    assignments: [],
  }
  fields.value.push(field)
  selectedFieldId.value = field.id
  newFieldName.value = ''
  newFieldType.value = 'text'
  newFieldOptions.value = ''
  showCreateForm.value = false
  creationError.value = ''
  showNotice(`"${name}" added as a reusable field. No existing object values were changed.`)
}

function requestRemoval(fieldId: string): void {
  const field = fields.value.find(candidate => candidate.id === fieldId)
  if (field?.kind === 'custom') pendingRemovalId.value = fieldId
}

function cancelRemoval(): void {
  pendingRemovalId.value = null
}

function confirmRemoval(): void {
  const field = pendingRemoval.value
  if (!field || field.kind !== 'custom') return

  const { name, assignments } = field
  fields.value = fields.value.filter(candidate => candidate.id !== field.id)
  pendingRemovalId.value = null
  if (selectedFieldId.value === field.id) {
    selectedFieldId.value = fields.value[0]?.id ?? ''
  }
  showNotice(
    `Removed "${name}". ${assignments.length} stored value${assignments.length === 1 ? '' : 's'} cleared from the sample objects; reload to restore the demo.`,
  )
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  void focusDialog()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.prototype-root {
  --prototype-panel: rgba(18, 28, 30, 0.97);
  --prototype-line: rgba(141, 164, 156, 0.2);
  --prototype-gold: #ddb374;
  min-height: 100vh;
  background: var(--app-bg);
  color: var(--text-primary);
}

.app-bar {
  position: relative;
  z-index: 20;
  display: grid;
  grid-template-columns: minmax(220px, 1fr) auto minmax(220px, 1fr);
  align-items: center;
  min-height: 4.35rem;
  padding: 0 1.5rem;
  border-bottom: 1px solid var(--line-soft);
  background: rgba(11, 17, 19, 0.96);
}

.brand {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  gap: 0.7rem;
  color: var(--text-primary);
  text-decoration: none;
}

.brand-mark {
  position: relative;
  display: grid;
  width: 2.1rem;
  height: 2.1rem;
  place-items: center;
  border: 1px solid var(--prototype-gold);
  border-radius: 50%;
}

.brand-mark::before,
.brand-mark::after {
  position: absolute;
  content: "";
  background: var(--prototype-gold);
}

.brand-mark::before {
  width: 1.3rem;
  height: 1px;
}

.brand-mark::after {
  width: 1px;
  height: 1.3rem;
}

.brand-mark span {
  z-index: 1;
  width: 0.42rem;
  height: 0.42rem;
  border: 1px solid var(--prototype-gold);
  border-radius: 50%;
  background: var(--app-bg);
}

.brand-wordmark,
.workspace-context,
.switch-current > span:last-child {
  display: grid;
}

.brand-wordmark strong {
  font-family: "Palatino Linotype", "Book Antiqua", Georgia, serif;
  font-size: 0.86rem;
  letter-spacing: 0.15em;
}

.brand-wordmark small,
.workspace-kicker,
.prototype-stamp,
.eyebrow,
.page-context-note > span,
.map-context-footer,
.switch-current small,
.switch-hint {
  color: var(--text-quiet);
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: 0.58rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.workspace-context {
  grid-template-columns: auto auto auto auto;
  align-items: center;
  gap: 0.7rem;
  color: var(--text-secondary);
  font-size: 0.77rem;
}

.workspace-context strong {
  color: var(--text-primary);
  font-weight: 600;
}

.context-divider {
  height: 1.4rem;
  border-left: 1px solid var(--line);
}

.active-system {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--text-secondary);
}

.active-system i,
.prototype-stamp i,
.map-context-footer i,
.scope-dot {
  display: inline-block;
  width: 0.42rem;
  height: 0.42rem;
  border-radius: 50%;
  background: var(--status-good);
  box-shadow: 0 0 0.65rem rgba(169, 200, 143, 0.35);
}

.prototype-stamp {
  justify-self: end;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: #d9b57e;
  letter-spacing: 0.08em;
}

.prototype-stamp i {
  width: 0.36rem;
  height: 0.36rem;
  background: var(--prototype-gold);
  box-shadow: none;
}

.work-area {
  position: relative;
  min-height: calc(100vh - 4.35rem);
  overflow: hidden;
}

.map-context {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background:
    radial-gradient(ellipse at 38% 54%, rgba(56, 88, 82, 0.14), transparent 37%),
    radial-gradient(ellipse at 72% 15%, rgba(153, 114, 68, 0.08), transparent 30%),
    var(--map-bg);
}

.map-context::before {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(105, 134, 125, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(105, 134, 125, 0.08) 1px, transparent 1px);
  background-size: 3.4rem 3.4rem;
  content: "";
  mask-image: linear-gradient(90deg, black, transparent 82%);
}

.map-context-heading {
  position: absolute;
  z-index: 1;
  top: 2rem;
  left: 2.5rem;
}

.map-context-heading h2 {
  margin: 0.3rem 0 0;
  color: var(--text-primary);
  font-family: "Palatino Linotype", "Book Antiqua", Georgia, serif;
  font-size: 1.6rem;
  font-weight: 400;
}

.map-context-heading p {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.45rem 0 0;
  color: var(--text-muted);
  font-size: 0.7rem;
}

.map-context-heading p span {
  width: 0.2rem;
  height: 0.2rem;
  border-radius: 50%;
  background: var(--prototype-gold);
}

.map-plot {
  position: absolute;
  top: 53%;
  left: 34%;
  width: min(70vw, 52rem);
  aspect-ratio: 1;
  transform: translate(-50%, -50%);
}

.orbit {
  position: absolute;
  top: 50%;
  left: 50%;
  border: 1px dashed rgba(134, 173, 150, 0.32);
  border-radius: 50%;
  transform: translate(-50%, -50%);
}

.orbit--outer {
  width: 100%;
  height: 60%;
  transform: translate(-50%, -50%) rotate(-18deg);
}

.orbit--middle {
  width: 72%;
  height: 44%;
  transform: translate(-50%, -50%) rotate(24deg);
}

.orbit--inner {
  width: 43%;
  height: 28%;
  border-color: rgba(221, 179, 116, 0.28);
  transform: translate(-50%, -50%) rotate(-35deg);
}

.plot-star {
  position: absolute;
  top: 50%;
  left: 50%;
  display: grid;
  width: 2.8rem;
  height: 2.8rem;
  place-items: center;
  border: 1px solid rgba(221, 179, 116, 0.45);
  border-radius: 50%;
  background: rgba(221, 179, 116, 0.09);
  box-shadow: 0 0 2.5rem rgba(221, 179, 116, 0.14);
  color: #eac68b;
  font-size: 1.3rem;
  transform: translate(-50%, -50%);
}

.plot-object {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.38rem 0.52rem;
  border: 1px solid rgba(123, 153, 142, 0.35);
  background: rgba(14, 25, 27, 0.86);
  color: var(--text-secondary);
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: 0.59rem;
  letter-spacing: 0.08em;
  white-space: nowrap;
}

.plot-object > i {
  width: 0.5rem;
  height: 0.5rem;
  border: 1px solid #92b7a1;
  border-radius: 50%;
  background: rgba(146, 183, 161, 0.24);
}

.plot-object small {
  display: block;
  margin-top: 0.22rem;
  color: var(--text-quiet);
  font-size: 0.48rem;
}

.plot-object--one {
  top: 22%;
  left: 56%;
}

.plot-object--two {
  top: 61%;
  left: 14%;
}

.plot-object--three {
  top: 75%;
  left: 63%;
}

.map-context-footer {
  position: absolute;
  right: 2.25rem;
  bottom: 1.75rem;
  left: 2.25rem;
  display: flex;
  justify-content: space-between;
  padding-top: 0.8rem;
  border-top: 1px solid rgba(123, 153, 142, 0.18);
  font-size: 0.54rem;
}

.map-context-footer span:last-child {
  display: inline-flex;
  align-items: center;
  gap: 0.42rem;
  color: var(--text-muted);
}

.map-context-footer i {
  width: 0.34rem;
  height: 0.34rem;
}

.page-context {
  width: min(72rem, calc(100% - 3rem));
  margin: 1.5rem auto 0;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  color: var(--text-quiet);
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: 0.59rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.breadcrumb a {
  color: var(--text-muted);
  text-decoration: none;
}

.breadcrumb a:hover {
  color: var(--accent-hover);
}

.breadcrumb strong {
  color: var(--prototype-gold);
  font-weight: 500;
}

.page-context-note {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--prototype-line);
}

.page-context-note p {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.72rem;
}

.manager-shell {
  color: var(--text-primary);
}

.manager-shell--a {
  position: relative;
  z-index: 2;
  width: min(72rem, calc(100% - 3rem));
  margin: 1.1rem auto 7.5rem;
  padding: 1.45rem 1.6rem 1.3rem;
  border: 1px solid var(--prototype-line);
  background:
    linear-gradient(135deg, rgba(32, 49, 48, 0.23), transparent 44%),
    var(--panel-bg);
  box-shadow: 0 1.2rem 3.6rem rgba(0, 0, 0, 0.28);
}

.manager-shell--b {
  position: absolute;
  z-index: 10;
  top: 1.25rem;
  right: 1.25rem;
  bottom: 5.6rem;
  display: block;
  width: min(31rem, calc(100% - 2.5rem));
  overflow-y: auto;
  padding: 1.1rem 1.1rem 1.5rem;
  border: 1px solid rgba(143, 166, 153, 0.32);
  background: var(--prototype-panel);
  box-shadow: 0 1.4rem 3.2rem rgba(0, 0, 0, 0.45);
  scrollbar-color: var(--line-strong) transparent;
  scrollbar-width: thin;
}

.manager-shell--c {
  position: fixed;
  z-index: 40;
  top: calc(50% + 2.175rem);
  left: 50%;
  display: block;
  width: min(58rem, calc(100vw - 2.5rem));
  max-height: calc(100vh - 7.1rem);
  margin: 0;
  overflow-y: auto;
  padding: 1.5rem 1.6rem 1.35rem;
  border: 1px solid rgba(221, 179, 116, 0.54);
  border-radius: 2px;
  background:
    linear-gradient(145deg, rgba(37, 55, 52, 0.28), transparent 38%),
    #111b1d;
  box-shadow: 0 1.8rem 5rem rgba(0, 0, 0, 0.62);
  color: var(--text-primary);
  transform: translate(-50%, -50%);
  scrollbar-color: var(--line-strong) transparent;
  scrollbar-width: thin;
}

.manager-shell--c::backdrop {
  background: transparent;
}

.modal-backdrop {
  position: fixed;
  z-index: 30;
  inset: 4.35rem 0 0;
  width: 100%;
  border: 0;
  background: rgba(3, 9, 10, 0.74);
  backdrop-filter: blur(3px);
  cursor: default;
}

.manager-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.manager-title-block {
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
}

.field-mark {
  display: grid;
  flex: 0 0 auto;
  width: 2.55rem;
  height: 2.55rem;
  place-items: center;
  border: 1px solid rgba(221, 179, 116, 0.52);
  color: var(--prototype-gold);
  font-family: "Palatino Linotype", "Book Antiqua", Georgia, serif;
  font-size: 1.25rem;
}

.field-mark span {
  margin-left: -0.22rem;
  color: var(--accent);
  font-size: 1.1rem;
}

.eyebrow {
  margin: 0;
  font-size: 0.54rem;
  letter-spacing: 0.15em;
}

.manager-header h1 {
  margin: 0.14rem 0 0;
  color: var(--text-primary);
  font-family: "Palatino Linotype", "Book Antiqua", Georgia, serif;
  font-size: clamp(1.55rem, 2.4vw, 2rem);
  font-weight: 400;
  letter-spacing: -0.025em;
  line-height: 1.05;
}

.manager-intro {
  max-width: 36rem;
  margin: 0.5rem 0 0;
  color: var(--text-muted);
  font-size: 0.72rem;
  line-height: 1.45;
}

.back-link {
  display: inline-flex;
  min-height: 2rem;
  align-items: center;
  gap: 0.4rem;
  flex: 0 0 auto;
  color: var(--text-secondary);
  font-size: 0.63rem;
  text-decoration: none;
}

.back-link span:first-child {
  color: var(--prototype-gold);
  font-size: 0.95rem;
}

.back-link:hover {
  color: var(--accent-hover);
}

.scope-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem 1.15rem;
  margin: 1.15rem 0 1.05rem;
  padding: 0.55rem 0.68rem;
  border-top: 1px solid var(--prototype-line);
  border-bottom: 1px solid var(--prototype-line);
  color: var(--text-muted);
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: 0.55rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.scope-strip span {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.scope-dot {
  width: 0.34rem;
  height: 0.34rem;
  background: var(--prototype-gold);
  box-shadow: none;
}

.manager-notice {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  margin: 0 0 0.85rem;
  padding: 0.55rem 0.7rem;
  border: 1px solid rgba(169, 200, 143, 0.35);
  background: rgba(87, 115, 75, 0.13);
  color: #d3e0c6;
  font-size: 0.68rem;
  line-height: 1.45;
}

.manager-notice > span {
  color: var(--status-good);
  font-weight: 700;
}

.manager-notice--error {
  border-color: var(--error-border);
  background: var(--error-bg);
  color: #ffcec7;
}

.manager-notice--error > span {
  color: var(--error);
}

.manager-toolbar,
.create-form-heading,
.create-form-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.manager-toolbar {
  margin-bottom: 0.65rem;
}

.manager-toolbar > div > span {
  display: block;
  margin-top: 0.25rem;
  color: var(--text-muted);
  font-size: 0.63rem;
}

.manager-toolbar > div > span i {
  padding: 0 0.16rem;
  color: var(--line-strong);
  font-style: normal;
}

.add-button,
.secondary-action,
.remove-button {
  display: inline-flex;
  min-height: 2.25rem;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.42rem 0.68rem;
  border: 1px solid var(--line-strong);
  border-radius: 2px;
  background: var(--control-bg);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.045em;
}

.add-button {
  border-color: rgba(221, 179, 116, 0.62);
  background: rgba(221, 179, 116, 0.12);
  color: #f1d6aa;
}

.add-button > span {
  color: var(--prototype-gold);
  font-size: 1rem;
}

.add-button:hover,
.secondary-action:hover {
  background: var(--control-hover);
}

.add-button:hover {
  border-color: var(--prototype-gold);
  background: rgba(221, 179, 116, 0.2);
}

.secondary-action:hover {
  border-color: var(--prototype-gold);
  color: #f1d6aa;
}

.remove-button {
  min-height: 1.95rem;
  border-color: rgba(198, 111, 99, 0.5);
  background: rgba(142, 58, 52, 0.12);
  color: #ffc2b9;
  font-size: 0.59rem;
}

.remove-button:hover {
  border-color: var(--error);
  background: rgba(142, 58, 52, 0.26);
}

.create-form {
  margin: 0 0 0.9rem;
  padding: 0.9rem;
  border: 1px solid rgba(221, 179, 116, 0.32);
  background: rgba(221, 179, 116, 0.045);
}

.create-form-heading {
  align-items: flex-start;
  margin-bottom: 0.8rem;
}

.create-form-heading h2 {
  margin: 0.2rem 0 0;
  font-family: "Palatino Linotype", "Book Antiqua", Georgia, serif;
  font-size: 1.1rem;
  font-weight: 400;
}

.create-form-heading > span {
  color: var(--text-quiet);
  font-size: 0.6rem;
}

.create-form-grid {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 0.7rem;
}

.create-form label,
.name-editor label,
.field-label {
  color: var(--text-secondary);
  font-size: 0.63rem;
  font-weight: 700;
  letter-spacing: 0.025em;
}

.create-form input,
.create-form select,
.create-form textarea,
.name-editor input,
.options-editor textarea {
  min-height: 2.3rem;
  margin-top: 0.3rem;
  font-size: 0.7rem;
}

.create-form textarea,
.options-editor textarea {
  min-height: 4.8rem;
  line-height: 1.45;
}

.create-options {
  grid-column: 1 / -1;
}

.create-options > span,
.field-label > span {
  color: var(--text-quiet);
  font-weight: 400;
}

.form-error {
  margin: 0.55rem 0 0;
  color: var(--error);
  font-size: 0.65rem;
}

.create-form-actions {
  margin-top: 0.7rem;
}

.create-form-actions p {
  margin: 0;
  color: var(--text-quiet);
  font-size: 0.6rem;
}

.manager-body {
  display: grid;
  grid-template-columns: minmax(12.5rem, 0.78fr) minmax(0, 1.75fr);
  align-items: start;
  gap: 0.85rem;
}

.definition-directory,
.definition-editor {
  min-width: 0;
  border: 1px solid var(--prototype-line);
  background: rgba(6, 13, 14, 0.31);
}

.definition-directory {
  padding: 0.65rem;
}

.field-group + .field-group {
  margin-top: 0.9rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--prototype-line);
}

.field-group h2 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 0 0.45rem;
  color: var(--text-quiet);
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: 0.53rem;
  font-weight: 500;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

.field-group h2 span {
  color: var(--prototype-gold);
}

.definition-choice {
  display: flex;
  width: 100%;
  min-height: 3.15rem;
  align-items: center;
  gap: 0.58rem;
  padding: 0.48rem 0.4rem;
  border: 1px solid transparent;
  border-radius: 1px;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
}

.definition-choice:hover {
  background: rgba(143, 166, 153, 0.07);
}

.definition-choice--active {
  border-color: rgba(221, 179, 116, 0.4);
  background: rgba(221, 179, 116, 0.09);
}

.choice-mark {
  display: grid;
  flex: 0 0 auto;
  width: 1.5rem;
  height: 1.5rem;
  place-items: center;
  border: 1px solid rgba(143, 166, 153, 0.32);
  color: var(--text-muted);
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: 0.58rem;
}

.choice-mark--native {
  border-color: rgba(221, 179, 116, 0.4);
  color: var(--prototype-gold);
}

.choice-copy {
  display: grid;
  min-width: 0;
  gap: 0.18rem;
}

.choice-copy strong {
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 0.67rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.definition-choice--active .choice-copy strong {
  color: var(--text-primary);
}

.choice-copy small {
  overflow: hidden;
  color: var(--text-quiet);
  font-size: 0.56rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.choice-copy small i {
  padding: 0 0.12rem;
  font-style: normal;
}

.choice-chevron {
  margin-left: auto;
  color: var(--text-quiet);
  font-size: 1rem;
}

.empty-directory {
  margin: 0.45rem 0.15rem;
  color: var(--text-quiet);
  font-size: 0.62rem;
}

.definition-editor {
  padding: 0.9rem;
}

.selected-field-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.8rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--prototype-line);
}

.selected-field-identity h2 {
  margin: 0.2rem 0 0.45rem;
  color: var(--text-primary);
  font-family: "Palatino Linotype", "Book Antiqua", Georgia, serif;
  font-size: 1.35rem;
  font-weight: 400;
  line-height: 1.15;
}

.field-metadata {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.55rem;
  color: var(--text-muted);
  font-size: 0.59rem;
}

.field-metadata > span + span::before {
  padding-right: 0.5rem;
  color: var(--line-strong);
  content: "·";
}

.type-badge,
.count-chip {
  display: inline-flex;
  min-height: 1.3rem;
  align-items: center;
  padding: 0.15rem 0.38rem;
  border: 1px solid rgba(143, 166, 153, 0.3);
  color: #c7d6cb;
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: 0.5rem;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.type-badge--single-select {
  border-color: rgba(221, 179, 116, 0.35);
  color: #e6c48f;
}

.type-badge--number {
  border-color: rgba(129, 177, 154, 0.35);
  color: #b4d2c1;
}

.type-badge--boolean {
  border-color: rgba(143, 164, 194, 0.35);
  color: #c4d0e1;
}

.remove-button {
  flex: 0 0 auto;
}

.native-lock {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.28rem 0.45rem;
  border: 1px solid var(--prototype-line);
  color: var(--text-quiet);
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: 0.52rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.native-lock i {
  width: 0.35rem;
  height: 0.35rem;
  border-radius: 50%;
  background: var(--prototype-gold);
}

.name-editor {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.32rem;
  margin: 0.75rem 0;
}

.name-editor-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.45rem;
}

.name-editor p,
.native-explanation {
  margin: 0;
  color: var(--text-quiet);
  font-size: 0.59rem;
  line-height: 1.4;
}

.native-explanation {
  margin: 0.7rem 0;
}

.options-editor,
.type-explanation {
  margin-top: 0.75rem;
  padding: 0.75rem;
  border: 1px solid var(--prototype-line);
  background: rgba(25, 38, 41, 0.44);
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.section-heading h3 {
  margin: 0.18rem 0 0;
  color: var(--text-secondary);
  font-size: 0.73rem;
  font-weight: 600;
}

.count-chip {
  border-color: var(--prototype-line);
  color: var(--text-muted);
  white-space: nowrap;
}

.option-usage {
  display: flex;
  flex-wrap: wrap;
  gap: 0.32rem;
  margin: 0.65rem 0;
  padding: 0;
  list-style: none;
}

.option-usage li {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.23rem 0.38rem;
  border: 1px solid rgba(143, 166, 153, 0.22);
  background: rgba(8, 15, 16, 0.45);
  color: var(--text-secondary);
  font-size: 0.56rem;
}

.option-usage li > span:last-child {
  color: var(--text-quiet);
  font-size: 0.5rem;
}

.option-usage .option-list-empty {
  color: var(--text-quiet);
  font-size: 0.59rem;
}

.option-swatch {
  width: 0.35rem;
  height: 0.35rem;
  border: 1px solid var(--prototype-gold);
  border-radius: 50%;
}

.field-label {
  display: block;
  margin-top: 0.55rem;
}

.editor-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.7rem;
  margin-top: 0.35rem;
}

.editor-actions p {
  max-width: 25rem;
  margin: 0;
  color: var(--text-quiet);
  font-size: 0.57rem;
  line-height: 1.4;
}

.type-explanation {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}

.type-mark {
  display: grid;
  flex: 0 0 auto;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border: 1px solid var(--prototype-line);
  color: var(--prototype-gold);
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: 0.68rem;
}

.type-explanation > div > p:last-child {
  margin: 0.25rem 0 0;
  color: var(--text-muted);
  font-size: 0.62rem;
  line-height: 1.45;
}

.value-preview {
  margin-top: 0.8rem;
}

.value-preview-help {
  margin: 0.38rem 0 0.48rem;
  color: var(--text-quiet);
  font-size: 0.57rem;
  line-height: 1.4;
}

.value-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--prototype-line);
}

.value-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.value-table th {
  padding: 0.4rem 0.5rem;
  border-bottom: 1px solid var(--prototype-line);
  background: rgba(24, 37, 39, 0.7);
  color: var(--text-quiet);
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: 0.49rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.value-table td {
  padding: 0.4rem 0.5rem;
  border-bottom: 1px solid rgba(141, 164, 156, 0.1);
  color: var(--text-muted);
  font-size: 0.6rem;
  vertical-align: top;
}

.value-table tr:last-child td {
  border-bottom: 0;
}

.value-table td:first-child {
  min-width: 8.5rem;
}

.value-table td:first-child strong,
.value-table td:first-child small {
  display: block;
}

.value-table td:first-child strong {
  color: var(--text-secondary);
  font-size: 0.61rem;
  font-weight: 600;
}

.value-table td:first-child small {
  margin-top: 0.12rem;
  color: var(--text-quiet);
  font-size: 0.52rem;
}

.stored-value {
  display: inline-block;
  max-width: 19rem;
  overflow-wrap: anywhere;
  color: #e2c696;
}

.no-values,
.no-selection {
  display: grid;
  justify-items: center;
  padding: 1rem;
  border: 1px dashed var(--prototype-line);
  color: var(--text-muted);
  text-align: center;
}

.no-values > span {
  color: var(--prototype-gold);
}

.no-values p,
.no-selection p {
  margin: 0.25rem 0 0;
  font-size: 0.61rem;
}

.no-selection {
  align-self: stretch;
  align-content: center;
  min-height: 16rem;
  padding: 1.5rem;
}

.no-selection h2 {
  margin: 0.85rem 0 0;
  font-family: "Palatino Linotype", "Book Antiqua", Georgia, serif;
  font-size: 1.2rem;
  font-weight: 400;
}

.no-selection p {
  max-width: 22rem;
  line-height: 1.5;
}

.removal-impact {
  margin-top: 0.8rem;
  padding: 0.8rem;
  border: 1px solid rgba(198, 111, 99, 0.52);
  background: rgba(104, 42, 38, 0.17);
}

.removal-impact > .eyebrow {
  color: #eaa398;
}

.removal-impact h3 {
  margin: 0.3rem 0;
  color: #ffd1c8;
  font-family: "Palatino Linotype", "Book Antiqua", Georgia, serif;
  font-size: 1.05rem;
  font-weight: 400;
}

.removal-impact > p:not(.eyebrow) {
  margin: 0.3rem 0;
  color: var(--text-secondary);
  font-size: 0.62rem;
  line-height: 1.45;
}

.removal-impact ul {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  gap: 0.25rem 0.7rem;
  margin: 0.55rem 0;
  padding: 0;
  list-style: none;
}

.removal-impact li {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  color: var(--text-secondary);
  font-size: 0.58rem;
}

.removal-impact li span {
  color: #e9bcb3;
  text-align: right;
}

.removal-impact .removal-prototype-note {
  color: #e1aaa1 !important;
  font-size: 0.57rem !important;
}

.removal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.45rem;
  margin-top: 0.65rem;
}

.remove-button--confirm {
  border-color: #a65d5d;
  background: #572d2b;
  color: #ffe0da;
}

.recommendation {
  display: grid;
  grid-template-columns: minmax(9.5rem, 0.72fr) minmax(0, 1.75fr);
  gap: 0.8rem;
  margin-top: 0.8rem;
  padding: 0.62rem 0.72rem;
  border-left: 2px solid var(--prototype-gold);
  background: rgba(221, 179, 116, 0.055);
}

.recommendation-heading strong {
  display: block;
  margin-top: 0.24rem;
  color: #ecd0a3;
  font-family: "Palatino Linotype", "Book Antiqua", Georgia, serif;
  font-size: 0.9rem;
  font-weight: 400;
}

.recommendation-heading strong span {
  color: var(--prototype-gold);
}

.recommendation > p {
  align-self: center;
  margin: 0;
  color: var(--text-muted);
  font-size: 0.59rem;
  line-height: 1.45;
}

.variant-switcher {
  position: fixed;
  z-index: 100;
  bottom: 0.85rem;
  left: 50%;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  width: max-content;
  max-width: calc(100vw - 1.25rem);
  padding: 0.42rem 0.5rem;
  border: 1px solid rgba(221, 179, 116, 0.42);
  background: rgba(10, 17, 18, 0.96);
  box-shadow: 0 0.5rem 2rem rgba(0, 0, 0, 0.55);
  transform: translateX(-50%);
  backdrop-filter: blur(12px);
}

.switch-arrow,
.switch-options button {
  display: grid;
  flex: 0 0 auto;
  width: 1.75rem;
  height: 1.75rem;
  place-items: center;
  border: 1px solid var(--prototype-line);
  border-radius: 1px;
  background: rgba(25, 38, 41, 0.65);
  color: var(--text-secondary);
  cursor: pointer;
}

.switch-arrow {
  color: var(--prototype-gold);
  font-size: 0.9rem;
}

.switch-arrow:hover,
.switch-options button:hover {
  border-color: var(--prototype-gold);
  background: rgba(221, 179, 116, 0.12);
}

.switch-current {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  min-width: 9rem;
  padding: 0 0.35rem;
}

.switch-index {
  display: grid;
  width: 1.7rem;
  height: 1.7rem;
  place-items: center;
  border: 1px solid rgba(221, 179, 116, 0.52);
  color: #efd3a4;
  font-family: "Palatino Linotype", "Book Antiqua", Georgia, serif;
  font-size: 0.9rem;
}

.switch-current small {
  font-size: 0.45rem;
  letter-spacing: 0.12em;
}

.switch-current strong {
  margin-top: 0.08rem;
  color: var(--text-primary);
  font-size: 0.66rem;
  font-weight: 600;
  white-space: nowrap;
}

.switch-options {
  display: flex;
  gap: 0.22rem;
  padding-left: 0.4rem;
  border-left: 1px solid var(--prototype-line);
}

.switch-options button {
  width: 1.55rem;
  height: 1.55rem;
  color: var(--text-muted);
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: 0.57rem;
}

.switch-options .switch-option--active {
  border-color: var(--prototype-gold);
  background: rgba(221, 179, 116, 0.18);
  color: #f1d6aa;
}

.switch-hint {
  padding: 0 0.25rem;
  font-size: 0.47rem;
  letter-spacing: 0.07em;
  white-space: nowrap;
}

.manager-shell--b .manager-header {
  align-items: center;
}

.manager-shell--b .manager-title-block {
  gap: 0.6rem;
}

.manager-shell--b .field-mark {
  width: 2rem;
  height: 2rem;
  font-size: 1rem;
}

.manager-shell--b .manager-header h1 {
  font-size: 1.45rem;
}

.manager-shell--b .manager-intro {
  max-width: 18rem;
  font-size: 0.64rem;
}

.manager-shell--b .back-link span:last-child {
  display: none;
}

.manager-shell--b .scope-strip {
  gap: 0.4rem 0.7rem;
  font-size: 0.49rem;
}

.manager-shell--b .manager-body {
  grid-template-columns: minmax(0, 1fr);
  gap: 0.6rem;
}

.manager-shell--b .definition-directory {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.4rem 0.6rem;
  padding: 0.5rem;
}

.manager-shell--b .field-group {
  min-width: 0;
}

.manager-shell--b .field-group + .field-group {
  margin-top: 0;
  padding-top: 0;
  border-top: 0;
}

.manager-shell--b .field-group h2 {
  margin-bottom: 0.3rem;
}

.manager-shell--b .definition-choice {
  min-height: 2.6rem;
  gap: 0.4rem;
  padding: 0.35rem 0.2rem;
}

.manager-shell--b .choice-mark {
  width: 1.2rem;
  height: 1.2rem;
}

.manager-shell--b .choice-copy strong {
  font-size: 0.61rem;
}

.manager-shell--b .choice-copy small {
  font-size: 0.51rem;
}

.manager-shell--b .definition-editor {
  padding: 0.7rem;
}

.manager-shell--b .recommendation {
  grid-template-columns: 1fr;
  gap: 0.35rem;
}

@media (max-width: 900px) {
  .app-bar {
    grid-template-columns: 1fr auto;
  }

  .workspace-context {
    display: none;
  }

  .manager-body {
    grid-template-columns: minmax(10rem, 0.72fr) minmax(0, 1.6fr);
  }

  .manager-shell--c .manager-body {
    grid-template-columns: minmax(10rem, 0.72fr) minmax(0, 1.6fr);
  }
}

@media (max-width: 700px) {
  .app-bar {
    min-height: 3.8rem;
    padding: 0 0.8rem;
  }

  .brand-mark {
    width: 1.8rem;
    height: 1.8rem;
  }

  .brand-wordmark strong {
    font-size: 0.75rem;
  }

  .brand-wordmark small {
    font-size: 0.48rem;
  }

  .prototype-stamp {
    font-size: 0.48rem;
  }

  .work-area {
    min-height: calc(100vh - 3.8rem);
  }

  .page-context {
    width: calc(100% - 1.25rem);
    margin-top: 0.8rem;
  }

  .page-context-note {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.3rem;
    margin-top: 0.7rem;
  }

  .page-context-note p {
    font-size: 0.65rem;
  }

  .manager-shell--a {
    width: calc(100% - 1.25rem);
    margin: 0.7rem auto 6.3rem;
    padding: 0.85rem;
  }

  .manager-shell--b {
    top: 0.55rem;
    right: 0.45rem;
    bottom: 5rem;
    width: calc(100% - 0.9rem);
    padding: 0.75rem;
  }

  .manager-shell--c {
    top: calc(50% + 1.9rem);
    width: calc(100vw - 1rem);
    max-height: calc(100vh - 6.1rem);
    padding: 0.8rem;
  }

  .modal-backdrop {
    inset: 3.8rem 0 0;
  }

  .manager-header {
    gap: 0.4rem;
  }

  .manager-title-block {
    gap: 0.55rem;
  }

  .field-mark {
    width: 2rem;
    height: 2rem;
  }

  .manager-header h1 {
    font-size: 1.45rem;
  }

  .manager-intro {
    max-width: 17rem;
    font-size: 0.63rem;
  }

  .back-link {
    font-size: 0;
  }

  .back-link span:first-child {
    font-size: 1rem;
  }

  .scope-strip {
    gap: 0.35rem 0.65rem;
    margin: 0.8rem 0;
    padding: 0.45rem;
    font-size: 0.47rem;
  }

  .manager-body,
  .manager-shell--c .manager-body {
    grid-template-columns: minmax(0, 1fr);
  }

  .definition-directory {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.4rem;
    padding: 0.45rem;
  }

  .field-group + .field-group {
    margin-top: 0;
    padding-top: 0;
    border-top: 0;
  }

  .field-group h2 {
    margin-bottom: 0.2rem;
    font-size: 0.47rem;
  }

  .definition-choice {
    min-height: 2.5rem;
    gap: 0.28rem;
    padding: 0.28rem 0.15rem;
  }

  .choice-mark {
    width: 1.1rem;
    height: 1.1rem;
    font-size: 0.5rem;
  }

  .choice-copy strong {
    font-size: 0.58rem;
  }

  .choice-copy small {
    font-size: 0.48rem;
  }

  .choice-chevron {
    display: none;
  }

  .definition-editor {
    padding: 0.65rem;
  }

  .selected-field-heading {
    gap: 0.35rem;
  }

  .selected-field-identity h2 {
    font-size: 1.15rem;
  }

  .remove-button {
    font-size: 0.52rem;
  }

  .native-lock {
    padding: 0.2rem;
    font-size: 0.44rem;
  }

  .create-form-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .create-options {
    grid-column: auto;
  }

  .create-form-heading > span {
    max-width: 7rem;
    text-align: right;
  }

  .create-form-actions {
    align-items: flex-start;
    flex-direction: column;
  }

  .value-table th,
  .value-table td {
    padding: 0.35rem;
  }

  .value-table th {
    font-size: 0.44rem;
  }

  .value-table td {
    font-size: 0.55rem;
  }

  .recommendation {
    grid-template-columns: 1fr;
    gap: 0.35rem;
  }

  .map-context-heading {
    top: 1rem;
    left: 1rem;
  }

  .map-plot {
    top: 39%;
    left: 30%;
    width: 96vw;
  }

  .map-context-footer {
    right: 0.8rem;
    bottom: 1.1rem;
    left: 0.8rem;
  }

  .variant-switcher {
    bottom: 0.45rem;
    gap: 0.25rem;
    padding: 0.32rem;
  }

  .switch-current {
    min-width: 7rem;
    gap: 0.3rem;
    padding: 0 0.15rem;
  }

  .switch-current strong {
    font-size: 0.58rem;
  }

  .switch-options {
    gap: 0.12rem;
    padding-left: 0.25rem;
  }

  .switch-options button {
    width: 1.35rem;
    height: 1.45rem;
  }

  .switch-arrow {
    width: 1.45rem;
    height: 1.45rem;
  }

  .switch-hint {
    display: none;
  }
}

@media (prefers-reduced-motion: no-preference) {
  .manager-shell--a,
  .manager-shell--b,
  .manager-shell--c {
    animation: field-manager-arrive 180ms ease-out both;
  }

  @keyframes field-manager-arrive {
    from {
      opacity: 0.88;
      translate: 0 0.35rem;
    }
    to {
      opacity: 1;
      translate: 0 0;
    }
  }
}
</style>
