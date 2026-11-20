---
title: Define shared geometry and disclosure in player views
status: closed
label: wayfinder:grilling
type: grilling
mode: HITL
parent: ../map.md
assignee: Codex
---

# Define shared geometry and disclosure in player views

## Question

How can the player preview and reader use the selected continuous navigation and spatial layout using only their published document?

Determine the geometry and detail available for Hidden, Unknown, Known-type and Revealed systems and objects. Decide what a system boundary or frame may reveal when some of its contents are private, and what happens to route endpoints and retained Orbit host chains at each detail level.

Clarify which shared spatial metadata is public and sufficient for stable placement. Account for player selection, framing and a document replacement whose public identifiers are snapshot-local.

## Existing facts

[Player projection](../../../domain/player-projection.ts) resolves coordinates before disclosure filtering. It supplies retained object and Orbit geometry for Revealed systems, while shared routes may expose a generic unknown destination. The [publication boundary](../../../docs/adr/0002-player-publication-boundary.md) governs all public inputs and derived presentation.

All three surfaces are explicitly in scope in [the source map](../map.md).

The [Jump Route decision](05-jump-route-representation.md) defines routes between systems, with optional Jump Point attachments. It specifies Warden geometry. This ticket decides which endpoint geometry a published view can use at each level of detail.

On 2026-11-16, the source issue was refreshed and remained open with no new comments. After fetching, `main` and `origin/main` matched `dc5edb282087458c1bc6dd26287c96a974662c3b`. Use that revision for current player behavior. The planning files remain on the prototype branch at `28217cb8e3292910070617e79389fd167ded2367` with the local decisions preserved.

## Resolution

Confirmed in two discussion rounds. The source issue was refreshed before closing this decision.

The preview and reader operate on a detached player document. The existing disclosure contract omits Hidden systems, gives Unknown presence and Known type generic marks, and allows Revealed systems to publish permitted interior geometry. Object coordinates and required Orbit geometry are resolved against the committed source before filtering so published locations retain their positions. A required Hidden host can appear as an Unknown presence, while unrelated hidden branches and private totals stay out of the document.

In the current projection, Unknown presence preserves public position with a neutral label, Known type adds the permitted classification, and Revealed permits the name and allowlisted content. This applies to Jump Points inside a Revealed system as well. A Station relationship appears only when both objects are Revealed. The preview and reader share the same player document view, and replacing the reader's document resets navigation and selection even if its snapshot-local IDs match the previous ones.

### Public geometry and route endpoints

1. **Published envelope and reveal threshold.** Compute a player's system envelope and its semantic reveal threshold using the public system anchor, published objects, and retained Orbit geometry from the player document. A private station that lies far from the published content has no effect on the envelope or threshold. Published entities keep their resolved coordinates. The Warden and player envelopes can therefore differ.
2. **Public route attachments.** At overview detail, draw a shared route to the available published system anchors or anonymous destination. In a detailed system, its end may attach to the route's actual Jump Point only when that point independently appears as Revealed in the same player document. Otherwise use the anchor. Publish only the eligible association using the snapshot's public identity. A shared route does not promote a Jump Point or Station. Keep the existing generic unknown destination at the committed position of an unresolved exit or Hidden system anchor where the route publication rules already allow it.

### System markers and consultation

3. **Systems with no published interior.** Unknown presence and Known type systems keep their respective generic markers at their published anchors at every zoom level. A Revealed system with no published contents has a named minimum envelope at its public anchor. The two cases disclose no private system extent or totals.
4. **Selection and camera.** A player can select a published system marker, including a generic one, and inspect the permitted information. Ordinary selection leaves the camera in place. Center frames the selected public geometry: the anchor marker for a generic system, the public envelope for a Revealed system, or the selected object, Orbit, or route as appropriate. Fit frames the whole published map. Initial framing, reveal thresholds, selection, and subsequent camera actions use only geometry from the player document. Identical permitted geometry yields identical framing even if private extents differ.
5. **Inspect a shared route.** The visible route can be selected in the preview or reader. Inspect shows its jump level and published endpoints. The anonymous endpoint stays labeled Unknown destination. Center frames the full public path in the usable view, including any published anonymous endpoint.

### Shared view behavior and handoff

The preview and reader use the same read-only interaction rules. As on the Warden map, semantic collapse can hide a selected mark while its published information remains selected for inspection. Preserve the existing reset when a different document replaces the current one. Matching public IDs in separate documents do not carry selection or pending camera actions across that replacement.

The eligible association in rule 2 extends the existing public route projection. It must refer to a Revealed Jump Point in the correct published system in the same snapshot, using that point's published geometry. The [compatibility and export decision](07-compatibility-and-exports.md) covers how earlier player documents acquire the unified presentation and how public geometry is used in exports.

## Blocked by

- [Place star systems on a stable shared canvas](01-shared-spatial-layout.md)
- [Prototype stable geometry and semantic detail](03-semantic-zoom-prototype.md)
- [Define Jump Route geometry across zoom levels](05-jump-route-representation.md)
