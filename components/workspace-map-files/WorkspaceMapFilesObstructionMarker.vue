<template>
  <span ref="marker" class="hidden" aria-hidden="true" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef } from 'vue'

const marker = useTemplateRef('marker')
let content: HTMLElement | null = null

onMounted(() => {
  content = marker.value?.closest<HTMLElement>('[data-slot="content"]') ?? null
  content?.setAttribute('data-map-obstruction', '')
})

onBeforeUnmount(() => content?.removeAttribute('data-map-obstruction'))
</script>
