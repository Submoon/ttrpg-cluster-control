---
title: 'Rename charts with resumable drafts and trustworthy Apply/save recovery'
status: closed
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 20: Rename charts with resumable drafts and trustworthy Apply/save recovery

## Parent

[Revamp the interface: responsive map editing with preserved local work](../spec.md). Source request: [Revamp the interface](https://github.com/Submoon/ttrpg-cluster-control/issues/3).

The human approved the twelve-ticket breakdown and exact dependencies on 2026-10-16. Approved planning baseline: `f4aa1b4438217412c308e61733d862f3d71597ca`, intentionally above `origin/main = 629d2a98715c3a16b954e0f77c639b1f0c31212c`. See the [approved proposal](../research/ticket-breakdown-proposal-2026-10-16.md).

## Acceptance reassessment - 2026-10-16

The human rejects the integrated composition at published source `b37c1abd512c6f47a59774ae3824965e420744b7` and withdraws acceptance of the 18-21 batch. Earlier technical results remain historical, scope-specific evidence; they do not establish conformity to the accepted B/Dock interface or a passing full preservation suite. Reassess this ticket against the corrected specification and [presentation acceptance reset](../research/interface-fidelity-reset-2026-10-16.md) before closing it again. Preserve usable application code and evidence rather than assuming everything must be rewritten.

Ticket 18 is reopened and unclaimed for reassessment; tickets 19-21 are blocked by the same approved dependency chain. Later tickets remain blocked. The human explicitly instructs planning corrections only, then a stop; do not resume implementation or tests until asked.

## What to build

Edit/hide/resume chart names, safely resolve transitions and distinguish an applied name from durable saving under failure.

## Current availability - 2026-10-19

Ticket 19 completes its scoped theme/resource reassessment with current source and runtime evidence. This ticket is now available and unclaimed; its previous acceptance remains withdrawn. The human resumes ticket 19 only, so no implementation or tests for this ticket are started here. Use the corrected presentation contract and current prerequisite Resolution when explicitly resumed.

## Acceptance criteria

1. [x] Parent-owned chart draft/errors/reopening survive hide/theme/reflow; clean transitions do not prompt, while Apply/Discard/Stay and invalid Apply preserve/reset the exact designated target/context/view/tool.
2. [x] Validate latest memory, publish once and end the form/continue transition before durable acknowledgement.
3. [x] Fault real writes: retain memory and persistent Not saved/error, latest-memory Retry and current applied JSON excluding drafts/previews.
4. [x] Later edits/older completion cannot falsely claim Saved or replay commands.
5. [x] Keep draft/tool/save/export feedback distinct, scoped cancellation and supported departure warnings.
6. [x] Remove decorative footer only while relocating useful continuously reachable feedback.
7. [x] Preserve existing names/summaries, without descriptions.

## Scope and exclusions

Chart journey plus existing single persistence owner/reusable guard contract; actual adapters follow in 22/24/26. Backup restore stays durable-first. Recovery JSON exists here before full interchange 27.

## Blocked by

- [Choose a coherent local light or dark presentation](19-theme-and-local-resources.md)

Dependency rationale: 19 — actual theme-toggle draft-resumption checks need the working control; real storage from 18 is inherited.

## Specification and evidence mapping

primary 66, 82–93, 99, 117; checks 7, 14, 23, 54–57, 100, 106, 109–110, 120. **B:** B1, B4, B5, B7, B9.

Story numbers refer to the [specification user stories](../spec.md#user-stories). B1–B10 refer to the [behavioral acceptance families](../research/spec-test-seams-2026-10-16.md#smallest-useful-high-level-acceptance-suite). Required checks extend crosscutting contracts; primary ownership alone does not certify other owners or the whole product.

## Required product constraints

- Preserve the accepted B/Dock composition for every UI surface changed by this ticket: bottom mode/creation Dock, full map board, optional desktop overlay panels and a compact header. Nuxt UI may change control appearance, spacing and typography; pixel identity is not required. Compare the actual integrated result with the accepted reference at comparable viewport/theme/state, recording structural differences, ordinary hit testing and focus. Behavioral passes do not certify visual fidelity. Follow the [presentation acceptance reset](../research/interface-fidelity-reset-2026-10-16.md); technical contracts cannot silently replace the approved composition.

- Deliver the real persisted-workspace product, never the memory-only sample. Preserve working baseline commands until their replacements work. Use Nuxt UI to the greatest practical extent: evaluate configuration, slots and adapters before bespoke equivalents and document the smallest justified exception. Keep the SSR shell/client maps and one provider/CSS integration.
- Preserve domain vocabulary, authoritative validation, references, host/recovery corrections, database `ttrpg-cluster-control`, marker `ttrpg-cluster-control-map`, schema/version and applicable drag identities. Support accepted older shapes inside that marker/version boundary; add no migration or previous-marker fallback, durable drafts, renderer or unrelated feature.
- At affected seams, own session draft identity/content/errors above presentation lifetime; hide/theme/reflow retain work. Refuse actual target/dependency conflicts before preview while allowing independent commands. Apply validates latest committed memory and ends its designated session before durable saving; failure retains applied data with truthful recovery. Scoped Cancel never undoes committed work. Preparation is read-only, and changed destructive effects require renewed review. Backup restoration retains its distinct durable-before-publication guarantee.
- Verify relevant light/dark states, useful text >=4.5:1 and meaningful graphics/controls >=3:1 against actual adjacent/composited backgrounds, non-color cues, names/help, visible unobscured focus, modal entry/return and keyboard/single-pointer alternatives. Automate relevant mobile portrait/landscape/touch/reduced-height flows; 390×844, 844×390 and 390×500 are useful starting viewports. Target Android Chrome only for supplementary real OS-keyboard open/closed, safe-area and physical gesture checks. Simulation is not physical proof; report unavailable gates explicitly, without invented passes or a new device/CI harness. Desktop support retains baseline scope.
- This feature owns its acceptance tests now; final cleanup does not supply missing feature checks. Record source/runtime/product route, validated fixture, viewport/browser/device/input and passed/failed/unexecuted/unavailable outcomes and limits. Preserve user storage with isolated browser contexts; historical prototype passes are prior art, not current integrated acceptance.

## Validation strategy

Fault a real durable write through isolated browser-platform setup, then observe form ending, transition, retained applied JSON, persistent recovery and latest Retry through the UI. Include delayed older completions, another applied edit, invalid Apply, scoped cancellation and all chart draft presentation transitions; restore fault patches during cleanup.

The primary seam is the real integrated product through the existing Playwright browser suite, with narrow codec/domain/storage tests only for the relevant invariant. Use actual downloads and durable reload where applicable. Run affected checks and appropriate typecheck/build; compiled-production presentation checks supplement development iteration. No new application test API or separate component harness is required.

## Execution and handoff

Coordination and analysis use `gpt-6.1-sol` at High effort; delegated implementation uses `gpt-6-luna` at XHigh effort, as requested by the human. Follow the [project-development workflow](../../../.agents/skills/project-development/SKILL.md), including complexity/risk routing, required architecture contracts and independent reviews; sensitive persistence, destructive operations and interchange require complementary technical and domain/data review. Delegated specialists stay within their assigned scope and do not restart routing.

Work blockers-first; preserve other agents' work. Return changed behavior, evidence identities/outcomes/limitations and unresolved findings to the coordinator. This ticket does not independently authorize GitHub writes, source-issue closure, merge or deployment; the later human request authorizes sequential branch commit/push.

## Comments

> *This was generated by AI during triage.*

2026-10-16 — Claimed after completed ticket 19 is committed/pushed as `e014a549e405bb283acb4368d45bdf484ca68d0a`, equal to the remote feature branch. Fresh fetch confirms 0 main-only / 26 feature-only against `origin/main = 629d2a98715c3a16b954e0f77c639b1f0c31212c`. This is the intentional implementation/review baseline. Sensitive routing requires a SOL 6.1 High contract, Luna XHIGH implementation and independent technical plus domain/data reviews. Chart drafts and ordinary memory-first saving are the scope; backup restoration remains durable-first, and later entity adapters retain their approved owners. See the [execution record](../research/implementation-18-21-2026-10-16.md).

## Previous implementation evidence - acceptance withdrawn

Implemented and verified against fixed baseline `e014a549e405bb283acb4368d45bdf484ca68d0a`. Final independently reviewed source candidate: `1f6d7fe2f9760bf3a42cba9f46113a1eddc23734`; subsequent checkpoint edits contain lifecycle/evidence only. Chart sessions retain exact targets, values and errors independently of visibility. The Nuxt UI modal supports scoped Apply/Discard/Stay and focus return; ordinary Apply publishes validated memory once and continues before durability. Ordered newest-revision feedback, latest-memory Retry and actual current JSON recovery retain applied work. Backup restoration remains durable-first. Deletion preparation remains read-only, and guarded continuations revalidate latest context, including delayed import completion.

Typecheck passes. Development chart/theme tests pass 23/23. Final production build passes in 1m53s; compiled portable tests pass **25/25** (19 chart, four theme, two launch). Independent eight-case light/dark desktop/mobile presentation matrix passes **287/287 observations**, with 149 contrast samples. Minimum useful text is 6.11:1, controls 5.85:1 and modal keyboard focus 6.70:1; full cue extent and actual hit testing are checked separately. Actual write-abort/download-failure/success/Retry/durable-reload recovery passes. Application console/hydration warnings and page errors are zero. A reduced-height screenshot initially captured opening opacity; a separate 39/39 settlement follow-up proves the opaque final surface and is not added to the matrix total. Coordinator visually inspects the landscape guard and reduced-height modal.

Independent Standards/technical and Spec/domain-data follow-ups report zero blockers. One confirmed asynchronous selection-context defect was fixed and causally regressed; repeated context checks remain an optional duplication observation. See [implementation results](../implementation-lab/ticket-20/implementation-results.md), [compiled QA](../implementation-lab/ticket-20/production-qa/acceptance-results.json) and the [execution record](../research/implementation-18-21-2026-10-16.md).

Physical Android Chrome/OS-keyboard/safe-area/gesture proof remains unavailable; emulation is not a physical pass. Full preservation testing remains scheduled after 21. Legacy full entity Apply adapters and later import/export/deletion UI retain their approved ticket owners; this closure does not complete the whole source request.

## Resumption - 2026-10-19

The human explicitly resumes this ticket. Intentional implementation baseline: 92c4bd85a2891bb1144c01e19d2b6088a93d5a7b, equal to origin/codex/interface-revamp after a fresh fetch; origin/main remains 629d2a98715c3a16b954e0f77c639b1f0c31212c (0 main-only / 38 feature-only). Source issue 3 is refreshed and unchanged. Sensitive routing uses SOL 6.1 High contracts and independent reviews, with Luna XHigh implementation. Existing behavior and prior evidence must be reassessed against the corrected specification; no historical pass is treated as current acceptance. Six pre-existing modified test/helper files are preserved separately.

## Resolution - resumed acceptance, 2026-10-19

Scoped reassessment is complete against the corrected specification. Final source is `65f6cc2cd910e4e05644dbc1e304ae2055f78106`, following chart-feedback source candidates `ffa10250` and `dc7861d7`. Existing parent-owned chart sessions, guard/target checks, memory-first Apply, revision-ordered saving, latest-memory Retry, applied-only JSON and durable-first backup restoration remain intact. Compact bottom feedback replaces the reserved decorative footer and duplicate Header/Dock save announcements; clean sessions are named truthfully. Nuxt UI supplies the direct recovery controls and details popover. Explicit Fit measures the current feedback obstruction; no feedback/theme change resets the camera.

The confirmed short-screen fitted-target obstruction and adjacent-control focus contrast defect are fixed and causally checked. Typecheck passes. The corrected shared-interface build passes 28/28 scoped compiled tests; the final CSS-only candidate builds successfully and passes 3/3 affected feedback tests, 27/27 causal compact observations and 37/37 details/focus observations. Final contrast/focus, held-Retry prior failure, real aborted writes/current JSON/durable reload and actual ordinary touch pass their scoped gates. Independent Standards and Spec/domain-data reviews have no blocking source findings; one optional coordinate-conversion duplication heuristic is deferred. The coordinator inspects final screenshots.

All original failed attempts remain attributed. The single repository-suite invocation exits 1 but its ephemeral TEMP report cannot be recovered: counts/cause are unavailable, and no passing full-suite or clean-checkout preservation result is claimed. The shared working tree retains five unrelated modified tests/helpers; the relevant pre-existing chart-test setup hunk is deliberately reviewed/adopted with its assertions preserved. Physical Android Chrome keyboard/safe-area/gestures remain unavailable. Final servers are stopped, ports free and frozen/protected hashes verified.

See the [resumption execution record](../research/implementation-20-resume-2026-10-19.md) and [final QA summary](../implementation-lab/ticket-20-resume-2026-10-19/qa/final-summary.md). This closes only ticket 20, superseding its withdrawn historical acceptance within scope. The inherited top Dock, column panels, framed map and dense Header remain unaccepted ticket-21 work. Source issue 3 stays open and the existing PR stays draft. The human authorizes ticket 21 only after this ticket is finished and committed/pushed; no ticket-21 implementation is started by this Resolution.