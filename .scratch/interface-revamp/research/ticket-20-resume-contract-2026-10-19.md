# Ticket 20 resumed contract: chart sessions and save recovery

## Authority and evidence boundary

Read-only source reassessment on 2026-10-19, for the explicit resumption of ticket 20. Coordinator-confirmed baseline: `92c4bd85a2891bb1144c01e19d2b6088a93d5a7b`, intentionally above `origin/main = 629d2a98715c3a16b954e0f77c639b1f0c31212c` (0 main-only / 38 feature-only). The coordinator owns the fetch, Git lifecycle and source issue 3, which remains open and unchanged.

Authority: ticket 20; corrected specification stories 66, 82–93, 99 and 117; the 2026-10-16 fidelity reset; current ticket 18/19 Resolutions. The old ticket-20 contract and implementation are useful prior art. Their historical passing tests do not establish current acceptance. This investigation starts no runtime, tests, server or build and claims no browser pass.

Six pre-existing modified test files are protected work: `tests/cluster-map.spec.ts`, `tests/helpers.ts`, `tests/object-fields.spec.ts`, `tests/workspace-chart-drafts.spec.ts`, `tests/workspace-data.spec.ts`, and `tests/workspace-ui.spec.ts`. Inspect and extend only with their existing edits retained; do not reset them to make a run green.

## Sound contracts already present

Retain these implementations unless current runtime evidence establishes a defect:

- `useLocalWorkspace` remains the single page persistence owner. `applyWorkspace` validates/detaches and publishes synchronously, returning a separately handled durable promise. The queue and revision prevent older completions from updating newer feedback. `retrySaveLatest` snapshots applied memory without replaying a command. Backup restoration remains durable-before-publication.
- `useEditorState` owns the chart session independently of its modal: session sequence, captured cluster/system IDs, initial names, current name refs and validation error. Watchers avoid replacing owned draft content. Apply resolves captured IDs against latest workspace memory and ends only that session after publication. Durable rejection does not become a form error or reopen the form.
- The asynchronous transition resolver has one pending owner, rejects concurrent requests, distinguishes clean/modified chart sessions and supports Apply/Discard/Stay. Invalid Apply or Stay retains the designated editor. Independent map commands can preserve chart ownership. Selection continuations reacquire context/target after awaiting the guard; delayed import navigation does not take over another pending guard.
- System deletion prepares/confirms before resolving a targeted chart session, then rebuilds its plan and repeats confirmation if memory changed. Initial review cancellation retains the hidden draft/error. Later entity Apply adapters remain owned by tickets 22/24/26, and import memory-first conversion remains ticket 27.
- `ChartNamesDialog` already uses configured Nuxt UI modal/form/input/button primitives, a scrollable body, separate footer actions, opener focus return, field-associated errors and a semantic keyboard outline. Existing chart summaries remain consultation content without invented descriptions.
- Actual JSON recovery uses existing applied-workspace codecs. `beforeunload` warns for modified chart/welcome drafts or applied non-durable memory; it does not imply durable drafts or universal browser support.

The current chart suite already contains causal tests for hidden/resumed drafts, clean versus guarded transitions, invalid Apply, independent placement, export separation, actual aborted writes/latest retry, old success/failure, reviewed system deletion, keyboard outline and delayed import/selection races. Preserve this coverage; rerun it against the actual resumed source.

## Concrete remaining work

### Compact bottom feedback, without the decorative footer

`BaselinePage.vue:319` still reserves a full-width sticky footer row. `WorkspaceHeader.vue:190` repeats permanent save status, while `WorkspaceDock.vue:62` repeats the same save message in a live region. The footer contains useful recovery rather than decorative prose, but merely changing its HTML tag does not satisfy story 117 or the reset's prohibition on duplicate permanent status rows.

Ticket 20 owns a bounded feedback correction:

1. Replace the full-width reserved footer row with one compact bottom feedback surface in the workspace. Keep its resting content concise: save state and a named draft reopening action when a session exists. Preserve persistent readable failure indication and immediate access to Retry and current Jump Cluster JSON. Nuxt UI configuration/slots or a small application positioning adapter are suitable; toasts cannot be the sole recovery path.
2. Remove the duplicated Header save badge and the Dock's save-status announcement; save feedback should have one active announcement owner. This is a small removal from the touched seam, not a Header redesign. Do not replace it with another permanent status row.
3. Reuse the same feedback content in the already existing compact-panel recovery slot. Keep the background instance hidden/inert while the exclusive compact panel owns presentation. Do not mount another editor or transfer draft ownership.
4. If details are collapsed, retain the visible Not saved state, named error access and Retry/JSON reachability; expanding/collapsing must not clear failure. A previous failure remains accessible during retry until latest successful durability. Export failure stays independently readable and cannot clear a storage error.
5. Remove or condition the permanently green status dot in `WorkspaceFeedback.vue`: the current literal `--status-good` also decorates Saving and Not saved. Keep text/non-color state distinctions.
6. The current `hasChartNameDraft` means any open session, including a clean one, while the copy says “Unapplied chart-name changes.” Use accurate session wording or distinguish changed content, retaining the reopening path for a hidden clean session. Do not change clean-transition prompting policy.

The new compact surface must improve available map space in actual captures. Ordinary hit testing must show it does not cover map context/Back, creation, zoom, panel actions or modal actions. Keep it bottom-oriented and subordinate to the board; do not move recovery into the oversized application header. Measure wrapped failures and short screens rather than using fixed padding as proof of reachability.

### Chart modal: verify before altering sound layout

The source bounds the whole modal to the dynamic viewport and scrolls the body; the title/description and form eyebrow still add vertical density. Source alone does not prove a short-screen failure. First test the current title/body/footer at 390×844, 844×390 and 390×500 in both palettes, including invalid Apply and guard mode. If action or field reachability fails, reduce secondary explanation/eyebrow and configure Nuxt UI slots/classes before introducing a custom envelope. Top dismissal continues to hide editor content or resolve a guard as Stay. Do not introduce a full Inspector or Fields redesign under this ticket.

### Persistence and guard checks

No source-backed reason was found to replace the queue, session model or guard engine. Retain them and fault the real writes. The newest state alone may claim Saved; a failed save retains applied memory and a persistent recovery route; Retry snapshots latest applied memory, excludes drafts and never replays commands. Explicitly observe a guarded transition and ended chart form before a held durable acknowledgment, then fail/retry that write. Confirm another applied edit and a newer unapplied session survive an older success/failure.

## Boundary with ticket 21 and fidelity acceptance

Current root `pages/index.vue` still mounts `BaselinePage`. The loaded-map shell retains the rejected top Dock, three-column framed map, dense Header and initially open Hierarchy. The current prerequisite Resolutions explicitly leave loaded-map B/Dock repair to ticket 21. Do not expand ticket 20 into moving the Dock/zoom, rebuilding panel geometry/resizing, changing initial panel policy, or redesigning the Header. Do not claim whole-interface fidelity acceptance for this ticket.

For the feedback and chart-modal surfaces changed here, preserve the accepted direction: compact chrome, bottom subordinate feedback, reachable actions, full workspace board as the later composition target. Compare actual integrated captures with `?variant=B&controls=dock` at comparable viewport/palette/context/panel state, recording fixture differences and the inherited ticket-21 shell differences explicitly. Behavioral passes cannot waive a changed-surface obstruction. Ticket 21 will integrate these retained feedback/session contracts into the corrected bottom Dock/full-board/overlay composition.

## Bounded implementation and validation scope

Primary implementation scope: `components/WorkspaceFeedback.vue`, the feedback placement/wiring in `components/BaselinePage.vue`, narrowly related styles in `assets/css/map-workspace.css`, removal of duplicate save status wiring in `WorkspaceHeader.vue` and `WorkspaceDock.vue`. `ChartNamesDialog.vue` changes are conditional on actual modal findings. Core composables should remain unchanged absent a reproducible defect. No schema/storage-adapter/codec/domain/package/provider changes, durable drafts, generic state framework or production test API.

Primary browser scope: `tests/workspace-chart-drafts.spec.ts`; extend it for truthful clean-session copy and compact recovery reachability/expansion if introduced. Adapt `activeWorkspaceFeedback` in `tests/helpers.ts` to the visible named feedback surface rather than the removed footer/CSS location, preserving its existing unrelated changes. Update only affected feedback selectors in `tests/workspace-theme.spec.ts` while retaining all theme/draft/error assertions. `tests/workspace-ui.spec.ts` may need narrow expected placement/reachability assertions; its pre-existing work remains intact. Do not weaken cluster-map/data/object-fields assertions to hide unrelated failures.

Required evidence: affected chart/theme/launch-recovery checks; ordinary keyboard and pointer/touch feedback/modals at the three compact viewports plus desktop; both palettes; actual current JSON download; aborted writes/latest retry/durable reload and old-completion races; relevant contrast against composited backgrounds (text 4.5:1, meaningful controls/graphics 3:1), unobscured focus and focus return. Run appropriate typecheck/build, then compiled-production changed-surface checks. Record source/runtime/fixture/browser/viewport/input and passed/failed/unexecuted/unavailable outcomes. Preserve isolated storage and restore platform fault patches in cleanup. Physical Android Chrome OS-keyboard/safe-area/gesture validation remains unavailable unless actually performed; viewport emulation is supplementary evidence only.
