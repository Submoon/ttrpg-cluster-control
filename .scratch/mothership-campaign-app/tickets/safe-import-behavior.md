---
title: Defining safe JSON import behavior
label: wayfinder:grilling
type: grilling
status: closed
assignee: Copilot
parent: "[Mothership Campaign App - V1 Specification](../map.md)"
---

## Question

When importing a cluster or standalone system into an existing local workspace, how should V1 handle collisions with existing entities? Decide whether the default is to create a copy, merge, or replace, what preview/confirmation the user sees, and how route references are handled. Imports must not silently overwrite existing work.

## Blocked by

- [Defining the V1 map data model and object catalogue](map-data-model.md)

## Resolution

V1 imports a cluster or standalone system as an independent copy; it never merges with or replaces an existing entity.

Before writing anything, validate the JSON and show a preview of the artifact, incoming entity counts, and any incoming entity whose original ID already exists in the workspace, alongside the matching entity as a possible duplicate. Explain that import creates a separate copy with new IDs and require explicit confirmation. Canceling or failing validation leaves the workspace unchanged. Matching names or keys alone do not imply identity or trigger merging.

Generate new IDs for all imported entities and remap internal references through an old-to-new ID map. For cluster imports, route endpoints that reference included Jump Points must point to their new IDs; unresolved external exits remain unresolved. Standalone-system imports contain no cluster routes.

Existing workspace entities are never modified or overwritten by import.
