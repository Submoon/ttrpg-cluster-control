---
title: "Inspect and find targets on the continuous Warden map"
status: in-progress
assignee: Codex
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 11 — Inspect and find targets on the continuous Warden map

## What to build

Let the Warden select, inspect, and reveal map targets without opening a separate system map. Keep map navigation available from every editing tool and preserve work through zoom and guarded selection changes.

## Blocked by

- [Open the Jump Cluster on one continuous Warden map](09-open-continuous-warden-map.md)

## Specification and baseline

[Unified map with stable semantic zoom](../spec.md) · [Source issue](https://github.com/Submoon/ttrpg-cluster-control/issues/4)

User stories covered: 10–20, 32–33.

Planning baseline: `dc5edb282087458c1bc6dd26287c96a974662c3b` (`main` and `origin/main` after fetch on 2026-11-16). The local planning checkout retains the prototype branch. Implement against the application baseline after refreshing it.

## Acceptance criteria

- [ ] Selecting a system name or frontmost eligible visible mark opens its permitted Inspector at the current camera position. Hierarchy selection also leaves the camera in place. Covered targets remain reachable through Hierarchy and Search where supported.
- [ ] Fit frames the whole Cluster. Center and Search use the usable area around panels and change zoom only as needed for reveal or framing. Fit, Center, pan and zoom preserve selection and any draft.
- [ ] A collapse retains the entity and its modified draft in Inspect. A focused mark that becomes hidden hands focus to its visible system name, or to the map when that name is outside the usable area. Focus elsewhere is left in place.
- [ ] Leaving a modified Inspector target through the map, Hierarchy or Search uses Apply, Discard and Stay. Stay or failed Apply retains the source target and draft and does not reveal the proposed destination.
- [ ] Select, Move and Add can use wheel, pinch and right-drag without a separate Navigate mode. Right click still opens the applicable menu, and one-finger background drag pans. After accepted Undo or Redo, reveal the affected entity or a surviving parent with the least required camera change.
- [ ] Verify draft guards and stale reveal cancellation at the command boundary, then exercise representative map, keyboard and camera interactions in the browser.
