import type { LocalWorkspace } from '../domain/workspace'

export type SearchTarget = { workspaceId: string; clusterId: string }
  & ({ kind: 'cluster' } | { kind: 'system'; systemId: string })

export interface SearchResult {
  /** Stable only for this workspace identity and result target; never display it as disambiguation. */
  key: string
  target: SearchTarget
  name: string
  typeLabel: string
  contextLabel: string
  /** Deterministic result-only disambiguation for otherwise equivalent visible labels. */
  occurrence: number | null
}

interface SearchCandidate {
  result: SearchResult
  normalizedName: string
  identityOrder: string
}

function normalizeSearchText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function visibleLabelKey(result: SearchResult, normalizedName: string): string {
  return JSON.stringify([
    normalizedName,
    result.typeLabel,
    normalizeSearchText(result.contextLabel),
  ])
}

function resultKey(target: SearchTarget): string {
  return target.kind === 'cluster'
    ? JSON.stringify([target.workspaceId, target.clusterId, target.kind])
    : JSON.stringify([target.workspaceId, target.clusterId, target.kind, target.systemId])
}

function matchRank(name: string, query: string): number | null {
  if (name === query) return 0
  if (name.startsWith(query)) return 1
  if (name.includes(query)) return 2
  return null
}

/** Searches the current applied workspace snapshot; callers must not supply draft or preview data. */
export function searchWorkspace(workspace: LocalWorkspace, rawQuery: string): SearchResult[] {
  const query = normalizeSearchText(rawQuery.trim())
  if (!query) return []

  const candidates: SearchCandidate[] = [
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
        occurrence: null,
      },
      normalizedName: normalizeSearchText(workspace.cluster.name),
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
        occurrence: null,
      },
      normalizedName: normalizeSearchText(system.name),
      identityOrder: `system:${system.id}`,
    })),
  ]

  const duplicateLabels = new Map<string, SearchCandidate[]>()
  for (const candidate of candidates) {
    candidate.result.key = resultKey(candidate.result.target)
    const labelKey = visibleLabelKey(candidate.result, candidate.normalizedName)
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
    .map(candidate => ({ candidate, rank: matchRank(candidate.normalizedName, query) }))
    .filter((match): match is { candidate: SearchCandidate; rank: number } => match.rank !== null)
    .sort((left, right) => left.rank - right.rank
      || compareText(left.candidate.normalizedName, right.candidate.normalizedName)
      || compareText(normalizeSearchText(left.candidate.result.contextLabel), normalizeSearchText(right.candidate.result.contextLabel))
      || compareText(left.candidate.result.typeLabel, right.candidate.result.typeLabel)
      || compareText(left.candidate.identityOrder, right.candidate.identityOrder))
    .map(({ candidate }) => candidate.result)
}
