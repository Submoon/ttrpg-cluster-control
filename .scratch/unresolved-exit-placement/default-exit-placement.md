---
title: Place automatic unresolved-exit targets near their origin
status: closed
closed_on: 2026-10-28
---

# Place automatic unresolved-exit targets near their origin

After inspecting PR #31's preview on 2026-10-28, the user authorized replacing the historical fixed-right automatic target placement with placement near the originating system, separating that system's unresolved exits. This explicitly supersedes the earlier requirement to retain the old automatic calculation. Saved manual targets remain absolute and unchanged.

## Baseline and ownership

- Fetched origin before the change. Main and origin/main remain at `9edfa66c4f505d56f106fc4af8245f200abfba78` and need no fast-forward.
- Actual change baseline: `dc1be86f128e0f51caa42b113d09366e6477afd7` on `codex/map-positioning`, eight commits ahead and none behind origin/main. This intentionally includes the completed six-ticket implementation.
- Existing [PR #31](https://github.com/Submoon/ttrpg-cluster-control/pull/31) remains linked to issue #27. Updating that PR and its preview is authorized by the ongoing publication request.
- Coordinator owns integration, Git and runtime. The architect supplied the shared geometry contract before implementation. The near-origin developer owned geometry and its render/export/validation/controller callers and regressions; a second developer owned only the failing Orbit test. Neither modified the other's files. Architecture advice and independent review were read-only.
- Preserve unrelated environment files and other worktrees.

## Accepted behavior and verification

- Unsaved targets start near their origin and follow automatic origin previews/moves. Separate unresolved exits by originating system, including routes from different Jump Points in that system.
- Saved manual targets and explicit target previews retain priority. No persistence migration or automatic rewrite of workspace data.
- Live geometry, initial Move preview, export and numerical admission use the same default calculation. No global collision solver or new positioning form.
- Reuse the approved pure geometry/validation seams and public unresolved-target journeys for RED/GREEN coverage, then lint/typecheck and affected tests. Reuse unchanged broad evidence; CI supplies fresh integrated checks and production build for the updated PR.
- The existing head's GitHub browser shard 1 passed 116 cases and failed one elliptical-Orbit resize assertion: expected horizontal radius 400 ±3, observed 404 at 55 percent zoom. Other shard and checks passed. The old oracle assumed an ideal fractional pointer while the browser delivered integer CSS pixels. The correction captures the specific Orbit's geometry and transforms before the gesture, measures delivered mouse events, enforces nearest-pixel accuracy and checks the resulting scale without weakening aspect-ratio, occupant-angle or interchange assertions. Observers unregister after the gesture.

## Verification and review

- New pure behavior assertions failed with the historical fixed-right fallback, then passed after the shared source-relative calculation. All 16 focused geometry, zoom, target validation, persistence and interchange checks passed (`test-results/near-exit-pure/report.json`).
- Automatic slots are grouped by originating system across Jump Points, including manually positioned unresolved siblings. Rows are 0, +64, -64, +128 and -128 scene units; each five-slot column starts 180 scene units farther right. Temporary target overrides win over saved absolute targets, which win over the automatic point. Source previews affect only automatic points.
- Typecheck caught two test-only integration errors (a duplicate variable name and a resolved-route fixture carrying an unresolved-only field); both were corrected. Final lint and typecheck passed. No production workaround or type suppression was introduced.
- Independent Standards and Spec review inspected the frozen diff and relevant callers, including the pointer-measurement correction. Both axes closed with zero blocking findings and inspected the final observer/input correction again without finding a new blocker.
- The focused browser batch passed all eight Cluster placement, distant recovery and image-export journeys (`test-results/near-exit-browser/report.json`). The Orbit test's first observer could not see release because D3 consumes it at window capture before document capture. The corrected observer runs at window capture and the test drives explicitly rounded CSS-pixel points. The full elliptical-Orbit journey then passed separately, including resize, occupant angles, save, export/import and append (`test-results/near-exit-orbit-recheck/report.json`, 1/1). The eight successful journeys remain valid for unchanged production source; no clean second nine-case run is claimed.
- Final lint and typecheck passed after the observer/input correction. No additional complete local suite or production build was run for this localized geometry/test follow-up; the updated PR triggers the existing integrated CI and Vercel checks.

## Resolution

Implemented the authorized near-origin automatic placement across live rendering, source previews, initial Move preview, committed export and numerical validation. Existing manual positions remain absolute and unchanged; no data migration or new persistence writer is introduced. The approved specification now records this explicit amendment to the old default-placement contract.

Completed locally on 2026-10-28 with 16 passing focused pure checks, eight passing affected Cluster browser journeys, the corrected Orbit journey passing separately, final lint/typecheck and independent review closure. The result is committed and published through existing PR #31; GitHub issue #27 remains open until the PR is merged. The new head's integrated CI result is tracked on the PR rather than represented as a completed local full-suite rerun. No merge was performed; unrelated environment files and other worktrees remain untouched.

## Compact spacing follow-up

The user reviewed the 180-unit default and requested a clearly closer target while retaining some visible space from the system's name/count rectangle. The refreshed baseline is `236d294ced1918ffe9efb90ffae38b64326ed4d2` on `codex/map-positioning`, nine commits ahead and none behind origin/main at `9edfa66c4f505d56f106fc4af8245f200abfba78`. Origin was fetched again; main needs no fast-forward.

The accepted implementation target is a 135-unit first-column offset from the source center: the 78-unit card half-width and 7-unit marker radius leave a 50-unit visible gap, compared with the previous 95. Keep the published per-system sibling rows (0, +64, -64, +128, -128), column spacing and manually chosen marker positions. The Jump-level badge sits to the endpoint's right; the unknown caption remains end-anchored to its left and is offset vertically away from the source card. The same route-local geometry applies to automatic, previewed and saved points. Known-destination route labels keep their current path layout.

The previous head's CI passed checks, shard 2 and the corrected Orbit journey, but shard 1 exposed minimum-zoom unresolved-target selection failing at the existing 20-CSS-pixel offset click. The coordinator reproduced that exact public test failure locally before source changes (`test-results/compact-exit-hit-red/report.json`). Retain this test and the existing hit area; verify it with the new compact presentation rather than weaken its expectation.

Use pure geometry/validation RED/GREEN checks and actual rendered card/marker/label bounds in the public placement journey, including a screenshot and unchanged layout through preview/confirm. Implementation and local verification of this follow-up are completed on 2026-10-28, with the evidence below.

Independent numerical review identified a compatibility defect in applying rightward captions to every extreme scene: a saved target at the renderer limit minus 600 with an 80-character name was valid at the published baseline, but the new caption could make restoration reject the unchanged workspace. A proposed scene-wide fallback was rejected during Spec review because moving one target far away changed unrelated automatic targets and their labels. It was not published.

The reassessed design uses no scene-wide presentation mode. Numeric admission validates effective system/endpoint anchor bounds with the existing 256-unit support margin and independently validates actual feature bounds with the exporter's 24-unit margin. The exact 236d layout remains compatibility evidence, not a runtime gate: treating an unchanged automatic point as a newly saved point must not change admission. The maximum valid Jump-level badge is 214 units wide, so its 14-unit endpoint offset plus export padding is 252, inside the former 256-unit allowance. Automatic points shift 45 units left, and unchanged-width captions shift by at most 45 horizontally and 78 vertically; their rendered bounds remain within the baseline allowance. Finite-coordinate, aggregate-span and ownership checks still apply. No canvas clamp, data migration or validation bypass is introduced.

The ordinary compact candidate passed the unchanged minimum-zoom offset selection regression. Its first visual-gap check exposed use of a newer matrix method unavailable on the browser's SVG matrix; the corrected test uses the established DOMPoint matrix-conversion pattern. The final public journey passes with actual rendered bounds.

The actual minimum-zoom screenshot also showed a rightward caption entering the neighboring Harrow card. Keep the agreed first marker point and the caption's end anchor at endpoint X minus 10; move its baseline 54 units above the endpoint when the endpoint is above its source, otherwise 54 units below. The badge stays to the right, so adjacent 64-unit rows do not collide in horizontal space. This clears the observed cards without a collision solver or changing untouched target positions.

## Compact spacing verification

- The final implementation has no scene-wide layout switch. A regression moves one saved target far away and compares the untouched automatic route's complete geometry before and after; both its point and labels stay unchanged.
- The final focused pure run passed 24/24, covering geometry, neighboring rows, source previews, manually saved positions, numeric limits, legacy restoration, zero-displacement save, zoom and interchange (`test-results/compact-exit-local-pure/report.json`). The zero-save test explicitly removes its fixture's pre-existing remote manual target before exercising the automatic route; direct validation and restoration now test the same scene.
- Independent Standards/Spec and complementary numerical/persistence reviewers inspected the corrected frozen diff and closed both confirmed P2 findings. The automatic-to-preview test captures its initial geometry before starting Move, so that boundary is observed rather than compared twice in the same state.
- Final lint and typecheck passed on the corrected source. Typecheck was also confirmed in an isolated run after restarting the dedicated development runtime; no production build or full local suite was repeated for this follow-up.
- The final affected browser batch passed 10/11 (`test-results/compact-exit-local-browser/report.json`). Its first compact two-contact journey timed out waiting for the initial workspace form before exercising geometry. The unchanged journey then passed on an isolated recheck (`test-results/compact-exit-gesture-recheck/report.json`, 1/1). No assertion, timeout or retry setting was weakened; this is not a clean second eleven-case run.
- Passing public evidence covers the retained minimum-zoom offset hit target, the measured 40–60 scene-unit visible gap, label/card separation, unchanged automatic-to-preview-to-saved geometry, gesture cancellation, distant recovery and full-scene SVG/PNG export in the three palettes, including export during a held system preview.
- Actual rendered detail and full-map screenshots are saved in ignored runtime artifacts at `test-results/compact-exit-detail.png` and `test-results/unresolved-exit-near-source.png`. The coordinator inspected the visible gap and legible caption. Browser evidence remains viewport/input emulation, not physical-device or screen-reader certification.

## Compact spacing resolution

The default first target is now 135 scene units from the system center, leaving approximately 50 units after the card and marker edges instead of 95. Original sibling spacing and manual marker coordinates remain unchanged. Badge and caption placement is route-local and stable through a zero-displacement Move; moving any other exit cannot change it. Separate anchor/feature safety envelopes preserve previously valid saved scenes and identical-point saving without introducing a scene-wide layout switch.

The coordinated implementation and confirmed review corrections are complete locally and are published through the same PR #31. Fresh integrated CI and Vercel deployment are triggered by its updated head; no new clean local full-suite run is implied. No merge, issue closure, dependency installation or unrelated-worktree change was performed.
