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
      description="Find the Jump Cluster or a star system by name."
      :dismissible="true"
      :content="{ onOpenAutoFocus: focusSearchOnOpen, onCloseAutoFocus: focusAfterSearchClose }"
      :ui="{ content: 'workspace-search-dialog-content max-h-[calc(100dvh-1rem)] overflow-hidden', body: 'min-h-0 overflow-hidden' }"
    >
      <template #body>
        <div ref="searchBody" class="workspace-search-body">
          <UFormField label="Search workspace" class="workspace-search-field">
            <UInput
              class="w-full"
              id="workspace-search-input"
              v-model="query"
              type="search"
              autocomplete="off"
              aria-controls="workspace-search-results"
              @keydown="handleQueryKeydown"
            />
          </UFormField>

          <p v-if="!query.trim()" class="workspace-search-hint" role="status">
            Type a cluster or star system name to find it in this workspace.
          </p>
          <p v-else-if="!props.results.length" class="workspace-search-hint" role="status">
            No matches for “{{ query.trim() }}”.
          </p>
          <div v-else class="workspace-search-results-wrap">
            <p class="workspace-search-count" role="status" aria-live="polite">
              {{ props.results.length }} {{ props.results.length === 1 ? 'match' : 'matches' }}
            </p>
            <ul
              id="workspace-search-results"
              ref="resultList"
              class="workspace-search-results"
              aria-label="Search results"
            >
              <li v-for="result in props.results" :key="result.key">
                <UButton
                  class="workspace-search-result"
                  color="neutral"
                  variant="ghost"
                  size="lg"
                  type="button"
                  :aria-label="resultAccessibleName(result)"
                  @keydown="handleResultKeydown"
                  @click="activateResult(result)"
                >
                  <span class="workspace-search-result-name">{{ result.name }}</span>
                  <span class="workspace-search-result-context">
                    <span>{{ result.typeLabel }} · {{ result.contextLabel }}</span>
                    <span v-if="result.occurrence !== null" class="workspace-search-occurrence">
                      Occurrence {{ result.occurrence }}
                    </span>
                  </span>
                  <UIcon name="i-lucide-arrow-up-right" aria-hidden="true" />
                </UButton>
              </li>
            </ul>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { useDialogCloseFocusBarrier } from '../composables/useDialogCloseFocusBarrier'
import type { SearchResult, SearchTarget } from '../utils/workspace-search'

type RevealOutcome =
  | { status: 'revealed' }
  | { status: 'rejected'; reason: 'guard' | 'stale' | 'unavailable' }

const props = defineProps<{
  results: readonly SearchResult[]
  reveal: (target: SearchTarget) => Promise<RevealOutcome>
}>()

const open = defineModel<boolean>('open', { required: true })
const query = defineModel<string>('query', { required: true })
const closeFocus = useDialogCloseFocusBarrier(open)
const searchOpener = ref<HTMLElement | null>(null)
const searchBody = ref<HTMLElement | null>(null)
const resultList = ref<HTMLUListElement | null>(null)
let returnToOpener = true

function focusableElement(element: Element | null): HTMLElement | null {
  if (element instanceof HTMLElement) return element
  return element instanceof SVGElement ? element.closest<HTMLElement>('button, a[href], [tabindex]') : null
}

function focusSearchInput(): void {
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

function focusResult(index: number): void {
  const buttons = resultList.value?.querySelectorAll<HTMLButtonElement>('button')
  if (!buttons?.length) return
  buttons[Math.max(0, Math.min(index, buttons.length - 1))]?.focus()
}

function handleQueryKeydown(event: KeyboardEvent): void {
  if (event.isComposing || event.keyCode === 229) return
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    open.value = false
    return
  }
  if (event.key === 'ArrowDown' && props.results.length) {
    event.preventDefault()
    focusResult(0)
  }
}

function handleResultKeydown(event: KeyboardEvent): void {
  if (event.isComposing || event.keyCode === 229) return
  const buttons = [...(resultList.value?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
  const index = buttons.indexOf(event.currentTarget as HTMLButtonElement)
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    focusResult((index + 1) % buttons.length)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    if (index === 0) searchBody.value?.querySelector<HTMLInputElement>('#workspace-search-input')?.focus()
    else focusResult(index - 1)
  } else if (event.key === 'Home') {
    event.preventDefault()
    focusResult(0)
  } else if (event.key === 'End') {
    event.preventDefault()
    focusResult(buttons.length - 1)
  }
}

function resultAccessibleName(result: SearchResult): string {
  const occurrence = result.occurrence === null ? '' : `, occurrence ${result.occurrence}`
  return `${result.name}, ${result.typeLabel}, ${result.contextLabel}${occurrence}`
}

function anotherModalOwnsFocus(): boolean {
  const activeElement = document.activeElement
  return [...document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')]
    .some(dialog => !dialog.classList.contains('workspace-search-dialog-content')
      && dialog.getAttribute('data-state') !== 'closed'
      && activeElement instanceof Node
      && dialog.contains(activeElement))
}

async function activateResult(result: SearchResult): Promise<void> {
  returnToOpener = false
  const outcome = await props.reveal(result.target)
  if (outcome.status === 'revealed') return

  returnToOpener = true
  await nextTick()
  if (!anotherModalOwnsFocus()) focusSearchInput()
}

defineExpose({ whenClosingFocusSettled: closeFocus.whenClosingFocusSettled })
</script>

<style scoped>
.workspace-search-entry {
  display: flex;
  flex: 0 0 auto;
}

.workspace-search-body {
  display: grid;
  min-height: 0;
  gap: 0.85rem;
}

.workspace-search-field {
  display: grid;
  gap: 0.35rem;
}

.workspace-search-hint {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.875rem;
  line-height: 1.45;
}

.workspace-search-results-wrap {
  display: grid;
  min-height: 0;
  gap: 0.35rem;
}

.workspace-search-count {
  margin: 0;
  color: var(--text-muted);
  font: 0.65rem Consolas, monospace;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.workspace-search-results {
  display: grid;
  max-height: min(55dvh, 34rem);
  min-height: 0;
  gap: 0.3rem;
  overflow: auto;
  margin: 0;
  padding: 0.1rem;
  list-style: none;
  overscroll-behavior: contain;
}

.workspace-search-result {
  display: grid;
  width: 100%;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr) auto;
  justify-content: stretch;
  gap: 0.18rem 0.8rem;
  border: 1px solid var(--line-soft);
  border-radius: 0.3rem;
  padding: 0.65rem 0.75rem;
  text-align: left;
  white-space: normal;
}

.workspace-search-result-name,
.workspace-search-result-context {
  min-width: 0;
  overflow-wrap: anywhere;
}

.workspace-search-result-name {
  grid-column: 1;
  color: var(--text-primary);
  font-family: Georgia, serif;
  font-size: 1rem;
  line-height: 1.2;
}

.workspace-search-result-context {
  display: flex;
  grid-column: 1;
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

.workspace-search-result :deep(svg) {
  grid-column: 2;
  grid-row: 1 / span 2;
  align-self: center;
  color: var(--accent);
}

.workspace-search-result:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}
</style>

<style>
.workspace-search-dialog-content {
  width: min(42rem, calc(100vw - 1.25rem));
}

.workspace-search-dialog-content button:focus-visible,
.workspace-search-dialog-content input:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
  transition: none;
}
</style>
