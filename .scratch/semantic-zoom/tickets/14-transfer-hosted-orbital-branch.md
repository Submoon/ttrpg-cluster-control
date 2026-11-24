---
title: "Transfer a hosted orbital branch to another system"
status: closed
assignee: Codex
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

- [x] Choose a different destination system and preview the root at a free position or on an eligible destination Orbit. The root leaves its original parent Orbit. All hosted Orbits and recursive occupants follow with their identities, internal connections, dimensions and proportions.
- [x] Retain available Location keys and show editable available suggestions for conflicting keys. Invalid, duplicate or unavailable replacements prevent acceptance until corrected.
- [x] Show route attachments affected by a transferred Jump Point and Station links that would span two systems, including links to a transferred Station. Acceptance clears those references while retaining the route identities and system connections and any Station links whose ends stay together.
- [x] Accept placement, ownership, keys and relationship fixes as one operation, with Undo and Redo covering the complete change. Cancellation, failed validation or a stale preview leaves both systems and all relationships unchanged.
- [x] Verify a nested branch, a destination Orbit, key collisions and link consequences through the mutation and a representative Warden preview and acceptance journey.

## Resolution

## Resolution

- The Warden can transfer an object and its hosted orbital branch to another system in one reviewed edit. Free placement uses destination-local coordinates. Choosing an eligible Orbit keeps the root on that Orbit when choosing its position on the map. The preview draws the complete moved branch without affecting the applied map or its images.
- The review keeps available Location keys, suggests available replacements for conflicts, and displays the affected Jump Route attachments and Station links by name. Applying keeps the logical route and any same-system relationship. Undo and Redo restore complete snapshots and reveal the object in its actual owning system.
- A stale workspace, renderer, or destination geometry draft cannot publish a transfer. A competing destination draft returns the placement to the same uncommitted review. Escape, held-release handling, and the next pointer sequence preserve cancellation and resume normal map input.
- Generated Vue types, 51 focused guard and workflow checks, and scoped lint passed. Independent reviews closed terminal pointer ownership and competing-draft findings. Real Chrome with the merged product revision `5a4e602671336dc99b3d27a752e4327f67ca4ce6` confirmed the fresh click after out-of-bounds release, held Escape, Orbit selection and painted branch, replacement key and named relationship effects, one complete transfer, and exact IndexedDB equality through Undo and Redo. Evidence is in `14-transfer-browser-results.json`.
