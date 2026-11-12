---
title: Choose Warden filter targets and surfaces
status: closed
label: wayfinder:grilling
type: grilling
parent: ../map.md
assignee: Codex
---

# Choose Warden filter targets and surfaces

## Question

Which entities can the Warden filter on the Jump Cluster and star-system maps, and which consultation surfaces follow those controls? Distinguish catalogue families and subtypes, user-named Other types, systems, Orbits and Jump Routes. The source examples span both map scales, which represent different entities.

Use a system hidden on the Jump Cluster map and a planet hidden in a star system as examples. Decide whether each stays visible in Hierarchy and accessible through Inspect, and whether the Warden keeps a common filter selection when moving between systems. The decisions on dependent geometry, search activation and saving build on this scope.

## Blocked by

None.

## Resolution

Confirmed on 2026-11-06.

- Warden filters apply directly to catalogue objects on star-system maps. The Jump Cluster map is outside this scope. Orbit rings are dependent geometry, with their treatment decided in [Decide how Warden filters affect dependent geometry](05-warden-dependent-geometry.md).
- A nonmatching object remains visible at greatly reduced opacity. Hierarchy retains the complete tree and identifies affected entries as dimmed on the map. The Warden can still consult them in Inspect through the existing selection flow.
- One set of active Warden filters applies across all star systems in the workspace. Visiting the Jump Cluster and returning to any star system retains that set. The session lifetime is covered by [Define what filter settings travel with a workspace](08-workspace-persistence.md).
- The type facet offers one option per catalogue subtype and one per user-named Other subtype. For example, Planet and Moon are distinct options, and two differently named Other subtypes can be filtered independently.

These decisions apply to the Warden editor. [Choose player filter capabilities and ownership](04-player-filter-contract.md) covers the player consultation contract. The eventual specification must record how the local scope and dimming behavior interpret the source issue's Cluster examples and visibility criterion.
