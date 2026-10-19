<template>
  <section class="chart-details-summary" role="region" :aria-label="detailsRegionLabel">
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

  <div class="mt-4 flex flex-wrap items-center gap-2">
    <UButton color="primary" variant="outline" @click="emit('edit-chart-names', props.mode === 'system' ? props.selectedSystem?.id : undefined)">
      {{ props.hasChartNameDraft ? 'Resume chart name draft' : 'Edit chart names' }}
    </UButton>
    <span v-if="props.hasChartNameDraft" class="save-feedback text-sm" role="status">
      Chart-name editing session
    </span>
  </div>

  <div
    v-if="props.mode === 'cluster' || props.selectedSystem"
    role="region"
    :aria-label="statisticsRegionLabel"
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
      <span>Stars</span>
      <strong>{{ starCount }}</strong>
      <span>Nested Orbits</span>
      <strong>{{ props.selectedSystem.orbits.length }}</strong>
    </template>
  </div>
  <p v-if="props.mode === 'cluster' && props.editorError" class="feedback m-0 error-text" role="alert">
    {{ props.editorError }}
  </p>
  </section>
</template>

<script setup lang="ts">
/**
 * Shared chart-name editor and summary for Cluster and system views.
 */
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
  hasChartNameDraft: boolean
  editorError?: string
}>()

const emit = defineEmits<{
  'edit-chart-names': [targetSystemId?: string]
}>()
const jumpPointCount = computed(() => jumpPointsInCluster(props.workspace.cluster).length)
const starCount = computed(() => props.selectedSystem?.objects.filter(object => object.subtype === 'star').length ?? 0)
const detailsRegionLabel = computed(() => props.mode === 'cluster' ? 'Jump Cluster details' : 'Star System details')
const statisticsRegionLabel = computed(() => props.mode === 'cluster' ? 'Jump Cluster statistics' : 'Star System statistics')
</script>
