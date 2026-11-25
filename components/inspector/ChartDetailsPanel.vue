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
    aria-label="Jump Cluster details"
  >
    <template #header>
      <div class="chart-details-card-heading">
        <span class="section-kicker">Jump Cluster details</span>
        <h2 class="mt-2 mb-0 [overflow-wrap:anywhere] text-[1.65rem]">
          {{ props.mode === 'cluster' ? props.workspace.cluster.name : props.selectedSystem?.name }}
        </h2>
      </div>
    </template>

    <p class="inspector-intro mb-0">
      {{ props.mode === 'cluster'
        ? 'Choose a route to inspect its logical Jump Point endpoints, or review player-facing publication.'
        : 'Choose a map object or Orbit to inspect it, or review player-facing publication.' }}
    </p>

    <section class="chart-publication-summary mt-4" aria-label="Player publication settings">
      <span class="section-kicker">PLAYER PUBLICATION</span>
      <dl class="m-0 mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2">
        <dt>Player-facing title</dt>
        <dd class="m-0 text-right font-medium [overflow-wrap:anywhere]">{{ props.workspace.cluster.playerTitle }}</dd>
      </dl>
      <PublicationModeControl
        v-if="props.selectedSystem"
        class="mt-3"
        :model-value="props.selectedSystem.publication"
        presentation-context="system"
        :disabled="props.saving || props.publicationBusy"
        @select="setSystemPublication"
      />
    </section>

    <template v-if="chartEditSystemId || props.hasChartNameDraft" #footer>
      <div class="chart-details-actions grid gap-2">
        <UButton
          v-if="chartEditSystemId"
          block
          class="w-full min-w-0 justify-center"
          color="primary"
          variant="soft"
          aria-label="Edit Jump Cluster details"
          @click="commands.charts.beginNamesEdit(chartEditSystemId)"
        >
          Edit
        </UButton>
      </div>
      <span v-if="props.hasChartNameDraft" class="chart-details-draft-status save-feedback text-sm" role="status">
        Jump Cluster details editing session
      </span>
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
        <strong data-testid="stat-star-systems">{{ props.workspace.cluster.systems.length }}</strong>
        <span>Jump Routes</span>
        <strong data-testid="stat-jump-routes">{{ props.workspace.cluster.routes.length }}</strong>
        <span>Logical Jump Points</span>
        <strong data-testid="stat-logical-jump-points">{{ jumpPointCount }}</strong>
      </template>
      <template v-else-if="props.selectedSystem">
        <span>Map objects</span>
        <strong data-testid="stat-map-objects">{{ props.selectedSystem.objects.length }}</strong>
        <span>Stars</span>
        <strong data-testid="stat-stars">{{ starCount }}</strong>
        <span>Nested Orbits</span>
        <strong data-testid="stat-nested-orbits">{{ props.selectedSystem.orbits.length }}</strong>
      </template>
    </div>
    <p v-if="props.mode === 'cluster' && props.editorError" class="feedback m-0 error-text" role="alert">
      {{ props.editorError }}
    </p>
  </UCard>
</template>

<script setup lang="ts">
/**
 * Shared chart-details editor and summary for Cluster and system views.
 */
import { computed } from 'vue'
import {
  jumpPointsInCluster,
  type LocalWorkspace,
  type PublicationMode,
  type StarSystem,
} from '../../domain/workspace'
import { useEditorCommands } from '../../composables/editor-workflows/editor-command-context'

const props = defineProps<{
  mode: 'cluster' | 'system'
  workspace: LocalWorkspace
  selectedSystem?: StarSystem
  chartEditSystemId?: string
  hasChartNameDraft: boolean
  editorError?: string
  saving: boolean
  publicationBusy?: boolean
}>()

const commands = useEditorCommands()
const jumpPointCount = computed(() => jumpPointsInCluster(props.workspace.cluster).length)
const chartEditSystemId = computed(() => props.chartEditSystemId
  ?? props.selectedSystem?.id
  ?? props.workspace.cluster.systems[0]?.id)
const starCount = computed(() => props.selectedSystem?.objects.filter(object => object.subtype === 'star').length ?? 0)
const statisticsRegionLabel = computed(() => props.mode === 'cluster' ? 'Jump Cluster statistics' : 'Star System statistics')

function setSystemPublication(mode: PublicationMode): void {
  const system = props.selectedSystem
  if (!system) return
  void commands.publication.set({
    targets: [{ kind: 'system', id: system.id, systemId: system.id }],
    mode,
  })
}
</script>

<style scoped>
.chart-details-card-heading { min-width: 0; }
</style>
