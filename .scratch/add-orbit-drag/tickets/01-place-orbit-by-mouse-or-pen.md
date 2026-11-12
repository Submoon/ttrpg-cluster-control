---
title: Place a circular Orbit by mouse or pen
status: closed
closed_on: 2026-11-09
assignee: /root
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 01: Place a circular Orbit by mouse or pen

## What to build

Let the Warden size a circular Orbit around an object host or unoccupied center by dragging on the star system map with a mouse or pen. The gesture shows the adjusted ring and places exactly that Orbit on release.

## Blocked by

None. Start from the [specified worktree baseline](../spec.md#baseline) with the tested local overlap fix and its regression coverage preserved.

## Specification

[Add Orbit drag placement](../spec.md) defines the approved behavior and test boundaries.

## Acceptance criteria

- [x] The gesture starts only in Add Orbit on a valid target. It fixes the closest eligible host at the initial press, favors the frontmost visible host on a tie, or uses an unoccupied center offered by the existing resolver. Pausing keeps the press reserved. Releasing before the movement threshold follows the existing click behavior and host chooser.
- [x] The preview uses the pointer's distance from the fixed center in scene units for both radii, with zero rotation and the target's existing minimum. Near a concentric circular Orbit, it shows the nearest available radius that leaves about four screen pixels between painted strokes at the current zoom, favoring the outer radius on a tie. Numeric Placement values remain available for the form.
- [x] A valid release creates exactly one Orbit matching the last valid displayed geometry, including outside the map or over a control. It consumes follow-on activation, keeps Add Orbit armed, and records one action through the existing guarded creation and history path.
- [x] Escape, focus loss, pointer cancellation, or a map change abandons the preview. Escape leaves Add Orbit armed while the map stays open. A stale or invalidated preview produces no Orbit and never substitutes different geometry on release.
- [x] Geometry and controller tests cover target ordering, radius, minimum, snapping, and single publication from a valid preview. Playwright exercises a drag and release over a control and compares the displayed and committed geometry. Existing numeric placement and three-click overlap regressions still pass.

## Resolution

Mouse and pen placement now share one circular preview and guarded creation path. Wheel zoom pauses during an active drag to keep the rendered gap consistent with the preview. The overlap fix remains a separate prerequisite commit.

The pure suite and the seven focused Playwright scenarios passed. The first browser pass exposed a test coordinate captured before the toolbar reflowed. The focused retry verified the actual release target, the committed circle, and cancellation with emulated Chromium pen input. The complete browser suite was not run.
