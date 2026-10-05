---
title: 23. Supporting Jump levels and destinations
label: wayfinder:implement
type: implement
status: open
parent: "[Mothership Campaign App - V1 Specification](../map.md)"
---

# 23. Supporting Jump levels and destinations

## What to build

As a Warden, I can identify each Jump Route by its Jump level and destination, rather than only by a sequential number.

## Acceptance criteria

- A Jump Route records a required Jump level. Standard levels 1 through 9 are supported, and custom positive integer levels above 9 are accepted.
- For known routes, the destination system is visible when viewing and editing the route.
- An unresolved exit can still have a Jump level and remains clearly identified as an unknown destination without creating a placeholder system or Jump Point.
- Route labels and details emphasize the Jump level and destination instead of relying on generated names such as `Jump-01`.
- Existing routes and their endpoint references remain intact when level and destination details are added; workspace persistence and JSON import/export preserve the new level.
- Verification covers standard and custom levels, known destinations, unresolved exits, and existing saved routes.

## Blocked by

- None.

## Source specs

- [Mothership Campaign App - V1 Specification](../map.md)
- [01. Defining the V1 map data model and object catalogue](01-map-data-model.md)
- [08. Connecting Jump Points across a Jump Cluster](08-jump-cluster-routes.md)
- [12. Exporting clusters and systems as versioned JSON](12-json-export.md)
- [13. Importing JSON as a safe independent copy](13-json-import.md)
