import { nextTick, onBeforeUnmount } from 'vue'
import type { ClientRectBounds } from '../../utils/map-usable-area'

export interface WardenMapDomOptions {
  getRoot: () => SVGSVGElement | null
  getUsableClientRect?: () => ClientRectBounds | undefined
}

export interface WardenMapOrbitEditTarget {
  systemId: string
  orbitId: string
  kind: 'resize' | 'rotation' | 'center'
  axis: 'global' | 'horizontal' | 'vertical'
}

export interface WardenMapSystemFrameResizeTarget {
  systemId: string
  corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
}

const detailEntitySelector = [
  '.continuous-warden-object[data-system-id]',
  '.continuous-warden-orbit-target[data-system-id]',
  '.continuous-warden-orbit-edit-handle[data-system-id]',
].join(', ')

/** Owns Warden SVG target decoding and focus that depends on the mounted map DOM. */
export function useWardenMapDom({ getRoot, getUsableClientRect }: WardenMapDomOptions) {
  let focusGeneration = 0
  let disposed = false

  function closestInRoot<T extends Element>(target: EventTarget | null, selector: string): T | null {
    if (typeof Element === 'undefined' || !(target instanceof Element)) return null
    const root = getRoot()
    if (!root?.isConnected) return null
    const match = target.closest<T>(selector)
    return root && match && root.contains(match) ? match : null
  }

  function systemIdAtTarget(target: EventTarget | null): string | null {
    return closestInRoot<SVGElement>(target, '.cluster-system-node[data-system-id]')
      ?.getAttribute('data-system-id') ?? null
  }

  function objectTargetAtTarget(target: EventTarget | null): { systemId: string; objectId: string } | null {
    const mark = closestInRoot<SVGElement>(target, '.continuous-warden-object[data-system-id][data-object-id]')
    const systemId = mark?.getAttribute('data-system-id')
    const objectId = mark?.getAttribute('data-object-id')
    return systemId && objectId ? { systemId, objectId } : null
  }

  function orbitTargetAtTarget(target: EventTarget | null): { systemId: string; orbitId: string } | null {
    const mark = closestInRoot<SVGElement>(target,
      '.continuous-warden-orbit-target[data-system-id][data-orbit-id], '
      + '.continuous-warden-orbit-hit-target[data-system-id][data-orbit-id], '
      + '.continuous-warden-orbit-visible-arc[data-system-id][data-orbit-id], '
      + '.continuous-warden-orbit-edit-handle[data-system-id][data-orbit-id]',
    )
    const systemId = mark?.getAttribute('data-system-id')
    const orbitId = mark?.getAttribute('data-orbit-id')
    return systemId && orbitId ? { systemId, orbitId } : null
  }

  function orbitEditTargetAtTarget(target: EventTarget | null): WardenMapOrbitEditTarget | null {
    const handle = closestInRoot<SVGElement>(target, '.continuous-warden-orbit-edit-handle[data-system-id][data-orbit-id]')
    const handleSystemId = handle?.getAttribute('data-system-id')
    const handleOrbitId = handle?.getAttribute('data-orbit-id')
    if (handle && handleSystemId && handleOrbitId) {
      const kind = handle.getAttribute('data-orbit-edit-kind')
      if (kind === 'rotation' || kind === 'center') {
        return { systemId: handleSystemId, orbitId: handleOrbitId, kind, axis: 'global' }
      }
      if (kind === 'resize') {
        const axis = handle.getAttribute('data-resize-axis')
        return {
          systemId: handleSystemId,
          orbitId: handleOrbitId,
          kind,
          axis: axis === 'horizontal' || axis === 'vertical' ? axis : 'global',
        }
      }
    }
    const orbit = orbitTargetAtTarget(target)
    return orbit ? { ...orbit, kind: 'resize', axis: 'global' } : null
  }

  function routeIdAtTarget(target: EventTarget | null): string | null {
    return closestInRoot<SVGElement>(target, '.cluster-route[data-route-id]')
      ?.getAttribute('data-route-id') ?? null
  }

  function systemFrameResizeTarget(target: EventTarget | null): WardenMapSystemFrameResizeTarget | null {
    const button = closestInRoot<HTMLButtonElement>(target, 'button[data-system-resize-handle][data-system-id]')
    const systemId = button?.getAttribute('data-system-id')
    const corner = button?.getAttribute('data-system-resize-handle')
    if (!systemId || (corner !== 'top-left' && corner !== 'top-right'
      && corner !== 'bottom-left' && corner !== 'bottom-right')) return null
    return { systemId, corner }
  }

  function isExitMarkerTarget(target: EventTarget | null): boolean {
    return closestInRoot<SVGElement>(target, '.cluster-exit-hit-target, .cluster-exit-mark') !== null
  }

  function focusOrbitFromPath(
    eventTarget: EventTarget | null,
    orbit: { systemId: string; orbitId: string },
  ): void {
    const path = closestInRoot<SVGPathElement>(
      eventTarget,
      'path.continuous-warden-orbit-visible-arc, path.continuous-warden-orbit-hit-target',
    )
    const root = getRoot()
    if (!path || !root) return
    const systemId = CSS.escape(orbit.systemId)
    const orbitId = CSS.escape(orbit.orbitId)
    root.querySelector<SVGElement>(
      `.continuous-warden-orbit-target[data-system-id="${systemId}"][data-orbit-id="${orbitId}"]`,
    )?.focus({ preventScroll: true })
  }

  function focusMap(): void {
    const root = getRoot()
    if (root?.isConnected) root.focus({ preventScroll: true })
  }

  function focusedDetailSystemId(): string | null {
    const root = getRoot()
    const focused = root?.ownerDocument.activeElement
    if (!root || typeof Element === 'undefined' || !focused
      || !(focused instanceof Element) || !root.contains(focused)) return null
    const entity = focused.closest<SVGElement>(detailEntitySelector)
    return entity && root.contains(entity) ? entity.getAttribute('data-system-id') : null
  }

  function preserveFocusBeforeDetailCollapse(nextDetailSystemIds: ReadonlySet<string>): void {
    const capturedGeneration = ++focusGeneration
    const root = getRoot()
    if (!root?.isConnected) return
    const document = root.ownerDocument
    const focusedMark = document.activeElement
    if (typeof Element === 'undefined' || !(focusedMark instanceof Element) || !root.contains(focusedMark)) return
    const focusedEntity = focusedMark.closest<SVGElement>(detailEntitySelector)
    const systemId = focusedEntity?.getAttribute('data-system-id')
    if (!focusedEntity || !root.contains(focusedEntity) || !systemId || nextDetailSystemIds.has(systemId)) return

    void nextTick(() => {
      if (disposed || capturedGeneration !== focusGeneration || getRoot() !== root || !root.isConnected) return
      const currentFocus = document.activeElement
      if (currentFocus !== document.body && currentFocus !== root && currentFocus !== focusedMark) return
      const markIsMountedHere = focusedEntity.isConnected && root.contains(focusedEntity)
      const markIsHidden = !markIsMountedHere
        || focusedEntity.closest('[inert], [aria-hidden="true"]') !== null
        || focusedEntity.getClientRects().length === 0
      if (!markIsHidden) return

      const usable = getUsableClientRect?.()
      const visibleName = usable
        ? [...root.querySelectorAll<SVGElement>('.continuous-warden-name-target[data-system-id]')]
            .find((candidate) => {
              if (candidate.getAttribute('data-system-id') !== systemId
                || !candidate.isConnected || !root.contains(candidate) || candidate.getClientRects().length === 0) return false
              if (candidate.closest('[inert], [aria-hidden="true"]')) return false
              const bounds = candidate.getBoundingClientRect()
              return bounds.left >= usable.left && bounds.top >= usable.top
                && bounds.right <= usable.right && bounds.bottom <= usable.bottom
            })
        : undefined
      if (visibleName) visibleName.focus({ preventScroll: true })
      else focusMap()
    })
  }

  onBeforeUnmount(() => {
    disposed = true
    focusGeneration += 1
  })

  return {
    systemIdAtTarget,
    objectTargetAtTarget,
    orbitTargetAtTarget,
    orbitEditTargetAtTarget,
    routeIdAtTarget,
    systemFrameResizeTarget,
    isExitMarkerTarget,
    focusOrbitFromPath,
    focusMap,
    focusedDetailSystemId,
    preserveFocusBeforeDetailCollapse,
  }
}
