---
title: Implement distant exits and Orbit occupant map placement
status: in-progress
---

# Implement distant exits and Orbit occupant map placement

The user authorized coordinated implementation of the remaining local tickets 03 and 05 through the implement skill on 2026-10-28. The previous delivery and its verification remain recorded in [implementation.md](implementation.md).

## Refreshed baseline

- Fetched origin on 2026-10-28. Main and origin/main remain at `9edfa66c4f505d56f106fc4af8245f200abfba78` and need no fast-forward.
- Actual implementation base: `c3c4946644463f5d83dde5436b3c99f04bea1fd1`, three commits ahead and none behind origin/main. This intentionally includes the completed prerequisites 01, 02, 04 and 06.
- Continue on `codex/map-positioning-first-frontier` in this worktree. Preserve unrelated `.codex/environments/` files and other worktrees.
- Re-fetched source issue #27: still open with the enhancement label, unchanged body and no comments. The approved expanded local specification remains authoritative for tickets 03 and 05.
- No push, PR, merge or remote issue/label change is part of this delivery.

## Coordination and verification

- Architect reviews the second-frontier contracts before implementation. At most two implementation writers with disjoint file ownership; coordinator owns shared integration, Git and runtime.
- Ticket 03 extends Cluster scene recovery, Fit/grid and full-scene image export. Ticket 05 extends the existing system-object placement and creation workflow to Orbit occupants and removes remaining position-angle fields.
- Shared integration remains coordinator-owned: `BaselinePage.vue`, `useEditorWorkflows.ts`, `WorkspaceDock.vue`, `WorkspaceMapCanvas.vue`, shared workflow types, unresolved-target preview admission and `tests/helpers.ts`. Writer 03 also owns the shared image-export tests, preserving the coordinator's migrated occupant-preview setup.
- Reuse the approved public editor/interchange/export journeys and existing pure geometry/format seams. Use vertical RED/GREEN slices, retain meaningful independent coordinate oracles and preserve explicit relationship guards.
- Dedicated development server: port 3127. The coordinator owns browser test scheduling and Nuxt generation checks; use unique test output directories.
- Browser checks use the existing system Chrome through `PLAYWRIGHT_CHANNEL=chrome`, with local-network access enabled. No browser or dependency installation is required. Short shared source freezes prevent cross-feature Nuxt HMR from invalidating another writer's browser journey.
- Run typecheck and affected tests during development. Freeze the integrated source, run the full suite once, then fix and rerun affected failures. Final lint/typecheck, production build, independent Standards/Spec and complementary numerical/persistence review are completion gates.
- Commit the authorized work to the current branch. Local parent completion must not silently close GitHub issue #27.

## Resolution

Pending implementation and verification.

## Integrated candidate and review

- Initial frozen implementation: `84195a14c607483127035569e26b1f6ffc2a8ef6`. Reviewed corrections: `ede5b3b19a1694aa7ba770df687e00e29964cfc4`.
- Public and pure RED/GREEN slices verified sub-25% recovery, negative/distant layout durability, raster bounds, occupant map/keyboard positioning, creation without angle forms and Inspector Apply/transfer/Discard preservation. The initial existing image-export regression passed 10/10.
- Independent Standards, Spec and complementary numerical/persistence reviews are recorded in [review-second-frontier.md](review-second-frontier.md). Both confirmed numerical/surface findings were corrected and closed before the full suite. The correction's pure boundary tests passed 10/10 and public distant tests passed 3/3 including desktop and wide/short viewports.
- The effective-angle duplication suggestion is nonblocking and has no demonstrated behavior defect. No additional ticket 05 blocker was identified.
- Final lint/typecheck passed after the corrections and the explicit unresolved-route type guard. The four affected Cluster image-export journeys passed together after the viewport-space rewrite (`test-results/second-frontier-cluster-images-final/report.json`).
- The complete suite once and production build are the remaining verification sequence. Sources remain frozen throughout browser checks; no second full-suite pass is implied by later affected reruns.

## Complete-suite result and follow-up

The complete suite ran once on `80f0b21462a600bd5b63d75912742299cded3b85` in system Chrome: **263 passed, 1 failed, 264 total**, in 28.4 minutes (`test-results/second-frontier-full/report.json`). There were no retries or skipped tests.

The failure is an actual creation regression in the rotated/nested-Orbit journey. A map-resolved Orbit was retained in the same input field as an explicit control choice, so the next click on a different Orbit was rejected. The ticket 05 owner is separating explicit preference from inferred map outcomes, preserving the existing count, placement, pointer-accuracy and legacy-angle assertions. Affected reruns, correction review and build remain pending; no second full-suite run is claimed.

## Agreed implementation contracts

- Cluster maps expose a reactive `getMinimumZoomScale()` derived from valid applied bounds and the usable viewport. Shared camera helpers accept optional minimums with the existing 0.25 default. The coordinator transports that floor through visit recording, percentage changes and controls; System maps keep their current floor.
- Camera memory preserves raw positive scale. Controls display small percentages with significant digits and keep a one-percentage-point slider step, avoiding zero labels or an unbounded slider step count.
- Fit and image bounds use applied content, exclude edit-only hit shapes and do not grow from the background/grid. The grid covers applied and visible scene extents without entering content measurements.
- PNG output is capped before SVG image decoding and canvas allocation, retaining the full scene viewBox. The working policy is a 4096-pixel maximum edge and 4,194,304-pixel area; the export owner validates safe arithmetic and finalizes the tested policy.
- A local Chrome probe showed that SVG length attributes silently saturate around 33,554,428 even for much larger finite JavaScript coordinates. The agreed conservative renderer safety budget is `2**24 - 4096` scene units, with derived marker/curve/label/padded aggregate geometry checked before publication/import. This is an explicitly documented numerical support policy below the observed platform saturation, not an initial-canvas placement rectangle or a universal-browser precision claim. Unsafe candidates are rejected with feedback rather than clamped; preview admission and live dragging follow the same policy.
- Object movement keeps scene-space target/nudge events. Named Orbit movement projects onto that Orbit; keyboard movement changes the Orbit parameter directly so it works at ellipse extrema. Existing ambiguous drag choices remain explicit.
- Trusted `CommittedObjectPosition` publications carry previous/next placements and effective angles in radians for Orbit placements. Only positional/untouched relationship baselines are rebased; unrelated draft fields and real stale-data/explicit relationship guards remain.
- Creation loses its angle form and required-angle parsing. Explicit logical Orbit selection remains, with map targeting or a valid named default followed by Move. Public test helpers express requested positions by clicking measured ellipse points, without reintroducing a product form or test-only production API.
