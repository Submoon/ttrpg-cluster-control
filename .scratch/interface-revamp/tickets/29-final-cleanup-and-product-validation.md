---
title: 'Finish the production editor and retire the revamp experiments'
status: blocked
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 29: Finish the production editor and retire the revamp experiments

## Parent

[Revamp the interface: responsive map editing with preserved local work](../spec.md). Source request: [Revamp the interface](https://github.com/Submoon/ttrpg-cluster-control/issues/3).

The human approved the twelve-ticket breakdown and exact dependencies on 2026-10-16. Approved planning baseline: `f4aa1b4438217412c308e61733d862f3d71597ca`, intentionally above `origin/main = 629d2a98715c3a16b954e0f77c639b1f0c31212c`. See the [approved proposal](../research/ticket-breakdown-proposal-2026-10-16.md).

## What to build

The real product ships no disposable comparison behavior, and maintainers receive consolidated docs/provenance plus truthful final acceptance.

## Acceptance criteria

1. [ ] Start only after every implementation ticket 18–28 is closed; keep this cleanup ticket last. Inventory the current documentation/product experiment scope and classify canonical/archive/remove before usage-audited cleanup. Use the dated 2026-10-16 coordinator estimate of 510 tracked effort files/50 Markdown docs, eight product-tree `Prototype*.vue` components/two fixtures as starting evidence, not fixed counts or a deletion target.
2. [ ] Remove residual sample/prototype routes/flags/seeds/comparisons/imports/navigation and unused components/assets/scripts/dependencies/config/harnesses; prove absence from route graph/SSR/production bundles.
3. [ ] Keep valid necessary fixtures tests-only and preserve database/schema/compatibility/shared integration.
4. [ ] Consolidate **all effort-created documentation**, repair links/indexes and archive superseded material without losing accepted rationale/hashes/runtime/device identity/failures.
5. [ ] No blind `.scratch`/capture/untracked user/log/unrelated deletion; collection inventory need not inline-read every historical capture.
6. [ ] After cleanup run integrated parity/browser, typecheck/build, compiled SSR/portal/local-resource and codec/storage/export regressions.
7. [ ] Reconcile B1–B10, targeted Chrome OS-keyboard/physical gestures and keyboard/screen-reader evidence honestly.
8. [ ] Measure final production initial/deferred JS/CSS/resources/startup/mount/overlays/pan/zoom **after comparison removal**, using comparable baseline arms only, reporting missing arms and investigating material regressions without invented budgets/library-only claims.

## Scope and exclusions

Bounded final cleanup/integration, not deferred feature implementation/accessibility/testing. Mechanical steps remain within this final ticket rather than extra publications. No merge/deploy/release/GitHub closure authorization.

## Blocked by

- [Reposition objects and manipulate Orbit geometry safely](25-safe-system-object-and-orbit-manipulation.md)
- [Review destructive changes and exchange independent JSON copies safely](27-reviewed-deletion-and-json-interchange.md)
- [Export clean complete SVG and PNG in active or print light palettes](28-clean-themed-svg-png-exports.md)

Dependency rationale: 25, 27, 28 — terminal closure includes **every ticket 18–28**. All earlier tickets must be closed before starting; this stays **last**.

## Specification and evidence mapping

primary 119–120 plus cleanup amendment; mandatory regression 1–118. **B:** B1–B10 and final performance/evidence consolidation.

Story numbers refer to the [specification user stories](../spec.md#user-stories). B1–B10 refer to the [behavioral acceptance families](../research/spec-test-seams-2026-10-16.md#smallest-useful-high-level-acceptance-suite). Required checks extend crosscutting contracts; primary ownership alone does not certify other owners or the whole product.

## Required product constraints

- Deliver the real persisted-workspace product, never the memory-only sample. Preserve working baseline commands until their replacements work. Use Nuxt UI to the greatest practical extent: evaluate configuration, slots and adapters before bespoke equivalents and document the smallest justified exception. Keep the SSR shell/client maps and one provider/CSS integration.
- Preserve domain vocabulary, authoritative validation, references, host/recovery corrections, database `ttrpg-cluster-control`, marker `ttrpg-cluster-control-map`, schema/version and applicable drag identities. Support accepted older shapes inside that marker/version boundary; add no migration or previous-marker fallback, durable drafts, renderer or unrelated feature.
- At affected seams, own session draft identity/content/errors above presentation lifetime; hide/theme/reflow retain work. Refuse actual target/dependency conflicts before preview while allowing independent commands. Apply validates latest committed memory and ends its designated session before durable saving; failure retains applied data with truthful recovery. Scoped Cancel never undoes committed work. Preparation is read-only, and changed destructive effects require renewed review. Backup restoration retains its distinct durable-before-publication guarantee.
- Verify relevant light/dark states, useful text >=4.5:1 and meaningful graphics/controls >=3:1 against actual adjacent/composited backgrounds, non-color cues, names/help, visible unobscured focus, modal entry/return and keyboard/single-pointer alternatives. Automate relevant mobile portrait/landscape/touch/reduced-height flows; 390×844, 844×390 and 390×500 are useful starting viewports. Target Android Chrome only for supplementary real OS-keyboard open/closed, safe-area and physical gesture checks. Simulation is not physical proof; report unavailable gates explicitly, without invented passes or a new device/CI harness. Desktop support retains baseline scope.
- This feature owns its acceptance tests now; final cleanup does not supply missing feature checks. Record source/runtime/product route, validated fixture, viewport/browser/device/input and passed/failed/unexecuted/unavailable outcomes and limits. Preserve user storage with isolated browser contexts; historical prototype passes are prior art, not current integrated acceptance.

## Validation strategy

After usage-audited cleanup, run the integrated preserved-capability/browser suite, typecheck/build, compiled SSR/portal/local-resource and relevant codec/storage/export checks. Reconcile B1–B10 with actual Chrome keyboard/physical and assistive evidence. Measure comparable production resources/startup/overlays/map interaction after experimental code removal; report missing arms and no invented numerical budget.

The primary seam is the real integrated product through the existing Playwright browser suite, with narrow codec/domain/storage tests only for the relevant invariant. Use actual downloads and durable reload where applicable. Run affected checks and appropriate typecheck/build; compiled-production presentation checks supplement development iteration. No new application test API or separate component harness is required.

## Execution and handoff

Coordination and analysis use `gpt-6.1-sol` at High effort; delegated implementation uses `gpt-6-luna` at XHigh effort, as requested by the human. Follow the [project-development workflow](../../../.agents/skills/project-development/SKILL.md), including complexity/risk routing, required architecture contracts and independent reviews; sensitive persistence, destructive operations and interchange require complementary technical and domain/data review. Delegated specialists stay within their assigned scope and do not restart routing.

No implementation has started and no assignee is set. Work blockers-first; preserve other agents' work. Return changed behavior, evidence identities/outcomes/limitations and unresolved findings to the coordinator. This ticket does not authorize GitHub writes, source-issue closure, merge or deployment.
