<template>
  <UDashboardNavbar
    as="header"
    :toggle="false"
    class="workspace-header"
    :ui="{ center: 'workspace-header-center' }"
    :inert="props.compactModalOpen ? true : undefined"
  >
    <template #left>
      <div class="workspace-header-brand" aria-label="TTRPG Cluster Control">
        <span class="workspace-header-mark" aria-hidden="true">✦</span>
        <span class="workspace-header-wordmark">TTRPG Cluster Control</span>
      </div>
    </template>

    <template #default>
      <section v-if="workspace" class="workspace-header-cluster" aria-label="Current Jump Cluster">
        <span class="workspace-header-eyebrow">Current Jump Cluster</span>
        <h1>{{ workspace.cluster.name }}</h1>
      </section>
    </template>

    <template #right>
      <div class="workspace-header-utilities">
        <div class="workspace-header-theme" role="group" aria-label="Theme">
          <ColorScheme>
            <span class="workspace-header-theme-status">{{ colorMode.value === 'dark' ? 'Dark' : 'Light' }}</span>
          </ColorScheme>
          <UColorModeButton class="theme-control-toggle workspace-control" />
        </div>
        <slot name="field-definitions" />
      </div>
    </template>
  </UDashboardNavbar>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { LocalWorkspace, StarSystem } from '../domain/workspace'

const props = withDefaults(defineProps<{
  workspace: LocalWorkspace | null
  activeView?: 'cluster' | 'system'
  selectedSystem?: StarSystem | null
  compactModalOpen?: boolean
}>(), {
  activeView: 'cluster',
  selectedSystem: null,
  compactModalOpen: false,
})

const workspace = computed(() => props.workspace)
const colorMode = useColorMode()
</script>

<style scoped>
:global(.workspace-header) {
  position: relative;
  z-index: 20;
  height: auto;
  display: flex;
  min-width: 0;
  min-height: 3.5rem;
  align-items: center;
  gap: clamp(0.75rem, 2vw, 1.75rem);
  border: 1px solid var(--line-soft);
  border-radius: 0.35rem;
  padding: 0.55rem clamp(0.75rem, 1.8vw, 1.5rem);
  background: var(--panel);
  color: var(--text-primary);
}

:global(.workspace-header [data-slot="center"]) {
  display: flex;
  min-width: 0;
  flex: 1 1 auto;
  justify-content: center;
}

:global(.workspace-header [data-slot="right"]) {
  min-width: 0;
}

.workspace-header-brand,
.workspace-header-utilities,
.workspace-header-theme {
  display: flex;
  min-width: 0;
  align-items: center;
}

.workspace-header-brand {
  flex: 0 0 auto;
  gap: 0.55rem;
  color: var(--text-primary);
  white-space: nowrap;
}

.workspace-header-mark {
  color: var(--accent);
  font-size: 1.25rem;
}

.workspace-header-wordmark {
  font-family: Georgia, serif;
  font-size: clamp(0.95rem, 1.25vw, 1.2rem);
  letter-spacing: 0.015em;
}

.workspace-header-eyebrow {
  color: var(--text-muted);
  font: 0.625rem Consolas, monospace;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.workspace-header-cluster {
  display: grid;
  min-width: 0;
  flex: 1 1 auto;
  justify-items: center;
  gap: 0.18rem;
  text-align: center;
}

.workspace-header-cluster h1 {
  max-width: min(42vw, 34rem);
  margin: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-family: Georgia, serif;
  font-size: 1rem;
  font-weight: 500;
  line-height: 1.1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workspace-header-utilities {
  flex: 0 0 auto;
  justify-content: flex-end;
  gap: 0.5rem;
}

.workspace-header-theme {
  gap: 0.35rem;
  border-left: 1px solid var(--line-soft);
  padding-left: 0.65rem;
}

.workspace-header-theme-status {
  color: var(--text-secondary);
  font-size: 0.75rem;
}

@media (max-width: 760px), (max-height: 600px) {
  :global(.workspace-header) {
    flex-wrap: wrap;
    gap: 0.45rem 0.65rem;
    padding: 0.45rem 0.6rem;
  }

  :global(.workspace-header [data-slot="center"]) {
    order: 3;
    flex: 1 1 100%;
    justify-content: flex-start;
  }

  :global(.workspace-header [data-slot="right"]) {
    flex: 0 1 auto;
  }

  .workspace-header-brand {
    flex: 1 1 auto;
  }

  .workspace-header-theme-status {
    display: none;
  }

  .workspace-header-cluster {
    order: 3;
    flex: 1 1 100%;
    justify-items: start;
    text-align: left;
  }

  .workspace-header-cluster h1 {
    max-width: min(76vw, 30rem);
  }

  .workspace-header-utilities {
    flex: 0 1 auto;
    gap: 0.3rem;
  }

  .workspace-header-theme {
    border-left: 0;
    padding-left: 0;
  }
}
</style>
