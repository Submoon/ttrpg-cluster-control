---
title: 'Populate star systems with every catalogue type and Orbit structure'
status: blocked
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 23: Populate star systems with every catalogue type and Orbit structure

## Parent

[Revamp the interface: responsive map editing with preserved local work](../spec.md). Source request: [Revamp the interface](https://github.com/Submoon/ttrpg-cluster-control/issues/3).

The human approved the twelve-ticket breakdown and exact dependencies on 2026-10-16. Approved planning baseline: `f4aa1b4438217412c308e61733d862f3d71597ca`, intentionally above `origin/main = 629d2a98715c3a16b954e0f77c639b1f0c31212c`. See the [approved proposal](../research/ticket-breakdown-proposal-2026-10-16.md).

## What to build

Place every one of fifteen catalogue subtypes, including Other, at free/Orbit positions, and create hosted/unoccupied-center Orbits through an anchored persistent Add chooser.

## Acceptance criteria

1. [ ] Introduce real chooser, same-type lifetime, type/next-target/Quit and compact context-banner reuse through working system creation.
2. [ ] Retain Back/context and Inspect on demand.
3. [ ] Dismissal consumes Escape/outside input before map quit/placement, preserving progress/type/drafts; Quit drops only unfinished work.
4. [ ] Place at the actual transformed/rotated/nested target, never a fixed angle.
5. [ ] Indicate candidates without hover, explicitly resolve overlap, explain invalid targets without mutation/reset, and provide keyboard/single-pointer preview/Confirm/Cancel/coordinates/Orbit-position alternatives.
6. [ ] Add Orbit chooses object host or unoccupied center with nested validation and independent per-axis corrections/notices.
7. [ ] Pan/takeover/cancel/interruption cannot publish partial creation; valid completion publishes once with real save-failure/JSON/reload checks.

## Scope and exclusions

Existing system creation catalogue, two result families sharing targeting/lifetime. This real first Add journey supplies reusable chooser behavior for cluster ticket 24; no horizontal prefactor, manipulation handles, Fields editor or defaults-generator change.

## Blocked by

- [Edit complete object and Orbit data through a resumable Inspector](22-complete-object-and-orbit-inspectors.md)

Dependency rationale: 22 — actual object/Orbit draft dependency authority must reject conflicting creation before preview.

## Specification and evidence mapping

primary 24–25, 27–37, 51–52; checks 26, 40, 43–46, 49, 60, 82–93, 96, 107–111, 120. **B:** B1–B5, B7, B9.

Story numbers refer to the [specification user stories](../spec.md#user-stories). B1–B10 refer to the [behavioral acceptance families](../research/spec-test-seams-2026-10-16.md#smallest-useful-high-level-acceptance-suite). Required checks extend crosscutting contracts; primary ownership alone does not certify other owners or the whole product.

## Required product constraints

- Deliver the real persisted-workspace product, never the memory-only sample. Preserve working baseline commands until their replacements work. Use Nuxt UI to the greatest practical extent: evaluate configuration, slots and adapters before bespoke equivalents and document the smallest justified exception. Keep the SSR shell/client maps and one provider/CSS integration.
- Preserve domain vocabulary, authoritative validation, references, host/recovery corrections, database `ttrpg-cluster-control`, marker `ttrpg-cluster-control-map`, schema/version and applicable drag identities. Support accepted older shapes inside that marker/version boundary; add no migration or previous-marker fallback, durable drafts, renderer or unrelated feature.
- At affected seams, own session draft identity/content/errors above presentation lifetime; hide/theme/reflow retain work. Refuse actual target/dependency conflicts before preview while allowing independent commands. Apply validates latest committed memory and ends its designated session before durable saving; failure retains applied data with truthful recovery. Scoped Cancel never undoes committed work. Preparation is read-only, and changed destructive effects require renewed review. Backup restoration retains its distinct durable-before-publication guarantee.
- Verify relevant light/dark states, useful text >=4.5:1 and meaningful graphics/controls >=3:1 against actual adjacent/composited backgrounds, non-color cues, names/help, visible unobscured focus, modal entry/return and keyboard/single-pointer alternatives. Automate relevant mobile portrait/landscape/touch/reduced-height flows; 390×844, 844×390 and 390×500 are useful starting viewports. Target Android Chrome only for supplementary real OS-keyboard open/closed, safe-area and physical gesture checks. Simulation is not physical proof; report unavailable gates explicitly, without invented passes or a new device/CI harness. Desktop support retains baseline scope.
- This feature owns its acceptance tests now; final cleanup does not supply missing feature checks. Record source/runtime/product route, validated fixture, viewport/browser/device/input and passed/failed/unexecuted/unavailable outcomes and limits. Preserve user storage with isolated browser contexts; historical prototype passes are prior art, not current integrated acceptance.

## Validation strategy

Use real system-map creation and valid dense/rotated/nested fixtures. Verify transformed destinations, explicit ambiguous candidates, all catalogue subtypes and both Orbit host forms through UI plus JSON/reload; test no partial application during cancellation/takeover and retained applied results after save failure.

The primary seam is the real integrated product through the existing Playwright browser suite, with narrow codec/domain/storage tests only for the relevant invariant. Use actual downloads and durable reload where applicable. Run affected checks and appropriate typecheck/build; compiled-production presentation checks supplement development iteration. No new application test API or separate component harness is required.

## Execution and handoff

Coordination and analysis use `gpt-6.1-sol` at High effort; delegated implementation uses `gpt-6-luna` at XHigh effort, as requested by the human. Follow the [project-development workflow](../../../.agents/skills/project-development/SKILL.md), including complexity/risk routing, required architecture contracts and independent reviews; sensitive persistence, destructive operations and interchange require complementary technical and domain/data review. Delegated specialists stay within their assigned scope and do not restart routing.

No implementation has started and no assignee is set. Work blockers-first; preserve other agents' work. Return changed behavior, evidence identities/outcomes/limitations and unresolved findings to the coordinator. This ticket does not authorize GitHub writes, source-issue closure, merge or deployment.
