import type { LocalWorkspace } from '../domain/workspace'
import { catalogueSubtypeLabel } from './catalogue-labels'
import { objectMark } from './catalogue-marks'

export type SearchTarget = { workspaceId: string; clusterId: string }
  & ({ kind: 'cluster' } | { kind: 'system'; systemId: string } | { kind: 'object'; systemId: string; objectId: string })

export type SearchResultMark =
  | { kind: 'glyph'; value: string }
  | { kind: 'icon'; value: 'i-lucide-network' | 'i-lucide-orbit' }
  | { kind: 'none' }

export interface SearchResult<TTarget = SearchTarget> {
  /** Stable within one consumer's result list and never displayed as disambiguation. */
  key: string
  target: TTarget
  name: string
  typeLabel: string
  contextLabel: string
  leadingMark: SearchResultMark
  locationKey?: string
  /** Deterministic result-only disambiguation for otherwise equivalent visible labels. */
  occurrence: number | null
}

export interface SearchCandidate<TTarget = SearchTarget> {
  result: SearchResult<TTarget>
  identityOrder: string
  /** Explicit corpus terms for consumers whose public labels differ from their display context. */
  searchTerms?: readonly string[]
}

function normalizeSearchText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function visibleLabelKey<TTarget>(result: SearchResult<TTarget>, normalizedName: string): string {
  return JSON.stringify([
    normalizedName,
    result.typeLabel,
    normalizeSearchText(result.contextLabel),
    result.locationKey ?? '',
  ])
}

function resultKey(target: SearchTarget): string {
  if (target.kind === 'cluster') return JSON.stringify([target.workspaceId, target.clusterId, target.kind])
  return target.kind === 'system'
    ? JSON.stringify([target.workspaceId, target.clusterId, target.kind, target.systemId])
    : JSON.stringify([target.workspaceId, target.clusterId, target.kind, target.systemId, target.objectId])
}

function matchRank(name: string, query: string): number | null {
  if (name === query) return 0
  if (name.startsWith(query)) return 1
  if (name.includes(query)) return 2
  return null
}

/** Ranks one consumer's already allowlisted candidates with shared matching and duplicate-label rules. */
export function rankSearchCandidates<TTarget>(
  candidates: readonly SearchCandidate<TTarget>[],
  rawQuery: string,
): SearchResult<TTarget>[] {
  const query = normalizeSearchText(rawQuery.trim())
  if (!query) return []

  const duplicateLabels = new Map<string, SearchCandidate<TTarget>[]>()
  for (const candidate of candidates) {
    const normalizedName = normalizeSearchText(candidate.result.name)
    const labelKey = visibleLabelKey(candidate.result, normalizedName)
    const matches = duplicateLabels.get(labelKey) ?? []
    matches.push(candidate)
    duplicateLabels.set(labelKey, matches)
  }

  for (const matches of duplicateLabels.values()) {
    if (matches.length < 2) continue
    matches.sort((left, right) => compareText(left.identityOrder, right.identityOrder))
    matches.forEach((candidate, index) => { candidate.result.occurrence = index + 1 })
  }

  return candidates
    .map(candidate => {
      const normalizedName = normalizeSearchText(candidate.result.name)
      const searchTerms = candidate.searchTerms
        ?? [candidate.result.name, candidate.result.locationKey ?? '']
      const rank = searchTerms
        .map(term => matchRank(normalizeSearchText(term), query))
        .filter((termRank): termRank is number => termRank !== null)
        .reduce<number | null>((best, termRank) => best === null ? termRank : Math.min(best, termRank), null)
      return { candidate, normalizedName, rank }
    })
    .filter((match): match is { candidate: SearchCandidate<TTarget>; normalizedName: string; rank: number } => match.rank !== null)
    .sort((left, right) => left.rank - right.rank
      || compareText(left.normalizedName, right.normalizedName)
      || compareText(normalizeSearchText(left.candidate.result.contextLabel), normalizeSearchText(right.candidate.result.contextLabel))
      || compareText(left.candidate.result.typeLabel, right.candidate.result.typeLabel)
      || compareText(left.candidate.identityOrder, right.candidate.identityOrder))
    .map(({ candidate }) => candidate.result)
}

/** Searches the current applied workspace snapshot; callers must not supply draft or preview data. */
export function searchWorkspace(workspace: LocalWorkspace, rawQuery: string): SearchResult[] {
  if (!normalizeSearchText(rawQuery.trim())) return []

  const objectCandidates: SearchCandidate<SearchTarget>[] = workspace.cluster.systems.flatMap(system =>
    system.objects.map((object): SearchCandidate<SearchTarget> => ({
      result: {
        key: '',
        target: {
          workspaceId: workspace.id,
          clusterId: workspace.cluster.id,
          kind: 'object',
          systemId: system.id,
          objectId: object.id,
        },
        name: object.name,
        typeLabel: catalogueSubtypeLabel(object),
        contextLabel: `Star System: ${system.name}`,
        leadingMark: { kind: 'glyph', value: objectMark(object) },
        locationKey: object.locationKey,
        occurrence: null,
      },
      identityOrder: `object:${system.id}:${object.id}`,
    })),
  )

  const candidates: SearchCandidate<SearchTarget>[] = [
    {
      result: {
        key: '',
        target: {
          workspaceId: workspace.id,
          clusterId: workspace.cluster.id,
          kind: 'cluster',
        },
        name: workspace.cluster.name,
        typeLabel: 'Jump Cluster',
        contextLabel: 'Current workspace',
        leadingMark: { kind: 'icon', value: 'i-lucide-network' },
        occurrence: null,
      },
      identityOrder: `cluster:${workspace.cluster.id}`,
    },
    ...workspace.cluster.systems.map((system): SearchCandidate => ({
      result: {
        key: '',
        target: {
          workspaceId: workspace.id,
          clusterId: workspace.cluster.id,
          kind: 'system',
          systemId: system.id,
        },
        name: system.name,
        typeLabel: 'Star System',
        contextLabel: `Jump Cluster: ${workspace.cluster.name}`,
        leadingMark: { kind: 'icon', value: 'i-lucide-orbit' },
        occurrence: null,
      },
      identityOrder: `system:${system.id}`,
    })),
    ...objectCandidates,
  ]

  for (const candidate of candidates) {
    candidate.result.key = resultKey(candidate.result.target)
  }

  return rankSearchCandidates(candidates, rawQuery)
}
