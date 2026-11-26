import type { PlayerClusterDocument, PlayerObjectMarker } from '../domain/player-projection'
import { playerObjectPresentation } from './player-object-presentation'
import { rankSearchCandidates, type SearchCandidate, type SearchResult } from './workspace-search'

/** Result navigation is fenced by the exact public snapshot from which it was produced. */
export type PlayerSearchTarget = { document: PlayerClusterDocument }
  & (
    | { kind: 'cluster' }
    | { kind: 'system'; systemId: string }
    | { kind: 'object'; systemId: string; objectId: string }
    | { kind: 'branch-object'; branchId: string; objectId: string }
  )

export type PlayerSearchResult = SearchResult<PlayerSearchTarget>

/**
 * Searches only player-visible text and classifications in a detached public document.
 * System and object IDs are used only for navigation; they are never query terms or labels.
 */
export function searchPlayerDocument(document: PlayerClusterDocument, rawQuery: string): PlayerSearchResult[] {
  if (!rawQuery.trim()) return []

  const candidates: SearchCandidate<PlayerSearchTarget>[] = [{
    result: {
      key: 'player-cluster',
      target: { kind: 'cluster', document },
      name: document.title,
      typeLabel: 'Player document',
      contextLabel: 'Current document',
      leadingMark: { kind: 'icon', value: 'i-lucide-network' },
      occurrence: null,
    },
    identityOrder: 'cluster',
    searchTerms: [document.title],
  }]

  document.systems.forEach((system, systemIndex) => {
    if (system.disclosure !== 'revealed') return

    const systemTarget: PlayerSearchTarget = {
      kind: 'system',
      document,
      systemId: system.id,
    }
    candidates.push({
      result: {
        key: `player-system-${systemIndex}`,
        target: systemTarget,
        name: system.label,
        typeLabel: 'Zone',
        contextLabel: `Player document: ${document.title}`,
        leadingMark: { kind: 'icon', value: 'i-lucide-orbit' },
        occurrence: null,
      },
      identityOrder: `system:${String(systemIndex).padStart(8, '0')}`,
      searchTerms: [system.label, 'Zone'],
    })

    system.map.objects.forEach((object, objectIndex) => {
      const key = `player-object-${systemIndex}-${objectIndex}`
      candidates.push(objectCandidate(
        object, key, `Zone: ${system.label}`, { kind: 'object', document, systemId: system.id, objectId: object.id },
        `object:${String(systemIndex).padStart(8, '0')}:${String(objectIndex).padStart(8, '0')}`,
      ))
    })
  })

  const routes = new Map(document.routes.map(route => [route.id, route]))
  for (const branch of document.routeBranches) {
    const route = branch.anchor.kind === 'route' ? routes.get(branch.anchor.routeId) : undefined
    const contextLabel = route ? `Jump Level ${route.jumpLevel}` : 'Jump Cluster'
    for (const object of branch.map.objects) {
      const key = `player-${branch.id}-${object.id}`
      candidates.push(objectCandidate(
        object, key, contextLabel, { kind: 'branch-object', document, branchId: branch.id, objectId: object.id }, key,
      ))
    }
  }

  return rankSearchCandidates(candidates, rawQuery)
}

function objectCandidate(
  object: PlayerObjectMarker,
  key: string,
  contextLabel: string,
  target: PlayerSearchTarget,
  identityOrder: string,
): SearchCandidate<PlayerSearchTarget> {
  const presentation = playerObjectPresentation(object)
  return {
    result: {
      key,
      target,
      name: presentation.label,
      typeLabel: presentation.typeLabel ?? presentation.label,
      contextLabel,
      leadingMark: presentation.glyph === null
        ? { kind: 'none' }
        : { kind: 'glyph', value: presentation.glyph },
      occurrence: null,
    },
    identityOrder,
    searchTerms: [presentation.label, presentation.typeLabel ?? ''],
  }
}
