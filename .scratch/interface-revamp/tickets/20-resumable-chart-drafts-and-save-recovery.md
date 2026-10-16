---
title: 'Rename charts with resumable drafts and trustworthy Apply/save recovery'
status: blocked
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

## What to build

Edit/hide/resume chart names, safely resolve transitions and distinguish an applied name from durable saving under failure.

## Acceptance criteria

1. [ ] Parent-owned chart draft/errors/reopening survive hide/theme/reflow; clean transitions do not prompt, while Apply/Discard/Stay and invalid Apply preserve/reset the exact designated target/context/view/tool.
2. [ ] Validate latest memory, publish once and end the form/continue transition before durable acknowledgement.
3. [ ] Fault real writes: retain memory and persistent Not saved/error, latest-memory Retry and current applied JSON excluding drafts/previews.
4. [ ] Later edits/older completion cannot falsely claim Saved or replay commands.
5. [ ] Keep draft/tool/save/export feedback distinct, scoped cancellation and supported departure warnings.
6. [ ] Remove decorative footer only while relocating useful continuously reachable feedback.
7. [ ] Preserve existing names/summaries, without descriptions.

## Scope and exclusions

Chart journey plus existing single persistence owner/reusable guard contract; actual adapters follow in 22/24/26. Backup restore stays durable-first. Recovery JSON exists here before full interchange 27.

## Blocked by

- [Choose a coherent local light or dark presentation](19-theme-and-local-resources.md)

Dependency rationale: 19 — actual theme-toggle draft-resumption checks need the working control; real storage from 18 is inherited.

## Specification and evidence mapping

primary 66, 82–93, 99, 117; checks 7, 14, 23, 54–57, 100, 106, 109–110, 120. **B:** B1, B4, B5, B7, B9.

Story numbers refer to the [specification user stories](../spec.md#user-stories). B1–B10 refer to the [behavioral acceptance families](../research/spec-test-seams-2026-10-16.md#smallest-useful-high-level-acceptance-suite). Required checks extend crosscutting contracts; primary ownership alone does not certify other owners or the whole product.

## Required product constraints

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

No implementation has started and no assignee is set. Work blockers-first; preserve other agents' work. Return changed behavior, evidence identities/outcomes/limitations and unresolved findings to the coordinator. This ticket does not authorize GitHub writes, source-issue closure, merge or deployment.
