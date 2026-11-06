import type { PlayerClusterDocument } from '../domain/player-projection'
import { playerObjectPresentation } from './player-object-presentation'
import { rankSearchCandidates, type SearchCandidate, type SearchResult } from './workspace-search'

/** Result navigation is fenced by the exact public snapshot from which it was produced. */
export type PlayerSearchTarget = { document: PlayerClusterDocument }
  & (
    | { kind: 'cluster' }
    | { kind: 'system'; systemId: string }
    | { kind: 'object'; systemId: string; objectId: string }
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
        typeLabel: 'Star system',
        contextLabel: `Player document: ${document.title}`,
        leadingMark: { kind: 'icon', value: 'i-lucide-orbit' },
        occurrence: null,
      },
      identityOrder: `system:${String(systemIndex).padStart(8, '0')}`,
      searchTerms: [system.label, 'Star system'],
    })

    system.map.objects.forEach((object, objectIndex) => {
      const presentation = playerObjectPresentation(object)
      const typeLabel = presentation.typeLabel ?? presentation.label
      const target: PlayerSearchTarget = {
        kind: 'object',
        document,
        systemId: system.id,
        objectId: object.id,
      }
      candidates.push({
        result: {
          key: `player-object-${systemIndex}-${objectIndex}`,
          target,
          name: presentation.label,
          typeLabel,
          contextLabel: `Star system: ${system.label}`,
          leadingMark: presentation.glyph === null
            ? { kind: 'none' }
            : { kind: 'glyph', value: presentation.glyph },
          occurrence: null,
        },
        identityOrder: `object:${String(systemIndex).padStart(8, '0')}:${String(objectIndex).padStart(8, '0')}`,
        searchTerms: [presentation.label, presentation.typeLabel ?? ''],
      })
    })
  })

  return rankSearchCandidates(candidates, rawQuery)
}
