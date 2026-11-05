<template>
  <section class="player-public-hierarchy" aria-label="Visible system hierarchy">
    <div v-if="props.workspacePresentation" class="player-public-panel-heading">
      <span class="section-kicker">PUBLIC NAVIGATION</span><h2>Visible objects</h2>
    </div>
    <h3 v-else class="m-0 text-sm font-semibold">Visible objects</h3>
    <p v-if="!treeItems.length" class="empty-copy">No map objects are visible to players.</p>
    <div v-else ref="treeContainer" class="player-system-hierarchy-tree">
      <!-- @vue-generic {PlayerTreeItem[]} -->
      <UTree
        :items="treeItems"
        :model-value="selectedTreeItem"
        :expanded="expandedKeys"
        :get-key="getTreeItemKey"
        label-key="label"
        :nested="false"
        aria-label="Player object and Orbit hierarchy"
        :ui="{ link: 'player-system-hierarchy-item' }"
        @keydown.capture="stopComposingTreeKeys"
        @update:expanded="updateExpandedKeys"
        @select="selectHierarchyItem"
        @toggle="preventClickToggle"
      >
        <template #item-wrapper="{ item, level, expanded, selected, handleToggle, ui }">
          <div
            :class="ui.link({
              class: [
                'player-system-hierarchy-row grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-1 gap-y-0 rounded-[2px] border border-transparent px-2 py-1 text-left',
                item.kind === 'orbit'
                  ? 'player-system-hierarchy-row--orbit'
                  : `player-system-hierarchy-row--${item.object.disclosure}`,
                { active: selected },
              ],
              selected,
            })"
            :aria-label="item.ariaLabel"
            :data-player-hierarchy-key="item.key"
            :data-player-hierarchy-level="level"
            :style="{ paddingInlineStart: `${Math.min(level - 1, maximumIndentLevels) * indentStep}rem` }"
            @compositionstart="isComposing = true"
            @compositionend="isComposing = false"
          >
            <template v-if="item.kind === 'object'">
              <span class="player-system-hierarchy-title col-start-1 row-start-1 flex min-w-0 items-start gap-1 [overflow-wrap:anywhere]">
                <span v-if="objectPresentation(item)?.glyph" class="player-system-hierarchy-glyph shrink-0" aria-hidden="true">
                  {{ objectPresentation(item)?.glyph }}
                </span>
                <span class="player-system-hierarchy-label min-w-0 [overflow-wrap:anywhere]">{{ item.label }}</span>
              </span>
              <small v-if="objectPresentation(item)?.typeLabel" class="player-system-hierarchy-type col-start-1 row-start-2 mt-[0.12rem] block min-w-0 [overflow-wrap:anywhere]">
                {{ objectPresentation(item)?.typeLabel }}
              </small>
              <small v-if="item.parentContext" class="player-system-hierarchy-path col-start-1 row-start-3 mt-[0.1rem] block min-w-0 [overflow-wrap:anywhere]">
                {{ item.parentContext }}
              </small>
            </template>
            <template v-else>
              <span class="player-system-hierarchy-title col-start-1 row-span-2 flex min-w-0 items-start gap-1 [overflow-wrap:anywhere]">
                <span class="player-system-hierarchy-orbit-mark shrink-0" aria-hidden="true">○</span>
                <span class="player-system-hierarchy-label min-w-0 [overflow-wrap:anywhere]">{{ item.label }}</span>
              </span>
            </template>
            <UButton
              v-if="item.children?.length"
              class="player-system-hierarchy-toggle col-start-2 row-span-3 min-h-[2rem] min-w-[2rem] shrink-0 justify-center self-center px-0"
              color="neutral"
              variant="ghost"
              size="xs"
              :tabindex="-1"
              :aria-label="`${expanded ? 'Collapse' : 'Expand'} ${item.label}`"
              :aria-expanded="expanded"
              @click.stop="toggleAndRestoreFocus($event, item, handleToggle)"
            >
              <UIcon :name="expanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" aria-hidden="true" />
            </UButton>
          </div>
        </template>
      </UTree>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { PlayerSystemDocument } from '../domain/player-projection'
import { playerObjectPresentation } from '../utils/player-object-presentation'
import { buildPlayerSystemHierarchy, summarizePlayerContextLabel } from '../utils/player-system-hierarchy'
import type { PlayerHierarchyNode } from '../utils/player-system-hierarchy'
import type { TreeItemSelectEvent, TreeItemToggleEvent } from 'reka-ui'

interface PlayerTreeItemBase {
  key: string
  label: string
  textValue: string
  ariaLabel: string
  parentContext?: string
  children?: PlayerTreeItem[]
  [key: string]: unknown
}

type PlayerTreeItem = PlayerTreeItemBase & (
  | { kind: 'object'; object: NonNullable<Extract<PlayerHierarchyNode, { kind: 'object' }>['object']> }
  | { kind: 'orbit'; orbit: NonNullable<Extract<PlayerHierarchyNode, { kind: 'orbit' }>['orbit']> }
)

const props = withDefaults(defineProps<{
  document: PlayerSystemDocument
  selectedObjectId: string | null
  selectedOrbitId?: string | null
  workspacePresentation?: boolean
}>(), {
  selectedOrbitId: null,
  workspacePresentation: false,
})
const emit = defineEmits<{
  'inspect-object': [publicObjectId: string]
  'inspect-orbit': [publicOrbitId: string]
}>()

const maximumIndentLevels = 4
const maximumDefaultExpandedDepth = 128
const indentStep = 0.65
const treeContainer = ref<HTMLElement | null>(null)
const expandedKeys = ref<string[]>([])
const isComposing = ref(false)
const focusRequestNonce = ref(0)
const hierarchy = computed(() => buildPlayerSystemHierarchy(props.document))
const treeItems = computed(() => prepareTreeItems(hierarchy.value))
const treeItemByKey = computed(() => indexTreeItems(treeItems.value))
const initialExpandedKeys = computed(() => collectInitialExpandedKeys(treeItems.value))
const parentKeyByKey = computed(() => indexParentKeys(treeItems.value))
const selectedKey = computed(() => props.selectedObjectId
  ? `object:${props.selectedObjectId}`
  : props.selectedOrbitId ? `orbit:${props.selectedOrbitId}` : null)
const selectedTreeItem = computed(() => selectedKey.value
  ? treeItemByKey.value.get(selectedKey.value)
  : undefined)

watch(() => props.document, () => {
  focusRequestNonce.value += 1
  expandedKeys.value = initialExpandedKeys.value
  expandSelectedAncestors()
}, { flush: 'sync', immediate: true })

watch(selectedKey, () => {
  focusRequestNonce.value += 1
  expandSelectedAncestors()
}, { flush: 'sync', immediate: true })

function prepareTreeItems(nodes: PlayerHierarchyNode[]): PlayerTreeItem[] {
  const roots: PlayerTreeItem[] = []
  const pending = nodes.slice().reverse().map(node => ({ node, siblings: roots }))
  while (pending.length) {
    const entry = pending.pop()!
    const node = entry.node
    const context = node.kind === 'object' && node.object.placement.kind === 'orbit'
      ? objectParentContext(node.object.placement.orbitId, props.document)
      : undefined
    const base = {
      key: node.key,
      label: node.label,
      textValue: node.label,
      ariaLabel: playerTreeAccessibleLabel(node, props.document),
      ...(context === undefined ? {} : { parentContext: context }),
    }
    const item: PlayerTreeItem = node.kind === 'object'
      ? {
          ...base,
          kind: 'object',
          object: node.object,
          ...(node.children?.length ? { children: [] } : {}),
        }
      : {
          ...base,
          kind: 'orbit',
          orbit: node.orbit,
          ...(node.children?.length ? { children: [] } : {}),
        }
    entry.siblings.push(item)
    if (node.children?.length && item.children) {
      for (let index = node.children.length - 1; index >= 0; index -= 1) {
        pending.push({ node: node.children[index]!, siblings: item.children })
      }
    }
  }
  return roots
}

function objectParentContext(orbitId: string, document: PlayerSystemDocument): string {
  const orbit = document.orbits.find(candidate => candidate.id === orbitId)
  if (!orbit) return 'Orbit around an unknown public host'
  if (orbit.hostId === null) return 'Orbit around unoccupied center'
  const host = document.objects.find(candidate => candidate.id === orbit.hostId)
  return `Orbit around ${summarizePlayerContextLabel(host
    ? playerObjectPresentation(host).label
    : 'Unknown presence')}`
}

function playerTreeAccessibleLabel(node: PlayerHierarchyNode, document: PlayerSystemDocument): string {
  if (node.kind === 'orbit') return node.label
  const presentation = playerObjectPresentation(node.object)
  const parent = node.object.placement.kind === 'orbit'
    ? objectParentContext(node.object.placement.orbitId, document)
    : undefined
  return [presentation.label, presentation.typeLabel, parent].filter(Boolean).join(', ')
}

function objectPresentation(item: PlayerTreeItem) {
  return item.kind === 'object' ? playerObjectPresentation(item.object) : null
}

function indexTreeItems(items: PlayerTreeItem[]): Map<string, PlayerTreeItem> {
  const result = new Map<string, PlayerTreeItem>()
  const pending = items.slice()
  while (pending.length) {
    const item = pending.pop()!
    result.set(item.key, item)
    if (item.children) pending.push(...item.children)
  }
  return result
}

/** Ordinary documents open fully; deeper paths stay available on demand to avoid Reka recursion overflow. */
function collectInitialExpandedKeys(items: PlayerTreeItem[]): string[] {
  const result: string[] = []
  const pending = items.map(item => ({ item, depth: 1 }))
  while (pending.length) {
    const entry = pending.pop()!
    if (!entry.item.children?.length || entry.depth >= maximumDefaultExpandedDepth) continue
    result.push(entry.item.key)
    for (const child of entry.item.children) pending.push({ item: child, depth: entry.depth + 1 })
  }
  return result
}

function indexParentKeys(items: PlayerTreeItem[]): Map<string, string | null> {
  const result = new Map<string, string | null>()
  const pending = items.map(item => ({ item, parentKey: null as string | null }))
  while (pending.length) {
    const entry = pending.pop()!
    result.set(entry.item.key, entry.parentKey)
    if (!entry.item.children) continue
    for (const child of entry.item.children) pending.push({ item: child, parentKey: entry.item.key })
  }
  return result
}

function getTreeItemKey(item: PlayerTreeItem): string {
  return item.key
}

function expandSelectedAncestors(): void {
  const key = selectedKey.value
  if (!key) return
  const ancestors: string[] = []
  let parentKey = parentKeyByKey.value.get(key) ?? null
  while (parentKey !== null) {
    ancestors.push(parentKey)
    parentKey = parentKeyByKey.value.get(parentKey) ?? null
  }
  if (!ancestors.length) return
  expandedKeys.value = [...new Set([...expandedKeys.value, ...ancestors])]
}

function updateExpandedKeys(keys: string[]): void {
  focusRequestNonce.value += 1
  expandedKeys.value = keys
}

function stopComposingTreeKeys(event: KeyboardEvent): void {
  if (isComposing.value || event.isComposing) event.stopPropagation()
}

function selectHierarchyItem(_event: TreeItemSelectEvent<PlayerTreeItem>, item: PlayerTreeItem): void {
  _event.preventDefault()
  focusRequestNonce.value += 1
  if (item.kind === 'object') emit('inspect-object', item.object.id)
  else emit('inspect-orbit', item.orbit.id)
}

function preventClickToggle(event: TreeItemToggleEvent<PlayerTreeItem>): void {
  if (event.detail.originalEvent.type === 'click') event.preventDefault()
}

function toggleAndRestoreFocus(event: MouseEvent, item: PlayerTreeItem, handleToggle: () => void): void {
  const document = props.document
  handleToggle()
  const nonce = ++focusRequestNonce.value
  void nextTick(() => {
    if (props.document !== document || focusRequestNonce.value !== nonce) return
    const element = treeContainer.value?.querySelector<HTMLElement>(
      `[data-player-hierarchy-key="${CSS.escape(item.key)}"]`,
    )
    const treeItem = element?.closest<HTMLElement>('[role="treeitem"]') ?? element
    if (!treeItem || !isVisibleTreeRow(treeItem)) return
    treeItem.focus()
  })
  event.preventDefault()
}

function isVisibleTreeRow(element: HTMLElement): boolean {
  return element.isConnected
    && element.getClientRects().length > 0
    && getComputedStyle(element).visibility !== 'hidden'
    && !element.closest('[inert], [aria-hidden="true"]')
}

onBeforeUnmount(() => {
  focusRequestNonce.value += 1
})
</script>

<style scoped>
.player-public-hierarchy { display: grid; min-width: 0; gap: .5rem; }
.player-public-panel-heading { display: grid; gap: .2rem; }
.player-public-panel-heading h2 { margin: 0; font: 500 1rem Georgia, serif; }
.player-system-hierarchy-tree { min-width: 0; }
.player-system-hierarchy-row {
  width: 100%;
  min-height: 2.55rem;
  overflow-wrap: anywhere;
  cursor: pointer;
  color: var(--text-secondary);
}
.player-system-hierarchy-row:hover {
  border-color: var(--line);
  background: var(--panel-raised);
}
:deep(.player-system-hierarchy-item:focus-visible) .player-system-hierarchy-row {
  outline: 2px solid var(--focus);
  outline-offset: 1px;
}
.player-system-hierarchy-row--orbit { color: var(--text-secondary); }
.player-system-hierarchy-row.active {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--text-primary);
}
.player-system-hierarchy-label { min-width: 0; }
.player-system-hierarchy-row--unknown .player-system-hierarchy-glyph,
.player-system-hierarchy-row--unknown .player-system-hierarchy-type { color: var(--text-muted); }
.player-system-hierarchy-row--known-type .player-system-hierarchy-glyph,
.player-system-hierarchy-row--known-type .player-system-hierarchy-type { color: var(--text-secondary); }
.player-system-hierarchy-row--revealed .player-system-hierarchy-glyph,
.player-system-hierarchy-row--revealed .player-system-hierarchy-type { color: var(--map-installation); }
.player-system-hierarchy-orbit-mark { color: var(--map-muted); }
.player-system-hierarchy-type,
.player-system-hierarchy-path { color: var(--text-muted); font-size: .72rem; line-height: 1.35; }
.player-system-hierarchy-path { font-size: .68rem; }
.player-system-hierarchy-toggle { grid-column: 2; }
</style>
