---
title: Define the meaning of a status filter
status: closed
label: wayfinder:grilling
type: grilling
parent: ../map.md
assignee: Codex
---

# Define the meaning of a status filter

## Question

How should the Warden filter by campaign state and by Player publication? Use a station whose campaign state changes from Operational to Abandoned while its publication stays Revealed. For publication, decide whether the criterion matches the configured object mode or the effective disclosure in the player document.

For campaign state, determine how a Field becomes available in the filter picker and how the Warden activates it. [Define matching for Field filters](12-field-filter-rules.md) covers individual operators and the treatment of unset and inapplicable values. The [domain context](../../../CONTEXT.md) defines Player publication and custom Field applicability separately.

## Current behavior

- [Player publication](../../../domain/workspace-model.ts#L143) controls disclosure through Hidden, Unknown presence, Known type and Revealed. The [Warden Hierarchy](../../../components/MapHierarchy.vue#L181) already shows publication indicators.
- A [catalogue object](../../../domain/workspace-model.ts#L87) has publication and optional custom Field values. Campaign state can currently be recorded in a custom Field. A [single-select Field](../../../domain/workspace-model.ts#L32) stores one choice from a defined list and can apply to all objects or a selected catalogue scope.

## Blocked by

None.

## Resolution

Confirmed on 2026-11-06.

- The Warden can filter separately by campaign state and by Player publication. A station can change from Operational to Abandoned while its publication mode stays Revealed.
- Native and custom Fields are available as filter criteria by default. The Warden chooses active criteria in the filter picker. Campaign state is expressed through a Field the Warden can filter like any other Field.
- The Player publication criterion matches the publication mode configured on the object. A planet configured as Revealed matches Revealed even when the system's publication prevents the planet from appearing in the player document. The effective player disclosure stays governed by the existing publication policy.
