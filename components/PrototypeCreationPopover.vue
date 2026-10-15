<template>
  <UPopover
    class="b-create-popover"
    :open="props.open"
    :portal="'.proto-b'"
    :modal="false"
    :content="{ side: 'top', align: 'end', sideOffset: 8, collisionPadding: 8 }"
    :ui="{ content: 'b-create-popover-layer' }"
    @update:open="emit('update:open', $event)"
  >
    <template #default="{ open }">
      <slot name="trigger" :open="open" />
    </template>
    <template #content>
      <div id="b-create-menu" class="b-create-content" aria-label="Choose what to add">
        <PrototypeCataloguePicker
          v-if="props.catalogueOpen && props.view === 'system'"
          :selected="props.selected"
          @close="emit('close')"
          @select="emit('select', $event)"
        />
        <template v-else-if="props.view === 'cluster'">
          <button type="button" @click="emit('choose', 'add-system')">Add star system</button>
          <button type="button" @click="emit('choose', 'add-route')">Add Jump Route</button>
        </template>
        <template v-else>
          <button type="button" @click="emit('open-catalogue')">Add map mark…</button>
          <button type="button" @click="emit('choose', 'add-orbit')">Add Orbit</button>
        </template>
      </div>
    </template>
  </UPopover>
</template>

<script setup lang="ts">
import type { CatalogueSubtype } from '../domain/workspace'

type View = 'cluster' | 'system'
type AddAction = 'add-system' | 'add-route' | 'add-orbit'

const props = defineProps<{
  open: boolean
  view: View
  catalogueOpen: boolean
  selected: CatalogueSubtype
}>()

const emit = defineEmits<{
  'update:open': [open: boolean]
  choose: [tool: AddAction]
  'open-catalogue': []
  close: []
  select: [subtype: CatalogueSubtype]
}>()
</script>

<style scoped>
:global(.b-create-popover-layer) { z-index: 15; }
.b-create-content { display: grid; width: min(28rem, calc(100vw - 1rem)); max-height: min(70dvh, 34rem); gap: .22rem; overflow: auto; border: 1px solid var(--proto-line); padding: .35rem; background: var(--proto-surface); color: var(--proto-ink); box-shadow: 0 .8rem 2rem rgba(0,0,0,.25); }
.b-create-content > button { min-height: 2.45rem; border: 1px solid transparent; padding: .45rem .6rem; background: var(--proto-soft); color: var(--proto-ink); font-family: var(--proto-ui-font); font-size: .78rem; text-align: left; cursor: pointer; }
.b-create-content > button:hover { border-color: var(--proto-accent); }
.b-create-content button:focus-visible { outline: 2px solid var(--proto-accent); outline-offset: 2px; }
</style>
