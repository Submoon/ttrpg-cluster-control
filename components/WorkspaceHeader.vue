<template>
  <UDashboardNavbar
    as="header"
    class="workspace-header"
    :class="{ 'workspace-header-compact-editor': compactEditorHeader }"
    :toggle="true"
    toggle-side="right"
    :ui="{ center: 'workspace-header-center' }"
    :inert="props.compactModalOpen ? true : undefined"
  >
    <template #left>
      <div class="workspace-header-brand" aria-label="TTRPG Cluster Control">
        <img class="workspace-header-mark" :src="logo" alt="" width="28" height="28" />
        <span class="workspace-header-wordmark">TTRPG Cluster Control</span>
      </div>
    </template>

    <template #default>
      <section
        v-if="workspace && !compactEditorHeader"
        class="workspace-header-cluster"
        aria-label="Current Jump Cluster"
      >
        <span class="workspace-header-eyebrow">Current Jump Cluster</span>
        <h1 :aria-labelledby="workspaceHeadingLabelId">
          <UPopover
            v-model:open="workspaceNameDisclosureOpen"
            :modal="false"
            :content="{
              side: 'bottom', align: 'center', sideOffset: 4, collisionPadding: 12,
              onOpenAutoFocus: event => event.preventDefault(),
            }"
          >
            <UButton
              class="workspace-control workspace-header-name-trigger"
              color="neutral"
              variant="ghost"
              size="sm"
              :aria-label="`${workspace.cluster.name}, show full map name`"
              :aria-expanded="workspaceNameDisclosureOpen"
            >
              <span :id="workspaceHeadingLabelId" class="workspace-header-name-text">{{ workspace.cluster.name }}</span>
              <UIcon name="i-lucide-chevron-down" class="workspace-header-name-disclosure-icon" aria-hidden="true" />
            </UButton>
            <template #content>
              <div class="workspace-header-name-popover">
                <p class="workspace-header-full-name">{{ workspace.cluster.name }}</p>
              </div>
            </template>
          </UPopover>
        </h1>
      </section>
      <section
        v-else-if="!workspace && props.publicTitle"
        class="workspace-header-cluster workspace-header-public"
        aria-label="Player map"
      >
        <span class="workspace-header-eyebrow">{{ props.publicEyebrow }}</span>
        <h1>{{ props.publicTitle }}</h1>
      </section>
    </template>

    <template #right>
      <div v-show="!compactEditorHeader" class="workspace-header-utilities">
        <slot name="player-actions" />
        <NuxtLink
          v-if="props.showPrivacyLink"
          class="text-xs font-medium text-primary underline underline-offset-2"
          to="/privacy"
          :target="workspace ? '_blank' : undefined"
          :rel="workspace ? 'noopener' : undefined"
          :aria-label="workspace ? 'Privacy policy (opens in a new tab)' : undefined"
        >
          Privacy policy
        </NuxtLink>
        <div class="workspace-header-theme" role="group" aria-label="Theme">
          <ColorScheme>
            <span class="workspace-header-theme-status">{{ colorMode.value === 'dark' ? 'Dark' : 'Light' }}</span>
          </ColorScheme>
          <UColorModeButton class="theme-control-toggle workspace-control" />
        </div>
        <slot name="editor-actions" />
      </div>
    </template>

    <template #toggle>
      <UButton
        v-if="compactEditorHeader"
        ref="mobileMenuToggle"
        class="workspace-control workspace-mobile-menu-toggle"
        color="neutral"
        variant="ghost"
        size="sm"
        :icon="mobileMenuOpen ? 'i-lucide-x' : 'i-lucide-menu'"
        :aria-label="mobileMenuOpen ? 'Close workspace menu' : 'Open workspace menu'"
        aria-controls="workspace-mobile-menu"
        :aria-expanded="mobileMenuOpen"
        @click="mobileMenuOpen = !mobileMenuOpen"
      />
    </template>
  </UDashboardNavbar>

  <UDashboardSidebar
    v-if="compactEditorHeader"
    v-model:open="mobileMenuOpen"
    class="workspace-mobile-menu-sidebar"
    mode="slideover"
    side="right"
    :toggle="false"
    :menu="{
      title: 'Workspace menu',
      description: 'Jump Cluster tools and settings',
      side: 'right',
      transition: false,
      content: { onCloseAutoFocus: restoreMenuToggleFocus },
    }"
    :ui="{ root: 'lg:hidden', overlay: 'lg:block', content: 'lg:block' }"
  >
    <template #content="{ close }">
      <div id="workspace-mobile-menu" class="workspace-mobile-menu-content">
        <div class="workspace-mobile-menu-heading">
          <h2>Workspace menu</h2>
          <UButton
            class="workspace-control"
            color="neutral"
            variant="ghost"
            size="sm"
            trailing-icon="i-lucide-x"
            aria-label="Close workspace menu"
            @click="close?.()"
          >
            Close
          </UButton>
        </div>
        <section v-if="workspace" class="workspace-mobile-menu-cluster" aria-label="Current Jump Cluster">
          <span class="workspace-header-eyebrow">Current Jump Cluster</span>
          <h3>{{ workspace.cluster.name }}</h3>
        </section>
        <div class="workspace-mobile-menu-actions">
          <slot name="mobile-actions" />
        </div>
        <div class="workspace-mobile-menu-utilities">
          <div class="workspace-header-theme" role="group" aria-label="Theme">
            <ColorScheme>
              <span class="workspace-header-theme-status">{{ colorMode.value === 'dark' ? 'Dark' : 'Light' }}</span>
            </ColorScheme>
            <UColorModeButton class="theme-control-toggle workspace-control" />
          </div>
          <NuxtLink
            v-if="props.showPrivacyLink"
            class="text-xs font-medium text-primary underline underline-offset-2"
            to="/privacy"
            target="_blank"
            rel="noopener"
            aria-label="Privacy policy (opens in a new tab)"
          >
            Privacy policy
          </NuxtLink>
        </div>
      </div>
    </template>
  </UDashboardSidebar>

</template>

<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import logo from '~/assets/cluster-control-logo-256.png'
import type { LocalWorkspace, StarSystem } from '../domain/workspace'

const props = withDefaults(defineProps<{
  workspace: LocalWorkspace | null
  activeView?: 'cluster' | 'system'
  selectedSystem?: StarSystem | null
  compactModalOpen?: boolean
  isCompactViewport?: boolean
  showPrivacyLink?: boolean
  publicTitle?: string
  publicEyebrow?: string
}>(), {
  activeView: 'cluster',
  selectedSystem: null,
  compactModalOpen: false,
  isCompactViewport: false,
  publicEyebrow: 'PLAYER VIEW',
})

const workspace = computed(() => props.workspace)
const colorMode = useColorMode()
const mobileMenuOpen = defineModel<boolean>('mobileMenuOpen', { default: false })
const workspaceNameDisclosureOpen = ref(false)
const workspaceHeadingLabelId = `workspace-header-name-${useId()}`
const mobileMenuToggle = ref<{ $el?: HTMLElement } | null>(null)
const compactEditorHeader = computed(() => Boolean(workspace.value && props.isCompactViewport))

function restoreMenuToggleFocus(event: Event): void {
  event.preventDefault()
  void nextTick(focusMobileMenuToggle)
}

function focusMobileMenuToggle(): HTMLElement | null {
  const target = mobileMenuToggle.value?.$el
  if (!target?.isConnected || target.closest('[inert], [aria-hidden="true"]') || target.getClientRects().length === 0) return null
  target.focus({ preventScroll: true })
  return target
}

defineExpose({ focusMobileMenuToggle })

watch(compactEditorHeader, isCompact => {
  if (!isCompact) mobileMenuOpen.value = false
})

watch(() => workspace.value?.cluster.id, () => {
  workspaceNameDisclosureOpen.value = false
  mobileMenuOpen.value = false
})
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
  background: var(--panel-bg);
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
  flex: none;
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

.workspace-header-name-trigger {
  max-width: 100%;
  min-height: 1.65rem;
  justify-content: center;
  color: inherit;
  font: inherit;
  font-weight: inherit;
}

.workspace-header-name-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workspace-header-name-disclosure-icon {
  flex: none;
  color: var(--text-muted);
}

.workspace-header-name-popover {
  max-width: min(70vw, 48rem);
  padding: 0.6rem 0.75rem;
}

.workspace-header-full-name {
  margin: 0;
  color: var(--text-primary);
  font-family: Georgia, serif;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.workspace-header-public h1 {
  max-width: min(44vw, 38rem);
  font-size: clamp(1rem, 1.45vw, 1.25rem);
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

.workspace-mobile-menu-content {
  display: grid;
  min-height: 0;
  height: 100%;
  gap: 1rem;
  min-width: 0;
  overflow-y: auto;
  align-content: start;
  padding: clamp(0.85rem, 4vw, 1.5rem);
}

.workspace-mobile-menu-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border-bottom: 1px solid var(--line-soft);
  padding-bottom: 0.6rem;
}

.workspace-mobile-menu-heading h2 {
  margin: 0;
  color: var(--text-primary);
  font-family: Georgia, serif;
  font-size: 1.1rem;
  font-weight: 500;
}

.workspace-mobile-menu-cluster {
  display: grid;
  gap: 0.35rem;
  border-bottom: 1px solid var(--line-soft);
  padding: 0 0 0.8rem;
}

.workspace-mobile-menu-cluster h3 {
  margin: 0;
  color: var(--text-primary);
  font-family: Georgia, serif;
  font-size: 1.2rem;
  font-weight: 500;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.workspace-mobile-menu-actions,
.workspace-mobile-menu-utilities {
  display: grid;
  justify-items: start;
  gap: 0.65rem;
  min-width: 0;
}

.workspace-mobile-menu-utilities {
  border-top: 1px solid var(--line-soft);
  padding-top: 0.8rem;
}

.workspace-mobile-menu-utilities .workspace-header-theme {
  border: 0;
  padding: 0;
}

.workspace-mobile-menu-utilities .workspace-header-theme-status {
  display: inline;
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

  :global(.workspace-header-compact-editor [data-slot="center"]) {
    display: none;
  }

  :global(.workspace-header-compact-editor [data-slot="left"]) {
    flex: 1 1 auto;
  }

  :global(.workspace-header-compact-editor [data-slot="right"]) {
    flex: 0 0 auto;
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

  .workspace-header-public h1 { max-width: min(66vw, 30rem); }

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
