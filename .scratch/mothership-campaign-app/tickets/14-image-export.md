---
title: 14. Exporting complete maps as PNG and SVG
label: wayfinder:implement
type: implement
status: open
triage_labels:
  - enhancement
  - ready-for-agent
parent: "[Mothership Campaign App - V1 Specification](../map.md)"
---

# 14. Exporting complete maps as PNG and SVG

## What to build

As a Warden, I can export a complete Jump Cluster or star-system map as PNG or SVG, including content outside the current viewport, and get the same map arrangement in either format.

## Acceptance criteria

- PNG and SVG exports include the complete map regardless of the current viewport.
- Both formats use the same rendered map scene, so their map content and arrangement agree.
- SVG export serializes the rendered SVG scene; PNG export rasterizes that same scene through browser Canvas.

## Blocked by

- [08. Connecting Jump Points across a Jump Cluster](08-jump-cluster-routes.md)
- [10. Navigating and arranging both map views](10-map-navigation.md)

## Source specs

- [Mothership Campaign App - V1 Specification](../spec.md)
- [03. Prototyping the Jump Cluster and system-map editor](03-map-editor-prototype.md)
- [04. Choosing the V1 application and rendering architecture](04-application-architecture.md)
