---
title: "Inspect and find targets on the continuous Warden map"
status: closed
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

- [x] Selecting a system name or frontmost eligible visible mark opens its permitted Inspector at the current camera position. Hierarchy selection also leaves the camera in place. Covered targets remain reachable through Hierarchy and Search where supported.
- [x] Fit frames the whole Cluster. Center and Search use the usable area around panels and change zoom only as needed for reveal or framing. Fit, Center, pan and zoom preserve selection and any draft.
- [x] A collapse retains the entity and its modified draft in Inspect. A focused mark that becomes hidden hands focus to its visible system name, or to the map when that name is outside the usable area. Focus elsewhere is left in place.
- [x] Leaving a modified Inspector target through the map, Hierarchy or Search uses Apply, Discard and Stay. Stay or failed Apply retains the source target and draft and does not reveal the proposed destination.
- [x] Select, Move and Add can use wheel, pinch and right-drag without a separate Navigate mode. Right click still opens the applicable menu, and one-finger background drag pans. After accepted Undo or Redo, reveal the affected entity or a surviving parent with the least required camera change.
- [x] Verify draft guards and stale reveal cancellation at the command boundary, then exercise representative map, keyboard and camera interactions in the browser.

## Resolution

Integrated `365a4bfb7207eb9110722086c8e21e4f9f3f35df` on the refreshed application baseline. The combined candidate `e3655b5a6589d385da8ebaab3bc9dc1d3c39bdcb` passed the Vue type check and 72 focused pure checks across Warden navigation and player projection and admission.

- A single continuous map stayed mounted through system selection, object Search, and explicit Center. Selection left the camera in place. Center preserved sufficient zoom.
- Collapsing a focused object handed focus to the visible system name or canvas and preserved the Inspector draft. Fit kept the draft, and Stay rejected an inspected target change across systems on the same canvas.
- Keyboard panning and Enter placed an armed system at a clear viewport center. Continuous-mode shortcuts use Select, Move and Add.
- The command checks cover Apply, failed Apply, Discard and Stay, including a modified system chart when selecting Cluster details. Camera math preserves zoom for fitting targets, minimally pans oversized history targets and leaves a valid Cluster fallback in view.
- The initial runtime attempt found invalid duplicate declarations, corrected before verification. The initial keyboard probe tried an occupied point and observed the normal placement rejection. The corrected journey pans to clear space before submitting.

Continuous placement within an owning system and Jump Route graphics remain in tickets 12 and 15.
