<script setup lang="ts">
import { computed } from 'vue'
import {
  jumpPointsInCluster,
  type LocalWorkspace,
  type StarSystem,
} from '../../domain/workspace'

const props = defineProps<{
  mode: 'cluster' | 'system'
  workspace: LocalWorkspace
  selectedSystem?: StarSystem
  chartNamesEditing: boolean
  saving: boolean
  formError: string
  editorError?: string
}>()

const emit = defineEmits<{
  'submit-names': []
  'edit-chart-names': []
  'cancel-chart-names': []
}>()

const clusterName = defineModel<string>('clusterName', { required: true })
const systemName = defineModel<string>('systemName', { required: true })
const clusterNameId = computed(() =>
  props.mode === 'cluster' ? 'cluster-detail-name' : 'detail-cluster-name',
)
const systemNameId = computed(() =>
  props.mode === 'cluster' ? 'system-detail-name' : 'detail-system-name',
)
const jumpPointCount = computed(() => jumpPointsInCluster(props.workspace.cluster).length)
</script>

<template>
  <template v-if="props.mode === 'cluster'">
    <span class="section-kicker">CLUSTER DETAILS</span>
    <h2 class="mt-[0.65rem] mb-[0.35rem] [overflow-wrap:anywhere] text-[1.65rem]">{{ props.workspace.cluster.name }}</h2>
    <p class="inspector-intro mb-[1em]">
      Choose a route to inspect its logical Jump Point endpoints, or edit the chart names.
    </p>
  </template>
  <template v-else-if="props.selectedSystem">
    <span class="section-kicker">CHART DETAILS</span>
    <h2 class="mt-[0.65rem] mb-[0.35rem] [overflow-wrap:anywhere] text-[1.65rem]">{{ props.selectedSystem.name }}</h2>
    <p class="inspector-intro mb-[1em]">
      Choose a map object or Orbit to inspect it, or edit the chart names.
    </p>
  </template>

  <form class="field-stack mt-4 grid gap-3" @submit.prevent="emit('submit-names')">
    <fieldset class="m-0 grid gap-3 border-0 p-0" :disabled="!props.chartNamesEditing || props.saving">
      <label :for="clusterNameId">Jump Cluster</label>
      <input :id="clusterNameId" v-model="clusterName" maxlength="80" required>
      <label :for="systemNameId">Star system</label>
      <input :id="systemNameId" v-model="systemName" maxlength="80" required>
    </fieldset>
    <p v-if="props.formError" class="feedback m-0 error-text" role="alert">{{ props.formError }}</p>
    <div class="flex flex-wrap gap-2">
      <button
        v-if="!props.chartNamesEditing"
        class="primary-button"
        type="button"
        aria-label="Edit chart names"
        @click="emit('edit-chart-names')"
      >
        Edit
      </button>
      <button v-else class="primary-button" type="submit" aria-label="Save chart names" :disabled="props.saving">
        Save
      </button>
      <button v-if="props.chartNamesEditing" class="quiet-button" type="button" @click="emit('cancel-chart-names')">
        Cancel
      </button>
    </div>
  </form>

  <div
    v-if="props.mode === 'cluster' || props.selectedSystem"
    class="orbit-facts my-4 grid grid-cols-[1fr_auto] gap-[0.55rem] border-y border-[var(--line-soft)] py-[0.8rem]"
  >
    <template v-if="props.mode === 'cluster'">
      <span>Star systems</span>
      <strong>{{ props.workspace.cluster.systems.length }}</strong>
      <span>Jump Routes</span>
      <strong>{{ props.workspace.cluster.routes.length }}</strong>
      <span>Logical Jump Points</span>
      <strong>{{ jumpPointCount }}</strong>
    </template>
    <template v-else-if="props.selectedSystem">
      <span>Map objects</span>
      <strong>{{ props.selectedSystem.objects.length }}</strong>
      <span>Nested Orbits</span>
      <strong>{{ props.selectedSystem.orbits.length }}</strong>
    </template>
  </div>
  <p v-if="props.mode === 'cluster' && props.editorError" class="feedback m-0 error-text" role="alert">
    {{ props.editorError }}
  </p>
</template>
