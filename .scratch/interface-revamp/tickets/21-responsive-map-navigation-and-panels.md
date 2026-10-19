---
title: 'Explore separate maps through the responsive Dock, Hierarchy and Inspect'
status: open
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 21: Explore separate maps through the responsive Dock, Hierarchy and Inspect

## Parent

[Revamp the interface: responsive map editing with preserved local work](../spec.md). Source request: [Revamp the interface](https://github.com/Submoon/ttrpg-cluster-control/issues/3).

The human approved the twelve-ticket breakdown and exact dependencies on 2026-10-16. Approved planning baseline: `f4aa1b4438217412c308e61733d862f3d71597ca`, intentionally above `origin/main = 629d2a98715c3a16b954e0f77c639b1f0c31212c`. See the [approved proposal](../research/ticket-breakdown-proposal-2026-10-16.md).

## Acceptance reassessment - 2026-10-16

The human rejects the integrated composition at published source `b37c1abd512c6f47a59774ae3824965e420744b7` and withdraws acceptance of the 18-21 batch. Earlier technical results remain historical, scope-specific evidence; they do not establish conformity to the accepted B/Dock interface or a passing full preservation suite. Reassess this ticket against the corrected specification and [presentation acceptance reset](../research/interface-fidelity-reset-2026-10-16.md) before closing it again. Preserve usable application code and evidence rather than assuming everything must be rewritten.

Ticket 18 is reopened and unclaimed for reassessment; tickets 19-21 are blocked by the same approved dependency chain. Later tickets remain blocked. The human explicitly instructs planning corrections only, then a stop; do not resume implementation or tests until asked.

## What to build

Reproduce the accepted B/Dock composition using Nuxt UI: one full map board, a bottom mode/creation Dock, one bottom-right zoom set, optional desktop overlay panels and compact application/map chrome. Navigate deliberately enters a system, Select requests its data, and compact Inspect/Hierarchy are fullscreen/exclusive. Nuxt UI control styling may differ from the prototype; the page structure must remain recognizable.

## Acceptance criteria

1. [ ] Show context/names/Back, fit first visits and restore each map's session viewport/valid selection; clear deleted IDs.
2. [ ] Short click/tap/Enter/Space differs from drag-pan over entities.
3. [ ] Anchor the Navigate/Select/Move/creation Dock at the bottom and the single zoom set at bottom-right, separate from panel/file commands; retain wheel/keyboard/single-pointer view movement and 25–1600%.
4. [ ] Panel opening/hiding/reflow preserves mode/progress and draft lifetime.
5. [ ] Verify every compact opener/exclusive path, desktop Map files above Inspect, dialog layering/focus return, refused transitions retaining context/view/tool and accepted context changes resetting Navigate.
6. [ ] Fit/target recovery uses actual unobscured area at short heights; long press in Navigate cancels pending activation before Inspect.
7. [ ] Desktop panels overlay a full-size map board instead of consuming fixed page columns. Hierarchy starts hidden. Use suitable Nuxt UI panel/sidebar sizing and resizing, with accessible width adjustment, retained editor instances and session-only widths; document the smallest necessary adapter and verify its actual behavior.
8. [ ] Keep the application header compact. Move Back and adjacent Hierarchy/Inspect/Map files into compact map chrome; retain secondary counts/summaries in consultation surfaces and useful recovery feedback without a decorative footer.
9. [ ] Compare the real product with the accepted B/Dock artifact on desktop, portrait and short landscape, with comparable theme/state and disclosed fixture differences. Record paired views and inspect Dock position, map priority, panel overlap, header density, focus and ordinary hit targets. Allow Nuxt UI visual details without accepting structural drift.
10. [ ] Complete the preserved-capability suite after presentation correction. Resolve or explicitly identify the current Orbit-resize failure and unresolved-exit timeout; do not convert the historical 405 presentation observations or incomplete 93-test invocation into whole-product acceptance.

## Scope and exclusions

Navigation/composition using current maps/editors. Retain functional legacy creation until 23 introduces anchored persistent Add through a real result; no abstract Add framework, renderer replacement or app context menu here.

## Blocked by

- [Rename charts with resumable drafts and trustworthy Apply/save recovery](20-resumable-chart-drafts-and-save-recovery.md)

Dependency rationale: 20 — context/selection/panel changes need working guarded-session acknowledgement.

## Specification and evidence mapping

primary 4–20, 23, 50, 53–54; checks 21–22, 24, 28–32, 44–46, 59, 82–86, 96, 105–111, 119–120. **B:** B1–B5, B9.

Story numbers refer to the [specification user stories](../spec.md#user-stories). B1–B10 refer to the [behavioral acceptance families](../research/spec-test-seams-2026-10-16.md#smallest-useful-high-level-acceptance-suite). Required checks extend crosscutting contracts; primary ownership alone does not certify other owners or the whole product.

## Required product constraints

- Preserve the accepted B/Dock composition for every UI surface changed by this ticket: bottom mode/creation Dock, full map board, optional desktop overlay panels and a compact header. Nuxt UI may change control appearance, spacing and typography; pixel identity is not required. Compare the actual integrated result with the accepted reference at comparable viewport/theme/state, recording structural differences, ordinary hit testing and focus. Behavioral passes do not certify visual fidelity. Follow the [presentation acceptance reset](../research/interface-fidelity-reset-2026-10-16.md); technical contracts cannot silently replace the approved composition.

- Deliver the real persisted-workspace product, never the memory-only sample. Preserve working baseline commands until their replacements work. Use Nuxt UI to the greatest practical extent: evaluate configuration, slots and adapters before bespoke equivalents and document the smallest justified exception. Keep the SSR shell/client maps and one provider/CSS integration.
- Preserve domain vocabulary, authoritative validation, references, host/recovery corrections, database `ttrpg-cluster-control`, marker `ttrpg-cluster-control-map`, schema/version and applicable drag identities. Support accepted older shapes inside that marker/version boundary; add no migration or previous-marker fallback, durable drafts, renderer or unrelated feature.
- At affected seams, own session draft identity/content/errors above presentation lifetime; hide/theme/reflow retain work. Refuse actual target/dependency conflicts before preview while allowing independent commands. Apply validates latest committed memory and ends its designated session before durable saving; failure retains applied data with truthful recovery. Scoped Cancel never undoes committed work. Preparation is read-only, and changed destructive effects require renewed review. Backup restoration retains its distinct durable-before-publication guarantee.
- Verify relevant light/dark states, useful text >=4.5:1 and meaningful graphics/controls >=3:1 against actual adjacent/composited backgrounds, non-color cues, names/help, visible unobscured focus, modal entry/return and keyboard/single-pointer alternatives. Automate relevant mobile portrait/landscape/touch/reduced-height flows; 390×844, 844×390 and 390×500 are useful starting viewports. Target Android Chrome only for supplementary real OS-keyboard open/closed, safe-area and physical gesture checks. Simulation is not physical proof; report unavailable gates explicitly, without invented passes or a new device/CI harness. Desktop support retains baseline scope.
- This feature owns its acceptance tests now; final cleanup does not supply missing feature checks. Record source/runtime/product route, validated fixture, viewport/browser/device/input and passed/failed/unexecuted/unavailable outcomes and limits. Preserve user storage with isolated browser contexts; historical prototype passes are prior art, not current integrated acceptance.

## Validation strategy

Exercise role/name-based keyboard and ordinary hit-tested click/tap/drag on both map wrappers, nested Hierarchy and every panel entry/reflow. Check actual usable regions, Fit/Back/zoom, desktop Map files above Inspect and compiled-production portal/focus geometry; retain existing capability assertions while adapting presentation locators.

The primary seam is the real integrated product through the existing Playwright browser suite, with narrow codec/domain/storage tests only for the relevant invariant. Use actual downloads and durable reload where applicable. Run affected checks and appropriate typecheck/build; compiled-production presentation checks supplement development iteration. No new application test API or separate component harness is required.

## Execution and handoff

Coordination and analysis use `gpt-6.1-sol` at High effort; delegated implementation uses `gpt-6-luna` at XHigh effort, as requested by the human. Follow the [project-development workflow](../../../.agents/skills/project-development/SKILL.md), including complexity/risk routing, required architecture contracts and independent reviews; sensitive persistence, destructive operations and interchange require complementary technical and domain/data review. Delegated specialists stay within their assigned scope and do not restart routing.

Work blockers-first; preserve other agents' work. Return changed behavior, evidence identities/outcomes/limitations and unresolved findings to the coordinator. This ticket does not independently authorize GitHub writes, source-issue closure, merge or deployment; the later human request authorizes the sequential branch commit/push.

## Comments

> *This was generated by AI during triage.*

2026-10-16 — Claimed only after completed ticket 20 is committed/pushed as `338cc138200da11e3e50cfd8eea071bacb17474a`, equal to the remote feature branch. Fresh origin comparison shows 0 main-only / 27 feature-only against `origin/main = 629d2a98715c3a16b954e0f77c639b1f0c31212c`. This intentional baseline is the fixed review base. Complex navigation/composition with sensitive retained-draft/context boundaries requires a SOL 6.1 High contract, Luna XHIGH implementation and independent technical plus domain/data reviews. Full preservation testing runs after integration of this final ticket in the authorized four-ticket sequence. Physical Android Chrome proof remains supplementary and unavailable, never inferred from emulation.

## Current availability - 2026-10-19

Ticket 20 completes its scoped reassessment; this ticket is available and unclaimed. The human explicitly authorizes resumption only after ticket 20 is finished and committed/pushed. The corrected B/Dock structural contract and maximum Nuxt UI reuse remain mandatory: bottom Dock, full map board, optional resizable desktop overlays, compact header/map chrome and exclusive fullscreen compact panels. Nuxt UI appearance may differ; structural substitutions remain rejected. No implementation is started by this availability update.