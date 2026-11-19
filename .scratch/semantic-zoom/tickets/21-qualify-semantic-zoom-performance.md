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

## Qualification to date

The current Warden renderer keeps camera changes local during input and starts with folded owner branches. An independent browser check confirmed that each newly selected member becomes visible in its owning branch, and that manual collapse preserves selection. The player renderer caches the drawable size and retains its detail projection while membership stays the same.

A 17-sample automated rehearsal on the Dell Latitude 5520 with headless Chrome 158 and a 1440 × 900 viewport used product revision `5a4e602671336dc99b3d27a752e4327f67ca4ce6`. Demanding-scene wheel zoom averaged 52.1 fps in Warden, 43.6 fps in Preview, and 46.8 fps in the reader. The longest intervals were 66.7, 133.3, and 100.0 ms respectively. Automated pan averaged 60 fps. Captured selection feedback stayed within 14.5 ms and detail settling within 26.9 ms. The demanding Preview still exceeded the freeze limit in this rehearsal.

The [protected device lab](https://ttrpg-cluster-control-4sbv2fkb6-submoon.vercel.app/__map-qualification/index.html) serves the same product revision with synthetic scene files on Preview deployment `429dd38efab40b8655feec78b05f761471742c74`. Physical laptop and Firefox Android qualification is still open.

The activated product revision `f993c51666bb7be7efcab42f19ef1180e76e87f2` excludes SVG repaint records from the player layout observer while retaining actual wrapper and obstruction changes. Its second 17-sample Chromium rehearsal showed demanding-scene wheel averages of 49.7, 51.4, and 44.6 fps, with 66.7 ms as the longest interval on each surface. One demanding Warden selection had a 183.3 ms frame interval. Repeat selections with the corrected timing probe and qualify on the physical devices.

The refreshed Vercel Preview deploys the activated product revision `6e1a4b1d23305839aa305d18416b6bd3a009f34b` as deployment `4c0f3e6fb7dd554a1ee0abc94d4c9ce84098c443`. The updated recorder reads elapsed time as the selection callback runs, and the measurement page uses the normal product entry points. [Device measurement page](https://ttrpg-cluster-control-pd7escs5f-submoon.vercel.app/__map-qualification/index.html)
