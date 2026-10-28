---
title: Move unoccupied Orbit centers without coordinate fields
status: closed
closed_on: 2026-10-27
assignee: /root/orbit_center_placement
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 06: Move unoccupied Orbit centers without coordinate fields

**What to build:** Let the Warden move an unoccupied Orbit center through the common click/keyboard preview-and-confirm workflow as well as dragging. Remove center X/Y fields while preserving Orbit size, rotation, host-relative order and explicit attachment/detachment.

**Status:** closed — implemented and verified

## Blocked by

None (can start immediately).

## Specification and baseline

Parent: [Map-based positioning and movable unresolved-exit targets](../spec.md).

Source: [Allow repositioning unresolved-exit target markers on the Cluster map](https://github.com/Submoon/ttrpg-cluster-control/issues/27); Orbit-center field removal belongs to the user-approved expanded scope.

Planning baseline: 9edfa66c4f505d56f106fc4af8245f200abfba78, refreshed on 2026-10-27. Refresh before implementation without altering the approved decisions.

Relevant parent stories: 30–45, 50–53, 56, 58–71, 80 and 86, as applicable to Orbit centers.

## Acceptance criteria

- [x] An unoccupied Orbit center supports explicit Move, clicked destination or keyboard-arrow adjustment, a coherent preview and named confirm/cancel actions.
- [x] Preview moves the Orbit and its dependent geometry consistently without changing committed/exported workspace data. Confirmation publishes one result; cancellation preserves the last applied center.
- [x] Existing center dragging remains available with valid-release commit. Transformed coordinates, focus, interruption, navigation takeover and suppressed late release follow the established map contract.
- [x] Keyboard movement adjusts the active preview without also panning the map. No numeric coordinate form, modifier or drag is required to complete a valid center placement.
- [x] Editable Center X/Y fields are removed from Inspector and any other relevant creation/placement surface. Accessible map-based creation remains available.
- [x] Orbit horizontal/vertical radii and rotation remain editable, together with host-relative order and supported relationship controls.
- [x] Explicit host selection, attachment and detachment remain available. Ambiguous candidates are named choices; invalid relationships retain existing validation and do not mutate data.
- [x] Hosted Orbits continue to derive their center from the host and move with it. No independent hosted-center position or handle is introduced.
- [x] A committed center move does not apply unrelated Orbit draft fields. Applying or discarding a radius, rotation, order or descriptive draft preserves the current center instead of restoring stale coordinates.
- [x] Explicit draft host/relationship changes retain their deliberate guarded behavior and do not silently apply unrelated data during center movement.
- [x] Hidden Inspector and responsive changes retain unrelated draft values. Deleted Orbit/host or changed map/workspace context cannot receive a stale move.
- [x] Applied centers and dependent geometry survive navigation/reload. Existing persistence feedback, failure recovery and Retry preserve the result without replaying movement.
- [x] Other Orbits, object relationships and non-position properties remain unchanged except for geometry that is intentionally carried by the moved center.

## Verification

Use public Orbit creation/editing and system-map movement journeys for pointer and keyboard preview/confirm/cancel, transformed coordinates, retained radii/rotation/order, explicit host resolution, numeric-field absence and focus. Exercise center movement with an open unrelated Orbit draft, then both Apply and Discard, and verify reload. Reuse established attachment, carried-geometry and stale-context regressions; use existing pure domain checks only where needed.

## Delivery boundaries

Orbit-center operations do not require the free-object or Orbit-occupant tickets. Coordinate overlapping renderer, gesture and Inspector changes through ownership rules rather than adding an artificial dependency. Keep hosted-Orbit movement through hosts and preserve relationship operations.

Use focused Orbit/session responsibilities and the existing workspace writer. Follow the parent verification contract; do not implement history, start unrelated refactors or modify remote issues.

## Resolution

Implemented unoccupied-center map previews, keyboard nudging, confirmation/cancellation and retained direct dragging. Removed center coordinate fields while preserving radii, rotation, order and supported host changes. Confirmed centers remain independent of unrelated Orbit drafts and survive reload.

Completed on 2026-10-27. Targeted public/pure checks, the integrated suite with affected failure reruns, final lint/typecheck/build and independent review closure are recorded in the [implementation record](../implementation.md) and [review](../review.md). This local closure applies only to this ticket; the parent effort and GitHub issue remain open.
