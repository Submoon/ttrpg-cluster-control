---
title: 'Prepare truthful mutation outcomes and action context'
status: closed
assignee: coordinator
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 01: Prepare truthful mutation outcomes and action context

## Source and scope

[Undo and redo for applied workspace changes](../spec.md) is the parent specification; its validated product and testing contracts remain authoritative.

Behavior-preserving prerequisite supporting the complete specification; no history UI is exposed by this ticket.

Source: [Undo/redo functionality — GitHub issue #5](https://github.com/Submoon/ttrpg-cluster-control/issues/5), re-fetched on 2026-10-27 with unchanged body, open state, labels and no comments. Actual planning baseline: `9edfa66c4f505d56f106fc4af8245f200abfba78`, equal to fetched `origin/main`. Refresh the source/baseline before implementation and preserve local work.

## What to build

Existing creation, form Apply, placement, deletion, Fields and import behavior remains intact while every mutation uses one descriptor-bearing application contract. Sessions and transitions distinguish pending/rejected/unchanged work from actual memory publication.

## Blocked by

None. This is the initial executable frontier once implementation is explicitly authorized.

## Acceptance criteria

- [x] All current applied-data entry points, including separately composed file actions, use the shared contract with bounded semantic action/target/context metadata; initialization/hydration/backup restore remain explicit baseline operations.
- [x] Keep synchronous low-level memory publication and separate durable acknowledgement. Evolve only mutation-facing contracts that may await consent, including session Apply and transition resolution; preserve existing durable-await semantics where used.
- [x] Draft/review closure, created-target selection and navigation continuation happen only after actual memory application. Rejection or a pre-application failure retains the initiating work and its context.
- [x] Preserve operation/session identities and preparation/revalidation hooks for future consent; no hidden asynchronous success is reported by a synchronous boolean.
- [x] No history controls or behavior are exposed yet. Existing Apply/Discard/Stay, clean Apply, failed-save memory retention, Retry, reviewed import/deletion and draft-preservation journeys remain valid.
- [x] Run relevant behavior checks and static checks; this prerequisite is green and verifiable on its own, not a wide refactor awaiting a later repair ticket.

## Shared constraints

- Keep one workspace owner and ordered save queue, with no Pinia data copy, new portable-history format or parallel persistence path. Historical restoration preserves identities and complete normalized data.
- When history is exposed, every applied mutation is recorded centrally. Traversal requires latest saved data and no modified/pending editing work; immediate traversal results survive a later save failure, and Retry saves current memory without replay.
- Retention is at most 100 action edges and 32 MiB (33,554,432 bytes) of correctly counted retained encoded snapshots/descriptors. Oversized continuation requires explicit consent and creates a non-undoable baseline; cancellation or failure before publication preserves data/history. This is not a heap-size guarantee.
- Respect the confirmed action/group boundaries, session lifetime, guarded context checks and native text history. Read-only consultation does not traverse or apply/discard a draft and follows modal ownership independently of the saved-state traversal gate.
- Apply these shared contracts to this ticket without absorbing other tickets. The coordinator owns shared Git/integration resources and serializes overlapping edits. Do not modify other worktrees or unrelated correction efforts.

## Verification and completion

- Use the approved command/read-only interface with real validation and controlled time/durable acknowledgements for affected deterministic scenarios. Test observable results and refusal/preservation behavior, not private timeline arrays or stubbed store actions.
- Add or extend the relevant public UI and real IndexedDB scenarios described by the acceptance criteria; include cancellation, stale asynchronous context and pre-publication versus post-publication failure paths where affected.
- Complete lint/typecheck and affected checks according to repository guidance. Reuse successful unchanged evidence; the coordinator runs the production build and one full integrated suite after all slices are integrated, with independent Sensitive-route restoration/persistence review.
- Record actual evidence and unavailable physical-input/performance checks honestly. Passing this ticket does not close the GitHub source, authorize a merge/release or claim other tickets complete.

## Planning authorization

The user explicitly authorized coordination of this first ticket through `implement` on 2026-10-27. The coordinator claims it on branch `codex/undo-redo-ticket-01`, with actual implementation baseline `9edfa66c4f505d56f106fc4af8245f200abfba78`, equal to freshly fetched `origin/main`. No other ticket is claimed or included in implementation scope. The source issue body/comments were re-read and remain unchanged.

## Execution contract

The pre-agreed test seams remain the command/read-only interface with real validation and controlled durable acknowledgements, supplemented by public browser and real IndexedDB journeys. Apply TDD in vertical red/green slices there. Architecture must settle the shared mutation interface before disjoint writers start. Final review uses the pinned implementation baseline above for separate Standards and Spec axes plus complementary persistence/destructive-transition review. Commit only scoped source/tests/documentation and the planning artifacts created in this effort; preserve unrelated environment configuration and other worktrees.

## Comments

> *This was generated by AI during triage.*

The architect settled one page-owned mutation executor with required semantic action metadata and a proposal/current-owner request. It returns an asynchronous applied/unchanged/rejected verdict while preserving the raw writer's synchronous memory publication and independent durable promise. Applied-data revision is distinct from save-queue revision; Retry does not advance it. Initial creation has an explicit baseline callback. No history, capacity planner, consent UI or input grouping is implemented in this prerequisite.

Writer A owned the executor, workspace revision, shared types and chart/entity/route/transition controllers plus focused tests; the untouched import workflow was explicitly transferred from Writer B to Writer A during execution. Writer B owned map/creation/placement/Fields/deletion commands and associated tests. The coordinator owned page/composition integration, documentation, server/ports, Git and integrated checks. Source ownership remained disjoint and shared interfaces were agreed before writing.

## Resolution

Completed the behavior-preserving prerequisite on `codex/undo-redo-ticket-01`. Every applied-data command now uses one descriptor-bearing mutation executor with truthful applied/unchanged/rejected outcomes, synchronous memory publication and a separate durable acknowledgement. Applied-data revision, session ownership checks and transition revalidation protect against stale asynchronous completion. Initialization, hydration and backup restoration remain explicit baseline operations. No history controls or timeline are exposed by this ticket.

The corrected source candidate `46a027806ce9d0e1d71c997b8c95b41278c5d55d` passed global lint, typecheck and the production build, plus 11 focused pure tests. The initial browser batch passed 40/41; its timed-out Orbit case then passed alone in 16.3 seconds and again in the final complete run. Five focused Orbit placement journeys passed, including a public assertion that Apply disappears after successful attachment.

The final complete Playwright attempt ran all 246 tests with no skips: 244 passed and two exceeded the unchanged 30-second limit (30.2 minutes total). Both passed in subsequent isolated runs without code or timeout changes: the real IndexedDB failure/backup scenario in 4.5 seconds and the native/custom Fields journey in 25.4 seconds. This is not a claim of a wholly green single full-suite attempt; the timeout cause was not established. Reports are retained locally under ignored `test-results/ticket01-*` paths.

Separate Standards and Spec reviews plus complementary persistence review have no remaining findings on the corrected candidate. The confirmed Orbit preview/self-publication completion defect was reproduced, fixed and re-reviewed; current-session/draft protection remains intact. No physical-device or large-workspace performance validation is claimed.

The ticket index was renamed to `index.md`, and all 62 local planning links were verified. Before completion on 2026-10-27, `origin/main` was fetched again and remained at the pinned baseline `9edfa66c4f505d56f106fc4af8245f200abfba78`; the source issue remained open and unchanged with no comments. Only ticket 01 is complete. Ticket 02 becomes eligible; tickets 02–08 remain unclaimed, and GitHub issue #5 remains open.
