---
title: 21. Including the system name in system-map image exports
label: wayfinder:implement
type: implement
status: closed
assignee: Copilot
parent: "[Mothership Campaign App - V1 Specification](../map.md)"
---

# 21. Including the system name in system-map image exports

## What to build

As a Warden, I can identify a system-map PNG or SVG by its system name, even when the exported image is separated from the application.

## Acceptance criteria

- System-map PNG and SVG exports display the current system name in the upper-left corner.
- The title has clear spacing and contrast, stays within the exported image bounds, and does not overlap map content.
- Adding the title preserves the complete map scene regardless of the current pan or zoom.
- Renaming the system updates the title in subsequent exports.
- Jump Cluster exports and the in-app map layout remain unchanged.

## Blocked by

- None.

## Source specs

- [Mothership Campaign App - V1 Specification](../map.md)
- [14. Exporting complete maps as PNG and SVG](14-image-export.md)

## Resolution

Star-system PNG and SVG exports now include the current system name in a reserved title band above the map scene. The title uses the map text color, and the export bounds expand to fit names up to the existing 80-character limit. PNG still rasterizes the same titled SVG scene. The in-app map and Jump Cluster exports remain unchanged; browser acceptance coverage verifies title placement, contrast, bounds, and updates after renaming.
