---
title: Protect retained test evidence across supported execution paths
status: closed
assignee: ticket13_implementation
type: implementation
spec: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 13: Protect retained test evidence across supported execution paths

## Specification

[Approved follow-up](../spec.md#approved-follow-up-behavior-first-pruning-and-shorter-feedback); retrospective R2, informed by the documented output-directory/evidence-loss failures.

## What to deliver

Supported test commands preserve earlier retained evidence and report invalid/empty diagnostic selections clearly. Contributors can inspect the first failure without rerunning merely to regenerate destroyed reports or traces.

## Blocked by

- [09: Verify the integrated suite and publish the result record](09-integrated-verification-and-results.md) — closed.
- [10: Review recent repository sessions and prioritize testing improvements](10-retrospective-test-session-problems.md) — closed.

## Scope and coordination

Inspect existing output ownership, local/pure/direct-CLI paths, artifact sanitation and any retained shared summary tooling before designing a change. Use architecture review to resolve an uncovered ownership boundary; reuse the current runner and guards. Implement the cheapest deterministic fix for a demonstrated gap. If a proposed hazard is already prevented, document that evidence instead of adding redundant machinery.

Own runner/artifact/analysis tooling and its focused tests. Tickets 11/12 own application coverage; coordinate any shared configuration or documentation through the coordinator, who owns Git/runtime resources. Preserve others' work. Authentication and fail-closed sanitation changes require the repository's sensitive review route; keep secrets out of evidence.

## Acceptance criteria

- [x] Capture the current baseline and demonstrate which supported entry points still have an evidence-ownership or analysis-validation gap; distinguish existing guards from missing behavior.
- [x] A disposable retained-evidence sentinel outside a new run's owned directory survives supported runs. Owned concurrent output directories remain disjoint, and cleanup stays within owned resources. Preserve first-attempt failure reports/traces.
- [x] Retained shared selection/summary tooling visibly rejects zero-case input or incompatible trace/report schema where the demonstrated gap exists; avoid a new permanent analyzer solely for ignored historical harnesses.
- [x] Supported pure, focused and CI execution still work; Preview secrets and protected artifact sanitation remain scoped and fail-closed. Use isolated fixtures for destructive-output controls, not actual retained evidence.
- [x] Update the shared testing guide and affected helper/runner contracts with actual supported usage; record focused proof and independent review. Any new tooling case explains its distinct verification failure and execution cost.
- [x] Supply ticket 14 the stable per-run artifact/cleanup contract and ticket 15 the cumulative diff/evidence for final review. Run focused checks here, not a redundant full browser qualification.

## Delivery evidence

The [11/13 result record](../implementation-11-13-results.md) records config-time ownership, coordinator/worker path consistency, early override rejection, last-run handling, retained native sentinels, stale-descriptor rejection and native protected-output proof. The demonstrated inline encoded-body gap is corrected within the existing sanitizer; no-auth bytes and file attachments retain their tested behavior. Native empty selection already fails and no maintained shared analyzer required another implementation. Documentation closure is approved; ticket 14 consumes the settled contract.


## Resolution

Closed on 2026-11-04. Implemented early output ownership with coordinator/worker consistency, guarded CLI/environment/last-run destinations, isolated native/JSON/HTML outputs and corrected protected inline-attachment sanitation. Real native controls preserve disposable and historical evidence, reject stale/escaping inputs, retain owned failure traces and show zero decoded inline credential leaks with fake inputs. No-auth bytes and existing sanitation gates remain verified. Standards, Spec and complementary sensitive reviews closed with zero remaining findings on tree ac146749224d31579a8f1b274a8279ff55f6a265 and approved this bounded metadata closure. The [delivery record](../implementation-11-13-results.md) preserves first failures, corrective evidence and limitations. Ticket 14 remains unimplemented; no live Preview or full-suite execution is claimed here.
