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

- Writers for 02 and 04 have delivered their implementations and focused checks and released their shared files. They remain subject to integrated review; their tickets are not closed yet.
- The Cluster-system writer now owns 01, including the shared Cluster renderer. The Orbit-center writer now owns 06, including system renderer and entity-session/map-workflow extensions. The coordinator continues to own composition and common interfaces.
- Keyboard creation is required when numeric creation positions are removed. Both map families use their existing candidate/validation paths with the current visible map center, rather than an arbitrary fallback location.
- Explicit positional editing must win over background pan while armed; right-button/two-contact navigation takeover still cancels and navigates. Invisible endpoint hit areas are removed from export.
- A separate Orbit-center preview channel avoids collisions with Inspector host-preview ownership and inherits latest applied size/orientation.
- Full integrated suite, production build, independent Standards/Spec review, complementary persistence review and final commit remain pending.
