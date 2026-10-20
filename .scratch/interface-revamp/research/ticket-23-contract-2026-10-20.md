# Ticket 23 implementation contract

## Baseline and boundary

2026-10-20 architecture/domain inspection for the coordinator. The coordinator supplied the freshly fetched intentional feature baseline `0bd3b33d106fa0631ed7dbd5f6e73af018e1422e`, equal to the feature remote; `origin/main` is `629d2a98715c3a16b954e0f77c639b1f0c31212c`, with 0 main-only / 44 feature-only commits. This artifact is the only file owned by this analysis. No application, browser, Git, storage or test execution occurred here.

Authority: local ticket 23; specification stories 24–25, 27–37 and 51–52 and its crosscutting checks; tools decisions 11/12; accepted B/Dock and Dock-feedback evidence; completed ticket 22 contract/execution; `CONTEXT.md` and `docs/agents/domain.md`. There is no `docs/adr/` directory. No new domain term or ADR is necessary. This implements the real persisted product at `/`; `/?variant=B&controls=dock` supplies the accepted presentation comparison only.

Exclude cluster construction 24, manipulation 25, Fields 26, generator changes, schema/codec/version changes, a new renderer and a production test API. Existing native drag identities remain supported. The human separately requested the bounded Chart details presentation repair in the appendix.

## Actual capabilities and gaps

| Current source seam | Preserve / change |
| --- | --- |
| `WorkspaceDock.vue` already wraps the actual Add trigger in installed Nuxt UI `UPopover`, with collision bounds and a scrollable portal. | Retain this anchor. Palette activation currently calls `addObject`/`addOrbit` immediately; it does not arm persistent Add. Introduce one parent-owned creation session, not another chooser framework. |
| `ObjectPalette.vue` has all 15 catalogue subtypes, family controls and native object/Orbit MIME drags. | Use its existing catalogue data and marks, upgrade controls to Nuxt UI, and change activation into type selection. Do not lose Other custom subtype text. |
| `useMapWorkflows.addObject` supports free scene drops, Orbit IDs and angles; `addOrbit` supports host/unoccupied drops. Both use generated identities/domain functions. | Reuse these domain constructors and latest-workspace replacement, but route system creation through one atomic immediate-memory application. Existing click creation uses selected targets/default positions; that must become the explicit arm → target → preview → Confirm journey. |
| `system-map-renderer.ts` resolves drops with `pointer(event, content)`, and geometry resolves rotated elliptical and nested Orbits. | Reuse `objectPositions`, `orbitCenter`, `orbitRadii`, `orbitRotation`, `orbitAngleAtPoint`, `orbitPointAtAngle`, `toNormalizedMapPoint`. `orbitAtPoint` returns only the nearest candidate; creation needs all eligible candidates and an explicit ambiguity choice. |
| `WorkspaceMapCanvas.vue` already owns right-pan, two-touch takeover, long-press, click suppression, pointer cancellation, blur and visibility handling. | Extend this arbitration for Add. Do not duplicate these listeners in a second map surface or weaken Move behavior. |
| Ticket 22 owns entity sessions and `isEntityCommandBlocked`. `orbit-create` already blocks creation of a sibling of an edited Orbit. | Invoke this authority before any preview and again before publication. The current drop's fake `object-placement` with `objectId: ''` is not a meaningful creation contract. |
| `WorkspaceMapChrome.vue` owns context, Back and on-demand Inspect; compact panels hide dock/zoom. | Replace the context-summary contents while Add is active with type, next target/status and Quit Add. Retain the context name and Back. Do not insert another permanent compact row. |
| `useLocalWorkspace.applyWorkspace` publishes synchronously and returns `durable`; existing feedback handles retry/applied JSON recovery. | Use this exact boundary. Durable failure must not leave Confirm armed to publish the same entity again. Retain database, marker, codec and backup-restoration ordering. |

One hidden preservation issue matters: `objectPositions` distributes objects with missing saved angles using occupant count. Appending an object can move older occupants even if the new object has an explicit angle. On the affected destination Orbit only, materialize each existing occupant's currently effective angle when it has no saved angle, in the same valid creation publication. Leave all explicit angles and other Orbits untouched. This preserves observed geometry without changing the default generator. The coordinator explicitly accepted this bounded correction.

## Small shared contract

Writer A defines the following in `composables/editor-workflows/types.ts` before Writer B begins. Existing names may be reused only with these units and semantics. No state is durable until Confirm/native valid drop.

```ts
type SystemCreationType =
  | { kind: 'object'; subtype: CatalogueSubtype }
  | { kind: 'orbit' }

type SystemCreationTarget =
  | { kind: 'free'; point: Point } // normalized system coordinates; no [0,1] clamp
  | { kind: 'orbit'; orbitId: string; angle: number } // radians
  | { kind: 'host'; objectId: string }

type SystemCreationCandidate = {
  key: string
  label: string
  target: SystemCreationTarget
  error: string | null // includes actual Inspector conflict; never silently filter it
}

type SystemCreationPreview = {
  id: number // one completion token, consumed synchronously on application
  target: SystemCreationTarget
  radii?: OrbitRadii // scene units; Orbit creation only
  rotation?: number // degrees; Orbit creation only
}

type SystemCreationSession = {
  id: number
  clusterId: string
  systemId: string
  type: SystemCreationType
  candidates: SystemCreationCandidate[]
  preview: SystemCreationPreview | null
  inputs: {
    x: string; y: string; orbitId: string; angleDegrees: string
    hostId: string; horizontalRadius: string; verticalRadius: string
    rotation: string; otherType: string
  }
  errors: Record<string, string>
  notice: string
}
```

Use one small `useSystemCreationWorkflows.ts`, composed by `useEditorWorkflows`, with workspace/applyWorkspace, selected system/context and `isEntityCommandBlocked` supplied from existing owners. It exposes `creationSession`, `chooseCreationType(type)`, `offerCreationCandidates(candidates)`, `previewCreation(target)`, `confirmCreation(previewId): boolean`, `cancelCreationPreview()` and `quitAdd()`. Input mutation remains parent-owned; components receive the session and emit intentions. Chooser open/closed is separate presentation state and is never a proxy for Add lifetime. Keep it controlled above the popover so panel opening and the canvas see the same value.

`previewCreation` resolves the captured cluster/system against latest memory, validates type/target/input, checks the real command predicate, and only then sets a preview. Invalid work retains type, inputs and explanation; it neither publishes nor clears an older Inspector session. Ambiguity sets candidates and requires activating a named candidate before a preview; do not choose by SVG stacking order. `confirmCreation` repeats latest-memory validation and consumes exactly its still-current preview ID. No asynchronous confirmation window exists before memory application. Build the next workspace on latest memory, apply once, clear only that preview/candidates, retain the type and reusable inputs, and attach `durable.catch` handling through the existing save owner. A synchronous validation/application error retains correctable inputs/error and publishes nothing.

Prefer one creation owner over leaving old workflow methods as competing mutation paths. Existing `addObject`/`addOrbit`/drop adapters may delegate to it for compatibility, but all creation publication must end at the same completion routine. `useMapWorkflows` continues to own existing manipulation commands. Do not clear `editorError` as a way to erase save-owner recovery.

Extend `EntityCommand` with `{ kind: 'object-create'; orbitId: string | null }`. Handle it explicitly in `useEntityInspectorSession.isEntityCommandBlocked`; current append-only object creation, including angle materialization with identical effective positions, changes none of the captured entity/placement/definition dependencies and is independent. It therefore returns false after the authority's existing session checks. Orbit creation keeps `{ kind: 'orbit-create'; hostId }`: a modified Orbit draft with that same host has a sibling-order conflict and must reject before preview. A different-host Orbit or creating an object does not become a whole-system draft lock. Do not invent an empty object ID or block merely because Inspect is open. The creation owner still validates that the destination/host exists and resolves valid nested geometry at both stages.

Add narrow map contracts:

```ts
// SystemMap/renderer event, forwarded by WorkspaceMapCanvas only in Add:
'creation-target': [candidates: SystemCreationCandidate[]]
'cancel-creation-preview': []

// props through WorkspaceMapCanvas → SystemMap → existing renderer:
creationType: SystemCreationType | null
creationPreview: SystemCreationPreview | null
creationChooserOpen: boolean

// Existing SystemMapHandle extension, ordinary application capability:
getCreationCandidates(point: Point, type: SystemCreationType): SystemCreationCandidate[]
// point is raw scene coordinates, not normalized or client coordinates
```

The renderer's click/tap target resolver and this handle call the same pure candidate calculation. Add `creationCandidatesAtPoint` beside the existing geometry functions; do not replace manipulation's existing nearest-target semantics in ticket 23. The resolver enumerates nearby ellipse candidates with projected points/angles and nearby object hosts, with readable names and invalid reasons. Keep existing scene-unit Orbit tolerance initially; validate actual compact touch targets rather than silently changing global geometry. A free point is offered only where the chosen result permits empty space; an object mark is not silently treated as an empty center. Multiple valid overlapping rings/hosts require the named choice, including alternatives reachable without hover. Native drop payloads use the same resolver and authority: unambiguous valid release may complete once; ambiguous/invalid release offers correction without publication. Drag cancellation publishes nothing.

## Lifecycle, geometry and accessible UI

Choosing a type closes the chooser and arms Add without creation. The map modes stay `navigate | select | move`; active creation is the separate persistent intent, visibly reflected in Dock/status and taking precedence over ordinary short map selection. Success never calls `selectObject`/`selectOrbit` in a way that retargets or opens an Inspector. Preserve any selected/edited entity and its draft; announce the newly created readable name and leave explicit Inspect available. A later deliberate Select/Inspect action follows existing guards.

Type changes cancel only unfinished creation. Cancel in the preview drops that target/geometry preview and returns to choosing another target with the same type. Quit Add or Escape on the map drops the unfinished session and returns to Navigate. Chooser dismissal changes neither session nor progress. Opening/hiding panels or reflow/theme retains type, inputs and validation errors; panel opening closes chooser presentation. Accepted effective map navigation ends Add through the existing successful context transition; a refused transition preserves it. No context request may clear the session before its draft guard succeeds.

Use raw `pointer(event, .system-map-content)` for pointer targeting, including pan/zoom; for the chosen Orbit use resolved nested host center, saved independent axes and rotation in `orbitAngleAtPoint`. Persist exactly that parameter angle. The projected preview must use `orbitPointAtAngle` with the same data, never a fixed angle or viewport-normalized approximation. Coordinate controls use explicit finite nonblank normalized X/Y; Orbit position controls select a named Orbit and parameter angle in degrees, converted to radians once. No hidden clamping to the original board is allowed.

Provide a compact Nuxt UI precision surface reached by a readable “Placement” action in Add status, with named free X/Y or Orbit/position fields, and hosted/unoccupied center choices for Orbit. It exposes Preview, Confirm and Cancel as appropriate. A map click/tap also presents the indicated preview and the same Confirm/Cancel actions. Use `UFormField`, `UInput`/`UInputNumber`, `USelect` and `UButton`, with validation errors next to controls. Preserve input strings to distinguish blank from zero. A small anchored `UPopover` for precision is sufficient; do not create a permanent extra toolbar or open the object Inspector automatically. Visible preview graphics/text are noninteractive, excluded from export and identify the proposed target without color alone.

For Add Orbit, target an existing catalogue-object host or a finite unoccupied center; any catalogue object may host nested Orbits. Use `createOrbit` for ID/order and `defaultOrbitRadius`/`minimumOrbitRadius` for defaults and minimums. Never modify an existing Orbit to fake creation. Validate both radius inputs independently; round and clamp each to the host minimum as existing commands do, preserving a valid larger companion axis. Show which axis was corrected and its resulting value; one axis correction must not overwrite the other or be hidden by ordinary save status. Reject blank/nonfinite axes and rotation, normalize finite rotation, retain target/inputs. Validate nested host geometry with existing resolution; do not invent host-family restrictions or require whole-ring nonintersection, which the domain does not guarantee.

Creation preview does not alter domain memory. On right-pan, two-contact takeover, pointer/touch cancel, blur, hidden document, lost/canceled gesture, mode change or map unmount, discard the live geometric preview and suppress its trailing release/click. Retain Add type and nongeometric input choices until explicit exit/context change; Inspector drafts and committed entities remain. Extend the existing canvas arbitration, including fresh-sequence suppression reset, rather than introducing a time-only global click blocker. No Add long-press behavior is introduced. View navigation must retain its existing keyboard/pointer alternatives.

## Installed Nuxt UI fit and dismissal

Inspected installed `@nuxt/ui` 4.11.3 `Popover.vue`/`Popover.d.vue.ts`, overlay utility, and Reka UI 2.10.5 Popover/DismissableLayer source. `UPopover.content` accepts placement options **and** `onEscapeKeyDown`, `onPointerDownOutside`, `onInteractOutside`, `onCloseAutoFocus` handlers; the public component itself emits only open-change/close-prevent. Use these supported hooks, the real trigger slot, portal/collision configuration and available-size CSS variables. Do not guess unsupported top-level emits. Nonmodal Reka explicitly allows outside pointer events, and Nuxt's stock outside helper does not consume map actions; touch dismissal can be deferred to click.

Smallest preferred adaptation: use an anchored **modal UPopover for the catalogue while open**, with library focus scope/outside-pointer blocking. Its installed modal implementation traps focus, hides background from assistive technology and restores the actual trigger. Consume Escape in the content hook (`preventDefault`, stop propagation, close presentation explicitly); do not let the same key reach a map-level Quit handler. Outside dismissal must also consume the complete originating pointer/click sequence. Verify that with ordinary mouse and touch hits; if a release still reaches the canvas, add a narrow creation-chooser sequence latch to the existing canvas arbitration, cleared on the next fresh sequence. Do not replace the library popover with a bespoke overlay. Modal behavior lasts only while choosing; the map remains available once it closes. A higher dialog owns dismissal first.

Document any necessary exception at its smallest seam: SVG/D3 candidate/preview drawing and gesture arbitration have no Nuxt UI substitute. Everything surrounding them—chooser, labelled type controls, precision form, ambiguity list, buttons and status styling—uses Nuxt UI configuration/slots first. Keep existing single provider/CSS integration and explicit popup stacking above chrome/below full-height panels. Prototype CSS is composition evidence, not a blanket custom-component exception.

## Writers, first RED and verification

**Evidence-based compatibility amendment:** the later source review confirms that installed modal Popover hard-codes background accessibility and pointer blocking, which prevents the preserved ordinary native drag-to-map seam. Use the anchored nonmodal Nuxt UPopover with one Dock-owned document-capture outside-dismissal sequence adapter instead. Consume only the originating outside pointer/touch/release/click, preserve keyboard activation, higher dialogs, Add progress and native drag source lifetime; clean listeners on unmount. Do not add a second Canvas latch/API or force hidden test hits. The [implementation record](implementation-23-2026-10-20.md#native-chooser-compatibility-clarification) records the independent source evidence and exact handoff. Real native drag and first-event mouse/touch dismissal still require QA.

At most two implementation writers, with disjoint ownership after the shared types are frozen. QA alone runs servers/browsers/typecheck/build/tests; coordinator alone changes Git/planning and freezes all repository writes during watched runtime.

| Writer | Exclusive ownership |
| --- | --- |
| A: session, product composition and test compatibility | `types.ts`, `useSystemCreationWorkflows.ts`, `useMapWorkflows.ts` creation adapters only, `useEntityInspectorSession.ts` predicate, `useEditorWorkflows.ts`, `BaselinePage.vue`, `WorkspaceDock.vue`, `WorkspaceMapChrome.vue`, `ObjectPalette.vue`, new creation-form component if needed; `tests/helpers.ts` and existing tests needing intentional creation setup updates; `tests/workspace-system-creation.spec.ts`. Also the serialized Chart details appendix below. |
| B: map targeting and interruption | `WorkspaceMapCanvas.vue`, `SystemMap.vue`, `components/maps/system-map-renderer.ts`, `utils/system-map-geometry.ts`; `tests/workspace-system-creation-geometry.spec.ts` and its one new dense/rotated/nested import fixture. No page/workflow/types/helper edits. |

A first adds one real-product RED journey: ordinary Add → Planet selects type but creates nothing; click target → visible preview creates nothing; Confirm creates one object at the requested coordinates; repeat another target without reopening catalogue; Inspect stays closed; export JSON and reload retain both. QA records its actual baseline failure before implementation. A then implements this thin end-to-end path using B's minimal target-event support; freeze and run it before expanding Orbit/ambiguity/interruption. Shared interfaces precede parallel changes, not a horizontal refactor.

A audits existing `addCatalogueObject` and `clickDockAction('Add orbit')` callers up front. They currently assume immediate creation. Adapt shared helpers to perform **public** explicit placement/Preview/Confirm for legacy setup, with optional explicit target parameters where an old selected Orbit/host matters. Update direct callers that require it; do not emulate removed commands, weaken value assertions, force clicks or leave dozens of unrelated tests failing until the final run. Keep native HTML drag helpers on their real valid-release path. New Add tests must use the new public flow directly so compatibility helpers cannot hide lifetime regressions.

Keep a few integrated journeys, not an exhaustive device/type cross product:

1. Repeated catalogue workflow above plus a 15-subtype loop on one valid imported system, with distinct exported families/subtypes/keys, Other custom type text via ordinary controls/Inspector, no forced Inspect and reload verification.
2. Rotated, elliptical, nested and transformed Orbit placement with at least two distinct pointer targets; explicit overlap choice; invalid/blocked target explanation with unchanged JSON; precise keyboard/one-pointer coordinates and Orbit-position alternative. Include an older missing-angle occupant and compare its independently fixed fixture scene position before/after append, rather than restating the implementation's angle formula.
3. Hosted/unoccupied Orbit creation, nested host, independent asymmetric-axis correction and notice, malformed input no change; modified same-host Orbit Inspector draft refuses before preview, while a different host and independent object creation remain possible with the draft intact.
4. A short interruption/dismissal/recovery journey: chooser Escape/outside touch consumes first event and retains Add; right-pan/two-touch/cancel/blur produce no partial entity or trailing click; preview Cancel and Quit preserve committed work/drafts; abort one real IndexedDB write, prove one in-memory result and applied JSON, retry then durable reload. Reuse existing failure interception and download/import/reload seams.

Fold assertions into coherent cases where practical. Preserve existing gesture/domain/storage suites and their original assertions/timeouts. Run focused checks per changed seam, appropriate typecheck/build, and the coordinator's one full-suite gate. The existing private Vite-only storage proof must run in development; no production test API is added to make it pass in compiled output.

Compare actual product with B/Dock at comparable desktop, portrait and short-landscape state/theme: full map board, bottom mode/Add Dock, context replacement, one zoom set, optional desktop overlays and exclusive compact panels. Ordinary hit testing/focus must cover chooser over chrome, precision/Confirm/Quit reachability and Back/Inspect. Record structural differences (persisted product precision/recovery versus memory-only B), measured relevant contrast and actual viewport/input/source/runtime identity. The accepted later context-banner decision supersedes the prototype's extra Add-status strip; copying that strip would fail the agreed composition. Physical Android Chrome keyboard/safe-area/gesture gates remain unavailable without a supplied device; emulation is not physical proof.

## Appendix: bounded Chart details presentation amendment

The human identified an isolated outer X row, redundant Chart details heading/button treatment and unpadded summary/counts. This is an authorized presentation repair, not a chart-name lifecycle change. Writer A performs it **before** parallel Add work if shared Inspector composition could overlap, owning only `components/inspector/ChartDetailsPanel.vue`, `components/MapInspector.vue` and the smallest shared-close layout correction if source evidence requires it. Existing `MapEditorLayout` currently asks `WorkspaceResizablePanel` to show its outer close for non-entity consultation; changing body padding alone cannot remove that row. Prefer leaving the working shared close contract and integrating its visual alignment with the summary header using Nuxt UI slots/configuration; do not start a global panel rewrite. If a source change in `MapEditorLayout.vue`/`WorkspaceResizablePanel.vue` is unavoidable, reserve it to A and keep it consultation-only, with the existing hide event/focus restoration.

Use one coherent padded summary with a modest uppercase `CHART DETAILS`/`CLUSTER DETAILS` kicker, readable chart name/intro, Nuxt UI Edit/Resume action and a tidy aligned statistics definition list. Use `UCard` slots/configuration or equivalent existing panel composition, `UButton` and `USeparator` before custom framing. Preserve the keyboard-accessible **Chart details** control and its `aria-pressed=true` active semantics, including while already active; treat it as compact navigation in the header rather than a second large title. Existing tests explicitly assert that control and uppercase kicker, so retain those behaviors instead of deleting them for appearance.

Do not alter `show-chart-details`, chart-name guards/Apply/Discard/Stay, session identity, hide/focus return or save/recovery ownership. Retain counts/region names and a real named close command. Verify the existing Chart details keyboard/active case and one compact ordinary-close/focus check, plus a comparable actual screenshot in the same shell. No new prototype vote or persistence work is required.
