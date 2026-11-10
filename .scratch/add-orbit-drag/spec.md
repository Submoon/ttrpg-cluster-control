---
title: Add Orbit drag placement
status: open
scope_status: approved
testing_seams_status: approved
testing_seams_approved_on: 2026-11-06
ticketing_status: published
ticketing_approved_on: 2026-11-06
triage_labels:
  - enhancement
  - ready-for-agent
---

# Add Orbit drag placement

## Source issue

[Set Orbit width by dragging during placement (#42)](https://github.com/Submoon/ttrpg-cluster-control/issues/42) was fetched on 2026-11-06. It is open, labeled `enhancement`, and has no comments. This specification covers the approved **Add Orbit drag** section. The consecutive placement overlap regression is a separate work item within the same issue.

## Baseline

`origin/main` and local `main` were at `7e4f6049dae7ab23b952316ab238410c2a714f0f` after fetching. The worktree advanced from planning revision `19e4532ca2de3c0906214faa64ab62a6874269b0` without changing the overlap patch. The ticket 01 baseline is `0b476f22d60975dfbb5da681fcbf25700c91a43d`, which adds the tested overlap fix and its regression coverage to `origin/main`.

## Problem Statement

The Warden can place an Orbit by clicking or entering its geometry in Placement. They need to size a circular Orbit directly on the star system map, see its final size, and place it with the same gesture.

## Solution

In Add Orbit, hold a valid target and drag with a mouse, pen, or one touch contact. The preview follows the radius around that fixed target and adjusts for nearby concentric rings. A valid release places the displayed circle and keeps Add Orbit armed.

## User Stories

1. As a Warden, I want to start at an object host or an unoccupied center so I can size the Orbit around the intended target.
2. As a Warden, I want to see the adjusted circle before release so I know which Orbit will be saved.
3. As a Warden, I want to navigate with two fingers and resume sizing around the same target so I can change my view during placement.
4. As a Warden, I want to cancel an unfinished gesture and keep click, tap, and numeric placement available so I can choose how to add the next Orbit.

## Implementation Decisions

- **Press and threshold.** Only Add Orbit owns the new gesture. Resolve the target at the initial press. Among eligible object hosts, choose the closest to the press in scene coordinates and use the frontmost visible host on a tie. Otherwise use an unoccupied center if the existing resolver offers one. Keep the target reserved during a pause and fixed during the drag. Release below the movement threshold follows the existing click or tap path, including the chooser for ambiguous hosts.
- **Preview geometry.** Convert the pointer through the current map transform. Use its distance from the center for both radii, apply the target's existing minimum, and use zero rotation. Resolve any normalization before showing the preview. If the proposed ring is too close to an existing concentric circle, use current committed geometry to find the closest radius that leaves about four screen pixels between the painted strokes at the current zoom. Prefer the outer radius on a tie. Show only the adjusted ring and retain the numeric Placement inputs.
- **Touch navigation.** During a drag, a second contact suspends placement and gives the camera ownership. When one contact remains, retain the original target and immediately recalculate the preview using that contact and the new transform. Require a new one-finger movement before release can commit. Lifting both fingers without that movement cancels placement.
- **Release and cancellation.** A valid release commits exactly one Orbit with the last valid displayed geometry, including outside the map or over a control. Consume the matching release and follow-on activation so it cannot also trigger a control or click placement. Escape, loss of focus, pointer cancellation, or a map change discards the gesture and its preview. Escape keeps Add Orbit armed if the map remains open.
- **Ownership and publication.** The mounted map owns pointer and navigation arbitration. The Add controller owns the provisional target and geometry. Release uses the existing guarded creation and history path with the captured preview. Recheck session, target, and geometry against the current workspace before publishing. If the preview is no longer valid, discard it without substituting another geometry. A successful gesture is one history action through the existing workspace writer.

## Testing Decisions

- **Geometry and controller tests.** Use explicit inputs to verify target ordering, radius and minimum, and the nearest allowed gap at controlled zooms. Exercise the Add command with the real controller to verify cancellation, rejection of stale previews, exact preview-to-commit geometry, and one publication.
- **Playwright.** Verify a pointer drag and release over a control using rendered preview and committed geometry. Exercise second-contact takeover, one-contact resumption, and release with and without renewed movement. Reuse the existing creation and gesture test coverage where appropriate and keep the browser suite within its 100-case limit. Retain the separate three-click overlap regression and numeric placement coverage.

## Out of Scope

Changes to the consecutive placement overlap fix, existing Orbit editing, numeric Placement semantics, or saved workspace formats.

## Further Notes

1. [Place a circular Orbit by mouse or pen](tickets/01-place-orbit-by-mouse-or-pen.md)
2. [Place a circular Orbit by touch with pinch resumption](tickets/02-place-orbit-by-touch.md)
