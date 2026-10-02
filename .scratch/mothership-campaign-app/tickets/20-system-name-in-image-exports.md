---
title: 20. Including the system name in system-map image exports
label: wayfinder:implement
type: implement
status: open
parent: "[Mothership Campaign App - V1 Specification](../map.md)"
---

# 20. Including the system name in system-map image exports

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
