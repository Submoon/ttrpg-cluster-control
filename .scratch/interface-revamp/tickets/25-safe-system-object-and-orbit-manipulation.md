---
title: 'Reposition objects and manipulate Orbit geometry safely'
status: closed
assignee: ticket25
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 25: Reposition objects and manipulate Orbit geometry safely

## Parent

[Revamp the interface: responsive map editing with preserved local work](../spec.md). Source request: [Revamp the interface](https://github.com/Submoon/ttrpg-cluster-control/issues/3).

The human approved the twelve-ticket breakdown and exact dependencies on 2026-10-16. Approved planning baseline: `f4aa1b4438217412c308e61733d862f3d71597ca`, intentionally above `origin/main = 629d2a98715c3a16b954e0f77c639b1f0c31212c`. See the [approved proposal](../research/ticket-breakdown-proposal-2026-10-16.md).

## What to build

Move changes object placement/attachment and Orbit axes/rotation/centers deliberately, with coherent dependents and equivalent precise controls.

## Acceptance criteria

1. [x] In Move, dropping an attached object in clear space detaches it at the raw drop position; a unique valid Orbit drop attaches/transfers at the indicated position. Normal free/unique-target release commits directly. Ambiguous targets require a named choice, invalid-only targets refuse without mutation, and precise Orbit/free controls remain an alternative. Preserve former occupants' effective positions. This follows the human's 2026-10-21 amendment; hosted-Orbit centers still require explicit Detach.
2. [x] Transform nested/rotated targets correctly and move hosted/nested dependents in previews/commits.
3. [x] Named Orbit controls provide independent axes, uniform ring resize, rotation/unoccupied-center movement; hosted centers require Detach and attachable centers indicate valid hosts.
4. [x] Preserve cycles/order/geometry/host-minimum notices/expanding scenes and focused/keyboard/numeric/Confirm alternatives.
5. [x] In the **system wrapper**, test every mode over entities/handles with second-contact/right-pan, interruption/tool/Escape/long press and suppressed late release, alongside normal once-only commit.
6. [x] Refuse dependency conflicts before preview; permit independent navigation.
7. [x] Verify applied versus canceled outcomes in JSON/reload/save failure.

## Scope and exclusions

Existing system manipulation family, same renderer/commands/targeting. Cluster evidence is 24; no new geometry model. Integrate image exclusion checks for new previews with 28.

## Blocked by

- [Populate star systems with every catalogue type and Orbit structure](23-system-object-and-orbit-creation.md)

Dependency rationale: 23 — consumes actual destination/candidate/Confirm targeting and inherits 22's commands/draft exclusion. No cluster-construction dependency.

## Specification and evidence mapping

primary 38–43; checks 21–23, 34–37, 44–46, 49–54, 60, 63, 82–93, 96, 107–110, 120. **B:** B1–B5, B7, B9.

Story numbers refer to the [specification user stories](../spec.md#user-stories). B1–B10 refer to the [behavioral acceptance families](../research/spec-test-seams-2026-10-16.md#smallest-useful-high-level-acceptance-suite). Required checks extend crosscutting contracts; primary ownership alone does not certify other owners or the whole product.

## Required product constraints

- Preserve the accepted B/Dock composition for every UI surface changed by this ticket: bottom mode/creation Dock, full map board, optional desktop overlay panels and a compact header. Nuxt UI may change control appearance, spacing and typography; pixel identity is not required. Compare the actual integrated result with the accepted reference at comparable viewport/theme/state, recording structural differences, ordinary hit testing and focus. Behavioral passes do not certify visual fidelity. Follow the [presentation acceptance reset](../research/interface-fidelity-reset-2026-10-16.md); technical contracts cannot silently replace the approved composition.

- Deliver the real persisted-workspace product, never the memory-only sample. Preserve working baseline commands until their replacements work. Use Nuxt UI to the greatest practical extent: evaluate configuration, slots and adapters before bespoke equivalents and document the smallest justified exception. Keep the SSR shell/client maps and one provider/CSS integration.
- Preserve domain vocabulary, authoritative validation, references, host/recovery corrections, database `ttrpg-cluster-control`, marker `ttrpg-cluster-control-map`, schema/version and applicable drag identities. Support accepted older shapes inside that marker/version boundary; add no migration or previous-marker fallback, durable drafts, renderer or unrelated feature.
- At affected seams, own session draft identity/content/errors above presentation lifetime; hide/theme/reflow retain work. Refuse actual target/dependency conflicts before preview while allowing independent commands. Apply validates latest committed memory and ends its designated session before durable saving; failure retains applied data with truthful recovery. Scoped Cancel never undoes committed work. Preparation is read-only, and changed destructive effects require renewed review. Backup restoration retains its distinct durable-before-publication guarantee.
- Verify relevant light/dark states, useful text >=4.5:1 and meaningful graphics/controls >=3:1 against actual adjacent/composited backgrounds, non-color cues, names/help, visible unobscured focus, modal entry/return and keyboard/single-pointer alternatives. Automate relevant mobile portrait/landscape/touch/reduced-height flows; 390×844, 844×390 and 390×500 are useful starting viewports. Target Android Chrome only for supplementary real OS-keyboard open/closed, safe-area and physical gesture checks. Simulation is not physical proof; report unavailable gates explicitly, without invented passes or a new device/CI harness. Desktop support retains baseline scope.
- This feature owns its acceptance tests now; final cleanup does not supply missing feature checks. Record source/runtime/product route, validated fixture, viewport/browser/device/input and passed/failed/unexecuted/unavailable outcomes and limits. Preserve user storage with isolated browser contexts; historical prototype passes are prior art, not current integrated acceptance.

## Validation strategy

Verify the system wrapper independently over objects and all Orbit handle families, including normal release and canceled late release. Use rotated/nested/off-initial-scene fixtures, explicit alternatives, invalid hosts/conflicts, dependent previews and actual JSON/reload/save-failure outcomes.

The primary seam is the real integrated product through the existing Playwright browser suite, with narrow codec/domain/storage tests only for the relevant invariant. Use actual downloads and durable reload where applicable. Run affected checks and appropriate typecheck/build; compiled-production presentation checks supplement development iteration. No new application test API or separate component harness is required.

## Execution and handoff

Coordination and analysis use `gpt-6.1-sol` at High effort; delegated implementation uses `gpt-6-luna` at XHigh effort, as requested by the human. Follow the [project-development workflow](../../../.agents/skills/project-development/SKILL.md), including complexity/risk routing, required architecture contracts and independent reviews; sensitive persistence, destructive operations and interchange require complementary technical and domain/data review. Delegated specialists stay within their assigned scope and do not restart routing.

Claimed on2026-10-21 from `8d4b67841956e22e5b9d1269724845c902770121`, equal to the freshly fetched feature remote (0 main-only/49 feature-only against main `629d2a98715c3a16b954e0f77c639b1f0c31212c`). Ticket23 is closed. See the [execution record](../research/implementation-25-2026-10-21.md). SOL6.1 High defines/reviews the contracts and Luna XHIGH implements serial tracer verticals. Preserve others' work; no successor, source-issue closure or merge.

## Resolution

Completed on 2026-10-21 from the intentionally continued feature baseline `8d4b67841956e22e5b9d1269724845c902770121`. Move supports the human-approved direct drag-out detachment, explicit overlap choices, optional Nuxt UI precise placement, safe Orbit host/geometry changes, and canceled-gesture suppression while preserving dependent geometry and durable formats.

Final typecheck and production build pass. The final complete suite passes **161/161 in 14.9 minutes**, with one worker, zero retries, zero skips and zero flaky outcomes. The earlier 158/161 candidate and all three diagnosed corrections remain recorded; they are not counted as a green run. Both independent review axes have no unresolved blockers. Actual compiled desktop/light, portrait/dark and short-landscape/dark presentation was exercised and inspected.

See the [execution record](../research/implementation-25-2026-10-21.md), [Standards and Spec review](../research/review-25-2026-10-21.md), and [integrated QA evidence](../implementation-lab/ticket-25-2026-10-21/qa/README.md). Physical Android Chrome, OS keyboard and safe-area proof remain unavailable. Ticket 28 retains full SVG/PNG verification; ticket 29 retains final cleanup and whole-interface Astra/Tools review. No successor implementation, source-issue closure or merge is included.

### Hosted-object drag follow-up

Corrected invisible sticking when a dragged object carries Orbits: their old geometry is excluded from pointer destinations, consistently for preview, guards and release. Real stationary targets and full-system numeric/cycle checks remain. The Primary Star regression and adjacent checks pass 14/14, typecheck/build pass, and both bounded independent review axes have no blockers. See [follow-up evidence](../implementation-lab/ticket-25-2026-10-21/qa/host-drag/README.md); the earlier complete-suite result predates this correction.
