---
title: "Place the anchor of an imported standalone system"
status: in-progress
assignee: Codex
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 18 — Place the anchor of an imported standalone system

## What to build

Let the Warden place a reviewed standalone system copy at a chosen anchor on the continuous Cluster map instead of accepting an automatically assigned slot.

## Blocked by

- [Open the Jump Cluster on one continuous Warden map](09-open-continuous-warden-map.md)

## Specification and baseline

[Unified map with stable semantic zoom](../spec.md) · [Source issue](https://github.com/Submoon/ttrpg-cluster-control/issues/4)

User stories covered: 7–9, 51, 57.

Planning baseline: `dc5edb282087458c1bc6dd26287c96a974662c3b` (`main` and `origin/main` after fetch on 2026-11-16). The local planning checkout retains the prototype branch. Implement against the application baseline after refreshing it.

## Acceptance criteria

- [ ] Opening a supported standalone system file as a copy shows its complete envelope as a placement preview. The Warden chooses its anchor on the map, including where envelopes overlap.
- [ ] Accepting adds an independent copy through the existing import workflow. It keeps internal object positions, Orbit geometry and relationships at the common scale. The chosen anchor and layout survive save and reload.
- [ ] Cancel or an invalid/stale import leaves the active Cluster and existing systems unchanged. A complete Cluster backup still uses the separate restore workflow, retains saved anchors and establishes a fresh history baseline.
- [ ] Verify one legacy system with distant content and a rotated Orbit through import admission, preview, acceptance and reopen. Verify cancellation before confirmation.
