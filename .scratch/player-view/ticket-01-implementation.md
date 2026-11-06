---
title: Ticket 01 implementation and verification
status: closed
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

Architecture was resolved before implementation. Ticket 01 is complete; this record retains the boundaries, actual verification outcomes and remaining local timing limit. Raw logs/screenshots belong in test artifacts.

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

- Stable review snapshot: `bbe8b0993108414fc494c08918e832453a465b4a`, compared with the recorded baseline using a three-dot diff. Independent Standards and Spec reviews both identified the same missing preview-event forwarding in the inspected-system consultation. The owner added forwarding and a public open/close/focus/retained-inspection regression; both reviewers closed the correction statically. Runtime validation is included in the full suite.
- Complementary privacy/persistence review identified a type-bearing accessible list name for Unknown presence. A neutral marker name and an accessibility assertion are pending after the frozen full-suite run. No other confirmed privacy or persistence defect was found.
- Standards also suggested sharing the two short publication validators as a nonblocking duplication heuristic. This is deferred: mutation and source-restoration admission remain separate, typed and covered boundaries; no behavioral divergence was demonstrated.
- Production build completed successfully (exit 0; Nuxt/Nitro, 2026-10-30). The four compiled-server entry scenarios passed on the dedicated production port 3128. The later one-line event-forwarding correction does not change the production entry seam; its development-browser regression is included in the integrated run.
- The one complete integrated run has started on development port 3127: `npm test -- --reporter=line --output=test-results/player-view-full` (447 tests). Raw output: `test-results/player-view-full.log`.
- All 180 pure cases passed in that run. Its first development-storage case exceeded the existing 30-second limit during cold client initialization, before the welcome form appeared (snapshot: Opening this browser's workspace). The server recorded a 16.7-second first SSR render. Keep the test and timeout unchanged; replay that case on the warm server after the run to distinguish startup overhead from persistence behavior.
- Pre-completion source refresh on 2026-10-30: fetched `origin/main` remains `8d4b66504ca6723db5405ed7cb93d0a666264c9a` (0/0 against the recorded base); GitHub #9 still has its original body, open state, two labels and no comments. No remote writes were made.

### Integrated run and bounded corrections

The complete run finished with 429 passed / 18 failed (47.6 minutes); all 180 pure cases and all eight new publication journeys passed. The initial failures are retained in the full report, not reported as a clean run. The failed-case selection is copied to `test-results/player-view-failed-replay-selection.json` for exact focused replays without overwriting full-run artifacts.

- Eight existing scenarios encounter partial `Chart details` selectors that now also match `Edit chart details`. Eleven command locators in six files will use exact accessible names, with their behavior assertions unchanged.
- The keyboard-outline scenario's fixed Tab count predates the two new controls. Its explicit traversal will assert the player title and publication control before measuring the same footer-button outline.
- The old export expectations must assert current outer version 2 while retaining layout version 1. The named legacy-applicability import fixture must explicitly use outer version 1; current v2 correctly rejects the legacy object applicability scopes. Raw legacy fixtures remain v1.
- Three maintained footer smoke variants found the newly added preview action in the primary footer, displacing the existing Edit/Open action composition. Move that secondary consultation action into the Player publication summary and retain the original footer geometry assertions.
- Four cases reached their existing 30-second deadline (cold storage initialization, two catalogue journeys and the long Orbit export journey). Replay unchanged on the warm server before deciding whether any further correction is warranted.
- The privacy review's type-bearing unknown-marker list name will receive a focused failing accessibility assertion, then the neutral label correction. Only affected checks will rerun after these corrections.

### Final verification and review closure

- `npm run lint` and `npm run typecheck`: passed on the corrected source. `git diff --check`: passed.
- The focused accessibility regression first failed on the actual `aria-label=Visible star system labels` in an Unknown presence map (`test-results/player-view-aria-red`). After the neutral label correction, the mode/accessibility journey passed. The corrected eight-case publication run had seven passes and one cold setup timeout before publication began; that remaining case passed unchanged in isolation in 16.8 seconds. Artifacts: `test-results/player-view-publication-green` and `test-results/player-view-publication-first-replay`.
- Final desktop and compact screenshots from the corrected publication run were visually inspected. Preview/close actions remain reachable, the unknown marker is neutral and the secondary Preview action is beside publication settings. The existing three footer geometry/hit-test scenarios passed unchanged at desktop, portrait compact and short landscape sizes.
- Exact failed-case replay: `npx playwright test --last-failed --reporter=line --output=test-results/player-view-failed-replay`, with `PLAYWRIGHT_LAST_RUN_OUTPUT_FILE` pointing to the copied full-run selection: 17 passed / one old long Orbit journey reached its 30-second deadline. Raw output: `test-results/player-view-failed-replay.log`. The cold storage and catalogue cases passed without changing assertions or timeouts.
- The unchanged long Orbit journey (`system-orbits.spec.ts:246`) completed all assertions on the candidate with the local CLI diagnostic `--timeout=90000` (one passed, 53.4 seconds). Its normal deadline was not edited or disabled. Artifacts: `test-results/player-view-long-orbit-current`.
- Baseline comparison used an archived copy of `8d4b66504ca6723db5405ed7cb93d0a666264c9a` under ignored `test-results/player-view-baseline-check`, existing dependencies and separate port 3129. Its only configuration override was a private Vite cache directory to avoid sharing the candidate cache. The first baseline run timed out loading the cold page; with 90 seconds the original scenario completed all assertions (one passed, 1.5 minutes). A subsequent warm baseline run again exceeded 30 seconds at the image-export stage (`system-orbits.spec.ts:757`), matching the initial integrated candidate failure stage. This establishes a pre-existing local timing limit, not a clean default-deadline run. Baseline evidence is retained inside that ignored copy.
- Completion evidence covers all 447 scenarios: 446 have passing normal-deadline evidence; the long existing Orbit scenario has complete assertion evidence with the local 90-second diagnostic allowance on both baseline and candidate. The full run is deliberately recorded as 429/18, not rewritten as a clean pass.
- Independent Standards and Spec reviewers closed the inspected-system forwarding defect and reviewed the final bounded corrections without new blocking findings. Complementary privacy/persistence review closed the Unknown-mode ARIA disclosure. No tests were weakened to close these findings. The duplicated-validator heuristic remains the documented nonblocking suggestion.
- GitHub #9 was reread immediately before closure and remains unchanged and open. Ticket 01 is closed; ticket 02 is available but unclaimed. No later slice, remote issue write, push, PR or merge was performed. Coordinator-owned verification servers are stopped at handoff; unrelated workspace files remain untouched.
