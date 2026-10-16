# Focused B inspector prototype

## Question and authorization

Does the confirmed inspector layout keep varied, long forms and their feedback/actions usable on desktop and compact screens without losing drafts? The human explicitly asks to continue with [Validate the responsive inspector form in the B prototype](../tickets/17-prototype-inspector-form.md), after confirming the complete [inspector-form Resolution](../tickets/14-decide-inspector-form-refinements.md#resolution).

Use one focused rendering within the accepted B/Dock preview. Earlier whole-page alternatives and Header/Bottom comparisons have already served their decisions; this iteration does not reopen them. Keep the accepted Fields manager and separate baseline application. Prototype state stays in memory.

## Baseline

Fresh origin fetch on 2026-10-16 confirms `8ff3d47a6e6bbfc957c7b3fec19ec856b49225ae`, intentionally 0 main-only / 17 feature-only versus `origin/main = 629d2a98715c3a16b954e0f77c639b1f0c31212c`. No tracked application changes exist at intake. Source issue 3 is open, with unchanged requirements and no comments. Preserve unrelated local environments, evidence, servers and browser tabs.

## Coordination

The coordinator owns this report, ticket/map updates and shared Git/publication on the existing preview branch and draft PR. SOL 6.1 High defines the smallest rendering/state/command boundary first. Luna XHIGH owns application implementation; a separate Luna XHIGH worker owns focused QA code/evidence and the isolated preview runtime. Independent SOL reviews examine the frozen candidate before publication. Existing draft conflict and deletion paths require particular preservation attention; the design brief determines the precise boundaries before code changes.

QA owns `.scratch/interface-revamp/device-preservation-lab/inspector-form-2026-10-16/` and the shared isolated dependency runtime. It starts with baseline source identity and local development captures. Application writers must not race runtime copies or builds; source is copied only at an explicit handoff. No broad functional or physical-device acceptance is inferred from bounded checks.

## Required behavior

- Visible, selection-appropriate sections; fluid full-width name/Description; one compact-screen column; optional paired short controls on desktop.
- Persistent bottom Apply / Discard changes with compact save/error access, accessible top Hide and internally scrolling content. Keep Delete separate with its existing consequence review.
- Description means the actual object description. Keep native/custom distinction and user-defined labels/values; use readable existing catalogue terms and preserve Other subtype text. Do not introduce system/cluster descriptions.
- Preserve draft identity, Hide/reopen, invalid Apply, guarded context changes, Fields conflicts and the in-memory/durable-save distinction. Do not claim successful Apply for unsupported prototype operations.
- Record known baseline controls that remain outside the representative prototype; omissions do not waive full feature preservation in the final refactor.
- Local development checks and a compiled-production layout check, including portrait, short landscape and reduced-height viewports. Vercel is the human phone preview; keyboard hardware/safe areas and the final human verdict remain separate.

## Execution status

### Bounded design brief

SOL architecture selects the Sensitive route because Apply and deletion touch established draft, validation and destructive-operation seams. Implement a new B-only `PrototypeBInspector.vue`; leave the existing `PrototypeInspector.vue` and its A/C renderings unchanged. Workbench retains its single existing draft, selection and transition-guard owner. Any dense fixture belongs to a separate opt-in B-only helper; preserve the ordinary seed and accepted Fields fixture.

Keep the existing six models (name, description, Jump level, unresolved exit, custom values and native values) and existing hide/apply/discard/delete/Manage-with-real-opener/retry events. Do not introduce a second local draft. Add narrow capability, coverage, structured-error and readable-label presentation inputs. Stable control identities support labels, inline errors and feedback links.

Supported memory operations: object Name/Description/native/custom fields; route name/Jump level/unresolved exit; system name. B Orbit and chart fallback are read-only summaries, with deletion where already supported. Gate unsupported or stale Apply in Workbench itself: return false without mutation, draft synchronization, simulated save or success message. Remove unsupported system/chart Session notes rather than inventing stored fields. Baseline omissions remain explicit prototype gaps.

B-only prevalidation reuses existing rules for exposed controls and reports invalid input without silently clamping or substituting it. Invalid Apply retains draft/workspace and cannot advance an Apply/Discard/Stay transition. Preserve the existing Fields-conflict handling and renewed impact review. Use readable existing catalogue names, retaining custom subtype text.

The current prototype has image exports but no applied-workspace JSON download. Add the required recovery action narrowly in Workbench by reusing the existing workspace codec, without modifying it or the interchange schema. Download the currently applied sample workspace with an explicit prototype filename; do not include an uncommitted draft or imply durable storage. A B renderer export event may be added for this action. Verify a downloaded sample with the existing decoder.

Give the B aside/card a definite available height, header/body/footer rows and one internally scrolling body. Full-width text, multiline custom text, compact bounded feedback, reachable top Hide and ordinary bottom actions must work at reduced heights without outer double scrolling. Keep full error detail reachable from the footer and inline fields; Delete remains at the end of the body.

Source inspection reveals that the current generic prototype deletion dialog plans its cascade only after confirmation. Correct B only: compute the existing pure deletion plan before opening review, display the target and exact affected entities without mutation, and commit only the reviewed workspace snapshot. If the workspace changed, refresh review and require confirmation again. Cancel/Escape preserves workspace, selection and drafts. Confirmed deletion alone can abandon the deleted target's draft, explicitly disclosed. Do not create another cascade algorithm or change A/C behavior.

Independent technical and domain/data reviews will inspect the same frozen candidate. QA's focused matrix covers layout/dense text, reduced-height feedback access, native/custom value distinctions, draft retention/Discard/Apply, invalid guards, Fields conflict, capability gates, exact/canceled deletion and simulated save retry, followed by compiled-production layout checks. Results remain pending.

### First frozen candidate

Luna completes the three-file application candidate and freezes writes. The coordinator verifies these SHA-256 values:

| File | SHA-256 |
| --- | --- |
| `PrototypeBInspector.vue` | `D97E5CC72E05F907D9232E231D307402B70BD7B5012F9EDCCF8E43707EA1AE1E` |
| `PrototypeWorkbench.vue` | `2D18B8652CE3E28593FD7EBD71783D175804ED7F5BF1B86CA2EDDAEE191F39AC` |
| `prototype-inspector-fixture.ts` | `971DA11D6FE447B4CAF454FEAAB0954BD4CD4644B5A0E7E85D0DEC565CBE3CE5` |

Whitespace checks pass. Component/template typing and browser behavior remain unverified at this handoff. Independent SOL technical and domain/data reviews inspect this snapshot; QA receives explicit permission to copy only these three files into its runtime. The first successful simulated save attempt triggers the existing first-failure scenario; the dense fixture is opt-in through the initial B `inspectorSample=dense` query.

### Runtime preflight limitations

Default-sandbox process/network checks proved unreliable. An existing dev process was incorrectly classified as absent; QA removed its lock before an escalated process check corrected that conclusion. No application source or process was changed by that metadata removal. The coordinator then authorizes restart only of the exact verified, root-owned preview runtime process. The restarted development server displays Nuxt's build-progress screen during baseline readiness attempts; those images are not usable application baseline captures or passing tests. Keep this environment history distinct from candidate behavior and use the final local production runtime if development readiness remains unavailable.

### First review findings and correction cycle

Both independent reviewers verify the frozen hashes. The domain/data review finds no blocking defect in capability refusal, native/custom/hidden-value preservation, Fields conflicts, applied-state JSON export, reviewed deletion or seed isolation. These are source findings, not runtime acceptance.

The technical review identifies five confirmed P2 defects: a blank object Name returns the stale-target message before publishing its inline errors; Nuxt UI's FormField context overrides the manually supplied invalid state; custom multiline text lacks full-width styling; the main B header still renders raw catalogue identifiers; and arrow keys on focused feedback containers can trigger the development variant switcher. The coordinator inspects the relevant paths, accepts all five findings and returns them to Luna as one bounded correction cycle. Preserve error/label associations when connecting Nuxt UI FormField errors, avoiding duplicate messages. No runtime source update occurs until the corrected freeze.

The initial snapshot's `npm run typecheck` completes with exit 1 and one diagnostic: `PrototypeWorkbench.vue(885,54): TS2339`, accessing `options` without sufficient narrowing of the custom-field definition union. Add the explicit type discrimination to this same correction cycle; do not suppress the diagnostic or cast around it. QA does not build or run the full matrix against this rejected snapshot and holds for corrected source. No new acceptance result is recorded yet.

### Corrected frozen candidate

Luna applies all five technical corrections and explicitly narrows the single-select definition before reading options. Updated SHA-256 values are `010D58FEDEED2780BEE57223E950B7BDD5D5233C2054DC20E18BAF7FCB24DF3E` for `PrototypeBInspector.vue` and `B102BD8230E2D4E819D68B0B516DF9A3E39D34751AB8A3D9EA7CA090A6BB7D7D` for Workbench. The fixture retains `971DA11D6FE447B4CAF454FEAAB0954BD4CD4644B5A0E7E85D0DEC565CBE3CE5`. The coordinator verifies all three and confirms the baseline inspector, Fields components/fixture, domain, composables and page routing have no diff.

Independent technical re-review finds no remaining blocker in the corrected scope, including Nuxt UI's generated label/error associations and the nonduplicated error slot. Complementary domain re-review also finds no blocker: reversing the five bounded Workbench corrections reconstructs initial reviewed hash `2D18B8652CE3E28593FD7EBD71783D175804ED7F5BF1B86CA2EDDAEE191F39AC`, confirming deletion, JSON recovery, Fields semantics and the ordinary seed are unchanged. It separately verifies specific Name feedback and preservation of custom-value distinctions through explicit type narrowing. Fresh runtime checks remain separate. QA receives explicit permission to copy only the two corrected files; source writes remain frozen while checks run.

### Corrected compilation

QA verifies all three corrected runtime source hashes against the frozen checkout. The corrected candidate's `npm run typecheck` passes with exit 0 in the isolated preview runtime, using `C:\nodejs\npm.cmd`. The original candidate's single TS2339 failure remains separate historical evidence.

The first corrected production-build attempt uses the default sandbox and exits 1 during Nitro assembly with an `EPERM` resolving Vue's `index.mjs`, after client and server bundling. QA verifies the process has exited and retries the identical command with the authorized elevated local environment. This second `npm run build` passes with exit 0 (Nuxt 4.6.0, Nitro 2.13.4), without application or dependency changes. Keep the environment failure distinct from source validation. Browser results against the compiled candidate remain pending.

### Compiled-production smoke

The compiled candidate runs on local port 3144. The initial dense-inspector smoke passes at 1440×900 and 390×500 with no uncaught page errors. The compact card measures `(13, 11, 364, 476)`; its footer ends at y=487 with no horizontal overflow. The coordinator visually inspects both screenshots and confirms the header, body and ordinary-action footer composition. These two smoke checks do not substitute for the focused behavior matrix or physical-phone acceptance.

### Final focused production validation

The final complete execution passes **11/11 cases**, with no uncaught page errors, against the same corrected frozen source. See the [reproduction and limits](../device-preservation-lab/inspector-form-2026-10-16/README.md), [runner](../device-preservation-lab/inspector-form-2026-10-16/qa-inspector-form.mjs) and [final machine-readable results](../device-preservation-lab/inspector-form-2026-10-16/qa-inspector-form.json).

- Desktop dense sections, readable catalogue labels and full-width multiline custom text.
- Portrait, short landscape and reduced-height layouts, with Hide/reopen, theme/resize draft retention and persistent actions.
- Blank Name refusal, linked inline/summary feedback, actual invalid/error-description accessibility attributes, retained input and keyboard focus; feedback arrow keys keep B selected.
- Apply, Discard, simulated first-save failure and Retry; applied-state recovery export excludes a separate dirty draft.
- Route/system editing and the read-only Orbit capability boundary.
- Fields Stay/resumption, Discard of the object draft, and Apply of the object draft followed by a renewed multi-object impact review.
- Delete Cancel and compact Escape retain the exact modified draft and selection. Confirmed deletion removes Aster, its hosted Orbit and Morrow while preserving unrelated entities.

Both real JSON downloads pass the unchanged `prepareJsonImport` decoder: dense applied data has 3 systems, 13 objects, 6 Orbits, 4 routes and 7 custom fields; ordinary data after confirmed deletion has 3 systems, 11 objects, 5 Orbits, 4 routes and 3 custom fields. Downloaded values establish applied-only export behavior rather than a new interchange format.

Earlier partial runs exposed harness assumptions, not confirmed application defects: compact mount/transition timing, controls intentionally covered by a fullscreen panel, exact domain labels, USelect button interaction, reading dismissed modal content and choosing an option already applied to the object. Retain their attempt reports separately; the final 11-case result is one complete execution, not combined partial passes. No application changes occur after the corrected source freeze.

The coordinator also inspects desktop, compact validation, light short-landscape, deletion-review and renewed-Fields-impact screenshots. Viewport emulation does not establish physical touch, virtual-keyboard or safe-area acceptance. Chart fallback refusal and stale deletion-plan renewal retain independent source-review evidence; the browser matrix does not force unreachable state through injection. Full baseline control parity, durable saving, final Nuxt UI adoption and the human's verdict remain outside these scoped passes.

### Artifact handoff

The existing preview branch and draft PR carry this focused inspector refinement. Ticket 17 remains in progress for the human's reaction to the artifact. On a phone, open the dense sample and Inspect; review scrolling and bottom actions with the keyboard visible in portrait and landscape, then Hide/reopen a modified draft. Reload resets the sample. No product merge or source-issue closure follows from delivery.

### Human acceptance

2026-10-16 — After delivery, the human explicitly accepts this prototype. [The ticket Resolution](../tickets/17-prototype-inspector-form.md#resolution) closes the artifact decision and records published commit `be8bef3e9efaea76b986480a40de6bd260e59d18`, fresh origin comparison and the unchanged source request. The earlier handoff paragraph describes delivery-time status. This acceptance adds no scenario-specific physical-device claims and does not decide final Nuxt UI adoption. The next planning step consolidates current evidence and concrete integration risks before that separate adoption decision and specification.
