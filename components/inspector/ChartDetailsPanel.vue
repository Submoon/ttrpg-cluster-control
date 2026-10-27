<template>
  <UCard
    class="chart-details-summary chart-details-card"
    variant="outline"
    :ui="{
      root: 'flex h-full min-h-0 flex-col rounded-[2px] overflow-hidden',
      header: 'shrink-0 px-4 py-3 sm:px-5',
      body: 'min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5',
      footer: 'shrink-0 border-t border-[var(--line-soft)] px-4 py-3 sm:px-5',
    }"
    role="region"
    :aria-label="detailsRegionLabel"
  >
    <template #header>
      <div class="chart-details-card-heading">
        <span class="section-kicker">{{ props.mode === 'cluster' ? 'CLUSTER DETAILS' : 'CHART DETAILS' }}</span>
        <h2 class="mt-2 mb-0 [overflow-wrap:anywhere] text-[1.65rem]">
          {{ props.mode === 'cluster' ? props.workspace.cluster.name : props.selectedSystem?.name }}
        </h2>
      </div>
    </template>

    <p class="inspector-intro mb-0">
      {{ props.mode === 'cluster'
        ? 'Choose a route to inspect its logical Jump Point endpoints, or edit the chart names.'
        : 'Choose a map object or Orbit to inspect it, or edit the chart names.' }}
    </p>

    <template #footer>
      <div class="chart-details-actions grid gap-2" :class="{ 'chart-details-actions--system': props.allowOpenSystem && props.mode === 'system' && props.selectedSystem }">
        <UButton block class="w-full min-w-0 justify-center" color="primary" variant="outline" @click="emit('edit-chart-names', props.mode === 'system' ? props.selectedSystem?.id : undefined)">
          {{ props.hasChartNameDraft ? 'Resume chart name draft' : 'Edit chart names' }}
        </UButton>
        <UButton
          v-if="props.allowOpenSystem && props.mode === 'system' && props.selectedSystem"
          block
          class="w-full min-w-0 justify-center"
          color="primary"
          @click="emit('open-system', props.selectedSystem.id)"
        >
          Open system
        </UButton>
        <span v-if="props.hasChartNameDraft" class="chart-details-draft-status save-feedback text-center text-sm" role="status">
          Chart-name editing session
        </span>
      </div>
    </template>

    <USeparator v-if="props.mode === 'cluster' || props.selectedSystem" class="my-4" />
    <div
      v-if="props.mode === 'cluster' || props.selectedSystem"
      role="region"
      :aria-label="statisticsRegionLabel"
      class="orbit-facts grid grid-cols-[1fr_auto] gap-[0.55rem]"
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
    <div v-if="props.mode === 'system' && props.selectedSystem" class="chart-details-system-delete">
      <p v-if="props.workspace.cluster.systems.length <= 1" id="chart-details-system-delete-restriction" class="inspector-intro m-0" role="status">
        A Jump Cluster must keep at least one star system.
      </p>
      <UButton
        color="error"
        variant="outline"
        :disabled="props.saving || props.workspace.cluster.systems.length <= 1"
        :aria-label="`Delete ${props.selectedSystem.name} system`"
        :aria-describedby="props.workspace.cluster.systems.length <= 1 ? 'chart-details-system-delete-restriction' : undefined"
        @click="emit('delete-system', props.selectedSystem.id)"
      >
        Delete system…
      </UButton>
    </div>
  </UCard>
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
  saving: boolean
  allowOpenSystem?: boolean
}>()

const emit = defineEmits<{
  'edit-chart-names': [targetSystemId?: string]
  'open-system': [systemId: string]
  'delete-system': [systemId: string]
}>()
const jumpPointCount = computed(() => jumpPointsInCluster(props.workspace.cluster).length)
const starCount = computed(() => props.selectedSystem?.objects.filter(object => object.subtype === 'star').length ?? 0)
const detailsRegionLabel = computed(() => props.mode === 'cluster' ? 'Jump Cluster details' : 'Star System details')
const statisticsRegionLabel = computed(() => props.mode === 'cluster' ? 'Jump Cluster statistics' : 'Star System statistics')
</script>

<style scoped>
.chart-details-card-heading { min-width: 0; }
.chart-details-actions--system { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.chart-details-draft-status { grid-column: 1 / -1; }
.chart-details-system-delete {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
  border-top: 1px solid var(--line-soft);
  padding-top: 0.75rem;
}
</style>
