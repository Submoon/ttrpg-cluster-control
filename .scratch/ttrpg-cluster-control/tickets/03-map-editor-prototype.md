---
title: 03. Prototyping the Jump Cluster and system-map editor
label: wayfinder:prototype
type: prototype
status: closed
assignee: Copilot
parent: "[TTRPG Cluster Control - V1 Specification](../map.md)"
---

## Question

What editing workflow makes the two V1 maps clear and manageable? Build a cheap, throwaway prototype for the user to react to, not production application code.

Show a manually arranged Jump Cluster graph with Jump-N route edges and an unresolved external exit; opening a system should lead to a schematic orbital view with parent-child rings and a details panel. Demonstrate creating a cluster/system, adding a route or Jump Point, adding an orbit and an object, editing its details, and exporting PNG/SVG. Use the agreed V1 data model and test whether multiple stars, nested moons, and non-orbital hazards remain legible.

## Prototype

[Open the interactive map-editor prototype](map-editor-prototype.html) directly in a browser. Compare variants with `?variant=A`, `?variant=B`, `?variant=C`, or `?variant=D`.

Drag systems to arrange the cluster; drag objects onto an Orbit to change their host placement or onto open chart for a system-level position. All edits remain in memory.

## Resolution

V1 uses the map-first canvas with a hierarchical object/Orbit navigator and a right-side inspector (variant D). The register-first C layout was not selected. Both map views use the zoom controls and bounds specified in [04. Choosing the V1 application and rendering architecture](04-application-architecture.md).
