---
title: 'Review destructive changes and exchange independent JSON copies safely'
status: open
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 27: Review destructive changes and exchange independent JSON copies safely

## Parent

[Revamp the interface: responsive map editing with preserved local work](../spec.md). Source request: [Revamp the interface](https://github.com/Submoon/ttrpg-cluster-control/issues/3).

The human approved the twelve-ticket breakdown and exact dependencies on 2026-10-16. Approved planning baseline: `f4aa1b4438217412c308e61733d862f3d71597ca`, intentionally above `origin/main = 629d2a98715c3a16b954e0f77c639b1f0c31212c`. See the [approved proposal](../research/ticket-breakdown-proposal-2026-10-16.md).

## What to build

Review current deletion/import consequences without losing drafts, confirm an accurate change and exchange complete applied cluster/system JSON.

## Acceptance criteria

1. [ ] Separated/protected Delete prepares actual cascades read-only, resolves ownership at confirmation and recomputes/renews changed effects after another Apply.
2. [ ] Cancel/validation publishes nothing.
3. [ ] Clear deleted selections/per-view IDs/drafts/pending targets/references, retaining unrelated work and fresh subsequent creation contracts.
4. [ ] Parse/validate import before draft resolution; show collisions/possible matches and confirm an independent ID-remapped copy with references/applicability correct and current work retained, never silent merge/replacement.
5. [ ] Reuse freshness/resolution without a new global engine.
6. [ ] Preserve cluster/system geometry/native/custom data and supported older route/circle/ellipse/applicability shapes under unchanged marker/version/no-fallback.
7. [ ] Current JSON includes latest applied memory under failed saving and excludes drafts/previews/UI state.
8. [ ] Invalid/canceled/download failures preserve work; successful export cannot clear save failure; valid application survives subsequent storage failure with Retry/recovery JSON.
9. [ ] Verify downloads/reload/menu/review reachability.

## Scope and exclusions

One reviewed workspace-change/files journey across existing cascade/import/codec commands. No migration/merge/undo/defaults fix/related closure. Early recovery JSON stays available. Owners 23/25 integrate their own pending-target invalidation rather than forcing an all-gestures dependency.

## Blocked by

- [Construct and arrange a Jump Cluster with complete Jump Routes](24-cluster-systems-and-jump-routes.md)
- [Consult, edit and create Fields without losing work or assignments](26-resumable-fields-lifecycle.md)

Dependency rationale: 24 — route/endpoint owner and cluster pending targets must work; 26 — Fields owners and reviewed-plan freshness/resolution must work. Object/Orbit owners are inherited; no image/system-gesture prerequisite.

Prerequisite24 is satisfied on2026-10-21. This ticket remains blocked by26 and unclaimed; the approved dependency graph is retained.

## Specification and evidence mapping

primary 94–98, 100; checks 3, 9, 15, 27, 36–43, 47–49, 58, 61, 78–80, 82–93, 99, 107–110, 120. **B:** B1, B4–B9.

Story numbers refer to the [specification user stories](../spec.md#user-stories). B1–B10 refer to the [behavioral acceptance families](../research/spec-test-seams-2026-10-16.md#smallest-useful-high-level-acceptance-suite). Required checks extend crosscutting contracts; primary ownership alone does not certify other owners or the whole product.

## Required product constraints

- Preserve the accepted B/Dock composition for every UI surface changed by this ticket: bottom mode/creation Dock, full map board, optional desktop overlay panels and a compact header. Nuxt UI may change control appearance, spacing and typography; pixel identity is not required. Compare the actual integrated result with the accepted reference at comparable viewport/theme/state, recording structural differences, ordinary hit testing and focus. Behavioral passes do not certify visual fidelity. Follow the [presentation acceptance reset](../research/interface-fidelity-reset-2026-10-16.md); technical contracts cannot silently replace the approved composition.

- Deliver the real persisted-workspace product, never the memory-only sample. Preserve working baseline commands until their replacements work. Use Nuxt UI to the greatest practical extent: evaluate configuration, slots and adapters before bespoke equivalents and document the smallest justified exception. Keep the SSR shell/client maps and one provider/CSS integration.
- Preserve domain vocabulary, authoritative validation, references, host/recovery corrections, database `ttrpg-cluster-control`, marker `ttrpg-cluster-control-map`, schema/version and applicable drag identities. Support accepted older shapes inside that marker/version boundary; add no migration or previous-marker fallback, durable drafts, renderer or unrelated feature.
- At affected seams, own session draft identity/content/errors above presentation lifetime; hide/theme/reflow retain work. Refuse actual target/dependency conflicts before preview while allowing independent commands. Apply validates latest committed memory and ends its designated session before durable saving; failure retains applied data with truthful recovery. Scoped Cancel never undoes committed work. Preparation is read-only, and changed destructive effects require renewed review. Backup restoration retains its distinct durable-before-publication guarantee.
- Verify relevant light/dark states, useful text >=4.5:1 and meaningful graphics/controls >=3:1 against actual adjacent/composited backgrounds, non-color cues, names/help, visible unobscured focus, modal entry/return and keyboard/single-pointer alternatives. Automate relevant mobile portrait/landscape/touch/reduced-height flows; 390×844, 844×390 and 390×500 are useful starting viewports. Target Android Chrome only for supplementary real OS-keyboard open/closed, safe-area and physical gesture checks. Simulation is not physical proof; report unavailable gates explicitly, without invented passes or a new device/CI harness. Desktop support retains baseline scope.
- This feature owns its acceptance tests now; final cleanup does not supply missing feature checks. Record source/runtime/product route, validated fixture, viewport/browser/device/input and passed/failed/unexecuted/unavailable outcomes and limits. Preserve user storage with isolated browser contexts; historical prototype passes are prior art, not current integrated acceptance.

## Validation strategy

Use real reviewed cascades and valid/invalid cluster/system imports, changed plans, canceled reviews, download errors and failed saving. Inspect independent-copy IDs/references/applicability, existing work retention and stale-ID cleanup in actual downloads/reload. Preserve narrow codec/accepted-shape/storage regressions alongside the visible journeys.

The primary seam is the real integrated product through the existing Playwright browser suite, with narrow codec/domain/storage tests only for the relevant invariant. Use actual downloads and durable reload where applicable. Run affected checks and appropriate typecheck/build; compiled-production presentation checks supplement development iteration. No new application test API or separate component harness is required.

## Execution and handoff

Coordination and analysis use `gpt-6.1-sol` at High effort; delegated implementation uses `gpt-6-luna` at XHigh effort, as requested by the human. Follow the [project-development workflow](../../../.agents/skills/project-development/SKILL.md), including complexity/risk routing, required architecture contracts and independent reviews; sensitive persistence, destructive operations and interchange require complementary technical and domain/data review. Delegated specialists stay within their assigned scope and do not restart routing.

No implementation has started and no assignee is set. Work blockers-first; preserve other agents' work. Return changed behavior, evidence identities/outcomes/limitations and unresolved findings to the coordinator. This ticket does not authorize GitHub writes, source-issue closure, merge or deployment.
