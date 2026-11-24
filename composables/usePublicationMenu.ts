import { computed, nextTick, onBeforeUnmount, onMounted, shallowRef, watch, type Ref } from 'vue'
import type { LocalWorkspace } from '../domain/workspace'
import type { useEditorUiStore } from '../stores/editor-ui'
import type {
  PublicationMenuLease,
  PublicationMenuOptions,
  PublicationMenuRequest,
  PublicationMenuView,
  EntityContextTarget,
} from './editor-workflows/publication-types'

type PublicationUiStore = ReturnType<typeof useEditorUiStore>

interface OwnedMenu extends PublicationMenuView {
  id: number
  workspaceId: string
  clusterId: string
  context: string
  mapCanvas: Element | null
  hierarchyOrigin: {
    container: Element
    keyAttribute: 'data-hierarchy-key' | 'data-route-id' | 'data-system-id'
    key: string
    inTree: boolean
  } | null
  selectionPending: boolean
}

/** Checks visibility through the captured surface's ancestors without moving the viewport. */
function isVisible(element: Element): boolean {
  if (!element.isConnected || element.getClientRects().length === 0 || typeof window === 'undefined') return false

  for (let current: Element | null = element; current; current = current.parentElement) {
    if (current.hasAttribute('hidden') || current.hasAttribute('inert')) return false
    const style = window.getComputedStyle(current)
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false
  }
  return true
}

function captureHierarchyOrigin(request: PublicationMenuRequest): OwnedMenu['hierarchyOrigin'] {
  const item = request.opener.closest('[role="treeitem"]')
  const row = item?.matches('[data-hierarchy-key]')
    ? item
    : [...(item?.querySelectorAll('[data-hierarchy-key]') ?? [])]
        .find(candidate => candidate.closest('[role="treeitem"]') === item)
  const tree = row?.closest('[role="tree"]')
  const rowKey = row?.getAttribute('data-hierarchy-key')
  if (row && tree && rowKey && hierarchyRowMatchesTarget(row, request.target)) {
    return { container: tree, keyAttribute: 'data-hierarchy-key', key: rowKey, inTree: true }
  }

  if (request.target.kind === 'route') {
    const routeRow = request.opener.closest('[data-route-id]')
    const routeList = routeRow?.closest('nav[aria-label="Jump Routes"]')
    if (routeRow?.getAttribute('data-route-id') === request.target.id && routeList) {
      return { container: routeList, keyAttribute: 'data-route-id', key: request.target.id, inTree: false }
    }
  }

  if (request.target.kind === 'system') {
    const systemRow = request.opener.closest('[data-system-id]')
    const systemList = systemRow?.closest('nav[aria-label="Star systems"]')
    if (systemRow?.getAttribute('data-system-id') === request.target.id && systemList) {
      return { container: systemList, keyAttribute: 'data-system-id', key: request.target.id, inTree: false }
    }
  }
  return null
}

function hierarchyRowMatchesTarget(row: Element, target: EntityContextTarget): boolean {
  if (target.kind === 'route') return row.getAttribute('data-route-id') === target.id
  if (target.kind === 'system') return row.getAttribute('data-system-id') === target.id
  return row.getAttribute('data-system-id') === target.systemId
    && row.getAttribute(target.kind === 'object' ? 'data-object-id' : 'data-orbit-id') === target.id
}

/** Owns one transient context menu and its originating target/focus lifetime for a page. */
export function usePublicationMenu(options: {
  workspace: Ref<LocalWorkspace | null>
  store: PublicationUiStore
  continuousMap?: Readonly<Ref<boolean>>
  canRestoreFocus?: (request: PublicationMenuRequest) => boolean
  prepareContextObjectSelection?: (objectId: string, isCurrent: () => boolean) => Promise<boolean>
}) {
  const {
    workspace,
    store,
    continuousMap,
    canRestoreFocus = () => true,
    prepareContextObjectSelection,
  } = options
  const active = shallowRef<OwnedMenu | null>(null)
  let sequence = 0
  let disposed = false
  let pending: OwnedMenu | null = null

  function contextSignature(): string {
    return JSON.stringify([
      store.workspaceId,
      continuousMap?.value === true,
      store.activeView,
      store.selectedSystemId,
      store.clusterSelectedSystemId,
      store.inspectedClusterSystemId,
      store.inspectedTarget,
      store.mapMode,
    ])
  }

  function targetExists(current: LocalWorkspace, target: EntityContextTarget): boolean {
    if (target.kind === 'system') return target.systemId === target.id
      && current.cluster.systems.some(system => system.id === target.id)
    if (target.kind === 'route') return current.cluster.routes.some(route => route.id === target.id)
    return current.cluster.systems.some(system => system.id === target.systemId
      && (target.kind === 'object'
        ? system.objects.some(object => object.id === target.id)
        : system.orbits.some(orbit => orbit.id === target.id)))
  }

  function close(id?: number): void {
    if (id === undefined) {
      active.value = null
      if (pending) pending.selectionPending = false
      pending = null
      return
    }
    if (active.value?.id === id) active.value = null
    if (pending?.id === id) {
      pending.selectionPending = false
      pending = null
    }
  }

  function menuContextIsCurrent(menu: OwnedMenu): boolean {
    const current = workspace.value
    return !!current && current.id === menu.workspaceId && current.cluster.id === menu.clusterId
      && contextSignature() === menu.context && targetExists(current, menu.target)
  }

  function isTargetInMapContext(menu: OwnedMenu): boolean {
    if (menu.source !== 'map') return true
    const canvas = menu.mapCanvas
    const continuousMap = !!canvas?.querySelector('.continuous-warden-map-svg')
    if (continuousMap) {
      return store.activeView === 'cluster'
        && canvas?.getAttribute('data-workspace-id') === menu.workspaceId
        && canvas?.getAttribute('data-cluster-id') === menu.clusterId
    }
    if (menu.target.kind === 'system' || menu.target.kind === 'route') return store.activeView === 'cluster'
    return store.activeView === 'system' && store.selectedSystemId === menu.target.systemId
  }

  function markerMatchesTarget(menu: OwnedMenu, marker: Element): boolean {
    if (!isTargetInMapContext(menu)) return false
    if (menu.target.kind === 'system') {
      return marker.matches('.cluster-system-node[data-system-id]')
        && marker.getAttribute('data-system-id') === menu.target.id
    }
    if (menu.target.kind === 'route') {
      return marker.matches('.cluster-route[data-route-id]')
        && marker.getAttribute('data-route-id') === menu.target.id
    }

    const continuousMap = !!menu.mapCanvas?.querySelector('.continuous-warden-map-svg')
    if (continuousMap) {
      if (menu.target.kind === 'object') {
        return marker.matches('.continuous-warden-object[data-system-id][data-object-id]')
          && marker.getAttribute('data-system-id') === menu.target.systemId
          && marker.getAttribute('data-object-id') === menu.target.id
      }
      return marker.matches(
        '.continuous-warden-orbit-target[data-system-id][data-orbit-id], '
        + '.continuous-warden-orbit-edit-handle[data-system-id][data-orbit-id]',
      )
        && marker.getAttribute('data-system-id') === menu.target.systemId
        && marker.getAttribute('data-orbit-id') === menu.target.id
    }
    const systemMap = menu.mapCanvas?.querySelector('.system-map-svg[data-system-id]')
    if (systemMap?.getAttribute('data-system-id') !== menu.target.systemId) return false
    if (menu.target.kind === 'object') {
      return marker.matches('.system-object[data-object-id]')
        && marker.getAttribute('data-object-id') === menu.target.id
    }
    return marker.matches(
      '.orbit-hit-target[data-orbit-id], .orbit-axis-handle[data-orbit-id], '
      + '.orbit-rotation-handle[data-orbit-id], .orbit-center-handle[data-orbit-id]',
    ) && marker.getAttribute('data-orbit-id') === menu.target.id
  }

  function findMapMarker(menu: OwnedMenu): Element | null {
    const canvas = menu.mapCanvas
    if (!canvas || !isVisible(canvas) || !isTargetInMapContext(menu)) return null

    const continuousMap = canvas.querySelector('.continuous-warden-map-svg') !== null
    const selector = menu.target.kind === 'system'
      ? '.cluster-system-node[data-system-id]'
      : menu.target.kind === 'route'
        ? '.cluster-route[data-route-id]'
        : menu.target.kind === 'object'
          ? continuousMap
            ? '.continuous-warden-object[data-system-id][data-object-id]'
            : '.system-object[data-object-id]'
          : continuousMap
            ? '.continuous-warden-orbit-target[data-system-id][data-orbit-id], '
              + '.continuous-warden-orbit-edit-handle[data-system-id][data-orbit-id]'
            : '.orbit-hit-target[data-orbit-id], .orbit-axis-handle[data-orbit-id], '
              + '.orbit-rotation-handle[data-orbit-id], .orbit-center-handle[data-orbit-id]'
    return [...canvas.querySelectorAll(selector)].find(marker => markerMatchesTarget(menu, marker)) ?? null
  }

  function focusTarget(menu: OwnedMenu): HTMLElement | SVGElement | null {
    const origin = menu.hierarchyOrigin
    if (origin) {
      if (!isVisible(origin.container)) return null
      // Redraws can replace rows; recover only inside the originating tree or list.
      const row = [...origin.container.querySelectorAll<HTMLElement>(`[${origin.keyAttribute}]`)].find(candidate =>
        candidate.getAttribute(origin.keyAttribute) === origin.key
        && hierarchyRowMatchesTarget(candidate, menu.target)
        && (origin.inTree ? candidate.closest('[role="tree"]') === origin.container : true))
      if (!row || !isVisible(row)) return null
      return origin.inTree ? row.closest<HTMLElement>('[role="treeitem"]') ?? row : row
    }
    if (menu.source !== 'map') return isVisible(menu.opener) ? menu.opener : null

    const canvas = menu.mapCanvas
    if (canvas && canvas.contains(menu.opener) && isVisible(canvas) && isVisible(menu.opener)
      && markerMatchesTarget(menu, menu.opener)) return menu.opener

    const replacement = findMapMarker(menu)
    return replacement instanceof HTMLElement || replacement instanceof SVGElement ? replacement : null
  }

  async function restoreFocus(menu: OwnedMenu, closingContent: Element | null): Promise<void> {
    await nextTick()
    if (disposed || sequence !== menu.id || active.value !== null || typeof document === 'undefined') return

    const current = workspace.value
    if (!current || current.id !== menu.workspaceId || current.cluster.id !== menu.clusterId
      || contextSignature() !== menu.context || !targetExists(current, menu.target)) return

    let allowed: boolean
    try {
      allowed = canRestoreFocus(menu)
    } catch {
      return
    }
    if (!allowed) return

    const focused = document.activeElement
    const focusBelongsToClosingMenu = closingContent !== null
      && (focused === closingContent || closingContent.contains(focused))
    if (focused !== document.body && focused !== document.documentElement && !focusBelongsToClosingMenu) return

    const target = focusTarget(menu)
    if (target && isVisible(target)) target.focus({ preventScroll: true })
  }

  function isActiveTargetValid(menu: OwnedMenu): boolean {
    return menuContextIsCurrent(menu) && menu.opener.isConnected
  }

  function isPendingContextCurrent(menu: OwnedMenu): boolean {
    return pending?.id === menu.id
      && menuContextIsCurrent(menu)
      && menu.target.kind === 'object'
      && (menu.source === 'map' || menu.source === 'hierarchy')
      && ((continuousMap?.value === true && store.activeView === 'cluster')
        || (store.activeView === 'system' && store.selectedSystemId === menu.target.systemId))
  }

  const currentRequest = computed<PublicationMenuView | null>(() => {
    const menu = active.value
    return menu && isActiveTargetValid(menu) ? menu : null
  })

  watch([active, currentRequest], ([menu, request]) => {
    if (menu && !request) close(menu.id)
  }, { flush: 'sync' })

  watch([
    () => workspace.value?.id,
    () => workspace.value?.cluster.id,
    contextSignature,
  ], () => {
    const menu = pending
    if (menu && !isPendingContextCurrent(menu)) close(menu.id)
  }, { flush: 'sync' })

  async function openPreparedContextMenu(
    menu: OwnedMenu,
  ): Promise<void> {
    const prepareSelection = prepareContextObjectSelection
    const accepted = prepareSelection
      ? await prepareSelection(menu.target.id, () => isPendingContextCurrent(menu))
      : false
    if (!accepted || !isPendingContextCurrent(menu)) {
      close(menu.id)
      return
    }

    await nextTick()
    const opener = isPendingContextCurrent(menu) ? focusTarget(menu) : null
    menu.selectionPending = false
    if (!opener) {
      close(menu.id)
      return
    }

    menu.opener = opener
    pending = null
    active.value = menu
  }

  function openMenu(request: PublicationMenuRequest, menuOptions?: PublicationMenuOptions): PublicationMenuLease | null {
    const current = workspace.value
    if (disposed || !current || !request?.opener?.isConnected || !Number.isFinite(request.clientPoint.x)
      || !Number.isFinite(request.clientPoint.y) || !targetExists(current, request.target)) return null

    const shouldPrepareSelection = !!menuOptions?.selectObjectForContext
      && request.target.kind === 'object'
      && (request.source === 'map' || request.source === 'hierarchy')
      && (store.activeView === 'system' || (continuousMap?.value === true && store.activeView === 'cluster'))
    if (pending) pending.selectionPending = false
    const menu: OwnedMenu = {
      ...request,
      target: { ...request.target },
      clientPoint: { ...request.clientPoint },
      id: ++sequence,
      workspaceId: current.id,
      clusterId: current.cluster.id,
      context: contextSignature(),
      mapCanvas: request.source === 'map' ? request.opener.closest('.workspace-map-canvas') : null,
      hierarchyOrigin: request.source === 'hierarchy'
        ? captureHierarchyOrigin(request)
        : null,
      selectionPending: shouldPrepareSelection,
      restoreFocus: closingContent => restoreFocus(menu, closingContent),
    }
    const lease: PublicationMenuLease = {
      close: () => close(menu.id),
      isPreparingSelectionFor: objectId => menu.selectionPending
        && menu.target.kind === 'object'
        && objectId === menu.target.id,
    }
    if (shouldPrepareSelection) {
      active.value = null
      pending = menu
      void openPreparedContextMenu(menu).catch(() => {
        menu.selectionPending = false
        close(menu.id)
      })
    } else {
      pending = null
      active.value = menu
    }
    return lease
  }

  const closeOnViewportChange = (): void => close()
  onMounted(() => {
    disposed = false
    window.addEventListener('resize', closeOnViewportChange)
    window.addEventListener('scroll', closeOnViewportChange, true)
  })
  onBeforeUnmount(() => {
    disposed = true
    window.removeEventListener('resize', closeOnViewportChange)
    window.removeEventListener('scroll', closeOnViewportChange, true)
    close()
  })

  return { request: currentRequest, openMenu, close }
}
