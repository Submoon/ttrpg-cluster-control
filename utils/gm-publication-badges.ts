import type { PublicationMode, Point } from '../domain/workspace'
import { publicationPresentation, publicationStatus } from './publication-presentation'

const svgNamespace = 'http://www.w3.org/2000/svg'

export interface MapPublicationDecorationOptions {
  identity: string
  mode: PublicationMode
  parentPublication?: PublicationMode
  position: Point
}

/** Adds a non-interactive badge to the administrative sibling layer, outside measured map features. */
export function appendPublicationBadge(
  layer: SVGGElement,
  { identity, mode, parentPublication, position }: MapPublicationDecorationOptions,
): SVGGElement {
  const status = publicationStatus(mode, parentPublication)
  const document = layer.ownerDocument
  const badge = document.createElementNS(svgNamespace, 'g')
  badge.setAttribute('class', `gm-publication-badge${status.parentBlocked ? ' has-parent-publication-gate' : ''}`)
  badge.setAttribute('data-gm-publication-admin', '')
  badge.setAttribute('data-publication-identity', identity)
  badge.setAttribute('transform', `translate(${position.x} ${position.y})`)
  badge.setAttribute('aria-hidden', 'true')
  badge.setAttribute('pointer-events', 'none')
  layer.append(badge)

  const backing = document.createElementNS(svgNamespace, 'circle')
  backing.setAttribute('class', 'gm-publication-badge-backing')
  backing.setAttribute('r', '5.5')
  badge.append(backing)

  const icon = document.createElementNS(svgNamespace, 'g')
  icon.setAttribute('class', 'gm-publication-badge-icon')
  icon.setAttribute('transform', 'translate(-3.84 -3.84) scale(0.32)')
  icon.innerHTML = publicationPresentation(mode).svgBody
  badge.append(icon)

  if (status.parentBlocked) {
    const lockBackground = document.createElementNS(svgNamespace, 'circle')
    lockBackground.setAttribute('class', 'gm-publication-lock-backing')
    lockBackground.setAttribute('cx', '4')
    lockBackground.setAttribute('cy', '-4')
    lockBackground.setAttribute('r', '3')
    badge.append(lockBackground)

    const lock = document.createElementNS(svgNamespace, 'g')
    lock.setAttribute('class', 'gm-publication-lock-icon')
    lock.setAttribute('transform', 'translate(1.84 -6.16) scale(0.18)')
    lock.innerHTML = '<path d="M7 10V7a5 5 0 0 1 10 0v3"/><rect x="5" y="10" width="14" height="11" rx="2"/>'
    badge.append(lock)
  }

  return badge
}

/** Adds a tooltip and screen-reader description without changing the mark's existing accessible name. */
export function describeMapPublication(
  mark: SVGGElement,
  identity: string,
  mode: PublicationMode,
  parentPublication?: PublicationMode,
): void {
  const status = publicationStatus(mode, parentPublication)
  const description = mark.ownerDocument.createElementNS(svgNamespace, 'desc')
  const id = `gm-publication-description-${encodeURIComponent(identity)}`
  description.setAttribute('id', id)
  description.setAttribute('class', 'gm-publication-admin gm-publication-description')
  description.textContent = status.description
  mark.append(description)

  const tooltip = mark.ownerDocument.createElementNS(svgNamespace, 'title')
  tooltip.setAttribute('class', 'gm-publication-admin gm-publication-tooltip')
  tooltip.textContent = status.description
  mark.append(tooltip)
  mark.setAttribute('aria-describedby', id)
  mark.setAttribute('data-gm-publication-described', '')
}
