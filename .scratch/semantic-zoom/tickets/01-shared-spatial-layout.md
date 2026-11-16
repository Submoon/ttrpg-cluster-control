---
title: Place star systems on a stable shared canvas
status: closed
label: wayfinder:grilling
type: grilling
mode: HITL
parent: ../map.md
assignee: Codex
---

# Place star systems on a stable shared canvas

## Question

How should each system's existing local geometry be anchored and scaled into the shared Cluster canvas?

Choose the anchor, initial system scale, the meaning of any system frame or envelope, and how deliberately moving or resizing a system affects its contents. Decide how neighboring systems can overlap and how the Warden controls the space occupied by a dense system.

Use two nearby systems, an off-center star, a free Orbit center and a distant object as concrete cases. The user has selected stable geometry during zoom and direct editing across visible systems.

## Existing facts

Cluster system anchors and local geometry use independent coordinate frames. Current objects can extend beyond their initial scene bounds. Stars are ordinary movable objects, and a system can contain multiple stars. The current data has no common distance unit or stored transform between these frames.

See the baseline and source references in [Unified map with stable semantic zoom](../map.md).

## Blocked by

None.

## Resolution

Confirmed by the user over three discussion rounds on 2026-11-13. The source issue and comments were refreshed before resolution. The planning baseline remains `a369e60943a062b24e4404af8ce9610b4bdbb393`.

1. Each system has its own Cluster anchor, independent of its stars. Moving the anchor moves the whole system. A system may have multiple stars or an off-center star.
2. All systems use one common drawing scale. The Warden positions whole systems and edits their contents at that scale. This supersedes the earlier decision to allow individual system scaling.
3. The Warden's visible system envelope automatically fits its contents with a margin. Moving an object farther away enlarges the envelope to include it.
4. Neighboring systems may overlap when repositioned or when their contents expand. Their envelopes remain identifiable. The Warden can reposition systems to arrange the map.
5. An envelope may be asymmetric around its anchor. Its size follows the system's contents.
6. With Move, dragging a system's name or anchor moves the whole system.
7. The envelope includes the anchor, objects and Orbits. An empty system has a minimum frame around its anchor.

Camera navigation uses stable geometry. Moving a system is an explicit layout edit.

### Handoff boundaries

- The product contract defines an independent anchor and a common scale across systems. The specification will express the local-to-canvas coordinate convention. The treatment of existing saved layouts belongs to [Choose compatibility and export behavior for the unified map](07-compatibility-and-exports.md).
- The common scale's numerical value, envelope margin, minimum footprint and visual treatment remain specification choices. The [prototype](03-semantic-zoom-prototype.md) used adjustable scales while comparing reveal policies. The common scale was clarified after those runs during [editing and navigation](04-cross-system-editing.md).

Creation ownership and cross-system transfers are addressed by [Define ownership and placement across system boundaries](02-system-ownership-and-placement.md). Public envelope disclosure is addressed by [Define shared geometry and disclosure in player views](06-player-geometry-and-disclosure.md).
