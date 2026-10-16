# Interface revamp: proposed implementation slices

## Proposal status and authority

**This is a concrete proposal for the human granularity/dependency check, not published implementation tickets.** Proposed IDs are **18–37**, continuing after the seventeen closed decision tickets. No existing ticket is replaced. The source issue and specification remain open; no implementation, cleanup, Git or remote write is performed here.

Authority: [the complete specification](../spec.md), frozen SHA-256 `DF58B9D8715140A8F18D9F808FF83A2B1EBEC3F2596A2B23F37F1E51778E212F`, supplemented by the human's 2026-10-16 instruction that the **last ticket must clean up this effort's documentation and disconnect/remove disposable prototypes from the real project**. The coordinator supplied fresh feature baseline `f4aa1b4438217412c308e61733d862f3d71597ca`, equal to its remote, intentionally 0 main-only / 23 feature-only against `origin/main = 629d2a98715c3a16b954e0f77c639b1f0c31212c`. Issue 3 was refreshed unchanged, open, without comments. This delegated analysis does not repeat coordinator-owned Git operations.

Read alongside the [preservation matrix](../analysis.md#preservation-matrix-existing-and-future), [current Astra review](astra-current-interface-review-2026-10-16.md), and [B1–B10 test seams](spec-test-seams-2026-10-16.md). Historical prototype pass counts are scenario material with their original provenance, not current product passes. No ADR directory is present; no domain relationship or new vocabulary is proposed.

## Why these boundaries fit the existing product

The retained real editor already connects the domain, maps, inspectors, file workflows and IndexedDB owner. Ordinary commit validates and publishes detached memory immediately, but returns durable completion; current form acknowledgements await it. Backup restore intentionally publishes after durable replacement. The chart-name slice therefore changes acknowledgement and save-latest Retry together, through an observable workflow. Other draft types adopt the same contract in their own end-to-end editing slices. This is an incremental adapter rollout, not a separate state-framework ticket.

The current `/` defaults to the memory-only prototype; `?variant=baseline` reaches the retained persisted editor, and existing tests still navigate `/` expecting the old product. Slice 18 fixes the actual product/test target before later work can appear successful against the wrong application. Shared feature-branch styles/renderers mean the retained route is not pristine `origin/main` for comparative performance.

The two map wrappers have independent input paths. Cluster movement and system/Orbit movement therefore carry explicit wrapper-specific cancellation evidence. Existing valid persisted/imported workspaces allow editing, Fields and image export branches to proceed without waiting for new creation UI. Creation is split by the result delivered; editing does not acquire a creation dependency merely to obtain test data.

No standalone prefactor is justified: the current product provides useful seams, and any small extraction belongs in the first working behavior that needs it. No new schema, renderer, diagnostic API, test framework, durable draft store or generic command bus is required. Ticket sizes are bounded by a single visible workflow or target family; shared behavior is extended, not reimplemented in every slice.

## Rules carried by every proposed ticket

- Deliver a working persisted-product journey, relevant tests and its evidence together. Preserve unaffected baseline capabilities while migrating a workflow; intermediate completion is not acceptance of the entire redesign. Keep real legacy commands reachable until their replacement works; do not replace them with decorative controls, success for ignored values, sample data or simulated saves.
- Use Nuxt UI to the greatest practical extent, considering configuration, slots and adapters before bespoke equivalents. Reassess prototype controls rather than copying their exemption status. Record the smallest necessary exception and concrete evidence. Retain the SSR shell/client-mounted maps and one provider/CSS integration.
- Preserve the database, marker, schema/version, drag identities where retained, accepted older shapes inside the current identity boundary, and no old-database migration/previous-marker fallback. Keep authoritative domain validation, host corrections and reference integrity. No budgets, new scope or related-issue closure are implied.
- Every newly introduced editor/command participates immediately in draft ownership, latest-memory application, ordered autosave, relevant targeted exclusion and stale-ID cleanup. Hidden drafts count. Preparation is read-only; valid Apply ends the designated session at memory publication, and save failure does not undo it. An already applied change survives cancellation of later work. New previews must not appear before ownership refusal.
- Presentation changes preserve relevant draft identity/content/errors, selection, tool and per-view session state. Use existing stable mounted editors during an envelope rollout where necessary; do not introduce a remount that loses an unconverted draft. Each entity-specific slice completes ownership above presentation lifetime for its own draft type.
- Relevant light/dark states, >=4.5:1 useful text, >=3:1 meaningful graphics/controls, non-color cues, names, visible focus, modal entry/return, keyboard and single-pointer alternatives are part of each delivered workflow. Theme slice 19 establishes the shared active preference/resources before 20's theme-toggle draft checks and all later consumers. The declared graph carries that prerequisite transitively; later surfaces extend and verify the shared tokens in their own workflow, without hidden completion gates.
- Automate meaningful mobile portrait, landscape and reduced-height/touch cases from the first relevant slice, using 390×844, 844×390 and 390×500 as starting viewports. Measure usable unobscured areas and ordinary hit testing. Targeted **Android Chrome only** checks cover OS keyboard, safe areas and actual gestures; desktop scope stays unchanged. Do not claim a reduced viewport or synthetic second contact is physical-device proof. Phone checks belong to the introducing slice and are reconciled again at the final gate; no new hardware harness/CI requirement is introduced.
- Evidence names the product route, source/runtime, fixture validity/identity, viewport/device/browser/input, outcome and limits, with passed/failed/unexecuted/unavailable distinguished. Use the existing real-browser Playwright seam plus narrow codec/domain/storage regressions; add no test-only application interface. Run affected checks and appropriate typecheck/build; compiled-production checks cover hydration, menus/portals and geometry. The last ticket performs the final post-cleanup integration/performance run, rather than owning all earlier testing.

## Proposed numbered breakdown

### 18 — Open and recover the real local workspace at the product root

**Blocked by:** none; this is the initial frontier.

**Delivers:** `/` presents the actual local-workspace application. A Warden creates a Jump Cluster/first system, resumes saved data, or receives actionable loading/recovery feedback instead of entering a disposable sample.

**Acceptance:** restore the real product as the default, preserve product/data identity and validated hydration; keep Try again and missing/damaged/failed/successful backup restoration truthful, with durable-before-publication replacement and no editable partial snapshot. Explicitly capture a safe isolated pre-change retained-baseline run using its named route, then target the product root in preservation tests; distinguish selector drift from lost behavior. Preserve existing commands and user storage. Start automated welcome/resume/recovery phone layouts and a compiled SSR/hydration check. Establish runtime/fixture identity and comparable measurement method for later performance work.

**Scope/size:** one launch/recovery journey using the existing product. No whole-shell redesign, new migration, blanket test rewrite, prototype promotion or final experiment deletion. Disconnect the sample from the product entry immediately; its remaining source cleanup is 37.

**Stories:** primary 1–3, 101–102; required checks 89, 98, 107–111, 119–120. **Evidence:** B1, B8, B9.

### 19 — Choose a coherent local light or dark presentation

**Blocked by:** 18 — palette and resource evidence must target the actual persisted product/SSR entry.

**Delivers:** a named theme control changes the shell, both maps, native controls and portal content together; the explicit browser/device preference survives sessions/workspaces and overrides subsequent OS changes.

**Acceptance:** before an explicit choice follow initial and changing OS preference; afterward use the separate durable choice. Preserve workspace, draft/errors, selection, placement, view, mode and save state without a workspace save. Cover useful text, meaningful state/graphics, simultaneous focus/selection and non-hue unknown-route/error cues. Package all used static/dynamic glyphs locally; prove actual cold glyph rendering with external Internet denied to browser and server while the app remains reachable. Test SSR/hydration and portal surfaces, keyboard/touch control, light/dark mobile states. Later surfaces inherit these tokens and resource rules in their own tickets.

**Scope/size:** shared preference/palette/resource behavior through existing product surfaces, not a theme engine or complete redesign of every form. No image-scene export implementation here.

**Stories:** primary 103–111; required checks 82, 89–90, 119–120. **Evidence:** B4, B9.

### 20 — Rename charts with resumable drafts and trustworthy Apply/save recovery

**Blocked by:** 19 — needs the working theme control for actual theme-toggle draft-resumption acceptance; real commands, hydration and persistence from 18 are inherited transitively.

**Delivers:** edit a cluster/system name, hide and resume the draft, resolve a requested transition with Apply/Discard/Stay, and distinguish an applied name from a durable save even when storage fails.

**Acceptance:** parent-owned chart-name draft/feedback survives hide/theme/reflow with a reopening indicator. Clean transitions do not prompt; Stay or invalid Apply keeps the exact original target/context/view/tool. Validate against latest committed memory, publish once and end the designated form/continue its transition before durable acknowledgement. Force a real write failure, preserve memory and persistent Not saved/error, Retry latest memory without replay, and export current applied JSON excluding drafts/previews. Later edits and delayed/older completions cannot falsely mark the newest snapshot saved. Keep draft/tool/save/export errors distinct; scoped cancellation and supported departure warnings retain their boundaries. Remove decorative footer only while relocating all useful feedback into continuous reachable status/actions. Chart names/summaries retain their existing scope; no cluster/system descriptions.

**Scope/size:** one concrete chart-name workflow plus the existing single autosave boundary, reusable transition contract and status access. Other editor types adopt real adapters in 22/26/30/32/33; this ticket does not rewrite all forms. Recovery restore remains durable-first.

**Stories:** primary 66, 82–93, 99, 117; required checks 7, 14, 23, 54–57, 100, 106, 109–110, 120. **Evidence:** B1, B4, B5, B7, B9.

### 21 — Explore and inspect separate maps through the responsive Dock and panels

**Blocked by:** 20 — accepted/refused context and selection changes need the working guard/session contract.

**Delivers:** Navigate opens a system deliberately; Select requests data without entering it; optional nested Hierarchy and Inspect leave desktop maps usable and occupy exclusive fullscreen compact surfaces.

**Acceptance:** visible context/names and explicit Back; first-visit Fit, session-only per-map viewport/valid selection restoration, deleted-ID cleanup. Navigate/Select drag pans even over entities, while short click/tap/Enter/Space has the specified intent; long press in Navigate cancels pending activation. Dock separates Navigate/Select/Move from creation/panel/file commands and contains one reachable zoom set, wheel and keyboard/single-pointer view alternatives at 25–1600%. Opening/hiding panels preserves tool/progress and closes only the chooser; compact exclusivity holds through every opener/reflow. Keep existing editors mounted safely until their dedicated adapter lands. Map files works above desktop Inspect, and dialogs/conflicts contain/return focus correctly. Fit/target recovery use actual unobscured regions, not SVG width; address short-screen obstruction and compact context. Guard refusal leaves the prior presentation/context/view/tool intact; accepted context change resets Navigate.

**Scope/size:** navigation/presentation outcomes, reusing current maps and working editors. Full creation, Move manipulations and form parity have separate slices; no replacement renderer or application context menu.

**Stories:** primary 4–20, 23, 50, 53–54; required checks 21–22, 24, 31–32, 44–46, 59, 82–86, 96, 105–111, 119–120. **Evidence:** B1–B5, B9.

### 22 — Edit the complete catalogue-object data in a resumable Inspector

**Blocked by:** 21 — consumes the real selection/Inspector/guard path.

**Delivers:** Select or Hierarchy opens a complete object form with readable visible sections, precise validation and reachable ordinary actions; a hidden object draft remains owned and discoverable.

**Acceptance:** full Name/unique system Location key/Description, Other type text, placement and conditional schematic coordinates, optional physical Station association for a logical Jump Point, native Atmosphere/Port class and all applicable typed custom values including multiline text. Preserve hidden/ineligible assignments and zero/false. Built-in Description and a custom Session note retain different identities. Numeric geometry remains usable in Select. Top Hide, persistent bottom Apply/Discard/status/error access, field-error navigation and separated final Delete entry work with long content/Android Chrome keyboard. Object draft survives presentation, rejects conflicting entity/host/placement/definition/deletion commands before previews, and permits independent navigation/commands. Apply uses latest memory and ends despite a subsequent save failure. Use established catalogue/domain labels in controls, hierarchy and map accessible names; later target slices extend this vocabulary.

**Scope/size:** one object editing/validation family through existing domain commands, not every Inspector type. Retain the working existing reviewed Delete behavior until 34; do not add an unreviewed destructive shortcut. Fields definitions are 31–33.

**Stories:** primary 22, 55–62; required checks 33, 38–39, 51–52, 78, 82–93, 94–96, 105–110, 120. **Evidence:** B1, B4–B7, B9.

### 23 — Repeatedly place star systems with an anchored Add chooser

**Blocked by:** 21 — needs the Dock, context/Back, layering and guarded session behavior.

**Delivers:** choose Add System, place multiple real systems in the cluster, and remain in the cluster with the same type active and Inspect on demand.

**Acceptance:** map-appropriate choices use the real anchored trigger, collision/available-space placement and ordinary focus/hit testing. Show type, next target and Quit Add; compact status reuses the context banner while retaining context/Back. Successful creation neither opens/retargets Inspect nor discards existing drafts. Chooser dismissal retains type/progress; Escape/outside dismissal is consumed before map placement/quit. Opening panels closes the chooser without resetting intent. Quit Add/map Escape drops only unfinished creation and returns Navigate; committed systems and drafts survive. Creation publishes once with truthful save-failure handling. Named keyboard/single-pointer destination Confirm/Cancel is available. The preview link explicitly opens a fresh preview without claiming workspace sharing.

**Scope/size:** shared chooser/lifetime through one system-creation result. Preserve other working baseline creation commands while 24/25/30 migrate their target-specific paths; do not pretend they are already accepted. No seed workspace or new defaults generator.

**Stories:** primary 24–32, 118; required checks 15–17, 27, 36–37, 44–46, 49, 51–52, 82–93, 105–111, 120. **Evidence:** B1–B5, B7, B9.

### 24 — Place every catalogue subtype at the intended free or Orbit position

**Blocked by:** 23 — reuses the anchored chooser, persistent Add state and dismissal/quit arbitration.

**Delivers:** on a system map choose any of the fifteen subtypes, including Other, then repeatedly create at an indicated free point or actual position on a rotated/nested Orbit.

**Acceptance:** transform the actual destination correctly; no fixed default angle replaces the intended target. Indicate candidates without hover and require explicit touch/keyboard choice when valid destinations overlap. Invalid targets explain refusal, mutate nothing and retain Add. Supply source/destination preview and Confirm/Cancel plus coordinates/Orbit-position alternatives, without requiring drag, hover, pinch or modifiers. Preserve domain constraints, all relevant drafts/dependencies and typed object identities; repeat success leaves Inspect on demand. Both normal application and save-failure/current-JSON checks prove actual persisted-product results. Introduce the reusable explicit destination/candidate interaction only as needed for this working placement journey.

**Scope/size:** catalogue placement family. Existing editing supplies Other type text; new custom fields, hosted-Orbit editing and Move are excluded. Future manipulation slices extend the same alternatives and cancellation policy.

**Stories:** primary 33–34, 36–37, 51–52; required checks 25, 27–32, 40, 44–46, 49, 60, 82–93, 96, 107–110, 120. **Evidence:** B1–B5, B7, B9.

### 25 — Create hosted or unoccupied-center Orbits deliberately

**Blocked by:** 24 — uses the working system-map destination/candidate/Confirm interaction, not a new parallel targeting system.

**Delivers:** Add Orbit creates a valid Orbit around the chosen object host or an indicated unoccupied center, with persistent repeated Add and deliberate cancellation.

**Acceptance:** host/empty-space targeting, nested structures, explicit overlap choice and invalid-target explanations preserve existing domain checks and independent per-axis host minimum correction/notices. Preview matches the validated new Orbit and its placement; no partial Orbit is published by panning, cancellation or chooser dismissal. Keyboard and single-pointer alternatives achieve each result. Creation preserves unrelated drafts, refuses actual ownership conflicts before preview and uses latest-memory save/retry semantics. Test free/hosted/nested valid fixtures, both themes and compact/touch flows.

**Scope/size:** Orbit creation only; precise editing of existing axes/order/rotation is 26, Move handles/attachment are 29. Not blocked by editing slices: existing import/fixtures already supply hosts and nested examples.

**Stories:** primary 35; required checks 24–25, 27–32, 36–37, 40, 43–46, 49, 51–52, 82–93, 96, 107–110, 120. **Evidence:** B1–B3, B5, B7, B9.

### 26 — Edit complete Orbit geometry and relationships in Inspect

**Blocked by:** 22 — reuses the working Inspector envelope and draft adapter/acknowledgement pattern.

**Delivers:** an existing Orbit's independent radii, unoccupied Center X/Y, per-host ordering, rotation and explicit Detach are editable in Select with a resumable owned draft.

**Acceptance:** visible full-parity sections and valid latest-memory Apply; ignored geometry must never report success. Preserve host minimum adjustment per axis with independent notice, nested relationships and order constraints. Hosted centers require explicit Detach before independent movement. Draft survives hide/theme/reflow with feedback and blocks conflicting Orbit/host/dependency operations before competing previews while unrelated operations remain possible. Test valid/invalid Apply, Apply/Discard/Stay, save failure, full geometry JSON/reload outcomes and keyboard-open ordinary actions. Keep separated reviewed Delete entry.

**Scope/size:** one existing-Orbit form/command family using imported/baseline fixtures; no dependency on new Orbit creation. Gesture handles and host attachment targeting are 29.

**Stories:** primary 63; required checks 22, 40–43, 51–59, 82–93, 94–96, 107–110, 120. **Evidence:** B1, B4–B7, B9.

### 27 — Move cluster systems safely with navigation takeover and explicit destinations

**Blocked by:** 21 — consumes persistent Move, map intent and session navigation.

**Delivers:** Move changes an existing system's cluster position deliberately; view navigation and cancellation never publish a canceled edit or enter the system.

**Acceptance:** system selection/movement versus background pan, valid release exactly once, explicit source/destination preview and Confirm/Cancel/coordinate alternatives. In the **cluster wrapper**, two-contact pan/zoom and recognized right-button drag work over systems in every available mode; cancel an existing preview before takeover, suppress its later release/click and retain mode/type/progress. Preserve stationary right-click native behavior outside a recognized pan; recognized pan suppresses its resulting context menu. Long press in Navigate/Move cancels movement/activation before Inspect. Interruption, Escape and tool/context cancellation drop only unfinished work. Conflict refusal precedes preview; unrelated view navigation remains available. Test normal commit separately from interrupted paths and observe unchanged JSON/reload after cancellation.

**Scope/size:** cluster system movement and explicit cluster-wrapper arbitration, not an assumed pass for the system wrapper. New route progress is checked again in 30; no new right-click feature.

**Stories:** primary 21, 44–46, 49; required checks 18–20, 23, 38–43, 47, 50–54, 82–93, 96, 107–110, 120. **Evidence:** B1–B5, B7, B9.

### 28 — Move objects and change Orbit attachment explicitly

**Blocked by:** 22 — object/host/placement draft exclusion must already work; 24 — reuses valid target choice and destination confirmation.

**Delivers:** Move repositions free objects and attached objects, transfers/attaches to a chosen valid Orbit, or explicitly changes an attached object to free placement.

**Acceptance:** dragging an attached object into empty space retains its Orbit and changes position on it; only a deliberate valid Orbit target transfers/attaches, and attached-to-free is explicit. Transform rotated/nested destinations correctly. Hosted/nested Orbits and dependents follow host previews and validated commits. Draft/dependency exclusion precedes preview. In the **system wrapper**, exercise every available mode with second-contact/right-pan takeover, interruption, late release suppression, long-press Inspect and valid once-only release; do not inherit a cluster-only pass. Keep numeric/Orbit-position and source/destination Confirm/Cancel alternatives equivalent. Save failure retains applied movement, and cancellation leaves both JSON and durable data unchanged.

**Scope/size:** object movement/attachment family and system-wrapper arbitration. No Orbit-axis/center/rotation handles; route-origin behavior remains 30. Existing domain placement rules are authoritative.

**Stories:** primary 38–40; required checks 21–23, 34, 36–37, 44–46, 49–54, 60, 82–93, 96, 107–110, 120. **Evidence:** B1–B5, B7, B9.

### 29 — Manipulate Orbit axes, rotation and centers without accidental edits

**Blocked by:** 26 — needs Orbit draft/dependency authority and full geometry commands; 28 — uses the system-wrapper takeover and explicit target/destination behavior.

**Delivers:** selected-Orbit controls change independent axes, uniform ring size, rotation and unoccupied centers, and deliberately detach/attach hosts while dependent structures remain coherent.

**Acceptance:** named target-aware handles and equivalent focused/numeric/single-pointer controls achieve every result. Hosted center requires explicit Detach; attaching an unoccupied center announces valid hosts and resolves ambiguity. Preserve cycles/host/geometry validation, per-axis host minimum corrections with separate notices, ordering and nested dependents in previews/commits. Actual dependency drafts reject before preview; second contact/right-pan/long press/tool change/interruption cancels without a late commit, while ordinary release commits once. Test all handle families, off-initial-scene positions and invalid destinations, both themes and touch/keyboard. Exported applied JSON/reload proves outcomes, not just handle animation.

**Scope/size:** one existing-Orbit manipulation family using valid fixtures; no new geometry model or renderer. Does not wait for Add Orbit solely for test setup.

**Stories:** primary 41–43; required checks 21–23, 35–40, 44–46, 49–54, 63, 82–93, 96, 107–110, 120. **Evidence:** B1–B5, B7, B9.

### 30 — Build and edit known or unresolved Jump Routes safely

**Blocked by:** 22 — reuses the owned Inspector pattern and logical Jump Point/Station distinction; 23 — reuses Add chooser/lifetime/arbitration.

**Delivers:** choose an origin, navigate to a destination and complete a real route, or edit all route endpoint/destination/Jump level data in a resumable form.

**Acceptance:** cluster creation retains origin/stage during pan/zoom/right-pan without publishing a partial route; completion keeps Add Route active but resets both endpoints. Quit/Escape/tool change cancels only unfinished route work. Handle invalid/overlapping endpoints deliberately with keyboard/single-pointer alternatives. Existing route Inspect preserves From Jump Point, known/unresolved destination, To Jump Point/external label, standard levels 1–9 and higher positive integers. Logical Jump Points remain distinct from optional Stations. Route draft owns actual endpoints/dependencies, survives presentation, and uses full guards/latest-memory Apply/save failure; clean transitions remain prompt-free. Test late release and pending-origin deletion invalidation with fresh subsequent creation state.

**Scope/size:** one route lifecycle, not new system or Jump Point creation; fixtures supply endpoints. Existing route semantics/schema remain unchanged.

**Stories:** primary 47–48, 64–65; required checks 24–32, 36–37, 44–46, 49, 51–59, 82–96, 107–110, 120. **Evidence:** B1–B7, B9.

### 31 — Consult Fields through resumable list and detail screens

**Blocked by:** 21 — needs working panel/file layer and opener/context preservation.

**Delivers:** global Fields and contextual Manage open the same session, showing a useful definitions list and full-area read-only detail on phone or a bounded centered two-column dialog on desktop.

**Acceptance:** first opening is the list; detail shows saved type, choices, applicability and assignments. Back restores list position/highlight/focus; Close hides and returns to the actual opener while retaining last valid screen/selection and underlying map/editor work. Manage creates no artificial field target. Keep compact title/Back/Close, internal scrolling and bottom commands reachable at short heights, with OS keyboard checks where applicable. Explicit Edit is discoverable and enters the retained working editor; existing edits/drafts are not lost while 32 converts that workflow. Verify actual production modal centering, keyboard focus entry/containment/return and long-content light/dark states.

**Scope/size:** complete consultation/navigation journey. Preserve working native/custom editing and creation entry paths; new edit/creation ownership and destructive review are 32–33, not falsely accepted here.

**Stories:** primary 67–72, 81; required checks 14–16, 55–57, 69, 73, 76–77, 82–85, 105–111, 120. **Evidence:** B4–B6, B9.

### 32 — Edit field definitions with owned drafts and accurate impact reviews

**Blocked by:** 31 — provides consultation/Edit/session/focus flow; 22 — object draft/definition dependency conflicts must be resolvable through the real owner.

**Delivers:** explicitly edit existing native/custom definitions, options, type and applicability without losing assignments silently; review the exact affected values before destructive application/deletion.

**Acceptance:** supported types/choices/native options and all/selected-category/subtype applicability; hidden ineligible values and zero/false persist. Definition draft/feedback survives Back/hide/theme/reflow and same-target resume. Definition/New/other-target transitions use Apply/Discard/Stay only when modified. Preparation stays read-only with object drafts intact; resolve incompatible ownership, recompute effects after draft Apply and require renewed review when the footprint changes. Cancel/invalid Apply preserves both sessions. Confirmed custom deletion returns to a valid nearby row/list control and clears deleted IDs, never unrelated Atmosphere by default. Latest-memory application ends the intended editing session even if saving fails. Reach reviews/errors/ordinary actions with Android Chrome keyboard open, with correct focus return.

**Scope/size:** one definition edit/impact lifecycle, reusing existing impact/domain logic. Introduces the shared reviewed-plan freshness contract through a real field operation; general entity deletion/import extend it in 34–35. New-field form is 33.

**Stories:** primary 77–80; required checks 61–62, 69–74, 81–93, 94–96, 105–110, 120. **Evidence:** B1, B4–B7, B9.

### 33 — Create custom fields without confusing Hide and Cancel

**Blocked by:** 32 — reuses the guarded Fields owner/editor transitions and real definition application contract.

**Delivers:** one reachable guarded New entry per screen opens a dedicated full-area creation form; success opens the new read-only detail and explicit Cancel returns to the list without creating.

**Acceptance:** text/number/boolean/single-select types and choices, applicability, validation/errors, bottom commands and full width text. Hide/Close preserves the creation draft/screen; reopen through Fields or Manage resumes it. New from modified existing work is guarded; Stay/invalid Apply retains content/focus/context. Successful creation publishes once and ends at memory acknowledgement even if local save fails; Retry cannot create duplicates. Presentation Cancel drops only the designated creation draft and does not discard a previously created definition or clear unrelated save error. Cover short landscape, actual Android Chrome keyboard, light/dark and keyboard-only flows.

**Scope/size:** one new-definition journey using existing schema/types and session machinery. No form builder, additional field kinds or persistence of drafts.

**Stories:** primary 73–76; required checks 69–72, 77–78, 81–93, 105–110, 120. **Evidence:** B1, B4–B7, B9.

### 34 — Review and confirm entity deletion against current dependencies

**Blocked by:** 26 and 30 — complete Orbit and route owner/dependency adapters, including the object adapter transitively; 32 — reuses the proven impact-review freshness/owner-resolution interaction.

**Delivers:** deleting a system, object, Orbit or route shows the actual cascade before applying, preserves drafts during preparation and never confirms a footprint made obsolete by another Apply.

**Acceptance:** separated final Delete controls and protected keyboard Delete in inputs/dialogs. Prepare read-only even with incompatible drafts; resolve ownership only at confirmation. Recalculate latest consequences after applying another draft; if effects change, show the renewed review before commit. Cancel/validation failure publishes nothing; valid memory application survives later save failure and uses normal Retry/current-JSON recovery. Clear all deleted selections, per-view remembered IDs, affected draft/pending targets and dependent references; retain unrelated entities/work. Subsequent creation uses the established fresh identity/default/explicit-placement contract. Each later command adapter must register its own pending-target invalidation rather than require a global lock or a dependency on every gesture ticket.

**Scope/size:** one destructive entity-operation family through existing cascade/domain commands; no defaults-generator fix, undo, player filtering or related issue closure. Field deletion remains owned by 32.

**Stories:** primary 94–96; required checks 9, 27, 36–43, 47–49, 58, 79–80, 82–93, 100, 107–110, 120. **Evidence:** B1, B4–B7, B9.

### 35 — Import independent copies and export complete current JSON

**Blocked by:** 26 and 30 — complete Orbit and route owner/dependency adapters, including the object adapter transitively, are needed to guard import-triggered selection/context transitions; 32 — supplies the working reviewed-plan freshness/owner-resolution interaction. Import consumes no entity-deletion result and can proceed independently of 34.

**Delivers:** Map files imports validated cluster/system JSON through explicit preview and confirmation, retaining existing data as an independent ID-remapped copy, and exports the chosen applied cluster/system scope.

**Acceptance:** show collisions/possible matches, reference remapping and applicability reconciliation; no implicit merge/replacement. Read-only preparation preserves drafts, and changed dependencies after Apply force renewed review. Malformed files, canceled reviews and failed downloads preserve all work. Preserve native/custom values, layout/geometry/references and accepted older route/circle/ellipse/applicability shapes inside the unchanged marker/version contract; no prior-marker fallback or database migration. Current JSON reads latest applied memory during pending/failed saving and excludes every draft, preview and temporary view/tool/selection state. Export success does not clear a save failure. Menus remain reachable above Inspect/Fields with keyboard/touch and actual download assertions plus reload/reference validation.

**Scope/size:** one existing interchange workflow, reusing codec/import validation and reviewed plans. Early recovery JSON in 20 remains available throughout; this ticket completes scope/compatibility/import parity rather than withholding recovery until here.

**Stories:** primary 97–98, 100; required checks 3, 15, 61, 78, 82–99, 107–110, 120. **Evidence:** B1, B5–B9.

### 36 — Export clean complete SVG and PNG in the selected print or active palette

**Blocked by:** 21 — uses the real map context/files path, applied/session separation inherited from 20, and shared active/print palette contract inherited from 19. No redundant direct blocker on 19 is needed.

**Delivers:** export the full applied cluster/system as standalone SVG or matching PNG, in active light/dark or export-only Light for printing, regardless of viewport or local-save failure.

**Acceptance:** bounds/content come from latest validated applied data, including off-viewport geometry and applied long system name/title band. Remove selection/focus/hover, handles, drafts and gesture/candidate previews before determining content/bounds. Preserve meaningful object/route/Orbit/unresolved cues. SVG is independently styled/readable; PNG represents the same scene/geometry/palette/title/bounds. Capture live state/applied JSON before and after success/failure to prove no mutation of theme preference, selection, view, mode, draft, gesture or save error. Distinguish export errors and leave recovery available. Exercise both maps × active-light/active-dark/print × SVG/PNG with dense content and temporary edits; later new preview kinds must extend these assertions in their introducing slice.

**Scope/size:** image-result contract using the existing renderer/export seam, not a new map renderer. No dependency on complete Fields, destruction or JSON import: valid fixtures and 20's applied snapshot contract suffice. No player/secrecy filtering.

**Stories:** primary 112–116; required checks 15, 55–57, 82–93, 99–100, 103–110, 120. **Evidence:** B1, B4, B7, B9–B10.

### 37 — Finish the production editor and retire the revamp experiments

**Blocked by:** 25, 27, 29, 33, 34, 35, 36 — these are the graph's terminal deliverables; their transitive closure includes **every ticket 18–36**. Explicit start condition: every preceding implementation ticket is closed. This must remain the **last** ticket.

**Delivers:** the finished product is a coherent real editor without disposable prototype/comparison behavior in its shipped entry, bundles or navigation, and its maintainers receive a usable canonical documentation/evidence trail plus honest final product acceptance.

**Acceptance:** audit usage before removing residual prototype/sample routes, query switches, seeds, comparison variants, fixtures, harnesses, unused components/assets/scripts/dependencies/configuration and associated navigation/imports. Prove absence from the product route graph, SSR output and production bundles; keep necessary valid fixtures strictly in tests. Preserve user database, schema and import compatibility. Consolidate **all documentation created for this effort**: identify canonical decisions/specification/completion guidance, archive or retire obsolete/duplicated planning/prototype reports, repair links/indexes and retain original evidence/source/runtime provenance. Inventory/classify canonical/archive/remove at the collection level before bounded edits; the coordinator's current scope estimate is 510 tracked effort files including 50 Markdown documents, plus eight product-tree `Prototype*.vue` components and two prototype fixture modules. This does not require reading or deleting every historical capture inline. Do not blindly delete `.scratch`, historical records, untracked user files/logs or unrelated work.

Run post-cleanup typecheck/build and the integrated preserved-capability/browser suite, compiled SSR/hydration/portal/local-resource checks, relevant codec/storage regressions and both-map output inspection. Reconcile B1–B10 with actual current source/fixture/browser outcomes and focused Android Chrome OS-keyboard/physical-gesture plus keyboard/screen-reader evidence; unavailable gates remain explicit, not passes. Measure final integrated production initial/deferred JS/CSS/resources, startup/mount, overlays and map pan/zoom on representative ordinary/dense scenarios **after comparison/sample removal**. Use comparable baseline arms only where valid; report missing/partial arms and investigate reproducible usability regressions, without invented numerical budgets or isolated-library-cost claims. Earlier tickets already own their functional, accessibility and mobile checks; this is the final regression/cleanup gate.

**Scope/size:** cleanup plus the production integration journey, not a deferred implementation catch-all. If the usage inventory is too large for one context, perform bounded mechanical removals as tracked subtasks inside this last ticket and integrate before closure; do not redefine all prior tickets as unfinished or delete without provenance. Product release/merge/deployment/GitHub closure require their own existing authorization.

**Stories:** primary 119–120 and the human's final-cleanup amendment; mandatory regression 1–118. **Evidence:** B1–B10, with final performance/evidence consolidation rather than historical pass-count aggregation.

## Blocking graph and frontier

Only true direct blockers are declared above. Shared source ownership, desirable sequencing, obtaining fixture data and comprehensive final testing are not themselves blocking edges. The theme prerequisite is explicit through 19 → 20: draft theme-toggle acceptance and all later palette consumers start after it. Import and entity deletion independently extend the review/owner contract introduced by Fields; neither consumes the other's result.

```text
18 → 19 → 20 → 21
21 → 22, 23, 27, 31
23 → 24 → 25
22 → 26
22 + 24 → 28
26 + 28 → 29
22 + 23 → 30
22 + 31 → 32 → 33
26 + 30 + 32 → 34, 35
21 → 36
25 + 27 + 29 + 33 + 34 + 35 + 36 → 37 (all 18–36 closed)
```

Initial frontier: **18**. Then **19**, **20** and **21** successively establish the real product, theme and actual guarded-draft acceptance prerequisites. Once 21 is closed, **22, 23, 27, 31 and 36** can proceed by actual file ownership/capacity; this is permission to work a frontier, not to launch five overlapping writers. Existing shared-checkout concurrency/review rules still apply. Once 26/30/32 are closed, **34 and 35** can proceed independently. No leaf can bypass the final cleanup gate.

## Exact story ownership and required extensions

Every story 1–120 has one primary accountable ticket. A primary owner coordinates its complete contract; a crosscutting story is satisfied only after its listed mandatory extensions/checks are complete. This avoids claiming that the first chart draft proves every later draft or that the final evidence ticket supplies missing accessibility work.

| Specification stories | Primary ticket | Mandatory extension/check owners where the contract crosses workflows |
| --- | --- | --- |
| 1–3 | 18 | 20, 35, 37 |
| 4–17 | 21 | 23, 31, 34–36; 9 extends to every deletion/target adapter |
| 18–20 | 21 | 27–30, 37, both map wrappers |
| 21 | 27 | 28–29 complete object/Orbit Move results |
| 22 | 22 | 26, 30 |
| 23 | 21 | 23–33, each new panel/tool owner |
| 24–32 | 23 | 24–25, 30; each Add kind owns repetition/draft/cancellation checks |
| 33–34 | 24 | 22, 28, 35 |
| 35 | 25 | 26, 29 |
| 36–37 | 24 | 25, 28–30 |
| 38–40 | 28 | 25–26, 29 |
| 41–43 | 29 | 25–26 preserve numeric/host-correction outcomes |
| 44–46 | 27 | 21, 23–25, 28–30; 28 proves the separate system wrapper |
| 47–48 | 30 | 27, 34 for cluster input and stale origin |
| 49 | 27 | 23–25, 28–30; every new preview/creation kind |
| 50 | 21 | 27–29 extend long press to Move and live-preview suppression |
| 51–52 | 24 | 21–23, 25–30; all manipulations require equivalent alternatives |
| 53–54 | 21 | 20, 23–30, 34 |
| 55–62 | 22 | 26, 30, 34; readable labels also 21, 23–25, 31–33 |
| 63 | 26 | 25, 29, 35 |
| 64–65 | 30 | 22, 35 |
| 66 | 20 | 21, 36 |
| 67–72 | 31 | 32–33 complete editable/creation resumption and guarded draft Back |
| 73–76 | 33 | 31–32 preserve consultation/new transitions |
| 77–80 | 32 | 22, 31, 33–35 |
| 81 | 31 | 32–33 and 37 targeted Android Chrome gate |
| 82–86 | 20 | **22 object, 26 Orbit, 30 route, 32 definition, 33 creation**, plus all command/panel adapters 21–35 |
| 87–93 | 20 | All mutating slices 22–30, 32–35; backup restore 18 retains its distinct boundary |
| 94–96 | 34 | **32 field impacts, 35 import**, every new pending-target adapter 23–30, 33 |
| 97–98 | 35 | 18, 20, 22, 25–30, 32–34 preserve their own domain/reference outcomes |
| 99 | 20 | 35 full interchange scope and 36 applied-only image checks |
| 100 | 35 | 20, 32, 34, 36 failure/cancel preservation |
| 101–102 | 18 | 20, 35, 37 storage atomicity and recovery regressions |
| 103–106 | 19 | Every later surface, especially 21–23, 26, 30–33, 36 |
| 107–111 | 19 | **Every introducing UI/map/export slice**; 37 reconciles existing evidence, never substitutes for it |
| 112–116 | 36 | Each new preview/draft kind 22–30, 32–33 checks its exclusion and no live-state mutation |
| 117 | 20 | 21–23, 26, 30–33 and 37 keep relocated feedback reachable |
| 118 | 23 | 37 removes obsolete experiment links without implying remote workspace sharing |
| 119 | 37 | 18 establishes route/SSR/measurement baseline; every slice verifies hydration/responsiveness when touched; 19 resources, 21/31 portal geometry |
| 120 | 37 | **Every relevant slice** supplies automated mobile and targeted device evidence as introduced; 37 records the final supported-device state |

## B1–B10 delivery ownership

| Scenario family | Introducing/delivery owners | Final reconciliation |
| --- | --- | --- |
| B1 complete real workflow/parity | 18, 20, 22–30, 32–35 | 37, using focused preserved-capability cases rather than one giant smoke |
| B2 intents and creation lifetime | 21, 23–25, 30 | 37, both maps |
| B3 navigation takeover/cancellation | 21, 27 cluster, 28 system, 29 handles, 30 origin | 37, explicit physical second-contact limits |
| B4 presentation-independent drafts | 20 chart, 22 object, 26 Orbit, 30 route, 32 definition, 33 creation | 37, all six owners/content/errors |
| B5 guard/dependency authority | 20–30, 32–35 as each target/command appears | 37, hidden ownership and independent commands |
| B6 Fields and reviewed destruction | 31–35; 22 object-draft conflict adapter | 37, refreshed impacts and stale IDs |
| B7 memory Apply/save/latest Retry | 20 first real UI failure; every later mutating owner | 37, no replay/duplicate or stale saved status |
| B8 load and backup recovery | 18; preserved after persistence/interchange changes | 37, durable-before-publication exception |
| B9 theme/resources/responsive accessibility | 19 shared behavior; every introducing surface/target | 37, actual keyboard/screen-reader/Android Chrome and cold resources |
| B10 clean complete image result | 36; each new preview/draft owner checks exclusions | 37, standalone files and live-state preservation |

## Approval handoff

The numbered title/blockers/delivery summaries above are ready for the to-tickets human check: does this granularity fit fresh contexts, are the blocking edges genuine, and should any slices merge or split? There is no unresolved product-contract question from the source analysis. Exact palette values, Nuxt UI composition and small justified adapters remain routine implementation choices within the frozen specification.

After human approval, publish one local implementation file per approved ID under the existing `tickets/` directory, with English titles, `type: implementation`, the repository's required frontmatter/triage roles, parent `../spec.md`, and titled relative `Blocked by` links. Initial lifecycle is `open` only for the available frontier and `blocked` for real unmet dependencies; `ready-for-agent` remains a triage role. Do not use the generic skill's alternate `issues/` directory, restart numbering at 01, or close/modify the source issue. The coordinator owns metadata/integration and later implementation dispatch; this proposal performs none of those actions.
