---
title: Position Cluster systems from the map
status: closed
closed_on: 2026-10-27
assignee: /root/cluster_system_placement
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 01: Position Cluster systems from the map

**What to build:** Let the Warden select a Cluster system, invoke Move, choose a destination by click or keyboard arrows, preview it, and confirm or cancel. Keep direct dragging. Remove system X/Y inputs from editing and creation surfaces only when their map-based replacements are available.

**Status:** closed — implemented and verified

## Blocked by

None (can start immediately).

## Specification and baseline

Parent: [Map-based positioning and movable unresolved-exit targets](../spec.md).

Source: [Allow repositioning unresolved-exit target markers on the Cluster map](https://github.com/Submoon/ttrpg-cluster-control/issues/27); the system-positioning scope was approved separately in the parent specification.

Planning baseline: 9edfa66c4f505d56f106fc4af8245f200abfba78, refreshed on 2026-10-27. Refresh before implementation without discarding approved scope.

Relevant parent stories: 30–43, 45–46, 54, 58–60, 64–71, 80 and 86, as applicable to Cluster systems.

## Acceptance criteria

- [x] A selected Cluster system exposes an explicit map-based Move operation; a pointer user can choose a destination without dragging.
- [x] Keyboard arrows adjust the active movement preview instead of panning the map. Named confirm/cancel actions and visible focus allow completion without a pointer, numeric input or modifier.
- [x] The preview and connected route geometry follow the candidate destination. Choosing or adjusting it does not alter committed or exported workspace data.
- [x] Confirmation applies one complete movement; cancellation retains the previous position and returns reachable focus.
- [x] Existing Move-mode dragging remains available and commits on a valid release. Select and navigation do not accidentally reposition a system.
- [x] Pan/zoom conversion is correct, and existing system-placement bounds and invalid/occupied-destination rules remain effective; unresolved-target bounds must not be applied to systems.
- [x] Navigation takeover, interruption, relevant tool/context changes and disposal cancel unfinished movement and suppress a later release/click.
- [x] Editable system X/Y fields and coordinate-based creation inputs are removed from panels. Accessible map-based system creation remains possible, and no replacement numeric position form is introduced elsewhere.
- [x] Committed movement preserves unrelated chart or Inspector drafts. Applying or discarding them cannot restore an older system position or apply unrelated fields.
- [x] Movement survives map navigation and reload. Applied state and existing save/error/Retry behavior remain intact without replaying the move.
- [x] Other systems, logical route endpoints and non-position properties are unchanged by moving one system.

## Verification

Use the public Cluster editor for representative pointer and keyboard preview/confirm/cancel, transformed coordinates, invalid destination, focus, takeover, field removal and map creation. Extend existing precise-system-movement and navigation coverage. Verify draft preservation, committed export/reload state and existing save recovery at their established boundaries; do not count mocked internal calls.

## Delivery boundaries

Reuse existing system layout and guarded command/writer responsibilities. No new schema or unresolved-target behavior is required. Resolve shared keyboard/gesture interfaces before overlapping writers, but do not add dependency edges to other element families merely because they share a renderer or Dock.

Follow the parent specification and repository checks. This publication does not start implementation, history work or any remote operation.

## Resolution

Implemented Cluster-system map click and keyboard previews with explicit confirmation/cancellation, retained direct dragging, keyboard creation and source-system placement validation. Removed system coordinate forms while preserving independent chart drafts.

Completed on 2026-10-27. Targeted public/pure checks, the integrated suite with affected failure reruns, final lint/typecheck/build and independent review closure are recorded in the [implementation record](../implementation.md) and [review](../review.md). This local closure applies only to this ticket; the parent effort and GitHub issue remain open.
