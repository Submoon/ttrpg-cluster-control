---
title: 'Export clean complete SVG and PNG in active or print light palettes'
status: open
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 28: Export clean complete SVG and PNG in active or print light palettes

## Parent

[Revamp the interface: responsive map editing with preserved local work](../spec.md). Source request: [Revamp the interface](https://github.com/Submoon/ttrpg-cluster-control/issues/3).

The human approved the twelve-ticket breakdown and exact dependencies on 2026-10-16. Approved planning baseline: `f4aa1b4438217412c308e61733d862f3d71597ca`, intentionally above `origin/main = 629d2a98715c3a16b954e0f77c639b1f0c31212c`. See the [approved proposal](../research/ticket-breakdown-proposal-2026-10-16.md).

## What to build

Standalone SVG/matching PNG contain the full applied map in active light/dark or export-only Light for printing, independently of viewport/failed save.

## Acceptance criteria

1. [ ] Applied-only scene/bounds include off-viewport geometry and long applied system title band.
2. [ ] Exclude selection/focus/hover/handles/drafts/gesture/candidate previews **before bounds**, retaining meaningful map/unresolved cues.
3. [ ] Resolve export palette without changing live preference; standalone SVG and PNG match arrangement/palette/title/bounds.
4. [ ] Exercise both maps × active-light/active-dark/print × SVG/PNG with dense content/hidden draft/preview/failed save.
5. [ ] Before/after applied JSON/live state proves no selection/view/tool/gesture/draft/theme/save mutation, implicit Apply/Discard or conflated export error.
6. [ ] New target owners extend exclusion checks as introduced.

## Scope and exclusions

Existing export-result seam, not a renderer or player/secrecy filter. Independent early branch consumes stable applied/palette contracts.

## Blocked by

- [Explore separate maps through the responsive Dock, Hierarchy and Inspect](21-responsive-map-navigation-and-panels.md)

Dependency rationale: 21 — real map/files context plus inherited 20 applied-state and 19 palette contracts. Fixtures avoid full creation/Fields/destruction dependencies.

## Specification and evidence mapping

primary 112–116; checks 15, 55–57, 82–93, 99–100, 103–110, 120. **B:** B1, B4, B7, B9–B10.

Story numbers refer to the [specification user stories](../spec.md#user-stories). B1–B10 refer to the [behavioral acceptance families](../research/spec-test-seams-2026-10-16.md#smallest-useful-high-level-acceptance-suite). Required checks extend crosscutting contracts; primary ownership alone does not certify other owners or the whole product.

## Required product constraints

- Preserve the accepted B/Dock composition for every UI surface changed by this ticket: bottom mode/creation Dock, full map board, optional desktop overlay panels and a compact header. Nuxt UI may change control appearance, spacing and typography; pixel identity is not required. Compare the actual integrated result with the accepted reference at comparable viewport/theme/state, recording structural differences, ordinary hit testing and focus. Behavioral passes do not certify visual fidelity. Follow the [presentation acceptance reset](../research/interface-fidelity-reset-2026-10-16.md); technical contracts cannot silently replace the approved composition.

- Deliver the real persisted-workspace product, never the memory-only sample. Preserve working baseline commands until their replacements work. Use Nuxt UI to the greatest practical extent: evaluate configuration, slots and adapters before bespoke equivalents and document the smallest justified exception. Keep the SSR shell/client maps and one provider/CSS integration.
- Preserve domain vocabulary, authoritative validation, references, host/recovery corrections, database `ttrpg-cluster-control`, marker `ttrpg-cluster-control-map`, schema/version and applicable drag identities. Support accepted older shapes inside that marker/version boundary; add no migration or previous-marker fallback, durable drafts, renderer or unrelated feature.
- At affected seams, own session draft identity/content/errors above presentation lifetime; hide/theme/reflow retain work. Refuse actual target/dependency conflicts before preview while allowing independent commands. Apply validates latest committed memory and ends its designated session before durable saving; failure retains applied data with truthful recovery. Scoped Cancel never undoes committed work. Preparation is read-only, and changed destructive effects require renewed review. Backup restoration retains its distinct durable-before-publication guarantee.
- Verify relevant light/dark states, useful text >=4.5:1 and meaningful graphics/controls >=3:1 against actual adjacent/composited backgrounds, non-color cues, names/help, visible unobscured focus, modal entry/return and keyboard/single-pointer alternatives. Automate relevant mobile portrait/landscape/touch/reduced-height flows; 390×844, 844×390 and 390×500 are useful starting viewports. Target Android Chrome only for supplementary real OS-keyboard open/closed, safe-area and physical gesture checks. Simulation is not physical proof; report unavailable gates explicitly, without invented passes or a new device/CI harness. Desktop support retains baseline scope.
- This feature owns its acceptance tests now; final cleanup does not supply missing feature checks. Record source/runtime/product route, validated fixture, viewport/browser/device/input and passed/failed/unexecuted/unavailable outcomes and limits. Preserve user storage with isolated browser contexts; historical prototype passes are prior art, not current integrated acceptance.

## Validation strategy

Independently inspect standalone SVG and matching PNG across both maps and active-light/active-dark/print-light palettes. Include long titles, off-viewport/dense geometry, hidden drafts, selection and active previews under failed saving; compare full bounds/content and live state/applied JSON before and after success/failure.

The primary seam is the real integrated product through the existing Playwright browser suite, with narrow codec/domain/storage tests only for the relevant invariant. Use actual downloads and durable reload where applicable. Run affected checks and appropriate typecheck/build; compiled-production presentation checks supplement development iteration. No new application test API or separate component harness is required.

## Execution and handoff

Coordination and analysis use `gpt-6.1-sol` at High effort; delegated implementation uses `gpt-6-luna` at XHigh effort, as requested by the human. Follow the [project-development workflow](../../../.agents/skills/project-development/SKILL.md), including complexity/risk routing, required architecture contracts and independent reviews; sensitive persistence, destructive operations and interchange require complementary technical and domain/data review. Delegated specialists stay within their assigned scope and do not restart routing.

No implementation has started and no assignee is set. Work blockers-first; preserve other agents' work. Return changed behavior, evidence identities/outcomes/limitations and unresolved findings to the coordinator. This ticket does not authorize GitHub writes, source-issue closure, merge or deployment.

## Current availability - 2026-10-19

Ticket21 completes its scoped B/Dock reassessment. This ticket is now open and unclaimed; no implementation is started. Its predecessor preserves existing export capabilities and records their successful focused checks; that evidence does not implement this ticket's complete clean/export-palette contract. See [the ticket21 execution record](../research/implementation-21-resume-2026-10-19.md) for source identities and validation limits.
