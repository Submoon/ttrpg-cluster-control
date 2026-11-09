---
title: Decide how Warden filters affect dependent geometry
status: closed
label: wayfinder:grilling
type: grilling
parent: ../map.md
assignee: Codex
---

# Decide how Warden filters affect dependent geometry

## Question

What stays at normal opacity and what stays actionable when a Warden filter dims a host, its occupant or the current selection? Use a dimmed star with a matching planet and nested moon, then invert the matches. Decide what happens to Orbit rings, hit targets, focus, and placement targets, including when the Warden selects a dimmed object from Hierarchy. Define what ordinary Fit and the Warden's SVG/PNG export should frame when the display is filtered, against the existing complete-image contract in the [editor specification](../../ttrpg-cluster-control/spec.md).

## Current behavior

- The system renderer uses separate [painted rings and Orbit hit targets](../../../components/maps/system-map-renderer.ts#L712). Object inspection uses [click and keyboard activation](../../../components/maps/system-map-renderer.ts#L1225), while [placement resolves candidates and occupied space from geometry](../../../utils/system-map-geometry.ts#L553). Opacity and interaction eligibility are separate decisions.
- [Hierarchy selection](../../../components/MapHierarchy.vue#L416) uses guarded navigation. [Ordinary Fit](../../../components/SystemMap.vue#L491) measures the rendered bounds of all objects and Orbits in the system. [Search framing](../../../components/SystemMap.vue#L565) measures the selected object's hosted branch.
- The Warden's [SVG and PNG export](../../../utils/map-image-export.ts#L167) clones the rendered scene, removes interaction and viewport state, and captures computed styles. The [player export](../../../docs/adr/0002-player-publication-boundary.md) uses its own published scene.

## Blocked by

- [Choose Warden filter targets and surfaces](01-warden-filter-scope.md)

## Resolution

Confirmed on 2026-11-06.

- Every Orbit ring uses its normal opacity. This applies to hosted, nested, and unoccupied Orbits regardless of which hosts or occupants match the filters.
- Dimmed objects retain the same map interactions and eligibility as other objects. Existing Inspect, keyboard and touch activation, Move, Add and placement rules continue to apply, including hit testing and occupied-space checks. Dimming changes presentation independently of geometry.
- Ordinary selection retains dimming on both the object and its selection treatment. This applies when selection comes from Hierarchy or the map and when changing a filter dims the current selection. [Resolve Warden search activation under filters](07-warden-search-reveal.md) covers any search-specific emphasis.
- Ordinary Fit frames the entire star-system map, including dimmed objects and all Orbit rings. The same rule applies when every object is dimmed.
- Warden SVG and PNG exports render the complete system map with its standard opacity and committed geometry. The editor retains its active filters and dimmed presentation during export.
