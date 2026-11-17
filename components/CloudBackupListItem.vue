<template>
  <li class="grid gap-2 rounded-md border border-[var(--line-soft)] p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
    <div class="grid min-w-0 gap-1">
      <span class="break-all font-medium">{{ props.name }}</span>
      <time class="text-sm text-muted" :datetime="props.timestamp">{{ formattedTimestamp }}</time>
    </div>

    <div class="flex flex-wrap gap-2 sm:items-center">
      <UButton
        color="primary"
        variant="solid"
        size="sm"
        :disabled="props.disabled"
        :aria-label="`Restore ${props.name}`"
        @click="emit('restore')"
      >
        Restore
      </UButton>
      <UButton
        color="neutral"
        variant="outline"
        size="sm"
        :disabled="props.disabled"
        :aria-label="`Download JSON for ${props.name}`"
        @click="emit('download')"
      >
        Download JSON
      </UButton>
      <slot name="delete" />
    </div>

    <slot name="confirmation" />
  </li>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  name: string
  timestamp: string
  disabled?: boolean
}>(), {
  disabled: false,
})
const emit = defineEmits<{
  restore: []
  download: []
}>()

const formattedTimestamp = computed(() => {
  const date = new Date(props.timestamp)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
})
</script>
