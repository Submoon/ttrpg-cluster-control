---
title: 'Construct and arrange a Jump Cluster with complete Jump Routes'
status: closed
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 24: Construct and arrange a Jump Cluster with complete Jump Routes

## Parent

[Revamp the interface: responsive map editing with preserved local work](../spec.md). Source request: [Revamp the interface](https://github.com/Submoon/ttrpg-cluster-control/issues/3).

The human approved the twelve-ticket breakdown and exact dependencies on 2026-10-16. Approved planning baseline: `f4aa1b4438217412c308e61733d862f3d71597ca`, intentionally above `origin/main = 629d2a98715c3a16b954e0f77c639b1f0c31212c`. See the [approved proposal](../research/ticket-breakdown-proposal-2026-10-16.md).

## What to build

Add systems without leaving the cluster, deliberately move them and create/edit known/unresolved Jump Routes while retaining safe progress.

## Acceptance criteria

1. [x] Repeat Add System at intended destinations without auto-entry/Inspect or draft loss, reusing chooser/status/Quit/explicit alternatives.
2. [x] Move systems by once-only valid release or preview/Confirm/Cancel/coordinates.
3. [x] In the **cluster wrapper**, verify Navigate/Select pan, two-contact/right-pan in every mode, interruption/tool changes/long-press Inspect: cancel preview before takeover and suppress late release/click/system entry; preserve native stationary right-click outside recognized pan.
4. [x] Add Route keeps origin/stage during pan/zoom without partial data and resets both endpoints after completion.
5. [x] Full route Inspector retains From Jump Point, known/unresolved To Jump Point/external label, levels 1–9/higher positive integers and resumable endpoint ownership/guards.
6. [x] Resolve ambiguity/refusal, clear stale origins and retain applied results under save failure without replay.
7. [x] Label preview links as fresh previews rather than unsaved-workspace sharing.

## Scope and exclusions

Existing cluster construction/arrangement family in delivery order. Fixtures supply endpoints; no catalogue creation, system geometry or schema changes. Cluster input requires its own evidence.

## Blocked by

- [Populate star systems with every catalogue type and Orbit structure](23-system-object-and-orbit-creation.md)

Dependency rationale: 23 — consumes the proven anchored persistent Add journey; 22's Inspector/Jump Point contracts are inherited.

## Specification and evidence mapping

primary 21, 26, 44–49, 64–65, 118; checks 15–20, 23–25, 27–32, 36–37, 50–59, 82–96, 105–111, 120. **B:** B1–B7, B9.

Story numbers refer to the [specification user stories](../spec.md#user-stories). B1–B10 refer to the [behavioral acceptance families](../research/spec-test-seams-2026-10-16.md#smallest-useful-high-level-acceptance-suite). Required checks extend crosscutting contracts; primary ownership alone does not certify other owners or the whole product.

## Required product constraints

- Preserve the accepted B/Dock composition for every UI surface changed by this ticket: bottom mode/creation Dock, full map board, optional desktop overlay panels and a compact header. Nuxt UI may change control appearance, spacing and typography; pixel identity is not required. Compare the actual integrated result with the accepted reference at comparable viewport/theme/state, recording structural differences, ordinary hit testing and focus. Behavioral passes do not certify visual fidelity. Follow the [presentation acceptance reset](../research/interface-fidelity-reset-2026-10-16.md); technical contracts cannot silently replace the approved composition.

- Deliver the real persisted-workspace product, never the memory-only sample. Preserve working baseline commands until their replacements work. Use Nuxt UI to the greatest practical extent: evaluate configuration, slots and adapters before bespoke equivalents and document the smallest justified exception. Keep the SSR shell/client maps and one provider/CSS integration.
- Preserve domain vocabulary, authoritative validation, references, host/recovery corrections, database `ttrpg-cluster-control`, marker `ttrpg-cluster-control-map`, schema/version and applicable drag identities. Support accepted older shapes inside that marker/version boundary; add no migration or previous-marker fallback, durable drafts, renderer or unrelated feature.
- At affected seams, own session draft identity/content/errors above presentation lifetime; hide/theme/reflow retain work. Refuse actual target/dependency conflicts before preview while allowing independent commands. Apply validates latest committed memory and ends its designated session before durable saving; failure retains applied data with truthful recovery. Scoped Cancel never undoes committed work. Preparation is read-only, and changed destructive effects require renewed review. Backup restoration retains its distinct durable-before-publication guarantee.
- Verify relevant light/dark states, useful text >=4.5:1 and meaningful graphics/controls >=3:1 against actual adjacent/composited backgrounds, non-color cues, names/help, visible unobscured focus, modal entry/return and keyboard/single-pointer alternatives. Automate relevant mobile portrait/landscape/touch/reduced-height flows; 390×844, 844×390 and 390×500 are useful starting viewports. Target Android Chrome only for supplementary real OS-keyboard open/closed, safe-area and physical gesture checks. Simulation is not physical proof; report unavailable gates explicitly, without invented passes or a new device/CI harness. Desktop support retains baseline scope.
- This feature owns its acceptance tests now; final cleanup does not supply missing feature checks. Record source/runtime/product route, validated fixture, viewport/browser/device/input and passed/failed/unexecuted/unavailable outcomes and limits. Preserve user storage with isolated browser contexts; historical prototype passes are prior art, not current integrated acceptance.

## Validation strategy

Verify the cluster wrapper independently: short activation versus pan, normal once-only release, interrupted/right-pan/second-contact paths, origin retained during view movement and fresh completed-route endpoints. Check full route forms, guarded hidden drafts, JSON/reload and failed saving; physical gesture limits remain explicit.

The primary seam is the real integrated product through the existing Playwright browser suite, with narrow codec/domain/storage tests only for the relevant invariant. Use actual downloads and durable reload where applicable. Run affected checks and appropriate typecheck/build; compiled-production presentation checks supplement development iteration. No new application test API or separate component harness is required.

## Execution and handoff

Coordination and analysis use `gpt-6.1-sol` at High effort; delegated implementation uses `gpt-6-luna` at XHigh effort, as requested by the human. Follow the [project-development workflow](../../../.agents/skills/project-development/SKILL.md), including complexity/risk routing, required architecture contracts and independent reviews; sensitive persistence, destructive operations and interchange require complementary technical and domain/data review. Delegated specialists stay within their assigned scope and do not restart routing.

Claimed on 2026-10-20 from `446d7eca6568441086fc60c35e95fcdce9808145`, equal to the freshly fetched feature remote. Main remains `629d2a98715c3a16b954e0f77c639b1f0c31212c` (0 main-only/47 feature-only); tracked tree is clean and source issue3 is open/unchanged. See the [execution record](../research/implementation-24-2026-10-20.md). SOL6.1 High defines/reviews contracts; Luna XHIGH implements. Keep focused iteration/reviews economical, then one complete final suite with one worker. Preserve others' work. No successor, issue closure or merge is authorized.

## Resolution — 2026-10-21

Targeted repeated system creation, deliberate system movement and full resumable Jump Route editing are implemented in the persisted editor with Nuxt UI and the accepted B/Dock structure. Creation resets both endpoints after memory application; failed saving retains applied data and Retry does not replay creation. Parent sessions retain stage, values and errors through hide/reflow/view navigation while exact transition/dependency guards preserve unrelated work. Quit explicitly abandons route creation; edit drafts retain their own lifecycle.

Final complete validation is **135/135**, zero failures/skips/flaky cases/retries, original deadlines and one worker, on113 unchanged inputs. Typecheck/build and independent bounded technical/domain reviews pass. Final presentation checks pass24/24 with paired image inspection; desktop actions have a full-width summary above them and the compact Inspector fills the screen. The earlier133/2 full result, interrupted8-pass run, fixture corrections and all limits remain explicit in the [execution record](../research/implementation-24-2026-10-20.md) and [final QA report](../implementation-lab/ticket-24-2026-10-21/qa/README.md).

Physical Android Chrome/OS-keyboard/safe-area checks remain unavailable. Owned servers are stopped. Source issue3 remains open, PR28 draft and no successor is started; final whole-interface Astra review, including Tools coherence, remains29.
