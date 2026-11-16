---
title: "Open the player preview and reader on one continuous map"
status: blocked
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 16 — Open the player preview and reader on one continuous map

## What to build

Let the player explore a detached published map on one camera in the preview and standalone reader. Open supported older shares directly in this view.

## Blocked by

- [Open the Jump Cluster on one continuous Warden map](09-open-continuous-warden-map.md)

## Specification and baseline

[Unified map with stable semantic zoom](../spec.md) · [Source issue](https://github.com/Submoon/ttrpg-cluster-control/issues/4)

User stories covered: 2–5, 12, 14, 41–45, 48, 52–53.

Planning baseline: `dc5edb282087458c1bc6dd26287c96a974662c3b` (`main` and `origin/main` after fetch on 2026-11-16). The local planning checkout retains the prototype branch. Implement against the application baseline after refreshing it.

## Acceptance criteria

- [ ] Both surfaces render the same document through the continuous map, using committed effective public geometry and required Orbit/host chains. Generic Unknown presence and Known type markers stay at their anchors. A Revealed system with an empty published interior has a named minimum frame.
- [ ] Public envelopes, reveal thresholds, initial framing and Fit depend on permitted geometry. Two inputs with identical public geometry and different private extents produce the same public envelope and camera outcome.
- [ ] Select a published marker, object or Orbit for inspection without moving the camera. Center frames its public geometry. Semantic collapse keeps the logical selection. Pinch and background pan work on the same canvas.
- [ ] Open older player files and links. Retain public anchor endpoints where there is no association with a Jump Point and remove resolved same-system loops silently from the loaded document. Keep anonymous destinations and the original share bytes.
- [ ] Replacing the document resets selection and pending reveal actions even when its IDs repeat. Verify public projection and legacy admission plus a representative preview/reader journey from the same document.
