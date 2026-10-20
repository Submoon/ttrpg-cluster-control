# Ticket 22 implementation contract

## Scope and baseline

Read-only architecture/domain analysis for the coordinator on 2026-10-19. The coordinator supplies the freshly compared intentional feature baseline `2a4564d7ef5916df0cc4e025e7997ca7c86f81f7`, equal to the feature remote and 0 main-only / 43 feature-only against `origin/main = 629d2a98715c3a16b954e0f77c639b1f0c31212c`. This report changes only this planning artifact; it runs no application, browser, Git or storage operations. Source inspection is evidence of current implementation, not executed acceptance.

Authority: ticket 22, specification stories 22 and 55–63 plus the ticket's affected preservation checks, root `CONTEXT.md`, `docs/agents/domain.md`, accepted inspector refinements/prototype and ticket 21's B/Dock integration. No `docs/adr/` directory exists in this checkout. No new domain term, schema change or product decision is needed.

Retain the real persisted product at `/`, the accepted bottom Dock/full-board/optional desktop overlays/fullscreen compact panel composition, existing reviewed deletion, native drag identities, storage database/codec/version and the page's single storage owner. `/?variant=B&controls=dock&inspectorSample=dense` is the accepted disposable presentation reference, not the product or an application fixture source.

## Current gaps and capabilities to preserve

| Seam | Current implementation and bounded change |
| --- | --- |
| Object form | `components/inspector/MapObjectInspector.vue` owns reactive draft/snapshot/error locally. It already preserves Name, unique Location key, Description, Other Type label, placement and conditional system coordinates, native values, custom values and Jump Point–Station association. Retain these capabilities while replacing local lifetime and the Edit/Save/Cancel layout. |
| Typed values | Initialization uses `String(value)` and custom parsing checks empty string separately; numeric zero and boolean false already survive. All definition slots are retained even when applicability hides controls. Preserve this behavior and sparse changes; do not rebuild assignments from visible fields. Definition watcher currently deletes removed field slots and silently changes a live draft—parent ownership must guard relevant definition mutation instead. |
| Orbit form | `OrbitInspector.vue` edits axes, unoccupied Center X/Y and sibling order; Detach is a separate command. Rotation exists in layout and map commands but is absent from the form. Draft ownership is local, with no captured target/host snapshot. `Number('')` accepts blank centers as zero; radii are silently rounded. Add explicit nonblank finite parsing, numeric rotation and per-control errors. |
| Apply/save | `useMapWorkflows.saveObjectEdit/saveOrbitEdit` await `commit`, then acknowledge the child. A durable failure leaves an already applied edit looking unapplied. Existing `useLocalWorkspace.applyWorkspace` and chart-name Apply already provide the required immediate memory-publication seam. Reuse it without changing save ordering or backup restore. |
| Guards | `useEditorState.resolveTransition` reads component handles; any active editor counts as unsaved. Inspector guard offers discard/stay only; its Apply branch always cancels. Add modified-versus-clean detection and actual entity Apply. Preserve existing route handling until ticket 24. |
| Conflicts | Renderer blocks only direct manipulation of the edited object via `isObjectMoveBlocked`. Orbit resize/rotation/center and dependency manipulation have no equivalent pre-preview check. Workflows alone are too late once local geometry is visible. Add a shared predicate used before local preview and again before commands commit. |
| Labels | Object header, Hierarchy subtype copy and SVG object accessible name expose family/subtype identifiers. Reuse `catalogueTypes` labels plus one readable family-label mapping; preserve Other custom subtype text. Use “Physical Station” or “Physical Station association” for the optional installation belonging to a logical Jump Point. |
| Deletion/recovery | Existing `planMapEntityDeletion` consequence review and latest-plan renewal must remain authoritative. Existing workspace feedback already supports retry and applied JSON recovery; embed/reach the same recovery state from the inspector footer instead of creating new save state. |

## Shared ownership and interfaces

Use the existing chart-session pattern, extended narrowly to the two system entity types. One session owner lives in editor workflow state above `MapInspector`, compact panels and responsive layout. A small dedicated `useEntityInspectorSession.ts` is acceptable; avoid a general editor framework or a second storage owner.

The writer owning state defines the shared types once in `composables/editor-workflows/types.ts` (the component contracts can re-export compatible types). The agreed semantic surface is:

```ts
type EntityInspectorSession = {
  id: number
  clusterId: string
  systemId: string
  targetId: string
  errors: Record<string, string>
  error: string
} & (
  | { kind: 'object'; initial: ObjectEditBaseline; draft: ObjectDraft }
  | { kind: 'orbit'; initial: OrbitEditBaseline; draft: OrbitDraft }
)

// Public owner operations; implementation may use the existing workflow names.
beginObjectEdit(): Promise<void>
beginOrbitEdit(): Promise<void>
applyEntitySession(): boolean
discardEntitySession(): void
hasModifiedEntitySession: ComputedRef<boolean>
isEntityCommandBlocked(command: EntityCommand): boolean
```

`ObjectDraft` retains existing string inputs (`locationKey`, `name`, `description`, `subtype`, `placement`, `x`, `y`, `atmosphere`, `portClass`, `jumpStationId`, `customFieldValues`). Do not use truthiness to represent typed absence. `OrbitDraft` has string `targetOrder`, `horizontalRadius`, `verticalRadius`, `centerX`, `centerY`, `rotation`; Detach remains an explicit committed command, not an ignored checkbox or hidden draft field.

Initial baselines capture detached entity values and only relevant layout/definition/relationship values. They never hold a whole-workspace lock or rely on object reference identity. Apply resolves the captured cluster/system/target IDs against **latest** workspace memory, rejects missing or changed actual dependencies and runs existing authoritative domain validation on a candidate. Unrelated changes are preserved by building on latest memory. Form errors use stable keys: `name`, `locationKey`, `description`, `subtype`, `placement`, `x`, `y`, `jumpStationId`, `native:atmosphere`, `native:portClass`, `custom:<id>`, `targetOrder`, `horizontalRadius`, `verticalRadius`, `centerX`, `centerY`, `rotation`.

Apply returns false and preserves session/content/errors/context/tool on invalid or stale work. Valid Apply calls `applyWorkspace`, clears only the same session ID synchronously, attaches rejection handling to `durable`, and returns true so a requested transition can continue. Save failures remain the storage owner's persistent recovery state. Discard clears only its designated unapplied session. A clean session can close without prompting; merely opening Edit is not a modification. Hide/reflow/theme never end a session, clear its errors or publish data. A hidden modified session has a visible resume path.

Keep `MapInspectorHandle` as a compatibility facade for the legacy route inspector and existing callers during this ticket. Its entity methods delegate to the parent session instead of reaching into entity component state. This avoids reworking route creation or changing the legacy route's save contract under ticket 22.

**Dispatch names:** `MapInspector` receives `entitySession: EntityInspectorSession | null`; each system-entity form receives the narrowed `session` prop. Keep existing `request-object-edit` / `request-orbit-edit` begin events. Add `apply-entity-session(sessionId: number)` and `discard-entity-session(sessionId: number)` through `MapInspector` to the owner. New forms submit identity rather than an independently assembled candidate. The owner exports `entitySession`, `hasModifiedEntitySession`, `applyEntitySession(expectedId?: number): boolean`, `discardEntitySession(expectedId?: number)`, `isEntityCommandBlocked(command): boolean` and `isEntityDraftTarget(kind, id): boolean`. The owner keeps session content deeply reactive; the form can bind the parent-owned nested `session.draft` directly, with no copied draft or sync watcher. Owner operations check the expected session ID. Existing save events/handle aliases can remain compatibility facades where callers still require them.

### Command dependency boundary

Use a small discriminated `EntityCommand` input for the operations actually touched, for example object placement/movement, Orbit geometry, Orbit host change, definition mutation and deletion. This is a predicate contract, not a command bus. One pure predicate must answer both renderer and workflow callers. The state writer owns dependency calculation; component/renderer callers do not duplicate it.

An object draft owns its object data/placement, relevant current and draft-selected Orbit host chains, linked Station identity, native definitions and custom definition identities that determine its draft's values. An Orbit draft owns its Orbit geometry/host, the host/placement chain used for that geometry and its host-relative sibling order. A sibling command conflicts only when it changes those owned order/host dependencies. A name change on an unrelated object, unrelated Orbit geometry, independent map pan/zoom, file consultation/export and unrelated creation are not conflicts.

Block manipulation of the draft target, host/placement dependency changes and definition changes that would invalidate or clear owned assignments **before** editing preview. Do not block every object merely because it shares a system. Validate the draft-selected destination as well as saved placement; switching a placement select changes dependencies. Definition rename/options/applicability/removal affecting the active object's field slots must resolve that session; consultation and unrelated definitions remain possible. Reuse existing domain host-chain validation and destructive plans to determine actual effects rather than inventing a separate cascade algorithm.

For deletion, inspect the existing pure plan first and intersect its affected entities/references with owned dependencies; do not discard just to prepare a review. If resolution Apply changes the plan, recompute and require renewed review. Confirmed deletion may clear its designated target session; Cancel/Stay preserves it exactly. Ticket 22 should keep the existing review presentation rather than implement ticket 27's full destructive UX.

The UI writer wires the predicate into object dragging/keyboard manipulation, Orbit ring/axis/rotation/center paths and palette placement where the destination or host conflicts. Check before changing `livePositions`, `liveOrbitRadii`, `liveOrbitRotations` or `liveOrbitCenters`; perform the same check in workflows for keyboard/direct-command defense. A gesture whose candidate host changes during drag must be checked before showing that candidate. Refusal reports a specific reason and leaves current draft/memory unchanged. Ordinary click/selection/navigation remains available.

### Bounded writer ownership

1. **State writer:** `composables/**`, shared workflow and inspector request types/contracts, session model/parsing/validation, transition resolution, latest-memory Apply and conflict predicate. Preserve existing chart/storage behavior and legacy route facade. No component/test edits.
2. **UI and acceptance writer:** object/Orbit inspectors, `MapInspector.vue`, shared inspector envelope, `BaselinePage.vue` wiring, `ChartNamesDialog.vue` guard Apply affordance, feedback/resume presentation, readable-label utility plus Hierarchy/SVG labels, `SystemMap.vue`/renderer predicate hookup and focused tests/helpers. No independent session owner or workflow reimplementation. State writer publishes exact exported names before UI wiring.

Two writers maximum. They are not alone in the checkout; preserve other edits. Runtime/build ownership remains serialized by the coordinator. Keep legacy accessible aliases such as “Save map object”, “Save Orbit” and “Cancel map object edits” where sensible while visible actions read Apply changes/Discard changes; adapt shared test helpers rather than rewriting many preserved journeys. New tests should exercise visible accepted commands.

## Accepted presentation translated to the real forms

`PrototypeBInspector.vue` establishes header/body/footer rows: top Hide; one internally scrolling body; visible sections; bottom status/errors/recovery and Apply/Discard. Body order is validation summary, object details, catalogue/native values, custom values, save details and separate final Delete. Full-width Name, Description and multiline custom text are required; short numeric/select controls may pair on desktop and stack on compact screens. Error links focus stable control IDs using actual Nuxt UI FormField error context. Footer Review issues leads to the summary; save Details/Retry/Export reach shared applied-state recovery. Use Nuxt UI buttons, form fields, inputs, textareas, selects, badges and existing panel primitives to the greatest practical extent.

Complete Object details with Location key/Other Type label, then visible Placement/coordinates/Station section; keep native values and custom values distinct. Description remains built-in; a custom “Session note” remains indexed by its own definition ID. Do not copy prototype coverage/read-only or simulated-save wording into the persisted editor. Orbit's visible sections contain axes, center when unoccupied, rotation, host-relative order and explicit Detach, followed by the same status/action/delete structure. Orbit has no editable Name or description.

Numeric geometry is available in Select. Move controls gestures, not form permissions. Parse blanks/nonfinite values explicitly; reject invalid center/radius/order values beside the affected control. Existing rotation normalization to [0, 360) is valid when clearly reflected in the applied display. Preserve effective default radii when reordering/detaching so saved absence cannot accidentally change geometry; use existing helpers. Keep each host-minimum axis correction independently observable when attachment raises one or both axes. An unsupported or inapplicable value must not be silently ignored while Apply reports success.

## Priority product journeys

Use the existing Playwright integrated product seam with isolated browser storage, valid imported fixture/setup, ordinary hit testing and actual downloads/reload. Add approximately eight focused journeys, parameterizing object/Orbit where useful. Existing capability tests remain preserved acceptance work, not substitutes for new ownership/failure cases.

1. **Complete object data round trip:** rich object with long Description, separate custom Session note, text/number/boolean/select and hidden ineligible assignments. Apply zero and false, export actual JSON and reload after Saved. Assert exact values, untouched hidden fields, native values, unique key and valid Station references. A second Other/Jump Point variant covers custom subtype/Station association without one giant scenario.
2. **Orbit numeric editing in Select:** hosted/nested and unoccupied variants; apply independent axes, rotation, Center X/Y and sibling order. Export/reload verifies exact geometry/references and host-relative order. Detach preserves ID/children/effective radii and enables center controls. Existing attachment regression retains per-axis minimum notices.
3. **Invalid repair and navigation:** duplicate key, blank/nonfinite coordinates, invalid radius/order and typed number. Invalid Apply changes no JSON, retains values, exposes inline errors and summary-to-control focus, and refuses a requested context change without altering view/tool. Repair succeeds.
4. **Presentation lifetime:** dirty object and Orbit with error; Hide/reopen, light/dark, desktop–390×844–844×390–390×500 reflow. Same content/errors and hidden resume path persist; top Hide/footer actions/recovery links remain hit-testable with unobscured keyboard focus and internal scrolling.
5. **Guard choices and clean edits:** dirty selection/context change exercises Stay, invalid Apply, valid Apply and Discard. Valid Apply permits transition; clean opening needs no prompt. Discard does not clear existing save failure or alter committed data. Legacy route guards remain operational.
6. **Pre-preview conflicts versus independence:** hidden dirty object/Orbit; pointer/keyboard attempts on target and host/placement dependencies cannot alter live SVG geometry or exported JSON. Unrelated object/Orbit movement and pan/zoom work and survive later Apply. Include draft destination dependency rather than only original placement.
7. **Definition/deletion boundary:** read-only consequence preparation leaves draft untouched; conflicting definition/deletion choice resolves Apply/Discard/Stay, renewed changed consequences require renewed confirmation. Cancel review preserves exact draft/selection; existing successful cascade removes only reviewed entities. Keep Fields overhaul out of scope.
8. **Real durable failure:** abort one browser IndexedDB write through existing platform interception while applying an object, then Orbit variant. Session ends immediately, requested transition completes, applied data remains exactly once, persistent Not saved plus Retry/current JSON remain reachable. Download contains applied values and excludes a later hidden draft; Retry saves latest memory and reload restores it. Restore platform hooks in cleanup.

Use existing `downloadJson`, import and map-coordinate helpers. Extend existing typed export helper shapes only where needed for asserted description/native/layout data; do not expose test-only application APIs. Typecheck/build and a bounded compiled-production dense form check supplement browser behavior. Record exact source/runtime/route/fixture/input/viewport/outcomes. Compare integrated dense Inspector with accepted B at comparable state/theme/viewport; behavioral passes do not prove composition. Physical Android Chrome keyboard/safe-area/gesture checks remain unavailable unless actually executed.

## Independent review focus

After the candidate freezes, technical review checks single owner/lifetime, no component synchronization race, same-session acknowledgment, blank/finite parsing, Apply-vs-save timing, predicate coverage before every preview, Nuxt UI error/focus associations and absence of global locks. Complementary data/domain review checks sparse latest-memory merge, ineligible zero/false preservation, Description/Session note identity, Station/Orbit relationships, order/default radius/rotation behavior, independent per-axis notices and unchanged deletion/interchange/storage boundaries. Review must not infer browser or physical-device passes from source.
