---
title: Recover and export distant unresolved exits
status: closed
closed_on: 2026-10-28
assignee: /root/exit_placement
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 03: Recover and export distant unresolved exits

**What to build:** Let the Warden arrange unresolved-exit targets beyond the initial canvas, recover the entire applied scene through pan and Fit, and export it completely as vector SVG or a manageable-size PNG.

**Status:** closed — implemented and verified.

## Blocked by

- [02 — Move and retain unresolved-exit targets](02-move-and-retain-unresolved-exit-targets.md).

The target-layout and committed-geometry path must exist before its far-scene navigation and output guarantees can be completed.

## Specification and baseline

Parent: [Map-based positioning and movable unresolved-exit targets](../spec.md).

Source: [Allow repositioning unresolved-exit target markers on the Cluster map](https://github.com/Submoon/ttrpg-cluster-control/issues/27); off-canvas placement and bounded whole-scene PNG output were approved in the expanded specification.

Planning baseline: 9edfa66c4f505d56f106fc4af8245f200abfba78. Refreshed implementation base on 2026-10-28: c3c4946644463f5d83dde5436b3c99f04bea1fd1, including the completed blocker; see the [second-frontier record](../implementation-second-frontier.md).

Relevant parent stories: 5–7, 40, 68–69 and 76–85.

## Acceptance criteria

- [x] Valid targets can be placed on either side of the initial canvas, including negative coordinates, and remain at the same map-space point after navigation, reload and JSON round trip.
- [x] Pan can reach placed targets without modifying any committed position.
- [x] Fit includes all applied systems, route geometry, targets and labels, even when a scale below the historical 25 percent floor is required.
- [x] A target and its originating map remain recoverable together; Fit does not merely center oversized bounds while leaving both ends outside the viewport.
- [x] Subsequent pan/zoom and movement continue to use the correct transform after such a Fit operation. No system-placement bounds or other entity constraints are implicitly expanded.
- [x] Off-canvas background/grid presentation remains coherent with the expanded scene.
- [x] SVG exports the whole applied scene as vector content with correct label bounds and no viewport crop.
- [x] PNG exports that same full scene with preserved aspect ratio and bounded output dimensions, reducing resolution when necessary instead of allocating a scene-sized unbounded canvas.
- [x] Export during a live drag or non-drag preview uses the last applied geometry, not the unfinished candidate.
- [x] Selection styling and edit-only hit shapes are excluded from exported appearance; invisible interaction geometry does not incorrectly inflate Fit or export bounds.
- [x] Input and derived geometry/output calculations remain finite and safe. Unsafe data produces defined feedback without publishing partial state or attempting an unbounded raster allocation.
- [x] Ordinary-scene navigation, exports, retained labels and previous movement/recovery behavior continue to work.

## Verification

Exercise distant targets through the public Cluster editor, including a negative location and an extent that cannot fit at the old minimum scale. Verify recovery, subsequent movement, reload/interchange, unchanged committed data during navigation, exported SVG content bounds and PNG dimensions/aspect ratio. Reuse applied-export-during-preview coverage. Use existing pure geometry/validation seams for overflow and unsafe-derived-value cases; select and justify practical output caps without adding a new test-only API.

## Delivery boundaries

This extends the delivered unresolved-target capability, not a standalone generic zoom/export refactor. Exact scene-dependent scale handling, output caps and grid rendering are engineering choices within the approved whole-scene contract. Do not replace it with viewport-only export, a new hard placement rectangle or a global navigation redesign.

Use existing renderer/export ownership and the single workspace writer. Do not implement undo/redo or alter unrelated worktrees.

## Resolution

Implemented scene-dependent Cluster Fit below 25 percent, preserved visit scale and whole-viewport grid/background coverage. Applied targets, paths and labels define Fit and vector export bounds. PNG retains the full scene while capping its edge and pixel area before image decoding or canvas allocation. Admission and preview/drag guards reject unsafe points and derived label/aggregate geometry before publication, without clamping valid off-canvas targets.

Completed on 2026-10-28. Focused pure/public checks, the complete-suite result with affected correction reruns, final lint/typecheck/build and independent review closure are recorded in the [implementation record](../implementation-second-frontier.md) and [review](../review-second-frontier.md). This local closure does not change GitHub issue #27.
