---
title: Approved tickets for map-based positioning
status: open
plan_status: approved
plan_approved_on: 2026-10-27
tickets_status: published
---

# Approved tickets for map-based positioning

The user approved these six slices and their blocking edges through the Codex question form on 2026-10-27. One English ready-for-agent local file is published per ticket. Ticket numbers below are local identifiers, not GitHub issue numbers. Implementation of the authorized initial frontier (01, 02, 04 and 06) is in progress.

## Source and baseline

- Parent: [Map-based positioning and movable unresolved-exit targets](spec.md), with approved product scope and testing entry points.
- Source issue: [Allow repositioning unresolved-exit target markers on the Cluster map](https://github.com/Submoon/ttrpg-cluster-control/issues/27).
- Origin and the issue were refreshed on 2026-10-27 for this breakdown. The issue remains open, enhancement, with unchanged body and no comments.
- Actual decomposition baseline: 9edfa66c4f505d56f106fc4af8245f200abfba78. Worktree HEAD, origin/main and main are aligned; no intentionally different base.
- [Undo/redo functionality](https://github.com/Submoon/ttrpg-cluster-control/issues/5) remains a related contract, not a blocking edge. No cross-chat message was sent.
- Repository policy publishes approved implementation tickets under this effort's tickets directory. No GitHub issue, parent state or remote label will be changed.

## Slicing decisions

- Deliver by user-visible element family and scenario, rather than by schema, renderer or test layer.
- Every ticket owns its command behavior, preview/commit/cancel guarantees, appropriate durable-state effects and affected tests. Do not defer all testing to a final ticket.
- Reuse focused placement controllers, pure geometry, guarded commands and the single workspace writer. No standalone horizontal prefactor is justified by current evidence.
- Keep the old alternative available until its replacement is delivered for that family, then remove the corresponding editable position fields in the same ticket. All fields are gone when the complete plan is done.
- Resolve shared interaction interfaces at the architecture step before concurrent writers, and follow the repository's writer/resource limits. Overlapping source files require coordination; they do not by themselves create product dependency edges.
- Each completed slice is independently demonstrable and appropriately verified. Passing a slice does not mean the entire specification or GitHub request is complete.

## Published tickets

### 01 — [Position Cluster systems from the map](tickets/01-position-cluster-systems-from-map.md)

**Blocked by:** None (can start immediately).

**What it delivers:** Cluster systems can be positioned through the common select/Move/click-or-keyboard/preview/confirm workflow. Drag remains available. System X/Y editing and coordinate-based creation inputs disappear when map-only alternatives are ready.

**Completion evidence:** pointer and keyboard preview/confirm/cancel; retained system-placement validation and source-system bounds; navigation takeover and focus; numeric-field absence; accessible map creation; reload/save recovery; preservation of unrelated chart drafts and already committed geometry.

**Boundary:** does not require unresolved targets or system-map object changes. Existing system movement and layout already provide its durable path.

### 02 — [Move and retain unresolved-exit targets](tickets/02-move-and-retain-unresolved-exit-targets.md)

**Blocked by:** None (can start immediately).

**What it delivers:** An existing unresolved target can be dragged or placed through the common non-drag workflow; its path and labels follow, and the chosen absolute position is saved, restored, exchanged and associated with the right Jump Route. Logical route properties and unrelated drafts are preserved.

**Completion evidence:** independent routes with repeated names/origins; pan/zoom conversion and no first-drag jump; route selection in Select/Move; fixed target after origin movement; ordinary route edits; resolution/deletion cleanup; legacy defaults; reload and save Retry; JSON round trips and import ID remapping; applied geometry in normal-scene SVG/PNG exports; canceled preview never persisted.

**Boundary:** deliver the complete ordinary placement/durability path, not a renderer-only or schema-only change. The scene-space storage contract must already permit valid off-canvas values. Do not introduce a temporary schema bound that the next ticket must migrate. Far-scene navigation and raster sizing guarantees are completed by ticket 03; this ticket alone does not complete the full off-canvas acceptance criteria.

### 03 — [Recover and export distant unresolved exits](tickets/03-recover-and-export-distant-unresolved-exits.md)

**Blocked by:** 02 — Move and retain unresolved-exit targets.

**What it delivers:** A Warden can place a target beyond the initial canvas, recover the entire applied map with pan and Fit, and export it completely as SVG or a bounded-size PNG.

**Completion evidence:** negative and far-away target positions remain durable; Fit includes targets and labels below the historical minimum scale; consistent off-canvas presentation; pan/zoom never mutate data; whole-scene vector export; raster scaling without cropping or unbounded allocation; committed geometry during a live preview; no bounds inflation from hit shapes; numerical failures reject without a partial update.

**Why blocked:** the demonstrations and guarantees depend on the target-layout and committed-geometry path introduced by 02. This ticket extends a delivered user capability; it is not a separate generic zoom or export refactor.

### 04 — [Position free system-map objects without coordinates](tickets/04-position-free-system-map-objects.md)

**Blocked by:** None (can start immediately).

**What it delivers:** Free objects can be moved on the map by drag or click/keyboard preview and confirmation, with their hosted descendants carried consistently. Free-object X/Y fields disappear from Inspector, Dock and relevant creation/placement surfaces without removing logical object properties.

**Completion evidence:** free placement and explicit destination choice; carried Orbits/descendants; invalid or ambiguous target handling; preview/cancel and focus; no editable X/Y; non-drag map creation; retained names/custom/native fields and Station associations; independent committed movement across Inspector Apply/Discard, reload and save recovery.

**Boundary:** establishes the system-object map-targeting and independent-position-commit path used by 05. Keep the existing supported Orbit-occupant path working until its own replacement is delivered.

### 05 — [Position Orbit occupants without angle fields](tickets/05-position-orbit-occupants-without-angle-fields.md)

**Blocked by:** 04 — Position free system-map objects without coordinates.

**What it delivers:** Objects on Orbits use map-only placement, including keyboard/click alternatives, along-Orbit motion, valid transfer and explicit free/attached outcomes. Positional-angle fields are removed while Orbit rotation and logical destination choices remain.

**Completion evidence:** preserving an Orbit while moving along it; attachment/transfer/free outcomes; named choices for overlapping targets; existing relationship/cycle validation; carried descendants; no editable occupant-angle field; retained size/orientation/Station/relationship controls; cancellation, focus, reload and independent Inspector drafts.

**Why blocked:** extends 04's system-object target/preview/commit path to angular and relationship-dependent outcomes. Doing this after the free-object path avoids two incompatible replacements for the same object placement workflow.

### 06 — [Move unoccupied Orbit centers without coordinate fields](tickets/06-move-unoccupied-orbit-centers.md)

**Blocked by:** None (can start immediately).

**What it delivers:** Unoccupied Orbit centers use the common click/keyboard preview-and-confirm placement as well as drag. Center X/Y fields disappear, while Orbit size, rotation, host-relative order and explicit attachment/detachment remain usable.

**Completion evidence:** center move/preview/confirm/cancel with its contained geometry; retained radii/rotation controls and draft values; explicit host candidates and invalid-target behavior; hosted Orbits continue to move through hosts; keyboard focus; center fields absent; position preserved across unrelated Orbit Apply/Discard and reload.

**Boundary:** center/Orbit operations are independent from the object placement controller delivered in 04/05. Coordinate overlapping renderer, gesture and Inspector changes through normal ownership rules instead of adding an artificial blocker.

## Blocking graph and frontier

- 02 blocks 03.
- 04 blocks 05.
- 01 and 06 have no ticket blockers.
- Initial frontier: 01, 02, 04 and 06. This is availability, not authorization for four concurrent writers; the repository's limit and disjoint-ownership rules still apply.
- Tickets were published open and ready-for-agent. The user subsequently authorized implementation of 01, 02, 04 and 06; their current lifecycle and assignee are recorded in each ticket. Prerequisite links still govern 03 and 05, whose implementation has not been requested. See the [first-frontier implementation record](implementation.md) for coordination boundaries.
- No ticket waits on #5 merely because both efforts touch semantic edits. Reconcile interfaces if that design lands first; add a real blocker only if new evidence establishes one.

## Specification coverage

Numbers refer to User Stories in the parent specification. Cross-cutting stories appear in multiple tickets because each completed family must preserve those guarantees.

| Ticket | Story coverage |
| --- | --- |
| 01 | 30–43, 45–46, 54, 58–60, 64–71, 80, 86 |
| 02 | 1–45, 64–76, 80–86 for the ordinary scene; far-scene guarantees completed by 03 |
| 03 | 5–7, 40, 68–69, 76–85 |
| 04 | 30–45, 47, 49, 51, 55, 58–60, 62–71, 80, 86 |
| 05 | 30–45, 48–49, 51–53, 57–68, 70–71, 80, 86 |
| 06 | 30–45, 50–53, 56, 58–71, 80, 86 |

All 86 stories are covered collectively. The integrated delivery must also satisfy the specification's testing decisions and completion checks; this plan does not create a final horizontal testing ticket.

## Approval and publication

The user selected “Valider la granularité et les dépendances proposées” on 2026-10-27. The approved tickets are published with lifecycle status open, parent-specification links, the enhancement/ready-for-agent triage roles and explicit blocking links. Local publication does not modify or close the GitHub source, authorize implementation, create a PR or start an unrelated chat. Before implementation, refresh the source/baseline and follow the repository's applicable architecture, ownership and review route.

## Publication verification

Verified on 2026-10-27: six unclaimed open tickets, local enhancement/ready-for-agent roles, 82 acceptance criteria, valid local references, collective coverage of all 86 parent stories, no source paths/code snippets in ticket prose, and exactly the approved blocking edges 02 to 03 and 04 to 05. Source issue #27 was re-read before reporting completion and remains unchanged, open, with no comments. No runtime tests were run because this task publishes planning documents only. Product source, remote labels, parent issue state and unrelated worktrees were not changed.
