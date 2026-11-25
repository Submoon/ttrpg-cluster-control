<template>
  <g ref="decoration" aria-hidden="true" pointer-events="none" />
</template>

<script setup lang="ts">
import { useTemplateRef, watchEffect } from 'vue'
import type { PublicationMode } from '../../domain/workspace'
import { appendPublicationBadge } from '../../utils/gm-publication-badges'

const props = defineProps<{
  identity: string
  mode?: PublicationMode
  parentPublication?: PublicationMode
}>()

const decoration = useTemplateRef<SVGGElement>('decoration')

watchEffect((onCleanup) => {
  if (!decoration.value || !props.mode) return
  const badge = appendPublicationBadge(decoration.value, {
    identity: props.identity,
    mode: props.mode,
    parentPublication: props.parentPublication,
    position: { x: 0, y: 0 },
  })
  onCleanup(() => badge.remove())
}, { flush: 'post' })
</script>

<style scoped>
:deep(.gm-publication-badge) { color: var(--map-text); }

:deep(.gm-publication-lock-icon) {
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}

:deep(.gm-publication-badge-backing),
:deep(.gm-publication-lock-backing) {
  fill: var(--map-bg);
  stroke: var(--map-grid-line);
  stroke-width: 1.25;
}
</style>
