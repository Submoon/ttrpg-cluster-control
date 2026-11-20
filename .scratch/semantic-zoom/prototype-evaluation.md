# Semantic zoom prototype evaluation

## Artifact and question

The throwaway source is retained on `codex/prototype-semantic-zoom`, based on `9ab9cd782abde0968348fcb283079fa9941111a5`. Origin was fetched at the start of the prototype work and matched main. The prototype deliberately stays on that baseline rather than following later changes during evaluation.

Run `npm run prototype:semantic-zoom` and open <http://127.0.0.1:3034/?prototype=semantic-zoom&variant=system>. The prototype branch guide describes the controls and walkthrough. This development-only entry uses in-memory state and does not mount the saved-workspace editor.

The question is whether stable shared geometry makes navigation between systems and nested orbital groups understandable, and which reveal and targeting rules support that navigation. The three URL variants compare whole-system reveal (`system`), orbital-group reveal (`orbit`) and selection-retained context (`focus`). Policy switching preserves camera, selection and scene edits. Thresholds remain hypotheses.

## Fixture composition

| System | Reference objects | Demanding objects |
| --- | --- | --- |
| Helion Reach | 20 | 44 |
| Verdant Reach | 14 | 30 |
| Kestrel Gate | 9 | 26 |
| Morrow's Lantern | 7 | 24 |
| Quiet Frame | 0 | 0 |
| Cinder Fold | — | 21 |
| Nacre Belt | — | 18 |
| Threnody | — | 15 |
| Peregrine | — | 12 |
| Farwatch | — | 10 |
| Total | 50 | 200 |

Stars count as objects. The reference scene contains 16 Orbits and 3 Jump Routes; the demanding scene contains 26 Orbits and the same 3 routes. Both include the five-link orbital example, different system scales, overlapping envelopes, an empty system, free Orbit centers and multiple occupants. Luminous Reach transfers as an eight-object, seven-Orbit hosted branch.

## Interaction evidence

Disposable model and browser probes exercised the prototype on 2026-11-13. They were removed after verification; reports and screenshots remain locally under `test-results/semantic-zoom-prototype-20261113/`.

- 48 model assertions passed across the 5-system/50-object and 10-system/200-object fixtures, covering scene validity, projection, envelope geometry, creation, movement and transfer consequences.
- Seven desktop journeys passed, including policy/camera stability, Focus context removal when switching to Orbit, transfer preview and cancellation, destination-Orbit targeting, editable key collisions, owner-preserving movement and stale owner-choice cancellation. No JavaScript errors or IndexedDB workspace were observed in those journeys.
- A system-name drag translated the independent anchor. Inspector scaling and the visible scale handle both preserved the anchor and used uniform scaling.
- Emulated touch verified that a second contact cancels an uncommitted object edit and begins a pinch. Releasing outside the map did not strand pointer ownership: the next one-finger edit committed, and a subsequent fresh tap cleared selection. The corrected sequence passed with a fresh touchscreen tap and again with the same CDP transport throughout.
- The compact 390 × 844 layout had no horizontal page overflow and retained usable map and Inspector controls. This checks browser layout and input, not physical-device ergonomics.

Early probes exposed real integration defects in input payloads, ambiguous targeting, stale drafts, touch ownership and scale-handle hit testing; those were corrected and the affected journeys repeated. Earlier gesture-probe failures also included an ambiguous overlapping target and inconsistent test setup. The successful final probe uses the isolated Seedling Rock target. The initial failures are retained separately and are not represented as clean first runs.

## Local timing samples

Environment: Windows 10.0.26200, Intel Core i7-1185G7 at 3 GHz, 8 logical CPUs, 32 GiB RAM, Node 24.18.1 and headless Chrome 157.0.8103.78. The prototype was served by Nuxt development mode. Desktop viewport: 1440 × 960. Compact viewport: 390 × 844 with mobile/touch emulation on the same laptop.

Each sample used a short sequence of wheel zooms followed by a pan. Reference samples used the Orbit policy at cluster overview; demanding samples used the System policy focused near Helion Reach. The demanding policy revealed all 200 objects and 26 Orbit rings. The displayed visible count describes reveal state, including geometry outside the viewport.

| Viewport | Scene and policy | Zoom rAF proxy | Zoom p95 / maximum interval | Pan rAF proxy | Last selection proxy | Last wheel idle-frame proxy |
| --- | --- | --- | --- | --- | --- | --- |
| Desktop | 50 objects, Orbit overview | 52 fps | 33.3 / 83.4 ms | 60 fps | Not sampled | 159.3 ms |
| Desktop | 200 objects, System detail | 39 fps | 50.1 / 66.6 ms | 60 fps | 79.0 ms | 166.3 ms |
| Compact emulation | 50 objects, Orbit overview | 60 fps | 16.8 / 16.9 ms | 60 fps | Not sampled | 166.3 ms |
| Compact emulation | 200 objects, System detail | 46 fps | 33.5 / 83.3 ms | 60 fps | 51.3 ms | 166.1 ms |

These are short rolling `requestAnimationFrame` observations, not a rendering benchmark or an input-to-painted-pixel trace. Selection is measured to the next frame after reactive updates. Zoom settling is measured to an idle frame after actual wheel/pinch camera changes and includes the prototype's idle debounce. The compact performance samples still used wheel and mouse-pan input; separate CDP contacts verified pinch behavior. These samples do not establish touch performance on a physical smartphone, trackpad behavior or sustained performance.

The observed idle cadence was approximately 60 Hz; physical display refresh rate was not measured in this headless run. Separate visible-label counts were not captured. Those omissions and the short samples keep this evidence below the complete measurement protocol in ticket 08.

The agreed target remains 60 fps on both devices and both scenes. The prototype does not yet meet that target in the sampled zoom sequences. No sampled interval exceeded 100 ms, but this does not certify the no-freeze requirement. The selection and settling proxies were below their 100 ms and 200 ms targets where sampled; production measurement is still required.

Reports: `model-results.json`, `browser-desktop-results.json`, `compact-gesture-results.json`, `compact-touch-repeat-results.json` and `desktop-observations.json`. Representative screenshots include `desktop-transfer-preview.png`, `desktop-layout-controls.png`, `desktop-200-system.png` and `compact-touch-checked.png`.

## Repository verification

The implementation candidate is `bbe8bd0f7e170e3436fcfb4c0c344043a6496d5d`. Source was frozen for the final checks. The subsequent evaluation-record update changes documentation only.

| Check | Result | Local evidence under `test-results/semantic-zoom-prototype-20261113/` |
| --- | --- | --- |
| `npm run lint` | Passed | `lint-candidate.log` |
| `npm run typecheck` | Passed | `typecheck-candidate.log` |
| `npm run build` | Passed, 5 min 21 s | `build-candidate.log` |
| `npm run test:pure` | 358 passed; reused for unchanged pure-code scope | `pure.log` |
| Development IndexedDB save regression | Passed | `browser-suite.log` |
| Two focused browser journeys against the compiled app | 2 passed | `production-focused.log` |
| Complete browser suite against the compiled app | 99 passed, 0 skipped, 0 flaky, 19.1 min | `production-browser.log`, `production-browser-results.json` |
| `node scripts/ci/check-markdown-links.mjs` | Passed | `markdown-links.log` |

The initial development-server suite was stopped after eight completed cases: six passed, including the development-only storage regression, and two exceeded their 30-second test budget. The retained run is `test-results/local-test-1794589716735-38028-fc42c54b/`. It is not a passing complete development-suite result.

Independent trace review of the occupied-Orbit resize case found 19.09 seconds spent in setup, including a 15.84-second workspace-loader wait. The deadline expired during the second Orbit's Add action; the action and subsequent saved-radius/angle checks completed successfully in the trace. The browser requested the ordinary Baseline page and no semantic-zoom components. This supports a cumulative timing failure, without claiming to have reproduced it on the original baseline.

After rebuilding the exact candidate, the two cases passed without changing tests or deadlines. The complete browser suite then passed against `.output/server/index.mjs` on port 3035, using `PLAYWRIGHT_CHANNEL=chrome`, `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3035` and `npm test -- --project=browser`. Its unique artifact root is recorded in the JSON report. Both maintained preview-smoke journeys are included in that full run. The development-only storage case retains its separate successful evidence. Initial lint/type diagnostics and prototype findings were corrected before the final checks; no permanent prototype tests were added.

Architecture and independent source review were completed, including closure of the input-targeting, gesture-ownership, stale-draft and visible scale-handle findings. The remaining limitations concern the human interaction verdict and performance targets, not an unresolved source-review finding.

## User verdict

The user chose System Envelope and requested much larger system names at distant zoom. That choice is recorded in [the prototype ticket](tickets/03-semantic-zoom-prototype.md). The earlier timing samples describe the original comparison before this visual refinement.

The refinement was checked in Chrome at 1440 × 960 and in touch emulation at 390 × 844. At Fit, all five names in the reference scene and all ten in the demanding scene were reachable and their text bounds did not overlap. The measured overview text sizes were 14–18 px on desktop and 15 px in the compact examples. The checks covered selecting and dragging a name on desktop, revealing detail through Focus, and selecting an overview name by touch. TypeScript and focused lint passed. Screenshots and measurements are in `test-results/semantic-zoom-prototype-20261113/overview-labels/`. Label placement can still overlap if a denser or shorter view runs out of space. Performance was not remeasured for the label refinement.

Player disclosure, final Jump Route presentation, production renderer/command ownership, persistence, compatibility and exports remain in their dependent tickets. The prototype is an interaction study for the Warden surface; it is not the completed three-surface feature.
