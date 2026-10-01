---
title: 04. Choosing the V1 application and rendering architecture
label: wayfinder:grilling
type: grilling
status: closed
assignee: Copilot
parent: "[Mothership Campaign App - V1 Specification](../map.md)"
---

## Question

Given the confirmed data model and map prototype, what is the simplest suitable application architecture for V1?

Compare Nuxt with a smaller Vue/Vite-style application and any materially better alternative. Recommend the 2D rendering approach for an editable network graph and nested orbital diagrams that support map zoom, deleting map elements, and adjusting Orbit radii, along with local browser persistence, JSON round-tripping for clusters and standalone systems, and PNG/SVG export. Explain the trade-offs and how to keep later campaign modules and an Obsidian adapter possible without building them now.

## Resolution

### Runtime and module shape

Use Nuxt with SSR enabled. SSR handles the application shell and routes; the user's workspace loads from IndexedDB after hydration, so the map editor is client-only. This requires a Nuxt/Nitro SSR host; it does not add a separate application data API, account, or remote workspace. A Vue/Vite SPA would be smaller for this local-first app and avoid SSR overhead, but Nuxt is the selected baseline and no other alternative materially improves the fit.

Keep the map domain model independent of Nuxt and D3. Future campaign features can be added as ordinary Nuxt routes/features; do not add a plugin system or shared campaign-entity layer in V1. A future Obsidian adapter can translate Markdown/Canvas data to and from the app's versioned JSON. Direct Obsidian compatibility and synchronization remain out of scope.

### Rendering and editing

D3 owns the SVG subtree in a client-only map component; Vue/Nuxt owns the surrounding application and controls. This avoids Vue and D3 updating the same DOM. Use the same D3/SVG approach for both manually arranged views; a force simulation or a second graph-rendering library is unnecessary.

Both views use pointer-centered wheel/trackpad/pinch zoom, pan by dragging the empty background, visible +/-/Fit controls, and a 25-400% zoom range. System nodes and map objects remain separately draggable. Keep SVG elements keyboard-focusable with accessible names, and expose zoom through the visible controls as well as gestures.

Orbit radius is display layout, not a physical measurement. Its minimum must leave clearance around the host; there is no fixed maximum. Changing a radius moves orbiting objects along the ring while preserving their stored angles. If deletion has dependents, show the affected entities and require explicit confirmation before cascading; cancellation changes nothing.

### Persistence and interchange

Persist the workspace and its layout in browser IndexedDB. Access it only after hydration, and save committed edits transactionally. Surface failed writes as unsaved/error state rather than reporting success.

Cluster JSON includes its systems, routes, and system-node positions; standalone-system JSON includes only local system content and Jump Points, not cluster routes. Both carry a versioned `layout` section for custom Orbit radii and orbital-object angles; the cluster layout also contains system-node positions. Keep selection and current zoom/pan out of JSON. Validate and preview imports before writing, follow the confirmed independent-copy/no-overwrite behavior in [02. Defining safe JSON import behavior](02-safe-import-behavior.md), and apply its ID remapping to ID-keyed layout entries too.

Export the complete map regardless of the current viewport. Serialize the D3-generated SVG for SVG export; rasterize that same scene through browser Canvas for PNG, avoiding a second renderer. SVG keeps individual map elements addressable and supports direct vector export; Canvas may suit much denser maps, but would add hit-testing, accessibility, and a separate SVG-export path that V1 does not need.
