---
title: 28. Showing the dragged map object in the drag preview
label: wayfinder:implement
type: implement
status: open
parent: "[Mothership Campaign App - V1 Specification](../map.md)"
---

# 28. Showing the dragged map object in the drag preview

## What to build

As a Warden, I see the map object I am placing under the pointer while dragging from Add Object, rather than the palette button.

## Acceptance criteria

- Dragging any catalogue object from the Add Object palette shows a preview matching that object's map mark, not the palette button.
- The preview remains visible near the pointer without obscuring the intended drop location.
- Dropping on the system map or an Orbit keeps the existing placement behavior; canceling a drag does not create or alter an object.
- The existing click and keyboard activation paths for adding objects remain available and unchanged.
- Browser verification covers representative catalogue marks, map-level and Orbit drops, and the drag preview during the gesture.

## Blocked by

- None.

## Source specs

- [Mothership Campaign App - V1 Specification](../map.md)
- [06. Building a star-system map with nested Orbits](06-star-system-map.md)
- [10. Navigating and arranging both map views](10-map-navigation.md)
- [16. Making the workspace darker and more map-first](16-map-first-visual-refresh.md)
- [24. Improving text readability in Add Object and Map Files](24-map-actions-typography.md)
- [25. Supporting elliptical Orbits and unoccupied centers](25-special-orbits.md)
