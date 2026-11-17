---
title: "Draw and inspect Jump Routes through semantic zoom"
status: closed
assignee: Codex
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 15 — Draw and inspect Jump Routes through semantic zoom

## What to build

Make routes individually readable and selectable on the continuous Warden map from Cluster overview to local detail, including unresolved destinations and paths that extend beyond the viewport.

## Blocked by

- [Create, edit, and restore routes between systems](10-edit-and-restore-system-routes.md)
- [Inspect and find targets on the continuous Warden map](11-inspect-and-frame-continuous-map.md)

## Specification and baseline

[Unified map with stable semantic zoom](../spec.md) · [Source issue](https://github.com/Submoon/ttrpg-cluster-control/issues/4)

User stories covered: 34–40.

Planning baseline: `dc5edb282087458c1bc6dd26287c96a974662c3b` (`main` and `origin/main` after fetch on 2026-11-16). The local planning checkout retains the prototype branch. Implement against the application baseline after refreshing it.

## Acceptance criteria

- [x] A known end uses its system anchor in overview or without an attachment. At local detail it uses its attached Jump Point. Each end changes independently with a short transition that preserves route identity, selection and Inspector draft.
- [x] Show an unresolved destination at its authored position at every detail level, with a distinct marker. An unplaced exit retains its existing origin-relative default, and a placed exit retains its own position when the origin moves.
- [x] Multiple routes sharing systems or exact endpoints have distinct selectable paths. Jump-level labels appear where they fit, with priority for the selected route when labels compete. Full route names are available in Inspect.
- [x] Select a visible segment with either end outside the viewport without moving the camera. Center frames the complete path in the usable map area. Target changes use the existing Inspector guard.
- [x] The new canvas exposes route authoring and edits from the system-based route workflow, including unresolved placement. Verify mixed detail, overlap and selection at a clipped path through geometry and a representative browser journey.

## Resolution

The Warden continuous map uses the shared scene-space Jump Route curves. Each known end follows its own semantic detail state, with stable route identity and a short endpoint transition. Unresolved destinations keep their authored position or the legacy origin-relative default. Existing route authoring, guarded inspection, and explicit unresolved placement use the current command and writer.

- The 43 focused pure tests cover independent endpoints, authored/default exits, parallel and coincident lanes, nearest rendered curve selection, and Center convergence in a shallow usable area. The combined route and import candidate `f853751778a38ce8bc270894cd7bc5173b55f2ef` passed the Vue check. The route SFCs compile and a mounted Vue probe verified that ongoing zoom retargets the tween without changing its 140 ms deadline.
- Chrome verified selectable clipping, different detail at either end, selection with unchanged camera, full-path Center in usable space, selected route names, a modified draft retained after Stay, and an authored unresolved destination nudged and saved through the explicit Move workflow. The maintained journey selects the new exit after setting Move mode.
- A second Chrome test clicked the center and neighboring routes in a 23-route overlap at distant zoom. The middle route's centerline was covered by two later hit strokes, and the nearest rendered curve received selection. Independent review closed the proven hit, transition, and Center defects.
- Browser results use a locally compiled revision that loads the already-installed dependencies from the worktree. Full portable packaging and performance qualification remain on the integrated activation revision.

The existing direct drag of an unresolved marker is tracked in ticket 22 for the default activation. The continuous map now supports the explicit Move on map, preview, keyboard nudge, and Confirm move workflow.
