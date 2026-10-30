---
title: 'Publish Jump Routes and safe physical Station associations'
status: closed
assignee: coordinator
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 04: Publish Jump Routes and safe physical Station associations

**Parent:** [Player view and secret-free sharing](../spec.md).

**Source:** [Player view and secret-free export — GitHub #9](https://github.com/Submoon/ttrpg-cluster-control/issues/9). Approved breakdown: 2026-10-29. Planning baseline: `8d4b66504ca6723db5405ed7cb93d0a666264c9a`, equal to fetched origin/main. Refresh source/baseline before implementation.

**What to build:** the Warden chooses which Jump Routes players see and verifies their public connections in the cluster preview. A connection to a Hidden system appears unresolved at its exact map position; private logical endpoints and physical installations stay protected.

**Status:** closed after simultaneous implementation and verification with ticket 03, `implement` and subagents on 2026-10-30. Tickets 01–04 are closed; tickets 05–07 remain unstarted.

## Blocked by

- [02: Explore published objects and anonymous Orbit host chains](02-object-publication-host-chains.md).

## Acceptance criteria

- [x] Route editing exposes a saved, undoable player-sharing setting. New and supported legacy routes default unshared; route sharing is independent of internal Jump Point disclosure.
- [x] A shared route requires at least one non-hidden endpoint system. Two retained systems are connected through their public markers; two Hidden systems suppress the route. Unknown presence/Known type system markers can be retained endpoints without opening their internal maps.
- [x] With one Hidden endpoint system, show an unresolved player destination at that system's exact schematic map position. Use the retained side as the player origin even if it is the source route's destination. Do not alter the GM route's resolution, orientation, references or source layout.
- [x] Player route data/labels keep the Jump level but omit internal route names, logical Jump Point identities/names and hidden system identity/type/properties. Unknown destination labels are generic. Existing GM unresolved-exit strings are not treated as automatically public.
- [x] A source-unresolved external route needs a shared setting and a retained origin. Preserve its permitted applied endpoint geometry while projecting only generic player labels. Private routes do not affect published counts, ordinals, bounds or identity metadata.
- [x] Projected route references are valid even when internal Jump Point objects are absent; do not smuggle private endpoint objects into the document just to satisfy the source renderer's requirements.
- [x] A Jump Point's physical Station association is visible in public inspection only if both objects are Revealed. An association does not auto-promote a Hidden Station. This leaves the separate required-Orbit-host exception intact.
- [x] Route sharing and any required metadata survive ordinary editing, save/reload, Undo/Redo, full backup/import remapping and recovery without losing source fields or broadening publication.

## Verification and completion

Exercise actual route editing and preview for both source orientations, shared/unshared routes, partial systems, both-Hidden systems, exact secret-destination coordinates, existing unresolved exits and private siblings. Inspect projected data and accessible route text for forbidden endpoint/source labels. Test Station pairs across disclosure modes, import remapping, history and source graph immutability. Run focused route geometry/projection and public browser regressions with lint/typecheck.

## Scope boundaries

This slice extends the common preview/projection and existing guarded route workflow. It does not depend on public prose/Fields, standalone JSON or URLs. Display the deliberately authorized positions and anonymous structure, but do not treat the player's unresolved representation as a destructive edit to the authoritative domain model. Sensitive review rules apply.

## Resolution

Implemented all eight criteria through the existing guarded route session, writer and history. Explicitly shared routes use public system markers independently of private Jump Points. Hidden destinations retain their exact authorized coordinates and generic labels; authored unresolved exits preserve full-source applied geometry. Private routes and both-Hidden connections are omitted without affecting public identities or counts. Station inspection exposes an association only between two Revealed objects. Public-only pan/zoom/Fit keeps distant destinations inspectable and preserves the cluster camera across system visits without changing source geometry or history.

Pure route/Station matrices, source backup/import remapping, real route sharing Undo/Redo/reload, recovery and source-export equality passed. Desktop/compact far-route inspection and compiled feature checks passed. The single complete suite reported 514 passed / 4 timed out; unchanged targeted replay resolved two, and two explicitly scoped legacy-journey budgets resolved the remaining two with all assertions unchanged. Standards, Spec and complementary privacy/persistence reviews have zero remaining findings. See the [combined implementation record](../tickets-03-04-implementation.md) for exact revisions and execution evidence.

Work is committed locally on `codex/player-view-ticket-01`, intentionally retaining the original implementation base rather than integrating main's subsequent changes. Tickets 05 and 07 are now available but unclaimed; 06 remains blocked by 05. No later implementation, push, PR, remote issue change or merge into main occurred.

## Comments

> *This was generated by AI during triage.*

Implementation started with ticket 03 on 2026-10-30. Refetched GitHub #9 is unchanged. Fresh origin/main remains `971e91c0ad2fc78e4f92c1e625091a577960b41b`; current branch `codex/player-view-ticket-01` is five commits ahead and zero behind. The actual implementation/review baseline is `4b70c1bd170125210f304d70611c28712945bf4d`, intentionally including local prerequisites 01 and 02. See the [combined implementation record](../tickets-03-04-implementation.md).
