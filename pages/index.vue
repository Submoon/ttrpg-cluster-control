<script setup lang="ts">
const route = useRoute()

const variant = computed(() => {
  const value = route.query.variant
  if (value === 'baseline') return null
  return value === 'A' || value === 'B' || value === 'C' ? value : null
})
</script>

<template>
  <PrototypeWorkbench v-if="variant" :initial-variant="variant" />
  <BaselinePage v-else />
</template>
