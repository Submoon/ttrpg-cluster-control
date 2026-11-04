import type { PlayerObjectMarker, PlayerOrbit, PlayerSystemDocument } from '../domain/player-projection'
import { playerObjectPresentation } from './player-object-presentation'

export type PlayerHierarchyNode =
  | {
      kind: 'object'
      key: string
      label: string
      object: PlayerObjectMarker
      children?: PlayerHierarchyNode[]
    }
  | {
      kind: 'orbit'
      key: string
      label: string
      orbit: PlayerOrbit
      children?: PlayerHierarchyNode[]
    }

/** Builds the nested public object and Orbit graph without consulting source records or ancestor paths. */
export function buildPlayerSystemHierarchy(document: PlayerSystemDocument): PlayerHierarchyNode[] {
  const objectsById = new Map(document.objects.map(object => [object.id, object]))
  const objectNodes = new Map(document.objects.map((object) => {
    const node: PlayerHierarchyNode = {
      kind: 'object',
      key: `object:${object.id}`,
      label: playerObjectPresentation(object).label,
      object,
    }
    return [object.id, node] as const
  }))
  const orbitNodes = new Map(document.orbits.map((orbit) => {
    const host = orbit.hostId === null ? null : objectsById.get(orbit.hostId) ?? null
    const node: PlayerHierarchyNode = {
      kind: 'orbit',
      key: `orbit:${orbit.id}`,
      label: host
        ? `Orbit around ${summarizePlayerContextLabel(playerObjectPresentation(host).label)}`
        : 'Orbit around unoccupied center',
      orbit,
    }
    return [orbit.id, node] as const
  }))

  for (const orbit of document.orbits) {
    if (orbit.hostId === null) continue
    const host = objectNodes.get(orbit.hostId)
    const orbitNode = orbitNodes.get(orbit.id)
    if (host && orbitNode) appendChild(host, orbitNode)
  }

  for (const object of document.objects) {
    if (object.placement.kind !== 'orbit') continue
    const orbitNode = orbitNodes.get(object.placement.orbitId)
    const objectNode = objectNodes.get(object.id)
    if (orbitNode && objectNode) appendChild(orbitNode, objectNode)
  }

  const systemLevelObjects = document.objects
    .filter(object => object.placement.kind === 'system')
    .flatMap(object => objectNodes.get(object.id) ?? [])
  const unoccupiedOrbits = document.orbits
    .filter(orbit => orbit.hostId === null)
    .flatMap(orbit => orbitNodes.get(orbit.id) ?? [])
  return [...systemLevelObjects, ...unoccupiedOrbits]
}

/** Shortens a repeated public parent label without splitting a surrogate pair. */
export function summarizePlayerContextLabel(label: string): string {
  const maximumLength = 80
  if (label.length <= maximumLength) return label
  let prefix = label.slice(0, maximumLength - 1)
  const lastCodeUnit = prefix.charCodeAt(prefix.length - 1)
  const nextCodeUnit = label.charCodeAt(prefix.length)
  if (lastCodeUnit >= 0xD800 && lastCodeUnit <= 0xDBFF
    && nextCodeUnit >= 0xDC00 && nextCodeUnit <= 0xDFFF) {
    prefix = prefix.slice(0, -1)
  }
  return `${prefix}…`
}

function appendChild(parent: PlayerHierarchyNode, child: PlayerHierarchyNode): void {
  parent.children ??= []
  parent.children.push(child)
}
