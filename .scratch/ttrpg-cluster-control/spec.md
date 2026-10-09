---
title: TTRPG Cluster Control - V1 Specification
status: closed
triage_labels:
  - enhancement
  - ready-for-agent
---

## Problem Statement

The Warden needs a dependable way to manually create and maintain schematic Jump Clusters and star-system maps for a tabletop role-playing campaign. These maps must describe known systems, Jump Routes, logical Jump Points, orbital structure, and keyed locations without requiring astronomical precision or procedural generation.

Existing Obsidian notes use Markdown wikilinks and `.canvas` maps, but V1 needs a clear app-native editing and backup workflow. It must preserve the Warden's work locally, make copies safe to import, and produce shareable map images without silently replacing existing data.

## Solution

Build a single-user, local-first browser application for manually creating and editing Jump Clusters and their star-system maps. Use a map-first canvas with a hierarchical object/Orbit navigator and an inspector. Save committed edits automatically in browser IndexedDB, and let the Warden exchange versioned JSON for complete clusters or standalone systems and export complete maps as PNG or SVG.

The domain model remains independent of the web framework and renderer. V1 does not require an account, a remote workspace API, map generation, or direct Obsidian compatibility.

## User Stories

1. As a Warden, I want to use the app without creating an account, so that my campaign workspace stays single-user and local-first.
2. As a Warden, I want the app to restore my local workspace when I return, so that I can continue editing without manually loading a save file.
3. As a Warden, I want committed changes to save automatically, so that routine editing does not depend on remembering to save.
4. As a Warden, I want to see when a local save fails and the workspace is still unsaved, so that I do not mistake a failed write for a saved campaign.
5. As a Warden, I want to create and manually arrange a Jump Cluster, so that its map reflects the known network in my campaign rather than a generated layout.
6. As a Warden, I want to add multiple star systems to a Jump Cluster, so that I can map the places known to my crew.
7. As a Warden, I want to open a star system from its cluster map, so that I can move between network-level and local detail.
8. As a Warden, I want to create Jump Points in a star system, so that Jump Routes can refer to logical endpoints rather than physical stations.
9. As a Warden, I want to connect Jump Points with Jump Routes, so that known travel connections are visible on the cluster map.
10. As a Warden, I want a Jump Route to end at an unresolved external exit, so that I can record a route whose far end is beyond the known Jump Cluster without inventing a system.
11. As a Warden, I want to record an optional physical Jump Station separately from a Jump Point, so that a logical route endpoint is not confused with a physical location.
12. As a Warden, I want each star system to contain multiple stars, so that I can represent systems with more than one stellar host.
13. As a Warden, I want to add map objects from a concise catalogue of celestial bodies, small bodies and fields, installations, vessels, Jump Points, phenomena, and an "other" type, so that I can describe the places and hazards in my setting.
14. As a Warden, I want each catalogue object to have a stable identity, family or subtype, required location key, name, and description, so that I can identify and describe it consistently.
15. As a Warden, I want location keys to be unique within their star system, so that keyed map locations remain unambiguous.
16. As a Warden, I want to place any catalogue object either directly in a star system or in an Orbit, so that map placement is not restricted by object type.
17. As a Warden, I want system-level objects to receive an initial schematic position that I can edit, so that hazards and other non-orbital features can be placed on the system map.
18. As a Warden, I want objects to host Orbits of their own, including stars orbiting other stars and moons orbiting planets, so that I can build nested orbital hierarchies.
19. As a Warden, I want an Orbit to be a lightweight placement structure that can be empty or contain multiple objects, so that I can plan a system before filling every Orbit.
20. As a Warden, I want to reorder a host's Orbits, so that I can adjust their schematic presentation without entering physical orbital measurements.
21. As a Warden, I want to edit an object's details in an inspector while navigating the hierarchy, so that I can work on a map object without losing its context.
22. As a Warden, I want planets and moons to have an optional atmosphere field and applicable installations to have an optional port-class field, so that common science-fiction campaign details are quick to record.
23. As a Warden, I want to edit the single-select options for the native fields, so that their values fit the terminology of my campaign.
24. As a Warden, I want to define reusable custom fields for my local app and give objects optional text, number, boolean, or single-select values, so that I can track campaign-specific details without changing the map structure.
25. As a Warden, I want system nodes and map objects to be independently draggable, so that I can arrange cluster and system maps by hand.
26. As a Warden, I want to pan and zoom either map with pointer-centered wheel, trackpad, or pinch gestures and visible zoom controls, so that I can inspect both dense and broad maps.
27. As a Warden, I want visible zoom-in, zoom-out, and fit controls with a defined 25-1600% range, so that map navigation is available without relying on gestures.
28. As a Warden, I want to resize an Orbit while keeping its orbiting objects at their stored angles, so that I can improve readability without changing their relative arrangement.
29. As a Warden, I want the minimum Orbit radius to leave clearance around its host and have no arbitrary fixed maximum, so that the layout remains usable at different scales.
30. As a Warden, I want map elements to be keyboard-focusable and have accessible names, so that I can identify and operate them without relying only on visual presentation.
31. As a Warden, I want to see which entities depend on an item before a cascading deletion and explicitly confirm the cascade, so that I can avoid accidental loss of dependent map data.
32. As a Warden, I want canceling a deletion confirmation to leave the map unchanged, so that I can safely inspect the impact before committing the deletion.
33. As a Warden, I want to export a complete Jump Cluster as versioned JSON, including its systems, routes, system-node positions, and layout, so that I can back up or move the whole network.
34. As a Warden, I want to export a standalone star system as versioned JSON containing its local objects and Jump Points but no cluster routes, so that I can reuse a system independently.
35. As a Warden, I want JSON exports to preserve custom Orbit radii and orbital-object angles, while omitting selection and current zoom or pan, so that layout survives interchange without capturing temporary view state.
36. As a Warden, I want an import to be validated and previewed before any data is written, so that I can understand what the file contains before accepting it.
37. As a Warden, I want the import preview to show incoming entity counts and original-ID collisions with possible matching entities, so that I can spot likely duplicates before creating a copy.
38. As a Warden, I want importing to create a confirmed, independent copy with new IDs rather than merge with or replace existing entities, so that existing campaign work is never silently overwritten.
39. As a Warden, I want import to remap internal references and ID-keyed layout entries, so that routes, Orbit radii, object angles, and system positions remain attached to the copied entities.
40. As a Warden, I want cluster routes to point to the new IDs of included Jump Points while unresolved external exits stay unresolved, so that copied route topology remains correct.
41. As a Warden, I want matching names or location keys alone not to imply identity during import, so that intentional duplicates can coexist without accidental merging.
42. As a Warden, I want canceling an import or failing validation to leave the workspace unchanged, so that an unaccepted or invalid file cannot damage existing work.
43. As a Warden, I want to export a complete map as PNG or SVG regardless of the current viewport, so that the resulting image includes the whole map rather than only what I was viewing.
44. As a Warden, I want PNG and SVG exports to use the same rendered map scene, so that their contents and arrangement agree.

## Implementation Decisions

### Domain and map data

- A Jump Cluster contains star systems and Jump Routes. A Jump Route connects logical Jump Points by stable ID; its far end may remain unresolved beyond the known cluster. A physical Jump Station is optional and distinct from a logical Jump Point.
- A star system contains one or more stars, catalogue objects, and an Orbit hierarchy. Orbits can be nested under any catalogue object, including stars and planets.
- Each catalogue object has a stable app-generated ID, family/subtype, required user-editable location key unique within its star system, name, and description. Families and subtypes are:
  - `CelestialBody`: star, planet, moon
  - `SmallBody/Field`: asteroid, belt
  - `Installation`: station, base, colony
  - `Vessel`: vessel, derelict
  - `JumpPoint`
  - `Phenomenon`: anomaly, nebula, hazard
  - `Other`: a user-supplied type label
- Every catalogue object may be placed directly in a star system or attached to an Orbit. System-level X/Y positions are manually editable schematic positions, not astronomical coordinates. Every catalogue object may host Orbits.
- An Orbit is an unkeyed placement structure with a technical ID, a host object, and an order among that host's Orbits. It may contain zero or more catalogue objects. Orbit radii are display layout, not physical measurements.
- The optional native fields are `atmosphere` for planets/moons and `portClass` for applicable installations. Both are single-select fields with user-editable options.
- Custom-field definitions are global to the local app and reusable across clusters and systems. They support text, number, boolean, and single-select values with user-defined options. Values are optional per catalogue object; Orbits do not have custom fields.

### Editing and rendering

- The editor uses a map-first canvas, a hierarchical object/Orbit navigator, and a right-side inspector.
- Nuxt owns the application shell and controls; a client-only D3 map component owns its SVG subtree. Both the Jump Cluster and system views use this D3/SVG approach. Do not add a force simulation or a second map renderer.
- Both views support pointer-centered wheel/trackpad/pinch zoom, panning by dragging the empty background, and visible zoom-in, zoom-out, and fit controls. Zoom is limited to 25–1600%, with unbounded panning.
- System nodes and map objects remain separately draggable. Every Orbit is an ellipse; equal radii form a circle. Its horizontal and vertical radii have host-clearance minimums and no fixed maximum. Selected Orbits expose right and top handles for axis-specific resizing, plus a rotation handle; dragging elsewhere on the ring scales both radii uniformly. Selected Orbits with unoccupied centers expose a draggable center handle. Resizing, rotation, and moving the center preserve child-object angles. Ctrl+mouse wheel over the selected Orbit also rotates it; Ctrl+mouse wheel elsewhere retains map zoom.
- Orbits can be dragged from the Add Object palette onto a map object to attach them, or onto empty map space to create an Orbit around an unoccupied center at the drop point. The Selected inspector can detach a hosted Orbit to a nearby free center.
- Orbit names are not drawn on the system map or in SVG/PNG exports.
- SVG map elements are keyboard-focusable and have accessible names; visible controls provide an alternative to gesture-based zoom.
- Deleting an entity with dependents requires an explicit confirmation that identifies the affected entities. Canceling leaves all data unchanged.

### Persistence, interchange, and exports

- Store the local workspace and map layout in IndexedDB. Read it only after application hydration and save committed edits transactionally. A failed write must surface as an unsaved/error state.
- Cluster JSON contains its systems, routes, system-node positions, and a versioned layout section. Standalone-system JSON contains only local system content and Jump Points, not cluster routes. Both layout sections preserve custom Orbit radii, rotations, and orbital-object angles. Neither contains current selection or zoom/pan state.
- Validate and preview imports before writing. An accepted import creates an independent copy with new IDs; it never merges with or replaces existing entities. Show incoming entity counts and original-ID collisions with possible existing duplicates, but do not treat matching names or keys as identity.
- Remap internal references and ID-keyed layout entries through the same old-to-new ID map. Cluster route endpoints that refer to included Jump Points receive new IDs; unresolved external exits remain unresolved. Standalone-system exports and imports contain no cluster routes.
- Export the complete map regardless of the current viewport. Serialize the D3-generated SVG for SVG export and rasterize that same scene through browser Canvas for PNG export.

### Application boundary and future compatibility

- Use Nuxt with SSR enabled for the application shell and routes; load the local workspace after hydration and keep the map editor client-only. Nuxt/Nitro is the SSR host; V1 adds no application data API, account, or remote workspace.
- Keep the map domain model independent of Nuxt and D3. Future campaign modules can be ordinary Nuxt routes/features; V1 does not add a plugin system or shared campaign-entity layer.
- A future Obsidian adapter may translate Markdown/Canvas data to and from the app's versioned JSON. Direct Obsidian import/export and synchronization are not part of V1.

## Testing Decisions

- Good tests verify observable user behavior and persisted or exported results, not framework internals, D3 implementation details, or the IndexedDB schema.
- Use one browser-level acceptance seam at the application boundary to cover the editor, IndexedDB persistence, JSON import/export, and image export together.
- The acceptance scenarios should create and edit a Jump Cluster and nested system map; verify map navigation and accessible controls; reload and confirm saved state; exercise dependent-deletion confirmation; validate import preview, cancellation, confirmed copy creation, ID/reference remapping, and unchanged existing entities; and verify full-map JSON, PNG, and SVG exports.
- The repository currently has no application implementation or test-suite precedent. The acceptance harness should be the smallest browser test setup needed by the implementation; do not prescribe tests of Nuxt, Vue, or D3 internals.

## Out of Scope

- User accounts, remote workspace storage, and a separate application data API.
- Procedural generation of Jump Clusters or star systems.
- Astronomical-scale maps, physical orbital measurements, or physics simulation.
- Direct Obsidian Markdown/Canvas import, export, or synchronization.
- V1 scenario floorplans, session logs, factions/job board, crew-character tracking, and port/shore-leave tools.
- Cross-module campaign entity sharing/navigation and the design or implementation of a future Obsidian adapter.

## Further Notes

- Use the repository glossary for Jump Cluster, star system, Jump Point, Jump Route, Orbit, and location key.
- This spec synthesizes the resolved decisions in the [V1 map](map.md), [04. application and rendering architecture](tickets/04-application-architecture.md), [01. map data model](tickets/01-map-data-model.md), [02. safe import behavior](tickets/02-safe-import-behavior.md), and [03. editor prototype](tickets/03-map-editor-prototype.md).
