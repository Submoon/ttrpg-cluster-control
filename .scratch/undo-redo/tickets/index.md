# Undo/redo implementation tickets

Eight local implementation tickets were approved through the Codex question form on 2026-10-27, including read-only History consultation. Tickets 01 and 02 are complete following the user's explicit `implement` instructions. Tickets 03–08 remain open/unclaimed with local triage roles `enhancement`/`ready-for-agent`; unsatisfied blocking edges determine availability.

Parent: [Undo and redo for applied workspace changes](../spec.md). Planning and approval record: [Undo/redo implementation ticket plan](../ticket-plan.md). Source: [Undo/redo functionality — GitHub issue #5](https://github.com/Submoon/ttrpg-cluster-control/issues/5).

Actual baseline: `9edfa66c4f505d56f106fc4af8245f200abfba78`, equal to freshly fetched `origin/main` at publication on 2026-10-27.

| Ticket | Delivery | Blocked by |
| --- | --- | --- |
| 01 | [Prepare truthful mutation outcomes and action context](01-prepare-mutation-outcomes.md) | None |
| 02 | [Undo and redo saved changes through the shared coordinator](02-shared-history-coordinator.md) | [Prepare truthful mutation outcomes and action context](01-prepare-mutation-outcomes.md) |
| 03 | [Restore useful context without stale drafts](03-restore-context-and-drafts.md) | [Undo and redo saved changes through the shared coordinator](02-shared-history-coordinator.md) |
| 04 | [Group continuous keyboard and wheel adjustments](04-group-continuous-adjustments.md) | [Undo and redo saved changes through the shared coordinator](02-shared-history-coordinator.md) |
| 05 | [Restore deletion cascades and shared Fields effects](05-restore-cascades-and-fields.md) | [Undo and redo saved changes through the shared coordinator](02-shared-history-coordinator.md) |
| 06 | [Traverse reviewed imports and exports with exact identity](06-import-export-history.md) | [Undo and redo saved changes through the shared coordinator](02-shared-history-coordinator.md) |
| 07 | [Complete keyboard and compact interaction](07-keyboard-and-compact-controls.md) | [Restore useful context without stale drafts](03-restore-context-and-drafts.md) |
| 08 | [Inspect retained session history](08-inspect-session-history.md) | [Undo and redo saved changes through the shared coordinator](02-shared-history-coordinator.md) |

## Execution frontier

Tickets 01 and 02 are closed. Tickets 03/04/05/06/08 are eligible and unclaimed; 07 still requires 03. This graph expresses behavior dependencies, not permission for overlapping writers or Git operations.

The first working history in 02 records every mutation and includes the safety floor. Later family tickets add their complete consequence/consent integration and evidence rather than leaving unrecorded data paths.

After all eight are integrated, complete the parent specification verification and independent Sensitive-route reviews. Do not create an artificial final test-only feature dependency; each ticket owns its affected failure evidence.

The user separately authorized tickets 01 and 02 on the current branch `codex/undo-redo-ticket-01`. Their tickets record the respective baselines and execution contracts. No GitHub mutation, push, PR, merge or implementation of tickets 03–08 is authorized by those instructions.

## Completed work

[Prepare truthful mutation outcomes and action context](01-prepare-mutation-outcomes.md) established the shared application contract, separate memory/durable results and stale-session guards. Its resolution records the static/build checks, independent reviews and full-suite results, including two timeouts that passed isolated retests.

[Undo and redo saved changes through the shared coordinator](02-shared-history-coordinator.md) delivered the shared bounded session history, direct commands, saved-state/pending-work gates, oversized consent and recovery. Its resolution records the independent reviews, larger-workspace observations, initial complete attempt and passing targeted corrections, including stable controls during menu dismissal.
