---
title: Place a circular Orbit by touch with pinch resumption
status: open
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 02: Place a circular Orbit by touch with pinch resumption

## What to build

Let the Warden place a circular Orbit by dragging with one finger in Add Orbit. The Warden can switch to two-finger navigation during the preview and resume placement around the same target after the pinch.

## Blocked by

[Place a circular Orbit by mouse or pen](01-place-orbit-by-mouse-or-pen.md) delivers the shared target resolution, preview geometry, and guarded creation path this ticket uses.

## Specification

[Add Orbit drag placement](../spec.md) defines the approved behavior, baseline, and test boundaries.

## Acceptance criteria

- [ ] A one-finger drag on a valid Add Orbit target uses the same fixed target, circular sizing, minimum radius, and painted ring gap as mouse and pen. A pause keeps the press reserved, and a tap below the drag threshold retains the existing tap and host chooser behavior.
- [ ] A second contact during the drag suspends placement and gives the camera control. When one contact remains, the preview immediately recalculates from that contact's position and the new zoom around the original target.
- [ ] A new one-finger movement is required before release can commit after the pinch. Lifting both fingers without that movement creates no Orbit. After movement, a valid release creates exactly one Orbit with the last valid preview geometry, including outside the map or over a control, and keeps Add Orbit armed. Canceled or stale gestures create no Orbit and cannot trigger a follow-on activation.
- [ ] Tests at the gesture controller boundary cover suspension, recalculation, the movement gate, and cancellation. Playwright exercises second-contact takeover, one-contact resumption, and the outcomes with and without renewed movement. Reuse an appropriate browser journey to stay within the 100-case budget.
