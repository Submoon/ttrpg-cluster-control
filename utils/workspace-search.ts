import type { LocalWorkspace } from '../domain/workspace'
import { catalogueSubtypeLabel } from './catalogue-labels'

export type SearchTarget = { workspaceId: string; clusterId: string }
  & ({ kind: 'cluster' } | { kind: 'system'; systemId: string } | { kind: 'object'; systemId: string; objectId: string })

export interface SearchResult {
  /** Stable only for this workspace identity and result target; never display it as disambiguation. */
  key: string
  target: SearchTarget
  name: string
  typeLabel: string
  contextLabel: string
  locationKey?: string
  /** Deterministic result-only disambiguation for otherwise equivalent visible labels. */
  occurrence: number | null
}

interface SearchCandidate {
  result: SearchResult
  normalizedName: string
  normalizedLocationKey?: string
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

/** Searches the current applied workspace snapshot; callers must not supply draft or preview data. */
export function searchWorkspace(workspace: LocalWorkspace, rawQuery: string, activeSystemId?: string): SearchResult[] {
  const query = normalizeSearchText(rawQuery.trim())
  if (!query) return []

  const activeSystem = activeSystemId
    ? workspace.cluster.systems.find(system => system.id === activeSystemId)
    : undefined
  const objectCandidates: SearchCandidate[] = activeSystem
    ? activeSystem.objects.map((object): SearchCandidate => ({
      result: {
        key: '',
        target: {
          workspaceId: workspace.id,
          clusterId: workspace.cluster.id,
          kind: 'object',
          systemId: activeSystem.id,
          objectId: object.id,
        },
        name: object.name,
        typeLabel: catalogueSubtypeLabel(object),
        contextLabel: `Star System: ${activeSystem.name}`,
        locationKey: object.locationKey,
        occurrence: null,
      },
      normalizedName: normalizeSearchText(object.name),
      normalizedLocationKey: normalizeSearchText(object.locationKey),
      identityOrder: `object:${activeSystem.id}:${object.id}`,
    }))
    : []

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
    ...objectCandidates,
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
    .map(candidate => {
      const nameRank = matchRank(candidate.normalizedName, query)
      const keyRank = candidate.normalizedLocationKey === undefined
        ? null
        : matchRank(candidate.normalizedLocationKey, query)
      const rank = nameRank === null
        ? keyRank
        : keyRank === null
          ? nameRank
          : Math.min(nameRank, keyRank)
      return { candidate, rank }
    })
    .filter((match): match is { candidate: SearchCandidate; rank: number } => match.rank !== null)
    .sort((left, right) => left.rank - right.rank
      || compareText(left.candidate.normalizedName, right.candidate.normalizedName)
      || compareText(normalizeSearchText(left.candidate.result.contextLabel), normalizeSearchText(right.candidate.result.contextLabel))
      || compareText(left.candidate.result.typeLabel, right.candidate.result.typeLabel)
      || compareText(left.candidate.identityOrder, right.candidate.identityOrder))
    .map(({ candidate }) => candidate.result)
}
