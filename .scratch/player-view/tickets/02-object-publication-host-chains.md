---
title: 'Explore published objects and anonymous Orbit host chains'
status: closed
assignee: coordinator
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 02: Explore published objects and anonymous Orbit host chains

**Parent:** [Player view and secret-free sharing](../spec.md).

**Source:** [Player view and secret-free export — GitHub #9](https://github.com/Submoon/ttrpg-cluster-control/issues/9). Approved breakdown: 2026-10-29. Planning baseline: `8d4b66504ca6723db5405ed7cb93d0a666264c9a`, equal to fetched origin/main. Refresh source/baseline before implementation.

**What to build:** the Warden can set an object's disclosure mode and explore the resulting player system preview. Visible objects retain their applied geometry, and their required secret host chain appears anonymously without revealing unrelated objects.

**Status:** closed. The user authorized implementation with `implement` and subagents on 2026-10-30. Tickets 01 and 02 are closed; tickets 03–07 remain unstarted.

## Blocked by

- [01: Preview system publication in the Jump Cluster](01-system-publication-preview.md).

## Acceptance criteria

- [x] Object editing exposes the four saved, undoable disclosure modes. Hidden omits the object except for the required-host exception; Unknown presence gives a neutral marker; Known type shows only type; Revealed shows permitted name/type. New objects default Known type and legacy objects initialize Hidden.
- [x] Only Revealed systems open an internal player preview. Hidden/Unknown presence/Known type systems include no internal objects even if a child's saved setting is more permissive. The Warden's source child settings survive a parent-mode change.
- [x] Partial object modes contain no source name, subtype-bearing key, descriptive text or properties. Unknown presence does not expose true type through a glyph, halo, class/attribute, accessible label, identifier or hierarchy row. Warden Location keys remain private in every player mode.
- [x] A published object's required chain of secret object hosts is included recursively as Unknown presences, with the necessary Orbits. A host already permitted at a higher disclosure level is neither duplicated nor downgraded. Do not include hidden siblings, unrelated Orbit branches or independently empty Orbits.
- [x] Unoccupied geometric centers remain geometry; do not invent physical objects for them. Project valid safe references and only the necessary geometry without embedding omitted source identities or metadata.
- [x] Effective applied positions, radii, rotations and angles remain stable after filtering, including missing-value defaults and nested Orbits. Resolve required source geometry before removal; hidden sibling order must not move public objects or leak through private labels/counts.
- [x] All new object publication data survives normal save/reload, Undo/Redo, complete GM backup/import ID remapping and recovery, preserving the original objects and orbital structure.
- [x] Object public prose/Fields and physical Station associations remain absent from the preview until their own slices add them. No player transport is exposed by this ticket.

## Verification and completion

Through real object editing and preview navigation, verify all modes, parent-system gates, nested hidden hosts, already-Revealed hosts, unoccupied centers, shared hosts, hidden siblings and effective default geometry. Inspect the projected data and accessibility tree for private marker absence. Exercise source round trips, ID remapping, Undo/Redo and save-failure preservation. Run focused geometry/projection and browser scenarios with lint/typecheck; preserve existing complete-map editing and layout regressions.

## Scope boundaries

Extend the established common projection/preview rather than create a second disclosure implementation. Text/Fields are handled by ticket 03; routes/Station association by ticket 04. The source writer, history and authoritative geometry remain unchanged in ownership. Sensitive design/review rules apply.

## Resolution

Implemented all eight criteria: saved object disclosure through the existing draft/history/writer, strict source version 3 with private legacy object defaults, and Revealed-only internal player maps. The common allowlisted projection preserves applied geometry and recursively retains only necessary anonymous hosts and Orbits. Public navigation, hierarchy, inspection and viewport controls consume detached player data and leave the GM workspace unchanged. Text/Fields, Station associations and player transport remain for later slices.

Candidate `2afe07f23cbc00907695bc5496770dc9eab770d5` passed lint, typecheck, a production build, focused projection/geometry/persistence scenarios, compiled entry journeys and desktop/compact visual inspection. The complete suite ran once: 471 passed / 13 failed. An unchanged targeted replay passed 12/13; the remaining newly merged shortcut test used obsolete chart-dialog labels. Correcting only its three exact locators produced an 8/8 passing whole-file replay, with assertions and timeouts preserved. Standards, Spec and complementary privacy/persistence reviews have no blockers; one optional Low migration-duplication suggestion is deferred. See the [implementation record](../ticket-02-implementation.md) for commands, evidence and limits.

The correction and closure are committed locally on `codex/player-view-ticket-01`. Tickets 03 and 04 are available but unclaimed; no later implementation, push, remote write or merge into main occurred. GitHub #9 was reread before completion and remains open and unchanged.

## Comments

> *This was generated by AI during triage.*

Implementation started on 2026-10-30. GitHub #9 was reread and is unchanged. Fresh `origin/main` is `971e91c0ad2fc78e4f92c1e625091a577960b41b`; its map-tool shortcuts were merged without conflicts while preserving the two local ticket 01 commits. The implementation/review baseline is now `61aa6cb1accaf67f196cffa284109cdf35674189`. Work continues on the current branch as required by `implement`. See the [implementation record](../ticket-02-implementation.md).
