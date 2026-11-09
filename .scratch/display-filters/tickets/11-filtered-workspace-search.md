---
title: Define how Warden Search combines text and filters
status: closed
label: wayfinder:grilling
type: grilling
parent: ../map.md
assignee: Codex
---

# Define how Warden Search combines text and filters

## Question

How does the Warden search by name or location key, by filter criteria alone, or by combining both inputs? A query with active criteria can run with the text field empty. Decide which map filter facets are available in Search, whether the criteria are independent of the map's active settings, and what happens to those settings when the Warden changes criteria in Search.

The maintainer described text AND/OR filters. Decide whether that means either input can be used alone with an intersection when both are present, or whether the Warden can explicitly select a union as well. Use an exact name match outside the chosen type and a type match with a different name to distinguish the two behaviors.

Define the result scope for filter-only queries, including object criteria and cluster or system results, as well as ordering and the empty state when both inputs are empty. [Current Warden Search](../../../utils/workspace-search.ts#L108) returns no results for an empty text query.

## Current behavior

- [Warden Search](../../../utils/workspace-search.ts#L108) checks the applied workspace. It matches the Jump Cluster and system names, plus catalogue-object names and Location keys across all systems. [Text ranking](../../../utils/workspace-search.ts#L57) favors exact, prefix and then substring matches. Rows show type and system context and distinguish duplicate results.
- The [Search palette](../../../components/WorkspaceSearch.vue#L36) announces counts or no matches for nonblank text and shows guidance with an empty query. The [existing Search contract](../../global-search/spec.md#solution) retains the query through close, reopen and successful activation during the editor session.

## Blocked by

- [Define how Warden filter criteria combine](06-combination-rules.md)

## Resolution

Confirmed on 2026-11-06.

Search offers Type, configured Player publication and Field criteria with the same matching rules as the map. Search owns a separate active criterion set. Editing it updates Search results while the map continues to apply its own criteria. Search text and criteria each survive closing, reopening and activating a result during the editor session. They reset with the editor session or workspace replacement.

| Text | Active search criteria | Results |
| --- | --- | --- |
| Present | None | Existing Jump Cluster, system and object text matches, with their current ranking. |
| Empty | Present | Matching catalogue objects across all systems, ordered by system name and then by object name. Keep objects from the same system together and use stable ties for duplicate names. |
| Present | Present | Catalogue objects that satisfy both the text and the criteria, with the current text ranking among those matches. |
| Empty | None | Guidance to enter text or add a criterion. The results list is empty. |

Treat blank input as empty text. Clearing text leaves any active criteria available for filter-only search. Clearing the criteria leaves the current text search intact. An active search reports the matching result count or an appropriate no-match state in both text and filter-only modes. Existing result identity and disambiguation remain available.

Activating a result uses the existing [guarded navigation and framing decision](07-warden-search-reveal.md). The map's active criteria determine whether the selected object is dimmed and receives a locator after framing.
