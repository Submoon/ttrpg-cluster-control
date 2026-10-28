<template>
  <p
    v-if="props.purpose === 'add'"
    class="cluster-system-placement-guidance"
    role="status"
  >
    Click a clear point on the Cluster map to add a system.
  </p>
  <UButton
    v-else
    class="workspace-control cluster-system-placement-trigger"
    color="neutral"
    variant="outline"
    size="sm"
    aria-label="Move selected system on map"
    @click="emit('begin-map-move')"
  >
    <UIcon name="i-lucide-move" aria-hidden="true" />
    Move selected system on map
  </UButton>
</template>

<script setup lang="ts">
const props = defineProps<{
  purpose: 'add' | 'move'
}>()

const emit = defineEmits<{
  'begin-map-move': []
}>()
</script>

<style scoped>
.cluster-system-placement-guidance {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.75rem;
}
</style>