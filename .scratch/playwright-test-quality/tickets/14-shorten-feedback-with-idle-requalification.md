---
title: Shorten focused feedback with safe idle requalification
status: closed
assignee: Codex
type: implementation
spec: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 14: Shorten focused feedback with safe idle requalification

## Specification

[Approved follow-up](../spec.md#approved-follow-up-behavior-first-pruning-and-shorter-feedback); R3 and its [idle requalification requirements](../retrospective-test-sessions.md#r3-extension-requalify-between-idle-local-runs).

## What to deliver

A contributor can use focused checks and explicitly rerun after a compatible idle edit on the existing owned local server, after fresh bounded qualification. Active runs retain strict source/HMR invalidation, separate artifacts and reliable cleanup.

## Blocked by

- [13: Protect retained test evidence across supported execution paths](13-protect-test-evidence-ownership.md).

The new verification epochs must use ticket 13's settled artifact-ownership and cleanup contract so requalification cannot overwrite or relabel an earlier failed/invalid result.

## Scope and coordination

Use an architect before implementation to define verification-epoch/resource lifetime in the existing launcher. Reuse source monitoring, browser readiness, supported focused selections and direct-predecessor/CI qualification. Own local runner/readiness/monitor behavior and focused tests; preserve application-coverage writers' work. The coordinator owns Git, ports, processes and shared guide edits.

Choose fresh-session recovery for incompatible runtime/configuration changes. Keep cold-start qualification separate from ordinary warmed functional checks. Add convenient focused selections only for demonstrated gaps; this ticket does not promise a runtime gain before measurement or create another runner.

## Acceptance criteria

- [x] Map representative data/UI edits to existing focused commands and record a matched fresh-session control, including readiness/setup/body/cleanup/total costs.
- [x] After the previous child and cleanup finish, an explicit rerun can replace epoch-owned monitor/probe/callback state, capture stable current inputs and obtain fresh readiness on the live server. Qualification remains bounded; changes during preparation invalidate/restart it safely.
- [x] Active verification remains permanently invalid after relevant source/HMR changes, even for restored edits or an otherwise successful child. Later qualification never changes the earlier result or its evidence.
- [x] Test unchanged repetition, idle edit followed by requalification, active/preparation/transient edits, stale callbacks, cancellation and cleanup. Incompatible configuration changes require a fresh session; old resources cannot approve or poison a new epoch.
- [x] Exercise one real data and one UI edit/rerun under matched conditions; preserve isolated browser contexts, per-run artifacts and process/port ownership. State limitations or lack of measured gain honestly.
- [x] Update supported-command/fixture guidance and the concise result record, run focused checks and obtain independent review of the lifetime/guard semantics. Hand the stable source and evidence to ticket 15 for final cumulative qualification; do not weaken cold-start or protected sanitation requirements.

## Resolution

The existing local launcher supports explicit requalification after a settled compatible idle edit. New preparation starts with continuous input observation and keeps active invalidation and evidence ownership per run. The [delivery record](../implementation-12-14-results.md#safe-idle-requalification) gives the 54 focused pure checks, six real Chromium executions, matched timing phases, reviewer closure and the remaining shutdown limit. Ticket 15 owns the cumulative qualification.
