---
title: "Create, edit, and restore routes between systems"
status: in-progress
assignee: Codex
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 10 — Create, edit, and restore routes between systems

## What to build

Let the Warden create and edit a Jump Route between systems using the current editor entry points, including routes with no local Jump Points. Open older editable maps with the same valid routes and layout under the new relationship rules.

## Blocked by

None. This ticket can start immediately.

## Specification and baseline

[Unified map with stable semantic zoom](../spec.md) · [Source issue](https://github.com/Submoon/ttrpg-cluster-control/issues/4)

User stories covered: 34–36, 38, 49–51, 57.

Planning baseline: `dc5edb282087458c1bc6dd26287c96a974662c3b` (`main` and `origin/main` after fetch on 2026-11-16). The local planning checkout retains the prototype branch. Implement against the application baseline after refreshing it.

## Acceptance criteria

- [ ] Create or edit a route directly between distinct known systems, or from a system to an unresolved destination. At each known end, a Jump Point in that system can be omitted or chosen. The existing overview can display the result, including a route with no Jump Points.
- [ ] Changing the route's system in the Inspector clears the prior local attachment on that end of the draft and offers an eligible replacement. The other end retains its attachment. Reject new or edited routes with the same system at both ends.
- [ ] Deleting an attached Jump Point lists affected attachments in the consequence review. Accepting keeps the route and its system endpoints and clears the affected attachment. Cancellation leaves the route and point intact.
- [ ] For legacy editable restoration and import, infer systems from the existing points, preserve valid references, identities and unresolved exit placement, and silently remove resolved same-system routes and their route-only metadata. Keep their Jump Points and linked Stations.
- [ ] Save and reopen a route with and without local attachments. Keep existing editors, public anchor-route projection, deletion reviews and complete backup restore usable with the changed model. Verify legacy, current and invalid input through the existing format and command seams.
