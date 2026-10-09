---
title: 17. Moving map import and export actions into the header
label: wayfinder:implement
type: implement
status: closed
assignee: Copilot
parent: "[TTRPG Cluster Control - V1 Specification](../map.md)"
---

# 17. Moving map import and export actions into the header

## What to build

As a Warden, I can find map import and export actions in the application header, so that file operations are easy to locate and do not take space above the map.

## Acceptance criteria

- Import and export actions are available from the header in both Jump Cluster and star-system views.
- Each action clearly communicates whether it applies to the active cluster or system and retains its existing format and safe-import behavior.
- The map-editing toolbar no longer duplicates the same import and export actions.
- Header actions remain keyboard accessible and usable at narrow viewport widths.

## Blocked by

- None.

## Resolution

Moved Jump Cluster and star-system JSON/image exports and JSON import into the responsive application header, with export actions scoped to the active map and duplicate map-toolbar actions removed. The existing import flow still validates, previews, confirms, and adds JSON as an independent copy to the current Jump Cluster. The header disclosure is keyboard accessible and closes on Escape with focus restored.

- Validation passed: `npm run typecheck` and `npm test` (22 browser tests).

## Source specs

- [TTRPG Cluster Control - V1 Specification](../map.md)
- [12. Exporting clusters and systems as versioned JSON](12-json-export.md)
- [13. Importing JSON as a safe independent copy](13-json-import.md)
- [14. Exporting complete maps as PNG and SVG](14-image-export.md)
