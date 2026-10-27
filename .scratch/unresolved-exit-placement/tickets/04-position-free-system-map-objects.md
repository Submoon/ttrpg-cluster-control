---
title: Position free system-map objects without coordinates
status: closed
closed_on: 2026-10-27
assignee: /root/free_object_placement
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 04: Position free system-map objects without coordinates

**What to build:** Let the Warden position free objects directly on a system map by drag or click/keyboard preview and confirmation. Carry hosted Orbits and descendants consistently, remove free-object X/Y inputs, and preserve unrelated Inspector edits.

**Status:** closed — implemented and verified

## Blocked by

None (can start immediately).

## Specification and baseline

Parent: [Map-based positioning and movable unresolved-exit targets](../spec.md).

Source: [Allow repositioning unresolved-exit target markers on the Cluster map](https://github.com/Submoon/ttrpg-cluster-control/issues/27); the system-object scope was explicitly approved in this effort's expanded specification.

Planning baseline: 9edfa66c4f505d56f106fc4af8245f200abfba78, refreshed on 2026-10-27. Refresh before implementation without altering the approved scope.

Relevant parent stories: 30–45, 47, 49, 51, 55, 58–60, 62–71, 80 and 86, as applicable to free objects.

## Acceptance criteria

- [x] A selected free object supports explicit Move, a clicked destination or keyboard-arrow adjustment, visible preview and named confirm/cancel actions.
- [x] The preview changes no committed/exported workspace data. Confirmation applies one complete move; cancellation restores the previous applied position.
- [x] Existing Move-mode dragging remains available, with valid-release commit and navigation-takeover/interruption cancellation. No late release can commit a canceled gesture.
- [x] Positioning is correct under pan, zoom and responsive sizing. Keyboard preview movement does not also pan the map, and focus remains reachable after completion or cancellation.
- [x] Moving a host carries its hosted Orbits and descendants according to existing placement rules without rewriting their logical relationships.
- [x] Explicit free placement remains expressible, including where another visual target overlaps the desired location. Retained logical destination choices and current invalid/ambiguous-target rules remain usable.
- [x] Existing object attachment and Orbit-occupant behavior continues to work while its dedicated map-only replacement is pending.
- [x] Editable free-object X/Y fields disappear from Inspector, Dock and relevant creation/placement surfaces. No equivalent numeric position form is added elsewhere.
- [x] Map-based object creation remains operable without dragging or numeric coordinates.
- [x] Object names, descriptions, native/custom fields, Jump Point Station associations and explicit placement relationship controls remain editable.
- [x] A committed move does not apply unrelated Inspector draft fields. Apply and Discard preserve the latest committed position rather than restoring stale draft coordinates.
- [x] Explicit relationship edits in a draft keep their intentional semantics and validation. Movement must not silently apply, discard or overwrite such edits to bypass a guard.
- [x] Hidden panels and responsive changes preserve unrelated drafts. A deleted object or changed map/workspace invalidates stale pending movement safely.
- [x] Position survives navigation and reload; existing save feedback and Retry retain the applied result without replaying the move.

## Verification

Use public free-object and host-object journeys for click and keyboard placement, preview/cancel, transformed dragging, focus, creation and field removal. Reuse existing system-manipulation, relationship and entity-session coverage for carried geometry and Inspector Apply/Discard. Confirm durability through exported committed state and reload, with existing failure/recovery checks where the command path changes.

## Delivery boundaries

Deliver the system-object map-targeting and independent-position-commit path that the Orbit-occupant ticket extends. Keep supported Orbit placement working during this slice; remove its angle fields only when its equivalent map interaction is delivered.

Reuse existing placement validation, session controllers and the single writer. Resolve overlapping renderer/Inspector interfaces before concurrent edits; do not start a separate generic interaction framework or unrelated refactor. This publication does not authorize implementation or remote changes.

## Resolution

Implemented free-object map placement and keyboard creation without coordinate fields, with carried geometry and independent metadata/geometry drafts. Restored explicit host/order relationship protection and accessible refusal feedback through the existing Placement popover. Occupant-angle replacement remains ticket 05.

Completed on 2026-10-27. Targeted public/pure checks, the integrated suite with affected failure reruns, final lint/typecheck/build and independent review closure are recorded in the [implementation record](../implementation.md) and [review](../review.md). This local closure applies only to this ticket; the parent effort and GitHub issue remain open.
