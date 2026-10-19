# Ticket 18 resumed final QA

**Launch/recovery passes its bounded final compiled checks. The repository suite is not green.** No loaded-map fidelity or physical-device pass is claimed.

Baseline `28278d90c462fcc0542088513ebd8cf07c7eeaa4` intentionally differs from `origin/main = 629d2a98715c3a16b954e0f77c639b1f0c31212c`. Initial candidate `86b5ab64fcaf0e477faabe25fd8ccaf0030e88cf` received the sole whole-suite attempt. Final candidate is `06997ef73fe9f722f458f491b50dafab32d9c6a7`, adding only a scoped opaque focus-color correction. The six pre-existing modified test/helper files remained byte-identical; suite evidence includes that preserved working tree, not a clean-commit assertion.

| Gate | Status |
| --- | --- |
| Whole repository, development, one worker, `maxFailures=1` | 93 discovered; **0 passed, 1 failed, 92 not run**; no repeat |
| Developer focused development evidence before CSS-only focus correction | 9/9, including the development-module atomic-save regression; typecheck exit 0 |
| Initial build and real compiled focus RED | Build passed in 1m17s; Create focus contrast **1.4566054854:1**, below 3 |
| Necessary corrected build | Passed in 1m38s; source hashes unchanged across build and final QA |
| Final actual compiled launch/recovery files | **8/8 passed in 9.6s**; excludes only the dev-module import storage case |
| Compiled presentation | Four viewports × both themes passed; no application page errors or console warnings/errors |
| Final preservation and cleanup | All six pre-existing hashes match; owned servers stopped; ports 3100 and 3180 free |

The sole full-suite failure is `tests/cluster-map.spec.ts:78`: the restored Jump Cluster locator's `Open Vesper system map` node was absent while checking its previous drag transform. The error context displays the Vesper **system** map. Its exact cause is **unclassified**; there was no baseline reproduction proving it pre-existing, and no repair or repeated broad suite was undertaken in ticket 18. This prevents a repository-wide preservation claim.

Compiled presentation verified HTTP 200 SSR loading without editable creation data, client hydration to the real welcome, native required-field focus, retained entered names through theme changes, ordinary keyboard focus and hit-tested actions, touch-emulated recovery actions, explicit missing-backup feedback and no horizontal overflow at 1440×900, 390×844, 844×390 and 390×500. Existing compiled tests own create/save/reload, invalid current, failed/successful atomic restore, missing/damaged backup and transient opening failure; the presentation helper does not repeat those complete journeys.

Actual rendered-background samples on desktop measured input, Create, recovery action and error text in both themes. Text minima are **5.7401:1**, control boundaries/fills **5.5869:1**, and focused input/Create/recovery outlines **6.1266:1**, all exceeding the unrounded 4.5/3/3 thresholds. The initial focus RED caused the narrowly scoped opaque-token correction. Two helper setup errors were corrected without application changes: initially valid default names needed clearing before required-field validation, and native selected text needed ordinary ArrowRight before comparing unselected text colors. Neither is classified as a product failure or counted as a passing test.

Runtime: installed Chrome **155.0.8059.80**, headless, isolated contexts, device scale 1; reduced motion requested; desktop keyboard/mouse and compact keyboard/touch emulation. Product route `/`, compiled `.output/server/index.mjs`, loopback port 3180. Final Welcome SHA256 is `C9D9209BBAEA340B2080E9F2441AFD19ADF87D37E99749667BCF163CA2A05707`. Compiled Welcome style module is `WorkspaceWelcome-styles.BqNHsSRF.mjs`, SHA256 `3152889FA9D8A49C31383EBEB2CAB93F3722A31F578E0F8A2647B9B9CC148B91`; full source/runtime hashes are in the manifest references. The handed-over development tree 36912/53364, initial compiled PID 48364 and final compiled PID 23916 were identified before termination. Build dependency deprecation warnings are separate from the zero browser application warnings.

## Visual assessment and limits

Independent QA inspected the two final compiled PNGs and canonical tracked B/Dock reference. The restrained framed brand/header, serif identity, small labels, readable form and explicit recovery feedback fit the applicable reference language. Shared palette and Nuxt UI details differ. Prototype B starts with seeded map data and has **no matching welcome/loading/recovery form**; its historical map image cannot establish a paired launch or whole-map fidelity pass. The developer's four before/after pairs are retained, and the coordinator inspected all four final images; they were not recaptured as a second full screenshot set.

Top Dock, fixed map columns and dense loaded header remain ticket 21. Historical Orbit-resize/unresolved-exit concerns remain outside ticket 18. Physical Android Chrome keyboard, safe-area and physical gesture checks are **unavailable**; viewport/touch emulation supplies no physical proof. Contrast is a sample of the changed launch controls/error/focus, not an application-wide or SVG audit. Historical totals are not combined with this candidate's results.

## Curated evidence

[`evidence-manifest.json`](evidence-manifest.json) contains only referenced evidence with exact paths and SHA256s: final structured results, source/compiled/process identity and cleanup, real focus RED, full-suite result/error context, two compiled PNGs, developer handoff/capture reports and four image pairs, canonical B reference, and reproducible final configs/helper. Raw logs, abandoned helper attempts and generated test artifact directories are excluded from the curated manifest.
