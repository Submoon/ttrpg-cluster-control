---
title: "Place the anchor of an imported standalone system"
status: closed
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

- [x] Opening a supported standalone system file as a copy shows its complete envelope as a placement preview. The Warden chooses its anchor on the map, including where envelopes overlap.
- [x] Accepting adds an independent copy through the existing import workflow. It keeps internal object positions, Orbit geometry and relationships at the common scale. The chosen anchor and layout survive save and reload.
- [x] Cancel or an invalid/stale import leaves the active Cluster and existing systems unchanged. A complete Cluster backup still uses the separate restore workflow, retains saved anchors and establishes a fresh history baseline.
- [x] Verify one legacy system with distant content and a rotated Orbit through import admission, preview, acceptance and reopen. Verify cancellation before confirmation.

## Resolution

The standalone import stages an independently remapped system and its full geometry on the continuous Cluster canvas. The Warden can choose an anchor, frame the preview, and proceed through the existing review and atomic save. The preview stays outside committed hit targets, Search results, Fit bounds, and image exports.

- The final source at `d01cc0f4af728edfb466bbad0438b23af78a9ff9` passed the Vue type check and a standard production build. The scoped admission and history suite passed all 21 pure tests. Independent interaction and persistence reviews confirmed context invalidation, history blocking, reachable framing controls, and held-contact release suppression.
- Chrome opened a version 3 system with a distant 4200 by 1900 Orbit rotated by 31 degrees, framed the detached Orbit and envelope, canceled one review, and accepted a new anchor without changing an unrelated chart draft. The copied identity, chosen anchor, radii, and rotation survived save and reload. During placement, arrows moved the camera, Undo and its shortcut stayed blocked, and Escape restored the armed tool.
- A separate Chrome journey held the primary button in reachable empty space, pressed Escape, and released. The existing system count stayed unchanged. A fresh click at the same position added the next system, verifying that the stale release and the fresh contact were distinguished.
- Two other Chrome journeys passed against the same production source. A write failure closed the completed review and Retry persisted the single applied copy. Complete backup validation and restore still use the existing replacement path.

The managed development verification first encountered a stale local process and later invalidated its result on an unidentified file event. The recorded browser results use the frozen production build. The initial held-contact fixture placed its fresh click in an occupied system envelope. The passing fixture isolates the contact sequence in an empty part of a single-system scene.
