---
title: Mothership Campaign App - V1 Specification
label: wayfinder:map
status: open
---

## Destination

An implementation-ready functional and technical definition for a single-user, local-first browser V1 that lets the Warden manually create and edit schematic Jump Clusters and orbital system maps. It includes browser autosave, JSON import/export for complete clusters and standalone systems, and PNG/SVG image export; it leaves room for later campaign modules and Obsidian compatibility without implementing them.

## Notes

- Domain: Mothership campaign management. Relevant source context: the v1.2 Warden's Operations Manual and Player's Survival Guide.
- Confirmed baseline: no account; manual map construction, not procedural generation; schematic maps, not astronomical scale.
- A Jump Cluster contains star systems and Jump Routes. Routes connect logical Jump Points and may have an unresolved exit to another cluster. A physical Jump Station is optional.
- A standalone system export contains its local objects and Jump Points, not cluster routes. Systems support multiple stars and nested orbits around stars or planets.
- The V1 object catalogue includes celestial bodies, stations/bases/colonies, vessels/derelicts, Jump Points, anomalies/nebulae/hazards, and a freely named "other" type.
- The existing Obsidian notes use Markdown wikilinks and `.canvas` maps; V1 uses app-native JSON, with direct Obsidian compatibility deferred.
- V1 map views must support zoom; the controls and limits remain to be specified.
- V1 map editing must support deleting map elements and resizing Orbits by adjusting their displayed radius. Behavior for deleting entities with dependents/references and the limits or positioning effects of resizing remain to be specified.
- The repository currently has no application code or technology constraints beyond its README.
- Use `grilling` and `domain-modeling` for human decisions; use `prototype` for visual/interaction questions.
- Warden's Operations Manual pp. 44-45 describes the Jump Cluster map as a schematic network of known systems and notable locations that can grow during play.

## Decisions so far

<!-- One line per closed ticket; the detailed decision lives in that ticket. -->

- [Defining the V1 map data model and object catalogue](tickets/map-data-model.md): V1 uses keyed typed objects placed in an Orbit or at schematic system X/Y, with lightweight native and reusable custom fields.
- [Defining safe JSON import behavior](tickets/safe-import-behavior.md): imports create a confirmed, ID-remapped independent copy and preserve existing entities.
- [Prototyping the Jump Cluster and system-map editor](tickets/map-editor-prototype.md): V1 combines a map-first canvas with a hierarchical object/Orbit navigator and inspector; the map view supports zoom.

## Out of scope

- Implementing the web application in this planning effort.
- V1 scenario floorplans, session logs, factions/job board, crew-character tracking, and port/shore-leave tools; these remain future module candidates.
- Direct `.md`/`.canvas` import/export or synchronization in V1.
- Cross-module campaign entity sharing/navigation and the design of a future Obsidian adapter are separate efforts beyond this V1 map specification.
- Procedural generation of Jump Clusters or systems.
