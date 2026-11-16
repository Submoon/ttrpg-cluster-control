---
title: "Transfer a hosted orbital branch to another system"
status: blocked
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 14 — Transfer a hosted orbital branch to another system

## What to build

Give the Warden an explicit Change system action to move an object and all its hosted geometry to a new owner after reviewing placement, keys and affected relationships.

## Blocked by

- [Create, edit, and restore routes between systems](10-edit-and-restore-system-routes.md)
- [Add and move a target within its owning system](12-add-and-move-within-owning-system.md)

## Specification and baseline

[Unified map with stable semantic zoom](../spec.md) · [Source issue](https://github.com/Submoon/ttrpg-cluster-control/issues/4)

User stories covered: 24–27, 33, 36, 57.

Planning baseline: `dc5edb282087458c1bc6dd26287c96a974662c3b` (`main` and `origin/main` after fetch on 2026-11-16). The local planning checkout retains the prototype branch. Implement against the application baseline after refreshing it.

## Acceptance criteria

- [ ] Choose a different destination system and preview the root at a free position or on an eligible destination Orbit. The root leaves its original parent Orbit. All hosted Orbits and recursive occupants follow with their identities, internal connections, dimensions and proportions.
- [ ] Retain available Location keys and show editable available suggestions for conflicting keys. Invalid, duplicate or unavailable replacements prevent acceptance until corrected.
- [ ] Show route attachments affected by a transferred Jump Point and Station links that would span two systems, including links to a transferred Station. Acceptance clears those references while retaining the route identities and system connections and any Station links whose ends stay together.
- [ ] Accept placement, ownership, keys and relationship fixes as one operation, with Undo and Redo covering the complete change. Cancellation, failed validation or a stale preview leaves both systems and all relationships unchanged.
- [ ] Verify a nested branch, a destination Orbit, key collisions and link consequences through the mutation and a representative Warden preview and acceptance journey.
