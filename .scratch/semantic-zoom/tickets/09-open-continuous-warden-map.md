---
title: "Open the Jump Cluster on one continuous Warden map"
status: in-progress
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

- [ ] The Warden can open a saved workspace and zoom continuously from the Cluster overview into two nearby systems with independently revealed interiors. Both systems use one D3 camera. Overview names stay readable and remain associated with their systems.
- [ ] The legacy Cluster positions become the independent anchors. One common uniform conversion preserves local geometry, rotated and nested Orbits, off-center stars and distant objects. Zoom preserves their schematic positions and proportions.
- [ ] Each envelope encloses its anchor and complete in-scope contents with a margin. An empty system has a minimum frame, and overlapping systems retain their saved arrangements.
- [ ] Dragging a system's name or anchor in Move translates the complete system. The accepted edit survives reload and uses the existing workspace history and save path.
- [ ] Fit frames the whole Cluster and its applicable geometry. Verify the projection on a legacy fixture and exercise reveal, system movement and reload through the real editor.
