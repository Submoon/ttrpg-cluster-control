<template>
  <UButton
    v-if="!props.session"
    color="neutral"
    variant="ghost"
    size="sm"
    class="chart-details-control mb-4"
    type="button"
    :aria-pressed="chartDetailsActive"
    @click="emit('show-chart-details')"
  >
    Chart details
  </UButton>

  <template v-if="selectedRoute && !props.session">
    <section class="jump-route-details" aria-label="Jump Route details">
      <div class="jump-route-details-body">
        <span class="section-kicker">JUMP ROUTE / SELECTED</span>
        <span class="type-chip mt-[0.65rem] inline-block border border-[var(--line)] px-[0.4rem] py-[0.27rem]">LOGICAL ENDPOINTS</span>
        <h2 class="mt-[0.65rem] mb-[0.35rem] [overflow-wrap:anywhere] text-[1.65rem]">Jump Level {{ selectedRoute.jumpLevel }}</h2>
        <p class="inspector-intro mb-[1em]">
          Routes reference logical Jump Points. A Station is a separate physical location.
        </p>
        <div class="orbit-facts my-4 grid grid-cols-[1fr_auto] gap-[0.55rem] border-y border-[var(--line-soft)] py-[0.8rem]">
          <span>Endpoints</span>
          <strong class="text-right">{{ props.selectedRouteSummary }}</strong>
        </div>
        <p v-if="selectedRoute.toPointId === null" class="inspector-intro">
          <strong>Unknown destination: {{ selectedRoute.unresolvedExit }}</strong> is beyond the known Jump Cluster.
        </p>
        <div class="jump-route-delete">
          <UButton
            color="error"
            variant="outline"
            :disabled="props.saving"
            :aria-label="`Delete Jump Route (Level ${selectedRoute.jumpLevel})`"
            @click="emit('delete-route')"
          >
            Delete route
          </UButton>
        </div>
      </div>
      <footer class="jump-route-details-footer" aria-label="Jump Route actions">
        <UButton block class="w-full justify-center" color="primary" :disabled="props.saving" aria-label="Edit Jump Route" @click="emit('request-route-edit', selectedRoute.id)">
          Edit
        </UButton>
      </footer>
    </section>
  </template>

  <ChartDetailsPanel
    v-else-if="props.inspectedSystem && !props.session"
    mode="system"
    :workspace="props.workspace"
    :selected-system="props.inspectedSystem"
    :allow-open-system="true"
    :has-chart-name-draft="props.hasChartNameDraft"
    :editor-error="props.editorError"
    :saving="props.saving"
    @edit-chart-names="emit('edit-chart-names', $event)"
    @open-system="emit('open-system', $event)"
    @delete-system="emit('delete-system', $event)"
  />

  <section v-else-if="props.session" class="route-session-inspector" aria-label="Jump Route editor">
    <header class="route-session-header">
      <span class="section-kicker">{{ props.session.routeId ? 'JUMP ROUTE / EDIT' : 'JUMP ROUTE / NEW' }}</span>
      <span class="type-chip mt-[0.45rem] inline-block border border-[var(--line)] px-[0.4rem] py-[0.27rem]">LOGICAL ENDPOINTS</span>
      <h2 class="mt-2 mb-1 [overflow-wrap:anywhere]">
        {{ props.session.routeId ? 'Edit Jump Route' : 'Connect Jump Points' }}
      </h2>
      <p class="inspector-intro m-0">
        Routes reference logical Jump Points. A Station is a separate physical location.
      </p>
    </header>

    <form id="route-session-form" class="route-session-form" novalidate @submit.prevent="applyRouteSession">
      <div class="route-session-fields" aria-label="Jump Route fields">
        <div
          v-if="summaryMessage || errorEntries.length"
          ref="validationSummary"
          class="route-validation-summary"
          role="alert"
          aria-live="assertive"
          tabindex="-1"
        >
          <strong>{{ errorEntries.length ? `${errorEntries.length} form ${errorEntries.length === 1 ? 'issue' : 'issues'}` : 'Could not apply this route' }}</strong>
          <p class="m-0">{{ summaryMessage || 'Review the marked fields before applying.' }}</p>
          <ul v-if="errorEntries.length" class="m-0 pl-5">
            <li v-for="[field, message] in errorEntries" :key="field">
              <UButton
                v-if="field !== 'form'"
                class="route-validation-issue"
                color="error"
                variant="link"
                size="xs"
                type="button"
                @click="focusControl(field)"
              >{{ fieldLabels[field] }}: {{ message }}</UButton>
              <span v-else>{{ message }}</span>
            </li>
          </ul>
        </div>

        <UFormField label="Jump level" :error="fieldError('jumpLevel')">
          <UInput
            id="route-level"
            :model-value="props.session.draft.jumpLevel"
            type="number"
            min="1"
            step="1"
            inputmode="numeric"
            @update:model-value="update('jumpLevel', $event)"
          />
          <template #hint>Standard levels are 1–9; any positive integer level is supported.</template>
        </UFormField>

        <UFormField label="From Jump Point" :error="fieldError('fromPointId')">
          <USelect
            id="route-from"
            :model-value="props.session.draft.fromPointId"
            :items="sourcePointItems"
            placeholder="Choose an origin Jump Point"
            @update:model-value="updateFromPoint($event)"
          />
        </UFormField>

        <UFormField label="Route destination" :error="fieldError('destination')">
          <USelect
            id="route-destination"
            :model-value="props.session.draft.destination"
            :items="destinationItems"
            @update:model-value="update('destination', $event)"
          />
        </UFormField>

        <template v-if="props.session.draft.destination === 'point'">
          <UFormField label="To Jump Point" :error="fieldError('toPointId')">
            <USelect
              id="route-to"
              :model-value="props.session.draft.toPointId"
              :items="destinationPointItems"
              placeholder="Choose a different Jump Point"
              @update:model-value="updateToPoint($event)"
            />
          </UFormField>
          <p class="inspector-intro m-0">
            Destination system: {{ destinationReference?.system.name ?? 'Select a Jump Point' }}.
            Routes connect Jump Points independently of any physical Station.
          </p>
        </template>
        <template v-else>
          <UFormField label="Unknown destination label" :error="fieldError('unresolvedExit')">
            <UInput
              id="route-exit"
              :model-value="props.session.draft.unresolvedExit"
              maxlength="80"
              @update:model-value="update('unresolvedExit', $event)"
            />
          </UFormField>
          <p v-if="props.session.draft.unresolvedExit" class="inspector-intro m-0" role="status">
            <strong>Unknown destination: {{ props.session.draft.unresolvedExit }}</strong> is beyond the known Jump Cluster.
          </p>
        </template>

        <p v-if="props.session.routeId === null && !jumpPointItems.length" class="empty-copy m-0" role="status">
          Open a star system and add a Jump Point before creating a route.
        </p>
      </div>

      <footer class="route-session-footer">
        <div class="route-session-summary">
          <span class="section-kicker">ROUTE DRAFT</span>
          <p class="route-session-endpoints m-0" role="status" aria-live="polite">{{ routeDraftSummary }}</p>
          <span class="route-session-state" role="status" aria-live="polite">{{ routeSessionState }}</span>
        </div>
        <div class="flex flex-wrap gap-2">
          <UButton color="primary" type="submit" :disabled="props.saving">
            {{ props.session.routeId ? 'Apply Jump Route' : 'Create Jump Route' }}
          </UButton>
          <UButton color="neutral" variant="outline" type="button" @click="emit('discard-route-session', props.session!.id)">
            Discard {{ props.session.routeId ? 'changes' : 'route draft' }}
          </UButton>
        </div>
      </footer>
    </form>
  </section>

  <ChartDetailsPanel
    v-else
    mode="cluster"
    :workspace="props.workspace"
    :has-chart-name-draft="props.hasChartNameDraft"
    :editor-error="props.editorError"
    :saving="props.saving"
    @edit-chart-names="emit('edit-chart-names')"
  />
</template>

<script setup lang="ts">
/** Presents route details and the page-owned route session with Nuxt UI controls. */
import { computed, nextTick, ref, watch } from 'vue'
import {
  jumpPointsInCluster,
  type JumpRoute,
  type LocalWorkspace,
  type Orbit,
  type StarSystem,
  type SystemObject,
} from '../../domain/workspace'
import type { RouteDraftField, RouteInspectorSession } from '../../composables/editor-workflows/useRouteInspectorSession'
import ChartDetailsPanel from './ChartDetailsPanel.vue'

const props = defineProps<{
  workspace: LocalWorkspace
  selectedSystem?: StarSystem
  selectedObject?: SystemObject
  selectedOrbit?: Orbit
  selectedRoute?: JumpRoute
  inspectedSystem?: StarSystem
  selectedRouteSummary: string
  hasChartNameDraft: boolean
  saving: boolean
  editorError: string
  session: RouteInspectorSession | null
}>()

const emit = defineEmits<{
  'edit-chart-names': [targetSystemId?: string]
  'open-system': [systemId: string]
  'delete-system': [systemId: string]
  'show-chart-details': []
  'request-route-edit': [routeId: string]
  'delete-route': []
  'clear-error': []
  'update-route-input': [sessionId: number, field: RouteDraftField, value: string]
  'choose-route-point': [sessionId: number, pointId: string]
  'apply-route-session': [sessionId: number]
  'discard-route-session': [sessionId: number]
}>()

const selectedRoute = computed(() => props.selectedRoute)
const chartDetailsActive = computed(() => !props.selectedObject && !props.selectedOrbit && !selectedRoute.value && !props.session)
const pickFromMap = '__route-pick-from-map__'
const pickToMap = '__route-pick-to-map__'
const jumpPointItems = computed(() => jumpPointsInCluster(props.workspace.cluster).map(({ point, system }) => ({
  label: `${point.name} (${system.name})`,
  value: point.id,
})))
const sourcePointItems = computed(() => {
  const active = props.session
  const scope = active?.sourceSystemIds
  const points = jumpPointsInCluster(props.workspace.cluster)
    .filter(reference => scope == null || scope.includes(reference.system.id))
    .map(({ point, system }) => ({ label: `${point.name} (${system.name})`, value: point.id }))
  return active?.draft.fromPointId
    ? [{ label: 'Choose on map…', value: pickFromMap }, ...points]
    : points
})
const destinationPointItems = computed(() => {
  const active = props.session
  const scope = active?.destinationSystemIds
  const points = jumpPointsInCluster(props.workspace.cluster)
    .filter(reference => (scope == null || scope.includes(reference.system.id))
      && reference.point.id !== active?.draft.fromPointId)
    .map(({ point, system }) => ({ label: `${point.name} (${system.name})`, value: point.id }))
  return active?.draft.toPointId
    ? [{ label: 'Choose on map…', value: pickToMap }, ...points]
    : points
})
const destinationItems = [
  { label: 'Known Jump Point', value: 'point' },
  { label: 'Unresolved external exit', value: 'external' },
]
const destinationReference = computed(() => props.session
  ? jumpPointsInCluster(props.workspace.cluster).find(({ point }) => point.id === props.session?.draft.toPointId)
  : undefined)
const fieldLabels: Record<RouteDraftField, string> = {
  jumpLevel: 'Jump level',
  fromPointId: 'From Jump Point',
  destination: 'Route destination',
  toPointId: 'To Jump Point',
  unresolvedExit: 'Unknown destination label',
}
const controlIds: Record<RouteDraftField, string> = {
  jumpLevel: 'route-level',
  fromPointId: 'route-from',
  destination: 'route-destination',
  toPointId: 'route-to',
  unresolvedExit: 'route-exit',
}
const validationSummary = ref<HTMLElement | null>(null)
let pendingApplyFocusSessionId: number | null = null
const errorEntries = computed(() => Object.entries(props.session?.errors ?? {})
  .filter((entry): entry is [RouteDraftField | 'form', string] => !!entry[1]))
const summaryMessage = computed(() => props.session?.error || props.editorError)
watch(
  () => ({
    sessionId: props.session?.id ?? null,
    hasIssues: !!summaryMessage.value || errorEntries.value.length > 0,
  }),
  ({ sessionId, hasIssues }) => {
    const expectedSessionId = pendingApplyFocusSessionId
    if (expectedSessionId === null) return
    if (sessionId !== expectedSessionId) {
      pendingApplyFocusSessionId = null
      return
    }
    if (!hasIssues) return
    pendingApplyFocusSessionId = null
    validationSummary.value?.focus()
  },
  { flush: 'post' },
)
const routeDraftSummary = computed(() => {
  const draft = props.session?.draft
  if (!draft) return ''
  const origin = jumpPointItems.value.find(item => item.value === draft.fromPointId)?.label ?? 'Choose origin'
  const destination = draft.destination === 'external'
    ? draft.unresolvedExit ? `Unknown destination: ${draft.unresolvedExit}` : 'Name external exit'
    : jumpPointItems.value.find(item => item.value === draft.toPointId)?.label ?? 'Choose destination'
  return `From ${origin} · To ${destination}`
})
const hasRouteChanges = computed(() => {
  const session = props.session
  return !!session && JSON.stringify(session.draft) !== JSON.stringify(session.initial)
})
const routeSessionState = computed(() => {
  const session = props.session
  if (!session) return ''
  return !hasRouteChanges.value
    ? session.routeId ? 'Route edit ready' : 'Route draft ready'
    : session.routeId ? 'Unapplied route changes' : 'Unapplied route draft'
})

function fieldError(field: RouteDraftField): string | undefined {
  return props.session?.errors[field] || undefined
}

async function applyRouteSession(): Promise<void> {
  const session = props.session
  if (!session) return
  pendingApplyFocusSessionId = session.id
  emit('apply-route-session', session.id)
  await nextTick()
  if (pendingApplyFocusSessionId !== session.id) return
  if (props.session?.id !== session.id) {
    pendingApplyFocusSessionId = null
    return
  }
  if (summaryMessage.value || errorEntries.value.length) {
    pendingApplyFocusSessionId = null
    validationSummary.value?.focus()
  }
}

function focusControl(field: RouteDraftField | 'form'): void {
  if (field === 'form') return
  const wrapper = document.getElementById(controlIds[field])
  const control = wrapper?.matches('input, button, [role="combobox"]')
    ? wrapper
    : wrapper?.querySelector<HTMLElement>('input, button, [role="combobox"]')
  control?.focus()
  control?.scrollIntoView({ block: 'center' })
}

function update(field: RouteDraftField, value: unknown): void {
  const session = props.session
  if (!session) return
  emit('update-route-input', session.id, field, String(value ?? ''))
}

function updateFromPoint(value: unknown): void {
  update('fromPointId', String(value ?? '') === pickFromMap ? '' : value)
}

function updateToPoint(value: unknown): void {
  update('toPointId', String(value ?? '') === pickToMap ? '' : value)
}
</script>

<style scoped>
.route-session-inspector {
  display: grid;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  grid-template-rows: auto minmax(0, 1fr);
  overflow: hidden;
}

.jump-route-details {
  display: grid;
  min-width: 0;
  min-height: 0;
  flex: 1 1 0;
  grid-template-rows: minmax(0, 1fr) auto;
  overflow: hidden;
}

.jump-route-details-body {
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0.8rem 0.9rem;
}

.jump-route-delete {
  display: flex;
  justify-content: flex-end;
  margin-top: 1rem;
  border-top: 1px solid var(--line-soft);
  padding-top: 0.75rem;
}

.jump-route-details-footer {
  display: flex;
  flex: 0 0 auto;
  justify-content: flex-end;
  border-top: 1px solid var(--line-soft);
  background: var(--panel-bg);
  padding: 0.65rem 0.9rem max(0.65rem, env(safe-area-inset-bottom, 0px));
}

.route-session-header {
  border-bottom: 1px solid var(--line-soft);
  background: var(--panel-bg);
  padding: .8rem .9rem .65rem;
}

.route-session-header h2 { font: 500 1.45rem/1.2 Georgia, serif; }

.route-session-form {
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template-rows: minmax(0, 1fr) auto;
  overflow: hidden;
}

.route-session-fields {
  display: grid;
  min-height: 0;
  align-content: start;
  gap: .8rem;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: .8rem .9rem;
}

.route-validation-summary {
  border: 1px solid var(--error-border);
  border-radius: .6rem;
  background: var(--error-bg);
  padding: .7rem .8rem;
  color: var(--text-primary);
}

.route-validation-summary:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

.route-validation-summary p { margin-top: .3rem; }
.route-validation-issue { padding: 0; text-align: left; }

.route-session-footer {
  display: grid;
  gap: .55rem;
  border-top: 1px solid var(--line-soft);
  background: var(--panel-bg);
  padding: .65rem .9rem calc(.65rem + env(safe-area-inset-bottom, 0px));
}

.route-session-summary { display: grid; gap: .15rem; min-width: 0; }
.route-session-endpoints { overflow-wrap: anywhere; color: var(--text-secondary); font-size: .72rem; }
.route-session-state { color: var(--text-muted); font-size: .68rem; }

</style>
