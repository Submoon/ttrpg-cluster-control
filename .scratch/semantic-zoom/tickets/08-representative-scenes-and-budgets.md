---
title: Choose representative scenes and interaction budgets
status: closed
label: wayfinder:grilling
type: grilling
mode: HITL
parent: ../map.md
assignee: Codex
---

# Choose representative scenes and interaction budgets

## Question

What representative map sizes, nesting depths, object densities and devices should determine whether the unified zoom is usable?

Choose ordinary and demanding scenes, the relevant desktop and mobile inputs, and observable expectations for camera response, reveal transitions and targeting. Translate the source issue's acceptable-performance requirement into explicit criteria that can guide the prototype and subsequent implementation validation.

Include a dense system beside a sparse one, an extended orbital branch, several simultaneously detailed systems and touch zoom. Establish the evaluation scenes before choosing numeric thresholds or renderer optimizations.

## Context

[The source map](../map.md) includes the Warden editor, player preview and player reader. Their disclosed content differs, and all three should be evaluated against their applicable scenes. The source issue explicitly requires mobile touch zoom.

## Blocked by

None.

## Resolution

Confirmed by the user on 2026-11-13. The source issue and comments were refreshed before resolution. Main and this worktree were fast-forwarded to `9ab9cd782abde0968348fcb283079fa9941111a5`, preserving local planning and glossary edits. HEAD, main and origin/main matched this baseline.

### Existing evidence

- The generated [Global Search Atlas](../../../tests/workspace-global-search.spec.ts) contains 20 systems and 520 catalogue objects, including stars, with no Orbits or Jump Routes. It supplies a data-volume reference from a search regression.
- [Deep Readability Atlas](../../../tests/fixtures/workspace-hierarchy-deep.json) contains one system, eight objects and six Orbits, with a deepest chain of five host-to-occupant Orbit links. [Branch Atlas](../../../tests/workspace-object-search.spec.ts) exercises extended geometry, rotated ellipses and distant objects.
- Existing [touch checks](../../../tests/workspace-touch-takeover.spec.ts) exercise compact Chromium at 390 by 844 and simulate pinch through CDP. Desktop checks use 1440 by 900 or 960. The [interface revamp specification](../../interface-revamp/spec.md) names physical Android Chrome as its touch target.
- Prior [revamp measurements](../../interface-revamp/finalization.md) use a small two-system campaign. Frame pacing and latency for unified semantic zoom remain to be measured.
- The [player codec](../../../domain/player-codec.ts) defines admission limits for public documents. Performance targets for the chosen scenes require their own measurements.

### Devices

The user selected a typical laptop and a mid-range smartphone. Inputs include mouse/wheel and trackpad on the laptop, and one-finger movement and two-finger pinch on the phone. Specific device models and browser versions have not been named.

### Scenes

| Scene | Systems | Total catalogue objects |
| --- | --- | --- |
| Reference | 5 | 50 |
| Demanding | 10 | 200 |

Stars are included in the object totals. These are the user-confirmed evaluation volumes. Build scene variants that exercise the spatial-layout and ownership decisions, including dense and sparse neighboring systems, overlapping envelopes, several visible groups and nested orbital branches.

As a fixture-composition choice, reuse the existing five-link orbital branch and extended-geometry cases within these volumes. Record the resulting Orbit and Jump Route counts and the object distribution in the prototype artifacts. Their numeric composition can be adjusted while retaining the selected totals and scenario coverage.

### Interaction targets

| Interaction | Confirmed target |
| --- | --- |
| Sustained pan and zoom | Aim for 60 frames per second on both devices in both scenes |
| Camera continuity during a gesture | Regular movement with no visible freeze longer than 100 ms |
| Click or tap selection | Visible selection feedback in under 100 ms |
| Semantic detail after zoom | Detail stabilizes in under 200 ms after zoom input ends |

The camera responds throughout the gesture. All four device/scene combinations use the 60-frame-per-second target. Evaluate the Warden editor, player preview and player reader against these targets on their applicable scene content.

### Measurement and prototype handoff

- Record device model, browser/version, viewport and display refresh rate when measuring. Record the source scene counts and the visible object, Orbit and label counts for each camera segment and surface.
- Start gesture measurements after scene admission and initial rendering. Include first entry into previously coarse groups, repeated crossings of detail thresholds, panning between neighboring systems and sustained wheel/trackpad or pinch input. Report initial-load time separately if measured.
- Capture frame intervals, observed frame rate and pauses during active gestures, together with selection and detail-settling delays. A 60-frame-per-second cadence corresponds to approximately 16.7 ms per frame. Report timing distributions and the longest pauses alongside the human assessment of smoothness.
- Keep prototype measurements tied to the exact scene and device used. Physical-phone results remain to be collected. Compact-browser emulation supplies layout and gesture checks, and hardware-specific performance requires measurement on the named phone.
- Prototype feedback determines whether the selected detail rules meet the targets and which rendering work needs adjustment. These are design targets awaiting observed evidence.
