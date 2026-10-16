# Interface revamp: reduced implementation-ticket proposal

## Status and authority

**Proposal only: twelve tickets, IDs 18–29.** The human requested fewer tickets. [The reviewed twenty-ticket candidate](ticket-breakdown-20-slices-2026-10-16.md), SHA-256 `E71888A9A99D08A50675F01A8DDEDCE79A68033A452E952634D58CB30EB78CD8`, preserves the previous detail; its granularity was rejected, not its product contracts. This reduced breakdown still requires human approval before individual tickets are published. Decision tickets 01–17 remain unchanged.

Authority: [specification](../spec.md), SHA-256 `DF58B9D8715140A8F18D9F808FF83A2B1EBEC3F2596A2B23F37F1E51778E212F`, plus the human's explicit **last-ticket cleanup** requirement. Coordinator baseline: `f4aa1b4438217412c308e61733d862f3d71597ca`, equal to the feature remote, intentionally 0 main-only / 23 feature-only against `origin/main = 629d2a98715c3a16b954e0f77c639b1f0c31212c`. Issue 3 was refreshed unchanged/open/no comments. No application, runtime, Git, issue or individual-ticket changes are performed here; no checks are claimed executed beyond proposal validation.

Sources: [preservation matrix](../analysis.md#preservation-matrix-existing-and-future), [current Astra review](astra-current-interface-review-2026-10-16.md), [B1–B10 seams](spec-test-seams-2026-10-16.md), [independent constraints](ticket-decomposition-constraints-2026-10-16.md). No new domain terms/schema/renderer; no ADR directory is present.

## Boundaries and acceptance shared by all tickets

The current `/` defaults to a memory-only prototype; `?variant=baseline` reaches the retained persisted editor, while existing tests expect historical product forms at `/`. Ticket 18 restores the proper product/test target first. The retained feature-branch baseline shares changed styles/renderers and is not pristine main for performance comparison.

Ordinary commit already validates/publishes detached memory immediately but returns durable completion, which old forms await. Backup restoration intentionally publishes after durable replacement. Ticket 20 changes ordinary acknowledgement and latest-memory Retry through a working chart-name journey; later owners extend that contract. No generic foundation/store/command-bus prefactor is necessary.

The twelve units combine related existing workflows: object/Orbit Inspect, system creation, cluster construction, system manipulation, complete Fields and reviewed workspace changes. Ordered steps below are acceptance/delivery order **within one ticket**, not separately published pseudo-tickets. Larger units reuse established contracts and existing domain/workflow families. Existing valid imported/persisted fixtures avoid creation-only prerequisites for editing/export. Further compression would combine unrelated journeys; unexpected implementation complexity must be reported with evidence rather than silently adding tickets.

- Use Nuxt UI to the greatest practical extent: configuration/slots/adapters before bespoke equivalents, with the smallest justified exception documented. Prototype implementations have no exemption. Keep the SSR shell/client maps and one provider/CSS integration.
- Preserve every baseline command/outcome and authoritative domain validation while replacing presentation. Keep working legacy commands until their replacement works; no sample promotion, simulated persistence, placeholder controls or success for ignored values. Retain database `ttrpg-cluster-control`, marker `ttrpg-cluster-control-map`, schema/version, drag identities where retained, supported older shapes inside the current marker/version boundary, no migration/previous-marker fallback, and merged host/recovery corrections.
- Every introduced editor/command immediately uses parent-owned session draft identity/content/errors, targeted conflict refusal **before preview**, Apply/Discard/Stay, latest-memory validation/application and ordered autosave. Hidden ownership counts; independent commands remain available. Valid Apply ends its designated session/permits transition before durable acknowledgement. Failed saving retains applied data. Cancel affects only designated unapplied work; preparation is read-only and changed destructive effects require renewed review.
- Keep unconverted editors safely mounted during envelope rollout; hide/theme/reflow cannot introduce draft loss. Each assigned owner completes its adapter above presentation lifetime. Theme 19 is an explicit ancestor of 20's actual theme-toggle checks and all later consumers; no shadow completion gate.
- Every new surface/target verifies both themes, >=4.5:1 useful text and >=3:1 meaningful graphics/controls against actual adjacent/composited backgrounds, non-hue cues, readable names/help, visible unobscured focus, modal entry/return and keyboard/single-pointer alternatives. Accessibility is embedded, not deferred to the final ticket.
- Automate relevant mobile portrait/landscape/touch/reduced-height journeys from the introducing slice; 390×844, 844×390 and 390×500 are starting viewports. Measure unobscured usable map/form space and ordinary hit testing. Targeted **Android Chrome only** checks supplement automation for OS keyboard open/closed, portrait/landscape, safe areas, physical tap/drag/long press/second contact. Simulation does not prove device behavior. No new device/CI harness or Firefox mobile obligation; desktop scope remains baseline.
- Use existing browser Playwright/download/reload seams plus narrow codec/domain/storage regressions, not debug APIs or a new component harness. Each owner supplies affected behavior checks, appropriate typecheck/build and compiled-production hydration/portal/geometry checks. Evidence records source/runtime/product route, valid fixture, viewport/browser/device/input and passed/failed/unexecuted/unavailable limits. Historical counts are not current acceptance. Final cleanup reconciles earlier evidence and measures post-cleanup performance; it does not supply missing feature acceptance.

## Proposed numbered breakdown

### 18 — Open and recover the real local workspace at the product root

**Blocked by:** none; initial frontier.

**Delivers:** `/` creates a real Jump Cluster/first system, resumes saved work or offers actionable recovery rather than a disposable sample.

**Acceptance, in order:** capture a safe isolated retained-baseline check using its explicit route, then restore deliberate product-root tests while preserving working commands/user storage. Verify create/save/reload, loading, invalid/unavailable current snapshots and Try again. Exercise missing/damaged backup and failed/successful restore with durable-before-publication replacement and no editable partial data. Begin responsive welcome/recovery and compiled SSR/hydration evidence with source/fixture identity and a comparable measurement method.

**Scope/size:** launch/recovery only; no migration, whole-shell redesign or blanket test rewrite. Disconnect the prototype from the product entry now; remove residual experimental source in 29.

**Stories:** primary 1–3, 101–102; checks 89, 98, 107–111, 119–120. **B:** B1, B8, B9.

### 19 — Choose a coherent local light or dark presentation

**Blocked by:** 18 — acceptance must target the real product/SSR entry.

**Delivers:** one named theme control updates shell, maps, native controls and portals; the explicit device/browser preference survives sessions/workspaces and overrides later OS changes.

**Acceptance, in order:** follow OS preference until explicit choice, then persist that separate preference. Apply common tokens and actual contrast/non-color/focus states throughout existing surfaces. Preserve all data, drafts/errors, placements, selection, view/tool and saving state without a workspace save. Package every static/dynamic icon locally and prove cold glyph rendering with external Internet denied to both browser and server while the app remains reachable. Verify hydrated SSR and keyboard/touch/mobile portals.

**Scope/size:** shared palette/preference/resources, not a theme engine or all-form redesign. Image scenes are 28; later owners extend these tokens.

**Stories:** primary 103–111; checks 82, 89–90, 119–120. **B:** B4, B9.

### 20 — Rename charts with resumable drafts and trustworthy Apply/save recovery

**Blocked by:** 19 — actual theme-toggle draft-resumption checks need the working control; real storage from 18 is inherited.

**Delivers:** edit/hide/resume chart names, safely resolve transitions and distinguish an applied name from durable saving under failure.

**Acceptance, in order:** parent-owned chart draft/errors/reopening survive hide/theme/reflow; clean transitions do not prompt, while Apply/Discard/Stay and invalid Apply preserve/reset the exact designated target/context/view/tool. Validate latest memory, publish once and end the form/continue transition before durable acknowledgement. Fault real writes: retain memory and persistent Not saved/error, latest-memory Retry and current applied JSON excluding drafts/previews. Later edits/older completion cannot falsely claim Saved or replay commands. Keep draft/tool/save/export feedback distinct, scoped cancellation and supported departure warnings. Remove decorative footer only while relocating useful continuously reachable feedback. Preserve existing names/summaries, without descriptions.

**Scope/size:** chart journey plus existing single persistence owner/reusable guard contract; actual adapters follow in 22/24/26. Backup restore stays durable-first. Recovery JSON exists here before full interchange 27.

**Stories:** primary 66, 82–93, 99, 117; checks 7, 14, 23, 54–57, 100, 106, 109–110, 120. **B:** B1, B4, B5, B7, B9.

### 21 — Explore separate maps through the responsive Dock, Hierarchy and Inspect

**Blocked by:** 20 — context/selection/panel changes need working guarded-session acknowledgement.

**Delivers:** Navigate deliberately enters a system, Select requests its data, desktop maps coexist with optional nested panels, and compact Inspect/Hierarchy are fullscreen/exclusive.

**Acceptance, in order:** show context/names/Back, fit first visits and restore each map's session viewport/valid selection; clear deleted IDs. Short click/tap/Enter/Space differs from drag-pan over entities. Dock separates modes, creation and panel/file commands; retain one zoom set, wheel/keyboard/single-pointer view movement and 25–1600%. Panel opening/hiding/reflow preserves mode/progress and draft lifetime. Verify every compact opener/exclusive path, desktop Map files above Inspect, dialog layering/focus return, refused transitions retaining context/view/tool and accepted context changes resetting Navigate. Fit/target recovery uses actual unobscured area at short heights; long press in Navigate cancels pending activation before Inspect.

**Scope/size:** navigation/composition using current maps/editors. Retain functional legacy creation until 23 introduces anchored persistent Add through a real result; no abstract Add framework, renderer replacement or app context menu here.

**Stories:** primary 4–20, 23, 50, 53–54; checks 21–22, 24, 28–32, 44–46, 59, 82–86, 96, 105–111, 119–120. **B:** B1–B5, B9.

### 22 — Edit complete object and Orbit data through a resumable Inspector

**Blocked by:** 21 — consumes real selection/Inspector/guard presentation.

**Delivers:** full object/Orbit data and geometry are editable in readable visible sections, with owned hidden drafts, precise errors and reachable actions.

**Acceptance, in order:** deliver full-width long text, top Hide, persistent bottom Apply/Discard/status/error access, error-to-control navigation and separated reviewed Delete. Preserve object Name/unique Location key/Description, Other type text, placement/conditional coordinates, optional physical Station association for logical Jump Points, native/custom typed values including zero/false and ineligible stored values; Description and custom Session note remain distinct. Preserve Orbit axes, unoccupied Center X/Y, per-host order, rotation/Detach, nested structures and per-axis host-minimum notices; no ignored-value success. Both adapters survive presentation and refuse actual entity/host/placement/definition/deletion conflicts before preview while allowing independent commands; numeric geometry works in Select. Latest-memory Apply ends despite later save failure. Use readable domain labels throughout Inspector/Hierarchy/map names and keyboard-open long forms.

**Scope/size:** one existing selected-entity journey, sequentially extending the same envelope/owner for two system target types. Fixtures supply entities. Route form is 24, Fields is 26, gestures/creation are separate. Preserve working reviewed Delete until 27.

**Stories:** primary 22, 55–63; checks 33, 38–43, 51–52, 78, 82–96, 105–110, 120. **B:** B1, B4–B7, B9.

### 23 — Populate star systems with every catalogue type and Orbit structure

**Blocked by:** 22 — actual object/Orbit draft dependency authority must reject conflicting creation before preview.

**Delivers:** place every one of fifteen catalogue subtypes, including Other, at free/Orbit positions, and create hosted/unoccupied-center Orbits through an anchored persistent Add chooser.

**Acceptance, in order:** introduce real chooser, same-type lifetime, type/next-target/Quit and compact context-banner reuse through working system creation. Retain Back/context and Inspect on demand. Dismissal consumes Escape/outside input before map quit/placement, preserving progress/type/drafts; Quit drops only unfinished work. Place at the actual transformed/rotated/nested target, never a fixed angle. Indicate candidates without hover, explicitly resolve overlap, explain invalid targets without mutation/reset, and provide keyboard/single-pointer preview/Confirm/Cancel/coordinates/Orbit-position alternatives. Add Orbit chooses object host or unoccupied center with nested validation and independent per-axis corrections/notices. Pan/takeover/cancel/interruption cannot publish partial creation; valid completion publishes once with real save-failure/JSON/reload checks.

**Scope/size:** existing system creation catalogue, two result families sharing targeting/lifetime. This real first Add journey supplies reusable chooser behavior for cluster ticket 24; no horizontal prefactor, manipulation handles, Fields editor or defaults-generator change.

**Stories:** primary 24–25, 27–37, 51–52; checks 26, 40, 43–46, 49, 60, 82–93, 96, 107–111, 120. **B:** B1–B5, B7, B9.

### 24 — Construct and arrange a Jump Cluster with complete Jump Routes

**Blocked by:** 23 — consumes the proven anchored persistent Add journey; 22's Inspector/Jump Point contracts are inherited.

**Delivers:** add systems without leaving the cluster, deliberately move them and create/edit known/unresolved Jump Routes while retaining safe progress.

**Acceptance, in order:** repeat Add System at intended destinations without auto-entry/Inspect or draft loss, reusing chooser/status/Quit/explicit alternatives. Move systems by once-only valid release or preview/Confirm/Cancel/coordinates. In the **cluster wrapper**, verify Navigate/Select pan, two-contact/right-pan in every mode, interruption/tool changes/long-press Inspect: cancel preview before takeover and suppress late release/click/system entry; preserve native stationary right-click outside recognized pan. Add Route keeps origin/stage during pan/zoom without partial data and resets both endpoints after completion. Full route Inspector retains From Jump Point, known/unresolved To Jump Point/external label, levels 1–9/higher positive integers and resumable endpoint ownership/guards. Resolve ambiguity/refusal, clear stale origins and retain applied results under save failure without replay. Label preview links as fresh previews rather than unsaved-workspace sharing.

**Scope/size:** existing cluster construction/arrangement family in delivery order. Fixtures supply endpoints; no catalogue creation, system geometry or schema changes. Cluster input requires its own evidence.

**Stories:** primary 21, 26, 44–49, 64–65, 118; checks 15–20, 23–25, 27–32, 36–37, 50–59, 82–96, 105–111, 120. **B:** B1–B7, B9.

### 25 — Reposition objects and manipulate Orbit geometry safely

**Blocked by:** 23 — consumes actual destination/candidate/Confirm targeting and inherits 22's commands/draft exclusion. No cluster-construction dependency.

**Delivers:** Move changes object placement/attachment and Orbit axes/rotation/centers deliberately, with coherent dependents and equivalent precise controls.

**Acceptance, in order:** attached-object drag into empty space retains its Orbit/changes position; explicit valid Orbit targeting transfers/attaches, and attached-to-free is explicit. Transform nested/rotated targets correctly and move hosted/nested dependents in previews/commits. Named Orbit controls provide independent axes, uniform ring resize, rotation/unoccupied-center movement; hosted centers require Detach and attachable centers indicate valid hosts. Preserve cycles/order/geometry/host-minimum notices/expanding scenes and focused/keyboard/numeric/Confirm alternatives. In the **system wrapper**, test every mode over entities/handles with second-contact/right-pan, interruption/tool/Escape/long press and suppressed late release, alongside normal once-only commit. Refuse dependency conflicts before preview; permit independent navigation. Verify applied versus canceled outcomes in JSON/reload/save failure.

**Scope/size:** existing system manipulation family, same renderer/commands/targeting. Cluster evidence is 24; no new geometry model. Integrate image exclusion checks for new previews with 28.

**Stories:** primary 38–43; checks 21–23, 34–37, 44–46, 49–54, 60, 63, 82–93, 96, 107–110, 120. **B:** B1–B5, B7, B9.

### 26 — Consult, edit and create Fields without losing work or assignments

**Blocked by:** 22 — object draft/definition conflicts must resolve through the real owner; 20/21 session/presentation contracts are inherited.

**Delivers:** Fields/Manage resume one session for consultation, explicit editing, custom creation and reviewed assignment changes.

**Acceptance, in order:** list → saved detail → Edit; compact full-area screens versus bounded centered desktop columns. Show type/choices/applicability/assignments. Back restores list position/highlight/focus; Close hides/returns to the actual opener, retaining map/editor/session. Manage invents no target. Definition/creation drafts survive Back/hide/theme/reflow; modified target/New changes use Apply/Discard/Stay, clean changes do not prompt. One guarded New entry per screen supports text/number/boolean/single-select/choices; success opens new read-only detail, explicit Cancel returns without creation, Close retains draft. Preserve native options/applicability/ineligible values/zero/false. Prepare type/option/deletion impacts read-only before object-draft resolution, reprepare/renew changed consequences after Apply and preserve work on Cancel/invalidity. Selected deletion returns to a valid row/list control, clears IDs and never defaults to Atmosphere. Memory-first acknowledgement/Retry cannot duplicate creation. Compact header/internal scroll/bottom actions/reviews/errors work with Android Chrome keyboard open/closed.

**Scope/size:** the existing full Fields lifecycle in ordered consultation/edit/create/impact steps, reusing controls/domain logic. No extra types, durable drafts or form builder. Establish freshness through real field changes; 27 reuses the semantic contract.

**Stories:** primary 67–81; checks 14–16, 55–57, 61–62, 82–96, 105–111, 120. **B:** B1, B4–B7, B9.

### 27 — Review destructive changes and exchange independent JSON copies safely

**Blocked by:** 24 — route/endpoint owner and cluster pending targets must work; 26 — Fields owners and reviewed-plan freshness/resolution must work. Object/Orbit owners are inherited; no image/system-gesture prerequisite.

**Delivers:** review current deletion/import consequences without losing drafts, confirm an accurate change and exchange complete applied cluster/system JSON.

**Acceptance, in order:** separated/protected Delete prepares actual cascades read-only, resolves ownership at confirmation and recomputes/renews changed effects after another Apply. Cancel/validation publishes nothing. Clear deleted selections/per-view IDs/drafts/pending targets/references, retaining unrelated work and fresh subsequent creation contracts. Parse/validate import before draft resolution; show collisions/possible matches and confirm an independent ID-remapped copy with references/applicability correct and current work retained, never silent merge/replacement. Reuse freshness/resolution without a new global engine. Preserve cluster/system geometry/native/custom data and supported older route/circle/ellipse/applicability shapes under unchanged marker/version/no-fallback. Current JSON includes latest applied memory under failed saving and excludes drafts/previews/UI state. Invalid/canceled/download failures preserve work; successful export cannot clear save failure; valid application survives subsequent storage failure with Retry/recovery JSON. Verify downloads/reload/menu/review reachability.

**Scope/size:** one reviewed workspace-change/files journey across existing cascade/import/codec commands. No migration/merge/undo/defaults fix/related closure. Early recovery JSON stays available. Owners 23/25 integrate their own pending-target invalidation rather than forcing an all-gestures dependency.

**Stories:** primary 94–98, 100; checks 3, 9, 15, 27, 36–43, 47–49, 58, 61, 78–80, 82–93, 99, 107–110, 120. **B:** B1, B4–B9.

### 28 — Export clean complete SVG and PNG in active or print light palettes

**Blocked by:** 21 — real map/files context plus inherited 20 applied-state and 19 palette contracts. Fixtures avoid full creation/Fields/destruction dependencies.

**Delivers:** standalone SVG/matching PNG contain the full applied map in active light/dark or export-only Light for printing, independently of viewport/failed save.

**Acceptance, in order:** applied-only scene/bounds include off-viewport geometry and long applied system title band. Exclude selection/focus/hover/handles/drafts/gesture/candidate previews **before bounds**, retaining meaningful map/unresolved cues. Resolve export palette without changing live preference; standalone SVG and PNG match arrangement/palette/title/bounds. Exercise both maps × active-light/active-dark/print × SVG/PNG with dense content/hidden draft/preview/failed save. Before/after applied JSON/live state proves no selection/view/tool/gesture/draft/theme/save mutation, implicit Apply/Discard or conflated export error. New target owners extend exclusion checks as introduced.

**Scope/size:** existing export-result seam, not a renderer or player/secrecy filter. Independent early branch consumes stable applied/palette contracts.

**Stories:** primary 112–116; checks 15, 55–57, 82–93, 99–100, 103–110, 120. **B:** B1, B4, B7, B9–B10.

### 29 — Finish the production editor and retire the revamp experiments

**Blocked by:** 25, 27, 28 — terminal closure includes **every ticket 18–28**. All earlier tickets must be closed before starting; this stays **last**.

**Delivers:** the real product ships no disposable comparison behavior, and maintainers receive consolidated docs/provenance plus truthful final acceptance.

**Acceptance, in order:** inventory/classify canonical/archive/remove before usage-audited cleanup. Coordinator estimate: 510 tracked effort files/50 Markdown docs, eight product-tree `Prototype*.vue` components/two fixtures. Remove residual sample/prototype routes/flags/seeds/comparisons/imports/navigation and unused components/assets/scripts/dependencies/config/harnesses; prove absence from route graph/SSR/production bundles. Keep valid necessary fixtures tests-only and preserve database/schema/compatibility/shared integration. Consolidate **all effort-created documentation**, repair links/indexes and archive superseded material without losing accepted rationale/hashes/runtime/device identity/failures. No blind `.scratch`/capture/untracked user/log/unrelated deletion; collection inventory need not inline-read every historical capture. After cleanup run integrated parity/browser, typecheck/build, compiled SSR/portal/local-resource and codec/storage/export regressions. Reconcile B1–B10, targeted Chrome OS-keyboard/physical gestures and keyboard/screen-reader evidence honestly. Measure final production initial/deferred JS/CSS/resources/startup/mount/overlays/pan/zoom **after comparison removal**, using comparable baseline arms only, reporting missing arms and investigating material regressions without invented budgets/library-only claims.

**Scope/size:** bounded final cleanup/integration, not deferred feature implementation/accessibility/testing. Mechanical steps remain within this final ticket rather than extra publications. No merge/deploy/release/GitHub closure authorization.

**Stories:** primary 119–120 plus cleanup amendment; mandatory regression 1–118. **B:** B1–B10 and final performance/evidence consolidation.

## Direct graph and frontier

```text
18 → 19 → 20 → 21
21 → 22, 28
22 → 23, 26
23 → 24, 25
24 + 26 → 27
25 + 27 + 28 → 29 (all 18–28 closed; last)
```

Initial frontier **18**, then **19 → 20 → 21**. After 21: **22/28** independently; after 22: **23/26**; after 23: **24/25**; after 24/26: **27**. Shared-file/concurrency/review rules still govern actual dispatch. Every direct edge is nonredundant. No fixture-only or hidden acceptance gate; the first real Add journey 23 precedes its cluster reuse 24 rather than putting an abstract framework in 21.

## Exact story ownership and mandatory extensions

All 120 stories have one primary accountable ticket. Crosscutting satisfaction requires both primary delivery and mandatory owner extensions; one chart draft cannot prove every draft, and final reconciliation cannot supply missing feature checks.

| Specification stories | Primary ticket | Mandatory extensions/check owners |
| --- | --- | --- |
| 1–3 | 18 | 20, 27, 29 |
| 4–17 | 21 | 23–24, 26–28; every deletion/target adapter clears remembered IDs |
| 18–20 | 21 | 23–25, both wrappers |
| 21 | 24 | 25 object/Orbit Move |
| 22 | 22 | 24 route form |
| 23 | 21 | Every new panel/tool owner 22–27 |
| 24–25 | 23 | 24 cluster Add, 25 takeover |
| 26 | 24 | 23 shared Add |
| 27–37 | 23 | 24 cluster/routes, 25 attachment, 22 object data |
| 38–43 | 25 | 22 numeric/host correction, 23 creation |
| 44–49 | 24 | 21 navigation, 23 creation, **25 separate system wrapper/handles** |
| 50 | 21 | 24–25 Move/preview suppression |
| 51–52 | 23 | 21–22, 24–25; every result has alternatives |
| 53–54 | 21 | 20, 23–25, 27 |
| 55–63 | 22 | 24 route, 26 Fields, 27 Delete; all targets' labels |
| 64–65 | 24 | 22 logical/physical identity, 27 interchange |
| 66 | 20 | 21 context, 28 applied title |
| 67–81 | 26 | 22 object conflicts, 29 final Chrome gate |
| 82–86 | 20 | **22 object/Orbit, 24 route, 26 definition/creation**; all adapters 21–27 |
| 87–93 | 20 | All mutating owners 22–27; 18 durable-first restore |
| 94–96 | 27 | **26 field impacts**, 23–26 pending-target cleanup |
| 97–98 | 27 | 18/20 and each data/geometry/Fields owner's invariants |
| 99 | 20 | 27 JSON scope, 28 applied-only images |
| 100 | 27 | 20, 26, 28 failure/cancel preservation |
| 101–102 | 18 | 20, 27, 29 recovery/storage regressions |
| 103–106 | 19 | Every later surface, especially 21–22, 24, 26, 28 |
| 107–111 | 19 | **Every introducing UI/map/export owner**; 29 only reconciles |
| 112–116 | 28 | 22–26 new draft/preview exclusions/live-state checks |
| 117 | 20 | 21–22, 24, 26, 29 retain reachable feedback |
| 118 | 24 | 29 removes obsolete links, no remote sharing claim |
| 119 | 29 | 18 baseline/SSR/method; 19 resources; 21/26 portals; all owners' responsiveness |
| 120 | 29 | **Every relevant owner** automates mobile/supplies targeted device checks |

## B1–B10 ownership

| Scenario family | Introducing/delivery owners | Final reconciliation |
| --- | --- | --- |
| B1 real resumed workflow/full parity | 18, 20, 22–27 | 29 focused cases, not one giant smoke |
| B2 intents/creation lifetime | 21, 23–24 | 29 both maps |
| B3 takeover/cancellation | 21, 23 creation, **24 cluster**, **25 system/handles** | 29 physical second-contact limits |
| B4 draft lifetime | 20 chart, 22 object/Orbit, 24 route, 26 definition/creation | 29 all six owners/errors |
| B5 guards/dependencies | 20–27 as introduced | 29 hidden conflicts and independent actions |
| B6 Fields/refreshed reviews | 26 Fields, 27 cascades/import, 22 object conflict | 29 stale IDs/renewed footprints |
| B7 Apply/save/latest Retry | 20 first real visible failure; later mutating owners | 29 no replay/duplicate/stale Saved |
| B8 load/backup recovery | 18, preserved after 20/27 | 29 durable-first exception |
| B9 theme/resources/accessibility | 19 shared; every introducing owner | 29 actual Chrome/assistive/cold-resource checks |
| B10 clean image result | 28; every new preview/draft owner | 29 standalone files/live-state preservation |

## Approval and publication handoff

The twelve-ticket breakdown is ready for the human granularity/edge check. No new product-contract question is unresolved; palette values, Nuxt UI composition and small evidence-based adapters remain implementation choices. The independent export branch and final cleanup are preserved.

After approval, publish one English local implementation ticket per approved ID under existing `tickets/`, with required frontmatter, `type: implementation`, parent `../spec.md`, separate triage roles and titled relative blocker links. Lifecycle initially `open` only for the frontier, otherwise `blocked`; `ready-for-agent` is a triage role. Do not restart numbering, use generic `issues/`, modify decision tickets or close/change the source issue. Metadata/integration and implementation dispatch remain coordinator-owned. No actual implementation tickets have been written.
