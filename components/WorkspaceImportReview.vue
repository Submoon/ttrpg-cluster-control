<template>
  <UModal
    v-model:open="dialogOpen"
    title="Review import"
    description="Review the validated independent copy before adding it to this workspace."
    :dismissible="!props.confirming"
    :content="{ onOpenAutoFocus: captureOpener, onCloseAutoFocus: restoreFocus }"
    :ui="{
      content: 'workspace-import-review-content max-h-[calc(100dvh-2rem)] overflow-hidden max-[760px]:h-[calc(100dvh-1rem)] max-[760px]:max-h-none max-[760px]:w-[calc(100vw-1rem)]',
      body: 'min-h-0 overflow-y-auto',
      footer: 'shrink-0 border-t border-[var(--line-soft)]',
    }"
  >
    <template #body>
      <div v-if="props.summary" class="grid gap-4">
        <section class="grid gap-3" aria-label="Import effects">
          <div>
            <span class="section-kicker">INDEPENDENT COPY</span>
            <h2 class="mb-1 mt-2 break-words text-xl">
              Import this {{ props.summary.type === 'cluster' ? 'Jump Cluster' : 'star system' }} as an independent copy?
            </h2>
          </div>

          <ul class="m-0 grid gap-1 pl-5" aria-label="Import counts">
            <li>Star systems: {{ props.summary.systems }}</li>
            <li>Map objects: {{ props.summary.objects }}</li>
            <li>Orbits: {{ props.summary.orbits }}</li>
            <li>Jump Routes: {{ props.summary.routes }}</li>
            <li>Custom fields: {{ props.summary.customFields }}</li>
          </ul>

          <div class="grid gap-1">
            <h3 class="m-0 text-sm font-semibold">Original-ID collisions ({{ props.summary.idCollisions.length }}):</h3>
            <ul class="m-0 grid gap-1 pl-5">
              <li v-if="!props.summary.idCollisions.length">None</li>
              <li v-for="collision in props.summary.idCollisions" :key="`${collision.id}:${collision.entity}`" class="break-words">
                {{ collision.entity }} "{{ collision.name }}" [{{ collision.id }}]
              </li>
            </ul>
          </div>

          <div class="grid gap-1">
            <h3 class="m-0 text-sm font-semibold">
              Possible existing matches by name or location key ({{ props.summary.possibleMatches.length }}):
            </h3>
            <ul class="m-0 grid gap-1 pl-5">
              <li v-if="!props.summary.possibleMatches.length">None</li>
              <li
                v-for="(match, index) in props.summary.possibleMatches"
                :key="`${match.entity}:${match.existingSystem}:${match.reason}:${index}`"
                class="break-words"
              >
                {{ match.entity }} "{{ match.name }}" in "{{ match.existingSystem }}" ({{ match.reason }})
              </li>
            </ul>
          </div>

          <p class="inspector-intro m-0">
            Map entities remain separate copies and receive new IDs. Compatible custom field definitions are reused and their applicability targets are combined.
          </p>
        </section>

        <UAlert
          v-if="props.fieldConflict"
          color="warning"
          variant="subtle"
          :description="props.fieldConflict.message"
          role="status"
        />
        <UButton
          v-if="props.fieldConflict"
          class="justify-self-start"
          color="neutral"
          variant="outline"
          :disabled="props.confirming"
          @click="emit('review-fields')"
        >
          Review Fields draft
        </UButton>
        <UAlert
          v-if="props.error"
          color="error"
          variant="subtle"
          :description="props.error"
          role="alert"
        />
      </div>
    </template>

    <template #footer>
      <div class="flex w-full flex-wrap justify-end gap-2">
        <UButton color="neutral" variant="ghost" :disabled="props.confirming" @click="emit('cancel')">
          Cancel import
        </UButton>
        <UButton
          color="primary"
          :loading="props.confirming"
          :disabled="props.confirming"
          @click="emit('confirm')"
        >
          Import independent copy
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
/** Presents the validated import summary while the file workflow retains source and freshness state. */
import { computed } from 'vue'
import type { DeepReadonly } from 'vue'
import type { JsonImportSummary } from '../domain/workspace'

const props = defineProps<{
  open: boolean
  suspended: boolean
  summary: DeepReadonly<JsonImportSummary> | null
  confirming: boolean
  error: string
  fieldConflict: { message: string } | null
}>()

const emit = defineEmits<{
  cancel: []
  confirm: []
  'review-fields': []
}>()

const dialogOpen = computed({
  get: () => props.open && !props.suspended,
  set: (open: boolean) => {
    if (!open && props.open && !props.suspended && !props.confirming) emit('cancel')
  },
})

let opener: HTMLElement | null = null

function focusableElement(active: Element | null): HTMLElement | null {
  if (active instanceof HTMLElement) return active
  if (active instanceof SVGElement) return active.closest<HTMLElement>('button, a[href], [tabindex]')
  return null
}

function isVisible(element: HTMLElement): boolean {
  return element.isConnected && !element.matches(':disabled')
    && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden'
}

function captureOpener(): void {
  if (!opener) opener = focusableElement(document.activeElement)
}

function restoreFocus(event: Event): void {
  if (props.suspended) {
    event.preventDefault()
    return
  }
  event.preventDefault()
  const target = opener && isVisible(opener)
    ? opener
    : document.querySelector<HTMLElement>('#workspace-hierarchy-panel [aria-current="true"]')
      ?? document.querySelector<HTMLElement>('#workspace-main [role="group"][aria-label$="star system map"]')
      ?? document.getElementById('workspace-main')
  target?.focus()
  opener = null
}
</script>
