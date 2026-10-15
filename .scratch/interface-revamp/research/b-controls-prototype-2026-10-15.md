# Focused B control-presentation prototype

## Scope and provenance

This exploration supports [Decide readable control grouping and accessible operation labels within B](../tickets/12-decide-controls-presentation.md). The human explicitly requested a targeted prototype iteration and an implementation subagent. SOL 6.1 High owns analysis; Luna XHIGH subagents own the prototype changes. The accepted B direction and the human-resolved [tools contract](../tickets/11-finalize-tools-contract.md) are the inputs, not new questions to vote on.

The parent refreshed origin before the work. The intentionally different preview branch was `codex/interface-revamp` at `19755c750560723429555a9a92c55a554dbd6360`, matching its remote and 0 main-only / 8 branch-only against `origin/main` at `629d2a98715c3a16b954e0f77c639b1f0c31212c`. Issue 3 remains open and unchanged, with no comments. Existing decision artifacts and unrelated local files were preserved.

## Candidates

- `/?variant=B&controls=groups`: grouped Navigate / Select / Move controls, a separate Add entry, Hierarchy / Inspect, and directly visible file commands. Narrow portrait uses two rows for map controls.
- `/?variant=B&controls=dock`: a mode dock with a distinct Add group, paired panel controls in the header, and a Map files menu. The extra menu step is a candidate, not a human-approved decision.

Both use the same seeded, memory-only workspace and interaction code. The development presentation switch preserves in-memory context; opening a shareable URL or reloading starts a fresh seed. The prototype does not modify saved IndexedDB workspaces. Fields and inspector form redesign remain separate pending decisions.

## Static review

SOL reviewed the root-source diff against the closed tools contract. Two concrete findings were corrected: Escape must defer to the open native Fields dialog, and a system in Select must announce inspection rather than opening its map. The review found no other concrete blocker within this scope; it was not browser or physical-device validation.

## Executed validation

The final isolated production build and TypeScript check passed. The dependency runtime is `preview-build/`; runnable source remains at the repository root. A normal Windows production build reached client/SSR success but failed at Nitro packaging with the known `EPERM realpath node_modules/vue/index.mjs`. The same build with elevated filesystem access succeeded without configuration or dependency changes. An earlier build was deliberately interrupted after a Select-drag release guard was added; it is not counted as a successful validation. Intermediate builds and diagnostic failures precede the final corrected artifact; the final build completed in 2m20s and was served on the owned port 3131, then stopped.

The first targeted browser sweep found header overlap in short landscape and a post-creation toast covering zoom. Both were corrected. Add feedback now appears with its type, instructions and route progress instead of hiding refusal explanations; other feedback remains available when that surface is hidden. A later menu check found Share covered by zoom in short landscape; the Dock Map files popup now uses two columns there, and all four actions pass center hit tests.

The final [QA report](../device-preservation-lab/artifacts/resolved-tools-2026-10-15/qa-report.json) contains **9 successful cases and zero browser errors**, executed by [the focused harness](../device-preservation-lab/qa-resolved-tools.mjs):

- Both presentations at 390×844 and 844×390: visible control bounds/hit targets, one zoom group, toast clearance and exclusive full-screen mobile panels.
- Select drag-pan from a system without opening Inspect, followed by a distinct activation that opens Inspect, in both presentations.
- Two Add System placements without leaving the cluster or opening Inspect, with visible invalid-target feedback; two Add Star placements without opening Inspect.
- Right-button and CDP two-contact view navigation retaining a chosen route origin without adding a route; Escape closes Fields before a later Escape cancels unfinished Add.

The [menu survey](../device-preservation-lab/artifacts/resolved-tools-2026-10-15/layout-overlap-survey.json), produced by [the diagnostic script](../device-preservation-lab/inspect-resolved-controls.mjs), records bounds, action hit tests and trigger-close restoration for Add and Map files. The open Dock Add popup temporarily covers part of zoom in portrait and crosses the dock top by approximately 2.4 px in short landscape. Its actions and trigger remain accessible, and closing restores the controls; these are transient popup states, not permanent control obstruction. The Map files actions are visible and hit-testable after the two-column correction.

The parent independently verified that all six application source files match the built copy; full SHA-256 values are in the [source manifest](../device-preservation-lab/artifacts/resolved-tools-2026-10-15/source-manifest.json). Final screenshots are in that artifact directory. A panel assertion initially measured an unfinished animation, and closed native-details descendants required a visibility-filter correction; neither harness issue was a product fix. The full suite passed after these corrections.

The checks use viewport-emulated Chrome and synthetic CDP touch input, not physical hardware. They do not prove complete serialized-model equality, every menu action's outcome, 390×500 layout, virtual-keyboard behavior, all exports or production storage preservation.

## Published artifact and connected-browser spot check

Application source and bounded evidence were published as `1666b008b41439360bbef80d35735c7f72620c4f` on the existing draft [PR 28](https://github.com/Submoon/ttrpg-cluster-control/pull/28). Its exact-commit Vercel status was SUCCESS: [deployment](https://vercel.com/submoon/ttrpg-cluster-control/Gz58P3bM7ioUdeAMouJp1BtRaWDQ). Compare [Grouped rail](https://ttrpg-cluster-control-git-codex-interface-revamp-submoon.vercel.app/?variant=B&controls=groups) and [Mode dock](https://ttrpg-cluster-control-git-codex-interface-revamp-submoon.vercel.app/?variant=B&controls=dock). A later documentation-only checkpoint does not change these six application-source hashes.

The parent used a fresh tab in the authenticated in-app browser, preserving the user's original tab. On the published Grouped rail, Select changed system names to inspection actions and opened Vela's metadata Inspector while the cluster map remained active. After hiding Inspect, Navigate entered Vela without opening Inspect; Back returned to the cluster. Both control presentations rendered in the normal desktop-size browser.

At the requested 390×844 viewport, Dock Inspect settled at `(0,0)` with height 844 and layout width 375 (the browser retained a 15 px scrollbar gutter); dock and zoom computed to `display:none`. Hiding Inspect and opening Hierarchy left only Hierarchy visible. At requested 844×390, all four open Map files action centers hit their buttons, including Share; closing the disclosure restored the map controls. Temporary viewport overrides were reset afterward and the new Dock preview tab was left open for review. These bounded checks supplement the local QA; they are not a physical-device or keyboard acceptance claim.

## Pending human decisions and limits

The presentation ticket remains in progress. [Final focused prototype validation](../tickets/15-prototype-resolved-tools-contract.md) remains blocked until the human selects a presentation. The device/preservation investigation remains in progress, and final Nuxt UI adoption requires its own later human decision. No map closure, source-issue closure, merge, production implementation, exhaustive export coverage or physical-phone acceptance follows from this exploration.
