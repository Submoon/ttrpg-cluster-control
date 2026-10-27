---
title: Implement the first available map-positioning tickets
status: in-progress
---

# Implement the first available map-positioning tickets

The user authorized coordinated implementation by subagents of tickets 01, 02, 04 and 06 on 2026-10-27 through the implement skill. Tickets 03 and 05 are not included. No push, PR, merge, remote issue change or cross-chat message is authorized.

## Baseline and execution boundary

- Fetched origin before implementation; HEAD, origin/main and main are 9edfa66c4f505d56f106fc4af8245f200abfba78 with no divergence.
- Branch: codex/map-positioning-first-frontier, created in this chat's formerly detached worktree. Unrelated environment files and other worktrees are preserved.
- The product scope and test seams remain those approved in the [specification](spec.md); the [ticket index](ticket-plan.md) defines the approved dependencies.
- Architect before implementation, at most two concurrent writers, followed by integrated checks and independent Standards/Spec review plus complementary persistence/domain review. The coordinator owns Git, runtime, shared integration and final commit.
- Dedicated development runtime: port 3127. Existing services on other ports are not managed by this effort. Tests use the established public editor and pure geometry/format seams with red-before-green cycles.

## Writer sequencing and ownership

- Wave 1: ticket 02 owns Cluster rendering/geometry, unresolved-target controller and durable layout/format/lifecycle behavior; ticket 04 owns system-object rendering/placement, free-object fields and independent object-draft position behavior.
- Wave 2: ticket 01 owns Cluster-system map placement after ticket 02 releases the renderer; ticket 06 owns unoccupied Orbit-center placement after ticket 04 releases system renderer and entity-session/map-workflow files.
- This sequencing prevents shared-file edits; it does not add ticket blockers to the approved graph.
- Coordinator-exclusive integration: feature composition, editor page, canvas wrapper, Dock wrapper, shared workflow types and editor command context if needed. Writers request precise wiring instead of editing these files concurrently.

## Architecture contracts

- Specialized controllers use consistent move-target and move-nudge events in raw SVG scene coordinates and a moveTargeting flag. Do not reuse the normalized/clamped Cluster-system Add target for exits.
- Canvas captures arrows before ordinary pan only during active movement. Armed clicks are consumed before ordinary selection/Add. Move start focuses the map; completion/cancellation leaves reachable focus.
- Unresolved-target layout is optional, keyed by route ID, with absolute scene-space points. Missing data uses legacy automatic placement. Validate ownership and derived geometry; remap imports and prune on resolution, direct/dependent deletion and route pruning.
- Geometry and export share committed positions; temporary preview overrides remain transient. Far-scene Fit and bounded PNG output remain ticket 03.
- Trusted position-only publication may rebase only positional Inspector baselines/dependency snapshots. Keep draft strings, errors and session identity, plus real property/relationship stale guards. Object free-to-free and unoccupied Orbit-center movements are independent of unrelated drafts; intentional attachment changes remain guarded.
- Keep occupant-angle controls and existing Orbit-occupant alternatives until ticket 05. Remove each targeted numeric-field family only with its map-based replacement.

## Completion requirements

Each selected ticket must satisfy its criteria, meaningful targeted tests and integrated review. Run lint/typecheck during development and the complete suite once on the integrated candidate; build for the integration/SSR check. Fix confirmed review findings and obtain closure before marking tickets complete. Commit the authorized result on this branch; do not push it.

## Integration checkpoint

- All four writers have delivered their implementations and focused checks. The integrated sources are frozen at candidate 7d7cbf0751effaeb24a066d817fe354168ecc113; the full suite and review corrections remain completion gates.
- Both writer waves have released their shared files. The coordinator owns final integration, source-freeze boundaries and any correction dispatch.
- Keyboard creation is required when numeric creation positions are removed. Both map families use their existing candidate/validation paths with the current visible map center, rather than an arbitrary fallback location.
- Explicit positional editing must win over background pan while armed; right-button/two-contact navigation takeover still cancels and navigates. Invisible endpoint hit areas are removed from export.
- A separate Orbit-center preview channel avoids collisions with Inspector host-preview ownership and inherits latest applied size/orientation.
- Integrated typecheck, lint and whitespace checks passed. The complete 248-test suite finished against the dedicated development runtime; production build follows the affected retests so generated build artifacts do not disturb the live test server.
- Independent Standards, Spec and complementary persistence/domain reviews are recorded in [review.md](review.md). Two unique P2 defects require correction: preserving explicit Orbit relationship guards and exposing refused free-movement feedback. The deep review's stale nested-host snapshot sequence is supporting evidence for the same guard defect.
- The initial local implementation commit exists for stable comparison. Corrections, affected retests, reviewer closure and completion records remain pending; no remote action has been taken.

## Integrated verification record

- The complete suite ran once on the initial frozen source candidate: **242 passed, 6 failed, 248 total**, in 30.6 minutes. Report: `test-results/first-frontier-full/report.json` (ignored runtime artifact).
- Failures to resolve: missing export-blob initialization in the adapted nested-map test; a screen-to-scene rounding assertion in the elliptical-Orbit test; Add chooser setup in the clean-save test; the two comprehensive catalogue/field-definition journeys reaching the 30-second test limit; one cold prepared-campaign opening not completing before its assertion deadline.
- The rounding check now compares the actual committed center before/after Apply, preserving the existing pointer-target tolerance. The export test initializes its normal capture seam. The clean-save setup explicitly closes the Add chooser before opening Placement.
- The two comprehensive journeys retain every assertion and use the runner's per-test slow annotation: one exercises all fifteen catalogue entries, and the other edits six field definitions and creates objects across two systems. The full-run snapshots showed completed prior steps rather than a stuck individual operation. Affected runs must still finish successfully before completion.
- The correction owner reproduced both review findings with failing public journeys before changing production source. The proposed-host test observed a real host move, while the refusal test found no visible error. Geometry-only draft independence is covered separately to avoid restoring an overly broad guard.
- Final affected results, build and reviewer closure are pending below.
