---
title: 'Publish player text and permitted Field values'
status: closed
assignee: coordinator
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 03: Publish player text and permitted Field values

**Parent:** [Player view and secret-free sharing](../spec.md).

**Source:** [Player view and secret-free export — GitHub #9](https://github.com/Submoon/ttrpg-cluster-control/issues/9). Approved breakdown: 2026-10-29. Planning baseline: `8d4b66504ca6723db5405ed7cb93d0a666264c9a`, equal to fetched origin/main. Refresh source/baseline before implementation.

**What to build:** the Warden writes separate player text and GM notes, marks native/custom Fields shareable, masks sensitive assignments, and sees exactly the permitted text/values in the public object inspector of the preview.

**Status:** closed after simultaneous implementation and verification with ticket 04, `implement` and subagents on 2026-10-30. Tickets 01–04 are closed; tickets 05–07 remain unstarted.

## Blocked by

- [02: Explore published objects and anonymous Orbit host chains](02-object-publication-host-chains.md).

## Acceptance criteria

- [x] Object editing separates player-facing text from private GM notes. Supported existing descriptions become GM notes without data loss; initial player text is empty. No automatic prose splitting or implicit publication occurs.
- [x] Fields management provides a shared player-publication setting for native Atmosphere/Port class and custom Fields. Legacy and newly created Fields default private. Applicability remains a distinct concept and changing it does not erase stored assignments or imply publication.
- [x] Object editing can additionally mask a value of an otherwise shareable Field. An object mask cannot make a private Field public. Modes below Revealed suppress prose and all Fields regardless of definition/assignment settings.
- [x] The player preview inspector shows player text and only the name/type/value of Fields actually permitted on Revealed objects. GM notes, masked values, private/unused definitions, applicability inventories and unselected options remain absent from the projection.
- [x] Publishing a single-select value does not expose other possible values. For example, sharing Faction: Merchants must not embed an unused secret Cult option. Native option lists have the same no-unused-inventory rule.
- [x] Source publication settings, masks and both prose fields follow normal draft validation, Apply/Discard, save/reload and Undo/Redo. Export/projection does not alter source notes or values.
- [x] Complete GM backups/imports and current/last-valid recovery preserve all prose, Field definitions, values and publication intent. Independent-copy import remaps definition IDs and object masks correctly. Same-name definition merges preserve compatible policies or require an explicit conflict/review; they never silently broaden publication.
- [x] Existing legacy layout/applicability/Jump-level support and full-map backup semantics remain intact. Extend the common projection/preview; no separate Field-only sharing format or additional campaign notes subsystem is introduced.

## Verification and completion

Use real Fields and object-inspector flows to test native/custom publication, a single masked object among public peers, all four disclosure modes, private prose and unused select choices. Inspect the complete projected object payload with distinct secret markers. Verify supported legacy migration, full-source round trips, same-name import conflicts, mask ID remapping, recovery and Undo/Redo. Run relevant pure/controller/browser scenarios, lint and typecheck, including compact control completion/focus behavior.

## Scope boundaries

This ticket owns public object prose and Field publication, not system/route prose, external note links or campaign management. It depends on the object preview but not route publication, so it can proceed alongside ticket 04 subject to coordinated ownership of shared contracts. Sensitive persistence/privacy reviews apply.

## Resolution

Implemented all eight criteria through the existing object and Fields sessions, writer and history. Player text is separate from unchanged private GM notes. Native/custom publication and per-object masks govern assignment-local public values; inactive source values/masks remain intact. The common allowlisted preview excludes private prose, definitions, unused options and source identities. Source version 4 retains complete backups, strict current validation and format-specific legacy migration. Independent imports remap masks and reject incompatible publication policies explicitly.

Application candidate `9f3513ce` passed focused projection/import/migration and public editing/history/recovery checks, compiler checking, lint, a production build and desktop/compact inspection. Compiled entry/feature checks passed 7/7. The complete suite ran once: 514 passed / 4 timed out. An unchanged targeted replay passed 2/4; two case-local 60-second budgets then let the remaining complete legacy journeys pass 2/2, preserving every assertion and ordinary expectation timeout. Standards, Spec and complementary privacy/persistence reviews have zero remaining findings. See the [combined implementation record](../tickets-03-04-implementation.md) for exact revisions, logs and limits.

Work is committed locally on `codex/player-view-ticket-01`. The original implementation base is intentionally retained while origin/main has advanced; no main integration, push, PR or remote issue change is included. Tickets 05 and 07 are available but unclaimed; ticket 06 remains blocked by 05. GitHub #9 remains open and unchanged.

## Comments

> *This was generated by AI during triage.*

Implementation started with ticket 04 on 2026-10-30. Refetched GitHub #9 is unchanged. Fresh origin/main remains `971e91c0ad2fc78e4f92c1e625091a577960b41b`; current branch `codex/player-view-ticket-01` is five commits ahead and zero behind. The actual implementation/review baseline is `4b70c1bd170125210f304d70611c28712945bf4d`, intentionally including local prerequisites 01 and 02. See the [combined implementation record](../tickets-03-04-implementation.md).
