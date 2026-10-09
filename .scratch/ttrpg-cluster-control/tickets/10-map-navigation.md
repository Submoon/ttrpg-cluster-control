---
title: 10. Navigating and arranging both map views
label: wayfinder:implement
type: implement
status: closed
assignee: Copilot
triage_labels:
  - enhancement
  - ready-for-agent
parent: "[TTRPG Cluster Control - V1 Specification](../map.md)"
---

# 10. Navigating and arranging both map views

## What to build

As a Warden, I can arrange systems and map objects by hand, inspect dense or broad maps, and resize Orbits without changing the objects' relative angles. Both map views provide accessible controls as well as gesture-based navigation.

## Acceptance criteria

- Jump Cluster and system maps support independently dragging system nodes and map objects; dragging empty background pans the map.
- Wheel, trackpad, and pinch zoom is centered on the pointer, and visible zoom-in, zoom-out, and fit controls work in both map views.
- Zoom is limited to 25–1600%, with unbounded panning; the visible controls provide an alternative to gesture-based zoom.
- Resizing an Orbit moves its objects along the ring while preserving stored angles; the minimum radius leaves clearance around its host and there is no fixed maximum.
- Map elements are keyboard-focusable and have accessible names.

## Blocked by

- [06. Building a star-system map with nested Orbits](06-star-system-map.md)
- [07. Adopting Tailwind CSS for the Nuxt interface](07-tailwind-css.md)
- [08. Connecting Jump Points across a Jump Cluster](08-jump-cluster-routes.md)

## Source specs

- [TTRPG Cluster Control - V1 Specification](../spec.md)
- [03. Prototyping the Jump Cluster and system-map editor](03-map-editor-prototype.md)
- [04. Choosing the V1 application and rendering architecture](04-application-architecture.md)

## Resolution

Both D3/SVG map views support pan, pointer-centered zoom, fit controls, and manual arrangement with persisted layout. Orbit resizing preserves object angles, has host-clearance minimums and no fixed maximum; zoom and pan remain temporary. Accessible controls are keyboard operable.
