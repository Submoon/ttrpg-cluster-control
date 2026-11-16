<template>
  <UTooltip
    :open="open"
    :text="text"
    :reference="item"
    :content="{ side: 'left', collisionPadding: 8, onEscapeKeyDown: closeHint }"
    :ui="{
      content: 'pointer-events-none z-[90] h-auto max-w-60 data-[state=closed]:animate-none',
      text: 'whitespace-normal',
    }"
    disable-hoverable-content
  >
    <span><slot /></span>
  </UTooltip>
  <span :id="hintId" ref="description" hidden>{{ text }}</span>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, useId, useTemplateRef } from 'vue'

defineProps<{ text: string }>()

const description = useTemplateRef('description')
const item = shallowRef<HTMLElement>()
const open = ref(false)
const hintId = useId()
const listeners = new AbortController()

function closeHint(): void {
  open.value = false
}

onMounted(() => {
  const row = description.value?.closest<HTMLElement>('[role="menuitem"]')
  if (!row) return
  item.value = row
  row.setAttribute('aria-describedby', hintId)
  const options = { signal: listeners.signal }
  row.addEventListener('focus', () => { if (row.matches(':focus-visible')) open.value = true }, options)
  row.addEventListener('blur', closeHint, options)
  row.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') open.value = true }, options)
  row.addEventListener('pointerleave', () => { open.value = row.matches(':focus-visible') }, options)
})

onBeforeUnmount(() => listeners.abort())
</script>
