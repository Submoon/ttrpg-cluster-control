---
title: "Inspect shared Jump Routes in the player views"
status: in-progress
assignee: Codex
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 17 — Inspect shared Jump Routes in the player views

## What to build

Let players select and frame shared routes in the preview and reader and see only the route attachment detail the Warden has published.

## Blocked by

- [Draw and inspect Jump Routes through semantic zoom](15-render-and-inspect-warden-routes.md)
- [Open the player preview and reader on one continuous map](16-open-continuous-player-map.md)

## Specification and baseline

[Unified map with stable semantic zoom](../spec.md) · [Source issue](https://github.com/Submoon/ttrpg-cluster-control/issues/4)

User stories covered: 37, 39–40, 45–48, 52.

Planning baseline: `dc5edb282087458c1bc6dd26287c96a974662c3b` (`main` and `origin/main` after fetch on 2026-11-16). The local planning checkout retains the prototype branch. Implement against the application baseline after refreshing it.

## Acceptance criteria

- [ ] The same shared route has a selectable public path in both surfaces, including when only a segment is visible. Inspect shows its jump level and permitted endpoints. Center frames the entire public path.
- [ ] At overview detail use published system anchors. At detailed zoom an end follows a Jump Point only if the document explicitly associates that route with an independently Revealed Jump Point in the correct published system. All other known ends use their anchors.
- [ ] A permitted anonymous destination keeps its authorized coordinates and generic Unknown destination label. A shared route adds no permission to reveal the private system, attachment, Station or original route direction. Routes with no published system are omitted.
- [ ] Valid legacy snapshots without an association remain readable using anchors. Validate public references, obscured and clipped routes, and replacement of a document while a reveal is pending.
