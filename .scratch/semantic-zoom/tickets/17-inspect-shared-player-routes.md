---
title: "Inspect shared Jump Routes in the player views"
status: closed
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

- [x] The same shared route has a selectable public path in both surfaces, including when only a segment is visible. Inspect shows its jump level and permitted endpoints. Center frames the entire public path.
- [x] At overview detail use published system anchors. At detailed zoom an end follows a Jump Point only if the document explicitly associates that route with an independently Revealed Jump Point in the correct published system. All other known ends use their anchors.
- [x] A permitted anonymous destination keeps its authorized coordinates and generic Unknown destination label. A shared route adds no permission to reveal the private system, attachment, Station or original route direction. Routes with no published system are omitted.
- [x] Valid legacy snapshots without an association remain readable using anchors. Validate public references, obscured and clipped routes, and replacement of a document while a reveal is pending.

## Resolution

Implemented the detached version-2 Player JSON document with public, system-local Jump Point attachments. The version-1 compressed link transport is unchanged. Legacy documents load from their own published data and remove old same-system loops while keeping valid routes. Independent reviews checked the admission and disclosure boundary and the rendered route corrections.

The reader and preview share the same route layer, selection, Inspector and Center. Known ends use anchors at overview and independently Revealed attached points when the corresponding detail is visible. Anonymous ends retain their exact allowed coordinate and the Unknown destination label. Selection from a clipped segment keeps the camera until explicit Center. Compact Center dismisses the Inspector and validates the captured document, route and renderer before moving the camera.

The frozen source and fixtures passed Vue types, lint, targeted public geometry tests and linked production Chrome checks. The reader journey replaces a link in the same compact tab during a pending Search reveal and verifies that repeating public IDs does not reselect the prior document's route or leave its locator.
