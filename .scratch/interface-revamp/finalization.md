# Interface revamp finalization

Source request: [Revamp the interface](https://github.com/Submoon/ttrpg-cluster-control/issues/3). Ticket: [Finish the production editor and retire the revamp experiments](tickets/29-final-cleanup-and-product-validation.md).

## Baseline and scope

Started 2026-10-22 from `cf469857862565c58047fee98f8f174bee845c7c`, equal to fetched `origin/codex/interface-revamp`. `origin/main` remains `629d2a98715c3a16b954e0f77c639b1f0c31212c`: 0 main-only / 54 feature-only commits. Tickets 18–28 are closed; tracked checkout was clean. GitHub issue 3 is unchanged/open. No merge, release or source closure is authorized by this finalization.

The tracked effort contains 1,005 files, 128 Markdown documents and 48,934,857 bytes at intake. Counts describe the starting collection, not a deletion target. Unknown/user-created untracked files are protected. Every deletion needs an audited use/authority decision; no recursive directory purge, duplicate archive tree or change to saved-workspace formats.

Root coordinates runtime, Git and this final dossier. SOL 6.1 High defines the preservation contract and technical review; Luna XHIGH owns bounded product retirement and documentation cleanup. Astra reviews the actual cleaned complete interface, Tools included, after candidate freeze.

## Three cleanup passes

1. **Usage and authority:** remove proven obsolete prototype entry/branches and product-only samples; retire unconsumed one-off scaffolding and obvious duplicate reports.
2. **Necessity:** consolidate current requirements and substantive ticket resolutions; retain one final evidence dossier. Promote maintained QA configuration out of scratch before removing its old location.
3. **Minimal retained surface:** challenge every remaining document, index, image and script against a current consumer or otherwise-lost necessary fact. Repair links; remove redundant material rather than hiding it in an archive.

Pass counts, retained reasons and validation outcomes will be recorded here. Accepted historical facts remain concise; raw deleted artifacts are recoverable through exact Git commit/former-path provenance.

### Pass 1 — usage and authority

Removed 874 individually verified tracked generated files (47,106,142 bytes): obsolete captures, results, source snapshots and one-off runners in the historical collections. All Markdown is retained for consolidation in Pass 2; the one currently consumed scratch Playwright configuration is protected until promotion. No directory recursion, untracked deletion, Git metadata or build/runtime deletion occurs. The 558 untracked lab files remain protected pending provenance review. Historical documents temporarily have 175 raw-artifact links across 23 files; retained canonical links will be repaired during consolidation. No current product documentation or this dossier links to the removed raw files.

The new public-route regression fails as expected on the verified prior production build: `?variant=A` renders comparison UI rather than the real welcome/editor. Its 30.1-second RED establishes the route leak before source retirement. The ten prototype-only components/fixtures have no maintained consumer outside that branch; shared field primitives, D3 maps, `d3` and `reka-ui` remain production dependencies.

### Pass 2 — necessity

Removed 94 individually audited tracked files: 93 superseded research/lab Markdown reports (1,246,426 baseline bytes) and the old 1,789-byte scratch Playwright configuration after promoting and verifying its maintained root replacement. Current README, specification, delivery index and ticket resolutions carry the necessary facts; the specification retains all 120 stories and B1–B10. The canonical 34-document local-link check passes. No untracked files were deleted. Redundant top-level historical documents remain specifically for the final restrictive pass.

### Pass 3 — minimal retained surface

Removed five redundant top-level historical documents (110,691 bytes/498 lines), including the separate prototype README, and the obsolete 143-byte artifact `.gitattributes`. README, specification and decision-ticket prose were reduced by a further 115,511 bytes/531 lines. The retained surface has a current consumer: product README for use/development; specification for 120 normative stories, 16 accepted decisions and B1–B10; the compact delivery/dependency index; 29 substantive ticket scope/resolution paths for tracker continuity; this one final dossier for actual acceptance. The final 33-document local-link/anchor check passes. No archive tree or per-report stubs replace deleted reports.

The old registered prototype checkout was separately verified clean, with no active application process, then retired using `git worktree remove`; its branch `codex/interface-revamp-prototype` and commit `7ea41e0a9b0e585e23812eb9165e95420d72dc89` remain recoverable. Unknown local material is audited separately rather than deleted by extension.

### Audited local artifacts and retained exceptions

Removed 555 proven disposable untracked files individually: 517 generated outputs/fixtures (30,008,386 bytes), 29 unconsumed QA runners/configs (150,087 bytes), and nine superseded QA notes (52,791 bytes). The notes described corrected header/focus/recovery-target defects already preserved as outcomes and maintained regressions; their obsolete pixel diagnostics were not another necessary report. Two saved patches and one preserved test-source snapshot were initially retained, then captured in the safety branch below.

Retired three ignored, provenance-verified measurement copies after tests: source-baseline from `629d2a9`, source-b from `7ea41e0` with its documented fixture adaptation, and the old B output. Their offline-probe consumers were already removed. Safe preflight found no Git metadata, reparse points or active path references; individual deletion removed 46,335 files/601,204,893 bytes and 6,627 empty directories, with no errors. The registered prototype checkout was retired separately, as recorded above.

The first closure at `161f8e351235804ee1fcde6facf05a01f067b842` left the ignored `preview-build/`, six ignored test-result files and empty laboratory folders on disk. The human requested their removal. A fresh fetch still showed `origin/main = 629d2a9`, with 0 main-only / 55 feature-only commits.

Before removal, all 378 non-generated preview and saved working files (14,857,309 bytes) were captured byte-for-byte on the **local-only** branch `codex/interface-revamp-cleanup-safety-20261022`, commit `dd4842d991a597295951918034bfefab39d47b2e`. The preview source occupies its original root-relative paths; `preserved-current-worktree/` holds the three former working files. Independent review verified every raw Git blob against the source SHA-256 and exact tree coverage. The branch was not pushed, and no backup directory was added to the product.

The follow-up removed all 28,020 residual inventoried files (355,490,219 bytes) and their empty directories. `preview-build`, `device-preservation-lab`, `implementation-lab`, `measurement-lab`, `research` and `visuals` are now absent, and their obsolete ignore rule is removed. Only `tickets/`, `spec.md`, `implementation-plan.md` and this dossier remain: 32 Markdown files versus the initial 1,005 effort files/128 Markdown documents. No unrelated work was removed. All 115 previously validated production/test/configuration hashes are unchanged; this filesystem/documentation follow-up uses targeted integrity and link checks, without another application test run.

## Acceptance and limits

### Frozen product candidate

The retirement changes make `pages/index.vue` render the persisted `BaselinePage` unconditionally, remove eleven unused comparison/debug components and fixtures, remove the prototype npm command, and rename the shared maps' touch CSS class without changing its behavior. Production field primitives, maps, `d3`, `reka-ui`, domain/storage/codecs and test fixtures remain. Maintained Playwright configuration now lives at the repository root; optional production/development splitting preserves the single existing Vite-only storage-adapter case. Direct development-only Node typings support this configuration.

Source/test/config snapshot: 115 files, aggregate SHA-256 `92355d21e2642beb21f2f4ac52066ba2536ce3857876c1ac9bae39d07ae59e95`, relative to `cf469857`. Typecheck passed after installing the missing direct Node types; production build passed in 79 seconds. Nine focused Chrome cases passed on the compiled product: four former comparison URLs create/save/reload real workspaces, plus five existing panel/composition/focus regressions. SSR returns HTTP 200 and the real local-workspace loading shell; the welcome appears after client storage initialization. Browser bundles have no retired comparison/debug signatures. Independent technical and domain/spec inspections found the orphaned `StatePeek.vue`; it was removed and both reviewers verified closure, with no further source findings. Final broad runtime acceptance is recorded separately below.

The before-cleanup measurement uses the unchanged compiled `cf469857` output (99 compiled-file hashes verified before retiring its old manifest), Node 24.18.1 and Chrome 155.0.8059.85. Both isolated contexts use `tests/fixtures/workspace-data-campaign-baseline.json` through the public import flow: 2 systems, 6 objects, 2 Orbits, 1 route and 1 custom field. Desktop is 1440×900/light; compact is 390×844/dark. Overlay, zoom and pan measurements take three samples per action; startup is a single observation per context. Raw transient output is outside the repository. Accepted B/Dock reference captures were taken from that compiled build at comparable dark desktop/compact viewports before rebuilding. No old-main or isolated Nuxt UI cost arm is available.

### Final production performance

The final fixture SHA-256 is `4683261fd887443a32fda9d8a7e689b44df92387f772626f470c3566d50e9006`. Final source identity is `dffc2758b06bc01dec926c61e5e9637efd3d128d6b2ba4ad01e004bbd804e8d2` (115 files); compiled identity is `bc0d7a33a3546c23d12e8b6cc9f49099feb1073a7898a861cc2092cf0d039651` (81 application/runtime files). Final build passed in 72 seconds after the copy correction.

| Initial decoded bytes, both contexts | Before | Final |
| --- | ---: | ---: |
| JavaScript | 1,237,498 | 1,094,337 |
| CSS | 345,800 | 275,978 |
| Combined | 1,583,298 | 1,370,315 |

Combined initial JS/CSS decreased by 212,983 bytes (13.5%). Neither arm loads deferred JS/CSS when first opening the sampled features. These are measured complete-product resources, not an estimate of Nuxt UI's isolated cost.

| Median action milliseconds (3 samples) | Desktop before → final | Compact before → final |
| --- | ---: | ---: |
| Inspect open | 66.06 → 66.95 | 83.25 → 66.66 |
| Hierarchy open | 66.77 → 66.71 | 83.53 → 66.84 |
| Map files open | 83.39 → 83.85 | 83.62 → 83.43 |
| Fields open | 66.77 → 70.86 | 83.39 → 67.68 |
| Close actions, range | 66.71–583.97 → 66.72–584.38 | 83.40–551.44 → 66.70–568.04 |
| Zoom +/−, range | 66.70–83.58 → 67.72–82.55 | 83.56–83.62 → 66.70–67.52 |
| Fit | 66.66 → 66.48 | 66.71 → 66.82 |
| Pan | 117.54 → 117.01 | 67.11 → 67.08 |

Startup observations vary materially: welcome/map-mount were 217.9/247.25 ms before versus 242.2/361.43 ms final on desktop, and 214.8/242.85 versus 162.1/180.65 ms compact. An initial post-cleanup observation was slower (851.7/813.84 ms desktop; 408.1/432.52 ms compact); a bounded repeat after the copy-only rebuild returned the figures above, with stable interaction medians and no production runtime errors. Full route wall time also varied (527.21 → 1,581.93 ms desktop; 520.38 → 386.22 ms compact). These single startup samples include browser/action scheduling, do not isolate a causal regression, and establish no general latency improvement or numerical acceptance budget. The resource reduction is reproducible; startup benchmarking remains observational.

Preserve real persisted workspace, B/Dock composition, maximum Nuxt UI use, supported data shapes, IndexedDB `ttrpg-cluster-control`, marker `ttrpg-cluster-control-map`, schema/version, drafts, recovery and exports. Reconcile B1–B10 with actual final tests and compiled-browser evidence. Distinguish failed broad runs from attributed targeted corrections.

Measure comparable production initial/deferred JS/CSS/resources, startup/map mount, overlays and pan/zoom after removing comparisons; disclose missing arms and avoid invented budgets or library-only cost claims. Final Astra scope covers the whole interface and desktop/mobile workflows, including selection/data editing, view-only pan, moving entities, creation, hierarchy, inspectors, Fields and file actions. Foundry VTT is a conceptual reference, not extra feature scope.

Physical Android Chrome OS-keyboard/safe-area/two-finger and screen-reader validation is currently unavailable unless actually performed. Simulated touch/compact viewports are not physical proof. Earlier prototype reviews and historical phone observations do not certify this product.

### Integrated acceptance map

Final full suite: **194/194 passed in 11.7 minutes**, one worker, zero retries, skipped, unexpected or flaky cases, and no report errors. This is the single complete run on the final frozen candidate: 193 cases on compiled production at `http://127.0.0.1:3180/`, plus the one existing Vite-only IndexedDB adapter case on development at port 3100. All 115 source/test/config and 81 compiled-file hashes remained unchanged throughout. No focused correction or second full run was needed. Typecheck and final production build pass; SSR returns the real loading shell and the only page is `index.vue`. No retired comparison signatures remain in emitted browser or application-server code.

This result applies to these families; file names below are test ownership, not separate pass claims.

| Family | Maintained coverage |
| --- | --- |
| B1 — complete/resumed workflow | `production-entry`, `workspace-launch`, `workspace-data`, `workspace-ui` |
| B2 — tools and creation lifetime | `workspace-navigation`, `workspace-system-creation`, `workspace-cluster-construction`, `workspace-add-route-targeting` |
| B3 — cancellation/takeover | `workspace-touch-takeover`, `workspace-cluster-gesture-takeover`, `workspace-system-gesture-arbitration`, `workspace-map-gesture-guards` |
| B4 — presentation-independent drafts | `workspace-chart-drafts`, `workspace-entity-sessions`, `workspace-panels`, `workspace-fields-lifecycle` |
| B5 — authority/conflicts | `workspace-object-placement-guards`, `workspace-entity-inspector`, `workspace-orbit-placement`, `workspace-system-manipulation` |
| B6 — Fields/destructive review | `workspace-field-types`, `workspace-fields-lifecycle`, `workspace-reviewed-deletions`, `workspace-reviewed-imports`, `workspace-change-reviews-responsive` |
| B7 — Apply/save failure/latest Retry | `workspace-chart-feedback`, `workspace-chart-drafts`, `workspace-entity-sessions`, `workspace-fields-lifecycle` |
| B8 — load/backup recovery | `workspace-recovery`, `workspace-data` |
| B9 — theme/resources/responsive access | `workspace-theme`, `workspace-composition`, `workspace-panels`, `workspace-fields-lifecycle` |
| B10 — complete applied image export | `workspace-image-exports`, `workspace-data` |

Keyboard/focus checks exercise browser focus and accessibility attributes. They do not establish screen-reader speech or physical OS behavior. Earlier ticket 27/28 full runs and focused corrections remain explicitly distinguished in their resolutions; this new final run stands on its own.

### Final independent Astra interface review

Astra inspected the approved references and actual compiled product at 1440×900, 390×844 and 844×390, then exercised public workspace creation/import, object/Orbit inspection, hidden drafts, theme/reflow, invalid-name correction, compact Fields, navigation, entity movement, repeated creation and a real JSON download. No blocking defect was found. The B/Dock structure and substantial Nuxt UI use are retained; custom map/session/gesture behavior has justified responsibilities. Tools distinguish Select/data editing, Navigate/view pan and direct system entry, Move/entity movement, and persistent Add; the requested Foundry comparison is conceptual, not an extra feature requirement.

One confirmed P3 copy defect referenced the former “Add Object” label in the hierarchy. Luna corrected it to the actual Add → Add Orbit placement/drag flow; the final build includes that correction. Astra's optional suggestion to place the existing object/Orbit Edit entry near the heading is retained as a future usability improvement, without silently reopening the accepted explicit-edit workflow. Exhaustive numeric contrast, every failure scenario, screen-reader speech and physical device behavior were not certified by this bounded review; the maintained suite and explicit limits remain separate.
