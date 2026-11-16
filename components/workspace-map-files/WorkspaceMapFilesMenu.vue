<template>
  <UDropdownMenu
    v-model:open="open"
    :items="items"
    :modal="false"
    :content="dropdownContent"
    :ui="{
      content: 'workspace-map-files-content z-[80] overflow-y-auto',
      item: 'min-h-11 items-center',
      itemLabel: 'whitespace-normal',
      label: 'whitespace-normal',
    }"
  >
    <template #content-top>
      <WorkspaceMapFilesObstructionMarker />
    </template>
    <template #default>
      <UButton
        ref="trigger"
        aria-label="Map files"
        icon="i-lucide-folder-open"
        color="neutral"
        :variant="open ? 'soft' : 'outline'"
        size="sm"
        class="workspace-control workspace-map-files-toggle workspace-map-icon-control"
        :aria-expanded="open"
      />
    </template>
    <template #item-leading="{ item, ui, active }">
      <img v-if="item.googleDrive" :src="googleDriveLogo" alt="" class="size-4 shrink-0">
      <UIcon v-else-if="item.icon" :name="item.icon" :class="ui.itemLeadingIcon({ active })" aria-hidden="true" />
    </template>
    <template #item-label="{ item }">
      <MapFilesItemHint v-if="item.hint" :text="item.hint">
        <span :data-workspace-map-files-item="item.menuValue">{{ item.label }}</span>
      </MapFilesItemHint>
      <span v-else :data-workspace-map-files-item="item.menuValue">{{ item.label }}</span>
    </template>
    <template #print-trailing>
      <span aria-hidden="true" inert class="pointer-events-none">
        <USwitch :model-value="printLight" size="sm" tabindex="-1" />
      </span>
    </template>
  </UDropdownMenu>

  <MapFilesTriggerHint :trigger="triggerElement()" text="Map files" />

  <div
    v-if="props.exportError || (props.playerExportError && !linkDialogOpen) || props.playerLinkBusy"
    class="workspace-map-files-feedback"
    data-map-obstruction
  >
    <p v-if="props.exportError" role="alert">{{ props.exportError }}</p>
    <p v-if="props.playerExportError && !linkDialogOpen" role="alert">{{ props.playerExportError }}</p>
    <p v-if="props.playerLinkBusy" role="status" aria-live="polite">Generating player link…</p>
  </div>

  <UModal
    v-model:open="linkDialogOpen"
    title="Player snapshot link"
    description="A snapshot of the published Jump Cluster. Anyone with the link can read and copy it."
    :transition="false"
    :content="{ onCloseAutoFocus: returnToSharing }"
  >
    <template #body>
      <div v-if="linkDialogMode === 'ready' && dialogLinkUrl" class="workspace-map-files-link-dialog">
        <UFormField label="Link">
          <UInput :model-value="dialogLinkUrl" readonly class="w-full" />
        </UFormField>
        <UButton
          icon="i-lucide-copy"
          class="min-h-11 justify-self-start"
          :disabled="props.playerLinkBusy"
          @click="emit('copy-player-link')"
        >Copy player link</UButton>
        <p v-if="props.playerLinkStatus" role="status" class="m-0 text-sm">{{ props.playerLinkStatus }}</p>
      </div>
      <div v-else-if="linkDialogMode === 'error'" class="workspace-map-files-link-dialog">
        <p role="alert" class="m-0 text-sm text-error">{{ linkDialogError }}</p>
        <p v-if="props.playerLinkStatus" role="status" class="m-0 text-sm">{{ props.playerLinkStatus }}</p>
        <UButton
          v-if="linkDialogFallback"
          color="neutral"
          variant="soft"
          class="min-h-11 justify-self-start"
          @click="exportPlayerJsonFallback"
        >Export player JSON</UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { useDialogCloseFocusBarrier } from '../../composables/useDialogCloseFocusBarrier'
import type { PlayerLinkGenerationResult } from '../../composables/usePlayerFileExports'
import type { MapImageFormat } from '../../utils/map-image-export'
import MapFilesItemHint from './MapFilesItemHint.vue'
import WorkspaceMapFilesObstructionMarker from './WorkspaceMapFilesObstructionMarker.vue'
import MapFilesTriggerHint from './MapFilesTriggerHint.vue'
// Official product logo from https://developers.google.com/workspace/drive/api/guides/branding.
import googleDriveLogo from './google-drive.png'

type GroupValue = 'download' | 'restore' | 'image' | 'share'
type MenuItem = DropdownMenuItem & {
  googleDrive?: boolean
  hint?: string
  menuValue?: string
}

const props = withDefaults(defineProps<{
  workspaceId: string
  scope: string
  activeView: 'cluster' | 'system'
  imageAvailable: boolean
  restoreLoading?: boolean
  exportError: string
  generatedPlayerUrl: string
  playerLinkBusy: boolean
  playerLinkStatus: string
  playerExportError: string
  cloudBackupItems?: readonly DropdownMenuItem[]
  cloudRestoreItems?: readonly DropdownMenuItem[]
  generatePlayerLink: () => Promise<PlayerLinkGenerationResult>
}>(), {
  cloudBackupItems: () => [],
  cloudRestoreItems: () => [],
})

const emit = defineEmits<{
  'export-cluster-json': []
  'export-system-json': []
  'export-warden-image': [format: MapImageFormat, lightForPrinting: boolean]
  'export-player-json': []
  'export-player-image': [format: MapImageFormat, lightForPrinting: boolean]
  'preview-player-view': [focusMapFiles: () => void]
  'import-system': []
  'restore-cluster': []
  'copy-player-link': []
  'files-open-change': [open: boolean]
}>()

const open = defineModel<boolean>('open', { required: true })
const closeFocus = useDialogCloseFocusBarrier(open)
const trigger = useTemplateRef('trigger')
const printLight = ref(false)
const linkDialogOpen = ref(false)
const linkDialogMode = ref<'ready' | 'error' | null>(null)
const linkDialogError = ref('')
const linkDialogFallback = ref(false)
const dialogLinkUrl = ref('')
const linkOpener = ref<'generate' | 'reopen'>('generate')
const linkDialogWorkspaceId = ref<string | null>(null)
const generatedWorkspaceId = ref(props.generatedPlayerUrl ? props.workspaceId : null)
const dropdownContent = computed(() => ({
  align: 'end' as const,
  collisionPadding: 8,
  onCloseAutoFocus: closeFocus.settleClosingFocus,
}))
const canViewGeneratedLink = computed(() => Boolean(props.generatedPlayerUrl)
  && generatedWorkspaceId.value === props.workspaceId)

const groups = computed(() => [
  { value: 'download' as const, label: 'Download or back up', icon: 'i-lucide-download' },
  { value: 'restore' as const, label: 'Import or restore', icon: 'i-lucide-upload' },
  { value: 'image' as const, label: 'Export an image', icon: 'i-lucide-image' },
  { value: 'share' as const, label: 'Share with players', icon: 'i-lucide-users' },
])

function keepSubmenuOpenOnParentFocus(event: Event): void {
  // Reka can briefly focus the parent menu when the mouse leaves a submenu trigger.
  const parentMenu = ownedMenu(triggerElement())
  if (parentMenu && event.target === parentMenu) event.preventDefault()
}

const items = computed<MenuItem[][]>(() => {
  const content = {
    collisionPadding: 8,
    prioritizePosition: true,
    sticky: 'always' as const,
    class: 'workspace-map-files-content',
    onFocusOutside: keepSubmenuOpenOnParentFocus,
  }
  const clusterJson: MenuItem = {
    menuValue: 'private-cluster-json',
    label: 'Download private Jump Cluster JSON',
    icon: 'i-lucide-file-json',
    hint: 'Download editable Warden data for the active Jump Cluster.',
    onSelect: () => emit('export-cluster-json'),
  }
  const systemJson: MenuItem = {
    menuValue: 'private-system-json',
    label: 'Download private Star System JSON',
    icon: 'i-lucide-file-json',
    hint: 'Download editable Warden data for the active Star System.',
    onSelect: () => emit('export-system-json'),
  }

  const imageAction = (audience: 'Warden' | 'Player', format: MapImageFormat): MenuItem => ({
    menuValue: `${audience.toLowerCase()}-${format.toLowerCase()}`,
    label: `${audience} ${format.toUpperCase()}`,
    icon: format === 'png' ? 'i-lucide-image' : 'i-lucide-shapes',
    disabled: !props.imageAvailable,
    hint: `${props.scope} · ${audience} image · ${format}. ${audience === 'Warden' ? 'Includes private Warden content.' : 'Includes only player-visible content.'}`,
    onSelect: () => exportImage(audience, format),
  })

  const children: Record<GroupValue, MenuItem[]> = {
    download: [
      { type: 'label', label: props.scope },
      ...(props.activeView === 'system' ? [systemJson, clusterJson] : [clusterJson]),
      ...props.cloudBackupItems.map(item => ({ ...item } as MenuItem)),
    ],
    restore: [
      {
        menuValue: 'import-system',
        label: 'Add a Star System from JSON',
        icon: 'i-lucide-file-plus',
        hint: 'Add an independent copy of this Star System to the active Jump Cluster.',
        onSelect: () => emit('import-system'),
      },
      {
        menuValue: 'restore-cluster',
        label: 'Restore Jump Cluster from JSON',
        icon: 'i-lucide-history',
        hint: 'Replace the active Jump Cluster after review of a complete JSON backup.',
        disabled: props.restoreLoading,
        onSelect: () => emit('restore-cluster'),
      },
      ...props.cloudRestoreItems.map(item => ({ ...item } as MenuItem)),
    ],
    image: [
      { type: 'label', label: props.scope },
      {
        type: 'checkbox',
        menuValue: 'light-for-printing',
        label: 'Light for printing',
        slot: 'print',
        ui: { itemTrailingIcon: 'hidden' },
        checked: printLight.value,
        onSelect: event => event.preventDefault(),
        onUpdateChecked: checked => { printLight.value = checked },
      },
      { type: 'separator' },
      imageAction('Warden', 'png'),
      imageAction('Warden', 'svg'),
      imageAction('Player', 'png'),
      imageAction('Player', 'svg'),
    ],
    share: [
      { type: 'label', label: 'Published Jump Cluster' },
      {
        menuValue: 'preview-player-view',
        label: 'Preview player view',
        icon: 'i-lucide-eye',
        hint: 'Preview the public view of the active Jump Cluster or revealed Star System.',
        onSelect: event => { event.preventDefault(); void openPreview() },
      },
      {
        menuValue: 'export-player-json',
        label: 'Export player JSON',
        icon: 'i-lucide-file-json',
        hint: 'Download only player-visible data for the published Jump Cluster.',
        onSelect: () => emit('export-player-json'),
      },
      {
        menuValue: 'open-player-reader',
        label: 'Open player reader',
        icon: 'i-lucide-book-open',
        to: '/player',
        target: '_blank',
        rel: 'noopener',
      },
      {
        menuValue: 'generate',
        label: 'Generate player link',
        icon: 'i-lucide-link',
        hint: 'Create a shareable link containing one published Jump Cluster snapshot.',
        disabled: props.playerLinkBusy,
        onSelect: event => { event.preventDefault(); void generateLink() },
      },
      ...(canViewGeneratedLink.value ? [{
        menuValue: 'reopen',
        label: 'View generated link',
        icon: 'i-lucide-external-link',
        onSelect: (event: Event) => { event.preventDefault(); void reopenLink() },
      }] : []),
    ],
  }

  return [
    [{ type: 'label', label: props.scope }],
    groups.value.map(group => ({
      ...group,
      menuValue: group.value,
      content,
      children: children[group.value],
    })),
  ]
})

const filesOverlayOpen = computed(() => open.value || linkDialogOpen.value)
watch(filesOverlayOpen, visible => emit('files-open-change', visible), { immediate: true })

watch(() => props.workspaceId, () => {
  open.value = false
  linkDialogOpen.value = false
  linkDialogMode.value = null
  linkDialogError.value = ''
  linkDialogFallback.value = false
  dialogLinkUrl.value = ''
  generatedWorkspaceId.value = null
  linkDialogWorkspaceId.value = null
}, { flush: 'sync' })

watch(() => props.generatedPlayerUrl, (url) => {
  if (url) {
    generatedWorkspaceId.value ??= props.workspaceId
  } else {
    generatedWorkspaceId.value = null
    if (linkDialogMode.value === 'ready') linkDialogOpen.value = false
  }
})

watch(linkDialogOpen, (visible) => {
  if (!visible) {
    linkDialogMode.value = null
    linkDialogError.value = ''
    linkDialogFallback.value = false
    dialogLinkUrl.value = ''
  }
})

function triggerElement(): HTMLElement | null {
  const button = trigger.value?.$el
  return button instanceof HTMLElement ? button : null
}

function focusTrigger(): void {
  triggerElement()?.focus({ preventScroll: true })
}

function ownedMenu(owner: Element | null | undefined): HTMLElement | null {
  const id = owner?.getAttribute('aria-controls')
  return id ? document.getElementById(id) : null
}

function hasMapFilesFocusOwnership(): boolean {
  if (typeof document === 'undefined') return false
  const active = document.activeElement
  if (active === document.body || active === document.documentElement || active === triggerElement()) return true
  return active instanceof Element
    && Boolean(active.closest('.workspace-map-files-content[role="menu"]'))
}

function focusStillBelongsToDialog(activeElement: Element | null, dialog: HTMLElement | null): boolean {
  return Boolean(dialog && activeElement && dialog.contains(activeElement))
}

async function focusSharing(
  opener: 'generate' | 'reopen',
  workspaceId: string,
  closingDialog: HTMLElement | null = null,
): Promise<void> {
  if (props.workspaceId !== workspaceId || open.value) return
  await nextTick()
  if (props.workspaceId !== workspaceId || open.value) return
  if (!hasMapFilesFocusOwnership() && !focusStillBelongsToDialog(document.activeElement, closingDialog)) return
  open.value = true
  await nextTick()
  if (props.workspaceId !== workspaceId || !open.value) return
  if (!hasMapFilesFocusOwnership() && !focusStillBelongsToDialog(document.activeElement, closingDialog)) return
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  if (props.workspaceId !== workspaceId || !open.value) return
  if (!hasMapFilesFocusOwnership() && !focusStillBelongsToDialog(document.activeElement, closingDialog)) return
  const mainMenu = ownedMenu(trigger.value?.$el)
  const shareRow = mainMenu?.querySelector<HTMLElement>('[data-workspace-map-files-item="share"]')?.closest<HTMLElement>('[role="menuitem"]')
  if (!shareRow) return
  shareRow.click()
  await nextTick()
  if (props.workspaceId !== workspaceId || !open.value) return
  if (!hasMapFilesFocusOwnership() && !focusStillBelongsToDialog(document.activeElement, closingDialog)) return
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  if (props.workspaceId !== workspaceId || !open.value) return
  if (!hasMapFilesFocusOwnership() && !focusStillBelongsToDialog(document.activeElement, closingDialog)) return
  ownedMenu(shareRow)?.querySelector<HTMLElement>(`[data-workspace-map-files-item="${opener}"]`)?.closest<HTMLElement>('[role="menuitem"]')?.focus()
}

function returnToSharing(event: Event): void {
  event.preventDefault()
  const workspaceId = linkDialogWorkspaceId.value
  if (!workspaceId || props.workspaceId !== workspaceId) return
  const closingDialog = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
  void focusSharing(linkOpener.value, workspaceId, closingDialog)
}

async function closeMenuAndSettle(): Promise<void> {
  open.value = false
  await nextTick()
  await closeFocus.whenClosingFocusSettled()
}

async function closeForDialog(): Promise<boolean> {
  await closeMenuAndSettle()
  return !open.value && hasMapFilesFocusOwnership()
}

async function openPreview(): Promise<void> {
  const workspaceId = props.workspaceId
  await closeMenuAndSettle()
  if (props.workspaceId !== workspaceId || open.value) return
  emit('preview-player-view', focusTrigger)
}

async function generateLink(): Promise<void> {
  const workspaceId = props.workspaceId
  const scope = props.scope
  const activeView = props.activeView
  linkOpener.value = 'generate'
  await closeMenuAndSettle()
  if (props.workspaceId !== workspaceId || props.scope !== scope || props.activeView !== activeView || open.value) return
  const result = await props.generatePlayerLink()
  if (props.workspaceId !== workspaceId || props.scope !== scope || props.activeView !== activeView) return
  if (result.status === 'cancelled') return
  if (result.status === 'ready') {
    generatedWorkspaceId.value = workspaceId
  }
  if (open.value || !hasMapFilesFocusOwnership()) return
  linkDialogWorkspaceId.value = workspaceId
  if (result.status === 'ready') {
    dialogLinkUrl.value = result.url
    linkDialogMode.value = 'ready'
  } else {
    linkDialogError.value = result.message
    linkDialogFallback.value = result.fallback
    linkDialogMode.value = 'error'
  }
  linkDialogOpen.value = true
}

async function reopenLink(): Promise<void> {
  const workspaceId = props.workspaceId
  linkOpener.value = 'reopen'
  await closeMenuAndSettle()
  if (props.workspaceId !== workspaceId || open.value || !canViewGeneratedLink.value) return
  linkDialogWorkspaceId.value = workspaceId
  dialogLinkUrl.value = props.generatedPlayerUrl
  linkDialogMode.value = 'ready'
  linkDialogOpen.value = true
}

function exportImage(audience: 'Warden' | 'Player', format: MapImageFormat): void {
  const lightForPrinting = printLight.value
  printLight.value = false
  if (audience === 'Warden') emit('export-warden-image', format, lightForPrinting)
  else emit('export-player-image', format, lightForPrinting)
}

function exportPlayerJsonFallback(): void {
  linkDialogOpen.value = false
  emit('export-player-json')
}

defineExpose({ closeForDialog, focusTrigger, triggerElement })
</script>

<style scoped>
.workspace-map-files-link-dialog {
  display: grid;
  gap: 0.75rem;
}

.workspace-map-files-feedback {
  position: absolute;
  z-index: 75;
  top: calc(100% + 0.25rem);
  right: 0;
  width: max-content;
  max-width: min(22rem, calc(100vw - 1rem));
  display: grid;
  gap: 0.4rem;
  margin: 0;
  border: 1px solid var(--line-soft);
  border-radius: 0.35rem;
  padding: 0.55rem 0.7rem;
  background: var(--panel-raised);
  color: var(--color-error, #e88f87);
  font-size: 0.75rem;
  overflow-wrap: anywhere;
  box-shadow: 0 0.5rem 1.5rem rgb(0 0 0 / 24%);
}

.workspace-map-files-feedback p { margin: 0; }

:global(.workspace-map-files-content) {
  width: min(15rem, calc(100vw - 1rem));
  max-height: min(70vh, 32rem, max(0px, var(--reka-dropdown-menu-content-available-height, 70vh)));
  overflow: auto;
}
</style>
