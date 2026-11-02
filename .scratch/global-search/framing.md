---
title: "Global search with auto-fit: behavior framing"
status: closed
---

## Source issue

[Global search with auto-fit, GitHub #7](https://github.com/Submoon/ttrpg-cluster-control/issues/7), fetched on 2026-10-29 via `gh issue view` with body, comments, labels and state.

- State: OPEN. Labels: `enhancement`, `priority:P1`. No comments at fetch time.
- Existing requirements: a visible, accessible search input; search cluster names, system names and object labels; selecting a result automatically fits/zooms the map to show it; mobile keyboard input works.
- Fuzzy matching for typos is optional ("May include"), not an acceptance requirement.
- Header or sidebar are suggestions, not a prescribed interaction.
- Parent [Revamp the interface, GitHub #3](https://github.com/Submoon/ttrpg-cluster-control/issues/3) is CLOSED and has no comments. Its mobile, accessibility and feature-preservation requirements remain relevant. Its closure does not satisfy #7.
- This effort is local analysis and user clarification only. No product implementation or remote writes are authorized by this framing request.
- Re-fetched after round 2 on 2026-10-29: body, comments, labels and state unchanged.

## Baseline and working boundary

`origin` was fetched successfully on 2026-10-29. Actual `HEAD`, local `main` and `origin/main` are all `8d4b66504ca6723db5405ed7cb93d0a666264c9a`; comparison `HEAD...origin/main` is 0 ahead / 0 behind. This matches the parent chat's last-known `8d4b6650`. The isolated worktree is detached at that revision. No different base is intended; no fast-forward was necessary.

Pre-existing untracked `.codex/environments/` is unrelated and was left untouched. No other chats were contacted. Two read-only fact investigations supported this document; all analysis and artifacts stay in this worktree.

## Recommended route

Use the explicitly requested `ask-matt` router, followed by `grill-with-docs` and its `grilling` / `domain-modeling` primitives: inspect existing behavior, ask dependency-aware rounds of product questions, and keep the answers here. These skill sources were read before application. Repository instructions override their generic glossary layout: `CONTEXT.md` remains the domain context, and this feature's working notes remain in `.scratch/global-search/`.

The feature had a bounded destination but unsettled behavior spanning navigation, drafts and camera ownership. Code-informed clarification resolved the product questions in two rounds and one shared-understanding confirmation. No runnable experiment was necessary. No new domain term or hard-to-reverse trade-off was established, so there is no context or ADR change.

## Established code facts

| Concern | Evidence and implication |
| --- | --- |
| Search scope | `domain/workspace-model.ts:136` gives one `LocalWorkspace.cluster`. `utils/workspace-storage.ts:6` stores current data and a last-valid recovery snapshot, not a searchable multi-workspace library. Global can cover inactive systems without adding storage capabilities. |
| Imported clusters | `domain/workspace-json-import.ts:407` appends independent systems/routes into the existing cluster, retaining its identity/name. The imported source cluster name is not retained as another cluster entity. |
| Searchable names | Cluster/system `name`, object `name` and separate `locationKey` are modeled in `domain/workspace-model.ts`. Object label is the displayed name, not an extra stored label. The renderer displays both key and name (`components/maps/system-map-renderer.ts:990`). |
| Location keys | `CONTEXT.md:26` defines the Warden's object marker, not an i18n/translation key. Uniqueness is system-local and case-sensitive (`domain/workspace-system-objects.ts:157`, `domain/workspace-schema.ts:38`). Searching keys extends #7 and was explicitly accepted in Q2. |
| Homonyms | Names need not be unique. Keys can repeat across systems; even same-system keys differing only by case can coexist. Imports preserve names/keys while replacing IDs (`domain/workspace-json-import.ts:255`, `:305`). Type + system name + object key can still produce identical-looking rows after importing a system twice. Never identify or deduplicate results by display text. |
| Current browsing | `components/MapHierarchy.vue:21`, `:93`, `:111` lists systems and current-system entities; no text search exists there. No fuzzy-search library is declared in `package.json`. |
| Navigation choices | `selectSystem` enters a system map; `selectClusterSystem` selects/inspects its cluster node without changing the active system (`composables/editor-workflows/useEditorNavigation.ts:214`, `:227`). These are distinct product actions. |
| Cross-map objects | `selectObject` only operates on the active system (`composables/editor-workflows/useEditorNavigation.ts:244`). There is no single guarded command to reveal an object in an explicitly identified other system. Existing navigation calls return void even on cancellation, so blindly chaining them is insufficient. |
| Draft resolution | `composables/editor-workflows/useEditorTransitions.ts:33` owns Apply/Discard/Stay and pending-transition exclusion. Navigation captures and revalidates context and target existence after waiting. Applied memory and durable saving are separate acknowledgements. |
| Existing camera tools | Whole-map Fit exists (`components/SystemMap.vue:432`, `components/ClusterMap.vue:364`). `components/WorkspaceMapCanvas.vue:652` measures the usable area around visible obstructions for Fit. History reveal minimally pans, keeps zoom and measures the full SVG rather than obstruction-aware space (`utils/reveal-svg-target.ts:111`, `:130`). Neither is a ready-made result-framing command. |
| Geometry reuse | `utils/map-zoom.ts:115` computes a centered bounded transform for supplied bounds and usable rectangle. Target bounds, context margin and desired scale still need a search contract. Small symbols must not automatically fill the viewport at maximum zoom. |
| Descendant structure | `utils/map-hierarchy.ts:15` traverses object -> hosted Orbit -> occupants recursively, but produces rows rather than bounds. `utils/system-map-geometry.ts:359` collects nested descendant object IDs for movement. No subtree-bounds helper was found. |
| Descendant geometry | System objects and Orbits are rendered in separate flat groups (`components/maps/system-map-renderer.ts:707`, `:957`). An object's SVG group does not contain its descendants. Object groups include key/name text and hit geometry (`:973`-`:995`); Orbit groups include interaction handles. Bounds must cover visible content deliberately, rather than assuming DOM ancestry or measuring handles. |
| Map boundary | `components/WorkspaceMapCanvas.vue:15`, `:41` mounts cluster and system maps as alternatives. Cluster system cards show a name and counts, not internal objects/Orbits (`components/ClusterMap.vue:817`, `:834`, `:846`, `:851`). Showing all internal descendants of a system would require entering its map and revising Q4. |
| Remembered visits | Camera and valid selection are temporary per-map state (`composables/editor-workflows/useEditorMapControls.ts:120`); canvas mounting restores a visit or fits (`components/WorkspaceMapCanvas.vue:707`). Search framing must run after that restoration and revalidate its request. |
| Compact panels | Width <=760px or height <=600px activates compact behavior (`composables/editor-workflows/useEditorViewport.ts:17`). Inspector is fullscreen there. Default object selection opens Inspector, which can immediately conceal the framed target. |
| Keyboard ownership | Native hierarchy buttons and map focus exist. Map arrows pan only when the map owns focus; the history shortcut bridge ignores editable controls, composition and overlays (`composables/useWorkspaceHistoryShortcuts.ts:22`). Search keys must respect these owners. |
| Scale evidence | Existing campaign and focused fixtures have only a few systems/objects. The model has no inspected hard count limit; these fixtures cannot establish a large-workspace performance guarantee. |

## Validated scope

1. Search committed in-memory data from the entire current workspace, including inactive systems. Use the newest applied state even while its durable save is pending; unapplied drafts and temporary placement previews remain excluded.
2. Include the cluster name, system names, object names and Location keys. Exclude descriptions, custom fields, route names, Orbits, catalogue-wide searches and other browser profiles/workspaces from the first version.
3. Match literal substrings without case or accent sensitivity; rank exact matches before prefixes before other substrings; do not correct typos (confirmed Q3). Trim the query, do not enumerate all data on empty query, use a deterministic tie-break, return one row per entity even if several fields match, and retain distinct IDs despite identical display text (final consultation contract confirmed Q11).
4. Cluster -> cluster map with full-map Fit; system -> selected cluster node; object -> selected object in its own system (confirmed Q4). Activation should be explicit, never triggered by typing, highlighting or hovering.
5. Frame the target **and all its descendants drawn in the selected map** (confirmed Q5-Q7). An object includes its hosted Orbits, their occupants and recursively hosted branches, excluding its parent Orbit, siblings, unrelated routes and Station references. A system result frames only its cluster node; a cluster result fits the whole cluster map. Include visible marks/rings and labels rather than invisible hit targets or editing handles. Prioritize containing the entire branch with a margin even when small labels need subsequent manual zoom; avoid excessive enlargement for an isolated target. The concrete margin and isolated-target scale are implementation/design choices to verify visually.
6. Reuse existing draft and navigation ownership. Searching, closing search and responsive reflow preserve drafts. Changing target resolves modified sessions through Apply/Discard/Stay; Stay, invalid Apply or stale context must not partly change map, selection or camera. Selecting the existing draft target should preserve its session.
7. Search itself creates no workspace edit, history action, new durable index or alternate persistence path. An existing guarded Apply may still publish the user's explicitly accepted edit.
8. Show the framed map after activation without automatically opening Inspect. Preserve already-open desktop panels if useful space remains; hide the compact fullscreen panel while preserving any retained draft. Inspect stays available (confirmed Q8).
9. Successful activation closes search, focuses the map and retains the query for the current editor session. Reopening search restores that query. Every explicit activation reframes, including the already-selected result; ordinary navigation retains its existing visit behavior. Stay retains search/query without navigation (confirmed Q9).
10. Distinguish homonyms with type/system context and object Location key, then a result-only occurrence number when those labels are still identical. Never rename entities or expose internal IDs merely for disambiguation (confirmed Q10). Keep that numbering deterministic for unchanged data; it is not durable domain identity.
11. Provide visible access, keyboard-only operation, touch activation, clear empty/no-match feedback and a mobile input flow. The exact surface remains a later design choice, bounded by the behavior above; no header/sidebar/dialog layout is mandated.

## Questions and decision status

### Round 1 — user answers received on 2026-10-29

- Q1 **confirmed**: all of the current workspace, including inactive systems; no multi-cluster library.
- Q2 **confirmed**: cluster/system/object names plus Location keys; exclude descriptions, custom fields, Orbits and routes in the first version.
- Q3 **confirmed**: case/accent-insensitive literal partial matching, ordered exact -> prefix -> substring; no typo correction.
- Q4 **confirmed**: system result targets its cluster node; object result opens its containing system and selects the object; cluster result opens its map.
- Q5 **confirmed with a different choice from the recommendation**: "Cadrer aussi toute la descendance de la cible". Target-only framing is superseded. This does not implicitly reverse Q4 or authorize switching system results to the system map.

### Round 2 — user answers received on 2026-10-29

- Q6 **confirmed**: recursive hosted Orbits/occupants for an object; no parent/siblings or unrelated links. A system result remains a cluster node; the cluster result fits the whole cluster map.
- Q7 **confirmed**: visibility of the complete branch takes priority over small-label readability. Manual zoom can follow. This requires accommodating the needed zoom rather than silently clipping at the current system zoom floor.
- Q8 **confirmed**: map first, no automatic Inspect opening; retain desktop panels where the result stays visible; hide the compact fullscreen panel and preserve retained drafts.
- Q9 **confirmed**: success closes search, focuses the map and remembers the session query; every activation reframes. Stay retains search/query and does not navigate.
- Q10 **confirmed**: type/system/key context, then a result-only occurrence number when necessary; no data renaming or raw internal IDs.

### Final consultation contract — confirmed Q11 on 2026-10-29

The user answered **"Oui, cadrage validé uniquement"**, confirming the ten answers above and these consultation details. This validates framing only and does not authorize product implementation.

- Search the latest applied workspace, including changes waiting for durable saving, but not unapplied drafts/previews. Search consultation, opening/closing and result browsing do not alter data, selection, camera or drafts. Only explicit result activation invokes guarded navigation.
- Preserve existing Apply/Discard/Stay semantics; failed validation or Stay keeps the starting map/selection/camera and search query. A stale or removed target cannot produce a partial navigation. Reusing the current draft target preserves its session.
- Trim surrounding query whitespace. An empty query invites typing and does not list all entities; no match is explicit. Treat punctuation literally. One row per entity, with the best matching field determining exact/prefix/substring rank. Stable ties and occurrence numbers use deterministic ordering; do not silently truncate matches.
- Visible access must work without a keyboard shortcut. Users can type, move among results with keyboard, explicitly activate with Enter or touch, and close with Escape. IME composition must not accidentally activate a result. Escape belongs to search first, restores its opener when simply dismissed and does not also cancel tools/drafts or pan the map. Success focuses the map; Stay returns usable focus to search after the guard closes.
- Query lifetime is the current editor identity/session: preserve hide/reopen/reflow, reset on workspace/cluster identity change or editor exit. No durable search history or new map-navigation stack is required.

The surface, concrete spacing/zoom cap for isolated targets, tie-break implementation and large-list rendering are reversible implementation/design choices within this contract. No prototype is currently necessary to decide the product behavior. The future implementation should collect a representative larger-workspace check before making numerical performance claims.

## Validated acceptance criteria

1. A visible, named search entry is reachable from cluster and system contexts with keyboard and touch, on desktop and compact layouts. Native input editing and IME composition remain usable.
2. A query finds matching names and Location keys across inactive systems. Ignore case, accents and surrounding query whitespace; match punctuation literally; rank exact matches before prefixes before substrings. Empty input invites typing without listing all data; no matches are explicit. No typo correction is included.
3. Homonymous objects/systems, repeated keys across systems and duplicate imported copies remain separate stable-ID targets. Matching multiple fields does not duplicate the same entity's row; result context supports an intentional choice.
4. Typing and browsing results never change selection, camera, tool, draft or committed data. Rename/import/delete/Undo/Redo refresh results from applied data; vanished targets cannot be activated.
5. Successful activation selects the exact result and opens the agreed containing map. Cross-system object activation never briefly selects the wrong system's object or restores a remembered selection after the search target.
6. The target and its complete descendant branch from Q6 are framed with a margin after destination mount and panel/keyboard layout changes. Cover visible marks, Orbit rings and labels, excluding invisible hit geometry and editing handles. A large branch may reduce label readability; containing the whole branch takes priority over the current system zoom floor. An isolated target must retain useful surrounding context rather than expand to maximum zoom.
7. Dirty or hidden chart, object, Orbit and route drafts use existing guards. Stay, failed validation, stale target/context and superseded requests retain a coherent starting state; Apply/Discard proceed only after the accepted outcome. Repeated activation does not queue stale reveals.
8. Search framing coexists with per-map visit memory; ordinary navigation still restores its camera/selection. Search never performs an unsolicited data write or Undo/Redo step.
9. Keyboard users can open, enter a query, reach results, choose deliberately and dismiss without map-arrow or editor-shortcut leakage. Success closes search and focuses the map; Stay preserves query and usable search focus. Every activation, including reactivation, reframes. Simple dismissal returns focus to the opener without canceling the editor tool or draft.
10. Mobile users can type with the software keyboard, scroll/select results and see the framed result after activation, with the fullscreen Inspector hidden and retained drafts preserved. Details remain accessible afterward. Desktop panels may remain open while the result is visible. Resizing/rotating/hiding search preserves unfinished work and the session query.

## Risks and dependencies

- The core dependency is a complete guarded reveal command and its accepted/cancelled outcome, with explicit workspace/system/entity IDs. Keep domain search pure; leave sessions in focused controllers, transient search state in its appropriate editor owner, and browser layout/focus with mounted owners.
- Target framing depends on rendered geometry, usable viewport measurement and completion of remembered-camera restoration. Reusing the history-specific reveal unchanged would bypass needed guards and keep its obstruction limitation.
- Q5 requires descendant bounds rather than only the selected symbol. Nested/rotated ellipses, large labels and branches beyond the normal system zoom floor need explicit coverage; do not fit the entire containing map as a substitute for the chosen branch.
- Implementing whole-branch visibility may require a scene-derived lower zoom bound for system maps, analogous to existing cluster handling, coordinated with zoom controls and visit restoration. The accepted behavior is full containment, not preserving a hard-coded percentage at the cost of clipping. This is a technical design dependency, not a new product question.
- Compact Inspector and the software keyboard can hide the map after a technically correct camera change. The visible result, rather than transform values alone, defines success.
- Case-insensitive search must not treat case-sensitive keys as identity or collapse imports. Missing names/keys, deleted targets and context changes during confirmations need explicit handling.
- Continuous Orbit adjustments and active placement/gesture previews already have operation ownership. Search navigation must compose with existing completion/cancellation contracts instead of clearing those states directly.
- Issue #3 supplies existing responsive/accessibility foundations. No change to its closed state is required. No dependency on another issue or another chat has been verified or invented.
- Fuzzy matching and searching full descriptions/custom fields expand product behavior and result volume; neither is established as necessary by current code or #7.

## Verification plan and evidence collected

This framing used source inspection and read-only GitHub queries only. No product code, runtime behavior, UI screenshot, lint/typecheck or automated test result is claimed.

For later implementation, use focused pure cases for search normalization/ranking/deduplication and target geometry; controller cases for complete guarded cross-map activation, cancellations and stale asynchronous requests; public browser journeys for the visible result, focus and draft preservation. Existing anchors include:

- `tests/workspace-navigation.spec.ts:224` (remembered cameras), `:304` (open inspected system), `:328` (active vs inspected system), `:442` (keyboard ownership).
- `tests/workspace-chart-drafts.spec.ts:379`, `:470`, `:546` (hidden drafts and transition choices).
- `tests/workspace-panels.spec.ts:87`, `:192`, `:244` (compact focus, reflow, nested dialogs).
- `tests/map-zoom.spec.ts` and `tests/reveal-svg-target.spec.ts` (existing geometry boundaries).

Run lint, typecheck and affected scenarios for a behavioral change, with UI smoke and desktop/compact visual inspection. Follow repository integrated-check guidance if dependency/SSR integration changes. Verify actual software-keyboard behavior and keyboard/screen-reader interaction separately where needed; viewport emulation alone cannot certify them. Do not add a fuzzy library or production build solely for this documentation-only effort.

## Completion boundary

All eleven questions are explicitly answered. The final shared-understanding confirmation closes this analysis effort only; it does not authorize implementation or close GitHub #7. This file is the validated behavior-framing reference, not an implementation ticket. No push, PR, merge, label/comment change or issue closure is requested.

## Resolution

Closed on 2026-10-29 after the user's Q11 confirmation. The initial product scope, navigation destinations, descendant framing, homonym handling, draft guarantees and keyboard/mobile outcomes are agreed. The UI composition and concrete technical choices remain implementation/design work constrained by this contract, rather than unresolved product requirements.

The future implementation has three connected responsibilities: deterministic search over applied data; one guarded cross-map result-reveal operation; and branch-aware framing with accessible desktop/compact presentation. Its material risks and required verification are recorded above. Implementation requires a new user instruction and a fresh baseline check; no product work was started in this effort.

After the framing was closed, the user invoked `to-spec` and approved its test seams. The resulting local [Global search with branch-aware map framing](spec.md) consolidates this validated contract for subsequent ticket planning. That specification does not authorize product implementation or remote tracker changes.
