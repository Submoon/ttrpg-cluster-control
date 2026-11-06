<template>
  <UDropdownMenu
    :open="Boolean(props.request)"
    :items="items"
    :modal="true"
    :content="contentOptions"
    :ui="{ content: 'min-w-48' }"
    @update:open="onOpenChange"
  >
    <template #default>
      <span class="pointer-events-none sr-only" tabindex="-1">Player visibility</span>
    </template>
    <template #content-top>
      <span :ref="captureMenuContent" class="hidden" aria-hidden="true" />
    </template>
  </UDropdownMenu>
</template>

<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import type { PublicationMode } from '../domain/workspace'
import type { PublicationMenuView } from '../composables/editor-workflows/publication-types'
import { publicationModes, publicationPresentation } from '../utils/publication-presentation'

const props = defineProps<{
  request: PublicationMenuView | null
  currentMode: PublicationMode | null
  busy?: boolean
}>()

const emit = defineEmits<{
  select: [mode: PublicationMode]
  dismiss: []
}>()

const virtualAnchor = computed(() => ({
  getBoundingClientRect() {
    const point = props.request?.clientPoint ?? { x: 0, y: 0 }
    return new DOMRect(point.x, point.y, 0, 0)
  },
}))

const contentOptions = computed(() => ({
  reference: virtualAnchor.value,
  side: 'bottom' as const,
  align: 'start' as const,
  sideOffset: 0,
  collisionPadding: 8,
  onCloseAutoFocus,
}))

const requestByContent = new WeakMap<Element, PublicationMenuView>()
const contentAnchor = shallowRef<Element | null>(null)

function rememberContent(content: Element, request: PublicationMenuView): void {
  requestByContent.set(content, request)
  // Reka dispatches close autofocus from the Popper wrapper, outside the inner menu element.
  const scope = content.closest('[data-reka-popper-content-wrapper]')
  if (scope) requestByContent.set(scope, request)
}

function captureMenuContent(value: unknown): void {
  const anchor = value instanceof Element ? value : null
  contentAnchor.value = anchor
  const request = props.request
  const content = anchor?.closest('[role="menu"]')
  if (request && content) rememberContent(content, request)
}

watch(() => props.request, (request) => {
  const content = contentAnchor.value?.closest('[role="menu"]')
  if (request && content) rememberContent(content, request)
}, { flush: 'sync' })

const items = computed(() => publicationModes.map((mode) => {
  const presentation = publicationPresentation(mode)
  const current = props.currentMode === mode
  return {
    type: 'checkbox' as const,
    checked: current,
    label: presentation.label,
    icon: presentation.icon,
    disabled: props.busy,
    onUpdateChecked: () => undefined,
    onSelect: () => emit('select', mode),
  }
}))

function onOpenChange(open: boolean): void {
  if (!open) emit('dismiss')
}

function onCloseAutoFocus(event: Event): void {
  event.preventDefault()
  const content = event.target instanceof Element ? event.target : null
  const request = content ? requestByContent.get(content) : null
  if (request) void request.restoreFocus(content)
}
</script>
