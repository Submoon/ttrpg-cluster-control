<template>
  <section class="b-inspector-card" :aria-label="`${title} inspector`">
    <header class="b-inspector-header">
      <div class="b-inspector-heading-copy">
        <p class="proto-eyebrow">{{ eyebrow }}</p>
        <h2>{{ title }}</h2>
        <p class="b-inspector-subtitle">{{ subtitle }}</p>
      </div>
      <UButton size="sm" color="neutral" variant="ghost" aria-label="Hide inspector" @click="emit('hide')">
        Hide
      </UButton>
    </header>

    <div class="b-inspector-body">
      <div v-if="validationError || errorCount" id="b-inspector-validation-summary" class="b-inspector-feedback b-inspector-feedback--error" role="alert" aria-live="assertive" tabindex="-1">
        <strong>{{ errorCount ? `${errorCount} form ${errorCount === 1 ? 'issue' : 'issues'}` : 'Could not apply these changes' }}</strong>
        <p v-if="validationError">{{ validationError }}</p>
        <p v-else>Review the marked fields before applying.</p>
        <ul v-if="errorEntries.length">
          <li v-for="[key, message] in errorEntries" :key="key">
            <a :href="`#${controlId(key)}`" @click.prevent="focusControl(key)">{{ message }}</a>
          </li>
        </ul>
      </div>

      <section v-if="!editable" class="b-inspector-feedback" aria-label="Read-only inspector">
        <strong>Read-only in this prototype</strong>
        <p>{{ readOnlyReason }}</p>
      </section>

      <template v-if="kind === 'object' && object">
        <section class="b-inspector-section" aria-labelledby="b-object-details-heading">
          <div class="b-inspector-section-heading">
            <div>
              <p class="proto-eyebrow">{{ objectFamilyLabel }}</p>
              <h3 id="b-object-details-heading">Object details</h3>
              <span class="b-inspector-type-chip">{{ objectSubtypeLabel }}</span>
            </div>
            <UBadge color="neutral" variant="subtle">Built-in</UBadge>
          </div>
          <fieldset class="b-inspector-fields" :disabled="!editable">
            <UFormField label="Name" :error="fieldErrors.name || undefined">
              <UInput :id="controlId('name')" v-model="name" class="b-inspector-full" size="lg" maxlength="80" autocomplete="off" />
              <template v-if="fieldErrors.name" #error="{ error }">
                <p class="b-inspector-inline-error">{{ error }}</p>
              </template>
            </UFormField>
            <UFormField label="Description" :error="fieldErrors.description || undefined">
              <UTextarea :id="controlId('description')" v-model="description" class="b-inspector-full" :rows="3" autoresize />
              <template v-if="fieldErrors.description" #error="{ error }">
                <p class="b-inspector-inline-error">{{ error }}</p>
              </template>
            </UFormField>
          </fieldset>
        </section>

        <section v-if="hasNativeFields" class="b-inspector-section" aria-labelledby="b-native-fields-heading">
          <div class="b-inspector-section-heading">
            <div>
              <p class="proto-eyebrow">NATIVE VALUES</p>
              <h3 id="b-native-fields-heading">Catalogue fields</h3>
            </div>
            <UBadge color="neutral" variant="subtle">Built-in</UBadge>
          </div>
          <fieldset class="b-inspector-fields b-inspector-fields--paired" :disabled="!editable">
            <UFormField v-if="hasAtmosphere" label="Atmosphere" :error="fieldErrors['native:atmosphere'] || undefined">
              <USelect
                :id="controlId('native:atmosphere')"
                :model-value="nativeValues.atmosphere === '' ? unsetFieldValue : nativeValues.atmosphere"
                :items="[{ label: 'Not recorded', value: unsetFieldValue }, ...atmosphereOptions.map(option => ({ label: option, value: option }))]"
                @update:model-value="value => nativeValues.atmosphere = value === unsetFieldValue ? '' : String(value)"
              />
              <template v-if="fieldErrors['native:atmosphere']" #error="{ error }">
                <p class="b-inspector-inline-error">{{ error }}</p>
              </template>
            </UFormField>
            <UFormField v-if="object.family === 'Installation'" label="Port class" :error="fieldErrors['native:portClass'] || undefined">
              <USelect
                :id="controlId('native:portClass')"
                :model-value="nativeValues.portClass === '' ? unsetFieldValue : nativeValues.portClass"
                :items="[{ label: 'Not recorded', value: unsetFieldValue }, ...portClassOptions.map(option => ({ label: option, value: option }))]"
                @update:model-value="value => nativeValues.portClass = value === unsetFieldValue ? '' : String(value)"
              />
              <template v-if="fieldErrors['native:portClass']" #error="{ error }">
                <p class="b-inspector-inline-error">{{ error }}</p>
              </template>
            </UFormField>
          </fieldset>
        </section>

        <section class="b-inspector-section" aria-labelledby="b-custom-fields-heading">
          <div class="b-inspector-section-heading">
            <div>
              <p class="proto-eyebrow">CUSTOM VALUES</p>
              <h3 id="b-custom-fields-heading">Custom fields</h3>
            </div>
            <UButton size="xs" color="neutral" variant="ghost" @click="emitManageFields">Manage fields</UButton>
          </div>
          <fieldset class="b-inspector-fields" :disabled="!editable">
            <UFormField v-for="field in customFields" :key="field.id" :label="field.name" :error="fieldErrors[`custom:${field.id}`] || undefined">
              <USelect
                v-if="field.type === 'single-select' || field.type === 'boolean'"
                :id="controlId(`custom:${field.id}`)"
                :model-value="selectValue(field)"
                :items="selectItems(field)"
                @update:model-value="value => setSelectValue(field, String(value))"
              />
              <UTextarea
                v-else-if="field.type === 'text'"
                :id="controlId(`custom:${field.id}`)"
                :model-value="String(fieldValues[field.id] ?? '')"
                class="b-inspector-full"
                :rows="3"
                autoresize
                @update:model-value="value => setCustomValue(field, value)"
              />
              <UInput
                v-else
                :id="controlId(`custom:${field.id}`)"
                :model-value="String(fieldValues[field.id] ?? '')"
                type="number"
                step="any"
                inputmode="decimal"
                @update:model-value="value => setCustomValue(field, value)"
              />
              <template v-if="fieldErrors[`custom:${field.id}`]" #error="{ error }">
                <p class="b-inspector-inline-error">{{ error }}</p>
              </template>
            </UFormField>
            <p v-if="customFields.length === 0" class="b-inspector-muted">No custom fields apply to this object.</p>
          </fieldset>
        </section>
      </template>

      <template v-else-if="kind === 'route'">
        <section class="b-inspector-section" aria-labelledby="b-route-details-heading">
          <div class="b-inspector-section-heading">
            <div>
              <p class="proto-eyebrow">JUMP ROUTE</p>
              <h3 id="b-route-details-heading">Route details</h3>
            </div>
          </div>
          <fieldset class="b-inspector-fields b-inspector-fields--paired" :disabled="!editable">
            <UFormField label="Route name" class="b-inspector-full-row" :error="fieldErrors.name || undefined">
              <UInput :id="controlId('name')" v-model="name" class="b-inspector-full" maxlength="80" autocomplete="off" />
              <template v-if="fieldErrors.name" #error="{ error }">
                <p class="b-inspector-inline-error">{{ error }}</p>
              </template>
            </UFormField>
            <UFormField label="Jump level" :error="fieldErrors.jumpLevel || undefined">
              <UInput :id="controlId('jumpLevel')" v-model.number="jumpLevel" type="number" min="1" step="1" inputmode="numeric" />
              <template v-if="fieldErrors.jumpLevel" #error="{ error }">
                <p class="b-inspector-inline-error">{{ error }}</p>
              </template>
            </UFormField>
            <UFormField v-if="routeIsUnresolved" label="Unresolved exit" class="b-inspector-full-row" :error="fieldErrors.unresolvedExit || undefined">
              <UInput :id="controlId('unresolvedExit')" v-model="unresolvedExit" class="b-inspector-full" maxlength="80" />
              <template v-if="fieldErrors.unresolvedExit" #error="{ error }">
                <p class="b-inspector-inline-error">{{ error }}</p>
              </template>
            </UFormField>
          </fieldset>
          <div class="b-inspector-route-summary">
            <span>Endpoints</span>
            <strong>{{ routeSummary }}</strong>
            <small>Endpoint selection is outside this focused prototype.</small>
          </div>
        </section>
      </template>

      <section v-else-if="kind === 'system'" class="b-inspector-section" aria-labelledby="b-system-heading">
        <div class="b-inspector-section-heading">
          <div><p class="proto-eyebrow">STAR SYSTEM</p><h3 id="b-system-heading">System details</h3></div>
        </div>
        <fieldset class="b-inspector-fields" :disabled="!editable">
          <UFormField label="Star system name" :error="fieldErrors.name || undefined">
            <UInput :id="controlId('name')" v-model="name" class="b-inspector-full" maxlength="80" autocomplete="off" />
            <template v-if="fieldErrors.name" #error="{ error }">
              <p class="b-inspector-inline-error">{{ error }}</p>
            </template>
          </UFormField>
        </fieldset>
      </section>

      <section v-if="coverageNote" class="b-inspector-coverage" aria-label="Prototype coverage note">
        <strong>Coverage in this prototype</strong>
        <p>{{ coverageNote }}</p>
      </section>

      <section id="b-inspector-save-details" class="b-inspector-save-details" aria-label="Save status" tabindex="-1">
        <div class="b-inspector-section-heading">
          <div><p class="proto-eyebrow">MEMORY-ONLY SAMPLE</p><h3>{{ saveState === 'error' ? 'Simulated save error' : saveState === 'saving' ? 'Simulated save' : 'Prototype save status' }}</h3></div>
          <span class="b-inspector-save-dot" :class="`is-${saveState}`" aria-hidden="true"></span>
        </div>
        <p>{{ saveMessage }}</p>
        <div v-if="saveState === 'error'" class="b-inspector-save-actions">
          <UButton size="xs" color="error" variant="outline" @click="emit('retry-save')">Retry simulated save</UButton>
          <UButton size="xs" color="neutral" variant="outline" @click="emit('export-json')">Export applied JSON</UButton>
        </div>
      </section>

      <section v-if="canDelete" class="b-inspector-delete" aria-labelledby="b-inspector-delete-heading">
        <div><p class="proto-eyebrow">SEPARATE DESTRUCTIVE ACTION</p><h3 id="b-inspector-delete-heading">Delete</h3></div>
        <p>The existing impact review lists everything that will be removed or updated.</p>
        <UButton class="b-inspector-delete-button" color="error" variant="outline" @click="emit('delete')">
          Delete {{ kind === 'route' ? 'Jump Route' : kind === 'orbit' ? 'Orbit' : kind === 'system' ? 'star system' : 'object' }}…
        </UButton>
      </section>
    </div>

    <footer class="b-inspector-footer">
      <div class="b-inspector-footer-status" role="status" aria-live="polite">
        <span class="b-inspector-save-dot" :class="`is-${saveState}`" aria-hidden="true"></span>
        <span>{{ saveState === 'error' ? 'Save needs attention' : saveState === 'saving' ? 'Simulated save running' : 'Memory-only prototype' }}</span>
        <button v-if="validationError || errorCount" type="button" class="b-inspector-error-link" @click="focusSummary">Review {{ errorCount || 1 }} {{ (errorCount || 1) === 1 ? 'issue' : 'issues' }}</button>
        <template v-if="saveState === 'error'">
          <button type="button" class="b-inspector-footer-link" @click="focusSaveDetails">Details</button>
          <button type="button" class="b-inspector-footer-link" @click="emit('retry-save')">Retry</button>
          <button type="button" class="b-inspector-footer-link" @click="emit('export-json')">Export applied JSON</button>
        </template>
      </div>
      <div class="b-inspector-footer-actions">
        <UButton color="primary" :disabled="!editable || !dirty" @click="emit('apply')">Apply changes</UButton>
        <UButton color="neutral" variant="outline" :disabled="!dirty" @click="emit('discard')">Discard changes</UButton>
      </div>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { CustomFieldDefinition, CustomFieldValue, SystemObject } from '../domain/workspace'

const name = defineModel<string>('name', { required: true })
const description = defineModel<string>('description', { required: true })
const jumpLevel = defineModel<number>('jumpLevel', { required: true })
const unresolvedExit = defineModel<string>('unresolvedExit', { required: true })
const fieldValues = defineModel<Record<string, CustomFieldValue>>('fieldValues', { required: true })
const nativeValues = defineModel<{ atmosphere: string; portClass: string }>('nativeValues', { required: true })
const unsetFieldValue = '__not_recorded__'

const props = defineProps<{
  kind: 'object' | 'route' | 'system' | 'chart' | 'orbit'
  eyebrow: string
  title: string
  subtitle: string
  dirty: boolean
  canDelete: boolean
  routeIsUnresolved: boolean
  routeSummary: string
  customFields: CustomFieldDefinition[]
  object: SystemObject | null
  atmosphereOptions: string[]
  portClassOptions: string[]
  saveState: 'saved' | 'saving' | 'error'
  saveMessage: string
  validationError: string
  editable: boolean
  readOnlyReason: string
  coverageNote: string
  fieldErrors: Record<string, string>
  objectFamilyLabel: string
  objectSubtypeLabel: string
}>()

const emit = defineEmits<{
  hide: []
  apply: []
  discard: []
  delete: []
  'manage-fields': [opener: HTMLElement]
  'retry-save': []
  'export-json': []
}>()

const errorEntries = computed(() => Object.entries(props.fieldErrors))
const errorCount = computed(() => errorEntries.value.length)
const hasAtmosphere = computed(() => props.object?.family === 'CelestialBody' && (props.object.subtype === 'planet' || props.object.subtype === 'moon'))
const hasNativeFields = computed(() => hasAtmosphere.value || props.object?.family === 'Installation')

function controlId(key: string): string {
  return `b-inspector-control-${encodeURIComponent(key)}`
}

function focusControl(key: string): void {
  const control = document.getElementById(controlId(key)) as HTMLElement | null
  control?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  control?.focus({ preventScroll: true })
}

function focusSummary(): void {
  const summary = document.getElementById('b-inspector-validation-summary')
  summary?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  summary?.focus({ preventScroll: true })
}

function focusSaveDetails(): void {
  const details = document.getElementById('b-inspector-save-details')
  details?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  details?.focus({ preventScroll: true })
}

function emitManageFields(event: MouseEvent): void {
  if (event.currentTarget instanceof HTMLElement) emit('manage-fields', event.currentTarget)
}

function selectValue(field: CustomFieldDefinition): string {
  const value = fieldValues.value[field.id]
  return value === undefined || value === '' ? unsetFieldValue : String(value)
}

function selectItems(field: CustomFieldDefinition): Array<{ label: string; value: string }> {
  if (field.type === 'single-select') {
    return [{ label: 'Not recorded', value: unsetFieldValue }, ...field.options.map(option => ({ label: option, value: option }))]
  }
  return [
    { label: 'Not recorded', value: unsetFieldValue },
    { label: 'Yes', value: 'true' },
    { label: 'No', value: 'false' },
  ]
}

function setCustomValue(field: CustomFieldDefinition, value: string | number): void {
  fieldValues.value[field.id] = String(value)
}

function setSelectValue(field: CustomFieldDefinition, value: string): void {
  if (value === unsetFieldValue) fieldValues.value[field.id] = ''
  else if (field.type === 'boolean') fieldValues.value[field.id] = value === 'true'
  else fieldValues.value[field.id] = value
}
</script>

<style scoped>
.b-inspector-card {
  display: grid;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  grid-template-rows: auto minmax(0, 1fr) auto;
  overflow: hidden;
  color: var(--proto-ink);
}

.b-inspector-header,
.b-inspector-footer {
  background: var(--proto-surface);
}

.b-inspector-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: .55rem;
  padding: .8rem .9rem .65rem;
  border-bottom: 1px solid var(--proto-line);
}

.b-inspector-heading-copy { min-width: 0; }
.b-inspector-header h2 { margin: .22rem 0 .28rem; overflow-wrap: anywhere; font: 500 1.28rem/1.06 var(--proto-display-font); }
.b-inspector-subtitle { margin: 0; color: var(--proto-muted); font-size: .73rem; line-height: 1.4; }

.b-inspector-body {
  display: grid;
  min-height: 0;
  align-content: start;
  gap: .8rem;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: .8rem .9rem;
}

.b-inspector-section,
.b-inspector-save-details,
.b-inspector-delete,
.b-inspector-coverage,
.b-inspector-feedback { min-width: 0; }
.b-inspector-section { display: grid; gap: .65rem; }
.b-inspector-section + .b-inspector-section,
.b-inspector-coverage,
.b-inspector-save-details,
.b-inspector-delete { border-top: 1px solid var(--proto-line); padding-top: .8rem; }
.b-inspector-section-heading { display: flex; align-items: center; justify-content: space-between; gap: .5rem; }
.b-inspector-section-heading h3,
.b-inspector-delete h3 { margin: .18rem 0 0; font: 500 1rem/1.15 var(--proto-display-font); }
.b-inspector-type-chip { display: inline-block; margin-top: .2rem; border: 1px solid var(--proto-line); border-radius: 999px; padding: .12rem .42rem; color: var(--proto-muted); font-size: .65rem; }
.b-inspector-fields { display: grid; min-width: 0; gap: .7rem; margin: 0; border: 0; padding: 0; }
.b-inspector-fields--paired { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.b-inspector-full { width: 100%; }
.b-inspector-fields--paired :deep(.b-inspector-full-row) { grid-column: 1 / -1; }
.b-inspector-inline-error { margin: .2rem 0 0; color: var(--proto-danger); font-size: .72rem; line-height: 1.4; }
.b-inspector-feedback { border: 1px solid var(--proto-line); border-radius: .4rem; padding: .65rem .75rem; background: var(--proto-soft); font-size: .74rem; line-height: 1.45; }
.b-inspector-feedback strong { display: block; margin-bottom: .2rem; }
.b-inspector-feedback p { margin: 0; color: var(--proto-muted); }
.b-inspector-feedback--error { border-color: color-mix(in srgb, var(--proto-danger) 60%, var(--proto-line)); background: color-mix(in srgb, var(--proto-danger) 10%, var(--proto-surface)); }
.b-inspector-feedback--error strong,
.b-inspector-feedback--error li a { color: var(--proto-danger); }
.b-inspector-feedback ul { display: grid; gap: .16rem; margin: .35rem 0 0; padding-left: 1.1rem; }
.b-inspector-feedback li a { text-decoration: underline; text-underline-offset: .12em; }
.b-inspector-route-summary { display: grid; gap: .18rem; border-left: 2px solid var(--proto-accent); padding: .35rem .6rem; background: var(--proto-soft); }
.b-inspector-route-summary span,
.b-inspector-route-summary small,
.b-inspector-coverage p,
.b-inspector-save-details > p,
.b-inspector-delete > p { color: var(--proto-muted); font-size: .7rem; line-height: 1.4; }
.b-inspector-route-summary strong { overflow-wrap: anywhere; font-size: .78rem; }
.b-inspector-route-summary small { font-size: .65rem; }
.b-inspector-muted { margin: 0; color: var(--proto-muted); font-size: .74rem; }
.b-inspector-coverage strong { font-size: .75rem; }
.b-inspector-coverage p,
.b-inspector-save-details > p,
.b-inspector-delete > p { margin: .25rem 0 0; }
.b-inspector-save-details .b-inspector-section-heading { margin-bottom: .25rem; }
.b-inspector-save-dot { width: .48rem; height: .48rem; flex: 0 0 auto; border-radius: 50%; background: var(--proto-good); }
.b-inspector-save-dot.is-error { background: var(--proto-danger); }
.b-inspector-save-dot.is-saving { background: var(--proto-accent); animation: b-inspector-pulse .9s ease-in-out infinite alternate; }
.b-inspector-save-actions { display: flex; flex-wrap: wrap; gap: .4rem; margin-top: .55rem; }
.b-inspector-delete-button { justify-self: start; margin-top: .55rem; }
.b-inspector-footer { display: grid; gap: .55rem; border-top: 1px solid var(--proto-line); padding: .6rem .9rem calc(.65rem + env(safe-area-inset-bottom, 0px)); box-shadow: 0 -.2rem .8rem color-mix(in srgb, var(--proto-bg) 35%, transparent); }
.b-inspector-footer-status { display: flex; min-width: 0; align-items: center; flex-wrap: wrap; gap: .35rem .55rem; color: var(--proto-muted); font-size: .65rem; line-height: 1.2; }
.b-inspector-footer-status > span:nth-child(2) { margin-right: auto; }
.b-inspector-error-link,
.b-inspector-footer-link { border: 0; padding: .1rem 0; background: transparent; color: var(--proto-accent); font: inherit; text-decoration: underline; text-underline-offset: .12em; cursor: pointer; }
.b-inspector-footer-status .b-inspector-error-link { color: var(--proto-danger); }
.b-inspector-footer-actions { display: grid; grid-template-columns: 1fr 1fr; gap: .45rem; }
.b-inspector-footer-actions :deep(button) { justify-content: center; }

@keyframes b-inspector-pulse { to { opacity: .38; transform: scale(.72); } }

@media (max-width: 760px), (max-width: 1024px) and (max-height: 600px) {
  .b-inspector-fields--paired { grid-template-columns: minmax(0, 1fr); }
  .b-inspector-header { padding-top: .55rem; }
  .b-inspector-body { padding-top: .65rem; }
  .b-inspector-footer { gap: .45rem; padding-top: .45rem; }
  .b-inspector-footer-actions { gap: .35rem; }
}
</style>
