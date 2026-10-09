---
title: 08. Connecting Jump Points across a Jump Cluster
label: wayfinder:implement
type: implement
status: closed
assignee: Copilot
triage_labels:
  - enhancement
  - ready-for-agent
parent: "[TTRPG Cluster Control - V1 Specification](../map.md)"
---

# 08. Connecting Jump Points across a Jump Cluster

## What to build

As a Warden, I can grow a Jump Cluster with multiple star systems, open a system from the cluster map, and connect logical Jump Points with Jump Routes. A route can leave the known cluster without inventing a destination system, and an optional physical Jump Station remains distinct from its Jump Point.

## Acceptance criteria

- The Warden can add multiple star systems to a Jump Cluster and open a system from the cluster map.
- A Jump Route connects Jump Points by stable identity rather than by physical station.
- A route can have an unresolved external exit beyond the known Jump Cluster without creating a placeholder system or Jump Point.
- A physical Jump Station can be recorded separately and optionally for a logical Jump Point.
- The cluster map presents the systems, known route connections, and unresolved exits together.

## Blocked by

- [06. Building a star-system map with nested Orbits](06-star-system-map.md)
- [07. Adopting Tailwind CSS for the Nuxt interface](07-tailwind-css.md)

## Resolution

- Implemented the cluster map with multiple systems and route connections between stable Jump Point IDs, including unresolved external exits that do not create placeholder entities. Jump Points can optionally reference a separate physical Station installation.
- The workspace validator checks route endpoint and Station references, and browser acceptance covers route creation, endpoint renaming, persistence after reload, and Station association.
- Validation passed: `npm run typecheck`, `npm test`, and `npm run build`.

## Source specs

- [TTRPG Cluster Control - V1 Specification](../spec.md)
- [01. Defining the V1 map data model and object catalogue](01-map-data-model.md)
- [03. Prototyping the Jump Cluster and system-map editor](03-map-editor-prototype.md)
- [04. Choosing the V1 application and rendering architecture](04-application-architecture.md)
