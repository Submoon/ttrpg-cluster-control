---
title: Review recent repository sessions and prioritize testing improvements
status: closed
assignee: ticket10_retro
type: implementation
spec: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 10: Review recent repository sessions and prioritize testing improvements

## Request

The user requested this additional follow-up on 2026-10-30: invoke `$retro` on recent sessions for this repository, analyze all testing problems found in those sessions, and work out how to resolve them. This is an analysis deliverable; it does not add a new completion criterion to the original [Reliable, focused Playwright tests and shared testing guidance](../spec.md) specification.

## What to deliver

An evidence-based retrospective and a prioritized improvement plan for the tests, their execution environment, and the coding-agent workflow. Invoke the installed `$retro` skill and its `writing-for-agents` prerequisite. Use the skill from the execution environment rather than copying its instructions into project policy. The current environment's supplied reference is `C:/Users/fbal-fontaine/.agents/skills/retro/SKILL.md`.

## Scope and handoff

The user added four priorities during execution: assess whether the test volume is proportionate to this application, whether verification and test repair consume too much development time, whether the assertions protect useful behavior rather than frequently changing presentation, and why timeouts keep recurring. Make these questions explicit in the report. Compare coverage obligations and execution cost, distinguish supported wall-time measurements from active development time, and identify concrete narrowing/removal candidates with retained behavioral owners. Keep accessibility, focus, hit testing and cartographic correctness distinct from incidental styling. Distinguish startup/client readiness, preparation consuming the scenario budget, waits for actions or assertions, cleanup after a deadline, contaminated runs, and confirmed product stalls; retain uncertainty where the cause is unproven. Repeated deadlines are a reliability problem to resolve, not an acceptable default or a reason for blanket timeout increases. Any proposed reductions remain recommendations for review.

Start with the five most recent completed top-level chats associated with this Git repository, including its worktrees. Treat delegated-agent logs as supporting evidence for their parent chat rather than separate sessions. Include the tickets 01/05 and 02/03 delivery records even if they fall outside that initial set; deduplicate them if both batches belong to one chat. Follow direct references to earlier sessions when necessary to explain a recurring problem. Record the actual session identities, dates, revisions, selection rationale, and inaccessible evidence; do not substitute summaries for available primary logs.

Read the existing check scripts, CI workflow, verification guidance, planning artifacts, and results before proposing changes. Investigate every test-related problem observed within the selected sessions, including incorrect or ineffective assertions, duplication and boundary choice, setup and synchronization, timing failures, environmental differences, runner selection, diagnostics, source changes during browser runs, resource ownership, and costly or misleading validation/orchestration. Treat these as investigation areas rather than predetermined causes. Distinguish product defects, test defects, environment/tooling defects, and incomplete evidence.

Use the retrospective's environment categories where relevant: navigation, automated checks, reviewer guidance, instruction placement, tool economy, ineffective instructions, and information access. Identify an existing check that is missing, unwired, or broken before inventing another. Prefer a deterministic guard for a mechanical failure; reserve reviewer instructions for judgments that a guard cannot make reliably.

Reconcile proposals with completed fixes and the remaining tickets in this effort. Separate resolved problems, existing planned work, and new gaps. Deliver recommendations and proposed follow-up tickets; applying product, test, CI, global instruction, or personal-skill changes is outside this ticket.

## Blocked by

- [02: Make pure runs independent and retain first-attempt browser diagnostics](02-independent-runs-and-failure-diagnostics.md)
- [03: Correct ineffective gesture, recovery and observer assertions](03-effective-regression-assertions.md)

Include those completed delivery records. This follow-up does not wait for, or block, ticket 09's original integrated-verification scope.

## Acceptance criteria

- [x] Invoke `$retro` and its required writing guidance; document the selected repository sessions and evidence gaps.
- [x] Build a complete problem register for that scope, with the symptom, primary evidence, affected revision/environment, impact, recurrence when supported, and confirmed cause or explicit hypothesis.
- [x] Explain false positives, false greens, preparation failures, actual product regressions, and failures caused by the validation workflow separately where the evidence supports that distinction.
- [x] Assess the existing local/CI checks and instructions, identifying why they did or did not catch each problem. Avoid duplicating a working guard or proposing blanket rules that reject justified tests.
- [x] Publish an English report under this effort, ordered by severity and practical priority. For each recommendation, identify the target boundary or owner, expected benefit, cost, risks, dependencies, and a concrete verification method. Label unsupported performance or flakiness claims as unproven.
- [x] Map recommendations to completed work, existing open tickets, or proposed bounded follow-ups, preserving the original implementation pipeline and avoiding duplicate tickets.
- [x] Present the findings and proposed plan for review without automatically implementing the recommendations or publishing remote issues.

## Evidence entry points

- [Tickets 01 and 05 implementation evidence](../implementation-results.md)
- [Tickets 02 and 03 implementation evidence](../implementation-02-03-results.md)
- [Tickets 04 and 06 implementation evidence](../implementation-04-06-results.md), including the 2026-11-02 default-output-directory cleanup that removed prior ignored runtime artifacts. Treat those missing files as an evidence gap and use available primary session logs; do not assume earlier artifact paths still exist.
- [Tickets 07 and 08 implementation evidence](../implementation-07-08-results.md), including test-authoring errors caught by review/native checks, transient-popover observation, a contradicted readiness bound, measured fixture clocks, two unsuccessful strict protocols, the successful thirteen-run protocol and the unresolved full-run failures. Include diagnostic helper placement and evidence ownership when reviewing the workflow.
- [Playwright coverage inventory](../coverage-inventory.md)
- [Verification and test guidance](../../../docs/agents/testing.md)

Runtime artifacts referenced by those records are local ignored evidence and may be unavailable later. Record missing artifacts explicitly and retain the distinction between observed results and reconstructed explanations.

## Review handoff

The [test-session retrospective](../retrospective-test-sessions.md) accounts for five completed top-level repository chats plus the explicitly required current-chat delivery records, records primary-log references and evidence gaps, groups 18 problem mechanisms, and proposes four bounded follow-ups. It addresses the user's volume, development-time, behavior-versus-presentation and recurring-timeout concerns. Main reconciliation and current suite failures remain owned by ticket 09.

## Resolution

Closed on 2026-11-04 after coordinator acceptance and independent review with zero remaining findings. The [retrospective report](../retrospective-test-sessions.md) covers the five selected completed chats and all four Playwright-quality delivery batches, with primary evidence, timing limits, a problem register and concrete behavior-first pruning candidates. Its four proposed follow-ups remain recommendations; none was implemented or published remotely. Ticket 09 retains integration and suite-verification ownership. The coordinator will present the findings with the delivery result.

## User follow-up: permanent behavior coverage and three pruning passes

Added on 2026-11-04 after ticket 09 delivery at `f8ab5c91ef17cd7144dbde45ac6dc62efb7a372f`. The user requests permanent coverage centered on necessary behavior, temporary aesthetic checks during implementation, and removal of low-value tests where replacement adds no useful protection. R1 now contains a [three-pass execution plan](../retrospective-test-sessions.md#r1-extension-three-increasingly-selective-pruning-passes): sequential independent sub-agents apply increasingly demanding retention criteria; the last pass uses Astra (`gpt-6-astra`) at High reasoning. The plan preserves usability, accessibility and cartographic behavior, records explicit retirements and retained owners, and uses focused checks plus one final cumulative qualification. This is a documentation amendment to the completed analysis; no pruning pass or test deletion has been performed.

The subsequent planning request is recorded in the [specification follow-up and dependency table](../spec.md#approved-follow-up-behavior-first-pruning-and-shorter-feedback). Local open tickets 11, 12 and 15 cover R1's three passes; 13 covers R2; 14 covers R3; 15 also covers R4's oracle review. Each includes documentation acceptance criteria and an explicit handoff. These new implementation tickets do not reopen this completed retrospective or tickets 01–09, and their creation does not launch implementation.
