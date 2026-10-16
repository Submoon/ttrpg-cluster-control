---
title: 'Edit complete object and Orbit data through a resumable Inspector'
status: blocked
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 22: Edit complete object and Orbit data through a resumable Inspector

## Parent

[Revamp the interface: responsive map editing with preserved local work](../spec.md). Source request: [Revamp the interface](https://github.com/Submoon/ttrpg-cluster-control/issues/3).

The human approved the twelve-ticket breakdown and exact dependencies on 2026-10-16. Approved planning baseline: `f4aa1b4438217412c308e61733d862f3d71597ca`, intentionally above `origin/main = 629d2a98715c3a16b954e0f77c639b1f0c31212c`. See the [approved proposal](../research/ticket-breakdown-proposal-2026-10-16.md).

## What to build

Full object/Orbit data and geometry are editable in readable visible sections, with owned hidden drafts, precise errors and reachable actions.

## Acceptance criteria

1. [ ] Deliver full-width long text, top Hide, persistent bottom Apply/Discard/status/error access, error-to-control navigation and separated reviewed Delete.
2. [ ] Preserve object Name/unique Location key/Description, Other type text, placement/conditional coordinates, optional physical Station association for logical Jump Points, native/custom typed values including zero/false and ineligible stored values; Description and custom Session note remain distinct.
3. [ ] Preserve Orbit axes, unoccupied Center X/Y, per-host order, rotation/Detach, nested structures and per-axis host-minimum notices; no ignored-value success.
4. [ ] Both adapters survive presentation and refuse actual entity/host/placement/definition/deletion conflicts before preview while allowing independent commands; numeric geometry works in Select.
5. [ ] Latest-memory Apply ends despite later save failure.
6. [ ] Use readable domain labels throughout Inspector/Hierarchy/map names and keyboard-open long forms.

## Scope and exclusions

One existing selected-entity journey, sequentially extending the same envelope/owner for two system target types. Fixtures supply entities. Route form is 24, Fields is 26, gestures/creation are separate. Preserve working reviewed Delete until 27.

## Blocked by

- [Explore separate maps through the responsive Dock, Hierarchy and Inspect](21-responsive-map-navigation-and-panels.md)

Dependency rationale: 21 — consumes real selection/Inspector/guard presentation.

## Specification and evidence mapping

primary 22, 55–63; checks 33, 38–43, 51–52, 78, 82–96, 105–110, 120. **B:** B1, B4–B7, B9.

Story numbers refer to the [specification user stories](../spec.md#user-stories). B1–B10 refer to the [behavioral acceptance families](../research/spec-test-seams-2026-10-16.md#smallest-useful-high-level-acceptance-suite). Required checks extend crosscutting contracts; primary ownership alone does not certify other owners or the whole product.

## Required product constraints

- Deliver the real persisted-workspace product, never the memory-only sample. Preserve working baseline commands until their replacements work. Use Nuxt UI to the greatest practical extent: evaluate configuration, slots and adapters before bespoke equivalents and document the smallest justified exception. Keep the SSR shell/client maps and one provider/CSS integration.
- Preserve domain vocabulary, authoritative validation, references, host/recovery corrections, database `ttrpg-cluster-control`, marker `ttrpg-cluster-control-map`, schema/version and applicable drag identities. Support accepted older shapes inside that marker/version boundary; add no migration or previous-marker fallback, durable drafts, renderer or unrelated feature.
- At affected seams, own session draft identity/content/errors above presentation lifetime; hide/theme/reflow retain work. Refuse actual target/dependency conflicts before preview while allowing independent commands. Apply validates latest committed memory and ends its designated session before durable saving; failure retains applied data with truthful recovery. Scoped Cancel never undoes committed work. Preparation is read-only, and changed destructive effects require renewed review. Backup restoration retains its distinct durable-before-publication guarantee.
- Verify relevant light/dark states, useful text >=4.5:1 and meaningful graphics/controls >=3:1 against actual adjacent/composited backgrounds, non-color cues, names/help, visible unobscured focus, modal entry/return and keyboard/single-pointer alternatives. Automate relevant mobile portrait/landscape/touch/reduced-height flows; 390×844, 844×390 and 390×500 are useful starting viewports. Target Android Chrome only for supplementary real OS-keyboard open/closed, safe-area and physical gesture checks. Simulation is not physical proof; report unavailable gates explicitly, without invented passes or a new device/CI harness. Desktop support retains baseline scope.
- This feature owns its acceptance tests now; final cleanup does not supply missing feature checks. Record source/runtime/product route, validated fixture, viewport/browser/device/input and passed/failed/unexecuted/unavailable outcomes and limits. Preserve user storage with isolated browser contexts; historical prototype passes are prior art, not current integrated acceptance.

## Validation strategy

Use valid rich fixtures for both Inspector types, native/custom values, long text, host/order/placement relationships and invalid input. Verify hidden ownership/refusal before preview, independent commands, actual applied JSON/reload, forced save failure and all presentation/keyboard-open action paths.

The primary seam is the real integrated product through the existing Playwright browser suite, with narrow codec/domain/storage tests only for the relevant invariant. Use actual downloads and durable reload where applicable. Run affected checks and appropriate typecheck/build; compiled-production presentation checks supplement development iteration. No new application test API or separate component harness is required.

## Execution and handoff

Coordination and analysis use `gpt-6.1-sol` at High effort; delegated implementation uses `gpt-6-luna` at XHigh effort, as requested by the human. Follow the [project-development workflow](../../../.agents/skills/project-development/SKILL.md), including complexity/risk routing, required architecture contracts and independent reviews; sensitive persistence, destructive operations and interchange require complementary technical and domain/data review. Delegated specialists stay within their assigned scope and do not restart routing.

No implementation has started and no assignee is set. Work blockers-first; preserve other agents' work. Return changed behavior, evidence identities/outcomes/limitations and unresolved findings to the coordinator. This ticket does not authorize GitHub writes, source-issue closure, merge or deployment.
