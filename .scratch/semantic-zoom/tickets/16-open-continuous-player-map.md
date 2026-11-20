---
title: "Open the player preview and reader on one continuous map"
status: closed
assignee: Codex
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

- [x] Both surfaces render the same document through the continuous map, using committed effective public geometry and required Orbit/host chains. Generic Unknown presence and Known type markers stay at their anchors. A Revealed system with an empty published interior has a named minimum frame.
- [x] Public envelopes, reveal thresholds, initial framing and Fit depend on permitted geometry. Two inputs with identical public geometry and different private extents produce the same public envelope and camera outcome.
- [x] Select a published marker, object or Orbit for inspection without moving the camera. Center frames its public geometry. Semantic collapse keeps the logical selection. Pinch and background pan work on the same canvas.
- [x] Open older player files and links. Retain public anchor endpoints where there is no association with a Jump Point and remove resolved same-system loops silently from the loaded document. Keep anonymous destinations and the original share bytes.
- [x] Replacing the document resets selection and pending reveal actions even when its IDs repeat. Verify public projection and legacy admission plus a representative preview/reader journey from the same document.

## Resolution

Integrated `a10bb76009a896a152c234f844ea623c74d59da3`. The preview and reader use the continuous public map behind the temporary `map=continuous` switch pending activation in ticket 22. The scene and camera use the same detached, validated player document.

- The Vue type check and 72 focused pure checks passed on the combined Warden and player candidate. The player checks compare inputs whose private extents differ, cover public presence, named minimum envelopes and public Orbit chains, and verify legacy admission and exact document identity. The final decoration and browser test changes passed targeted lint.
- Chrome verified that the reader and Warden preview render identical public envelopes from the representative published map. Four Revealed systems and one Unknown presence were visible. Private geometry stayed outside the rendered scene. Compact Chrome touch emulation verified pinch and continued camera input after the original touch target collapsed.
- The maintained reader journey passed against the production build of `dbe14a8ed759155eca7700b2e4e385c1c1315444`. It preserves the old share URL while removing its internal route, handles replacement files with repeated IDs, selects a system and object without moving the camera, centers the selected public geometry, clears Search locators on pointer and keyboard zoom, and restores visible focus while keeping the selected object in Inspect after collapse.
- Independent review checked field and document admission, public-only bounds and projection, camera framing, and label legibility. Chrome exposed a decorative label leader intercepting the anchor click. The production journey passed after the pointer fix and after adjusting the test to stop zooming at the first detail reveal, use the desktop Inspector contents, and reveal the focus target after the previous collapse.

Published Jump Route attachments and route inspection follow in ticket 17. Physical smartphone performance measurements follow in ticket 21.
