---
title: "Add and move a target within its owning system"
status: blocked
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

- [ ] Adding takes the owner from a definite object or Orbit target, then from a unique envelope if there is no definite target. Overlap or empty space outside all envelopes prompts an owner choice. Cancel leaves the workspace unmodified.
- [ ] Move uses the frontmost eligible target. Moving an object across a neighboring envelope retains the source owner, updates its envelope, and only permits attachment to an eligible Orbit of that owner.
- [ ] Existing direct and precise object and Orbit adjustments resolve coordinates in the target's system. Hosted geometry follows its host, and supported unoccupied-center and attachment workflows preserve same-system and acyclic relationships.
- [ ] An independent move in a different system can commit while the Inspector and modified draft stay on the original entity. A gesture that retargets Inspect uses the existing draft guard.
- [ ] A touch drag can manipulate an eligible mark in Move. A second contact rolls back the uncommitted move and starts pinch. Verify the next gesture remains usable and no unintended edit was stored.
