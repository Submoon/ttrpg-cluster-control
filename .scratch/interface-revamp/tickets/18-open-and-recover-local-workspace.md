---
title: 'Open and recover the real local workspace at the product root'
status: open
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 18: Open and recover the real local workspace at the product root

## Parent

[Revamp the interface: responsive map editing with preserved local work](../spec.md). Source request: [Revamp the interface](https://github.com/Submoon/ttrpg-cluster-control/issues/3).

The human approved the twelve-ticket breakdown and exact dependencies on 2026-10-16. Approved planning baseline: `f4aa1b4438217412c308e61733d862f3d71597ca`, intentionally above `origin/main = 629d2a98715c3a16b954e0f77c639b1f0c31212c`. See the [approved proposal](../research/ticket-breakdown-proposal-2026-10-16.md).

## Acceptance reassessment - 2026-10-16

The human rejects the integrated composition at published source `b37c1abd512c6f47a59774ae3824965e420744b7` and withdraws acceptance of the 18-21 batch. Earlier technical results remain historical, scope-specific evidence; they do not establish conformity to the accepted B/Dock interface or a passing full preservation suite. Reassess this ticket against the corrected specification and [presentation acceptance reset](../research/interface-fidelity-reset-2026-10-16.md) before closing it again. Preserve usable application code and evidence rather than assuming everything must be rewritten.

Ticket 18 is reopened and unclaimed for reassessment; tickets 19-21 are blocked by the same approved dependency chain. Later tickets remain blocked. The human explicitly instructs planning corrections only, then a stop; do not resume implementation or tests until asked.

## What to build

`/` creates a real Jump Cluster/first system, resumes saved work or offers actionable recovery rather than a disposable sample.

## Acceptance criteria

1. [ ] Capture a safe isolated retained-baseline check using its explicit route, then restore deliberate product-root tests while preserving working commands/user storage.
2. [ ] Verify create/save/reload, loading, invalid/unavailable current snapshots and Try again.
3. [ ] Exercise missing/damaged backup and failed/successful restore with durable-before-publication replacement and no editable partial data.
4. [ ] Begin responsive welcome/recovery and compiled SSR/hydration evidence with source/fixture identity and a comparable measurement method.

## Scope and exclusions

Launch/recovery only; no migration, whole-shell redesign or blanket test rewrite. Disconnect the prototype from the product entry now; remove residual experimental source in 29.

## Blocked by

None (can start immediately).

## Specification and evidence mapping

primary 1–3, 101–102; checks 89, 98, 107–111, 119–120. **B:** B1, B8, B9.

Story numbers refer to the [specification user stories](../spec.md#user-stories). B1–B10 refer to the [behavioral acceptance families](../research/spec-test-seams-2026-10-16.md#smallest-useful-high-level-acceptance-suite). Required checks extend crosscutting contracts; primary ownership alone does not certify other owners or the whole product.

## Required product constraints

- Preserve the accepted B/Dock composition for every UI surface changed by this ticket: bottom mode/creation Dock, full map board, optional desktop overlay panels and a compact header. Nuxt UI may change control appearance, spacing and typography; pixel identity is not required. Compare the actual integrated result with the accepted reference at comparable viewport/theme/state, recording structural differences, ordinary hit testing and focus. Behavioral passes do not certify visual fidelity. Follow the [presentation acceptance reset](../research/interface-fidelity-reset-2026-10-16.md); technical contracts cannot silently replace the approved composition.

- Deliver the real persisted-workspace product, never the memory-only sample. Preserve working baseline commands until their replacements work. Use Nuxt UI to the greatest practical extent: evaluate configuration, slots and adapters before bespoke equivalents and document the smallest justified exception. Keep the SSR shell/client maps and one provider/CSS integration.
- Preserve domain vocabulary, authoritative validation, references, host/recovery corrections, database `ttrpg-cluster-control`, marker `ttrpg-cluster-control-map`, schema/version and applicable drag identities. Support accepted older shapes inside that marker/version boundary; add no migration or previous-marker fallback, durable drafts, renderer or unrelated feature.
- At affected seams, own session draft identity/content/errors above presentation lifetime; hide/theme/reflow retain work. Refuse actual target/dependency conflicts before preview while allowing independent commands. Apply validates latest committed memory and ends its designated session before durable saving; failure retains applied data with truthful recovery. Scoped Cancel never undoes committed work. Preparation is read-only, and changed destructive effects require renewed review. Backup restoration retains its distinct durable-before-publication guarantee.
- Verify relevant light/dark states, useful text >=4.5:1 and meaningful graphics/controls >=3:1 against actual adjacent/composited backgrounds, non-color cues, names/help, visible unobscured focus, modal entry/return and keyboard/single-pointer alternatives. Automate relevant mobile portrait/landscape/touch/reduced-height flows; 390×844, 844×390 and 390×500 are useful starting viewports. Target Android Chrome only for supplementary real OS-keyboard open/closed, safe-area and physical gesture checks. Simulation is not physical proof; report unavailable gates explicitly, without invented passes or a new device/CI harness. Desktop support retains baseline scope.
- This feature owns its acceptance tests now; final cleanup does not supply missing feature checks. Record source/runtime/product route, validated fixture, viewport/browser/device/input and passed/failed/unexecuted/unavailable outcomes and limits. Preserve user storage with isolated browser contexts; historical prototype passes are prior art, not current integrated acceptance.

## Validation strategy

Use real browser creation, IndexedDB save/reload, invalid-current and missing/damaged/failed/successful backup cases. Preserve narrow storage transaction regressions. Capture the interim explicit baseline route and then the actual product root, plus compiled SSR/hydration and responsive welcome/recovery evidence.

The primary seam is the real integrated product through the existing Playwright browser suite, with narrow codec/domain/storage tests only for the relevant invariant. Use actual downloads and durable reload where applicable. Run affected checks and appropriate typecheck/build; compiled-production presentation checks supplement development iteration. No new application test API or separate component harness is required.

## Execution and handoff

Coordination and analysis use `gpt-6.1-sol` at High effort; delegated implementation uses `gpt-6-luna` at XHigh effort, as requested by the human. Follow the [project-development workflow](../../../.agents/skills/project-development/SKILL.md), including complexity/risk routing, required architecture contracts and independent reviews; sensitive persistence, destructive operations and interchange require complementary technical and domain/data review. Delegated specialists stay within their assigned scope and do not restart routing.

Claimed on 2026-10-16 under the human's explicit request to implement tickets 18, 19, 20 and 21 sequentially, with commit/push between tickets. Work blockers-first and preserve other agents' work. The coordinator owns authorized branch commit/push and existing draft PR updates; this does not authorize source-issue changes, merge or deployment outside the preview workflow.

## Comments

> *This was generated by AI during triage.*

2026-10-16 — Fresh origin fetch confirms intentional feature baseline `3c660a6a2df6c37f392c998c36d72cec1ddbf938`, equal to its remote, 0 main-only / 24 feature-only against `origin/main = 629d2a98715c3a16b954e0f77c639b1f0c31212c`. Source issue 3 is unchanged and open. SOL 6.1 High supplies the bounded launch/recovery contract; Luna XHIGH implements with behavior-first Playwright checks at the already human-confirmed seam. Review uses this per-ticket baseline, separate from prior prototype changes. See the [sequential execution record](../research/implementation-18-21-2026-10-16.md).

## Previous implementation evidence - acceptance withdrawn

Completed on 2026-10-16. The default and unrecognized variants now mount the real persisted workspace; explicit comparison variants remain opt-in until 29. A safe retained-baseline capture precedes the meaningful root-route red/green. Storage, domain/codec identity and the single workspace owner remain unchanged. Local launch-control contrast and short-viewport focus defects discovered by compiled QA are corrected without a shared-theme or form redesign.

Validation: 8/8 focused launch/recovery tests before the presentation repair, then 2/2 portable compiled launch/focus tests covering both creation and recovery; current typecheck passes. The final compiled build passes in 1m45s, and strict SSR/hydration/responsive QA passes 41/41 at 1440×900, 390×844, 844×390 and 390×500, with no application warnings/page errors. Actual dark control-boundary contrast is at least 5.868:1 and measured text at least 7.174:1. Independent Standards and Spec/domain-data reviews of frozen source candidate `339a1062` have no blockers. See [implementation evidence](../implementation-lab/ticket-18/implementation-results.md), [compiled results](../implementation-lab/ticket-18/production-qa/results.json) and the [execution/review record](../research/implementation-18-21-2026-10-16.md).

Limits remain explicit: current-dark launch/recovery evidence only (light belongs to 19), emulation is not a physical Android Chrome keyboard/safe-area/gesture pass, and full-suite preservation runs at the end of the authorized 18–21 sequence. One sandbox-only realpath failure is environmental; normal-access builds pass. The source issue remains open. Ticket 19 is now available.
