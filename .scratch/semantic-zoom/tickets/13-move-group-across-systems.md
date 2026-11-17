---
title: "Select and move an object group across systems"
status: in-progress
assignee: Codex
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 13 — Select and move an object group across systems

## What to build

Let the Warden assemble a selection across system boundaries and move it as one operation, including members hidden by semantic zoom.

## Blocked by

- [Add and move a target within its owning system](12-add-and-move-within-owning-system.md)

## Specification and baseline

[Unified map with stable semantic zoom](../spec.md) · [Source issue](https://github.com/Submoon/ttrpg-cluster-control/issues/4)

User stories covered: 11, 28–33.

Planning baseline: `dc5edb282087458c1bc6dd26287c96a974662c3b` (`main` and `origin/main` after fetch on 2026-11-16). The local planning checkout retains the prototype branch. Implement against the application baseline after refreshing it.

## Acceptance criteria

- [ ] On desktop, modified click and the unmodified primary-button selection rectangle in Select can gather objects from several systems. Right-drag still pans. Map and Hierarchy show shared selection and support the existing keyboard access.
- [ ] On a phone, long-pressing each object toggles membership. An ordinary tap selects normally. Motion or a second contact cancels a pending hold, and the release of an activated hold cannot also tap. Switching to Move retains the group.
- [ ] Dragging a selected object moves the whole group by a single Cluster-space displacement. Only the grabbed object can snap that displacement to an eligible Orbit in its own system.
- [ ] All members keep their owners. Hosted branches follow their hosts exactly once, even when a descendant is also selected. The preview identifies Orbit attachments, detachments and the number of selected members hidden by detail.
- [ ] Cancellation keeps the pre-gesture layout. A valid group move is accepted atomically and is restored or reverted as one history entry. Verify deterministic group geometry and a representative combined gesture and history journey.
