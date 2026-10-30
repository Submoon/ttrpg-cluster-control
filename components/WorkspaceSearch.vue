<template>
  <div class="workspace-search-entry">
    <UButton
      class="workspace-control workspace-map-search"
      color="neutral"
      variant="outline"
      size="sm"
      aria-label="Search"
      aria-haspopup="dialog"
      :aria-expanded="open"
      @click="open = true"
    >
      <UIcon name="i-lucide-search" aria-hidden="true" />
      Search
    </UButton>

    <UModal
      v-model:open="open"
      title="Search workspace"
      description="Find the Jump Cluster or any star system by name, or any object in the workspace by name or Location key."
      :dismissible="true"
      :content="{ onOpenAutoFocus: focusSearchOnOpen, onCloseAutoFocus: focusAfterSearchClose }"
      :ui="{
        content: 'workspace-search-dialog-content max-h-[calc(100dvh-1rem)] overflow-hidden',
        body: 'flex min-h-0 flex-col overflow-hidden',
      }"
    >
      <template #body>
        <div ref="searchBody" class="workspace-search-body">
          <p
            v-if="query.trim() && props.results.length"
            class="workspace-search-count"
            role="status"
            aria-live="polite"
          >
            {{ props.results.length }} {{ props.results.length === 1 ? 'match' : 'matches' }}
          </p>

          <!-- @vue-generic {WorkspaceSearchPaletteGroup, WorkspaceSearchPaletteItem} -->
          <UCommandPalette
            v-model:search-term="query"
            class="workspace-search-palette"
            :groups="paletteGroups"
            :input="paletteInputProps"
            :fuse="{ resultLimit: Math.max(1, props.results.length) }"
            :autofocus="false"
            :back="false"
            :close="false"
            :highlight-on-hover="false"
            :preserve-group-order="true"
            :search-delay="0"
            :value-key="'key'"
            :label-key="'label'"
            :description-key="'description'"
            :virtualize="false"
            :ui="{
              root: 'workspace-search-palette-root',
              input: 'workspace-search-palette-input',
              content: 'workspace-search-palette-content',
              viewport: 'workspace-search-palette-viewport',
              item: 'workspace-search-result',
            }"
            @keydown.capture="handlePaletteKeydown"
            @compositionstart="handleCompositionStart"
            @compositionend="handleCompositionEnd"
            @pointerdown.capture="handlePalettePointerDown"
          >
            <template #item="{ item }">
              <span class="workspace-search-result-name">{{ item.result.name }}</span>
              <span class="workspace-search-result-context">
                <span>{{ item.result.typeLabel }} · {{ item.result.contextLabel }}</span>
                <span v-if="item.result.locationKey" class="workspace-search-location-key">
                  Location key: {{ item.result.locationKey }}
                </span>
                <span v-if="item.result.occurrence !== null" class="workspace-search-occurrence">
                  Occurrence {{ item.result.occurrence }}
                </span>
              </span>
            </template>

            <template #empty>
              <p class="workspace-search-hint" role="status">
                {{ query.trim()
                  ? `No matches for “${query.trim()}”.`
                  : 'Type a cluster or star system name, or an object name or Location key from any star system.' }}
              </p>
            </template>
          </UCommandPalette>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { CommandPaletteGroup, CommandPaletteItem } from '@nuxt/ui/components/CommandPalette.vue'
import { useDialogCloseFocusBarrier } from '../composables/useDialogCloseFocusBarrier'
import type { SearchResult, SearchTarget } from '../utils/workspace-search'

type RevealOutcome =
  | { status: 'revealed' }
  | { status: 'rejected'; reason: 'guard' | 'stale' | 'unavailable' }

type WorkspaceSearchPaletteItem = CommandPaletteItem & {
  key: string
  label: string
  description: string
  result: SearchResult
}
type WorkspaceSearchPaletteGroup = CommandPaletteGroup<WorkspaceSearchPaletteItem>

const props = defineProps<{
  results: readonly SearchResult[]
  reveal: (target: SearchTarget) => Promise<RevealOutcome>
}>()

const open = defineModel<boolean>('open', { required: true })
const query = defineModel<string>('query', { required: true })
const closeFocus = useDialogCloseFocusBarrier(open)
const searchOpener = ref<HTMLElement | null>(null)
const searchBody = ref<HTMLElement | null>(null)
const resultsMode = ref(false)
const isComposing = ref(false)
let returnToOpener = true
let selectionGeneration = 0

const paletteInputProps = {
  id: 'workspace-search-input',
  type: 'search',
  role: 'combobox',
  'aria-label': 'Search workspace',
  'aria-controls': 'workspace-search-results',
  'aria-expanded': 'true',
  'aria-haspopup': 'listbox',
  autocomplete: 'off',
}

const paletteGroups = computed<WorkspaceSearchPaletteGroup[]>(() => [{
  id: 'workspace-search-results',
  ignoreFilter: true,
  items: props.results.map(result => ({
    key: result.key,
    label: result.name,
    description: `${result.typeLabel} · ${result.contextLabel}`,
    result,
    onSelect: (event: Event) => selectResult(event, result),
  })),
}])

watch(query, () => { resultsMode.value = false })
watch(open, (isOpen) => {
  resultsMode.value = false
  isComposing.value = false
  if (!isOpen) selectionGeneration += 1
})

function focusableElement(element: Element | null): HTMLElement | null {
  if (element instanceof HTMLElement) return element
  return element instanceof SVGElement ? element.closest<HTMLElement>('button, a[href], [tabindex]') : null
}

function focusSearchInput(): void {
  // Nuxt UI exposes no content ref or content-id prop, so associate the combobox with its actual listbox here.
  const listbox = searchBody.value?.querySelector<HTMLElement>('[role="listbox"]')
  if (listbox) {
    listbox.id = 'workspace-search-results'
    listbox.setAttribute('aria-label', 'Search results')
  }
  searchBody.value?.querySelector<HTMLInputElement>('#workspace-search-input')?.focus()
}

function focusSearchOnOpen(event: Event): void {
  searchOpener.value = focusableElement(document.activeElement)
  event.preventDefault()
  void nextTick(focusSearchInput)
}

function isVisibleFocusTarget(element: HTMLElement): boolean {
  return element.isConnected
    && !element.matches(':disabled')
    && element.getClientRects().length > 0
    && getComputedStyle(element).visibility !== 'hidden'
}

function focusAfterSearchClose(event: Event): void {
  event.preventDefault()
  if (open.value) {
    closeFocus.settleClosingFocus()
    return
  }
  if (!returnToOpener) {
    searchOpener.value = null
    returnToOpener = true
    closeFocus.settleClosingFocus()
    return
  }
  if (searchOpener.value && isVisibleFocusTarget(searchOpener.value)) searchOpener.value.focus()
  searchOpener.value = null
  closeFocus.settleClosingFocus()
}

function isSearchInput(target: EventTarget | null): target is HTMLInputElement {
  return target instanceof HTMLInputElement && target.id === 'workspace-search-input'
}

function handlePaletteKeydown(event: KeyboardEvent): void {
  if (!isSearchInput(event.target)) return
  if (isComposing.value || event.isComposing || event.keyCode === 229) {
    event.stopPropagation()
    return
  }

  if ((event.ctrlKey || event.metaKey || event.altKey || event.shiftKey)
    && ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
    event.stopPropagation()
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    open.value = false
    return
  }

  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    resultsMode.value = false
    return
  }

  const activeId = event.target.getAttribute('aria-activedescendant')
  const firstOptionId = searchBody.value?.querySelector<HTMLElement>('[role="option"]')?.id
  if (event.key === 'ArrowDown') {
    if (!props.results.length) return
    if (!resultsMode.value && firstOptionId && activeId === firstOptionId) {
      event.preventDefault()
      event.stopPropagation()
    }
    resultsMode.value = true
    return
  }

  if (event.key === 'ArrowUp') {
    if (!props.results.length) return
    if (resultsMode.value && firstOptionId && activeId === firstOptionId) {
      event.preventDefault()
      event.stopPropagation()
      resultsMode.value = false
      return
    }
    resultsMode.value = true
    return
  }

  if (event.key === 'Home' || event.key === 'End') {
    if (!resultsMode.value || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) {
      event.stopPropagation()
    }
  }
}

function handlePalettePointerDown(event: PointerEvent): void {
  if (isSearchInput(event.target)) resultsMode.value = false
}

function handleCompositionStart(): void {
  isComposing.value = true
  resultsMode.value = false
}

function handleCompositionEnd(): void {
  isComposing.value = false
}

function anotherModalOwnsFocus(): boolean {
  const activeElement = document.activeElement
  return [...document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')]
    .some(dialog => !dialog.classList.contains('workspace-search-dialog-content')
      && dialog.getAttribute('data-state') !== 'closed'
      && activeElement instanceof Node
      && dialog.contains(activeElement))
}

function selectResult(event: Event, result: SearchResult): void {
  event.preventDefault()
  focusSearchInput()
  returnToOpener = false
  const selection = ++selectionGeneration
  void activateResult(result, selection)
}

async function activateResult(result: SearchResult, selection: number): Promise<void> {
  const outcome = await props.reveal(result.target)
  if (outcome.status === 'revealed' || selection !== selectionGeneration || !open.value) return

  returnToOpener = true
  await nextTick()
  if (selection === selectionGeneration && open.value && !anotherModalOwnsFocus()) focusSearchInput()
}

defineExpose({ whenClosingFocusSettled: closeFocus.whenClosingFocusSettled })
</script>

<style scoped>
.workspace-search-entry {
  display: flex;
  flex: 0 0 auto;
}

.workspace-search-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  gap: 0.5rem;
}

.workspace-search-count {
  flex: 0 0 auto;
  margin: 0;
  color: var(--text-muted);
  font: 0.65rem Consolas, monospace;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.workspace-search-hint {
  margin: 0;
  padding: 0.75rem;
  color: var(--text-secondary);
  font-size: 0.875rem;
  line-height: 1.45;
}

.workspace-search-result-name,
.workspace-search-result-context {
  min-width: 0;
  overflow-wrap: anywhere;
}

.workspace-search-result-name {
  color: var(--text-primary);
  font-family: Georgia, serif;
  font-size: 1rem;
  line-height: 1.2;
}

.workspace-search-result-context {
  display: flex;
  flex-wrap: wrap;
  gap: 0.15rem 0.5rem;
  color: var(--text-muted);
  font-size: 0.72rem;
  line-height: 1.35;
}

.workspace-search-occurrence {
  color: var(--accent-hover);
  font-variant-numeric: tabular-nums;
}

</style>

<style>
.workspace-search-dialog-content {
  width: min(42rem, calc(100vw - 1.25rem));
}

.workspace-search-dialog-content .workspace-search-palette-content {
  max-height: min(55dvh, 34rem);
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.workspace-search-dialog-content .workspace-search-palette-root {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.workspace-search-dialog-content .workspace-search-palette-input {
  flex: 0 0 auto;
}

.workspace-search-dialog-content .workspace-search-palette-viewport {
  max-height: min(55dvh, 34rem);
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.workspace-search-dialog-content .workspace-search-result {
  display: grid;
  width: 100%;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr);
  justify-content: stretch;
  gap: 0.18rem;
  border: 1px solid var(--line-soft);
  border-radius: 0.3rem;
  padding: 0.65rem 0.75rem;
  text-align: left;
  white-space: normal;
}

.workspace-search-dialog-content .workspace-search-result[data-highlighted] {
  outline: 2px solid var(--focus);
  outline-offset: -2px;
}
</style>
