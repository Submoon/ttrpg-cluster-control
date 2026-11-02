<template>
  <section class="player-share-controls" aria-label="Player snapshot link">
    <p class="m-0 text-xs text-[var(--text-muted)]">
      Each link is an immutable snapshot anyone with it can read and copy. Generate another after publication changes.
      If the complete URL is too large or link sharing is unavailable, use Export player JSON.
    </p>

    <UButton
      class="workspace-control workspace-map-file-button"
      color="primary"
      variant="soft"
      size="sm"
      aria-label="Generate player link"
      title="Generate a link to the current public snapshot"
      :loading="props.busy"
      :disabled="props.busy"
      @click="emit('generate')"
    >
      Generate player link
    </UButton>

    <UFormField v-if="props.url" label="Player snapshot link">
      <UInput
        :model-value="props.url"
        type="url"
        readonly
        autocomplete="off"
        class="w-full"
        aria-label="Player snapshot link"
      />
    </UFormField>

    <UButton
      v-if="props.url"
      class="workspace-control workspace-map-file-button"
      color="primary"
      variant="outline"
      size="sm"
      aria-label="Copy player link"
      :disabled="props.busy"
      @click="emit('copy')"
    >
      Copy player link
    </UButton>

    <p v-if="props.status" class="m-0 text-xs" role="status" aria-live="polite">
      {{ props.status }}
    </p>
  </section>
</template>

<script setup lang="ts">
const props = defineProps<{
  url: string
  busy: boolean
  status: string
}>()

const emit = defineEmits<{
  generate: []
  copy: []
}>()
</script>

<style scoped>
.player-share-controls {
  display: grid;
  min-width: 0;
  gap: 0.5rem;
}
</style>
