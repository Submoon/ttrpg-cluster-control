---
title: 25. Supporting elliptical and centerless Orbits
label: wayfinder:implement
type: implement
status: open
parent: "[Mothership Campaign App - V1 Specification](../map.md)"
---

# 25. Supporting elliptical and centerless Orbits

## What to build

As a Warden, I can represent elliptical Orbits and objects revolving around an unoccupied or invisible center, so that binary and other unusual systems can be charted. The map remains schematic; this does not add orbital physics or animation.

## Acceptance criteria

- Any Orbit can use the existing circular shape or an elliptical shape with independently adjustable horizontal and vertical radii. Existing circular Orbits and layouts remain unchanged.
- An Orbit's center does not require a visible catalogue object. A populated Orbit can have no host or use a non-rendering anchor, and can still contain multiple visible objects.
- An Orbit with no objects remains distinct from an Orbit that contains objects but has no visible center.
- Multiple stars can share an Orbit and appear along its path without requiring a star or other visible object at the center.
- Orbit shape, dimensions, child-object placement, and any invisible-anchor state persist through workspace save/restore and round-trip through versioned JSON import/export.
- SVG and PNG exports show the ellipse and visible orbiting objects without rendering an invisible anchor.
- Resizing an Orbit preserves its child objects' relative positions; ellipse paths remain usable with map pan, zoom, and Fit controls.
- Verification covers existing circular Orbits, editing and resizing an ellipse, multiple stars around an empty/invisible center, persistence, JSON round-trips, and image exports.

## Blocked by

- None.

## Source specs

- [Mothership Campaign App - V1 Specification](../spec.md)
- [01. Defining the V1 map data model and object catalogue](01-map-data-model.md)
- [06. Building a star-system map with nested Orbits](06-star-system-map.md)
- [10. Navigating and arranging both map views](10-map-navigation.md)
- [12. Exporting clusters and systems as versioned JSON](12-json-export.md)
- [13. Importing JSON as a safe independent copy](13-json-import.md)
- [14. Exporting complete maps as PNG and SVG](14-image-export.md)
