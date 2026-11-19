---
title: Unified map with stable semantic zoom
status: closed
label: wayfinder:map
---

# Unified map with stable semantic zoom

## Destination

Reach an implementation-ready specification for a single continuous D3 canvas with stable schematic geometry and semantic detail across the Warden editor, player preview and player reader. Resolve spatial layout, editing across systems, disclosure, compatibility and the interaction/performance evidence needed to implement the feature.

## Source issue

[Unified map with semantic zoom](https://github.com/Submoon/ttrpg-cluster-control/issues/4), refreshed on 2026-11-16. The issue is open and has no comments.

The source requests a continuous canvas showing Cluster points at distant zoom and systems and their sub-objects at closer zoom. The Cluster is the organizational root. Its acceptance criteria require one D3 canvas, automatic detail changes at zoom thresholds, acceptable performance across zoom levels and working mobile touch zoom.

The framing discussion on 2026-11-13 explicitly includes the Warden editor, player preview and player reader, together with direct editing across visible systems.

## Notes

### Confirmed intake constraints

- The user selected stable schematic geometry. Zoom changes the camera and displayed detail. Local expansion that redistributes neighboring objects was considered and the user preferred stable geometry.
- The same navigation concept applies to all three surfaces, with information determined by each audience's publication permissions.
- The Warden can edit objects across visible systems directly. The target of the gesture determines the relevant system.
- Every catalogue object belongs to a star system in this effort, including objects far from its stars.
- The existing object-to-Orbit-to-object relationships provide the hierarchy inside systems. Concentric Orbits with the same host are peers.
- System Envelope is the selected reveal policy. A collapsed system needs a prominent name at distant zoom.

### Baseline and existing contracts

- After fetching origin on 2026-11-13, this worktree was fast-forwarded from `d221ffaec94d5ef35a01efc0180072e96d5b4e55` to `a369e60943a062b24e4404af8ce9610b4bdbb393`. HEAD, local main and origin/main matched that revision at the planning baseline. Local untracked environment configuration was preserved.
- When starting the representative-scenes decision on 2026-11-13, origin had advanced by six commits. Main and this worktree were fast-forwarded to `9ab9cd782abde0968348fcb283079fa9941111a5`, preserving the local glossary and planning work. The incoming changes concern contextual map actions, navigation and related UI/tests. This revision remains the prototype's base.
- For editing and navigation on 2026-11-14, fetched `origin/main` and local `main` matched `6613435f4b0fe0ac12528a64d6d2132cd2138e79`. Current editor behavior is reviewed at that revision. The local decision files remain on the prototype branch to retain its accepted changes.
- For Jump Route planning on 2026-11-16, local `main` was fast-forwarded after fetching and matches `origin/main` at `dc5edb282087458c1bc6dd26287c96a974662c3b`. Route behavior is reviewed at that revision. The planning checkout retains the prototype branch and its local decision files.
- [Workspace data](../../domain/workspace-model.ts) stores Cluster system positions independently from local object and Orbit geometry. [Cluster projection](../../utils/cluster-map-geometry.ts) and [system projection](../../utils/system-map-geometry.ts) provide deterministic positions. Implementing a shared canvas requires a local-to-canvas transform.
- Local geometry can extend beyond its initial scene bounds. An Orbit can have zero or multiple occupants and can follow an object host or an unoccupied center.
- [Player projection](../../domain/player-projection.ts) resolves public geometry before filtering and remaps relationships to snapshot-local IDs. The [publication boundary](../../docs/adr/0002-player-publication-boundary.md) governs the public inputs to the unified view.
- [The interface revamp navigation decision](../interface-revamp/tickets/01-map-navigation-boundary.md) deliberately deferred continuous navigation to this effort.
- Follow [editor architecture](../../docs/architecture/editor.md), [UI guidance](../../docs/agents/ui.md) and [domain context](../../CONTEXT.md). Use grilling and domain-modeling for decision discussions and prototype for runnable interaction questions.
- Planning artifacts follow the [local issue tracker](../../docs/agents/issue-tracker.md). Once this map is resolved, consolidate the decisions through to-spec and to-tickets.

## Decisions so far

- [Place star systems on a stable shared canvas](tickets/01-shared-spatial-layout.md) — Systems share one drawing scale and each has an independent movable anchor. The [revised specification](spec.md#geometry-reveal-and-ownership-boundaries) defines non-overlapping frames with independently positioned contents.
- [Define ownership and placement across system boundaries](tickets/02-system-ownership-and-placement.md) — Creation infers a clear owner or asks for one. The [revised specification](spec.md#placement-and-transfer) adds frame resizing and limited stretch. A drop in a neighboring frame initiates an orbital branch transfer and opens a review when keys or links need to change.
- [Choose representative scenes and interaction budgets](tickets/08-representative-scenes-and-budgets.md) — Evaluate 5 systems with 50 objects and 10 systems with 200 objects on a laptop and smartphone, targeting 60 frames per second, selection feedback under 100 ms and settled detail under 200 ms.
- [Prototype stable geometry and semantic detail](tickets/03-semantic-zoom-prototype.md) — The user chose System Envelope with large, readable names above the map at distant zoom.
- [Define editing and navigation across visible systems](tickets/04-cross-system-editing.md) — Camera gestures work across tools. Selection and drafts survive zoom, and a single group move can span systems. Frontmost targets receive direct input, while explicit reveal commands move the camera as needed.
- [Define Jump Route geometry across zoom levels](tickets/05-jump-route-representation.md) — Routes connect distinct systems with optional Jump Points. They switch their displayed ends with semantic detail and remain individually selectable. Migration silently drops old same-system routes.
- [Define shared geometry and disclosure in player views](tickets/06-player-geometry-and-disclosure.md) — Both player views use published geometry for envelopes, reveal and framing. Players can inspect public markers and routes, and detailed routes attach only to independently Revealed Jump Points.
- [Choose compatibility and export behavior for the unified map](tickets/07-compatibility-and-exports.md) — Preserve legacy layout, open earlier player shares on the unified map, and offer whole-Cluster, selected-system, and viewport images. Standalone imports use an anchor placement preview.

## Specification

The [runnable prototype and evaluation record](prototype-evaluation.md) capture the System Envelope decision and its overview-label refinement. Local development-browser samples expose zoom performance below the agreed target.

The eight decisions are consolidated in the [unified map specification](spec.md), including architecture boundaries, legacy migration and verification of the agreed performance targets. The specification is ready for implementation slicing. Numeric geometry and presentation parameters will be validated against its acceptance checks.

## Out of scope

- Product implementation during this Wayfinding effort.
- Objects with no owning star system. The user requested the dependent follow-up [Place and manage inter-system objects, including ships on Jump Routes](https://github.com/Submoon/ttrpg-cluster-control/issues/60), blocked by the source semantic-zoom issue.

## Deferred proposals

Planet surface maps, station interiors and political overlays were suggested during exploration. Their inclusion has not been approved. The current destination concerns the existing Cluster, systems, catalogue objects, Orbits and Jump Routes.
