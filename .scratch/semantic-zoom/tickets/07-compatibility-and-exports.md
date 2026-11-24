---
title: Choose compatibility and export behavior for the unified map
status: closed
label: wayfinder:grilling
type: grilling
mode: HITL
parent: ../map.md
assignee: Codex
---

# Choose compatibility and export behavior for the unified map

## Question

How should existing workspaces and published documents acquire the selected shared layout, and which spatial choices persist through save, reload, import and export?

Define how existing Cluster and local positions map to the independent system anchors and common drawing scale when reopening documents created before this feature. Decide the scope and framing of existing image and data exports in a continuous canvas.

Consider a workspace with distant local objects, a single-system import into an existing Cluster, an older player snapshot and undo/redo of a layout edit. Specify the user-visible outcomes and compatibility requirements.

## Context

Use the accepted layout, ownership and public-geometry decisions from [the source map](../map.md). Existing persistence and history ownership is documented in [editor architecture](../../../docs/architecture/editor.md). Implementation format choices follow after the required behavior is settled.

The [Jump Route decision](05-jump-route-representation.md) requires retained older routes to keep their identity, Jump Point attachments, and unresolved exit information when the workspace adopts direct system endpoints. Migration silently removes resolved routes within the same system from older editable maps, retaining their Jump Points and Stations. Apply these requirements when defining restoration and import.

The [player geometry decision](06-player-geometry-and-disclosure.md) derives framing and system envelopes from the published document and permits route attachments to independently Revealed Jump Points. Earlier player documents contain system-based route endpoints. Define their continuous presentation from the information they already carry.

On 2026-11-16, the source issue was refreshed and remained open with no new comments. After fetching, `main` and `origin/main` matched `dc5edb282087458c1bc6dd26287c96a974662c3b`. Use that revision for current behavior. The planning files remain on the prototype branch at `28217cb8e3292910070617e79389fd167ded2367` with the local decisions preserved.

## Existing behavior

The [complete backup restore decision](https://github.com/Submoon/ttrpg-cluster-control/blob/dc5edb282087458c1bc6dd26287c96a974662c3b/docs/adr/0003-restore-complete-jump-cluster-backups.md) defines restoring a Jump Cluster as replacing the active map and establishes a fresh undo baseline. Importing a standalone star system remains a reviewed copy into the selected Cluster. Player documents and links are portable snapshots under the [publication boundary](../../../docs/adr/0002-player-publication-boundary.md).

- A standalone system file carries its internal positions, Orbits, and attached geometry. The current import gives the copy a new Cluster position. Complete backups retain the Cluster layout. Applied map layout is durable, and the editor camera and selection are transient.
- Current PNG and SVG exports frame the entire applied scene of the active map. The old two-map navigation determines whether that scene is the Cluster overview or a single system. Player images are rendered from the public document. The unified canvas needs an explicit scope because it no longer has that two-map navigation.
- Existing player JSON and links use the same player document decoder, with public system and anonymous route endpoints. They carry no route-to-Jump-Point association. Existing local coordinates and Cluster positions use different projections. A single common drawing scale applies to complete projected system geometry so circular Orbits and relative object positions are preserved.

## Resolution

Confirmed by the user across three rounds. The source issue was refreshed before closing this decision.

### Opening older maps and choosing an export scope

1. **Older editable maps.** Use each existing Cluster position as the system anchor. Preserve resolved relative object positions, Orbit dimensions and orientation through the common drawing scale, including content beyond the former system viewport. Preserve existing overlaps. The accepted cleanup of legacy same-system routes applies to editable maps.
2. **Older player shares.** Open existing player files and links on the unified map using only what the snapshot already publishes. Use the published system anchors for route ends without an explicit Jump Point association. A published Jump Point in the same system is insufficient to infer an association.
3. **Image scope.** Offer three explicit PNG and SVG scopes: entire Cluster, selected system, and current viewport. Frame the first two scopes automatically, including in-scope content outside the live viewport.

### Image detail and standalone imports

4. **Entire Cluster image.** Export an overview with system names, individual Jump Routes between system anchors, and any in-scope unresolved or published anonymous destinations. Frame the whole overview independently of the live camera. Use the selected-system or current-viewport scopes for internal map detail.
5. **Current viewport image.** Preserve the map framing, zoom, semantic detail, and filters of the live view. Render applied map data. Omit editor and reader chrome, including menus and panels, and omit unapplied placement or movement previews.
6. **Standalone system import.** Preview the incoming envelope and let the Warden choose the copy's anchor on the unified map. The new anchor places the complete imported system at the common scale and preserves its internal arrangement. The existing reviewed copy applies when the placement is confirmed.

### System image details and older player loops

7. **Selected-system image.** Automatically frame the selected system's envelope and all its permitted objects and Orbits, including distant objects. Include dashed segments of its incident routes leading away from that system. Keep the image focused on the selected system and its route segments. A distant neighboring system or destination does not determine the image bounds.
8. **Legacy public loops.** When loading an older player file or link, silently remove resolved routes connecting a published system to itself from the loaded player document. The unified view and image exports use the cleaned document. The original share remains an immutable input. Anonymous destinations are distinct from resolved same-system routes.

### Persistence and export handoff

- Applied anchors, local placements, Orbit geometry, and authored unresolved destinations persist in the editable workspace and complete Cluster backups. Envelopes are derived from the corresponding layout. Layout edits use the existing undo/redo path, with camera and selection as transient view state. A complete restore establishes the existing fresh undo baseline.
- A standalone system file carries its internal layout. Its anchor is chosen in the destination Cluster during reviewed placement. A complete Cluster backup retains its own system anchors and route data regardless of camera or image scope.
- Portable player documents carry the allowed geometry of the snapshot. The same disclosure boundary applies to all three image scopes in the player preview and reader.

## Blocked by

- [Place star systems on a stable shared canvas](01-shared-spatial-layout.md)
- [Define ownership and placement across system boundaries](02-system-ownership-and-placement.md)
- [Define shared geometry and disclosure in player views](06-player-geometry-and-disclosure.md)
