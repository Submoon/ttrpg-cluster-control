<template>
  <UTooltip
    :open="open"
    :text="text"
    :reference="props.trigger ?? undefined"
    :content="{ side: 'bottom', collisionPadding: 8, onEscapeKeyDown: closeHint }"
    :ui="{
      content: 'pointer-events-none z-[90] h-auto max-w-60 data-[state=closed]:animate-none',
      text: 'whitespace-normal',
    }"
    disable-hoverable-content
  >
    <span aria-hidden="true" class="hidden" />
  </UTooltip>
  <span :id="hintId" hidden>{{ text }}</span>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, useId, watch } from 'vue'

const props = defineProps<{ trigger: HTMLElement | null; text: string }>()
const open = ref(false)
const hintId = useId()
let listeners: AbortController | null = null

function closeHint(): void {
  open.value = false
}

function bindTrigger(trigger: HTMLElement | null): void {
  listeners?.abort()
  listeners = null
  if (!trigger) return
  trigger.setAttribute('aria-describedby', hintId)
  listeners = new AbortController()
  const options = { signal: listeners.signal }
  trigger.addEventListener('focus', () => { if (trigger.matches(':focus-visible')) open.value = true }, options)
  trigger.addEventListener('blur', closeHint, options)
  trigger.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') open.value = true }, options)
  trigger.addEventListener('pointerleave', () => { open.value = trigger.matches(':focus-visible') }, options)
  trigger.addEventListener('click', closeHint, options)
}

watch(() => props.trigger, bindTrigger, { immediate: true })
onBeforeUnmount(() => listeners?.abort())
</script>
