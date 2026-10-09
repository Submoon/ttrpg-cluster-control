---
title: 22. Expanding the system-map grid and layout bounds
label: wayfinder:implement
type: implement
status: closed
assignee: Copilot
parent: "[TTRPG Cluster Control - V1 Specification](../map.md)"
---

# 22. Expanding the system-map grid and layout bounds

## What to build

As a Warden, I can lay out a system across a much larger grid, so that adding several Orbits and map objects does not quickly hit the current placement limits.

## Acceptance criteria

- System maps support a substantially larger usable layout than the current bounds, allowing Orbits and objects to extend well beyond the existing limits without being clamped.
- The grid and background cover the expanded layout, and pan, zoom, and Fit keep the full map inspectable.
- PNG and SVG exports include the expanded grid and map content without clipping.
- Existing saved layouts keep their positions and remain editable.
- Verification covers placing and moving Orbits and objects beyond the current map bounds.

## Blocked by

- None.

## Source specs

- [TTRPG Cluster Control - V1 Specification](../map.md)
- [06. Building a star-system map with nested Orbits](06-star-system-map.md)
- [10. Navigating and arranging both map views](10-map-navigation.md)
- [14. Exporting complete maps as PNG and SVG](14-image-export.md)

## Resolution

System-level placements accept any finite coordinates, and the system-map background and grid expand to cover objects and Orbits. Existing coordinates retain their mapping; Fit and image exports include expanded content. Jump Cluster system positions remain bounded.

- Validation passed: `npm run typecheck`, `npm test` (26 tests), and `npm run build`.
