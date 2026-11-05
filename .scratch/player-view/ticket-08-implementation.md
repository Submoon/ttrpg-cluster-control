---
title: Player and Warden interface consistency implementation
status: in-progress
parent: tickets/08-player-map-interface-consistency.md
---

# Player and Warden interface consistency

## User direction and baseline

The user clarified on 2026-11-04 that [local ticket 08](tickets/08-player-map-interface-consistency.md) belongs to the current player-view effort and must be resolved in PR #39 before merge. Preserve revelation colors while aligning type glyphs, dashed Orbits, useful inspection, true nested Hierarchy and Back placement. This is implementation work in the existing branch, not deferred follow-up planning.

Start from `98c1c7cbdb36a068a7eb0090f91574ce7264b36b` on `codex/player-view-ticket-01`. Refreshed origin/main is `47c0418a835da285e9edb88e8f8dffc19c3a2bba` (29 ahead, zero behind). The completed quick-publication controls and measured player-marker hit-area correction are included. Preserve unrelated `.codex/environments/`. The coordinator owns Git, runtime/browser sessions and integration; at most two disjoint implementation writers are active.

## Existing data and privacy boundary

The public DTO already carries disclosed object classification, placement, retained Orbit hosts/geometry, player text, published Fields and permitted Station links. Improve presentation and navigation without extending source/DTO schemas, codecs, disclosure policy or persistence. Only Revealed systems open. Unknown markers remain generic; missing private details are never recovered from Warden data.

Reuse the pure catalogue glyph/label helpers on the narrowed disclosed DTO arms without fabricating source SystemObjects. Retain current marker envelopes, positions and revelation colors. Match the Warden's `3 6` Orbit dash treatment in live rendering and public images. Keep measured hit targets continuous across artwork/labels and outside camera/image geometry inputs.

`PlayerDocumentView` remains the only public selection owner. Object and Orbit inspection opens the appropriate desktop/compact panel; expansion alone does not inspect. Public hierarchy follows object → Orbit → object relationships, with real accessible levels, bounded indentation and immediate public parent context. Pending reveal/focus work captures document identity, system, target and a request generation because public IDs can repeat in a replacement snapshot.

Do not mount a second full `MapEditorLayout` inside the Warden preview: fixed panel IDs and global focus selectors would collide with the surrounding Warden workspace. Keep its embedded arrangement while sharing the corrected public hierarchy/inspection components and navigation contracts. Player components never mount Warden commands, state, history or hydration.

## Pre-agreed verification seams

These reuse the already approved public-reader, projection/artifact and UI verification boundaries. No new storage or external integration seam is introduced.

1. **Public browser consultation:** load actual player JSON or links, inspect published locations, expand nested Hierarchy, select/navigate with native input and return to the cluster on desktop/compact layouts. Observe visible/accessible content, focus and real marker geometry; retain read-only/private-data assertions. This verifies user behavior, not internal controller calls.
2. **Pure public presentation/tree/camera interfaces:** known literal mixed-disclosure examples verify glyph policy, object/Orbit nesting, stable public targets, finite reveal calculations and document replacement fencing. These do not certify browser typography or physical input devices.
3. **Actual generated public artifacts:** SVG/PNG glyph and dash conventions, published relationships/geometry and secret exclusion. Retain the existing codec, image-bound and source-preservation regressions.

Follow vertical red → green slices: write one meaningful failing public behavior check before changing its presentation path, qualify its first desktop/compact captures, then continue. Root runs all shared checks on frozen inputs. Full final qualification and independent standards/spec/privacy reviews remain required before merge readiness.

## Coordination

Architecture and exact shared interfaces precede implementation. The intended owners are public consultation (document shell, panels/tree and inspection) and public rendering/navigation (maps, camera, shared glyph presentation and public images). Resolve shared interfaces and fixture ownership before parallel edits. Owner briefs and final evidence will be recorded here.

### Frozen interfaces and ownership

The architecture handoff fixes these interfaces before production editing:

- Consultation owns `utils/player-inspection.ts`: `PlayerInspectionTarget = { kind: 'object' | 'orbit'; id: string }` and `PlayerUsableRectReader = (mapClientRect: ClientRectBounds) => ClientRectBounds | null`. Null means blocked; an omitted reader means the full map rectangle.
- Consultation owns `buildPlayerSystemHierarchy(PlayerSystemDocument): PlayerHierarchyNode[]`, with object/Orbit discriminants, stable public keys, public labels and optional children. Root nodes are system-level objects and unoccupied Orbits; objects contain hosted Orbits; Orbits contain their retained objects. Index relationships, preserve public sibling order and avoid complete ancestor-string duplication.
- Rendering owns `playerObjectPresentation(PlayerObjectMarker): { glyph: string | null; label: string; typeLabel: string | null }`, narrowing disclosure before calling the pure catalogue helpers. Unknown classification stays absent.
- `PlayerSystemHierarchy` and `PlayerSystemMap` add optional `selectedOrbitId` and `inspect-orbit`; the map exposes `revealTarget(target, expectedDocument): boolean`, with identity validation and no selection/focus side effects. Object Inspector may emit `inspect-orbit`; focused Orbit Inspector emits `inspect-object`.
- Both public map components accept optional `getUsableClientRect`. The document view reads only its own visible public panel/control descendants and uses `largestUnobstructedClientRect`; a covering compact panel returns null. Embedded adjacent panels leave the SVG rectangle unchanged.
- Keep existing Fit and maximum fitted scale. Rendering adds a bounded pan envelope equal to obstruction insets converted to scene coordinates, accounting for SVG meet/letterboxing. The same envelope governs manual pan, `canPan` and origin-only `revealPoint`; no obstruction retains the original clamp. Fit resets the original fitted view.
- Pure `revealPlayerMapPoint({ point, current, fitted, viewport, usable, margin? }): PlayerMapSceneBounds | undefined` lives in `player-map-fit.ts`; margin defaults to 20 CSS pixels. It preserves current camera dimensions, returns undefined for unusable/invalid input and permits unchanged valid results.
- After deferred work, the document owner rechecks exact cluster/system-document references, copied target and request nonce. Compact blocked targets remain pending only while still owned and are revealed after returning to the map.

Consultation owns document view/preview, public hierarchies/Inspectors, inspection/tree utilities and consultation tests. Rendering owns both public maps, viewport/presentation/geometry/image utilities and separate rendering/camera/export tests. Rendering removes the system map's embedded consultation aside; consultation replaces it in the document view's embedded branch, without a second full editor layout.

The shared test fixture is owned by consultation: `createPlayerInterfaceFixture(): { document: PlayerClusterDocument; json: string }` in `tests/fixtures/player-interface-fixture.ts`. It uses the real projection/codec and returns only sanitized public input. Initial writers are restricted to one meaningful failing public-tree journey and one actual public-SVG glyph/dash test before production changes are authorized. Coordinator runs and records the RED results.

## Initial RED evidence

Both first slices use native browser input against the actual standalone reader and the same projected, codec-validated JSON fixture. Types/lint pass after correcting the consultation test's callback delimiter; no setup failure is counted as the RED. Root also waits for the native file input to become enabled and scopes glyph checks to the visible SVG text rather than assuming a single text child.

The frozen run `ticket08-public-interface-red.log`, owned `local-test-2026-11-04T16-33-36-886Z-38504`, reaches the Revealed system in both cases. Consultation fails because `role=tree` named Player object and Orbit hierarchy is absent; rendering fails because Public Star lacks the visible `✦` catalogue glyph. These reproduce the reported flat list and inconsistent icons. No private sentinel reaches the JSON or initial view. The initial native-reader slices replace a proposed test-only fake DOM/serializer harness; actual downloaded SVG conventions will be qualified through the maintained real export journey.

Production implementation is now authorized within the frozen two-owner boundaries. Each owner extends meaningful user/artifact regressions before changing the corresponding path and hands off frozen checkpoints for coordinator checks.

## First GREEN checkpoint

The frozen native-reader replay passes both initial cases (2/2), with the named nested object/Orbit tree and the disclosed catalogue glyphs plus dashed Orbits. Evidence: `ticket08-public-interface-first-green.log`, owned run `local-test-2026-11-04T16-55-01-535Z-41820`. Nuxt preparation, source typecheck and affected lint also pass. This checkpoint does not yet qualify automatic inspection, Back placement, camera reveal or downloaded images; those paths remain in progress.

## Consultation and artifact RED

The next frozen native run reaches the public system and actual image download, then fails Back-before-title ordering and the missing disclosed Moon glyph in the downloaded SVG. Evidence: `ticket08-consultation-artifacts-red-network.log`, owned run `local-test-2026-11-04T17-08-01-219Z-57224` (2 failures). The consultation journey also retains nested levels and adds public text, zero/false Fields, immediate public Orbit context, selection, desktop/compact screenshots and return-focus assertions. The image journey checks real SVG and PNG-intermediate glyph/dash values alongside existing geometry/privacy checks.

An earlier local attempt could not access loopback under sandbox restrictions and was stopped before scenarios; it is not application-failure evidence. The rerun used the required local-network permission. Full checks/build and immutable-preview smoke succeeded on the preceding committed candidate `98c1c7cb`; its full browser qualification had four failures across both shards, including one compact reader failure (184 passing cases in that shard). The compact test can read desktop `aria-expanded` before the media-query update; synchronize the responsive state before interacting, retaining its dialog/focus assertions. Separate read-only diagnosis covers the other shard's publication-image rounding assertion and two native touch failures; their causes are not presumed to match the reader race or earlier unexplained timeouts.

The early architecture check requires selected-path expansion, exact-document/nonce fencing for deferred tree focus, and bounded Unicode-safe immediate host context. Installed Nuxt UI `UTree` supports the required split expansion/selection slots and controlled expansion, so reuse that component rather than retaining a custom tree without a concrete limitation. Both implementation owners are now completing the remaining agreed scope before the next frozen checkpoint.

## Camera and rendering checkpoint

The rendering owner completed public glyph/dash image parity, selectable Orbit hit strokes outside measured geometry, optional usable-area readers, origin-only target reveal, and bounded manual pan. The old map-owned consultation aside was removed after the document owner moved both embedded panels into the common document composition. No DTO, codec, source publication or persistence changes are introduced.

The frozen camera/geometry selection passes 7/7 (`ticket08-camera-geometry-pure.log`), including fitted-scale preservation, obstruction edge targets, an already zoomed view, SVG meet letterboxing, blocked/invalid regions and narrow-area margins. Live desktop/compact visual qualification and actual artifact replay remain pending at this checkpoint.

## First integrated native/visual checkpoint

After correcting mechanical template/tree type errors, full source typecheck and affected lint pass. The first frozen six-case native run passes live glyph/dash rendering, actual SVG/PNG parity/geometry and the original publication-image framing assertion. The consultation journey passes its desktop tree, public detail, zero/false Field, selection and Back-order assertions and produces a readable desktop capture. Its compact assertions then incorrectly query the inert background toolbar; use the active dialog's recovery controls without changing behavior or weakening details/focus checks. Evidence: `ticket08-core-first-visual-native.log`, owned run `local-test-2026-11-04T17-30-16-425Z-43648` (3 passed, 3 failed).

The first desktop capture was visually inspected before broad qualification. It shows matching disclosed symbols, dashed Orbits, nested rows and useful published Inspector content with the left Back action. A selected expanded branch collapsed on row selection; separate selection from expansion through the installed Tree slot, preserving the current expanded keys. Independent review also found that camera/top navigation overlays were not marked for the public usable-area reader; mark those actual overlays and verify the target against rendered obstructions.

### Confirmed native release defect

The two remaining failures reproduce the prior CI touch failures. A temporary passive observer records the original trusted touch pointer (ID 2, touch ID 1) starting on a cluster system at approximately (195, 497). After long-press inspection changes the compact layout, the same pointer's trusted `pointerup`, then touch-generated compatibility `mousedown`, `mouseup` and `click`, target the newly underlying Preview player view button. Their default actions are not prevented, and the unexpected preview opens. No `touchend` is observed at window for that release. This establishes retargeted release activation, separate from the eight historical unexplained timeouts.

The architecture keeps an Inspect-long-press-owned release token with the mounted canvas, correlates pointer/touch identity, and captures the matching terminal pointer event plus compatibility mouse events across the sibling panel boundary. It preserves terminal transport cleanup, clears on a new genuine contact/terminal click/disposal, and expires only after release. A fresh same-position tap remains usable; no Preview-button/focus-specific workaround or general next-click blackout is introduced. A separate bounded developer owns that canvas/helper correction after the rendering writer's handoff. Temporary test observers were removed after capture; the original native assertions and deadlines are retained for qualification.

The publication-image mismatch did not reproduce locally: source feature BBox and serialized-image BBox differ, but the original strict framing assertion passes at that checkpoint. The producer-clone bounds are unavailable, so no font or floating-point cause is established. Subsequent review replaces the unsupported exact-remeasurement assumption with a stronger direct invariant: export the same scene with and without administrative DOM, restore detached nodes in `finally`, and require exactly equal viewBoxes/feature transforms plus unchanged complete JSON. Independent serialized-ink checks retain the inclusive 24–25-unit outward-padding contract (with a 48-unit system title band); title width may extend the right edge. No retry, deadline change, arbitrary framing tolerance or production export workaround is introduced.

## Corrected native and visual qualification

The frozen corrected core passes 6/6 native cases (`ticket08-core-native-corrected.log`, owned run `local-test-2026-11-04T17-51-42-819Z-48112`). This includes the complete desktop/compact consultation journey, live catalogue glyphs/dashed Orbits, real SVG/PNG parity and geometry, exact administrative-decoration export independence, and both original touch-release regressions with fresh Navigate/Move taps. The coordinator inspected both desktop and compact screenshots before broad qualification: the tree remains expanded on selection, Back occupies the left navigation position, published details/relationships are readable, and Field values omit technical type prefixes.

Two additional frozen executions pass (`ticket08-replacement-touch-lifetime.log`, owned run `local-test-2026-11-04T17-57-30-664Z-55056`): real fragment admission replaces a document with reused public IDs while compact coverage defers reveal, clearing the old selection; the maintained native touch case now holds beyond the former suppression window, then checks release focus, cancellation with a reused touch identifier, and an intentional fresh mouse action opening/closing Preview. Exact next-tick tree-focus timing is statically reviewed rather than artificially forced. Listener/timer disposal was independently reviewed; viewport/input emulation is not a physical-device or screen-reader certification.

Full source types, affected source/test lint, Markdown references and Git whitespace checks pass. Standards/spec and complementary privacy/read-only reviews close with no code findings. Their broader verification gates remain separate.

The affected 29-case browser matrix passes 27 and finds two remaining obsolete test assumptions (`ticket08-affected-browser-matrix.log`, owned run `local-test-2026-11-04T17-59-01-724Z-55188`): a helper queries the now-inert toolbar after automatic compact inspection, and nested Unknown rows now include immediate parent context in their accessible names. Correct those locators while retaining all long-prose, privacy, count and geometry assertions, then replay the affected cases. The maintained deep-reader journey additionally qualifies branch/leaf label width and a screenshot at the panel's native minimum width. Final exact-candidate CI remains required before ticket closure.

## Final local replay and review closure

Both corrected compatibility cases pass unchanged feature/privacy assertions in `ticket08-final-affected-replay.log` (owned run `local-test-2026-11-04T18-06-59-410Z-19192`). That run's additional minimum-width measurement initially searched for a descendant row even though the installed Tree renders the role and row on the same element. The correction measures the actual treeitem and its available name column rather than the ink width of a short label; no application or threshold change is made. The maintained deep-reader case then passes alone in `ticket08-minimum-width-qualified.log`, owned run `local-test-2026-11-04T18-10-22-777Z-54592`, with both the expandable level-19 branch and level-21 leaf retaining at least 80 pixels of name space at the native minimum panel width. The capture was inspected; final CI also scrolls the leaf into view so both deep rows are included in its capture.

All 29 affected scenarios are qualified through the original matrix plus these affected replays. This is not described as a clean initial 29-case run. Standards/spec and complementary privacy reviews close with zero findings. Refreshed origin/main remains `47c0418a835da285e9edb88e8f8dffc19c3a2bba`; this deliberately continues the existing feature branch rather than main. The next gate is a complete exact-head CI qualification, including production build, all projects and immutable Preview, before local ticket closure.

## Exact-head CI and native gesture diagnosis

[CI for `9cb241cf`](https://github.com/Submoon/ttrpg-cluster-control/actions/runs/41884929680) passed the production build, types, lint, Markdown checks, 330 checks/storage scenarios, the two immutable Preview smoke scenarios and 368 of 370 browser scenarios. The required quality check failed. Both earlier compact release and export regressions passed in this run.

- The existing Navigate object long-press test deterministically reproduced the stationary camera after a subsequent native right drag. Event capture confirmed the right-drag owner received and forwarded the native moves. During those moves the stored D3 viewport changed, but the active zoom dispatch was still calling a listener bound to the detached scene from before the long-press selection redraw. The touch sequence left that obsolete native zoom gesture alive after its original target was removed. The relevant captures are `ticket08-ci-gesture-reproduction.log` and `ticket08-ci-pan-zoom-capture.log`.
- The existing Move takeover test failed before takeover, while waiting for its first touch move to alter the star preview. It passed the local replays, including the instrumented replay. The failure trace does not establish why the preview failed to start. This remains separate from the reproducible stale scene and the earlier eight historical timeouts.

The existing Warden touch owner now handles both thresholded one-finger pan and pinch, leaving D3 drag admission for Move marks and using D3 transforms only to update the camera. Managed maps disable native D3 touch zoom binding. A single gesture owner can cancel the camera transport before an Inspect redraw removes the scene. Standalone D3 detection and mouse, wheel and double-click zoom bindings are retained. Temporary observers and console diagnostics were removed from source and tests.

The first frozen correction passed the 12-case native gesture matrix in `ticket08-managed-touch-matrix.log` (owned run `local-test-2026-11-05T08-58-59-484Z-13188`). The existing long-press/right-drag regression passes with its original assertion, as does the independent initial Move preview. The compact cluster journey verifies that a marker pan leaves zoom and navigation unchanged, then exercises inspection, fresh taps and browser-generated double-click zoom. Chromium emulation does not certify physical-device input.

Independent review also identified two camera continuity cases at the new ownership boundary. Admitted touchstart must interrupt any current zoom animation before taking a pan baseline, and the empty-background hold timer must leave its pending pan available. The maintained compact journey covers a stationary contact followed by a real background drag, with no Inspector activation.

The corrected continuity replay passed 4/4 (`ticket08-managed-touch-final.log`, owned run `local-test-2026-11-05T09-05-22-197Z-34968`), including the two exact-head CI failures and the expanded compact journey. The final Add correction preserves a delayed camera pan on an entity while still consuming placement on release. The native Add replay passed 2/2 (`ticket08-managed-touch-add.log`, owned run `local-test-2026-11-05T09-07-42-320Z-14308`), including separate viewport assertions for the delayed pan and subsequent pinch and unchanged JSON/IndexedDB checks. The independent reviewer closed all findings. Refreshed origin/main remains `47c0418a835da285e9edb88e8f8dffc19c3a2bba`. Final cumulative CI remains required before closing ticket 08.

[CI for `664d5cc7`](https://github.com/Submoon/ttrpg-cluster-control/actions/runs/42000065917) passed the production build, checks/storage (330), exact Preview smoke (2), and 369 of 370 browser scenarios. The long-press/right-drag regression passed. The first Move preview assertion failed again before the second contact. An older local Windows development run also failed at this same assertion on `c6bca4b3` (`player-view-57-full-suite.log`), then passed unchanged on replay. The recurrence predates ticket 08 and is not specific to the production runtime or Linux.

### Confirmed obstruction during the Map files exit

The initial Move journey passed three local production replays and the targeted immutable Preview smoke. In its usual shard position, the [instrumented Preview run](https://github.com/Submoon/ttrpg-cluster-control/actions/runs/42003360558) reproduced the failure. Trusted `pointerdown` and `touchstart` at the star's measured center reached the Map files panel's player-link explanatory paragraph. The star and scene were connected and stable, Move was pressed, and D3 had installed touch drag on the star. No first drag began. The terminal pointer cancellation reached the star after the obstruction disappeared. These events isolate the closing popover's hit interception from D3 ownership and mode readiness.

Pausing the real exit animation on the previous production build gives a deterministic RED (`ticket08-prod-files-exit-red.log`). The teleported popover remains mounted in `data-state="closed"` with computed `pointer-events: auto`. Disabling only the inner content still left the native preview failing (`ticket08-map-files-exit-green.log`, owned run `local-test-2026-11-05T09-57-38-597Z-40988`). Reka's positioned wrapper is an independent hit target. The correction opts both layers out of pointer hits for the closed Map files popover. The maintained test keeps that state through the first native Move preview, then resumes the animation and verifies rollback on pinch, view-only pan, and full JSON/IndexedDB equality. Temporary native tracing and the extra smoke tag are removed.

The frozen corrected replay passed 3/3 (`ticket08-map-files-wrapper-qualified.log`, owned run `local-test-2026-11-05T10-00-44-169Z-7332`). It verifies the desktop menu remains interactive when open, the compact star moves while both closed layers are still mounted, and Navigate/Move holds and fresh taps still work. Independent review closed the wrapper finding. Final exact-head CI is the remaining merge gate.
