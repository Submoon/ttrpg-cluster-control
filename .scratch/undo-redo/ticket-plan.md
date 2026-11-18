---
title: Undo/redo implementation ticket plan
status: closed
---

# Undo/redo implementation ticket plan

This is the approval and dependency index for [Undo and redo for applied workspace changes](spec.md). All eight implementation tickets have since closed. Their acceptance criteria and individual evidence remain in the ticket files; [the ticket index](tickets/index.md) is the current execution and integrated-verification record.

## Source and baseline

The source request is [Undo/redo functionality — GitHub issue #5](https://github.com/Submoon/ttrpg-cluster-control/issues/5). The planning baseline was 9edfa66c4f505d56f106fc4af8245f200abfba78, equal to freshly fetched origin/main when the plan was published on 2026-10-27. Each implementation record carries its own baseline.

## Approved breakdown

## Ticket detail

| Ticket | Status | Blocked by | Delivery |
| --- | --- | --- | --- |
| [01 — Prepare truthful mutation outcomes and action context](tickets/01-prepare-mutation-outcomes.md) | closed | None | Establish truthful in-memory and durable outcomes, action context, and stale-session guards. |
| [02 — Undo and redo saved changes through the shared coordinator](tickets/02-shared-history-coordinator.md) | closed | 01 | Provide direct commands and one bounded, shared session-history coordinator with saved-state and pending-work gates. |
| [03 — Restore useful context without stale drafts](tickets/03-restore-context-and-drafts.md) | closed | 02 | Restore useful editor context while retaining drafts and rejecting stale continuations. |
| [04 — Group continuous keyboard and wheel adjustments](tickets/04-group-continuous-adjustments.md) | closed | 02 | Group continuous gestures and keyboard adjustments into coherent history steps. |
| [05 — Restore deletion cascades and shared Fields effects](tickets/05-restore-cascades-and-fields.md) | closed | 02 | Restore complete reviewed deletion and shared-Field consequences. |
| [06 — Traverse reviewed imports and exports with exact identity](tickets/06-import-export-history.md) | closed | 02 | Make reviewed imports reversible with stable identities and keep exports outside history. |
| [07 — Complete keyboard and compact interaction](tickets/07-keyboard-and-compact-controls.md) | closed | 03 | Expose the existing guarded history commands and consultation access on desktop and compact layouts. |
| [08 — Inspect retained session history](tickets/08-inspect-session-history.md) | closed | 02 | Add read-only consultation of the bounded session history. |

The approved dependency graph is **01 → 02 → {03, 04, 05, 06, 08}**, with **03 → 07**. These edges express behavior prerequisites; overlapping source edits still follow ownership and integration coordination.

## Safety and dependency rationale

One shared coordinator owns the bounded history, saved-state publication, and traversal. Family tickets extend its complete consequence and consent boundaries rather than adding per-family stacks. Ticket 08 is read-only consultation, not an audit log or a second history store; the original framing remains in [framing.md](framing.md).

The user approved eight tickets, including history consultation, on 2026-10-27. The later implementation authorizations and branch/base choices are recorded in the execution records; planning approval alone did not authorize remote writes or merges.

## Coverage and completion

The approved story mapping is retained here as a compact requirements index. Ticket files own the detailed criteria; the execution index and each ticket preserve test coverage and previous results.

| Specification stories | Primary delivery ticket |
| --- | --- |
| 1, 6, 14, 20, 24–32, 42–47 | 02, with family-specific identity/recovery evidence in 05/06 |
| 2–5, 7, 9–13, 33–36 | 03 |
| 15–18 | 04 |
| 8, 19, 48 | 05, with import Redo also covered by 06 |
| 21–23 | 06 |
| 37–41 | 07 |
| 49–53 | 08 |

The [execution index](tickets/index.md) preserves integrated run accounting, corrected failures, review closure, scenario totals, and physical-input/accessibility limits. The [ticket 07 record](tickets/07-keyboard-and-compact-controls.md) records its complete integrated run. Earlier slice acceptance and test evidence remain in each linked ticket.

## Batch execution (completed)

The 2026-10-28 implementation batch started from completed prerequisites at 4ad6976aaf0953bcaac90c26eb4e289c3ef75487, with freshly fetched origin/main at 9edfa66c4f505d56f106fc4af8245f200abfba78. The [execution index](tickets/index.md) records its owners, later baseline, integration, and verification.

## Batch verification

The detailed outcomes are preserved in [tickets/index.md](tickets/index.md) and the eight ticket records. They distinguish a complete run with initial failures from focused corrections and later clean integrated qualification; this plan does not compress those results into a single all-green claim.

## Ticket 07 execution

Ticket 07 completed under its separate 2026-10-28 authorization after its dependencies closed. Its [implementation record](tickets/07-keyboard-and-compact-controls.md) records its baseline, reviews, and integration.

## Ticket 07 verification

The ticket 07 record preserves the 346-scenario complete run, focused scenarios, desktop/compact evidence, and browser-emulation limits. See [its verification section](tickets/07-keyboard-and-compact-controls.md#verification-and-completion).

## PR feedback refinement

The user-authorized PR #32 refinements, their exact execution base, implementation findings, test corrections, and remaining physical-input limits are indexed in [pr32-main-integration.md](pr32-main-integration.md). Its PR and branch states are historical.

## Resolution

The plan closed after publication and approval of the eight local tickets. All eight tickets are now closed, and the parent specification's implementation and verification are recorded in the linked execution index and ticket resolutions. The GitHub source issue remains a separate tracker state; local closure does not modify it.
