---
title: "Native Nuxt UI presentation refactor"
status: in-progress
---

## Current checkpoint

Native Navbar, Toolbar, CommandPalette and Tree are implemented. The redundant empty-query instruction is removed. Ticket 03 also includes Control+K on Windows/Linux and Command+K on macOS, an accessible `UKbd` hint, idempotent query refocusing and live gesture/dialog admission.

The latest upstream baseline is **d40e5f515baf1afeb0e2135461287b243b2a1f6c** (PR #38); it is merged at **c0241267d91f9d2da1a8a7e34a46dfe18bb745eb**. Main is checked out in another worktree, so its local reference was not force-updated. Three conflicting test hunks preserve both `waitForWorkspaceSaved` acknowledgements and native `treeitem` locators. No merge was aborted and no local work was discarded.

| Evidence | Result |
| --- | --- |
| Native Search/Tree/panel journeys at `dfc5c362` | 27/27 passed; `test-results/dashboard-focus-final-browser/report.json` |
| Phone input after native replacement | User-reported success on Nothing Phone 4a Pro / Firefox at `dfc5c362`; see mobile record |
| Two chained Tree locators found by first native CI | Corrected; exact 2/2 rerun passed |
| Shortcut first slice | Intended red before implementation, complete green from a dirty Inspector (11.3s) |
| Shortcut, closing modal, held pans, old map-shortcut guards and responsive states | 12/12 passed; `test-results/search-shortcut-final-browser/report.json` |
| Closing-modal test cleanup correction | 1/1 passed; `test-results/search-shortcut-closing-cleanup/report.json` |
| Final shortcut lint / prepared Nuxt types | Both passed; `test-results/search-shortcut-pan-final-{lint,typecheck}.log` |
| Independent source reviews | Original native P2s closed; shortcut gesture P2 source closure accepted; final commit pin pending |
| Complete integrated CI for latest shortcut + main | Pending |

The complex existing nested-map construction test reached its unchanged 30-second local deadline twice after the latest merge, at different Add completion steps. No assertion established a product defect and no deadline/skip was changed. Other conflict-affected field configuration, delayed-import guard and Tree history tests passed. Complete CI must still run this scenario; do not describe the local merge checkpoint as entirely green.

The shortcut's active-contact guard reads a live predicate exposed by the existing map-tool shortcut owner. Its pointer/touch Sets and capture/release/cancel/blur/unmount lifecycle remain unchanged; Search does not duplicate tracking or cache that nonreactive state. Competing dialogs remain owners throughout actual visible exit animations. The new public closing-Fields regression pauses/resumes the native animation with guaranteed cleanup and checks suppression, opener focus and a fresh admitted chord.

## Authorization and baseline

The user requested replacing the existing presentation with `UDashboardNavbar`, `UDashboardToolbar` and `UCommandPalette` on 2026-10-30, then proposed `UTree` for Hierarchy. Continue on the single **codex/global-search** branch and [draft PR #36](https://github.com/Submoon/ttrpg-cluster-control/pull/36). Preserve the accepted global-search specification, guarded commands, applied data, camera framing and session lifetimes.

Product baseline: **afa33c00f1e733cfe14f76d8ba4cfbfb1f029a8c**. A fresh fetch confirms `origin/main` remains **971e91c0ad2fc78e4f92c1e625091a577960b41b**, an ancestor of the feature branch (0 behind / 13 ahead). Existing uncommitted work is limited to planning records and a browser-test geometry-oracle correction. Preserve it and unrelated `.codex/environments/`.

Before final integration checks, another fetch found `origin/main` and the already updated main worktree at **d4b97331b9821b7a4ad9022c50391ba14fc847c9**, adding PR #37's `UKbd` presentation change in `WorkspaceDock.vue`. This disjoint change was merged without conflicts or stashing local work at **136260329122b950d7f4c6f34c21eec1d487b78b** (0 behind / 14 ahead). Final native UI checks include this current base; no intentionally outdated main base remains.

The preceding product passed lint, typecheck, build, 54 focused pure checks, 18 search journeys, eight UI smoke cases and a user-reported real-phone journey on Nothing Phone 4a Pro / Firefox. The single full local run was 504/515 with 11 failures; a targeted rerun passed 11/12 (one neighboring viewport control included), leaving an initial archive-hydration failure before Add Route. CI checks and the first browser shard passed; the second failed only an incorrect hosted-branch maximum-zoom assertion. The correction now also measures actual visible ring geometry: rotated SVG DOM rectangles overestimate curve paint. Its diagnostic loop is separate from product changes. Do not claim a clean full suite.

## Architecture

Read-only architecture and installed Nuxt UI source were inspected before releasing developers. No new domain, store, navigation, renderer or persistence interface is needed.

- `WorkspaceHeader.vue`: `UDashboardNavbar as="header" :toggle="false"`; brand in left, current cluster in center, theme/Fields in right. Override fixed header height and hidden compact center defaults; preserve wrapping, heading semantics, props and inert behavior. Do not move DashboardGroup.
- `WorkspaceMapChrome.vue`: `UDashboardToolbar as="nav"`; existing context/status in left, actions in right. Preserve the named navigation landmark, obstruction/inert attributes, action order, events, Search models and exposed close-focus barrier. Use wrapping rather than horizontal overflow on compact screens.
- `WorkspaceSearch.vue`: retain the visible opener, `UModal` and its focus-close barrier; replace the custom input/list with `UCommandPalette`. Existing open/query/results/reveal/exposed interfaces remain.
- Hierarchy: `UTree` is appropriate for the nested Objects/Orbits projection. Preserve the existing depth-first ordering, metadata and guarded commands; flat systems/routes remain navigation. Expansion is consultation, not selection. The current implementation has no collapsed state, so retain initially visible descendants and reveal selected ancestors.

### Palette contract

Use one stable group of the already ordered results, `ignoreFilter: true`, `preserveGroupOrder`, `valueKey="key"`, no extra debounce/index/fuzzy matching/virtualization. Installed Palette still slices ignored groups: set `fuse.resultLimit` to at least the full result count, never its default 12. Preserve contextual labels, Location keys, occurrence numbers, empty/no-match states and live count through supported item slots without nested controls.

Each item synchronously prevents its selection event's default before calling the existing async activation. Highlight/hover/model updates never navigate. The guarded command owns accepted closure; Stay or invalid Apply retain Search and query. Keep `autofocus=false` and the modal's existing focus owner. Protect late rejected callbacks against newer activation/dismissal and preserve nested-modal focus.

Native Palette options use listbox/option roles with query DOM focus and `aria-activedescendant`. Keep a small mounted editing/results keyboard mode: editing Home/End and modified navigation retain native caret behavior; Down/Up enters result navigation; results Home/End reaches first/last; Up from first returns to editing. Reset editing on input/composition/query pointer or Left/Right. Consume a first Down when Palette already highlights the first item. Use `highlightOnHover=false`. Composition state, `isComposing` and keyCode 229 stop propagation without cancelling native default. Only uncomposed Escape dismisses. Keep Select All, copy/paste, Delete and Backspace native.

### Tree contract

Use stable keys and a controlled selection derived from accepted store state. Prevent the cancellable `select` event synchronously, then invoke the existing object/Orbit command; never call the slot's direct `handleSelect`, which bypasses that cancellation. Stay must not leave an optimistic selected row. Toggle/expansion remains independent consultation. Build children from the existing hierarchy projection; omit `children` entirely for leaves. Preserve object keys/type/name and Orbit/host/occupant metadata.

## Coordination and verification

At most two disjoint writers. The coordinator owns Git, all servers/browser sessions, shared preparation/static/build scheduling and integration. No source edits during integrated checks. Chrome and Search implementations preserve each other's files and the geometry-oracle work. Unexpected ownership expansion requires coordination.

Use public behavior seams: native palette role/identity and unchanged map before activation; first/last navigation, Enter/touch destination, query retention; native caret and composition; Apply/Discard/Stay, nested guards, desktop/portrait/short landscape, 500 results, Add/shortcut isolation and actual usable map framing. Adapt button/focus oracles to option/active-descendant semantics without dropping domain, camera, guard or query assertions. Inspect rendered states. Native-header changes reuse existing UI behavior checks rather than tests of component names. Revalidate the software-keyboard journey on the updated branch preview because the previous phone testimony covers the preceding UI.

## Active implementation checkpoints

The Chrome developer completed only `WorkspaceHeader.vue` and `WorkspaceMapChrome.vue`; their public interfaces are unchanged. All eight maintained UI smoke cases passed with those native wrappers (`test-results/dashboard-chrome-palette-red/report.json`, 1.9 minutes), including desktop, portrait and short landscape. The title of that artifact predates the actual palette tracer selection; it contains only those eight cases.

The native 500-result keyboard tracer was then run against the preceding custom Search. Its expected combobox was absent, establishing the intended red (`test-results/dashboard-palette-red-native-probe/report.json`). The Search developer was released to implement Palette, then adapt existing option/active-descendant oracles and restore the separate rotation/touch journey after the first green. Do not prescribe Location-key ordering among identical-name UUID-tied objects, or require ephemeral option DOM IDs to survive modal remounts.

The Chrome developer proceeds serially to `MapHierarchy.vue` and its first public guarded-Tree tracer before implementing Tree. That owner also has mechanical non-search hierarchy row locator updates and the hierarchy-row portions of `tests/helpers.ts`; flat system/route and renderer button locators remain unchanged. Search tests and the separate search geometry assertion helper belong to the Search developer. The coordinator alone schedules source freezes and executes tests.

The first guarded Tree journey passed on the minimal native implementation: Stay retains the nested object's draft and accepted selection; Discard then selects its parent Orbit (`test-results/dashboard-core-first-green/report.json`). Two independent follow-up journeys cover expansion/keyboard consultation and externally selected ancestor revelation, followed by mechanical hierarchy-role migration of existing scenarios.

Two Palette scrolling corrections remained red. A read-only architecture reassessment and actual computed-layout probe then established the cause: `UCommandPalette` renders a fragment, so its forwarded class did not receive the parent's Vue scope attribute. Scoped root/descendant sizing rules therefore never applied. The rendered 500-option viewport was approximately 25,196px tall while the modal body was 764px with hidden overflow (`test-results/dashboard-palette-layout-probe/report.json`). Correct through supported native `ui` slots or a selector anchored on the real parent-owned element; preserve the scrollability assertions. This is a presentation defect, not a reason to relax reachability coverage.

Supported Palette slot classes and the modal's available-height chain correct the scrolling. Visual inspection also found the analogous Navbar fragment-root scoping defect (hidden current-cluster title), and missing scoped styles on generated Toolbar slot elements (clipped compact commands). Narrow namespaced selectors now reach those native elements. The corrected portrait capture shows the cluster title, wrapped commands and full-width map. Existing responsive review journeys now assert title/action containment and lack of horizontal overflow across desktop, portrait and short landscape.

Whole-repository lint and the prepared Nuxt TypeScript check passed (`test-results/dashboard-final-lint.log`, `test-results/dashboard-final-typecheck.log`). The first six-case native checkpoint passed four cases: 500-result keyboard revelation (19.2s), rotated touch activation (12.5s), native editing/composition isolation (4.3s), and guarded Tree selection (7.6s). The two new Tree journeys remain red on typeahead and a history-focus expectation (`test-results/dashboard-native-first-integrated/report.json`); diagnose against native Tree and existing history ownership before changing behavior or assertions. No deadlines were extended. The previous 500-result timeout was split by responsibility, moving unrelated shortcut/composition checks into their own journey while retaining all 500-result reachability, identity and reopen assertions.

Read-only reassessment confirmed native typeahead needs explicit `textValue` metadata; it now uses object/Orbit labels, independent of Location-key and descriptive text. The keyboard test starts typeahead before other navigation keys because installed Reka buffers their key names. History intentionally restores an enabled initiating element or falls back to the map; its oracle now checks no hierarchy focus stealing rather than focus on a newly disabled Undo button. Exact map-marker labels distinguish objects from their hosted Orbit hit targets.

On the current main-integrated candidate, all three header/toolbar responsive journeys passed, including 390×500, 390×844, 844×390 and 1440×900 states. Guarded Tree selection and external map/history ancestor revelation also passed (`test-results/dashboard-tree-responsive-final/report.json`, five of six cases). The remaining keyboard journey reached its final compact reopening step, where the existing Inspector had correctly become fullscreen; the test now closes that surface through its public action before reopening Hierarchy. No production focus policy, deadline, skip or assertion threshold was changed. The complete Search regression, five footer/deletion UI smoke cases and this corrected Tree case are running in `test-results/dashboard-search-ui-regression/report.json`; three maintained panel smoke cases still follow. Integrated CI, independent final reviews and updated phone testimony remain pending.

## Independent reviews and focus corrections

The native candidate **62c6ad5c15456dcefafcaf0200b7f25223611ebc** was committed and pushed to the single branch. Independent Standards and Spec reviewers compared the candidate with pinned current main **d4b97331b9821b7a4ad9022c50391ba14fc847c9**, focusing the native delta since `afa33c00` while checking existing command ownership. CI passed lint, full Nuxt typecheck, build, pure tests and development storage for this candidate. Its exact Vercel Preview was ready; browser shards were still running when corrections began.

The 26-case local Search/UI checkpoint finished **23 passed / 3 failed** in 5.6 minutes (`test-results/dashboard-search-ui-regression/report.json`). All six global journeys, the corrected Tree keyboard journey and five footer/deletion smoke cases passed. One failure was initial archive hydration before the isolated-leaf test body; one was a stale homonym-test scroll-container oracle, now corrected to the actual native viewport without relaxing bounds, identity or reachability. The third was a real focus defect identified by the Spec review.

- **Spec P2:** after a hidden chart-name draft's Stay consultation closed, the native option button received focus. An actual-element diagnostic confirmed the connected `BUTTON` with `role=option`; the initial Search rejection had correctly left focus with the still-open name editor. The minimal correction synchronously focuses the combobox before invoking guarded revelation, making it the nested editor's captured opener. Canceled native selection performs no subsequent focus write. The unchanged hidden-chart draft journey passed in 11.1 seconds (`test-results/dashboard-focus-partial-green/report.json`), and the independent Spec reviewer accepted source closure.
- **Standards P2:** clicking a Tree chevron focused its nested button, from which native Tree arrow handlers did not run. A new public dirty-draft tracer confirmed ArrowRight left the branch collapsed. The correction invokes native toggle and immediately focuses its owning treeitem with `preventScroll`, without selecting anything or invoking a guard. The independent Standards reviewer accepted source closure; the new public tracer still requires green confirmation.

Final whole-repository lint and the prepared Nuxt TypeScript check passed on both corrections (`test-results/dashboard-focus-final-lint.log`, `test-results/dashboard-focus-final-typecheck.log`). No temporary diagnostic remains in tests. Final targeted browser checks, complete CI, review pin confirmation and focused actual-phone revalidation remain pending. No source issue was closed and no merge/release was performed.

## Verified native candidate and follow-up

The corrections were committed and pushed at **dfc5c362bac9be64872f94ce6feb860cb8bdcb99**. Both independent review axes confirmed the exact committed closure with zero remaining source findings. All **27 final local journeys passed** in 5.1 minutes (`test-results/dashboard-focus-final-browser/report.json`): all 20 Search journeys, four Tree journeys and three maintained panel smoke cases. Together with the preceding five footer/deletion smoke cases and three responsive journeys, the maintained UI selection and requested desktop/compact states are covered. This includes the independent readable/rotated branch oracle and the actual chevron-to-arrow regression.

Vercel deployment **7443136252** for `dfc5c362` was confirmed ready before sharing the rolling branch preview. The user repeated the software-keyboard/activation/Stay protocol on the previously identified Nothing Phone 4a Pro / Firefox and answered **“Tout fonctionne sur le téléphone”**. See [actual mobile evidence](mobile-validation.md); device testimony is separate from browser emulation.

The first native CI candidate `62c6ad5c` completed 296 browser passes and four failures. Two were the already corrected Search focus/scroll defects. The other two were missed chained hierarchy locators in chart-write recovery and history consultation; both now query `treeitem` while preserving every domain, selection and rendered-radius assertion. Their exact local rerun passed **2/2** in 22.8 seconds (`test-results/dashboard-ci-locator-corrections/report.json`). All checks/build/pure/storage passed on both native candidates. No automatic Actions run appeared for the `dfc5c362` push, so the coordinator dispatched **41088310716** manually on that exact branch/head. Its checks passed; its browser jobs were canceled when the user added the opening-shortcut follow-up below, avoiding a knowingly obsolete integration run. A final integrated CI run remains required on the new candidate.

### Ticket 03 opening shortcut and initial copy

The user requested removing the redundant initial instruction and asked where Control+K would be implemented. The coordinator assigned it to ticket 03, retaining one branch and PR. Initial empty-query copy is now removed through the supported empty-slot visibility configuration; the input still invites typing and a nonempty failed query retains its explicit message.

Read-only architecture prescribed a small mounted bubble listener owned by `WorkspaceSearch`, with cleanup, a page-owned availability flag forwarded through `WorkspaceMapChrome`, and Nuxt UI `useKbd`/`UKbd` for platform chord interpretation and display. Installed `defineShortcuts` prevents default before its handler and cannot admit handled/repeated/composing events first, so it is unsuitable for this editor ownership contract. No store action, domain change, imperative focus forwarding or separate generic shortcut service is introduced.

The shortcut must preserve the query, draft, map/tool/camera and activation guards; respect native composition, event ownership, competing dialogs, compact fullscreen panels and gestures; and remain useful when Search is already open. Add public behavior tracers before implementing the bridge, then repeat focused checks and independent review for this bounded delta. The phone validation continues to cover the unchanged mobile input/activation path.

### Browser geometry oracle reassessment

The original hosted-branch test incorrectly required its fitted scale to equal the 2x isolated-target maximum. The first correction preserved that cap, added independent 12px/9px text-size floors and complete visible-paint containment. Parent object groups containing invisible hit targets were excluded. A repeated public red then identified an ellipse's oversized transformed DOM rectangle as overlapping the real map header, while the screenshot showed the painted ring well below it.

Read-only architecture reassessment prescribed browser-native curve sampling rather than copying production's analytic ellipse formula. The actual application probe (`test-results/dashboard-palette-red-native-probe/report.json`) measured a DOM top near 113px against a header ending at 132px, but the conservative native curve envelope began at 177.5px. It used 3,442 arc-length samples, a 0.25 CSS-pixel outward error envelope, complete screen CTM, and the computed 2.4-unit scaling stroke. This establishes a test-measurement defect, not an observed product framing bug.

An isolated native-SVG cost probe additionally measured 3,524 samples in 34.4ms. A previous 30-second whole-test timeout therefore does not establish excessive sampling cost. The final helper keeps 0.25px accuracy and the existing containment/obstruction thresholds, measures `.orbit-ring` through native geometry plus outward sampling/stroke bounds, and measures ordinary visible glyph/text elements through DOM boxes. Direct Inspector checks use the same helper. Invalid geometry is rejected; sample sets are never truncated and no silent fallback is used. Temporary verbose probe scaffolding was removed; useful failure identities/rectangles remain. The readable hosted-branch journey passed in `test-results/dashboard-core-first-green/report.json` (10 seconds). Renderer/framing source is unchanged.
