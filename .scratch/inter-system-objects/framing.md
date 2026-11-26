---
title: Zones and catalogue objects in route transit
status: open
framing_status: approved
---

# Zones and catalogue objects in route transit

The user approved this consolidated framing and its delivery expectations on 2026-11-25. It is input to the later implementation specification and ticket breakdown; implementation has not started. The [superseded free-space framing](earlier-framing.md) is retained as history and does not define the delivery scope.

## Source issue

[Place and manage inter-system objects, including ships on Jump Routes](https://github.com/Submoon/ttrpg-cluster-control/issues/60), fetched on 2026-11-25. The issue is open, labelled enhancement, and has no comments. It requests catalogue objects outside arbitrary system ownership, ships positioned along Jump Routes, semantic-zoom integration and durable placement/relationships. Its semantic-zoom dependency was completed on 2026-11-24.

During framing on 2026-11-25, the user replaced free inter-system placement with generic named Zones and route transit. This local decision narrows and clarifies the source request; GitHub has not been edited.

## Baseline

Analysis uses fetched `origin/main` at `aab5a0c386c3d47959019d90867dc60a303982da`. Local `main` was fast-forwarded to that revision. Branch `codex/issue-60-framing` starts from that baseline. The original detached worktree revision `48873799dac97b84856db676176b5c6b869b5620` is not the analysis base. Existing local environment files were preserved.

## Confirmed current model

### One generic Zone container

The user confirmed one container called Zone, reusing the current star-system structure. It can represent a star system, an isolated station or a region without stars, and supports a local map, catalogue objects and Orbits. This is a terminology/generalization decision, not a second parallel container type.

Objects belong to a Zone or are in transit on a Jump Route. There is no free placement between Zones. Preserve the existing frame rules and routes between Zones, including optional local Jump Point attachments and unresolved exits.

### Same placement gesture for new and existing objects

The user confirmed that objects already in a local map can depart on a route and later enter a local map as the same entities, retaining identity, notes, Fields and publication. Route markers are not unrelated copies of the travelling object.

The user then clarified that any new or existing catalogue object can be dropped into a Zone or onto a route. Use the same placement model for creation and relocation. Do not require creating an object in a local map first, or add an origin-Zone restriction to selecting a route. An accepted relocation carries its hosted branch and retains entity identity.

The route-specific decisions below remain applicable to this model.

### Empty Zones at creation

Always create an empty Zone, including the initial local map and subsequently added Zones. Do not seed a Primary Star or require a star-system template. A star is an ordinary catalogue object the Warden can add afterward. Existing maps retain their existing contents.

### Deletion cascades to route travellers

The user chose to delete route-associated objects and their hosted branches when their route is deleted, after consequence confirmation. This also applies to incident routes removed as a consequence of deleting a Zone. The review must enumerate the affected routes, travellers and branches. Cancelling leaves data intact. This supersedes all earlier preserve-and-detach/relocate proposals.

### Cluster-wide Location keys retained

The user explicitly retained the earlier Cluster-wide key requirement after narrowing the placement scope: keys are not local to a Zone. The earlier accepted compatibility policy remains: newly assigned keys are unique throughout the Cluster, while existing duplicate keys in older maps are retained rather than renamed automatically. Placement changes preserve the same object and its existing key; precise legacy admission must not silently force renaming.

### Bounded placement within a Zone

The user added a strict Zone-placement constraint. Coordinate editing must reject impossible positions rather than publish an out-of-Zone result. The accepted position of the directly manipulated object cannot exceed the Zone including its permitted automatic expansion. This supersedes earlier statements allowing ordinary local placement outside the frame.

During dragging, show the dragged object at the pointer as an unapplied preview and a translucent ghost at its actual permitted landing position. The pointer can cross empty space to reach another Zone or route; the ghost communicates the bounded result if a drop is attempted between Zones. Do not confuse unconstrained pointer-preview geometry with an accepted object outside its container. New-object placement without a valid Zone/route target is rejected.

For an existing object, release applies its shown ghost position. Without another valid target, a Zone object projects to its current Zone's allowed elastic boundary, while a route object projects to its current route. This replaces cancelling an existing-object drop merely because the pointer is in empty space. Another valid Zone or route enables the intended transfer.

The user rejected testing every descendant as an independent obstacle to root movement: validate the directly manipulated object, preserve its branch, and automatically enlarge the Zone frame to encompass descendants, retaining their dimensions and relationships without automatically moving the camera. Preserve non-overlapping neighboring frames. If required growth is blocked by a neighboring Zone, show the last genuinely possible landing position in the ghost and limit the placement; reject an impossible change rather than moving neighboring Zones or overlapping their frames.

The user explicitly requested the ghost of the complete branch: root object, hosted Orbits and their recursively nested occupants. This must preview the actual accepted branch geometry, not merely the root point.

### Existing out-of-frame geometry

The user selected preserving existing positions in older maps and enforcing the new bounds only for new or changed placements. Do not automatically resize or reposition old content on opening. Unrelated edits must not force correction of pre-existing outliers. This is an explicit compatibility exception, separate from new-placement validity.

### Hierarchy, Search and filters

Route-associated objects appear under their route in Hierarchy, retaining their nested Orbits and occupants. Local objects remain under their Zone. Search indexes objects in both contexts, and the current object criteria apply in both places. Do not expose private route context through public hierarchy.

### Relationship consequences

A transferred root leaves its former parent Orbit, carries its complete hosted branch and preserves internal relationships. Present incompatible external relationships before accepting the transfer, and apply the move and all accepted consequences together. A Jump Point leaving its Zone loses its local route attachment while the route retains the same endpoint Zones. Do not revive the superseded rule that routes follow a free inter-system endpoint.

### Route-specific decisions retained

- All catalogue types can be represented on a route. A moving root retains its hosted Orbit branch and recursive occupants.
- Position updates are manual. There is no autonomous travel or campaign clock.
- The Warden can move an object along a route or enter an exact departure-to-arrival percentage in Inspect. Relative progression follows the route when it is reshaped. Swapping its departure and arrival complements progression to retain the stage along the trip.
- An object remains attached at 0% or 100% until the Warden explicitly chooses Detach, including at known Zone endpoints. Zoom alone never changes ownership.
- Distant views retain root markers; zoom progressively reveals hosted branches. Selection survives semantic collapse. Player presentation derives only from permitted content.
- Objects retain the four existing publication modes. A published travelling object can appear without exposing a private route's path, name, percentage or destinations. A shared route may disclose the association and progression using only permitted endpoint information.

### Persistence, history and exports

Complete source backup and restore include all Zones, routes, travellers, hosted branches, publication policies and accepted layout. Older files remain readable under the accepted legacy exceptions. A standalone Zone file contains that Zone's own content and internal relationships, retaining reviewed copy import; it does not include travellers owned by routes.

Cluster and current-viewport images include travellers at the applicable semantic detail. Selected-Zone images use that Zone's own content and the existing bounded incident-route treatment. Player preview, reader, files, links and images follow the same publication permissions and detached-document boundary. Their framing and metadata depend only on permitted content.

One accepted transfer, its frame growth and its relationship consequences constitute one Undo/Redo action. Reuse the existing applied-memory, ordered persistence and history owners. Unapplied drag/ghost previews are not persisted or exported. Cancellation and stale operations do not publish partial changes.

## Observable delivery criteria

- A new Zone is empty and supports a stellar system or a location without stars; existing saved names and contents survive the terminology change.
- Every catalogue type can be created or relocated in a Zone or on a route. Relocation preserves identity, authored data and the complete hosted branch.
- Pointer dragging shows an unconstrained pointer preview and the complete translucent branch at its actual landing position. An existing object's accepted position matches that ghost; new placement without a valid support creates nothing.
- Local dragging obeys the permitted elastic limit. Descendant-driven frame growth retains branch geometry, does not overlap or move neighboring Zones and does not automatically move the camera. Numeric edits reject impossible proposals.
- Route progression is manual, supports precise input, follows reshaping, complements on simple reversal, and remains attached at 0%/100% until an explicit context-changing action.
- Deletion review includes all travellers and descendants cascaded by a route or Zone removal; cancel preserves data. History restores the complete accepted action.
- New key assignments are Cluster-wide unique. Existing duplicate keys and out-of-frame positions remain unchanged until the relevant assignment or placement is edited; unrelated edits and round trips do not silently repair them.
- Hierarchy, object Search, criteria, inspection and selection work for both Zone and route context. Semantic collapse preserves selection. Published travellers never disclose a private route association or private content through presentation, documents, images or their bounds.
- Full backups round-trip all committed transit data; standalone Zone copies retain their scope. Exported scenes follow their selected scope and exclude unapplied previews.

Use existing pure domain/geometry/codec/projection checks, guarded command/history checks and focused browser journeys for their distinct observable risks. The later specification should pin the relevant seams and compatibility/version decisions before implementation; this framing does not prescribe a storage schema or file layout.

## Superseded scope

The earlier free-space decisions are not requirements of this narrowed effort: free object placement, automatic capture/release through system frames, standalone Orbits outside local containers, free Jump Point route endpoints, zero-container Clusters and extended free-inter-system Station-association rules. Cluster-wide uniqueness for newly assigned keys was explicitly retained. The earlier route-deletion proposal of leaving objects freely between systems is superseded by confirmed cascade deletion.

## Existing facts

- A star-system container can have no stars or objects; its anchor is independent of stars. A Zone therefore does not require a new container solely to represent a place without a solar system.
- Objects and Orbits currently live in their owning system. The current placement union has only local coordinates and Orbit references; route transit is new domain behavior.
- Routes currently connect different systems or lead to an unresolved exit. Local point attachments and optional Station associations are distinct relationships.
- Full source backup replaces the active Cluster on restore; standalone local-map import remains a reviewed copy. Player documents are detached allowlisted snapshots, independent of private source data.

## Framing resolution

All product branches raised in this interview have answers. On 2026-11-25, the user confirmed the overall model through Codex's structured question tool: "Oui, le cadrage est validé". The next phase is specification and dependency-aware ticket breakdown from this approved model. The open status denotes planned delivery, not unfinished framing. Implementation has not started, and the GitHub issue has not been edited or closed.
