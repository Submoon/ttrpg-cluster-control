---
title: Superseded framing of free inter-system objects
status: closed
---

# Place and manage inter-system catalogue objects

## Resolution

Superseded on 2026-11-25 by [Zones and catalogue objects in route transit](spec.md). This document preserves the earlier interview, including rejected alternatives and decisions that were later changed. It is not an implementation brief and must not override the current framing. Closing this historical document does not mean issue 60 has been implemented.

This document captures framing decisions. It is not yet an approved implementation specification.

## Current direction: scope reconsidered

On 2026-11-25, the user reconsidered free inter-system objects: "ce n'est peut-être pas une bonne idée de gérer des objets entre les systèmes", while retaining interest in objects along a Jump Route. The earlier decisions below are historical interview material and must not be treated as an approved delivery scope. Frame-based membership, free objects/Orbits, free Jump Point endpoints, zero-system Clusters and related migration changes are suspended pending a narrower route-transit framing. Confirm which previous route-specific decisions remain applicable before implementation or final specification.

The pending Station-association policy question is superseded by this scope reconsideration; do not continue it without a route-specific need. The free-inter-system, extended-endpoint, Orbit and global-key glossary edits have been rolled back. Only the route-progression term remains while the route-transit model is clarified.

The user confirmed that route transit concerns the same catalogue objects that can depart from and return to a local map, preserving identity and data, rather than unrelated route-only markers.

The user then asked whether locations without a solar system should use another kind of zone, or whether renaming the current system container would suffice. This is an open domain-modeling question, not approval of either alternative. Baseline facts: a system can have no stars or other objects; its anchor is independent of stars and its local map already supports objects and Orbits. A generic named Zone could reuse that container. Do not assume that scope narrowing or the Zone terminology has been accepted yet.

## Source issue

[Place and manage inter-system objects, including ships on Jump Routes](https://github.com/Submoon/ttrpg-cluster-control/issues/60), fetched on 2026-11-25. The issue is open, labelled enhancement, and has no comments.

The requested outcome is to create, inspect and position objects without assigning them to an arbitrary star system, represent ships on Jump Routes, integrate selection and semantic zoom, and preserve placement and relationships through save and restore. The semantic-zoom dependency, issue 4, was completed on 2026-11-24.

## Baseline

Framing uses fetched `origin/main` at `aab5a0c386c3d47959019d90867dc60a303982da`. Local `main` was fast-forwarded to that revision. The framing branch is `codex/issue-60-framing`, created from that baseline; the initial detached worktree revision `48873799dac97b84856db676176b5c6b869b5620` is not the analysis base. Existing local environment files were preserved.

## Confirmed decisions

### Eligible object types

On 2026-11-25, the user selected the entire catalogue. Inter-system placement must therefore support every catalogue type from the first delivery, rather than an initial Vessel-only subset. This does not yet decide Orbit ownership, hosted branches, or relationship rules.

### Free and route-attached placement

On 2026-11-25, the user confirmed both free placement between systems and attachment to a Jump Route for every catalogue type. Attaching or detaching an object is an explicit action.

### Manual position updates

On 2026-11-25, the user confirmed manual position updates, including progression along a Jump Route. Automatic travel simulation and campaign-time progression are outside this delivery.

### Automatic ownership changes at system frames

On 2026-11-25, the user selected changing ownership when an object moves into or out of a system frame, instead of requiring an explicit ownership-change action. Moving or resizing a system must also reassess ownership. This extends delivered drag-transfer behavior to inter-system placement and system movement/resizing. Boundary cases and camera-only changes still need clarification.

Ownership changes preserve object identity, notes, Fields and publication and include the complete hosted orbital branch. Moving an occupant independently leaves its former parent Orbit. Changes to links or Location keys require a consequence preview before acceptance.

The user chose to retain existing frames that partly adapt to their contents, rather than introduce fixed boundaries. A system move carries its current contents and evaluates new memberships at its final position; objects merely crossed during the gesture are not collected. Resizing evaluates membership against the final limits. Changes receive a preview and one combined Undo action.

Evaluate membership once per accepted operation, using the proposed final frame geometry including accepted elastic growth, before inserting or removing the newly classified contents. Recomputing rendering does not trigger another capture pass. A hosted branch follows its root object's point; a standalone Orbit branch follows its unoccupied center. Occupants do not independently change ownership merely because they extend outside the frame. Moving an occupant independently separates it from the branch.

When containment is ambiguous at a frame boundary, choose the candidate system whose anchor/center is nearest, rather than opening an ownership chooser. Outside all frames, ordinary unattached placement is inter-system; nearest-system selection is an ambiguity rule, not an unconditional capture radius.

### Inter-system orbital branches

On 2026-11-25, the user confirmed complete hosted orbital branches between systems, including recursive occupants and their internal relationships. Standalone unoccupied-center Orbits and detailed transfer rules remain open.

### Route-following placement

On 2026-11-25, after considering an endpoint-system movement that displaces the route, the user selected that the associated object follows the displaced route. This supersedes the earlier fixed-map-position answer. The user subsequently confirmed a relative departure-to-arrival progression, such as 40%, preserved as the route changes shape. The Warden can move the object along the route and enter a precise progression in the Inspector. Zoom, direction, endpoint-edit and arrival rules remain open.

### Route edits and deletion

The user confirmed that changing a route's destination keeps its objects attached at the same progression. Simply exchanging departure and arrival converts progression to its complement (30% becomes 70%) to retain the object's position along the trip.

Deleting a route preserves its associated objects and hosted branches at their last map positions as free inter-system objects, with consequences reviewed before acceptance. This also applies when a route is removed as a consequence of deleting a system.

### Standalone inter-system Orbits

The user confirmed that Orbits with an unoccupied center can exist between systems, as well as Orbits hosted by inter-system objects.

### Cluster-wide Location keys

The user selected Cluster-wide uniqueness for newly assigned Location keys, including every system and inter-system placement. The user then explicitly chose to preserve duplicate keys already present in older maps, rather than rename them during migration. A transfer retains an object's existing key. Legacy duplicates must not block unrelated editing or saving; new assignments cannot introduce further duplicates. Existing keys are labels, not substitutes for globally unique entity IDs.

### Independent inter-system publication

Inter-system objects use Hidden, Unknown presence, Known type and Revealed, independently of system publication. A published inter-system object may appear between Hidden systems. Required Orbits and hosts follow the existing minimum-disclosure rules.

A published route-associated object remains visible when its route is private, but only at its permitted map position: do not disclose the private route path, name, progression or destinations. When the route is shared, its association and progression may be disclosed with only already-authorized endpoint information.

### Transit takes precedence over system frames

An object associated with a route remains in transit when that route crosses an unrelated system frame or a frame moves over it. A zoom-only change never changes ownership. At every endpoint, including a known system or point and an unresolved exit, the object remains attached even at 0% or 100% until an explicit Detach action. Detaching at an in-system endpoint places it in that system; detaching at an inter-system endpoint places it freely there. This supersedes the earlier automatic-entry answer for system endpoints. This is a Warden-triggered positioning workflow, not autonomous travel.

### Inter-system Jump Point endpoints

The user explicitly extended routes to allow inter-system Jump Points as endpoints, rather than restricting every known endpoint to a system. Routes can therefore connect a system with an inter-system Jump Point or two inter-system Jump Points.

A route retains its endpoint Jump Point identity through point movement and ownership changes, including a move of the point's host branch. It does not fall back to the former system merely because the point leaves that system. This supersedes the existing transfer consequence that clears a route's local point attachment.

A shared route requires at least one published endpoint, whether a system or an inter-system Jump Point. A Hidden other endpoint becomes a generic unknown destination at its authorized position. A route with two Hidden endpoints is omitted from the player document.

Reject placements that introduce a geometry-dependency cycle, including attaching a route's endpoint point or its host branch to that same route, or cycles passing through several routes. Explain the rejection and preserve the previous accepted state.

If connected endpoints come to belong to the same system, remove the resulting internal route only after confirmation. Apply the established preservation rule to its route-associated objects: detach them at their last positions with their branches intact. Deleting an inter-system endpoint Jump Point removes its incident routes after consequence review, rather than converting the removed endpoint into an unresolved destination. Deleting an in-system point retains the existing system fallback where that system survives.

### Clusters without systems

A Jump Cluster may contain no systems, whether it has inter-system objects and Orbits or is completely empty during preparation. The current last-system deletion restriction must therefore change.

### Semantic zoom and selection

Inter-system root objects remain visible as markers in distant views. Zooming progressively reveals hosted Orbits and occupants. Preserve selection when details collapse. Apply the same presentation principle in the player view, using only permitted published content.

## Existing constraints

- Catalogue objects currently belong to a star system, even when drawn outside its envelope. Object placements are system coordinates or an Orbit reference. Current drag handling already supports reviewed transfers into another system's captured frame.
- Jump Routes have stable identities, but their drawn curves and displayed endpoints change with semantic zoom. Existing route geometry does not define a transit-progress contract.
- Existing system transfers preserve identities and hosted branches while reviewing Location key conflicts, crossing Station links and route attachments.
- Player projection currently admits objects through Revealed systems. Inter-system disclosure needs explicit rules within the existing allowlisted public-document boundary.
- The current displayed frame uses authored preferred dimensions when available and otherwise the content envelope, then applies neighbor clipping. It may exclude owned contents. Regular frame geometry is camera-independent; limited drag elasticity uses a screen-distance threshold. Keep this distinct from the full-content envelope used for framing and semantic reveal.

## Open decisions

- Automatic-ownership boundary cases and attachment/removal interaction rules.
- Station links; the user requested the exact delivered UI path before deciding their new inter-system rule.
- Creation, movement, Hierarchy and inspection interactions.
- Save/restore, import, exports, history and compatibility acceptance criteria.

## Interview state

Confirmed decisions are recorded above. Continue the interview using Codex's structured question tool and retain the active turn while awaiting replies. Unanswered recommendations remain proposals, not user decisions.

The user requested a plain-language explanation of the optional Jump Point-to-Station association. Its new inter-system compatibility rule remains undecided.
