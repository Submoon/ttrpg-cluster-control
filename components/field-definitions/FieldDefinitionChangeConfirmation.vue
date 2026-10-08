<script setup lang="ts">
import type { PendingFieldDefinitionChange } from './model'

const props = defineProps<{
  change: PendingFieldDefinitionChange
}>()

const emit = defineEmits<{
  cancel: []
  confirm: []
}>()
</script>

<template>
  <section
    class="field-definition-confirmation"
    role="region"
    aria-label="Field change confirmation"
  >
    <span class="section-kicker">CONFIRM DATA CHANGE</span>
    <h3>
      {{ props.change.kind === 'remove'
        ? `Delete ${props.change.fieldName}?`
        : `Remove saved values from ${props.change.fieldName}?` }}
    </h3>
    <p>
      The following saved values will be cleared. The change will not be applied unless you confirm.
    </p>
    <ul v-if="props.change.affectedAssignments.length">
      <li
        v-for="assignment in props.change.affectedAssignments"
        :key="assignment.objectId"
      >
        <span>{{ assignment.objectName }} / {{ assignment.systemName }}</span>
        <strong>{{ assignment.value }}</strong>
      </li>
    </ul>
    <p v-else class="empty-copy">This definition has no saved object values.</p>
    <div class="field-definition-actions">
      <button class="quiet-button" type="button" @click="emit('cancel')">
        Cancel field changes
      </button>
      <button class="primary-button" type="button" @click="emit('confirm')">
        {{ props.change.kind === 'remove'
          ? 'Delete field and clear values'
          : 'Remove options and clear affected values' }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.field-definition-confirmation {
  display: grid;
  gap: 0.5rem;
  border: 1px solid var(--error-border);
  padding: 0.8rem;
  background: linear-gradient(135deg, rgba(166, 93, 93, 0.12), var(--panel-bg) 58%);
}

.field-definition-confirmation h3 {
  margin: 0;
  font-family: Georgia, serif;
  font-size: 1.1rem;
  font-weight: 500;
}

.field-definition-confirmation > p {
  margin: 0.45rem 0 0;
  color: var(--text-muted);
  font-size: 0.75rem;
  line-height: 1.5;
}

.field-definition-confirmation ul {
  display: grid;
  gap: 0.35rem;
  margin: 0.6rem 0 0;
  padding: 0;
  list-style: none;
}

.field-definition-confirmation li {
  display: grid;
  grid-template-columns: minmax(5rem, 1fr) minmax(5rem, 1fr) minmax(4rem, auto);
  gap: 0.6rem;
  align-items: center;
  border-top: 1px solid var(--line-soft);
  padding-top: 0.4rem;
  font-size: 0.68rem;
}

.field-definition-confirmation li strong {
  color: var(--accent-hover);
  overflow-wrap: anywhere;
  text-align: right;
}

.field-definition-confirmation .empty-copy {
  margin: 0.5rem 0 0;
}

@media (max-width: 760px) {
  .field-definition-confirmation li {
    grid-template-columns: minmax(4rem, 0.8fr) minmax(4rem, 1fr) minmax(3rem, auto);
    gap: 0.35rem;
  }
}
</style>
