---
title: 13. Importing JSON as a safe independent copy
label: wayfinder:implement
type: implement
status: closed
assignee: Copilot
triage_labels:
  - enhancement
  - ready-for-agent
parent: "[TTRPG Cluster Control - V1 Specification](../map.md)"
---

# 13. Importing JSON as a safe independent copy

## What to build

As a Warden, I can preview a cluster or standalone-system JSON file and import it as an independent copy only after confirmation, without merging with or replacing existing campaign work.

## Acceptance criteria

- The app validates an import and shows a preview before writing, including incoming entity counts and original-ID collisions with possible matching entities.
- Matching names or location keys alone do not imply identity or cause an import to merge entities.
- After explicit confirmation, import creates an independent copy with new IDs and remaps internal references and ID-keyed layout entries.
- Cluster route endpoints that refer to included Jump Points use their new IDs; unresolved external exits remain unresolved. Standalone-system imports contain no cluster routes.
- The import carries custom-field definitions used by imported objects and their values; missing definitions are created with new IDs and the values are remapped to them.
- Canceling the import or failing validation leaves the existing workspace unchanged.

## Blocked by

- [12. Exporting clusters and systems as versioned JSON](12-json-export.md)

## Source specs

- [TTRPG Cluster Control - V1 Specification](../spec.md)
- [02. Defining safe JSON import behavior](02-safe-import-behavior.md)
- [01. Defining the V1 map data model and object catalogue](01-map-data-model.md)
- [04. Choosing the V1 application and rendering architecture](04-application-architecture.md)

## Resolution

- Added validated, confirmed JSON imports for Jump Clusters and standalone systems as independent copies, remapping entity IDs, internal references, layout entries, and custom-field values without merging existing work.
- Validation passed: `npm run typecheck`, `npm test` (8 browser acceptance tests), and `npm run build`.
