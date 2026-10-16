<template>
  <details class="prototype-state-peek">
    <summary>STATE / {{ state.view }} · {{ state.tool }} · {{ state.draft }}</summary>
    <pre>{{ JSON.stringify(state, null, 2) }}</pre>
  </details>
</template>

<script setup lang="ts">
defineProps<{ state: Record<string, string | number | undefined> }>()
</script>
