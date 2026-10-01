---
title: 09. Adding native and reusable custom fields
label: wayfinder:implement
type: implement
status: closed
assignee: Copilot
triage_labels:
  - enhancement
  - ready-for-agent
parent: "[Mothership Campaign App - V1 Specification](../map.md)"
---

# 09. Adding native and reusable custom fields

## What to build

As a Warden, I can record common Mothership details on applicable map objects and define reusable campaign-specific fields, so object details remain useful without changing the map structure.

## Acceptance criteria

- Planets and moons can have an optional atmosphere field; applicable installations can have an optional port-class field.
- Both native single-select fields use option lists the Warden can edit.
- The Warden can define custom fields reusable across clusters and systems, with text, number, boolean, or single-select values; single-select options are user-editable.
- Custom-field values are optional per catalogue object, and Orbit structures do not receive object fields.

## Blocked by

- [06. Building a star-system map with nested Orbits](06-star-system-map.md)
- [07. Adopting Tailwind CSS for the Nuxt interface](07-tailwind-css.md)

## Source specs

- [Mothership Campaign App - V1 Specification](../spec.md)
- [01. Defining the V1 map data model and object catalogue](01-map-data-model.md)

## Resolution

- Added workspace-wide, editable Atmosphere and Port class option lists, with optional values on planets/moons and Installation objects.
- Added reusable custom-field definitions with optional per-object text, number, boolean, and single-select values; single-select options are editable. Orbits remain unfielded.
- Existing local workspaces without field settings restore with defaults. Removing an assigned option is rejected; deleting a custom field requires confirmation and clears its values.
- Validation passed: `npm run typecheck`, `npm test` (3 browser acceptance tests), and `npm run build`.
