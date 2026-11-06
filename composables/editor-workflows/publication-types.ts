import type { PublicationMode } from '../../domain/workspace'

export interface PublicationTarget {
  kind: 'system' | 'object'
  id: string
  systemId: string
}

export interface PublicationRequest {
  targets: readonly PublicationTarget[]
  mode: PublicationMode
}

export interface PublicationMenuRequest {
  target: PublicationTarget
  clientPoint: { x: number; y: number }
  opener: HTMLElement | SVGElement
  source: 'map' | 'hierarchy' | 'inspector'
}

/** Read-only menu view whose focus return is revalidated by the page-scoped owner. */
export interface PublicationMenuView extends PublicationMenuRequest {
  restoreFocus(closingContent: Element | null): Promise<void>
}

export interface PublicationMenuLease {
  close(): void
}
