---
title: 'Choose a coherent local light or dark presentation'
status: closed
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 19: Choose a coherent local light or dark presentation

## Parent

[Revamp the interface: responsive map editing with preserved local work](../spec.md). Source request: [Revamp the interface](https://github.com/Submoon/ttrpg-cluster-control/issues/3).

The human approved the twelve-ticket breakdown and exact dependencies on 2026-10-16. Approved planning baseline: `f4aa1b4438217412c308e61733d862f3d71597ca`, intentionally above `origin/main = 629d2a98715c3a16b954e0f77c639b1f0c31212c`. See the [approved proposal](../research/ticket-breakdown-proposal-2026-10-16.md).

## Acceptance reassessment - 2026-10-16

The human rejects the integrated composition at published source `b37c1abd512c6f47a59774ae3824965e420744b7` and withdraws acceptance of the 18-21 batch. Earlier technical results remain historical, scope-specific evidence; they do not establish conformity to the accepted B/Dock interface or a passing full preservation suite. Reassess this ticket against the corrected specification and [presentation acceptance reset](../research/interface-fidelity-reset-2026-10-16.md) before closing it again. Preserve usable application code and evidence rather than assuming everything must be rewritten.

Ticket 18 is reopened and unclaimed for reassessment; tickets 19-21 are blocked by the same approved dependency chain. Later tickets remain blocked. The human explicitly instructs planning corrections only, then a stop; do not resume implementation or tests until asked.

## What to build

One named theme control updates shell, maps, native controls and portals; the explicit device/browser preference survives sessions/workspaces and overrides later OS changes.

## Current availability - 2026-10-19

Ticket 18 completes its scoped reassessment with fresh launch/recovery evidence. This ticket is now available and unclaimed; its own previous acceptance remains withdrawn. The human resumes ticket 18 only, so no implementation or tests for this ticket are started. Follow the corrected presentation contract and current prerequisite Resolution when explicitly resumed.

## Current resumption - 2026-10-19

The human subsequently explicitly requests implement for this ticket. Freshly fetched baseline is `f64d00dbaf9cee569a8a62db0005b4ffe7f00ca7`, equal to the remote feature branch, intentionally 0 main-only / 36 feature-only above `origin/main = 629d2a98715c3a16b954e0f77c639b1f0c31212c`. Source issue 3 remains open and unchanged. Reassess retained theme/resources before rewriting; preserve ticket 18 and the six pre-existing modified test/helper files. This resumption does not start tickets 20–29 or repair the loaded-map composition owned by 21. Analysis/reviews use SOL 6.1 High; implementation uses Luna XHIGH, with the coordinator owning planning and Git.

## Acceptance criteria

1. [x] Follow OS preference until explicit choice, then persist that separate preference.
2. [x] Apply common tokens and actual contrast/non-color/focus states throughout existing surfaces.
3. [x] Preserve all data, drafts/errors, placements, selection, view/tool and saving state without a workspace save.
4. [x] Package every static/dynamic icon locally and prove cold glyph rendering with external Internet denied to both browser and server while the app remains reachable.
5. [x] Verify hydrated SSR and keyboard/touch/mobile portals.

## Scope and exclusions

Shared palette/preference/resources, not a theme engine or all-form redesign. Image scenes are 28; later owners extend these tokens.

## Blocked by

- [Open and recover the real local workspace at the product root](18-open-and-recover-local-workspace.md)

Dependency rationale: 18 — acceptance must target the real product/SSR entry.

## Specification and evidence mapping

primary 103–111; checks 82, 89–90, 119–120. **B:** B4, B9.

Story numbers refer to the [specification user stories](../spec.md#user-stories). B1–B10 refer to the [behavioral acceptance families](../research/spec-test-seams-2026-10-16.md#smallest-useful-high-level-acceptance-suite). Required checks extend crosscutting contracts; primary ownership alone does not certify other owners or the whole product.

## Required product constraints

- Preserve the accepted B/Dock composition for every UI surface changed by this ticket: bottom mode/creation Dock, full map board, optional desktop overlay panels and a compact header. Nuxt UI may change control appearance, spacing and typography; pixel identity is not required. Compare the actual integrated result with the accepted reference at comparable viewport/theme/state, recording structural differences, ordinary hit testing and focus. Behavioral passes do not certify visual fidelity. Follow the [presentation acceptance reset](../research/interface-fidelity-reset-2026-10-16.md); technical contracts cannot silently replace the approved composition.

- Deliver the real persisted-workspace product, never the memory-only sample. Preserve working baseline commands until their replacements work. Use Nuxt UI to the greatest practical extent: evaluate configuration, slots and adapters before bespoke equivalents and document the smallest justified exception. Keep the SSR shell/client maps and one provider/CSS integration.
- Preserve domain vocabulary, authoritative validation, references, host/recovery corrections, database `ttrpg-cluster-control`, marker `ttrpg-cluster-control-map`, schema/version and applicable drag identities. Support accepted older shapes inside that marker/version boundary; add no migration or previous-marker fallback, durable drafts, renderer or unrelated feature.
- At affected seams, own session draft identity/content/errors above presentation lifetime; hide/theme/reflow retain work. Refuse actual target/dependency conflicts before preview while allowing independent commands. Apply validates latest committed memory and ends its designated session before durable saving; failure retains applied data with truthful recovery. Scoped Cancel never undoes committed work. Preparation is read-only, and changed destructive effects require renewed review. Backup restoration retains its distinct durable-before-publication guarantee.
- Verify relevant light/dark states, useful text >=4.5:1 and meaningful graphics/controls >=3:1 against actual adjacent/composited backgrounds, non-color cues, names/help, visible unobscured focus, modal entry/return and keyboard/single-pointer alternatives. Automate relevant mobile portrait/landscape/touch/reduced-height flows; 390×844, 844×390 and 390×500 are useful starting viewports. Target Android Chrome only for supplementary real OS-keyboard open/closed, safe-area and physical gesture checks. Simulation is not physical proof; report unavailable gates explicitly, without invented passes or a new device/CI harness. Desktop support retains baseline scope.
- This feature owns its acceptance tests now; final cleanup does not supply missing feature checks. Record source/runtime/product route, validated fixture, viewport/browser/device/input and passed/failed/unexecuted/unavailable outcomes and limits. Preserve user storage with isolated browser contexts; historical prototype passes are prior art, not current integrated acceptance.

## Validation strategy

Use cold browser/server resource checks with external Internet denied but the app reachable, actual glyph inspection, OS/explicit preference changes and reload/new-session checks. Measure actual composited contrast and inspect both maps/native controls/portal palettes, focus and preserved draft/save state.

The primary seam is the real integrated product through the existing Playwright browser suite, with narrow codec/domain/storage tests only for the relevant invariant. Use actual downloads and durable reload where applicable. Run affected checks and appropriate typecheck/build; compiled-production presentation checks supplement development iteration. No new application test API or separate component harness is required.

## Execution and handoff

Coordination and analysis use `gpt-6.1-sol` at High effort; delegated implementation uses `gpt-6-luna` at XHigh effort, as requested by the human. Follow the [project-development workflow](../../../.agents/skills/project-development/SKILL.md), including complexity/risk routing, required architecture contracts and independent reviews; sensitive persistence, destructive operations and interchange require complementary technical and domain/data review. Delegated specialists stay within their assigned scope and do not restart routing.

The initial planning publication left this ticket unclaimed. Work blockers-first; preserve other agents' work. Return changed behavior, evidence identities/outcomes/limitations and unresolved findings to the coordinator. This ticket does not independently authorize GitHub writes, source-issue closure, merge or deployment; the human's later sequential implementation request authorizes branch commit/push between tickets.

## Comments

> *This was generated by AI during triage.*

2026-10-16 — Claimed only after completed ticket 18 is committed/pushed as `006a245134ad06baaf0f56333d2722428b0df367`, equal to the remote feature branch. Fresh origin comparison remains 0 main-only / 25 feature-only against `origin/main = 629d2a98715c3a16b954e0f77c639b1f0c31212c`. SOL 6.1 High defines the bounded preference/resource/state-preservation contract before Luna XHIGH implementation. Use Sensitive routing for durable preference and preservation boundaries, with independent technical and domain/data reviews. No workspace persistence/schema redesign is authorized. See the [sequential execution record](../research/implementation-18-21-2026-10-16.md).

## Resolution

2026-10-19 — Scoped reassessment completed at `aeeae7a6e0ec9e9f7df3161f4b5a7a00833edf1b` against `f64d00dbaf9cee569a8a62db0005b4ffe7f00ca7`. Retain the existing Nuxt UI preference owner, shared palettes and locally packaged Lucide resources. Header restores the named Theme group and applies its existing opaque focus style to the library button, correcting measured light/dark focus failures. No palette, provider, configuration, package, layout, domain or persistence rewrite occurs. The owned theme test adds ordinary chooser dismissal and explicit map visibility before route creation, retaining its draft/save assertions.

Development evidence reports 4/4 tests and typecheck success; the final developer JSON went to stdout, so the earlier 3/4 JSON is not mislabelled. Independent compiled tests pass **4/4 in 9.5s**, and the build passes. Current cold browser/server guards have separate negative canaries, actual mounted sun/moon pixel proof and 44 locally available library-superset SVG bodies; body inventory and visible glyph proof remain distinct. Compiled evidence covers OS/explicit preference and fresh sessions, creation/import, drafts/errors and saving states, both maps, Orbit/camera/tool preservation, native controls/portals, compact touch and reduced-height reflow. The remaining warm supplement passes 89 observations/17 samples after explicit public fixture setup; this is not a fictitious clean whole-matrix run. Both independent source reviews report no findings. The coordinator inspects both developer image pairs and all four compiled PNGs.

See the [current execution/review record](../research/implementation-19-resume-2026-10-19.md) and [final QA with curated provenance](../implementation-lab/ticket-19-resume-2026-10-19/qa/final-summary.md). Failed helper setup/measurement attempts remain disclosed. Native-dialog reverse Tab parks on BODY/browser boundary before ordinary Tab re-entry; no interactive background activation was observed, but strict DOM focus containment is not established. Fields lifecycle/composition belongs to its later owner, and loaded-map B/Dock repair remains ticket 21. Physical Android Chrome is unavailable. The single full-suite attempt stops at the same unclassified cluster-return symptom: 0 passed / 1 failed / 92 not run, using six preserved pre-existing test edits excluded from these commits. No repository-wide pass, source-issue completion or merge is claimed. Owned servers are stopped and protected/frozen hashes match. Source issue 3 is re-read and remains open/unchanged. Ticket 20 becomes available and unclaimed; it is not started.

## Previous implementation evidence - acceptance withdrawn

2026-10-16 — Implemented on the real persisted product at `/`. Nuxt UI's existing color-mode owner supplies OS-first presentation and a named explicit browser preference, without another provider or workspace save. Shared light/dark tokens cover the shell, both maps, native controls and Fields portals. Locally packaged Lucide supplies static and dynamic icons with external fallback disabled. Data/schema/codec and the single ordered persistence owner remain unchanged.

Final reviewed source candidate is `5b915a8de04afc06f7421587d53705b6338536ab`, against fixed ticket baseline `006a2451`. Independent Standards and Spec/domain-data reviews find no blockers. Typecheck and the final production build pass. The compiled portable suite passes **6/6**; final affected production checks pass **98/98** across four viewport sizes and both palettes, including the complete landscape Fields focus outline. Minimum measured control/focus contrast is **3.7346:1**. Earlier cold-server/browser checks prove 44 local SVG glyph bodies, 22 visible glyph checks, successful separate network-block canaries and no normal external attempts. Subsequent source changes only reserve header focus space; unchanged resource hashes retain that evidence.

Chart/object/route drafts, Fields draft/errors, Orbit selection/camera, applied data and Saving/Not saved states survive theme changes; settled theme-only intervals cause no IndexedDB writes. The delayed-save test holds notification delivery rather than claiming physically suspended durability. Test-owned Canvas performance hints are classified separately from zero application/hydration warnings or page errors. See [implementation evidence](../implementation-lab/ticket-19/implementation-results.md), [QA evidence](../implementation-lab/ticket-19/production-qa/final-summary.md) and the execution record for repair history and source identities. Physical Android Chrome, OS keyboard and safe-area checks remain unavailable; no physical pass is inferred. Later tool/panel and complete-form owners extend this foundation.
