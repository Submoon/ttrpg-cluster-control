---
title: 06. Building a star-system map with nested Orbits
label: wayfinder:implement
type: implement
status: closed
assignee: Copilot
triage_labels:
  - enhancement
  - ready-for-agent
parent: "[Mothership Campaign App - V1 Specification](../map.md)"
---

# 06. Building a star-system map with nested Orbits

## What to build

As a Warden, I can build a schematic star-system map with multiple stars, keyed locations, and nested orbital structure. I can place catalogue objects directly in the system or in an Orbit, navigate the hierarchy, and edit each object's key, name, and description without losing its context.

## Acceptance criteria

- A system can contain multiple stars and objects from every V1 catalogue family and subtype: celestial bodies, small bodies/fields, installations, vessels, Jump Points, phenomena, and a freely named "other" type.
- Each catalogue object has a stable identity, family or subtype, required user-editable location key unique within its star system, name, and description.
- Any catalogue object can be placed directly in the system or in an Orbit. A system-level object receives an editable initial schematic X/Y position.
- Any catalogue object can host Orbits. Orbits are unkeyed, can be empty or contain multiple objects, can be nested, and can be reordered under their host.
- The map-first canvas, hierarchical object/Orbit navigator, and inspector stay synchronized as the Warden navigates and edits an object.

## Blocked by

- [05. Creating and restoring a local campaign workspace](05-local-campaign-workspace.md)

## Source specs

- [Mothership Campaign App - V1 Specification](../spec.md)
- [01. Defining the V1 map data model and object catalogue](01-map-data-model.md)
- [03. Prototyping the Jump Cluster and system-map editor](03-map-editor-prototype.md)
- [04. Choosing the V1 application and rendering architecture](04-application-architecture.md)

## Resolution

- Implemented the client-only D3/SVG system editor with all 15 catalogue subtypes, editable unique location keys, and freely named `Other` types. Map objects support system-level placement with editable schematic X/Y coordinates or placement in nested, empty, multi-object, and reorderable Orbits. Canvas, hierarchy, and inspector selections and edits stay synchronized and persist through the local workspace.
- Validation passed: `npm run typecheck`, `npm test`, and `npm run build`.
