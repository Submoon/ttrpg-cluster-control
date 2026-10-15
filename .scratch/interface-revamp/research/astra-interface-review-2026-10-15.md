# Independent Astra review of the corrected B interface

## Overall verdict

**Continue with the accepted B direction, but do not call the current preview ready for acceptance.** The map-led composition, restrained field-console styling, explicit system return, and separate inspector are a convincing foundation. Navigation and draft protection worked on the representative route inspected. The interface still needs a functional Fit correction and clearer operational hierarchy, more readable controls, and a less vertically expensive mobile field-management flow. These are refinements of B, not grounds for restarting the layout choice.

This is a review of the whole interface. Tools coherence is an explicit sub-verdict below. No final Nuxt UI adoption decision or closure of ticket 10 follows from this report.

## Build, method and limits

- Reviewed on 2026-10-15: commit `4d90f9774ea14b49fe6f99f1c72becacfd8454ed`, branch `codex/interface-revamp`, [draft PR 28](https://github.com/Submoon/ttrpg-cluster-control/pull/28).
- Live [B branch preview](https://ttrpg-cluster-control-git-codex-interface-revamp-submoon.vercel.app/). Exact-SHA Vercel SUCCESS and [deployment identity](https://vercel.com/submoon/ttrpg-cluster-control/FN4szvZbJrXNqsHAaHqioZhMx4zg) were supplied and recorded by the parent immediately before review; the page itself does not expose a SHA. This attribution depends on that deployment evidence, not an independent build fingerprint in the browser.
- `git fetch origin` completed after a sandbox write restriction was resolved. HEAD is the reviewed SHA; fetched `origin/main` is `629d2a98715c3a16b954e0f77c639b1f0c31212c`; comparison is 0 main-only / 6 branch-only commits. The feature branch is the intentional review base. Existing local work was preserved.
- Authenticated IAB in the subagent session. The parent's tab IDs were unavailable in this isolated session, so a new hidden disposable tab was created. No human tab or baseline persisted workspace was touched. Review-tab viewport override was reset and the disposable tab closed at completion.
- Desktop screenshot approximately 1265 × 712; explicit overrides 390 × 844 and 844 × 390. Scrollbar gutters reduce drawable width (landscape SVG measured 829 pixels with window width 844). These are desktop browser size overrides, not touch-device emulation or physical-device evidence.
- Input: semantic browser clicks, text entry, one Escape key attempt, and read-only DOM inspection. Scenes: Outer Reach Jump Cluster and Vela Reach. Actions: system entry/return, hierarchy selection, inspector open/hide/reopen, draft editing, guarded return with Stay, draft discard, blank-name Apply validation, Fields selection, Add catalogue opening/closing, Fit, theme toggle and viewport changes.
- No new builds, automated tests, import/export campaign, physical gestures, screen-reader session, contrast measurement, virtual keyboard or safe-area hardware test. No claim that the requested two-contact/long-press behavior is physically accepted. The human-provided phone name remains “Nothing phone 4a pro”; OS/browser unknown.
- Seeded memory-only state and incomplete production parity remain explicit prototype boundaries. Historical theme/export/offline limitations are not relabeled as newly introduced regressions. See [existing evidence](b-device-preservation-evidence.md) and `README-PROTOTYPE.md`.

## Prioritized findings across the interface

### P1 — Fit can remove the complete system drawing from view

**Observed current defect; introduction date not established.** Clean reproduction at 844 × 390: reload the disposable B page, open Vela Reach in Navigate, observe the system drawing, click Fit. The canvas becomes empty while the context, selection and entity accessibility nodes remain. Read-only DOM inspection finds the map transform `translate(-79859.74531173706,-15362.942461013794) scale(0.25)`. The earlier portrait sequence produced the same result; returning to the cluster and reopening Vela retained the unusable system view.

This breaks a recovery control precisely when a Warden needs to find the map. Reachable zoom-button centers do not establish functional Fit correctness. Fix before presenting this build as a successful device-validation candidate. Relevant entry points: `components/PrototypeWorkbench.vue:97`, `components/PrototypeMapCanvas.vue:339`, `components/SystemMap.vue:196`.

The parent team's separate targeted source diagnosis identifies an out-of-range seeded unoccupied Orbit center (`PrototypeWorkbench.vue:1068`) interpreted as normalized coordinates by `utils/system-map-geometry.ts:53`, inflating the bounds used by Fit. That is corroborating source analysis from SOL, not an independently executed repair by this reviewer. Historical huge SVG bounds may share this cause; this review does not attribute the defect to the latest phone corrections.

### P2 — Operational hierarchy is flatter than the tasks it represents

**Design recommendation, grounded in observed controls.** Navigate, Move, System/Add mark, Route/Orbit, Hierarchy, Import, Export and Inspect all use substantially the same rail treatment. Inspect is separated from Hierarchy by two file commands; modes and panel toggles can both look active. The underlying DOM already distinguishes pressed modes from expanded panels, but the visual grouping does not make that distinction easy to learn. This matters especially at phone size, where every slot consumes scarce space and hover titles are unavailable.

Use the concrete grouped alternative below. Keep explicit Inspect and full-height mobile editing; do not restore removed Details or duplicate zoom controls.

### P2 — Control typography makes the interface harder to read than its panel headings

**Observed visual weakness; not a measured WCAG failure.** The attractive large serif map/panel titles coexist with very small rail labels, status text and map metadata. At desktop size, identifying tools requires reading tiny captions beneath generic symbols. At 844 × 390, the wide single-row rail repeats this problem. The source confirms `.rail-button span { font-size: .43rem; }` at `PrototypeWorkbench.vue:1226`; the narrow-phone override improves this to `.58rem`, but landscape still needs attention. The desktop map footer is `.48rem` at line 1233.

Increase task-bearing labels first and reduce decorative microcopy/duplicate context to pay for the space. Keep the distinctive typography for headings; choose readable action text before preserving the current eight-item density. Light and dark shells both preserve the broad hierarchy, but this sampling does not certify contrast or complete theme coherence.

### P2 — Mobile Fields spends most of the first screen on the definition list

**Observed usability weakness.** At 390 × 844, opening Fields stacks the whole native/custom list above the editor. With only five seeded definitions, the selected editor begins around the lower third of the screen and its Edit action is below the fold. Selecting Threat index changes the lower editor without bringing the editing action into view. A larger real catalogue will exacerbate the travel and disconnect between selection and action.

Prefer a compact selected-field chooser/list-to-detail transition on narrow screens, with a persistent Back to definitions path and retained selection/scroll. Keep the desktop two-column structure, which makes selection and existing assignments understandable. This is an information-layout recommendation, not a request to remove the impact-review workflow.

### P2 — Add catalogue dismissal is ambiguous about the next map tap

**Observed behavior; design clarification needed.** Opening Add mark selects the placement mode and displays a useful explicit one-placement explanation. Closing the catalogue leaves Add mark pressed and Navigate unpressed. That can be intentional—the chooser must get out of the way for placement—but “Close” alone does not distinguish “continue placing the chosen Planet” from “cancel adding.” The remaining footer describes pan/zoom rather than the armed placement operation.

Give the pending operation a compact, visible instruction such as “Place Planet · tap map or Orbit” with an explicit Cancel action. Distinguish dismissing the chooser from canceling placement. Keep the accepted return to Navigation after one successful placement. Placement completion was not exercised here. An Escape attempt was issued at the end, but the immediate AX diff did not establish the resulting pressed-state change; keyboard cancellation is not certified by this review.

### P2 — Some map adjustment controls lack accessible names

**Observed DOM accessibility gap, bounded to Vela.** The system DOM snapshot exposed named radius sliders alongside additional unnamed sliders, and an unnamed button under the unoccupied Orbit group. Users navigating controls without seeing the drawing cannot identify those operations reliably. Entity buttons, the explicit Back action, zoom buttons and inspector form labels were otherwise meaningfully named in the sampled snapshot.

Give every operable Orbit handle a name describing the operation and target, and verify keyboard behavior in the intended mode. This finding is based on rendered accessibility/DOM structure, not a screen-reader test; it does not claim every unnamed node was keyboard reachable.

### P3 — Form density and terminology can better express the editing task

**Design recommendation.** In the full-width landscape inspector, the name and notes controls remain narrow while most of the width is unused; Apply/Discard require vertical travel. At portrait size, the primary notes textarea is also much narrower than the panel. The seeded “Session notes” and custom “Session note” are easy to confuse, and technical labels such as `CELESTIALBODY / PLANET` and `JumpPoint / jump-point` leak implementation-like spelling into otherwise readable content.

Use available field width, preserve clear grouping and reachable actions, and distinguish built-in notes from the seeded custom field. Translate display labels into established domain language without changing domain identifiers. The full-height mobile presentation itself is coherent and should remain as accepted.

## What worked and should be preserved

- B makes the map the primary workspace. Dark green, warm accents and restrained borders give the interface a recognizable identity without requiring decorative illustrations.
- Navigate opened Vela without Inspect. Back to Jump Cluster was visible at portrait and short landscape sizes. Context labels remained present, though the top-bar system name truncates on the phone and repeats the more useful map HUD.
- Hierarchy exposed the cluster, systems, objects and nested Orbits, then selecting Aster opened its inspector and closed Hierarchy. This provides an important alternative to targeting crowded map labels.
- Editing Aster's label, Hide, then reopen retained the draft. Back to Jump Cluster opened the explicit Apply/Discard/Stay guard. Stay preserved context and draft; Discard restored the applied value. The dialog accurately explains in-memory application rather than implying durable saving.
- Applying an empty star name was refused with “Object name is required.” The draft stayed available. This is one demonstrated validation route, not complete validation coverage.
- Mobile Inspect occupied the full viewport and removed rail/zoom from the visible accessibility tree. Hide remained in the sticky header. This meets the intended separation between map work and focused editing on a narrow display.
- One zoom set and a bottom rail were present in the sampled phone layout. No new duplicate zoom/Details issue was observed. The current hierarchy of buttons remains worth improving even though their placement corrections are visible.

## Tools coherence sub-verdict

**The capabilities are coherent; the current presentation is only partly coherent.** They support a sensible Warden workflow, but the rail presents several different interaction contracts as peers. This is more than icon polish and less than a need for a Foundry-style layer system.

| Current control | Actual role and expectation | Assessment |
| --- | --- | --- |
| Navigate | Persistent interaction mode; system activation changes context; background manipulation navigates the view | Appropriate default. Keep distinct from editing and expose next-gesture guidance. |
| Move / Modify | Persistent editing mode; changes what object manipulation does | Keep paired with Navigate. “Move” is clearer than a generic edit icon, but modification capabilities need discoverable guidance. Physical drag arbitration was not retested here. |
| System / Route | Cluster-context placement operations | Name as “Add system” / “Add Jump Route” where space permits; bare nouns under Tools obscure intent. Do not imply a permanent editing mode. |
| Add mark / Orbit | System-context catalogue choice and Orbit placement | Shared Add family is sensible. Keep the selected subtype visible after closing the catalogue. Orbit needs the same explicit Add wording. |
| Hierarchy | Panel for structure, selection and context access | Belongs beside Inspect, with expanded-state styling. Choosing an item can lead to editing; explain through item affordances rather than treating the panel as a map mode. |
| Inspect | Selected entity's editing panel | Explicit entry is necessary, including as the alternative to long press. Its active appearance should mean panel open, not a third interaction mode. |
| Import / Export | Immediate file operations; Export rail action invokes PNG | Separate from interaction modes. “Import map…” and “Export image…” clarify asymmetrical scope. No actual file operation was run. |
| SVG / Share | HUD commands; SVG invokes export, Share copies prototype link | Duplicate export access and vague Share scope merit consolidation; sharing this prototype URL does not share the user's in-memory draft. This known limitation must remain explicit. |
| Fields / Theme | Reusable data definitions and presentation preference | Global command placement is defensible. Fields also has a contextual Manage entry in Inspect, which usefully connects assignment to definition. |

### One concrete alternative to evaluate

Keep B's floating map and desktop side rail, with three clearly separated groups: **Navigate / Move**, **Add…**, **Hierarchy / Inspect**. Add opens context-appropriate options (System, Jump Route in cluster; catalogue mark, Orbit in a system); choosing one arms a visible one-shot placement prompt with Cancel. A selected subtype can remain a quick repeat choice, but each completion still returns to Navigate. Put **Import map…, Export image… (PNG/SVG), Share preview link** in one map/document menu near the map title; keep Back to Jump Cluster directly visible. Keep Fields accessible globally and through Manage.

On mobile, retain the same five principal entries in a readable bottom row, with named groups or spacing and an unmistakable mode indicator. Opening Hierarchy or Inspect still hides the rail. A visible pending-placement strip occupies map chrome only while an Add operation is armed.

Trade-offs: this reduces permanent controls and improves classification, but adds one step to selecting an Add type or file action. Frequent route creation might justify a context-specific quick action after usage evidence. Do not add a second persistent selection mode, copy Foundry's complete layer architecture, or remove one-finger Move editing to simplify explanation. The human should decide whether the extra menu step is worth the clearer everyday map workspace.

## Official Foundry reference, and the inference drawn

Consulted official documentation on 2026-10-15:

1. [Glossary of Terms](https://foundryvtt.com/article/glossary/), updated August 20, 2026, version 14.367. It describes Scene Controls grouped by placeable document type, Scene Navigation as a separate context surface, and a Sidebar chiefly for document collections/settings. **Inference for B:** distinguish gesture controls, context navigation and information panels. B has fewer object families and a different schematic-mapping task, so full layer switching would add unnecessary complexity.
2. [SceneControlTool API](https://foundryvtt.com/api/interfaces/foundry.SceneControlTool.html), version 14. The documented model distinguishes an active tool, an immediate button that does not become active, and an on/off toggle. **Inference for B:** mixed control types can coexist in a tool system, but their states and grouping must communicate different effects. Foundry is not evidence that every tool must be a persistent mode, nor that file commands belong among B's gesture modes.
3. [Tiles](https://foundryvtt.com/article/tiles/), current page consulted; its illustrations identify version 14.368. It distinguishes Select Tile, Place Tile and editing via a configuration/palette, including cancellation of creation. **Inference for B:** clearly separate selecting/manipulating existing content from creating content, and make completion/cancellation legible. No Foundry touch, one-shot placement or mobile behavior is assumed from this reference.

These sources support organizing principles, not a mandate to reproduce Foundry's appearance or interactions. The dated version-14 material was preferred over an older orientation article surfaced by search; product documentation evolves and these conclusions are bounded to the cited pages.

## Follow-up decisions and acceptance boundary

Correct and recheck the current Fit failure with explicit new-build provenance. Then consider the grouping alternative, minimum readable action typography, mobile Fields flow and pending-placement feedback as a small set of design decisions. Preserve the working navigation/draft contracts while doing so. Physical phone input, keyboard paths, assistive technology and production save semantics remain separate acceptance work; no wholesale redesign, publication or implementation was performed by this review.

## Human proposed mode split

### Interpretation and recommendation

The human subsequently proposed separating selection/data modification, movement only, and adding things or moving existing objects (possibly split). This is conceptual analysis requested after the review, not another browser test or an accepted replacement contract.

**Recommendation: separate existing-object manipulation from Add. A dedicated selection/data mode is defensible if deliberate editing is the goal; retain Navigate rather than replacing it with strict Pan for now.** The resulting candidate is **Navigate / Select / Move**, plus **Add… as a temporary operation**. Select means selecting a target for its data editor; Move means changing existing geometry on the map. These are task distinctions, not four mutually exclusive permanent modes.

“Movement only” is ambiguous. The primary reading here is **moving the view**, because the final proposed category already mentions moving objects. If it means **moving objects without editing their data**, it is simply Move in this recommendation: there is no reason to add a second tool that also moves those same objects. In that reading, Select / Move / Add, with existing Navigate retained for browsing, covers the request.

### Three concrete models

| Model | Persistent modes and temporary action | Benefit | Cost / judgment |
| --- | --- | --- | --- |
| A — Earlier compact proposal | Navigate, Move; Add…; Hierarchy and Inspect are panels | Lowest mode-switch cost; preserves the accepted default and five principal entries | Selecting data still relies on explicit Inspect, long press or Hierarchy. Good for browsing, less explicit for deliberate editing. |
| B — Literal split | Pan, Select, Move; Add… | Maximum separation: Pan cannot accidentally open or edit an entity | Strict Pan removes direct system opening from the default map tap; needs a separate Open system action. Adds mode switches even during ordinary browsing. Not my preferred default. |
| C — Recommended candidate | Navigate, Select, Move; Add… | Keeps direct browsing while giving data editing and geometric editing distinct intentions | One extra persistent mode versus A. The six principal entries, including Hierarchy/Inspect panel access, need a layout decision; do not merely squeeze another tiny icon into the rail. |

The following table describes **proposed** pointer semantics. It is not a claim about untested current gestures. “Select” below means select the target and request Inspect through the existing draft guard. On mobile this opens the accepted full-height panel, so sequential inspection requires Hide between targets unless Hierarchy supplies the next target.

| Action / gesture | A — compact | B — strict Pan split | C — recommended candidate |
| --- | --- | --- | --- |
| Tap system in default mode | Navigate opens its map, Inspect closed | Pan does nothing to the entity; use explicit Open system | Navigate opens its map, Inspect closed |
| Tap object to edit data | Select target then explicit Inspect, or long press / Hierarchy | Select mode: select target and request Inspect | Select mode: select target and request Inspect |
| Tap system while selecting data | Explicit inspection path needed | Select edits system metadata; explicit Open system enters it | Select edits system metadata; explicit Open system enters it |
| One-pointer drag on background | Pan view | Pan view in Pan; allow background pan in other modes too | Pan view in all three modes |
| One-pointer drag on existing entity | Move changes geometry; Navigate navigates without editing | Pan moves view even over entities; Select never changes geometry; Move changes geometry | Navigate navigates without editing; Select never changes geometry; Move changes geometry |
| Two-contact gesture | View navigation only | View navigation only | View navigation only |
| Long press on entity | Request Inspect in Navigate/Move | Keep existing request in Move; whether strict Pan also opens Inspect requires an explicit decision | Request Inspect in Navigate/Move; in Select this is an alternative to tap, not another operation |
| Add chosen type | Arm placement, then complete or Cancel | Same; no moving existing objects while armed | Same; no moving existing objects while armed |
| Finish placement | Return to Navigate under current contract | Would need an explicit decision to return to Pan instead | Return to Navigate under current contract |

### Why Add and Move should remain separate

An Add gesture creates a new identity; a Move gesture changes an existing entity. Combining them makes an ambiguous tap or drag especially costly near small or overlapping targets: a miss can create something instead of moving it. It also obscures what “done” means. Move can remain active for several edits; Add must visibly show its chosen type, placement progress (including route endpoints where relevant), and cancellation, and exit after one completed creation. A menu can group both under editing, but it must not leave the same gesture ambiguously responsible for both effects.

Selection is shared state across modes, not ownership of the Select tool. Switching mode should retain a valid target, viewport and draft. “Select” must not mean that selection becomes impossible in Move, or that opening Inspect automatically changes the manipulation mode. Hide/reopen remains a panel operation. The Select mode changes the effect of the next map tap; the explicit Inspect control opens the current selection's panel. Their visual states must differ, or the new split recreates the original confusion under different names.

### Geometry, keyboard and decisions still required

- **Data versus geometry is an interaction distinction, not a permissions boundary.** If the inspector contains coordinates, Orbit radii or host choices, applying those fields also changes geometry. Keep precise numeric editing available and label it as geometry. The Move tool means direct map manipulation, not exclusive authorization to change position. If the human wants a true geometry lock, that is a separate requirement.
- **Keep two contacts reserved for the view in every mode.** A second contact must cancel uncommitted geometric/placement preview rather than committing an accidental edit. Preserve one-finger editing in Move; a Pan mode does not justify removing it. Long press must continue to cancel movement preview before opening Inspect.
- **Keyboard must offer the same intentions without requiring long press.** Focusable, named mode buttons; explicit Inspect and Open system actions; visible Cancel plus Escape for an armed Add; keyboard geometry controls with target/operation names. Do not assign arrow keys simultaneously to view pan and object motion without an explicit mode/focus rule. Specific shortcuts and focus transitions need design/validation; they are not accepted merely by this table.
- **Do not reset a dirty draft when changing mode.** Preserve it, and apply the existing guard when selection/context changes or another action would invalidate its target. Whether opening an existing target in Select focuses the first field or only the panel header should be decided and tested for keyboard users.
- **Model C needs a human decision to add Select and define tap-to-edit.** Existing Navigate remains default; system taps still open a map without Inspect. Strict Pan as a replacement default (model B), a different post-Add return mode, or removal of long-press inspection would each change an existing decision and need explicit agreement. None is inferred from the question.
- **Layout cost is real.** Model C has four map-operation entries rather than three in the earlier proposal. Hierarchy/Inspect access must remain available, but can be visually grouped as panels instead of pretending to be more map modes. Decide that grouping before increasing the mobile rail count. If the extra mode proves cumbersome in representative browsing/editing, model A remains the simpler fallback.

The previously cited Foundry sources support distinguishing active tools, immediate actions and toggles, and separating selection from creation. They do not establish that this application needs strict Pan, a particular number of modes, or any of the proposed touch rules. The recommended candidate is an application-specific judgment; no implementation or ticket closure is authorized by this analysis.
