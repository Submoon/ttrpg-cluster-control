<template>
  <template v-if="selectedRoute && !props.session">
    <section class="jump-route-details" aria-label="Jump Route details">
      <div class="jump-route-details-body">
        <span class="section-kicker">JUMP ROUTE / SELECTED</span>
        <span class="type-chip mt-[0.65rem] inline-block border border-[var(--line)] px-[0.4rem] py-[0.27rem]">SYSTEM CONNECTIONS</span>
        <h2 class="mt-[0.65rem] mb-[0.35rem] [overflow-wrap:anywhere] text-[1.65rem]">Jump Level {{ selectedRoute.jumpLevel }}</h2>
        <p v-if="selectedRoute.name" class="inspector-intro [overflow-wrap:anywhere]">{{ selectedRoute.name }}</p>
        <p class="inspector-intro mb-[1em]">
          Routes connect systems directly. Local Jump Points are optional; Stations remain separate physical locations.
        </p>
        <p v-if="props.editorError" class="route-sharing-error" role="alert" aria-live="assertive">
          {{ props.editorError }}
        </p>
        <section
          v-if="selectedRouteSharingStatus"
          class="route-sharing-control route-sharing-control--configured"
          aria-label="Configured visibility"
        >
          <div class="route-sharing-control-heading">
            <span class="section-kicker">CONFIGURED VISIBILITY</span>
            <div role="group" aria-label="Jump Route visibility" class="route-sharing-buttons">
              <UTooltip text="Keep this Jump Route private from players.">
                <UButton
                  aria-label="Set Jump Route visibility to Private"
                  :aria-pressed="!selectedRoute.playerShared"
                  :disabled="props.saving || props.publicationBusy"
                  :color="selectedRoute.playerShared ? 'neutral' : 'primary'"
                  :variant="selectedRoute.playerShared ? 'ghost' : 'soft'"
                  class="min-h-9 min-w-[4.5rem] justify-center gap-1 px-2 text-xs"
                  size="sm"
                  type="button"
                  @click="emit('set-route-sharing', selectedRoute.id, false)"
                >
                  <UIcon name="i-lucide-eye-off" class="size-4" aria-hidden="true" />
                  <span>Private</span>
                </UButton>
              </UTooltip>
              <UTooltip text="Include this Jump Route in player publication when an endpoint system is visible.">
                <UButton
                  aria-label="Set Jump Route visibility to Shared"
                  :aria-pressed="selectedRoute.playerShared"
                  :disabled="props.saving || props.publicationBusy"
                  :color="selectedRoute.playerShared ? 'primary' : 'neutral'"
                  :variant="selectedRoute.playerShared ? 'soft' : 'ghost'"
                  class="min-h-9 min-w-[4.5rem] justify-center gap-1 px-2 text-xs"
                  size="sm"
                  type="button"
                  @click="emit('set-route-sharing', selectedRoute.id, true)"
                >
                  <UIcon name="i-lucide-eye" class="size-4" aria-hidden="true" />
                  <span>Shared</span>
                </UButton>
              </UTooltip>
            </div>
          </div>
          <p class="inspector-intro m-0" role="status" aria-live="polite">
            Configured visibility: {{ selectedRouteSharingStatus.visibilityLabel }}.
          </p>
          <p v-if="selectedRouteSharingStatus.noVisibleEndpointMessage" class="route-sharing-blocked" role="status">
            {{ selectedRouteSharingStatus.noVisibleEndpointMessage }}
          </p>
          <p v-else-if="selectedRoute.playerShared" class="inspector-intro m-0">
            Hidden systems are anonymized in the player view; logical Jump Point names remain private.
          </p>
        </section>
        <div class="orbit-facts my-4 grid grid-cols-[1fr_auto] gap-[0.55rem] border-y border-[var(--line-soft)] py-[0.8rem]">
          <span>Endpoints</span>
          <strong class="text-right">{{ props.selectedRouteSummary }}</strong>
        </div>
        <p v-if="selectedRoute.toSystemId === null" class="inspector-intro">
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
    :publication-busy="props.publicationBusy"
    :selected-system="props.inspectedSystem"
    :chart-edit-system-id="props.inspectedSystem?.id"
    :has-chart-name-draft="props.hasChartNameDraft"
    :editor-error="props.editorError"
    :saving="props.saving"
    @delete-system="emit('delete-system', $event)"
  />

  <section v-else-if="props.session" class="route-session-inspector" aria-label="Jump Route editor">
    <header class="route-session-header">
      <span class="section-kicker">{{ props.session.routeId ? 'JUMP ROUTE / EDIT' : 'JUMP ROUTE / NEW' }}</span>
      <span class="type-chip mt-[0.45rem] inline-block border border-[var(--line)] px-[0.4rem] py-[0.27rem]">SYSTEM CONNECTIONS</span>
      <h2 class="mt-2 mb-1 [overflow-wrap:anywhere]">
        {{ props.session.routeId ? 'Edit Jump Route' : 'Connect Systems' }}
      </h2>
      <p class="inspector-intro m-0">
        Routes connect systems directly. Local Jump Points are optional attachments; Stations remain separate physical locations.
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

        <UFormField label="From system" :error="fieldError('fromSystemId')">
          <USelect
            id="route-from-system"
            :model-value="props.session.draft.fromSystemId"
            :items="sourceSystemItems"
            placeholder="Choose an origin system"
            @update:model-value="updateFromSystem($event)"
          />
        </UFormField>
        <UFormField label="From Jump Point (optional)" :error="fieldError('fromPointId')">
          <USelect
            id="route-from-point"
            :model-value="pointOptionValue(props.session.draft.fromPointId)"
            :items="sourcePointItems"
            placeholder="System-only endpoint"
            :disabled="!props.session.draft.fromSystemId"
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

        <template v-if="props.session.draft.destination === 'system'">
          <UFormField label="To system" :error="fieldError('toSystemId')">
            <USelect
              id="route-to-system"
              :model-value="props.session.draft.toSystemId"
              :items="destinationSystemItems"
              placeholder="Choose a different system"
              @update:model-value="updateToSystem($event)"
            />
          </UFormField>
          <UFormField label="To Jump Point (optional)" :error="fieldError('toPointId')">
            <USelect
              id="route-to-point"
              :model-value="pointOptionValue(props.session.draft.toPointId)"
              :items="destinationPointItems"
              placeholder="System-only endpoint"
              :disabled="!props.session.draft.toSystemId"
              @update:model-value="updateToPoint($event)"
            />
          </UFormField>
          <p class="inspector-intro m-0">
            Destination system: {{ destinationSystem?.name ?? 'Select a system' }}.
            Jump Points are optional local attachments; Stations remain separate physical locations.
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

        <div class="route-sharing-control">
          <UCheckbox
            id="route-player-shared"
            :model-value="props.session.draft.playerShared"
            label="Share with players"
            @update:model-value="update('playerShared', $event)"
          />
          <p class="inspector-intro m-0">
            Shared routes keep their Jump level. Hidden destinations use a generic label; logical Jump Point names stay private.
          </p>
        </div>

        <p v-if="props.session.routeId === null && props.workspace.cluster.systems.length < 2" class="empty-copy m-0" role="status">
          Add another system before creating a known-system route. An unresolved external exit remains available.
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
    :chart-edit-system-id="props.chartEditSystemId"
    :has-chart-name-draft="props.hasChartNameDraft"
    :editor-error="props.editorError"
    :saving="props.saving"
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
import { routeSharingStatus } from '../../utils/gm-publication-badges'
import { decodeRoutePointOption, encodeRoutePointOption, noLocalRoutePointOption } from '../../utils/route-point-option'

const props = defineProps<{
  workspace: LocalWorkspace
  selectedSystem?: StarSystem
  selectedObject?: SystemObject
  selectedOrbit?: Orbit
  selectedRoute?: JumpRoute
  inspectedSystem?: StarSystem
  chartEditSystemId?: string
  selectedRouteSummary: string
  hasChartNameDraft: boolean
  saving: boolean
  editorError: string
  publicationBusy?: boolean
  session: RouteInspectorSession | null
}>()

const emit = defineEmits<{
  'delete-system': [systemId: string]
  'request-route-edit': [routeId: string]
  'set-route-sharing': [routeId: string, playerShared: boolean]
  'delete-route': []
  'clear-error': []
  'update-route-input': [sessionId: number, field: RouteDraftField, value: string | boolean]
  'choose-route-system': [sessionId: number, systemId: string]
  'choose-route-point': [sessionId: number, pointId: string]
  'apply-route-session': [sessionId: number]
  'discard-route-session': [sessionId: number]
}>()

const selectedRoute = computed(() => props.selectedRoute)
const selectedRouteSharingStatus = computed(() => selectedRoute.value
  ? routeSharingStatus(props.workspace.cluster, selectedRoute.value)
  : null)
const noLocalPoint = noLocalRoutePointOption
const pointOptionValue = (pointId: string | null) => encodeRoutePointOption(pointId)
const systems = computed(() => props.workspace.cluster.systems)
const sourceSystemItems = computed(() => {
  const active = props.session
  const choices = active?.sourceSystemIds ?? systems.value.map(system => system.id)
  return systems.value
    .filter(system => choices.includes(system.id) && system.id !== active?.draft.toSystemId)
    .map(system => ({ label: system.name, value: system.id }))
})
const destinationSystemItems = computed(() => {
  const active = props.session
  const choices = active?.destinationSystemIds ?? systems.value.map(system => system.id)
  return systems.value
    .filter(system => choices.includes(system.id) && system.id !== active?.draft.fromSystemId)
    .map(system => ({ label: system.name, value: system.id }))
})
const sourcePointItems = computed(() => {
  const active = props.session
  if (!active?.draft.fromSystemId) return [{ label: 'No local Jump Point', value: noLocalPoint }]
  return [
    { label: 'No local Jump Point', value: noLocalPoint },
    ...jumpPointsInCluster(props.workspace.cluster)
      .filter(reference => reference.system.id === active.draft.fromSystemId)
      .map(({ point, system }) => ({ label: `${point.name} (${system.name})`, value: encodeRoutePointOption(point.id) })),
  ]
})
const destinationPointItems = computed(() => {
  const active = props.session
  if (!active?.draft.toSystemId) return [{ label: 'No local Jump Point', value: noLocalPoint }]
  return [
    { label: 'No local Jump Point', value: noLocalPoint },
    ...jumpPointsInCluster(props.workspace.cluster)
      .filter(reference => reference.system.id === active.draft.toSystemId
        && reference.point.id !== active.draft.fromPointId)
      .map(({ point, system }) => ({ label: `${point.name} (${system.name})`, value: encodeRoutePointOption(point.id) })),
  ]
})
const destinationItems = [
  { label: 'Known system', value: 'system' },
  { label: 'Unresolved external exit', value: 'external' },
]
const destinationSystem = computed(() => systems.value.find(system => system.id === props.session?.draft.toSystemId))
const fieldLabels: Record<RouteDraftField, string> = {
  jumpLevel: 'Jump level',
  fromSystemId: 'From system',
  fromPointId: 'From Jump Point',
  destination: 'Route destination',
  toSystemId: 'To system',
  toPointId: 'To Jump Point',
  unresolvedExit: 'Unknown destination label',
  playerShared: 'Share with players',
}
const controlIds: Record<RouteDraftField, string> = {
  jumpLevel: 'route-level',
  fromSystemId: 'route-from-system',
  fromPointId: 'route-from-point',
  destination: 'route-destination',
  toSystemId: 'route-to-system',
  toPointId: 'route-to-point',
  unresolvedExit: 'route-exit',
  playerShared: 'route-player-shared',
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
  const fromSystem = systems.value.find(system => system.id === draft.fromSystemId)
  const fromPoint = draft.fromPointId
    ? jumpPointsInCluster(props.workspace.cluster).find(reference => reference.point.id === draft.fromPointId)?.point
    : undefined
  const origin = fromSystem
    ? fromPoint ? `${fromPoint.name} (${fromSystem.name})` : fromSystem.name
    : 'Choose origin system'
  const toPoint = draft.toPointId
    ? jumpPointsInCluster(props.workspace.cluster).find(reference => reference.point.id === draft.toPointId)?.point
    : undefined
  const destination = draft.destination === 'external'
    ? draft.unresolvedExit ? `Unknown destination: ${draft.unresolvedExit}` : 'Name external exit'
    : destinationSystem.value
      ? toPoint ? `${toPoint.name} (${destinationSystem.value.name})` : destinationSystem.value.name
      : 'Choose destination system'
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
  if (field === 'playerShared') {
    if (typeof value === 'boolean') emit('update-route-input', session.id, field, value)
    return
  }
  emit('update-route-input', session.id, field, String(value ?? ''))
}

function updateFromSystem(value: unknown): void {
  const session = props.session
  if (!session) return
  const systemId = String(value ?? '')
  if (session.sourceSystemIds) emit('choose-route-system', session.id, systemId)
  else update('fromSystemId', systemId)
}

function updateToSystem(value: unknown): void {
  const session = props.session
  if (!session) return
  const systemId = String(value ?? '')
  if (session.destinationSystemIds) emit('choose-route-system', session.id, systemId)
  else update('toSystemId', systemId)
}

function updateFromPoint(value: unknown): void {
  update('fromPointId', decodeRoutePointOption(String(value ?? '')))
}

function updateToPoint(value: unknown): void {
  update('toPointId', decodeRoutePointOption(String(value ?? '')))
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

.route-sharing-control--configured {
  margin-block: 1rem;
  border-block: 1px solid var(--line-soft);
  padding-block: .8rem;
}

.route-sharing-control-heading {
  display: flex;
  flex-wrap: wrap;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: .65rem;
  margin-bottom: .45rem;
}

.route-sharing-buttons {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: .25rem;
  border: 1px solid var(--line-soft);
  border-radius: .45rem;
  background: var(--panel-soft);
  padding: .2rem;
}

.route-sharing-blocked,
.route-sharing-error {
  margin: .45rem 0 0;
  border-left: 2px solid var(--warning-border, var(--line));
  padding: .35rem .55rem;
  color: var(--text-primary);
  font-size: .78rem;
}

.route-sharing-error {
  border-left-color: var(--error-border);
  background: var(--error-bg);
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

.route-sharing-control {
  display: grid;
  gap: .4rem;
  border-top: 1px solid var(--line-soft);
  padding-top: .8rem;
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
