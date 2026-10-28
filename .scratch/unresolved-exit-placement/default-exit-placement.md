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
