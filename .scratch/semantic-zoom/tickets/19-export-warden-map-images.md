---
title: "Export all three Warden map image scopes"
status: blocked
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 19 — Export all three Warden map image scopes

## What to build

Let the Warden export the entire Jump Cluster, a selected system, or the current viewport as PNG or SVG from the continuous map.

## Blocked by

- [Draw and inspect Jump Routes through semantic zoom](15-render-and-inspect-warden-routes.md)

## Specification and baseline

[Unified map with stable semantic zoom](../spec.md) · [Source issue](https://github.com/Submoon/ttrpg-cluster-control/issues/4)

User stories covered: 54–57.

Planning baseline: `dc5edb282087458c1bc6dd26287c96a974662c3b` (`main` and `origin/main` after fetch on 2026-11-16). The local planning checkout retains the prototype branch. Implement against the application baseline after refreshing it.

## Acceptance criteria

- [ ] Entire Cluster frames the overview with the system names, individual anchor-to-anchor routes and unresolved destinations, including geometry outside the live viewport.
- [ ] Selected system frames its complete envelope, objects and Orbits and dashed incident route segments leading away from it. A distant destination or neighboring system does not expand those bounds.
- [ ] Current viewport preserves the map framing, zoom, semantic detail and active filters. The rendered image uses applied map data and excludes menus, panels and unapplied movement or placement previews.
- [ ] The three scope choices work in PNG and SVG. Keep bounded PNG rasterization and all in-scope SVG geometry. Verify scope geometry, file preflight, a representative download and a cancelled export with no stale download.
