---
title: "Global search: approved vertical implementation slices"
status: closed
---

## Purpose and approval state

This is the approval and delivery index for [Global search with branch-aware map framing](spec.md). On 2026-10-29 the user approved three independently useful slices with the dependency graph below. All three are now closed; their ticket files remain authoritative for acceptance criteria and per-slice evidence. The specification records the complete product boundary.

## Source issue and actual baseline

The source request is [Global search with auto-fit, GitHub #7](https://github.com/Submoon/ttrpg-cluster-control/issues/7). At publication on 2026-10-29, the successful fetch showed detached HEAD, local main, and origin/main at 8d4b66504ca6723db5405ed7cb93d0a666264c9a, with no divergence. This is historical planning evidence; an implementation must use its own recorded baseline.

## Breakdown and real blocking edges

The three links below preserve the original approved implementation-ticket paths.

| Ticket | Status | Blocked by | Delivery |
| --- | --- | --- | --- |
| [01 — Find and reveal the cluster and its systems](tickets/01-cluster-system-search.md) | closed | None | Search cluster and system names, then reveal the selected destination through the guarded editor operation. |
| [02 — Find an object and frame its branch in the active system](tickets/02-active-system-object-branches.md) | closed | 01 | Add active-system objects and their recursively hosted Orbit branches. |
| [03 — Find and reveal objects across every system](tickets/03-global-object-reveal.md) | closed | 02 | Extend object search across unopened systems and sequence cross-map reveal with framing and focus. |

The approved graph remains **01 → 02 → 03**. Ticket 02 needs the search and reveal entry established by 01; ticket 03 needs the object semantics and branch framing established by 02. No broad prefactoring ticket was identified.

## Follow-up tickets

The later closed refinements preserve the initial graph and are not a new horizontal testing layer:

- [04 — Show type icons in Search results](tickets/04-search-result-type-icons.md)
- [05 — Keep deeply nested Hierarchy rows readable](tickets/05-deep-hierarchy-readability.md)

## Completed user review

The user approved the three-slice scope and linear dependencies without requesting a split, merge, or dependency change. Object search is deliberately intermediate in 02 and becomes workspace-wide only in 03. Completion requires the full specification with recorded evidence, not merely an ID change or completion of an earlier slice.

## Resolution

The three approved tickets were published locally on 2026-10-29 and have since all closed. Their acceptance criteria, blockers, and resolutions remain in the linked ticket files. GitHub issue #7 and any remote PR lifecycle are separate from this local planning record.

### Implementation outcome

The recorded implementation closed tickets 01–03 on the global-search branch. Ticket 03 records the all-workspace feature, the native search entry, an actual-phone journey, and the integrated CI result. The follow-up evidence and mobile qualification are preserved in [slice 01](implementation-01.md), [slice 02](implementation-02.md), [slice 03](implementation-03.md), [follow-ups 04–05](implementation-followups-04-05.md), and [mobile validation](mobile-validation.md). PR [#36](https://github.com/Submoon/ttrpg-cluster-control/pull/36) is referenced by the historical delivery record; consult the live GitHub record for its current state.
