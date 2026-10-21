# Move host ghost-target regression

Baseline: `e3d546e3f529304a711a3d1d6a09b249df49ae14`, equal to the fetched feature remote; origin/main remains `629d2a98715c3a16b954e0f77c639b1f0c31212c` (0 main-only / 50 feature-only).

The single new public native-drag test fails against that unchanged compiled baseline: Primary Star stays 103.923 scene-X units away from the pointer when crossing its hosted Orbit's original ellipse. The actual carried ring should move with it. `baseline-red-results.json` records this meaningful failure.

The correction excludes carried-host Orbits from one shared pointer-target helper for command checks, preview and release. It keeps full-system geometry/validation, applied positions for stationary targets, dependency guards, ambiguity and explicit numeric cycle checks. A renderer-scoped cache holds only carried Orbit IDs. No data format, component appearance or application API changes.

The old self-ring pointer test deliberately expected the ghost freeze. Its revised assertions require raw free motion with nested dependents. The precise Placement test additionally verifies self/descendant destinations are not offered while valid stationary destinations remain available. The new Primary Star test checks the held crossing, following branch, commit JSON and durable reload.

Focused development-server verification passes **14/14 in 2.0 minutes**, one worker, zero retries and original deadlines: the complete manipulation file, gesture-guard file, legacy hosted-object drag and palette/keyboard-add cases. Typecheck and production build pass (build 1m17s). The two reviewed source fingerprints match after verification. Independent SOL 6.1 High technical and domain/data reviews report no blockers; Luna XHIGH implemented the correction.

The earlier complete 161/161 result in the parent folder predates this follow-up. A new complete suite and physical-device checks were not run. Scope is intentionally focused on this defect and its adjacent risks. Task-owned development/baseline servers were stopped. Archived logs only normalize trailing whitespace; original host-TEMP logs remain intact.
