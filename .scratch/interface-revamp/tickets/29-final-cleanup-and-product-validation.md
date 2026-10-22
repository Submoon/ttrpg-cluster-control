---
title: 'Finish the production editor and retire the revamp experiments'
status: closed
assignee: ticket29
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

The human approved the twelve-ticket breakdown and exact dependencies on 2026-10-16. The [implementation plan](../implementation-plan.md) preserves that graph; the [finalization dossier](../finalization.md) records the actual cleanup baseline and evidence.

## What to build

The real product ships no disposable comparison behavior, and maintainers receive consolidated docs/provenance plus truthful final acceptance.

## Acceptance criteria

1. [x] Start after every implementation ticket 18–28 is closed; keep this cleanup last. Inventory the actual scope and classify retained/removed material before usage-audited cleanup.
2. [x] Remove residual sample/prototype routes/flags/seeds/comparisons/imports/navigation and unused components/assets/scripts/dependencies/config/harnesses; prove absence from route graph/SSR/production bundles.
3. [x] Keep valid necessary fixtures tests-only and preserve database/schema/compatibility/shared integration.
4. [x] Consolidate **all effort-created documentation**, repair links/indexes and remove superseded working copies without losing accepted rationale/hashes/runtime/device identity/failures. Historical raw records remain recoverable from Git; do not create another archive tree.
5. [x] No blind `.scratch`/capture/untracked user/log/unrelated deletion; collection inventory need not inline-read every historical capture.
6. [x] After cleanup run integrated parity/browser, typecheck/build, compiled SSR/portal/local-resource and codec/storage/export regressions.
7. [x] Reconcile B1–B10, targeted Chrome OS-keyboard/physical gestures and keyboard/screen-reader evidence honestly.
8. [x] Measure final production initial/deferred JS/CSS/resources/startup/mount/overlays/pan/zoom **after comparison removal**, using comparable baseline arms only, reporting missing arms and investigating material regressions without invented budgets/library-only claims.
9. [x] Obtain the human-requested independent Astra review of the complete implemented interface, including desktop/mobile journeys and the meaning/grouping of Tools. Explicitly assess selection/data editing, view-only pan, movement and creation, using Foundry VTT as the requested conceptual comparison. Record findings and their adjudication against the accepted decisions; the review is not limited to Tools, and the earlier prototype review does not certify this final product.

## Scope and exclusions

Bounded final cleanup/integration, not deferred feature implementation/accessibility/testing. Mechanical steps remain within this final ticket rather than extra publications. No merge/deploy/release/GitHub closure authorization.

## Blocked by

- [Reposition objects and manipulate Orbit geometry safely](25-safe-system-object-and-orbit-manipulation.md)
- [Review destructive changes and exchange independent JSON copies safely](27-reviewed-deletion-and-json-interchange.md)
- [Export clean complete SVG and PNG in active or print light palettes](28-clean-themed-svg-png-exports.md)

Dependency rationale: 25, 27, 28 — terminal closure includes **every ticket 18–28**. All earlier tickets must be closed before starting; this stays **last**.

## Specification and evidence mapping

primary 119–120 plus cleanup amendment; mandatory regression 1–118. **B:** B1–B10 and final performance/evidence consolidation.

Story numbers and B1–B10 refer to the [specification](../spec.md). Required checks extend crosscutting contracts; primary ownership alone does not certify other owners or the whole product.

## Preservation and verification

The specification remains normative: accepted B/Dock composition with maximum Nuxt UI reuse; shared domain, saved formats, drafts, save/recovery guarantees, accessibility and supported-browser boundaries are preserved. This ticket adds no renderer, migration, durable draft storage or deferred feature. Production behavior is verified through the maintained public-UI Playwright suite, actual downloads and durable reload, not a new application test API.

Run focused checks, typecheck/build and one final full suite on the frozen candidate; record actual fixture/runtime/source identities and failures separately from retests. Compare compiled presentation with the accepted B/Dock reference and measure only comparable performance arms. Physical Android Chrome keyboard/safe-area/gestures and actual screen-reader checks remain unavailable unless performed; emulation cannot certify them.

Astra reviews the whole interface, Tools included. The human's “movement only” means view pan; distinguish approved Navigate/Select/Move/Add behavior from proposed redesigns. Historical prototype opinions do not certify the product.

## Execution

Work started after verifying closure of tickets 18–28. SOL 6.1 High coordinates; Luna XHIGH implements; independent technical/spec reviews and the final Astra interface review follow the project-development workflow. The finalization dossier owns the three cleanup passes, integrated evidence and review adjudication. No source-issue closure, merge or release is authorized.

## Resolution

Completed 2026-10-22 from `cf469857862565c58047fee98f8f174bee845c7c`. Three progressively stricter passes retired prototype routes/components, historical artifacts and duplicate documentation while retaining the current contract and substantive ticket outcomes. The production editor is the only page workflow, including former comparison query URLs.

Final typecheck/build pass; the single full Chrome run passes **194/194** in 11.7 minutes with one worker and zero retries/skips. Source and compiled hashes remain unchanged. Independent technical/spec reviews are clear; Astra reviewed the whole actual interface and Tools, found no blocker, and verified correction of its stale Add-label finding. Initial JS/CSS decreased 13.5%; startup measurements remain observational. Physical Android Chrome and screen-reader checks are unavailable, not passed. See the [finalization dossier](../finalization.md) for identities, three-pass accounting, performance, review and limits.

GitHub issue 3 stays open and PR 28 stays draft for human acceptance; no merge or release is implied.

Follow-up at `161f8e35`: the human found ignored preview files and empty laboratory directories still on disk. Their non-generated source and three saved working files were verified in a local Git safety commit before deleting the residual copies and obsolete ignore rule. Only the specification, compact index, tickets and final dossier remain. Production/test/configuration hashes are unchanged; targeted integrity, tracker-path and link checks cover this follow-up.
