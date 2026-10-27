# Interface revamp finalization

Source: [GitHub issue 3](https://github.com/Submoon/ttrpg-cluster-control/issues/3). Scope: [ticket 29](tickets/29-final-cleanup-and-product-validation.md). The [specification](spec.md) and [delivery plan](implementation-plan.md) retain the accepted requirements and dependencies; this record retains acceptance, cleanup provenance and limits.

## Baseline and scope

Final cleanup started on 2026-10-22 at feature commit `cf469857862565c58047fee98f8f174bee845c7c`, after tickets 18–28 closed. Fetched `origin/main` was `629d2a98715c3a16b954e0f77c639b1f0c31212c`: 0 main-only / 54 feature-only commits. The retrospective guardrail follow-up started on 2026-10-26 at `1cdd1b49d55177c54363fb8b14fa13ca9e769f41`, with the same main and 0 / 61 commits. Both intentionally use the feature branch as their baseline.

Issue 3 remains open and [PR 28](https://github.com/Submoon/ttrpg-cluster-control/pull/28) is draft. No merge, release or source-issue closure is implied.

## Three cleanup passes

1. **Usage:** removed 874 individually verified generated files and retired the comparison entry, components and samples. Shared production maps, field primitives, domain/storage/codecs and valid test fixtures remain.
2. **Necessity:** removed 93 superseded research/lab reports and the scratch Playwright configuration after promoting its maintained replacement to the root. Current requirements and substantive ticket resolutions retain authority.
3. **Minimal surface:** removed five redundant top-level documents and the obsolete artifact `.gitattributes`; condensed retained prose and repaired links. The effort now contains only `tickets/`, `spec.md`, `implementation-plan.md` and this record: 32 Markdown files, versus 1,005 files/128 Markdown documents at intake.

The physical follow-up also removed provenance-verified ignored build/lab copies and empty directories; unknown or unrelated work was protected. No duplicate archive tree remains. Product code always renders the persistent editor, including former comparison query URLs, and emits no retired comparison/debug signatures.

Before deleting the remaining preview source and three saved working files, all 378 non-generated files (14,857,309 bytes) were captured and independently SHA-256 verified on the **local-only** safety branch `codex/interface-revamp-cleanup-safety-20261022`, commit `dd4842d991a597295951918034bfefab39d47b2e`. Do not push that recovery branch. The retired prototype checkout is recoverable from `codex/interface-revamp-prototype`, commit `7ea41e0a9b0e585e23812eb9165e95420d72dc89`. Detailed historical inventories remain in Git, including cleanup commit `161f8e351235804ee1fcde6facf05a01f067b842` and physical follow-up `815f1e63b9734ba36a8a959c12ff39a50008ff6e`.

## Acceptance and limits

### Frozen product candidate

The final cleanup candidate passed typecheck, production build, SSR and **194/194 Chrome tests in 11.7 minutes**, one worker, zero retries, skips or flaky cases. Execution used 193 compiled-app cases at port 3180 and the existing Vite-only IndexedDB adapter case at port 3100. Runtime was Node 24.18.1 / Chrome 155.0.8059.85. Source and compiled identities stayed unchanged throughout:

| Identity | SHA-256 |
| --- | --- |
| Campaign fixture, `tests/fixtures/workspace-data-campaign-baseline.json` | `4683261fd887443a32fda9d8a7e689b44df92387f772626f470c3566d50e9006` |
| Final source/test/configuration, 115 files | `dffc2758b06bc01dec926c61e5e9637efd3d128d6b2ba4ad01e004bbd804e8d2` |
| Compiled application/runtime, 81 files | `bc0d7a33a3546c23d12e8b6cc9f49099feb1073a7898a861cc2092cf0d039651` |

Coverage spans B1–B10: persistence/recovery, navigation and tool lifetimes, gesture cancellation, retained drafts/conflict guards, Fields/destructive reviews, failed-save retry and JSON recovery, responsive themes/resources, and complete applied SVG/PNG exports. The specification defines those contracts; maintained test families own their executable checks.

This full-suite result certifies that frozen cleanup candidate, not every subsequent commit. Later Select-default, consultation/editing footer, compact recovery and system-command changes passed their affected selections (36, 33 and 10 cases respectively), typecheck/build and independent SOL review. Initial failures were attributed and corrected: hidden-header autofocus, a compact recovery overlay intercepting footer actions, and an append-import fixture mistaken for a single-system workspace. Public-UI setup now explicitly distinguishes creation from append import. Historical corrections and detailed measurements remain recoverable from Git and PR 28.

### Final production performance

Comparable compiled-product measurements used the campaign fixture (2 systems, 6 objects, 2 Orbits, 1 route, 1 custom field), desktop 1440×900/light and compact 390×844/dark. Initial decoded JavaScript/CSS fell from **1,583,298 to 1,370,315 bytes**, a 13.5% reduction. Neither arm loaded deferred JS/CSS when opening sampled features. Three-sample interaction medians remained comparable. Startup and map-mount observations varied materially and establish no general latency improvement or numerical budget. No old-main or isolated Nuxt UI cost arm was available.

### Final independent Astra interface review

Astra reviewed the accepted references and actual compiled product at 1440×900, 390×844 and 844×390, including workflows, hierarchy, inspectors, Fields, file actions and Tools. No blocker remained. Its stale Add-label finding was corrected; maximum Nuxt UI use and the B/Dock composition were retained.

Later human decisions supersede earlier optional suggestions: **Select** is default and leftmost; **Navigate** pans/enters systems; **Move** manipulates entities; **Add** remains persistent. Consultation exposes footer Edit, editing exposes Apply/Discard; system consultation also offers Open system. Foundry VTT remains a conceptual reference, not extra scope.

Physical Android Chrome OS-keyboard/safe-area/two-finger behavior and actual screen-reader speech were unavailable for final acceptance. Browser emulation, focus assertions and historical prototype phone tests do not certify those checks. Exhaustive contrast and every possible failure state were outside the bounded visual review.

## Maintained follow-up

The retrospective replaces repeated execution journals with root CI/lint, reusable `@ui-smoke` checks and report attachments. Current commands live in [README](../../README.md); UI boundaries and review judgement live in [UI guidance](../../docs/agents/ui.md). Subsequent run results belong in CI/PR artifacts rather than extending this historical dossier.
