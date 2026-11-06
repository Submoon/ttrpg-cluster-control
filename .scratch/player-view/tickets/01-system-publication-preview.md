---
title: 'Preview system publication in the Jump Cluster'
status: closed
assignee: coordinator
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 01: Preview system publication in the Jump Cluster

**Parent:** [Player view and secret-free sharing](../spec.md).

**Source:** [Player view and secret-free export — GitHub #9](https://github.com/Submoon/ttrpg-cluster-control/issues/9), rechecked on 2026-10-29, unchanged and open. Planning baseline: `8d4b66504ca6723db5405ed7cb93d0a666264c9a`, equal to fetched origin/main. Refresh source/baseline before implementation and preserve local work.

**What to build:** the Warden can choose how each system appears to players, choose a public share title, and inspect a cluster preview that contains only the permitted system markers. Publication edits are saved and undoable through the ordinary editor flow; full backups retain the settings without losing preparation data.

**Status:** closed. Implemented and verified by the coordinator and assigned specialists on 2026-10-30 under the user's `implement` instruction. The remaining tickets are not started.

## Blocked by

None (can start immediately once implementation is authorized).

## Acceptance criteria

- [x] The existing system consultation/editing flow exposes Hidden, Unknown presence, Known type and Revealed modes in desktop and compact layouts. Unknown markers have neutral presentation; Known type markers reveal type but no name; only Revealed markers show the system's name.
- [x] New systems default Known type. Supported legacy maps initialize system publication as Hidden. Changing a system's mode preserves its full source contents and does not rewrite child settings.
- [x] The Warden can choose a player-facing share title. Preview labels never silently substitute the private cluster title. Location keys, internal object/route data, source counts, notes and Fields are absent from this first cluster-only preview.
- [x] A pure, allowlisted player projection and its cluster renderer provide the preview. Safe public identities, counts, bounds, visible labels and accessible text are derived from projected content rather than a hidden full-source scene. Unknown source extensions are omitted.
- [x] Publication/title changes use the existing validated mutation owner, ordered save queue and ordinary Undo/Redo semantics, including the separate memory-application and durability outcomes. Previewing itself creates no data mutation or history action.
- [x] Save/reload and complete GM backup round trips preserve system publication/title and all existing data. Independent-copy append import preserves incoming system modes and the destination cluster's player title, consistent with the existing destination chart-name contract. Old supported file/layout forms remain importable with private defaults; unsupported newer versions fail clearly. Establish the versioned source/public projection boundary without relying on old readers retaining unknown fields.
- [x] The preview is visibly a Warden-side consultation, not a secure borrowed-browser mode. It exposes no player download/link action in this slice; the base editor continues using the saved GM workspace.
- [x] A later slice can extend the same projection with permitted system internals, text/Fields and routes. This slice emits none of those unsupported source surfaces rather than forwarding them through the preview.

## Verification and completion

Exercise the real system editing command, save/reload, Undo/Redo, legacy restore/import, full backup and desktop/compact preview. Inspect the projected document and rendered/accessibility text for distinct private name, source-ID, count and unknown-property markers. Verify source immutability and save-failure/retry behavior. Use focused pure/browser scenarios plus lint and typecheck; retain green existing system-editing and full-export behavior.

## Scope boundaries

This is a complete system-publication/preview slice, not a schema-only prerequisite. No separate broad prefactor is required by the plan: introduce only the focused seams needed for this behavior. Internal object navigation, prose/Fields, routes, player files, URLs and images belong to later tickets. Follow the Sensitive route: architecture design before implementation and complementary independent reviews for privacy/persistence. Exact schema/version design is implementation work within the approved specification.

## Resolution

Implemented the four system publication modes, independent public title, guarded editing and a pure allowlisted Warden-side preview. Source version 2 preserves publication metadata through existing persistence, history and complete backup/import paths; legacy data starts private. The preview receives only public markers and has no player transport/download action.

All eight acceptance criteria are resolved. Independent Standards, Spec and complementary privacy/persistence reviews have no blocking findings. Lint, typecheck, production build and compiled entry checks passed. The complete suite ran once (429 passed / 18 initial failures); bounded corrections and replays validated those cases, with the existing long Orbit journey completing under a local 90-second diagnostic limit. Its ordinary 30-second timeout also reproduces on the warm baseline; the repository timeout and test assertions remain unchanged. See the [implementation and verification record](../ticket-01-implementation.md) for exact results and artifacts.

Initial implementation snapshot: `bbe8b0993108414fc494c08918e832453a465b4a`; final corrections and this resolution are committed together on `codex/player-view-ticket-01`. Ticket 02 is now available but unclaimed. GitHub #9 remains open and unchanged.

## Comments

> *This was generated by AI during triage.*

Implementation started on 2026-10-30 by explicit user instruction. Fresh origin fetch and source reread confirm HEAD/main/origin/main still at the planning baseline, with unchanged GitHub #9. Work is isolated on `codex/player-view-ticket-01`; existing `.codex/environments/` is unrelated and preserved. The approved projection and public UI/import/history seams will use TDD. Architecture precedes implementation; Standards, Spec and complementary privacy/persistence review will inspect the final stable candidate. See the [implementation record](../ticket-01-implementation.md).
