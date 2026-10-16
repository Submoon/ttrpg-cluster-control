# Independent Astra review of the current B interface and decisions

## Verdict

**The current decisions form a coherent, buildable direction and are ready for specification synthesis.** Keep B, the selected Dock, separate cluster/system maps, optional Hierarchy, fullscreen compact Inspect, the Fields list/detail/Edit flow, and the confirmed inspector sections/actions. The current interface is substantially clearer than the earlier globally reviewed artifact. Tools now express different intentions and surface types instead of presenting all commands as equivalent rail items.

This is readiness to write the specification, **not acceptance of the current prototype as the production interface**. There are concrete reachability and composition defects, plus the already documented integration obligations. They need explicit acceptance criteria and implementation work; they do not require another overall design choice. No fundamental contradiction between the accepted decisions was found. Maximum Nuxt UI reuse is compatible with the design, but requires reassessing bespoke prototype controls rather than copying them wholesale.

The presentation and focused-tools records 12/15 still need their own evidence reconciliation and formal disposition. This report does not close them or supply a human answer. Their open states are not evidence that the human must choose Dock again.

## Snapshot, method and provenance

- Review date: 2026-10-16. Frozen review snapshot: `4b10e069c4b516a5d937574595ef3a30d906c2ec`; application source unchanged since accepted `be8bef3e9efaea76b986480a40de6bd260e59d18`. The coordinator supplied a fresh origin fetch and source-issue refresh: intentionally 0 main-only / 21 feature-only against `origin/main = 629d2a98715c3a16b954e0f77c639b1f0c31212c`. Issue 3 remains open and unchanged. No Git operation was performed by this reviewer.
- Read the [bounded brief](astra-current-interface-review-brief-2026-10-16.md), current map, consolidated dossier, authoritative Tools/Fields/Inspector/library Resolutions, draft/save and theme/export contracts, previous Astra report, relevant current components, and root domain vocabulary. The delegated review-only workflow was followed without spawning agents or changing application code.
- **Independent live actions:** a new owned background IAB tab at `http://127.0.0.1:3144/?variant=B&controls=dock`, followed by the same disposable route with `inspectorSample=dense`. Initial visible-tab creation was unsupported in a subagent; background creation succeeded. No native computer automation or human tab was used.
- **Runtime identity belongs to the coordinator:** during this review the parent reverified listener `127.0.0.1:3144`, PID 2888, command `"C:\nodejs\node.exe" .output/server/index.mjs`, and the three frozen inspector/workbench/fixture source hashes in the isolated runtime. The reviewer confirmed page readiness and the corresponding current features. A reviewer-side CIM process query was denied by the sandbox; it is not an independent process/hash verification. The page does not expose a build SHA. The exact-head Vercel success in the brief was not used as a substitute for local browser observations.
- Default desktop capture approximately 1265×712; explicit samples 1440×960, 390×844, 844×390 and 390×500. Browser scrollbars reduce drawable width. These are desktop IAB viewport overrides, **not actual Android Firefox, touch or virtual-keyboard tests**. Some size changes retained outer-page scroll, visible in the captures; no claim of a pristine scroll-zero comparison is made.
- Used visible controls, semantic locators, text entry, chooser Escape, screenshots, accessibility/DOM snapshots and read-only bounding-box/hit-target inspection. Browser screenshots were inspected in this session; no persistent fresh image file is claimed. Temporary viewport override was reset and the owned tab closed. Sample drafts were discarded; no workspace storage, imports, downloads or publication were exercised.

The representative routes were system entry/Back, Select→Inspect, edit→Hide→reopen, guarded Back→Stay, invalid Apply, Fields list→detail→Edit→Back→same-definition resume, Hierarchy→object Inspector, Add chooser→Orbit→reopen→Escape dismissal→Quit Add, Vela/Kestrel Fit, and dense Inspector text across light/dark and reduced height. A case-sensitive locator miss, an early dense-panel hydration visibility miss, and one browser action timeout were resolved from fresh visible state; they are not application defects.

## Whole-interface assessment

The map remains the dominant workspace on desktop, and the restrained green/cream palette and serif map headings give the interface a consistent identity. Context return is explicit. Keeping data editing in a side Inspector on desktop and a dedicated fullscreen surface on compact screens is coherent: it avoids squeezing a complex form beside an unusably narrow map. Hierarchy supplies a valuable alternative to directly targeting crowded marks and reflects hosted/nested Orbits. Selecting Hearth through Hierarchy switched the visible compact surface to Inspect and removed the dock/zoom from view.

Inspector is markedly improved. Aster's Name and Description use the available width, native/custom sections are distinguishable, and ordinary actions remain at the bottom. Blank Name refused Apply, retained the draft and showed both local feedback and a linked summary. Hide/reopen preserved an edited name, and Back to Jump Cluster presented Apply/Discard/Stay; Stay preserved context. In the dense 390×500 sample, the long title wrapped, the form scrolled internally, and Hide plus Apply/Discard remained visible. A multiline Description draft survived Hide, a light-theme switch and reopening. This supports the layout and state model; it does not disprove the human keyboard-open failure.

Fields now has the intended mobile journey instead of putting the entire list above the editor. Threat index opened in consultation, Edit exposed a draft, and Back→same definition resumed `Threat review draft`. The bottom commands remained visible in the sampled short-landscape screen. The remaining problem is the amount of space left to actually use the form, not the list/detail architecture.

Ordinary and dense content were both inspected. Long names still crowd map labels and some hierarchy secondary text remains tiny and technical. These observations reinforce the need to specify usable content space and dense-content acceptance rather than equating the SVG's full dimensions with usable map area.

## Prioritized findings and required treatment

### P2 — Map files is occluded by the desktop Inspector

**Independently reproduced on the current local runtime.** On initial desktop B with the route Inspector open, expanding Map files exposed menu buttons in the DOM but hid their visible rows behind Inspect. The Export image button's center, from rectangle `x=1034.61, y=184.95, width=196.41, height=36`, hit-tested to the Inspector's `The Gannet Passage` heading. No force click or export was performed.

Source explains the layering: [PrototypeWorkbench.vue](../../../components/PrototypeWorkbench.vue) lines 109–113 place the menu inside the HUD; line 1879 gives that HUD z-index 3, line 1888 gives the child menu z-index 8, and line 1919 puts the sibling Inspector at z-index 4. The child cannot escape the lower ancestor stacking context.

**Required integration fix:** compose the menu in the correct overlay layer, with normal hit-tested pointer access and keyboard focus while Inspect is open. Nuxt UI menu/popover adaptation is the first option to evaluate. Requiring Hide first is a workaround, not the intended independent desktop panel contract. This is a confirmed existing obligation, not a new design blocker.

### P2 — Compact Fields retains an oversized fixed header

**Independently observed, corroborating the human's Android/Firefox landscape report.** At 844×390 in the resumed Threat index editor, the Fields header measured 139.125 CSS pixels, about 36% of the viewport, before draft feedback and bottom commands. The editable pane had roughly 140 pixels left. Back, eyebrow, title and two-line explanatory summary consume height that the form needs.

Source: [PrototypeFieldDefinitionsDialog.vue](../../../components/PrototypeFieldDefinitionsDialog.vue) lines 17–28, 661–664 and 712–719 retain the complete header with only small compact-layout adjustments.

**Required integration fix:** a compact header retaining meaningful title, Back and Close, with secondary explanation reduced or relocated. Verify long field definitions and actual portrait/landscape device behavior. The confirmed list/detail/Edit and Bottom-command decisions remain suitable.

### P2 — Actual keyboard-open action access remains unresolved

**Human-observed defect; not newly reproduced by this desktop browser review.** The human's Nothing phone 4a pro, Android, Firefox report says editing actions disappear with the virtual keyboard open. Closing the keyboard is an available workaround, not a revocation of the action-access contract. Versions, exact loaded SHA and precise editor surface remain unspecified.

The current fullscreen containers rely on `100dvh`: [PrototypeWorkbench.vue](../../../components/PrototypeWorkbench.vue) lines 2107/2156 and [PrototypeFieldDefinitionsDialog.vue](../../../components/PrototypeFieldDefinitionsDialog.vue) line 658. This identifies relevant integration surfaces; it does **not** prove a browser-specific root cause or that changing one CSS unit is sufficient.

**Required acceptance:** reachable ordinary actions and feedback on the actual device/browser with keyboard open and closed, portrait and landscape, while preserving draft and focus. The 390×500 Inspector result is useful simulated reduced-height evidence only. No further user choice is necessary unless the product intends to relax the accepted requirement.

### P2 — Map chrome still consumes or covers important short-screen content

**Observed composition limitation, not the old total-Fit failure.** At 844×390, Vela and Kestrel drawings remained visible after Fit, but HUD/dock/zoom overlays covered portions of the scene. A short-landscape attempt to activate Kestrel from the cluster timed out while its position was behind upper chrome; opening it at desktop size and then returning to landscape allowed the bounded Fit check. This is evidence that a mathematically fitted scene is not necessarily unobstructed.

At 390×844, Add Orbit showed clear type/instruction/Quit feedback in a separate block below the context HUD, including repeated introductory wording. The already delegated context-banner reuse is not implemented by this artifact. Source: [PrototypeWorkbench.vue](../../../components/PrototypeWorkbench.vue) lines 98–125, 2094–2098 and 2140–2142.

**Required specification/integration treatment:** retain context and Back while using the chosen compact Add-banner arrangement; define available map space against actual overlays and representative scenes. Specify a reachable targeting/recovery route at short heights. This does not authorize changing Add lifetime, removing explicit controls, or inventing a universal pixel budget. The exact packing can be resolved during adaptation and focused validation; another B/Dock vote is unnecessary.

### P3 — Readability and vocabulary improvements are incomplete outside Inspector

**Observed polish and source-supported consistency issue.** Dock words are appreciably more readable than the old microscopic rail captions, but hierarchy secondary labels and map/footer microcopy remain small. Hierarchy still displays `CelestialBody / planet`, `JumpPoint / jump-point` and `SmallBody/Field / belt`, while Inspector uses readable catalogue labels.

Source: [PrototypeHierarchy.vue](../../../components/PrototypeHierarchy.vue) line 58 emits family/subtype identifiers; lines 136 and 146 retain `.48rem`/`.52rem` secondary text. [system-map-renderer.ts](../../../components/maps/system-map-renderer.ts) line 501 also uses these identifiers in object accessible names.

Use the established display vocabulary consistently and spend typography budget on actions, identity and status before decorative microcopy. This is not a measured contrast/WCAG failure. No schema or domain-term change is needed.

## Tools sub-verdict

**The current Tools model and selected Dock are coherent enough to specify.** The earlier main concern—modes, panels and file actions looking like interchangeable tools—is substantially addressed.

| Surface | Current assessment |
| --- | --- |
| Navigate / Select / Move | A compact explicit mode group. Select→entity immediately requested Inspect in the live route; Move exposed named resize controls. Navigate's system entry remains distinct from data inspection. Keeping numeric geometry in Inspect is compatible with this separation of gesture intent. |
| Persistent Add | A separate creation family. The chooser is anchored to its trigger; Add Orbit displayed chosen type, next target and Quit Add. Reopening the chooser then Escape dismissed it while retaining Add; Quit returned to Navigate. This makes the next gesture more predictable. Repetition/no-auto-Inspect semantics come from the authoritative human contract and existing controls evidence; placement repetition was not re-executed here. |
| Hierarchy / Inspect | Adjacent panel commands with expanded state, separate from modes. Compact exclusivity and visible Hide are appropriate; production focus entry/return must accompany visual exclusivity. |
| Map files | Correctly separated immediate commands with explicit Import, PNG, SVG and preview-link labels. Its actual desktop layering must be repaired. Preview sharing must not imply sharing an in-memory workspace. |
| Zoom | One explicitly named zoom set remains. Fit is a useful recovery command; placement must account for usable map space rather than only canvas bounds. |

Do not revive the old one-shot Add recommendation. The human deliberately chose persistent same-type creation, on-demand Inspect and staying in the cluster after Add System. These decisions are mutually consistent with draft ownership: a completed creation is applied data; discarding a later Inspector draft does not delete that entity. A route origin is operation progress and survives view navigation, while an uncommitted gesture preview does not. Exact focus destinations, stationary-right-click behavior and release suppression should be written as deterministic acceptance behavior using the existing contract/evidence. The current source preserves stationary right click provisionally; that is not proof of universal browser behavior. No Foundry comparison is needed to settle this application-specific model.

## Follow-up to the earlier Astra findings

The earlier global review belongs to `4d90f97`, with a separate parent correction check on `3111a19`. Its recommendations are not current requirements where superseded by human decisions.

| Earlier finding | Current status and evidence boundary |
| --- | --- |
| Total drawing disappearance after Fit | **Addressed for the reproduced seed scenes; independently checked now.** Vela transform after Fit was `translate(-208.36192440246845,-70.66169021421798) scale(1.2270846437351717)`; Kestrel was `translate(-83.2569247474567,-111.85686808792224) scale(1.2611542034825167)`. Both drawings remained visible. Overlay/label visibility is a separate remaining issue, not a revival of the old failure. |
| Flat operational hierarchy | **Substantially addressed** by the selected Dock, separate panel pair and Map files menu. Layering remains a concrete defect. |
| Tiny control typography | **Partly addressed.** Dock labels improved; hierarchy/footer metadata still needs refinement. No complete contrast or zoom audit was run. |
| Mobile Fields list above editor | **Addressed structurally and checked live.** List/detail/Edit and draft resume work in the sampled route. Header density/real keyboard remain open. |
| Ambiguous Add dismissal | **Addressed in the sampled route.** Type/instruction/Quit are explicit and chooser Escape retains intent. The earlier successful-Add return to Navigate is **superseded by human decision**, not an outstanding defect. |
| Unnamed Orbit controls | **Addressed in source, partly verified live.** Current Move exposed named Resize controls. Renderer lines 291–354 now name axis, center and rotation operations with targets and hide inactive handles appropriately. Full keyboard/assistive-technology behavior was not revalidated. |
| Narrow forms and confusing built-in/custom labels | **Substantially addressed in Inspector**, including Description, responsive width, sections and bottom feedback/actions. Technical identifier spelling remains in Hierarchy/map accessible labels. |

## Nuxt UI default and exception boundary

The [final human policy](../tickets/08-confirm-nuxt-ui-adoption.md#resolution) is decisive: use Nuxt UI components to the greatest practical extent, evaluating configuration, slots and adapters before equivalent bespoke UI. B's appearance and interaction contracts do not depend on its current native-button implementation.

- The current UButton/UInput/UTextarea/USelect-based Inspector and Nuxt UI modal/popover integrations show that the design can coexist with library primitives. This is evidence of current use, not a claim that every candidate library component meets every requirement automatically.
- Reassess Dock controls, panel commands, Map files, hierarchy/catalogue rows, Fields buttons/forms and persistent editor composition. Ordinary controls are not exceptions merely because their content describes Orbits or custom fields. Source ownership of draft/navigation state can remain separate from reusable presentation components.
- Preserve desktop non-modal map access and compact fullscreen/exclusive editing when choosing composition. A narrow custom arrangement may be justified after adaptation is evaluated, but the entire existing envelope is not pre-approved. Record the specific unmet requirement, attempted adaptation, smallest remaining custom surface and verification evidence; no new per-component human permission process is needed.
- D3/SVG geometry, authoritative validation, session draft ownership, persistence and interchange remain application-owned. This is compatible with maximum library reuse and prevents presentation defaults from silently changing domain or save semantics.
- One theme/token preference must cover shell, maps and teleported menus/dialogs. Current light/dark sampling and draft retention do not certify portal completeness, OS default, durable preference or first render. Current `theme` initialization/toggle in Workbench lines 274/1561 remains a memory-only prototype implementation.
- Package actually used icons locally, including dynamic selections; test fresh browser and server without external Internet. Preserve the dossier's known cold-icon failure. Test focus entry, visible focus, dismissal and return in integrated components rather than assuming library adoption guarantees accessibility.
- Historical additional 628,307 received JS/CSS bytes include comparison scaffolding and other changes. They are not isolated Nuxt UI cost or the final interface budget. Measure the integrated artifact without A/C comparison code; missing baseline timing samples are not zero-cost measurements.

## Readiness and next action

**No new essential human design choice blocks specification synthesis.** The accepted contracts are sufficient to describe the product, provided the specification explicitly separates intended behavior from prototype omissions and assigns the known fixes above.

For records 12/15, reuse the selected Dock artifact, nine controls cases, anchored chooser/Orbit follow-up, human phone feedback, this review and the source-specific dossier. Reconcile their criteria individually. Existing evidence does not become a full physical-gesture pass, and the unimplemented context-banner refinement must stay identifiable. If a remaining criterion requires a visual demonstration, produce only that narrow delta; there is no reason to restart the broad comparison or seek the same Dock vote. A new precise human question is warranted only for an actual desired contract change, such as relaxing keyboard-open action access—not to approve routine composition work already delegated.

The specification should carry the required integration work: menu layering; compact Fields and Add chrome; real keyboard reachability; named/focusable controls and explicit focus paths; full baseline editing and attachment/order capabilities; application-owned draft exclusions and guarded transitions; durable save/retry/backup recovery; coherent persisted themes/local icons; and complete full-scene active-light/active-dark/print SVG/PNG behavior. Missing prototype controls and simulated failure/retry are not permission to reduce functionality. Exact palette values and dense-content/map-area acceptance belong in that buildable specification and its bounded validation plan.

Optional polish includes reducing repeated instructional prose and decorative context, regularizing secondary type sizes, and using consistent display labels. It should not obscure the concrete reachability work.

Reuse the 26 development Fields cases, four production placement cases and eleven production Inspector cases with their original source identities; do not sum them with this review into a new current-version score. Physical second-contact success, full keyboard/screen-reader behavior, contrast measurements, real persistence, exhaustive image exports and final performance remain unverified here. The real Android/Firefox failures remain open. No application change, ticket closure, production approval or publication is implied by this report.
