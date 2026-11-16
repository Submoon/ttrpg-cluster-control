---
title: "Draw and inspect Jump Routes through semantic zoom"
status: blocked
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

- [ ] A known end uses its system anchor in overview or without an attachment. At local detail it uses its attached Jump Point. Each end changes independently with a short transition that preserves route identity, selection and Inspector draft.
- [ ] Show an unresolved destination at its authored position at every detail level, with a distinct marker. An unplaced exit retains its existing origin-relative default, and a placed exit retains its own position when the origin moves.
- [ ] Multiple routes sharing systems or exact endpoints have distinct selectable paths. Jump-level labels appear where they fit, with priority for the selected route when labels compete. Full route names are available in Inspect.
- [ ] Select a visible segment with either end outside the viewport without moving the camera. Center frames the complete path in the usable map area. Target changes use the existing Inspector guard.
- [ ] The new canvas exposes route authoring and edits from the system-based route workflow, including unresolved placement. Verify mixed detail, overlap and selection at a clipped path through geometry and a representative browser journey.
