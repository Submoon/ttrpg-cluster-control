---
title: Define Jump Route geometry across zoom levels
status: closed
label: wayfinder:grilling
type: grilling
mode: HITL
parent: ../map.md
assignee: Codex
---

# Define Jump Route geometry across zoom levels

## Question

How should Jump Routes connect systems and show optional Jump Point locations as semantic detail appears?

Choose the visible attachment points, route path and selection affordances across zoom levels. Cover multiple Jump Points in one system, unresolved exits, crowded neighboring systems and endpoints that are outside the viewport or below the current detail level.

## Existing facts

The current Cluster map draws resolved routes between its system cards. Its route geometry offsets the curve ends from system positions, and routes between two Jump Points in the same system use an arc above the card. It draws unresolved exits at their saved position when available and otherwise computes a default. The [prototype](03-semantic-zoom-prototype.md) instead draws a temporary straight line between the projected Jump Points. The existing source format references Jump Points directly and derives their owning systems. This is the baseline before the model decision below.

- The [existing route projection](../../../utils/cluster-map-geometry.ts) bends curves by route index. This can leave routes sharing projected endpoints on top of each other. Existing route selection identifies an individual route and opens its Inspector. Fit already accounts for unresolved exit positions and labels.
- A placed unresolved exit stays at its own map position when the origin system moves. An exit without a saved placement uses a default relative to the origin. On the current [player publication boundary](../../../docs/adr/0002-player-publication-boundary.md), a shared route discloses permitted system endpoints or a generic unknown destination. It does not currently publish the identity of the associated Jump Points. The Warden drawing decision does not itself change that boundary.

On 2026-11-16, the source issue and the dependent inter-system object issue were refreshed. The source is open and its scope is unchanged. After fetching origin and fast-forwarding local `main` by two commits, `main` and `origin/main` matched `dc5edb282087458c1bc6dd26287c96a974662c3b`. Use that revision for current application behavior. Planning remains on the prototype branch at `28217cb8e3292910070617e79389fd167ded2367` with the local planning edits preserved.

The user has requested [inter-system objects and ships on Jump Routes](https://github.com/Submoon/ttrpg-cluster-control/issues/60) as a dependent effort. Record any assumptions relevant to that follow-up while deciding the route representation for [the unified map](../map.md).

## Resolution

Confirmed by the user across the discussion rounds. The source issue was refreshed before closing this decision.

### Overview geometry

1. **Overview endpoints.** A resolved Jump Route connects the system anchors when both systems are shown at overview detail. The system anchors and any associated Jump Points keep their map positions as the route changes its displayed attachments.
2. **Unresolved destinations.** An unresolved exit keeps its placed schematic position and a distinct unresolved-destination marker at every detail level. The existing distinction between a placed exit and a default position still applies.

### Mixed detail and separate paths

3. **Mixed detail.** Choose each known endpoint independently. Use the system's anchor in overview and its optional Jump Point's projected position when the system's detail is shown. An unresolved exit keeps its own position, with only the origin following this rule.
4. **Distinct systems.** A resolved Jump Route connects two different star systems. The current validation accepts two distinct Jump Points within one system. The new contract replaces that rule.
5. **Separate paths.** Draw multiple Jump Routes between the same systems as distinct selectable paths, including at overview detail when they share the same anchor positions.

### Legacy routes and attachment transitions

6. **Legacy same-system routes.** When opening or importing an older editable map, automatically drop every resolved route whose two Jump Points belong to the same system. Do this silently, without a user warning, and retain the Jump Points and any linked Stations. Discard metadata that belongs only to the removed routes. New routes and endpoint edits must use distinct systems. This is the final rule for older same-system routes.
7. **Attachment transition.** Use a short visual transition when a route end changes between a system anchor and its detailed attachment. Keep route selection and the Inspector session across the transition.

### Endpoint model

8. **System connection.** A route refers directly to its origin system and to a different destination system or an unresolved destination. The Warden can change either known system directly in the Inspector. Each known end can optionally specify one Jump Point in that system. When no Jump Point is assigned, draw that end at its system anchor even in detail view.
9. **Jump Points and Stations.** A Jump Point provides the local attachment position. It can exist on its own or reference a physical Station in the same system. The Station link remains separate from the route's choice of Jump Point. See the [domain context](../../../CONTEXT.md).

### Attachment changes and compatibility

10. **Transfer or deletion of a Jump Point.** Keep each affected route and its system endpoints. The transfer preview or deletion review lists the affected routes and the attachments that will be cleared. Applying the operation clears those references and redraws the affected ends at their system anchors. An ordinary reposition within the same system keeps the attachment. A Station link is reviewed separately under the [ownership and placement decision](02-system-ownership-and-placement.md).
11. **Change endpoint system.** When the Warden chooses a different system for a route end, clear the previous system's Jump Point from that end of the draft. The Warden may choose a Jump Point in the new system or apply with its anchor. The unchanged end keeps its own attachment.
12. **Existing routes.** For retained routes, derive the systems from the existing Jump Points and keep those references as optional attachments. Preserve the route identity and unresolved exit information. Apply the silent same-system cleanup during migration. The [compatibility and export decision](07-compatibility-and-exports.md) will cover the storage and import details.

### Labels and interaction

13. **Labels.** At distant zoom, show the jump level where labels fit. Prioritize the selected route's label when labels would overlap. Keep the individual paths distinct and show full names in Inspect.
14. **Selection and framing.** The visible portion of a route remains selectable when one or both endpoints are outside the viewport. Ordinary selection keeps the current camera. Center frames the entire route in the usable area and may zoom out to include both ends. Existing Inspector draft guards apply when selecting a different route.

### Handoff

Route identity and system endpoints persist through zoom. Path separation and the transition between displayed attachments are map presentation. The [transit follow-up](https://github.com/Submoon/ttrpg-cluster-control/issues/60) can use the route identity and needs its own placement rule for ships. The [player disclosure decision](06-player-geometry-and-disclosure.md) determines which endpoint information can appear in a published view.

## Blocked by

- [Place star systems on a stable shared canvas](01-shared-spatial-layout.md)
- [Prototype stable geometry and semantic detail](03-semantic-zoom-prototype.md)
