---
title: Search Warden maps by text and criteria
status: open
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

- [ ] Search offers Type, configured Player publication and Field criteria using the same operators and combination rules as the Warden map. Changing Search criteria updates the results and preserves the map's active criteria.
- [ ] With text alone, preserve the current Jump Cluster and system name results and object name or Location key results, including current ranking and disambiguation.
- [ ] With criteria and empty or whitespace-only text, return matching catalogue objects across all systems. Order systems by name and keep each system together. Sort objects by name within it and use stable ties for duplicate names.
- [ ] With both inputs present, return objects satisfying the text and every active condition, using current text ranking among matches. With both empty, show guidance and an empty result list. Announce counts or an appropriate no-match state for active searches.
- [ ] Clearing text retains the criteria and clearing criteria retains text. Both survive closing, reopening and activating a result within the editor session. A fresh session or workspace replacement starts with empty inputs.
- [ ] Activate object results through the existing guarded Search command. Use the map's criteria to determine the selected object's display state.

## Verification

Extend the Search model coverage for the four input states, duplicate identities and deterministic ordering. Use an existing browser journey to demonstrate filter-only results and the independence of the map and Search selections.
