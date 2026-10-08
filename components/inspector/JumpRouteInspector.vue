<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import {
  jumpPointsInCluster,
  type JumpRoute,
  type LocalWorkspace,
  type Orbit,
  type StarSystem,
  type SystemObject,
} from '../../domain/workspace'
import ChartDetailsPanel from './ChartDetailsPanel.vue'
import type { JumpRouteInspectorHandle, JumpRouteSaveRequest } from './contracts'

interface JumpRouteDraft {
  jumpLevel: string
  fromPointId: string
  destination: 'point' | 'external'
  toPointId: string
  unresolvedExit: string
}

const props = defineProps<{
  workspace: LocalWorkspace
  selectedSystem?: StarSystem
  selectedObject?: SystemObject
  selectedOrbit?: Orbit
  selectedRoute?: JumpRoute
  selectedRouteSummary: string
  chartNamesEditing: boolean
  saving: boolean
  formError: string
  editorError: string
}>()

const emit = defineEmits<{
  'submit-names': []
  'edit-chart-names': []
  'cancel-chart-names': []
  'show-chart-details': []
  'request-route-edit': [routeId: string]
  'save-route': [request: JumpRouteSaveRequest]
  'cancel-route': [routeId: string | null]
  'delete-route': []
  'clear-route-selection': []
  'clear-error': []
}>()

const clusterName = defineModel<string>('clusterName', { required: true })
const systemName = defineModel<string>('systemName', { required: true })
const selectedRoute = computed(() => props.selectedRoute)
const routeFormOpen = ref(false)
const editingRouteId = ref<string | null>(null)
const routeDraft = reactive<JumpRouteDraft>({
  jumpLevel: '1',
  fromPointId: '',
  destination: 'external',
  toPointId: '',
  unresolvedExit: 'Uncharted exit',
})
const routeDraftError = ref('')
const chartDetailsActive = computed(() =>
  !props.selectedObject
  && !props.selectedOrbit
  && !selectedRoute.value
  && !routeFormOpen.value,
)
const jumpPoints = computed(() => jumpPointsInCluster(props.workspace.cluster))
const routeDestinationPoints = computed(() =>
  jumpPoints.value.filter(({ point }) => point.id !== routeDraft.fromPointId),
)
const routeDraftDestination = computed(() =>
  routeDestinationPoints.value.find(({ point }) => point.id === routeDraft.toPointId),
)

function syncRouteDraft(route: JumpRoute | undefined): void {
  routeDraft.jumpLevel = String(route?.jumpLevel ?? 1)
  routeDraft.fromPointId = route?.fromPointId ?? jumpPoints.value[0]?.point.id ?? ''
  routeDraft.toPointId = route?.toPointId ?? ''
  routeDraft.destination = route?.toPointId === null
    ? 'external'
    : route?.toPointId ? 'point' : (routeDestinationPoints.value.length ? 'point' : 'external')
  routeDraft.unresolvedExit = route?.toPointId === null ? route.unresolvedExit : 'Uncharted exit'
}

function beginRoute(): void {
  routeDraft.jumpLevel = '1'
  routeDraft.fromPointId = jumpPoints.value[0]?.point.id ?? ''
  routeDraft.toPointId = routeDestinationPoints.value[0]?.point.id ?? ''
  routeDraft.destination = routeDestinationPoints.value.length ? 'point' : 'external'
  routeDraft.unresolvedExit = 'Uncharted exit'
  editingRouteId.value = null
  routeFormOpen.value = true
  routeDraftError.value = ''
  emit('clear-error')
}

function startRouteEdit(): void {
  const route = selectedRoute.value
  if (!route) return
  syncRouteDraft(route)
  editingRouteId.value = route.id
  routeFormOpen.value = true
  routeDraftError.value = ''
  emit('clear-route-selection')
  emit('clear-error')
}

function cancelRouteForm(clearError = true): void {
  const routeId = editingRouteId.value
  editingRouteId.value = null
  routeFormOpen.value = false
  routeDraftError.value = ''
  emit('cancel-route', routeId)
  if (clearError) emit('clear-error')
}

function submitRoute(): void {
  routeDraftError.value = ''
  emit('save-route', {
    routeId: editingRouteId.value,
    jumpLevel: Number(routeDraft.jumpLevel),
    fromPointId: routeDraft.fromPointId,
    toPointId: routeDraft.destination === 'external' ? null : routeDraft.toPointId,
    unresolvedExit: routeDraft.unresolvedExit,
  })
}

function cancelEdits(clearError = true): void {
  if (routeFormOpen.value) cancelRouteForm(clearError)
}

watch(selectedRoute, route => {
  if (routeFormOpen.value) return
  editingRouteId.value = null
  syncRouteDraft(route)
}, { immediate: true })
watch(() => routeDraft.fromPointId, fromPointId => {
  const firstDestination = routeDestinationPoints.value[0]?.point.id ?? ''
  if (routeDraft.toPointId === fromPointId || !firstDestination) {
    routeDraft.toPointId = firstDestination
  }
  if (!firstDestination) routeDraft.destination = 'external'
})

const inspectorHandle = {
  hasUnsavedEdits: () => routeFormOpen.value,
  cancelEdits,
  beginRoute,
  startRouteEdit,
  routeSaveSucceeded: () => {
    editingRouteId.value = null
    routeFormOpen.value = false
    routeDraftError.value = ''
  },
} satisfies JumpRouteInspectorHandle

defineExpose(inspectorHandle)
</script>

<template>
  <button
    v-if="!routeFormOpen"
    class="quiet-button chart-details-control mb-4"
    type="button"
    :aria-pressed="chartDetailsActive"
    @click="emit('show-chart-details')"
  >
    Chart details
  </button>
  <template v-if="selectedRoute">
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
    <div class="flex flex-wrap gap-2">
      <button class="primary-button" type="button" aria-label="Edit Jump Route" :disabled="props.saving" @click="emit('request-route-edit', selectedRoute.id)">
        Edit
      </button>
      <button
        class="quiet-button"
        type="button"
        :aria-label="`Delete Jump Route (Level ${selectedRoute.jumpLevel})`"
        :disabled="props.saving"
        @click="emit('delete-route')"
      >
        Delete route
      </button>
    </div>
  </template>

  <template v-else-if="routeFormOpen">
    <span class="section-kicker">{{ editingRouteId ? 'JUMP ROUTE / EDIT' : 'JUMP ROUTE / NEW' }}</span>
    <span class="type-chip mt-[0.65rem] inline-block border border-[var(--line)] px-[0.4rem] py-[0.27rem]">LOGICAL ENDPOINTS</span>
    <h2 class="mt-[0.65rem] mb-[0.35rem] [overflow-wrap:anywhere] text-[1.65rem]">
      {{ editingRouteId ? 'Edit Jump Route' : 'Connect Jump Points' }}
    </h2>
    <p class="inspector-intro mb-[1em]">
      Routes reference logical Jump Points. A Station is a separate physical location.
    </p>
    <form class="field-stack mt-4 grid gap-3" @submit.prevent="submitRoute">
      <template v-if="jumpPoints.length">
        <label for="route-level">
          Jump level
          <input
            id="route-level"
            v-model="routeDraft.jumpLevel"
            type="number"
            min="1"
            step="1"
            required
          >
        </label>
        <p class="inspector-intro m-0">Standard levels are 1-9; custom positive integer levels are supported.</p>
        <label for="route-from">
          From Jump Point
          <select id="route-from" v-model="routeDraft.fromPointId" required>
            <option v-for="reference in jumpPoints" :key="reference.point.id" :value="reference.point.id">
              {{ reference.point.name }} ({{ reference.system.name }})
            </option>
          </select>
        </label>
        <label for="route-destination">
          Route destination
          <select id="route-destination" v-model="routeDraft.destination">
            <option value="point" :disabled="routeDestinationPoints.length === 0">Known Jump Point</option>
            <option value="external">Unresolved external exit</option>
          </select>
        </label>
        <label v-if="routeDraft.destination === 'point'" for="route-to">
          To Jump Point
          <select id="route-to" v-model="routeDraft.toPointId" required>
            <option value="" disabled>Select a different Jump Point</option>
            <option v-for="reference in routeDestinationPoints" :key="reference.point.id" :value="reference.point.id">
              {{ reference.point.name }} ({{ reference.system.name }})
            </option>
          </select>
        </label>
        <p v-if="routeDraft.destination === 'point'" class="inspector-intro m-0">
          Destination system: {{ routeDraftDestination?.system.name ?? 'Select a Jump Point' }}
        </p>
        <p v-if="routeDraft.destination === 'point'" class="inspector-intro m-0">
          This route connects Jump Points by stable identity, independently of any physical Station.
        </p>
        <label v-else for="route-exit">
          Unknown destination label
          <input
            id="route-exit"
            v-model="routeDraft.unresolvedExit"
            maxlength="80"
            required
          >
        </label>
        <p v-if="routeDraft.destination === 'external'" class="inspector-intro m-0" role="status">
          <strong>Unknown destination: {{ routeDraft.unresolvedExit }}</strong> is beyond the known Jump Cluster.
        </p>
        <p v-if="props.editorError || routeDraftError" class="feedback m-0 error-text" role="alert">
          {{ routeDraftError || props.editorError }}
        </p>
        <div class="flex flex-wrap gap-2">
          <button class="primary-button" type="submit" :disabled="props.saving">
            {{ editingRouteId ? 'Save Jump Route' : 'Create Jump Route' }}
          </button>
          <button class="quiet-button" type="button" @click="cancelRouteForm()">
            Cancel
          </button>
        </div>
      </template>
      <template v-else>
        <p class="empty-copy m-0" role="status">Open a star system and add a Jump Point before creating a route.</p>
        <button class="quiet-button justify-self-start" type="button" @click="cancelRouteForm()">
          Cancel
        </button>
      </template>
    </form>
  </template>

  <ChartDetailsPanel
    v-else
    v-model:cluster-name="clusterName"
    v-model:system-name="systemName"
    mode="cluster"
    :workspace="props.workspace"
    :chart-names-editing="props.chartNamesEditing"
    :saving="props.saving"
    :form-error="props.formError"
    :editor-error="props.editorError"
    @submit-names="emit('submit-names')"
    @edit-chart-names="emit('edit-chart-names')"
    @cancel-chart-names="emit('cancel-chart-names')"
  />
</template>
