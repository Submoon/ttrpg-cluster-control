---
title: "Search icons and deep Hierarchy readability implementation"
status: closed
---

# Search icons and deep Hierarchy readability implementation

## Scope and baseline

Authorized on 2026-11-02: implement [Search result type icons](tickets/04-search-result-type-icons.md) and [deep Hierarchy readability](tickets/05-deep-hierarchy-readability.md) in parallel with subagents, retaining the single `codex/global-search` branch.

Fetched `origin` before implementation. Baseline HEAD: `8fea36283b9eac0ef1cfa49fd7f8f5f4479e13d5`. `origin/main`: `d40e5f515baf1afeb0e2135461287b243b2a1f6c`; comparison: 0 behind / 20 ahead. This deliberately retains tickets 01–03 and their native Nuxt UI refactor. `main` is checked out in another worktree and is left untouched. Preserve the unrelated `.codex/environments/environment.toml`.

## Ownership

- Search specialist: `WorkspaceSearch.vue`, `utils/workspace-search.ts`, focused Search icon test and necessary model-test fixture updates.
- Hierarchy specialist: `MapHierarchy.vue`, focused deep-layout test and its fixture.
- Coordinator: planning files, Git, runtime ports, browser sessions, all checks and integration. No concurrent edits to shared catalogue, helpers or editor commands.
- Independent reviewer: stable combined diff against the pinned baseline, covering repository standards and both tickets' acceptance criteria.

## Verification record

Before correction, the public deep-fixture journey in `test-results/followups-hierarchy-red/report.json` reaches 14 records and actual `aria-level="11"`. At the Home-resized 220px panel minimum, the deepest `.tree-copy` has width **0px**, failing the readable-space assertion (`>= 80px`). Normal/minimum screenshots are attached; the coordinator inspected the minimum-width capture. This is the confirmed layout regression, with `MapHierarchy.vue` still at the baseline.

Initial setup attempts failed before reaching the layout: sandbox loopback isolation, Nuxt/client-module cold startup, then an unscoped SVG-node navigation locator outside the viewport. The coordinator moved the development server to an accessible loopback execution context, explicitly warmed the runtime and scoped the navigation to the public Hierarchy button. No timeout, assertion, retry or skip policy was weakened. Historical artifacts remain in the separate `followups-hierarchy-baseline*` and `followups-hierarchy-before*` directories.

## Delivered behavior

Search results carry presentation-only leading marks: canonical `objectMark` glyphs for objects (including custom Other fallback) and distinct existing Lucide network/orbit icons for the cluster/systems. Marks are decorative, labels keep their complete context/disambiguation, and rows use a fixed leading column with a 44px minimum height. Matching, ranking, target identity and reveal commands are unchanged.

Hierarchy retains native nested UTree and actual accessible levels. Supported UI slots offset guide borders and apply a per-level indentation step `min(5px, 40px / maximumDepth)`, limiting total visible indentation to 40px. Grid rows prioritize names, show complete Location keys separately, wrap secondary type/parent context without truncation and describe root placement as `System map`. Expansion, selection, guarded commands and focus handlers are unchanged.

## Local verification

- Full lint and Nuxt typecheck passed on the bounded-indent candidate: `test-results/followups-verified-lint.log` and `followups-verified-typecheck.log`. The later source adjustment only replaces the root context string with `System map`; exact-candidate CI checks are pending.
- Nine Search model cases passed, including every catalogue subtype/custom Other and cluster/system marks: `test-results/followups-icons-focused/report.json`. Its first browser attempt stopped in import setup while the other specialist was editing UI; a later frozen-source run passed that browser case.
- New Search browser journey passed (14.3s): desktop/compact long duplicate rows, decorative rendered marks, complete accessible names, keyboard highlight and deliberate activation returning focus to the map. Report: `test-results/followups-visual/report.json`.
- Final integrated browser selection **12/12 passed** (2.1m): `test-results/followups-integrated-browser/report.json`. Command: `playwright test tests/workspace-hierarchy-readability.spec.ts tests/workspace-hierarchy-tree.spec.ts tests/workspace-search.spec.ts tests/workspace-global-search.spec.ts tests/workspace-object-search.spec.ts tests/workspace-panels.spec.ts --project=browser --grep 'deep object|selecting a parent|Orbit expander|tree keyboard expansion|map selection and relationship|keyboard search keeps|real Inspector draft|reveals an object from an unopened|compact Location-key search|@ui-smoke' --trace retain-on-failure`, with `PLAYWRIGHT_SUITE=browser`, loopback `PLAYWRIGHT_BASE_URL` and separate output/JSON report paths.
- The new deep journey imports 34 records through the public UI and reaches actual level 31. At the real 220px Home-resized panel minimum, object names retain at least 80px at level 11 and level 29 (both expandable) and level 31 (leaf), with total indentation at most 41px including measurement tolerance. It verifies complete metadata/no horizontal overflow, empty Orbit reachability, compact keyboard focus, touch selection in Inspector and selection retained after reopening Hierarchy.
- The first deep touch assertion incorrectly expected Hierarchy to remain visible after selection. The error snapshot showed the correct object in the existing compact Inspector. The test was corrected to verify that existing transition and reopen Hierarchy; product selection behavior was preserved.
- Coordinator and independent reviewer inspected desktop/compact Search screenshots and minimum-width/compact deep Hierarchy screenshots. They show readable names/context and clear selection. Captures are attached to the two browser reports above.

## Independent review

One independent reviewer covered Standards and both tickets' specifications against `8fea36283b9eac0ef1cfa49fd7f8f5f4479e13d5`, inspected native component markup/callers and personally viewed four rendered captures. The initial reduced fixed nesting still had unbounded width loss; the correction caps the total budget and compensates each 1px guide border. Coverage includes the near-bottom expandable row, not just a leaf. Both findings are closed, with **zero remaining source or visual findings**. The maintained 12-case browser selection subsequently passed.

## Integration check

Implementation candidate `97fbb2e456427f6fa6c67488b40106a84adc0cf9` was committed and pushed on `codex/global-search`. Existing draft [PR #36](https://github.com/Submoon/ttrpg-cluster-control/pull/36) is updated. [CI run 41419142044](https://github.com/Submoon/ttrpg-cluster-control/actions/runs/41419142044) passed lint, full Nuxt typecheck, production build and **222/222 pure/storage cases** (32.0s). Exact-candidate Vercel Preview resolution succeeded. Browser shard 1 passed **160/160** (11.3m); shard 2 passed 151 cases and failed the new icon journey's immediate CSS-mask sample. Final outcome: **533 passed / 1 failed**, with the quality gate correctly failing. No cases were skipped or retried.

### CI observation correction

The Search icon test sampled the mounted `span.iconify` before Nuxt Icon asynchronously fetched its data and inserted the mask stylesheet. The installed CSS component mounts the span first, then calls `loadIcon(...).then(mountCSS)` on a cache miss. Both requested icons are present in the local Lucide server bundle; dynamic names are not preloaded in the client bundle. Independent review confirmed this supported transient state and found no missing-icon source defect.

Only the test helper changes: bounded `expect.poll` with the normal expectation timeout waits for an actual computed CSS mask or SVG drawing markup. It retains the final nonzero dimensions, supported representation and CSS-mask checks. No timeout, retry, skip or product behavior changes. A permanently missing icon still fails. Focused test lint passed; the corrected complete Search journey passed locally in 12.6s (`test-results/followups-icons-async-recheck/report.json`). Independent review found zero remaining issues in this correction. A new exact-preview CI run will verify the asynchronous observation in production.

Final verified candidate: `bbe17d2eb3b35f0a1f5c81c30efb728cd97d564d`. [CI run 41421347433](https://github.com/Submoon/ttrpg-cluster-control/actions/runs/41421347433) completed successfully: lint, full Nuxt typecheck, production build, **222/222** pure/storage tests (39.3s), exact-preview resolution, browser shard 1 **160/160** (9.8m), browser shard 2 **152/152** (7.6m), and the final quality gate. Total: **534/534 passed**, with no failed, skipped or retried cases. The corrected actual-painted-icon assertion passed against production Preview. Application source is unchanged from `97fbb2e4`.

The [rolling branch preview](https://ttrpg-cluster-control-git-codex-global-search-submoon.vercel.app) retains the existing branch address. Local development runtime is stopped after verification. No merge, release or source-issue closure is authorized by this work.

## Resolution

Tickets 04 and 05 are closed. Two specialists implemented disjoint Search/Hierarchy scopes, and the coordinator integrated them on the existing single feature branch. Acceptance criteria, focused browser/model coverage, rendered review, the exact-candidate full suite and independent Standards/Spec findings are resolved. The subsequent closure commit changes documentation only; source and tests remain identical to the verified `bbe17d2e` tree. The PR remains draft and GitHub #7 is not closed by this follow-up.

Browser emulation establishes responsive layout and browser interaction; it does not certify physical-device keyboards or screen readers. Earlier physical-phone validation belongs to the unchanged Search navigation path, not to these follow-ups' new layout.
