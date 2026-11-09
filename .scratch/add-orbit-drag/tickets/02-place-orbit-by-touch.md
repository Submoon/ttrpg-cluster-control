---
title: Place a circular Orbit by touch with pinch resumption
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

# 02: Place a circular Orbit by touch with pinch resumption

## What to build

Let the Warden place a circular Orbit by dragging with one finger in Add Orbit. The Warden can switch to two-finger navigation during the preview and resume placement around the same target after the pinch.

## Blocked by

[Place a circular Orbit by mouse or pen](01-place-orbit-by-mouse-or-pen.md) delivers the shared target resolution, preview geometry, and guarded creation path this ticket uses.

## Specification

[Add Orbit drag placement](../spec.md) defines the approved behavior, baseline, and test boundaries.

The implementation starts at `b53b618c63f08614988f59384e67022d9c6a4c67` on `codex/add-orbit-drag`, which includes ticket 01 and the separate overlap fix. The fetched `origin/main` was `7e4f6049dae7ab23b952316ab238410c2a714f0f`.

## Acceptance criteria

- [x] A one-finger drag on a valid Add Orbit target uses the same fixed target, circular sizing, minimum radius, and painted ring gap as mouse and pen. A pause keeps the press reserved, and a tap below the drag threshold retains the existing tap and host chooser behavior.
- [x] A second contact during the drag suspends placement and gives the camera control. When one contact remains, the preview immediately recalculates from that contact's position and the new zoom around the original target.
- [x] A new one-finger movement is required before release can commit after the pinch. Lifting both fingers without that movement creates no Orbit. After movement, a valid release creates exactly one Orbit with the last valid preview geometry, including outside the map or over a control, and keeps Add Orbit armed. Canceled or stale gestures create no Orbit and cannot trigger a follow-on activation.
- [x] Tests at the gesture controller boundary cover suspension, recalculation, the movement gate, and cancellation. Playwright exercises second-contact takeover, one-contact resumption, and the outcomes with and without renewed movement. Reuse an appropriate browser journey to stay within the 100-case budget.

## Resolution

Touch placement uses the shared circular preview and guarded creation path. Pinching moves the camera while the Orbit geometry stays fixed. When one finger remains, the preview recalculates around the original target at the current zoom. A fresh one-finger movement enables placement again.

The extended touch takeover journey verifies cancellation, resumption, release over Quit Add, and a subsequent tap. Both browser shards ran in Edge, with 98 of 99 scenarios passing on the first pass, including the touch journey and the three consecutive clicks around one host. The standalone player reader timed out waiting for the shared map title and passed on an isolated rerun. The IndexedDB recovery case passed.

The full pure run passed 323 of 325 cases on the first pass. Two timing-sensitive local launcher cases passed on an isolated rerun. Type checking, lint, and Markdown link validation passed.
