<template>
  <div class="contents">
    <div v-if="props.hasChartNameDraft" class="flex flex-wrap items-center gap-2" role="status" aria-live="polite">
      <span class="feedback">Unapplied chart-name changes</span>
      <UButton
        class="workspace-control resume-chart-draft"
        color="neutral"
        variant="outline"
        size="sm"
        @click="emit('resume-chart-draft')"
      >
        Resume chart name draft
      </UButton>
    </div>

    <span
      class="save-feedback p-0 text-sm"
      :class="{ 'error-text': props.saveState === 'error', 'saved-text': props.saveState === 'saved' }"
      :role="props.saveState === 'error' ? 'alert' : 'status'"
      :aria-live="props.saveState === 'error' ? 'assertive' : 'polite'"
    >
      <span class="inline-block size-[0.4rem] shrink-0 rounded-full bg-[var(--status-good)]" aria-hidden="true"></span>
      {{ props.saveMessage }}
    </span>

    <div v-if="props.saveState === 'error'" class="flex flex-wrap items-center gap-2">
      <UButton class="workspace-control" color="primary" variant="outline" size="sm" @click="emit('retry-save')">
        Retry save
      </UButton>
      <UButton class="workspace-control" color="neutral" variant="outline" size="sm" @click="emit('export-current-json')">
        Export current Jump Cluster JSON
      </UButton>
    </div>

    <p v-if="props.exportError" class="feedback m-0 error-text" role="alert" aria-live="assertive">
      Export failed: {{ props.exportError }}
    </p>
  </div>
</template>

<script setup lang="ts">
import type { SaveState } from '../composables/editor-workflows/types'

const props = defineProps<{
  hasChartNameDraft: boolean
  saveState: SaveState
  saveMessage: string
  exportError: string
}>()

const emit = defineEmits<{
  'resume-chart-draft': []
  'retry-save': []
  'export-current-json': []
}>()
</script>
