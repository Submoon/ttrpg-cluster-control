---
title: 12. Exporting clusters and systems as versioned JSON
label: wayfinder:implement
type: implement
status: closed
assignee: Copilot
triage_labels:
  - enhancement
  - ready-for-agent
parent: "[Mothership Campaign App - V1 Specification](../map.md)"
---

# 12. Exporting clusters and systems as versioned JSON

## What to build

As a Warden, I can export a complete Jump Cluster or a standalone star system as portable, versioned JSON without losing map layout or custom-field data.

## Acceptance criteria

- A Jump Cluster export includes its systems, Jump Routes, system-node positions, and a versioned layout section.
- A standalone system export includes its local content and Jump Points but no Jump Cluster routes.
- Layout data preserves custom Orbit radii and orbital-object angles; cluster layout also preserves system-node positions.
- Exports include the custom-field definitions used by their objects and the corresponding values.
- Neither export includes selection or current zoom/pan state.

## Blocked by

- [08. Connecting Jump Points across a Jump Cluster](08-jump-cluster-routes.md)
- [09. Adding native and reusable custom fields](09-object-fields.md)
- [10. Navigating and arranging both map views](10-map-navigation.md)

## Source specs

- [Mothership Campaign App - V1 Specification](../spec.md)
- [01. Defining the V1 map data model and object catalogue](01-map-data-model.md)
- [04. Choosing the V1 application and rendering architecture](04-application-architecture.md)

## Resolution

- Added versioned JSON exports for Jump Clusters and standalone systems. Cluster exports include routes and system-node positions; standalone exports include only local system content and orbital layout. Both preserve field settings and object layout while excluding temporary view state.
- Validation passed: `npm run typecheck`, `npm test` (6 browser acceptance tests), and `npm run build`.
