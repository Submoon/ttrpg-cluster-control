<template>
  <section id="b-catalogue-panel" class="b-catalogue-panel" aria-label="Choose catalogue object type">
    <header class="b-catalogue-heading">
      <div><small>ADD OBJECT / CATALOGUE</small><strong>Choose a mark</strong></div>
      <button type="button" aria-label="Close object catalogue" @click="emit('close')">×</button>
    </header>
    <div class="b-catalogue-family-list" role="group" aria-label="Catalogue categories">
      <button
        v-for="group in groups"
        :key="group.family"
        type="button"
        :aria-pressed="selectedFamily === group.family"
        @click="selectedFamily = group.family"
      >
        <span aria-hidden="true">{{ group.mark }}</span><span>{{ group.label }}</span>
      </button>
    </div>
    <div class="b-catalogue-types" role="group" :aria-label="`${activeGroup.label} object types`">
      <button
        v-for="type in activeGroup.types"
        :key="type.value"
        type="button"
        :aria-pressed="props.selected === type.value"
        @click="emit('select', type.value)"
      >
        <span class="b-catalogue-glyph" aria-hidden="true">{{ catalogueMarks[type.value] }}</span>
        <span>{{ type.label }}</span>
      </button>
    </div>
    <p>Choose open space or an Orbit on the map. Add stays active for this mark type until you choose another tool.</p>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { catalogueTypes, type CatalogueSubtype, type ObjectFamily } from '../domain/workspace'
import { catalogueMarks } from '../utils/catalogue-marks'

const props = defineProps<{ selected: CatalogueSubtype }>()
const emit = defineEmits<{ close: []; select: [subtype: CatalogueSubtype] }>()

const familyDefinitions = [
  { family: 'CelestialBody', label: 'Celestial bodies', mark: '✦' },
  { family: 'SmallBody/Field', label: 'Small bodies & fields', mark: '◌' },
  { family: 'Installation', label: 'Installations', mark: '⌂' },
  { family: 'Vessel', label: 'Vessels', mark: '⌁' },
  { family: 'JumpPoint', label: 'Jump Points', mark: '⊙' },
  { family: 'Phenomenon', label: 'Phenomena', mark: '✧' },
  { family: 'Other', label: 'Other', mark: '◇' },
] satisfies Array<{ family: ObjectFamily; label: string; mark: string }>
const groups = familyDefinitions.map(group => ({
  ...group,
  types: catalogueTypes.filter(type => type.family === group.family),
}))
const selectedFamily = ref<ObjectFamily>(catalogueTypes.find(type => type.value === props.selected)?.family ?? groups[0]!.family)
const activeGroup = computed(() => groups.find(group => group.family === selectedFamily.value) ?? groups[0]!)
</script>

<style scoped>
.b-catalogue-panel { position: absolute; z-index: 7; top: 5.3rem; left: 5.5rem; display: grid; width: min(28rem, calc(100% - 6.5rem)); gap: .6rem; border: 1px solid var(--proto-line); padding: .7rem; background: color-mix(in srgb, var(--proto-surface) 97%, transparent); color: var(--proto-ink); box-shadow: 0 1rem 3rem rgba(0,0,0,.34); backdrop-filter: blur(20px); }
.b-catalogue-heading { display: flex; align-items: center; justify-content: space-between; gap: .5rem; }
.b-catalogue-heading > div { display: grid; gap: .18rem; }
.b-catalogue-heading small { color: var(--proto-muted); font-size: .46rem; font-weight: 700; letter-spacing: .13em; }
.b-catalogue-heading strong { font: 500 .9rem var(--proto-display-font); }
.b-catalogue-heading button { width: 2rem; min-height: 2rem; border: 1px solid var(--proto-line); background: var(--proto-soft); color: var(--proto-ink); font-size: 1.05rem; cursor: pointer; }
.b-catalogue-family-list { display: flex; flex-wrap: wrap; gap: .25rem; border-bottom: 1px solid var(--proto-line); padding-bottom: .5rem; }
.b-catalogue-family-list button, .b-catalogue-types button { display: inline-flex; min-height: 2.2rem; align-items: center; justify-content: center; gap: .32rem; border: 1px solid var(--proto-line); padding: .3rem .45rem; background: var(--proto-soft); color: var(--proto-ink); font: inherit; cursor: pointer; }
.b-catalogue-family-list button { min-height: 2.2rem; color: var(--proto-muted); font-size: .75rem; }
.b-catalogue-family-list button[aria-pressed="true"], .b-catalogue-types button[aria-pressed="true"] { border-color: var(--proto-accent); background: color-mix(in srgb, var(--proto-accent) 14%, var(--proto-surface)); color: var(--proto-ink); }
.b-catalogue-family-list button > span:first-child { color: var(--proto-accent); }
.b-catalogue-types { display: flex; flex-wrap: wrap; gap: .3rem; }
.b-catalogue-types button { font-size: .78rem; }
.b-catalogue-glyph { color: var(--proto-accent); font-size: .85rem; }
.b-catalogue-panel p { margin: 0; color: var(--proto-muted); font-size: .76rem; line-height: 1.45; }
.b-catalogue-panel :focus-visible { outline: 2px solid var(--proto-accent); outline-offset: 1px; }
@media (max-width: 760px) {
  .b-catalogue-panel { top: 3.3rem; right: .4rem; bottom: auto; left: .4rem; width: auto; height: auto; max-height: min(46dvh, 28rem); align-content: start; overflow: auto; }
  .b-catalogue-family-list button { flex: 1 1 calc(50% - .25rem); justify-content: flex-start; }
}
@media (max-height: 600px) and (min-width: 761px) {
  .b-catalogue-panel { top: 5.2rem; bottom: 7.6rem; overflow: auto; }
}
</style>
