---
title: Ticket 01 implementation and verification
status: in-progress
parent: spec.md
---

# Ticket 01 implementation and verification

User authorization on 2026-10-30 covers [Preview system publication in the Jump Cluster](tickets/01-system-publication-preview.md), subagent coordination and the commit requested by `implement`. It does not start later tickets or authorize remote writes, a push, PR or merge.

## Baseline and ownership

- Baseline: `8d4b66504ca6723db5405ed7cb93d0a666264c9a`; fresh origin fetch confirms HEAD/main/origin/main are equal (0 ahead / 0 behind). GitHub #9 is unchanged.
- Branch: `codex/player-view-ticket-01` in the existing isolated worktree.
- Pre-existing unrelated `.codex/environments/` remains untouched.
- Coordinator owns Git, runtime ports, shared checks, integration and documentation. Architects/reviewers are read-only. At most two source writers will have disjoint assigned ownership after architecture resolves interfaces.
- Route: Sensitive (privacy, persistence, portable formats and migration). Architecture, developer implementation, independent Standards/Spec review and complementary privacy/persistence review are required.

## Approved test seams

The user already approved the common pure disclosure projection and actual public UI/import/history behavior. Use red-green slices at these interfaces, not tests of private helpers. Verify projected/serialized absence and source preservation in addition to visible controls.

## Design and verification

Architecture is being resolved before implementation. This record will retain the agreed boundaries and concise actual check outcomes; raw logs/screenshots belong in test artifacts. No product acceptance is claimed yet.

### Agreed design

- Current source workspace/full exports use version 2, unchanged layout version 1; explicit legacy migration assigns Hidden and a generic safe title, while malformed version 2 is rejected. New systems start Known type.
- System publication and cluster player title are authoritative source values. Existing guarded chart editing owns their draft/Apply/Discard and update action; existing writer/history retain ownership.
- A pure player document projection includes only public marker identities/positions/disclosure labels and the safe player title. Known type is Star system because the source has no separate system classification. The DTO-only preview renderer receives no source system contents, routes, Fields or counts.
- Append import retains the destination player title consistently with existing destination cluster-name semantics and preserves/remaps incoming system modes. The source title is preserved in its own complete export/restore, not applied to a different destination cluster. No provenance feature is added.
- Domain/formats/projection writer owns domain modules and relevant pure/current typed fixtures; editor writer owns composables/components, shared UI helpers and focused public UI tests. Coordinator owns integration/docs/runtime checks.
- See ADR 0002 for the durable privacy/versioning trade-off. No product questions require reopening.

### Checks so far

- Baseline pure legacy restoration: 2 passed (`workspace-data`, pure project, 2026-10-30), before source edits. Reports under `test-results/player-view-baseline`.
- Runtime: Node 24.18.1 / npm 11.16.0. Coordinator development server owns port 3127; no other chat's server is reused.

- UI red confirmed against the existing chart dialog: the public journey fails at the absent Player-facing title input, before production controls are added. Artifact: `test-results/player-view-ui-red-feature`. Earlier missing Chromium-cache/loopback and stale intermediate-import failures were environment/integration setup, not functional red evidence.
- Browser verification uses the existing host Playwright cache and a coordinator-owned host-mode server because the sandbox blocks loopback browser access. No dependency/browser download or unrelated server was required.

- Domain handoff: 22 focused pure tests passed, including strict-current/legacy migration, projection secrecy and source/import behavior. Interim type errors in current typed fixtures were corrected without converting the raw version 1 JSON fixtures.
- Interim integration typecheck passed. The first public publication/apply/preview journey passed (1 test); its initially ambiguous default/modal Close selector was made explicit.
- Integrated pure project: 179 passed, 1 failed due only to an old expected version-1 error message. The supported-version error expectation was updated, preserving the rejection assertions; all 10 tests in that affected file then passed. The full suite has not yet run.

- Final focused UI coverage: 7 passed in the eight-case run; the remaining Stay test asserted the wrong background context while the editor was modal. Its test sequence was corrected to inspect retained draft values, close the editor, then verify the unchanged system context; the targeted replay passed (1 test). The passing cases include source-private DOM/accessibility, all modes, desktop/compact focus, applied history/reload, explicit inspected target, failed durability/Retry, public v2 append import and measured long-label bounds.
- The 80-character wide-name geometry tracer first failed on actual rendered SVG text exceeding its viewBox, then passed after a conservative public-label width envelope was applied. No source geometry was changed.
- Desktop and compact PNG evidence under `test-results/player-view-publication-focused-final` was visually inspected before broad UI/integration checks. The preview remains clearly Warden-side, with reachable closing controls; these viewport checks do not certify physical assistive devices.
- Lint and typecheck passed after current helper types were made compatible with both v1 raw fixtures and v2 exports. No legacy JSON fixture was converted to mask a current-type error.
