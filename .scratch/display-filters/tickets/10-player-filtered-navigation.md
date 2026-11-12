---
title: Resolve filtered navigation and framing in player consultation
status: closed
label: wayfinder:grilling
type: grilling
parent: ../map.md
assignee: Codex
---

# Resolve filtered navigation and framing in player consultation

## Question

How do player filters affect the map, Hierarchy, Inspect, search, and Fit in both the reader and preview? Decide how to handle a published search result or current selection that does not match the filters, and a matching object whose public Orbit host does not match. Settle which published relationship context remains visible and whether a filtered view can be exported as a separate image action. Keep the complete published document and existing share actions governed by the publication policy.

The [shared player document view](../../../components/PlayerDocumentView.vue) already owns selection, public search activation and deferred map reveal. Use a search result in another system, a compact panel covering the map and a changed document during deferred reveal as acceptance scenarios.

## Current behavior

- The [public projection](../../../domain/player-projection.ts#L244) retains the required public Orbit ancestry, including neutral Unknown presences for otherwise private hosts. The [system map](../../../components/PlayerSystemMap.vue#L86) and [Hierarchy](../../../utils/player-system-hierarchy.ts#L21) use that detached graph for object and Orbit navigation.
- [Activating an object result](../../../components/PlayerDocumentView.vue#L546) enters its published system if needed and uses the ordinary Inspect selection path. The [deferred reveal](../../../components/PlayerDocumentView.vue#L704) checks the current document, system, map and selection. It waits while the compact panel covers the map. [Map reveal](../../../components/PlayerSystemMap.vue#L291) pans as needed to show the selected anchor at the destination's current zoom. [Fit](../../../components/PlayerSystemMap.vue#L210) uses the entire public system scene.
- Both views [prepare images](../../../components/PlayerDocumentView.vue#L599) from the complete active public map. The [public image exporter](../../../utils/player-map-image-export.ts#L95) renders its published geometry for SVG and PNG independently of the live map viewport.

## Blocked by

- [Choose player filter capabilities and ownership](04-player-filter-contract.md)

## Resolution

Confirmed on 2026-11-06 for both the player reader and the Warden's player preview.

- A published object outside the active criteria remains visible at reduced opacity, with its selection treatment also dimmed. It stays selectable by pointer, touch and keyboard on the map and through the full public Hierarchy. Identify dimmed entries accessibly in Hierarchy and keep their published information available in Inspect.
- Published Orbit rings keep their usual opacity and remain selectable. The published host and occupant relationships remain available, including an Unknown presence retained as a public host.
- Public text Search retains its existing result set and ranking under map filters. Activating an object result opens its published system as needed, uses the existing Inspect flow and pans as needed to reveal the selected anchor at the destination's current zoom. **Fit** continues to frame the complete published system, including dimmed objects and Orbit rings.
- After a successful Search reveal, a dimmed target receives a locator. In compact mode, wait until the map is visible and the reveal can complete. The locator retains the object's dimming and clears on the first deliberate map interaction. A changed document, system or selection invalidates a pending reveal or locator for the old target.
- Existing SVG and PNG actions export the complete active published map at its usual opacity. The published document and shared links use the existing publication policy. Player view filters remain session-local settings.
