---
title: 'Consult, edit and create Fields without losing work or assignments'
status: open
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 26: Consult, edit and create Fields without losing work or assignments

## Parent

[Revamp the interface: responsive map editing with preserved local work](../spec.md). Source request: [Revamp the interface](https://github.com/Submoon/ttrpg-cluster-control/issues/3).

The human approved the twelve-ticket breakdown and exact dependencies on 2026-10-16. Approved planning baseline: `f4aa1b4438217412c308e61733d862f3d71597ca`, intentionally above `origin/main = 629d2a98715c3a16b954e0f77c639b1f0c31212c`. See the [approved proposal](../research/ticket-breakdown-proposal-2026-10-16.md).

## What to build

Fields/Manage resume one session for consultation, explicit editing, custom creation and reviewed assignment changes.

## Acceptance criteria

1. [ ] List → saved detail → Edit; compact full-area screens versus bounded centered desktop columns.
2. [ ] Show type/choices/applicability/assignments.
3. [ ] Back restores list position/highlight/focus; Close hides/returns to the actual opener, retaining map/editor/session.
4. [ ] Manage invents no target.
5. [ ] Definition/creation drafts survive Back/hide/theme/reflow; modified target/New changes use Apply/Discard/Stay, clean changes do not prompt.
6. [ ] One guarded New entry per screen supports text/number/boolean/single-select/choices; success opens new read-only detail, explicit Cancel returns without creation, Close retains draft.
7. [ ] Preserve native options/applicability/ineligible values/zero/false.
8. [ ] Prepare type/option/deletion impacts read-only before object-draft resolution, reprepare/renew changed consequences after Apply and preserve work on Cancel/invalidity.
9. [ ] Selected deletion returns to a valid row/list control, clears IDs and never defaults to Atmosphere.
10. [ ] Memory-first acknowledgement/Retry cannot duplicate creation.
11. [ ] Compact header/internal scroll/bottom actions/reviews/errors work with Android Chrome keyboard open/closed.

## Scope and exclusions

The existing full Fields lifecycle in ordered consultation/edit/create/impact steps, reusing controls/domain logic. No extra types, durable drafts or form builder. Establish freshness through real field changes; 27 reuses the semantic contract.

## Blocked by

- [Edit complete object and Orbit data through a resumable Inspector](22-complete-object-and-orbit-inspectors.md)

Dependency rationale: 22 — object draft/definition conflicts must resolve through the real owner; 20/21 session/presentation contracts are inherited.

## Specification and evidence mapping

primary 67–81; checks 14–16, 55–57, 61–62, 82–96, 105–111, 120. **B:** B1, B4–B7, B9.

Story numbers refer to the [specification user stories](../spec.md#user-stories). B1–B10 refer to the [behavioral acceptance families](../research/spec-test-seams-2026-10-16.md#smallest-useful-high-level-acceptance-suite). Required checks extend crosscutting contracts; primary ownership alone does not certify other owners or the whole product.

## Required product constraints

- Preserve the accepted B/Dock composition for every UI surface changed by this ticket: bottom mode/creation Dock, full map board, optional desktop overlay panels and a compact header. Nuxt UI may change control appearance, spacing and typography; pixel identity is not required. Compare the actual integrated result with the accepted reference at comparable viewport/theme/state, recording structural differences, ordinary hit testing and focus. Behavioral passes do not certify visual fidelity. Follow the [presentation acceptance reset](../research/interface-fidelity-reset-2026-10-16.md); technical contracts cannot silently replace the approved composition.

- Deliver the real persisted-workspace product, never the memory-only sample. Preserve working baseline commands until their replacements work. Use Nuxt UI to the greatest practical extent: evaluate configuration, slots and adapters before bespoke equivalents and document the smallest justified exception. Keep the SSR shell/client maps and one provider/CSS integration.
- Preserve domain vocabulary, authoritative validation, references, host/recovery corrections, database `ttrpg-cluster-control`, marker `ttrpg-cluster-control-map`, schema/version and applicable drag identities. Support accepted older shapes inside that marker/version boundary; add no migration or previous-marker fallback, durable drafts, renderer or unrelated feature.
- At affected seams, own session draft identity/content/errors above presentation lifetime; hide/theme/reflow retain work. Refuse actual target/dependency conflicts before preview while allowing independent commands. Apply validates latest committed memory and ends its designated session before durable saving; failure retains applied data with truthful recovery. Scoped Cancel never undoes committed work. Preparation is read-only, and changed destructive effects require renewed review. Backup restoration retains its distinct durable-before-publication guarantee.
- Verify relevant light/dark states, useful text >=4.5:1 and meaningful graphics/controls >=3:1 against actual adjacent/composited backgrounds, non-color cues, names/help, visible unobscured focus, modal entry/return and keyboard/single-pointer alternatives. Automate relevant mobile portrait/landscape/touch/reduced-height flows; 390×844, 844×390 and 390×500 are useful starting viewports. Target Android Chrome only for supplementary real OS-keyboard open/closed, safe-area and physical gesture checks. Simulation is not physical proof; report unavailable gates explicitly, without invented passes or a new device/CI harness. Desktop support retains baseline scope.
- This feature owns its acceptance tests now; final cleanup does not supply missing feature checks. Record source/runtime/product route, validated fixture, viewport/browser/device/input and passed/failed/unexecuted/unavailable outcomes and limits. Preserve user storage with isolated browser contexts; historical prototype passes are prior art, not current integrated acceptance.

## Validation strategy

Exercise the complete Fields list/detail/Edit/New/impact lifecycle with long definitions, choices/assignments, every custom type, zero/false and ineligible stored values. Verify both draft owners, renewed consequences after another Apply, creation without replay, real opener/list focus and compiled modal geometry, plus targeted Chrome keyboard checks.

The primary seam is the real integrated product through the existing Playwright browser suite, with narrow codec/domain/storage tests only for the relevant invariant. Use actual downloads and durable reload where applicable. Run affected checks and appropriate typecheck/build; compiled-production presentation checks supplement development iteration. No new application test API or separate component harness is required.

## Execution and handoff

Coordination and analysis use `gpt-6.1-sol` at High effort; delegated implementation uses `gpt-6-luna` at XHigh effort, as requested by the human. Follow the [project-development workflow](../../../.agents/skills/project-development/SKILL.md), including complexity/risk routing, required architecture contracts and independent reviews; sensitive persistence, destructive operations and interchange require complementary technical and domain/data review. Delegated specialists stay within their assigned scope and do not restart routing.

No implementation has started and no assignee is set. Work blockers-first; preserve other agents' work. Return changed behavior, evidence identities/outcomes/limitations and unresolved findings to the coordinator. This ticket does not authorize GitHub writes, source-issue closure, merge or deployment.
