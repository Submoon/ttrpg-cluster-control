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
- Map zoom, dependent deletion, and Orbit-resize behavior are specified in [04. Choosing the V1 application and rendering architecture](tickets/04-application-architecture.md).
- The Nuxt application now has its local workspace foundation; remaining V1 implementation work is listed below.
- Use `grilling` and `domain-modeling` for human decisions; use `prototype` for visual/interaction questions.
- Warden's Operations Manual pp. 44-45 describes the Jump Cluster map as a schematic network of known systems and notable locations that can grow during play.

## Decisions so far

<!-- One line per closed ticket; the detailed decision lives in that ticket. -->

- [01. Defining the V1 map data model and object catalogue](tickets/01-map-data-model.md): V1 uses keyed typed objects placed in an Orbit or at schematic system X/Y, with lightweight native and reusable custom fields.
- [02. Defining safe JSON import behavior](tickets/02-safe-import-behavior.md): imports create a confirmed, ID-remapped independent copy and preserve existing entities.
- [03. Prototyping the Jump Cluster and system-map editor](tickets/03-map-editor-prototype.md): V1 combines a map-first canvas with a hierarchical object/Orbit navigator and inspector; the map view supports zoom.
- [04. Choosing the V1 application and rendering architecture](tickets/04-application-architecture.md): V1 uses Nuxt SSR, a client-only D3/SVG map, IndexedDB, versioned layout-preserving JSON, confirmed zoom/edit behavior, and full-map PNG/SVG exports.
- [05. Creating and restoring a local campaign workspace](tickets/05-local-campaign-workspace.md): the Nuxt app creates a local Jump Cluster and first star system, restores it after hydration, and transactionally saves committed edits with visible error state.
- [06. Building a star-system map with nested Orbits](tickets/06-star-system-map.md): the D3/SVG editor supports the full object catalogue, schematic placements and nested Orbits, with synchronized canvas, hierarchy, and inspector edits persisted to the local workspace.
- [07. Adopting Tailwind CSS for the Nuxt interface](tickets/07-tailwind-css.md): Nuxt uses Tailwind utilities for layout, spacing, responsive behavior, and focus states while preserving the existing visual details.
- [08. Connecting Jump Points across a Jump Cluster](tickets/08-jump-cluster-routes.md): the cluster map supports multiple systems and Jump Routes between stable Jump Point IDs, with unresolved external exits and optional physical Station references.
- [09. Adding native and reusable custom fields](tickets/09-object-fields.md): workspace-wide native options and typed custom fields save optional values on map objects, never Orbits.
- [10. Navigating and arranging both map views](tickets/10-map-navigation.md): both D3/SVG maps support temporary pan/zoom with accessible fit controls and persisted manual layout, including Orbit resizing that preserves object angles without a fixed maximum.
- [11. Safely deleting dependent map entities](tickets/11-safe-dependent-deletion.md): every deletion requires confirmation; dependency previews identify cascaded objects, Orbits, routes, and cleared Station links, and cancellation preserves the workspace.
- [12. Exporting clusters and systems as versioned JSON](tickets/12-json-export.md): versioned cluster and standalone-system exports preserve maps, custom fields, and durable layout while excluding temporary view state.
- [13. Importing JSON as a safe independent copy](tickets/13-json-import.md): validated, confirmed JSON imports create independent copies with remapped IDs and references while preserving existing campaign work.
- [14. Exporting complete maps as PNG and SVG](tickets/14-image-export.md): both map views export their complete rendered SVG scene directly or rasterized through Canvas, independent of current pan and zoom.
- [15. Verifying the V1 workflow in one browser acceptance test](tickets/15-browser-acceptance.md): one end-to-end browser path verifies persistence, safe import/deletion, and complete map exports.
- [16. Making the workspace darker and more map-first](tickets/16-map-first-visual-refresh.md): full-canvas maps show Jump Cluster and active-system details in the shared application header, with 25–1600% zoom, animated edge panels, and a responsive object palette below the header; compact category buttons reveal one object group at a time and scroll horizontally when needed. Keyboard deletion and separate compact export controls remain supported.
- [17. Moving map import and export actions into the header](tickets/17-header-import-export.md): a responsive, keyboard-accessible header exposes exports for the active Jump Cluster or star system and the existing safe JSON-copy import into the current cluster.
- [18. Prototyping field-definition management](tickets/18-field-definition-management.md): the user selected the Quick Dialog to manage reusable definitions next to the map, preview affected existing values, and confirm potentially destructive changes; product implementation is tracked in [19. Implementing field-definition management with a Quick Dialog](tickets/19-field-definition-management.md).
- [19. Implementing field-definition management with a Quick Dialog](tickets/19-field-definition-management.md): the active map now manages native and reusable field definitions through a Quick Dialog, with previews and explicit confirmation before clearing assigned values; workspace persistence and JSON export are preserved, and the prototype route is retired.
- [20. Clarifying the Chart Details action](tickets/20-chart-details-state.md): both inspectors expose a keyboard-accessible Chart Details toggle with synchronized `aria-pressed` and active styling; it returns from object, Orbit, or route selection to chart-level details and is hidden while a route draft is open.
- [21. Including the system name in system-map image exports](tickets/21-system-name-in-image-exports.md): star-system PNG/SVG exports include the current system name in a readable, bounds-fitting title band while leaving the in-app map and Jump Cluster exports unchanged.
- [22. Expanding the system-map grid and layout bounds](tickets/22-expanding-system-map-grid.md): system objects and Orbits can extend beyond the former 960x560 scene; the background and grid grow with the layout, Fit and exports include the expanded content, and existing saved positions remain unchanged.
- [23. Supporting Jump levels and destinations](tickets/23-jump-levels-and-destinations.md): Jump Routes use positive Jump levels and identify their known destination systems or explicitly unknown exits while preserving existing routes and JSON compatibility.
- [24. Improving text readability in Add Object and Map Files](tickets/24-map-actions-typography.md): Add Object and Map Files use larger scoped typography with compact, unclipped layouts; Map Files actions scroll within a bounded panel.
- [25. Supporting elliptical Orbits and unoccupied centers](tickets/25-special-orbits.md): every Orbit is an ellipse (equal radii form a circle), draggable from Add Object onto a host or unoccupied center; a selected unoccupied Orbit's center handle moves its objects, while Detach gives a hosted Orbit a nearby unoccupied center without changing dimensions, rotation, or child angles and reindexes its old host's Orbits. Axis handles, uniform ring resizing, and handle/Ctrl+wheel rotation preserve child angles and persist through workspace and JSON; Orbit names do not appear on maps or in SVG/PNG exports.
- [26. Refining sidebar collapse animation and labels](tickets/26-sidebar-collapse-animation.md): both sidebars fade content before shrinking and moving to the edge, then reveal upright vertical labels at the existing handle geometry; reduced motion and responsive reopening are covered in both map views.
- [27. Scoping custom fields to categories and subtypes](tickets/27-custom-field-applicability.md): reusable fields target all objects or selected categories and subtypes; hidden values persist, legacy object targets are discarded on restore/import, and compatible definitions unite selected scopes (unscoped definitions remain global).

## Implementation tickets

Implement in dependency order; each ticket also lists its blockers.

| Order | Ticket | Blocked by |
| --- | --- | --- |
| 05 | [05. Creating and restoring a local campaign workspace](tickets/05-local-campaign-workspace.md) | None |
| 06 | [06. Building a star-system map with nested Orbits](tickets/06-star-system-map.md) | [05. Creating and restoring a local campaign workspace](tickets/05-local-campaign-workspace.md) |
| 07 | [07. Adopting Tailwind CSS for the Nuxt interface](tickets/07-tailwind-css.md) | [06. Building a star-system map with nested Orbits](tickets/06-star-system-map.md) |
| 08 | [08. Connecting Jump Points across a Jump Cluster](tickets/08-jump-cluster-routes.md) | [06. Building a star-system map with nested Orbits](tickets/06-star-system-map.md); [07. Adopting Tailwind CSS for the Nuxt interface](tickets/07-tailwind-css.md) |
| 09 | [09. Adding native and reusable custom fields](tickets/09-object-fields.md) | [06. Building a star-system map with nested Orbits](tickets/06-star-system-map.md); [07. Adopting Tailwind CSS for the Nuxt interface](tickets/07-tailwind-css.md) |
| 10 | [10. Navigating and arranging both map views](tickets/10-map-navigation.md) | [06. Building a star-system map with nested Orbits](tickets/06-star-system-map.md); [07. Adopting Tailwind CSS for the Nuxt interface](tickets/07-tailwind-css.md); [08. Connecting Jump Points across a Jump Cluster](tickets/08-jump-cluster-routes.md) |
| 11 | [11. Safely deleting dependent map entities](tickets/11-safe-dependent-deletion.md) | [06. Building a star-system map with nested Orbits](tickets/06-star-system-map.md); [07. Adopting Tailwind CSS for the Nuxt interface](tickets/07-tailwind-css.md); [08. Connecting Jump Points across a Jump Cluster](tickets/08-jump-cluster-routes.md) |
| 12 | [12. Exporting clusters and systems as versioned JSON](tickets/12-json-export.md) | [08. Connecting Jump Points across a Jump Cluster](tickets/08-jump-cluster-routes.md); [09. Adding native and reusable custom fields](tickets/09-object-fields.md); [10. Navigating and arranging both map views](tickets/10-map-navigation.md) |
| 13 | [13. Importing JSON as a safe independent copy](tickets/13-json-import.md) | [12. Exporting clusters and systems as versioned JSON](tickets/12-json-export.md) |
| 14 | [14. Exporting complete maps as PNG and SVG](tickets/14-image-export.md) | [08. Connecting Jump Points across a Jump Cluster](tickets/08-jump-cluster-routes.md); [10. Navigating and arranging both map views](tickets/10-map-navigation.md) |
| 15 | [15. Verifying the V1 workflow in one browser acceptance test](tickets/15-browser-acceptance.md) | Tickets 05–14 |
| 18 | [18. Prototyping field-definition management](tickets/18-field-definition-management.md) | None |
| 19 | [19. Implementing field-definition management with a Quick Dialog](tickets/19-field-definition-management.md) | [18. Prototyping field-definition management](tickets/18-field-definition-management.md) |
| 20 | [20. Clarifying the Chart Details action](tickets/20-chart-details-state.md) | None |
| 22 | [22. Expanding the system-map grid and layout bounds](tickets/22-expanding-system-map-grid.md) | None |
| 23 | [23. Supporting Jump levels and destinations](tickets/23-jump-levels-and-destinations.md) | None |
| 24 | [24. Improving text readability in Add Object and Map Files](tickets/24-map-actions-typography.md) | None |
| 25 | [25. Supporting elliptical Orbits and unoccupied centers](tickets/25-special-orbits.md) | None |
| 26 | [26. Refining sidebar collapse animation and labels](tickets/26-sidebar-collapse-animation.md) | None |
| 27 | [27. Scoping custom fields to categories and subtypes](tickets/27-custom-field-applicability.md) | None |
| 28 | [28. Showing the dragged map object in the drag preview](tickets/28-map-object-drag-preview.md) | None |
| 29 | [29. Reviewing and modularizing the frontend architecture](tickets/29-frontend-architecture.md) | [27. Scoping custom fields to categories and subtypes](tickets/27-custom-field-applicability.md); [28. Showing the dragged map object in the drag preview](tickets/28-map-object-drag-preview.md) |
| 30 | [30. Documenting the project and codebase](tickets/30-project-documentation.md) | [27. Scoping custom fields to categories and subtypes](tickets/27-custom-field-applicability.md); [28. Showing the dragged map object in the drag preview](tickets/28-map-object-drag-preview.md); [29. Reviewing and modularizing the frontend architecture](tickets/29-frontend-architecture.md) |

## Out of scope

- Implementing the web application in this planning effort.
- V1 scenario floorplans, session logs, factions/job board, crew-character tracking, and port/shore-leave tools; these remain future module candidates.
- Direct `.md`/`.canvas` import/export or synchronization in V1.
- Cross-module campaign entity sharing/navigation and the design of a future Obsidian adapter are separate efforts beyond this V1 map specification.
- Procedural generation of Jump Clusters or systems.
