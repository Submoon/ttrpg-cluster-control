---
title: Search Warden maps by text and criteria
status: closed
assignee: coordinator
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 16 — Search Warden maps by text and criteria

## Parent

[Display filters for the Warden and player consultation](../spec.md)

## What to build

A Warden can find catalogue objects across all systems using text, criteria or both. Search keeps its own active set so a lookup can use different criteria from the map.

## Blocked by

- [Filter Warden maps by publication and Field values](14-warden-publication-and-field-filters.md)

## Acceptance criteria

- [x] Search offers Type, configured Player publication and Field criteria using the same operators and combination rules as the Warden map. Changing Search criteria updates the results and preserves the map's active criteria.
- [x] With text alone, preserve the current Jump Cluster and system name results and object name or Location key results, including current ranking and disambiguation.
- [x] With criteria and empty or whitespace-only text, return matching catalogue objects across all systems. Order systems by name and keep each system together. Sort objects by name within it and use stable ties for duplicate names.
- [x] With both inputs present, return objects satisfying the text and every active condition, using current text ranking among matches. With both empty, show guidance and an empty result list. Announce counts or an appropriate no-match state for active searches.
- [x] Clearing text retains the criteria and clearing criteria retains text. Both survive closing, reopening and activating a result within the editor session. A fresh session or workspace replacement starts with empty inputs.
- [x] Activate object results through the existing guarded Search command. Use the map's criteria to determine the selected object's display state.

## Verification

Extend the Search model coverage for the four input states, duplicate identities and deterministic ordering. Use an existing browser journey to demonstrate filter-only results and the independence of the map and Search selections.

## Resolution

Warden Search accepts text, criteria or their intersection. Search criteria live in the editor session and use the Warden map operators. Each surface retains its own active selections. Search preserves text ranking and occurrence labels and uses the existing guarded reveal flow.

Pure checks cover ordering, duplicate identities, state resets and Field reconciliation. The compact browser journey covers criteria-only results, independent map dimming and keyboard operation of the nested Field selector.
