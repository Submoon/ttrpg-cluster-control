---
title: Position Orbit occupants without angle fields
status: open
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 05: Position Orbit occupants without angle fields

**What to build:** Let the Warden position an object along an Orbit, transfer it to another valid Orbit, or choose free placement through map interactions with keyboard/click alternatives. Remove numeric positional-angle fields without removing Orbit rotation or logical destination choices.

**Status:** ready-for-agent

## Blocked by

- [04 — Position free system-map objects without coordinates](04-position-free-system-map-objects.md).

This extends the same object's delivered map-targeting, preview and independent-position-commit path instead of introducing a competing replacement.

## Specification and baseline

Parent: [Map-based positioning and movable unresolved-exit targets](../spec.md).

Source: [Allow repositioning unresolved-exit target markers on the Cluster map](https://github.com/Submoon/ttrpg-cluster-control/issues/27); removal of occupant-angle position fields was approved in the expanded specification.

Planning baseline: 9edfa66c4f505d56f106fc4af8245f200abfba78, refreshed on 2026-10-27. Implement on the integrated blocker result after refreshing the baseline.

Relevant parent stories: 30–45, 48–49, 51–53, 57–68, 70–71, 80 and 86.

## Acceptance criteria

- [ ] A selected Orbit occupant supports the common explicit Move, click/keyboard destination, preview and confirm/cancel workflow without numeric angle input.
- [ ] Moving along an Orbit can preserve the existing Orbit relationship while changing the object's position on it.
- [ ] Valid transfer to another Orbit and explicit free placement remain available without requiring drag or modifiers; each follows established relationship and cycle validation.
- [ ] Overlapping or ambiguous destinations expose explicit named choices. Invalid choices explain the problem and do not mutate committed data.
- [ ] Moving an object that hosts Orbits carries its descendants consistently through along-Orbit movement, transfer and free placement.
- [ ] The non-drag preview is transient; confirmation applies one complete result and cancellation preserves the last applied placement.
- [ ] Existing Move-mode dragging and valid-release commit remain available. Pan/zoom conversion, focus recovery, gesture interruption and suppressed late release work for attached and transferred objects.
- [ ] Keyboard arrows adjust the active position preview rather than pan the map or implicitly apply a relationship change.
- [ ] Editable positional-angle fields are removed from all panels and relevant creation/placement surfaces. Free-object X/Y fields removed by the blocker do not return.
- [ ] Orbit rotation remains distinct from occupant position and stays editable together with radii, host-relative order and retained relationship controls.
- [ ] Names, descriptions, custom/native fields and Jump Point Station association are preserved; placement does not silently modify them.
- [ ] Unrelated Inspector drafts survive movement, hide/reopen and responsive reflow. Applying/discarding those drafts preserves the committed placement; explicit relationship edits remain intentional and guarded.
- [ ] Stale object, Orbit, host or workspace context is checked before committing after asynchronous decisions.
- [ ] Applied position/relationship survives navigation and reload. Existing save failure and Retry behavior does not replay a transfer or movement.
- [ ] Existing map-based creation remains keyboard/single-pointer operable without an occupant-angle form.

## Verification

Use public system-map journeys to demonstrate along-Orbit movement, named transfer, explicit free placement, ambiguous/invalid targets and carried descendants. Cover pointer and keyboard preview/confirm/cancel, numeric-field absence, retained Orbit rotation and relationship editing, Inspector preservation, reload and relevant save recovery. Reuse existing pure placement/relationship checks for domain invariants; avoid tests tied to internal controller composition.

## Delivery boundaries

An object's angle along an Orbit is a position, not its orientation or the Orbit's rotation. This ticket removes the former and retains the latter. Do not replace explicit relationship operations with visual guessing, loosen attachment/cycle rules or introduce a new independent center for hosted Orbits.

Follow the parent architecture and verification contracts. Issue #5 is related but does not block this ticket; previews remain transient and each completed action has one semantic boundary.
