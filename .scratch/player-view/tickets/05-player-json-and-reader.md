---
title: 'Export and open a standalone player JSON snapshot'
status: in-progress
assignee: coordinator
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 05: Export and open a standalone player JSON snapshot

**Parent:** [Player view and secret-free sharing](../spec.md).

**Source:** [Player view and secret-free export — GitHub #9](https://github.com/Submoon/ttrpg-cluster-control/issues/9). Approved breakdown: 2026-10-29. Planning baseline: `8d4b66504ca6723db5405ed7cb93d0a666264c9a`, equal to fetched origin/main. Refresh source/baseline before implementation.

**What to build:** the Warden downloads the complete sanitized cluster as a dedicated player JSON document, and a recipient opens it in a standalone read-only reader without the GM file, account or workspace storage. This is the first player data transport and the file fallback for the later URL feature.

**Status:** in-progress and assigned to the coordinator. The user authorized simultaneous implementation of tickets 05 and 07 with `implement` and subagents on 2026-11-02. Ticket 06 remains unstarted.

## Blocked by

- [03: Publish player text and permitted Field values](03-public-text-and-fields.md).
- [04: Publish Jump Routes and safe physical Station associations](04-shared-routes-and-stations.md).

## Acceptance criteria

- [ ] A clearly distinct player-file action exports the existing common projection, with a dedicated versioned format, the chosen player title and a safe filename. It includes the permitted cluster rather than only the active system. Full GM backup/export actions remain separate and complete.
- [ ] The downloaded document obeys all four modes, system-entry gates, public prose/Field masks, minimal Field metadata, route/Station and recursive host-chain rules. Permitted exact unknown-destination positions remain present; excluded source names/keys/IDs, notes, option inventories, history, backups and unknown extensions do not.
- [ ] Generate safe public identities and valid internal references rather than copying source identity strings that can contain private information. Counts/bounds/accessibility text come from the public document, not omitted source content.
- [ ] File actions use the existing operation preflight and authoritative applied snapshot. Pending drafts/gestures/previews and stale map/context callbacks cannot contaminate output. Sharing does not mutate GM data/history, and existing failed-save export/retry semantics are preserved.
- [ ] A recipient can open a player JSON through an explicit public UI flow and use pan/zoom, cluster navigation, Revealed-system entry and public inspection. Unknown/partial systems remain non-openable. The reader exposes no GM editing, history, recovery or private reveal command.
- [ ] Player loading validates unknown input, version, references, finite geometry and bounded size/work. Invalid, truncated, unsupported and wholly empty inputs fail clearly without falling back to a local GM workspace. Entirely empty share generation is blocked; an otherwise valid Revealed system can have no public internal objects.
- [ ] Player consultation is independent of the singleton GM hydrate/write/recovery owner and works in a fresh context without GM IndexedDB. Different player documents can coexist while base-site tabs still reopen the saved GM workspace. Loading a player file never appends it through the normal full-map importer.
- [ ] The player route/composition remains SSR-safe: parse client data at the proper lifecycle boundary without making GM data part of server hydration or module state. Reload, disposal and document changes clear obsolete player selection/map resources.
- [ ] Supported old GM files still import with private defaults; new full backups retain all source/publication metadata. Do not promise that older applications can open new formats. Keep this player codec usable by the later URL transport without a parallel disclosure implementation.

## Verification and completion

Capture and inspect actual downloaded JSON and open it through the public reader flow in a fresh context. Seed private markers in names, type-bearing keys/IDs, notes, field names/options/unused values, hidden relationships, extra properties and retained-history source data. Verify the deliberate structural exceptions, empty/invalid/version/size failures, multiple reader contexts alongside GM storage, reload and unchanged source exports. Exercise existing preflight/save-failure scenarios. Run lint/typecheck, focused pure/browser coverage and a production build/compiled-reader entry check for SSR integration.

## Scope boundaries

The player file is a consultation document, not an editable GM import or a stripped backup. No URL compression, cloud publication, image export implementation, additional saved GM workspace or audience profile is included here. This ticket waits for both content and relationship projection slices so the first distributed player format represents the agreed scope. Sensitive privacy/format/persistence reviews apply.


## Comments

> *This was generated by AI during triage.*

Implementation started on 2026-11-02. GitHub #9 was reread and remains open and unchanged. Starting HEAD is `abcf6625863c74785fb72a5e802dffc82af7a26e`; origin/main is `d40e5f515baf1afeb0e2135461287b243b2a1f6c`. Main was safely fast-forwarded; the coordinator is integrating it into `codex/player-view-ticket-01` before pinning the feature implementation base. See the [combined implementation record](../tickets-05-07-implementation.md).

Post-merge implementation/review base: `b42d39a4cd81b83594695aa22a84be9455cf23b6`. Baseline typecheck, lint corrections, 29 focused pure tests and five browser merge regressions passed; the branch is nine ahead/zero behind origin/main. No complete-suite run yet for this delivery.
