---
title: "Open the Jump Cluster on one continuous Warden map"
status: closed
assignee: Codex
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 09 — Open the Jump Cluster on one continuous Warden map

## What to build

Open a real saved Jump Cluster on the continuous map. Let the Warden inspect the overview and local detail in one camera, move a system by its anchor or name, and recover its position after reload. Make this path available for integrated verification ahead of the default-entry change.

## Blocked by

None. This ticket can start immediately.

## Specification and baseline

[Unified map with stable semantic zoom](../spec.md) · [Source issue](https://github.com/Submoon/ttrpg-cluster-control/issues/4)

User stories covered: 1, 3–9, 14, 49, 57.

Planning baseline: `dc5edb282087458c1bc6dd26287c96a974662c3b` (`main` and `origin/main` after fetch on 2026-11-16). The local planning checkout retains the prototype branch. Implement against the application baseline after refreshing it.

## Acceptance criteria

- [x] The Warden can open a saved workspace and zoom continuously from the Cluster overview into two nearby systems with independently revealed interiors. Both systems use one D3 camera. Overview names stay readable and remain associated with their systems.
- [x] The legacy Cluster positions become the independent anchors. One common uniform conversion preserves local geometry, rotated and nested Orbits, off-center stars and distant objects. Zoom preserves their schematic positions and proportions.
- [x] Each envelope encloses its anchor and complete in-scope contents with a margin. An empty system has a minimum frame, and overlapping systems retain their saved arrangements.
- [x] Dragging a system's name or anchor in Move translates the complete system. The accepted edit survives reload and uses the existing workspace history and save path.
- [x] Fit frames the whole Cluster and its applicable geometry. Verify the projection on a legacy fixture and exercise reveal, system movement and reload through the real editor.

## Resolution

Integrated `fa85739a37b46a3b032e743fb47770592060947c`. The subordinate browser candidate was `cbff353675d974c74b57da03c54d5193ccf736c7`; the final commit adds a typed missing-anchor fallback and forwards system history framing. A type check using the generated Nuxt configuration passed on the integrated candidate.

- Opened a legacy Jump Cluster backup in the real Warden workspace at `/?map=continuous`. The two systems collapsed to overview names and revealed their six objects through one camera. The unflagged entry continued to open the existing system map.
- Moved Vesper by its name at a projected zoom and confirmed displacement on both axes against the browser SVG matrix. Harrow kept its anchor. Vesper's accepted position remained unchanged after loading the workspace again.
- Confirmed every system name was readable and directly reachable after Fit at 390 × 844 in Chrome touch emulation, on the 5-system/50-object and 10-system/200-object scenes. Phone hardware performance is tracked in ticket 21.
- The projection and workspace command checks passed (9 tests). Targeted ESLint and independent source review passed. The review verified the corrections to anchor conversion, preview ownership, label sizing and placement, and initial detail state.

The continuous entry remains opt-in until ticket 22. Panel-aware target framing remains in ticket 11.
