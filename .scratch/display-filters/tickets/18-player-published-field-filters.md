---
title: Filter player maps by published Field values
status: open
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 18 — Filter player maps by published Field values

## Parent

[Display filters for the Warden and player consultation](../spec.md)

## What to build

The reader and preview can narrow published objects using Fields that appear in the player document. Public Field criteria reuse typed comparisons while remaining independent of private definitions.

## Blocked by

- [Filter Warden maps by publication and Field values](14-warden-publication-and-field-filters.md)
- [Filter player maps by published type](17-player-published-type-filters.md)

## Acceptance criteria

- [ ] Offer Field criteria from published assignments in the current player document. Group assignments by public name and kind. Distinguish two groups with the same name and different kinds using the public kind.
- [ ] For same-name, same-kind assignments on one object, any published value satisfying the condition is enough. A Field criterion requires a matching public assignment. The public panel offers value operators and omits **No value**.
- [ ] Reuse the typed value operators for text, number, boolean and single-select values. Build controlled choice lists from observed public assignments. Keep one condition per Field group and accept alternatives within a choice condition with OR.
- [ ] Combine the active Type and Field conditions with AND. Options, match counts and zero-match feedback derive entirely from the public document. A masked, omitted or inapplicable source value has the same observable absence.
- [ ] Use the shared player filter controls to add, edit and remove criteria and clear the current set. Retain the independent reader and preview session lifetime, complete public relationships, Inspect details and complete exports.

## Verification

Use a public-document fixture with duplicate public names and kinds, different kinds under one name, and private or masked sentinels. Verify matching and option inventories at the public model boundary and exercise one typed Field criterion in the existing player browser path.
