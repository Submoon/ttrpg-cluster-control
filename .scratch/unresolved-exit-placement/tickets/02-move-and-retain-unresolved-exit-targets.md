---
title: Move and retain unresolved-exit targets
status: in-progress
assignee: /root/exit_placement
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 02: Move and retain unresolved-exit targets

**What to build:** Let the Warden reposition an existing unresolved-exit target by Move-mode drag or the common click/keyboard preview-and-confirm workflow. Keep the target attached to its Jump Route, update its path and labels live, and preserve the chosen absolute map position through saving and interchange.

**Status:** ready-for-agent

## Blocked by

None (can start immediately).

## Specification and baseline

Parent: [Map-based positioning and movable unresolved-exit targets](../spec.md).

Source: [Allow repositioning unresolved-exit target markers on the Cluster map](https://github.com/Submoon/ttrpg-cluster-control/issues/27).

Planning baseline: 9edfa66c4f505d56f106fc4af8245f200abfba78, refreshed on 2026-10-27. The issue's pre-refactor technical baseline is historical, not the implementation base.

Relevant parent stories: 1–45, 64–76 and 80–86 for ordinary-scene placement and durability. Full far-scene navigation/output guarantees are completed by the dependent distant-exit ticket.

## Acceptance criteria

- [ ] An existing unresolved target can be dragged in Move without recreating the route; the path, Jump-level label, marker and exit-name label follow the preview coherently.
- [ ] Selecting the marker selects its existing Jump Route. Select opens that route's Inspector; Move selects quietly, without entering the origin system or changing the active system.
- [ ] A selected target supports explicit Move, pointer destination or keyboard-arrow adjustment, preview and named confirm/cancel actions. No coordinate or positional-angle fields are added.
- [ ] A valid drag release or explicit non-drag confirmation applies one semantic movement. Previews and cancellations never enter committed snapshots or exports; takeover/interruption suppresses a delayed release.
- [ ] Pan, zoom and responsive sizing preserve the intended map-space destination, with no first-drag jump from reusing system-specific bounds.
- [ ] Each manual position belongs to route identity, not exit name, route index or source-system position. Routes with repeated names or origins remain independent.
- [ ] Moving a target leaves its origin system, origin Jump Point, Jump level, unresolved-exit name and unresolved status unchanged.
- [ ] A manually positioned target stays fixed when its origin system moves; connecting geometry adapts. Ordinary route name, level and origin Jump Point edits retain the target position.
- [ ] Resolving the destination removes the saved target position. Making that destination unresolved later uses automatic placement. No return-to-automatic editing action is introduced.
- [ ] Route deletion and dependent deletion remove obsolete target layout without orphan references or changes to unrelated routes.
- [ ] Older files and routes without saved positions retain existing automatic placement without eager rewriting.
- [ ] Saved layout accepts valid map-space positions beyond the initial canvas and is not constrained by a temporary schema bound. Invalid ownership, malformed points or unsafe derived geometry are rejected before a partial update.
- [ ] Positions survive navigation, reload and workspace/Cluster JSON round trips. Append import remaps each position to its newly allocated route ID, including repeated independent imports.
- [ ] Standalone-system export retains its existing scope and excludes Cluster routes.
- [ ] Normal-scene SVG/PNG exports use the applied target, path and labels even during an unfinished move, rather than reverting to automatic placement or exporting a preview.
- [ ] Movement does not apply unrelated route or other Inspector edits. Applying/discarding a valid unrelated draft preserves the current position; stale or deleted targets cannot commit after asynchronous context changes.
- [ ] Existing in-memory application, save feedback, failure recovery and Retry persist the applied snapshot without replaying movement.

## Verification

Use public route creation/inspection and Cluster movement journeys for the delivered behavior. Verify repeated names/origins, source movement, route edits, resolution, deletion, transformed gestures, keyboard/click placement and preview cancellation. Use public JSON export/import/reload to prove durable ownership and remapping; existing pure geometry and format seams cover automatic fallback, invalid references and numerical edge cases. Extend established recovery and applied-image-export regressions.

## Delivery boundaries

This is a complete ordinary placement/durability slice, including the schema, command, renderer, import/export and tests required for that behavior. It is not a renderer-only change. Full recovery and bounded raster output for distant geometry belong to the dependent distant-exit ticket; this ticket alone does not finish those acceptance criteria.

Keep committed layout separate from logical route data and UI state. Use the single workspace writer and existing session/gesture ownership. Follow the repository's Sensitive architecture and persistence/domain review route. Coordinate encoding and snapshot reconstruction with import remapping and cleanup.

A completed movement should be compatible with one future history entry, but issue #5 is not a blocker and history is not implemented here. No remote operation or product implementation is started by publishing this ticket.
