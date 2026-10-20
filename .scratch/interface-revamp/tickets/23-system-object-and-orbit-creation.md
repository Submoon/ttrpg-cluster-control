---
title: 'Populate star systems with every catalogue type and Orbit structure'
status: closed
assignee: ticket23
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

1. [x] Introduce real chooser, same-type lifetime, type/next-target/Quit and compact context-banner reuse through working system creation.
2. [x] Retain Back/context and Inspect on demand.
3. [x] Dismissal consumes Escape/outside input before map quit/placement, preserving progress/type/drafts; Quit drops only unfinished work.
4. [x] Place at the actual transformed/rotated/nested target, never a fixed angle.
5. [x] Indicate candidates without hover, explicitly resolve overlap, explain invalid targets without mutation/reset, and provide keyboard/single-pointer preview/Confirm/Cancel/coordinates/Orbit-position alternatives.
6. [x] Add Orbit chooses object host or unoccupied center with nested validation and independent per-axis corrections/notices.
7. [x] Pan/takeover/cancel/interruption cannot publish partial creation; valid completion publishes once with real save-failure/JSON/reload checks.

## Scope and exclusions

Existing system creation catalogue, two result families sharing targeting/lifetime. This real first Add journey supplies reusable chooser behavior for cluster ticket 24; no horizontal prefactor, manipulation handles, Fields editor or defaults-generator change.

## Blocked by

- [Edit complete object and Orbit data through a resumable Inspector](22-complete-object-and-orbit-inspectors.md)

Dependency rationale: 22 — actual object/Orbit draft dependency authority must reject conflicting creation before preview.

## Specification and evidence mapping

primary 24–25, 27–37, 51–52; checks 26, 40, 43–46, 49, 60, 82–93, 96, 107–111, 120. **B:** B1–B5, B7, B9.

Story numbers refer to the [specification user stories](../spec.md#user-stories). B1–B10 refer to the [behavioral acceptance families](../research/spec-test-seams-2026-10-16.md#smallest-useful-high-level-acceptance-suite). Required checks extend crosscutting contracts; primary ownership alone does not certify other owners or the whole product.

## Required product constraints

- Preserve the accepted B/Dock composition for every UI surface changed by this ticket: bottom mode/creation Dock, full map board, optional desktop overlay panels and a compact header. Nuxt UI may change control appearance, spacing and typography; pixel identity is not required. Compare the actual integrated result with the accepted reference at comparable viewport/theme/state, recording structural differences, ordinary hit testing and focus. Behavioral passes do not certify visual fidelity. Follow the [presentation acceptance reset](../research/interface-fidelity-reset-2026-10-16.md); technical contracts cannot silently replace the approved composition.

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

Work blockers-first; preserve other agents' work. Return changed behavior, evidence identities/outcomes/limitations and unresolved findings to the coordinator. This ticket does not independently authorize GitHub writes, source-issue closure, merge or deployment.

## Explicit implementation - 2026-10-20

The human requests coordinated implement for ticket23, retaining the accepted prototype conclusions and maximum Nuxt UI reuse. Claimed from `0bd3b33d106fa0631ed7dbd5f6e73af018e1422e`, equal to the freshly fetched feature remote, with a clean tracked tree. Main remains `629d2a98715c3a16b954e0f77c639b1f0c31212c` (0 main-only /44 feature-only commits). This is the intentional feature baseline; issue3 is open and unchanged. SOL6.1 High defines and reviews the sensitive placement/draft contract; bounded Luna XHIGH agents implement. Coordinator owns lifecycle/Git; one QA owner serializes runtime. Reuse the human-approved actual-product Playwright/import/download/reload seam. See [the execution record](../research/implementation-23-2026-10-20.md). No successor is started.

## Resolution

Completed from the intentional feature baseline `0bd3b33d106fa0631ed7dbd5f6e73af018e1422e`. Final fresh origin/source reads still match that feature remote and main `629d2a98715c3a16b954e0f77c639b1f0c31212c` (0 main-only / 44 feature-only before this delivery); issue3 remains open and unchanged.

All fifteen catalogue subtypes and hosted/unoccupied Orbits use one parent-owned, repeatable Add session with precise map or numeric targeting, named ambiguity, preview/Confirm/Cancel and truthful single publication/save recovery. Existing object positions, authoritative draft exclusion, MIME identities, codecs and database schema are preserved. Chooser dismissal consumes its sequence; view navigation cancels only unfinished geometry. Nuxt UI supplies the anchored chooser, category/catalogue buttons and precision controls. The small documented input-sequence adapter preserves ordinary native dragging and outside dismissal.

The human's Chart details presentation feedback is included: padded Nuxt UI consultation, aligned statistics and a shared named header action. The obstructive tooltip is removed. Preservation also fixes preview redraw canceling new view navigation and a decorative rotation stem intercepting the vertical resize handle; geometry and actual rotation controls remain unchanged.

Validation is attributed, not a blanket whole-suite certificate: the sole complete invocation is **111 passed / 8 failed / 119 executed**, zero skipped/flaky. All eight failed journeys have successful focused retests after reviewed corrections; logical test splits yield121 canonical cases. Final palette regressions pass6/6, the complete original ellipse journey passes1/1, final gesture checks pass2/2, and typecheck plus the required production builds pass. Five builds correspond to actual source changes; no complete-suite repeat, raised deadline, weakened precision or forced interaction is used. See the [execution record](../research/implementation-23-2026-10-20.md) and [final QA report](../implementation-lab/ticket-23-2026-10-20/qa/final-gate-report.md) for exact intermediate failures, identities and limitations.

Final Add comparisons pass27/27 checks across three root/B pairs; the two unchanged-scope Chart views pass20/20. Eight selected images retain per-candidate provenance. Coordinator visual inspection accepts the bounded B/Dock structure; Nuxt control appearance and root/B fixture differences are explicit. Final category/help contrast minima exceed7:1. Physical Android Chrome, OS keyboard and safe-area checks remain unavailable. Owned servers are stopped and3100/3180 are free.

Tickets24 and25 are now open and unclaimed;26 and28 remain open;27 and29 remain blocked. No successor is started. Source issue3 stays open, PR28 stays draft, and final whole-interface Astra review including Tools coherence remains ticket29.
