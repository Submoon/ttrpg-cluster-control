<script setup lang="ts">
/**
 * Read-only assignment list shared by definition inspection and destructive-change previews.
 */
import type { FieldValueAssignment } from './model'

const props = defineProps<{
  assignments: FieldValueAssignment[]
  heading: string
  regionLabel: string
  emptyMessage?: string
  affected?: boolean
}>()
</script>

<template>
  <section
    class="field-definition-values"
    :class="{ 'field-definition-affected': props.affected }"
    role="region"
    :aria-label="props.regionLabel"
  >
    <div class="field-definition-section-heading">
      <h4>{{ props.heading }}</h4>
      <span>{{ props.assignments.length }}</span>
    </div>
    <p v-if="!props.assignments.length && props.emptyMessage" class="empty-copy">
      {{ props.emptyMessage }}
    </p>
    <ul v-else>
      <li v-for="assignment in props.assignments" :key="assignment.objectId">
        <span>{{ assignment.objectName }}</span>
        <small>{{ assignment.systemName }}</small>
        <strong>{{ assignment.value }}</strong>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.field-definition-values {
  border: 1px solid var(--line-soft);
  padding: 0.8rem;
  background: var(--panel-bg);
}

.field-definition-values ul {
  display: grid;
  gap: 0.35rem;
  margin: 0.6rem 0 0;
  padding: 0;
  list-style: none;
}

.field-definition-values li {
  display: grid;
  grid-template-columns: minmax(5rem, 1fr) minmax(5rem, 1fr) minmax(4rem, auto);
  gap: 0.6rem;
  align-items: center;
  border-top: 1px solid var(--line-soft);
  padding-top: 0.4rem;
  font-size: 0.68rem;
}

.field-definition-values li small {
  color: var(--text-muted);
  font: 0.58rem Consolas, monospace;
}

.field-definition-values li strong {
  color: var(--accent-hover);
  overflow-wrap: anywhere;
  text-align: right;
}

.field-definition-values .empty-copy {
  margin: 0.55rem 0 0;
}

.field-definition-affected {
  border-color: var(--error-border);
  background: linear-gradient(135deg, rgba(166, 93, 93, 0.12), var(--panel-bg) 58%);
}

@media (max-width: 760px) {
  .field-definition-values li {
    grid-template-columns: minmax(4rem, 0.8fr) minmax(4rem, 1fr) minmax(3rem, auto);
    gap: 0.35rem;
  }
}
</style>
