---
title: Filter Warden maps by publication and Field values
status: open
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 14 — Filter Warden maps by publication and Field values

## Parent

[Display filters for the Warden and player consultation](../spec.md)

## What to build

A Warden can combine Type with configured Player publication and the campaign information already recorded in native and custom Fields. The same panel explains and recovers from obsolete criteria when definitions change.

## Blocked by

- [Filter Warden system maps by type](13-warden-type-filters.md)

## Acceptance criteria

- [ ] The Player publication facet offers Hidden, Unknown presence, Known type and Revealed. Match the mode configured on the object even when the system's publication prevents that object from reaching a player document. Any selected publication mode satisfies the facet.
- [ ] Offer every native and custom Field by default through the filter picker. Each Field can have one active condition. Reuse existing Field identities, assignments, applicability and configured choices.
- [ ] For text, offer contains, equals and does not contain with case- and accent-insensitive matching. For numbers, offer equality, inequality, all four ordered comparisons and an inclusive interval. For booleans, offer **Is Yes** or **Is No**. For a single-select Field, **Is** accepts any one of the selected configured choices.
- [ ] Offer **No value** for a missing or inapplicable Field, including an inapplicable Field with a retained assignment. Count empty or whitespace-only text as missing and zero and false as assigned. All value comparisons require an applicable assignment, including exclusions and inequality.
- [ ] Combine active Type, Player publication and Field conditions with AND. Empty facets are unrestricted. Count one per active publication facet and Field. An incomplete replacement keeps the last valid condition active. Valid edits and per-criterion removal apply immediately, and **Clear all** clears the entire active set.
- [ ] After an applied Field change or history traversal, retain criteria and choices that remain valid. Remove invalid references and inform the Warden. If **Is** loses its last choice, remove the condition. Preserve unrelated criteria and valid criteria with zero matches.
- [ ] Make typed value comparisons reusable for a second consumer that supplies its own values and applicability. Map filtering continues to use the full Warden inputs, existing session lifetime, dimming and export behavior.

## Verification

Use a deterministic model matrix for the operators, applicability, OR within facets and AND across them. Use an editor workflow check for a renamed Field and a removed choice with history traversal. Extend the filter-panel browser journey to show one typed Field criterion working with Type and publication.
