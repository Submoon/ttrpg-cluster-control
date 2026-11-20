---
title: "Select and move an object group across systems"
status: closed
assignee: Codex
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 13 — Select and move an object group across systems

## What to build

Let the Warden assemble a selection across system boundaries and move it as one operation, including members hidden by semantic zoom.

## Blocked by

- [Add and move a target within its owning system](12-add-and-move-within-owning-system.md)

## Specification and baseline

[Unified map with stable semantic zoom](../spec.md) · [Source issue](https://github.com/Submoon/ttrpg-cluster-control/issues/4)

User stories covered: 11, 28–33.

Planning baseline: `dc5edb282087458c1bc6dd26287c96a974662c3b` (`main` and `origin/main` after fetch on 2026-11-16). The local planning checkout retains the prototype branch. Implement against the application baseline after refreshing it.

## Acceptance criteria

- [x] On desktop, modified click and the unmodified primary-button selection rectangle in Select can gather objects from several systems. Right-drag still pans. Map and Hierarchy show shared selection and support the existing keyboard access.
- [x] On a phone, long-pressing each object toggles membership. An ordinary tap selects normally. Motion or a second contact cancels a pending hold, and the release of an activated hold cannot also tap. Switching to Move retains the group.
- [x] Dragging a selected object moves the whole group by a single Cluster-space displacement. Only the grabbed object can snap that displacement to an eligible Orbit in its own system.
- [x] All members keep their owners. Hosted branches follow their hosts exactly once, even when a descendant is also selected. The preview identifies Orbit attachments, detachments and the number of selected members hidden by detail.
- [x] Cancellation keeps the pre-gesture layout. A valid group move is accepted atomically and is restored or reverted as one history entry. Verify deterministic group geometry and a representative combined gesture and history journey.

## Resolution

## Resolution

- Continuous Warden selection spans owners using the desktop rectangle and modifier toggle, Hierarchy membership and individual touch holds. Right-button pan remains independent. Focused inspection, the current Inspector draft and explicit group membership are separate. Semantic disappearance does not remove a member. Ordinary Search and history object reveal set an explicit singleton, and unrelated group members survive focused object, Orbit, route or owner cleanup.
- One active Move plans a common Cluster-space delta. The grabbed independent member determines Orbit snap in its own system. Owned branches move once, and attachment changes are shown during preview. The group previews moved objects, hosted Orbits and detailed route endpoints. Image, Fit and envelope geometry still use the applied projections. Held Escape, pinch takeover or stale gestures cancel without publication. One history operation applies the group across owners.
- Focused pure planner/controller/route tests passed, including explicit membership, atomic workspace/history publication, surviving membership after cleanup and moving an attached route endpoint in preview. Generated Vue passed at the final source state. Independent code review rechecked the hosted Orbit/route, singleton and cleanup fixes.
- Exact compiled Chrome source with test-only revisions through `05541f2d3506c3187067fc09683dcfb107e0cb06` passed the maintained cross-owner pointer journey. It uses two exposed marks in different owners, a real modified click, a visible group preview, Escape with a held pointer and an unchanged actual backup, then a fresh group move with the companion's saved position changed in its original owner.
- The maintained compact hold passed at the same product source. Supplemental actual Chrome desktop input verified rectangle, right pan, membership across semantic collapse, the hosted Orbit preview and restoration on held Escape. The compact supplement verified two individual holds on different owners and actual second-contact pinch takeover with all group transforms restored. Results are `13-group-mouse-results.json` and `13-group-touch-results.json`.
- The existing legacy Hierarchy and keyboard-reflow case also passed by itself in 36.8 seconds after the fixture switched to the actual post-reopen backup and removed its duplicate immediate Redo download.
