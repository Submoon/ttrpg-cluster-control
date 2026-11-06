---
title: Full-page player reader presentation
status: closed
parent: spec.md
---

# Full-page player reader

On 2026-11-04 the user requested a player interface close to the Warden map workspace: a viewport-filling map, navigation and read-only consultation. The reported screenshot shows the centered standalone reader and an oversized Known type system marker.

## Baseline

Branch `codex/player-view-ticket-01`, PR [#39](https://github.com/Submoon/ttrpg-cluster-control/pull/39), starting HEAD `fee195f6d10d6972728a5cf69f665f073da3ab0a`. Refreshed origin/main remains `47c0418a835da285e9edb88e8f8dffc19c3a2bba`, 20 ahead and zero behind. The separate main checkout is already current. The unrelated untracked `.codex/environments/` remains untouched.

## Agreed presentation boundary

The architect confirmed that `MapEditorLayout`, `WorkspaceResizablePanel` and the header presentation can be reused without mounting GM hydration, commands or persistence. The player workspace consumes only the validated public document. GM-specific Hierarchy, Inspector, search and viewport owners are not reused. Embedded Warden preview remains an embedded consultation.

The direct player route currently misses styles loaded only by `BaselinePage`; load the shared presentation stylesheet globally without loading the editor itself. Keep the current palette and local typography. Replace the centered, height-limited loaded view with a full workspace; retain file admission, safe errors, clean JSON fallback, hash replacement, cancellation and per-tab isolation.

Fit only the live camera to public bounds and measured viewport size, with a maximum fit magnification of one CSS pixel per world unit. Keep exported SVG/PNG geometry unchanged. Verify usable desktop/compact panels, focus, pan/zoom, sparse-marker scale and long public text.

## System opening clarification

The user confirmed through the integrated mechanism on 2026-11-04: keep opening limited to Revealed systems and make this requirement clearer. A Known type child alone does not open its parent. The system publication dialog and Warden chart summary explain the parent gate and independent object settings; the object publication control also identifies its parent prerequisite. No disclosure behavior changes.

## Verification

The maintained desktop regression reproduced the reported width restriction before implementation: at a 1440px viewport the public system map is 1280px wide, failing the required minimum of 1424px. Evidence: `test-results/player-workspace-layout-red-frozen.log`, owned `local-test-2026-11-04T11-10-56-493Z-13904/playwright-run-1`. The preceding launcher was invalidated by an unidentified filesystem event before assertions; it is not counted as the RED.

Implementation, affected reader/link/preview/editor checks, types/lint, production direct-entry evidence and independent review remain pending. Coordinator owns Git, runtime/browser operations and integration; source and test specialists have disjoint ownership.

### Implementation and focused correction record

Local candidate `7c50f673` adds the public workspace presentation, shared header/layout and global presentation stylesheet, DTO-only panels and live fit sizing. `eeff2d14` retains clean-link/file-mode ownership, adapts maintained public-panel journeys and fixes camera-control placement. No source schema, projection, transport format, GM writer or history behavior changed.

Full Nuxt types and full lint passed. The first preparation exposed a duplicate auto-imported type name; the composable's redundant type re-export was removed and regeneration no longer reports it. Full-source incremental types and affected lint passed after correction. Four pure fit/image-bound assertions passed in a frozen owned run (`player-workspace-fit-frozen.log`). An earlier four-assertion pure run was invalidated by concurrent source editing and is not counted as successful qualification.

The expanded browser fixture initially used invalid public object IDs, then an incorrect automatic banner-role assumption for the nested shared header. Those are test setup/locator failures, not application failures; the maintained width RED above remains the original feature reproduction. Fixtures now use admitted `object-N` IDs, generic Known type labels and the actual shared header.

Early captures and native geometry then confirmed the review finding: an in-flow camera-control row pushed SVG bottoms to 915px at a 900px desktop viewport and 665px at a 650px compact viewport. Controls overlapped the floating toolbar. Workspace-only absolute SVG placement and bounded bottom-center controls fix those layout mechanisms while preserving embedded preview DOM and camera ownership. The architect verified the remaining centered space between bounded desktop panels accommodates the controls.

The outer workspace frame is eight pixels per side. Geometry checks now compare the SVG to the real board width and require it to remain below the header and inside the viewport, rather than incorrectly excluding the component border with a guessed width margin. The redundant one-pixel cluster-renderer border is removed only in workspace mode, so its SVG fills the complete board. Captures/measurements: `player-workspace-layout-geometry.log`, `player-workspace-layout-green.log`, `player-workspace-layout-board.log` and their separate owned reports.

The latest two-case run passed frame sizing, theme changes and public inspection before encountering test-harness mismatches: native pointer cancellation suppresses compatibility mouse events, and an inert toolbar is correctly excluded from role queries while a compact dialog is open. The shared native mouse-input helper now supports explicitly observing pointer events while keeping the default mouse observation for existing callers. Compact assertions use the active dialog's controls and retain return-focus assertions. No forced click, increased timeout, retry or relaxed private-data assertion was introduced. These latest changes still need replay.

Independent review found no GM hydration/persistence dependency or disclosure-gate change. Source layout and clean-link findings were addressed. Its remaining pre-hydration test mismatch is corrected by checking the visible file action's readiness while retaining the hidden input's disabled/enabled and real-loading assertions. Final review closure and production build remain pending.

### Qualified presentation candidate

Application candidate `8a525c038e9e7975c7684ce323a5ca961da0d70b` passed **21/21** selected browser regressions in six minutes, without retries or deadline changes. This covers all standalone file-reader journeys, all compressed-link journeys, the two new desktop/compact workspace scenarios, shared Warden responsive/focus checks, painted Search/deep-Hierarchy smoke checks, and publication/preview/legacy-import/long-label cases. Evidence: `player-workspace-regressions.log`, owned `local-test-2026-11-04T12-12-42-803Z-40172/playwright-run-1/results.json`.

Desktop pointer panning also passed with measured native delivery, and the existing direct-drag Warden scenario passed using the unchanged default mouse-event observation (`player-workspace-navigation.log`). Root inspected the readable desktop system view, dark cluster view and compact scrolled Inspector screenshots. Controls are reachable, markers have a bounded fit scale, and the actual SVG fills the framed board without clipping.

Review identified that closing the compact Inspector before an older long-prose width assertion weakened that exact regression. The original assertion remains, and the scenario now reopens the Inspector, verifies the complete **13,000-character** public text and measures width while the panel is visible. The affected case passed separately in six seconds (`player-workspace-prose-visible.log`, owned `local-test-2026-11-04T12-23-25-048Z-20352`). This final change affects only the test; application source remains identical to 8a525c03.

Production evidence is supplied by exact-candidate CI rather than another local build: [checks job 126567645547](https://github.com/Submoon/ttrpg-cluster-control/actions/runs/41827992582/job/126567645547) for 8a525c03 completed Markdown validation, lint, typecheck, production Build, and pure/development-storage checks successfully. The Vercel build and immutable-preview smoke check also succeeded. Both full browser shards are still running at this record update; no complete green suite is claimed. The final test/documentation push must retain conservative CI qualification.

### Delivery and limits

The player workspace is implemented on PR #39, with no source-format, disclosure-policy or GM-data change. The user reaffirmed the system-level Revealed gate; anonymous Known type system exploration is not requested. Existing Known type snapshots still omit their internal maps. Mark the parent system Revealed and generate a new snapshot to consult its published objects.

Review corrections have no remaining code findings; focused runtime evidence is recorded above. Full CI status remains a publication check to follow on the PR. The PR stays a draft, and no merge or source-issue closure is performed. The pre-existing `.codex/environments/` is untouched.

### Confirmed opening guidance

The copy-only clarification starts from `0335b1193f8a7e724f30aecce7b43087c5972dd8`; refreshed origin/main remains `47c0418a835da285e9edb88e8f8dffc19c3a2bba`, 24 ahead and zero behind. Help text appears beside both publication controls and in the Warden chart summary. The existing player hierarchy already explains that a Known type system's internal map is not shared. No model, projection, migration or navigation command changes are needed. Relevant existing browser journeys, lint and types qualify the wording and compact layout; no new test is added for static text.

## Resolution

The full-page read-only presentation and requested publication guidance are implemented. The user reaffirmed the existing opening rule; no product-choice question remains pending. The clarification passed affected lint, full-source incremental types, Markdown links, and two existing publication browser journeys covering system and object modes on desktop/compact views (**2/2**, 34.4 seconds, zero retries). Evidence: `player-gate-guidance-ui.log`, owned `local-test-2026-11-04T13-34-24-366Z-34584/playwright-run-1`.

Presentation qualification remains the 21/21 browser matrix, pure checks, targeted prose replay and production evidence recorded above. Complete CI remains the PR's publication gate; local closure does not merge the draft or close GitHub #9.

### Publication dropdown readability

Starting from `d4b97a693ba573f96ddb0d0da28e71c0374fbdab`, refreshed origin/main remains `47c0418a835da285e9edb88e8f8dffc19c3a2bba` (25 ahead, zero behind). A new desktop/compact regression measures actual text clipping, reproducing the truncated Unknown presence option before the fix (`publication-readability-red.log`). Both system and object controls now use their available width, permit wrapping in the popup and place the selected-mode explanation below the control rather than beside the heading.

Desktop passed in `publication-readability-green.log`. Its compact case reached the menu successfully but exposed a test setup error: the compact Inspector was still open before using Add. Closing it through its normal public control fixed the setup; the affected compact case passed in `publication-readability-compact.log`, owned `local-test-2026-11-04T14-07-10-612Z-42808`. Source lint and full-source incremental types passed; screenshots retain the complete labels. No publication semantics changed.

### Protected Preview qualification correction

CI run `41839789374` for `d4b97a69` completed build/checks/smoke successfully, with two browser failures. The fresh-link recipient omitted Preview authentication; its retained snapshot explicitly shows Log in to Vercel. The corrected harness passes only fixture-provided Preview cookies into its otherwise empty context and asserts HTTP 200, preserving GM storage isolation and all privacy assertions. Targeted lint and independent review passed; protected-Preview replay is pending.

The far-route scenario completed setup and both captures in about five seconds, then waited on the revealed-system marker click until its original 30-second deadline. This is an actionability failure of undetermined cause, rather than demonstrated cumulative setup slowness. No deadline or assertion is relaxed; retain focused replay in final qualification. Evidence is retained under `test-results/pr-d4b-ci-artifacts/` and `pr-d4b-browser-ci-failures.log`.

### Revealed marker hit-area correction

The protected-Preview authentication correction is confirmed by the successful first browser shard of [CI run 41846310480](https://github.com/Submoon/ttrpg-cluster-control/actions/runs/41846310480) for `680ae48c`. Its remaining failure repeatedly resolves the Revealed system group as visible/stable, while its parent SVG intercepts the center click. The visible group combines a circle and text with unpainted space between them.

A minimal public-document regression removes routes, pan and zoom: a native click at the circle/label gap fails to open one Revealed system (`quick-publication-focus-and-hit-red.log`, owned `local-test-2026-11-04T15-08-53-652Z-53824`). The correction measures only the public visual group's actual SVG bounds and fills the interactive group's union with a transparent hit rectangle. The rectangle is outside its own measurement and the DTO-based camera/image bounds; measurement runs on document/mount/activation changes rather than pan frames.

The minimal regression passed in 2.8 seconds, the original far-route journey passed unchanged, and both passed again in the clean integrated matrix. Source types/lint and independent review passed. This explains the later marker actionability failure; it does not retroactively establish the cause of the eight earlier unrelated timing failures. The broader player/Warden presentation correction is tracked in [local ticket 08](tickets/08-player-map-interface-consistency.md) and is required before PR #39 may merge.
