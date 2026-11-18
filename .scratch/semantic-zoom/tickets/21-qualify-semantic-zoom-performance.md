---
title: "Measure and improve semantic zoom performance"
status: in-progress
assignee: Codex
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 21 — Measure and improve semantic zoom performance

## What to build

Qualify the continuous map's interaction performance on representative laptop and smartphone hardware. Improve any confirmed cause of missed targets and record the results on the changed candidate.

## Blocked by

- [Select and move an object group across systems](13-move-group-across-systems.md)
- [Transfer a hosted orbital branch to another system](14-transfer-hosted-orbital-branch.md)
- [Inspect shared Jump Routes in the player views](17-inspect-shared-player-routes.md)

## Specification and baseline

[Unified map with stable semantic zoom](../spec.md) · [Source issue](https://github.com/Submoon/ttrpg-cluster-control/issues/4)

User stories covered: 5, 12, 58.

Planning baseline: `dc5edb282087458c1bc6dd26287c96a974662c3b` (`main` and `origin/main` after fetch on 2026-11-16). The local planning checkout retains the prototype branch. Implement against the application baseline after refreshing it.

## Acceptance criteria

- [ ] Use production builds on a typical laptop and a physical mid-range smartphone. Cover 5 systems with 50 objects and 10 systems with 200 objects, counting stars. Include dense and sparse neighbors, overlaps, concurrent detail, distant geometry, routes and a five-link Orbit branch. Exercise the Warden, preview and reader with applicable public data.
- [ ] Measure sustained pan and zoom, first reveal, repeated threshold crossings, neighboring systems, selection and detail settling. Use laptop mouse/wheel and trackpad and phone touch pan and pinch. Record device, browser, viewport, refresh rate, routes, Orbits, visible object counts and visible labels.
- [ ] Compare measured frame pacing with the 60 fps target in both scenes on both devices. Check regular motion, no visible freeze longer than 100 ms during input, selection feedback under 100 ms, and detail settled under 200 ms after zoom input ends.
- [ ] Keep frame interval distributions, longest pauses, input and settle timings, and observed smoothness tied to the tested revision and fixture. Isolate initial rendering from gesture timings. Recheck relevant behavior after changes and report any target still unverified or missed.
- [ ] Use actual device measurements for the hardware acceptance. Compact emulation may supplement gesture and layout checks.
