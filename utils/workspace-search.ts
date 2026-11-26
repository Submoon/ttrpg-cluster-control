import { routeContentsFor, type CatalogueObject, type LocalWorkspace, type PublicationMode } from '../domain/workspace'
import { catalogueSubtypeLabel } from './catalogue-labels'
import { objectMark } from './catalogue-marks'
import type { FieldCondition } from './field-filter-matching'
import { normalizeSearchText } from './normalize-search-text'
import { createWardenObjectFilterMatcher } from './warden-map-filters'

export type SearchTarget = { workspaceId: string; clusterId: string }
  & ({ kind: 'cluster' } | { kind: 'system'; systemId: string }
    | ({ kind: 'object'; objectId: string } & (
      { systemId: string; routeId?: never } | { routeId: string; systemId?: never }
    )))

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

export interface WorkspaceSearchCriteria {
  /** OR alternatives across catalogue types. */
  types: readonly string[]
  /** OR alternatives across current Player publication settings. */
  publicationModes: readonly PublicationMode[]
  /** One condition per Field; different Fields combine with AND. */
  fieldConditions: readonly FieldCondition[]
}

interface WorkspaceObjectSearchCandidate extends SearchCandidate<SearchTarget> {
  ownerId: string
  ownerName: string
  object: CatalogueObject
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
    : JSON.stringify([target.workspaceId, target.clusterId, target.kind, target.routeId ?? target.systemId, target.objectId])
}

function matchRank(name: string, query: string): number | null {
  if (name === query) return 0
  if (name.startsWith(query)) return 1
  if (name.includes(query)) return 2
  return null
}

function setDuplicateOccurrences<TTarget>(candidates: readonly SearchCandidate<TTarget>[]): void {
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
}

/** Ranks one consumer's already allowlisted candidates with shared matching and duplicate-label rules. */
export function rankSearchCandidates<TTarget>(
  candidates: readonly SearchCandidate<TTarget>[],
  rawQuery: string,
): SearchResult<TTarget>[] {
  const query = normalizeSearchText(rawQuery.trim())
  if (!query) return []

  setDuplicateOccurrences(candidates)

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

function workspaceSearchCandidates(workspace: LocalWorkspace): {
  candidates: SearchCandidate<SearchTarget>[]
  objectCandidates: WorkspaceObjectSearchCandidate[]
  objectsByKey: Map<string, CatalogueObject>
} {
  const objectsByKey = new Map<string, CatalogueObject>()
  function objectCandidate(
    owner: { systemId: string } | { routeId: string },
    ownerName: string,
    object: CatalogueObject,
  ): WorkspaceObjectSearchCandidate {
    const ownerId = 'routeId' in owner ? owner.routeId : owner.systemId
    const target: SearchTarget = {
      workspaceId: workspace.id,
      clusterId: workspace.cluster.id,
      kind: 'object',
      objectId: object.id,
      ...owner,
    }
    const key = resultKey(target)
    objectsByKey.set(key, object)
    return {
      ownerId,
      ownerName,
      object,
      result: {
        key,
        target,
        name: object.name,
        typeLabel: catalogueSubtypeLabel(object),
        contextLabel: `${'routeId' in owner ? 'Jump Route' : 'Zone'}: ${ownerName}`,
        leadingMark: { kind: 'glyph', value: objectMark(object) },
        locationKey: object.locationKey,
        occurrence: null,
      },
      identityOrder: key,
    }
  }

  const zones = new Map(workspace.cluster.systems.map(system => [system.id, system.name]))
  const objectCandidates = [
    ...workspace.cluster.systems.flatMap(system =>
      system.objects.map(object => objectCandidate({ systemId: system.id }, system.name, object))),
    ...workspace.cluster.routes.flatMap(route => {
      const contents = routeContentsFor(workspace.cluster, route.id)
      if (!contents) return []
      const departure = zones.get(route.fromSystemId)
      const arrival = route.toSystemId === null ? route.unresolvedExit : zones.get(route.toSystemId)
      const ownerName = route.name || `${departure} to ${arrival} (Level ${route.jumpLevel})`
      return contents.objects.map(object => objectCandidate({ routeId: route.id }, ownerName, object))
    }),
  ]

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
        typeLabel: 'Zone',
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

  return { candidates, objectCandidates, objectsByKey }
}

function compareName(left: string, right: string): number {
  return compareText(normalizeSearchText(left), normalizeSearchText(right)) || compareText(left, right)
}

/** Searches the current applied workspace snapshot; callers must not supply draft or preview data. */
export function searchWorkspace(
  workspace: LocalWorkspace,
  rawQuery: string,
  criteria?: WorkspaceSearchCriteria,
): SearchResult[] {
  const queryIsEmpty = rawQuery.trim().length === 0
  const hasCriteria = !!criteria && (criteria.types.length > 0
    || criteria.publicationModes.length > 0
    || criteria.fieldConditions.length > 0)
  if (!hasCriteria) {
    if (queryIsEmpty || !normalizeSearchText(rawQuery.trim())) return []
    return rankSearchCandidates(workspaceSearchCandidates(workspace).candidates, rawQuery)
  }
  if (!queryIsEmpty && !normalizeSearchText(rawQuery.trim())) return []

  const filterObject = createWardenObjectFilterMatcher(
    workspace,
    criteria.types,
    criteria.publicationModes,
    criteria.fieldConditions,
  )

  if (queryIsEmpty) {
    const { objectCandidates } = workspaceSearchCandidates(workspace)
    setDuplicateOccurrences(objectCandidates)
    return objectCandidates
      .filter(candidate => filterObject(candidate.object))
      .sort((left, right) => compareName(left.ownerName, right.ownerName)
        || compareText(left.ownerId, right.ownerId)
        || compareName(left.object.name, right.object.name)
        || compareText(left.object.id, right.object.id))
      .map(candidate => candidate.result)
  }

  const { candidates, objectsByKey } = workspaceSearchCandidates(workspace)
  return rankSearchCandidates(candidates, rawQuery).filter((result) => {
    if (result.target.kind !== 'object') return false
    const object = objectsByKey.get(result.key)
    return object !== undefined && filterObject(object)
  })
}
