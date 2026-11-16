---
title: Define ownership and placement across system boundaries
status: closed
label: wayfinder:grilling
type: grilling
mode: HITL
parent: ../map.md
assignee: Codex
---

# Define ownership and placement across system boundaries

## Question

How does the Warden choose the owning system when creating or moving an object on the unified canvas?

Determine what happens when an object is placed outside a visible system envelope, within overlapping envelopes, or across another system's boundary. Decide whether dragging can transfer ownership, how the destination is communicated, and what happens to a moved object's hosted Orbit branch and same-system relationships.

Every object must have an owning system in this effort. Consider a planet with a Moon and a Station, a free object far from its star, and a Jump Point linked to a Station. Distinguish the user actions of repositioning within a system and transferring to another one by their observable outcomes.

## Context

The [source map](../map.md) confirms direct editing across systems. Geometry alone may be ambiguous where system envelopes overlap. The dependent [inter-system objects follow-up](https://github.com/Submoon/ttrpg-cluster-control/issues/60) owns future objects without a star-system parent.

## Blocked by

- [Place star systems on a stable shared canvas](01-shared-spatial-layout.md)

## Resolution

Confirmed by the user over three discussion rounds on 2026-11-13. The source issue and its comments were refreshed before resolution. The verified planning baseline is `a369e60943a062b24e4404af8ce9610b4bdbb393`.

The spatial-layout decision allows overlapping system envelopes that expand with their contents. This ticket therefore defines ownership independently from the visual containment of a point alone.

### Creation and ownership

1. A definite object or Orbit placement target supplies the owning system at creation. Otherwise, the unique system envelope at the placement point supplies it. When multiple envelopes overlap or the point is outside every envelope, the Warden chooses the owning system before creation is accepted.
2. An ordinary move retains the object's owning system, including when it ends inside a neighbor's envelope. The source envelope adapts. An explicit Change system action initiates an ownership transfer.

### Code facts relevant to transfer decisions

- Existing [object placement](../../../composables/editor-workflows/useSystemObjectPlacement.ts) and [workspace placement mutations](../../../domain/workspace-placement.ts) operate within one owning system. Cross-system transfer requires a new operation.
- [Workspace validation](../../../domain/workspace-schema.ts) requires globally unique object and Orbit IDs, while location keys are unique within a system. A transferred entity can retain its identity, but a conflicting incoming location key requires resolution.
- Orbit hosts and occupants must belong to the same system, and the placement graph must remain acyclic. Preserving a host's existing descendant relationships requires transferring its complete hosted branch. The root's own source parent Orbit is a separate relationship to resolve.
- Jump Routes reference Jump Point IDs across the Cluster. A Jump Point's optional Station link is restricted to the same system. Multiple Jump Points can reference one Station. Transferring a linked endpoint or Station therefore requires handling any links that would span different systems.

### Transfer scope and review

3. Transferring an object includes its complete hosted Orbit branch and all recursive occupants, preserving their internal relationships.
4. After choosing the destination system, the Warden places the transferred object through a preview before acceptance.
5. Available location keys are retained. For each incoming key that conflicts with the destination, the operation proposes an available replacement that the Warden can edit before acceptance.

### Destination placement and relationships

6. Destination placement supports either a free position or an Orbit of the chosen system. The transferred root leaves its source parent Orbit, while its hosted Orbits and occupants travel with it.
7. All systems share a drawing scale, so a transferred branch keeps its apparent size, local dimensions and proportions at the current zoom. The preview shows its resulting placement. This supersedes the earlier destination-scale rule.
8. Station links are retained whenever both ends remain in the same system. The preview identifies Station links that the transfer would place across systems, and accepting the transfer removes those links. This applies both to a departing Jump Point and to a departing Station with one or more referring Jump Points. For Jump Routes, see the [attachment removal rule](05-jump-route-representation.md#attachment-changes-and-compatibility). Transferring a Jump Point leaves the systems connected and removes the local route attachment after review.

### Handoff boundaries

The prototype covers creation within overlapping envelopes or outside all envelopes, ordinary movement across another system's envelope, and explicit whole-branch transfer. The preview communicates the destination, resulting placement, replacement keys and affected links. The prototype's scale comparison predates the common-scale clarification.

Detailed command, draft and multi-selection interactions are coordinated with [Define editing and navigation across visible systems](04-cross-system-editing.md).

Player disclosure and the public presentation of changed system ownership are coordinated with [Define shared geometry and disclosure in player views](06-player-geometry-and-disclosure.md).
