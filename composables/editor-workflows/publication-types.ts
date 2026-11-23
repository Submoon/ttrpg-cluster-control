import type { PublicationMode } from '../../domain/workspace'

export interface PublicationTarget {
  kind: 'system' | 'object'
  id: string
  systemId: string
}

export interface OrbitContextTarget {
  kind: 'orbit'
  id: string
  systemId: string
}

export type EntityContextTarget = PublicationTarget | OrbitContextTarget | { kind: 'route'; id: string }

export interface PublicationRequest {
  targets: readonly (PublicationTarget | OrbitContextTarget)[]
  mode: PublicationMode
}

export interface PublicationMenuRequest {
  target: EntityContextTarget
  clientPoint: { x: number; y: number }
  opener: HTMLElement | SVGElement
  source: 'map' | 'hierarchy' | 'inspector'
}

export interface PublicationMenuOptions {
  /** Select the target object before opening its context menu. */
  selectObjectForContext?: boolean
}

/** Read-only menu view whose focus return is revalidated by the page-scoped owner. */
export interface PublicationMenuView extends PublicationMenuRequest {
  restoreFocus(closingContent: Element | null): Promise<void>
}

export interface PublicationMenuLease {
  close(): void
  isPreparingSelectionFor(objectId: string | null): boolean
}
