---
title: 25. Supporting elliptical Orbits and unoccupied centers
label: wayfinder:implement
type: implement
status: closed
assignee: Copilot
parent: "[Mothership Campaign App - V1 Specification](../map.md)"
---

# 25. Supporting elliptical Orbits and unoccupied centers

## What to build

As a Warden, I can represent every Orbit as an ellipse—including circular Orbits with equal radii—rotate it, and place objects around an unoccupied center, so that binary and other unusual systems can be charted. The map remains schematic; this does not add orbital physics or animation.

## Acceptance criteria

- Every Orbit uses horizontal and vertical radii; equal radii appear circular. Existing saved circular layouts restore as equal radii, and elliptical layout data remains importable.
- An Orbit's center does not require a visible catalogue object. A populated Orbit can have no host or use a non-rendering anchor, and can still contain multiple visible objects.
- An Orbit with no objects remains distinct from an Orbit that contains objects but has no visible center.
- Multiple stars can share an Orbit and appear along its path without requiring a star or other visible object at the center.
- Dragging Orbit from the Add Object palette onto a map object hosts it there; dropping onto empty map space creates an Orbit centered at the drop point. Activating the palette control adds an Orbit to the selected object or, when none is selected, to an unoccupied center.
- Selected Orbits expose right and top handles that resize one axis independently. Dragging another point on the ring scales both radii uniformly; resizing preserves child-object angles.
- A selected unoccupied Orbit exposes a draggable center handle that moves its center and contained objects together.
- The Selected inspector can detach a hosted Orbit to a nearby free center, after which the center handle can move it.
- A selected Orbit can be rotated by dragging its rotation handle or using Ctrl+mouse wheel over its ring. Rotation preserves child-object angles; Ctrl+mouse wheel elsewhere continues to zoom the map.
- Orbit dimensions, child-object placement, and any invisible-anchor state persist through workspace save/restore and round-trip through versioned JSON import/export.
- Orbit rotation is included in workspace persistence and versioned JSON round-trips.
- SVG and PNG exports show the ellipse and visible orbiting objects without rendering an invisible anchor.
- Orbit names are not displayed on the map or in SVG/PNG exports.
- Ellipse paths and their resize controls remain usable with map pan, zoom, and Fit controls; editing controls do not appear in image exports.
- Verification covers legacy circle and ellipse data, axis-specific and uniform resizing, hosted and unoccupied drag-and-drop, multiple stars around an empty center, persistence, JSON round-trips, and image exports.

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

## Resolution

Every Orbit is an ellipse, with equal radii forming a circle. Orbits can be dragged from Add Object onto a host or an unoccupied map location. A selected unoccupied Orbit has a center handle that moves its contained objects; the Selected inspector can detach a hosted Orbit to a nearby empty center while preserving its dimensions, rotation, and child angles and reindexing the remaining hosted Orbits. Selected Orbits also expose independent axis handles, uniform ring resizing, and rotation by handle or Ctrl+mouse wheel. Centers, radii, rotations, and child angles persist through workspace restore and versioned JSON round-trips. Orbit names are not rendered on maps or in SVG/PNG exports, and image exports omit edit controls and invisible anchors. The map-navigation test starts its uniform-resize drag away from the axis handles and verifies uniform resizing and persistence. Validation passed: `npm run typecheck`, `npm test` (30 passed), and `git diff --check`.
