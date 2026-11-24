---
title: "Add and move a target within its owning system"
status: closed
assignee: Codex
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 12 — Add and move a target within its owning system

## What to build

Let the Warden add objects and manipulate objects and Orbits in any visible system on the continuous map. Ordinary movement keeps ownership even when two envelopes overlap.

## Blocked by

- [Inspect and find targets on the continuous Warden map](11-inspect-and-frame-continuous-map.md)

## Specification and baseline

[Unified map with stable semantic zoom](../spec.md) · [Source issue](https://github.com/Submoon/ttrpg-cluster-control/issues/4)

User stories covered: 17, 20–24, 32–33.

Planning baseline: `dc5edb282087458c1bc6dd26287c96a974662c3b` (`main` and `origin/main` after fetch on 2026-11-16). The local planning checkout retains the prototype branch. Implement against the application baseline after refreshing it.

## Acceptance criteria

- [x] Adding takes the owner from a definite object or Orbit target, then from a unique envelope if there is no definite target. Overlap or empty space outside all envelopes prompts an owner choice. Cancel leaves the workspace unmodified.
- [x] Move uses the frontmost eligible target. Moving an object across a neighboring envelope retains the source owner, updates its envelope, and only permits attachment to an eligible Orbit of that owner.
- [x] Existing direct and precise object and Orbit adjustments resolve coordinates in the target's system. Hosted geometry follows its host, and supported unoccupied-center and attachment workflows preserve same-system and acyclic relationships.
- [x] An independent move in a different system can commit while the Inspector and modified draft stay on the original entity. A gesture that retargets Inspect uses the existing draft guard.
- [x] A touch drag can manipulate an eligible mark in Move. A second contact rolls back the uncommitted move and starts pinch. Verify the next gesture remains usable and no unintended edit was stored.

## Resolution

Implemented continuous object Add and Move with explicit owning-system commands and the existing Inspector transition guard. Add prioritizes a visible object or eligible Orbit, then a unique envelope, and presents an explicit owner choice for overlap or empty space outside all envelopes. An occupied definite mark can retain its owner while placement continues. A request remains owned through draft preflight, history capacity and mutation, and held keyboard activation creates one object.

Direct and precise Move use the target's local coordinates at the common scale. A pointer acquisition follows painted order for eligible targets. Objects and hosted geometry stay with their owner, and an unrelated move can preserve the current Inspector draft. Orbit geometry and center adjustments retain the related branch and validate the captured source after preflight. Concurrent center requests preserve the latest guarded handoff. Focus falls back to an owning system name or the canvas when detail collapses.

The cumulative candidate passed Vue types and focused lint with 73 earlier cross-ticket checks and 55 focused checks on the later ownership and player-route candidate. Compiled Chrome verified Add, held Enter, retained route drafts, exact free placement, direct resize, Escape before release, focus recovery, route inspection and held import cancellation. The compact Chromium touch journey at `1e285fe48d6c062ff42a76390bfb0bcbd6aafe87` canceled a real object preview on second contact, pinched the camera, reloaded the unchanged geometry and persisted the next single-finger drag under the same owner. This compact run contributes gesture coverage to ticket 12. Physical performance remains in ticket 21.
