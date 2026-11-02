---
title: "Search icons and deep Hierarchy readability implementation"
status: in-progress
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

The complete suite will run on the exact committed candidate through the existing PR CI. Pending: final candidate revision, CI URL/counts and rolling branch preview readiness. No merge, release or source-issue closure is authorized by this work.

Browser emulation establishes responsive layout and browser interaction; it does not certify physical-device keyboards or screen readers. Earlier physical-phone validation belongs to the unchanged Search navigation path, not to these follow-ups' new layout.
