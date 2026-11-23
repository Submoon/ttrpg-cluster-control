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
      <span class="pointer-events-none sr-only" tabindex="-1">Map item actions</span>
    </template>
    <template #content-top="{ sub }">
      <span v-if="!sub" :ref="captureMenuContent" class="hidden" aria-hidden="true" />
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
  routeShared?: boolean
  emptyOrbit?: boolean
  lastSystem?: boolean
  saving?: boolean
  busy?: boolean
  moveSelectionAvailable?: boolean
}>()

const emit = defineEmits<{
  select: [mode: PublicationMode]
  'share-route': [shared: boolean]
  edit: []
  delete: []
  'move-selection': []
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

const items = computed(() => [
  {
    label: 'Edit',
    icon: 'i-lucide-pencil',
    disabled: props.busy,
    onSelect: () => emit('edit'),
  },
  ...(props.moveSelectionAvailable ? [{
    label: 'Move selection',
    icon: 'i-lucide-move',
    disabled: props.busy,
    onSelect: () => emit('move-selection'),
  }] : []),
  {
    label: 'Change Visibility',
    icon: 'i-lucide-eye',
    disabled: props.busy || props.emptyOrbit,
    content: {
      prioritizePosition: true,
      collisionPadding: 8,
    },
    children: props.request?.target.kind === 'route'
      ? [false, true].map(shared => ({
          type: 'checkbox' as const,
          checked: props.routeShared === shared,
          label: shared ? 'Shared with players' : 'Private',
          icon: shared ? 'i-lucide-eye' : 'i-lucide-eye-off',
          onUpdateChecked: () => undefined,
          onSelect: () => emit('share-route', shared),
        }))
      : [
          ...(props.request?.target.kind === 'orbit'
            ? [{ type: 'label' as const, label: 'Objects on this Orbit and its branches' }]
            : []),
          ...publicationModes.map((mode) => {
            const presentation = publicationPresentation(mode)
            return {
              type: 'checkbox' as const,
              checked: props.currentMode === mode,
              label: presentation.label,
              icon: presentation.icon,
              onUpdateChecked: () => undefined,
              onSelect: () => emit('select', mode),
            }
          }),
        ],
  },
  {
    label: 'Delete',
    description: props.lastSystem ? 'A Jump Cluster must keep at least one star system.' : undefined,
    icon: 'i-lucide-trash-2',
    color: 'error' as const,
    disabled: props.busy || props.lastSystem || props.saving,
    onSelect: () => emit('delete'),
  },
])

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
