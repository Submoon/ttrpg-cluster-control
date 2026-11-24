---
title: "Measure and improve semantic zoom performance"
status: closed
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

Qualify continuous-map interaction performance across representative scenes and the Warden and player surfaces. Improve confirmed causes of missed targets and record results on the changed candidate. Record any user-approved change to the hardware qualification scope.

## Dependencies (completed)

- [Select and move an object group across systems](13-move-group-across-systems.md)
- [Transfer a hosted orbital branch to another system](14-transfer-hosted-orbital-branch.md)
- [Inspect shared Jump Routes in the player views](17-inspect-shared-player-routes.md)

## Specification and baseline

[Unified map with stable semantic zoom](../spec.md) · [Source issue](https://github.com/Submoon/ttrpg-cluster-control/issues/4)

User stories covered: 5, 12, 58.

Planning baseline: `dc5edb282087458c1bc6dd26287c96a974662c3b` (`main` and `origin/main` after fetch on 2026-11-16). The local planning checkout retains the prototype branch. At comparison time, the application base was `6f2ce0690c344cbb6052a785cba672481d47032` and `origin/main` was `48873799dac97b84856db676176b5c6b869b5620`.

## Acceptance criteria

- [x] Qualify the production web build on both representative scenes and all three surfaces: Warden, Player Preview and Player Reader.
- [x] Measure mouse pan and wheel zoom, reveal and collapse thresholds, neighboring systems, selection feedback and detail settling. Record the tested browser, viewport, refresh estimate, fixture contents and visible marks.
- [x] Compare results with the 60 fps aim, 100 ms gesture-freeze limit, 100 ms selection-feedback target and 200 ms detail-settling target; record remaining misses.
- [x] Tie frame intervals and interaction timings to the tested revision and fixtures, separate initial render from gesture timings, and recheck the confirmed hotspot after the change.
- [x] On 2026-11-24 the user waived physical-mobile acceptance to finish on web measurements. No physical-phone result is claimed. Manual trackpad input was not separately measured.

## Resolution

The user waived physical-mobile acceptance on 2026-11-24 and accepted web-only closeout. The ticket closes with desktop browser results and remaining misses recorded below; no physical-device performance is certified.

## Qualification result

The production web candidate was revision `f4e1cff97cae2ec92b76812bef4c5899dd9199ff`, following comparison revision `6f2ce0690c344cbb6052a785cba672481d47032`. Automated mouse measurements ran on Windows at 1440 × 900, device-pixel ratio 1, in headless Chrome 158.0.8127.38 and Playwright Firefox 157.0. The idle frame estimate was approximately 60 Hz. Each repeated browser run recorded 18 reports across the two scenes, three surfaces, and pan, wheel, and selection scenarios.

| Scene | Systems | Catalogue objects | Visible objects / Orbits / routes / labels across sampled views |
| --- | ---: | ---: | --- |
| Reference | 5 | 50 | 0–44 / 0–14 / 2–3 / 4–51 |
| Demanding | 10 | 200 | 0–131 / 0–16 / 3 / 8–139 |

Both fixtures included dense and sparse neighbors, overlaps, concurrent detail, distant geometry, Jump Routes and a five-link Orbit branch. Stars count toward the catalogue-object totals.

| Measure | Chrome 158 | Firefox 157 |
| --- | --- | --- |
| Repeated mouse pan and wheel pacing | 59.9 fps across the measured surfaces and scenes | 53.1–59.9 fps |
| Longest gesture frame interval | 17.5 ms in the repeat run; 22.3 ms in the earlier pass | 33.42 ms in the repeat run; 86.32 ms in the earlier pass |
| Maximum wheel-settle time | 168 ms in the repeat run; 168 ms in the earlier pass | 164 ms in the repeat run; 176 ms in the earlier pass |

Selection feedback measurements below are reference / demanding scene in milliseconds:

| Surface | Chrome 158 | Firefox 157 |
| --- | ---: | ---: |
| Warden | 114.7 / 81.5 | 47 / 48 |
| Player Preview | 39.4 / 48.5 | 65 / 90 |
| Player Reader | 50.1 / 68.4 | 54 / 147 |

The ignored local directory `test-results/semantic-zoom-web-qualification/` contains `21-automated-f4e1cff9-repeat.json` and `21-automated-firefox-f4e1cff9-repeat.json`. The demanding Preview traces are `21-demanding-preview-6f2ce069-selection-chrome-trace.json`, `21-demanding-preview-f4e1cff9-selection-chrome-trace.json`, and `21-demanding-preview-f4e1cff9-selection-repeat-chrome-trace.json`. To rerun against a production server, set `SEMANTIC_CHECK_ORIGIN`, `SEMANTIC_CHECK_REVISION`, `SEMANTIC_PROFILE_UNFLAGGED=1`, and `SEMANTIC_PROFILE_SAMPLE=repeat`, then run `node test-results/semantic-zoom-web-qualification/run-web-qualification.mjs`.

The demanding Preview trace isolated avoidable layout work after an Inspector content swap. Selection-to-feedback improved from 169.5 ms on revision `6f2ce069` to 78.3 ms on the first `f4e1cff9` profile and 52.6 ms on its repeat. Click dispatch fell from 164 ms to 46 ms, and the longest synchronous layout fell from 56 ms to 26 ms. `PlayerDocumentView` now invalidates map usable-area measurements for obstruction changes and relevant ancestor changes, observes obstruction dimensions, and ignores unrelated Inspector descendants. A subsequent SVG selector type annotation changed no runtime behavior. The existing Chrome Player Preview/publication and Player Reader journeys passed; the browser case count stayed at 20.

The 60 fps figure remains an aim. Firefox did not meet it in every sampled case. The 100 ms gesture-freeze bound and 200 ms detail-settling bound were met in the recorded gesture samples. Selection feedback still exceeded 100 ms for the reference-scene Warden selection in Chrome (114.7 ms) and the demanding-scene Player Reader selection in Firefox (147 ms). These are reported desktop-web exceptions.
