---
title: 11. Safely deleting dependent map entities
label: wayfinder:implement
type: implement
status: closed
assignee: Copilot
triage_labels:
  - enhancement
  - ready-for-agent
parent: "[Mothership Campaign App - V1 Specification](../map.md)"
---

# 11. Safely deleting dependent map entities

## What to build

As a Warden, I can inspect the effects of deleting a map entity before confirming a cascade, so I do not accidentally lose routes, Orbits, or other dependent map data.

## Acceptance criteria

- Before cascading a deletion, the app identifies the dependent entities that will be removed.
- Deleting any map entity requires explicit confirmation; when dependents are affected, the confirmation lists them before any data is changed.
- Canceling the confirmation leaves the map and all dependent data unchanged.
- Confirming the cascade removes the selected entity and its dependents without leaving broken references.

## Blocked by

- [06. Building a star-system map with nested Orbits](06-star-system-map.md)
- [07. Adopting Tailwind CSS for the Nuxt interface](07-tailwind-css.md)
- [08. Connecting Jump Points across a Jump Cluster](08-jump-cluster-routes.md)

## Source specs

- [Mothership Campaign App - V1 Specification](../spec.md)
- [04. Choosing the V1 application and rendering architecture](04-application-architecture.md)

## Resolution

Every map-entity deletion now requires confirmation. When dependents are affected, the confirmation previews dependent objects, nested Orbits, Jump Routes, and physical Station links. Confirmed deletions clear broken references and stale layout entries, normalize remaining Orbit order, and cannot remove the last star system; canceling leaves the saved workspace unchanged.
