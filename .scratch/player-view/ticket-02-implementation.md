---
title: Ticket 02 implementation and verification
status: closed
parent: spec.md
---

# Ticket 02 implementation and verification

The user authorized [Explore published objects and anonymous Orbit host chains](tickets/02-object-publication-host-chains.md), subagent coordination and a local commit through `implement` on 2026-10-30. Tickets 03–07, remote writes, pushes, PRs and merges into main are outside this instruction.

## Baseline and ownership

- Original HEAD: `2ef2e4447a96f80292df10e764ff4da565f2d9d4`, with ticket 01's two local commits. The only unrelated work is untracked `.codex/environments/`, preserved untouched.
- Fresh origin/main and local main: `971e91c0ad2fc78e4f92c1e625091a577960b41b`. The initial branch was two commits ahead / three behind. Integrating origin/main preserved ticket 01 and brought in map-tool shortcuts plus delivered-pointer Orbit regression expectations without conflicts.
- Actual implementation/review baseline: `61aa6cb1accaf67f196cffa284109cdf35674189`, on the existing `codex/player-view-ticket-01` branch. This intentionally includes the local prerequisite rather than starting from origin/main alone. Main itself is already current.
- GitHub #9 was reread: unchanged body, open state, enhancement / priority:P1 labels, no comments, last updated 2026-10-09T14:46:17Z. No remote write occurred.
- Sensitive route: architecture before implementation; at most two disjoint implementation writers; independent Standards/Spec and complementary privacy/persistence reviews. Coordinator owns shared Git, runtime ports, browser sessions, integration checks and documentation.

## Approved test seams

The existing approved specification covers the common pure player projection/geometry boundary and real public editing, preview navigation, import, persistence/recovery and history seams. Continue TDD there: effective source geometry and secret removal, saved publication commands, DTO-only consultation and source-preserving round trips. No new test seam or product choice requires reopening the interview.

## Design and verification

Architecture resolved the smallest extension of the established projection/preview before the two implementation writers started. A geometry specialist traced applied defaults and host dependencies independently. The chronological evidence below records initial failures, corrections and completed verification. Raw logs, traces and screenshots belong in ignored test artifacts.

The prior ticket's local timing evidence is historical: one unchanged long Orbit journey exceeded 30 seconds on both its old baseline and candidate, completing with a local 90-second diagnostic limit. The newly integrated main also updates Orbit pointer expectations; reassess actual current failures rather than assuming the old result applies.

### Agreed architecture

- Source workspace/full exports advance to version 3; layout and player projection remain version 1. Current object publication is required. Supported v2 migration preserves its required system publication/public title and initializes objects Hidden; it must not repair malformed v2 system metadata. Unversioned local/v1 files retain their existing shims and initialize systems/objects Hidden. Both new-object construction paths use Known type.
- Extend the existing object draft, validated mutation and writer/history flow. `SystemObject.publication` and `ObjectDraft.publication` use `PublicationMode`; `SystemObjectChanges.publication` is optional so unrelated edits preserve it. Share `isPublicationMode` through the domain facade for source and draft admission.
- `projectPlayerCluster` keeps its public entry point. Only a Revealed system marker has a `map: PlayerSystemDocument`. The map contains allowlisted objects and Orbits, with public identities and remapped placement/host references. Unknown object arms have no family/subtype/type-bearing presentation; partial modes have no prose/Fields, and no mode includes Location keys or Station associations.
- Resolve complete committed geometry with existing pure utilities before filtering. Retain published objects and recursively their containing Orbits/hosts; promote only otherwise Hidden required hosts to Unknown, without downgrading public hosts. Omit unrelated branches, empty Orbits, source order and private identities. Keep unoccupied centers geometric. Copy all numeric points/radii rather than returning references into source layout.
- The preview owns transient public system/object IDs and DTO-only navigation, hierarchy and inspection. New system rendering accepts only the player system document, not source objects or editor state. Preview modal ownership also blocks the newly integrated Warden map-tool shortcuts.
- Two writers: domain/formats/projection/pure tests and editor/object draft/player components/focused UI tests. Coordinator owns BaselinePage integration, shared UI helpers/cross-cutting typed fixtures, documentation, Git and all browser/runtime checks.

### Baseline checks and cleanup

- Focused baseline projection/publication/cluster geometry: 17 passed (`test-results/player-view-02-baseline-pure.log`).
- Initial baseline typecheck exposed the old ticket 01 diagnostic source copy under ignored `test-results`; Nuxt still included its TypeScript files. That generated copy was moved outside the project to `C:/Users/fbal-fontaine/.codex/visualizations/2026/10/29/01a1875f-a22c-7a02-bd3d-b26ee5d7fc6d/ticket-01-baseline-evidence`, preserving evidence and removing only its verified dependency junction. No application/source validation rule was weakened. Clean baseline typecheck then passed before implementation writers started.

### Initial TDD evidence

- Domain writer first observed the missing catalogue-object publication, then passed its creation case with Known type. A second tracer observed the missing initial-primary-star publication and then passed both creation cases (2/2 pure). Both construction paths were made runnable before browser verification.
- Coordinator-owned browser tracer reached actual workspace creation, planet Add and editing, then failed on the absent `How players see this object` control at line 25 (explicit 5-second visibility assertion). This is feature red, rather than an invalid workspace or loading failure. Artifact: `test-results/player-view-02-object-ui-red`. A temporary 60-second outer CLI allowance accommodated first client startup; the missing-control assertion failed at its own unchanged 5-second boundary.
- The short source freeze ended after that red. Domain migration/projection and editor implementation now proceed within their disjoint ownership. Runtime/overlay integration remains coordinator-owned.

### First integrated slice

- Domain checkpoint: 15 focused pure tests passed across projection and publication data, including full-source default geometry, nested rotated/default Orbits, unoccupied centers, shared-host retention and v2 migration. The source was frozen before integration.
- Interim typecheck found current typed fixture objects missing the newly required publication, plus one old projection test needing explicit Revealed-arm narrowing. Those fixtures were updated without converting raw legacy map fixtures or weakening validation. Interim lint found one unused type import and a computed summary without an explicit fallback; both were fixed. Typecheck and lint then passed (`test-results/player-view-02-interim-*-fixed.log`).
- The first integrated UI run reached publication, system entry, object inspection, accessibility snapshot and return-focus assertions, then found two successive harness locator mistakes in its intentional background keyboard injection: modal-hidden Warden content needed an explicit hidden-content locator, and the named map group was already the SVG root rather than its ancestor. These test-only corrections preserved the shortcut assertion.
- The corrected complete tracer passed (1/1, 25.5 seconds; `test-results/player-view-02-object-ui-tracer-green`). It verifies real editing/Apply, Revealed-only entry, DTO-only inspection and private prose absence, actual ARIA output, Back/close focus return and Warden map-shortcut blocking.
- Both writers were released for remaining vertical slices after this green. A shared existing storage-fault helper was moved unchanged into `tests/helpers.ts` so the new nondefault-publication recovery scenario can reuse it; existing recovery assertions remain intact.

### Domain completion and host hierarchy

- Domain writer's complete owned suite passed 18/18 with dedicated output `test-results/player-view-02-domain-final`. It covers all object modes and parent gates, private data/Station-link absence, strict v3 object metadata and strict v2 system metadata, legacy privacy defaults, nondefault object publication snapshot/import/remapping, detached geometry and unchanged source layout.
- Coordinator's focused existing geometry, placement, draft validation and history regressions passed 44/44 (`test-results/player-view-02-geometry-history-regressions.log`). Existing Vue lifecycle warnings were retained rather than suppressed.
- The first host-chain UI tracer correctly failed because its public object row contained no required-host ancestry. The DTO-only hierarchy was extended to follow remapped Orbit/host references. A later setup correction moved the reference Cluster export after returning from System view; the test now checks actual post-import source identities as well as incoming fixture identities. Unknown row selection permits its authorized geometric ancestry text while still requiring exactly three anonymous rows and no actual type disclosure.
- The complete host-chain scenario then passed (1/1, 11.7 seconds; `test-results/player-view-02-host-hierarchy-verified`). Desktop and 390×844 PNGs were visually inspected before broader UI checks. Both show neutral hosts and public labels with reachable close controls. The compact hierarchy is in the scrollable body; final pan/zoom/fit work will address map readability and the desktop lower edge extending beyond the initial body viewport.
- Artifact ownership correction: earlier domain-only runs used Playwright's default `test-results` output and cleaned earlier temporary reports, including some initial red/interim-check files referenced historically above. Their observed command outcomes remain recorded here; those old paths are not claimed to remain available. Subsequent commands use dedicated per-run output directories, preserving current logs/screenshots. No source work was reverted to recreate red artifacts.

### Completed UI candidate

- The first long-label measurement used the text's local SVG coordinates and was corrected before counting feature-red evidence. The transformed, root-scene measurement then correctly failed: right edge 1494.8444 exceeded viewBox right 536. The public-only bounds/label measurement and wrapping correction passed (1/1, 17.6 seconds; `test-results/player-view-02-public-label-green`).
- The viewport tracer failed on the absent navigation controls, then passed after owned Fit/zoom/pan, pointer capture/cancellation, wheel and keyboard interaction were added (1/1, 28.2 seconds; `test-results/player-view-02-player-viewport-green`). Complete source JSON and History controls were equal before/after consultation.
- The architecture reviewer assessed the component's approximately 533 nonblank lines under the repository's 500-line review trigger and recommended keeping it cohesive: the small public DTO interface, actual SVG label measurement and viewport/pointer lifetime share one mounted owner; extraction would add a private DOM/selector contract and numerous forwarding handlers. This is an assessed trigger, not a waived hard limit.
- The complementary Sensitive review completed its frozen domain phase with no confirmed findings, covering strict migration, complete source preservation, host closure, applied geometry and allowlisting. Final UI/privacy follow-up and independent Standards/Spec review remain pending the committed integrated candidate.
- Production build passed (exit 0, 6 minutes 41 seconds; `test-results/player-view-02-build.log`). Candidate typecheck passed. Lint found four overwritten initial numeric assignments in the SVG fit function; they were replaced by direct geometry-bound initialization without changing behavior, and lint passed (`test-results/player-view-02-candidate-lint-fixed.log`). The compiled build predates only that behavior-equivalent initializer cleanup and subsequent test-only expectation corrections.
- Compiled-server focused run on port 3148: 11/12 passed, covering four production entry variants plus preview/host geometry, long labels, viewport, parent gates, Undo/Redo/reload/Retry and real backup recovery with nondefault publication/private source data. The remaining mode-loop test assumed the scene was empty when its planet was Hidden, overlooking the independently Known type initial star; it also needed explicit object inspection before expecting details. After those test-only corrections, all four modes passed (1/1, 23.5 seconds; `test-results/player-view-02-production-modes-final`). No application behavior was changed to satisfy those expectations.
- Final desktop/compact images from `test-results/player-view-02-production-focused` were inspected again after viewport sizing/controls. The initial map now fits above the footer, and the compact body scrolls to its hierarchy while retaining the closing controls.
- All eight new public journeys now have passing evidence on the production build (seven in the focused batch plus the mode-loop replay); all four compiled entry checks passed. The complete local suite will run once on the final integrated source, followed by affected replays only if required.

### Integrated suite and final correction

- Integrated implementation snapshot: `2afe07f23cbc00907695bc5496770dc9eab770d5` (`feat: explore published objects and anonymous orbit hosts`). Application source stayed frozen throughout the complete suite and its targeted replays. The dev server was warmed through a real UI journey first (1/1 passed; `test-results/player-view-02-dev-warmup.log`).
- Full command: `npm test -- --reporter=line --output=test-results/player-view-02-full`, with explicit local base URL `http://127.0.0.1:3147`, existing installed Chromium, one worker and no retries. Result: **471 passed / 13 failed, 484 total, 1.1 hours**. All 191 pure checks, the local storage check and all eight new object-publication browser journeys passed. Log and original failed selection remain at `test-results/player-view-02-full.log` and `test-results/player-view-02-full/.last-run.json`.
- The failures initially presented as overall 30-second deadlines or five-second loading waits in existing map, Orbit, navigation and campaign-preparation journeys. An untouched copy of the failed selection was used with `PLAYWRIGHT_LAST_RUN_OUTPUT_FILE` and `--last-failed --output=test-results/player-view-02-failed-replay`, retaining the complete run's artifacts. Result: **12 passed / 1 failed in 3.0 minutes**, with the same source, dev server, assertions and deadlines. Log: `test-results/player-view-02-failed-replay.log`. These twelve outcomes are successful replays, not a clean first full-suite pass.
- The persistent Ctrl+Z case was diagnosed from its captured page: the chart-details region and `Edit chart details` button were present, while the scenario introduced by merged main still requested pre-ticket-01 `Edit chart names`. Its dialog and submit locators also retained the old names. The editor writer changed only those three exact strings to the existing `Edit chart details` / `Apply details` labels; no application code, assertion, timeout or shortcut expectation changed.
- The whole affected file then passed **8/8 in 1.5 minutes**: `npx playwright test tests/workspace-map-tool-shortcut-guards.spec.ts --project=browser --reporter=line --output=test-results/player-view-02-shortcut-guards-final`. Log: `test-results/player-view-02-shortcut-guards-final.log`. It exercises actual naming, saving, map focus, Ctrl+Z, original-name restoration and unchanged Select mode. All thirteen original failures therefore have passing evidence through unchanged replay or this corrected-file run. The complete suite was not rerun.
- Final application lint/typecheck/build evidence above remains applicable to unchanged application source. Scoped ESLint passed (exit 0) for the final test-only label correction: `npx eslint tests/workspace-map-tool-shortcut-guards.spec.ts --max-warnings 0`, log `test-results/player-view-02-shortcut-lint-final.log`. No validation was disabled or warning suppressed.

### Independent review closure

The review fixed point is `61aa6cb1accaf67f196cffa284109cdf35674189`; the implementation diff is `git diff 61aa6cb1accaf67f196cffa284109cdf35674189...2afe07f23cbc00907695bc5496770dc9eab770d5`. Independent reviewers inspected Standards and Spec in parallel, with a complementary Sensitive review covering the frozen domain phase and then the integrated UI candidate. Both Standards and Spec reviewers subsequently inspected the three-line locator correction and confirmed closure without weakened coverage.

- **Standards:** zero documented-standard violations or blocking findings. One **Low, optional Duplicated Code heuristic** notes the repeated raw-object Hidden initialization in local workspace and portable import legacy migrations. Deferred: the present implementations agree, retain distinct version-specific system/title admission, and are covered by strict current/v2/legacy tests. No refactor is required for correctness. The large public map component's cohesion was separately assessed by the architect and Standards reviewer as recorded above.
- **Spec:** zero findings; all eight ticket criteria are implemented without missing behavior or consequential scope creep.
- **Sensitive privacy/persistence:** zero confirmed findings. Public renderers receive allowlisted detached DTOs, hidden host closure uses safe references, Unknown markup/ARIA omits true type and identity, navigation/viewport resources remain local, and publication follows the existing writer/history/recovery owner.
- Runtime evidence is coordinator-owned. Desktop and compact screenshots and browser accessibility snapshots were inspected; physical keyboard devices and screen-reader behavior were not independently certified.

### Resolution and handoff

All eight ticket 02 criteria are resolved. The source workspace and full GM maps now use version 3; player DTO/layout versions remain 1. Only Revealed systems carry an internal map. Newly created objects use Known type, supported old object data starts Hidden, and complete GM operations preserve private source data and publication settings. No prose/Fields, physical Station association, player JSON/link or player image export was added by this ticket.

Before completion, origin was fetched again: origin/main remains `971e91c0ad2fc78e4f92c1e625091a577960b41b`, with the candidate four commits ahead / zero behind. GitHub #9 was reread and its body, labels, open state and absence of comments remain unchanged. The implementation baseline intentionally remains the merge commit `61aa6cb1`; there was no need to integrate a newer base.

The implementation snapshot and final test correction/resolution are local commits on `codex/player-view-ticket-01`. The coordinator stopped the owned dev server after browser checks. The unrelated untracked `.codex/environments/` remains untouched. No push, remote write, PR or merge into main occurred. Tickets 03 and 04 are available but unclaimed; tickets 03–07 remain unstarted and the parent feature remains in progress.
