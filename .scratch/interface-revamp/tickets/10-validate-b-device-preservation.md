---
title: Validate the selected B direction on representative devices and preservation flows
status: open
label: wayfinder:task
type: task
mode: HITL
parent: ../map.md
---

## Parent map

[Revamp the interface: make the map central on desktop and mobile](../map.md)

## Question

Which physical-device, accessibility, and state-preservation guarantees can be demonstrated by the accepted B direction before final library adoption, and which guarantees require later production integration evidence?

## Context and scope

Created on 2026-10-14 to retain explicit missing evidence from [Interface prototype evidence and comparison plan](../prototype-evidence.md). Baseline: `629d2a98715c3a16b954e0f77c639b1f0c31212c`, confirmed by the root's fresh fetch on 2026-10-14, `main == origin/main`, zero ahead/behind. Refresh the baseline and [Revamp the interface](https://github.com/Submoon/ttrpg-cluster-control/issues/3) when claiming. No physical-phone, virtual-keyboard, touch-gesture, complete accessibility or production-storage acceptance has been established by the browser emulation runs.

The human has already chosen B, with full-height mobile Inspect, mutually exclusive mobile Inspect/Hierarchy, removal of the pictured utility toolbar and LIVE MAP badge. Do not require another design approval. The mobile inspector covers the map while open; hiding/reopening must preserve editing and map state. Desktop retains independently navigable map editing. This explicit mobile amendment supersedes the earlier simultaneous mobile-pan presentation assumption, not domain/draft/save guarantees.

## Required evidence and artifact

Write `../research/b-device-preservation-evidence.md`. Record exact capture, physical device/browser/OS versions, data/scenes, actual actions and observations, screenshots where useful, failures, simulated behavior and unmeasured limitations. Human participation supplies physical-device access/observations where unavailable to the agent; it is not a new vote on the layout.

- Use dense populated Jump Cluster and star system scenes on representative desktop and a modest physical phone. Cover portrait, landscape/short viewport, virtual keyboard and safe areas in both themes. Measure the actually visible map area in map mode and full-height editor geometry in Inspect mode; verify internal scroll, Hide, close/reopen and reachable actions/status.
- Exercise every mobile Inspect/Hierarchy opening path, accepted selection/context transitions and desktop-to-mobile reflow. Demonstrate exclusivity, same-target reopening, dirty-draft Apply/Discard/Stay, refusal/invalid Apply preserving the prior panel and draft, and no stale selection. Keep hierarchy initially closed and placement-type catalogue distinct from existing-entity selection.
- Demonstrate touch/pinch/second-contact cancellation, keyboard and single-pointer alternatives, target indication/ambiguity/invalid rejection, targeted one-shot Add and persistent Move/Modify under the resolved interaction contract. Desktop pan/zoom while editing and mobile hide-to-map navigation must preserve session work and prior applied data.
- Review focus/scroll restoration, modal confirmation containment/return, icon names/help, non-color states, measured contrast/focus/target criteria, and screen-reader/color-blindness observations. Coordinate the separate accessibility request; do not claim a full audit or conformance from a small representative sample.
- Cover object/Orbit/Jump Route/chart/field drafts, hidden ownership and dependency conflict guards; native/custom definition types/options/applicability and affected-value review; cancellation and renewed destructive review after Apply; import/cascade-deletion previews and validation refusal. Record unsupported stubbed flows separately from domain command evidence.
- Exercise clean full-scene SVG/PNG for both maps, active/print palettes, dense/off-viewport geometry and active draft/gesture conditions: output excludes temporary decoration/unapplied work and preserves live context/view/tool/theme/draft. Capture actual files and visually inspect them.
- Separate in-memory Apply from durable saving/error/Retry/current JSON/reload/recovery. The prototype's simulated saves cannot prove real IndexedDB ordering, latest-snapshot Retry, backup restoration or full functional parity. Identify exact remaining production acceptance scenarios without connecting the disposable prototype to the user's real storage or implementing the production revamp in this evidence task.

## Resolution criteria

The artifact distinguishes executed representative checks, observed failures, unsupported disposable behavior, and later product-acceptance requirements. Closing this task records an honest completed investigation, not automatic passage of every gate. Essential unknowns that prevent final adoption require a precise follow-up dependency. [Confirm Nuxt UI adoption from prototype evidence](08-confirm-nuxt-ui-adoption.md) owns the subsequent live library decision.

## Blocked by

- [Choose a map-first UI direction through desktop and mobile prototypes](04-map-first-ui-direction.md) — **closed**, final capture and resolution supply the accepted presentation contract.

## Notes

Apply `wayfinder` and suitable browser/accessibility tools; claim before work. This ticket is open and unclaimed. Do not start it automatically during the current prototype-retouch session. Browser resizing is not physical touch or a virtual-keyboard test. Preserve application data and existing contracts; all project documentation is English. No GitHub writes or production implementation.
