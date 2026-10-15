# Mobile Fields flow: source analysis and decision frontiers

## Scope and provenance

Planning support for [Decide the mobile Fields list-to-editor flow](../tickets/13-decide-mobile-fields-flow.md). This report establishes facts and records the human's Q1–Q4 answers relayed by the coordinator. The [ticket's Resolution](../tickets/13-decide-mobile-fields-flow.md#resolution) is the canonical final contract; this report retains the supporting analysis and historical decision frontiers. The coordinator owns closing the ticket and updating the map. No implementation, runtime launch, browser interaction, Git mutation, publication, or test execution occurred in this analysis.

Coordinator-supplied fresh baseline, 2026-10-15: intentionally different preview/planning branch `codex/interface-revamp`, `HEAD = origin/codex/interface-revamp = d756cf8b3e44a6015e304a44c7db62884ea5d662`. Fetched `origin/main` is `629d2a98715c3a16b954e0f77c639b1f0c31212c`; comparison is 0 main-only / 12 branch-only. GitHub source request was refreshed by the coordinator: open, unchanged, no comments. Historical review observations have their own earlier build provenance below.

The coordinator fetched again before the second frontier, after receiving Q2/Q3, and after final Q4 confirmation, confirming the same baseline and comparison. The coordinator also refreshed GitHub issue 3 after Q4: open, unchanged, no comments. This report does not perform an independent fetch.

Read the Wayfinder, grilling and domain-modeling skills, repository agent/issue-tracker/domain instructions, root `CONTEXT.md`, parent map, Astra review, resolved field-management/applicability contracts, and the accepted draft contract. No `docs/adr/` directory exists in this checkout; no new term, glossary change or ADR is needed for this presentation choice. The separate Dock/Add-status feedback is outside this report.

## Facts: actual current flow

| Concern | Evidence and current behavior |
| --- | --- |
| Entry points | B's global **Fields** (`components/PrototypeWorkbench.vue:75`) and inspector **Manage** (`components/PrototypeInspector.vue:36`) both call the same no-argument `openFieldManager()` (`PrototypeWorkbench.vue:915`); one shared `FieldDefinitionsDialog` receives both (`:205`). Manage does not identify a particular definition or filter by the current object. |
| Opening | `components/FieldDefinitionsDialog.vue:228` resets creation inputs and selects `native:atmosphere`, then opens a native modal dialog. Opening does not change map selection or context in the B caller. There is no explicit last-selected-definition or list-scroll restoration. |
| Selection and layout | The list is rendered before the selected editor (`FieldDefinitionsDialog.vue:47`); selection updates its ID without moving focus or scrolling the editor into view (`:213`). Desktop uses two columns (`:492`); below 760 px these become one column (`:565`). The custom list section spans the list's narrow-screen grid (`components/field-definitions/FieldDefinitionList.vue:139`), so every custom row still precedes the editor. |
| Display versus editing | Selection displays a definition's detail. Controls are disabled until **Edit**. Name/options/applicability, existing assignments and any affected assignments all precede the Edit/Save/Cancel/Delete action group (`components/field-definitions/FieldDefinitionEditor.vue:1`, `:94`, `:108`). Removing the list obstruction alone therefore does not guarantee reachable actions with many assignments. |
| Definition contents | Two built-in single-select definitions, Atmosphere and Port class, precede custom definitions (`components/field-definitions/model.ts:83`). Custom fields support text, number, boolean and single-select. Creation chooses the type; current editing changes custom name, relevant options and applicability, not the type. Only custom definitions offer deletion (`FieldDefinitionEditor.vue:145`, `:265`, `:305`). |
| Assignments and scope | Assignments retain object, system and value; their projection includes stored values on objects currently outside the field's applicability (`components/field-definitions/model.ts:152`). `FieldDefinitionValues.vue:1` renders a read-only list, not an object-value editor. |
| Creation | **New custom field** is in the list (`FieldDefinitionList.vue:23`). It opens a creation form after the entire list/detail layout (`FieldDefinitionsDialog.vue:71`, `:266`), creating another potentially long scroll. Successful creation selects the newly added definition; deletion selects Atmosphere (`:324`). |
| Destructive review | Removing used options prepares affected assignments; custom deletion prepares all assignments. The dialog's review is appended after the creation form and requires an explicit confirmation (`FieldDefinitionsDialog.vue:119`, `:283`; `FieldDefinitionEditor.vue:265`, `:305`; `FieldDefinitionChangeConfirmation.vue:1`). Cancel clears only the pending review. |
| Conflicting object draft | B permits opening Fields while an object draft exists. At attempted field application, it checks conflicts (`PrototypeWorkbench.vue:942`, `:957`, `:991`). Apply object draft cancels the old field-impact review and requires saving the field change again for renewed review; Discard retries the prepared change; Stay keeps both drafts (`:631`). Invalid object Apply keeps the conflict and error. |
| Save boundary | B publishes memory and increments the field revision before its simulated save (`PrototypeWorkbench.vue:919`). The baseline persistence workflow instead acknowledges after awaited commit (`composables/editor-workflows/useFieldDefinitionWorkflows.ts:54`, `:132`). Neither prototype simulation nor static reading establishes production durable-save parity. |
| Scroll, keyboard and focus | The dialog itself scrolls and is limited by `100dvh`; the header and field actions are not sticky in the inspected component (`FieldDefinitionsDialog.vue:389`, `:454`; `FieldDefinitionEditor.vue:108`). The explicit close-focus restoration references the component's own trigger (`:256`), which B hides (`PrototypeWorkbench.vue:205`); native dialog return-to-opener behavior and nested conflict focus need later verification. |

The [Astra global review](astra-interface-review-2026-10-15.md#p2--mobile-fields-spends-most-of-the-first-screen-on-the-definition-list) observed the obstruction at 390 × 844 with only five definitions on `4d90f9774ea14b49fe6f99f1c72becacfd8454ed`: selecting Threat index changed the lower editor without revealing Edit. That is dated desktop-browser viewport evidence. This source analysis confirms the same structural cause in the current component; it is not a new phone reproduction.

## Established decisions: preserve without another approval round

- The human selected a map-bound Quick Dialog over a separate management page: [Prototyping field-definition management](../../ttrpg-cluster-control/tickets/18-field-definition-management.md#resolution). A list/detail transition inside that dialog does not require application routing or a new domain model.
- Reusable definitions remain distinct from optional per-object values. Preserve native/custom kinds, custom creation types, options, applicability, existing assignment inspection and explicit impact review. Preserve desktop list/detail usefulness.
- Applicability controls visibility and **preserves stored values**; option removal and custom-definition deletion own value-clearing review: [Scoping custom fields to categories and subtypes](../../ttrpg-cluster-control/tickets/27-custom-field-applicability.md#resolution).
- [Define revamp guarantees for drafts, selection, and saving](../tickets/05-editor-state-and-preservation.md#resolution) governs field edits and creation too: presentation hiding and responsive remounting preserve session drafts/feedback; only explicit Cancel/Discard or successful in-memory Apply ends a draft. Moving to a different target or incompatible editor with modified work requires Apply/Discard/Stay; clean editing needs no prompt. Refusal or invalid Apply preserves the current state. Renew destructive review if resolving another draft changes consequences.
- Preserve global Fields and contextual Manage, map context/valid selection, clear return paths and focus. Do not conflate in-dialog Back with leaving the map, changing a definition, or discarding work.

**Static gaps against the accepted contract, not newly reproduced defects.** The closed draft ticket explicitly says, at line 82, “Apply the same policy to object, Orbit, Jump Route, chart-name, and field-definition drafts, including creation forms.” Lines 83–84 make presentation close a hide and require Apply/Discard/Stay for modified-target transitions, without prompting for a clean edit. Selecting a different definition, opening creation and closing the current dialog instead use discard-only `window.confirm`, based on editing mode rather than actual dirtiness (`FieldDefinitionsDialog.vue:213`, `:245`, `:266`). Closing unmounts the editor and opening resets creation; creation content itself is not covered by that close guard. This is source evidence of behavior differing from the intended contract, not a new browser reproduction or authorization for a separate bug fix. Future responsive work must honor that accepted contract. This planning report neither repairs the gaps nor claims they have been repaired.

## Candidate mobile structures

These alternatives retain the management dialog and desktop two-column layout. They were the initial analysis candidates; the human subsequently chose A, as recorded below. B and C remain comparison context, not open alternatives requiring another vote.

| Choice | Concrete interaction | Benefit | Trade-off |
| --- | --- | --- | --- |
| **A — List then detail** (recommended) | A mobile definitions screen groups native/custom rows and New custom field. Tapping a row replaces the list with that definition's detail/editor region. A visible **Back to definitions** returns inside the dialog. | A chosen definition no longer follows all other rows; metadata remains readable in a large catalogue. Reuses current list and definition identity. | Switching definitions adds a Back step. Requires explicit list/detail state, selection/focus/scroll restoration and preservation of the mounted or externally owned draft. |
| **B — Compact chooser above detail** | A compact selected-definition control stays above the detail; activating it opens a bounded picker, then returns to detail. | Efficient repeated switching; little persistent vertical list cost. | Kind/type/applicability are less visible until opening the picker. Long catalogues make picker design important. A plain unlabeled select would lose current useful row information. |
| **C — Expand selected row inline** | The list remains the mobile screen; the selected row expands its detail directly beneath itself and other details close. | Familiar browsing with immediate row-to-content proximity. | The chosen row can still be far down a long catalogue, expansion moves later rows, and returning among long details is less predictable. More scroll/focus complexity for weaker separation. |

No search, filtering, virtualized list, bulk editing, new field type or multiple shelved definition drafts is required to resolve this structure. A large-catalogue scenario is necessary; a specific new search feature is not established by this analysis.

## Q1: human-selected mobile structure

The coordinator asked the human to choose A, a definitions list followed by a dedicated definition detail/editor view inside Fields with Back to definitions, or B, a compact chooser above the editor. Desktop retains two columns in both.

**Human answer, 2026-10-15: A — list then detail.** This actual answer was relayed by the coordinator. It selects the proposed mobile navigation structure; it does not decide initial opening, direct-edit versus inspect-first, action placement or all detailed return behavior. No implementation or final physical-device acceptance follows from this answer.

## Historical second frontier: Q2 and Q3

After Q1 selected A, these two independent questions were ready together. The wording below records that historical frontier, which initially had no answers; the actual subsequent answers are recorded immediately after it. Each recommendation is separate from Q1.

**Q2 — Opening and resumption.** Do you accept a shared Fields/Manage memory during the session: the first opening shows the definitions list, then reopening resumes the last valid Fields view, including its current draft? The alternative always opens the list, while still preserving and clearly exposing any retained draft.

**Recommendation: shared memory and resume.** Both entries currently open the same manager without a field target. A single remembered state is the smallest coherent policy and avoids sending a person back through the list after hiding an unfinished detail. It must not automatically enter a field merely because Manage came from an object inspector. Memory is session-only and never changes map context/selection. If the user closed Fields while viewing the list, reopening resumes the list; if they hid it while viewing detail/creation, resume that valid view. Deleted targets cannot be resumed.

**Q3 — Selecting an existing definition.** Do you accept opening an inspect-first detail showing its definition and existing assignments, with an immediately reachable Edit action, before enabling changes? The alternative enables editing as soon as the row is selected; it still requires explicit Apply to change data.

**Recommendation: inspect-first detail, then Edit.** Definition management is useful for checking scope and assignments as well as editing, and this preserves the current distinction between reading and editing. The cost is one additional action for someone who already intends to edit. This is a real interaction choice, separate from layout; direct edit does not itself apply data.

## Q2 and Q3: actual human answers

The coordinator relayed the following actual answers on 2026-10-15:

- **Q2: Resume the last screen**, the recommended answer. Fields and Manage share session memory: first opening shows the list, and reopening resumes the last valid view/draft. The bundled navigation rule is accepted: Back to definitions recovers list position/highlight while hiding and retaining the draft; moving to another definition follows the previously accepted draft guard. Close hides Fields and returns to its actual opener. This does not create a field-specific Manage target or durable draft storage.
- **Q3: A — Detail then Edit**, the recommended answer. Selecting an existing definition opens its read-only detail with a reachable Edit action. Selection does not immediately activate editing.

At that stage, these answers settled opening/resumption and existing-definition selection; creation/deletion destinations and final shared understanding were still pending. The subsequent actual Q4 confirmation below settles the proposed destinations. Exact action layout remains a prototype concern.

## Coherent navigation and reachability recommendation

The following describes the accepted navigation behavior, the application of existing preservation contracts, and the still-unvalidated action-placement recommendation:

- **Back to definitions** stays inside Fields, returns to the saved list position and selected-row highlight/focus, and hides the current detail without ending its one draft. Selecting that same row resumes it. Choosing another definition or New is a target/editor transition and uses the accepted modified-draft guard; clean edits need no prompt. These rules do not authorize several shelved definition drafts.
- **Close Fields** hides the manager and returns focus to the actual Fields/Manage opener while preserving the underlying map/inspector. Reopening resumes the last valid Fields view under the actual Q2 answer; draft preservation remains a requirement.
- Action reachability with long forms, assignments and the virtual keyboard is already a resolution criterion, not a yes/no choice. Recommend compact persistent navigation plus primary controls separated from the long assignment scroller, adapting to the visible keyboard viewport. **Edit** is reachable immediately on inspect-first detail; **Apply/Cancel** remain reachable while editing. Creation, validation errors, destructive review and conflict resolution must also work within the available viewport.
- An always-visible Apply starts or continues the existing impact/conflict workflow where necessary; it cannot stand in for explicitly reviewing and confirming the latest destructive effects. Preserve all assignment names/values and current feedback. No exact header/footer split, CSS mechanism or physical-keyboard layout is considered accepted by this text.

**No Q4 asking whether controls should be reachable is recommended.** A genuine visual placement question, if needed, can compare a bottom action strip with an upper action row using a later concrete prototype; both candidates must meet the mandatory reachability and review criteria. Asking that now without visual evidence would add interview cost without settling the usability fact.

## Historical final shared-understanding question

No essential structural unknown prevented one final recap. The following was prepared as one confirmation question allowing a targeted correction. Creation/deletion destinations were explicitly new proposals for that confirmation, not inferred from Q1–Q3. The actual Q4 answer is recorded after this historical recap.

**Proposed question: Do you confirm this complete Fields flow, including the proposed creation and deletion destinations?**

- **Accepted mobile structure and selection:** definitions list → read-only definition detail → Edit. Fields and Manage resume the last valid screen during the session; the first opening starts on the list. Desktop retains its two columns.
- **Accepted navigation and preservation:** Back to definitions restores list position and selected-row highlight/focus, hiding detail without discarding its draft. Selecting that same definition resumes it. Close hides Fields, returns focus to the actual opener, and allows subsequent resumption.
- **Proposed creation destination:** New custom field opens a dedicated creation form in the detail space. A valid applied creation shows the new definition's read-only detail rather than starting another edit draft. Explicit Cancel abandons only that creation draft and returns to the list without creating or changing a definition. A prior modified definition draft uses the established guard before New changes the editor target.
- **Proposed deletion destination:** after an explicitly reviewed, confirmed and successfully applied deletion of the selected custom definition, return to the list and focus a valid nearby row, falling back to the list heading or New control if no appropriate row exists. Cancelling the impact review leaves data and the definition draft unchanged. This replaces the current incidental selection of Atmosphere; it is a proposed presentation destination, not a domain change.
- **Existing required guards:** selecting a different target with modified work retains Apply/Discard/Stay. Validation refusal preserves the work and current context. Destructive impacts remain explicitly reviewed and confirmed; resolving another draft requires a renewed accurate review when effects change. Applicability changes retain stored values. Application and durable saving remain distinct under the accepted contract.
- **Required accessibility, proposed visual arrangement:** navigation, primary controls and errors must remain reachable with long assignments and the mobile virtual keyboard. Recommend a command band separate from long scrolling content; exact header/footer placement and CSS remain for the later prototype. This planning confirmation proves no physical-device behavior.

**Historical recommendation: confirm this coherent flow; a yes accepts the proposed creation/deletion destinations along with the recap.** The human could instead correct only the point differing from their intended workflow.

## Q4: actual final confirmation and closure check

**Human answer, 2026-10-15: “Confirmer ce parcours” (recommended).** The coordinator relayed this actual final answer. It confirms the complete recap, including the previously proposed creation and deletion destinations. Those destinations are now accepted decisions, not pending proposals. The earlier pending wording in this report describes historical interview stages only.

The [canonical final contract](../tickets/13-decide-mobile-fields-flow.md#resolution) belongs to the closed decision ticket. All essential structural decisions have been addressed: mobile list/detail, desktop preservation, first opening/reopening through both entry points, read-only selection before Edit, internal Back and Close, selected identity/list position/focus, retained draft and guarded target changes, creation and deletion destinations, impact/conflict review, and action reachability. There is no remaining human design question required to close this decision. [Validate the mobile Fields flow in the B prototype](../tickets/16-prototype-mobile-fields-flow.md) is the open, unclaimed follow-up for actual visual and behavioral evidence.

This confirmation authorizes recording the decision only. It starts no prototype preparation or implementation and certifies no phone, keyboard, focus, storage or production behavior. Exact visual placement, responsive mechanics and physical-device usability require later evidence. The coordinator is creating the separate HITL prototype ticket **Validate the mobile Fields flow in the B prototype**, open and unassigned, with the closed Fields decision as its only prerequisite. Inspector refinements and Dock/Add presentation are independent and introduce no artificial dependency. Later code belongs to Luna XHIGH under the coordinator's separately authorized scope.

## Minimum later prototype scenarios and missing evidence

- First opening, then a definition near the bottom of a long native/custom list; select, reach Edit, return and recover row/focus/scroll. Include long names, scope summaries and a definition with many assignments. Five definitions must also remain comfortable.
- Open from both Fields and inspector Manage; return to each real opener and the unchanged map selection/context. Hide/reopen during a modified definition or creation draft; resize/rotate/theme change; same-definition resume, different-definition Apply/Discard/Stay, and invalid Apply.
- Create each supported custom type, cancel without mutation, and select the created field on success. Delete the selected custom definition and use an explicit valid fallback after deletion; never retain a stale field ID.
- Remove an assigned native/custom option: inspect named affected values, cancel intact, confirm only the reviewed effects. Narrow applicability and show values remain stored. Repeat with a conflicting dirty object draft: Apply object, refresh impact, review again; Stay and validation failure preserve both work and context.
- On the human's Nothing phone 4a pro, portrait and short landscape, open the actual keyboard in name/options/creation forms; reach primary actions, cancel, Back/Close, errors and the destructive/conflict review without hidden controls or page overflow. Browser/OS and safe-area/keyboard behavior are not known. A desktop resized viewport cannot certify this.
- Verify ordinary keyboard focus order, modal containment, return focus, clear accessible names and Escape semantics; retain desktop two-column usefulness. Browser Back integration is not currently implemented by this local dialog and must not be promised implicitly.

The actual campaign catalogue size and switching frequency are unknown; no human data was supplied beyond the small seed. They are optional prototype refinement inputs and do not reopen the confirmed structure. There is no new browser, physical-device, assistive-technology or virtual-keyboard evidence in this report. Existing save/storage/JSON and full production parity gaps remain separate acceptance work. The human decision exchange is complete; later prototype work and physical acceptance remain separate.
