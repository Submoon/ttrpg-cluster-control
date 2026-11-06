import { jumpPointsInCluster } from '../domain/workspace'
import type { JumpCluster, JumpPointReference, JumpRoute, PublicationMode, Point } from '../domain/workspace'
import { publicationPresentation, publicationStatus } from './publication-presentation'

const svgNamespace = 'http://www.w3.org/2000/svg'

export interface MapPublicationDecorationOptions {
  identity: string
  mode: PublicationMode
  parentPublication?: PublicationMode
  position: Point
}

export interface RouteSharingStatus {
  visibilityLabel: 'Private' | 'Shared with players'
  hasVisibleEndpoint: boolean
  isBlocked: boolean
  noVisibleEndpointMessage: string | null
  description: string
}

/** Describes the configured route setting and whether its existing endpoints appear in player projection. */
export function routeSharingStatus(
  cluster: JumpCluster,
  route: JumpRoute,
  points: ReadonlyMap<string, JumpPointReference> = new Map(
    jumpPointsInCluster(cluster).map(reference => [reference.point.id, reference]),
  ),
): RouteSharingStatus {
  const origin = points.get(route.fromPointId)
  const destination = route.toPointId === null ? undefined : points.get(route.toPointId)
  const hasVisibleEndpoint = route.toPointId === null
    ? origin !== undefined && origin.system.publication !== 'hidden'
    : origin !== undefined && destination !== undefined
      && (origin.system.publication !== 'hidden' || destination.system.publication !== 'hidden')
  const visibilityLabel = route.playerShared ? 'Shared with players' : 'Private'
  const isBlocked = route.playerShared && !hasVisibleEndpoint
  const noVisibleEndpointMessage = !isBlocked
    ? null
    : route.toPointId === null
      ? 'This shared route has no visible endpoint because its origin system is Hidden.'
      : origin && destination
        ? 'This shared route has no visible endpoint because both endpoint systems are Hidden.'
        : 'This shared route has no visible endpoint in the current player view.'
  const description = route.playerShared
    ? isBlocked
      ? `Configured visibility: ${visibilityLabel}. ${noVisibleEndpointMessage}`
      : `Configured visibility: ${visibilityLabel}. The route appears when at least one endpoint system is visible; Hidden systems are anonymized.`
    : `Configured visibility: ${visibilityLabel}. This route is omitted from player publication.`

  return { visibilityLabel, hasVisibleEndpoint, isBlocked, noVisibleEndpointMessage, description }
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

/** Adds an eye/eye-off route badge and a lock when a shared route has no retained endpoint. */
export function appendRouteSharingBadge(
  layer: SVGGElement,
  { identity, playerShared, hasVisibleEndpoint, position }: {
    identity: string
    playerShared: boolean
    hasVisibleEndpoint: boolean
    position: Point
  },
): SVGGElement {
  const badge = appendPublicationBadge(layer, {
    identity,
    mode: playerShared ? 'revealed' : 'hidden',
    ...(playerShared && !hasVisibleEndpoint ? { parentPublication: 'hidden' as const } : {}),
    position,
  })
  badge.setAttribute('data-route-sharing', playerShared ? 'shared' : 'private')
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
  describeAdministrativeStatus(mark, identity, status.description)
}

/** Adds a private publication description to a Warden-only accessible map mark. */
function describeAdministrativeStatus(mark: SVGGElement, identity: string, text: string): void {
  const description = mark.ownerDocument.createElementNS(svgNamespace, 'desc')
  const id = `gm-publication-description-${encodeURIComponent(identity)}`
  description.setAttribute('id', id)
  description.setAttribute('class', 'gm-publication-admin gm-publication-description')
  description.textContent = text
  mark.append(description)

  const tooltip = mark.ownerDocument.createElementNS(svgNamespace, 'title')
  tooltip.setAttribute('class', 'gm-publication-admin gm-publication-tooltip')
  tooltip.textContent = text
  mark.append(tooltip)
  mark.setAttribute('aria-describedby', id)
  mark.setAttribute('data-gm-publication-described', '')
}

/** Adds the committed route-sharing status to the Warden's accessible map description. */
export function describeRouteSharing(
  mark: SVGGElement,
  identity: string,
  status: RouteSharingStatus,
): void {
  describeAdministrativeStatus(mark, identity, status.description)
}
